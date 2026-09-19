/* eslint-env jest */
import { antCount, streetPath } from './ants.js';

describe('ants', () => {
    test('antCount grows with the square root and is capped', () => {
        expect(antCount(0)).toBe(0);
        expect(antCount(1)).toBe(2);
        expect(antCount(100)).toBe(10);
        expect(antCount(10000)).toBe(60);
        expect(antCount(1e9)).toBe(60);
    });

    test('streetPath on the same row walks the street under the plates', () => {
        const a = { x: 0, y: 0, w: 50, h: 50 };
        const b = { x: 120, y: 0, w: 50, h: 50 };
        const p = streetPath(a, b, 10);
        expect(p[0]).toEqual({ x: 25, y: 25 });
        expect(p[p.length - 1]).toEqual({ x: 145, y: 25 });
        // the middle of the walk is on the street below the row (y = 55)
        expect(p[1].y).toBe(55);
        expect(p[2].y).toBe(55);
    });

    test('streetPath across rows uses a vertical street between the columns', () => {
        const a = { x: 0, y: 0, w: 50, h: 50 };
        const b = { x: 120, y: 120, w: 50, h: 50 };
        const p = streetPath(a, b, 10);
        // vertical street just right of the source plate: x = 55
        const vertical = p.filter(pt => pt.x === 55);
        expect(vertical.length).toBe(2);
        expect(vertical[0].y).toBe(55);
        expect(vertical[1].y).toBe(175);
        expect(p[p.length - 1]).toEqual({ x: 145, y: 145 });
    });

    test('streetPath never puts a street point inside another plate column', () => {
        const a = { x: 240, y: 0, w: 50, h: 50 };   // right column
        const b = { x: 0, y: 120, w: 50, h: 50 };   // left column, next row
        const p = streetPath(a, b, 10);
        const vertical = p.filter(pt => pt.x === 235); // gap left of the source
        expect(vertical.length).toBe(2);
    });
});
