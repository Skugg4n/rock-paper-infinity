/* eslint-env jest */
import { makeWorld, W, H, T, depthOf, HARD_BAND, BASALT_BAND, SINEW_BAND } from './world.js';
import {
    newState, step, buy, buyGraft, gateOf, digTime, serialize, deserialize, preparedState, sleepers, PRICES, POD_EVERY, HOME_X,
    closeStop, stopOpen, shows, rowShown, STOPS, INTRO, ROW_GAP, LINES, ping, pingShows, gpsReady, GPS,
    boost, teleport, shock, litAt, lampRadius,
} from './dig.js';
import { qOrder, has, LAB_S, Q_LINES } from './quantum.js';
import { FIRST_FAIL, REPAIR_S, spotOf, repairCost, ALARM_LINES } from './alarms.js';
import { decide, readStop } from './autopilot.js';
import { roomSpot, roomAt, chamberOf, chamberOver } from './base.js';

/** A fresh game past its first stops. */
function started() {
    const s = newState(7);
    while (stopOpen(s)) closeStop(s);
    return s;
}
import { chosenDeep, nextDeep, deepModule } from '../deepVersion.js';

describe('the world', () => {
    test('is seeded: the same seed lays the same ground', () => {
        expect(Array.from(makeWorld(3).tiles)).toEqual(Array.from(makeWorld(3).tiles));
        expect(Array.from(makeWorld(3).tiles)).not.toEqual(Array.from(makeWorld(4).tiles));
    });
    test('24 wide, 400 deep, the bottom at 2 000 m; the gates are whole bands; twelve finds; a heart', () => {
        const w = makeWorld(7);
        expect(w.tiles.length).toBe(W * H);
        expect(depthOf(H - 1)).toBe(2000);
        for (let x = 0; x < W; x++) {
            expect(w.tiles[HARD_BAND[0] * W + x]).toBe(T.HARD);
            expect(w.tiles[BASALT_BAND[0] * W + x]).toBe(T.BASALT);
            expect(w.tiles[SINEW_BAND[0] * W + x]).toBe(T.SINEW);
        }
        expect(Object.keys(w.finds)).toHaveLength(12);
        expect(Array.from(w.tiles).filter((t) => t === T.HEART).length).toBeGreaterThan(4);
    });
});

describe('the rules', () => {
    test('soil digs in 0.25 s, a better drill digs faster', () => {
        const s = newState(7);
        expect(digTime(s, T.SOIL, 0)).toBeCloseTo(0.25);
        s.levels.drill = 1;
        expect(digTime(s, T.SOIL, 0)).toBeLessThan(0.25);
    });
    test('the gates: hard rock wants DRILL 2, basalt DRILL 3, the deep a hull, the sinew bone', () => {
        const s = newState(7);
        expect(gateOf(s, T.HARD, 70)).toMatch(/DRILL 2/);
        expect(gateOf(s, T.BASALT, 70)).toMatch(/DRILL 3/);
        expect(gateOf(s, T.STONE, 120)).toMatch(/HULL 1/);
        s.levels.hull = 2;
        expect(gateOf(s, T.STONE, 260)).toMatch(/HULL 3/);
        expect(gateOf(s, T.SINEW, 10)).toMatch(/bone/);
    });
    test('digging down then flying home delivers the ore, and parts come in piece by piece', () => {
        const s = newState(7);
        const mem = {};
        let t = 0;
        while (s.delivered === 0 && t < 90) {
            if (stopOpen(s)) { t += readStop(s); continue; }
            step(s, 0.05, { decide: (st) => decide(st, mem).dir }); s.events.length = 0; t += 0.05;
        }
        expect(s.delivered).toBeGreaterThan(0);
        expect(t).toBeLessThan(60);                  // first ore home within a minute, stops read
    });
    test('the first recoveries cost only the cargo', () => {
        const s = preparedState({ row: 10 });
        s.y = 10; s.cargo = [T.ROCK]; s.battery = 0.01; s.reserve = 50;
        step(s, 0.05, { dir: 'left' }); step(s, 0.5, { dir: 'left' });
        expect(s.y).toBe(-1);
        expect(s.cargo).toEqual([]);
        expect(s.reserve).toBe(50);
    });
    test('the colony does not drink before the first purchase, and its gauge comes when it does', () => {
        const s = started();
        for (let i = 0; i < 200; i++) step(s, 0.05, {});
        expect(s.reserve).toBe(100);
        s.tut.rows.push('battery');
        s.x = roomSpot('workshop');
        s.parts = 100; expect(buy(s, 'battery')).toBe(true);
        for (let i = 0; i < 200; i++) step(s, 0.05, {});
        expect(s.reserve).toBe(100);
        expect(shows(s, 'gen')).toBe(false);
        for (let i = 0; i < 1200; i++) step(s, 0.05, {});
        expect(shows(s, 'gen')).toBe(true);
        expect(s.reserve).toBeLessThan(100);
    });
    test('an empty battery, later on: recovered home, cargo gone, a tenth of the reserve lost', () => {
        const s = preparedState({ row: 10 });
        s.deaths = 3;
        s.y = 10; s.cargo = [T.ROCK, T.ROCK]; s.battery = 0.01; s.reserve = 50;
        step(s, 0.05, { dir: 'left' });
        step(s, 0.5, { dir: 'left' });
        expect(s.y).toBe(-1);
        expect(s.cargo).toEqual([]);
        expect(s.reserve).toBeLessThanOrEqual(40);
        expect(s.line.text).toBe('Recovered. The cargo is gone.');
    });
    test('once a dive, when the battery is just enough to fly home: Turn back.', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.battery = 8;
        step(s, 0.05, {});
        expect(s.line.text).toBe('Turn back. Just enough power to fly home.');
    });
    test('pressing up under rock in a side tunnel says where the way up is', () => {
        const s = preparedState({ row: 10 });
        s.y = 10;
        s.tiles[10 * W + HOME_X + 1] = T.AIR; s.tiles[10 * W + HOME_X + 2] = T.AIR;
        s.tiles[9 * W + HOME_X + 2] = T.STONE;
        s.x = HOME_X + 2;
        step(s, 0.05, { dir: 'up' });
        expect(s.line.text).toBe('Up only through open ground. The way up is to the left.');
    });
    test('up under a ledge: the drone hovers, it does not bounce, and costs little', () => {
        const s = preparedState({ row: 10 });
        s.y = 10;
        s.tiles[11 * W + HOME_X] = T.AIR; s.tiles[12 * W + HOME_X] = T.AIR;   // open below
        s.tiles[9 * W + HOME_X] = T.STONE;                                    // a ledge above
        const b0 = s.battery;
        const ys = new Set();
        for (let i = 0; i < 40; i++) { step(s, 0.05, { dir: 'up' }); ys.add(s.y); }
        expect([...ys]).toEqual([10]);
        expect(b0 - s.battery).toBeLessThan(1);
    });
    test('ore right above a tunnel can be dug from below', () => {
        const s = preparedState({ row: 10 });
        s.y = 10; s.tiles[9 * W + HOME_X] = T.ROCK;
        for (let i = 0; i < 12; i++) step(s, 0.05, { dir: 'up' });
        expect(s.cargo).toContain(T.ROCK);
    });
    test('up with a side held turns into the first opening on that side', () => {
        const s = preparedState({ row: 20 });
        s.y = 20;
        s.tiles[15 * W + HOME_X - 1] = T.AIR;
        s.tiles[14 * W + HOME_X] = T.STONE;                                   // the shaft's ceiling
        for (let i = 0; i < 60 && s.x === HOME_X; i++) step(s, 0.05, { dir: 'up', side: 'left' });
        expect(s.x).toBe(HOME_X - 1);
        expect(s.y).toBe(15);
    });
    test('the turn-back line is on only while it is true', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.battery = 8;
        step(s, 0.05, {});
        expect(s.line.kind).toBe('turnback');
        s.battery = 200; s.levels.battery = 3;
        step(s, 0.05, {});
        expect(s.line.text).toBe('');
    });
    test('the colony at 0 %: a pod goes dark every three seconds', () => {
        const s = started();
        s.reserve = 0;
        for (let i = 0; i < Math.round(POD_EVERY * 2 / 0.05) + 1; i++) step(s, 0.05, {});
        expect(sleepers(s)).toBe(214);
        expect(s.line.text).toMatch(/^Pod \d+ went dark\.$/);
    });
    test('the workshop: only in its room, only rows it shows, only with the parts; a graft makes the sleepers dream', () => {
        const s = started();
        s.parts = PRICES[0];
        s.y = 3;
        expect(buy(s, 'drill')).toBe(false);
        s.y = -1; s.x = roomSpot('workshop');
        expect(buy(s, 'drill')).toBe(false);          // not shown yet
        s.tut.rows.push('drill');
        s.x = HOME_X;
        expect(buy(s, 'drill')).toBe(false);          // not in the room
        s.x = roomSpot('workshop');
        expect(buy(s, 'drill')).toBe(true);
        expect(s.levels.drill).toBe(1);
        expect(s.parts).toBe(0);
        s.bio = 6; s.bioSeen = true;
        expect(buyGraft(s)).toBe(true);
        expect(s.dreaming).toBe(true);
        expect(s.line.text).toBe('The sleepers are dreaming of you.');
    });
    test('touching the heart ends it: Woke: everyone is here.', () => {
        const s = preparedState({ row: 397, levels: { drill: 3, hull: 3 }, grafts: 3 });
        s.y = 397; s.x = HOME_X;
        const said = [];
        for (let i = 0; i < 200 && !s.ended; i++) { step(s, 0.05, { dir: 'down' }); if (!said.includes(s.line.text)) said.push(s.line.text); }
        expect(said).toEqual(expect.arrayContaining(['It beats.', 'Come home.', 'Almost.']));
        expect(s.ended).toBe(true);
        expect(s.line.text).toBe('Woke: everyone is here.');
    });
    test('a save comes back the same', () => {
        const s = preparedState({ row: 20, parts: 40 });
        const back = deserialize(serialize(s));
        expect(Array.from(back.tiles)).toEqual(Array.from(s.tiles));
        expect(back.parts).toBe(40);
    });
});

describe('which chapter IV', () => {
    test('?deep= wins, then the stored choice, else colony', () => {
        expect(chosenDeep('?deep=dig', 'vault')).toBe('dig');
        expect(chosenDeep('', 'vault')).toBe('vault');
        expect(chosenDeep('?debug', null)).toBe('colony');
        expect(chosenDeep('?deep=nonsense', 'nonsense')).toBe('colony');
        expect(nextDeep('colony')).toBe('vault');
        expect(nextDeep('dig')).toBe('colony');
        expect(deepModule('dig')).toBe('./phase4d/index.js');
        expect(deepModule('colony')).toBe('./phase4/index.js');
    });
});

describe('pass 3: one thing at a time', () => {
    test('the arrival is typed, then one stop: dig; the game stands still while a stop is open', () => {
        const s = newState(7);
        expect(s.tut.stop.id).toBe('arrive');
        expect(STOPS.arrive).toEqual([INTRO, '216 SLEEPERS.']);
        step(s, 1, { dir: 'down' });
        expect(s.time).toBe(0);
        expect(s.y).toBe(-1);
        closeStop(s);
        expect(s.tut.stop.text).toEqual(['The generators burn ore. Dig.']);
        expect(SHOWS_AT_START(s)).toEqual([]);
        closeStop(s);
        expect(stopOpen(s)).toBe(false);
    });
    test('at the start only down goes; the first tile dug shows POWER, with its stop', () => {
        const s = started();
        for (let i = 0; i < 10; i++) step(s, 0.05, { dir: 'left' });
        expect(s.x).toBe(HOME_X);
        for (let i = 0; i < 20 && !stopOpen(s); i++) step(s, 0.05, { dir: 'down' });
        expect(s.y).toBe(0);
        expect(shows(s, 'power')).toBe(true);
        expect(s.tut.stop.text).toEqual(['Power. It takes you down and brings you home.']);
    });
    test('CARGO at the first ore, DEPTH at 20 m, PARTS and the workshop (one row: BATTERY) at the first delivery', () => {
        const s = started();
        expect(shows(s, 'cargo') || shows(s, 'depth') || shows(s, 'parts')).toBe(false);
        s.tut.dug = true; s.tut.show.power = true; s.tut.done.power = true;
        s.tiles[0 * W + HOME_X] = T.ROCK;
        for (let i = 0; i < 20 && !s.cargo.length; i++) step(s, 0.05, { dir: 'down' });
        expect(shows(s, 'cargo')).toBe(true);
        expect(shows(s, 'depth')).toBe(false);
        for (let i = 0; i < 80 && s.y < 3; i++) step(s, 0.05, { dir: 'down' });
        expect(shows(s, 'depth')).toBe(true);
        // home through the hatch, to the warehouse
        for (let i = 0; i < 80 && s.y > -1; i++) step(s, 0.05, { dir: 'up' });
        expect(s.y).toBe(-1);
        for (let i = 0; i < 20; i++) step(s, 0.05, {});
        expect(s.cargo.length).toBe(1);                       // not unloaded at the hatch
        expect(s.line.text).toBe(LINES.unload);
        for (let i = 0; i < 40 && roomAt(s.x) !== 'warehouse'; i++) step(s, 0.05, { dir: 'left' });
        for (let i = 0; i < 20; i++) step(s, 0.05, {});
        expect(s.cargo.length).toBe(0);
        expect(shows(s, 'parts')).toBe(true);
        expect(s.tut.rows).toEqual(['battery']);
        expect(rowShown(s, 'drill')).toBe(false);
    });
    test('a new row comes with a need, one a dive, at least ROW_GAP apart', () => {
        const s = started();
        s.tut.rows = ['battery']; s.tut.revealDive = 0; s.tut.revealAt = 0;
        s.tut.needs = ['steering', 'drill'];
        const dive = () => { s.y = 3; step(s, 0.05, {}); s.y = -1; s.x = HOME_X; step(s, 0.05, {}); };
        step(s, 0.05, {});
        s.time = ROW_GAP + 1; dive();
        expect(s.tut.rows).toEqual(['battery', 'steering']);
        dive();
        expect(s.tut.rows).toEqual(['battery', 'steering']);   // too soon
        s.time += ROW_GAP; dive();
        expect(s.tut.rows).toEqual(['battery', 'steering', 'drill']);
        expect(s.line.text).toBe('New in the workshop: DRILL.');
    });
    test('hard rock asks for the DRILL row; a full cargo three times for CARGO', () => {
        const s = preparedState({ row: 58 });
        s.tut.rows = ['battery']; s.y = 58; s.x = HOME_X;
        step(s, 0.05, { dir: 'down' });
        expect(s.tut.needs).toContain('drill');
    });
    test('steering I is coarse: one press goes two steps; STEERING II one', () => {
        const s = preparedState({ row: 10 });
        s.levels.steering = 0;
        s.y = 10;
        for (let x = 0; x < W; x++) s.tiles[10 * W + x] = T.AIR;
        for (let x = 0; x < W; x++) s.tiles[11 * W + x] = T.STONE;
        step(s, 0.05, { dir: 'right' });
        for (let i = 0; i < 20; i++) step(s, 0.05, {});
        expect(s.x).toBe(HOME_X + 2);
        s.levels.steering = 1;
        step(s, 0.05, { dir: 'right' });
        for (let i = 0; i < 20; i++) step(s, 0.05, {});
        expect(s.x).toBe(HOME_X + 3);
    });
    test('the base: down from a room drives to the hatch; up into the base only through the hatch', () => {
        const s = preparedState({ row: 5 });
        s.y = -1; s.x = roomSpot('workshop') + 2;
        for (let i = 0; i < 60 && s.y < 1; i++) step(s, 0.05, { dir: 'down' });
        expect(s.x).toBe(HOME_X);
        expect(s.y).toBeGreaterThanOrEqual(0);
        const t = preparedState({ row: 5 });
        t.y = 0; t.x = HOME_X + 1; t.tiles[HOME_X + 1] = T.AIR;
        for (let i = 0; i < 10; i++) step(t, 0.05, { dir: 'up' });
        expect(t.y).toBe(0);
        expect(t.line.text).toMatch(/^Up only through open ground/);
    });
    test('the chambers: 36 sleepers each, six of them', () => {
        expect(chamberOf(1)).toBe(0);
        expect(chamberOf(216)).toBe(5);
        expect(chamberOver(HOME_X)).toBe(-1);
        expect(chamberOver(2)).toBe(0);
    });
    test('an old save without the guide gets one: everything shown, no stop', () => {
        const s = preparedState({ row: 70, levels: { drill: 2 } });
        const o = JSON.parse(serialize(s)); delete o.tut;
        const back = deserialize(JSON.stringify(o));
        expect(stopOpen(back)).toBe(false);
        expect(shows(back, 'power')).toBe(true);
        expect(rowShown(back, 'drill')).toBe(true);
    });
});
const SHOWS_AT_START = (s) => Object.keys(s.tut.show).filter((k) => s.tut.show[k]);

describe('pass 3, step 2: the base breaks, the tools are upgrades', () => {
    const at = (s, x) => { s.y = -1; s.x = x; };
    test('the first failure comes after about three minutes; missed, ten sleepers in that chamber die', () => {
        const s = started();
        s.tut.on = false;
        s.y = 10;
        let failAt = null;
        for (let i = 0; i < 20 * 60 * 6 && !s.alarms.lost; i++) {
            step(s, 0.05, {});
            for (const e of s.events) if (e.type === 'fail' && failAt === null) failAt = s.time;
            s.events.length = 0;
            s.battery = 40; s.reserve = 100;
        }
        expect(failAt).toBeGreaterThanOrEqual(FIRST_FAIL - 1);
        expect(failAt).toBeLessThan(FIRST_FAIL + 1);
        expect(s.alarms.lost).toBe(10);
        expect(sleepers(s)).toBe(206);
        // away without the radio: the news waits for the base
        expect(s.alarms.unseen[0]).toMatch(/^Chamber \d went dark\. 10 sleepers died\.$/);
        at(s, HOME_X); s.wasHome = false;
        step(s, 0.05, {});
        expect(s.line.text).toMatch(/went dark\. 10 sleepers died\./);
    });
    test('home with a chamber failing: a stop the first time; mended in two seconds under it, for parts', () => {
        const s = started();
        s.tut.dug = true;
        s.alarms.list.push({ id: 'c3', at: 0, until: 500 });
        at(s, HOME_X); s.parts = 50;
        step(s, 0.05, {});
        expect(s.tut.stop.text).toEqual(['A chamber is failing. Return to base and repair it.']);
        expect(s.tut.needs).toContain('radio');
        closeStop(s);
        at(s, spotOf('c3'));
        for (let i = 0; i < Math.ceil(REPAIR_S / 0.05) + 2; i++) step(s, 0.05, {});
        expect(s.alarms.list).toEqual([]);
        expect(s.parts).toBe(50 - repairCost(depthOf(s.record)));
    });
    test('a stopped generator: POWER does not charge at home until it is mended', () => {
        const s = started();
        s.tut.on = false;
        s.alarms.genDown = true;
        at(s, HOME_X); s.battery = 20;
        for (let i = 0; i < 40; i++) step(s, 0.05, {});
        expect(s.battery).toBe(20);
        s.parts = 100;
        at(s, spotOf('gen'));
        for (let i = 0; i < 60; i++) step(s, 0.05, {});
        expect(s.alarms.genDown).toBe(false);
        expect(s.battery).toBeGreaterThan(20);
    });
    test('the alarm tag says what and how long', () => {
        expect(ALARM_LINES.tag('c2', 39.2)).toBe('CHAMBER 3 · 40 s');
        expect(ALARM_LINES.tag('gen', 5)).toBe('GENERATOR · 5 s');
    });
    test('GPS: a ping shows ore below in a cone, not above; it recharges; GPS II is wider and quicker', () => {
        const s = preparedState({ row: 40 });
        s.y = 40; s.x = HOME_X;
        expect(ping(s)).toBe(false);                     // no GPS yet
        s.levels.gps = 1;
        expect(ping(s)).toBe(true);
        expect(pingShows(s, HOME_X, 46)).toBe(true);
        expect(pingShows(s, HOME_X, 35)).toBe(false);
        expect(pingShows(s, HOME_X + 9, 41)).toBe(false);
        expect(ping(s)).toBe(false);                     // recharging
        s.time += GPS[1].recharge; expect(gpsReady(s)).toBe(true);
        expect(GPS[2].range).toBeGreaterThan(GPS[1].range);
        expect(GPS[2].recharge).toBeLessThan(GPS[1].recharge);
    });
    test('the first turn back asks for the HOMING LINE; ore that was not there for the GPS', () => {
        const s = preparedState({ row: 30 });
        s.tut.rows = ['battery']; s.tut.needs = [];
        s.y = 30; s.battery = 8;
        step(s, 0.05, {});
        expect(s.tut.needs).toContain('homing');
        s.tiles[31 * W + HOME_X] = T.GHOST; s.battery = 40;
        for (let i = 0; i < 30; i++) step(s, 0.05, { dir: 'down' });
        expect(s.tut.needs).toContain('gps');
    });
});

describe('pass 3, step 3: things from the other side, the flesh', () => {
    test('six quantum objects in the rock, none in the city; BOOSTER or SHOCK WAVE first, never THE OTHER DRONE', () => {
        for (const seed of [1, 3, 7, 11, 42]) {
            const w = makeWorld(seed);
            expect(w.quantum).toHaveLength(6);
            for (const i of w.quantum) { expect(w.tiles[i]).toBe(T.QUANTUM); expect(depthOf(Math.floor(i / W))).toBeGreaterThan(60); }
            const o = qOrder(seed);
            expect(['booster', 'shock']).toContain(o[0]);
            expect(new Set(o).size).toBe(6);
        }
    });
    test('dug, it is carried (not cargo); in the LAB it takes 60 s; told at the base as a stop; then it is the drone\'s', () => {
        const s = preparedState({ row: 20 });
        s.y = 20; s.tiles[21 * W + HOME_X] = T.QUANTUM;
        for (let i = 0; i < 30 && !s.quantum.carry.length; i++) step(s, 0.05, { dir: 'down' });
        expect(s.quantum.carry).toHaveLength(1);
        expect(s.cargo).toHaveLength(0);
        expect(s.line.text).toBe('It flickers. Take it to the LAB.');
        s.y = -1; s.x = roomSpot('lab'); s.act = null;
        step(s, 0.05, {});
        expect(s.quantum.carry).toHaveLength(0);
        s.x = HOME_X;
        for (let i = 0; i < Math.ceil(LAB_S / 0.05) + 100 && !stopOpen(s); i++) step(s, 0.05, {});
        const first = s.quantum.order[0];
        expect(s.tut.stop.text[0]).toBe(`The lab opened it. It was a ${first === 'booster' ? 'BOOSTER' : 'SHOCK WAVE'}.`);
        expect(has(s, first)).toBe(true);
    });
    test('THE OTHER DRONE: It is us. It is not us.', () => {
        expect(Q_LINES.opened('other')).toBe('The lab opened it. It was a drone.');
        expect(Q_LINES.use.other).toBe('It is us. It is not us.');
    });
    test('a quantum object carried goes back to its rock when the drone is recovered', () => {
        const s = preparedState({ row: 20 });
        s.y = 20; s.quantum.carry = [25 * W + 3]; s.tiles[25 * W + 3] = T.AIR; s.battery = 0.01;
        step(s, 0.05, { dir: 'left' }); step(s, 0.5, { dir: 'left' });
        expect(s.tiles[25 * W + 3]).toBe(T.QUANTUM);
        expect(s.quantum.carry).toEqual([]);
    });
    test('BOOSTER: twice as fast at half the power; TELEPORT: home at once; SHOCK WAVE: eats two tiles round, ore to the cargo', () => {
        const a = preparedState({ row: 20 }), b = preparedState({ row: 20 });
        for (const s of [a, b]) { s.y = 20; s.quantum.got.push('booster', 'teleport', 'shock'); }
        expect(boost(b)).toBe(true);
        const a0 = a.battery, b0 = b.battery;
        for (const s of [a, b]) for (let y = 21; y < 60; y++) s.tiles[y * W + HOME_X] = T.SOIL;
        for (let i = 0; i < 60; i++) { step(a, 0.05, { dir: 'down' }); step(b, 0.05, { dir: 'down' }); }
        expect(b.y - 20).toBeGreaterThan((a.y - 20) * 1.6);
        expect((b0 - b.battery) / (b.y - 20)).toBeLessThan((a0 - a.battery) / (a.y - 20));
        expect(boost(b)).toBe(false);                    // recharging
        const c = preparedState({ row: 40 });
        c.y = 40; c.quantum.got.push('shock', 'teleport');
        c.tiles[41 * W + HOME_X + 1] = T.ROCK; c.tiles[42 * W + HOME_X] = T.STONE;
        expect(shock(c)).toBe(true);
        expect(c.tiles[42 * W + HOME_X]).toBe(T.AIR);
        expect(c.cargo).toContain(T.ROCK);
        expect(teleport(c)).toBe(true);
        expect(c.y).toBe(-1);
    });
    test('the SECOND LAMP lights farther down; the DEEP BATTERY charges in the heat', () => {
        const s = preparedState({ row: 260, levels: { hull: 3, drill: 3, battery: 3 } });
        s.y = 260; s.x = HOME_X; s.quantum.got = [];
        const r = lampRadius(s);
        expect(litAt(s, HOME_X, 260 + Math.ceil(r) + 1)).toBe(false);
        s.quantum.got.push('lamp2');
        expect(litAt(s, HOME_X, 260 + Math.ceil(r) + 1)).toBe(true);
        expect(litAt(s, HOME_X, 260 - Math.ceil(r) - 1)).toBe(false);
        s.tiles[261 * W + HOME_X] = T.STONE;
        s.battery = 50; s.grafts = 3;
        step(s, 1, {});
        const without = s.battery;
        s.quantum.got.push('deepbat'); s.battery = 50;
        step(s, 1, {});
        expect(s.battery).toBeGreaterThan(without);
    });
    test('the warm rock stops the game once; the first biomass at the base: the lab speaks, GRAFT lights', () => {
        const s = preparedState({ row: 218, levels: { hull: 2, drill: 3 } });
        s.tut.done.warm = false;
        s.y = 218; s.x = HOME_X;
        for (let i = 0; i < 80 && !stopOpen(s); i++) step(s, 0.05, { dir: 'down' });
        expect(s.tut.stop.text).toEqual(['The rock is warm. Warm like skin. We should not be here.']);
        const t = started();
        t.bioHome = false; t.bioSeen = false; t.delivered = 5; t.tut.rows = ['battery'];
        t.cargo = [T.BIO]; t.y = -1; t.x = roomSpot('warehouse');
        for (let i = 0; i < 10; i++) step(t, 0.05, {});
        expect(t.line.text).toBe('This is not rock. It is growing in the tank.');
        expect(t.tut.fresh).toBe('graft');
    });
});
