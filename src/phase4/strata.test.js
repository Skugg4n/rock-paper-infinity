import * as S from './strata.js';
import { graphFromSlots, createGrowth, reachable, take } from './growth.js';
import { CHAMBERS_PER_FLOOR } from './layout.js';

describe('the section: a row per floor', () => {
    test('a floor grows outward from the shaft on both sides, with no hole', () => {
        const cols = Array.from({ length: CHAMBERS_PER_FLOOR }, (_, i) => S.sectionColumn(i));
        expect(cols.slice(0, 4)).toEqual([-1, 1, -2, 2]);
        expect(new Set(cols).size).toBe(CHAMBERS_PER_FLOOR);
        expect(cols).not.toContain(0);
        for (let n = 1; n <= CHAMBERS_PER_FLOOR; n++) {
            const left = cols.slice(0, n).filter((c) => c < 0).map((c) => -c).sort((a, b) => a - b);
            left.forEach((c, i) => expect(c).toBe(i + 1));
        }
    });
    test('the thirteenth chamber starts the next floor, one pitch down', () => {
        const a = S.chamberPos(0), b = S.chamberPos(CHAMBERS_PER_FLOOR);
        expect(b.floor).toBe(1);
        expect(b.col).toBe(-1);
        expect(a.y - b.y).toBeCloseTo(S.FLOOR_PITCH);
        expect(S.floorLine(0)).toBeLessThan(S.HOUSE.y0);
        expect(S.HOUSE.y1).toBeLessThan(S.OLD_GROUND[S.OLD_GROUND.length - 1]);
    });
    test('the body graph built with sectionPlace is the row: the front walks the corridor', () => {
        const slots = ['mine', 'farm', 'generator', 'dorm', 'mine', null];
        const g = graphFromSlots(slots, S.sectionPlace);
        let s = createGrowth(g);
        expect(reachable(g, s).sort()).toEqual(['s0', 's1']);          // only the two by the shaft
        s = take(g, s, 's0');
        expect(reachable(g, s).sort()).toEqual(['s1', 's2']);           // then the next one out
        s = take(g, s, 's4');
        expect(s.body).not.toContain('s4');                              // not past a gap
    });
});

describe('the strata: the years as layers', () => {
    test('thickness grows with the log of the years', () => {
        expect(S.layerThickness(0)).toBeCloseTo(S.LAYER_MIN);
        expect(S.layerThickness(1e5)).toBeGreaterThan(S.layerThickness(1e3));
        expect(S.layerThickness(1e6)).toBeLessThan(3);
    });
    test('a new sleep opens a layer; the sleep under way thickens the top one', () => {
        let h = S.trackHistory([], 0, 1);
        expect(h).toEqual([0]);
        h = S.trackHistory(h, 40, 1);
        expect(h).toEqual([40]);
        const same = S.trackHistory(h, 40, 1);
        expect(same).toBe(h);
        h = S.trackHistory(h, 40, 2);
        expect(h).toEqual([40, 0]);
        h = S.trackHistory(h, 1040, 2);
        expect(h).toEqual([40, 1000]);
    });
    test('a reload with no history rebuilds one layer per sleep, deeper sleeps thicker', () => {
        const h = S.trackHistory([], 41207, 6);
        expect(h).toHaveLength(6);
        expect(h.reduce((a, b) => a + b, 0)).toBeCloseTo(41207);
        for (let i = 1; i < h.length; i++) expect(h[i]).toBeGreaterThan(h[i - 1]);
        expect(S.trackHistory(h, 10, 1)).toHaveLength(1);                    // a new game
    });
    test('never more than MAX_LAYERS, and the years are kept', () => {
        const h = S.compactHistory(Array.from({ length: 70 }, (_, i) => i + 1));
        expect(h.length).toBeLessThanOrEqual(S.MAX_LAYERS);
        expect(h.reduce((a, b) => a + b, 0)).toBe(70 * 71 / 2);
    });
    test('layers stack from YEAR 0 and the labels never crowd', () => {
        const layers = S.strataLayers([5, 10, 300, 1000, 9000, 31000]);
        expect(layers[0].y0).toBe(0);
        expect(S.surfaceY(layers)).toBeCloseTo(layers.reduce((a, L) => a + (L.y1 - L.y0), 0));
        expect(layers[layers.length - 1].cum).toBe(41315);
        const labels = S.strataLabels(layers, 0.42);
        expect(labels[0].kind).toBe('surface');
        expect(labels[labels.length - 1]).toEqual({ y: 0, years: 0, kind: 'zero' });
        for (let i = 1; i < labels.length; i++) expect(labels[i - 1].y - labels[i].y).toBeGreaterThanOrEqual(0.42 - 1e-9);
        expect(S.formatYears(41207)).toBe('41 207');
    });
});

describe('the camera', () => {
    test('a shallow colony rests with YEAR 0 at most 40 % down; a deep one keeps its deepest floor in view', () => {
        const viewH = 900 / 46;
        expect(0.5 + S.homeY(viewH, 1) / viewH).toBeLessThanOrEqual(0.4 + 1e-9);         // YEAR 0 at most 40 % down
        expect(0.5 - (S.floorLine(0) - S.homeY(viewH, 1)) / viewH).toBeLessThan(0.9);
        const deep = S.homeY(viewH, 9);
        const bottom = deep - viewH / 2;
        expect(S.floorLine(8)).toBeGreaterThan(bottom);
        const lim = S.cameraLimits(viewH, 9, 30);
        expect(lim.max).toBeGreaterThan(deep);
        expect(lim.min).toBeLessThanOrEqual(deep);
        expect(lim.max + viewH / 2).toBeGreaterThan(30);                    // the surface can be seen
    });
    test('the widest floor fits between the panel and the ruler', () => {
        const { ppu } = S.fitScale(1440, 300, S.widestColumn(100));
        expect(ppu).toBeLessThanOrEqual(S.MAX_PPU);
        expect((6 * S.PITCH + S.CH_W / 2) * 2 * ppu).toBeLessThan(1440 - 300 - S.RULER_PX);
        expect(S.fitScale(1440, 300, 3).ppu).toBe(S.MAX_PPU);
    });
});
