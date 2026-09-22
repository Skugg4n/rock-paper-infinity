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
 */

import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS, DEBUG_KEY } from '../constants.js';
import {
    initialDeepState, tickDay, sleep, digCost, roomCost, levelCost, automationCost,
    ROOM_FOR_COLUMN, COLUMN, ROOMS, DAYS_PER_YEAR, CRYO, CHAPTER_V, MAX_AUTO,
    cryoLabel, cryoName, group, probeCost, probeDays, PROBE_ENERGY, launchProbe, resolveDueProbes,
    clearChamber, clearDarkType, stalledRooms, ascentOffered, attemptAscent, ASCENT,
    startBuild, completeBuilds, buildProgress, buildPending, estimateNow, habitableYear,
    sleepTrouble, repairTick, scoutParty, MIN_SLEEPERS,
} from './deep.js';
import {
    conditions, advisorLines, pushFeed, ROOM_WORD, DESCENT_LINE, alarmLine, alarmGlyph,
    scoutLine, scoutSentLine, troubleClause,
} from './advisor.js';
import {
    ledger, buySentence, preview, deltaText, stocks, flows, flowText, previewStocks,
    nextOrePrice, affordText, cryoGateText, consequence, span, rateWords,
} from './readout.js';
import { initialLayout, freeChamber, normalizeLayout } from './layout.js';
import { createScene, supportsWebGL, ROOM_ICON } from './scene.js';
import { createCrust } from './crust.js';
import { createReplay } from './replay.js';
import { serializeDeep, saveToStorage, loadFromStorage } from './persistence.js';
import { playChapterCard } from '../chapterCard.js';
import { doomsday } from '../phase3/war.js';

const { SAVE_KEY, MAX_CATCHUP_DAYS } = PHASE4_CONSTANTS;
const BAR_H = 160;                 // the track's height in CSS pixels
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** Big numbers stay legible: 1 234, 45.6k, 3.1M, 2.0B. */
export function formatCount(n) {
    const v = Math.floor(Math.abs(n));
    const sign = n < 0 ? '-' : '';
    if (v < 10000) return sign + v.toLocaleString('en-US');
    if (v < 1e6) return `${sign}${(v / 1e3).toFixed(1)}k`;
    if (v < 1e9) return `${sign}${(v / 1e6).toFixed(1)}M`;
    if (v < 1e12) return `${sign}${(v / 1e9).toFixed(1)}B`;
    // a trillion step and two decimals past it: asleep at the top tiers the counters must
    // still visibly tick (B054), and 6.0e+14 does not move for a long time
    if (v < 1e15) return `${sign}${(v / 1e12).toFixed(1)}T`;
    return `${sign}${v.toExponential(2)}`;
}

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
        cryoUpBtn: document.getElementById('deep-cryo-up'),
        cryoUpBadge: document.getElementById('deep-cryo-up-badge'),
        probeBtn: document.getElementById('deep-probe-btn'),
        ascendBtn: document.getElementById('deep-ascend-btn'),
        resetBtn: document.getElementById('deep-reset-view'),
        crust: document.getElementById('deep-crust'),
        replay: document.getElementById('deep-replay'),
        root: document.getElementById('phase-deep'),
    };
    crust = createCrust(ui.crust, { onIcons: scheduleIconRefresh });
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
    let gates = { hall: null, current: null, next: null };   // what a dry run says would wake a sleep
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
        const ahead = hovering ? preview(state, hovering.kind, hovering.type, report) : null;
        const ghost = hovering ? previewStocks(state, hovering.kind, hovering.type, hovering.price || 0, hovering.currency || 'minerals', orePrice) : null;
        for (const c of COLUMN) {
            const h = Math.round(BAR_H * st[c].frac);
            ui.fills[c].style.height = `${h}px`;
            ui.heads[c].textContent = st[c].head;
            ui.flowIn[c].textContent = flowText(fl[c].in, '+');
            ui.flowOut[c].textContent = flowText(fl[c].out, '-');
            const weakest = c === report.weakest;
            ui.dots[c].classList.toggle('hidden', !weakest);
            if (weakest) ui.dots[c].style.bottom = `${Math.min(BAR_H - 4, h + 10)}px`;
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
                ? `Asleep: ${rateWords(CRYO[state.cryo].days)} a second. The hall wakes us if anything goes wrong.`
                : `Year ${group(cal.year)}: the ${ROOM_WORD[ROOM_FOR_COLUMN[report.weakest]]} is the bottleneck.`);
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

        const weakType = ROOM_FOR_COLUMN[report.weakest];
        const levelPrice = levelCost(weakType, state.level[weakType] || 0);
        const lvPending = buildPending(state, 'level', weakType);
        ui.levelBtn.classList.toggle('is-locked', asleep || state.stars < levelPrice || lvPending);
        buyTip(ui.levelBtn, { kind: 'level', type: weakType, price: levelPrice, currency: 'stars', sentence: buySentence('level', weakType, state), blocked: lvPending ? 'pending' : '', mark: roomMark(weakType) });
        showBuild(ui.levelBtn, 'level', weakType);

        // automation is teased only once the first level is bought
        const anyLevel = Object.values(state.level).some((l) => l > 0);
        ui.autoBtn.classList.toggle('hidden', !anyLevel);
        if (anyLevel) {
            const autoPrice = automationCost(weakType, state.auto[weakType] || 0);
            const auPending = buildPending(state, 'auto', weakType);
            ui.autoBtn.classList.toggle('is-locked', asleep || !(state.stars >= autoPrice) || auPending);
            buyTip(ui.autoBtn, {
                kind: 'auto', type: weakType, price: autoPrice, currency: 'stars', mark: roomMark(weakType),
                sentence: Number.isFinite(autoPrice) ? buySentence('auto', weakType, state) : '',
                blocked: (state.auto[weakType] || 0) >= MAX_AUTO ? 'top' : (auPending ? 'pending' : ''),
            });
            showBuild(ui.autoBtn, 'auto', weakType);
        }

        // ---- cryo: the hall, then the sleep; asleep, the sun that wakes the colony ----
        const tier = state.cryo;
        const owns = tier >= 0;
        ui.cryoBtn.classList.toggle('hidden', asleep);
        ui.wakeBtn.classList.toggle('hidden', !asleep);
        ui.cryoBadge.classList.toggle('hidden', !owns);
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
            const gate = cryoGateText(0, gates.hall, state);
            ui.cryoBtn.classList.toggle('is-locked', busy || !free || state.stars < CRYO[0].cost || !!gates.hall);
            setTooltip(ui.cryoBtn, priceRow(roomMark('cryo') + starCost(CRYO[0].cost))
                + says(`${cryoName(0)}: a cryo hall. Asleep, a month passes every second and the machines keep working.`)
                + note(gate || affordText({ price: CRYO[0].cost, have: state.stars, perDay: report.stars, blocked: free ? '' : 'chamber' }), 'is-missing'));
        }
        // the next tier: on screen once the hall is dug, offered once a sleep at its rate is safe
        const nextTier = owns ? CRYO[tier + 1] : null;
        ui.cryoUpBtn.classList.toggle('hidden', !nextTier || asleep);
        if (nextTier && !asleep) {
            ui.cryoUpBadge.textContent = rateLabel(tier + 1);
            const gate = cryoGateText(tier + 1, gates.next, state);
            ui.cryoUpBtn.classList.toggle('is-locked', busy || state.stars < nextTier.cost || !!gates.next);
            setTooltip(ui.cryoUpBtn, priceRow(roomMark('cryo') + starCost(nextTier.cost))
                + says(`${cryoName(tier + 1)}: sleep ${rateWords(nextTier.days)} a second.`)
                + note(gate || affordText({ price: nextTier.cost, have: state.stars, perDay: report.stars }), 'is-missing'));
        }

        // ---- scout parties: people up the shaft, for a reading of the sky ----
        const scoutsOn = owns || state.probesSent > 0 || state.probes.length > 0;
        ui.probeBtn.classList.toggle('hidden', !scoutsOn);
        if (scoutsOn) {
            const price = probeCost(state.probesSent);
            const party = scoutParty(state.humans);
            const people = state.humans - party >= MIN_SLEEPERS;
            const power = report.parts.E >= PROBE_ENERGY;
            ui.probeBtn.classList.toggle('is-locked', busy || asleep || state.minerals < price || !power || !people);
            const away = span(probeDays(state.probesSent));
            const missing = !people ? affordText({ blocked: 'people' })
                : (!power ? `Needs ${PROBE_ENERGY} spare energy to open the shaft: ${formatCount(report.parts.E)} today.`
                    : affordText({ price, have: state.minerals, perDay: report.parts.M, blocked: asleep ? 'asleep' : '' }));
            setTooltip(ui.probeBtn, priceRow(mineralCost(price) + cost(PROBE_ENERGY, 'zap') + cost(party, 'users'))
                + says(`Sends ${party} people up the shaft for about ${away}. They bring back a reading of the surface, or they do not come back.`)
                + note(missing, 'is-missing')
                + note('Every reading narrows the ring: the year we can go up.', 'is-goal'));
        }

        // ---- the way up: greyed from the first second, open on what the colony believes ----
        ui.ascendBtn.classList.toggle('is-locked', busy || asleep || !ascentOffered(state));
        setTooltip(ui.ascendBtn, priceRow(mineralCost(ASCENT.minerals) + starCost(ASCENT.stars) + cost(ASCENT.humans, 'users'))
            + says('The way up. It opens when the ring says the surface is habitable and the climb is paid for.'));

        const est = estimateNow(state);
        const year = habitableYear(state);
        crust.update({ est, year: Number.isFinite(year) ? group(year) : '', pending: (state.probes || []).length });
        scheduleIconRefresh();
    }

    /** The dry runs behind the cryo buttons. Once a colony day, never per frame. */
    function recomputeGates() {
        if (state.asleep) return;
        const owns = state.cryo >= 0;
        gates = {
            hall: owns ? null : sleepTrouble(state, CRYO[0].days),
            current: owns ? sleepTrouble(state, CRYO[state.cryo].days) : null,
            next: owns && CRYO[state.cryo + 1] ? sleepTrouble(state, CRYO[state.cryo + 1].days) : null,
        };
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
    /** Levels the room type that fixes the weakest column: the dot is the instruction. */
    function levelWeakest() {
        const type = ROOM_FOR_COLUMN[report.weakest];
        if (buildPending(state, 'level', type)) return;
        const price = levelCost(type, state.level[type] || 0);
        if (state.stars < price) return;
        state.stars -= price;
        startBuild(state, 'level', { type });
        mendType(type);
        bought();
        afterChange();
    }
    function automateWeakest() {
        const type = ROOM_FOR_COLUMN[report.weakest];
        if (buildPending(state, 'auto', type)) return;
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
    function buyCryoHall() {
        const slot = freeChamber(layout);
        if (slot < 0 || state.stars < CRYO[0].cost || gates.hall) return;
        state.stars -= CRYO[0].cost;
        state.cryo = 0;
        state.rooms.cryo = (state.rooms.cryo || 0) + 1;
        layout.slots[slot] = 'cryo';
        bought();
        afterChange();
    }
    function buyCryoTier() {
        const next = CRYO[state.cryo + 1];
        if (!next || state.stars < next.cost || gates.next) return;
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
        sleepSum = freshSum();
        // falling asleep: the first moment spins like the odometer it always was
        const before = snapshot();
        roll = { from: before, to: before, t0: performance.now(), dur: 0.05, ease: linear };
        const sum = sleepChunk(CRYO[state.cryo].days * SLEEP_TIMING.spin);
        saveGame();
        await rollTo(snapshot(), SLEEP_TIMING.spin, odometer);
        setBusy(false);
        if (sum.alarm) { await wake(sum.alarm); return; }
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
    function sleepTick() {
        if (busy || !state.asleep) return;
        const now = performance.now();
        // a hidden tab gets its timers throttled; it sleeps slower, it never jumps
        const dt = Math.min(0.25, Math.max(0, (now - lastSleepAt) / 1000));
        lastSleepAt = now;
        if (!(dt > 0)) return;
        // draw where the roll stands before starting the next one: a tab that gets no frames
        // (hidden, or a pane in the background) still sees the years move ten times a second
        drawCounters(rollingValue(now));
        const sum = sleepChunk(CRYO[state.cryo].days * dt);
        rollTo(snapshot(), SLEEP_TICK_MS / 1000 + 0.02);
        sleepTicks++;
        if (sum.alarm) { wake(sum.alarm).catch((e) => console.error('the deep: the wake broke', e)); return; }
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
        const line = alarmLine(alarm);
        const extra = alarm.kind === 'scouts' ? (alarm.landed || []).slice(1).map(scoutLine) : [];
        feed = pushFeed(feed, [line, ...extra]);
        advisorLine = `Year ${group(calendar(state.day).year)}. ${line}`;
        const t = sleepSum || freshSum();
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
        report = dryRun();
        recomputeGates();
        replay.show({
            rooms: state.rooms, stalled: state.stalled, alarm: alarmGlyph(alarm, ROOM_ICON),
            minerals: t.minerals, food: t.food, stars: t.stars, weakest: t.weakest, died: t.died,
        });
        sleepSum = null;
        toldAbout = null;               // a new day for the advisor: say where we stand again
        setBusy(false);
        startClock();
        updateChrome();
        saveGame();
    }

    // --- scout parties ----------------------------------------------------------
    function sendProbe() {
        // the ore and the people are deep.js's business; the spare power is the chrome's, because
        // the E column is a flow and not a stock: a colony with no headroom cannot open the shaft
        if (report.parts.E < PROBE_ENERGY) return;
        const p = launchProbe(state);
        if (!p) return;
        feed = pushFeed(feed, [scoutSentLine(p.people)]);
        bought();
        afterChange();
    }

    // --- the way up -----------------------------------------------------------
    /** The door opens on the estimate; what is behind it is the truth. A colony that
     *  guessed wrong loses a quarter of itself and gets its doubt back. */
    async function pressAscent() {
        if (busy || state.asleep || !ascentOffered(state)) return;
        setBusy(true);
        stopClock();
        const out = attemptAscent(state);
        saveGame();
        if (!out.success) {
            advisorLine = `Year ${group(calendar(state.day).year)}: `
                + `${formatCount(out.lost)} went up. Nobody came back.`;
            feed = pushFeed(feed, [`${formatCount(out.lost)} went up. Nobody came back.`]);
            report = dryRun();
            scene?.setState(state, layout);
            setBusy(false);
            startClock();
            updateChrome();
            return;
        }
        replay.hide();
        await (scene ? scene.ascend(2.0) : Promise.resolve());
        crust.lighten();
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
        const type = ROOM_FOR_COLUMN[report.weakest];
        return { kind: 'level', type, price: levelCost(type, state.level[type] || 0), currency: 'stars' };
    });
    watchHover(ui.autoBtn, () => {
        const type = ROOM_FOR_COLUMN[report.weakest];
        const price = automationCost(type, state.auto[type] || 0);
        return { kind: 'auto', type, price: Number.isFinite(price) ? price : 0, currency: 'stars' };
    });
    ui.cryoBtn.addEventListener('click', guarded(pressCryo), { signal });
    ui.wakeBtn.addEventListener('click', () => { if (!busy) wake({ kind: 'manual' }); }, { signal });
    ui.cryoUpBtn.addEventListener('click', guarded(buyCryoTier), { signal });
    ui.probeBtn.addEventListener('click', guarded(sendProbe), { signal });
    ui.ascendBtn.addEventListener('click', () => pressAscent(), { signal });
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
            for (const l of resolveDueProbes(state, layout.slots, Math.random)) lines.push(scoutLine(l));
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
        scene?.step(dt);
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
        runSleep();
    } else {
        state.asleep = false;
        startClock();
    }

    // A colony that already climbed is finished: the wall stands again on every reload.
    if (state.ascended) {
        crust.lighten();
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
        window.debug_deep = (what) => {
            if (what === 'minerals') state.minerals += 1e6;
            else if (what === 'stars') state.stars += 1e8;
            else if (what === 'day100') { for (let i = 0; i < 100; i++) report = tickDay(state, state.asleep); }
            else if (what === 'sleep') { pressCryo(); return; }
            else if (what === 'alarm') { if (state.asleep) wake({ kind: 'debug' }); return; }
            else if (what === 'probe') {
                state.minerals += probeCost(state.probesSent || 0);   // the hook is the party, not the bill
                const p = launchProbe(state);
                if (p) feed = pushFeed(feed, [scoutSentLine(p.people)]);
            } else if (what === 'home') {
                // bring every party home tomorrow: asleep, that is the next alarm
                for (const p of state.probes || []) p.dueDay = state.day + 1;
            } else if (what === 'ascend') {
                state.minerals = Math.max(state.minerals, ASCENT.minerals);
                state.stars = Math.max(state.stars, ASCENT.stars);
                state.humans = Math.max(state.humans, ASCENT.humans);
                // believe the surface is at 14 %, whatever it really is
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
