/* global lucide */

/**
 * Chapter IV · THE DEEP: the phase. Holds the colony's state, runs its
 * calendar (one real second is one day awake), draws the chrome over the model,
 * and saves. The rules live in deep.js, the positions in layout.js and the model
 * in scene.js; this file is the wiring between them.
 *
 * Since v1.43.0 cryo is a STATE. Awake, the day timer ticks once a second. Asleep,
 * a 10 Hz sleep timer runs the colony at the tier's rate (a month to a hundred
 * thousand years a real second) until an alarm wakes it or the player does; the
 * frame loop only rolls the numbers between those ticks.
 *
 * Since v1.46.0 something stays awake while the colony sleeps: the Watcher (watcher.js). Its
 * meter, its riddles and the snap of the base are wired here; the softening is the scene's.
 *
 * `window.__rpiPaused` (the shell's pause button) stops the chapter's clocks: no colony days
 * awake or asleep, no drift, and the scene renders without moving anyone.
 */

import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS, DEBUG_KEY } from '../constants.js';
import {
    initialDeepState, tickDay, sleep, digCost, roomCost, levelCost, automationCost,
    COLUMN, ROOMS, DAYS_PER_YEAR, CRYO, CHAPTER_V, MAX_AUTO,
    cryoLabel, cryoName, group, probeCost, PROBE_ENERGY, launchProbe, resolveDueProbes,
    clearChamber, clearDarkType, stalledRooms, attemptAscent, canTryAscent, ascentOdds, SURVIVAL_AT,
    startBuild, completeBuilds, buildProgress, buildPending, estimateNow, habitableYear,
    sleepTrouble, repairTick, scoutOdds, scoutsOut, MIN_SLEEPERS, RESURFACE_AT,
    ASCENT_MIN_PEOPLE, ordersDone, mourn,
} from './deep.js';
import {
    conditions, advisorLines, pushFeed, ROOM_WORD, DESCENT_LINE, alarmLine, alarmGlyph,
    scoutLine, scoutSentLine, troubleClause, ascentFailLine,
} from './advisor.js';
import {
    ledger, buySentence, preview, deltaText, stocks, flows, flowText, previewStocks,
    nextOrePrice, affordText, cryoReadyLine, consequence, span, rateWords,
    short, backIn, cryoNeed, offerFor, lowPoint, rewardShows,
} from './readout.js';
import { initialLayout, freeChamber, normalizeLayout } from './layout.js';
import { createScene, supportsWebGL, ROOM_ICON } from './scene.js';
import { createCrust } from './crust.js';
import { createReplay } from './replay.js';
import { serializeDeep, saveToStorage, loadFromStorage } from './persistence.js';
import {
    normalizeWatcher, watcherName, watchSleep, alarmHit, snap as snapWatcher, softness, watcherLines,
    puzzleDue, openPuzzle, beginSleep, dismissPuzzle, answerPuzzle, puzzleText, puzzleStars, sleepDays,
    CAPACITY_MAX, STABILITY_MAX, firstSleep, FIRST_SLEEP_DAYS, WATCHER_HELLO, snapWait, SNAP_COOLDOWN_MS,
} from './watcher.js';
import { playChapterCard } from '../chapterCard.js';
import { doomsday } from '../phase3/war.js';

const { SAVE_KEY, MAX_CATCHUP_DAYS } = PHASE4_CONSTANTS;
const BAR_H = 160;                 // the track's height in CSS pixels
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
/** The shell's pause (main.js owns the flag): the chapter's clocks hold while it is set. */
const paused = () => typeof window !== 'undefined' && !!window.__rpiPaused;
/** A click on the base is a click, not the end of a drag that turned the camera. */
const CLICK_PX = 6, CLICK_MS = 500;

/** The walk into the hall, the odometer spin of falling asleep, the walk out. Seconds. */
export const SLEEP_TIMING = { gather: 1.5, spin: 1.5, release: 1.2 };
/** Asleep, the colony is advanced this often (ms); the frames roll the numbers in between. */
const SLEEP_TICK_MS = 100;

let abortController = null;
let dayInterval = null;
let sleepInterval = null;
let rafId = 0;
let scene = null;
let crust = null;
let replay = null;
let savingEnabled = true;
let beforeUnloadHandler = null;
let iconRefreshQueued = false;

/** Debounced lucide pass: never called straight from a loop. */
function scheduleIconRefresh() {
    if (iconRefreshQueued) return;
    iconRefreshQueued = true;
    requestAnimationFrame(() => {
        iconRefreshQueued = false;
        try { lucide.createIcons(); } catch { /* the CDN is not there; the glyphs are not the game */ }
    });
}

/** Every number in chapter IV, counters and rates included (v1.45.0): "313 k", "2.3 B", "9 M".
 *  One short form, so the numbers over the bars never run into each other. See `short()`. */
export const formatCount = short;

/** Day 0 is the day the exit was blown: year 0, month 1, day 1. */
export function calendar(day) {
    const d = Math.max(0, Math.floor(day));
    const year = Math.floor(d / DAYS_PER_YEAR);
    const rest = d - year * DAYS_PER_YEAR;
    // twelve months of thirty days, and the last one holds the five left over (day 31 to 35):
    // counting its days modulo 30 made the clock run backwards at the end of every year
    const month = Math.min(12, Math.floor(rest / 30) + 1);
    return { year, month, day: rest - (month - 1) * 30 + 1 };
}

/**
 * What came down the hole: the salvage the war left and how scorched the
 * surface was the day the exit was blown. Read out of chapter II's save, which
 * is where the war state lives; defaults when there is nothing to read.
 * @returns {{salvage?:number, doom0?:number}}
 */
export function seedFromWar(raw) {
    try {
        const war = raw ? JSON.parse(raw)?.war : null;
        if (!war) return {};
        const seed = {};
        if (Number.isFinite(war.salvage) && war.salvage > 0) seed.salvage = Math.max(1500, Math.round(war.salvage));
        const doom = doomsday((war.scorchOurs || 0) + (war.scorchTheirs || 0));
        if (Number.isFinite(doom)) seed.doom0 = Math.max(RESURFACE_AT * 2, Math.min(100, doom));
        return seed;
    } catch {
        return {};
    }
}

export function init() {
    abortController = new AbortController();
    const signal = abortController.signal;
    savingEnabled = true;

    document.body.classList.add('in-deep');

    // --- state: what was saved, or what the war left us ---
    let state, layout;
    const saved = loadFromStorage(SAVE_KEY);
    if (saved) {
        state = saved.state;
        layout = saved.layout;
    } else {
        let stored = null;
        try { stored = localStorage.getItem(PHASE2_CONSTANTS.SAVE_KEY); } catch { /* ignore */ }
        state = initialDeepState(seedFromWar(stored));
        layout = initialLayout(state);
    }
    layout = normalizeLayout(state, layout);
    state.watcher = normalizeWatcher(state.watcher);

    const ui = {
        sceneHost: document.getElementById('deep-scene'),
        labelHost: document.getElementById('deep-labels'),
        fallback: document.getElementById('deep-fallback'),
        year: document.getElementById('deep-year'),
        month: document.getElementById('deep-month'),
        dayOfMonth: document.getElementById('deep-day'),
        minerals: document.getElementById('deep-minerals'),
        stars: document.getElementById('deep-stars'),
        oreRate: document.getElementById('deep-minerals-rate'),
        starsRate: document.getElementById('deep-stars-rate'),
        oreRow: document.getElementById('deep-ore-row'),
        starsRow: document.getElementById('deep-stars-row'),
        flowIn: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-in-${c}`)])),
        flowOut: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-out-${c}`)])),
        advisor: document.getElementById('deep-advisor'),
        feed: document.getElementById('deep-feed'),
        starsDay: document.getElementById('deep-stars-day'),
        heads: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-head-${c}`)])),
        fills: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-fill-${c}`)])),
        dots: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-dot-${c}`)])),
        ghosts: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-ghost-${c}`)])),
        deltas: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-delta-${c}`)])),
        bars: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-bar-${c}`)])),
        digBtn: document.getElementById('deep-dig-btn'),
        roomBtns: ['mine', 'farm', 'generator', 'dorm'].map((t) => ({ type: t, el: document.getElementById(`deep-room-${t}`) })),
        levelBtn: document.getElementById('deep-level-btn'),
        autoBtn: document.getElementById('deep-auto-btn'),
        cryoBtn: document.getElementById('deep-cryo-btn'),
        wakeBtn: document.getElementById('deep-wake-btn'),
        cryoBadge: document.getElementById('deep-cryo-badge'),
        cryoCaption: document.getElementById('deep-cryo-caption'),
        cryoUpCaption: document.getElementById('deep-cryo-up-caption'),
        probeBadge: document.getElementById('deep-probe-badge'),
        cryoUpBtn: document.getElementById('deep-cryo-up'),
        cryoUpBadge: document.getElementById('deep-cryo-up-badge'),
        probeBtn: document.getElementById('deep-probe-btn'),
        ascendBtn: document.getElementById('deep-ascend-btn'),
        resetBtn: document.getElementById('deep-reset-view'),
        crust: document.getElementById('deep-crust'),
        replay: document.getElementById('deep-replay'),
        root: document.getElementById('phase-deep'),
        watcher: document.getElementById('deep-watcher'),
        watcherName: document.getElementById('deep-watcher-name'),
        stabFill: document.getElementById('deep-stab-fill'),
        stabVal: document.getElementById('deep-stab-val'),
        capFill: document.getElementById('deep-cap-fill'),
        puzzle: document.getElementById('deep-puzzle'),
        puzzleQ: document.getElementById('deep-puzzle-q'),
        puzzleIn: document.getElementById('deep-puzzle-in'),
        puzzleSaid: document.getElementById('deep-puzzle-said'),
        snapRing: document.getElementById('deep-snap-ring'),
        snapArc: document.querySelector('#deep-snap-ring .arc'),
    };
    replay = createReplay(ui.replay, { onIcons: scheduleIconRefresh, format: formatCount });

    // --- the model ---
    if (supportsWebGL()) {
        try {
            scene = createScene(ui.sceneHost, {
                labelHost: ui.labelHost,
                onInteract: () => ui.resetBtn.classList.add('is-on'),
                onLabels: scheduleIconRefresh,
                onClearDark: (slot) => clearDark(slot),
            });
        } catch (e) {
            console.error('the deep: the model could not be built', e);
            scene = null;
        }
    }
    if (!scene) ui.fallback.classList.add('is-on');
    // the ring rides on the crust slab in the model; the flat band is only for a browser without it
    crust = createCrust(scene ? scene.crustHost : ui.crust);
    ui.crust.hidden = !!scene;

    // A transition is playing (the walk into the hall, the spin, the walk out, the climb):
    // nothing is clickable. Asleep is not busy: the wake button is live the whole sleep.
    let busy = false;
    let advisorLine = '';           // what woke the colony, until the next purchase
    let feed = [];                  // the advisor's last lines, oldest first
    let toldAbout = null;           // the conditions the last feed line was written about
    let hovering = null;            // { kind, type } of the button under the cursor, for the preview
    let roll = null;                // the numbers rolling between two sleep ticks: { from, to, t0, dur, ease, done }
    let sleepSum = null;            // the whole sleep, added up chunk by chunk, for the wake-up strip
    let lastSleepAt = 0;
    let sleepTicks = 0;
    // what a dry run says would wake a sleep: today (`hall`, `current`, `next`), and once every
    // order on the books is built (`plannedHall`, `plannedNext`), which is what the player still has to buy
    let gates = { hall: null, current: null, next: null, plannedHall: null, plannedNext: null };
    let sleepFrom = null;           // the counters when the sleep began: does a reward show on them?
    let said = { key: '', text: '' };                         // the hovered button's consequence, per day

    // --- the day's report, for the bars and the advisor ---
    // A dry run on a copy: the same numbers the next real day will give, without
    // spending one. That is what the four columns and the dot are showing.
    const dryRun = () => tickDay(JSON.parse(JSON.stringify(state)), state.asleep);
    let report = dryRun();

    // A colony just down the hole is told what all of it is for.
    if (state.day === 0 && !feed.length) feed = pushFeed(feed, [DESCENT_LINE]);

    function saveGame() {
        if (!savingEnabled || window.__rpiSkipSave) return;
        saveToStorage(SAVE_KEY, serializeDeep(state, layout));
    }
    beforeUnloadHandler = () => saveGame();

    // --- the chrome ---
    function setTooltip(el, html) {
        const t = el.querySelector('.tooltip');
        if (t && t.innerHTML !== html) t.innerHTML = html;
    }
    /** The one-line caption beside a locked cryo button: the reason, without hovering. */
    function setCaption(el, text) {
        if (!el) return;
        if (el.textContent !== text) el.textContent = text;
        el.parentElement.classList.toggle('is-captioned', !!text);
    }
    /** A sentence goes into a tooltip as text, never as markup. */
    const escapeText = (s2) => String(s2).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    /** Costs and one plain sentence: the tooltip of a purchase says what will happen. */
    const says = (sentence) => (sentence ? `<span class="deep-says">${escapeText(sentence)}</span>` : '');
    /** The last line of a tooltip, set apart: what is missing, or what it does for the goal. */
    const note = (sentence, cls = '') => (sentence ? `<span class="deep-says deep-note ${cls}">${escapeText(sentence)}</span>` : '');
    const cost = (n, icon) => `<span class="deep-mono">${formatCount(n)}</span><i data-lucide="${icon}" class="w-4 h-4"></i>`;
    const mineralCost = (n) => cost(n, 'pickaxe');
    const starCost = (n) => cost(n, 'star');
    const roomMark = (type) => `<i data-lucide="${ROOM_ICON[type]}" class="w-4 h-4"></i>`;
    const priceRow = (html) => `<span class="deep-price">${html}</span>`;
    const perDayText = (v) => `${v >= 0 ? '+' : '-'}${formatCount(Math.abs(v))}/d`;

    /** The three numbers of the calendar. Split out because the sleep rolls them on
     *  their own, sixty times a second, and must touch nothing else. */
    function drawClock(day) {
        const cal = calendar(day);
        ui.year.textContent = group(cal.year);
        ui.month.textContent = cal.month;
        ui.dayOfMonth.textContent = cal.day;
    }
    /** The clock and the two counters, as the sleep rolls them. */
    function drawCounters(v) {
        drawClock(v.day);
        ui.minerals.textContent = formatCount(v.ore);
        ui.stars.textContent = formatCount(v.stars);
    }
    const snapshot = () => ({ day: state.day, ore: state.minerals, stars: state.stars });

    /** What a tier sleeps, per second, for the badge: "1 y/s". */
    const rateLabel = (tier) => `${cryoLabel(CRYO[tier].days)}/s`;
    /** What the stars are for next, named, for "toward Cryo II". */
    function starGoal() {
        const next = CRYO[state.cryo + 1];
        return next ? cryoName(state.cryo + 1) : 'the next level';
    }
    const tierDays = () => CRYO[Math.max(0, state.cryo)].days;

    /**
     * THE ONE REASON the next cryo tier is not there (v1.48.0): the caption beside the button, its
     * tooltip, and the room type the level and automate buttons offer are all read off this.
     * @param {number} [tier] - index into CRYO; the next one by default
     */
    function needFor(tier = state.cryo + 1) {
        if (!CRYO[tier]) return null;
        const hall = tier === 0;
        return cryoNeed(tier, {
            state,
            trouble: hall ? gates.hall : gates.next,
            planned: hall ? gates.plannedHall : gates.plannedNext,
            starsPerDay: report.stars,
        });
    }
    /** What the dot marks, and why: the store running low (v1.48.0). */
    const lowNow = () => lowPoint(state, report, stocks(state, report, nextOrePrice(state, report)));
    /** The room type the level and automate buttons sell today, and why. */
    function offers(need = needFor(), low = lowNow()) {
        return { level: offerFor('level', state, report, need, low), auto: offerFor('auto', state, report, need) };
    }

    /**
     * The tooltip of a purchase: the price, what it does, and then either what is still
     * missing (B064) or, for the button under the cursor, what it does for the goal (B060).
     */
    function buyTip(el, { kind, type, price, currency, sentence, blocked, mark = '' }) {
        const have = currency === 'stars' ? state.stars : state.minerals;
        const perDay = currency === 'stars' ? report.stars : report.parts.M;
        const priceHtml = Number.isFinite(price) ? (currency === 'stars' ? starCost(price) : mineralCost(price)) : '';
        const missing = affordText({ price, have, perDay, blocked: state.asleep ? 'asleep' : blocked });
        let goal = '';
        if (hovering && hovering.kind === kind && hovering.type === type && Number.isFinite(price)) {
            const key = `${kind}|${type}|${state.day}|${state.cryo}`;
            if (said.key !== key) {
                said = {
                    key,
                    text: consequence(state, kind, type, {
                        price, currency, tierDays: tierDays(), report, goal: starGoal(), clause: troubleClause,
                    }),
                };
            }
            goal = said.text;
        }
        setTooltip(el, priceRow(mark + priceHtml) + says(sentence) + note(missing, 'is-missing') + note(goal, 'is-goal'));
    }

    function updateChrome() {
        const cal = calendar(state.day);
        // asleep, the frame loop rolls the clock and the counters; nothing here may fight it
        if (!state.asleep && !roll) drawCounters(snapshot());
        ui.oreRate.textContent = perDayText(report.parts.M);
        ui.starsRate.textContent = perDayText(report.stars);
        ui.starsDay.textContent = formatCount(report.stars);
        scene?.setMachine(report.stars);

        // THE BARS ARE STORES (B056): each on its own scale, the weakest FLOW marked with the dot.
        // Under each, what comes in and what goes out in a day. Hovering a purchase draws a ghost
        // where the store would stand once it is paid for and finished, and the change in that
        // column's daily surplus over it.
        const orePrice = nextOrePrice(state, report);
        const st = stocks(state, report, orePrice);
        const fl = flows(state, report);
        // v1.48.0: the dot marks what runs LOW (days of cover), never a full bar
        const low = lowPoint(state, report, st);
        const need = needFor();
        const ahead = hovering ? preview(state, hovering.kind, hovering.type, report) : null;
        const ghost = hovering ? previewStocks(state, hovering.kind, hovering.type, hovering.price || 0, hovering.currency || 'minerals', orePrice) : null;
        for (const c of COLUMN) {
            const h = Math.round(BAR_H * st[c].frac);
            ui.fills[c].style.height = `${h}px`;
            ui.heads[c].textContent = st[c].head;
            ui.flowIn[c].textContent = flowText(fl[c].in, '+');
            ui.flowOut[c].textContent = flowText(fl[c].out, '-');
            const marked = c === low.column;
            ui.dots[c].classList.toggle('hidden', !marked);
            if (marked) ui.dots[c].style.bottom = `${Math.min(BAR_H - 4, h + 10)}px`;
            const g = ui.ghosts[c], d = ui.deltas[c];
            if (ghost) {
                g.style.height = `${Math.round(BAR_H * ghost[c].frac)}px`;
                g.classList.toggle('is-down', ghost[c].frac < st[c].frac - 0.005);
                g.classList.add('is-on');
            } else {
                g.classList.remove('is-on');
            }
            if (ahead) {
                d.textContent = deltaText(ahead.delta[c], c);
                d.classList.toggle('is-down', ahead.delta[c] < -0.5);
                d.classList.add('is-on');
            } else {
                d.classList.remove('is-on');
                d.textContent = '';
            }
        }
        ui.advisor.textContent = advisorLine
            || (state.asleep
                // the first sleep says one thing, once: what the label under the scene is
                ? (firstSleep(state.watcher) ? WATCHER_HELLO
                    : `Asleep: ${rateWords(CRYO[state.cryo].days)} a second. The hall wakes us if anything goes wrong.`)
                : `Year ${group(cal.year)}. ${low.line}`);
        // the feed: the last five things worth saying, newest at the bottom
        if (ui.feed.childElementCount !== feed.length
            || (feed.length && ui.feed.lastElementChild.textContent !== feed[feed.length - 1])) {
            ui.feed.textContent = '';
            for (const line of feed) {
                const row = document.createElement('div');
                row.className = 'deep-feed-line';
                row.textContent = line;
                ui.feed.appendChild(row);
            }
        }
        // each bar says where its number came from, in one sentence (B062)
        for (const c of COLUMN) setTooltip(ui.bars[c], escapeText(ledger(c, state, report)));
        setTooltip(ui.starsRow, says("Wins. The machine plays with the colony's surplus.")
            + note(`${formatCount(report.stars)} a day: ten for every unit of the weakest column.`));
        setTooltip(ui.oreRow, says(`Ore in store. ${perDayText(report.parts.M)} after the generators have burned theirs.`));

        const asleep = !!state.asleep;
        // the buttons
        const free = freeChamber(layout) >= 0;
        const digPrice = digCost(state.chambers);
        ui.digBtn.classList.toggle('is-locked', asleep || state.minerals < digPrice || buildPending(state, 'dig'));
        buyTip(ui.digBtn, { kind: 'dig', type: null, price: digPrice, currency: 'minerals', sentence: buySentence('dig', null, state), blocked: buildPending(state, 'dig') ? 'pending' : '' });
        showBuild(ui.digBtn, 'dig', null);

        for (const { type, el } of ui.roomBtns) {
            const price = roomCost(type, state.rooms[type] || 0);
            const pending = buildPending(state, 'room', type);
            el.classList.toggle('is-locked', asleep || !free || state.minerals < price || pending);
            buyTip(el, { kind: 'room', type, price, currency: 'minerals', sentence: buySentence('room', type, state), blocked: pending ? 'pending' : (!free ? 'chamber' : '') });
            showBuild(el, 'room', type);
        }

        // v1.48.0: the level and automate buttons sell what the NEXT GOAL needs (the next cryo tier),
        // then what runs low, then the weakest column, and their tooltips say which and why
        const offer = offers(need, low);
        const lvType = offer.level.type;
        const levelPrice = levelCost(lvType, state.level[lvType] || 0);
        const lvPending = buildPending(state, 'level', lvType);
        // levelling or automating a room type the colony has none of would buy nothing at all
        const noneOf = (t) => !(state.rooms[t] > 0) && !buildPending(state, 'room', t);
        const noneText = (t) => `Build a ${ROOM_WORD[t]} first: there is none to improve.`;
        ui.levelBtn.classList.toggle('is-locked', asleep || state.stars < levelPrice || lvPending || noneOf(lvType));
        buyTip(ui.levelBtn, { kind: 'level', type: lvType, price: levelPrice, currency: 'stars', sentence: noneOf(lvType) ? noneText(lvType) : `${offer.level.head} ${buySentence('level', lvType, state)}`, blocked: lvPending ? 'pending' : '', mark: roomMark(lvType) });
        showBuild(ui.levelBtn, 'level', lvType);

        // automation is teased once the first level is bought, or the moment cryo needs it
        const auType = offer.auto.type;
        const autoShown = Object.values(state.level).some((l) => l > 0) || need?.button === 'auto';
        ui.autoBtn.classList.toggle('hidden', !autoShown);
        if (autoShown) {
            const autoPrice = automationCost(auType, state.auto[auType] || 0);
            const auPending = buildPending(state, 'auto', auType);
            ui.autoBtn.classList.toggle('is-locked', asleep || !(state.stars >= autoPrice) || auPending || noneOf(auType));
            buyTip(ui.autoBtn, {
                kind: 'auto', type: auType, price: autoPrice, currency: 'stars', mark: roomMark(auType),
                sentence: noneOf(auType) ? noneText(auType) : (Number.isFinite(autoPrice) ? `${offer.auto.head} ${buySentence('auto', auType, state)}` : ''),
                blocked: (state.auto[auType] || 0) >= MAX_AUTO ? 'top' : (auPending ? 'pending' : ''),
            });
            showBuild(ui.autoBtn, 'auto', auType);
        }

        // ---- cryo: the hall, then the sleep; asleep, the sun that wakes the colony ----
        const tier = state.cryo;
        const owns = tier >= 0;
        ui.cryoBtn.classList.toggle('hidden', asleep);
        ui.wakeBtn.classList.toggle('hidden', !asleep);
        ui.cryoBadge.classList.toggle('hidden', !owns);
        if (owns) setCaption(ui.cryoCaption, state.humans < MIN_SLEEPERS ? `needs ${MIN_SLEEPERS} people` : '');
        if (asleep) {
            ui.wakeBtn.classList.toggle('is-locked', busy);
            setTooltip(ui.wakeBtn, says('Wake the colony.') + note(`${cryoName(tier)}: ${rateWords(CRYO[tier].days)} a second.`));
        } else if (owns) {
            ui.cryoBadge.textContent = rateLabel(tier);
            const few = state.humans < MIN_SLEEPERS;
            ui.cryoBtn.classList.toggle('is-locked', busy || few);
            const warn = few
                ? `A colony under ${MIN_SLEEPERS} people cannot sleep.`
                : (gates.current ? `It would wake on day ${Math.max(1, gates.current.day)}: ${troubleClause(gates.current)}.` : '');
            setTooltip(ui.cryoBtn, priceRow(roomMark('cryo') + `<span class="deep-mono">${rateLabel(tier)}</span>`)
                + says(`Sleep: ${rateWords(CRYO[tier].days)} a second. The colony runs until something wakes it.`)
                + note(warn, 'is-missing'));
        } else {
            // one reason, from one function, in the caption and the tooltip alike (v1.48.0); the hall
            // is dug with its own chamber, so it never waits for a free one
            setCaption(ui.cryoCaption, need ? need.short : '');
            ui.cryoBtn.classList.toggle('is-locked', busy || !!need);
            setTooltip(ui.cryoBtn, priceRow(roomMark('cryo') + starCost(CRYO[0].cost))
                + says(`${cryoName(0)}: a cryo hall, dug with its own chamber. Asleep, a month passes every second and the machines keep working.`)
                + note(need ? need.long : '', 'is-missing'));
        }
        // the next tier: on screen once the hall is dug, offered once a sleep at its rate is safe
        const nextTier = owns ? CRYO[tier + 1] : null;
        ui.cryoUpBtn.classList.toggle('hidden', !nextTier || asleep);
        if (nextTier && !asleep) {
            ui.cryoUpBadge.textContent = rateLabel(tier + 1);
            // the reason is on screen, not only under the cursor, and it is the tooltip's reason too
            setCaption(ui.cryoUpCaption, need ? need.short : '');
            ui.cryoUpBtn.classList.toggle('is-locked', busy || !!need);
            setTooltip(ui.cryoUpBtn, priceRow(roomMark('cryo') + starCost(nextTier.cost))
                + says(`${cryoName(tier + 1)}: sleep ${rateWords(nextTier.days)} a second.`)
                + note(need ? need.long : '', 'is-missing'));
        }

        // ---- scout parties: people up the shaft, for a reading of the sky ----
        // Everything about a party is on the button before it goes (v1.45.0): who, how long, the
        // odds of each way it can end, and how far a good reading may be off.
        const scoutsOn = owns || state.probesSent > 0 || state.probes.length > 0;
        ui.probeBtn.classList.toggle('hidden', !scoutsOn);
        if (scoutsOn) {
            const out = scoutsOut(state);
            const odds = scoutOdds(state);
            const people = state.humans - odds.people >= MIN_SLEEPERS;
            const power = report.parts.E >= PROBE_ENERGY;
            ui.probeBtn.classList.toggle('is-locked', busy || asleep || out || state.minerals < odds.price || !power || !people);
            const trip = out ? state.probes[0] : null;
            ui.probeBadge.classList.toggle('hidden', !out);
            if (trip) ui.probeBadge.textContent = backIn(trip.dueDay - state.day);
            const mark = ui.probeBtn.querySelector('.deep-build');
            mark.classList.toggle('is-on', !!trip);
            if (trip) mark.style.setProperty('--p', `${Math.round(100 * Math.min(1, (state.day - trip.sentDay) / Math.max(1, trip.dueDay - trip.sentDay)))}%`);
            if (trip) {
                setTooltip(ui.probeBtn, says(`Party out, back in ${backIn(trip.dueDay - state.day)}.`)
                    + note(`${Math.round(trip.people)} people went up. One party at a time.`));
            } else {
                const p = odds.pct;
                const missing = !people ? affordText({ blocked: 'people' })
                    : (!power ? `Needs ${PROBE_ENERGY} spare energy a day to open the hatch: ${formatCount(report.parts.E)} today.`
                        : affordText({ price: odds.price, have: state.minerals, perDay: report.parts.M, blocked: asleep ? 'asleep' : '' }));
                setTooltip(ui.probeBtn, priceRow(mineralCost(odds.price) + cost(odds.people, 'users'))
                    + says(`Scout party: ${odds.people} people, out ${span(odds.days)}. `
                        + `Return ${p.reading} %, lost ${p.lost} %, back wrong ${p.wrong} %, followed home by something ${p.monster} %. `
                        + `Reading ± ${odds.scatter} %.`)
                    + note(missing, 'is-missing')
                    + note('A good reading narrows the doubt on the ring.', 'is-goal'));
            }
        }

        // ---- the way up: you can always try (v1.45.0). The button never waits on the estimate;
        //      it says what the colony believes, and what a wrong guess costs ----
        const ao = ascentOdds(state);
        const canTry = canTryAscent(state);
        ui.ascendBtn.classList.toggle('is-locked', busy || asleep || !canTry);
        setTooltip(ui.ascendBtn, says(`Try to resurface: everyone goes up. Survival ${Math.round(ao.survival)} % `
                + `(± ${Math.round(ao.spread)}). Below ${SURVIVAL_AT} % the first ${formatCount(ao.party)} die and the rest wait.`)
            + note(asleep ? 'The colony is asleep: wake it to try.'
                : (!canTry ? `Too few of us: at least ${ASCENT_MIN_PEOPLE} people to send anyone up.` : ''), 'is-missing'));

        const est = estimateNow(state);
        const year = habitableYear(state);
        crust.update({ est, year: Number.isFinite(year) ? group(year) : '' });
        updateWatcher();
        scheduleIconRefresh();
    }

    /* ---- THE WATCHER (v1.46.0) ------------------------------------------------
       Only in the sleep world: a slow pulse, a name, a meter, a sliver of capacity, and now and
       then a riddle. No sentence says what it is. */
    let puzzleShown = null;          // the riddle the card is showing, so it is drawn once
    let lingerUntil = 0;             // a solved riddle stays on its card this long (performance.now)
    function updateWatcher() {
        const w = state.watcher;
        const asleep = !!state.asleep;
        if (ui.watcher) {
            ui.watcher.hidden = !asleep;
            if (asleep) {
                const name = watcherName(w);
                if (ui.watcherName.textContent !== name) ui.watcherName.textContent = name;
                const stab = Math.round(w.stability);
                const v = String(stab);
                if (ui.stabVal.textContent !== v) ui.stabVal.textContent = v;
                ui.stabFill.style.width = `${(100 * w.stability / STABILITY_MAX).toFixed(1)}%`;
                ui.capFill.style.width = `${(100 * w.capacity / CAPACITY_MAX).toFixed(1)}%`;
                ui.watcher.classList.toggle('is-low', w.stability < 35);
            }
            const want = asleep ? (w.puzzle || (performance.now() < lingerUntil ? puzzleShown : null)) : null;
            if (want !== puzzleShown) {
                puzzleShown = want;
                ui.puzzle.classList.toggle('is-on', !!want);
                if (want) {
                    ui.puzzleQ.textContent = puzzleText(want);
                    ui.puzzleIn.value = '';
                    ui.puzzleSaid.textContent = '';
                    ui.puzzleIn.disabled = false;
                    try { ui.puzzleIn.focus({ preventScroll: true }); } catch { /* ignore */ }
                } else if (document.activeElement === ui.puzzleIn) {
                    ui.puzzleIn.blur();
                }
            }
        }
        // the base: as soft as the meter says while the colony sleeps, rigid when it wakes
        scene?.setSoftness(asleep ? softness(w.stability) : 0);
    }

    /** The dry runs behind the cryo buttons. Once a colony day, never per frame. */
    let readyTold = state.cryo;       // the highest tier the advisor has called ready
    function recomputeGates() {
        if (state.asleep) return;
        const owns = state.cryo >= 0;
        const nextDays = CRYO[state.cryo + 1]?.days;
        const planned = (owns && !nextDays) ? null : ordersDone(state);
        gates = {
            hall: owns ? null : sleepTrouble(state, CRYO[0].days),
            current: owns ? sleepTrouble(state, CRYO[state.cryo].days) : null,
            next: owns && nextDays ? sleepTrouble(state, nextDays) : null,
            plannedHall: owns ? null : sleepTrouble(planned, CRYO[0].days),
            plannedNext: owns && nextDays ? sleepTrouble(planned, nextDays) : null,
        };
        // the day a longer sleep can be had, the advisor says so once: "Cryo IV is ready: a century a second."
        const want = state.cryo + 1;
        if (CRYO[want] && want > readyTold && !needFor(want)) {
            readyTold = want;
            feed = pushFeed(feed, [cryoReadyLine(want)]);
        }
    }

    function afterChange() {
        report = dryRun();
        recomputeGates();
        scene?.setState(state, layout);
        updateChrome();
        saveGame();
    }

    /** Buying anything for a room type is how a fault is cleared: the stall mark goes, and
     *  whatever took a chamber of that kind is driven out of it. The books are kept in deep.js. */
    function mendType(type) {
        if (state.stalled && state.stalled[type]) delete state.stalled[type];
        clearDarkType(state, layout.slots, type);
    }
    /** Or by clicking the dark plate itself, which is what the marker is for. */
    function clearDark(slot) {
        if (busy || state.asleep || !clearChamber(state, layout.slots, slot)) return;
        afterChange();
    }

    /** The filling ring on a button while its order is being built. */
    function showBuild(el, kind, type) {
        const mark = el.querySelector('.deep-build');
        if (!mark) return;
        const job = (state.builds || []).find((j) => j.kind === kind && (type === null || j.type === type));
        mark.classList.toggle('is-on', !!job);
        if (job) mark.style.setProperty('--p', `${Math.round(buildProgress(state, job) * 100)}%`);
    }
    /** Hovering a purchase is what draws the ghosts; leaving it puts the bars back. The type
     *  and the price are read when the cursor arrives, for the buttons that follow the dot. */
    function watchHover(el, what) {
        el.addEventListener('mouseenter', () => { hovering = what(); updateChrome(); }, { signal });
        el.addEventListener('mouseleave', () => { hovering = null; updateChrome(); }, { signal });
    }

    // --- buying: the price now, the thing itself in a few days ---------------
    function bought() { advisorLine = ''; said.key = ''; }
    function dig() {
        const price = digCost(state.chambers);
        if (state.minerals < price || buildPending(state, 'dig')) return;
        state.minerals -= price;
        startBuild(state, 'dig');
        bought();
        afterChange();
    }
    function buildRoom(type) {
        const slot = freeChamber(layout);
        if (slot < 0 || buildPending(state, 'room', type)) return;
        const price = roomCost(type, state.rooms[type] || 0);
        if (state.minerals < price) return;
        state.minerals -= price;
        // the chamber is spoken for the moment the order goes in, so the next order
        // cannot be given the same one
        layout.slots[slot] = null;
        startBuild(state, 'room', { type, slot });
        mendType(type);
        bought();
        afterChange();
    }
    /** Levels the room type the button offers (the next goal, what runs low, the weakest). */
    function levelWeakest() {
        const type = offers().level.type;
        if (buildPending(state, 'level', type) || !(state.rooms[type] > 0)) return;
        const price = levelCost(type, state.level[type] || 0);
        if (state.stars < price) return;
        state.stars -= price;
        startBuild(state, 'level', { type });
        mendType(type);
        bought();
        afterChange();
    }
    function automateWeakest() {
        const type = offers().auto.type;
        if (buildPending(state, 'auto', type) || !(state.rooms[type] > 0)) return;
        const price = automationCost(type, state.auto[type] || 0);
        if (!Number.isFinite(price) || state.stars < price) return;
        state.stars -= price;
        startBuild(state, 'auto', { type });
        mendType(type);
        bought();
        afterChange();
    }

    /** Orders that landed: the layout is told where a new room went and gets a fresh chamber
     *  for every dig. */
    function placeBuilt(done) {
        if (!done || !done.length) return false;
        for (const job of done) {
            if (job.kind === 'dig') layout.slots.push(null);
            else if (job.kind === 'room') {
                const slot = job.slot >= 0 && job.slot < layout.slots.length ? job.slot : freeChamber(layout);
                if (slot >= 0) layout.slots[slot] = job.type;
            }
        }
        layout = normalizeLayout(state, layout);
        return true;
    }
    const landBuilds = () => placeBuilt(completeBuilds(state));

    // --- cryo: the hall, the ladder ---------------------------------------------
    /** The hall is dug with its own chamber (v1.48.0): a free one was a second, hidden price, and
     *  the rooms the dot asked for always took it first. */
    function buyCryoHall() {
        if (state.stars < CRYO[0].cost || needFor(0)) return;
        state.stars -= CRYO[0].cost;
        state.cryo = 0;
        state.chambers += 1;
        state.rooms.cryo = (state.rooms.cryo || 0) + 1;
        layout.slots.push('cryo');
        layout = normalizeLayout(state, layout);
        bought();
        afterChange();
    }
    function buyCryoTier() {
        const next = CRYO[state.cryo + 1];
        if (!next || state.stars < next.cost || needFor(state.cryo + 1)) return;
        state.stars -= next.cost;
        state.cryo += 1;
        bought();
        afterChange();
    }
    function pressCryo() {
        if (state.cryo < 0) { buyCryoHall(); return; }
        startSleep().catch((e) => console.error('the deep: the sleep broke', e));
    }

    /* ---- SLEEP IS A STATE (v1.43.0) ------------------------------------------
       The snowflake starts it: everyone walks into the hall, the counter spins like
       the odometer it always was for the first moment, and then the years ROLL, the
       ore and the stars with them, at the tier's rate, until an alarm wakes the
       colony or the sun button does. */

    /** The odometer: slow off the mark, flying, a long stop. */
    const odometer = (k) => k * k * k * (k * (k * 6 - 15) + 10);
    const linear = (k) => k;
    /** Where the rolling numbers stand right now. */
    function rollingValue(now) {
        if (!roll) return snapshot();
        const k = Math.min(1, Math.max(0, (now - roll.t0) / (roll.dur * 1000)));
        const e = roll.ease(k);
        const mix = (a, b) => a + (b - a) * e;
        return { day: mix(roll.from.day, roll.to.day), ore: mix(roll.from.ore, roll.to.ore), stars: mix(roll.from.stars, roll.to.stars) };
    }
    /** Roll the numbers from wherever they stand to `to` over `seconds`. A wall clock stands
     *  behind the frames, so a tab nobody watches still arrives. */
    function rollTo(to, seconds, ease = linear) {
        const now = performance.now();
        const from = rollingValue(now);
        if (roll?.done) clearTimeout(roll.done);
        return new Promise((resolve) => {
            const r = { from, to, t0: now, dur: Math.max(0.05, seconds), ease };
            r.done = setTimeout(() => {
                if (roll === r) { roll = null; drawCounters(to); }
                resolve();
            }, Math.ceil(r.dur * 1000) + 30);
            roll = r;
        });
    }

    function freshSum() {
        return { days: 0, minerals: 0, food: 0, stars: 0, born: 0, died: 0, weakest: {}, ranDays: {}, alarm: null };
    }
    /** Add one chunk of sleep to the running total. */
    function addToSum(sum) {
        const t = sleepSum;
        t.days += sum.days; t.minerals += sum.minerals; t.food += sum.food; t.stars += sum.stars;
        t.born += sum.born; t.died += sum.died;
        for (const [k, v] of Object.entries(sum.weakest)) t.weakest[k] = (t.weakest[k] || 0) + v;
        for (const r of ROOMS) t.ranDays[r] = (t.ranDays[r] || 0) + (sum.ran[r] || 0) * sum.days;
    }

    /** Run `days` of sleep with alarms on, and fold it into the running total. */
    function sleepChunk(days) {
        const sum = sleep(state, days, { alarms: true, slots: layout.slots, rng: Math.random, maxSteps: 20000 });
        placeBuilt(sum.built);
        addToSum(sum);
        // the Watcher counts the years, drifts, and banks what the machines spared
        sum.watch = watchSleep(state.watcher, { days: sum.days, tier: state.cryo, spare: sum.spare });
        report = dryRun();
        scene?.setState(state, layout);
        return sum;
    }

    async function startSleep() {
        if (busy || state.asleep || state.cryo < 0 || state.humans < MIN_SLEEPERS) return;
        setBusy(true);
        stopClock();
        replay.hide();
        advisorLine = '';
        hovering = null;
        await (scene ? scene.gather(SLEEP_TIMING.gather) : Promise.resolve());
        state.asleep = true;
        ui.root.classList.add('is-sleeping');
        updateChrome();                 // the sleep world at once: the Watcher, and its one line
        sleepSum = freshSum();
        sleepFrom = { ore: state.minerals, food: state.food, stars: state.stars };
        beginSleep(state.watcher, state.cryo);
        // falling asleep: the first moment spins like the odometer it always was
        const before = snapshot();
        roll = { from: before, to: before, t0: performance.now(), dur: 0.05, ease: linear };
        const sum = sleepChunk(CRYO[state.cryo].days * SLEEP_TIMING.spin);
        saveGame();
        await rollTo(snapshot(), SLEEP_TIMING.spin, odometer);
        setBusy(false);
        const woke = alarmOf(sum);
        if (woke) { await wake(woke); return; }
        runSleep();
    }

    /** The sleep timer: ten times a second, the tier's rate times the time that passed. */
    function runSleep() {
        stopSleep();
        lastSleepAt = performance.now();
        sleepInterval = setInterval(sleepTick, SLEEP_TICK_MS);
        updateChrome();
    }
    function stopSleep() {
        if (sleepInterval) clearInterval(sleepInterval);
        sleepInterval = null;
    }
    /** What wakes the colony after a chunk of sleep: an alarm, or the Watcher rebooting. */
    function alarmOf(sum) {
        if (sum.alarm) return sum.watch?.rebooted ? { ...sum.alarm, rebooted: true } : sum.alarm;
        return sum.watch?.rebooted ? { kind: 'reboot' } : null;
    }
    function sleepTick() {
        if (busy || !state.asleep) return;
        const now = performance.now();
        // a hidden tab gets its timers throttled; it sleeps slower, it never jumps
        const dt = Math.min(0.25, Math.max(0, (now - lastSleepAt) / 1000));
        lastSleepAt = now;
        if (!(dt > 0)) return;
        // paused: no colony days, no drift; the odometer holds where it stands
        const days = sleepDays(dt, CRYO[state.cryo].days, paused());
        if (!(days > 0)) return;
        // draw where the roll stands before starting the next one: a tab that gets no frames
        // (hidden, or a pane in the background) still sees the years move ten times a second
        drawCounters(rollingValue(now));
        const sum = sleepChunk(days);
        rollTo(snapshot(), SLEEP_TICK_MS / 1000 + 0.02);
        sleepTicks++;
        // the first sleep ends on a plain alarm after a year, never on a reboot (v1.48.0)
        const woke = alarmOf(sum)
            || (firstSleep(state.watcher) && sleepSum && sleepSum.days >= FIRST_SLEEP_DAYS ? { kind: 'first' } : null);
        if (woke) { wake(woke).catch((e) => console.error('the deep: the wake broke', e)); return; }
        // a riddle, now and then, never over an alarm
        if (puzzleDue(state.watcher, { asleep: true, alarmPending: busy })) openPuzzle(state.watcher, state);
        updateChrome();
        if (sleepTicks % 10 === 0) saveGame();
    }

    /**
     * Out of the ice. The sentence goes to the feed, the glyph to the strip, and the crowd
     * walks back out onto the lanes they left.
     * @param {object} alarm - what woke the colony; { kind:'manual' } for the sun button
     */
    async function wake(alarm) {
        if (!state.asleep || busy) return;
        stopSleep();
        setBusy(true);
        state.asleep = false;
        // the alarm is a jolt to the Watcher; a low one says it slightly wrong, never the reboot
        const w = state.watcher;
        const rebooted = alarm.kind !== 'reboot' && (alarmHit(w, alarm.kind) || !!alarm.rebooted);
        const said = alarm.kind === 'reboot' ? [alarmLine(alarm)]
            : watcherLines(w, [alarmLine(alarm), ...(alarm.kind === 'scouts' ? (alarm.landed || []).slice(1).map(scoutLine) : [])]);
        if (rebooted) said.push(alarmLine({ kind: 'reboot' }));
        const line = said[0];
        feed = pushFeed(feed, said);
        // the reboot line is said once, in the feed; the advisor's line keeps saying where we stand
        advisorLine = alarm.kind === 'reboot' ? '' : `Year ${group(calendar(state.day).year)}. ${line}`;
        const t = sleepSum || freshSum();
        // lives lost in the ice are mourned: no one is born for a year after the wake (v1.48.0)
        if (t.died >= 0.5) mourn(state);
        const ran = {};
        for (const r of ROOMS) ran[r] = t.days > 0 ? (t.ranDays[r] || 0) / t.days : 1;
        state.stalled = stalledRooms(state, { ran });
        if (alarm.kind === 'stall') state.stalled[alarm.type] = true;
        if (roll?.done) clearTimeout(roll.done);
        roll = null;
        drawCounters(snapshot());
        saveGame();
        ui.root.classList.remove('is-sleeping');
        scene?.setState(state, layout);
        await (scene ? scene.release(SLEEP_TIMING.release) : Promise.resolve());
        if (alarm.kind === 'scouts') for (const l of alarm.landed || []) if (l.back > 0) scene?.scoutsDown(l.back);
        report = dryRun();
        recomputeGates();
        // a "+46 B" that leaves the counter at "600 T" is not shown at all (v1.48.0)
        const from = sleepFrom || { ore: state.minerals, food: state.food, stars: state.stars };
        replay.show({
            rooms: state.rooms, stalled: state.stalled, alarm: alarmGlyph(alarm, ROOM_ICON),
            minerals: t.minerals, food: t.food, stars: t.stars, weakest: t.weakest, died: t.died,
            shows: { minerals: rewardShows(from.ore, t.minerals), food: rewardShows(from.food, t.food), stars: rewardShows(from.stars, t.stars) },
        });
        sleepSum = null;
        sleepFrom = null;
        toldAbout = null;               // a new day for the advisor: say where we stand again
        setBusy(false);
        startClock();
        updateChrome();
        saveGame();
    }

    // --- scout parties ----------------------------------------------------------
    function sendProbe() {
        // the ore and the people are deep.js's business; the spare power is the chrome's, because
        // the E column is a flow and not a stock: a colony with no headroom cannot open the hatch.
        // One party at a time: the button waits for the one that is out.
        if (report.parts.E < PROBE_ENERGY || scoutsOut(state)) return;
        const p = launchProbe(state);
        if (!p) return;
        scene?.scoutsUp(p.people);
        feed = pushFeed(feed, [scoutSentLine(p.people)]);
        bought();
        afterChange();
    }

    // --- the way up -----------------------------------------------------------
    /** You can always try (v1.45.0). What is behind the hatch is the truth: on a surface that is
     *  not ready the first party dies up there, the rest wait, and the colony knows the truth. */
    async function pressAscent() {
        if (busy || state.asleep || !canTryAscent(state)) return;
        setBusy(true);
        stopClock();
        const out = attemptAscent(state);
        saveGame();
        if (!out.success) {
            scene?.scoutsUp(out.lost);
            const line = ascentFailLine(out, formatCount);
            advisorLine = `Year ${group(calendar(state.day).year)}: ${line}`;
            feed = pushFeed(feed, [line]);
            report = dryRun();
            recomputeGates();
            scene?.setState(state, layout);
            setBusy(false);
            startClock();
            updateChrome();
            return;
        }
        replay.hide();
        await (scene ? scene.ascend(2.0) : Promise.resolve());
        crust.lighten();
        scene?.lighten();
        await delay(700);
        playChapterCard({ roman: CHAPTER_V.roman, title: CHAPTER_V.title, mode: 'to-come', dark: true });
    }

    /** One pass of the advisor: a line only when a condition is not what it was. */
    function speak() {
        const now = conditions(state, report);
        const lines = advisorLines(toldAbout, now);
        toldAbout = now;
        if (lines.length) feed = pushFeed(feed, lines);
    }

    function setBusy(on) {
        busy = on;
        ui.root.classList.toggle('is-busy', on);
        updateChrome();
    }

    /** Nothing is clickable while the years are running, but the sun. */
    const guarded = (fn) => () => { if (!busy && !state.asleep) fn(); };

    // ---- the Watcher's two hands: the snap and the riddle ----------------------
    /** A click on the base while the colony sleeps: it snaps rigid, and holds a little. Since
     *  v1.48.0 only a click that lands ON the model counts (a plate, a lane, the shaft), never the
     *  black around it; inside the cooldown the base does not move and the ring round the cursor
     *  says how long is left. */
    function snapBase() {
        if (!state.asleep || busy) return;
        if (snapWait(state.watcher, Date.now()) > 0) {
            ui.snapRing?.classList.remove('is-nudged');
            void ui.snapRing?.offsetWidth;
            ui.snapRing?.classList.add('is-nudged');
            return;
        }
        scene?.snap();
        if (paused()) return;            // the base snaps; nothing is earned while time holds
        if (snapWatcher(state.watcher, Date.now()) > 0) {
            ui.watcher?.classList.remove('is-held');
            void ui.watcher?.offsetWidth;          // restart the one-shot
            ui.watcher?.classList.add('is-held');
        }
        updateChrome();
    }
    let press = null;
    let pointer = null;              // where the cursor is over the scene, for the crosshair and the ring
    ui.sceneHost.addEventListener('pointerdown', (e) => {
        press = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    }, { signal });
    ui.sceneHost.addEventListener('pointerup', (e) => {
        const p = press;
        press = null;
        if (!p || e.button !== 0) return;
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_PX || performance.now() - p.t > CLICK_MS) return;
        if (!scene || !scene.hitsBase(e.clientX, e.clientY)) return;
        snapBase();
    }, { signal });
    ui.sceneHost.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; }, { signal });
    ui.sceneHost.addEventListener('pointerleave', () => { pointer = null; }, { signal });
    /** Once a frame, asleep: the crosshair only over the model, and the cooldown ring round the cursor. */
    const RING_LEN = 2 * Math.PI * 15;
    function stepCursor() {
        const asleep = !!state.asleep;
        const over = asleep && !!pointer && !!scene && scene.hitsBase(pointer.x, pointer.y);
        const wait = asleep ? snapWait(state.watcher, Date.now()) : 0;
        ui.sceneHost.classList.toggle('is-over-base', over && wait <= 0);
        if (!ui.snapRing) return;
        const on = asleep && !!pointer && wait > 0;
        ui.snapRing.hidden = !on;
        if (!on) return;
        ui.snapRing.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
        ui.snapArc?.setAttribute('stroke-dashoffset', (RING_LEN * wait / SNAP_COOLDOWN_MS).toFixed(1));
    }

    /** The riddle's answer, typed. Enter answers, Escape lets it go. */
    function sayOnCard(text, cls) {
        ui.puzzleSaid.textContent = text;
        ui.puzzle.classList.remove('is-right', 'is-wrong');
        void ui.puzzle.offsetWidth;
        ui.puzzle.classList.add(cls);
    }
    function answer() {
        const w = state.watcher;
        if (!state.asleep || busy || paused() || !w.puzzle) return;
        const out = answerPuzzle(w, ui.puzzleIn.value, state.cryo);
        if (!out) { sayOnCard('?', 'is-wrong'); return; }
        if (out.ok) {
            // the stars only get a number on the card when the counter visibly moves (v1.48.0)
            const gain = puzzleStars(report.stars);
            const shows = rewardShows(state.stars, gain);
            state.stars += gain;
            ui.puzzleIn.disabled = true;
            sayOnCard(shows ? `+${Math.round(out.gained)} · +${formatCount(gain)} stars` : `+${Math.round(out.gained)}`, 'is-right');
            // the card lingers a moment on its answer, then goes
            lingerUntil = performance.now() + 900;
            setTimeout(() => updateWatcher(), 950);
            updateChrome();
            saveGame();
            return;
        }
        ui.puzzleIn.value = '';
        sayOnCard(`${Math.round(out.gained)}`, 'is-wrong');
        if (out.rebooted) { wake({ kind: 'reboot' }).catch((e) => console.error('the deep: the wake broke', e)); return; }
        updateChrome();
        saveGame();
    }
    ui.puzzleIn?.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); answer(); }
        else if (e.key === 'Escape') {
            e.preventDefault();
            dismissPuzzle(state.watcher, state.cryo);
            updateChrome();
            saveGame();
        }
    }, { signal });

    // a click puts a button's tooltip away until the cursor leaves it (v1.48.0: the snowflake's
    // tooltip stayed over the scene after the click that started the sleep)
    for (const b of ui.root.querySelectorAll('.deep-btn-col .btn')) {
        b.addEventListener('click', () => b.classList.add('tip-off'), { signal, capture: true });
        b.addEventListener('pointerleave', () => b.classList.remove('tip-off'), { signal });
        b.addEventListener('pointerenter', () => b.classList.remove('tip-off'), { signal });
    }
    ui.digBtn.addEventListener('click', guarded(dig), { signal });
    for (const { type, el } of ui.roomBtns) el.addEventListener('click', guarded(() => buildRoom(type)), { signal });
    ui.levelBtn.addEventListener('click', guarded(levelWeakest), { signal });
    ui.autoBtn.addEventListener('click', guarded(automateWeakest), { signal });
    // the preview: every purchase button shows its own future on the bars
    watchHover(ui.digBtn, () => ({ kind: 'dig', type: null, price: digCost(state.chambers), currency: 'minerals' }));
    for (const { type, el } of ui.roomBtns) {
        watchHover(el, () => ({ kind: 'room', type, price: roomCost(type, state.rooms[type] || 0), currency: 'minerals' }));
    }
    watchHover(ui.levelBtn, () => {
        const type = offers().level.type;
        return { kind: 'level', type, price: levelCost(type, state.level[type] || 0), currency: 'stars' };
    });
    watchHover(ui.autoBtn, () => {
        const type = offers().auto.type;
        const price = automationCost(type, state.auto[type] || 0);
        return { kind: 'auto', type, price: Number.isFinite(price) ? price : 0, currency: 'stars' };
    });
    ui.cryoBtn.addEventListener('click', guarded(pressCryo), { signal });
    ui.wakeBtn.addEventListener('click', () => { if (!busy) wake({ kind: 'manual' }); }, { signal });
    ui.cryoUpBtn.addEventListener('click', guarded(buyCryoTier), { signal });
    ui.probeBtn.addEventListener('click', guarded(sendProbe), { signal });
    ui.ascendBtn.addEventListener('click', guarded(pressAscent), { signal });
    // the replay strip stays until the next thing the player does
    ui.root.addEventListener('click', () => { if (replay.visible()) replay.hide(); }, { signal, capture: true });
    ui.resetBtn.addEventListener('click', () => { scene?.resetView(); ui.resetBtn.classList.remove('is-on'); }, { signal });
    // "Reset everything" in the shared menu: each chapter says what that means for its own save
    document.getElementById('reset-btn')?.addEventListener('click', () => {
        if (!confirm('Reset all progress? This cannot be undone.')) return;
        savingEnabled = false;
        stopClock();
        stopSleep();
        if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler);
        try {
            localStorage.removeItem(SAVE_KEY);
            localStorage.removeItem(PHASE2_CONSTANTS.SAVE_KEY);
            localStorage.removeItem(PHASE1_CONSTANTS.SAVE_KEY);
            localStorage.removeItem(PHASE_KEY);
        } catch { /* ignore */ }
        setTimeout(() => location.reload(), 0);
    }, { signal });
    window.addEventListener('resize', () => scene?.resize(), { signal });
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // --- the calendar awake: one real second is one colony day ---
    let lastDayAt = performance.now();
    function dayTick() {
        if (busy || state.asleep) return;
        const now = performance.now();
        // paused: the day does not come, and nothing is owed for it afterwards
        if (paused()) { lastDayAt = now; return; }
        const elapsed = Math.round((now - lastDayAt) / 1000);
        // Away from the tab the timer is throttled. Catch up a little, never a
        // whole night: there is no offline progress in the deep yet.
        const days = Math.max(1, Math.min(MAX_CATCHUP_DAYS, elapsed));
        lastDayAt = now;
        const lines = [];
        for (let i = 0; i < days; i++) {
            landBuilds();
            report = tickDay(state, false);
            // parties come home on their own day, awake too, and the free hands mend what they let in
            for (const l of resolveDueProbes(state, layout.slots, Math.random)) {
                lines.push(scoutLine(l));
                if (l.back > 0) scene?.scoutsDown(l.back);
            }
            const cleared = repairTick(state, layout.slots, report.hands);
            if (cleared >= 0) lines.push(`The crew cleared chamber ${cleared + 1}.`);
        }
        if (lines.length) feed = pushFeed(feed, lines);
        report = dryRun();
        speak();
        recomputeGates();
        scene?.setState(state, layout);
        updateChrome();
        saveGame();
    }
    /** Stopping and starting the calendar is how a sleep avoids living a day twice:
     *  the interval is gone for the whole sleep, and the clock starts from now when it
     *  comes back, so nothing is caught up either. */
    function stopClock() {
        if (dayInterval) clearInterval(dayInterval);
        dayInterval = null;
    }
    function startClock() {
        stopClock();
        lastDayAt = performance.now();
        dayInterval = setInterval(dayTick, 1000);
    }

    // --- frames: the people walk, the camera drifts, the numbers roll; no game time here ---
    let lastFrame = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        if (roll) drawCounters(rollingValue(now));
        stepCursor();
        // paused, the scene still draws (and the camera still turns by hand), but nobody walks
        // and the base's jitter holds still
        scene?.step(paused() ? 0 : dt);
        rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    recomputeGates();
    scene?.setState(state, layout);
    updateChrome();
    saveGame();

    // A colony that was asleep when the tab closed is still asleep: the years roll on.
    if (state.asleep && state.cryo >= 0) {
        ui.root.classList.add('is-sleeping');
        sleepSum = freshSum();
        sleepFrom = { ore: state.minerals, food: state.food, stars: state.stars };
        runSleep();
    } else {
        state.asleep = false;
        startClock();
    }

    // A colony that already climbed is finished: the wall stands again on every reload.
    if (state.ascended) {
        crust.lighten();
        scene?.lighten();
        playChapterCard({ roman: CHAPTER_V.roman, title: CHAPTER_V.title, mode: 'to-come', dark: true });
    }

    // --- hooks ---
    window.rpiDeep = {
        get state() { return state; }, get layout() { return layout; }, get report() { return report; },
        get feed() { return feed.slice(); }, get gates() { return gates; }, scene,
    };
    let debugOn = false;
    try { debugOn = window.location.search.includes('debug') || localStorage.getItem(DEBUG_KEY) === '1'; } catch { /* ignore */ }
    if (debugOn) {
        window.debug_deep = (what, n) => {
            if (what === 'minerals') state.minerals += 1e6;
            else if (what === 'stability') {
                // the Watcher's meter, set by hand: 0 reboots at the next sleeping tick
                state.watcher.stability = Math.max(0, Math.min(STABILITY_MAX, Number(n) || 0));
            } else if (what === 'capacity') state.watcher.capacity = Math.max(0, Math.min(CAPACITY_MAX, Number(n ?? CAPACITY_MAX)));
            else if (what === 'puzzle') {
                // a riddle now, whatever the gap and the capacity say
                state.watcher.capacity = Math.max(state.watcher.capacity, CAPACITY_MAX);
                if (!state.watcher.puzzle) openPuzzle(state.watcher, state);
            }
            else if (what === 'stars') state.stars += 1e8;
            else if (what === 'day100') { for (let i = 0; i < 100; i++) report = tickDay(state, state.asleep); }
            else if (what === 'sleep') { pressCryo(); return; }
            else if (what === 'alarm') { if (state.asleep) wake({ kind: 'debug' }); return; }
            else if (what === 'probe') {
                state.minerals += probeCost(state.probesSent || 0);   // the hook is the party, not the bill
                const p = launchProbe(state);
                if (p) { scene?.scoutsUp(p.people); feed = pushFeed(feed, [scoutSentLine(p.people)]); }
            } else if (what === 'home') {
                // bring every party home tomorrow: asleep, that is the next alarm
                for (const p of state.probes || []) p.dueDay = state.day + 1;
            } else if (what === 'ascend') {
                // believe survival up there is 86 %, whatever it really is, and try
                state.est = { bias: (state.est?.bias || 0) + 14 - estimateNow(state).mean, spread: 3 };
                state.estRevealed = true;
                pressAscent();
                return;
            }
            afterChange();
        };
    }
}

export function teardown() {
    saveGame_onTeardown();
    if (abortController) abortController.abort();
    abortController = null;
    clearInterval(dayInterval);
    dayInterval = null;
    clearInterval(sleepInterval);
    sleepInterval = null;
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
    try { scene?.dispose(); } catch (e) { console.warn('the deep: dispose', e); }
    scene = null;
    try { replay?.destroy(); crust?.destroy(); } catch (e) { console.warn('the deep: chrome dispose', e); }
    replay = null;
    crust = null;
    document.body.classList.remove('in-deep');
    delete window.rpiDeep;
    delete window.debug_deep;
    savingEnabled = true;
}

/** The save on the way out lives on the state the closure still holds. */
function saveGame_onTeardown() {
    const held = window.rpiDeep;
    if (!held || !savingEnabled || window.__rpiSkipSave) return;
    saveToStorage(SAVE_KEY, serializeDeep(held.state, held.layout));
}
