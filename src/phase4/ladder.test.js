/* eslint-env jest */
/*
 * v1.49.0 (slice 6): the build queue, the Watcher's ladder (SYSTEM, HARDWARE), stability that
 * comes back awake, Surface as the Watcher keeps it, and the save that carries all of it.
 */
import {
    initialDeepState, tickDay, sleep, orderBuild, startBuild, completeBuilds, isQueued, ordered, nextPrice,
    chambersAhead, buildEta, buildProgress, BUILD_DAYS, digCost, roomCost, levelCost, QUEUE_MAX,
    troubleIn, FOOD_ALARM_DAYS, probeOdds, probeScatter, scoutOdds, CRYO, ordersDone,
} from './deep.js';
import {
    initialWatcher, normalizeWatcher, watchSleep, LADDER, RUNGS, nextStep, stepNeed, buyStep, has,
    capacityMax, puzzleGain, recoverAwake, AWAKE_RECOVER_PER_MONTH, CAPACITY_MAX,
    STABILITY_MAX, DRIFT_PER_SECOND, openPuzzle, puzzleDue, dormToTake, SPACE_LINE,
    wordCap, surfaceDue, openSurface, closeSurface, playSurface, REBOOT_TO, PUZZLE_GAIN,
    snapGain, snap, SNAP_DEEP, lampFactor, pressLamp,
} from './watcher.js';
import { SENTENCE, VISIT_AFTER_SECONDS, WIN_CAPACITY } from './surface.js';
import { deserializeDeep, SCHEMA_VERSION } from './persistence.js';

const colony = (over = {}) => ({ ...initialDeepState(), ...over });
const buyAll = (w, s, n, slots = []) => {
    for (let i = 0; i < n; i++) {
        const step = nextStep(w);
        w.capacity = capacityMax(w);
        s.stars += step.stars; s.minerals += step.ore || 0;
        expect(buyStep(w, s, slots)).not.toBe(null);
    }
};

describe('the build queue', () => {
    test('a second dig waits behind the first and costs the chamber after it', () => {
        const s = colony();
        expect(nextPrice(s, 'dig')).toBe(digCost(s.chambers));
        const a = orderBuild(s, 'dig');
        expect(isQueued(a)).toBe(false);
        expect(nextPrice(s, 'dig')).toBe(digCost(s.chambers + 1));
        const b = orderBuild(s, 'dig');
        expect(isQueued(b)).toBe(true);
        expect(buildProgress(s, b)).toBe(0);
        expect(ordered(s, 'dig')).toBe(2);
        const eta = buildEta(s);
        expect(eta.get(a)).toBe(BUILD_DAYS.dig);
        expect(eta.get(b)).toBe(2 * BUILD_DAYS.dig);
        for (let d = 1; d <= 2 * BUILD_DAYS.dig; d++) { s.day = d; completeBuilds(s); }
        expect(s.chambers).toBe(initialDeepState().chambers + 2);
        expect(s.builds).toHaveLength(0);
    });
    test('a room waits for the chamber a dig will make; lanes of other kinds run side by side', () => {
        const s = colony();
        expect(chambersAhead(s)).toBe(0);           // four chambers, four rooms
        orderBuild(s, 'dig');
        expect(chambersAhead(s)).toBe(1);
        const mine = orderBuild(s, 'room', { type: 'mine' });
        expect(isQueued(mine)).toBe(true);           // no chamber yet
        const lvl = orderBuild(s, 'level', { type: 'farm' });
        expect(isQueued(lvl)).toBe(false);           // another lane: it starts at once
        expect(buildEta(s).get(mine)).toBe(BUILD_DAYS.dig + BUILD_DAYS.room);
        expect(nextPrice(s, 'room', 'mine')).toBe(roomCost('mine', s.rooms.mine + 1));
        expect(nextPrice(s, 'level', 'farm')).toBe(levelCost('farm', 1));
        for (let d = 1; d <= BUILD_DAYS.dig + BUILD_DAYS.room; d++) { s.day = d; completeBuilds(s); }
        expect(s.rooms.mine).toBe(2);
        expect(s.level.farm).toBe(1);
        expect(QUEUE_MAX).toBeGreaterThanOrEqual(3);
    });
    test('asleep, the order under way finishes but the next waits, unless the Watcher has the Scheduler', () => {
        const run = (scheduler) => {
            const s = colony({ auto: { mine: 1, farm: 1, generator: 1, dorm: 1 }, food: 1e6, minerals: 1e6 });
            s.watcher = { ...initialWatcher(), bought: scheduler ? ['watchdog', 'scheduler'] : [] };
            orderBuild(s, 'dig'); orderBuild(s, 'dig'); orderBuild(s, 'dig');
            sleep(s, 40);
            return s;
        };
        const plain = run(false);
        expect(plain.chambers).toBe(initialDeepState().chambers + 1);
        expect(plain.builds.every(isQueued)).toBe(true);
        expect(plain.day).toBe(40);                   // the queue does not stop the sleep running
        const sched = run(true);
        expect(sched.chambers).toBe(initialDeepState().chambers + 3);
        expect(sched.builds).toHaveLength(0);
    });
    test('the simulation\'s own orders (startBuild into an empty lane) land exactly as before', () => {
        const a = colony(), b = colony();
        startBuild(a, 'level', { type: 'mine' });
        orderBuild(b, 'level', { type: 'mine' });
        for (let d = 1; d <= 10; d++) { a.day = b.day = d; completeBuilds(a); completeBuilds(b); tickDay(a); tickDay(b); }
        expect(a).toEqual(b);
    });
    test('the colony as it will stand counts the orders still waiting', () => {
        const s = colony();
        orderBuild(s, 'level', { type: 'mine' });
        orderBuild(s, 'level', { type: 'mine' });
        expect(ordersDone(s).level.mine).toBe(2);
        expect(s.level.mine).toBe(0);
    });
});

describe('the ladder', () => {
    test('SYSTEM then HARDWARE, four steps each, prices climbing', () => {
        expect(RUNGS.slice(0, 2)).toEqual(['SYSTEM', 'HARDWARE']);
        expect(LADDER.slice(0, 8).map((u) => u.id)).toEqual(['watchdog', 'scheduler', 'deepread', 'nightvision', 'cooling', 'secondcore', 'mast', 'reactor']);
        for (let i = 1; i < 8; i++) {
            expect(LADDER[i].stars).toBeGreaterThan(LADDER[i - 1].stars);
            expect(LADDER[i].cap).toBeGreaterThanOrEqual(LADDER[i - 1].cap);
        }
        // from HARDWARE on a step also takes ore and a dormitory
        for (const u of LADDER.slice(0, 8)) expect(!!u.beds && !!u.ore).toBe(u.rung >= 1);
        // every price fits the pool it is paid from
        const w = initialWatcher();
        for (const u of LADDER.slice(0, 8)) { expect(u.cap).toBeLessThanOrEqual(capacityMax(w)); w.bought.push(u.id); }
        for (const u of LADDER) expect(u.does).not.toMatch(/[‒-―]/);
    });
    test('one at a time, in order, and only with the price in hand', () => {
        const w = initialWatcher();
        const s = colony({ stars: 0 });
        expect(stepNeed(w, s)).toEqual({ step: LADDER[0], missing: 'capacity' });
        w.capacity = LADDER[0].cap;
        expect(stepNeed(w, s).missing).toBe('stars');
        s.stars = LADDER[0].stars;
        expect(stepNeed(w, s).missing).toBe('');
        const out = buyStep(w, s, []);
        expect(out.step.id).toBe('watchdog');
        expect(w.capacity).toBe(0);
        expect(s.stars).toBe(0);
        expect(has(w, 'watchdog')).toBe(true);
        expect(nextStep(w).id).toBe('scheduler');
        expect(buyStep(w, s, [])).toBe(null);
    });
    test('HARDWARE takes ore and a dormitory: the beds fall, and it is said once', () => {
        const s = colony({ rooms: { mine: 1, farm: 1, generator: 1, dorm: 3, cryo: 1 }, chambers: 7, minerals: 0, food: 1e5, humans: 30 });
        const slots = ['mine', 'farm', 'generator', 'dorm', 'dorm', 'dorm', 'cryo'];
        const w = initialWatcher();
        buyAll(w, s, 4, slots);
        const beds0 = tickDay(JSON.parse(JSON.stringify(s))).capacity;
        w.capacity = capacityMax(w); s.stars += LADDER[4].stars;
        expect(stepNeed(w, s).missing).toBe('ore');
        s.minerals = LADDER[4].ore;
        expect(dormToTake(s, slots)).toBe(5);         // the last dormitory dug
        const out = buyStep(w, s, slots);
        expect(out.slot).toBe(5);
        expect(out.firstSpace).toBe(true);
        expect(SPACE_LINE).toBe('We needed the space.');
        expect(s.minerals).toBe(0);
        expect(s.taken.dorm).toBe(1);
        expect(s.takenSlots).toEqual([5]);
        const beds1 = tickDay(JSON.parse(JSON.stringify(s))).capacity;
        expect(beds1).toBeCloseTo(beds0 * 2 / 3, 6);
        // the next one takes another, and says nothing
        buyAll(w, s, 1, slots);
        expect(s.takenSlots).toEqual([5, 4]);
        // the colony keeps its last dormitory: no third step without one to spare
        w.capacity = capacityMax(w); s.stars += 1e20; s.minerals += 1e20;
        expect(stepNeed(w, s).missing).toBe('dorm');
    });
    test('what the steps do', () => {
        const w = initialWatcher();
        const s = colony({ rooms: { mine: 1, farm: 1, generator: 1, dorm: 6, cryo: 1 } });
        const slots = ['mine', 'farm', 'generator', 'dorm', 'dorm', 'dorm', 'dorm', 'dorm', 'dorm'];
        // Watchdog: a quarter slower
        const a = { ...initialWatcher(), sleeps: 2 }, b = { ...initialWatcher(), sleeps: 2, bought: ['watchdog'] };
        watchSleep(a, { days: CRYO[1].days, tier: 1 }); watchSleep(b, { days: CRYO[1].days, tier: 1 });
        expect(STABILITY_MAX - b.stability).toBeCloseTo(0.75 * DRIFT_PER_SECOND[1], 9);
        // Deep read (v1.52.0): a snap gives half as much again
        const before = snapGain({ ...w, stability: 50 }, 2);
        buyAll(w, s, 3, slots);
        expect(snapGain({ ...w, stability: 50 }, 2)).toBeCloseTo(SNAP_DEEP * before, 9);
        const snapper = { ...w, stability: 50, lastSnapAt: 0 };
        expect(snap(snapper, 1e6, 2)).toBeCloseTo(SNAP_DEEP * before, 9);
        // Night vision: the food alarm at 27 days, not 30
        const lean = colony({ humans: 100, food: 0, rooms: { mine: 1, farm: 0, generator: 1, dorm: 1, cryo: 1 }, auto: { mine: 1, farm: 1, generator: 1, dorm: 1 }, minerals: 1e6 });
        const r = tickDay(JSON.parse(JSON.stringify(lean)), true);
        lean.food = 100 * 0.1 * (FOOD_ALARM_DAYS - 1.5);
        expect(troubleIn(lean, r)?.kind).toBe('food');
        lean.watcher = { bought: ['watchdog', 'scheduler', 'deepread', 'nightvision'] };
        expect(troubleIn(lean, r)).toBe(null);
        // Cooling: twice the pool
        buyAll(w, s, 2, slots);
        expect(capacityMax(w)).toBe(2 * CAPACITY_MAX);
        // Second core (v1.51.0): the lamps give double
        expect(lampFactor(w)).toBe(1);
        expect(puzzleGain(w)).toBe(PUZZLE_GAIN);
        buyAll(w, s, 1, slots);
        expect(lampFactor(w)).toBe(2);
        expect(puzzleGain(w)).toBe(2 * PUZZLE_GAIN);
        // Sensor mast: better odds, half the scatter
        const day = 1000 * 365;
        const m = colony({ day, humans: 100, watcher: { bought: ['mast'] } });
        const plain = colony({ day, humans: 100 });
        expect(probeOdds(day, true).reading).toBeGreaterThan(probeOdds(day).reading);
        expect(probeScatter(day, true)).toBeCloseTo(Math.max(1, probeScatter(day) / 2), 9);
        expect(scoutOdds(m).pct.reading).toBeGreaterThan(scoutOdds(plain).pct.reading);
        // Reactor tap: three times the capacity, three times as fast
        const x = { ...initialWatcher(), sleeps: 2 }, y = { ...initialWatcher(), sleeps: 2, bought: LADDER.slice(0, 8).map((u) => u.id) };
        watchSleep(x, { days: CRYO[2].days, tier: 2, spare: 1e9 });
        watchSleep(y, { days: CRYO[2].days, tier: 2, spare: 1e9 });
        expect(y.capacity).toBeCloseTo(3 * x.capacity, 9);
    });
    test('the Second core: one lamp event at a time still, and a solved one gives twice the stability', () => {
        const w = { ...initialWatcher(), sleeps: 3, capacity: 200, stability: 40, bought: LADDER.slice(0, 6).map((u) => u.id), nextPuzzleYears: 0 };
        expect(puzzleDue(w, { asleep: true })).toBe(true);
        openPuzzle(w, [3, 5, 7], 1, { kind: 'lamps' });
        w.nextPuzzleYears = 0;
        expect(puzzleDue(w, { asleep: true })).toBe(false);          // one demand at a time
        for (const lamp of w.puzzle.answer.slice()) pressLamp(w, lamp, 1);
        expect(w.puzzle).toBe(null);
        expect(w.stability).toBe(40 + 2 * PUZZLE_GAIN);
    });
});

describe('awake, stability comes back', () => {
    test('two points an awake month, never past the top', () => {
        const w = { ...initialWatcher(), stability: 40 };
        expect(recoverAwake(w, 30)).toBeCloseTo(AWAKE_RECOVER_PER_MONTH, 9);
        expect(w.stability).toBeCloseTo(42, 9);
        recoverAwake(w, 10000);
        expect(w.stability).toBe(STABILITY_MAX);
    });
});

describe('Surface, as the Watcher keeps it', () => {
    test('it comes a few seconds into a sleep it is due in, never the first', () => {
        // deep-rebuild: and only to a mind under SURFACE_BELOW
        const w = { ...initialWatcher(), sleeps: 1, stability: 60 };
        expect(surfaceDue(w, 1e9, 30)).toBe(false);
        w.sleeps = 2;
        w.stability = 90;
        expect(surfaceDue(w, 1e9, 30)).toBe(false);
        w.stability = 60;
        expect(surfaceDue(w, (VISIT_AFTER_SECONDS - 0.5) * 30, 30)).toBe(false);
        expect(surfaceDue(w, VISIT_AFTER_SECONDS * 30, 30)).toBe(true);
        openSurface(w);
        expect(surfaceDue(w, 1e9, 30)).toBe(false);
        closeSurface(w);
        expect(w.surface.visit).toBe(null);
    });
    test('a win fills the pool, a loss takes stability and can reboot the system', () => {
        const w = { ...initialWatcher(), sleeps: 2, capacity: 10 };
        openSurface(w); w.surface.visit.it = 'scissors';
        const r = playSurface(w, 'rock');
        expect(w.capacity).toBe(10 + WIN_CAPACITY);
        expect(r.word).toBe(true);
        const z = { ...initialWatcher(), sleeps: 2, stability: 2 };
        openSurface(z); z.surface.visit.it = 'paper';
        expect(playSurface(z, 'rock').rebooted).toBe(true);
        expect(z.stability).toBe(REBOOT_TO);
    });
    test('the words it can give grow with the ladder, and never the last one', () => {
        const w = initialWatcher();
        expect(wordCap(w)).toBe(1);
        w.bought = LADDER.slice(0, 8).map((u) => u.id);
        expect(wordCap(w)).toBe(SENTENCE.length - 1);
    });
});

describe('the save', () => {
    test('a v3 save opens with an empty ladder, no Surface yet, no dormitory taken', () => {
        const old = initialDeepState();
        delete old.taken; delete old.takenSlots;
        old.watcher = { stage: 1, stability: 60, capacity: 100, sleptYears: 500, sleeps: 9 };
        old.builds = [{ kind: 'dig', type: null, slot: -1, startDay: 0, doneDay: 8 }];
        const back = deserializeDeep(JSON.stringify({ schemaVersion: 3, state: old, layout: { slots: ['mine', 'farm', 'generator', 'dorm'] } }));
        expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
        expect(back.state.watcher.bought).toEqual([]);
        expect(back.state.watcher.surface.visits).toBe(0);
        expect(back.state.watcher.stability).toBe(60);
        expect(back.state.taken.dorm).toBe(0);
        expect(back.state.takenSlots).toEqual([]);
        expect(isQueued(back.state.builds[0])).toBe(false);
    });
    test('a ladder with a hole in it keeps the rungs under the hole', () => {
        expect(normalizeWatcher({ bought: ['watchdog', 'deepread', 'nonsense'] }).bought).toEqual(['watchdog']);
    });
});
