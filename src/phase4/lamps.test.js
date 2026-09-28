/* eslint-env jest */
/*
 * v1.51.0 (slice 8, with the cut from docs/superpowers/specs/2026-09-28-chapter-iv-reduction.md):
 * the lamps replace the riddles, one demand on screen at a time, the ladder you can see, and an
 * order in the strip that can be taken back.
 */
import {
    initialWatcher, normalizeWatcher, lampSlots, makeLampPuzzle, makeDarkPuzzle, makePuzzle, puzzleKind,
    lampLength, openPuzzle, puzzleDue, pressLamp, expireLamps, isLamp, demand, surfaceDue, openSurface,
    ladderLine, rungOpenLine, RUNG_OPEN_LINES, LADDER, RUNGS, selfSolve,
    LAMPS_MIN, LAMPS_MAX, LIE_BELOW, DARK_MS, DARK_SHARE, LAMP_EVERY_SLEEPS, PUZZLE_COST, PUZZLE_GAIN,
    PUZZLE_WRONG, CAPACITY_MAX, REBOOT_TO, STABILITY_MAX, puzzleGapYears,
} from './watcher.js';
import {
    initialDeepState, orderBuild, cancelOrder, digSpare, nextPrice, isQueued, chambersAhead, digCost, levelCost,
} from './deep.js';
import { VISIT_AFTER_SECONDS } from './surface.js';
import { CRYO } from './deep.js';

const LAMPS = [3, 5, 8, 9, 12];
const asleepWatcher = (over = {}) => ({ ...initialWatcher(), sleeps: 4, capacity: CAPACITY_MAX, sleptYears: 1000, nextPuzzleYears: 0, ...over });

describe('the lamps are the automated rooms', () => {
    test('a chamber whose room type is automated, never the hall, never one skipped', () => {
        const slots = ['mine', 'farm', 'generator', 'dorm', 'cryo', null, 'generator', 'farm'];
        const auto = { mine: 0, farm: 1, generator: 2, dorm: 0 };
        expect(lampSlots(slots, { auto })).toEqual([1, 2, 6, 7]);
        expect(lampSlots(slots, { auto, skip: [6] })).toEqual([1, 2, 7]);
        expect(lampSlots(slots, { auto: { cryo: 1 } })).toEqual([]);
    });
});

describe('THE LAMPS: a sequence to repeat', () => {
    test('three long at full stability, seven at none, longer as it falls', () => {
        expect(lampLength(STABILITY_MAX)).toBe(LAMPS_MIN);
        expect(lampLength(0)).toBe(LAMPS_MAX);
        let last = 0;
        for (let st = 100; st >= 0; st -= 5) { expect(lampLength(st)).toBeGreaterThanOrEqual(last); last = lampLength(st); }
    });
    test('seeded, from the lamps only, never the same lamp twice in a row', () => {
        for (let seed = 1; seed < 80; seed++) {
            const p = makeLampPuzzle(seed, LAMPS, 60);
            expect(makeLampPuzzle(seed, LAMPS, 60)).toEqual(p);
            expect(p.answer).toHaveLength(lampLength(60));
            expect(p.answer.every((x) => LAMPS.includes(x))).toBe(true);
            for (let i = 1; i < p.answer.length; i++) expect(p.answer[i]).not.toBe(p.answer[i - 1]);
            expect(p.lie).toBe(-1);                  // above LIE_BELOW a lamp never lies
            expect(p.shown).toEqual(p.answer);
        }
    });
    test('below LIE_BELOW a lamp may blink once without being part of the answer', () => {
        let lied = 0;
        for (let seed = 1; seed < 200; seed++) {
            const p = makeLampPuzzle(seed, LAMPS, LIE_BELOW - 10);
            if (p.lie < 0) { expect(p.shown).toEqual(p.answer); continue; }
            lied++;
            expect(p.shown).toHaveLength(p.answer.length + 1);
            const without = p.shown.slice();
            without.splice(p.lie, 1);
            expect(without).toEqual(p.answer);
            expect(LAMPS).toContain(p.shown[p.lie]);
        }
        expect(lied).toBeGreaterThan(40);
        expect(lied).toBeLessThan(160);
    });
    test('the right lamps in order solve it: capacity spent, stability gained', () => {
        const w = asleepWatcher({ stability: 40 });
        const p = openPuzzle(w, LAMPS, 2, { kind: 'lamps' });
        const answer = p.answer.slice();
        for (let i = 0; i < answer.length - 1; i++) {
            const r = pressLamp(w, answer[i], 2);
            expect(r).toMatchObject({ ok: true, done: false, at: i + 1 });
        }
        const r = pressLamp(w, answer[answer.length - 1], 2);
        expect(r).toMatchObject({ ok: true, done: true, gained: PUZZLE_GAIN });
        expect(w.puzzle).toBe(null);
        expect(w.capacity).toBe(CAPACITY_MAX - PUZZLE_COST);
        expect(w.stability).toBe(40 + PUZZLE_GAIN);
        expect(w.solved).toBe(1);
    });
    test('a wrong click ends it and costs', () => {
        const w = asleepWatcher({ stability: 40 });
        const p = openPuzzle(w, LAMPS, 2, { kind: 'lamps' });
        const wrong = LAMPS.find((x) => x !== p.answer[0]);
        const r = pressLamp(w, wrong, 2);
        expect(r).toMatchObject({ ok: false, done: true, gained: -PUZZLE_WRONG });
        expect(w.puzzle).toBe(null);
        expect(w.stability).toBe(40 - PUZZLE_WRONG);
        expect(w.capacity).toBe(CAPACITY_MAX);
        // and the one that takes the last of it reboots
        const z = asleepWatcher({ stability: PUZZLE_WRONG });
        const q = openPuzzle(z, LAMPS, 2, { kind: 'lamps' });
        expect(pressLamp(z, LAMPS.find((x) => x !== q.answer[0]), 2).rebooted).toBe(true);
        expect(z.stability).toBe(REBOOT_TO);
    });
    test('a lie is not part of the answer: the player clicks the answer, not what blinked', () => {
        let p = null, seed = 1;
        while (!p || p.lie < 0) p = makeLampPuzzle(seed++, LAMPS, 10);
        const w = asleepWatcher({ stability: 10, puzzle: p });
        let r = null;
        for (const lamp of p.answer) r = pressLamp(w, lamp, 2);
        expect(r.ok).toBe(true);
        expect(r.done).toBe(true);
    });
});

describe('WHICH LAMP WENT OUT', () => {
    test('the dark one within DARK_MS solves it; late or wrong ends it', () => {
        const w = asleepWatcher({ stability: 50 });
        const p = openPuzzle(w, LAMPS, 2, { kind: 'dark' });
        expect(p.kind).toBe('dark');
        expect(LAMPS).toContain(p.out);
        expect(isLamp(p, p.out)).toBe(true);
        expect(isLamp(p, 99)).toBe(false);
        expect(pressLamp(w, p.out, 2, { elapsedMs: DARK_MS - 1 })).toMatchObject({ ok: true, done: true });
        const late = asleepWatcher({ stability: 50 });
        const q = openPuzzle(late, LAMPS, 2, { kind: 'dark' });
        expect(pressLamp(late, q.out, 2, { elapsedMs: DARK_MS + 1 }).ok).toBe(false);
        const wrong = asleepWatcher({ stability: 50 });
        const d = openPuzzle(wrong, LAMPS, 2, { kind: 'dark' });
        expect(pressLamp(wrong, LAMPS.find((x) => x !== d.out), 2).ok).toBe(false);
        expect(wrong.stability).toBe(50 - PUZZLE_WRONG);
        const slow = asleepWatcher({ stability: 50 });
        openPuzzle(slow, LAMPS, 2, { kind: 'dark' });
        expect(expireLamps(slow, 2)).toMatchObject({ ok: false, done: true });
        expect(slow.puzzle).toBe(null);
        expect(makeDarkPuzzle(4, LAMPS)).toEqual(makeDarkPuzzle(4, LAMPS));
    });
});

describe('no numbers any more, and one demand at a time', () => {
    test('every event is a lamp event; none without two lamps', () => {
        let dark = 0;
        for (let seed = 1; seed <= 600; seed++) {
            const p = makePuzzle(seed, LAMPS);
            expect(['lamps', 'dark']).toContain(p.kind);
            if (puzzleKind(seed) === 'dark') dark++;
        }
        expect(dark / 600).toBeGreaterThan(DARK_SHARE - 0.08);
        expect(dark / 600).toBeLessThan(DARK_SHARE + 0.08);
        expect(makePuzzle(1, [4])).toBe(null);
        const w = asleepWatcher();
        expect(openPuzzle(w, [4])).toBe(null);
        expect(w.puzzle).toBe(null);
        expect(w.lampSleep).toBe(null);
    });
    test('at most once in LAMP_EVERY_SLEEPS sleeps', () => {
        const w = asleepWatcher({ sleeps: 5 });
        expect(puzzleDue(w, { asleep: true })).toBe(true);
        openPuzzle(w, LAMPS, 2);
        pressLamp(w, -1, 2);                          // lost; gone
        w.nextPuzzleYears = 0;
        expect(puzzleDue(w, { asleep: true })).toBe(false);
        w.sleeps += LAMP_EVERY_SLEEPS - 1;
        expect(puzzleDue(w, { asleep: true })).toBe(false);
        w.sleeps += 1;
        expect(puzzleDue(w, { asleep: true })).toBe(true);
    });
    test('never in the first sleep, never while Surface is there; Surface never while the lamps ask', () => {
        expect(puzzleDue(asleepWatcher({ sleeps: 1 }), { asleep: true })).toBe(false);
        const w = asleepWatcher({ sleeps: 6 });
        const tier = 2;
        const due = VISIT_AFTER_SECONDS * CRYO[tier].days;
        expect(surfaceDue(w, due, CRYO[tier].days)).toBe(true);
        openPuzzle(w, LAMPS, tier);
        expect(demand(w)).toBe('lamps');
        expect(surfaceDue(w, due, CRYO[tier].days)).toBe(false);
        w.puzzle = null;
        openSurface(w);
        expect(demand(w)).toBe('surface');
        w.nextPuzzleYears = 0; w.lampSleep = null;
        expect(puzzleDue(w, { asleep: true })).toBe(false);
    });
    test('the brain tissue plays the lamps itself now and then', () => {
        const w = asleepWatcher({ stability: 30, bought: LADDER.slice(0, 9).map((u) => u.id) });
        openPuzzle(w, LAMPS, 2);
        expect(selfSolve(w, 1, 2, () => 0)).toEqual([0]);
        expect(w.puzzle).toBe(null);
        expect(w.stability).toBe(30 + 2 * PUZZLE_GAIN);          // the Second core is below it
    });
    test('an old save: a number riddle and a second card are let go, a lamp event comes back from the start', () => {
        const old = normalizeWatcher({ puzzle: { seed: 3, rule: 'add', terms: [1, 2, 3, 4, 5], answer: 6 }, puzzle2: { terms: [1], answer: 2 } });
        expect(old.puzzle).toBe(null);
        expect(old.puzzle2).toBe(null);
        const p = { ...makeLampPuzzle(5, LAMPS, 50), at: 2 };
        const back = normalizeWatcher({ puzzle: p, lampSleep: 7 });
        expect(back.puzzle.at).toBe(0);
        expect(back.puzzle.answer).toEqual(p.answer);
        expect(back.lampSleep).toBe(7);
        expect(normalizeWatcher({}).lampSleep).toBe(null);
        expect(puzzleGapYears(1)).toBeGreaterThan(0);
    });
});

describe('the ladder you can see', () => {
    test('the line: a trail, a tick per rung; the next rung named as a teaser, the one past it not', () => {
        const at = (n) => ladderLine({ bought: LADDER.slice(0, n).map((u) => u.id) });
        const a = at(0);
        expect(a.trail).toBe(0);
        expect(a.ticks.map((t) => t.state)).toEqual(['open', 'tease', 'far']);
        expect(a.ticks.map((t) => t.name)).toEqual(RUNGS);
        const b = at(6);                // iv-surface: SYSTEM and half of HARDWARE
        expect(b.trail).toBeCloseTo(0.5, 9);
        expect(b.ticks.map((t) => t.state)).toEqual(['done', 'open', 'tease']);
        const c = at(8);
        expect(c.rung).toBe(2);
        expect(c.ticks.map((t) => t.state)).toEqual(['done', 'done', 'open']);
        const top = at(LADDER.length);
        expect(top.top).toBe(true);
        expect(top.ticks.every((t) => t.state === 'done')).toBe(true);
        expect(a.ticks.map((t) => t.at)).toEqual([0, 4 / 12, 8 / 12]);
    });
    test('one line when a rung opens, none otherwise', () => {
        expect(rungOpenLine('nightvision')).toBe(RUNG_OPEN_LINES[1]);
        expect(rungOpenLine('reactor')).toBe('The hardware is in. Something else is possible now.');
        expect(rungOpenLine('watchdog')).toBe('');
        expect(rungOpenLine('skin')).toBe('');
    });
    test('every step has its own glyph, its own name and a short line for the pill', () => {
        expect(new Set(LADDER.map((u) => u.icon)).size).toBe(LADDER.length);
        expect(new Set(LADDER.map((u) => u.name.toUpperCase())).size).toBe(LADDER.length);
        for (const u of LADDER) expect(typeof u.short).toBe('string');
    });
});

describe('an order taken back', () => {
    const colony = () => ({ ...initialDeepState(), minerals: 1e9, stars: 1e12 });
    test('its price back, the next order in the lane starts, the next price falls back', () => {
        const s = colony();
        const p1 = nextPrice(s, 'dig');
        s.minerals -= p1; const a = orderBuild(s, 'dig');
        const p2 = nextPrice(s, 'dig');
        s.minerals -= p2; const b = orderBuild(s, 'dig');
        expect(isQueued(b)).toBe(true);
        const before = s.minerals;
        const out = cancelOrder(s, a);
        expect(out).toEqual({ refund: p2, currency: 'minerals' });
        expect(s.minerals).toBe(before + p2);
        expect(isQueued(b)).toBe(false);                 // it moved up and started
        expect(nextPrice(s, 'dig')).toBe(p2);
        expect(digCost(s.chambers + 1)).toBe(p2);
        // a level is paid in stars, and comes back in stars
        s.rooms.farm = 1;
        const lp = nextPrice(s, 'level', 'farm');
        s.stars -= lp; const lv = orderBuild(s, 'level', { type: 'farm' });
        const stars = s.stars;
        expect(cancelOrder(s, lv)).toEqual({ refund: lp, currency: 'stars' });
        expect(s.stars).toBe(stars + lp);
        expect(lp).toBe(levelCost('farm', 0));
        expect(cancelOrder(s, lv)).toBe(null);           // already gone
    });
    test('asleep without the Scheduler, the next order waits for the wake', () => {
        const s = colony();
        const a = orderBuild(s, 'dig');
        const b = orderBuild(s, 'dig');
        cancelOrder(s, a, { asleep: true });
        expect(isQueued(b)).toBe(true);
    });
    test('a dig a waiting room counts on for its chamber cannot be taken back', () => {
        const s = colony();
        while (chambersAhead(s) > 0) orderBuild(s, 'room', { type: 'farm' });
        const d = orderBuild(s, 'dig');
        orderBuild(s, 'room', { type: 'mine' });
        expect(digSpare(s)).toBe(false);
        expect(cancelOrder(s, d)).toBe(null);
        expect(s.builds).toContain(d);
    });
});
