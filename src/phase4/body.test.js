/* eslint-env jest */
/*
 * v1.50.0 (slice 7): the BIOLOGICAL rung. The sectors, which one the body takes, what a step costs
 * in people, the body growing only in the dark, what the steps do, the last wake-up, the Watcher
 * going up alone, the ring that wakes once, and the save.
 */
import { sectorOf, SECTORS, initialLayout, CHAMBERS_PER_FLOOR } from './layout.js';
import {
    initialWatcher, normalizeWatcher, LADDER, RUNGS, stepNeed, buyStep, nextSector, sectorName, sealLine,
    peopleFor, BODY_GROW_SECONDS, watchSleep, driftFactor, selfSolve, autoSnapDue, bodyWhole, lastWake,
    ascendAlone, watcherName, openPuzzle, capacityMax, inBody, SOFT_FROM, SNAP_COOLDOWN_MS, puzzleGain,
    openSurface, NOBODY_LINE, GO_UP_ALONE,
} from './watcher.js';
import { initialDeepState, sleep, CRYO, resurfaceDay, canResurface, MIN_SLEEPERS } from './deep.js';
import { SENTENCE, SENTENCE_LINE } from './surface.js';
import { alarmLine } from './advisor.js';
import { deserializeDeep, SCHEMA_VERSION } from './persistence.js';

const HARDWARE = LADDER.filter((u) => u.rung < 2).map((u) => u.id);
const late = (over = {}) => {
    const s = { ...initialDeepState(), stars: 1e20, minerals: 1e20, humans: 2000, ...over };
    s.watcher = { ...initialWatcher(), sleeps: 9, capacity: 200, bought: HARDWARE.slice(), grown: BODY_GROW_SECONDS };
    return s;
};

describe('the sectors', () => {
    test('four sectors, three chambers each on every floor, the same on every floor', () => {
        expect(SECTORS).toBe(4);
        const count = [0, 0, 0, 0];
        for (let i = 0; i < CHAMBERS_PER_FLOOR; i++) count[sectorOf(i)]++;
        expect(count).toEqual([3, 3, 3, 3]);
        for (let i = 0; i < CHAMBERS_PER_FLOOR; i++) expect(sectorOf(i + CHAMBERS_PER_FLOOR)).toBe(sectorOf(i));
        // the arms, in order: north, east, south, west
        expect([0, 1, 2, 3].map(sectorOf)).toEqual([0, 1, 2, 3]);
        expect(sectorName(2)).toBe('Sector 3');
        expect(sealLine(2)).toBe('Sector 3 sealed for maintenance.');
    });
    test('the body takes the sector where most of them sleep, then the biggest, then the first', () => {
        const slots = ['mine', 'dorm', 'farm', 'dorm', 'dorm', null, 'mine', null, null, null, null, 'dorm'];
        // dorms by sector: 0: slot 4; 1: slot 1; 2: none; 3: slots 3 and 11
        expect(nextSector(slots, [])).toBe(3);
        expect(nextSector(slots, [3])).toBe(0);          // a tie on dorms and chambers: the first
        expect(nextSector(slots, [3, 0])).toBe(1);
        expect(nextSector(slots, [3, 0, 1])).toBe(2);
        expect(nextSector(slots, [0, 1, 2, 3])).toBe(-1);
    });
});

describe('the biological rung', () => {
    test('after HARDWARE, four steps, paid in people and capacity and stars, no ore, no beds', () => {
        expect(RUNGS[2]).toBe('BIOLOGICAL');
        const bio = LADDER.filter((u) => u.rung === 2);
        expect(bio.map((u) => u.id)).toEqual(['brain', 'nervous', 'spinal', 'skin']);
        for (const u of bio) {
            expect(u.people).toBeGreaterThan(0);
            expect(u.ore).toBeUndefined();
            expect(u.beds).toBeUndefined();
            expect(u.cap).toBeLessThanOrEqual(200);
        }
    });
    test('a step takes its share of the colony, seals a sector, and says so calmly', () => {
        const s = late();
        const slots = initialLayout({ rooms: { mine: 3, farm: 3, generator: 3, dorm: 6, cryo: 1 }, chambers: 16 }).slots;
        const w = s.watcher;
        expect(stepNeed(w, s).missing).toBe('');
        const want = peopleFor(LADDER[8], s);
        expect(want).toBe(200);
        const out = buyStep(w, s, slots);
        expect(out.step.id).toBe('brain');
        expect(out.people).toBe(200);
        expect(s.humans).toBe(1800);
        expect(out.sector).toBe(nextSector(slots, []));
        expect(w.sealed).toEqual([out.sector]);
        expect(inBody(w, slots.findIndex((_, i) => sectorOf(i) === out.sector))).toBe(true);
        // its rooms keep producing: no dormitory is taken by the body, only by the hardware
        expect(s.takenSlots || []).toEqual([]);
    });
    test('the body grows only in the dark: a step waits for BODY_GROW_SECONDS of sleep after the last', () => {
        const s = late();
        const w = s.watcher;
        buyStep(w, s, []);
        expect(w.grown).toBe(0);
        w.capacity = 200;
        expect(stepNeed(w, s).missing).toBe('growing');
        // half the time at a slow tier and half at a fast one: it is real seconds that count
        watchSleep(w, { days: CRYO[1].days * BODY_GROW_SECONDS / 2, tier: 1 });
        expect(stepNeed(w, s).missing).toBe('growing');
        watchSleep(w, { days: CRYO[5].days * BODY_GROW_SECONDS / 2, tier: 5 });
        w.capacity = 200;
        expect(stepNeed(w, s).missing).toBe('');
    });
    test('some must stay under the ice', () => {
        const s = late({ humans: MIN_SLEEPERS });
        expect(stepNeed(s.watcher, s).missing).toBe('people');
    });
    test('what the steps do: the lamps answer themselves, the snap comes, the drift halves, the sentence is heard', () => {
        const w = { ...initialWatcher(), sleeps: 5, capacity: 200, bought: [...HARDWARE, 'brain'], stability: 50 };
        openPuzzle(w, [2, 4, 6]);
        // a riddle answers itself now and then: at rng 0 it does, at rng 0.99 it does not
        expect(selfSolve(w, 1, 2, () => 0.99)).toEqual([]);
        expect(selfSolve(w, 1, 2, () => 0)).toEqual([0]);
        expect(w.puzzle).toBe(null);
        expect(w.stability).toBe(50 + puzzleGain(w));
        expect(selfSolve({ ...initialWatcher(), puzzle: w.puzzle }, 1, 2, () => 0)).toEqual([]);   // not without the tissue
        // the snap by itself, only with the nerves, only when the base gives, and not in the cooldown
        const n = { ...initialWatcher(), bought: [...HARDWARE, 'brain', 'nervous'], stability: SOFT_FROM - 10, lastSnapAt: 0 };
        expect(autoSnapDue(n, 10 * SNAP_COOLDOWN_MS)).toBe(true);
        expect(autoSnapDue({ ...n, stability: SOFT_FROM + 5 }, 10 * SNAP_COOLDOWN_MS)).toBe(false);
        expect(autoSnapDue({ ...n, lastSnapAt: 10 * SNAP_COOLDOWN_MS - 1 }, 10 * SNAP_COOLDOWN_MS)).toBe(false);
        expect(autoSnapDue({ ...n, bought: [...HARDWARE, 'brain'] }, 10 * SNAP_COOLDOWN_MS)).toBe(false);
        // the spinal fluid halves the drift again
        expect(driftFactor({ bought: ['watchdog'] })).toBe(0.75);
        expect(driftFactor({ bought: ['watchdog', 'spinal'] })).toBe(0.375);
        // the skin: the whole sentence, and Surface's line is it
        const s = late();
        s.watcher.bought = [...HARDWARE, 'brain', 'nervous', 'spinal'];
        buyStep(s.watcher, s, []);
        expect(s.watcher.surface.words).toBe(SENTENCE.length);
        expect(bodyWhole(s.watcher)).toBe(true);
        expect(openSurface(s.watcher).line).toBe(SENTENCE_LINE);
        expect(capacityMax(s.watcher)).toBe(200);
    });
});

describe('the last wake-up', () => {
    test('nobody comes out; the Watcher takes the colony\'s name; it goes up alone', () => {
        const s = late({ humans: 1234 });
        const w = s.watcher;
        w.bought = LADDER.map((u) => u.id);
        expect(watcherName(w)).toBe('SYSTEM AWAKE');
        expect(lastWake(w, s)).toBe(1234);
        expect(s.humans).toBe(0);
        expect(w.gone).toBe(true);
        expect(watcherName(w)).toBe(SENTENCE[SENTENCE.length - 1]);
        expect(watcherName(w)).toBe('US');
        expect(alarmLine({ kind: 'nobody' })).toBe(NOBODY_LINE);
        expect(NOBODY_LINE).toBe('Woke: nobody came out.');
        expect(GO_UP_ALONE).toBe('Go up. There is nothing left to lose.');
        ascendAlone(s);
        expect(s.ascended).toBe(true);
        expect(s.ending).toBe('watcher');
    });
});

describe('the ring wakes once', () => {
    test('the sensor wakes the colony at the ring, and a colony that stays down can sleep on', () => {
        const s = { ...initialDeepState(), auto: { mine: 1, farm: 1, generator: 1, dorm: 1 }, food: 1e9, minerals: 1e9, humans: 50 };
        s.day = Math.ceil(resurfaceDay(s.doom0)) - 3;
        const a = sleep(s, 100, { alarms: true });
        expect(a.alarm.kind).toBe('surface');
        expect(canResurface(s)).toBe(true);
        const b = sleep(s, 1e6, { alarms: true });
        expect(b.alarm?.kind).not.toBe('surface');
        expect(b.days).toBe(1e6);
        // without alarms, the old plain sleep stops at the ring every time
        const c = sleep(s, 100);
        expect(c.alarm.kind).toBe('surface');
    });
});

describe('the save', () => {
    test('a v4 save opens with no sector sealed and nobody gone', () => {
        const old = initialDeepState();
        old.watcher = { ...initialWatcher(), bought: HARDWARE.slice() };
        delete old.watcher.sealed; delete old.watcher.gone; delete old.watcher.grown;
        const back = deserializeDeep(JSON.stringify({ schemaVersion: 4, state: old, layout: { slots: ['mine', 'farm', 'generator', 'dorm'] } }));
        expect(SCHEMA_VERSION).toBe(5);
        expect(back.state.watcher.sealed).toEqual([]);
        expect(back.state.watcher.gone).toBe(false);
        expect(back.state.watcher.bought).toEqual(HARDWARE);
        expect(back.state.ringWoke).toBe(false);
        expect(normalizeWatcher({ sealed: [2, 2, 9, -1, 'x'] }).sealed).toEqual([2]);
    });
});
