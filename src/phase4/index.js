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
    initialDeepState, tickDay, sleep,
    COLUMN, ROOMS, DAYS_PER_YEAR, CRYO, CHAPTER_V,
    cryoName, group, probeCost, PROBE_ENERGY, launchProbe, resolveDueProbes,
    clearChamber, clearDarkType, stalledRooms, attemptAscent, canTryAscent, ascentOdds, SURVIVAL_AT,
    completeBuilds, buildProgress, estimateNow, habitableYear,
    sleepTrouble, repairTick, scoutOdds, scoutsOut, MIN_SLEEPERS, RESURFACE_AT,
    ASCENT_MIN_PEOPLE, ordersDone, mourn,
    orderBuild, nextPrice, chambersAhead, isQueued, buildEta, QUEUE_MAX, queueRunsAsleep,
    cancelOrder, digSpare, nextCryo, CRYO_TOP, FEED_MAX,
} from './deep.js';
import {
    conditions, advisorLines, pushFeed, DESCENT_LINE, alarmLine, alarmGlyph,
    scoutLine, scoutSentLine, troubleClause, ascentFailLine,
} from './advisor.js';
import {
    ledger, buySentence, preview, deltaText, stocks, flows, flowText, previewStocks,
    nextOrePrice, affordText, cryoReadyLine, consequence, span, rateWords,
    short, backIn, cryoNeed, lowPoint, rewardShows, cryoRoad,
} from './readout.js';
import { initialLayout, freeChamber, normalizeLayout, sectorOf } from './layout.js';
import { createScene, supportsWebGL, ROOM_ICON } from './scene.js';
import { createCrust } from './crust.js';
import { createReplay } from './replay.js';
import { serializeDeep, saveToStorage, loadFromStorage } from './persistence.js';
import {
    normalizeWatcher, watcherName, watchSleep, alarmHit, snap as snapWatcher, softness, watcherLines,
    puzzleDue, openPuzzle, beginSleep, dismissPuzzle, puzzleStars, sleepDays,
    STABILITY_MAX, firstSleep, FIRST_SLEEP_DAYS, WATCHER_HELLO, snapWait, SNAP_COOLDOWN_MS,
    recoverAwake, LADDER, capacityMax, surfaceDue, openSurface, closeSurface,
    playSurface, SPACE_LINE, selfSolve, autoSnapDue, bodyWhole, lastWake, ascendAlone,
    NOBODY_LINE, GO_UP_ALONE, sealLine, BODY_GROW_SECONDS,
    lampSlots, isLamp, pressLamp, expireLamps, lampFactor, DARK_MS, rungOpenLine,
    sealCandidates, sealSector, choosingSector, bodyGlyph, inBody, textMadness, lookDue,
} from './watcher.js';
import { THROWS, THROW_ICON, SENTENCE, SENTENCE_LINE, TYPE_MS } from './surface.js';
import {
    NODE_BY_ID, buy as treeBuy, buyMany as treeBuyMany, buyableCount, normalizeTree, nightNext, nightAhead, nightArc,
} from './tree.js';
import { machineTempo, machineSays } from './machine.js';
import { createTreeView } from './tree-view.js';
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
/**
 * ONE VOICE AT A TIME (v1.52.0, the cut, item 5). Asleep, only the alarm line, Surface and the
 * upgrade pill speak; the feed shows its last line only. Awake, the feed shows FEED_AWAKE lines.
 * The line of what woke the colony stays ALARM_LINE_MS, then the advisor says where we stand.
 */
export const FEED_AWAKE = 3;
/** deep-night (step 3b): asleep the feed is gone with the rest of the awake chrome. */
export const FEED_ASLEEP = 0;
export const ALARM_LINE_MS = 6000;
/** deep-night: a wake that brought no night says what the next one waits for, this long, once,
 *  in the advisor's place after the alarm line. */
export const NEXT_LINE_MS = 5000;
/** deep-night: Surface's game appears this long after its line has finished typing. */
export const GAME_AFTER_LINE_MS = 1000;
/** The people a biological step takes: the red delta over the H bar, and the number rolling down. */
const DROP_MS = { roll: 1200, fade: 2400 };


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
    state.tree = normalizeTree(state.tree);

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
        treeBtn: document.getElementById('deep-tree-btn'),
        treeBadge: document.getElementById('deep-tree-badge'),
        tree: document.getElementById('deep-tree'),
        cryoBtn: document.getElementById('deep-cryo-btn'),
        cryoText: document.getElementById('deep-cryo-text'),
        wakeBtn: document.getElementById('deep-wake-btn'),
        cryoCaption: document.getElementById('deep-cryo-caption'),
        probeText: document.getElementById('deep-probe-text'),
        probeBtn: document.getElementById('deep-probe-btn'),
        ascendBtn: document.getElementById('deep-ascend-btn'),
        ascendCaption: document.getElementById('deep-ascend-caption'),
        resetBtn: document.getElementById('deep-reset-view'),
        crust: document.getElementById('deep-crust'),
        replay: document.getElementById('deep-replay'),
        root: document.getElementById('phase-deep'),
        watcher: document.getElementById('deep-watcher'),
        watcherName: document.getElementById('deep-watcher-name'),
        stabFill: document.getElementById('deep-stab-fill'),
        pulse: document.querySelector('#deep-watcher .deep-watcher-pulse'),
        bodyTip: document.getElementById('deep-body-tip'),
        machineTip: document.getElementById('deep-machine-tip'),
        stabVal: document.getElementById('deep-stab-val'),
        // deep-night: the one line under the Watcher, where the sleep world stands
        arc: document.getElementById('deep-watcher-arc'),
        columns: document.getElementById('deep-columns'),
        // v1.51.0: the lamps' one line under the Watcher (the riddle cards are gone)
        card: {
            el: document.getElementById('deep-puzzle'),
            q: document.getElementById('deep-puzzle-q'),
            said: document.getElementById('deep-puzzle-said'),
        },
        queue: document.getElementById('deep-queue'),
        ask: document.getElementById('deep-watcher-ask'),
        duel: document.getElementById('deep-rps-duel'),
        fistYou: document.getElementById('deep-fist-you'),
        fistIt: document.getElementById('deep-fist-it'),
        fistItFront: document.getElementById('deep-fist-it-front'),
        surface: document.getElementById('deep-surface'),
        // deep-voice: Surface's line of the night, typed low in the dark
        voice: document.getElementById('deep-voice'),
        voiceText: document.getElementById('deep-voice-text'),
        voiceRest: document.getElementById('deep-voice-rest'),
        surfaceSaid: document.getElementById('deep-surface-said'),
        surfaceWords: document.getElementById('deep-surface-words'),
        rpsBtns: [...document.querySelectorAll('#deep-surface .deep-rps-btn')],
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
    let advisorUntil = 0;           // v1.52.0: an alarm line goes after ALARM_LINE_MS (0: it stays)
    let nextLine = '';              // deep-night: what the next night waits for, said once after the alarm line
    let nightAtSleep = 0;           // deep-night: Surface's night count when this sleep began
    let feed = [];                  // the advisor's last lines, oldest first
    let toldAbout = null;           // the conditions the last feed line was written about
    let hovering = null;            // { kind, type } of the button under the cursor, for the preview
    let roll = null;                // the numbers rolling between two sleep ticks: { from, to, t0, dur, ease, done }
    let sleepSum = null;            // the whole sleep, added up chunk by chunk, for the wake-up strip
    let lastSleepAt = 0;
    let sleepTicks = 0;
    let lookClock = 0;              // deep-fix: real seconds of this sleep, for the look at Cryo I and II
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
    const priceRow = (html) => `<span class="deep-price">${html}</span>`;
    const perDayText = (v) => `${v >= 0 ? '+' : '-'}${formatCount(Math.abs(v))}/d`;

    /** The three numbers of the calendar. Split out because the sleep rolls them on
     *  their own, sixty times a second, and must touch nothing else. */
    function drawClock(day) {
        const cal = calendar(day);
        ui.year.textContent = stutter(group(cal.year));
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

    /* ---- THE MADNESS IS FELT (deep-fix) ------------------------------------------------------
       The overnight playtest of v1.66.0: "The madness is a number." Asleep, under 50 the year's
       digits stutter now and then (a digit off by one, or the year before, for a moment) and the
       Watcher's letters drift one by one, more the lower the meter. Under 35 the lines lose or
       repeat a word (watcher.js garble). The rules never change; only what is shown. */
    let stuttered = null;           // { text, until } while the year shows wrong
    let yearShown = '';
    function stutter(text) {
        const now = performance.now();
        const mad = state.asleep ? textMadness(state.watcher.stability) : 0;
        if (!(mad > 0)) { stuttered = null; yearShown = text; return text; }
        if (stuttered && now < stuttered.until) return stuttered.text;
        stuttered = null;
        if (Math.random() < 0.035 * mad) {
            const digits = [...text].map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);
            let wrong = yearShown && yearShown !== text ? yearShown : text;
            if (wrong === text && digits.length) {
                const i = digits[Math.floor(Math.random() * digits.length)];
                const d = (Number(text[i]) + (Math.random() < 0.5 ? 9 : 1)) % 10;
                wrong = text.slice(0, i) + d + text.slice(i + 1);
            }
            stuttered = { text: wrong, until: now + 90 + 160 * mad };
            return wrong;
        }
        yearShown = text;
        return text;
    }
    /** The Watcher's name as letters, so each can drift; drawn again only when the name changes. */
    function drawName(name) {
        const el = ui.watcherName;
        if (!el || el.dataset.name === name) return;
        el.dataset.name = name;
        el.textContent = '';
        for (const ch of name) {
            const sp = document.createElement('span');
            sp.textContent = ch;
            el.appendChild(sp);
        }
    }
    let drifting = false;
    /** Once a frame: each letter of the name off its place by a little, more as the meter falls. */
    function stepMadness(now) {
        const el = ui.watcherName;
        if (!el) return;
        const mad = state.asleep && !state.watcher.gone ? textMadness(state.watcher.stability) : 0;
        if (!(mad > 0)) {
            if (drifting) { for (const sp of el.children) sp.style.transform = ''; drifting = false; }
            return;
        }
        drifting = true;
        const t = now / 1000;
        const a = 0.6 + 3.4 * mad;           // px at most
        let i = 0;
        for (const sp of el.children) {
            const k = i++ * 1.7;
            const x = a * Math.sin(t * (0.9 + 0.13 * k) + k) * 0.6;
            const y = a * Math.sin(t * (1.3 + 0.07 * k) + 2.1 * k);
            const r = mad > 0.5 ? (mad - 0.5) * 16 * Math.sin(t * 0.7 + k) : 0;
            sp.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(1)}deg)`;
        }
    }

    /** What the stars are for next, named, for "toward Cryo II". */
    function starGoal() {
        const next = nextCryo(state);
        return next ? cryoName(state.cryo + 1) : 'the next level';
    }
    const tierDays = () => CRYO[Math.max(0, state.cryo)].days;

    /**
     * THE ONE REASON the next cryo tier is not there (v1.48.0): the caption beside the button, its
     * tooltip, and the room type the level and automate buttons offer are all read off this.
     * @param {number} [tier] - index into CRYO; the next one by default
     */
    function needFor(tier = state.cryo + 1) {
        if (!CRYO[tier] || tier > CRYO_TOP) return null;     // the tier past VII is Surface's gift
        const hall = tier === 0;
        return cryoNeed(tier, {
            state,
            trouble: hall ? gates.hall : gates.next,
            planned: hall ? gates.plannedHall : gates.plannedNext,
            starsPerDay: report.stars,
        });
    }
    /** What the tree is told about the colony today: the next cryo tier's one reason (kept once a
     *  colony day, never per frame), the stars a day for "affordable in", and whether it sleeps. */
    const treeCtx = () => ({ need: needFor(), road: roadNow, starsPerDay: report.stars, orePerDay: report.parts.M, asleep: !!state.asleep });
    /** deep-fix: the whole road to the next cryo tier (readout.js cryoRoad), kept once a colony day
     *  with the gates; the tree's node and the sleep pill's caption both read it. */
    let roadNow = null;
    /** deep-copy: Sleep comes with a fade the moment Cryo I is bought (once the tree is closed). */
    let hadHall = null, arriveDue = false;

    /**
     * The tooltip of a purchase: the price, what it does, and then either what is still
     * missing (B064) or, for the button under the cursor, what it does for the goal (B060).
     */
    function buyTip(el, { kind, type, price, currency, sentence, blocked, mark = '' }) {
        const have = currency === 'stars' ? state.stars : state.minerals;
        const perDay = currency === 'stars' ? report.stars : report.parts.M;
        const priceHtml = Number.isFinite(price) ? (currency === 'stars' ? starCost(price) : mineralCost(price)) : '';
        const missing = affordText({ price, have, perDay, blocked: state.watcher.gone ? 'gone' : (state.asleep ? 'asleep' : blocked) });
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
        // deep-machine: the machine's tempo IS the stars a day; its hover says what it plays on
        scene?.setMachine(machineTempo(report, { asleep: !!state.asleep, feed: state.feed }), !!state.asleep);
        machineText = machineSays(report);

        // THE BARS ARE STORES (B056): each on its own scale, the weakest FLOW marked with the dot.
        // Under each, what comes in and what goes out in a day. Hovering a purchase draws a ghost
        // where the store would stand once it is paid for and finished, and the change in that
        // column's daily surplus over it.
        const orePrice = nextOrePrice(state, report);
        const st = stocks(state, report, orePrice);
        const fl = flows(state, report);
        // v1.48.0: the dot marks what runs LOW (days of cover), never a full bar
        const low = lowPoint(state, report, st);
        const ahead = hovering ? preview(state, hovering.kind, hovering.type, report) : null;
        const ghost = hovering ? previewStocks(state, hovering.kind, hovering.type, hovering.price || 0, hovering.currency || 'minerals', orePrice) : null;
        for (const c of COLUMN) {
            const h = Math.round(BAR_H * st[c].frac);
            ui.fills[c].style.height = `${h}px`;
            const dropping = c === 'H' && !!hDrop;      // the people the body took, rolling down
            if (!dropping) ui.heads[c].textContent = st[c].head;
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
            if (dropping) {
                // stepDrop() owns the delta while it shows
            } else if (ahead) {
                d.textContent = deltaText(ahead.delta[c], c);
                d.classList.toggle('is-down', ahead.delta[c] < -0.5);
                d.classList.add('is-on');
            } else {
                d.classList.remove('is-on');
                d.textContent = '';
            }
        }
        if (advisorLine && advisorUntil && performance.now() > advisorUntil) {
            advisorLine = '';
            advisorUntil = 0;
            // deep-night: then, once, what the next night waits for
            if (nextLine) { advisorLine = nextLine; advisorUntil = performance.now() + NEXT_LINE_MS; nextLine = ''; }
        }
        // v1.52.0: asleep the advisor is quiet (the one line it has is the feed's last); the first
        // sleep's WATCHER_HELLO goes to the feed
        const advice = state.asleep ? ''
            : (advisorLine || `Year ${group(cal.year)}. ${state.watcher.gone ? 'Nobody came out.' : low.line}`);
        if (ui.advisor.textContent !== advice) ui.advisor.textContent = advice;
        // the feed: the last things worth saying, newest at the bottom; three awake, one asleep.
        // deep-fix: a line the advisor is saying is not said again right under it
        const unsaid = advice ? feed.filter((l) => !advice.endsWith(l)) : feed;
        const shown = unsaid.slice(-(state.asleep ? FEED_ASLEEP : FEED_AWAKE));
        if (ui.feed.childElementCount !== shown.length
            || (shown.length && ui.feed.firstElementChild.textContent !== shown[0])
            || (shown.length && ui.feed.lastElementChild.textContent !== shown[shown.length - 1])) {
            ui.feed.textContent = '';
            for (const line of shown) {
                const row = document.createElement('div');
                row.className = 'deep-feed-line';
                row.textContent = line;
                ui.feed.appendChild(row);
            }
        }
        // each bar says where its number came from, in one sentence (B062)
        for (const c of COLUMN) setTooltip(ui.bars[c], escapeText(ledger(c, state, report)));
        // deep-copy: the rate beside each counter is its number; the hover only says what it is
        setTooltip(ui.starsRow, says('Stars. The machine on top wins them, game by game.'));
        setTooltip(ui.oreRow, says('Ore in store. The rate beside it is what is left after the generators burn theirs.'));

        // after the last wake-up there is nobody to build anything: the buttons stand as if asleep
        const gone = !!state.watcher.gone;
        const asleep = !!state.asleep || gone;
        // the buttons. Since v1.49.0 a button can be pressed again while its order is being built:
        // the next order is paid now, at the next price, and waits in the queue under the buttons
        const full = (state.builds || []).length >= QUEUE_MAX;
        const roomRoom = chambersAhead(state) > 0;
        const digPrice = nextPrice(state, 'dig');
        ui.digBtn.classList.toggle('is-locked', asleep || state.minerals < digPrice || full);
        buyTip(ui.digBtn, { kind: 'dig', type: null, price: digPrice, currency: 'minerals', sentence: buySentence('dig', null, state), blocked: full ? 'full' : '' });
        showBuild(ui.digBtn, 'dig', null);

        for (const { type, el } of ui.roomBtns) {
            const price = nextPrice(state, 'room', type);
            el.classList.toggle('is-locked', asleep || !roomRoom || state.minerals < price || full);
            buyTip(el, { kind: 'room', type, price, currency: 'minerals', sentence: buySentence('room', type, state), blocked: full ? 'full' : (!roomRoom ? 'chamber' : '') });
            showBuild(el, 'room', type);
        }
        drawQueue();

        // deep-tree: the level, automate and longer-sleep buttons are the tree's now. Its button
        // carries a badge with how many nodes can be bought right now, and the open panel redraws
        const canNow = gone ? 0 : buyableCount(state, treeCtx());
        const badge = canNow > 0 ? String(canNow) : '';
        if (ui.treeBadge.textContent !== badge) ui.treeBadge.textContent = badge;
        ui.treeBadge.classList.toggle('hidden', !badge);
        // deep-voice: after a night in which Surface opened a node, a quiet mark until the tree is looked at
        if (treeView?.isOpen() && state.tree?.unseen) state.tree.unseen = false;    // opened while looking at it
        const night = !!(state.tree && state.tree.unseen);
        ui.treeBtn.classList.toggle('has-night', night);
        // deep-copy: the badge is the count; the hover only says what the tree is
        setTooltip(ui.treeBtn, says('Everything the colony can grow into.')
            + note(night ? 'Something opened in the night.' : ''));
        treeView?.refresh();

        // ---- cryo: the hall, then the sleep; asleep, the sun that wakes the colony ----
        const tier = state.cryo;
        const owns = tier >= 0;
        // deep-copy: Sleep is not on screen until Cryo I is bought; then it comes with a short fade
        const sleepOn = owns && !asleep;
        if (hadHall === false && owns) arriveDue = true;
        if (arriveDue && sleepOn && !treeView?.isOpen()) {
            arriveDue = false;
            ui.cryoBtn.classList.remove('is-arriving');
            void ui.cryoBtn.offsetWidth;
            ui.cryoBtn.classList.add('is-arriving');
        }
        hadHall = owns;
        ui.cryoBtn.classList.toggle('hidden', !sleepOn);
        ui.wakeBtn.classList.toggle('hidden', !state.asleep);
        // v1.51.0: an action is a pill with a word, "Sleep · 1 y/s". deep-tree: the hall is Cryo I in
        // the tree; until it is bought the pill says so, and a click opens the tree
        // deep-copy: just "Sleep"; "1 m/s" read as metres a second. The hover says it in words
        const cryoWord = 'Sleep';
        if (ui.cryoText.textContent !== cryoWord) ui.cryoText.textContent = cryoWord;
        if (state.asleep) {
            ui.wakeBtn.classList.toggle('is-locked', busy);
            setTooltip(ui.wakeBtn, says('Wake the colony.'));
        } else if (gone) {
            // nobody is left to sleep
        } else if (owns) {
            const few = state.humans < MIN_SLEEPERS;
            ui.cryoBtn.classList.toggle('is-locked', busy || few);
            const warn = few
                ? `Too few people to sleep. It takes ${MIN_SLEEPERS}.`
                : (gates.current ? `They would wake after ${span(Math.max(1, gates.current.day))}, when ${troubleClause(gates.current)}.` : '');
            setTooltip(ui.cryoBtn, says(`Each second of sleep is ${rateWords(CRYO[tier].days)}. They sleep until something wakes them.`)
                + note(warn, 'is-missing'));
        }
        // deep-copy: before Cryo I there is no Sleep pill at all; what Cryo I needs is on its node in the tree
        // ---- scout parties: people up the shaft, for a reading of the sky ----
        // Everything about a party is on the button before it goes (v1.45.0): who, how long, the
        // odds of each way it can end, and how far a good reading may be off.
        const scoutsOn = !gone && (owns || state.probesSent > 0 || state.probes.length > 0);
        ui.probeBtn.classList.toggle('hidden', !scoutsOn);
        if (scoutsOn) {
            const out = scoutsOut(state);
            const odds = scoutOdds(state);
            const people = state.humans - odds.people >= MIN_SLEEPERS;
            const power = report.parts.E >= PROBE_ENERGY;
            ui.probeBtn.classList.toggle('is-locked', busy || asleep || out || state.minerals < odds.price || !power || !people);
            const trip = out ? state.probes[0] : null;
            const probeWord = trip ? `Scout party · ${backIn(trip.dueDay - state.day)}` : 'Scout party';
            if (ui.probeText.textContent !== probeWord) ui.probeText.textContent = probeWord;
            const mark = ui.probeBtn.querySelector('.deep-build');
            mark.classList.toggle('is-on', !!trip);
            if (trip) mark.style.setProperty('--p', `${Math.round(100 * Math.min(1, (state.day - trip.sentDay) / Math.max(1, trip.dueDay - trip.sentDay)))}%`);
            // deep-copy: hover text only, three plain lines; no odds (the ring's ± says the doubt)
            if (trip) {
                setTooltip(ui.probeBtn, says(`${formatCount(Math.round(trip.people))} people are up there.`)
                    + says(`They are due back in ${span(trip.dueDay - state.day)}.`));
            } else {
                const missing = !people ? 'Too few people to spare.'
                    : (!power ? 'Not enough power to open the hatch.'
                        : (asleep ? 'Only while the colony is awake.'
                            : (state.minerals < odds.price ? `You need ${formatCount(odds.price - state.minerals)} more ore.` : '')));
                setTooltip(ui.probeBtn, says(`Send ${odds.people} people up for ${span(odds.days)}.`)
                    + says(`Costs ${formatCount(odds.price)} ore.`)
                    + says('Some may not come back.')
                    + note(missing, 'is-missing'));
            }
        }

        // ---- the way up. deep-tree: no early attempt any more. The button is a greyed teaser,
        //      "survival 85 % needed", until the colony's own estimate reaches the line; then it
        //      opens, and what is behind the hatch is the truth, as before ----
        const ao = ascentOdds(state);
        const canTry = canTryAscent(state);
        if (gone) {
            // v1.50.0: the Watcher alone. No odds: there is nothing left to lose
            setCaption(ui.ascendCaption, GO_UP_ALONE);
            ui.ascendBtn.classList.toggle('is-locked', busy || !!state.ascended);
            ui.ascendBtn.setAttribute('aria-label', 'Go up');
            setTooltip(ui.ascendBtn, '');
        } else {
            // deep-copy: ONE text, the caption beside the pill, with live numbers and no ±; no hover
            const ready = ascentReady();
            setCaption(ui.ascendCaption, !ready ? `Opens at ${SURVIVAL_AT} % survival. Now about ${Math.round(ao.survival)} %.`
                : asleep ? 'Wake the colony to go up.'
                    : (!canTry ? `It takes at least ${ASCENT_MIN_PEOPLE} people.` : ''));
            ui.ascendBtn.classList.toggle('is-locked', busy || asleep || !canTry || !ready);
            setTooltip(ui.ascendBtn, '');
        }

        const est = estimateNow(state);
        const year = habitableYear(state);
        crust.update({ est, year: Number.isFinite(year) ? group(year) : '' });
        updateWatcher();
        scheduleIconRefresh();
    }

    /* ---- THE WATCHER (v1.46.0) ------------------------------------------------
       Only in the sleep world: a slow pulse, a name, a meter, and now and then the lamps. No
       sentence says what it is. Since v1.51.0 its ladder is a line and one pill under it, the
       capacity is only ever shown inside that pill, and the lamps' one line replaces the riddle
       cards. Opposite it in some sleeps, Surface. */
    function updateWatcher() {
        const w = state.watcher;
        const asleep = !!state.asleep;
        if (ui.watcher) {
            // after the last wake-up the Watcher stays: there is no other world to go back to
            ui.watcher.hidden = !asleep && !w.gone;
            ui.watcher.classList.toggle('is-whole', !!w.gone);
            if (asleep || w.gone) {
                drawName(watcherName(w));
                const stab = Math.round(w.stability);
                const v = String(stab);
                if (ui.stabVal.textContent !== v) ui.stabVal.textContent = v;
                ui.stabFill.style.width = `${(100 * w.stability / STABILITY_MAX).toFixed(1)}%`;
                ui.watcher.classList.toggle('is-low', w.stability < 35);
                // v1.52.0: the Watcher's shape grows with the body: a dot, a ring, a blob, a rim
                const shape = bodyGlyph(w);
                const cls = `deep-watcher-pulse${shape ? ` is-body is-${shape}` : ''}`;
                if (ui.pulse && ui.pulse.className !== cls) ui.pulse.className = cls;
                // deep-night: one line, where the sleep world stands; it changes rarely
                const arc = nightArc(state);
                if (ui.arc && ui.arc.textContent !== arc) ui.arc.textContent = arc;
            }
            drawAsk();
            drawLampCard();
        }
        drawSurface();
        // the base: as soft as the meter says while the colony sleeps, rigid when it wakes
        scene?.setSoftness(asleep ? softness(w.stability) : 0);
    }

    /* ---- THE TREE (deep-tree, step 1) ------------------------------------------------
       The level and automate buttons, the longer-sleep button and the Watcher's pill all moved
       into one panel (tree.js the rules, tree-view.js the board). A click buys one level, a
       shift-click as many as can be paid; a level or an automation is still an order in the build
       queue with its ring. The game keeps ticking underneath. */
    const sealedThisSleep = [];     // sectors the body took in this sleep, for the wake-up strip
    const treeView = ui.tree ? createTreeView(ui.tree, { state: () => state, ctx: treeCtx, onBuy: (id, many) => buyNode(id, many), onClose: () => closeTree() }) : null;
    function openTree() {
        if (!treeView || treeView.isOpen()) return;
        hovering = null;
        pointer = null;                 // the cursor is over the board now, not the base
        leaveChoice();
        ui.root.classList.add('is-tree-open');
        if (state.tree) state.tree.unseen = false;      // the night's mark: seen
        treeView.open();
        updateChrome();
        saveGame();
    }
    function closeTree() {
        if (!treeView || !treeView.isOpen()) return;
        treeView.close();
        ui.root.classList.remove('is-tree-open');
        updateChrome();
    }
    const toggleTree = () => (treeView?.isOpen() ? closeTree() : openTree());
    /** A node clicked. The tree says whether it can be bought; the phase does the rest: the layout,
     *  the faults a purchase clears, the feed, the sector a biological step asks for. */
    function buyNode(id, many = false) {
        if (paused()) return false;
        const n = NODE_BY_ID[id];
        if (!n) return false;
        // deep-fix: the tree is open through the walk into the hall; what is paid at once and needs
        // no one awake or asleep (Surface's gifts, the machine's feed) can be bought in it too
        if (busy && !(n.kind === 'surface' || n.kind === 'feed')) return false;
        if (n.kind === 'watcher' || n.kind === 'bio') {
            const out = treeBuy(state, id, { ...treeCtx(), slots: layout.slots, choose: true });
            if (!out) return false;
            // a biological step paid for and waiting for its sector: the tree closes, the arms light
            if (out.choose || (out.step && out.step.pending)) {
                if (out.step?.firstSpace) feed = pushFeed(feed, [SPACE_LINE]);
                // deep-fix: the sector is the one demand now: the lamps go quiet, Surface waits
                if (state.watcher.puzzle) { dismissPuzzle(state.watcher, state.cryo); lamp = null; }
                surfaceKey = '';
                saveGame();
                closeTree();
                enterChoice();
                return true;
            }
            if (out.step.firstSpace) feed = pushFeed(feed, [SPACE_LINE]);
            afterStep(out.step.step);
            return true;
        }
        const done = many ? treeBuyMany(state, id, treeCtx()) : [treeBuy(state, id, treeCtx())].filter(Boolean);
        if (!done.length) return false;
        for (const r of done) {
            if (r.kind === 'level' || r.kind === 'auto') mendType(r.type);
            // the hall is dug with its own chamber (v1.48.0)
            if (r.kind === 'cryo' && r.tier === 0) { layout.slots.push('cryo'); layout = normalizeLayout(state, layout); }
        }
        bought();
        afterChange();
        return true;
    }
    /** A biological step paid for and waiting for its sector: one line under the meter asks. */
    function drawAsk() {
        if (!ui.ask) return;
        const w = state.watcher;
        const asks = !!state.asleep && !w.gone && choosingSector(w);
        if (ui.ask.hidden === asks) ui.ask.hidden = !asks;
        ui.ask.classList.toggle('is-choosing', asks && choosing);
    }
    /** What every step bought says and does after it, whichever way it was bought. */
    function afterStep(step) {
        // v1.51.0: the last step of a rung opens the next one, and the advisor says so once
        const opened = rungOpenLine(step.id);
        if (opened) feed = pushFeed(feed, [opened]);
        // the skin: the sentence can be heard, now, whether Surface was here or not (and the
        // lamps go quiet for it: one demand at a time)
        if (step.id === 'skin') {
            const sf = state.watcher.surface;
            if (state.watcher.puzzle) { dismissPuzzle(state.watcher, state.cryo); lamp = null; }
            if (!sf.visit) openSurface(state.watcher, state);
            else sf.visit.line = SENTENCE_LINE;
            surfaceKey = '';
        }
        report = dryRun();
        scene?.setState(state, layout);
        updateChrome();
        saveGame();
    }

    /* ---- THE CHOICE (v1.52.0) ------------------------------------------------------------
       The cut, item 4: a biological step, once paid, asks for a sector. The pill reads "Choose a
       sector to seal", the arms that can be taken glow, the cursor is a crosshair; a click on any
       plate of an arm seals THAT sector: it turns warm and breathes, its walkers leave, and the
       people it took fall off the H bar with a red delta. Escape puts the choice away and refunds
       nothing: the step waits and the pill keeps asking. The rules are watcher.js's. */
    let choosing = false;
    let hoverSector = -1;
    function enterChoice() {
        if (!state.asleep || busy || state.watcher.gone || !choosingSector(state.watcher)) return;
        choosing = true;
        hoverSector = -1;
        ui.sceneHost.classList.add('is-choosing');
        scene?.setCandidates(sealCandidates(state.watcher, layout.slots), -1);
        updateChrome();
    }
    function leaveChoice() {
        if (!choosing) return;
        choosing = false;
        hoverSector = -1;
        ui.sceneHost.classList.remove('is-choosing');
        scene?.setCandidates(null);
    }
    /** The sector under the cursor, when it is one the body may take; else -1. */
    function candidateAt(x, y) {
        if (!scene) return -1;
        const slot = scene.slotAt(x, y);
        if (slot < 0) return -1;
        const k = sectorOf(slot);
        return sealCandidates(state.watcher, layout.slots).includes(k) ? k : -1;
    }
    function chooseSector(k) {
        if (!choosing || !state.asleep || busy || paused()) return false;
        const w = state.watcher;
        const before = state.humans;
        const out = sealSector(w, state, layout.slots, k);
        if (!out) return false;
        leaveChoice();
        // the advisor calls it maintenance, and the wake strip shows it
        feed = pushFeed(feed, [sealLine(out.sector, w.sealed.length - 1)]);
        sealedThisSleep.push(out.sector);
        if (out.people > 0) dropPeople(before, state.humans, out.people);
        afterStep(out.step);
        scene?.sealAnim(out.sector, out.people);
        return true;
    }
    let hDrop = null;               // { from, to, text, t0 } while the people roll off the H bar
    function dropPeople(from, to, n) {
        hDrop = { from, to, text: `\u2212${formatCount(n)}`, t0: performance.now() };
        const d = ui.deltas.H;
        d.classList.remove('is-drop');
        void d.offsetWidth;             // restart the one-shot fade
        d.textContent = hDrop.text;
        d.classList.add('is-on', 'is-down', 'is-drop');
        ui.columns?.classList.add('is-drop');      // deep-night: asleep, the H bar comes up for it
        stepDrop();
    }
    /** Once a frame while it shows: the number rolls down, the delta fades (CSS), then both let go. */
    function stepDrop() {
        if (!hDrop) return;
        const t = performance.now() - hDrop.t0;
        if (t >= DROP_MS.fade) {
            hDrop = null;
            ui.deltas.H.classList.remove('is-on', 'is-down', 'is-drop');
            ui.columns?.classList.remove('is-drop');
            ui.deltas.H.textContent = '';
            updateChrome();
            return;
        }
        const k = Math.min(1, t / DROP_MS.roll);
        const e = 1 - Math.pow(1 - k, 3);
        const v = formatCount(Math.round(hDrop.from + (hDrop.to - hDrop.from) * e));
        if (ui.heads.H.textContent !== v) ui.heads.H.textContent = v;
    }

    /* ---- SURFACE (v1.49.0): opposite the Watcher, only in the sleeps it comes in. One line,
       a game, what the game gave, and the sentence as far as it is known. Gone at the wake.
       v1.51.0: the game is played out. On a throw both fists shake for 0.6 s (the three buttons
       stand still), Surface's hidden throw turns face up, the loser cracks and fades, the winner
       pulses once, and only then the line; a won word slides into the sentence letter by letter.
       The rules are settled the moment the throw is made; only the showing waits. */
    const RPS_TIMING = { shake: 600, reveal: 300, settle: 380 };
    let surfaceKey = '';
    let rps = null;                 // the game being played out: { you, it, outcome, word, stage }
    let rpsTimers = [];
    const glyph = (t) => `<i data-lucide="${THROW_ICON[t]}" class="w-4 h-4"></i>`;
    /** The sentence as far as it is known; the word just won (index `fresh`) slides in by letter. */
    function drawWords(known, fresh) {
        const el = ui.surfaceWords;
        if (!(known > 0)) { el.textContent = ''; return; }
        el.innerHTML = SENTENCE.map((word, i) => {
            if (i === fresh) {
                return `<span class="deep-word-new">${[...word].map((ch, k) => `<span style="animation-delay:${k * 70}ms">${ch}</span>`).join('')}</span>`;
            }
            return i < known ? word : '·';
        }).join(' ');
    }
    function drawSurface() {
        if (!ui.surface) return;
        const sf = state.watcher.surface;
        // deep-fix: while a sector waits to be chosen, that is the one demand: a visit already here is not shown
        const v = state.asleep && !choosingSector(state.watcher) ? sf.visit : null;
        ui.surface.hidden = !v;
        drawVoice(v);
        if (!v) { surfaceKey = ''; return; }
        // deep-night: A SEQUENCE. While a line types, nothing else of Surface's is seen; the game
        // comes under it a second after the last letter (its place is held, so the line never moves)
        const waiting = !gameShown(v);
        ui.surface.classList.toggle('is-waiting', waiting);
        const r = v.result;
        const stage = rps ? rps.stage : (r ? 'line' : 'open');
        const key = `${sf.visits}|${stage}|${sf.words}|${v.line}|${waiting}`;
        if (key === surfaceKey) return;
        surfaceKey = key;
        ui.surface.classList.toggle('is-played', !!r);
        const said = !!r && stage === 'line';
        ui.surfaceSaid.textContent = said ? r.text : '';
        ui.surfaceSaid.classList.toggle('is-in', said && !!rps);
        // the sentence is a win's reward (deep-night): only after a win, once its line is said, the
        // word just won sliding in; otherwise it is in the tree's night log
        const fresh = said && rps && r.word ? sf.words - 1 : -1;
        drawWords(said && r.outcome === 'win' ? sf.words : 0, fresh);
        for (const b of ui.rpsBtns) {
            b.disabled = !!r;
            b.classList.remove('is-you', 'is-it');
        }
        ui.duel.hidden = !r;
        if (r) {
            const icons = `${r.you}|${r.it}`;
            if (ui.duel.dataset.icons !== icons) {
                ui.duel.dataset.icons = icons;
                ui.fistYou.innerHTML = glyph(r.you);
                ui.fistItFront.innerHTML = glyph(r.it);
            }
            const shown = stage === 'reveal' || stage === 'settle' || stage === 'line';
            const settled = stage === 'settle' || stage === 'line';
            ui.duel.classList.toggle('is-shaking', stage === 'shake');
            ui.duel.classList.toggle('is-revealed', shown);
            ui.fistYou.classList.toggle('is-won', settled && r.outcome === 'win');
            ui.fistYou.classList.toggle('is-lost', settled && r.outcome === 'lose');
            ui.fistIt.classList.toggle('is-won', settled && r.outcome === 'lose');
            ui.fistIt.classList.toggle('is-lost', settled && r.outcome === 'win');
        } else {
            delete ui.duel.dataset.icons;
        }
        scheduleIconRefresh();
    }
    /* ---- THE VOICE (deep-voice) ---------------------------------------------------------
       A night's line types itself, letter by letter (TYPE_MS a letter), low in the dark, in a larger
       and warmer mono than anything else, and stays until the colony wakes. Nothing on it can be
       clicked. Awake it is gone: the tree's night log keeps it. The caret shows only while it types. */
    let voice = null;               // { key, text, t0, doneAt } of the line on screen
    /** deep-night: may the game show? At once on a quiet visit; after a line, a second after it is whole. */
    function gameShown(v) {
        if (!v.line) return true;
        if (v.result || rps) return true;            // already played (a reload mid-game)
        return !!voice && voice.doneAt > 0 && performance.now() - voice.doneAt >= GAME_AFTER_LINE_MS;
    }
    function drawVoice(v) {
        if (!ui.voice) return;
        const line = v && v.line ? v.line : '';
        if (!line) {
            if (voice) { voice = null; ui.voiceText.textContent = ''; ui.voiceRest.textContent = ''; }
            if (!ui.voice.hidden) ui.voice.hidden = true;
            return;
        }
        const key = `${state.watcher.surface.visits}|${line}`;
        if (!voice || voice.key !== key) {
            voice = { key, text: line, t0: performance.now(), doneAt: 0 };
            ui.voiceText.textContent = '';
            ui.voiceRest.textContent = line;        // held in place, unseen, so the line never moves as it types
            ui.voice.classList.add('is-typing');
        }
        if (ui.voice.hidden) ui.voice.hidden = false;
        stepVoice();
    }
    /** Once a frame while a line is typing: one more letter every TYPE_MS. */
    function stepVoice() {
        if (!voice) return;
        const n = Math.min(voice.text.length, Math.floor((performance.now() - voice.t0) / TYPE_MS));
        if (ui.voiceText.textContent.length !== n) {
            ui.voiceText.textContent = voice.text.slice(0, n);
            ui.voiceRest.textContent = voice.text.slice(n);
        }
        if (n >= voice.text.length && ui.voice.classList.contains('is-typing')) {
            ui.voice.classList.remove('is-typing');
            voice.doneAt = performance.now();
        }
        // deep-night: the game comes a second after the last letter
        if (voice.doneAt && !ui.surface.hidden && ui.surface.classList.contains('is-waiting')
            && performance.now() - voice.doneAt >= GAME_AFTER_LINE_MS) ui.surface.classList.remove('is-waiting');
    }
    function stopRps() {
        for (const t of rpsTimers) clearTimeout(t);
        rpsTimers = [];
        rps = null;
    }
    function throwAtSurface(you) {
        if (!state.asleep || busy || paused() || rps || !THROWS.includes(you)) return;
        const v = state.watcher.surface.visit;
        if (!v || !gameShown(v)) return;                 // deep-night: the line first, then the game
        const r = playSurface(state.watcher, you);
        if (!r) return;
        rps = { you, it: r.it, outcome: r.outcome, word: r.word, stage: 'shake', log: [['throw', performance.now()]] };
        const at = (ms, stage) => rpsTimers.push(setTimeout(() => {
            if (!rps) return;
            rps.stage = stage;
            rps.log.push([stage, performance.now()]);
            updateWatcher();
            if (stage === 'line') {
                rpsLast = rps.log;
                rpsTimers.push(setTimeout(() => { rps = null; }, 600));
                if (r.rebooted) wake({ kind: 'reboot' }).catch((e) => console.error('the deep: the wake broke', e));
            }
        }, ms));
        at(RPS_TIMING.shake, 'reveal');
        at(RPS_TIMING.shake + RPS_TIMING.reveal, 'settle');
        at(RPS_TIMING.shake + RPS_TIMING.reveal + RPS_TIMING.settle, 'line');
        rps.log.push(['shake', performance.now()]);
        updateChrome();
        saveGame();
    }
    let rpsLast = null;             // the last game's timeline, for the tests: throw, shake, reveal, settle, line

    /* ---- THE LAMPS (v1.51.0) ----------------------------------------------------------
       Now and then (at most once in two sleeps, never while Surface is there) the lamps on the
       automated rooms ask for something. THE LAMPS: they go still, then blink a sequence, and the
       Watcher repeats it by clicking the rooms. WHICH LAMP WENT OUT: all lit, one goes dark, find
       it within three seconds. The rules are in watcher.js; this plays them on the model and
       keeps its own clock (a wall clock, held while paused). */
    const LAMP_T = { lead: 900, on: 460, gap: 220, darkLead: 1300 };
    let lamp = null;                // the event being played: { p, t, phase, outAt, last }
    let lampFx = null;              // a lamp answering a click, for a moment: { spec, until }
    let cardSaid = null;            // the card's last word, lingering after the event: { q, said, cls, until }
    function lampsNow() {
        return lampSlots(layout.slots, { auto: state.auto, skip: [...(state.darkSlots || []), ...(state.takenSlots || [])] });
    }
    /** The lamps an event may use: the ones in view, when two or more are. */
    function lampsInView() {
        const all = lampsNow();
        const seen = scene ? scene.visibleSlots(all) : all;
        return seen.length >= 2 ? seen : all;
    }
    function lampFlash(spec, ms) { lampFx = { spec, until: performance.now() + ms }; }
    let lampLast = 0;
    /** The lamps' clock: from the frames and from the sleep timer alike (a hidden tab still plays). */
    function stepLamps() {
        const now = performance.now();
        const dt = Math.min(250, Math.max(0, now - (lampLast || now)));
        lampLast = now;
        const w = state.watcher;
        const p = state.asleep ? w.puzzle : null;
        if (!p) lamp = null;
        else if (!lamp || lamp.p !== p) lamp = { p, t: 0, phase: 'lead', outAt: 0 };
        let spec = null;
        if (lamp) {
            if (!paused() && !busy) lamp.t += dt;
            const t = lamp.t;
            if (p.kind === 'dark') {
                if (t < LAMP_T.darkLead) { lamp.phase = 'lead'; spec = { lit: p.lamps }; }
                else {
                    if (lamp.phase !== 'out') { lamp.phase = 'out'; lamp.outAt = LAMP_T.darkLead; }
                    spec = { lit: p.lamps.filter((x) => x !== p.out), off: [p.out] };
                    if (t - lamp.outAt > DARK_MS) {
                        const lamps = p.lamps.slice();
                        const out = expireLamps(w, state.cryo);
                        if (out) endLamps(out, lamps, -1, p);
                        return;
                    }
                }
            } else {
                const per = LAMP_T.on + LAMP_T.gap;
                if (t < LAMP_T.lead) { lamp.phase = 'lead'; spec = {}; }
                else if (t < LAMP_T.lead + per * p.shown.length) {
                    lamp.phase = 'show';
                    if (p.at) p.at = 0;         // nothing counts before the sequence has been shown
                    const k = t - LAMP_T.lead;
                    const i = Math.floor(k / per);
                    spec = k - i * per < LAMP_T.on ? { flash: [p.shown[i]] } : {};
                } else { lamp.phase = 'input'; spec = {}; }
            }
        }
        if (lampFx && now < lampFx.until) spec = { ...(spec || {}), ...lampFx.spec };
        else lampFx = null;
        scene?.setLamps(spec && state.asleep ? spec : null);
        drawLampCard();
    }
    /** The one line under the Watcher: what the lamps ask, how far along. Nothing about a lie. */
    function drawLampCard() {
        const card = ui.card;
        if (!card.el) return;
        let q = '', said = '', cls = '';
        const now = performance.now();
        if (cardSaid && now < cardSaid.until) ({ q, said, cls } = cardSaid);
        else if (lamp && state.asleep) {
            cardSaid = null;
            const p = lamp.p;
            if (p.kind === 'dark') {
                q = lamp.phase === 'out' ? `ONE WENT OUT · ${Math.max(0, (DARK_MS - (lamp.t - lamp.outAt)) / 1000).toFixed(1)} s` : 'LAMPS · ALL LIT';
            } else {
                q = lamp.phase === 'input' ? `LAMPS · YOUR TURN${p.at ? ` · ${p.at}` : ''}` : 'LAMPS · WATCH';
            }
        }
        const on = !!q;
        if (card.el.classList.contains('is-on') !== on) card.el.classList.toggle('is-on', on);
        if (card.q.textContent !== q) card.q.textContent = q;
        if (card.said.textContent !== said) card.said.textContent = said;
        if (cls && !card.el.classList.contains(cls)) {
            card.el.classList.remove('is-right', 'is-wrong');
            void card.el.offsetWidth;
            card.el.classList.add(cls);
        } else if (!cls) card.el.classList.remove('is-right', 'is-wrong');
    }
    /**
     * A click on a chamber while the lamps ask. Only a lamp of the event counts, and only once the
     * sequence has been shown (or the lamp has gone out); anything else is left to the snap.
     * @returns {object|null} what pressLamp() said, or null when the click was not an answer
     */
    function pressSlot(slot) {
        const w = state.watcher;
        const p = w.puzzle;
        if (!state.asleep || busy || paused() || !lamp || lamp.p !== p || !isLamp(p, slot)) return null;
        if (!(lamp.phase === 'input' || lamp.phase === 'out')) return null;
        const lamps = p.lamps.slice();
        const out = pressLamp(w, slot, state.cryo, { elapsedMs: p.kind === 'dark' ? lamp.t - lamp.outAt : 0 });
        if (!out) return null;
        if (!out.done) { lampFlash({ flash: [slot] }, 260); drawLampCard(); return out; }
        endLamps(out, lamps, slot, p);
        return out;
    }
    function endLamps(out, lamps, slot, p) {
        const w = state.watcher;
        lamp = null;
        if (out.ok) {
            // the machine's wins, twice with the Second core; a number only where the counter moves
            const gain = puzzleStars(report.stars) * lampFactor(w);
            const shows = rewardShows(state.stars, gain);
            state.stars += gain;
            lampFlash({ flash: lamps }, 520);
            cardSaid = { q: 'LAMPS', said: shows ? `+${Math.round(out.gained)} · +${formatCount(gain)} stars` : `+${Math.round(out.gained)}`, cls: 'is-right', until: performance.now() + 1200 };
        } else {
            lampFlash({ wrong: slot >= 0 ? [slot] : [], ...(p.kind === 'dark' ? { off: [p.out] } : {}) }, 700);
            cardSaid = { q: 'LAMPS', said: `${Math.round(out.gained)}`, cls: 'is-wrong', until: performance.now() + 1200 };
        }
        updateChrome();
        saveGame();
        if (out.rebooted) wake({ kind: 'reboot' }).catch((e) => console.error('the deep: the wake broke', e));
    }

    /** The dry runs behind the cryo buttons. Once a colony day, never per frame. */
    let readyTold = Math.max(state.cryo ?? -1, Number.isFinite(state.cryoTold) ? state.cryoTold : -1);   // the highest tier the advisor has called buyable
    function recomputeGates() {
        if (state.asleep) return;
        const owns = state.cryo >= 0;
        const nextDays = nextCryo(state)?.days;
        const planned = (owns && !nextDays) ? null : ordersDone(state);
        gates = {
            hall: owns ? null : sleepTrouble(state, CRYO[0].days),
            current: owns ? sleepTrouble(state, CRYO[state.cryo].days) : null,
            next: owns && nextDays ? sleepTrouble(state, nextDays) : null,
            plannedHall: owns ? null : sleepTrouble(planned, CRYO[0].days),
            plannedNext: owns && nextDays ? sleepTrouble(planned, nextDays) : null,
        };
        // deep-fix: the whole road to the next tier, every part at once
        const want = state.cryo + 1;
        roadNow = CRYO[want] && want <= CRYO_TOP ? cryoRoad(want, state) : null;
        // the day a longer sleep can be bought, the advisor says so once: "Cryo IV can be bought: a
        // century a second." (deep-fix: kept in the save, so a reload does not say it again)
        if (CRYO[want] && want <= CRYO_TOP && want > readyTold && !needFor(want)) {
            readyTold = want;
            state.cryoTold = want;
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
        const job = (state.builds || []).find((j) => j.kind === kind && (type === null || j.type === type) && !isQueued(j));
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
    function bought() { advisorLine = ''; advisorUntil = 0; nextLine = ''; said.key = ''; }
    /* Since v1.49.0 every order goes through the queue (deep.js `orderBuild`): paid now, at the
       price after the orders already on the books, started when its lane and its chamber are free.
       A room takes whichever chamber is empty the day it starts. */
    const queueFull = () => (state.builds || []).length >= QUEUE_MAX;
    function dig() {
        const price = nextPrice(state, 'dig');
        if (state.minerals < price || queueFull()) return;
        state.minerals -= price;
        orderBuild(state, 'dig');
        bought();
        afterChange();
    }
    function buildRoom(type) {
        if (chambersAhead(state) <= 0 || queueFull()) return;
        const price = nextPrice(state, 'room', type);
        if (state.minerals < price) return;
        state.minerals -= price;
        orderBuild(state, 'room', { type });
        mendType(type);
        bought();
        afterChange();
    }
    /* ---- THE QUEUE (v1.49.0), since v1.51.0 a strip along the bottom of the window: "dig ◔ ·
       dig ○ · mine ○", each order with its ring. It never moves a button. An order that waits
       while the colony sleeps (no Scheduler yet) is drawn dim. A click on an order takes it back
       and returns its price (deep.js `cancelOrder`). Rebuilt only when the orders change; the
       rings are moved on every pass. */
    const QUEUE_WORD = { mine: 'mine', farm: 'farm', generator: 'gen', dorm: 'dorm' };
    const queueWord = (j) => (j.kind === 'dig' ? 'dig' : j.kind === 'room' ? QUEUE_WORD[j.type]
        : `${j.kind === 'level' ? 'lv' : 'auto'} ${QUEUE_WORD[j.type]}`);
    const Q_RING = 2 * Math.PI * 4.5;
    let queueKey = '';
    let queueRows = [];
    function drawQueue() {
        const jobs = state.builds || [];
        const key = jobs.map((j) => `${j.kind}${j.type}${j.startDay}`).join('|');
        if (key !== queueKey) {
            queueKey = key;
            ui.queue.textContent = '';
            queueRows = jobs.map((j) => {
                const row = document.createElement('button');
                row.className = 'deep-q-row';
                row.type = 'button';
                row.innerHTML = `<span class="deep-q-word">${queueWord(j)}</span>`
                    + '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">'
                    + '<circle class="track" cx="6" cy="6" r="4.5"></circle>'
                    + `<circle class="arc" cx="6" cy="6" r="4.5" stroke-dasharray="${Q_RING.toFixed(1)}" stroke-dashoffset="${Q_RING.toFixed(1)}"></circle></svg>`;
                row.addEventListener('click', () => takeBack(j), { signal });
                ui.queue.appendChild(row);
                return { job: j, row, arc: row.querySelector('.arc') };
            });
            ui.queue.hidden = !jobs.length;
        }
        const held = state.asleep && !queueRunsAsleep(state);
        const eta = queueRows.length ? buildEta(state) : null;
        const spare = digSpare(state);
        for (const r of queueRows) {
            const waiting = isQueued(r.job);
            const stuck = r.job.kind === 'dig' && !spare;
            r.row.classList.toggle('is-waiting', waiting);
            r.row.classList.toggle('is-held', waiting && held);
            r.row.classList.toggle('is-stuck', stuck);
            r.arc.setAttribute('stroke-dashoffset', (Q_RING * (1 - buildProgress(state, r.job))).toFixed(1));
            const left = Math.max(0, Math.ceil((eta.get(r.job) ?? state.day) - state.day));
            const when = waiting && held ? 'Waits for the colony to wake.' : `Ready in ${span(Math.max(1, left))}.`;
            const title = `${when} ${stuck ? 'A room waits for this chamber.' : 'Click to take it back.'}`;
            if (r.row.title !== title) r.row.title = title;
        }
    }
    /** A click on an order in the strip: gone, and its price back. */
    function takeBack(job) {
        if (busy || state.watcher.gone) return;
        if (!cancelOrder(state, job, { asleep: !!state.asleep })) return;
        said.key = '';
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

    // --- cryo: the hall and the tiers are bought in the tree; the pill sleeps ---------
    function pressCryo() {
        if (state.cryo < 0) { openTree(); return; }
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
        sum.watch = watchSleep(state.watcher, { days: sum.days, tier: state.cryo, spare: sum.spare, hold: choosing });
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
        nextLine = '';
        hovering = null;
        // deep-night: the awake chrome fades out as they walk into the hall: a different room
        ui.root.classList.add('is-night');
        await (scene ? scene.gather(SLEEP_TIMING.gather) : Promise.resolve());
        state.asleep = true;
        ui.root.classList.add('is-sleeping');
        updateChrome();                 // the sleep world at once: the Watcher, and its one line
        sleepSum = freshSum();
        sleepFrom = { ore: state.minerals, food: state.food, stars: state.stars };
        sealedThisSleep.length = 0;
        lookClock = 0;
        nightAtSleep = state.watcher.surface.night | 0;
        // the first sleep says one thing, once, what the label under the scene is (v1.52.0: in the
        // feed, the one line the sleep world shows)
        if (beginSleep(state.watcher, state.cryo)) feed = pushFeed(feed, [WATCHER_HELLO]);
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
        lookClock += dt;
        // the first sleep ends on a plain alarm after a year, never on a reboot (v1.48.0); deep-fix:
        // at Cryo I and II a sleep nothing else ends wakes for a look, once nothing asks on screen
        const look = !choosing && !hDrop && !rps && lookDue(state.watcher, state.cryo, lookClock);
        const woke = alarmOf(sum)
            || (firstSleep(state.watcher) && sleepSum && sleepSum.days >= FIRST_SLEEP_DAYS ? { kind: 'first' } : null)
            || (look ? { kind: 'look' } : null);
        if (woke) { wake(woke).catch((e) => console.error('the deep: the wake broke', e)); return; }
        // ONE DEMAND AT A TIME (v1.51.0): the lamps now and then (never over an alarm, never while
        // Surface is here, at most once in two sleeps), and in some sleeps, a few seconds in,
        // Surface (never while the lamps ask). watcher.js's demand() keeps them apart.
        const w = state.watcher;
        // an event whose lamp went away (a dormitory taken, a chamber gone dark) goes quietly
        if (w.puzzle && w.puzzle.lamps.some((sl) => !lampsNow().includes(sl))) { dismissPuzzle(w, state.cryo); lamp = null; }
        if (puzzleDue(w, { asleep: true, alarmPending: busy })) openPuzzle(w, lampsInView(), state.cryo);
        if (sleepSum && surfaceDue(w, sleepSum.days, CRYO[state.cryo].days)) { openSurface(w, state); surfaceKey = ''; }
        // the body at work (v1.50.0): the lamps answer themselves now and then, the snap comes by itself
        const open = w.puzzle;
        const held = w.stability;
        if (open && selfSolve(w, dt, state.cryo, Math.random).length) {
            endLamps({ ok: true, done: true, gained: w.stability - held, rebooted: false }, open.lamps.slice(), -1, open);
        }
        stepLamps();
        if (autoSnapDue(state.watcher, Date.now())) { scene?.snap(); snapWatcher(state.watcher, Date.now(), state.cryo); }
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
        closeSurface(w);                // Surface, and everything it said, is gone the moment they wake
        stopRps();
        leaveChoice();                  // a step waiting for its sector waits for the next sleep
        // v1.51.0: the lamps are a thing of the dark: an event still open goes with the sleep
        if (w.puzzle) dismissPuzzle(w, state.cryo);
        lamp = null;
        scene?.setLamps(null);
        if (bodyWhole(w) && !w.gone) { await lastWakeUp(); return; }
        const rebooted = alarm.kind !== 'reboot' && (alarmHit(w, alarm.kind) || !!alarm.rebooted);
        const said = alarm.kind === 'reboot' ? [alarmLine(alarm)]
            : watcherLines(w, [alarmLine(alarm), ...(alarm.kind === 'scouts' ? (alarm.landed || []).slice(1).map(scoutLine) : [])]);
        if (rebooted) said.push(alarmLine({ kind: 'reboot' }));
        const line = said[0];
        feed = pushFeed(feed, said);
        // the reboot line is said once, in the feed; the advisor's line keeps saying where we stand
        advisorLine = alarm.kind === 'reboot' ? '' : `Year ${group(calendar(state.day).year)}. ${line}`;
        advisorUntil = advisorLine ? performance.now() + ALARM_LINE_MS : 0;
        // deep-night: a sleep that brought no night, with one still to come, says what it waits for,
        // once, in the alarm line's place when that has had its time
        nextLine = (w.surface.night | 0) === nightAtSleep && nightAhead(state) ? nightNext(state, { asleep: false }).text : '';
        // deep-fix: low, the "next:" line is said slightly wrong too, as the wake lines are
        if (nextLine) nextLine = watcherLines(w, [nextLine])[0];
        if (nextLine && !advisorLine) { advisorLine = nextLine; advisorUntil = performance.now() + NEXT_LINE_MS; nextLine = ''; }
        const t = sleepSum || freshSum();
        // lives lost in the ice are mourned: no one is born for a year after the wake (v1.48.0); deep-fix:
        // and the people the body took in this sleep, whose year went by under the ice
        if (t.died >= 0.5 || sealedThisSleep.length) mourn(state);
        const ran = {};
        for (const r of ROOMS) ran[r] = t.days > 0 ? (t.ranDays[r] || 0) / t.days : 1;
        state.stalled = stalledRooms(state, { ran });
        if (alarm.kind === 'stall') state.stalled[alarm.type] = true;
        if (roll?.done) clearTimeout(roll.done);
        roll = null;
        drawCounters(snapshot());
        saveGame();
        ui.root.classList.remove('is-sleeping', 'is-night');
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
            sealed: sealedThisSleep.slice(),
        });
        sleepSum = null;
        sleepFrom = null;
        toldAbout = null;               // a new day for the advisor: say where we stand again
        setBusy(false);
        startClock();
        updateChrome();
        saveGame();
    }

    /**
     * THE LAST WAKE-UP (v1.50.0). The body is whole, the sleep ends, and nobody comes out: the
     * count reads 0, no one walks the lanes, the base breathes, and the Watcher stays on screen
     * under the colony's name. The only thing left to press is the way up.
     */
    async function lastWakeUp() {
        const w = state.watcher;
        const t = sleepSum || freshSum();
        const were = lastWake(w, state);
        feed = pushFeed(feed, [NOBODY_LINE]);
        advisorLine = `Year ${group(calendar(state.day).year)}. ${NOBODY_LINE}`;
        advisorUntil = 0;
        state.stalled = {};
        if (roll?.done) clearTimeout(roll.done);
        roll = null;
        drawCounters(snapshot());
        ui.root.classList.remove('is-sleeping', 'is-night');
        scene?.setState(state, layout);
        report = dryRun();
        const from = sleepFrom || { ore: state.minerals, food: state.food, stars: state.stars };
        replay.show({
            rooms: state.rooms, stalled: {}, alarm: alarmGlyph({ kind: 'nobody' }, ROOM_ICON),
            minerals: t.minerals, food: t.food, stars: t.stars, weakest: t.weakest, died: were,
            shows: { minerals: rewardShows(from.ore, t.minerals), food: rewardShows(from.food, t.food), stars: rewardShows(from.stars, t.stars) },
            sealed: sealedThisSleep.slice(),
        });
        sleepSum = null;
        sleepFrom = null;
        toldAbout = null;
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
    /** deep-tree: the way up opens when the colony's own estimate of survival up there reaches the
     *  line (85 %); before that the button is a greyed teaser. The early attempt is gone. */
    function ascentReady() {
        return ascentOdds(state).survival >= SURVIVAL_AT - 1e-9;
    }
    /** What is behind the hatch is the truth: on a surface that is not ready (the estimate was
     *  wrong) the first party dies up there, the rest wait, and the colony knows the truth. */
    async function pressAscent() {
        if (state.watcher.gone) { await goUpAlone(); return; }
        if (busy || state.asleep || !canTryAscent(state) || !ascentReady()) return;
        setBusy(true);
        stopClock();
        const out = attemptAscent(state);
        saveGame();
        if (!out.success) {
            scene?.scoutsUp(out.lost);
            const line = ascentFailLine(out, formatCount);
            advisorLine = `Year ${group(calendar(state.day).year)}. ${line}`;
            advisorUntil = 0;
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

    /** The Watcher goes up alone (v1.50.0): one amber dot climbs the shaft, and V waits at the top. */
    async function goUpAlone() {
        if (busy || state.ascended) return;
        setBusy(true);
        stopClock();
        ascendAlone(state);
        saveGame();
        replay.hide();
        await (scene ? scene.climbAlone(4.5) : Promise.resolve());
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
        if (snapWatcher(state.watcher, Date.now(), state.cryo) > 0) {
            ui.watcher?.classList.remove('is-held');
            void ui.watcher?.offsetWidth;          // restart the one-shot
            ui.watcher?.classList.add('is-held');
        }
        updateChrome();
    }
    let press = null;
    let pointer = null;              // where the cursor is over the scene, for the crosshair and the ring
    let machineText = '';            // deep-machine: the machine's hover, written once a colony day
    ui.sceneHost.addEventListener('pointerdown', (e) => {
        press = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    }, { signal });
    ui.sceneHost.addEventListener('pointerup', (e) => {
        const p = press;
        press = null;
        if (!p || e.button !== 0) return;
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_PX || performance.now() - p.t > CLICK_MS) return;
        if (!scene || !scene.hitsBase(e.clientX, e.clientY)) return;
        // v1.52.0: choosing a sector, a click on an arm the body may take seals it; nothing snaps
        if (choosing) {
            const k = candidateAt(e.clientX, e.clientY);
            if (k >= 0) chooseSector(k);
            return;
        }
        // v1.51.0: while the lamps ask, a click on one of their rooms is an answer, not a snap
        if (state.asleep && lamp && pressSlot(scene.slotAt(e.clientX, e.clientY))) return;
        snapBase();
    }, { signal });
    ui.sceneHost.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; }, { signal });
    ui.sceneHost.addEventListener('pointerleave', () => { pointer = null; }, { signal });
    /** Once a frame, asleep: the crosshair only over the model, and the cooldown ring round the cursor. */
    const RING_LEN = 2 * Math.PI * 15;
    function stepCursor() {
        const asleep = !!state.asleep;
        const over = asleep && !!pointer && !!scene && scene.hitsBase(pointer.x, pointer.y);
        const wait = asleep && !choosing ? snapWait(state.watcher, Date.now()) : 0;
        ui.sceneHost.classList.toggle('is-over-base', over && wait <= 0);
        // v1.52.0: choosing, the arm under the cursor glows a little more
        if (choosing) {
            const k = pointer && over ? candidateAt(pointer.x, pointer.y) : -1;
            if (k !== hoverSector) { hoverSector = k; scene?.setCandidates(sealCandidates(state.watcher, layout.slots), k); }
        }
        // a sealed plate says what it is now, and nothing else does
        const sealed = (state.watcher.sealed || []).length > 0;
        const slot = sealed && pointer && scene && !choosing ? scene.slotAt(pointer.x, pointer.y) : -1;
        const body = slot >= 0 && inBody(state.watcher, slot);
        if (ui.bodyTip) {
            if (ui.bodyTip.hidden === body) ui.bodyTip.hidden = !body;
            if (body) ui.bodyTip.style.transform = `translate(${pointer.x + 14}px, ${pointer.y + 12}px)`;
        }
        // deep-machine: over the machine on top, what it plays on (nothing while a sector is chosen)
        const onMachine = !!pointer && !!scene && !choosing && !body && scene.machineAt(pointer.x, pointer.y);
        if (ui.machineTip) {
            if (ui.machineTip.hidden === onMachine) ui.machineTip.hidden = !onMachine;
            if (onMachine) {
                if (ui.machineTip.textContent !== machineText) ui.machineTip.textContent = machineText;
                ui.machineTip.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 14}px)`;
            }
        }
        stepDrop();
        if (!ui.snapRing) return;
        const on = asleep && !!pointer && wait > 0;
        ui.snapRing.hidden = !on;
        if (!on) return;
        ui.snapRing.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
        ui.snapArc?.setAttribute('stroke-dashoffset', (RING_LEN * wait / SNAP_COOLDOWN_MS).toFixed(1));
    }

    /** Escape lets the lamps go (no cost; the next event is still two sleeps away). */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && treeView?.isOpen()) { closeTree(); return; }
        if (e.key !== 'Escape' || !state.asleep) return;
        // v1.52.0: Escape puts the choice away; nothing is refunded, the step waits, the pill asks
        if (choosing) { leaveChoice(); updateChrome(); return; }
        if (!state.watcher.puzzle) return;
        dismissPuzzle(state.watcher, state.cryo);
        lamp = null;
        updateChrome();
        saveGame();
    }, { signal });
    ui.ask.addEventListener('click', () => { if (!busy && !paused()) enterChoice(); }, { signal });
    // deep-fix: the TREE button answers through the walk into the hall (it was dead for 2.5 s)
    ui.treeBtn.addEventListener('click', () => toggleTree(), { signal });
    for (const b of ui.rpsBtns) b.addEventListener('click', () => throwAtSurface(b.dataset.throw), { signal });

    // a click puts a button's tooltip away until the cursor leaves it (v1.48.0: the snowflake's
    // tooltip stayed over the scene after the click that started the sleep)
    for (const b of ui.root.querySelectorAll('.deep-btn-col .btn')) {
        b.addEventListener('click', () => b.classList.add('tip-off'), { signal, capture: true });
        b.addEventListener('pointerleave', () => b.classList.remove('tip-off'), { signal });
        b.addEventListener('pointerenter', () => b.classList.remove('tip-off'), { signal });
    }
    ui.digBtn.addEventListener('click', guarded(dig), { signal });
    for (const { type, el } of ui.roomBtns) el.addEventListener('click', guarded(() => buildRoom(type)), { signal });
    // the preview: every purchase button shows its own future on the bars
    watchHover(ui.digBtn, () => ({ kind: 'dig', type: null, price: nextPrice(state, 'dig'), currency: 'minerals' }));
    for (const { type, el } of ui.roomBtns) {
        watchHover(el, () => ({ kind: 'room', type, price: nextPrice(state, 'room', type), currency: 'minerals' }));
    }
    ui.cryoBtn.addEventListener('click', guarded(pressCryo), { signal });
    ui.wakeBtn.addEventListener('click', () => { if (!busy) wake({ kind: 'manual' }); }, { signal });
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
        // awake, the Watcher rests: two points of stability an awake month (v1.49.0)
        recoverAwake(state.watcher, days);
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
        if (!state.watcher.gone) speak();
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
        stepVoice();
        stepLamps();
        stepMadness(now);
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
        ui.root.classList.add('is-sleeping', 'is-night');
        nightAtSleep = state.watcher.surface.night | 0;
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
        // v1.51.0, for the tests: the lamp event as it is being played, a click on a chamber as the
        // player's click would land, and the last game with Surface as a timeline
        get lamp() { return lamp ? { kind: lamp.p.kind, phase: lamp.phase, t: lamp.t, at: lamp.p.at || 0 } : null; },
        pressSlot: (slot) => pressSlot(slot),
        get rps() { return rps ? { stage: rps.stage, log: rps.log.slice() } : (rpsLast ? { stage: 'done', log: rpsLast.slice() } : null); },
        // v1.52.0, for the tests: the choice of a sector, and the people rolling off the H bar
        get choosing() { return choosing; },
        get hDrop() { return hDrop ? { text: hDrop.text, from: hDrop.from, to: hDrop.to } : null; },
        // deep-tree, for the tests: the panel, and what each node was last drawn from
        get treeOpen() { return !!treeView?.isOpen(); },
        // deep-voice, for the tests: the line on screen as it types
        get voice() {
            return voice ? { text: voice.text, typed: ui.voiceText.textContent, shown: !ui.voice.hidden,
                typing: ui.voice.classList.contains('is-typing') } : null;
        },
        get treeDrawn() { return treeView ? treeView.drawn : {}; },
        // deep-machine, for the tests: the machine's hover as it reads now, and whether it shows
        get machineTip() { return { text: machineText, shown: !!ui.machineTip && !ui.machineTip.hidden }; },
        get treeLog() { return treeView ? treeView.log : []; },
        // deep-night, for the tests: the night log's last line, and what the next night waits for now
        get treeLogNext() { return treeView ? treeView.logNext : ''; },
        // deep-fix, for the tests: the balances at the tree's top edge, and the road to the next tier
        get treeBalances() { return treeView ? treeView.balances : ''; },
        get road() { return roadNow; },
        get nightNext() { return nightNext(state); },
        openTree: () => openTree(),
        closeTree: () => closeTree(),
    };
    let debugOn = false;
    try { debugOn = window.location.search.includes('debug') || localStorage.getItem(DEBUG_KEY) === '1'; } catch { /* ignore */ }
    if (debugOn) {
        window.debug_deep = (what, n) => {
            if (what === 'minerals') state.minerals += 1e6;
            else if (what === 'stability') {
                // the Watcher's meter, set by hand: 0 reboots at the next sleeping tick
                state.watcher.stability = Math.max(0, Math.min(STABILITY_MAX, Number(n) || 0));
            } else if (what === 'capacity') state.watcher.capacity = Math.max(0, Math.min(capacityMax(state.watcher), Number(n ?? capacityMax(state.watcher))));
            else if (what === 'puzzle' || what === 'lamps' || what === 'dark') {
                // the lamps now, whatever the gap, the two sleeps and the capacity say (v1.51.0);
                // 'lamps' or 'dark' picks the kind. Surface goes first: one demand at a time
                state.watcher.capacity = Math.max(state.watcher.capacity, capacityMax(state.watcher));
                if (state.asleep) {
                    closeSurface(state.watcher);
                    stopRps();
                    state.watcher.puzzle = null;
                    lamp = null;
                    openPuzzle(state.watcher, lampsInView(), null, { kind: what === 'puzzle' ? null : what });
                }
            } else if (what === 'surface') {
                // Surface now, in this sleep, whatever the gaps say (v1.49.0)
                if (state.asleep) {
                    if (state.watcher.puzzle) { dismissPuzzle(state.watcher, state.cryo); lamp = null; }
                    stopRps();
                    const sf = state.watcher.surface;
                    sf.visit = null;
                    sf.lastSleep = 0;
                    openSurface(state.watcher, state);
                    surfaceKey = '';
                }
            } else if (what === 'night') {
                // deep-voice: Surface's next line now, in this sleep, whatever the pacing says
                if (state.asleep) {
                    if (state.watcher.puzzle) { dismissPuzzle(state.watcher, state.cryo); lamp = null; }
                    stopRps();
                    const sf = state.watcher.surface;
                    sf.visit = null;
                    sf.lastSleep = 0;
                    openSurface(state.watcher, state, { force: true });
                    surfaceKey = '';
                }
            } else if (what === 'ladder') {
                // the price of the next step, handed over: capacity, stars, ore
                const step = LADDER[(state.watcher.bought || []).length];
                if (step) {
                    state.watcher.capacity = capacityMax(state.watcher);
                    state.stars += step.stars;
                    state.minerals += step.ore || 0;
                    state.watcher.grown = BODY_GROW_SECONDS;       // and the body has grown enough
                }
            }
            else if (what === 'stars') state.stars += 1e8;
            else if (what === 'feed') {
                // deep-machine: the machine's feed level, set by hand (0 to FEED_MAX)
                state.feed = Math.max(0, Math.min(FEED_MAX, Math.floor(Number(n) || 0)));
            }
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
