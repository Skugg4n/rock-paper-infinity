/**
 * Chapter IV · THE DEEP: the Watcher (v1.46.0). The rules of the game inside the sleep.
 *
 * When the colony sleeps, something stays awake: the system that keeps the watch. The player
 * is that system, and nothing says so. It first shows itself as a label, SYSTEM AWAKE, and
 * after enough slept years, once and quietly, as THE WATCHER. Under it a STABILITY meter
 * that drifts down with the years and drops on alarms. Low, the base softens, the feed lines
 * get slightly wrong, and at zero the system reboots and wakes the colony. A click on the
 * base snaps it back. Since v1.51.0 the riddles are gone; now and then the lamps ask for
 * something instead, paid with the machines' spare capacity.
 *
 * Pure: no DOM, no clock of its own. The phase hands it the days slept, the tier, the spare
 * energy and the wall clock; the tests hand it numbers.
 */

import { CRYO, DAYS_PER_YEAR, BAD_ALARMS, MIN_SLEEPERS, bodyTakes } from './deep.js';
import { initialSurface, normalizeSurface, visitDue, openVisit, closeVisit, play as playRps, SENTENCE, VISIT_AFTER_SECONDS, nightGift } from './surface.js';
import { sectorOf, SECTORS } from './layout.js';

export const STABILITY_MAX = 100;
/** What the label reads, in order. It moves on once and never back: deep-voice, on Surface's first
 *  night ("Everyone is sleeping, but us."). Until v1.60 it was after a century of slept years. */
export const WATCHER_NAMES = ['SYSTEM AWAKE', 'THE WATCHER'];

/**
 * THE DRIFT. Stability falls with slept years: one point per `driftYears(tier)` years. The
 * years are scaled by the tier, so a real second of sleep costs about the same at a month a
 * second as at a hundred thousand years a second, a little more the deeper the sleep:
 * DRIFT_PER_SECOND points per real second at each tier.
 *
 * v1.52.0 (the cut: sanity IS the snap): flatter than before (0.5 to 2.2), so that the same
 * attention holds at every tier and an absent Watcher reboots in three to five sleeps of about
 * half a minute wherever it is on the ladder (scripts/sim-phase4.mjs, the two watcher lines).
 */
export const DRIFT_PER_SECOND = [0.9, 1.0, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4];       // the last: Long count (deep-voice)
/**
 * THE FIRST SLEEP TEACHES, IT DOES NOT PUNISH (v1.48.0). The overnight playtest: the first sleep
 * opened on a riddle nobody had been told about, a meter nobody had seen drained, and the first
 * wake a new player got was "Woke: the system rebooted." Now, in the first sleep, the meter does
 * not drift, alarms do not jolt it and no riddle comes; the advisor says one line,
 * WATCHER_HELLO, and the sleep ends on a plain alarm at the latest after FIRST_SLEEP_DAYS.
 * The drift starts with the second sleep, at Cryo I (half a point a second; 0.9 since v1.52.0).
 */
export const WATCHER_HELLO = 'Something stayed awake while they slept.';
export const FIRST_SLEEP_DAYS = DAYS_PER_YEAR;
/** Is this the first sleep the Watcher has kept? */
export const firstSleep = (w) => ((w && w.sleeps) || 0) <= 1;
const tierOf = (tier) => Math.max(0, Math.min(CRYO.length - 1, tier | 0));
/** Slept years a point of stability lasts at this tier. */
export const driftYears = (tier) => CRYO[tierOf(tier)].days / DAYS_PER_YEAR / DRIFT_PER_SECOND[tierOf(tier)];

/** deep-fix: at Cryo I and II (tiers under LOOK_TIERS) a sleep that nothing else ends wakes for a
 *  look after LOOK_EVERY_S real seconds ("Woke: a look at the colony."), so a sleep with no alarm
 *  still has an end (the playtest of v1.66.0 slept three minutes at Cryo I with nothing to wake it).
 *  It costs the meter nothing. index.js and scripts/sim-phase4.mjs keep the clock. */
export const LOOK_EVERY_S = 90;
export const LOOK_TIERS = 2;
/** A visit from Surface whose game is still to be played holds the look back, at most this long. */
export const LOOK_HOLD_S = 30;
/**
 * Is the look due? At Cryo I or II, past the first sleep, LOOK_EVERY_S real seconds into this sleep,
 * nothing else asking (a sector to choose, the lamps), and Surface's game played (or held long enough).
 * @param {object} w - the Watcher
 * @param {number} tier - the colony's cryo tier
 * @param {number} seconds - real seconds of this sleep
 */
export function lookDue(w, tier, seconds) {
    if (!(tier < LOOK_TIERS) || firstSleep(w) || !(seconds >= LOOK_EVERY_S) || w.sealing || w.puzzle) return false;
    const v = w.surface && w.surface.visit;
    return !v || !!v.result || seconds >= LOOK_EVERY_S + LOOK_HOLD_S;
}

/** An alarm is a jolt: a bad one costs more than good news. The hand and the reboot cost nothing. */
export const ALARM_DROP_BAD = 6;
export const ALARM_DROP = 2;
const NO_DROP = ['manual', 'debug', 'reboot', 'first', 'look'];

/** At zero the system reboots: the colony wakes, and the meter comes back at this. */
export const REBOOT_TO = 40;

/**
 * THE SNAP. A click on the base: the structure snaps back, and stability with it, at most once in
 * SNAP_COOLDOWN_MS of real time.
 *
 * v1.52.0: the snap is the whole idle mechanic (the cut), so it is tuned to be enough. A snap gives
 * back SNAP_COVERS seconds of this tier's drift, and more the softer the base has gone: times
 * (1 + SNAP_SOFT_BONUS x the share of the meter that is gone). So it scales with the tier, and the
 * meter finds its own level: a Watcher that snaps every T seconds settles where one snap pays for
 * T seconds of drift. Every 10 s that is about 78, every 12 s 71, every 15 s 60 (the low point,
 * just before the snap; it peaks a snap higher, 93, 89 and 83), at every tier alike. Deep read
 * gives SNAP_DEEP times as much.
 */
export const SNAP_COVERS = 4.5;
export const SNAP_SOFT_BONUS = 6;
export const SNAP_DEEP = 1.5;
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
        puzzle2: null,          // v1.49.0 to v1.50.0: the second riddle; always null since v1.51.0
        lampSleep: null,        // the sleep the last lamp event came in (v1.51.0): one in two sleeps at most
        surface: initialSurface(),
        saidSpace: false,       // "We needed the space.", said once
        sealed: [],             // the sectors the body has taken, 0 to 3, in order (v1.50.0)
        sealing: null,          // a biological step paid for, waiting for the player to choose its sector (v1.52.0)
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
    // v1.52.0: a step waiting for its sector is the next biological step, or nothing
    const due = LADDER[out.bought.length];
    out.sealing = due && due.rung === 2 && had.sealing === due.id && out.sealed.length < SECTORS ? due.id : null;
    out.stability = clamp(Number.isFinite(out.stability) ? out.stability : STABILITY_MAX, 0, STABILITY_MAX);
    out.capacity = clamp(Number.isFinite(out.capacity) ? out.capacity : 0, 0, capacityMax(out));
    out.sleptYears = Math.max(0, Number.isFinite(out.sleptYears) ? out.sleptYears : 0);
    out.stage = clamp(out.stage | 0, 0, WATCHER_NAMES.length - 1);
    // v1.51.0: the lamps, which lamp went out, a number. A sequence riddle from an older save is let go
    // v1.51.0: the riddles are gone; only a lamp event can be open, and only one. A number
    // riddle or a second card from an older save is let go; an event comes back to be shown from
    // the start
    const ints = (a) => Array.isArray(a) && a.length > 0 && a.every(Number.isInteger);
    const okPuzzle = (p) => !!p && ((p.kind === 'lamps' && ints(p.answer) && ints(p.shown) && ints(p.lamps))
        || (p.kind === 'dark' && ints(p.lamps) && Number.isInteger(p.out)));
    out.puzzle = okPuzzle(out.puzzle) ? { ...out.puzzle, ...(out.puzzle.kind === 'lamps' ? { at: 0 } : {}) } : null;
    out.puzzle2 = null;
    if (!Number.isFinite(out.lampSleep)) out.lampSleep = null;
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
 * @param {{days:number, tier:number, spare?:number, hold?:boolean}} slept - days slept, the tier they
 *        were slept at, the spare energy summed over those days (sleep()'s `sum.spare`), and `hold`
 *        (deep-fix): no drift for these days, while the player chooses a sector
 * @returns {{rebooted:boolean, named:boolean}} rebooted: stability hit zero and came back at
 *          REBOOT_TO (the phase wakes the colony); named: always false since deep-voice (the label
 *          changes on Surface's first night, openSurface)
 */
export function watchSleep(w, { days, tier, spare = 0, hold = false }) {
    const d = Math.max(0, days || 0);
    const years = d / DAYS_PER_YEAR;
    w.sleptYears += years;
    // deep-fix: `hold`, while a sector is being chosen, the meter holds (a click there seals, it
    // does not snap: the playtest fell from 51 to 6 and rebooted right after the seal)
    if (!firstSleep(w) && !hold) w.stability = Math.max(0, w.stability - years * driftFactor(w) / driftYears(tier));
    const k = capacityGain(w);
    const cap = k * CAPACITY_PER_SECOND * d / CRYO[tierOf(tier)].days;
    w.grown = (w.grown || 0) + d / CRYO[tierOf(tier)].days;       // the body grows only in the dark
    w.capacity = Math.min(capacityMax(w), w.capacity + Math.min(cap, k * Math.max(0, spare) * CAPACITY_K));
    return { rebooted: rebootIfSpent(w), named: false };
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
 * @param {number} [tier] - the cryo tier the colony sleeps at (the snap scales with its drift)
 * @returns {number} the stability gained: snapGain(w, tier), or 0 inside the cooldown
 */
export function snap(w, now, tier = 0) {
    if (now - (w.lastSnapAt || 0) < SNAP_COOLDOWN_MS && now >= (w.lastSnapAt || 0)) return 0;
    w.lastSnapAt = now;
    const before = w.stability;
    w.stability = Math.min(STABILITY_MAX, w.stability + snapGain(w, tier));
    return w.stability - before;
}

/** How soft the base is, 0 (rigid) to 1 (as soft as it gets), from the stability.
 *  deep-fix: the overnight playtest of v1.66.0 saw the base rigid at 42 and wavering only near 5
 *  (the curve was k^1.2, a third of the way at 42). Now it is felt from the first points under
 *  SOFT_FROM and grows as the meter falls: a fifth of the way at 70, half at 50, four fifths at 20. */
export const SOFT_CURVE = 0.7;
export function softness(stability) {
    const k = clamp((SOFT_FROM - stability) / SOFT_FROM, 0, 1);
    return Math.pow(k, SOFT_CURVE);
}
/** deep-fix: under this the madness reaches the text: the Watcher's letters drift and the year's
 *  digits stutter (index.js). Under GARBLE_BELOW the lines themselves lose or repeat a word. */
export const DRIFT_TEXT_BELOW = 50;
/** How far gone the text is, 0 (at DRIFT_TEXT_BELOW and over) to 1 (at zero). */
export const textMadness = (stability) => clamp((DRIFT_TEXT_BELOW - stability) / DRIFT_TEXT_BELOW, 0, 1);

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

/* ---- THE LAMPS (v1.51.0) ----------------------------------------------------
   Ola, after v1.50.0: "the number-sequence riddles are very hard and a bit boring", and the cut
   (docs/superpowers/specs/2026-09-28-chapter-iv-reduction.md): sanity is the snap; the riddles are
   gone. What is left is an occasional EVENT played on the model itself, at most once in
   LAMP_EVERY_SLEEPS sleeps and never while Surface is there (one demand on screen at a time):
   THE LAMPS: the indicator lamps on the automated rooms blink a sequence, three to seven long
     (longer as stability falls), and the Watcher repeats it by clicking the rooms; a wrong click
     ends it.
   WHICH LAMP WENT OUT: every lamp is lit, one goes dark, and it must be found within DARK_MS.
   Below LIE_BELOW a lamp may blink once without being part of the answer: the madness creeping
   in. Nothing says so. Solved: PUZZLE_COST capacity, puzzleGain() stability and a month of the
   machine's wins (twice both with the Second core). Lost: PUZZLE_WRONG. The state keeps the old
   name, `w.puzzle`, so a save needs no new schema. */

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
/** A seeded stream per event and per use, so the kind and the lamps never share draws. */
const rngFor = (seed, salt) => mulberry32((((seed | 0) * 2654435761) + salt * 40503) >>> 0);

export const PUZZLE_KINDS = ['lamps', 'dark'];
/** Of the lamp events, this share is "which lamp went out". */
export const DARK_SHARE = 0.4;
/** At most one lamp event in this many sleeps. */
export const LAMP_EVERY_SLEEPS = 2;
/** The length of a lamp sequence: three at full stability, seven at none. */
export const LAMPS_MIN = 3;
export const LAMPS_MAX = 7;
export const lampLength = (stability = STABILITY_MAX) =>
    LAMPS_MIN + Math.round((LAMPS_MAX - LAMPS_MIN) * clamp(1 - stability / STABILITY_MAX, 0, 1));
/** Below this a lamp may lie, once a sequence, this often. */
export const LIE_BELOW = GARBLE_BELOW;
export const LIE_CHANCE = 0.5;
/** Which lamp went out: this long to find it (ms of real time). */
export const DARK_MS = 3000;

/**
 * The lamps: the chambers whose room type is automated (the pulse only an automated room has),
 * less the cryo hall and whatever is skipped (a dark chamber, a dormitory the Watcher took).
 * @param {(string|null)[]} slots
 * @param {{auto?:object, skip?:number[]}} [o]
 * @returns {number[]} chamber indices
 */
export function lampSlots(slots, { auto = {}, skip = [] } = {}) {
    const no = new Set(skip);
    const out = [];
    (slots || []).forEach((type, i) => {
        if (type && type !== 'cryo' && (auto[type] || 0) > 0 && !no.has(i)) out.push(i);
    });
    return out;
}
/** Is this an event played on the lamps (every event is, since v1.51.0)? */
export const isLampKind = (p) => !!p && (p.kind === 'lamps' || p.kind === 'dark');
/** Does a click on this chamber count as an answer (it is one of the event's lamps)? */
export const isLamp = (p, slot) => isLampKind(p) && p.lamps.includes(slot);

/** A draw from the list, not `not` when there is anything else. */
function pickFrom(r, list, not) {
    const pool = list.length > 1 ? list.filter((x) => x !== not) : list;
    return pool[Math.floor(r() * pool.length)];
}

/**
 * THE LAMPS. `answer` is what the player must click, in order; `shown` is what blinks, which is
 * the answer with, now and then below LIE_BELOW, one false blink at `lie` (-1: none). No lamp
 * blinks twice in a row in the answer.
 * @param {number} seed
 * @param {number[]} lamps
 * @param {number} [stability]
 * @returns {{kind:'lamps', seed:number, lamps:number[], answer:number[], shown:number[], lie:number, at:number}}
 */
export function makeLampPuzzle(seed, lamps, stability = STABILITY_MAX) {
    const r = rngFor(seed, 11);
    const n = lampLength(stability);
    const answer = [];
    for (let i = 0; i < n; i++) answer.push(pickFrom(r, lamps, answer[i - 1]));
    const shown = answer.slice();
    let lie = -1;
    if (stability < LIE_BELOW && lamps.length > 1 && r() < LIE_CHANCE) {
        lie = Math.floor(r() * (n + 1));
        const around = [answer[lie - 1], answer[lie]];
        const pool = lamps.filter((x) => !around.includes(x));
        const from = pool.length ? pool : lamps.filter((x) => x !== answer[lie - 1]);
        shown.splice(lie, 0, from[Math.floor(r() * from.length)]);
    }
    return { kind: 'lamps', seed, lamps: lamps.slice(), answer, shown, lie, at: 0 };
}

/** WHICH LAMP WENT OUT: every lamp lit, then `out` goes dark. */
export function makeDarkPuzzle(seed, lamps) {
    const r = rngFor(seed, 13);
    return { kind: 'dark', seed, lamps: lamps.slice(), out: lamps[Math.floor(r() * lamps.length)] };
}

/** Which of the two a seed makes. */
export function puzzleKind(seed) {
    return rngFor(seed, 5)() < DARK_SHARE ? 'dark' : 'lamps';
}

/**
 * A lamp event, grown from a seed, the lamps there are and the Watcher's stability.
 * @param {number} seed
 * @param {number[]} lamps - at least two
 * @param {{kind?:string|null, stability?:number}} [o]
 * @returns {object|null} null with fewer than two lamps
 */
export function makePuzzle(seed, lamps = [], { kind = null, stability = STABILITY_MAX } = {}) {
    if (!Array.isArray(lamps) || lamps.length < 2) return null;
    const k = kind || puzzleKind(seed);
    return k === 'dark' ? makeDarkPuzzle(seed, lamps) : makeLampPuzzle(seed, lamps, stability);
}

/** THE SCHEDULER: what is asking for the player now. A sector to seal, Surface, or the lamps, or
 *  nothing; never two. deep-fix: a biological step paid for and waiting for its sector comes first
 *  (the playtest of v1.66.0 had Surface's game on screen while it chose); while it waits neither
 *  Surface nor the lamps may come, and a visit already there is not shown (index.js). */
export function demand(w) {
    if (w && w.sealing) return 'sector';
    if (w && w.surface && w.surface.visit) return 'surface';
    if (w && w.puzzle) return 'lamps';
    return null;
}

/**
 * May a lamp event come now? Asleep, nothing else asking (no Surface, no event open), no alarm
 * pending, not in the first sleep nor within LAMP_EVERY_SLEEPS of the last event, the machines
 * have the capacity for it, and the slept years since the last one are enough.
 * @param {object} w
 * @param {{asleep:boolean, alarmPending?:boolean}} ctx
 */
export function puzzleDue(w, { asleep, alarmPending = false }) {
    if (!asleep || alarmPending || firstSleep(w) || demand(w)) return false;
    if (w.lampSleep != null && (w.sleeps || 0) - w.lampSleep < LAMP_EVERY_SLEEPS) return false;
    if (w.capacity < PUZZLE_COST) return false;
    return w.nextPuzzleYears != null && w.sleptYears >= w.nextPuzzleYears;
}

/**
 * The lamps begin: an event on screen, counted against this sleep.
 * @param {object} w - mutated
 * @param {number[]} lamps
 * @param {number|null} [tier] - with it, the clock for the next one starts now
 * @param {{kind?:string|null}} [o] - force a kind (the debug hooks)
 * @returns {object|null} the event, or null (fewer than two lamps: nothing happens)
 */
export function openPuzzle(w, lamps, tier = null, { kind = null } = {}) {
    const p = makePuzzle(w.seed, lamps, { kind, stability: w.stability });
    if (!p) return null;
    w.puzzle = p;
    w.seed += 1;
    w.lampSleep = w.sleeps || 0;
    if (tier != null) w.nextPuzzleYears = w.sleptYears + puzzleGapYears(tier);
    return p;
}

/** The first sleep sets the clock for the first event. */
export function armPuzzles(w, tier) {
    if (w.nextPuzzleYears == null) w.nextPuzzleYears = w.sleptYears + puzzleGapYears(tier);
}

/**
 * A sleep begins (v1.48.0): counted, and the event clock set so that nothing opens in the first
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

/** Escape: the lamps go quiet, and the next event is a gap away (and still two sleeps away). */
export function dismissPuzzle(w, tier) {
    w.puzzle = null;
    w.nextPuzzleYears = w.sleptYears + puzzleGapYears(tier);
}

/** The event solved: the capacity it costs, the stability it gives. */
export function solvePuzzle(w, tier) {
    const before = w.stability;
    w.capacity = Math.max(0, w.capacity - PUZZLE_COST);
    w.stability = Math.min(STABILITY_MAX, w.stability + puzzleGain(w));
    w.solved = (w.solved || 0) + 1;
    dismissPuzzle(w, tier);
    return { ok: true, gained: w.stability - before, rebooted: false };
}
/** The event lost: a wrong click, or the lamp not found in time. It ends, and it costs. */
function failLamps(w, tier) {
    w.stability = Math.max(0, w.stability - PUZZLE_WRONG);
    dismissPuzzle(w, tier);
    return { ok: false, gained: -PUZZLE_WRONG, rebooted: rebootIfSpent(w) };
}

/**
 * A click on a lamp. The phase only sends clicks that land on one of the event's lamps.
 * THE LAMPS: the right lamp moves the answer on and the last one solves it; a wrong one ends it.
 * WHICH LAMP WENT OUT: the dark one within DARK_MS solves it; anything else ends it.
 * @param {object} w - mutated
 * @param {number} lamp - the chamber clicked
 * @param {number} tier
 * @param {{elapsedMs?:number}} [o] - since the lamp went out
 * @returns {{ok:boolean, done:boolean, gained:number, rebooted:boolean, at?:number}|null}
 */
export function pressLamp(w, lamp, tier, { elapsedMs = 0 } = {}) {
    const p = w.puzzle;
    if (!isLampKind(p)) return null;
    if (p.kind === 'dark') {
        const r = lamp === p.out && elapsedMs <= DARK_MS ? solvePuzzle(w, tier) : failLamps(w, tier);
        return { ...r, done: true };
    }
    if (lamp !== p.answer[p.at]) return { ...failLamps(w, tier), done: true };
    p.at += 1;
    if (p.at >= p.answer.length) return { ...solvePuzzle(w, tier), done: true };
    return { ok: true, done: false, gained: 0, rebooted: false, at: p.at };
}
/** The dark lamp was not found in time: as a wrong click. */
export function expireLamps(w, tier) {
    if (!w.puzzle || w.puzzle.kind !== 'dark') return null;
    return { ...failLamps(w, tier), done: true };
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
    { id: 'watchdog', rung: 0, name: 'Watchdog', icon: 'shield', does: 'Stability falls more slowly while they sleep.', short: 'stability drifts slower', cap: 20, stars: 2e4 },
    { id: 'scheduler', rung: 0, name: 'Scheduler', icon: 'list-ordered', does: 'The build queue keeps going while they sleep.', short: 'the queue runs while they sleep', cap: 30, stars: 2e5 },
    { id: 'deepread', rung: 0, name: 'Deep read', icon: 'book-open', does: 'Each click on the sleeping colony steadies it more.', short: 'a snap holds more', cap: 40, stars: 5e6 },
    { id: 'nightvision', rung: 0, name: 'Night vision', icon: 'moon', does: 'The alarms let them sleep a little longer.', short: 'alarms come later', cap: 50, stars: 5e7 },
    { id: 'cooling', rung: 1, name: 'Cooling', icon: 'fan', does: 'The Watcher can hold twice the capacity.', short: 'capacity holds twice as much', cap: 60, stars: 5e8, ore: 1e6, beds: 1 },
    { id: 'secondcore', rung: 1, name: 'Second core', icon: 'cpu', does: 'The lamps steady it twice as much.', short: 'the lamps give double', cap: 90, stars: 1e10, ore: 1e7, beds: 1 },
    { id: 'mast', rung: 1, name: 'Sensor mast', icon: 'radio-tower', does: 'Scouts read the sky better, and more of them come back.', short: 'scouts read the sky better', cap: 120, stars: 3e11, ore: 1e8, beds: 1 },
    { id: 'reactor', rung: 1, name: 'Reactor tap', icon: 'plug-zap', does: 'The generators fill capacity three times as fast.', short: 'three times the capacity', cap: 150, stars: 1e13, ore: 1e9, beds: 1 },
    /* BIOLOGICAL (v1.50.0). Paid in people: `people` is the share of the colony drawn from the
       dormitories, and each step seals one sector of the base into the body. */
    { id: 'brain', rung: 2, name: 'Brain tissue, human grade', icon: 'brain', does: 'The lamps sometimes answer themselves.', short: 'the lamps answer themselves', cap: 120, stars: 1e14, people: 0.10 },
    { id: 'nervous', rung: 2, name: 'Nervous system', icon: 'waypoints', does: 'The sleeping colony steadies itself now and then.', short: 'the snap comes by itself', cap: 150, stars: 6e14, people: 0.15 },
    { id: 'spinal', rung: 2, name: 'Spinal cooling fluid', icon: 'droplets', does: 'Stability falls more slowly still.', short: 'stability drifts half as fast', cap: 180, stars: 4e15, people: 0.20 },
    { id: 'skin', rung: 2, name: 'Skin receptors', icon: 'fingerprint', does: 'The sentence can be heard.', short: 'the sentence can be heard', cap: 200, stars: 3e16, people: 0.25 },
];

/* THE LADDER YOU CAN SEE (v1.51.0). Ola could not find BIOLOGICAL: twelve round buttons in one
   place read as one button. Now the whole road is one thin line with a tick at each rung and a
   filled trail, and under it ONE pill with the next step only: its rung, its name, what it takes
   and what it does. The rung after the one being climbed is named on the line as a teaser; the one
   past that is a tick with no name until it comes near. The advisor says one line when a rung opens. */
/** The advisor's line the moment a rung opens (indexed by the rung that opens). */
export const RUNG_OPEN_LINES = ['', 'The system is in. There is room for hardware now.', 'The hardware is in. Something else is possible now.'];
/** The line to say when this step was the last of its rung, or ''. */
export function rungOpenLine(stepId) {
    const i = LADDER.findIndex((u) => u.id === stepId);
    const next = LADDER[i + 1];
    if (i < 0 || !next || next.rung === LADDER[i].rung) return '';
    return RUNG_OPEN_LINES[next.rung] || '';
}
/**
 * The line over the pill: the trail (0 to 1, a share of the whole ladder) and a tick per rung,
 * each 'done', 'open' (being climbed), 'tease' (the next: its name readable) or 'far' (no name).
 * @param {object} w
 * @returns {{trail:number, top:boolean, rung:number, ticks:{name:string, at:number, state:string}[]}}
 */
export function ladderLine(w) {
    const n = Math.min(LADDER.length, ((w && w.bought) || []).length);
    const top = n >= LADDER.length;
    const rung = top ? RUNGS.length : LADDER[n].rung;
    const ticks = RUNGS.map((name, r) => {
        const at = LADDER.findIndex((u) => u.rung === r) / LADDER.length;
        const state = r < rung ? 'done' : r === rung ? 'open' : r === rung + 1 ? 'tease' : 'far';
        return { name, at, state };
    });
    return { trail: n / LADDER.length, top, rung, ticks };
}

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
/**
 * A snap's worth (v1.52.0): SNAP_COVERS seconds of the tier's drift, more the softer the base, and
 * half as much again with Deep read (v1.51.0 made it +10 for +5; before that it was a riddle's +25).
 * @param {object} w
 * @param {number} [tier]
 */
export function snapGain(w, tier = 0) {
    const gone = 1 - clamp((w && Number.isFinite(w.stability)) ? w.stability : STABILITY_MAX, 0, STABILITY_MAX) / STABILITY_MAX;
    return DRIFT_PER_SECOND[tierOf(tier)] * SNAP_COVERS * (1 + SNAP_SOFT_BONUS * gone) * (has(w, 'deepread') ? SNAP_DEEP : 1);
}
/** What a lamp event gives, times this: twice with the Second core (v1.51.0; it opened a second
 *  riddle card before). The stability and the machine's wins alike. */
export const lampFactor = (w) => (has(w, 'secondcore') ? 2 : 1);
/** A lamp event's worth in stability. */
export const puzzleGain = (w) => PUZZLE_GAIN * lampFactor(w);

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
    // v1.52.0: paid for, and waiting for the player to choose the sector it takes
    if (w.sealing && w.sealing === step.id) return { step, missing: 'sector' };
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
 *
 * A BIOLOGICAL step (v1.52.0) is a choice: with `choose`, the capacity and the stars are paid and
 * the step waits in `w.sealing` until the player picks the sector it takes (`sealSector`); the
 * people go then. Without it (the simulation, the older tests) the body takes `nextSector()` at once.
 * @param {object} w - mutated
 * @param {object} s - the colony, mutated (stars, ore, the dormitory taken)
 * @param {(string|null)[]} slots - the layout, for which dormitory is taken
 * @param {{choose?:boolean}} [o]
 * @returns {{step:object, slot:number, firstSpace:boolean, sector:number, people:number, pending?:boolean}|null} null when it cannot be bought
 */
export function buyStep(w, s, slots, { choose = false } = {}) {
    const need = stepNeed(w, s);
    if (!need || need.missing) return null;
    const { step } = need;
    w.capacity -= step.cap;
    s.stars -= step.stars;
    if (step.ore) s.minerals -= step.ore;
    const sector = -1, people = 0;
    let slot = -1, firstSpace = false;
    if (step.people) {
        w.sealing = step.id;
        if (choose) return { step, slot, firstSpace, sector, people, pending: true };
        const out = sealSector(w, s, slots, nextSector(slots, w.sealed || []));
        return out ? { ...out, slot, firstSpace } : { step, slot, firstSpace, sector, people };
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
    return { step, slot, firstSpace, sector, people };
}
/** The line the advisor says, once, the first time the Watcher takes a dormitory. */
export const SPACE_LINE = 'We needed the space.';

/* ---- THE CHOICE (v1.52.0) ---------------------------------------------------------------
   The cut, item 4: "BIOLOGICAL has no picture and no choice." Now a biological step, once paid
   for, asks for a sector; the arms of the base that can still be taken light up; the player
   clicks one and THAT sector seals, and the people go. Escape puts the choice away without a
   refund: the step waits, and the pill keeps asking. */

/**
 * The sectors the body may take now: the unsealed ones that hold a chamber (a sector with no
 * chamber dug in it has no plate to click), or every unsealed one when none does.
 * @param {object} w
 * @param {(string|null)[]} slots
 * @returns {number[]} 0 to 3, in order
 */
export function sealCandidates(w, slots) {
    const sealed = new Set((w && w.sealed) || []);
    const open = [];
    for (let k = 0; k < SECTORS; k++) if (!sealed.has(k)) open.push(k);
    const dug = new Set((slots || []).map((_, i) => sectorOf(i)));
    const held = open.filter((k) => dug.has(k));
    return held.length ? held : open;
}
/** Is a step paid for and waiting for its sector? */
export const choosingSector = (w) => !!(w && w.sealing);

/**
 * The player chose: the waiting biological step takes this sector and its people.
 * @param {object} w - mutated
 * @param {object} s - the colony, mutated (humans)
 * @param {(string|null)[]} slots
 * @param {number} sector - 0 to 3, one of sealCandidates()
 * @returns {{step:object, sector:number, people:number}|null} null when nothing waits or the sector cannot be taken
 */
export function sealSector(w, s, slots, sector) {
    const step = nextStep(w);
    if (!step || !step.people || w.sealing !== step.id) return null;
    if (!sealCandidates(w, slots).includes(sector)) return null;
    // its share of the colony as it is now; some always stay under the ice
    const people = Math.max(0, Math.min(peopleFor(step, s), Math.floor((s.humans || 0) - MIN_SLEEPERS)));
    s.humans -= people;
    // the sector's rooms keep producing as they did: they are part of the body now. deep-fix: the
    // people taken take their beds with them (deep.js bodyTakes), so the creches cannot grow them
    // back in the next second, and the colony mourns them
    bodyTakes(s, people);
    w.sealed = (w.sealed || []).concat([sector]);
    w.sealing = null;
    w.bought = (w.bought || []).concat([step.id]);
    w.grown = 0;
    if (step.id === 'skin') w.surface.words = SENTENCE.length;     // heard, not won
    return { step, sector, people };
}

/**
 * THE WATCHER'S SHAPE (v1.52.0): the glyph grows with the body, one shape per biological step
 * taken: a dot, a dot with a ring, a soft blob, a blob with a rim. Before the body it is the
 * pulse it always was ('').
 */
export const BODY_GLYPHS = ['', 'dot', 'ring', 'blob', 'rim'];
export function bodyGlyph(w) {
    const n = ((w && w.bought) || []).filter((id) => LADDER.some((u) => u.id === id && u.rung === 2)).length;
    return BODY_GLYPHS[Math.min(BODY_GLYPHS.length - 1, n)];
}

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
    // one demand at a time (v1.51.0): Surface waits while the lamps are asking
    if (firstSleep(w) || demand(w) || !visitDue(w.surface, w.sleeps || 0)) return false;
    return sleptDays >= VISIT_AFTER_SECONDS * Math.max(1, tierDays);
}
/**
 * Surface appears. With the skin receptors its line is the whole sentence, heard at last. When the
 * visit is a NIGHT (surface.js NIGHTS), the first one names the Watcher, and nights 2 to 6 open
 * their gift in the colony's tree (`s.tree.opened`) and mark the tree button (`s.tree.unseen`).
 * @param {object} w - mutated
 * @param {object|null} [s] - the colony (its cryo tier paces the nights; its tree takes the gift)
 * @param {{force?:boolean}} [o] - force: the next line now (the debug hook)
 * @returns {object} the visit
 */
export function openSurface(w, s = null, { force = false } = {}) {
    const v = openVisit(w.surface, w.sleeps || 0, { whole: has(w, 'skin'), tier: s ? s.cryo ?? -1 : -1, force });
    if (v.night === 1 && (w.stage | 0) === 0) w.stage = 1;
    const g = v.night ? nightGift(v.night) : null;
    if (g && s) openGift(s, g);
    return v;
}
/** Surface has opened a node of the tree: it is buyable from now on (tree.js), and the tree
 *  button carries a mark until the tree is next opened. */
export function openGift(s, id) {
    s.tree = s.tree && typeof s.tree === 'object' ? s.tree : {};
    s.tree.opened = Array.isArray(s.tree.opened) ? s.tree.opened : [];
    s.tree.bought = Array.isArray(s.tree.bought) ? s.tree.bought : [];
    if (!s.tree.opened.includes(id)) s.tree.opened.push(id);
    s.tree.unseen = true;
}
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

/** BRAIN TISSUE: a lamp event answers itself now and then (it was a riddle before v1.51.0). Per
 *  real second of sleep. */
export const SELF_SOLVE_PER_SECOND = 0.12;
/**
 * The brain tissue at work: the open lamp event may answer itself this slice, as if played right.
 * @param {object} w - mutated
 * @param {number} seconds - real seconds of sleep
 * @param {number} tier
 * @param {Function} rng
 * @returns {number[]} [0] when it answered itself, [] when not
 */
export function selfSolve(w, seconds, tier, rng = Math.random) {
    if (!has(w, 'brain') || !(seconds > 0)) return [];
    const out = [];
    if (w.puzzle && rng() < SELF_SOLVE_PER_SECOND * seconds) {
        solvePuzzle(w, tier);
        out.push(0);
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
    w.puzzle = null;
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
