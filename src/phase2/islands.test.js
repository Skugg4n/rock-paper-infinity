/* eslint-env jest */
import { coastPath, coastPoints, rng } from './islands.js';

describe('islands', () => {
    test('rng is deterministic and in [0,1)', () => {
        const a = rng(42), b = rng(42);
        const xs = Array.from({ length: 5 }, () => a());
        const ys = Array.from({ length: 5 }, () => b());
        expect(xs).toEqual(ys);
        xs.forEach(x => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
    });

    test('coastPath is a closed smooth path around the rect', () => {
        const d = coastPath({ x: 100, y: 100, w: 300, h: 200 }, { pad: 30, points: 12, seed: 3 });
        expect(d.startsWith('M ')).toBe(true);
        expect(d.endsWith(' Z')).toBe(true);
        expect((d.match(/ C /g) || []).length).toBe(12);
        // every coordinate lies outside the rect but within rect + 2·pad
        const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
        for (let i = 0; i < nums.length; i += 2) {
            expect(nums[i]).toBeGreaterThanOrEqual(100 - 60);
            expect(nums[i]).toBeLessThanOrEqual(400 + 60);
            expect(nums[i + 1]).toBeGreaterThanOrEqual(100 - 60);
            expect(nums[i + 1]).toBeLessThanOrEqual(300 + 60);
        }
    });

    test('bumps only go outward: no vertex lies inside the unbumped outline', () => {
        const rect = { x: 50, y: 50, w: 300, h: 150 };
        const base = coastPoints(rect, { pad: 40, points: 24, wobble: 0, seed: 9 });
        const bumped = coastPoints(rect, { pad: 40, points: 24, wobble: 0.4, seed: 9 });
        const cx = 200, cy = 125;
        bumped.forEach((p, i) => {
            expect(Math.hypot(p.x - cx, p.y - cy)).toBeGreaterThanOrEqual(Math.hypot(base[i].x - cx, base[i].y - cy) - 1e-9);
        });
    });

    test('same seed gives the same coast, different seed a different one', () => {
        const r = { x: 0, y: 0, w: 200, h: 100 };
        expect(coastPath(r, { seed: 1 })).toBe(coastPath(r, { seed: 1 }));
        expect(coastPath(r, { seed: 1 })).not.toBe(coastPath(r, { seed: 2 }));
    });
});
