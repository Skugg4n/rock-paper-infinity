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
} from './deep.js';
import { pushFeed, alarmLine } from './advisor.js';
import { short, span, cryoRoad, cryoNeed, ORE_SIGN, signHtml } from './readout.js';
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
    sealCandidates, sealSector, choosingSector, bodyGlyph, inBody, textMadness, lookDue, sleepDaysAt,
} from './watcher.js';
import { THROWS, THROW_ICON, SENTENCE, SENTENCE_LINE, TYPE_MS } from './surface.js';
import { NODE_BY_ID, buy as treeBuy, buyMany as treeBuyMany, normalizeTree, canBuy } from './tree.js';
import { machineTempo, machineSays } from './machine.js';
import { createTreeView } from './tree-view.js';
import {
    gauges as readGauges, advise, cryoLamps, wakeWord, hallucinationsAt, SNAP_CLEAR_MS, healing,
    drawerGroups, drawerCount, surfaceTape, MERGE_MS, RPS_FADE_MS, cardGone,
} from './instruments.js';
import { createPanel } from './panel.js';
import { createDrawer } from './drawer.js';
import { createViewHooks } from './view-hooks.js';
import {
    growOn, risen, normalizeGrow, organsOf, stepGrow, takeChamber, takeWords, viewOf, graphOf,
    growGauges, adviseGrow, riseLamps, riseReady, bodyGroups, buyBody, fleshShare, rise as riseBody,
    GROW_GAUGES, GROW_DAYS_PER_SECOND, GROW_END, RISE_LINES, setChamberPlace,
} from './grow.js';
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
        card: { el: $('deep-puzzle'), q: $('deep-puzzle-q'), said: $('deep-puzzle-said') },
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
        takeTip: $('deep-take-tip'), riseLines: $('deep-rise-lines'),
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
    const baseHooks = createViewHooks(scene, { ringHost: ui.ring, isEmpty, onIcons: scheduleIconRefresh, graph: () => graphOf(layout) });
    const hooks = scene && viewKind !== '3d' ? extendHooks(baseHooks, scene) : baseHooks;
    mountViewItem(viewKind);
    const panel = createPanel({
        root: ui.panel, gauges: $('deep-gauges'), advice: $('deep-advice'), empty: $('deep-empty'),
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
    let lookClock = 0;              // deep-fix: real seconds of this sleep, for the look at Cryo I and II
    let diveOffset = 0;             // the years slept, as days, less the calendar day: constant within a sleep
    let alarmUntil = 0;             // the wake's lamp goes out then (0: it is out)
    let inst = { advice: '', lamps: null, lever: false };   // what the instruments say, kept once a colony day
    let lastTempo = { throws: 0 };   // the machine's tempo as last read (the hands throw on it)

    const dryRun = () => tickDay(JSON.parse(JSON.stringify(state)), state.asleep);
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
        const unit = months ? 'MONTHS' : 'YEARS';
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
        if (state.asleep) drawDive(v.day);
        else drawClock(v.day);
        ui.minerals.textContent = formatCount(v.ore);
        ui.stars.textContent = formatCount(v.stars);
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
        if (state.asleep) return;
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
            lamps: state.cryo < 0 ? cryoLamps(roadNow) : null,
            advice: advise(state, report, { road: roadNow, lever: leverReady }),
        };
    }

    /* ---- THE CHROME ---------------------------------------------------------------------------- */
    const perDay = (v) => (Math.abs(v) < 0.5 ? '' : `${v >= 0 ? '+' : '-'}${formatCount(Math.abs(v))} a day`);
    let leverWas = null;
    function updateChrome() {
        if (!state.asleep && !roll) drawCounters(snapshot());
        const oreDay = perDay(report.parts.M), starDay = perDay(report.stars);
        if (ui.oreRate.textContent !== oreDay) ui.oreRate.textContent = oreDay;
        if (ui.starsRate.textContent !== starDay) ui.starsRate.textContent = starDay;
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
        panel.update({
            gauges: growing ? growGauges(state, report, layout) : readGauges(state, report),
            advice: asleep || risen(state) ? '' : inst.advice,
            empty: asleep || growing ? 0 : emptyChambers(state, layout).length,
            lamps: growing ? (risen(state) ? null : inst.lamps) : (!asleep && state.cryo < 0 ? inst.lamps : null),
        });
        if (alarmUntil && performance.now() > alarmUntil) { alarmUntil = 0; panel.alarm(''); }

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
        const badge = drawerCount(groups) > 0 ? String(drawerCount(groups)) : '';
        if (ui.treeBadge.textContent !== badge) ui.treeBadge.textContent = badge;
        ui.treeBadge.classList.toggle('hidden', !badge);
        ui.treeBtn.classList.toggle('has-night', !!(state.tree && state.tree.unseen));
        if (drawer.isOpen()) drawer.refresh(groups, wallet());
        treeView?.refresh();

        // THE LEVER: before the hall it is there once the lamps are lit and Cryo I can be paid.
        // deep-grow: in the body it is gone, and comes back overgrown when the body can rise
        const owns = state.cryo >= 0;
        const leverOn = growing ? (inst.lever && !risen(state)) : (!gone && (owns || inst.lever));
        if (leverWas === false && leverOn) {
            ui.leverWrap.classList.remove('is-arriving');
            void ui.leverWrap.offsetWidth;
            ui.leverWrap.classList.add('is-arriving');
        }
        leverWas = leverOn;
        ui.leverWrap.hidden = !leverOn;
        ui.root.classList.toggle('has-lever', leverOn);
        ui.leverWrap.classList.toggle('is-down', !!state.asleep);
        ui.leverWrap.classList.toggle('is-ready', !state.asleep && (inst.advice === 'SLEEP' || inst.advice === 'RISE'));
        ui.leverWrap.classList.toggle('is-flesh', growing);
        const few = !growing && !state.asleep && state.humans < MIN_SLEEPERS;
        ui.leverWrap.classList.toggle('is-locked', busy || few);
        // deep-fix2: the price is the fourth lamp on the panel; it is not said again under the lever
        if (ui.leverPrice.textContent !== '') ui.leverPrice.textContent = '';
        ui.lever.setAttribute('aria-label', growing ? 'Rise' : state.asleep ? 'Wake' : 'Sleep');
        const tape = growing ? 'RISE' : state.asleep ? 'WAKE' : 'SLEEP';
        if (ui.leverTape.textContent !== tape) ui.leverTape.textContent = tape;
        // the Watcher alone, at the old ending: the one thing left to press
        ui.ascendBtn.classList.toggle('hidden', !gone);
        ui.ascendBtn.classList.toggle('is-locked', busy || !!state.ascended);

        updateWatcher();
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
    const drawerRows = () => (growOn(state) ? bodyGroups(state) : drawerGroups(state, treeCtx()));
    const drawer = createDrawer(ui.drawer, {
        onBuy: (id) => (id.startsWith('body:') ? buyBodyItem(id.slice(5)) : buyNode(id)),
        onWholeTree: () => { closeDrawer(); openTree(); },
        onClose: () => ui.root.classList.remove('is-drawer-open'),
    });
    function openDrawer() {
        if (drawer.isOpen()) return;
        hooks.closeRoomRing();
        if (state.tree) state.tree.unseen = false;
        drawer.open();
        ui.root.classList.add('is-drawer-open');
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
    const LAMP_T = { lead: 900, on: 460, gap: 220, darkLead: 1300 };
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
        let q = '', said = '', cls = '';
        const now = performance.now();
        if (cardSaid && now < cardSaid.until) ({ q, said, cls } = cardSaid);
        else if (lamp && state.asleep) {
            cardSaid = null;
            const p = lamp.p;
            if (p.kind === 'dark') q = lamp.phase === 'out' ? `ONE WENT OUT · ${Math.max(0, (DARK_MS - (lamp.t - lamp.outAt)) / 1000).toFixed(1)} s` : 'LAMPS · ALL LIT';
            else q = lamp.phase === 'input' ? `LAMPS · YOUR TURN${p.at ? ` · ${p.at}` : ''}` : 'LAMPS · WATCH';
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
        if (out.ok) {
            const gain = puzzleStars(report.stars) * lampFactor(w);
            state.stars += gain;
            lampFlash({ flash: lamps }, 520);
            cardSaid = { q: 'LAMPS', said: `+${Math.round(out.gained)}`, cls: 'is-right', until: performance.now() + 1200 };
        } else {
            lampFlash({ wrong: slot >= 0 ? [slot] : [], ...(p.kind === 'dark' ? { off: [p.out] } : {}) }, 700);
            cardSaid = { q: 'LAMPS', said: `${Math.round(out.gained)}`, cls: 'is-wrong', until: performance.now() + 1200 };
        }
        updateChrome();
        saveGame();
        if (out.rebooted) wake({ kind: 'reboot' }).catch((e) => console.error('the deep: the wake broke', e));
    }

    function afterChange() {
        claimChambers(state, layout);
        if (growOn(state)) state.organs = organsOf(state, layout);
        report = dryRun();
        recomputeGates();
        scene?.setState(state, layout);
        hooks.reapply();
        updateChrome();
        saveGame();
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
    function bought() { alarmUntil = 0; panel.alarm(''); sound?.event('buy'); }
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
        for (const t of ROOMS) {
            const price = nextPrice(state, 'room', t);
            const miss = Math.ceil(price - state.minerals);
            out[t] = {
                price: `${ORE_SIGN} ${formatCount(price)}`,
                ok: !full && miss <= 0,
                need: full ? 'THE QUEUE IS FULL' : `${ORE_SIGN} ${formatCount(miss)} MORE`,
            };
        }
        return out;
    }
    function openRing(slot, x, y) {
        closeDrawer();
        hooks.openRoomRing(slot, x, y, {
            rooms: roomOffer(),
            onPick: (t) => { if (!busy && !state.asleep) buildRoom(t, slot); },
        });
    }

    /* ---- THE QUEUE (v1.49.0): a strip along the bottom, each order with its ring; a click takes it back ---- */
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
    const growLog = { taken: 0, died: 0, revived: 0 };
    let frontFloor = -1;
    function drawBody() {
        const v = viewOf(state, layout);
        hooks.setBody(v.body, v.necrotic, v.reachable);
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
            const front = Math.min(...v.reachable.map(floorOf));
            if (front !== frontFloor && !risen(state) && performance.now() >= holdFocusUntil) { frontFloor = front; scene?.focusFloor(front); }
        }
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
        drawBody();
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
    function growTick(now) {
        const secs = Math.max(0, Math.min(GROW_CATCHUP_S, (now - lastGrowAt) / 1000));
        lastGrowAt = now;
        if (risen(state)) return;
        const days = Math.max(1, Math.round(secs * GROW_DAYS_PER_SECOND));
        const died = [], revived = [], spread = [];
        for (let i = 0; i < days; i++) {
            landBuilds();
            state.organs = organsOf(state, layout);
            report = tickDay(state, false);
            const y = stepGrow(state, layout, 1);
            died.push(...y.died); revived.push(...y.revived); spread.push(...y.spread);
        }
        recoverAwake(state.watcher, days);
        if (died.length) { sound?.event('necrosis'); growLog.died += died.length; }
        if (revived.length) growLog.revived += revived.length;
        if (spread.length) { sound?.event('take'); growLog.taken += spread.length; }
        afterChange();
        drawBody();
    }
    /** A click on a chamber: the body takes it if it touches it and the price can be paid. */
    function takeAt(id) {
        if (!growOn(state) || risen(state) || busy || paused() || state.asleep) return false;
        const r = takeChamber(state, layout, id);
        if (!r) {
            if (takeWords(state, layout, id)) nudgeTip();
            return false;
        }
        growLog.taken++;
        sound?.event('take');
        afterChange();
        drawBody();
        showTip(id, tipAt.x, tipAt.y);
        return true;
    }
    /** The price over the chamber under the cursor, in plain words. */
    let tipAt = { x: 0, y: 0 };
    function showTip(id, x, y) {
        tipAt = { x, y };
        const words = id ? takeWords(state, layout, id) : '';
        const el = ui.takeTip;
        if (!el) return;
        if (el.dataset.text !== words) { el.dataset.text = words; el.innerHTML = signHtml(words); }
        el.hidden = !words;
        ui.sceneHost.classList.toggle('is-over-take', !!words);
        if (words) el.style.transform = `translate(${x + 16}px, ${y + 14}px)`;
    }
    function nudgeTip() {
        const el = ui.takeTip;
        if (!el) return;
        el.classList.remove('is-no');
        void el.offsetWidth;
        el.classList.add('is-no');
    }
    hooks.onChamberClick((id) => takeAt(id));
    hooks.onChamberHover((id, x, y) => showTip(growOn(state) && !busy ? id : '', x, y));
    /** A body item from the drawer. */
    function buyBodyItem(id) {
        if (paused() || busy) return false;
        if (!buyBody(state, id, report.stars)) return false;
        bought();
        afterChange();
        return true;
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
        if (growOn(state)) { await riseUp(); return; }
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
        sum.watch = watchSleep(state.watcher, { days: sum.days, tier: state.cryo, spare: sum.spare, hold: choosing });
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
        await Promise.all([panel.lights(true, LIGHTS_MS), scene ? scene.release(SLEEP_TIMING.release) : Promise.resolve()]);
        sleepSum = null;
        setBusy(false);
        startClock();
        updateChrome();
        saveGame();
    }

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
        if (!state.asleep || busy) return;
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
            if (body) ui.bodyTip.style.transform = `translate(${pointer.x + 14}px, ${pointer.y + 12}px)`;
        }
        const onMachine = !!pointer && !!scene && !choosing && !body && hooks.ringSlot < 0 && scene.machineAt(pointer.x, pointer.y)
            && !(ui.takeTip && !ui.takeTip.hidden);
        if (ui.machineTip) {
            if (ui.machineTip.hidden === onMachine) ui.machineTip.hidden = !onMachine;
            if (onMachine) {
                if (ui.machineTip.textContent !== machineText) ui.machineTip.textContent = machineText;
                ui.machineTip.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 14}px)`;
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
        if (drawer.isOpen() && ui.sceneHost.contains(e.target)) closeDrawer();
    }, { signal, capture: true });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
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
        if (paused()) { lastDayAt = now; return; }
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
        hooks.step(paused() ? 0 : dt, lastTempo.throws || 0);
        scene?.step(paused() ? 0 : dt);
        placeCentre();
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
    }

    recomputeGates();
    scene?.setState(state, layout);
    if (growOn(state)) enterGrowUi({ instant: !!state.grow.overgrown || risen(state) });
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
        // deep-grow
        get grow() { return state.grow ? JSON.parse(JSON.stringify(state.grow)) : null; },
        get gaugeLabels() { return panel.labels; },
        get overgrown() { return panel.overgrown; },
        get bodyView() { return viewOf(state, layout); },
        get bodyStats() { return hooks.bodyStats; },
        get growLog() { return { ...growLog }; },
        get riseReady() { return riseReady(state, layout); },
        take: (id) => takeAt(id),
        takeWords: (id) => takeWords(state, layout, id),
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
