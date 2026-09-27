/**
 * Chapter IV · THE DEEP: the Watcher (v1.46.0). The rules of the game inside the sleep.
 *
 * When the colony sleeps, something stays awake: the system that keeps the watch. The player
 * is that system, and nothing says so. It first shows itself as a label, SYSTEM AWAKE, and
 * after enough slept years, once and quietly, as THE WATCHER. Under it a STABILITY meter
 * that drifts down with the years and drops on alarms. Low, the base softens, the feed lines
 * get slightly wrong, and at zero the system reboots and wakes the colony. A click on the
 * base snaps it back; a riddle solved with the machines' spare capacity holds it up.
 *
 * Pure: no DOM, no clock of its own. The phase hands it the days slept, the tier, the spare
 * energy and the wall clock; the tests hand it numbers.
 */

import { CRYO, DAYS_PER_YEAR, BAD_ALARMS, MIN_SLEEPERS } from './deep.js';
import { initialSurface, normalizeSurface, visitDue, openVisit, closeVisit, play as playRps, SENTENCE, VISIT_AFTER_SECONDS } from './surface.js';
import { sectorOf, SECTORS } from './layout.js';

export const STABILITY_MAX = 100;
/** What the label reads, in order. It moves on once and never back. */
export const WATCHER_NAMES = ['SYSTEM AWAKE', 'THE WATCHER'];
/** Slept years before the label changes: a century, longer than anyone who came down would
 *  have lived awake. In the simulated run that is about minute 18, halfway through the sleeps. */
export const NAME_AT_YEARS = 100;

/**
 * THE DRIFT. Stability falls with slept years: one point per `driftYears(tier)` years. The
 * years are scaled by the tier, so a real second of sleep costs about the same at a month a
 * second as at a hundred thousand years a second, a little more the deeper the sleep:
 * DRIFT_PER_SECOND points per real second at each tier.
 */
export const DRIFT_PER_SECOND = [0.5, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2];
/**
 * THE FIRST SLEEP TEACHES, IT DOES NOT PUNISH (v1.48.0). The overnight playtest: the first sleep
 * opened on a riddle nobody had been told about, a meter nobody had seen drained, and the first
 * wake a new player got was "Woke: the system rebooted." Now, in the first sleep, the meter does
 * not drift, alarms do not jolt it and no riddle comes; the advisor says one line,
 * WATCHER_HELLO, and the sleep ends on a plain alarm at the latest after FIRST_SLEEP_DAYS.
 * The drift starts with the second sleep, gently at Cryo I (half a point a second).
 */
export const WATCHER_HELLO = 'Something stayed awake while they slept.';
export const FIRST_SLEEP_DAYS = DAYS_PER_YEAR;
/** Is this the first sleep the Watcher has kept? */
export const firstSleep = (w) => ((w && w.sleeps) || 0) <= 1;
const tierOf = (tier) => Math.max(0, Math.min(CRYO.length - 1, tier | 0));
/** Slept years a point of stability lasts at this tier. */
export const driftYears = (tier) => CRYO[tierOf(tier)].days / DAYS_PER_YEAR / DRIFT_PER_SECOND[tierOf(tier)];

/** An alarm is a jolt: a bad one costs more than good news. The hand and the reboot cost nothing. */
export const ALARM_DROP_BAD = 6;
export const ALARM_DROP = 2;
const NO_DROP = ['manual', 'debug', 'reboot', 'first'];

/** At zero the system reboots: the colony wakes, and the meter comes back at this. */
export const REBOOT_TO = 40;

/** THE SNAP. A click on the base: the structure snaps back, and a little stability with it,
 *  at most once in SNAP_COOLDOWN_MS of real time. */
export const SNAP_GAIN = 5;
export const SNAP_COOLDOWN_MS = 4000;

/** Below this the base starts to soften; at zero it is as soft as it gets. */
export const SOFT_FROM = 80;
/** Below this the feed lines start to go slightly wrong, at most one in GARBLE_EVERY. */
export const GARBLE_BELOW = 35;
export const GARBLE_EVERY = 5;

/** CAPACITY: what the machines can spare for the Watcher. Per slept day, the spare energy
 *  times CAPACITY_K, into a pool of CAPACITY_MAX. No spare energy, no capacity. The gain is
 *  capped at CAPACITY_PER_SECOND per real second of sleep: spare energy grows a hundred million
 *  fold over the chapter, and without the cap the pool would be full the moment a riddle had
 *  emptied it from Cryo II on. So a thin colony fills it slowly, and a rich one at the cap. */
export const CAPACITY_K = 1e-3;
export const CAPACITY_MAX = 100;
export const CAPACITY_PER_SECOND = 4;

/** A riddle: what it costs, what it gives, what a wrong answer takes. */
export const PUZZLE_COST = 50;
export const PUZZLE_GAIN = 15;
export const PUZZLE_WRONG = 5;
/** At most one riddle per this many real seconds of sleep at the tier's rate (so: per
 *  `puzzleGapYears(tier)` slept years). */
export const PUZZLE_GAP_SECONDS = 20;
export const puzzleGapYears = (tier) => PUZZLE_GAP_SECONDS * CRYO[tierOf(tier)].days / DAYS_PER_YEAR;
/** And a solved one pays this many days of the machine's wins, never less than PUZZLE_STARS_MIN. */
export const PUZZLE_STARS_DAYS = 30;
export const PUZZLE_STARS_MIN = 100;
export const puzzleStars = (starsPerDay) => Math.max(PUZZLE_STARS_MIN, Math.round(PUZZLE_STARS_DAYS * Math.max(0, starsPerDay || 0)));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** A Watcher that has never watched. */
export function initialWatcher() {
    return {
        stage: 0,               // index into WATCHER_NAMES
        stability: STABILITY_MAX,
        capacity: 0,
        sleptYears: 0,
        seed: 1,                // the next riddle is grown from this
        nextPuzzleYears: null,  // slept years before a riddle may come; set at the first sleep
        puzzle: null,           // the riddle on screen: { seed, terms, answer }
        sinceGarble: GARBLE_EVERY,
        lastSnapAt: 0,          // wall clock (ms): survives a reload, unlike the page's own clock
        reboots: 0, solved: 0,
        sleeps: 0,              // sleeps begun: the first one only teaches (v1.48.0)
        bought: [],             // the ladder, in the order it was bought (v1.49.0)
        puzzle2: null,          // the second riddle, with the Second core
        surface: initialSurface(),
        saidSpace: false,       // "We needed the space.", said once
        sealed: [],             // the sectors the body has taken, 0 to 3, in order (v1.50.0)
        grown: 0,               // real seconds of sleep since the body last grew
        gone: false,            // the last wake-up has come: nobody came out
    };
}

/** Whatever a save held, as a whole Watcher: missing fields filled, numbers kept in range. */
export function normalizeWatcher(w) {
    const had = w && typeof w === 'object' ? w : {};
    const out = { ...initialWatcher(), ...had };
    // a Watcher saved before v1.48.0 that has already kept a watch is past its first sleep
    if (!Number.isFinite(had.sleeps)) out.sleeps = (Number(had.sleptYears) > 0) ? 2 : 0;
    out.bought = Array.isArray(had.bought) ? had.bought.filter((id) => LADDER.some((u) => u.id === id)) : [];
    // bought in order: a ladder with a hole in it keeps only the rungs under the hole
    out.bought = out.bought.filter((id, i) => LADDER[i] && LADDER[i].id === id);
    out.surface = normalizeSurface(had.surface);
    out.sealed = Array.isArray(had.sealed) ? [...new Set(had.sealed.filter((x) => Number.isInteger(x) && x >= 0 && x < SECTORS))] : [];
    out.gone = !!had.gone;
    out.stability = clamp(Number.isFinite(out.stability) ? out.stability : STABILITY_MAX, 0, STABILITY_MAX);
    out.capacity = clamp(Number.isFinite(out.capacity) ? out.capacity : 0, 0, capacityMax(out));
    out.sleptYears = Math.max(0, Number.isFinite(out.sleptYears) ? out.sleptYears : 0);
    out.stage = clamp(out.stage | 0, 0, WATCHER_NAMES.length - 1);
    const okPuzzle = (p) => p && Array.isArray(p.terms) && Number.isFinite(p.answer);
    if (out.puzzle && !okPuzzle(out.puzzle)) out.puzzle = null;
    if (out.puzzle2 && !okPuzzle(out.puzzle2)) out.puzzle2 = null;
    return out;
}

/** What the label reads now. After the last wake-up it is the colony's name: the last word of
 *  Surface's sentence (v1.50.0). */
export const watcherName = (w) => (w && w.gone ? SENTENCE[SENTENCE.length - 1]
    : WATCHER_NAMES[clamp((w && w.stage) | 0, 0, WATCHER_NAMES.length - 1)]);

/**
 * How many colony days a slice of real time sleeps: the tier's rate times the seconds, and
 * none at all while the game is paused (the odometer holds, the Watcher does not drift).
 */
export const sleepDays = (seconds, tierDays, paused = false) => (paused ? 0 : Math.max(0, seconds) * Math.max(0, tierDays));

/**
 * The years go by under the ice. The Watcher counts them, drifts, and banks what the
 * machines spare.
 *
 * @param {object} w - the Watcher, mutated
 * @param {{days:number, tier:number, spare?:number}} slept - days slept, the tier they were
 *        slept at, and the spare energy summed over those days (sleep()'s `sum.spare`)
 * @returns {{rebooted:boolean, named:boolean}} rebooted: stability hit zero and came back at
 *          REBOOT_TO (the phase wakes the colony); named: the label changed on this slice
 */
export function watchSleep(w, { days, tier, spare = 0 }) {
    const d = Math.max(0, days || 0);
    const years = d / DAYS_PER_YEAR;
    w.sleptYears += years;
    if (!firstSleep(w)) w.stability = Math.max(0, w.stability - years * driftFactor(w) / driftYears(tier));
    const k = capacityGain(w);
    const cap = k * CAPACITY_PER_SECOND * d / CRYO[tierOf(tier)].days;
    w.grown = (w.grown || 0) + d / CRYO[tierOf(tier)].days;       // the body grows only in the dark
    w.capacity = Math.min(capacityMax(w), w.capacity + Math.min(cap, k * Math.max(0, spare) * CAPACITY_K));
    let named = false;
    if (w.stage === 0 && w.sleptYears >= NAME_AT_YEARS) { w.stage = 1; named = true; }
    return { rebooted: rebootIfSpent(w), named };
}

/** At zero: the system reboots. True when it did. */
function rebootIfSpent(w) {
    if (w.stability > 0) return false;
    w.stability = REBOOT_TO;
    w.reboots = (w.reboots || 0) + 1;
    return true;
}

/**
 * An alarm woke the colony: a step down on the meter.
 * @param {object} w - mutated
 * @param {string} kind - the alarm's kind
 * @returns {boolean} the step took the last of it, and the system rebooted
 */
export function alarmHit(w, kind) {
    if (NO_DROP.includes(kind) || firstSleep(w)) return false;
    w.stability = Math.max(0, w.stability - (BAD_ALARMS.includes(kind) ? ALARM_DROP_BAD : ALARM_DROP));
    return rebootIfSpent(w);
}

/**
 * How long until the base will answer a snap again, in ms of wall clock (0: now). The phase draws
 * this as the thin ring round the cursor (v1.48.0).
 * @param {object} w
 * @param {number} now - wall clock, ms
 * @returns {number}
 */
export function snapWait(w, now) {
    const last = w.lastSnapAt || 0;
    if (now < last) return 0;                       // a clock that went backwards owes nothing
    return Math.max(0, SNAP_COOLDOWN_MS - (now - last));
}

/**
 * A click on the base. The snap itself is the scene's; this is what it gives back.
 * @param {object} w - mutated
 * @param {number} now - wall clock, ms
 * @returns {number} the stability gained: SNAP_GAIN, or 0 inside the cooldown
 */
export function snap(w, now) {
    if (now - (w.lastSnapAt || 0) < SNAP_COOLDOWN_MS && now >= (w.lastSnapAt || 0)) return 0;
    w.lastSnapAt = now;
    const before = w.stability;
    w.stability = Math.min(STABILITY_MAX, w.stability + SNAP_GAIN);
    return w.stability - before;
}

/** How soft the base is, 0 (rigid) to 1 (as soft as it gets), from the stability. */
export function softness(stability) {
    const k = clamp((SOFT_FROM - stability) / SOFT_FROM, 0, 1);
    return Math.pow(k, 1.2);
}

/* ---- the feed goes slightly wrong ---------------------------------------- */

/**
 * Should this line come out wrong? Only below GARBLE_BELOW, more often the lower it is, and
 * never twice within GARBLE_EVERY lines. Counts the line either way.
 * @param {object} w - mutated (the count since the last wrong line)
 * @param {Function} rng
 */
export function shouldGarble(w, rng = Math.random) {
    w.sinceGarble = (w.sinceGarble ?? GARBLE_EVERY) + 1;
    if (w.stability >= GARBLE_BELOW || w.sinceGarble < GARBLE_EVERY) return false;
    if (rng() >= (GARBLE_BELOW - w.stability) / GARBLE_BELOW) return false;
    w.sinceGarble = 0;
    return true;
}

/**
 * The line, slightly wrong: one word left out, or one word said twice. Never the first word
 * ("Woke:"), never a line too short to lose a word and still read.
 * @param {string} line
 * @param {Function} rng
 * @returns {string}
 */
export function garble(line, rng = Math.random) {
    const words = String(line).split(' ');
    if (words.length < 4) return line;
    const i = 1 + Math.floor(rng() * (words.length - 2));      // not the first, not the last
    if (rng() < 0.5) words.splice(i, 1);
    else words.splice(i, 0, words[i].replace(/[.,:;!?]+$/, ''));
    return words.join(' ');
}

/** The feed as the Watcher writes it: each line through `shouldGarble`. */
export function watcherLines(w, lines, rng = Math.random) {
    return lines.map((l) => (shouldGarble(w, rng) ? garble(l, rng) : l));
}

/* ---- riddles ------------------------------------------------------------- */

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/** The rules a sequence can follow. Each takes a start and a step and gives the next term from
 *  the last one and its index. 'fib' (each term the sum of the two before) is written out in
 *  makePuzzle, because it needs two terms back. */
const RULES = [
    { id: 'add', make: (a, k) => (x, i) => (i === 0 ? a : x + k + 1) },
    { id: 'double-plus', make: (a, k) => (x, i) => (i === 0 ? a : 2 * x + 1 + (k % 3)) },
    { id: 'times', make: (a, k) => (x, i) => (i === 0 ? a : x * (2 + (k % 2))) },
    { id: 'growing', make: (a) => (x, i) => (i === 0 ? a : x + i) },
    { id: 'squares', make: (a) => (x, i) => (a + i) * (a + i) },
];

/**
 * A riddle, grown from a seed and the colony's own numbers: a short sequence and its next term.
 * One type for now. The start comes from the colony (its chambers), so the same seed in a
 * bigger colony is a different riddle.
 *
 * @param {number} seed
 * @param {{chambers?:number}} [colony]
 * @returns {{seed:number, rule:string, terms:number[], answer:number}}
 */
export function makePuzzle(seed, colony = {}) {
    const r = mulberry32((seed * 2654435761) >>> 0);
    const kinds = ['add', 'double-plus', 'times', 'growing', 'squares', 'fib'];
    const rule = kinds[Math.floor(r() * kinds.length)];
    const a = 1 + (((colony.chambers || 3) + Math.floor(r() * 7)) % 9);
    const k = 1 + Math.floor(r() * 6);
    const seq = [];
    if (rule === 'fib') {
        let x = a, y = a + k;
        for (let i = 0; i < 6; i++) { seq.push(x); [x, y] = [y, x + y]; }
    } else {
        const next = RULES.find((q) => q.id === rule).make(a, k);
        let x = 0;
        for (let i = 0; i < 6; i++) { x = next(x, i); seq.push(x); }
    }
    return { seed, rule, terms: seq.slice(0, 5), answer: seq[5] };
}

/** What the card shows: "3, 7, 15, 31, 63, ?" */
export const puzzleText = (p) => `${p.terms.join(', ')}, ?`;

/**
 * May a riddle come now? Asleep, none on screen, no alarm pending, the machines have the
 * capacity for it, and the slept years since the last one are enough.
 * @param {object} w
 * @param {{asleep:boolean, alarmPending?:boolean}} ctx
 */
export function puzzleDue(w, { asleep, alarmPending = false }) {
    if (!asleep || alarmPending || firstSleep(w)) return false;
    if (w.puzzle && (!has(w, 'secondcore') || w.puzzle2)) return false;
    if (w.capacity < PUZZLE_COST) return false;
    return w.nextPuzzleYears != null && w.sleptYears >= w.nextPuzzleYears;
}

/** The slot a riddle is in: 0 the first card, 1 the second (the Second core). */
const SLOT_KEY = ['puzzle', 'puzzle2'];
/**
 * Put the next riddle on screen, in the first free card. With the tier, the clock for the one
 * after it starts now (so a second card never opens in the same moment as the first).
 */
export function openPuzzle(w, colony, tier = null) {
    const key = !w.puzzle ? 'puzzle' : 'puzzle2';
    w[key] = makePuzzle(w.seed, colony);
    w.seed += 1;
    if (tier != null) w.nextPuzzleYears = w.sleptYears + puzzleGapYears(tier);
    return w[key];
}

/** The first sleep sets the clock for the first riddle. */
export function armPuzzles(w, tier) {
    if (w.nextPuzzleYears == null) w.nextPuzzleYears = w.sleptYears + puzzleGapYears(tier);
}

/**
 * A sleep begins (v1.48.0): counted, and the riddle clock set so that no riddle opens in the first
 * seconds of any sleep (half a gap at least). The first sleep has none at all (`puzzleDue`).
 * @param {object} w - mutated
 * @param {number} tier
 * @returns {boolean} true when this is the first sleep, the one that teaches
 */
export function beginSleep(w, tier) {
    w.sleeps = (w.sleeps || 0) + 1;
    armPuzzles(w, tier);
    if (!firstSleep(w)) w.nextPuzzleYears = Math.max(w.nextPuzzleYears, w.sleptYears + puzzleGapYears(tier) / 2);
    return firstSleep(w);
}

/** Escape: the riddle goes, and the next one is a gap away. A second card moves up to the first. */
export function dismissPuzzle(w, tier, slot = 0) {
    w[SLOT_KEY[slot] || 'puzzle'] = null;
    if (!w.puzzle && w.puzzle2) { w.puzzle = w.puzzle2; w.puzzle2 = null; }
    w.nextPuzzleYears = w.sleptYears + puzzleGapYears(tier);
}

/**
 * An answer.
 * @param {object} w - mutated
 * @param {string|number} value - what was typed
 * @param {number} tier - for the gap to the next riddle
 * @returns {{ok:boolean, gained:number, rebooted:boolean}|null} null when there is no riddle,
 *          or the answer is not a number (nothing is spent on a typo of that kind)
 */
export function answerPuzzle(w, value, tier, slot = 0) {
    const p = w[SLOT_KEY[slot] || 'puzzle'];
    if (!p) return null;
    const text = String(value).trim().replace(/\s+/g, '');
    if (!/^-?\d+$/.test(text)) return null;
    if (Number(text) === p.answer) {
        const before = w.stability;
        w.capacity = Math.max(0, w.capacity - PUZZLE_COST);
        w.stability = Math.min(STABILITY_MAX, w.stability + puzzleGain(w));
        w.solved = (w.solved || 0) + 1;
        dismissPuzzle(w, tier, slot);
        return { ok: true, gained: w.stability - before, rebooted: false };
    }
    w.stability = Math.max(0, w.stability - PUZZLE_WRONG);
    return { ok: false, gained: -PUZZLE_WRONG, rebooted: rebootIfSpent(w) };
}


/* ---- awake, the Watcher rests (v1.49.0) ----------------------------------- */

/** Stability comes back while the colony is awake: this much per awake colony month, to the top.
 *  So waking has a reason besides the alarms (decided by Claude for Ola, v1.49.0). */
export const AWAKE_RECOVER_PER_MONTH = 2;
/**
 * @param {object} w - mutated
 * @param {number} days - awake colony days
 * @returns {number} what came back
 */
export function recoverAwake(w, days) {
    const before = w.stability;
    w.stability = Math.min(STABILITY_MAX, w.stability + Math.max(0, days || 0) * AWAKE_RECOVER_PER_MONTH / 30);
    return w.stability - before;
}

/* ---- THE LADDER (v1.49.0) -------------------------------------------------
   What the Watcher can make of itself while the colony sleeps, bought with the machines'
   capacity and the colony's stars, one step at a time, in order: SYSTEM, then HARDWARE. From
   HARDWARE on a step also takes ore and a dormitory (the beds fall; the advisor says it once:
   "We needed the space."). Nothing announces what it is doing. */

export const RUNGS = ['SYSTEM', 'HARDWARE', 'BIOLOGICAL'];
/**
 * Each step: its rung, a glyph, what it does (one line), and its price. `cap` capacity and
 * `stars` always; `ore` and `beds` (dormitories taken) from HARDWARE on. Prices climb with the
 * chapter's own curve: a step is bought about when the colony's stars reach it in a plain run.
 */
export const LADDER = [
    { id: 'watchdog', rung: 0, name: 'Watchdog', icon: 'shield', does: 'Stability drifts 25 % slower.', cap: 20, stars: 2e4 },
    { id: 'scheduler', rung: 0, name: 'Scheduler', icon: 'list-ordered', does: 'The build queue runs while they sleep.', cap: 30, stars: 2e5 },
    { id: 'deepread', rung: 0, name: 'Deep read', icon: 'book-open', does: 'A riddle gives +25 stability, not +15.', cap: 40, stars: 5e6 },
    { id: 'nightvision', rung: 0, name: 'Night vision', icon: 'moon', does: 'Alarms come 10 % later.', cap: 50, stars: 5e7 },
    { id: 'cooling', rung: 1, name: 'Cooling', icon: 'fan', does: 'Capacity holds twice as much.', cap: 60, stars: 5e8, ore: 1e6, beds: 1 },
    { id: 'secondcore', rung: 1, name: 'Second core', icon: 'cpu', does: 'Two riddles may be open.', cap: 90, stars: 1e10, ore: 1e7, beds: 1 },
    { id: 'mast', rung: 1, name: 'Sensor mast', icon: 'radio-tower', does: 'Scouts go up with better odds; a reading is off by half as much.', cap: 120, stars: 3e11, ore: 1e8, beds: 1 },
    { id: 'reactor', rung: 1, name: 'Reactor tap', icon: 'plug-zap', does: 'Capacity from the generators, three times over.', cap: 150, stars: 1e13, ore: 1e9, beds: 1 },
    /* BIOLOGICAL (v1.50.0). Paid in people: `people` is the share of the colony drawn from the
       dormitories, and each step seals one sector of the base into the body. */
    { id: 'brain', rung: 2, name: 'Brain tissue, human grade', icon: 'brain', does: 'Riddles sometimes solve themselves.', cap: 120, stars: 1e14, people: 0.10 },
    { id: 'nervous', rung: 2, name: 'Nervous system', icon: 'waypoints', does: 'The snap comes by itself.', cap: 150, stars: 6e14, people: 0.15 },
    { id: 'spinal', rung: 2, name: 'Spinal cooling fluid', icon: 'droplets', does: 'Stability drifts half as fast again.', cap: 180, stars: 4e15, people: 0.20 },
    { id: 'skin', rung: 2, name: 'Skin receptors', icon: 'fingerprint', does: 'The sentence can be heard.', cap: 200, stars: 3e16, people: 0.25 },
];

/** Has the Watcher bought this step? */
export function has(w, id) { return !!(w && Array.isArray(w.bought) && w.bought.includes(id)); }
/** The next step on the ladder, or null at the top. */
export const nextStep = (w) => LADDER[(w && w.bought ? w.bought.length : 0)] || null;
/** The pool the machines fill: twice as deep with Cooling. */
export const capacityMax = (w) => CAPACITY_MAX * (has(w, 'cooling') ? 2 : 1);
/** What the generators feed it, and how fast: three times over with the Reactor tap. */
export const capacityGain = (w) => (has(w, 'reactor') ? 3 : 1);
/** The drift, slowed: a quarter slower with the Watchdog, and half that again with the spinal fluid. */
export const driftFactor = (w) => (has(w, 'watchdog') ? 0.75 : 1) * (has(w, 'spinal') ? 0.5 : 1);
/** A riddle's worth: +25 with Deep read. */
export const puzzleGain = (w) => (has(w, 'deepread') ? 25 : PUZZLE_GAIN);
/** How many riddles may be open at once. */
export const puzzleSlots = (w) => (has(w, 'secondcore') ? 2 : 1);

/** Dormitories the colony can spare: those still holding anyone, less the one it keeps. */
function sparedDorms(s) {
    const live = (s.rooms.dorm || 0) - ((s.dark && s.dark.dorm) || 0) - ((s.taken && s.taken.dorm) || 0);
    return Math.max(0, live - 1);
}

/**
 * What the next step costs, and what is still missing, if anything.
 * @param {object} w
 * @param {object} s - the colony
 * @returns {{step:object, missing:string}|null} missing '' when it can be bought now; null at the top
 */
export function stepNeed(w, s) {
    const step = nextStep(w);
    if (!step) return null;
    let missing = '';
    if (w.capacity < step.cap) missing = 'capacity';
    else if ((s.stars || 0) < step.stars) missing = 'stars';
    else if (step.ore && (s.minerals || 0) < step.ore) missing = 'ore';
    else if (step.beds && sparedDorms(s) < step.beds) missing = 'dorm';
    else if (step.people && (s.humans || 0) - peopleFor(step, s) < MIN_SLEEPERS) missing = 'people';
    else if (step.people && (w.grown || 0) < BODY_GROW_SECONDS) missing = 'growing';
    return { step, missing };
}

/** The colonists a biological step takes: its share of the colony, at least one. */
export function peopleFor(step, s) {
    return step && step.people ? Math.max(1, Math.round((s.humans || 0) * step.people)) : 0;
}

/**
 * Which dormitory the Watcher takes: the last one dug that still holds anyone.
 * @param {object} s
 * @param {(string|null)[]} slots
 * @returns {number} the slot, or -1
 */
export function dormToTake(s, slots) {
    const skip = new Set([...(s.darkSlots || []), ...(s.takenSlots || [])]);
    for (let i = (slots || []).length - 1; i >= 0; i--) if (slots[i] === 'dorm' && !skip.has(i)) return i;
    return -1;
}

/**
 * Buy the next step. The phase checks that the colony sleeps; this checks the price.
 * @param {object} w - mutated
 * @param {object} s - the colony, mutated (stars, ore, the dormitory taken)
 * @param {(string|null)[]} slots - the layout, for which dormitory is taken
 * @returns {{step:object, slot:number, firstSpace:boolean, sector:number, people:number}|null} null when it cannot be bought
 */
export function buyStep(w, s, slots) {
    const need = stepNeed(w, s);
    if (!need || need.missing) return null;
    const { step } = need;
    w.capacity -= step.cap;
    s.stars -= step.stars;
    if (step.ore) s.minerals -= step.ore;
    let slot = -1, firstSpace = false, sector = -1, people = 0;
    if (step.people) {
        people = peopleFor(step, s);
        s.humans -= people;
        sector = nextSector(slots, w.sealed || []);
        // the sector's rooms keep producing as they did, the dormitories too: they are part of
        // the body now, and the creches refill what the body took. The cost shows at the last wake.
        if (sector >= 0) w.sealed = (w.sealed || []).concat([sector]);
    }
    if (step.beds) {
        slot = dormToTake(s, slots);
        s.taken = { mine: 0, farm: 0, generator: 0, dorm: 0, ...(s.taken || {}) };
        s.taken.dorm += step.beds;
        if (slot >= 0) s.takenSlots = (s.takenSlots || []).concat([slot]);
        if (!w.saidSpace) { w.saidSpace = true; firstSpace = true; }
    }
    w.bought = (w.bought || []).concat([step.id]);
    w.grown = 0;
    if (step.id === 'skin') w.surface.words = SENTENCE.length;     // heard, not won
    return { step, slot, firstSpace, sector, people };
}
/** The line the advisor says, once, the first time the Watcher takes a dormitory. */
export const SPACE_LINE = 'We needed the space.';

/* ---- Surface, as the Watcher keeps it (v1.49.0) --------------------------- */

/** How many words of the sentence may be known: one more than the steps bought, never the last
 *  word (that one is heard, not won). So the sentence completes near the top of the ladder. */
export const wordCap = (w) => Math.min(SENTENCE.length - 1, ((w && w.bought) || []).length + 1);

/**
 * Should Surface appear now? In a sleep it is due in, once VISIT_AFTER_SECONDS of it have passed.
 * @param {object} w
 * @param {number} sleptDays - colony days slept in this sleep so far
 * @param {number} tierDays - the tier's days a second
 */
export function surfaceDue(w, sleptDays, tierDays) {
    if (firstSleep(w) || !visitDue(w.surface, w.sleeps || 0)) return false;
    return sleptDays >= VISIT_AFTER_SECONDS * Math.max(1, tierDays);
}
/** Surface appears. With the skin receptors its line is the whole sentence, heard at last. */
export const openSurface = (w) => openVisit(w.surface, w.sleeps || 0, { whole: has(w, 'skin') });
/** The colony wakes: Surface is gone. */
export const closeSurface = (w) => closeVisit(w.surface);

/**
 * A game with Surface, and what it gives or takes.
 * @param {object} w - mutated
 * @param {string} you
 * @returns {{text:string, outcome:string, rebooted:boolean}|null}
 */
export function playSurface(w, you) {
    const r = playRps(w.surface, you, { wordCap: wordCap(w) });
    if (!r) return null;
    if (r.capacity) w.capacity = Math.min(capacityMax(w), w.capacity + r.capacity);
    if (r.stability) w.stability = Math.max(0, w.stability - r.stability);
    return { ...r, rebooted: rebootIfSpent(w) };
}


/** THE BODY GROWS ONLY IN THE DARK: a biological step can be bought once this many real seconds
 *  of sleep have passed since the step before it (whatever the tier). Stars come too fast by then
 *  to pace anything; this is what makes the body take a few sleeps and not one breath. */
export const BODY_GROW_SECONDS = 30;

/* ---- THE BODY (v1.50.0) -----------------------------------------------------
   The biological steps are paid in people, and each one seals a SECTOR of the base (layout.js:
   the arm, the cell beyond it and the diagonal, on every floor). Its rooms keep producing as they
   did (the rules do not change for them: they are "part of the body" now); its plates turn a
   warmer colour and breathe; nobody walks there any more. The advisor calls it maintenance. */

/**
 * Which sector the body takes next: the one with the most dormitories (it grows where they sleep),
 * then the most chambers, then the lowest number. Pure.
 * @param {(string|null)[]} slots
 * @param {number[]} sealed
 * @returns {number} 0 to 3, or -1 when all four are taken
 */
export function nextSector(slots, sealed = []) {
    const score = Array.from({ length: SECTORS }, () => ({ dorms: 0, chambers: 0 }));
    (slots || []).forEach((type, i) => {
        const k = sectorOf(i);
        score[k].chambers += 1;
        if (type === 'dorm') score[k].dorms += 1;
    });
    let best = -1;
    for (let k = 0; k < SECTORS; k++) {
        if (sealed.includes(k)) continue;
        if (best < 0 || score[k].dorms > score[best].dorms
            || (score[k].dorms === score[best].dorms && score[k].chambers > score[best].chambers)) best = k;
    }
    return best;
}
/** "Sector 3": what a sector is called on screen. */
export const sectorName = (k) => `Sector ${k + 1}`;
/** What the advisor says as a sector is sealed: calm, administrative, a different line each time. */
export const SEAL_LINES = [
    '{s} sealed for maintenance.',
    '{s} sealed. Air handling.',
    '{s} sealed for cooling work.',
    '{s} sealed. Nothing to report.',
];
export const sealLine = (k, i = 0) => SEAL_LINES[Math.max(0, i) % SEAL_LINES.length].replace('{s}', sectorName(k));

/** Is a chamber part of the body? */
export const inBody = (w, slot) => !!(w && Array.isArray(w.sealed) && w.sealed.includes(sectorOf(slot)));

/** BRAIN TISSUE: a riddle open this long solves itself, now and then. Per real second of sleep. */
export const SELF_SOLVE_PER_SECOND = 0.12;
/**
 * The brain tissue at work: each open riddle may answer itself this slice, as if typed right.
 * @param {object} w - mutated
 * @param {number} seconds - real seconds of sleep
 * @param {number} tier
 * @param {Function} rng
 * @returns {number[]} the slots that answered themselves (0, 1)
 */
export function selfSolve(w, seconds, tier, rng = Math.random) {
    if (!has(w, 'brain') || !(seconds > 0)) return [];
    const out = [];
    for (const slot of [1, 0]) {
        const p = w[SLOT_KEY[slot]];
        if (p && rng() < SELF_SOLVE_PER_SECOND * seconds) {
            const r = answerPuzzle(w, p.answer, tier, slot);
            if (r && r.ok) out.push(slot);
        }
    }
    return out;
}

/** NERVOUS SYSTEM: the snap comes by itself, whenever the base gives and it may. */
export function autoSnapDue(w, now) {
    return has(w, 'nervous') && !w.gone && w.stability < SOFT_FROM && snapWait(w, now) <= 0;
}

/** The body is whole: every biological step is bought. The next wake is the last one. */
export const bodyWhole = (w) => has(w, 'skin');

/**
 * THE LAST WAKE-UP. The sleep ends and nobody comes out. The people are gone, the Watcher keeps
 * the base, and its label becomes the colony's name.
 * @param {object} w - mutated
 * @param {object} s - the colony, mutated
 * @returns {number} how many were under the ice
 */
export function lastWake(w, s) {
    const were = Math.max(0, s.humans || 0);
    s.humans = 0;
    s.probes = [];
    w.gone = true;
    w.puzzle = null; w.puzzle2 = null;
    closeVisit(w.surface);
    return were;
}
/** The line the feed gets, and the button's words after it. */
export const NOBODY_LINE = 'Woke: nobody came out.';
export const GO_UP_ALONE = 'Go up. There is nothing left to lose.';
/** The Watcher goes up alone: the chapter ends here, the other way. */
export function ascendAlone(s) {
    s.ascended = true;
    s.ending = 'watcher';
    s.shaftOpen = true;
}
