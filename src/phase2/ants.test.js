/* eslint-env jest */
import { antCount, streetPath, crossPath, reversePath, onIsland, coastRing, ringPoint, ringCoord, ringWalk, ringLength, nearestEdge, landKeeper, shoreline, inPolygon } from './ants.js';
import { boatCourse, roundCourse, courseAt, courseLength, sailSeconds, chooseArmoryPlot, plateExit } from './ants.js';
import { pickChosen, chosenCount, CHOSEN_MAX, enemiesRemain } from './ants.js';

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

    test('onIsland: nothing on the water leg counts as ashore, in either direction', () => {
        const ring = coastRing(grid, 10);
        const theirCoastY = theirs.y - 10 * 0.8;
        const at = (p, x) => { const i = Math.floor(x), k = x - i, a = p[i], b = p[Math.min(i + 1, p.length - 1)]; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; };
        for (let col = 0; col < 5; col++) for (let row = 0; row < 4; row++) {
            const there = crossPath(tile, plate(col, row), 10, grid, theirs);
            const back = reversePath(there);
            for (const p of [there, back]) {
                const toUs = p === there;
                for (let x = 0; x <= p.length - 1; x += 0.05) {
                    const q = at(p, x);
                    const ashore = onIsland(p, Math.floor(x), x - Math.floor(x));
                    // strictly between the two coasts is open water
                    const water = q.y > ring.y + ring.h + 0.5 && q.y < theirCoastY - 0.5;
                    if (water) expect(ashore).toBe(false);
                    // ashore means on the destination's side of the water
                    if (ashore) expect(toUs ? q.y <= ring.y + ring.h + 0.01 : q.y >= theirCoastY - 0.01).toBe(true);
                }
                expect(onIsland(p, p.length - 2, 1)).toBe(true);   // arriving is ashore
            }
        }
        // a street walk never leaves its island
        expect(onIsland(streetPath(plate(0, 0), plate(1, 1), 10), 0, 0)).toBe(true);
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

describe('boatCourse', () => {
    const from = { x: 0, y: 0 }, to = { x: 100, y: 0 };
    test('starts at from and ends at to', () => {
        expect(boatCourse(from, to, 0)).toEqual({ x: 0, y: 0 });
        const end = boatCourse(from, to, 1);
        expect(Math.abs(end.x - 100)).toBeLessThan(1e-9);
        expect(Math.abs(end.y)).toBeLessThan(1e-9);
    });
    test('bends to one side in the middle and is eased (slow at the ends)', () => {
        const mid = boatCourse(from, to, 0.5);
        expect(Math.abs(mid.y)).toBeGreaterThan(1);
        expect(boatCourse(from, to, 0.1).x).toBeLessThan(10);
        expect(boatCourse(from, to, 0.9).x).toBeGreaterThan(90);
    });
});

describe('the war by boat: courses', () => {
    test('roundCourse keeps the ends, merges duplicates and rounds the corners', () => {
        const pts = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
        const poly = roundCourse(pts, 20);
        expect(poly[0]).toEqual({ x: 0, y: 0 });
        expect(poly[poly.length - 1]).toEqual({ x: 100, y: 100 });
        // the corner itself is cut: no point of the course lies on (100, 0)
        expect(poly.some(p => p.x === 100 && p.y === 0)).toBe(false);
        // and never further than the radius from the straight legs
        for (const p of poly) expect(Math.min(Math.abs(p.y), Math.abs(p.x - 100))).toBeLessThanOrEqual(20);
    });
    test('courseAt starts and ends on the course, eased, with a heading along it', () => {
        const poly = roundCourse([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }]);
        expect(courseAt(poly, 0)).toMatchObject({ x: 0, y: 0 });
        const end = courseAt(poly, 1);
        expect(Math.abs(end.x - 200) + Math.abs(end.y - 200)).toBeLessThan(1e-6);
        expect(courseAt(poly, 0.1).x).toBeLessThan(0.1 * courseLength(poly));   // slow out of the harbour
        expect(Math.abs(courseAt(poly, 0.05).angle)).toBeLessThan(1e-9);       // heading east on the first leg
        expect(courseAt(poly, 0.95).angle).toBeCloseTo(Math.PI / 2, 6);         // heading south on the last
    });
    test('a crossing takes 5 to 9 real seconds, longer with distance', () => {
        expect(sailSeconds(10)).toBe(5);
        expect(sailSeconds(1e4)).toBe(9);
        expect(sailSeconds(385)).toBeCloseTo(7, 6);
    });
});

describe('landKeeper and shoreline (v1.70.0: nobody stands in the water)', () => {
    const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    test('a point well inside stays where it is; one outside or on the edge comes in to the margin', () => {
        const keep = landKeeper(square, 8);
        expect(keep({ x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
        for (const p of [{ x: -20, y: -20 }, { x: 120, y: 50 }, { x: 99, y: 99 }]) {
            const q = keep(p);
            expect(inPolygon(square, q)).toBe(true);
            expect(Math.min(q.x, q.y, 100 - q.x, 100 - q.y)).toBeGreaterThanOrEqual(7.9);
        }
        expect(landKeeper(null)).toBeNull();
    });
    test('a ring with a keeper bends its corners onto the land', () => {
        const R = { ...coastRing({ x: 10, y: 10, w: 80, h: 80 }, 20), land: landKeeper(square, 8) };
        for (let s = 0; s < ringLength(R); s += 7) expect(inPolygon(square, ringPoint(R, s))).toBe(true);
    });
    test('shoreline is where the walk from the water reaches the coast', () => {
        const p = shoreline({ x: 50, y: 150 }, { x: 50, y: 50 }, square);
        expect(p.x).toBeCloseTo(50); expect(p.y).toBeCloseTo(100, 0);
        expect(shoreline({ x: 50, y: 150 }, { x: 50, y: 130 }, square)).toBeNull();
    });

    // B220: the armory. A 5 x 4 grid of 100 px plates with a 10 px street, our pier under the bottom-left corner.
    const grid = Array.from({ length: 20 }, (_, i) => ({ x: (i % 5) * 110, y: Math.floor(i / 5) * 110, w: 100, h: 100 }));
    const pier = { x: 18, y: 444, w: 10, h: 80 };
    const town = () => {
        const b = [{ id: 1, type: 'factory' }, { id: 2, type: 'bank' }];
        for (let i = 3; i <= 20; i++) b.push({ id: i, type: i <= 12 ? 'skyscraper' : i <= 16 ? 'superStore' : i <= 18 ? 'district' : 'apartment', population: 1 });
        return b;
    };

    test('chooseArmoryPlot prefers the empty plot nearest the pier', () => {
        const b = town(); b[7] = undefined; b[17] = undefined;
        expect(chooseArmoryPlot(b, pier, grid)).toEqual({ index: 17, was: 'plot' });
    });

    test('chooseArmoryPlot never takes the last plot (the hatch) nor a ruin', () => {
        const b = town(); b[19] = undefined; b[15] = { id: 16, type: 'home', razed: true };
        expect(chooseArmoryPlot(b, pier, grid)).toEqual({ index: 10, was: 'skyscraper' });
    });

    test('chooseArmoryPlot without an empty plot takes the nearest home or store', () => {
        const b = town(); b[3] = { id: 4, type: 'home', population: 10 }; b[5] = { id: 6, type: 'store' };
        // the store (row 1, first column) is nearer the pier than the home (row 0)
        expect(chooseArmoryPlot(b, pier, grid)).toEqual({ index: 5, was: 'store' });
    });

    test('chooseArmoryPlot with no home or store takes the nearest of the rest, never a district, the factory or the bank', () => {
        expect(chooseArmoryPlot(town(), pier, grid)).toEqual({ index: 15, was: 'superStore' });
        const onlyBig = [{ id: 1, type: 'factory' }, { id: 2, type: 'bank' }, { id: 3, type: 'district' }, { id: 4, type: 'district' }];
        expect(chooseArmoryPlot(onlyBig, pier, grid)).toBeNull();
        expect(chooseArmoryPlot([{ id: 1, type: 'factory' }], pier, grid)).toBeNull();
    });

    test('plateExit leaves a bottom-row plate straight onto the road, an inner one by the street on its left', () => {
        const R = coastRing({ x: 0, y: 0, w: 540, h: 430 }, 10);
        const bottom = plateExit(grid[16], R, 10);
        expect(bottom).toEqual([{ x: 160, y: 380 }, { x: 160, y: R.y + R.h }]);
        const inner = plateExit(grid[7], R, 10);
        expect(inner[0]).toEqual({ x: 270, y: 160 });
        expect(inner[1]).toEqual({ x: 270, y: 215 });
        expect(inner[2]).toEqual({ x: 215, y: 215 });
        expect(inner[3]).toEqual({ x: 215, y: R.y + R.h });
    });

    describe('the chosen few (v1.88.0)', () => {
        // a seeded rng (mulberry32), so a run is the same every time
        const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const town = () => {
            const homes = ['home', 'apartment', 'skyscraper', 'district', null];
            return Array.from({ length: 60 }, (_, i) => ({ home: homes[i % 5], inside: i % 3 === 0, kind: i % 7 === 0 ? 'car' : 'person' }));
        };

        test('never more than CHOSEN_MAX, however many are asked for', () => {
            expect(CHOSEN_MAX).toBe(15);
            expect(pickChosen(town(), 40, seeded(1))).toHaveLength(15);
            expect(pickChosen(town(), 12, seeded(1))).toHaveLength(12);
            expect(pickChosen([], 12, seeded(1))).toEqual([]);
            expect(pickChosen(town(), 0, seeded(1))).toEqual([]);
        });

        test('the people who live highest go first, at home before out, and no cars', () => {
            const people = town();
            const few = pickChosen(people, 12, seeded(7)).map(i => people[i]);
            expect(few.every(p => p.kind !== 'car')).toBe(true);
            // 60 people, 12 in districts minus the cars among them: districts first, then skyscrapers
            const districts = people.filter(p => p.home === 'district' && p.kind !== 'car').length;
            expect(few.slice(0, districts).every(p => p.home === 'district')).toBe(true);
            expect(few.slice(districts).every(p => p.home === 'skyscraper')).toBe(true);
            const firstOut = few.findIndex(p => p.home === 'district' && !p.inside);
            expect(few.slice(0, firstOut).every(p => p.inside)).toBe(true);
        });

        test('the same seed gives the same few; another seed may break ties differently', () => {
            const a = pickChosen(town(), 12, seeded(42));
            expect(pickChosen(town(), 12, seeded(42))).toEqual(a);
            expect(new Set(a).size).toBe(a.length);
        });

        test('about one in five, at least three, never more than twelve', () => {
            expect(chosenCount(0)).toBe(0);
            expect(chosenCount(2)).toBe(2);
            expect(chosenCount(10)).toBe(3);
            expect(chosenCount(40)).toBe(8);
            expect(chosenCount(60)).toBe(12);
            expect(chosenCount(600)).toBe(12);
        });
    });
});

describe('enemiesRemain (B219)', () => {
    test('their walkers stand on their island before and during the war', () => {
        expect(enemiesRemain(undefined)).toBe(true);
        expect(enemiesRemain(null)).toBe(true);
        expect(enemiesRemain({ active: true })).toBe(true);
        expect(enemiesRemain({ enemyLeft: false, leaveStage: -1 })).toBe(true);
    });
    test('while they withdraw to the rocket (leaveStage 0) they still walk', () => {
        expect(enemiesRemain({ enemyLeft: true, leaveStage: 0 })).toBe(true);
        expect(enemiesRemain({ enemyLeft: true })).toBe(true);
    });
    test('once launched, left or rubble, nobody comes back (a reload included)', () => {
        for (const leaveStage of [1, 2, 3, 6, 7]) expect(enemiesRemain({ enemyLeft: true, leaveStage })).toBe(false);
    });
});
