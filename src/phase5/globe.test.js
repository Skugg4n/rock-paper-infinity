/* eslint-env jest */
import { project, unproject, cellAtLatLon, latOf, lonOf, TILT } from './globe.js';
import { CELLS } from './terrain.js';
import { UNITY_CHECKPOINTS } from './checkpoints.js';
import * as U from './unity.js';

describe('chapter V, the globe (fas 3)', () => {
    test('every map cell has a place on the sphere and back', () => {
        for (let i = 0; i < CELLS; i += 37) expect(cellAtLatLon(latOf(i), lonOf(i))).toBe(i);
    });
    test('projecting and unprojecting a point gives it back (the side that faces us)', () => {
        for (const [lat, lon, rot] of [[0.3, 0.2, 0], [-0.6, 1.1, 0.8], [0.9, -2.0, -1.7]]) {
            const [x, y, z] = project(lat, lon, rot, TILT);
            if (z <= 0) continue;
            const p = unproject(x, y, rot, TILT);
            expect(p.lat).toBeCloseTo(lat, 5);
            expect(Math.cos(p.lon - lon)).toBeCloseTo(1, 5);
        }
        expect(unproject(0.9, 0.9, 0)).toBeNull();
    });
    test('the planet checkpoint: the seeds are there to send, and a seed flies before it lands', () => {
        const s = UNITY_CHECKPOINTS['v-planet']();
        expect(s.scale).toBe(4);
        expect(s.ex.seeds).toBe(true);
        expect(U.visibleExperiments(s).some((e) => e.kind === 'seed')).toBe(true);
        const sea = U.seas(s)[0];
        expect(sea.name).toMatch(/^THE /);
        U.setDesign(s, { drift: sea.dist, skin: sea.salt, mind: 1, roots: sea.join, acid: 0 });
        expect(U.sendSeed(s, sea.k)).toBe('joined');
        expect(s.seeds.flying).toHaveLength(1);
        for (let k = 0; k < U.SEED_FLIGHT_S * 4 + 4; k++) { U.advance(s, 0.25); while (s.tut.stop) U.closeStop(s); }
        expect(s.seeds.flying).toHaveLength(0);
        expect(s.seeds.continents[sea.k]).toBe('joined');
    });
    test('WE LOOK UP lights only when we are one, warm, and cover about 41 % of the surface', () => {
        const s = UNITY_CHECKPOINTS['v-planet']();
        s.one = true; s.ex.warm = true; s.insight = 20;
        expect(U.visibleExperiments(s).some((e) => e.id === 'lookup')).toBe(false);
        const c = U.cache(s);
        for (let i = 0; i < CELLS && U.area(s) < CELLS * U.LOOK_UP_AT; i++) if (!c.eaten[i]) s.order.push(i);
        U.cache(s);
        expect(U.visibleExperiments(s).some((e) => e.id === 'lookup')).toBe(true);
        expect(U.buy(s, 'lookup')).toBe(true);
        expect(s.ended).toBe(true);
        expect(s.tut.stop.text).toEqual(['WE LOOK UP.']);
        expect(U.areaText(s)).toBe('41 % of the surface');
    });
});
