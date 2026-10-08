/* eslint-env jest */
import * as U from './unity.js';
import { mapFor, stormAt, CELLS, RIM, ROCK, PAPER, SCISSORS, SEA, CITY_WEATHER_AT } from './terrain.js';

const closeAll = (s) => { while (s.tut.stop) U.closeStop(s); };
function started() { const s = U.newUnity(); U.advance(s, 0.1); closeAll(s); return s; }

describe('chapter V, the rules', () => {
    test('the body comes up as a few blocks of the city, and the first stop says how to bite', () => {
        const s = U.newUnity();
        expect(U.area(s)).toBe(6);
        U.advance(s, 0.1);
        expect(s.tut.stop.id).toBe('start');
        expect(s.tut.stop.text).toEqual(['197 MINDS. ONE BODY.', 'THE CITY ABOVE US IS EMPTY. IT IS FOOD.', 'Click the edge to bite.']);
    });

    test('a click on the edge bites a block, until the body cannot stretch further', () => {
        const s = started();
        const fr = U.front(s, 1)[0];
        expect(U.bite(s, fr)).toBe(fr);
        expect(U.area(s)).toBe(7);
        expect(s.pool).toBeGreaterThan(0);
        let n = 0;
        while (U.bite(s, U.front(s, 1)[0]) >= 0) n++;
        expect(U.area(s)).toBeGreaterThanOrEqual(U.totalMass(s) * U.STRETCH);
        expect(n).toBeLessThan(10);
        // not the edge: no bite
        expect(U.bite(s, mapFor(s.seed, 0).start)).toBe(-1);
    });

    test('nutrient buys mass in fas 1; the price rises', () => {
        const s = started();
        s.nutrient = 10;
        const p0 = U.buyPrice(s, 'stomach');
        expect(U.buyMass(s, 'stomach')).toBe(true);
        expect(U.buyPrice(s, 'stomach')).toBeGreaterThan(p0);
        expect(s.mass.stomach).toBeCloseTo(U.START_MASS.stomach + U.BUY_MASS);
    });

    test('rock paper scissors at the edge: the right mode eats whole, the wrong one a third, a draw two thirds', () => {
        expect(U.modeMult('WRAP', ROCK)).toBe(1);
        expect(U.modeMult('CUT', PAPER)).toBe(1);
        expect(U.modeMult('CRUSH', SCISSORS)).toBe(1);
        expect(U.modeMult('WRAP', SCISSORS)).toBeCloseTo(1 / 3);
        expect(U.modeMult('CUT', ROCK)).toBeCloseTo(1 / 3);
        expect(U.modeMult('CRUSH', PAPER)).toBeCloseTo(1 / 3);
        expect(U.modeMult('WRAP', PAPER)).toBeCloseTo(2 / 3);
        expect(U.bestMode(SCISSORS)).toBe('CRUSH');
    });

    test('AUTONOMIC EDGE: the edge eats by itself, NERVE is grown, GROW AS sums to 100', () => {
        const s = started();
        expect(U.needText(s, U.visibleExperiments(s).find((e) => e.id === 'auto'))).toBe('Need 400 more thought.');
        s.thought = 400;
        expect(U.buy(s, 'auto')).toBe(true);
        expect(s.unlocked.nerve).toBe(true);
        expect(Object.values(s.grow).reduce((a, b) => a + b, 0)).toBe(100);
        expect(s.grow.nerve).toBeGreaterThan(0);
        const a0 = U.area(s);
        for (let k = 0; k < 400; k++) U.advance(s, 0.25);
        expect(U.area(s)).toBeGreaterThan(a0);
        // no more biting by hand
        expect(U.bite(s, U.front(s, 1)[0])).toBe(-1);
    });

    test('GROW AS: setting one share moves the others so the sum stays 100; locked organs have no row', () => {
        const s = started();
        s.thought = 400; U.buy(s, 'auto');
        U.setGrow(s, 'skin', 60);
        expect(s.grow.skin).toBe(60);
        expect(Object.values(s.grow).reduce((a, b) => a + b, 0)).toBe(100);
        expect(s.grow.brain).toBeUndefined();
        expect(U.setGrow(s, 'brain', 20)).toBe(false);
    });

    test('the city rim is a storm wall; it tears thin skin and GRAVEL IN THE SKIN holds it', () => {
        const m = mapFor(7, 0);
        const rim = m.rim.findIndex((v) => v === 1);
        expect(stormAt(m, rim, 0, 0)).toBe(1);
        expect(stormAt(m, m.start, 0, 0)).toBe(0);
        expect(stormAt(m, m.start, CITY_WEATHER_AT - 1, 0)).toBe(0);
        expect(RIM).toBeGreaterThan(0);
    });

    test('the red word is the single lowest factor, and only one at a time', () => {
        const s = started();
        s.thought = 400; U.buy(s, 'auto');
        s.mass.heart = 0.05;
        const f = U.flows(s);
        expect(f.red.organ).toBe('heart');
        expect(f.red.word).toBe('Weak pulse.');
        s.mass.heart = 50;
        const g = U.flows(s);
        expect(g.red == null || g.red.organ !== 'heart').toBe(true);
    });

    test('a block whose fix will not fit in memory makes the red word "Forgetting."', () => {
        const s = started();
        s.thought = 400; U.buy(s, 'auto');
        s.scale = 2; s.memory = 10;
        const f = U.flows(s);
        const e = U.visibleExperiments(s).find((x) => x.id === 'granite');
        expect(U.needText(s, e)).toBe('More than we can remember.');
        expect(f.cap).toBeLessThan(6000);
    });

    test('the zoom: the body becomes a dot on the next map, its size kept in km²', () => {
        const s = started();
        s.thought = 400; U.buy(s, 'auto');
        const c = U.cache(s);
        // eat most of the city by decree
        for (let i = 0; i < CELLS && U.area(s) < CELLS * U.ZOOM_AT; i++) if (!c.eaten[i] && mapFor(s.seed, 0).obst[i] === 0) s.order.push(i);
        const km = U.area(s) * U.tileKm2(0);
        U.advance(s, 0.1);
        expect(s.zoom).toBeTruthy();
        U.zoomDone(s);
        expect(s.tut.stop.text).toEqual(['The city is ours.']);
        U.closeStop(s);
        expect(s.scale).toBe(1);
        expect(U.area(s) * U.tileKm2(1)).toBeGreaterThan(km * 0.6);
        expect(U.area(s)).toBeLessThan(40);
        expect(U.areaText(s)).toMatch(/km²$/);
    });

    test('units: km² until the planet, then a share of the surface; no e-notation anywhere', () => {
        const s = U.newUnity();
        expect(U.areaText(s, 600)).toBe('3.3 km²');
        s.scale = 2; expect(U.areaText(s, 700)).toBe('38 281 km²');
        s.scale = 3; expect(U.areaText(s, 600)).toBe('2.1 M km²');
        s.scale = 4; expect(U.areaText(s, 1050)).toBe('41 % of the surface');
        expect(U.big(2.1e6)).toBe('2.1 M');
        expect(U.big(4.3e9)).toBe('4.3 B');
        expect(U.big(12400)).toBe('12 400');
    });

    test('a vault seen by the eyes and reached by the body: JOIN gives minds and a stop with one line', () => {
        const s = started();
        s.thought = 400; U.buy(s, 'auto');
        s.scale = 1;
        const m = mapFor(s.seed, 1);
        expect(m.vault).toBeGreaterThanOrEqual(0);
        s.seen[1] = true;
        s.order = [m.vault];
        U.cache(s);
        const j = U.visibleExperiments(s).find((e) => e.kind === 'join');
        expect(j.title).toBe('JOIN · 140 minds');
        expect(U.buy(s, 'join')).toBe(true);
        expect(s.minds).toBe(197 + 140);
        expect(s.tut.stop.text).toEqual(['140 minds join us.']);
    });

    test('seeds: the design decides; too little drift dies in the sea, no mind sits stuck, enough of all joins', () => {
        const s = U.newUnity();
        s.scale = 4; s.ex.seeds = true; s.order = []; s.mass.tissue = 100;
        const seas = U.seas(s);
        expect(seas.length).toBeGreaterThanOrEqual(4);
        const sea = seas[0];
        expect(U.setDesign(s, { drift: 11 })).toBe(false);
        U.setDesign(s, { drift: 0, acid: 10 });
        expect(U.sendSeed(s, sea.k)).toBe('sea');
        U.setDesign(s, { drift: sea.dist, skin: sea.salt, mind: 0, roots: 3 });
        expect(U.sendSeed(s, sea.k)).toBe('stuck');
        U.setDesign(s, { drift: sea.dist, skin: sea.salt, mind: 1, roots: sea.join });
        expect(U.sendSeed(s, sea.k)).toBe('joined');
        expect(s.seeds.continents[sea.k]).toBe('joined');
    });

    test('the oceans of the planet are not eaten; the coasts of the continent are, slowly, with SALT SKIN', () => {
        const s = U.newUnity();
        const m4 = mapFor(s.seed, 4), m3 = mapFor(s.seed, 3);
        const sea4 = m4.obst.findIndex((o) => o === SEA), sea3 = m3.obst.findIndex((o) => o === SEA);
        s.ex.salt = true;
        s.scale = 3; expect(U.edible(s, m3, sea3)).toBeGreaterThan(0);
        s.scale = 4; expect(U.edible(s, m4, sea4)).toBe(0);
    });

    test('guides: one at a time, never more often than every 40 s, each line once', () => {
        const s = U.newUnity();
        s.t = 100;
        expect(U.guide(s, 'a', 'Dr Okafor', 'One.')).toBe(true);
        s.t = 120;
        expect(U.guide(s, 'b', 'Mr Lund', 'Two.')).toBe(false);
        s.t = 141;
        expect(U.guide(s, 'b', 'Mr Lund', 'Two.')).toBe(true);
        s.t = 200;
        expect(U.guide(s, 'b', 'Mr Lund', 'Two.')).toBe(false);
        expect(s.log.at(-1)).toBe('Mr Lund: Two.');
    });

    test('save and load keep the game', () => {
        const s = started();
        s.thought = 123; s.order.push(U.front(s, 1)[0]);
        const t = U.deserialize(U.serialize(s));
        expect(t.thought).toBe(123);
        expect(t.order).toEqual(s.order);
        expect(U.deserialize('{"v":0}')).toBeNull();
    });

    test('the vault hands over the people in the body', () => {
        expect(U.fromVault(197).minds).toBe(197);
        expect(U.fromVault(212).tut.done.start).toBeUndefined();
    });

    test('player words have no em-dash', () => {
        const all = JSON.stringify([U.EXPERIMENTS.map((e) => [e.title, e.line]), U.MULTIS.map((e) => e.line), U.LINES.goal, U.LINES.ours, U.RED_GUIDE, U.VANCE, U.SEED_WORDS, U.DONE_LINES, Object.values(U.ORGANS).map((o) => o.word)]);
        expect(all).not.toMatch(/—/);
    });
});
