/* eslint-env jest */
import {
    placeChamber, floorCount, initialLayout, freeChamber, normalizeLayout,
    CHAMBERS_PER_FLOOR, CHAMBER_CELLS,
} from './layout.js';
import { initialDeepState } from './deep.js';

describe('the deep, laid out', () => {
    test('the arms come first, then the ring outside them, then the floor below', () => {
        expect(placeChamber(0)).toEqual({ floor: 0, x: 0, z: -1 });
        expect(placeChamber(3)).toEqual({ floor: 0, x: -1, z: 0 });
        expect(placeChamber(4)).toEqual({ floor: 0, x: 0, z: -2 });
        expect(placeChamber(CHAMBERS_PER_FLOOR)).toEqual({ floor: 1, x: 0, z: -1 });
        expect(placeChamber(2 * CHAMBERS_PER_FLOOR + 2).floor).toBe(2);
    });

    test('no two chambers share a cell, and none of them is the landing', () => {
        const seen = new Set();
        for (let i = 0; i < 3 * CHAMBERS_PER_FLOOR; i++) {
            const p = placeChamber(i);
            const key = `${p.floor},${p.x},${p.z}`;
            expect(seen.has(key)).toBe(false);
            expect(p.x === 0 && p.z === 0).toBe(false);
            seen.add(key);
        }
    });

    test('every chamber touches one already dug, so a floor is one piece of ground', () => {
        const taken = new Set(['0,0']);
        for (const [x, z] of CHAMBER_CELLS) {
            const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                .some(([dx, dz]) => taken.has(`${x + dx},${z + dz}`));
            expect(touches).toBe(true);
            taken.add(`${x},${z}`);
        }
    });

    test('floors are counted from chambers', () => {
        expect(floorCount(0)).toBe(1);
        expect(floorCount(CHAMBERS_PER_FLOOR)).toBe(1);
        expect(floorCount(CHAMBERS_PER_FLOOR + 1)).toBe(2);
    });

    test('a fresh colony puts its rooms in the first chambers and leaves the rest empty', () => {
        const s = initialDeepState();
        const layout = initialLayout(s);
        expect(layout.slots.length).toBe(s.chambers);
        expect(layout.slots.filter((x) => x === 'generator').length).toBe(1);
        expect(freeChamber(layout)).toBe(-1);           // three rooms in three chambers
        s.chambers += 1;
        expect(freeChamber(initialLayout(s))).toBe(3);
    });

    test('a saved layout is made to fit the state it comes back with', () => {
        const s = initialDeepState();
        s.chambers = 5; s.rooms.mine = 2;
        const fitted = normalizeLayout(s, { slots: ['farm', 'generator', 'dorm'] });
        expect(fitted.slots.length).toBe(5);
        expect(fitted.slots.filter((x) => x === 'mine').length).toBe(2);
        expect(normalizeLayout(s, null).slots.length).toBe(5);
        const trimmed = normalizeLayout({ chambers: 2, rooms: {} }, { slots: ['mine', 'farm', 'dorm'] });
        expect(trimmed.slots.length).toBe(2);
    });
});
