/* eslint-env jest */
/*
 * v1.46.0: the Watcher. The drift, the steps on alarms, the reboot, the snap, capacity from
 * the machines, the riddles, the feed going slightly wrong, the pause, and the save.
 */
import {
    initialWatcher, normalizeWatcher, watcherName, watchSleep, alarmHit, snap, softness,
    shouldGarble, garble, watcherLines, makePuzzle, puzzleText, puzzleDue, openPuzzle, armPuzzles,
    dismissPuzzle, answerPuzzle, sleepDays, driftYears, puzzleGapYears, puzzleStars,
    STABILITY_MAX, NAME_AT_YEARS, DRIFT_PER_SECOND, ALARM_DROP, ALARM_DROP_BAD, REBOOT_TO,
    SNAP_GAIN, SNAP_COOLDOWN_MS, CAPACITY_K, CAPACITY_MAX, CAPACITY_PER_SECOND, PUZZLE_COST, PUZZLE_GAIN, PUZZLE_WRONG,
    GARBLE_BELOW, GARBLE_EVERY, WATCHER_NAMES, PUZZLE_STARS_MIN,
    beginSleep, firstSleep, snapWait, FIRST_SLEEP_DAYS, WATCHER_HELLO,
} from './watcher.js';
import { CRYO, DAYS_PER_YEAR, initialDeepState, sleep, tickDay } from './deep.js';
import { deserializeDeep, serializeDeep, SCHEMA_VERSION } from './persistence.js';

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('the drift', () => {
    test('a real second of sleep costs DRIFT_PER_SECOND at every tier, whatever the years', () => {
        CRYO.forEach((c, tier) => {
            const w = { ...initialWatcher(), sleeps: 2 };      // past the first sleep, which does not drift
            watchSleep(w, { days: c.days, tier });
            expect(STABILITY_MAX - w.stability).toBeCloseTo(DRIFT_PER_SECOND[tier], 9);
            expect(w.sleptYears).toBeCloseTo(c.days / DAYS_PER_YEAR, 9);
        });
        // the deeper the sleep, a little more per second, never less
        for (let t = 1; t < DRIFT_PER_SECOND.length; t++) expect(DRIFT_PER_SECOND[t]).toBeGreaterThanOrEqual(DRIFT_PER_SECOND[t - 1]);
        // and a point lasts that many slept years
        expect(driftYears(1)).toBeCloseTo(1 / DRIFT_PER_SECOND[1], 9);
    });

    test('never below zero: at zero the system reboots to REBOOT_TO, once', () => {
        const w = { ...initialWatcher(), sleeps: 2 };
        w.stability = 1;
        const out = watchSleep(w, { days: CRYO[0].days * 10, tier: 0 });
        expect(out.rebooted).toBe(true);
        expect(w.stability).toBe(REBOOT_TO);
        expect(w.reboots).toBe(1);
        expect(watchSleep(w, { days: 1, tier: 0 }).rebooted).toBe(false);
    });

    test('the label changes once, quietly, at NAME_AT_YEARS slept years', () => {
        const w = initialWatcher();
        expect(watcherName(w)).toBe('SYSTEM AWAKE');
        expect(watchSleep(w, { days: (NAME_AT_YEARS - 1) * DAYS_PER_YEAR, tier: 6 }).named).toBe(false);
        expect(watcherName(w)).toBe(WATCHER_NAMES[0]);
        expect(watchSleep(w, { days: 2 * DAYS_PER_YEAR, tier: 6 }).named).toBe(true);
        expect(watcherName(w)).toBe('THE WATCHER');
        expect(watchSleep(w, { days: 1e6, tier: 6 }).named).toBe(false);
        expect(w.stage).toBe(1);
    });

    test('alarms are steps down: a bad one more than good news, the hand nothing', () => {
        const w = { ...initialWatcher(), sleeps: 2 };
        alarmHit(w, 'food');
        expect(w.stability).toBe(STABILITY_MAX - ALARM_DROP_BAD);
        alarmHit(w, 'scouts');
        expect(w.stability).toBe(STABILITY_MAX - ALARM_DROP_BAD - ALARM_DROP);
        alarmHit(w, 'manual'); alarmHit(w, 'reboot'); alarmHit(w, 'debug');
        expect(w.stability).toBe(STABILITY_MAX - ALARM_DROP_BAD - ALARM_DROP);
        w.stability = 1;
        expect(alarmHit(w, 'stall')).toBe(true);
        expect(w.stability).toBe(REBOOT_TO);
    });
});

describe('the first sleep teaches, it does not punish (v1.48.0)', () => {
    test('no drift, no jolt, no riddle in the first sleep; the second drifts, gently at Cryo I', () => {
        const w = initialWatcher();
        w.capacity = CAPACITY_MAX;
        expect(beginSleep(w, 0)).toBe(true);               // the first sleep
        expect(firstSleep(w)).toBe(true);
        watchSleep(w, { days: CRYO[0].days * 600, tier: 0 });   // ten real minutes of it
        expect(w.stability).toBe(STABILITY_MAX);
        expect(alarmHit(w, 'food')).toBe(false);
        expect(w.stability).toBe(STABILITY_MAX);
        w.sleptYears = 1e6;
        expect(puzzleDue(w, { asleep: true })).toBe(false);
        expect(beginSleep(w, 0)).toBe(false);              // the second
        watchSleep(w, { days: CRYO[0].days, tier: 0 });
        expect(STABILITY_MAX - w.stability).toBeCloseTo(DRIFT_PER_SECOND[0], 9);
        expect(DRIFT_PER_SECOND[0]).toBeLessThan(1);       // gently
        expect(alarmHit(w, 'food')).toBe(false);
        expect(w.stability).toBeLessThan(STABILITY_MAX - ALARM_DROP_BAD);
    });

    test('a sleep never opens on a riddle: half a gap at least from its start', () => {
        const w = { ...initialWatcher(), sleeps: 3, capacity: CAPACITY_MAX, sleptYears: 500, nextPuzzleYears: 10 };
        beginSleep(w, 2);
        expect(w.nextPuzzleYears).toBeCloseTo(500 + puzzleGapYears(2) / 2, 9);
        expect(puzzleDue(w, { asleep: true })).toBe(false);
    });

    test('the first wake is never a reboot, however low the meter was left', () => {
        const w = { ...initialWatcher(), stability: 1 };
        beginSleep(w, 3);
        expect(watchSleep(w, { days: CRYO[3].days * 100, tier: 3 }).rebooted).toBe(false);
        expect(alarmHit(w, 'stall')).toBe(false);
        expect(w.reboots).toBe(0);
        expect(FIRST_SLEEP_DAYS).toBe(DAYS_PER_YEAR);
        expect(WATCHER_HELLO).toBe('Something stayed awake while they slept.');
    });

    test('an old save that already kept a watch is past its first sleep', () => {
        expect(normalizeWatcher({ sleptYears: 40 }).sleeps).toBe(2);
        expect(normalizeWatcher({}).sleeps).toBe(0);
        expect(normalizeWatcher({ sleeps: 1, sleptYears: 40 }).sleeps).toBe(1);
    });
});

describe('the snap', () => {
    test('the cooldown can be read: how long until the base answers again', () => {
        const w = initialWatcher();
        expect(snapWait(w, 1e6)).toBe(0);
        snap(w, 1e6);
        expect(snapWait(w, 1e6 + 1000)).toBe(SNAP_COOLDOWN_MS - 1000);
        expect(snapWait(w, 1e6 + SNAP_COOLDOWN_MS)).toBe(0);
        expect(snapWait(w, 1e6 - 5)).toBe(0);              // a clock that went backwards owes nothing
    });

    test('+SNAP_GAIN, at most once per cooldown of real time, capped at the top', () => {
        const w = initialWatcher();
        w.stability = 50;
        expect(snap(w, 100000)).toBe(SNAP_GAIN);
        expect(snap(w, 100000 + SNAP_COOLDOWN_MS - 1)).toBe(0);
        expect(w.stability).toBe(50 + SNAP_GAIN);
        expect(snap(w, 100000 + SNAP_COOLDOWN_MS)).toBe(SNAP_GAIN);
        w.stability = STABILITY_MAX - 1;
        expect(snap(w, 200000)).toBe(1);
        expect(w.stability).toBe(STABILITY_MAX);
    });
    test('a wall clock that went backwards (another machine) does not lock the snap out', () => {
        const w = initialWatcher();
        w.lastSnapAt = 9e12;
        w.stability = 50;
        expect(snap(w, 1000)).toBe(SNAP_GAIN);
    });
    test('the base is rigid near the top and softest at zero', () => {
        expect(softness(100)).toBe(0);
        expect(softness(80)).toBe(0);
        expect(softness(0)).toBe(1);
        expect(softness(55)).toBeGreaterThan(0);
        expect(softness(20)).toBeGreaterThan(softness(55));
    });
});

describe('capacity from the machines', () => {
    test('per slept day: spare energy times k, at most CAPACITY_PER_SECOND a real second, into a capped pool', () => {
        const w = initialWatcher();
        watchSleep(w, { days: 30, tier: 0, spare: 30 * 100 });
        expect(w.capacity).toBeCloseTo(30 * 100 * CAPACITY_K, 9);
        // a rich colony fills it at the cap, at any tier: one real second is CAPACITY_PER_SECOND
        const rich = initialWatcher();
        watchSleep(rich, { days: CRYO[5].days, tier: 5, spare: 1e15 });
        expect(rich.capacity).toBeCloseTo(CAPACITY_PER_SECOND, 9);
        for (let i = 0; i < 100; i++) watchSleep(rich, { days: CRYO[5].days, tier: 5, spare: 1e15 });
        expect(rich.capacity).toBe(CAPACITY_MAX);
        const none = initialWatcher();
        watchSleep(none, { days: 3000, tier: 0, spare: 0 });
        expect(none.capacity).toBe(0);
    });
    test('sleep() sums the spare energy it slept through, fast forward included', () => {
        const s = initialDeepState();
        Object.assign(s, {
            minerals: 1e6, food: 1e6, humans: 20, chambers: 9, cryo: 0,
            rooms: { mine: 3, farm: 2, generator: 3, dorm: 1, cryo: 1 },
            auto: { mine: 1, farm: 1, generator: 1, dorm: 0 }, level: { mine: 1, farm: 1, generator: 1, dorm: 0 },
        });
        const day = tickDay(JSON.parse(JSON.stringify(s)), true);
        const sum = sleep(s, 400);
        expect(sum.spare).toBeGreaterThan(0);
        expect(sum.spare).toBeCloseTo(day.energySpare * sum.days, -1);
    });
    test('more generators, more capacity: the Watcher is fed by the M F E H game', () => {
        const base = initialDeepState();
        Object.assign(base, {
            minerals: 1e6, food: 1e6, humans: 20, chambers: 12, cryo: 0,
            rooms: { mine: 3, farm: 2, generator: 2, dorm: 1, cryo: 1 },
            auto: { mine: 1, farm: 1, generator: 1, dorm: 0 }, level: { mine: 1, farm: 1, generator: 1, dorm: 0 },
        });
        const more = JSON.parse(JSON.stringify(base));
        more.rooms.generator = 4;
        const a = sleep(base, 30), b = sleep(more, 30);
        expect(b.spare).toBeGreaterThan(a.spare);
    });
});

describe('riddles', () => {
    test('a seeded sequence and its next term: the same seed is the same riddle', () => {
        for (let seed = 1; seed < 60; seed++) {
            const p = makePuzzle(seed, { chambers: 12 });
            expect(p.terms).toHaveLength(5);
            expect(Number.isInteger(p.answer)).toBe(true);
            expect(p.terms.every(Number.isInteger)).toBe(true);
            expect(makePuzzle(seed, { chambers: 12 })).toEqual(p);
            expect(puzzleText(p)).toMatch(/^\d+(, \d+){4}, \?$/);
        }
        // the answers follow their rules
        const byRule = {};
        for (let seed = 1; seed < 200; seed++) { const p = makePuzzle(seed, { chambers: 7 }); byRule[p.rule] = p; }
        expect(Object.keys(byRule).sort()).toEqual(['add', 'double-plus', 'fib', 'growing', 'squares', 'times']);
        const f = byRule.fib;
        expect(f.answer).toBe(f.terms[3] + f.terms[4]);
        const q = byRule.squares;
        expect(Math.sqrt(q.answer)).toBe(Math.sqrt(q.terms[4]) + 1);
    });

    test('a riddle comes asleep, with the capacity for it, a gap of slept years apart, never over an alarm', () => {
        const w = { ...initialWatcher(), sleeps: 2 };
        w.capacity = CAPACITY_MAX;
        expect(puzzleDue(w, { asleep: true })).toBe(false);          // the clock is not armed yet
        armPuzzles(w, 0);
        expect(w.nextPuzzleYears).toBeCloseTo(puzzleGapYears(0), 9);
        expect(puzzleDue(w, { asleep: true })).toBe(false);
        w.sleptYears = w.nextPuzzleYears;
        expect(puzzleDue(w, { asleep: true })).toBe(true);
        expect(puzzleDue(w, { asleep: false })).toBe(false);
        expect(puzzleDue(w, { asleep: true, alarmPending: true })).toBe(false);
        w.capacity = PUZZLE_COST - 1;
        expect(puzzleDue(w, { asleep: true })).toBe(false);
        w.capacity = CAPACITY_MAX;
        openPuzzle(w, { chambers: 5 });
        expect(puzzleDue(w, { asleep: true })).toBe(false);          // one at a time
        // escape: gone, and the next is a gap away
        dismissPuzzle(w, 2);
        expect(w.puzzle).toBe(null);
        expect(w.nextPuzzleYears - w.sleptYears).toBeCloseTo(puzzleGapYears(2), 9);
        // the gap is the same stretch of real sleep at every tier
        expect(puzzleGapYears(3) / puzzleGapYears(0)).toBeCloseTo(CRYO[3].days / CRYO[0].days, 9);
    });

    test('right: costs capacity, +PUZZLE_GAIN. Wrong: -PUZZLE_WRONG and it stays. Not a number: nothing', () => {
        const w = initialWatcher();
        w.capacity = CAPACITY_MAX; w.stability = 40;
        openPuzzle(w, { chambers: 5 });
        const answer = w.puzzle.answer;
        expect(answerPuzzle(w, 'abc', 0)).toBe(null);
        expect(w.stability).toBe(40);
        const wrong = answerPuzzle(w, String(answer + 1), 0);
        expect(wrong.ok).toBe(false);
        expect(w.stability).toBe(40 - PUZZLE_WRONG);
        expect(w.puzzle).not.toBe(null);
        expect(w.capacity).toBe(CAPACITY_MAX);
        const right = answerPuzzle(w, ` ${answer} `, 0);
        expect(right.ok).toBe(true);
        expect(right.gained).toBe(PUZZLE_GAIN);
        expect(w.stability).toBe(40 - PUZZLE_WRONG + PUZZLE_GAIN);
        expect(w.capacity).toBe(CAPACITY_MAX - PUZZLE_COST);
        expect(w.puzzle).toBe(null);
        expect(w.solved).toBe(1);
        expect(answerPuzzle(w, '1', 0)).toBe(null);
    });

    test('a wrong answer that takes the last of it reboots the system', () => {
        const w = initialWatcher();
        w.capacity = CAPACITY_MAX; w.stability = PUZZLE_WRONG;
        openPuzzle(w, {});
        const out = answerPuzzle(w, String(w.puzzle.answer + 1), 0);
        expect(out.rebooted).toBe(true);
        expect(w.stability).toBe(REBOOT_TO);
    });

    test('a solved riddle pays a month of the machine, never less than a hundred', () => {
        expect(puzzleStars(0)).toBe(PUZZLE_STARS_MIN);
        expect(puzzleStars(1000)).toBe(30000);
    });
});

describe('the feed goes slightly wrong', () => {
    test('never above GARBLE_BELOW', () => {
        const w = initialWatcher();
        w.stability = GARBLE_BELOW;
        for (let i = 0; i < 50; i++) expect(shouldGarble(w, () => 0)).toBe(false);
    });
    test('below it, at most one line in GARBLE_EVERY', () => {
        const w = initialWatcher();
        w.stability = 1;
        const out = [];
        for (let i = 0; i < 40; i++) out.push(shouldGarble(w, () => 0));
        const hits = out.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
        expect(hits.length).toBeGreaterThan(0);
        for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(GARBLE_EVERY);
    });
    test('a word left out or said twice, never the first, never a short line', () => {
        const line = 'Woke: food will run out in 21 days.';
        const dropped = garble(line, seq([0.3, 0.1]));
        const doubled = garble(line, seq([0.3, 0.9]));
        expect(dropped.split(' ').length).toBe(line.split(' ').length - 1);
        expect(doubled.split(' ').length).toBe(line.split(' ').length + 1);
        expect(dropped.startsWith('Woke:')).toBe(true);
        expect(doubled.startsWith('Woke:')).toBe(true);
        expect(doubled).toMatch(/(\b\w+\b) \1/);
        expect(garble('Woke: hi.', () => 0.5)).toBe('Woke: hi.');
        // the feed helper leaves a steady Watcher's lines alone
        const w = initialWatcher();
        expect(watcherLines(w, [line, line], () => 0)).toEqual([line, line]);
    });
});

describe('the pause', () => {
    test('a paused slice sleeps no days, so the Watcher does not drift', () => {
        expect(sleepDays(0.1, 365, false)).toBeCloseTo(36.5, 9);
        expect(sleepDays(0.1, 365, true)).toBe(0);
        const w = initialWatcher();
        watchSleep(w, { days: sleepDays(0.1, CRYO[3].days, true), tier: 3, spare: 0 });
        expect(w.stability).toBe(STABILITY_MAX);
        expect(w.sleptYears).toBe(0);
    });
});

describe('the save', () => {
    test('a v2 save gets a fresh Watcher, and a v3 save keeps its own', () => {
        const old = initialDeepState();
        old.day = 5000; old.cryo = 2;
        delete old.watcher;
        const back = deserializeDeep(JSON.stringify({ schemaVersion: 2, state: old, layout: { slots: ['farm', 'generator', 'dorm'] } }));
        expect(back.state.watcher).toEqual(initialWatcher());
        expect(back.state.day).toBe(5000);
        const w = { ...initialWatcher(), stage: 1, stability: 55, capacity: 100, sleptYears: 1234, seed: 9, puzzle: makePuzzle(8, {}) };
        back.state.watcher = w;
        const raw = serializeDeep(back.state, back.layout);
        expect(JSON.parse(raw).schemaVersion).toBe(SCHEMA_VERSION);
        expect(SCHEMA_VERSION).toBe(3);
        expect(deserializeDeep(raw).state.watcher).toEqual(w);
    });
    test('a broken Watcher in a save is mended, not thrown away', () => {
        const w = normalizeWatcher({ stability: 500, capacity: -3, stage: 9, puzzle: { terms: 'x' } });
        expect(w.stability).toBe(STABILITY_MAX);
        expect(w.capacity).toBe(0);
        expect(w.stage).toBe(1);
        expect(w.puzzle).toBe(null);
    });
});
