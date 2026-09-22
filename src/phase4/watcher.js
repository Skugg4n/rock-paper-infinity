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

import { CRYO, DAYS_PER_YEAR, BAD_ALARMS } from './deep.js';

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
export const DRIFT_PER_SECOND = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2];
const tierOf = (tier) => Math.max(0, Math.min(CRYO.length - 1, tier | 0));
/** Slept years a point of stability lasts at this tier. */
export const driftYears = (tier) => CRYO[tierOf(tier)].days / DAYS_PER_YEAR / DRIFT_PER_SECOND[tierOf(tier)];

/** An alarm is a jolt: a bad one costs more than good news. The hand and the reboot cost nothing. */
export const ALARM_DROP_BAD = 6;
export const ALARM_DROP = 2;
const NO_DROP = ['manual', 'debug', 'reboot'];

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
    };
}

/** Whatever a save held, as a whole Watcher: missing fields filled, numbers kept in range. */
export function normalizeWatcher(w) {
    const out = { ...initialWatcher(), ...(w && typeof w === 'object' ? w : {}) };
    out.stability = clamp(Number.isFinite(out.stability) ? out.stability : STABILITY_MAX, 0, STABILITY_MAX);
    out.capacity = clamp(Number.isFinite(out.capacity) ? out.capacity : 0, 0, CAPACITY_MAX);
    out.sleptYears = Math.max(0, Number.isFinite(out.sleptYears) ? out.sleptYears : 0);
    out.stage = clamp(out.stage | 0, 0, WATCHER_NAMES.length - 1);
    if (out.puzzle && !(Array.isArray(out.puzzle.terms) && Number.isFinite(out.puzzle.answer))) out.puzzle = null;
    return out;
}

/** What the label reads now. */
export const watcherName = (w) => WATCHER_NAMES[clamp((w && w.stage) | 0, 0, WATCHER_NAMES.length - 1)];

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
    w.stability = Math.max(0, w.stability - years / driftYears(tier));
    const cap = CAPACITY_PER_SECOND * d / CRYO[tierOf(tier)].days;
    w.capacity = Math.min(CAPACITY_MAX, w.capacity + Math.min(cap, Math.max(0, spare) * CAPACITY_K));
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
    if (NO_DROP.includes(kind)) return false;
    w.stability = Math.max(0, w.stability - (BAD_ALARMS.includes(kind) ? ALARM_DROP_BAD : ALARM_DROP));
    return rebootIfSpent(w);
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
    if (!asleep || alarmPending || w.puzzle) return false;
    if (w.capacity < PUZZLE_COST) return false;
    return w.nextPuzzleYears != null && w.sleptYears >= w.nextPuzzleYears;
}

/** Put the next riddle on screen. */
export function openPuzzle(w, colony) {
    w.puzzle = makePuzzle(w.seed, colony);
    w.seed += 1;
    return w.puzzle;
}

/** The first sleep sets the clock for the first riddle. */
export function armPuzzles(w, tier) {
    if (w.nextPuzzleYears == null) w.nextPuzzleYears = w.sleptYears + puzzleGapYears(tier);
}

/** Escape: the riddle goes, and the next one is a gap away. */
export function dismissPuzzle(w, tier) {
    w.puzzle = null;
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
export function answerPuzzle(w, value, tier) {
    if (!w.puzzle) return null;
    const text = String(value).trim().replace(/\s+/g, '');
    if (!/^-?\d+$/.test(text)) return null;
    if (Number(text) === w.puzzle.answer) {
        const before = w.stability;
        w.capacity = Math.max(0, w.capacity - PUZZLE_COST);
        w.stability = Math.min(STABILITY_MAX, w.stability + PUZZLE_GAIN);
        w.solved = (w.solved || 0) + 1;
        dismissPuzzle(w, tier);
        return { ok: true, gained: w.stability - before, rebooted: false };
    }
    w.stability = Math.max(0, w.stability - PUZZLE_WRONG);
    return { ok: false, gained: -PUZZLE_WRONG, rebooted: rebootIfSpent(w) };
}
