// deep-organs: the organs as pure rules (organs.js): the prices, the work, the four ratios, the reach.
import {
    ORGANS, CHEAP, cheapOrgans, takeMass, regrowMass, takeWork, pumpFill, trickleFill, bodySums, pulseRatio,
    nerveRatio, massRate, paceOf, weakestOf, heartPump, beyondReach, fitsReach, migrateOrgans, organOf, fullFloors,
    neededOrgan, PUMP_STEP, TAKE_FLOOR, WORK_FLOOR, PUMP_ON_BEAT, DEMAND_FLOOR, SUPPLY_FLOOR, FULL_FLOOR, PACE_MIN,
    TRICKLE, DREAM_TRICKLE, LID_REACH, ORGAN_K, surgeOf, SURGE_MAX, TAKE_WORK,
} from './organs.js';
import { graphFromSlots, distances, HEART, MACHINE } from './growth.js';

const PATTERN = ['mine', 'dorm', 'farm', 'generator'];
const slots = Array.from({ length: 20 }, (_, i) => PATTERN[i % 4]);
const graph = graphFromSlots(slots);
const st = (body, organs = {}, necrotic = []) => ({ body: [HEART, ...body], necrotic, organs });

describe('the four organs and the ring', () => {
    test('four organs; the room\'s old function makes one cheap', () => {
        expect(ORGANS).toEqual(['vat', 'gut', 'heart', 'nerve']);
        expect(cheapOrgans('dorm')).toEqual(['vat']);
        expect(cheapOrgans('mine')).toEqual(['gut']);
        expect(cheapOrgans('generator')).toEqual(['heart']);
        expect(cheapOrgans('farm')).toEqual(['vat', 'gut']);
        expect(cheapOrgans('cryo')).toEqual(['nerve']);
        // s0 is a mine: a gut there costs CHEAP of the rest
        expect(takeMass(graph, 's0', 'gut')).toBe(Math.ceil(takeMass(graph, 's0', 'vat') * CHEAP));
    });
    test('deeper costs more mass and more work (uphill); every take before raises the price', () => {
        const deep = graph.nodes.find((n) => n.floor === 1 && n.kind === 'room').id;
        // the prices are whole numbers: the ratio within a rounding of TAKE_FLOOR
        expect(Math.abs(takeMass(graph, deep, 'nerve') / takeMass(graph, 's2', 'nerve') - TAKE_FLOOR)).toBeLessThan(0.1);
        expect(takeWork(graph, deep) / takeWork(graph, 's2')).toBeCloseTo(WORK_FLOOR, 5);
        expect(takeMass(graph, 's2', 'nerve', 10)).toBeGreaterThan(takeMass(graph, 's2', 'nerve', 0));
        expect(takeMass(graph, MACHINE, 'hands')).toBeGreaterThan(takeMass(graph, 's2', 'nerve'));
        expect(regrowMass(graph, 's2', 'heart')).toBeLessThan(takeMass(graph, 's2', 'heart'));
        expect(takeWork(graph, 's2', { regrow: true })).toBeLessThan(takeWork(graph, 's2'));
    });
});

describe('the pump', () => {
    test('deep-tension: on the beat three times, off it nothing; the surge, hearts make it stronger; the pace slows it', () => {
        expect(pumpFill({ beat: true })).toBe(PUMP_STEP * PUMP_ON_BEAT);
        expect(PUMP_ON_BEAT).toBe(3);
        expect(pumpFill({ beat: false })).toBe(0);
        expect(pumpFill({ beat: true, surge: surgeOf(5) })).toBeCloseTo(PUMP_STEP * PUMP_ON_BEAT * surgeOf(5));
        expect(surgeOf(0)).toBe(1);
        expect(surgeOf(99)).toBe(surgeOf(SURGE_MAX));
        expect(pumpFill({ beat: true, hearts: 1.5 })).toBeCloseTo(PUMP_STEP * PUMP_ON_BEAT * 1.5);
        expect(pumpFill({ beat: true, pace: 0.5 })).toBeCloseTo(PUMP_STEP * PUMP_ON_BEAT * 0.5);
        const s = bodySums(graph, st(['s0', 's3'], { s0: 'heart', s3: 'heart' }));
        expect(heartPump(s)).toBeGreaterThan(1);
    });
    test('left alone a take fills slowly; a dream faster; a player pumping clearly faster than both', () => {
        expect(trickleFill({})).toBe(TRICKLE);
        expect(trickleFill({ dreaming: true })).toBe(DREAM_TRICKLE);
        expect(trickleFill({ spread: 2 })).toBe(2 * TRICKLE);
        // deep-tension: a pump a second, four in five on the beat, with the trickle under it
        const human = (4 * pumpFill({ beat: true }) + pumpFill({ beat: false })) / 5 + TRICKLE;
        expect(human).toBeGreaterThan(4 * TRICKLE);
        // deep-pass4 (B411): a dream grows a room of the first floor in a few seconds (it took 13), yet a player
        // who keeps the beat, a pump a second on it with a heart or two, still fills faster than the dream
        // (and the dream makes only DREAM_MASS times the mass: scripts/sim-phase4.mjs --dreamer is slowest)
        expect(TAKE_WORK / DREAM_TRICKLE).toBeLessThan(5);
        expect(pumpFill({ beat: true, surge: surgeOf(SURGE_MAX), hearts: 1.24 }) + TRICKLE).toBeGreaterThan(1.6 * DREAM_TRICKLE);
    });
});

describe('the four ratios', () => {
    test('a small body is green everywhere; each kind of organ lifts its own gauge', () => {
        const small = bodySums(graph, st([]));
        expect(pulseRatio(small)).toBeGreaterThan(1);
        expect(nerveRatio(small)).toBeGreaterThan(1);
        const body = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];
        const plain = bodySums(graph, st(body, Object.fromEntries(body.map((id) => [id, 'gut']))));
        const hearts = bodySums(graph, st(body, { ...Object.fromEntries(body.map((id) => [id, 'gut'])), s3: 'heart', s7: 'heart' }));
        expect(pulseRatio(hearts)).toBeGreaterThan(pulseRatio(plain));
        expect(massRate(plain)).toBeGreaterThan(massRate(hearts));
        expect(massRate(plain, 2)).toBeGreaterThan(massRate(plain));
    });
    test('the weakest sets the pace, never under PACE_MIN; it names the organ to grow', () => {
        expect(paceOf({ F: 2, E: 0.6, H: 1.4 })).toBe(0.6);
        expect(paceOf({ F: 2, E: 0.01, H: 1.4 })).toBe(PACE_MIN);
        expect(paceOf({ F: 2, E: 3, H: 1.4 })).toBe(1);
        expect(weakestOf({ M: 2, F: 1.2, E: 0.9, H: 1.1 })).toBe('E');
        expect(neededOrgan({ M: 2, F: 1.2, E: 0.9, H: 1.1 })).toBe('heart');
        expect(neededOrgan({ M: 0.5, F: 1.2, E: 0.9, H: 1.1 })).toBe('gut');
    });
    test('a deeper organ asks more than it gives; a full floor gives FULL_FLOOR times', () => {
        expect(DEMAND_FLOOR).toBeGreaterThan(SUPPLY_FLOOR);
        const floor0 = graph.nodes.filter((n) => n.floor === 0 && n.id !== HEART).map((n) => n.id);
        const organs = Object.fromEntries(floor0.map((id) => [id, 'heart']));
        const part = bodySums(graph, st(floor0.slice(0, -1), organs));
        const full = bodySums(graph, st(floor0, organs));
        expect(fullFloors(graph, st(floor0, organs)).has(0)).toBe(true);
        expect(full.give.heart).toBeCloseTo((part.give.heart + 1) * FULL_FLOOR);
    });
});

describe('the edge starves beyond the hearts\' reach', () => {
    test('the farthest organs past the reach, never the lid; a heart brings them back in', () => {
        const ring = graph.nodes.filter((n) => n.floor === 0 && n.kind === 'room').map((n) => n.id);
        const all = Object.fromEntries(ring.map((id) => [id, 'gut']));
        const s = st(ring, all);
        const sums = bodySums(graph, s);
        expect(sums.size).toBeGreaterThan(LID_REACH);
        const far = beyondReach(graph, s, sums, distances(graph, s));
        expect(far.length).toBeGreaterThan(0);
        expect(far).not.toContain(HEART);
        const d = distances(graph, s);
        expect(d.get(far[0])).toBe(Math.max(...ring.map((id) => d.get(id))));
        const healed = st(ring, { ...all, [ring[0]]: 'heart', [ring[1]]: 'heart' });
        expect(beyondReach(graph, healed, bodySums(graph, healed), distances(graph, healed)).length).toBeLessThan(far.length);
        expect(fitsReach(graph, bodySums(graph, st([])), 's0')).toBe(true);
        expect(ORGAN_K).toBeGreaterThan(0);
    });
});

describe('an old body is given organs', () => {
    test('each chamber the organ its room made cheap; a farm alternates; the landings are spine', () => {
        const o = migrateOrgans(graph, [HEART, 's0', 's1', 's2', 's3', 's6', 'h1']);
        expect(o).toEqual({ s0: 'gut', s1: 'vat', s2: 'vat', s3: 'heart', s6: 'gut' });
        expect(organOf(graph, { organs: o }, 'h1')).toBe('spine');
        expect(organOf(graph, { organs: o }, HEART)).toBe('heart');
        expect(organOf(graph, { organs: o }, MACHINE)).toBe('hands');
    });
});
