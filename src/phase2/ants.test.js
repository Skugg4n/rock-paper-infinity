/* eslint-env jest */
import { antCount, streetPath, crossPath, reversePath, coastRing, ringPoint, ringCoord, ringWalk, ringLength, nearestEdge } from './ants.js';

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

    // A 5 × 4 grid of 50 px plates with 10 px streets; their island 100 px below.
    const plate = (col, row) => ({ x: col * 60, y: row * 60, w: 50, h: 50 });
    const grid = { x: 0, y: 0, w: 290, h: 230 };
    const theirs = { x: 60, y: 330, w: 170, h: 40 };
    const tile = { x: 100, y: 330, w: 40, h: 40 };
    const inside = (p, r) => p.x > r.x + 0.5 && p.x < r.x + r.w - 0.5 && p.y > r.y + 0.5 && p.y < r.y + r.h - 0.5;

    test('a crossing has no diagonals and never cuts through a plate', () => {
        for (let col = 0; col < 5; col++) for (let row = 0; row < 4; row++) {
            const dst = plate(col, row);
            const p = crossPath(tile, dst, 10, grid, theirs);
            for (let i = 1; i < p.length; i++) {
                const a = p[i - 1], b = p[i];
                expect(Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01).toBe(true);
                // sample the leg: nothing inside any plate but the target (the last leg walks into it)
                for (let k = 0.1; k < 1; k += 0.1) {
                    const q = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
                    for (let c2 = 0; c2 < 5; c2++) for (let r2 = 0; r2 < 4; r2++) {
                        if (c2 === col && r2 === row) continue;
                        expect(inside(q, plate(c2, r2))).toBe(false);
                    }
                }
            }
        }
    });

    test('a crossing lands on the coast nearest the target and keeps its markers when reversed', () => {
        const ring = coastRing(grid, 10);
        const south = crossPath(tile, plate(2, 3), 10, grid, theirs);
        expect(south.edge).toBe('s');
        expect(south[south.ourCoast].y).toBeCloseTo(ring.y + ring.h);   // reaches our coast from the water
        expect(south[south.crossFrom].y).toBeLessThan(theirs.y);        // leaves from their coast road
        const east = crossPath(tile, plate(4, 1), 10, grid, theirs);
        expect(east.edge).toBe('e');
        expect(east[east.land].x).toBeCloseTo(ring.x + ring.w);
        const north = crossPath(tile, plate(1, 0), 10, grid, theirs);
        expect(north.edge).toBe('n');
        const back = reversePath(south);
        expect(back[back.crossFrom]).toEqual(south[south.crossFrom]);
        expect(back[back.land]).toEqual(south[south.land]);
        expect(back.crossFrom).toBeGreaterThan(back.land);              // ours first, theirs later
    });

    test('the coast ring: coordinates round-trip and walks turn at corners', () => {
        const R = coastRing(grid, 10);
        for (const s of [0, 40, R.w + 10, R.w + R.h + 5, 2 * R.w + R.h + 30]) expect(ringCoord(R, ringPoint(R, s))).toBeCloseTo(s);
        const walk = ringWalk(R, R.w + R.h + 10, R.w - 10);    // bottom edge round the bottom-right corner to the top
        for (let i = 1; i < walk.length; i++) {
            const a = walk[i - 1], b = walk[i];
            expect(Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01).toBe(true);
        }
        expect(ringLength(R)).toBeCloseTo(2 * (R.w + R.h));
        expect(nearestEdge(plate(2, 2), grid)).toBe('s');                  // the side facing them counts one plate closer
    });

    test('streetPath never puts a street point inside another plate column', () => {
        const a = { x: 240, y: 0, w: 50, h: 50 };   // right column
        const b = { x: 0, y: 120, w: 50, h: 50 };   // left column, next row
        const p = streetPath(a, b, 10);
        const vertical = p.filter(pt => pt.x === 235); // gap left of the source
        expect(vertical.length).toBe(2);
    });
});
