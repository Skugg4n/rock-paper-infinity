/* global lucide */

/**
 * Chapter IV · THE DEEP: the phase. Holds the colony's state, runs its calendar (one real second is
 * one day awake), draws the chrome over the model, and saves. The rules live in deep.js, the
 * positions in layout.js and the model in scene.js; this file is the wiring between them.
 *
 * deep-rebuild (docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md): movements I and II.
 *   I · TEND. An instrument panel (panel.js) instead of the bars, the advisor and the readouts: four
 *   gauges, one stamped word of advice, the empty chambers, the three lamps of cryo. Rooms are built
 *   where they go, on the empty plates (view-hooks.js, the ring of four). Levels and automation are
 *   in a drawer from the right (drawer.js) that lists only what can be bought now and the next thing
 *   per branch. Cryo I is three lamps and a lever.
 *   II · SLEEP. The lever pulls the colony under: the panel goes dark light by light, the middle of
 *   the screen counts the years slept, and time accelerates within the sleep (watcher.js
 *   sleepDaysAt). A wake lights one lamp with one word. As the Watcher's mind goes, the screen
 *   hallucinates (instruments.js); a click on the base snaps it back. Surface is the hallucination:
 *   it comes only to a low mind, and from night 4 it speaks in the Watcher's own letters.
 *
 * deep-grow: III · GROW. The question answered, the colony does not sleep any more. The panel
 *   overgrows (panel.js overgrow), the drawer becomes tissue with the body's four items (grow.js),
 *   and the body spreads over the chambers as the player clicks them (view-hooks.js setBody,
 *   onChamberClick): it eats people every year of its own, starved its edge dies back, its organs
 *   make twenty times what the rooms did. The machine house taken, the tubes become hands. When the
 *   deepest floor is full the lever comes back, overgrown: RISE.
 *
 * deep-grow2: a taste of flesh before the question (graft.js: nights 4 and 5 give a graft; a click on
 *   a built room turns it to flesh, "×5" floats over it); the people counter beside ore and stars; the
 *   question as a choice; the feeding loop (grow.js); one choice at a time in the drawer. THE BODY
 *   DREAMS: awake GROW runs a day a second, the lever reads DREAM, a click on a chamber out of reach
 *   marks it (a red thread from the body), the dream dives time and the body grows along the marks
 *   until HUNGER, REACHED or the lever. THE HEART: awake, a click on the lid pumps (on the beat, double).
 *
 * Asleep, a 10 Hz sleep timer runs the colony; the frame loop only rolls the numbers between those
 * ticks. `window.__rpiPaused` (the shell's pause button) stops the chapter's clocks.
 */

import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS, DEBUG_KEY } from '../constants.js';
import {
    initialDeepState, tickDay, sleep,
    ROOMS, DAYS_PER_YEAR, CRYO, CHAPTER_V,
    group, clearChamber, clearDarkType, stalledRooms, completeBuilds,
    sleepTrouble, repairTick, MIN_SLEEPERS, RESURFACE_AT, resolveDueProbes,
    ordersDone, mourn, orderBuild, nextPrice, chambersAhead, isQueued, buildEta, QUEUE_MAX, queueRunsAsleep,
    cancelOrder, digSpare, nextCryo, CRYO_TOP, FEED_MAX, buildProgress,
    setIncome, beginSleepYield, endSleepYield, sleepCap,
} from './deep.js';
import { pushFeed, alarmLine } from './advisor.js';
import { short, span, cryoRoad, cryoNeed, ORE_SIGN, signHtml, rateText, FULL_TEXT } from './readout.js';
import { initialLayout, freeChamber, normalizeLayout, sectorOf, claimChambers, emptyChambers } from './layout.js';
import { createScene, supportsWebGL, chamberPlace as sceneChamberPlace } from './scene.js';
import { createStrataView, extendHooks, chamberPlace as strataChamberPlace } from './strata-view.js';
import { trackHistory } from './strata.js';
import { VIEW_KEY, VIEW_NAME, chosenView, otherView, urlForView } from './views.js';
import { serializeDeep, saveToStorage, loadFromStorage } from './persistence.js';
import {
    normalizeWatcher, watcherName, watchSleep, alarmHit, snap as snapWatcher, softness, watcherLines,
    puzzleDue, openPuzzle, beginSleep, dismissPuzzle, puzzleStars,
    STABILITY_MAX, firstSleep, FIRST_SLEEP_DAYS, snapWait, SNAP_COOLDOWN_MS,
    recoverAwake, LADDER, capacityMax, surfaceDue, openSurface, closeSurface,
    playSurface, selfSolve, autoSnapDue, bodyWhole, lastWake, ascendAlone,
    NOBODY_LINE, BODY_GROW_SECONDS, sealLine,
    lampSlots, isLamp, pressLamp, expireLamps, lampFactor, DARK_MS, rungOpenLine,
    mindWarning, lampHint, taughtLamps,
    sealCandidates, sealSector, choosingSector, bodyGlyph, inBody, textMadness, lookDue, sleepDaysAt, sleepPace,
} from './watcher.js';
import { THROWS, THROW_ICON, SENTENCE, SENTENCE_LINE, TYPE_MS, NIGHTS } from './surface.js';
import { NODE_BY_ID, buy as treeBuy, buyMany as treeBuyMany, normalizeTree, canBuy, LEVEL_NODE, AUTO_NODE } from './tree.js';
import { machineTempo, machineSays } from './machine.js';
import { createTreeView } from './tree-view.js';
import {
    gauges as readGauges, advise, cryoLamps, wakeWord, hallucinationsAt, SNAP_CLEAR_MS, healing,
    drawerGroups, drawerCount, surfaceTape, MERGE_MS, RPS_FADE_MS, cardGone,
    adviseAsleep, adviceNote, RECALL_MS, levelsReady, LEVELS_ROW, rowName, wakeWhy, roomStarsLine, calledRow, PRICES_FOOT,
} from './instruments.js';
import { createPanel } from './panel.js';
import { createDrawer } from './drawer.js';
import { createViewHooks } from './view-hooks.js';
import {
    growOn, risen, normalizeGrow, organsOf, stepGrow, viewOf, graphOf, growTarget,
    growGauges, adviseGrow, riseLamps, riseReady, bodyGroups, buyBody, fleshShare, rise as riseBody,
    GROW_GAUGES, GROW_DAYS_PER_SECOND, GROW_END, RISE_LINES, setChamberPlace,
    takeTip, toggleMark, markThreads, dreamStart, dreamWake, dreamEnd, dreaming, dreamDaysAt,
    pump, beatPhase, onBeat, PUMP_COOLDOWN_MS, peoplePerSecond, organMultiplier,
    takeOffer, startTake, taking, bodyRatios, pumpPath, ORGAN_NAME, HANDS_PULSE, handsGames, growNote, wantOrgan, GAUGE_ORGAN,
} from './grow.js';
import { surgeOf } from './organs.js';
import { MASS_SIGN } from './readout.js';
import { normalizeGraft, graftOwed, graftCandidates, graftWords, placeGraft, loneGrafts, GRAFT_MULT, graftEffect } from './graft.js';
import { HANDS_SECONDS } from './view-hooks.js';
import { playChapterCard } from '../chapterCard.js';
import { audio } from '../audio.js';
import { createDeepSound } from './sound.js';
import { doomsday } from '../phase3/war.js';

const { SAVE_KEY, MAX_CATCHUP_DAYS } = PHASE4_CONSTANTS;
/** The shell's pause (main.js owns the flag): the chapter's clocks hold while it is set. */
const paused = () => typeof window !== 'undefined' && !!window.__rpiPaused;
/** A click on the base is a click, not the end of a drag that turned the camera. */
const CLICK_PX = 6, CLICK_MS = 500;

/** The walk into the hall, the odometer spin of falling asleep, the walk out. Seconds. */
export const SLEEP_TIMING = { gather: 1.5, spin: 1.5, release: 1.2 };
/** The panel's lights go out one by one over this long when the lever is pulled. */
export const LIGHTS_MS = 800;
/** Asleep, the colony is advanced this often (ms); the frames roll the numbers in between. */
const SLEEP_TICK_MS = 100;
/** The wake's one lamp stays lit this long, or until the next purchase. */
export const ALARM_LAMP_MS = 12000;
/** The wake's sentences are kept in the save, the last this many; never on screen. */
const WAKE_LOG_MAX = 30;
/** Surface's game appears this long after its line has finished typing. */
export const GAME_AFTER_LINE_MS = 1000;

let abortController = null;
let dayInterval = null;
let sleepInterval = null;
let dreamTimer = null;              // deep-grow2: the dream's interval, for teardown
let rafId = 0;
let scene = null;
let sound = null;
let savingEnabled = true;
let beforeUnloadHandler = null;
let iconRefreshQueued = false;
let viewItem = null;                // deep-swap: "View: strata / 3D" in the ☰ menu, while IV is open

/** Debounced lucide pass: never called straight from a loop. */
function scheduleIconRefresh() {
    if (iconRefreshQueued) return;
    iconRefreshQueued = true;
    requestAnimationFrame(() => {
        iconRefreshQueued = false;
        try { lucide.createIcons(); } catch { /* the CDN is not there; the glyphs are not the game */ }
    });
}

/**
 * deep-swap: "View · strata" or "View · 3D" in the ☰ menu while chapter IV is open. A click keeps the
 * other view as the choice and loads the page again (the game is saved on the way out).
 */
function mountViewItem(kind) {
    viewItem?.remove();
    viewItem = null;
    const menu = document.getElementById('menu-dropdown');
    if (!menu) return;
    const b = document.createElement('button');
    b.id = 'deep-view-toggle';
    b.type = 'button';
    b.className = 'block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 whitespace-nowrap border-b border-slate-100';
    b.textContent = `View · ${VIEW_NAME[kind]}`;
    b.title = `Show the colony in the ${VIEW_NAME[otherView(kind)]} view`;
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = otherView(kind);
        try { localStorage.setItem(VIEW_KEY, next); } catch { /* the URL still carries it */ }
        const url = urlForView(window.location.href, next);
        if (url === window.location.href) window.location.reload();
        else window.location.assign(url);
    });
    menu.insertBefore(b, document.getElementById('reset-btn'));
    viewItem = b;
}

/** Every number in chapter IV: "313 k", "2.3 B", "9 M". See readout.js `short()`. */
export const formatCount = short;

/** Day 0 is the day the exit was blown: year 0, month 1, day 1. */
export function calendar(day) {
    const d = Math.max(0, Math.floor(day));
    const year = Math.floor(d / DAYS_PER_YEAR);
    const rest = d - year * DAYS_PER_YEAR;
    // twelve months of thirty days, and the last one holds the five left over (day 31 to 35)
    const month = Math.min(12, Math.floor(rest / 30) + 1);
    return { year, month, day: rest - (month - 1) * 30 + 1 };
}

/**
 * What came down the hole: the salvage the war left and how scorched the surface was the day the
 * exit was blown. Read out of chapter II's save; defaults when there is nothing to read.
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
    state.graft = normalizeGraft(state.graft);
    claimChambers(state, layout);
    // deep-swap: the years per sleep, kept with the save so the strata view lays the same layers after
    // a reload; a save from before is given them from the years slept and the number of sleeps
    trackStrata();
    function trackStrata() {
        const w = state.watcher || {};
        const next = trackHistory(state.strata, w.sleptYears || 0, w.sleeps || 0);
        if (next !== state.strata) state.strata = next;
    }

    // deep-sound: the chapter's sound. A colony that already climbed is finished and makes no sound.
    sound = createDeepSound(audio, { isHeld: () => !!document.querySelector('#chapter-card.is-active') });
    if (!state.ascended) {
        sound.start();
        if (!saved) sound.event('descent');
    }

    const $ = (id) => document.getElementById(id);
    const ui = {
        sceneHost: $('deep-scene'),
        labelHost: $('deep-labels'),
        fallback: $('deep-fallback'),
        year: $('deep-year'), month: $('deep-month'), dayOfMonth: $('deep-day'),
        minerals: $('deep-minerals'), stars: $('deep-stars'),
        oreRate: $('deep-minerals-rate'), starsRate: $('deep-stars-rate'),
        digBtn: $('deep-dig-btn'), digPrice: $('deep-dig-price'),
        treeBtn: $('deep-tree-btn'), treeBadge: $('deep-tree-badge'), tree: $('deep-tree'),
        lever: $('deep-lever'), leverWrap: $('deep-lever-wrap'), leverPrice: $('deep-lever-price'), leverTape: $('deep-lever-tape'),
        ascendBtn: $('deep-ascend-btn'), resetBtn: $('deep-reset-view'),
        root: $('phase-deep'),
        panel: $('deep-panel'),
        dive: $('deep-dive'), diveYears: $('deep-dive-years'), diveArc: $('deep-dive-arc'), diveUnit: $('deep-dive-unit'),
        watcher: $('deep-watcher'), watcherName: $('deep-watcher-name'),
        stabFill: $('deep-stab-fill'), stabVal: $('deep-stab-val'),
        pulse: document.querySelector('#deep-watcher .deep-watcher-pulse'),
        bodyTip: $('deep-body-tip'), machineTip: $('deep-machine-tip'),
        card: { el: $('deep-puzzle'), q: $('deep-puzzle-q'), said: $('deep-puzzle-said'), hint: $('deep-puzzle-hint') },
        queue: $('deep-queue'),
        ask: $('deep-watcher-ask'),
        duel: $('deep-rps-duel'), fistYou: $('deep-fist-you'), fistIt: $('deep-fist-it'), fistItFront: $('deep-fist-it-front'),
        night: $('deep-night'),
        surface: $('deep-surface'), surfaceName: $('deep-surface-name'),
        voice: $('deep-voice'), voiceText: $('deep-voice-text'), voiceRest: $('deep-voice-rest'),
        surfaceSaid: $('deep-surface-said'), surfaceWords: $('deep-surface-words'),
        rpsBtns: [...document.querySelectorAll('#deep-surface .deep-rps-btn')],
        snapRing: $('deep-snap-ring'), snapArc: document.querySelector('#deep-snap-ring .arc'),
        drawer: $('deep-drawer'), ring: $('deep-ring'),
        takeTip: $('deep-take-tip'), riseLines: $('deep-rise-lines'), recall: $('deep-recall'),
        // deep-grow2
        people: $('deep-people'), peopleRate: $('deep-people-rate'),
        mass: $('deep-mass'), massRate: $('deep-mass-rate'),
        heart: $('deep-heart'), heartSurge: document.querySelector('#deep-heart .deep-heart-surge'), marks: $('deep-marks'), float: $('deep-float'), diveWord: $('deep-dive-word'),
    };
    $('deep-crust').hidden = true;

    // --- the model, and the hooks the HUD talks to it through ---
    // deep-swap: THE STRATA VIEW is the default (Ola's choice, 2026-10-03); `?view=3d` or the ☰
    // menu's "View" makes the 3D one. Both answer the same calls (view-hooks.js, strata-view.js
    // extendHooks), and each says where a chamber sits in it, so the body's neighbours are the ones
    // on the screen (grow.js setChamberPlace)
    let storedView = null;
    try { storedView = localStorage.getItem(VIEW_KEY); } catch { /* ignore */ }
    const viewKind = chosenView(window.location.search, storedView);
    setChamberPlace(viewKind === '3d' ? sceneChamberPlace : strataChamberPlace);
    if (supportsWebGL()) {
        try {
            const common = {
                labelHost: ui.labelHost,
                onInteract: () => ui.resetBtn.classList.add('is-on'),
                onLabels: scheduleIconRefresh,
                onClearDark: (slot) => clearDark(slot),
                // deep-fix2: the "+" on the next chamber digs, as the DIG button does
                onDig: () => (!busy && !state.asleep && !paused() && !state.watcher.gone ? dig() : false),
            };
            scene = viewKind === '3d' ? createScene(ui.sceneHost, common)
                : createStrataView(ui.sceneHost, {
                    ...common, insetLeft: panelInset(),
                    // the year ruler's labels keep out from under what we hold, the buttons and the lever
                    avoid: () => [$('deep-hold'), $('deep-act'), ui.resetBtn].filter(Boolean).map((e) => e.getBoundingClientRect()),
                });
        } catch (e) {
            console.error('the deep: the model could not be built', e);
            scene = null;
        }
    }
    /** The strata view centres the colony in what the instrument panel leaves free on the left. */
    function panelInset() {
        const r = ui.panel ? ui.panel.getBoundingClientRect() : null;
        return Math.round(r && r.right > 0 ? r.right + 12 : 348);
    }
    if (!scene) ui.fallback.classList.add('is-on');
    ui.root.dataset.view = viewKind;
    // deep-grow: once the body grows nothing is built into an empty chamber any more
    const isEmpty = (slot) => !growOn(state) && emptyChambers(state, layout).includes(slot);
    const baseHooks = createViewHooks(scene, {
        ringHost: ui.ring, isEmpty, onIcons: scheduleIconRefresh, graph: () => graphOf(layout), marksHost: ui.marks, floatHost: ui.float,
    });
    const hooks = scene && viewKind !== '3d' ? extendHooks(baseHooks, scene) : baseHooks;
    mountViewItem(viewKind);
    const panel = createPanel({
        root: ui.panel, gauges: $('deep-gauges'), advice: $('deep-advice'), note: $('deep-advice-note'), empty: $('deep-empty'),
        lamps: $('deep-lamps'), alarm: $('deep-alarm'), alarmWord: $('deep-alarm-word'),
    });

    // A transition is playing (the walk into the hall, the spin, the walk out): nothing is clickable.
    let busy = false;
    let feed = [];                  // the old advisor's lines, kept for the save-log only
    let roll = null;                // the numbers rolling between two sleep ticks: { from, to, t0, dur, ease, done }
    let sleepSum = null;            // the whole sleep, added up chunk by chunk
    let lastSleepAt = 0;
    let sleepTicks = 0;
    let sleepClock = 0;             // deep-rebuild: real seconds into this sleep, for the dive
    let nightBefore = state.watcher.surface.night | 0;   // deep-econ: the night the sleep began on
    let lookClock = 0;              // deep-fix: real seconds of this sleep, for the look at Cryo I and II
    let diveOffset = 0;             // the years slept, as days, less the calendar day: constant within a sleep
    let alarmUntil = 0;             // the wake's lamp goes out then (0: it is out)
    let inst = { advice: '', lamps: null, lever: false };   // what the instruments say, kept once a colony day
    let lastTempo = { throws: 0 };   // the machine's tempo as last read (the hands throw on it)

    const dryRun = () => tickDay(JSON.parse(JSON.stringify(state)), state.asleep);
    // deep-grow2: the lone grafts make five times and eat a few people (grow.js organsOf)
    state.organs = organsOf(state, layout);
    // deep-econ (B330): the prices follow the colony's income, worked out afresh when the save is
    // opened, so a save sitting on an absurd stock (Ola's ★ 9.8e16) lands where it can buy again.
    // A save that slept with no cap counted keeps sleeping without one until its next wake
    if (!growOn(state)) setIncome(state);
    if (!state.asleep) endSleepYield(state);
    let report = dryRun();
    // deep-grow: a save that answered The question (or owns the old biological steps) has its body
    if (normalizeGrow(state, layout, report)) {
        state.organs = organsOf(state, layout);
        report = dryRun();
    }

    function saveGame() {
        if (!savingEnabled || window.__rpiSkipSave) return;
        saveToStorage(SAVE_KEY, serializeDeep(state, layout));
    }
    beforeUnloadHandler = () => saveGame();
    /** The wake's sentences: kept in the save, never on screen. */
    function logLines(lines) {
        if (!lines.length) return;
        feed = pushFeed(feed, lines);
        const year = calendar(state.day).year;
        state.wakeLog = [...(Array.isArray(state.wakeLog) ? state.wakeLog : []), ...lines.map((line) => ({ year, line }))].slice(-WAKE_LOG_MAX);
    }

    /* ---- THE COUNTERS ---------------------------------------------------------------------- */
    function drawClock(day) {
        const cal = calendar(day);
        ui.year.textContent = group(cal.year);
        ui.month.textContent = cal.month;
        ui.dayOfMonth.textContent = cal.day;
    }
    /** The middle of the night: the years slept, and the healing ring round them. */
    function drawDive(day) {
        const slept = Math.max(0, day + diveOffset);
        // under two years the count is in months, so the first sleep is seen to move
        const months = slept < 2 * DAYS_PER_YEAR;
        const text = stutter(group(Math.floor(months ? slept / 30 : slept / DAYS_PER_YEAR)));
        // deep-tension: "1 MONTHS" read wrong
        const n0 = Math.floor(months ? slept / 30 : slept / DAYS_PER_YEAR);
        const unit = months ? (n0 === 1 ? 'MONTH' : 'MONTHS') : (n0 === 1 ? 'YEAR' : 'YEARS');
        if (ui.diveUnit.textContent !== unit) ui.diveUnit.textContent = unit;
        if (ui.diveYears.textContent !== text) {
            ui.diveYears.textContent = text;
            const n = text.replace(/\D/g, '').length;
            ui.diveYears.dataset.size = n <= 5 ? 'l' : n <= 7 ? 'm' : 's';
        }
        const k = healing({ doom0: state.doom0, day });
        ui.diveArc.setAttribute('stroke-dashoffset', (603.2 * (1 - k)).toFixed(1));
    }
    function drawCounters(v) {
        if (state.asleep || dreaming(state)) drawDive(v.day);
        else drawClock(v.day);
        ui.minerals.textContent = formatCount(v.ore);
        ui.stars.textContent = formatCount(v.stars);
        const ppl = formatCount(Math.max(0, state.humans || 0));
        if (ui.people && ui.people.textContent !== ppl) ui.people.textContent = ppl;
        // deep-organs: the body's mass, its currency, beside them in GROW
        if (ui.mass && growOn(state)) {
            const m = formatCount(Math.floor(Math.max(0, state.grow.mass || 0)));
            if (ui.mass.textContent !== m) ui.mass.textContent = m;
        }
    }
    const snapshot = () => ({ day: state.day, ore: state.minerals, stars: state.stars });

    /* ---- THE MIND GOES (deep-rebuild) --------------------------------------------------------
       As the Watcher's stability falls in the sleep, the screen hallucinates: a lamp in an empty
       chamber, a figure on the crust, a needle and a year digit that read wrong for a moment, a
       plate's walls that breathe. One kind at a time comes in; a snap takes them all away. */
    let clearUntil = 0;             // after a snap, nothing false comes back before this
    let nextFalseAt = 0;            // the next kind may come in after this
    let twitchAt = 0;               // when the next needle twitches
    let stuttered = null;           // { text, until } while the year shows wrong
    const falseNow = { lamp: false, figure: false, twitch: false, breathe: false };
    function stutter(text) {
        const now = performance.now();
        if (!falseNow.twitch) { stuttered = null; return text; }
        if (stuttered && now < stuttered.until) return stuttered.text;
        stuttered = null;
        if (Math.random() < 0.02) {
            const digits = [...text].map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);
            if (!digits.length) return text;
            const i = digits[Math.floor(Math.random() * digits.length)];
            const d = (Number(text[i]) + 1 + Math.floor(Math.random() * 8)) % 10;
            const wrong = text.slice(0, i) + d + text.slice(i + 1);
            stuttered = { text: wrong, until: now + 260 };
            return wrong;
        }
        return text;
    }
    function allFalseOff() {
        for (const k of Object.keys(falseNow)) {
            if (falseNow[k]) { falseNow[k] = false; hooks.hallucinate(k, false); }
        }
        stuttered = null;
    }
    function stepHallucinations(now) {
        if (!state.asleep || busy || state.watcher.gone) { allFalseOff(); return; }
        const want = now >= clearUntil ? hallucinationsAt(state.watcher.stability) : [];
        for (const k of Object.keys(falseNow)) {
            if (falseNow[k] && !want.includes(k)) { falseNow[k] = false; hooks.hallucinate(k, false); }
        }
        if (now >= nextFalseAt) {
            const k = want.find((x) => !falseNow[x]);
            if (k) {
                falseNow[k] = true;
                hooks.hallucinate(k, true);
                nextFalseAt = now + 1400 + Math.random() * 2200;
            }
        }
        if (falseNow.twitch && now >= twitchAt) {
            panel.twitch();
            twitchAt = now + 1600 + Math.random() * 2600;
        }
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
        const a = 0.4 + 2.2 * mad;
        let i = 0;
        for (const sp of el.children) {
            const k = i++ * 1.7;
            const x = a * Math.sin(t * (0.9 + 0.13 * k) + k) * 0.6;
            const y = a * Math.sin(t * (1.3 + 0.07 * k) + 2.1 * k);
            sp.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
        }
    }

    /* ---- WHAT THE INSTRUMENTS SAY, once a colony day ------------------------------------------ */
    let roadNow = null;             // the road to the next cryo tier (readout.js cryoRoad)
    let needNow = null;             // its one reason, for the tree (readout.js cryoNeed)
    const treeCtx = () => ({ need: needNow, road: roadNow, starsPerDay: report.stars, orePerDay: report.parts.M, asleep: !!state.asleep });
    function recomputeGates() {
        // deep-pass3 (B404): a save opened asleep still knows the road to the next tier (the tape wakes for it)
        if (state.asleep) { if (!roadNow && CRYO[state.cryo + 1] && state.cryo + 1 <= CRYO_TOP) roadNow = cryoRoad(state.cryo + 1, state); return; }
        if (growOn(state)) {
            inst = { lever: riseReady(state, layout).ready, lamps: riseLamps(state, layout), advice: adviseGrow(state, layout) };
            return;
        }
        const want = state.cryo + 1;
        const days = nextCryo(state)?.days;
        roadNow = CRYO[want] && want <= CRYO_TOP ? cryoRoad(want, state) : null;
        needNow = days ? cryoNeed(want, {
            state, trouble: sleepTrouble(state, days), planned: sleepTrouble(ordersDone(state), days), starsPerDay: report.stars,
        }) : null;
        const leverReady = state.cryo >= 0 || canBuy(state, 'cryo-i', treeCtx()).ok;
        inst = {
            lever: leverReady,
            lamps: state.cryo < 0 ? cryoLamps(roadNow, undefined, state.stars || 0) : null,
            advice: advise(state, report, { road: roadNow, lever: leverReady }),
        };
    }

    /* ---- THE CHROME ---------------------------------------------------------------------------- */
    /* deep-econ (B331): RATES PER REAL SECOND. Awake a day is a second; asleep the dive runs the tier's
       days a second times its pace (watcher.js sleepPace); a dream its own (grow.js dreamDaysAt). */
    function daysPerSecond() {
        if (state.asleep) return sleepPace(sleepClock) * CRYO[Math.max(0, Math.min(CRYO.length - 1, state.cryo))].days;
        if (dreaming(state)) return dreamDaysAt(dreamClock, 1);
        return 1;
    }
    let leverWas = null;
    function updateChrome() {
        if (!state.asleep && !roll) drawCounters(snapshot());
        const dps = daysPerSecond();
        // a sleep's store, once full, brings nothing more (deep.js SLEEP_CAP_SECONDS): it says so
        const cap = state.asleep ? sleepCap(state) : null;
        const capFull = (k, c) => !!cap && cap[c] > 0 && state.sleepGot[k] >= cap[c] * (1 - 1e-9);
        const oreDay = capFull('ore', 'ore') ? FULL_TEXT : rateText(report.parts.M * dps);
        const starDay = capFull('stars', 'stars') ? FULL_TEXT : rateText(report.stars * dps);
        if (ui.oreRate.textContent !== oreDay) ui.oreRate.textContent = oreDay;
        if (ui.starsRate.textContent !== starDay) ui.starsRate.textContent = starDay;
        // deep-grow2: the people: born less lost; in the body what its vats grow less what it eats
        // deep-organs: in the body its own clock is real seconds, awake and dreaming alike
        const pDay = rateText(growOn(state) ? peoplePerSecond(state, layout) - (report.died || 0) * dps : ((report.born || 0) - (report.died || 0)) * dps);
        if (ui.peopleRate && ui.peopleRate.textContent !== pDay) ui.peopleRate.textContent = pDay;
        if (ui.massRate && growOn(state)) {
            const mr = rateText(bodyRatios(state, layout).massRate);
            if (ui.massRate.textContent !== mr) ui.massRate.textContent = mr;
        }
        // the machine's tempo IS the stars a day
        const tempo = machineTempo(report, { asleep: !!state.asleep, feed: state.feed });
        lastTempo = tempo;
        scene?.setMachine(tempo, !!state.asleep);
        sound?.setState({
            asleep: !!state.asleep, tempo, games: report.games, humans: state.humans, cryo: state.cryo,
            stability: state.watcher.stability, gone: !!state.watcher.gone, lamps: lampsNow().length, bought: state.watcher.bought,
            // deep-grow: the blood and the heartbeat follow the body's share of the colony
            flesh: growOn(state) ? fleshShare(state, layout) : null,
        });
        machineText = machineSays(report);

        // the panel: the gauges every pass, the word and the lamps as the day reads them
        const gone = !!state.watcher.gone;
        const asleep = !!state.asleep || gone;
        const growing = growOn(state);
        // deep-pass3 (B400): the mind warns before it restarts (the tape and the Watcher's label say so)
        mindWarning(state.watcher, !!state.asleep);
        // one thing asked at a time: the mind first (the lamps waited for an answer while it fell to 14)
        if (state.watcher.warn && state.watcher.puzzle) { dismissPuzzle(state.watcher, state.cryo); lamp = null; }
        // deep-econ (B332): asleep the tape still names the goal, or says WAKE when it can be paid
        const word = risen(state) || gone ? '' : state.asleep ? adviseAsleep(state, { road: roadNow }) : inst.advice;
        panel.update({
            gauges: growing ? growGauges(state, report, layout) : readGauges(state, report),
            advice: word,
            note: growing ? growNote(state, layout) : adviceNote(state, word, { road: roadNow }),
            empty: asleep || growing ? 0 : emptyChambers(state, layout).length,
            lamps: growing ? (risen(state) ? null : inst.lamps) : (!asleep && state.cryo < 0 ? inst.lamps : null),
            mode: growing ? 'grow' : asleep ? 'sleep' : 'tend',
        });
        if (alarmUntil && performance.now() > alarmUntil) { alarmUntil = 0; panel.alarm(''); }
        // deep-tension: the chamber the tape points at glows slowly, the drawer open or not
        const empties = !asleep && !growing && /^BUILD /.test(word) ? emptyChambers(state, layout) : [];
        // deep-pass3 (B402): in GROW the tape's word has a place too (TAKE A CHAMBER, GROW A HEART): ringed
        hooks.callChamber?.(growing ? growTarget(state, layout, panel.advice || word) : empties.length ? `s${empties[0]}` : null);

        // DIG: one button, its price under it
        const full = (state.builds || []).length >= QUEUE_MAX;
        const digPrice = nextPrice(state, 'dig');
        const digLocked = asleep || busy || state.minerals < digPrice || full;
        ui.digBtn.classList.toggle('is-locked', digLocked);
        // deep-fix2: ore always with its pickaxe, here, on the "+" of the next chamber, in the ring
        const dp = `${ORE_SIGN} ${formatCount(digPrice)}`;
        if (ui.digPrice.dataset.text !== dp) { ui.digPrice.dataset.text = dp; ui.digPrice.innerHTML = signHtml(dp); }
        scene?.setDigOffer({ html: signHtml(dp), ok: !digLocked, on: !asleep && !busy && !growing });
        showBuild(ui.digBtn, 'dig', null);
        drawQueue();

        // the drawer: its badge counts what can be bought now; open, it is drawn again
        const groups = gone ? [] : drawerRows();
        // deep-grow2: the body opens with one verb (take a chamber); the drawer button comes with its first item
        ui.root.classList.toggle('has-no-drawer', growing && !groups.length);
        const badge = drawerCount(groups) > 0 ? String(drawerCount(groups)) : '';
        if (ui.treeBadge.textContent !== badge) ui.treeBadge.textContent = badge;
        ui.treeBadge.classList.toggle('hidden', !badge);
        ui.treeBtn.classList.toggle('has-night', !!(state.tree && state.tree.unseen));
        if (drawer.isOpen()) drawer.refresh(groups, wallet());
        // deep-pass3 (B404): the prices move on the wake, and the drawer says so (they read as following the purse)
        drawer.setFoot(state.cryo >= 0 && !growing ? PRICES_FOOT : '');
        treeView?.refresh();

        // THE LEVER: before the hall it is there once the lamps are lit and Cryo I can be paid.
        // deep-grow: in the body it is gone, and comes back overgrown when the body can rise
        const owns = state.cryo >= 0;
        // deep-grow2: in the body the lever is DREAM (WAKE while it dreams), RISE when it can rise
        const leverOn = growing ? !risen(state) : (!gone && (owns || inst.lever));
        if (leverWas === false && leverOn) {
            ui.leverWrap.classList.remove('is-arriving');
            void ui.leverWrap.offsetWidth;
            ui.leverWrap.classList.add('is-arriving');
        }
        leverWas = leverOn;
        ui.leverWrap.hidden = !leverOn;
        ui.root.classList.toggle('has-lever', leverOn);
        const dreamt = dreaming(state);
        ui.leverWrap.classList.toggle('is-down', !!state.asleep || dreamt);
        // the knob glows when the tape says to pull it: SLEEP (or SAVE FOR, a sleep is how stars come), WAKE
        ui.leverWrap.classList.toggle('is-ready', state.asleep ? word === 'WAKE'
            : !dreamt && (word === 'SLEEP' || word === 'RISE' || word === 'DREAM' || (!growing && word.startsWith('SAVE FOR '))));
        ui.leverWrap.classList.toggle('is-flesh', growing);
        const few = !growing && !state.asleep && state.humans < MIN_SLEEPERS;
        ui.leverWrap.classList.toggle('is-locked', busy || few);
        // deep-fix2: the price is the fourth lamp on the panel; it is not said again under the lever
        if (ui.leverPrice.textContent !== '') ui.leverPrice.textContent = '';
        const growTape = dreamt ? 'WAKE' : inst.lever ? 'RISE' : 'DREAM';
        ui.lever.setAttribute('aria-label', growing ? growTape.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : state.asleep ? 'Wake' : 'Sleep');
        const tape = growing ? growTape : state.asleep ? 'WAKE' : 'SLEEP';
        if (ui.leverTape.textContent !== tape) ui.leverTape.textContent = tape;
        // the Watcher alone, at the old ending: the one thing left to press
        ui.ascendBtn.classList.toggle('hidden', !gone);
        ui.ascendBtn.classList.toggle('is-locked', busy || !!state.ascended);

        updateWatcher();
        // deep-grow2: before the question the grafts (and the rooms a graft may go into) are drawn on the view
        if (!growing) drawFlesh();
        scheduleIconRefresh();
    }
    const wallet = () => `★ ${formatCount(state.stars)}   ${ORE_SIGN} ${formatCount(state.minerals)}`;

    /* ---- THE WATCHER: asleep, its own label on the panel, and a thin meter ---- */
    function updateWatcher() {
        const w = state.watcher;
        const asleep = !!state.asleep;
        if (ui.watcher) {
            ui.watcher.hidden = !asleep && !w.gone;
            ui.watcher.classList.toggle('is-whole', !!w.gone);
            if (asleep || w.gone) {
                drawName(watcherName(w));
                const v = String(Math.round(w.stability));
                if (ui.stabVal.textContent !== v) ui.stabVal.textContent = v;
                ui.stabFill.style.width = `${(100 * w.stability / STABILITY_MAX).toFixed(1)}%`;
                ui.watcher.classList.toggle('is-low', w.stability < 35);
                ui.watcher.classList.toggle('is-warn', !!w.warn);
                const shape = bodyGlyph(w);
                const cls = `deep-watcher-pulse${shape ? ` is-body is-${shape}` : ''}`;
                if (ui.pulse && ui.pulse.className !== cls) ui.pulse.className = cls;
            }
            drawAsk();
            drawLampCard();
        }
        drawSurface();
        scene?.setSoftness(asleep ? softness(w.stability) : 0);
    }

    /* ---- THE DRAWER, and the whole tree behind it ---------------------------------------------- */
    /** What the drawer lists: the tree's rows, or in the body its four items (grow.js). */
    // deep-pass3 (B406): the row the tape names is always listed, ringed and scrolled to
    const drawerRows = () => (growOn(state) ? bodyGroups(state) : drawerGroups(state, { ...treeCtx(), called: calledRow(state, panel.advice) }));
    const drawer = createDrawer(ui.drawer, {
        onBuy: (id) => (id.startsWith('body:') ? buyBodyItem(id.slice(5)) : id === LEVELS_ROW ? buyLevels() : buyNode(id)),
        onWholeTree: () => { closeDrawer(); openTree(); },
        onClose: () => { ui.root.classList.remove('is-drawer-open'); frameDrawer(false); },
    });
    /** deep-tension: every level ready, in one click ("BUY 4 LEVELS"), cheapest first. */
    function buyLevels() {
        if (paused() || busy) return false;
        const { ids } = levelsReady(state);
        let n = 0;
        for (const id of ids) {
            const r = treeBuy(state, id, treeCtx());
            if (!r) break;
            if (r.kind === 'level' || r.kind === 'auto') mendType(r.type);
            n++;
        }
        if (!n) return false;
        bought();
        afterChange();
        return true;
    }
    /** deep-tension: the colony moves left of the open drawer, so nothing the panel points to is under it. */
    function frameDrawer(open) {
        const w = open && ui.drawer ? ui.drawer.getBoundingClientRect().width || 0 : 0;
        scene?.setInsetRight?.(open ? Math.max(w, 360) : 0);
    }
    function openDrawer() {
        if (drawer.isOpen()) return;
        hooks.closeRoomRing();
        if (state.tree) state.tree.unseen = false;
        drawer.open();
        ui.root.classList.add('is-drawer-open');
        frameDrawer(true);
        drawer.refresh(state.watcher.gone ? [] : drawerRows(), wallet());
        updateChrome();
    }
    function closeDrawer() { drawer.close(); }
    const toggleDrawer = () => (drawer.isOpen() ? closeDrawer() : openDrawer());

    const sealedThisSleep = [];
    const treeView = ui.tree ? createTreeView(ui.tree, { state: () => state, ctx: treeCtx, onBuy: (id, many) => buyNode(id, many), onClose: () => closeTree() }) : null;
    function openTree() {
        if (!treeView || treeView.isOpen()) return;
        pointer = null;
        leaveChoice();
        ui.root.classList.add('is-tree-open');
        if (state.tree) state.tree.unseen = false;
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
    /** A node bought, from the drawer or the tree. tree.js says whether it can be; the phase does the
     *  rest: the layout, the faults a purchase clears, the sector a biological step asks for. */
    function buyNode(id, many = false) {
        if (paused()) return false;
        const n = NODE_BY_ID[id];
        if (!n) return false;
        if (busy && !(n.kind === 'surface' || n.kind === 'feed')) return false;
        if (n.kind === 'watcher' || n.kind === 'bio') {
            const out = treeBuy(state, id, { ...treeCtx(), slots: layout.slots, choose: true });
            if (!out) return false;
            sound?.event('buy');
            if (out.choose || (out.step && out.step.pending)) {
                if (state.watcher.puzzle) { dismissPuzzle(state.watcher, state.cryo); lamp = null; }
                surfaceKey = '';
                saveGame();
                closeTree();
                closeDrawer();
                enterChoice();
                return true;
            }
            afterStep(out.step.step);
            return true;
        }
        const done = many ? treeBuyMany(state, id, treeCtx()) : [treeBuy(state, id, treeCtx())].filter(Boolean);
        if (!done.length) return false;
        for (const r of done) {
            // deep-grow: The question answered: movement III begins
            if (r.kind === 'gift' && r.gift === 'question') setTimeout(() => beginGrow().catch((e) => console.error('the deep: the body broke', e)), 0);
            if (r.kind === 'level' || r.kind === 'auto') mendType(r.type);
            // the hall is dug with its own chamber (v1.48.0)
            if (r.kind === 'cryo' && r.tier === 0) { layout.slots.push('cryo'); layout = normalizeLayout(state, layout); }
        }
        bought();
        afterChange();
        return true;
    }
    function drawAsk() {
        if (!ui.ask) return;
        const asks = !!state.asleep && !state.watcher.gone && choosingSector(state.watcher);
        if (ui.ask.hidden === asks) ui.ask.hidden = !asks;
        ui.ask.classList.toggle('is-choosing', asks && choosing);
    }
    function afterStep(step) {
        const opened = rungOpenLine(step.id);
        if (opened) logLines([opened]);
        if (step.id === 'skin') {
            const sf = state.watcher.surface;
            if (state.watcher.puzzle) { dismissPuzzle(state.watcher, state.cryo); lamp = null; }
            if (!sf.visit) openSurface(state.watcher, state);
            else sf.visit.line = SENTENCE_LINE;
            surfaceKey = '';
        }
        report = dryRun();
        scene?.setState(state, layout);
        hooks.reapply();
        updateChrome();
        saveGame();
    }

    /* ---- THE CHOICE (v1.52.0), kept for older saves: a biological step paid for waits for a sector ---- */
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
    function candidateAt(x, y) {
        if (!scene) return -1;
        const slot = scene.slotAt(x, y);
        if (slot < 0) return -1;
        const k = sectorOf(slot);
        return sealCandidates(state.watcher, layout.slots).includes(k) ? k : -1;
    }
    let hDrop = null;               // the people a step took, for the tests: { from, to, text, t0 }
    function chooseSector(k) {
        if (!choosing || !state.asleep || busy || paused()) return false;
        const w = state.watcher;
        const before = state.humans;
        const out = sealSector(w, state, layout.slots, k);
        if (!out) return false;
        leaveChoice();
        sound?.event('seal');
        logLines([sealLine(out.sector, w.sealed.length - 1)]);
        sealedThisSleep.push(out.sector);
        if (out.people > 0) hDrop = { from: before, to: state.humans, text: `−${formatCount(out.people)}`, t0: performance.now() };
        afterStep(out.step);
        scene?.sealAnim(out.sector, out.people);
        return true;
    }

    /* ---- SURFACE IS THE HALLUCINATION (deep-rebuild) -----------------------------------------
       Only in the sleep, only to a low mind (watcher.js surfaceDue). Its line types itself, then the
       game comes under it; 6 s after the result the whole of it fades. From night 4 its letters are
       the Watcher's own tape, more each night; at night 6 its label flickers to WATCHER before the
       question types. */
    const RPS_TIMING = { shake: 600, reveal: 300, settle: 380 };
    let surfaceKey = '';
    let rps = null;
    let rpsTimers = [];
    let rpsDoneAt = 0;              // when the last game's result was shown (the fade counts from it)
    const glyph = (t) => `<i data-lucide="${THROW_ICON[t]}" class="w-4 h-4"></i>`;
    function drawWords(known, fresh) {
        const el = ui.surfaceWords;
        if (!(known > 0)) { el.textContent = ''; return; }
        el.innerHTML = SENTENCE.map((word, i) => {
            if (i === fresh) return `<span class="deep-word-new">${[...word].map((ch, k) => `<span style="animation-delay:${k * 70}ms">${ch}</span>`).join('')}</span>`;
            return i < known ? word : '·';
        }).join(' ');
    }
    /** SURFACE as letters, the first `tape` of them on the Watcher's tape. */
    let nameKey = '';
    function drawSurfaceName(word, tape, merging) {
        const key = `${word}|${tape}|${merging}`;
        if (key === nameKey) return;
        nameKey = key;
        const el = ui.surfaceName;
        el.textContent = '';
        el.classList.toggle('is-merging', merging);
        el.classList.toggle('is-tape', tape >= word.length);
        [...word].forEach((ch, i) => {
            const sp = document.createElement('span');
            sp.textContent = ch;
            if (i < tape) sp.className = 'is-tape';
            el.appendChild(sp);
        });
    }
    /** The played card fades RPS_FADE_MS after the result, and is gone after it. */
    function surfaceGone(v) {
        // deep-fix2: while the fists shake and turn the game is under way, not gone. Before, the card
        // and the line vanished the moment a throw was made and came back at the result, and the
        // line typed itself a second time (Ola: "Surface's messages sometimes come twice in a row")
        return cardGone({ result: !!(v && v.result), playing: !!rps, doneAt: rpsDoneAt, now: performance.now() });
    }
    function drawSurface() {
        if (!ui.surface) return;
        const sf = state.watcher.surface;
        const v = state.asleep && !choosingSector(state.watcher) ? sf.visit : null;
        const gone = surfaceGone(v);
        ui.night.classList.toggle('is-fading', !!v && !!v.result && !!rpsDoneAt && performance.now() - rpsDoneAt >= RPS_FADE_MS);
        ui.surface.hidden = !v || gone;
        drawVoice(v && !gone ? v : null);
        if (!v || gone) { surfaceKey = ''; return; }
        const now = performance.now();
        const merging = !!voice && voice.merge && now < voice.t0;
        drawSurfaceName(merging ? 'WATCHER' : 'SURFACE', merging ? 7 : surfaceTape(sf.night), merging);
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
    /* THE VOICE. A night's line types itself letter by letter, low in the dark. From night 4 some
       of its words are on the Watcher's tape; at night 6 all of them. */
    let voice = null;               // { key, text, t0, doneAt, merge, tapeWords, started }
    function gameShown(v) {
        if (!v.line) return true;
        if (v.result || rps) return true;
        return !!voice && voice.doneAt > 0 && performance.now() - voice.doneAt >= GAME_AFTER_LINE_MS;
    }
    const tapeShare = (night) => (night >= 6 ? 1 : night === 5 ? 0.6 : night === 4 ? 0.3 : 0);
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
            // deep-fix2: a line already typed in this visit is shown whole, never typed again
            const again = typedKeys.has(key);
            const night = v.night || state.watcher.surface.night || 0;
            const share = tapeShare(night);
            const words = line.split(' ');
            const merge = night >= 6 && line !== SENTENCE_LINE;
            voice = {
                key, text: line, t0: performance.now() + (merge && !again ? MERGE_MS : 0), doneAt: 0, merge: merge && !again, started: false,
                tape: words.map((_, i) => ((i * 7 + 3) % 10) / 10 < share),
            };
            if (again) { voice.started = true; voice.t0 -= TYPE_MS * (line.length + 1); voiceShown = -1; }
            ui.voiceText.textContent = '';
            ui.voiceRest.textContent = line;
            ui.voice.classList.toggle('is-typing', !again);
            ui.voice.classList.toggle('is-tape', share >= 1);
        }
        if (ui.voice.hidden) ui.voice.hidden = false;
        stepVoice();
    }
    let voiceShown = -1;
    const typedKeys = new Set();    // deep-fix2: the lines that have begun to type, by visit and line
    let typeStarts = 0;             // how many times a line began to type (tests)
    function stepVoice() {
        if (!voice) return;
        const now = performance.now();
        if (now < voice.t0) return;
        if (!voice.started) {
            voice.started = true;
            voiceShown = -1;
            typedKeys.add(voice.key);
            typeStarts++;
            sound?.event('type', { text: voice.text, letterS: TYPE_MS / 1000 });
        }
        const n = Math.min(voice.text.length, Math.floor((now - voice.t0) / TYPE_MS));
        if (n !== voiceShown) {
            voiceShown = n;
            // the typed part, word by word, the tape words on their tape
            let html = '', at = 0;
            voice.text.split(' ').forEach((word, i) => {
                if (at >= n) return;
                const part = word.slice(0, Math.max(0, n - at));
                const esc = part.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
                html += (i ? ' ' : '') + (voice.tape[i] ? `<span class="tape">${esc}</span>` : esc);
                at += word.length + 1;
            });
            ui.voiceText.innerHTML = html;
            ui.voiceRest.textContent = voice.text.slice(n);
        }
        if (n >= voice.text.length && !voice.doneAt) {
            ui.voice.classList.remove('is-typing');
            voice.doneAt = now;
        }
        if (voice.doneAt && !ui.surface.hidden && ui.surface.classList.contains('is-waiting')
            && now - voice.doneAt >= GAME_AFTER_LINE_MS) ui.surface.classList.remove('is-waiting');
    }
    function stopRps() {
        for (const t of rpsTimers) clearTimeout(t);
        rpsTimers = [];
        rps = null;
    }
    function throwAtSurface(you) {
        if (!state.asleep || busy || paused() || rps || !THROWS.includes(you)) return;
        const v = state.watcher.surface.visit;
        if (!v || !gameShown(v)) return;
        const r = playSurface(state.watcher, you);
        if (!r) return;
        rps = { you, it: r.it, outcome: r.outcome, word: r.word, stage: 'shake', log: [['throw', performance.now()]] };
        const at = (ms, stage) => rpsTimers.push(setTimeout(() => {
            if (!rps) return;
            rps.stage = stage;
            rps.log.push([stage, performance.now()]);
            updateWatcher();
            if (stage === 'settle' && (r.outcome === 'win' || r.outcome === 'lose')) sound?.event(r.outcome === 'win' ? 'win' : 'lose');
            if (stage === 'line') {
                rpsLast = rps.log;
                rpsDoneAt = performance.now();
                rpsTimers.push(setTimeout(() => { rps = null; }, 600));
                if (r.rebooted) wake({ kind: 'reboot', voice: true }).catch((e) => console.error('the deep: the wake broke', e));
            }
        }, ms));
        at(RPS_TIMING.shake, 'reveal');
        at(RPS_TIMING.shake + RPS_TIMING.reveal, 'settle');
        at(RPS_TIMING.shake + RPS_TIMING.reveal + RPS_TIMING.settle, 'line');
        rps.log.push(['shake', performance.now()]);
        updateChrome();
        saveGame();
    }
    let rpsLast = null;

    /* ---- THE LAMPS (v1.51.0): now and then in the sleep the lamps on the automated rooms ask for
       something, and the Watcher answers by clicking the rooms. Rules in watcher.js. ---- */
    // deep-pass3 (B400): bigger and slower ("one lamp I barely saw"): each lamp burns 0.75 s
    const LAMP_T = { lead: 1400, on: 750, gap: 380, darkLead: 1800 };
    let lamp = null;
    let lampFx = null;
    let cardSaid = null;
    function lampsNow() {
        return lampSlots(layout.slots, { auto: state.auto, skip: [...(state.darkSlots || []), ...(state.takenSlots || [])] });
    }
    function lampsInView() {
        const all = lampsNow();
        const seen = scene ? scene.visibleSlots(all) : all;
        return seen.length >= 2 ? seen : all;
    }
    function lampFlash(spec, ms) { lampFx = { spec, until: performance.now() + ms }; }
    let lampLast = 0;
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
                    if (p.at) p.at = 0;
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
    function drawLampCard() {
        const card = ui.card;
        if (!card.el) return;
        let q = '', said = '', cls = '', hint = '';
        const now = performance.now();
        if (cardSaid && now < cardSaid.until) ({ q, said, cls } = cardSaid);
        else if (lamp && state.asleep) {
            cardSaid = null;
            const p = lamp.p;
            // deep-pass3 (B400): plain words, and how far along as lamps ("LAMPS · YOUR TURN" never said what)
            if (p.kind === 'dark') q = lamp.phase === 'out' ? `WHICH WENT OUT? ${Math.max(0, (DARK_MS - (lamp.t - lamp.outAt)) / 1000).toFixed(1)} s` : 'WATCH THE LAMPS';
            else q = lamp.phase === 'input' ? `YOUR TURN ${'●'.repeat(p.at)}${'○'.repeat(Math.max(0, p.answer.length - p.at))}` : 'WATCH THE LAMPS';
            hint = lampHint(state.watcher, p);
        }
        if (card.hint) {
            if (card.hint.textContent !== hint) card.hint.textContent = hint;
            card.hint.hidden = !hint;
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
        taughtLamps(w, p.kind);
        if (out.ok) {
            const gain = puzzleStars(report.stars) * lampFactor(w);
            state.stars += gain;
            lampFlash({ flash: lamps }, 520);
            cardSaid = { q: 'RIGHT', said: `+${Math.round(out.gained)}`, cls: 'is-right', until: performance.now() + 1400 };
        } else {
            lampFlash({ wrong: slot >= 0 ? [slot] : [], ...(p.kind === 'dark' ? { off: [p.out] } : {}) }, 700);
            cardSaid = { q: 'WRONG', said: out.gained < 0 ? `${Math.round(out.gained)}` : '', cls: 'is-wrong', until: performance.now() + 1400 };
        }
        updateChrome();
        saveGame();
        if (out.rebooted) wake({ kind: 'reboot' }).catch((e) => console.error('the deep: the wake broke', e));
    }

    /** deep-pass3 (B407): a tip by the cursor, kept on screen (the machine's ran off the right edge). */
    function placeTip(el, x, y) {
        const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
        const vw = window.innerWidth, vh = window.innerHeight;
        const px = x + w > vw - 8 ? Math.max(8, x - 32 - w) : x;
        const py = Math.max(8, Math.min(vh - h - 8, y));
        el.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
    }
    function afterChange({ save = true } = {}) {
        claimChambers(state, layout);
        state.organs = organsOf(state, layout);
        report = dryRun();
        recomputeGates();
        scene?.setState(state, layout);
        hooks.reapply();
        drawFlesh();
        updateChrome();
        if (save) saveGame();
    }
    function mendType(type) {
        if (state.stalled && state.stalled[type]) delete state.stalled[type];
        clearDarkType(state, layout.slots, type);
    }
    function clearDark(slot) {
        if (busy || state.asleep || !clearChamber(state, layout.slots, slot)) return;
        afterChange();
    }
    function showBuild(el, kind, type) {
        const mark = el.querySelector('.deep-build');
        if (!mark) return;
        const job = (state.builds || []).find((j) => j.kind === kind && (type === null || j.type === type) && !isQueued(j));
        mark.classList.toggle('is-on', !!job);
        if (job) mark.style.setProperty('--p', `${Math.round(buildProgress(state, job) * 100)}%`);
    }

    // --- buying: the price now, the thing itself in a few days ---------------
    function bought() { alarmUntil = 0; panel.alarm(''); panel.releaseHold?.(); sound?.event('buy'); }
    const queueFull = () => (state.builds || []).length >= QUEUE_MAX;
    function dig() {
        const price = nextPrice(state, 'dig');
        if (state.minerals < price || queueFull()) return false;
        state.minerals -= price;
        orderBuild(state, 'dig');
        bought();
        afterChange();
        return true;
    }
    /** A room ordered into this empty chamber (deep-rebuild: from the ring over the plate). */
    function buildRoom(type, slot = -1) {
        if (chambersAhead(state) <= 0 || queueFull()) return false;
        const price = nextPrice(state, 'room', type);
        if (state.minerals < price) return false;
        state.minerals -= price;
        const job = orderBuild(state, 'room', { type });
        if (slot >= 0 && emptyChambers(state, layout).includes(slot)) job.slot = slot;
        mendType(type);
        bought();
        afterChange();
        return true;
    }
    /** The ring's four rooms, priced, for the empty chamber under the cursor. */
    function roomOffer() {
        const out = {};
        const full = queueFull();
        // deep-pass3 (B403, B406): the room the tape names is ringed; each says what it does to the stars
        const called = (/^BUILD (\w+)$/.exec(panel.advice || '') || [])[1];
        for (const t of ROOMS) {
            const price = nextPrice(state, 'room', t);
            const miss = Math.ceil(price - state.minerals);
            const eff = roomStarsLine(state, t);
            out[t] = {
                price: `${ORE_SIGN} ${formatCount(price)}`,
                ok: !full && miss <= 0,
                need: full ? 'THE QUEUE IS FULL' : `${ORE_SIGN} ${formatCount(miss)} MORE`,
                stars: eff.line, why: eff.why,
                called: !!called && ROOM_TAPE[t] === called,
            };
        }
        return out;
    }
    const ROOM_TAPE = { mine: 'MINE', farm: 'FARM', generator: 'GENERATOR', dorm: 'DORMITORY' };
    function openRing(slot, x, y) {
        hooks.openRoomRing(slot, x, y, {
            rooms: roomOffer(),
            onPick: (t) => { if (!busy && !state.asleep) buildRoom(t, slot); },
        });
    }

    /* ---- THE QUEUE (v1.49.0): a strip along the bottom, each order with its ring; a click takes it back ---- */
    // deep-tension: plain words, the drawer's own names ("lv mine" read like a note to oneself)
    const QUEUE_WORD = { mine: 'MINE', farm: 'FARM', generator: 'GENERATOR', dorm: 'DORMITORY' };
    const queueWord = (j) => (j.kind === 'dig' ? 'DIG' : j.kind === 'room' ? QUEUE_WORD[j.type]
        : rowName(NODE_BY_ID[(j.kind === 'level' ? LEVEL_NODE : AUTO_NODE)[j.type]] || { name: QUEUE_WORD[j.type] }));
    const Q_RING = 2 * Math.PI * 4.5;
    let queueKey = '';
    let queueRows = [];
    function drawQueue() {
        const jobs = state.builds || [];
        const key = jobs.map((j) => `${j.kind}${j.type}${j.startDay}`).join('|');
        if (key !== queueKey) {
            queueKey = key;
            ui.queue.textContent = '';
            // deep-tension: the same order in a row is one row, "SEAM ×6" (six of them read like a stutter)
            const groupsQ = [];
            for (const j of jobs) {
                const g = groupsQ[groupsQ.length - 1];
                if (g && g.job.kind === j.kind && g.job.type === j.type && j.kind !== 'dig') { g.n++; g.last = j; } else groupsQ.push({ job: j, last: j, n: 1 });
            }
            queueRows = groupsQ.map(({ job: j, last, n }) => {
                const row = document.createElement('button');
                row.className = 'deep-q-row';
                row.type = 'button';
                row.innerHTML = `<span class="deep-q-word">${queueWord(j)}${n > 1 ? ` ×${n}` : ''}</span>`
                    + '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">'
                    + '<circle class="track" cx="6" cy="6" r="4.5"></circle>'
                    + `<circle class="arc" cx="6" cy="6" r="4.5" stroke-dasharray="${Q_RING.toFixed(1)}" stroke-dashoffset="${Q_RING.toFixed(1)}"></circle></svg>`;
                row.addEventListener('click', () => takeBack(last), { signal });
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
    function takeBack(job) {
        if (busy || state.watcher.gone) return;
        if (!cancelOrder(state, job, { asleep: !!state.asleep })) return;
        afterChange();
    }

    /** Orders that landed: a room goes into the chamber it claimed, a dig adds a chamber. */
    function placeBuilt(done) {
        if (!done || !done.length) return false;
        for (const job of done) {
            if (job.kind === 'dig') layout.slots.push(null);
            else if (job.kind === 'room') {
                const ok = job.slot >= 0 && job.slot < layout.slots.length && !layout.slots[job.slot];
                const slot = ok ? job.slot : freeChamber(layout);
                if (slot >= 0) layout.slots[slot] = job.type;
            }
        }
        layout = normalizeLayout(state, layout);
        claimChambers(state, layout);
        return true;
    }
    const landBuilds = () => placeBuilt(completeBuilds(state));

    /* ---- III · GROW (deep-grow) -------------------------------------------------------------
       The question answered: the colony does not sleep any more; the body spreads where it is
       clicked, eats people every year of its own, dies back at its edge when they run out. */
    const GROW_LABELS = Object.fromEntries(GROW_GAUGES.map((x) => [x.c, x.label]));
    /** Catch-up after a stall (a hidden tab): at most this many real seconds of the body at once. */
    const GROW_CATCHUP_S = 20;
    const growLog = { taken: 0, died: 0, revived: 0, pumps: 0, onBeat: 0, dreams: 0, grafts: 0 };
    let frontFloor = -1;
    let fleshKey = '';
    let organKey = '';                  // deep-organs: the organs as last drawn
    let heldK = null;                   // deep-organs: the take's share shown while a pump's wave is on its way
    /**
     * The flesh on the view: before the question the grafts (and, awake with a graft to place, the
     * rooms it may go into, glowing); in the body the body, its dead, what it can reach and the lone
     * grafts, and the marks of a dream with their threads.
     */
    function drawFlesh() {
        if (!growOn(state)) {
            const g = state.graft || { slots: [], owed: 0 };
            const offer = graftOwed(state) && !state.asleep && !busy ? graftCandidates(state, layout) : [];
            if (!g.slots.length && !offer.length && !fleshKey) return;
            const key = `t|${g.slots.join(',')}|${offer.join(',')}`;
            if (key === fleshKey) return;
            fleshKey = key;
            hooks.setBody(g.slots.slice(), [], offer, g.slots.slice());
            return;
        }
        drawBody();
    }
    function drawBody() {
        const v = viewOf(state, layout);
        const lone = loneGrafts(state);
        // deep-organs: the chambers in reach glow, and the living organs the tape asks to grow again
        const reach = dreaming(state) ? [] : v.glow;
        const key = `g|${v.body.join(',')}|${v.necrotic.join(',')}|${reach.join(',')}|${lone.join(',')}`;
        if (key !== fleshKey) { fleshKey = key; hooks.setBody([...v.body, ...lone], v.necrotic, reach, lone); }
        // deep-organs: the organs in their chambers; the take in progress grows its organ in and its fill
        // ring steps when the pump's wave arrives (heldK: the share shown until then)
        const t = v.taking ? { ...v.taking, k: heldK === null ? v.taking.k : Math.min(heldK, v.taking.k) } : null;
        const okey = `${JSON.stringify(v.organs)}|${t ? `${t.id}:${t.organ}:${t.k.toFixed(3)}` : ''}|${v.necrotic.join(',')}`;
        if (okey !== organKey) { organKey = okey; hooks.setOrgans?.(v.organs, { taking: t, dead: v.necrotic }); }
        hooks.setTaking?.(t);
        syncMarks();
        // the camera follows the front down, a floor at a time (never once the player holds it)
        const floorOf = (id) => Math.max(0, graphOf(layout).nodes.find((n) => n.id === id)?.floor ?? 0);
        const handsNow = v.body.includes('machine') && !handsShown;
        if (handsNow) {
            handsShown = true;
            hooks.setHands(true, { instant: loadingBody });
            // the first throw by hand, whether the player took the machine house or the flesh did
            if (!loadingBody) setTimeout(() => sound?.event('hands'), HANDS_SECONDS * 1000);
            // the machine becomes hands: the camera goes to look, and back to the front after
            if (!loadingBody && scene?.focusMachine()) holdFocusUntil = performance.now() + 7000;
        }
        if (v.reachable.length) {
            // deep-pass3 (B402): the camera goes where the tape points; else to the front's floor, the machine
            // house left out unless it is all there is (it counted as floor 0 and held the camera there while
            // the chambers in reach lay a floor below: "TAKE A CHAMBER, but nothing glows")
            const tgt = growTarget(state, layout);
            const rooms = v.reachable.filter((id) => id !== 'machine');
            const front = tgt && tgt !== 'machine' ? floorOf(tgt) : Math.min(...(rooms.length ? rooms : v.reachable).map(floorOf));
            if (front !== frontFloor && !risen(state) && performance.now() >= holdFocusUntil) { frontFloor = front; scene?.focusFloor(front); }
        }
    }
    /** The marks of a dream on the overlay, each with its thread from the nearest body node. */
    function syncMarks() {
        const want = growOn(state) && !risen(state) ? markThreads(state, layout) : [];
        const ids = new Set(want.map((m) => m.id));
        for (const id of hooks.marks || []) if (!ids.has(id)) hooks.markChamber(id, false);
        for (const m of want) hooks.markChamber(m.id, true, m.from);
    }
    /** deep-organs: over a plate the body took, the organ it became (the machine house: HANDS). */
    function floatTake(id) {
        const n = graphOf(layout).nodes.find((x) => x.id === id);
        if (!n) return;
        if (n.kind === 'machine') { hooks.floatText(id, 'HANDS'); return; }
        const o = growOn(state) ? state.grow.organs[id] : null;
        if (o) { hooks.floatText(id, ORGAN_NAME[o], `is-organ is-${o}`); return; }
        if (n.kind !== 'room' || !n.type || n.type === 'cryo') return;
        hooks.floatText(id, `×${formatCount(Math.round(organMultiplier(state, layout, id)))}`);
    }
    /** deep-organs: a take is done: its organ floats up; a full floor cascades over all its organs. */
    function tookIt(t) {
        if (!t) return;
        growLog.taken++;
        panel.releaseHold?.();
        sound?.event('take');
        floatTake(t.id);
        if (t.cascade && t.cascade.length) {
            const graph = graphOf(layout);
            sound?.event('swell');
            for (const f of t.cascade) {
                growLog.cascades = (growLog.cascades || 0) + 1;
                for (const n of graph.nodes) if (n.floor === f && n.kind === 'room' && state.grow.organs[n.id]) hooks.floatText(n.id, '×1.5', 'is-cascade');
            }
        }
        // the hands: the machine plays this many times the games, and the stars jump with it
        if (t.id === 'machine') {
            growLog.hands = (growLog.hands || 0) + 1;
            setTimeout(() => hooks.floatText('machine', `★ ×${formatCount(Math.round(handsGames(state, layout)))}`, 'is-cascade'), 900);
        }
    }
    /** Items that came into the drawer just now: its button carries the mark, as a gift does. */
    function newItems(seen) {
        if (!seen || !seen.length) return;
        if (state.tree) state.tree.unseen = true;
        sound?.event('gift');
    }
    let handsShown = false;
    let holdFocusUntil = 0;             // the camera stays on the hands this long
    let loadingBody = false;            // the first drawing after a load: the hands are hands already
    /** The panel, the drawer and the view go over to the body. */
    function enterGrowUi({ instant = false } = {}) {
        ui.root.classList.add('is-grow');
        scene?.setGrowMode(true);
        drawer.setFlesh(true);
        hooks.closeRoomRing();
        panel.overgrow(GROW_LABELS, { instant }).then(() => {
            if (state.grow && !state.grow.overgrown) { state.grow.overgrown = true; saveGame(); }
        });
        state.organs = organsOf(state, layout);
        loadingBody = instant;
        fleshKey = '';
        drawFlesh();
        loadingBody = false;
    }
    /** The question is answered: wake the colony if it sleeps, then the body begins. */
    async function beginGrow() {
        if (state.asleep) await wake({ kind: 'manual' });
        if (!normalizeGrow(state, layout, dryRun())) return;
        state.organs = organsOf(state, layout);
        report = dryRun();
        recomputeGates();
        enterGrowUi({ instant: false });
        sound?.event('take');
        updateChrome();
        saveGame();
    }
    let lastGrowAt = performance.now();
    /** Awake in the body: a day a real second (deep-grow2: time moves in the dreams). */
    function growTick(now) {
        const secs = Math.max(0, Math.min(GROW_CATCHUP_S, (now - lastGrowAt) / 1000));
        lastGrowAt = now;
        if (risen(state) || dreaming(state)) return;
        const days = Math.max(1, Math.round(secs * GROW_DAYS_PER_SECOND));
        runColony(days);
        const y = stepGrow(state, layout, secs);
        recoverAwake(state.watcher, days);
        afterBody(y);
        afterChange();
    }
    /** deep-organs: `days` colony days (the machine, the stars, the ore); the body keeps its own clock. */
    function runColony(days) {
        for (let i = 0; i < days; i++) {
            landBuilds();
            state.organs = organsOf(state, layout);
            report = tickDay(state, false);
        }
    }
    function afterBody(y) {
        if (y.died.length) {
            sound?.event('necrosis'); growLog.died += y.died.length;
            for (const id of y.died) hooks.floatText(id, 'STARVING', 'is-small is-dead');
        }
        if (y.revived.length) { growLog.revived += y.revived.length; for (const id of y.revived) hooks.floatText(id, 'BACK', 'is-small'); }
        for (const t of y.done || []) tookIt(t);
        if ((y.started || []).length) organKey = '';
        newItems(y.seen);
    }
    /** A click on a chamber. Before the question, with a graft to place: graft it. In the body: the
     *  heart pumps; a chamber in reach that can be paid is taken; any other chamber is marked for a
     *  dream (or unmarked). */
    function takeAt(id) {
        if (busy || paused() || state.asleep) return false;
        if (!growOn(state)) return graftAt(id);
        if (risen(state) || dreaming(state)) return false;
        if (id === 'h0') return pumpHeart();
        // deep-organs: the chamber being taken pumps too (the wave runs to it)
        const T = taking(state);
        if (T && T.id === id) return pumpHeart();
        const offer = takeOffer(state, layout, id);
        if (offer) {
            if (T) { nudgeTip(); return false; }
            showTip('', 0, 0);
            // deep-tension: the organ the body is short of, marked in the ring, its gauge named in the middle
            const want = wantOrgan(state, layout);
            hooks.openOrganRing(id, tipAt.x, tipAt.y, {
                organs: offer.organs, have: state.grow.mass, regrow: offer.regrow, want,
                short: want ? `${GROW_GAUGES.find((g) => g.c === Object.keys(GAUGE_ORGAN).find((k) => GAUGE_ORGAN[k] === want))?.label} is short.` : '',
                onPick: (organ) => chooseOrgan(id, organ),
            });
            sound?.event('ring');
            return true;
        }
        const tip = takeTip(state, layout, id);
        if (state.grow.body.includes(id)) { if (tip.text) nudgeTip(); return false; }
        if (viewOf(state, layout).reachable.includes(id)) { nudgeTip(); return false; }
        toggleMark(state, layout, id);
        afterChange();
        showTip(id, tipAt.x, tipAt.y);
        return false;
    }
    /** deep-organs: an organ picked in the ring: the take begins (paid now), its ring on the chamber. */
    function chooseOrgan(id, organ) {
        if (busy || paused() || !growOn(state) || dreaming(state)) return false;
        const t = startTake(state, layout, id, organ);
        if (!t) return false;
        growLog.chosen = growLog.chosen || {};
        growLog.chosen[organ] = (growLog.chosen[organ] || 0) + 1;
        sound?.event('organ', { organ });
        panel.releaseHold?.();
        organKey = '';
        afterChange();
        return true;
    }
    /** deep-grow2: a graft placed: the room turns to flesh and makes five times as much. */
    function graftAt(id) {
        const r = placeGraft(state, layout, id);
        if (!r) { if (graftWords(state, layout, id)) nudgeTip(); return false; }
        growLog.grafts++;
        sound?.event('take');
        afterChange();
        hooks.floatText(id, `×${GRAFT_MULT}`);
        // deep-econ (B336): and the room's own output before and after, where the cursor is
        showTip(id, tipAt.x, tipAt.y);
        return true;
    }
    /** The price over the chamber under the cursor, in plain words (red when the body would starve). */
    let tipAt = { x: 0, y: 0 };
    function showTip(id, x, y) {
        tipAt = { x, y };
        // deep-tension: the ring of organs speaks for itself; no tip over it
        if (hooks.organRingAt) id = '';
        const t = !id ? { text: '', red: false }
            : growOn(state) ? (dreaming(state) ? { text: '', red: false } : takeTip(state, layout, id))
                : { text: !state.asleep ? (graftWords(state, layout, id) || graftedWords(id)) : '', red: false };
        const el = ui.takeTip;
        if (!el) return;
        if (el.dataset.text !== t.text) { el.dataset.text = t.text; el.innerHTML = signHtml(t.text); }
        el.classList.toggle('is-red', !!t.red);
        el.hidden = !t.text;
        ui.sceneHost.classList.toggle('is-over-take', !!t.text);
        // deep-organs: the tip stays on the screen (it went off the right edge over the last chambers)
        if (t.text) {
            const w = el.offsetWidth || 260, h = el.offsetHeight || 30;
            const tx = Math.min(x + 16, window.innerWidth - w - 12), ty = Math.min(y + 14, window.innerHeight - h - 12);
            el.style.transform = `translate(${Math.max(8, tx)}px, ${Math.max(8, ty)}px)`;
        }
    }
    /** deep-econ (B336): over a lone graft, what it makes now against what the room made before. */
    function graftedWords(id) {
        return loneGrafts(state).includes(id) ? graftEffect(state, layout, report, id) : '';
    }
    function nudgeTip() {
        const el = ui.takeTip;
        if (!el) return;
        el.classList.remove('is-no');
        void el.offsetWidth;
        el.classList.add('is-no');
    }
    hooks.onChamberClick((id) => takeAt(id));
    hooks.onChamberHover((id, x, y) => showTip(!busy ? id : '', x, y));
    /** A body item from the drawer. */
    function buyBodyItem(id) {
        if (paused() || busy || dreaming(state)) return false;
        if (!buyBody(state, id, report.stars, report.minerals)) return false;
        bought();
        afterChange();
        return true;
    }

    /* ---- THE HEART (deep-grow2): awake, a click on the lid pumps; on the beat it counts double ---- */
    let lastPumpAt = 0;
    let heartShown = false;
    const beatNow = () => beatPhase(performance.now(), sound?.beat ? sound.beat() : null);
    function pumpHeart() {
        if (!growOn(state) || risen(state) || dreaming(state) || busy || paused() || state.asleep) return false;
        const now = performance.now();
        if (now - lastPumpAt < PUMP_COOLDOWN_MS) return false;
        lastPumpAt = now;
        const beat = onBeat(beatNow());
        // deep-organs: the share shown stays where it was until the wave gets there
        const before = taking(state);
        const k0 = before ? before.done / before.work : null;
        const r = pump(state, layout, { beat });
        if (!r) return false;
        growLog.pumps++;
        if (beat) growLog.onBeat++;
        sound?.event('pump', { beat });
        // deep-tension: the drum. On the beat ×3 (and the surge), off it nothing: MISS
        hooks.floatText('h0', beat ? `×${String(Math.round(30 * r.surge) / 10)}` : 'MISS', beat ? 'is-beat' : 'is-small is-miss');
        if (!beat) sound?.event('miss');
        if (before) heldK = k0;
        const targets = r.to.slice(0, 3);
        targets.forEach((to, i) => {
            const path = pumpPath(state, layout, to);
            const last = i === targets.length - 1;
            hooks.pumpWave?.(path.length > 1 ? path : ['h0', to], {
                beat,
                onArrive: !last ? null : () => {
                    heldK = null;
                    sound?.event('arrive', { beat });
                    if (r.done) tookIt(r.done);
                    else if (r.take) { const T = taking(state); if (T) hooks.floatText(T.id, `${Math.round(100 * T.done / T.work)} %`, 'is-small is-fill'); }
                    if (r.revived) hooks.floatText(r.revived, 'BACK', 'is-small');
                    if (r.mass > 0) hooks.floatText(to, `+${MASS_SIGN} ${r.mass < 10 ? (Math.round(r.mass * 10) / 10).toFixed(1) : formatCount(Math.round(r.mass))}`, 'is-small is-mass');
                    afterChange({ save: false });
                },
            });
        });
        ui.heart?.classList.remove('is-pumped');
        void ui.heart?.offsetWidth;
        ui.heart?.classList.add('is-pumped');
        afterChange({ save: false });
        return true;
    }
    /** Once a frame: the heart's hit area over the lid, swelling on the beat. */
    function placeHeart() {
        const el = ui.heart;
        if (!el) return;
        const on = !!scene && growOn(state) && !risen(state) && !dreaming(state) && !state.asleep && !busy;
        const p = on ? scene.screenOfNode('h0') : null;
        if (!p) { if (heartShown) { el.hidden = true; heartShown = false; } return; }
        if (!heartShown) { el.hidden = false; heartShown = true; }
        const r = ui.root.getBoundingClientRect();
        el.style.left = `${Math.round(p.x - r.left)}px`;
        el.style.top = `${Math.round(p.y - r.top)}px`;
        const ph = beatNow();
        hooks.setBeat?.(ph);
        el.style.setProperty('--beat', (1 + 0.22 * Math.exp(-ph * 9)).toFixed(3));
        el.classList.toggle('is-cool', performance.now() - lastPumpAt < PUMP_COOLDOWN_MS);
        // deep-tension: the beat's window: a ring closes in and meets the heart on the beat
        const u = ((ph + 0.5) % 1) - 0.5;
        el.style.setProperty('--approach', (u < 0 ? 1 + 1.5 * (-u / 0.5) : 1).toFixed(3));
        el.style.setProperty('--approach-o', (u < 0 ? 0.2 + 0.8 * (1 - (-u / 0.5)) : Math.max(0, 1 - u / 0.15)).toFixed(3));
        el.classList.toggle('is-window', onBeat(ph));
        const streak = state.grow.streak || 0;
        const sEl = ui.heartSurge;
        if (sEl) {
            const txt = streak > 0 ? `SURGE ×${surgeOf(streak).toFixed(2).replace(/0$/, '')}` : '';
            if (sEl.textContent !== txt) sEl.textContent = txt;
            sEl.hidden = !txt;
            sEl.classList.toggle('is-full', streak >= 5);
        }
    }
    ui.heart?.addEventListener('click', (e) => { e.stopPropagation(); pumpHeart(); }, { signal });

    /* ---- THE BODY DREAMS (deep-grow2): the lever lays it down; time dives; it grows along the marks ---- */
    const DREAM_TICK_MS = 100;
    const DREAM_DOWN_MS = 1200;
    let dreamInterval = null;
    let dreamClock = 0;
    let dreamLast = 0;
    let dreamTicks = 0;
    async function startDream() {
        if (busy || !growOn(state) || risen(state) || dreaming(state)) return;
        setBusy(true);
        closeDrawer();
        showTip('', 0, 0);
        alarmUntil = 0;
        panel.alarm('');
        ui.root.classList.add('is-dreaming');
        dreamStart(state, layout);
        growLog.dreams++;
        sound?.event('sleep');
        if (ui.diveWord) ui.diveWord.textContent = 'THE BODY DREAMS';
        diveOffset = -(state.grow.startDay || 0);
        ui.dive.hidden = false;
        drawCounters(snapshot());
        afterChange();
        await new Promise((r) => setTimeout(r, DREAM_DOWN_MS));
        setBusy(false);
        dreamClock = 0;
        dreamLast = performance.now();
        dreamInterval = setInterval(dreamTick, DREAM_TICK_MS);
        dreamTimer = dreamInterval;
    }
    function dreamTick() {
        if (!dreaming(state) || busy) return;
        const now = performance.now();
        const dt = Math.min(0.25, Math.max(0, (now - dreamLast) / 1000));
        dreamLast = now;
        if (paused() || !(dt > 0)) return;
        const days = Math.max(1, Math.round(dreamDaysAt(dreamClock, dt)));
        dreamClock += dt;
        runColony(days);
        const y = stepGrow(state, layout, dt);
        const woke = dreamWake(state, layout, y);
        afterBody(y);
        drawCounters(snapshot());
        afterChange({ save: ++dreamTicks % 10 === 0 });
        if (woke) wakeDream(woke);
    }
    /** The body wakes: one lamp, one word (HUNGER, REACHED, AWAKE). */
    function wakeDream(word) {
        if (dreamInterval) clearInterval(dreamInterval);
        dreamInterval = null;
        if (!dreaming(state)) return;
        dreamEnd(state);
        ui.root.classList.remove('is-dreaming');
        ui.dive.hidden = true;
        if (ui.diveWord) ui.diveWord.textContent = 'THE COLONY HAS SLEPT';
        sound?.event('wake');
        if (word !== 'AWAKE') sound?.event('knock');
        panel.alarm(word);
        alarmUntil = performance.now() + ALARM_LAMP_MS;
        lastGrowAt = performance.now();
        afterChange();
    }
    /**
     * RISE: the body pushes up through the shaft and the crust; two lines in the Watcher's own hand;
     * then V · UNITY. The end is saved first, so a reload shows the wall.
     */
    async function riseUp() {
        if (busy || !growOn(state) || risen(state) || !riseReady(state, layout).ready) return;
        setBusy(true);
        stopClock();
        closeDrawer();
        showTip('', 0, 0);
        ui.root.classList.add('is-rising');
        riseBody(state, layout);
        saveGame();
        sound?.event('rise');
        await new Promise((resolve) => hooks.rise(resolve));
        await typeLines(RISE_LINES);
        await new Promise((r) => setTimeout(r, 900));
        playChapterCard({ roman: GROW_END.roman, title: GROW_END.title, mode: 'to-come', dark: true });
    }
    /** The last lines, typed in the Watcher's tape, one after the other with a pause between. */
    async function typeLines(lines) {
        const host = ui.riseLines;
        if (!host) return;
        host.hidden = false;
        host.textContent = '';
        for (const [i, line] of lines.entries()) {
            const row = document.createElement('div');
            row.className = 'deep-rise-line';
            host.appendChild(row);
            sound?.event('type', { text: line, letterS: TYPE_MS / 1000 });
            for (let k = 1; k <= line.length; k++) {
                row.innerHTML = line.slice(0, k).split(' ').map((w) => (w ? `<span class="tape">${w}</span>` : '')).join(' ');
                await new Promise((r) => setTimeout(r, TYPE_MS));
            }
            if (i < lines.length - 1) await new Promise((r) => setTimeout(r, 1600));
        }
    }

    /* ---- THE LEVER --------------------------------------------------------------------------- */
    async function pullLever() {
        if (busy || paused() || state.watcher.gone) return;
        if (growOn(state)) {
            if (dreaming(state)) { wakeDream('AWAKE'); return; }
            if (riseReady(state, layout).ready) { await riseUp(); return; }
            await startDream();
            return;
        }
        if (state.asleep) { await wake({ kind: 'manual' }); return; }
        if (state.cryo < 0) {
            if (!canBuy(state, 'cryo-i', treeCtx()).ok) return;
            if (!buyNode('cryo-i')) return;
        }
        await startSleep();
    }

    /* ---- SLEEP IS A STATE, and since deep-rebuild a DIVE ------------------------------------- */
    const odometer = (k) => k * k * k * (k * (k * 6 - 15) + 10);
    const linear = (k) => k;
    function rollingValue(now) {
        if (!roll) return snapshot();
        const k = Math.min(1, Math.max(0, (now - roll.t0) / (roll.dur * 1000)));
        const e = roll.ease(k);
        const mix = (a, b) => a + (b - a) * e;
        return { day: mix(roll.from.day, roll.to.day), ore: mix(roll.from.ore, roll.to.ore), stars: mix(roll.from.stars, roll.to.stars) };
    }
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
        return { days: 0, minerals: 0, food: 0, stars: 0, born: 0, died: 0, ranDays: {} };
    }
    function sleepChunk(days) {
        const sum = sleep(state, days, { alarms: true, slots: layout.slots, rng: Math.random, maxSteps: 20000 });
        const landed = placeBuilt(sum.built);
        const t = sleepSum;
        t.days += sum.days; t.minerals += sum.minerals; t.food += sum.food; t.stars += sum.stars;
        t.born += sum.born; t.died += sum.died;
        for (const r of ROOMS) t.ranDays[r] = (t.ranDays[r] || 0) + (sum.ran[r] || 0) * sum.days;
        sum.watch = watchSleep(state.watcher, { days: sum.days, tier: state.cryo, spare: sum.spare, hold: choosing, pace: sleepPace(sleepClock) });
        trackStrata();
        report = dryRun();
        scene?.setState(state, layout);
        if (landed) hooks.reapply();
        return sum;
    }
    const setDiveOffset = () => { diveOffset = state.watcher.sleptYears * DAYS_PER_YEAR - state.day; };

    async function startSleep() {
        if (busy || state.asleep || state.cryo < 0 || state.humans < MIN_SLEEPERS) return;
        setBusy(true);
        stopClock();
        closeDrawer();
        hooks.closeRoomRing();
        alarmUntil = 0;
        panel.alarm('');
        // the panel goes dark light by light while they walk into the hall
        ui.root.classList.add('is-night');
        await Promise.all([panel.lights(false, LIGHTS_MS), scene ? scene.gather(SLEEP_TIMING.gather) : Promise.resolve()]);
        state.asleep = true;
        sound?.event('sleep');
        ui.root.classList.add('is-sleeping');
        beginSleep(state.watcher, state.cryo);
        // deep-econ: one sleep brings at most SLEEP_CAP_SECONDS of the income (deep.js capYield)
        beginSleepYield(state);
        nightBefore = state.watcher.surface.night | 0;
        trackStrata();
        setDiveOffset();
        ui.dive.hidden = false;
        updateChrome();
        sleepSum = freshSum();
        sealedThisSleep.length = 0;
        lookClock = 0;
        clearUntil = 0;
        // falling asleep: the first moment of the dive rolls like the odometer it always was
        const before = snapshot();
        roll = { from: before, to: before, t0: performance.now(), dur: 0.05, ease: linear };
        const sum = sleepChunk(sleepDaysAt(0, SLEEP_TIMING.spin, CRYO[state.cryo].days));
        sleepClock = SLEEP_TIMING.spin;
        saveGame();
        await rollTo(snapshot(), SLEEP_TIMING.spin, odometer);
        setBusy(false);
        const woke = alarmOf(sum);
        if (woke) { await wake(woke); return; }
        runSleep();
    }
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
    function alarmOf(sum) {
        if (sum.alarm) return sum.watch?.rebooted ? { ...sum.alarm, rebooted: true } : sum.alarm;
        return sum.watch?.rebooted ? { kind: 'reboot' } : null;
    }
    function sleepTick() {
        if (busy || !state.asleep) return;
        const now = performance.now();
        const dt = Math.min(0.25, Math.max(0, (now - lastSleepAt) / 1000));
        lastSleepAt = now;
        if (!(dt > 0)) return;
        // THE DIVE: the pace rises within the sleep; paused, no days and no drift
        const days = sleepDaysAt(sleepClock, dt, CRYO[state.cryo].days, paused());
        if (!(days > 0)) return;
        sleepClock += dt;
        drawCounters(rollingValue(now));
        const sum = sleepChunk(days);
        rollTo(snapshot(), SLEEP_TICK_MS / 1000 + 0.02);
        sleepTicks++;
        lookClock += dt;
        const look = !choosing && !hDrop && !rps && lookDue(state.watcher, state.cryo, lookClock);
        const woke = alarmOf(sum)
            || (firstSleep(state.watcher) && sleepSum && sleepSum.days >= FIRST_SLEEP_DAYS ? { kind: 'first' } : null)
            || (look ? { kind: 'look' } : null);
        if (woke) { wake(woke).catch((e) => console.error('the deep: the wake broke', e)); return; }
        const w = state.watcher;
        if (w.puzzle && w.puzzle.lamps.some((sl) => !lampsNow().includes(sl))) { dismissPuzzle(w, state.cryo); lamp = null; }
        if (puzzleDue(w, { asleep: true, alarmPending: busy })) openPuzzle(w, lampsInView(), state.cryo);
        if (sleepSum && surfaceDue(w, sleepSum.days, CRYO[state.cryo].days)) {
            const opened = (state.tree.opened || []).length;
            openSurface(w, state);
            surfaceKey = '';
            rpsDoneAt = 0;
            if ((state.tree.opened || []).length > opened) sound?.event('gift');
        }
        const open = w.puzzle;
        const held = w.stability;
        if (open && selfSolve(w, dt, state.cryo, Math.random).length) {
            endLamps({ ok: true, done: true, gained: w.stability - held, rebooted: false }, open.lamps.slice(), -1, open);
        }
        stepLamps();
        if (autoSnapDue(state.watcher, Date.now())) { scene?.snap(); sound?.event('snap'); snapWatcher(state.watcher, Date.now(), state.cryo); }
        if (hDrop && now - hDrop.t0 > 2400) hDrop = null;
        updateChrome();
        if (sleepTicks % 10 === 0) saveGame();
    }

    /**
     * Out of the ice. The panel comes back light by light, and one lamp says why, in one word.
     * @param {object} alarm - what woke the colony; { kind:'manual' } for the lever
     */
    async function wake(alarm) {
        if (!state.asleep || busy) return;
        stopSleep();
        setBusy(true);
        state.asleep = false;
        sound?.event('wake');
        const w = state.watcher;
        closeSurface(w);
        // deep-econ: the prices follow the income from this wake on; the cap counts again next sleep
        // (deep-pass3, B404: the drawer says so, and the tape wakes only for what the new prices still pay)
        endSleepYield(state);
        setIncome(state);
        // deep-econ (B335): a night that came in this sleep is said again, low, once the panel is back
        const missed = (w.surface.night | 0) > nightBefore ? w.surface.night | 0 : 0;
        nightBefore = w.surface.night | 0;
        stopRps();
        leaveChoice();
        if (w.puzzle) dismissPuzzle(w, state.cryo);
        lamp = null;
        scene?.setLamps(null);
        allFalseOff();
        if (bodyWhole(w) && !w.gone) { await lastWakeUp(); return; }
        if (!['manual', 'debug', 'first', 'look'].includes(alarm.kind)) sound?.event('knock');
        const rebooted = alarm.kind !== 'reboot' && (alarmHit(w, alarm.kind) || !!alarm.rebooted);
        const said = alarm.kind === 'reboot' ? [alarmLine(alarm)] : watcherLines(w, [alarmLine(alarm)]);
        if (rebooted) said.push(alarmLine({ kind: 'reboot' }));
        logLines(said);
        const t = sleepSum || freshSum();
        if (t.died >= 0.5 || sealedThisSleep.length) mourn(state);
        const ran = {};
        for (const r of ROOMS) ran[r] = t.days > 0 ? (t.ranDays[r] || 0) / t.days : 1;
        state.stalled = stalledRooms(state, { ran });
        if (alarm.kind === 'stall') state.stalled[alarm.type] = true;
        if (roll?.done) clearTimeout(roll.done);
        roll = null;
        ui.dive.hidden = true;
        drawCounters(snapshot());
        saveGame();
        ui.root.classList.remove('is-sleeping', 'is-night');
        scene?.setState(state, layout);
        report = dryRun();
        recomputeGates();
        updateChrome();
        // the one lamp, and the panel's lights back on, while they walk out
        panel.alarm(wakeWord(rebooted && alarm.kind !== 'reboot' ? { kind: 'reboot' } : alarm));
        alarmUntil = performance.now() + ALARM_LAMP_MS;
        if (missed) recallNight(missed);
        else {
            // deep-pass3 (B400): a restart, the first sleep's end, a look: said once, low, with the lamp
            const why = wakeWhy(alarm, rebooted || (alarm.kind === 'reboot' && !alarm.voice));
            if (why) recallLine(why);
        }
        await Promise.all([panel.lights(true, LIGHTS_MS), scene ? scene.release(SLEEP_TIMING.release) : Promise.resolve()]);
        sleepSum = null;
        setBusy(false);
        startClock();
        updateChrome();
        saveGame();
    }

    /* deep-econ (B335): MISSED NIGHTS ARE TOLD ON WAKING. Ola: "Suddenly a red light in the rooms.
       Nothing I did. No explanation." The night's line came while he slept; on the wake nothing said
       it. Now the line is said again, low, for RECALL_MS; the tape says what its gift asks for. */
    let recallTimers = [];
    function recallNight(n) {
        const line = NIGHTS[n - 1]?.line;
        if (!line || !ui.recall) return;
        recallLine(`“${line}”`);
        recallShown = { n, at: performance.now() };
    }
    function recallLine(text) {
        if (!ui.recall) return;
        for (const t of recallTimers) clearTimeout(t);
        ui.recall.textContent = text;
        ui.recall.hidden = false;
        void ui.recall.offsetWidth;
        ui.recall.classList.add('is-in');
        recallTimers = [
            setTimeout(() => ui.recall.classList.remove('is-in'), RECALL_MS),
            setTimeout(() => { ui.recall.hidden = true; }, RECALL_MS + 750),
        ];
    }
    let recallShown = null;
    /** THE LAST WAKE-UP (v1.50.0), for a save at the old body's end: nobody comes out. */
    async function lastWakeUp() {
        const w = state.watcher;
        sound?.event('unity');
        lastWake(w, state);
        logLines([NOBODY_LINE]);
        state.stalled = {};
        if (roll?.done) clearTimeout(roll.done);
        roll = null;
        ui.dive.hidden = true;
        drawCounters(snapshot());
        ui.root.classList.remove('is-sleeping', 'is-night');
        panel.lightsNow(true);
        scene?.setState(state, layout);
        report = dryRun();
        sleepSum = null;
        setBusy(false);
        startClock();
        updateChrome();
        saveGame();
    }
    /** The Watcher goes up alone (v1.50.0): one amber dot climbs the shaft, and V waits at the top. */
    async function goUpAlone() {
        if (busy || state.ascended || !state.watcher.gone) return;
        setBusy(true);
        stopClock();
        ascendAlone(state);
        saveGame();
        sound?.event('fade');
        await (scene ? scene.climbAlone(4.5) : Promise.resolve());
        scene?.lighten();
        await new Promise((r) => setTimeout(r, 700));
        playChapterCard({ roman: CHAPTER_V.roman, title: CHAPTER_V.title, mode: 'to-come', dark: true });
    }

    function setBusy(on) {
        busy = on;
        ui.root.classList.toggle('is-busy', on);
        updateChrome();
    }

    /* ---- THE SNAP: a click on the base while the colony sleeps. It snaps rigid, holds a little,
       and every false thing goes with a short flicker. ---- */
    function snapBase() {
        // deep-econ (B337): the snap is the sleep's alone: awake (or in a dream) a click makes no sound
        if (!state.asleep || busy || dreaming(state)) return;
        if (snapWait(state.watcher, Date.now()) > 0) {
            ui.snapRing?.classList.remove('is-nudged');
            void ui.snapRing?.offsetWidth;
            ui.snapRing?.classList.add('is-nudged');
            return;
        }
        scene?.snap();
        clearUntil = performance.now() + SNAP_CLEAR_MS;
        nextFalseAt = clearUntil;
        if (Object.values(falseNow).some(Boolean)) {
            falseNow.twitch = false;
            stuttered = null;
            hooks.snapClear().then(() => { for (const k of Object.keys(falseNow)) falseNow[k] = false; });
        }
        if (paused()) return;
        if (snapWatcher(state.watcher, Date.now(), state.cryo) > 0) {
            sound?.event('snap');
            ui.watcher?.classList.remove('is-held');
            void ui.watcher?.offsetWidth;
            ui.watcher?.classList.add('is-held');
        }
        updateChrome();
    }
    let press = null;
    let pointer = null;
    let machineText = '';
    ui.sceneHost.addEventListener('pointerdown', (e) => {
        press = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    }, { signal });
    ui.sceneHost.addEventListener('pointerup', (e) => {
        const p = press;
        press = null;
        if (!p || e.button !== 0) return;
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_PX || performance.now() - p.t > CLICK_MS) return;
        if (!scene || !scene.hitsBase(e.clientX, e.clientY)) return;
        if (!state.asleep) {
            // awake: an empty chamber offers its four rooms, right there
            if (busy || state.watcher.gone) return;
            const slot = hooks.emptyAt(e.clientX, e.clientY);
            if (slot >= 0) openRing(slot, e.clientX, e.clientY);
            return;
        }
        if (choosing) {
            const k = candidateAt(e.clientX, e.clientY);
            if (k >= 0) chooseSector(k);
            return;
        }
        if (lamp && pressSlot(scene.slotAt(e.clientX, e.clientY))) return;
        snapBase();
    }, { signal });
    ui.sceneHost.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; }, { signal });
    ui.sceneHost.addEventListener('pointerleave', () => { pointer = null; }, { signal });
    const RING_LEN = 2 * Math.PI * 15;
    function stepCursor() {
        const asleep = !!state.asleep;
        const over = !!pointer && !!scene && scene.hitsBase(pointer.x, pointer.y);
        const wait = asleep && !choosing ? snapWait(state.watcher, Date.now()) : 0;
        ui.sceneHost.classList.toggle('is-over-base', asleep && over && wait <= 0);
        // awake, the cursor is a hand over an empty chamber
        const emptyUnder = !asleep && over && !busy && hooks.emptyAt(pointer.x, pointer.y) >= 0;
        ui.sceneHost.classList.toggle('is-over-empty', emptyUnder);
        if (choosing) {
            const k = pointer && over ? candidateAt(pointer.x, pointer.y) : -1;
            if (k !== hoverSector) { hoverSector = k; scene?.setCandidates(sealCandidates(state.watcher, layout.slots), k); }
        }
        const sealed = (state.watcher.sealed || []).length > 0;
        const slot = sealed && pointer && scene && !choosing ? scene.slotAt(pointer.x, pointer.y) : -1;
        const body = slot >= 0 && inBody(state.watcher, slot);
        if (ui.bodyTip) {
            if (ui.bodyTip.hidden === body) ui.bodyTip.hidden = !body;
            if (body) placeTip(ui.bodyTip, pointer.x + 14, pointer.y + 12);
        }
        const onMachine = !!pointer && !!scene && !choosing && !body && hooks.ringSlot < 0 && scene.machineAt(pointer.x, pointer.y)
            && !(ui.takeTip && !ui.takeTip.hidden);
        if (ui.machineTip) {
            if (ui.machineTip.hidden === onMachine) ui.machineTip.hidden = !onMachine;
            if (onMachine) {
                if (ui.machineTip.textContent !== machineText) ui.machineTip.textContent = machineText;
                placeTip(ui.machineTip, pointer.x + 16, pointer.y + 14);
            }
        }
        if (!ui.snapRing) return;
        const on = asleep && !!pointer && wait > 0;
        ui.snapRing.hidden = !on;
        if (!on) return;
        ui.snapRing.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
        ui.snapArc?.setAttribute('stroke-dashoffset', (RING_LEN * wait / SNAP_COOLDOWN_MS).toFixed(1));
    }

    // outside the ring, a press closes it. deep-fix2: the drawer closes only on a press on the empty
    // scene behind it; DIG, the lever, the drawer button, the "+" and the menu do their own job and
    // leave it open (Ola: "you can click Dig, but the drawer just closes and nothing is dug")
    document.addEventListener('pointerdown', (e) => {
        if (hooks.ringSlot >= 0 && !ui.ring.contains(e.target)) hooks.closeRoomRing();
        if (hooks.organRingAt && !ui.ring.contains(e.target)) hooks.closeOrganRing();
        // deep-tension: a press on a chamber is not a press on the empty scene: the colony stands left of
        // the drawer now, so a room can be built with the drawer open (closing it moved the colony
        // under the ring that had just opened)
        const onChamber = !!scene && ((scene.slotAt?.(e.clientX, e.clientY) ?? -1) >= 0 || !!scene.chamberAt?.(e.clientX, e.clientY));
        if (drawer.isOpen() && ui.sceneHost.contains(e.target) && !onChamber) closeDrawer();
    }, { signal, capture: true });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (hooks.organRingAt) { hooks.closeOrganRing(); return; }
        if (hooks.ringSlot >= 0) { hooks.closeRoomRing(); return; }
        if (treeView?.isOpen()) { closeTree(); return; }
        if (drawer.isOpen()) { closeDrawer(); return; }
        if (!state.asleep) return;
        if (choosing) { leaveChoice(); updateChrome(); return; }
        if (!state.watcher.puzzle) return;
        dismissPuzzle(state.watcher, state.cryo);
        lamp = null;
        updateChrome();
        saveGame();
    }, { signal });
    ui.ask.addEventListener('click', () => { if (!busy && !paused()) enterChoice(); }, { signal });
    ui.treeBtn.addEventListener('click', () => toggleDrawer(), { signal });
    for (const b of ui.rpsBtns) b.addEventListener('click', () => throwAtSurface(b.dataset.throw), { signal });
    ui.digBtn.addEventListener('click', () => { if (!busy && !state.asleep) dig(); }, { signal });
    ui.lever.addEventListener('click', () => {
        if (ui.leverWrap.classList.contains('is-locked')) return;
        pullLever().catch((e) => console.error('the deep: the lever broke', e));
    }, { signal });
    ui.ascendBtn.addEventListener('click', () => { goUpAlone().catch((e) => console.error('the deep: the climb broke', e)); }, { signal });
    ui.resetBtn.addEventListener('click', () => { scene?.resetView(); ui.resetBtn.classList.remove('is-on'); }, { signal });
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
        if (paused()) { lastDayAt = now; lastGrowAt = now; return; }
        if (growOn(state)) { growTick(now); return; }
        const elapsed = Math.round((now - lastDayAt) / 1000);
        const days = Math.max(1, Math.min(MAX_CATCHUP_DAYS, elapsed));
        lastDayAt = now;
        recoverAwake(state.watcher, days);
        for (let i = 0; i < days; i++) {
            landBuilds();
            report = tickDay(state, false);
            // a party out from an older save still comes home on its day
            for (const l of resolveDueProbes(state, layout.slots, Math.random)) if (l.back > 0) scene?.scoutsDown(l.back);
            repairTick(state, layout.slots, report.hands);
        }
        afterChange();
    }
    function stopClock() {
        if (dayInterval) clearInterval(dayInterval);
        dayInterval = null;
    }
    function startClock() {
        stopClock();
        lastDayAt = performance.now();
        lastGrowAt = lastDayAt;
        dayInterval = setInterval(dayTick, 1000);
    }

    // --- frames: the people walk, the needles swing, the numbers roll; no game time here ---
    let lastFrame = performance.now();
    function frame(now) {
        // a rAF timestamp can be earlier than the clock read at init: never a negative step
        const dt = Math.max(0, Math.min(0.05, (now - lastFrame) / 1000));
        lastFrame = now;
        if (roll) drawCounters(rollingValue(now));
        else if (state.asleep && falseNow.twitch) drawDive(state.day);
        stepCursor();
        stepVoice();
        stepLamps();
        stepMadness(now);
        stepHallucinations(now);
        if (state.asleep && ui.surface && !ui.surface.hidden && surfaceGone(state.watcher.surface.visit)) drawSurface();
        else if (state.asleep && voice && voice.merge) drawSurface();
        panel.step(paused() ? 0 : dt);
        // deep-organs: the hands throw faster with PULSE (the hearts drive them)
        const handsK = growOn(state) && state.grow.body.includes('machine') ? Math.max(HANDS_PULSE[0], Math.min(HANDS_PULSE[1], bodyRatios(state, layout).ratios.E)) : 1;
        hooks.step(paused() ? 0 : dt, (lastTempo.throws || 0) * handsK);
        scene?.step(paused() ? 0 : dt);
        placeCentre();
        placeHeart();
        rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    /** deep-swap: the counter, Surface's stage and the last lines stand over the colony's middle (the strata view's shaft). */
    let centreAt = '';
    function placeCentre() {
        if (!scene || typeof scene.centre !== 'function') return;
        const c = scene.centre();
        const key = `${Math.round(c.x)}|${Math.round(c.y)}`;
        if (key === centreAt) return;
        centreAt = key;
        ui.root.style.setProperty('--deep-cx', `${Math.round(c.x)}px`);
        ui.root.style.setProperty('--deep-cy', `${Math.round(c.y)}px`);
        // deep-pass3 (B407): Surface's stage holds still through a sleep (its buttons drifted with the camera
        // and a click aimed at rock missed): it takes the middle awake and keeps it until the wake
        if (!state.asleep || !nightX) { nightX = Math.round(c.x); ui.root.style.setProperty('--deep-night-x', `${nightX}px`); }
    }
    let nightX = 0;

    recomputeGates();
    scene?.setState(state, layout);
    if (growOn(state)) enterGrowUi({ instant: !!state.grow.overgrown || risen(state) });
    else drawFlesh();
    updateChrome();
    panel.settle();
    saveGame();

    // A colony that was asleep when the tab closed is still asleep: the years roll on.
    if (state.asleep && state.cryo >= 0) {
        ui.root.classList.add('is-sleeping', 'is-night');
        panel.lightsNow(false);
        setDiveOffset();
        ui.dive.hidden = false;
        sleepSum = freshSum();
        sleepClock = 0;
        drawCounters(snapshot());
        runSleep();
    } else {
        state.asleep = false;
        startClock();
    }
    if (state.ascended) {
        scene?.lighten();
        // deep-grow: the body's end is V · UNITY
        const end = state.ending === 'body' ? GROW_END : CHAPTER_V;
        playChapterCard({ roman: end.roman, title: end.title, mode: 'to-come', dark: true });
    }

    // --- hooks, for the tests ---
    window.rpiDeep = {
        get state() { return state; }, get layout() { return layout; }, get report() { return report; },
        get feed() { return feed.slice(); }, scene,
        // deep-swap: which view draws the colony, and the layers the strata view lays
        view: viewKind,
        get strata() { return Array.isArray(state.strata) ? state.strata.slice() : []; },
        get graph() { return graphOf(layout); },
        get lamp() { return lamp ? { kind: lamp.p.kind, phase: lamp.phase, t: lamp.t, at: lamp.p.at || 0 } : null; },
        pressSlot: (slot) => pressSlot(slot),
        get rps() { return rps ? { stage: rps.stage, log: rps.log.slice() } : (rpsLast ? { stage: 'done', log: rpsLast.slice() } : null); },
        get choosing() { return choosing; },
        get hDrop() { return hDrop ? { text: hDrop.text, from: hDrop.from, to: hDrop.to } : null; },
        get treeOpen() { return !!treeView?.isOpen(); },
        get voice() {
            return voice ? { text: voice.text, typed: ui.voiceText.textContent, shown: !ui.voice.hidden,
                typing: ui.voice.classList.contains('is-typing'), starts: typeStarts } : null;
        },
        get typeStarts() { return typeStarts; },
        get treeDrawn() { return treeView ? treeView.drawn : {}; },
        get machineTip() { return { text: machineText, shown: !!ui.machineTip && !ui.machineTip.hidden }; },
        get road() { return roadNow; },
        // deep-econ
        get note() { return panel.note; },
        get recall() { return recallShown && ui.recall && !ui.recall.hidden ? { ...recallShown, text: ui.recall.textContent } : null; },
        get rates() { return { ore: ui.oreRate.textContent, stars: ui.starsRate.textContent, people: ui.peopleRate ? ui.peopleRate.textContent : '' }; },
        get tip() { return ui.takeTip && !ui.takeTip.hidden ? ui.takeTip.textContent : ''; },
        snap: () => snapBase(),
        showTip: (id) => { const p = scene?.screenOfNode?.(id); showTip(id, p ? p.x : 400, p ? p.y : 400); },
        openTree: () => openTree(),
        closeTree: () => closeTree(),
        // deep-rebuild
        get instruments() { return { ...inst, advice: panel.advice, alarm: panel.alarmWord, needles: Object.fromEntries(['M', 'F', 'E', 'H'].map((c) => [c, panel.needle(c)])) }; },
        get drawerOpen() { return drawer.isOpen(); },
        get drawerRows() { return drawer.rows; },
        get ringSlot() { return hooks.ringSlot; },
        get empties() { return emptyChambers(state, layout); },
        get hallucinating() { return { ...falseNow, scene: scene ? scene.hallucinating : null }; },
        get sleepClock() { return sleepClock; },
        get surfaceShown() { return !!ui.surface && !ui.surface.hidden; },
        openRing: (slot) => { const p = scene?.screenOfSlot(slot); openRing(slot, p ? p.x : innerWidth / 2, p ? p.y : innerHeight / 2); },
        openDrawer: () => openDrawer(),
        pull: () => pullLever(),
        // deep-grow2
        get graft() { return JSON.parse(JSON.stringify(state.graft || null)); },
        get people() { return { count: ui.people ? ui.people.textContent : '', rate: ui.peopleRate ? ui.peopleRate.textContent : '',
            shown: !!ui.people && ui.people.getBoundingClientRect().width > 0 }; },
        get marks() { return hooks.marks || []; },
        get dreaming() { return dreaming(state); },
        get heartShown() { return heartShown; },
        get beat() { return beatNow(); },
        pumpHeart: () => pumpHeart(),
        mark: (id) => { const on = toggleMark(state, layout, id); afterChange(); return on; },
        graftAt: (id) => graftAt(id),
        get graftOffer() { return graftOwed(state) ? graftCandidates(state, layout) : []; },
        // deep-grow
        get grow() { return state.grow ? JSON.parse(JSON.stringify(state.grow)) : null; },
        get gaugeLabels() { return panel.labels; },
        get overgrown() { return panel.overgrown; },
        get bodyView() { return viewOf(state, layout); },
        get bodyStats() { return hooks.bodyStats; },
        get growLog() { return { ...growLog }; },
        get riseReady() { return riseReady(state, layout); },
        take: (id) => takeAt(id),
        takeWords: (id) => takeTip(state, layout, id).text,
        // deep-organs
        choose: (id, organ) => chooseOrgan(id, organ),
        redraw: () => { fleshKey = ''; organKey = ''; afterChange(); return true; },
        get organRingAt() { return hooks.organRingAt || ''; },
        get organRing() {
            return [...ui.ring.querySelectorAll('.deep-ring-organ')].map((b) => ({ organ: b.dataset.organ, ok: b.classList.contains('is-ok'),
                cheap: b.classList.contains('is-cheap'), price: b.querySelector('.deep-ring-price').textContent.trim() }));
        },
        get organArt() { return hooks.organArt || []; },
        get ratios() { return growOn(state) ? bodyRatios(state, layout) : null; },
        get waves() { return hooks.waves || 0; },
        get taking() { return taking(state) ? { ...taking(state) } : null; },
        get weakestGauge() { const el = document.querySelector('#deep-gauges .deep-gauge.is-weakest'); return el ? el.dataset.col : ''; },
        screenOfNode: (id) => scene?.screenOfNode(id) || null,
        chamberAt: (x, y) => scene?.chamberAt(x, y) || '',
    };
    let debugOn = false;
    try { debugOn = window.location.search.includes('debug') || localStorage.getItem(DEBUG_KEY) === '1'; } catch { /* ignore */ }
    if (debugOn) {
        window.debug_deep = (what, n) => {
            if (what === 'minerals') state.minerals += 1e6;
            else if (what === 'stability') state.watcher.stability = Math.max(0, Math.min(STABILITY_MAX, Number(n) || 0));
            else if (what === 'capacity') state.watcher.capacity = Math.max(0, Math.min(capacityMax(state.watcher), Number(n ?? capacityMax(state.watcher))));
            else if (what === 'puzzle' || what === 'lamps' || what === 'dark') {
                state.watcher.capacity = Math.max(state.watcher.capacity, capacityMax(state.watcher));
                if (state.asleep) {
                    closeSurface(state.watcher);
                    stopRps();
                    state.watcher.puzzle = null;
                    lamp = null;
                    openPuzzle(state.watcher, lampsInView(), null, { kind: what === 'puzzle' ? null : what });
                }
            } else if (what === 'surface' || what === 'night') {
                // Surface now, in this sleep, whatever the gaps and the mind say ('night': its next line)
                if (state.asleep) {
                    if (state.watcher.puzzle) { dismissPuzzle(state.watcher, state.cryo); lamp = null; }
                    stopRps();
                    const sf = state.watcher.surface;
                    sf.visit = null;
                    sf.lastSleep = 0;
                    openSurface(state.watcher, state, { force: what === 'night' });
                    surfaceKey = '';
                    rpsDoneAt = 0;
                }
            } else if (what === 'ladder') {
                const step = LADDER[(state.watcher.bought || []).length];
                if (step) {
                    state.watcher.capacity = capacityMax(state.watcher);
                    state.stars += step.stars;
                    state.minerals += step.ore || 0;
                    state.watcher.grown = BODY_GROW_SECONDS;
                }
            } else if (what === 'stars') state.stars += 1e8;
            else if (what === 'feed') state.feed = Math.max(0, Math.min(FEED_MAX, Math.floor(Number(n) || 0)));
            else if (what === 'day100') { for (let i = 0; i < 100; i++) report = tickDay(state, state.asleep); }
            else if (what === 'sleep') { pullLever(); return; }
            else if (what === 'grow') {
                // deep-grow: answer The question now
                state.tree = state.tree || { opened: [], bought: [], unseen: false };
                if (!state.tree.opened.includes('question')) state.tree.opened.push('question');
                if (!state.tree.bought.includes('question')) state.tree.bought.push('question');
                beginGrow();
                return;
            } else if (what === 'graft') {
                // deep-grow2: Surface's gift, now
                state.graft = normalizeGraft(state.graft);
                state.graft.owed += 1;
            } else if (what === 'people') state.humans += Number(n) || 1e6;
            else if (what === 'starve') state.humans = MIN_SLEEPERS;
            else if (what === 'alarm') {
                // a test alarm; n names its kind ('food', 'energy', 'stall', 'reboot', ...)
                if (state.asleep) wake(n ? { kind: n, type: 'mine', days: 3, pct: 60 } : { kind: 'debug' });
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
    clearInterval(dreamTimer);
    dreamTimer = null;
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
    try { scene?.dispose(); } catch (e) { console.warn('the deep: dispose', e); }
    scene = null;
    viewItem?.remove();
    viewItem = null;
    try { sound?.stop(); } catch (e) { console.warn('the deep: sound stop', e); }
    sound = null;
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
