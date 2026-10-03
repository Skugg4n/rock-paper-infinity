import {
    graphFromSlots, createGrowth, reachable, take, whyNot, tick, advance, floorFull, distances,
    outputMultiplier, roomOutput, mass, riseReady, hunger, front, slotOf,
    HEART, MACHINE, hubId, slotId, BODY_OUTPUT, OUTPUT_FLOOR_GROWTH, EAT_PER_ORGAN, VAT_GROWTH,
} from './growth.js';
import { placeChamber } from './layout.js';

// two floors: the twelve chambers of floor 0 and five of floor 1
const SLOTS = ['mine', 'farm', 'generator', 'dorm', 'mine', 'farm', 'generator', 'dorm', 'cryo', 'mine', null, 'farm',
    'mine', 'farm', 'dorm', 'generator', null];
const G = graphFromSlots(SLOTS);
const onFloor = (f) => G.nodes.filter((n) => n.floor === f).map((n) => n.id);
const fill = (s, f) => {
    let st = s;
    for (let guard = 0; guard < 200 && !floorFull(G, st, f); guard++) {
        const next = reachable(G, st).find((id) => G.nodes.find((n) => n.id === id).floor === f);
        if (!next) break;
        st = take(G, st, next);
    }
    return st;
};

describe('the graph', () => {
    test('a landing per floor, every chamber, the machine house', () => {
        expect(onFloor(0)).toHaveLength(13);
        expect(onFloor(1)).toHaveLength(6);
        expect(G.nodes.some((n) => n.id === MACHINE)).toBe(true);
        expect(G.heart).toBe(HEART);
    });
    test('bridges only join neighbours on the same floor', () => {
        const byId = new Map(G.nodes.map((n) => [n.id, n]));
        for (const e of G.edges.filter((x) => x.kind === 'bridge')) {
            const a = byId.get(e.a), b = byId.get(e.b);
            expect(a.floor).toBe(b.floor);
            expect(Math.abs(a.x - b.x) + Math.abs(a.z - b.z)).toBe(1);
        }
    });
    test('the slot of a chamber id', () => {
        expect(slotOf(slotId(7))).toBe(7);
        expect(slotOf(hubId(1))).toBe(-1);
        expect(placeChamber(slotOf('s12')).floor).toBe(1);
    });
});

describe('the front', () => {
    test('the lid is the first organ and its four arms are reachable', () => {
        const s = createGrowth(G);
        expect(s.body).toEqual([HEART]);
        expect(reachable(G, s).sort()).toEqual(['s0', 's1', 's2', 's3']);
    });
    test('take refuses what the body does not touch, and returns the same state', () => {
        const s = createGrowth(G);
        expect(take(G, s, 's5')).toBe(s);           // ring two: not next to the lid
        expect(take(G, s, 's12')).toBe(s);          // the floor below
        expect(take(G, s, MACHINE)).toBe(s);        // the machine waits for a full floor
        expect(whyNot(G, s, 's5')).toMatch(/does not touch/);
        const t = take(G, s, 's0');
        expect(t).not.toBe(s);
        expect(t.body).toContain('s0');
        expect(take(G, t, 's0')).toBe(t);
    });
    test('the body is always one connected thing on its floor', () => {
        let s = createGrowth(G);
        for (let i = 0; i < 8; i++) s = take(G, s, reachable(G, s).filter((id) => id !== MACHINE).pop());
        const d = distances(G, s);
        for (const id of s.body) expect(d.has(id)).toBe(true);
    });
    test('a full floor opens the spine and the neck', () => {
        let s = fill(createGrowth(G), 0);
        expect(floorFull(G, s, 0)).toBe(true);
        expect(reachable(G, s).sort()).toEqual([MACHINE, hubId(1)].sort());
        s = take(G, s, hubId(1));
        expect(reachable(G, s)).toEqual(expect.arrayContaining(['s12', 's13', 's14', 's15']));
        expect(front(G, s)).toEqual({ floor: 1, share: 1 / 6 });
    });
});

describe('hunger, necrosis and vats', () => {
    test('a fed body eats people every year', () => {
        let s = createGrowth(G);
        s = take(G, s, 's0');                       // a mine
        const h = hunger(G, s);
        expect(h.eat).toBeCloseTo(2 * EAT_PER_ORGAN);
        const r = tick(G, s, 100);
        expect(r.people).toBeCloseTo(100 - 2 * EAT_PER_ORGAN);
        expect(r.died).toEqual([]);
    });
    test('the level of the room scales what an organ eats', () => {
        const s = take(G, createGrowth(G), 's0');
        expect(hunger(G, s, { mine: 10 }).eat).toBeGreaterThan(hunger(G, s).eat);
    });
    test('starved, the outermost organ goes necrotic first, one a year, never the heart', () => {
        let s = createGrowth(G);
        for (const id of ['s0', 's1', 's4', 's5']) s = take(G, s, id);     // s4 and s5 are ring two
        let r = tick(G, s, 0);
        expect(r.died).toHaveLength(1);
        expect(['s4', 's5']).toContain(r.died[0]);
        expect(outputMultiplier(G, r.state, r.died[0])).toBe(0);
        for (let i = 0; i < 10; i++) r = tick(G, r.state, 0);
        expect(r.state.necrotic).not.toContain(HEART);
        expect(r.state.necrotic.sort()).toEqual(['s0', 's1', 's4', 's5']);
    });
    test('necrotic flesh does not spread', () => {
        let s = createGrowth(G);
        s = take(G, s, 's0');
        s = { ...s, necrotic: ['s0'] };
        expect(reachable(G, s)).not.toContain('s5');      // (1,-1): beyond the dead arm
        expect(reachable(G, s)).not.toContain('s4');      // (0,-2) beyond the dead arm
    });
    test('fed again, the innermost necrotic organ revives first', () => {
        let s = createGrowth(G);
        for (const id of ['s0', 's4']) s = take(G, s, id);
        s = { ...s, necrotic: ['s4', 's0'] };
        const r = tick(G, s, 1000);
        expect(r.revived).toEqual(['s0']);
        expect(r.state.necrotic).toEqual(['s4']);
    });
    test('a dormitory taken is a vat: it grows people and never dies back', () => {
        let s = createGrowth(G);
        s = take(G, s, 's3');                        // a dorm, west arm
        expect(hunger(G, s).grow).toBeCloseTo(VAT_GROWTH);
        const r = tick(G, s, 0);
        expect(r.grown).toBeCloseTo(VAT_GROWTH);
        expect(r.state.necrotic).toEqual([]);
        // the vat feeds the heart: the people rise
        expect(r.people).toBeCloseTo(VAT_GROWTH - EAT_PER_ORGAN);
    });
    test('deeper floors are hungrier', () => {
        let s = fill(createGrowth(G), 0);
        s = take(G, s, hubId(1));
        const top = hunger(G, take(G, createGrowth(G), 's1')).eat - EAT_PER_ORGAN;
        const before = hunger(G, s).eat;
        s = take(G, s, 's13');
        expect(hunger(G, s).eat - before).toBeGreaterThan(top);
    });
    test('advance jumps a fed body and steps a hungry one', () => {
        let s = createGrowth(G);
        s = take(G, s, 's3');
        const fed = advance(G, s, 0, 1e6);
        expect(fed.people).toBeCloseTo((VAT_GROWTH - EAT_PER_ORGAN) * 1e6);
        expect(fed.state.years).toBe(1e6);
        let h = createGrowth(G);
        for (const id of ['s0', 's1', 's4']) h = take(G, h, id);
        const hungry = advance(G, h, 10, 50);
        expect(hungry.died.length).toBe(3);
        expect(hungry.state.years).toBe(50);
    });
});

describe('output, mass and the rise', () => {
    test('a living organ multiplies, more on deeper floors', () => {
        let s = take(G, createGrowth(G), 's0');
        expect(outputMultiplier(G, s, 's0')).toBe(BODY_OUTPUT);
        expect(outputMultiplier(G, s, 's1')).toBe(1);
        s = fill(s, 0);
        s = take(G, take(G, s, hubId(1)), 's12');
        expect(outputMultiplier(G, s, 's12')).toBeCloseTo(BODY_OUTPUT * OUTPUT_FLOOR_GROWTH);
        const mines = roomOutput(G, s).mine;
        expect(mines.rooms).toBe(4);
        expect(mines.effective).toBeGreaterThan(3 * BODY_OUTPUT);
    });
    test('mass counts living organs only', () => {
        const s = take(G, createGrowth(G), 's0');
        const m = mass(G, s);
        expect(m).toBeGreaterThan(0);
        expect(mass(G, { ...s, necrotic: ['s0'] })).toBeLessThan(m);
    });
    test('ready to rise: the deepest floor full and the machine taken', () => {
        let s = fill(createGrowth(G), 0);
        expect(riseReady(G, s).ready).toBe(false);
        s = take(G, s, MACHINE);
        expect(riseReady(G, s)).toMatchObject({ machine: true, deepestFull: false, ready: false });
        s = take(G, s, hubId(1));
        s = fill(s, 1);
        expect(riseReady(G, s).ready).toBe(true);
    });
    test('any view can hand in its own graph', () => {
        const g = {
            heart: 'a',
            nodes: [{ id: 'a', floor: 0, kind: 'hub' }, { id: 'b', floor: 0, kind: 'room', type: 'farm' },
                { id: 'c', floor: 1, kind: 'hub' }],
            edges: [{ a: 'a', b: 'b', kind: 'bridge' }, { a: 'a', b: 'c', kind: 'spine' }],
        };
        let s = createGrowth(g);
        expect(reachable(g, s)).toEqual(['b']);
        s = take(g, s, 'b');
        expect(reachable(g, s)).toEqual(['c']);
    });
});
