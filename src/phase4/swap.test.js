// deep-swap: the strata view is the default for chapter IV, the 3D view stays selectable, and the
// body's neighbours follow the view the player sees.
import { chosenView, otherView, urlForView, placeFor, VIEWS, VIEW_KEY } from './views.js';
import { placeChamber, CHAMBERS_PER_FLOOR } from './layout.js';
import { sectionPlace, panToShow, panLimit, sleepHomeY, strataLabels, strataLayers, reconstructHistory, trackHistory, FLOOR0 } from './strata.js';
import { graphOf, setChamberPlace, chamberPlace } from './grow.js';
import { reachable, HEART } from './growth.js';

describe('which view draws the colony', () => {
    test('the strata view is the default; ?view=3d or the stored choice makes the 3D one; the URL wins', () => {
        expect(VIEWS[0]).toBe('strata');
        expect(VIEW_KEY).toBe('rpi-deep-view');
        expect(chosenView('', null)).toBe('strata');
        expect(chosenView('?debug', null)).toBe('strata');
        expect(chosenView('?debug&view=3d', null)).toBe('3d');
        expect(chosenView('?view=3D', null)).toBe('3d');
        expect(chosenView('', '3d')).toBe('3d');
        expect(chosenView('?view=strata', '3d')).toBe('strata');
        expect(chosenView('?view=nonsense', null)).toBe('strata');
        expect(otherView('strata')).toBe('3d');
        expect(otherView('3d')).toBe('strata');
    });
    test('the menu sets a view already in the URL, and leaves a URL without one alone', () => {
        expect(urlForView('http://x/?debug&view=3d', 'strata')).toBe('http://x/?debug&view=strata');
        expect(urlForView('http://x/?debug', '3d')).toBe('http://x/?debug');
    });
    test('each view places chamber i its own way', () => {
        expect(placeFor('3d')).toBe(placeChamber);
        expect(placeFor('strata')).toBe(sectionPlace);
    });
});

describe('the body\'s neighbours follow the view', () => {
    const layout = { slots: new Array(CHAMBERS_PER_FLOOR * 2).fill('mine') };
    afterEach(() => setChamberPlace(null));

    test('in the strata view a floor is a row: the lid touches its two first chambers, each chamber its row neighbours', () => {
        setChamberPlace(sectionPlace);
        expect(chamberPlace()).toBe(sectionPlace);
        const g = graphOf(layout);
        const at = new Map(g.nodes.map((n) => [n.id, n]));
        for (const e of g.edges.filter((x) => x.kind === 'bridge')) {
            const a = at.get(e.a), b = at.get(e.b);
            expect(a.floor).toBe(b.floor);
            expect(Math.abs(a.x - b.x) + Math.abs(a.z - b.z)).toBe(1);
            expect(a.z).toBe(0);
        }
        expect(reachable(g, { body: [HEART], necrotic: [] }).sort()).toEqual(['s0', 's1']);
        // s0 is column -1, s2 column -2: a chamber two out grows only from the one beside it
        expect(reachable(g, { body: [HEART, 's0'], necrotic: [] }).sort()).toEqual(['s1', 's2']);
    });
    test('in the 3D view the lid touches its four arms', () => {
        setChamberPlace(placeChamber);
        const g = graphOf(layout);
        expect(reachable(g, { body: [HEART], necrotic: [] }).sort()).toEqual(['s0', 's1', 's2', 's3']);
    });
    test('changing the view rebuilds the graph for the same layout', () => {
        setChamberPlace(sectionPlace);
        const a = graphOf(layout);
        setChamberPlace(placeChamber);
        const b = graphOf(layout);
        expect(a).not.toBe(b);
        expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
    });
});

describe('the strata view\'s framing', () => {
    test('the camera pans only when the colony is wider than the room between the panel and the ruler', () => {
        expect(panLimit(1440, 348, 3, 46)).toBe(0);
        expect(panLimit(1440, 348, 6, 44)).toBeGreaterThan(0);
        // a target in view stays put; one past the edge is brought in, inside the limit
        expect(panToShow(2, 0, 10, 3)).toBe(0);
        expect(panToShow(14, 0, 10, 3)).toBe(3);
        expect(panToShow(-12, 0, 10, 5)).toBeCloseTo(-3.6);
    });
    test('asleep the camera rests with YEAR 0 a little under the middle, the first floor still on the screen', () => {
        const ppu = 34, viewH = 900 / ppu;
        const y = sleepHomeY(viewH, ppu);
        const screenOf = (wy) => 450 - (wy - y) * ppu;
        expect(screenOf(0)).toBeGreaterThan(450);
        expect(screenOf(FLOOR0)).toBeLessThanOrEqual(900 - 50);
    });
    test('the ruler names a year once: boundaries that read the same, or 0, are left out', () => {
        const layers = strataLayers(reconstructHistory(5000, 40));
        const labels = strataLabels(layers, 0.4);
        const texts = labels.filter((l) => l.kind === 'year').map((l) => Math.round(l.years));
        expect(new Set(texts).size).toBe(texts.length);
        expect(texts.every((t) => t >= 1)).toBe(true);
        expect(labels[labels.length - 1].kind).toBe('zero');
    });
    test('a first sleep of a few months shows YEAR 0 alone', () => {
        expect(strataLabels(strataLayers([0.25]), 0.4)).toEqual([{ y: 0, years: 0, kind: 'zero' }]);
    });
    test('an old save without layers is given one per sleep from the years slept', () => {
        const h = trackHistory(undefined, 4926, 40);
        expect(h).toHaveLength(40);
        expect(h.reduce((a, b) => a + b, 0)).toBeCloseTo(4926);
        // kept with the save, the same array comes back while nothing changed
        expect(trackHistory(h, 4926, 40)).toBe(h);
    });
});
