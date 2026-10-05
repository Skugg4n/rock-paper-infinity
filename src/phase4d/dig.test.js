/* eslint-env jest */
import { makeWorld, W, H, T, depthOf, HARD_BAND, BASALT_BAND, SINEW_BAND } from './world.js';
import { newState, step, buy, buyGraft, gateOf, digTime, serialize, deserialize, preparedState, sleepers, PRICES, POD_EVERY, HOME_X } from './dig.js';
import { decide } from './autopilot.js';
import { chosenDeep, nextDeep, deepModule } from '../deepVersion.js';

describe('the world', () => {
    test('is seeded: the same seed lays the same ground', () => {
        expect(Array.from(makeWorld(3).tiles)).toEqual(Array.from(makeWorld(3).tiles));
        expect(Array.from(makeWorld(3).tiles)).not.toEqual(Array.from(makeWorld(4).tiles));
    });
    test('24 wide, 400 deep, the bottom at 2 000 m; the gates are whole bands; twelve finds; a heart', () => {
        const w = makeWorld(7);
        expect(w.tiles.length).toBe(W * H);
        expect(depthOf(H - 1)).toBe(2000);
        for (let x = 0; x < W; x++) {
            expect(w.tiles[HARD_BAND[0] * W + x]).toBe(T.HARD);
            expect(w.tiles[BASALT_BAND[0] * W + x]).toBe(T.BASALT);
            expect(w.tiles[SINEW_BAND[0] * W + x]).toBe(T.SINEW);
        }
        expect(Object.keys(w.finds)).toHaveLength(12);
        expect(Array.from(w.tiles).filter((t) => t === T.HEART).length).toBeGreaterThan(4);
    });
});

describe('the rules', () => {
    test('soil digs in 0.25 s, a better drill digs faster', () => {
        const s = newState(7);
        expect(digTime(s, T.SOIL, 0)).toBeCloseTo(0.25);
        s.levels.drill = 1;
        expect(digTime(s, T.SOIL, 0)).toBeLessThan(0.25);
    });
    test('the gates: hard rock wants DRILL 2, basalt DRILL 3, the deep a hull, the sinew bone', () => {
        const s = newState(7);
        expect(gateOf(s, T.HARD, 70)).toMatch(/DRILL 2/);
        expect(gateOf(s, T.BASALT, 70)).toMatch(/DRILL 3/);
        expect(gateOf(s, T.STONE, 120)).toMatch(/HULL 1/);
        s.levels.hull = 2;
        expect(gateOf(s, T.STONE, 260)).toMatch(/HULL 3/);
        expect(gateOf(s, T.SINEW, 10)).toMatch(/bone/);
    });
    test('digging down then flying home delivers the ore, and parts come in piece by piece', () => {
        const s = newState(7);
        const mem = {};
        let t = 0;
        while (s.delivered === 0 && t < 60) { step(s, 0.05, { decide: (st) => decide(st, mem).dir }); s.events.length = 0; t += 0.05; }
        expect(s.delivered).toBeGreaterThan(0);
        expect(t).toBeLessThan(30);                  // first ore home within 30 s
    });
    test('an empty battery: recovered home, cargo gone, a tenth of the reserve lost', () => {
        const s = preparedState({ row: 10 });
        s.y = 10; s.cargo = [T.ROCK, T.ROCK]; s.battery = 0.01; s.reserve = 50;
        step(s, 0.05, { dir: 'left' });
        step(s, 0.5, { dir: 'left' });
        expect(s.y).toBe(-1);
        expect(s.cargo).toEqual([]);
        expect(s.reserve).toBeLessThanOrEqual(40);
        expect(s.line.text).toBe('Recovered. The cargo is gone.');
    });
    test('once a dive, when the battery is just enough to fly home: Turn back.', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.battery = 20;
        step(s, 0.05, {});
        expect(s.line.text).toBe('Turn back. Just enough power to fly home.');
    });
    test('the colony at 0 %: a pod goes dark every three seconds', () => {
        const s = newState(7);
        s.reserve = 0;
        for (let i = 0; i < Math.round(POD_EVERY * 2 / 0.05) + 1; i++) step(s, 0.05, {});
        expect(sleepers(s)).toBe(214);
        expect(s.line.text).toMatch(/^Pod \d+ went dark\.$/);
    });
    test('the workshop: only at the base, only with the parts; a graft makes the sleepers dream', () => {
        const s = newState(7);
        s.parts = PRICES[0];
        s.y = 3;
        expect(buy(s, 'drill')).toBe(false);
        s.y = -1;
        expect(buy(s, 'drill')).toBe(true);
        expect(s.levels.drill).toBe(1);
        expect(s.parts).toBe(0);
        s.bio = 6; s.bioSeen = true;
        expect(buyGraft(s)).toBe(true);
        expect(s.dreaming).toBe(true);
        expect(s.line.text).toBe('The sleepers are dreaming of you.');
    });
    test('touching the heart ends it: Woke: everyone is here.', () => {
        const s = preparedState({ row: 397, levels: { drill: 3, hull: 3 }, grafts: 3 });
        s.y = 397; s.x = HOME_X;
        for (let i = 0; i < 10 && !s.ended; i++) step(s, 0.05, { dir: 'down' });
        expect(s.ended).toBe(true);
        expect(s.line.text).toBe('Woke: everyone is here.');
    });
    test('a save comes back the same', () => {
        const s = preparedState({ row: 20, parts: 40 });
        const back = deserialize(serialize(s));
        expect(Array.from(back.tiles)).toEqual(Array.from(s.tiles));
        expect(back.parts).toBe(40);
    });
});

describe('which chapter IV', () => {
    test('?deep= wins, then the stored choice, else colony', () => {
        expect(chosenDeep('?deep=dig', 'vault')).toBe('dig');
        expect(chosenDeep('', 'vault')).toBe('vault');
        expect(chosenDeep('?debug', null)).toBe('colony');
        expect(chosenDeep('?deep=nonsense', 'nonsense')).toBe('colony');
        expect(nextDeep('colony')).toBe('vault');
        expect(nextDeep('dig')).toBe('colony');
        expect(deepModule('dig')).toBe('./phase4d/index.js');
        expect(deepModule('colony')).toBe('./phase4/index.js');
    });
});
