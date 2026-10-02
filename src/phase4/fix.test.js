/* eslint-env jest */
/*
 * deep-fix: the overnight playtest of v1.66.0 (docs/playtests/2026-10-03-chapter-iv-overnight.md).
 * Cryo I shows its whole road, the effect lines carry numbers, people the body takes stay gone,
 * the madness reaches the text, the sector is a demand, and the small fixes.
 */
import {
    initialDeepState, tickDay, sleep, CRYO, bodyKeep, bodyTakes, mourning, MIN_SLEEPERS,
} from './deep.js';
import { cryoRoad, cryoReadyLine, ledger } from './readout.js';
import { effectLine, nodeStatus, arrow } from './tree.js';
import {
    initialWatcher, LADDER, BODY_GROW_SECONDS, buyStep, sealSector, demand, surfaceDue, puzzleDue,
    watchSleep, softness, textMadness, alarmHit, SOFT_FROM, DRIFT_TEXT_BELOW, PUZZLE_COST,
} from './watcher.js';
import { initialLayout } from './layout.js';
import { alarmLine, alarmGlyph } from './advisor.js';

const HARDWARE = LADDER.filter((u) => u.rung < 2).map((u) => u.id);
/** A colony at the body: dormitories that fill, and the people grown into them. */
function late() {
    const s = {
        ...initialDeepState(), stars: 1e20, minerals: 1e20, food: 1e12, humans: 100,
        chambers: 30, rooms: { mine: 6, farm: 6, generator: 6, dorm: 6, cryo: 1 },
        level: { mine: 6, farm: 6, generator: 6, dorm: 4 }, auto: { mine: 3, farm: 3, generator: 3, dorm: 1 }, cryo: 3,
    };
    s.watcher = { ...initialWatcher(), sleeps: 9, capacity: 200, bought: HARDWARE.slice(), grown: BODY_GROW_SECONDS };
    s.humans = tickDay(JSON.parse(JSON.stringify(s)), true).capacity;      // grown into every bed
    return s;
}

describe('Cryo I shows its whole road', () => {
    test('at the descent every part at once, none ticked', () => {
        const s = initialDeepState();
        const r = cryoRoad(0, s);
        expect(r.text).toBe('needs: generators automated, farms automated, mines automated, 15 k ★');
        expect(r.done).toBe(0);
        expect(r.total).toBe(4);
        expect(r.open).toBe(false);
        // the tree's node says the same, whole
        expect(nodeStatus(s, 'cryo-i', { road: r }).reason).toBe(`Cryo I ${r.text}`);
        expect(nodeStatus(s, 'cryo-i').reason).toBe(`Cryo I ${r.text}`);
    });
    test('a part done is ticked and stays listed; one on order says so; the price ticks too', () => {
        const s = { ...initialDeepState(), stars: 2e4 };
        s.auto = { ...s.auto, generator: 1 };
        s.builds = [{ kind: 'auto', type: 'farm', slot: -1, startDay: 0, doneDay: 12 }];
        const r = cryoRoad(0, s);
        expect(r.text).toBe('needs: generators automated ✓, farms automated (ordered), mines automated, 15 k ★ ✓');
        expect(r.done).toBe(2);
    });
    test('everything in: the road is open, and the node can be bought', () => {
        const s = { ...initialDeepState(), stars: 2e4, minerals: 1e5, food: 1e4 };
        s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 };
        const r = cryoRoad(0, s);
        expect(r.items.every((x) => x.done)).toBe(true);
        expect(r.open).toBe(true);
    });
    test('a later tier lists what the sleep still meets, then its price', () => {
        const s = { ...initialDeepState(), stars: 0, food: 50, cryo: 0 };
        s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 };
        s.humans = 400;          // more mouths than the farms feed for a year asleep
        const r = cryoRoad(1, s);
        expect(r.items.map((x) => x.key)).toContain('food');
        expect(r.items[r.items.length - 1]).toMatchObject({ key: 'stars', done: false });
    });
    test('"can be bought", never "is ready"', () => {
        expect(cryoReadyLine(1)).toBe('Cryo II can be bought: a year a second.');
    });
});

describe('every effect line carries before and after', () => {
    test('a level: what the room makes, from a dry run', () => {
        const s = initialDeepState();
        expect(effectLine(s, 'seam')).toMatch(/^Doubles every mine: ore 12 → 24 a day/);
        expect(effectLine(s, 'output')).toMatch(/^Doubles every generator: energy 26 → 52 a day, ★ \d+ → \d+ a day/);
        expect(effectLine(s, 'feed')).toMatch(/^The machine draws 9 % of the spare energy: ★ 81 → \d+ a day\.$/);
    });
    test('Surface\'s gifts: the arrow and two numbers', () => {
        const s = { ...initialDeepState(), tree: { opened: ['lossless', 'cold', 'quiet'], bought: [], unseen: false } };
        s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 };
        s.level = { mine: 3, farm: 3, generator: 3, dorm: 0 };
        expect(effectLine(s, 'lossless')).toMatch(/^Automation output ×3: ore [\d.]+( k)? → [\d.]+( k)? a day/);
        expect(effectLine(s, 'quiet')).toMatch(/^Automated rooms need no upkeep crew: power drawn \d+ → \d+ a day/);
        expect(effectLine(s, 'cold')).toMatch(/^Sleepers eat nothing: .+ → .+/);
        // not opened: nothing to say yet
        expect(effectLine(s, 'question')).toBe('');
        expect(arrow(576, 1728)).toBe('576 → 1.7 k');
    });
    test('the Watcher\'s steps and the body\'s', () => {
        const s = late();
        s.watcher.bought = [];
        expect(effectLine(s, 'watchdog')).toMatch(/stability drift [\d.]+ → [\d.]+ a second\.$/);
        s.watcher.bought = HARDWARE.slice();
        expect(effectLine(s, 'brain')).toMatch(/^BIOLOGICAL: .+: people .+ → .+, beds .+ → .+\.$/);
    });
});

describe('people taken stay gone', () => {
    test('a biological step takes people AND their beds; a long sleep does not grow them back', () => {
        const s = late();
        const slots = initialLayout({ rooms: s.rooms, chambers: s.chambers }).slots;
        const beds0 = tickDay(JSON.parse(JSON.stringify(s)), true).capacity;
        const h0 = s.humans;
        const out = buyStep(s.watcher, s, slots);
        expect(out.people).toBeGreaterThan(0);
        expect(s.humans).toBeCloseTo(h0 - out.people, 6);
        expect(bodyKeep(s)).toBeLessThan(1);
        const beds1 = tickDay(JSON.parse(JSON.stringify(s)), true).capacity;
        expect(beds1).toBeCloseTo(beds0 - out.people, 3);
        expect(mourning(s)).toBe(true);
        // a thousand years under the ice: the creches have no beds to grow them back into
        sleep(s, 365000);
        expect(s.humans).toBeLessThanOrEqual(h0 - out.people + 1e-6);
        // and the people the hand writes say where the beds went
        const r = tickDay(JSON.parse(JSON.stringify(s)), false);
        expect(r.bodyBeds).toBeGreaterThan(0);
        expect(ledger('H', s, r)).toMatch(/beds went to the body\.$/);
    });
    test('the beds are taken once per step, and never below a sliver', () => {
        const s = { ...initialDeepState(), humans: 10 };
        expect(bodyTakes(s, 0)).toBe(0);
        expect(bodyKeep(s)).toBe(1);
        bodyTakes(s, 1e9);
        expect(bodyKeep(s)).toBeGreaterThan(0);
    });
    test('the chosen sector takes them the same way', () => {
        const s = late();
        const slots = initialLayout({ rooms: s.rooms, chambers: s.chambers }).slots;
        const out = buyStep(s.watcher, s, slots, { choose: true });
        expect(out.pending).toBe(true);
        const keep0 = bodyKeep(s);
        const sealed = sealSector(s.watcher, s, slots, 0);
        expect(sealed.people).toBeGreaterThan(0);
        expect(bodyKeep(s)).toBeLessThan(keep0);
        expect(s.humans).toBeGreaterThanOrEqual(MIN_SLEEPERS);
    });
});

describe('the madness is felt; the sector is a demand', () => {
    test('the base softens from the first points under 80, more as it falls', () => {
        expect(softness(SOFT_FROM)).toBe(0);
        expect(softness(79)).toBeGreaterThan(0.04);
        expect(softness(70)).toBeGreaterThan(0.2);
        expect(softness(50)).toBeGreaterThan(0.45);
        expect(softness(20)).toBeGreaterThan(softness(50));
        expect(softness(0)).toBe(1);
    });
    test('the text goes from 50 down', () => {
        expect(textMadness(DRIFT_TEXT_BELOW)).toBe(0);
        expect(textMadness(80)).toBe(0);
        expect(textMadness(25)).toBeCloseTo(0.5, 9);
        expect(textMadness(0)).toBe(1);
    });
    test('while a sector waits to be chosen it is the one demand: no Surface, no lamps', () => {
        const w = { ...initialWatcher(), sleeps: 9, capacity: PUZZLE_COST * 2, sleptYears: 1e6, nextPuzzleYears: 0, sealing: 'brain' };
        w.surface = { ...w.surface, lastSleep: 0, visits: 3 };
        expect(demand(w)).toBe('sector');
        expect(surfaceDue(w, 1e9, 365)).toBe(false);
        expect(puzzleDue(w, { asleep: true })).toBe(false);
        w.sealing = null;
        expect(demand(w)).toBe(null);
    });
    test('while the player chooses, the meter holds', () => {
        const a = { ...initialWatcher(), sleeps: 5, stability: 60 };
        const b = { ...a };
        watchSleep(a, { days: CRYO[2].days * 10, tier: 2 });
        watchSleep(b, { days: CRYO[2].days * 10, tier: 2, hold: true });
        expect(a.stability).toBeLessThan(60);
        expect(b.stability).toBe(60);
    });
});

describe('a sleep with no alarm still ends', () => {
    test('the look: a plain line, no jolt to the meter', () => {
        expect(alarmLine({ kind: 'look' })).toBe('Woke: a look at the colony.');
        expect(alarmGlyph({ kind: 'look' })).toBe('eye');
        const w = { ...initialWatcher(), sleeps: 5, stability: 50 };
        expect(alarmHit(w, 'look')).toBe(false);
        expect(w.stability).toBe(50);
    });
});
