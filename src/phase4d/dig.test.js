/* eslint-env jest */
import { makeWorld, W, H, T, depthOf, HARD_BAND, BASALT_BAND, SINEW_BAND } from './world.js';
import {
    newState, step, buy, buyGraft, gateOf, digTime, serialize, deserialize, preparedState, sleepers, PRICES, POD_EVERY, HOME_X,
    closeStop, stopOpen, shows, rowShown, STOPS, INTRO, ROW_GAP, LINES, ping, pingShows, gpsReady, GPS,
    boost, teleport, shock, litAt, lampRadius, fit, cargoCap, buyRefinery, THOUGHTS, LOST_WHY, maxHp, mendPlates, PAINTS, priceOf, STUCK_S, isOre, buildDrone, buildPrice, BUILD_S, batteryCap, buyGen, GEN_DRAIN, drainRate, canDigUp,
} from './dig.js';
import { CAVE_WARN, LAVA_STEP, heatHold } from './hazards.js';
import { qOrder, has, LAB_S, Q_LINES, coolOf } from './quantum.js';
import { FIRST_FAIL, REPAIR_S, spotOf, ALARM_LINES } from './alarms.js';
import { decide, readStop } from './autopilot.js';
import { roomSpot, roomAt, chamberOf, chamberOver } from './base.js';

/** Steps the world, reading every stop that opens (as a player clicking OK). */
function run(s, n, input = {}) { for (let i = 0; i < n; i++) { while (stopOpen(s)) closeStop(s); step(s, 0.05, input); } }
/** The lab's gifts, opened and fitted. */
const give = (s, ...ids) => { for (const id of ids) { s.quantum.got.push(id); s.quantum.fit.push(id); } };
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
        expect(Object.keys(w.finds)).toHaveLength(13);
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
    test('the gates: hard rock wants DRILL I, basalt DRILL II, the deep a hull, the sinew bone', () => {
        const s = newState(7);
        expect(gateOf(s, T.HARD, 70)).toBe('Too hard. Needs DRILL I.');
        expect(gateOf(s, T.BASALT, 70)).toBe('Basalt. Needs DRILL II.');
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
        for (let i = 0; i < 1200 && !stopOpen(s); i++) step(s, 0.05, {});
        expect(shows(s, 'gen')).toBe(true);
        expect(s.tut.stop.text).toEqual(['The generators keep them alive. Ore keeps the generators running.']);
        run(s, 200);
        expect(s.reserve).toBeLessThan(100);
    });
    test('an empty battery: the drone is lost where it is, a wreck with its cargo; a new one is built in the workshop', () => {
        const s = preparedState({ row: 10 });
        s.y = 10; s.cargo = [T.ROCK, T.ROCK, T.PAPER, T.PAPER]; s.battery = 0.01; s.reserve = 50;
        step(s, 0.05, { dir: 'left' }); step(s, 0.5, { dir: 'left' });
        expect(s.lost).toBe(true);
        expect(s.wrecks).toHaveLength(1);
        expect(s.wrecks[0].cargo).toHaveLength(4);
        expect(s.reserve).toBe(50);
        expect(stopOpen(s)).toBe(false);                   // first the beat on the screen
        for (let i = 0; i < 120 && !stopOpen(s); i++) step(s, 0.05, {});
        expect(s.tut.stop.text).toEqual(['The battery ran out.', 'The drone is lost. Build another.']);
        closeStop(s);
        const y0 = s.y;
        run(s, 10, { dir: 'down' });
        expect(s.y).toBe(y0);                              // no drone, nothing moves
        expect(buildDrone(s)).toBe(true);
        expect(s.droneN).toBe(2);
        run(s, Math.ceil(BUILD_S / 0.05) + 2);
        expect(s.battery).toBe(batteryCap(s));
        // back at the wreck: half its cargo
        const w = s.wrecks[0];
        s.y = w.y - 1; s.x = w.x; s.cargo = [];
        for (let y = 0; y <= w.y; y++) s.tiles[y * W + w.x] = T.AIR;
        run(s, 10, { dir: 'down' });
        expect(s.cargo).toHaveLength(2);
        expect(s.line.text).toBe('Half of its cargo was still there.');
    });
    test('a new drone: free three times, then 10, 15, 20 parts (never more than there are)', () => {
        const s = started();
        s.parts = 100;
        for (const [n, want] of [[1, 0], [3, 0], [4, 10], [5, 15], [6, 20]]) { s.lostCount = n; expect(buildPrice(s)).toBe(want); }
        s.parts = 7; s.lostCount = 6;
        expect(buildPrice(s)).toBe(0);                        // the wall's DRILL still needs them
        s.levels.drill = 1; s.levels.hull = 1; s.levels.drill = 2; s.levels.hull = 3;
        expect(buildPrice(s)).toBe(7);
    });
    test('EARLY WARNING: at the turn-back point (plus a margin) "Turn back now." once a dive; without it no line', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.battery = 8;
        step(s, 0.05, {});
        expect(s.line.kind).not.toBe('turnback');
        s.levels.warning = 1;
        step(s, 0.05, {});
        expect(s.line.text).toBe('Turn back now.');
        expect(s.warnOn).toBe(true);
    });
    test('up into rock: a bump, no words (the CRT is not spammed)', () => {
        const s = preparedState({ row: 10 });
        s.y = 10;
        for (let x = 0; x < W; x++) { s.tiles[10 * W + x] = T.AIR; s.tiles[9 * W + x] = x === HOME_X ? T.AIR : T.STONE; }
        s.x = HOME_X + 4;
        const ev = [];
        for (let i = 0; i < 20; i++) { step(s, 0.05, { dir: 'up' }); ev.push(...s.events.map((e) => e.type)); s.events.length = 0; }
        expect(s.y).toBe(10);
        expect(ev).toContain('bump');
        expect(s.line.text).toBe("Can't dig up here.");     // once
        const n = s.line.n;
        for (let i = 0; i < 20; i++) step(s, 0.05, { dir: 'up' });
        expect(s.line.n).toBe(n);                            // never again
    });
    test('up under a ledge: the drone hovers, it does not bounce, and costs little', () => {
        const s = preparedState({ row: 10 });
        s.y = 10;
        s.tiles[11 * W + HOME_X] = T.AIR; s.tiles[12 * W + HOME_X] = T.AIR;   // open below
        s.tiles[9 * W + HOME_X] = T.HARD;                                     // a ledge above (too hard to dig)
        const b0 = s.battery;
        const ys = new Set();
        for (let i = 0; i < 40; i++) { step(s, 0.05, { dir: 'up' }); ys.add(s.y); }
        expect([...ys]).toEqual([10]);
        expect(b0 - s.battery).toBeLessThan(1);
    });
    test('ore right above a tunnel can be dug from below', () => {
        const s = preparedState({ row: 10 });
        s.y = 10; s.tiles[9 * W + HOME_X] = T.ROCK; s.levels.updrill = 1;
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
        s.y = 30; s.battery = 8; s.levels.warning = 1;
        step(s, 0.05, {});
        expect(s.line.kind).toBe('turnback');
        s.battery = 200; s.levels.battery = 3;
        step(s, 0.05, {});
        expect(s.line.text).toBe('');
    });
    test('the colony at 0 %: a pod goes dark every three seconds', () => {
        const s = started();
        s.reserve = 0;
        step(s, 0.05, {});
        expect(s.tut.stop.text).toEqual(['The generators stopped. The sleepers are freezing.']);
        run(s, Math.round(POD_EVERY * 2 / 0.05) + 1);
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
    test('the heart: a slow row of stops, one line each, nothing gone before it is read; then the flow; then RISE', () => {
        const s = preparedState({ row: 397, levels: { drill: 3, hull: 3 }, grafts: 3 });
        s.y = 397; s.x = HOME_X;
        const stops = [];
        for (let i = 0; i < 2000 && !s.flowDone; i++) {
            if (stopOpen(s)) {
                // a stop holds: the world does not move on while it is open
                const t0 = s.time; step(s, 1, { dir: 'down' }); expect(s.time).toBe(t0);
                stops.push(s.tut.stop.text[0]); closeStop(s); continue;
            }
            step(s, 0.05, { dir: 'down' });
        }
        expect(stops).toEqual(['Something is beating down here.', 'It beats.', 'Come home.', 'Almost.',
            'The sleepers cannot live on the surface. Not as they are. They are too weak. Too frail. We see them perish in their sleep.',
            'Open the hatch, let them in here.',
            'We will carry them. You and me. The Deep and the Surface. We are one. We are...']);
        expect(s.ended).toBe(true);
        expect(s.flowDone).toBe(true);
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
        for (let i = 0; i < 20 && s.y < 0; i++) step(s, 0.05, { dir: 'down' });
        expect(s.y).toBe(0);
        expect(shows(s, 'power')).toBe(true);
        expect(stopOpen(s)).toBe(false);                 // it does not cut the first dig
        for (let i = 0; i < 40 && !stopOpen(s); i++) step(s, 0.05, {});
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
        expect(s.tut.rows).toEqual(['battery', 'steering']);
        expect(rowShown(s, 'drill')).toBe(false);
    });
    test('a new row comes with a need, one a dive, at least ROW_GAP apart; a row a wall asks for does not wait', () => {
        const s = started();
        s.tut.rows = ['battery']; s.tut.revealDive = 0; s.tut.revealAt = 0;
        s.tut.needs = ['cargo', 'lamp'];
        const dive = () => { s.y = 3; step(s, 0.05, {}); s.y = -1; s.x = HOME_X; step(s, 0.05, {}); };
        step(s, 0.05, {});
        s.time = ROW_GAP + 1; dive();
        expect(s.tut.rows).toEqual(['battery', 'cargo']);
        dive();
        expect(s.tut.rows).toEqual(['battery', 'cargo']);   // too soon
        s.time += ROW_GAP; dive();
        expect(s.tut.rows).toEqual(['battery', 'cargo', 'lamp']);
        expect(s.line.text).toBe('New in the workshop: LAMP.');
        s.tut.needs = ['drill'];
        dive();
        expect(s.tut.rows).toContain('drill');               // the wall's row: at once
    });
    test('hard rock asks for the DRILL row; a full cargo three times for CARGO', () => {
        const s = preparedState({ row: 58 });
        s.tut.rows = ['battery']; s.y = 58; s.x = HOME_X;
        step(s, 0.05, { dir: 'down' });
        expect(s.tut.needs).toContain('drill');
    });
    test('steering I is coarse when digging sideways (two tiles a press); in an open tunnel one step; STEERING II one', () => {
        const s = preparedState({ row: 10 });
        s.levels.steering = 0;
        s.y = 10;
        for (let x = 0; x < W; x++) s.tiles[11 * W + x] = T.STONE;
        for (let x = 0; x < W; x++) if (x !== HOME_X) s.tiles[10 * W + x] = T.SOIL;
        step(s, 0.05, { dir: 'right' });
        for (let i = 0; i < 30; i++) step(s, 0.05, {});
        expect(s.x).toBe(HOME_X + 2);                    // dug two
        for (let x = 0; x < W; x++) s.tiles[10 * W + x] = T.AIR;
        step(s, 0.05, { dir: 'right' });
        for (let i = 0; i < 20; i++) step(s, 0.05, {});
        expect(s.x).toBe(HOME_X + 3);                    // open tunnel: one
        s.levels.steering = 1;
        for (let x = 0; x < W; x++) if (x > s.x) s.tiles[10 * W + x] = T.SOIL;
        step(s, 0.05, { dir: 'right' });
        for (let i = 0; i < 30; i++) step(s, 0.05, {});
        expect(s.x).toBe(HOME_X + 4);
    });
    test('the base: down from a room drives to the hatch; up into the base only through the hatch', () => {
        const s = preparedState({ row: 5 });
        s.y = -1; s.x = roomSpot('workshop') + 2;
        for (let i = 0; i < 60 && s.y < 1; i++) step(s, 0.05, { dir: 'down' });
        expect(s.x).toBe(HOME_X);
        expect(s.y).toBeGreaterThanOrEqual(0);
        const t = preparedState({ row: 5 });
        t.y = 0; t.x = HOME_X + 3; t.tiles[HOME_X + 3] = T.AIR; t.tiles[HOME_X + 2] = T.AIR;
        for (let i = 0; i < 10; i++) step(t, 0.05, { dir: 'up' });
        expect(t.y).toBe(0);
    });
    test('steering I: up held beside the shaft steps into it and flies home; an up press cancels the second side step', () => {
        const s = preparedState({ row: 30 });
        s.levels.steering = 0;
        s.y = 30; s.x = HOME_X + 1;
        s.tiles[30 * W + HOME_X + 1] = T.AIR; s.tiles[31 * W + HOME_X + 1] = T.STONE;
        for (let i = 0; i < 200 && s.y > -1; i++) step(s, 0.05, { dir: 'up' });
        expect(s.y).toBe(-1);
        // from the shaft, a side press goes two steps, unless up comes first
        const t = preparedState({ row: 30 });
        t.levels.steering = 0; t.y = 30; t.x = HOME_X;
        for (let x = 0; x < W; x++) t.tiles[30 * W + x] = T.AIR;
        for (let x = 0; x < W; x++) if (x !== HOME_X) t.tiles[29 * W + x] = T.STONE;
        for (let x = 0; x < W; x++) t.tiles[31 * W + x] = T.STONE;
        step(t, 0.05, { dir: 'right' });
        for (let i = 0; i < 6; i++) step(t, 0.05, { dir: 'up' });
        expect(t.x).toBe(HOME_X);                    // back under the shaft, not two steps out
    });
    test('steering I: the second step never carries the drone past the shaft', () => {
        const s = preparedState({ row: 30 });
        s.levels.steering = 0; s.y = 30; s.x = HOME_X + 1;
        for (let x = 0; x < W; x++) s.tiles[30 * W + x] = T.AIR;
        for (let x = 0; x < W; x++) if (x !== HOME_X) s.tiles[29 * W + x] = T.STONE;
        for (let x = 0; x < W; x++) s.tiles[31 * W + x] = T.STONE;
        step(s, 0.05, { dir: 'left' });
        for (let i = 0; i < 10; i++) step(s, 0.05, {});
        expect(s.x).toBe(HOME_X);
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
        expect(s.alarms.unseen[0].text).toMatch(/^While you were gone: chamber \d went dark\. 10 died\.$/);
        at(s, HOME_X); s.wasHome = false;
        step(s, 0.05, {});
        expect(s.line.text).toMatch(/^While you were gone: chamber \d went dark\. 10 died\.$/);
    });
    test('home with a chamber failing: a stop the first time; mended in two seconds under it, for parts', () => {
        const s = started();
        s.tut.dug = true;
        s.alarms.list.push({ id: 'c3', at: 0, until: 500 });
        at(s, HOME_X); s.parts = 50;
        step(s, 0.05, {});
        expect(s.tut.stop.text).toEqual(['A chamber is failing. Drive to it and repair it.']);
        expect(s.tut.needs).toContain('radio');
        closeStop(s);
        s.alarms.list[0].cost = 17;                   // the price set when the alarm started
        s.record = 300;                               // deeper since: the price does not move
        at(s, spotOf('c3'));
        for (let i = 0; i < Math.ceil(REPAIR_S / 0.05) + 2; i++) step(s, 0.05, {});
        expect(s.alarms.list).toEqual([]);
        expect(s.parts).toBe(50 - 17);
        expect(s.line.text).toBe('Chamber 4 is mended.');
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
        s.levels.gps = 3; s.time += 100; ping(s);
        expect(pingShows(s, HOME_X, 35)).toBe(true);          // GPS III: the whole circle
        expect(GPS[4].recharge).toBe(GPS[1].recharge / 2);
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
    test('seven quantum objects in the rock, none in the city; BOOSTER or SHOCK WAVE first, never THE OTHER DRONE', () => {
        for (const seed of [1, 3, 7, 11, 42]) {
            const w = makeWorld(seed);
            expect(w.quantum).toHaveLength(7);
            for (const i of w.quantum) { expect(w.tiles[i]).toBe(T.QUANTUM); expect(depthOf(Math.floor(i / W))).toBeGreaterThan(60); }
            const o = qOrder(seed);
            expect(['booster', 'shock']).toContain(o[0]);
            expect(new Set(o).size).toBe(7);
            expect(o[0]).not.toBe('duplicator');
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
        expect(s.tut.stop.text).toEqual([`The lab opened it. It was a ${first === 'booster' ? 'BOOSTER' : 'SHOCK WAVE'}.`, 'Fit it in the WORKSHOP.']);
        expect(has(s, first)).toBe(false);              // fitted in the workshop first
        closeStop(s);
        expect(fit(s, first)).toBe(false);              // not in the workshop
        s.x = roomSpot('workshop');
        expect(fit(s, first)).toBe(true);
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
        for (const s of [a, b]) { s.y = 20; give(s, 'booster', 'teleport', 'shock'); }
        expect(boost(b)).toBe(true);
        const a0 = a.battery, b0 = b.battery;
        for (const s of [a, b]) for (let y = 21; y < 60; y++) s.tiles[y * W + HOME_X] = T.SOIL;
        for (let i = 0; i < 60; i++) { step(a, 0.05, { dir: 'down' }); step(b, 0.05, { dir: 'down' }); }
        expect(b.y - 20).toBeGreaterThan((a.y - 20) * 1.6);
        expect((b0 - b.battery) / (b.y - 20)).toBeLessThan((a0 - a.battery) / (a.y - 20));
        expect(boost(b)).toBe(false);                    // recharging
        const c = preparedState({ row: 40 });
        c.y = 40; give(c, 'shock', 'teleport');
        c.tiles[41 * W + HOME_X + 1] = T.ROCK; c.tiles[42 * W + HOME_X] = T.STONE;
        expect(shock(c)).toBe(true);
        expect(c.tiles[42 * W + HOME_X]).toBe(T.AIR);
        expect(c.cargo).toContain(T.ROCK);
        expect(teleport(c)).toBe(true);
        expect(c.y).toBe(-1);
    });
    test('the SECOND LAMP lights farther down; the DEEP BATTERY charges in the heat', () => {
        const s = preparedState({ row: 260, levels: { hull: 3, drill: 3, battery: 3 } });
        s.y = 260; s.x = HOME_X; s.quantum.got = []; s.quantum.fit = [];
        const r = lampRadius(s);
        expect(litAt(s, HOME_X, 260 + Math.ceil(r) + 1)).toBe(false);
        give(s, 'lamp2');
        expect(litAt(s, HOME_X, 260 + Math.ceil(r) + 1)).toBe(true);
        expect(litAt(s, HOME_X, 260 - Math.ceil(r) - 1)).toBe(false);
        s.tiles[261 * W + HOME_X] = T.STONE;
        s.battery = 50; s.grafts = 3;
        step(s, 1, {});
        const without = s.battery;
        give(s, 'deepbat'); s.battery = 50;
        step(s, 1, {});
        expect(s.battery).toBeGreaterThan(without);
    });
    test('the warm rock stops the game once; the first biomass at the base: the lab speaks, GRAFT lights', () => {
        const s = preparedState({ row: 318, levels: { hull: 3, drill: 3 }, grafts: 1 });
        s.tut.done.warm = false;
        s.y = 318; s.x = HOME_X;
        for (let i = 0; i < 80 && !stopOpen(s); i++) step(s, 0.05, { dir: 'down' });
        expect(s.tut.stop.text).toEqual(['Soft. It gives under the drill. It is flesh.']);
        const t = started();
        t.bioHome = false; t.bioSeen = false; t.delivered = 5; t.tut.rows = ['battery'];
        t.cargo = [T.BIO]; t.y = -1; t.x = roomSpot('warehouse');
        for (let i = 0; i < 10; i++) step(t, 0.05, {});
        expect(t.line.text).toBe('This is not rock. It is growing in the tank.');
        expect(t.tut.fresh).toBe('graft');
    });
});

describe('v1.92.1: after the third test and Ola', () => {
    test('the base row: the drone drives from the hatch into every room and back, also after a repair', () => {
        const s = preparedState({ row: 20, parts: 200 });
        s.y = -1; s.x = HOME_X;
        s.alarms.list.push({ id: 'c2', at: 0, until: 999, cost: 10 });
        const at = () => (s.act ? s.act.tx : s.x);
        const goTo = (x) => { for (let i = 0; i < 200 && at() !== x; i++) run(s, 1, { dir: at() < x ? 'right' : 'left' }); };
        for (const x of [0, roomSpot('warehouse'), spotOf('c2'), HOME_X, roomSpot('workshop'), roomSpot('lab'), W - 1, HOME_X]) {
            goTo(x);
            run(s, 50);                                   // stand still (mends c2 when under it)
            expect(s.x).toBe(x);
            expect(s.y).toBe(-1);
        }
        expect(s.alarms.list).toEqual([]);
    });
    test('a full cargo: the drone leaves ore in the rock and says so once', () => {
        const s = preparedState({ row: 20 });
        s.y = 20; s.x = HOME_X;
        s.cargo = Array(cargoCap(s)).fill(T.ROCK);
        s.tiles[21 * W + HOME_X] = T.PAPER;
        const ev = [];
        for (let i = 0; i < 30; i++) { step(s, 0.05, { dir: 'down' }); ev.push(...s.events.map((e) => e.type)); s.events.length = 0; }
        expect(s.tiles[21 * W + HOME_X]).toBe(T.PAPER);
        expect(s.y).toBe(20);
        expect(ev.filter((e) => e === 'full')).toHaveLength(1);
        expect(s.tut.needs).toContain('mapping');
    });
    test('MAPPING: ore the lamp has lit is remembered', () => {
        const s = preparedState({ row: 20 });
        s.y = 20; s.x = HOME_X; s.levels.mapping = 1;
        s.tiles[21 * W + HOME_X + 1] = T.ROCK;
        step(s, 0.05, {});
        expect(s.seen).toContain(21 * W + HOME_X + 1);
    });
    test('the first dive forgives: half the power until the first ore is home', () => {
        const a = started(), b = started();
        b.delivered = 1;
        for (const s of [a, b]) { s.tut.dug = true; s.tut.show.power = true; s.tut.done.power = true; }
        run(a, 40, { dir: 'down' }); run(b, 40, { dir: 'down' });
        expect(batteryCap(a) - a.battery).toBeLessThan((batteryCap(b) - b.battery) * 0.7);
    });
    test('the first deaths are a stop; a missed generator is said', () => {
        const s = started();
        s.y = -1; s.alarms.list.push({ id: 'c4', at: 0, until: 0.01, cost: 10 });
        s.tut.done.failing = true;
        step(s, 0.05, {});
        expect(s.tut.stop.text).toEqual(['Chamber 5 went dark. 10 sleepers died.']);
    });
});

test('taps of up climb: the drone holds a moment after each step up instead of falling back', () => {
    const s = preparedState({ row: 30 });
    s.y = 30; s.x = HOME_X;
    for (let k = 0; k < 10; k++) { step(s, 0.05, { dir: 'up' }); for (let i = 0; i < 5; i++) step(s, 0.05, {}); }
    expect(s.y).toBeLessThanOrEqual(21);
});

describe('v1.92.2: hazards, lost drones, ore and parts', () => {
    test('magma: a pocket opened runs into the tunnel, harms the drone, and hardens', () => {
        const s = preparedState({ row: 130, levels: { drill: 3, hull: 1 } });
        s.y = 130; s.x = HOME_X;
        for (let x = 0; x < W; x++) { s.tiles[130 * W + x] = T.AIR; s.tiles[131 * W + x] = T.STONE; s.tiles[129 * W + x] = x === HOME_X ? T.AIR : T.STONE; }
        s.tiles[130 * W + 20] = T.STONE; s.tiles[130 * W + 21] = T.MAGMA;
        s.x = 19;
        run(s, 30, { dir: 'right' });                     // digs beside the pocket: it opens
        expect(Object.keys(s.lava).length).toBeGreaterThan(0);
        run(s, 120);
        expect(s.lost).toBe(true);                         // stood in it too long
        // it hardens after a while
        run(s, Math.ceil(30 / 0.05));
        expect(Object.keys(s.lava).length).toBe(0);
        expect(heatHold(3)).toBeGreaterThan(heatHold(0));
        expect(LAVA_STEP).toBe(1.5);
    });
    test('gas: the drill touches it and it bursts, taking the tiles round it and power', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.x = HOME_X; s.levels.battery = 3; s.battery = batteryCap(s);
        s.tiles[31 * W + HOME_X] = T.GAS; s.tiles[31 * W + HOME_X + 1] = T.STONE;
        run(s, 20, { dir: 'down' });
        expect(s.tiles[31 * W + HOME_X + 1]).toBe(T.AIR);
        expect(s.battery).toBeLessThan(batteryCap(s) * 0.5);
    });
    test('a cave-in: an opening four wide under a roof in old rock falls after two seconds of warning', () => {
        const s = preparedState({ row: 80, levels: { drill: 2, hull: 1 } });
        s.y = 80; s.x = 3;
        for (let x = 0; x < W; x++) { s.tiles[79 * W + x] = T.STONE; s.tiles[81 * W + x] = T.STONE; s.tiles[80 * W + x] = T.STONE; }
        s.tiles[80 * W + 3] = T.AIR; s.tiles[80 * W + 4] = T.AIR; s.tiles[80 * W + 5] = T.AIR;
        s.levels.battery = 3; s.battery = batteryCap(s);
        for (let i = 0; i < 40 && !s.caves.length; i++) run(s, 1, { dir: 'right' });
        expect(s.caves).toHaveLength(1);
        s.x = 4; s.act = null;
        expect(s.line.text).toBe('The roof is moving.');
        run(s, Math.ceil(CAVE_WARN / 0.05) + 4);
        expect(s.lost).toBe(true);                         // stayed under it
        expect(s.tiles[80 * W + 4]).toBe(T.STONE);
    });
    test('UPWARD DRILL comes later: none at first; I ore only, II soft rock, III anything as fast as down', () => {
        const s = started();
        expect(canDigUp(s, T.ROCK)).toBe(false);
        s.levels.updrill = 1; expect(canDigUp(s, T.ROCK)).toBe(true); expect(canDigUp(s, T.STONE)).toBe(false);
        s.levels.updrill = 2; expect(canDigUp(s, T.STONE)).toBe(true); expect(canDigUp(s, T.HARD)).toBe(false);
        s.levels.updrill = 3; expect(canDigUp(s, T.HARD)).toBe(true);
    });
    test('UPWARD DRILL is offered after bumping into ore above three times', () => {
        const s = preparedState({ row: 10 });
        s.tut.rows = ['battery']; s.tut.needs = [];
        s.y = 10; s.x = HOME_X + 1; s.tiles[10 * W + HOME_X + 1] = T.AIR; s.tiles[11 * W + HOME_X + 1] = T.STONE; s.tiles[9 * W + HOME_X + 1] = T.ROCK;
        for (let k = 0; k < 3; k++) { s.bumpAt = -9; s.pressSteps = 0; step(s, 0.05, { dir: 'up' }); }
        expect(s.tut.needs).toContain('updrill');
    });
    test('ARMOUR: one plate; a hit costs one (a flash, a dent); at none the drone is lost; mended at the workshop', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.x = HOME_X; s.levels.armour = 1; s.hp = maxHp(s); s.levels.battery = 3; s.battery = batteryCap(s);
        expect(s.hp).toBe(2);
        s.tiles[31 * W + HOME_X] = T.GAS;
        run(s, 20, { dir: 'down' });
        expect(s.hp).toBe(1);
        expect(s.lost).toBe(false);
        s.y = -1; s.x = roomSpot('workshop'); s.parts = 50;
        expect(mendPlates(s)).toBe(true);
        expect(s.hp).toBe(2);
        const t = preparedState({ row: 30 });
        t.y = 30; t.x = HOME_X; t.tiles[31 * W + HOME_X] = T.GAS;
        run(t, 20, { dir: 'down' });
        expect(t.lost).toBe(true);
    });
    test('a new drone gets new paint (never the last one\'s) and its number; the wreck keeps its colour', () => {
        const s = preparedState({ row: 10 });
        s.y = 10; s.battery = 0.01;
        run(s, 3, { dir: 'left' });
        expect(s.wrecks[0].paint).toBe(0);
        buildDrone(s);
        expect(s.paint).not.toBe(0);
        expect(PAINTS[s.paint]).toBeDefined();
    });
    test('the generator is built up at the GENERATOR from the war on; each level burns 30 % less', () => {
        const s = started();
        s.parts = 500; s.y = -1; s.x = 1; s.drainFrom = 0; s.time = 10;
        expect(buyGen(s)).toBe(false);                     // not before the war
        s.layerSeen = 1;
        const before = drainRate(s);
        expect(buyGen(s)).toBe(true);
        expect(drainRate(s) / before).toBeCloseTo(GEN_DRAIN[1]);
    });
    test('a find says what it gives; unloading says ore into parts', () => {
        const s = started();
        s.tut.dug = true; s.tut.done.power = true; s.tut.show.power = true;
        const i = Object.keys(s.finds).map(Number).find((k) => s.finds[k] === 0);
        s.y = Math.floor(i / W) - 1; s.x = i % W;
        run(s, 20, { dir: 'down' });
        expect(s.line.text).toBe('A street sign. MARKET ST. +12 PARTS.');
        const t = started();
        t.cargo = [T.ROCK, T.PAPER]; t.y = -1; t.x = roomSpot('warehouse');
        const ev = [];
        for (let k = 0; k < 10; k++) { step(t, 0.05, {}); ev.push(...t.events); t.events.length = 0; }
        expect(ev.find((e) => e.type === 'unloaded')).toMatchObject({ ore: 2, parts: 7 });
    });
});

describe('v1.92.3: why the drone died, a base with teeth', () => {
    test('magma: the drill into it does not carry the drone in; the hull holds a few seconds, so it can back off', () => {
        const s = preparedState({ row: 130, levels: { drill: 3, hull: 1 } });
        s.y = 130; s.x = HOME_X;
        for (let x = 0; x < W; x++) { s.tiles[130 * W + x] = x === HOME_X ? T.AIR : T.STONE; s.tiles[131 * W + x] = T.STONE; }
        s.tiles[130 * W + HOME_X + 1] = T.MAGMA;
        run(s, 1, { dir: 'right' });
        run(s, 10);
        expect(s.x).toBe(HOME_X);
        expect(s.lava[130 * W + HOME_X + 1]).toBeDefined();
        run(s, 60, { dir: 'up' });                      // backs off up the shaft
        expect(s.lost).toBe(false);
    });
    test('every lost drone says why', () => {
        expect(LOST_WHY.power).toBe('The battery ran out.');
        expect(LOST_WHY.magma).toBe('Magma. The hull melted.');
        expect(LOST_WHY.cave).toBe('The roof came down.');
        expect(LOST_WHY.gas(57)).toBe('Gas. It took 57 POWER.');
    });
    test('no turn back at the heart', () => {
        const s = preparedState({ row: 395, levels: { drill: 3, hull: 3 }, grafts: 3 });
        s.y = 395; s.x = HOME_X; s.battery = 5;
        run(s, 4);
        expect(s.line.kind).not.toBe('turnback');
    });
    test('the generators take every other piece while under 90 %; the rest is parts; the drone unloads driving through', () => {
        const s = started();
        s.reserve = 50; s.cargo = [T.ROCK, T.ROCK, T.ROCK, T.ROCK]; s.y = -1; s.x = 11; s.tut.dug = true;
        const ev = [];
        for (let k = 0; k < 30 && s.x > 3; k++) { run(s, 1, { dir: 'left' }); ev.push(...s.events); s.events.length = 0; }
        expect(s.cargo).toEqual([]);
        const u = ev.find((e) => e.type === 'unloaded');
        expect(u).toMatchObject({ ore: 4, gen: 2, parts: 4 });
        expect(LINES.unloaded(8, 4, 22)).toBe('8 ORE → 4 to the generators, 22 PARTS');
    });
    test('the alarm shows the price', () => {
        expect(ALARM_LINES.tag('c2', 40, 12)).toBe('CHAMBER 3 · 40 s · 12 PARTS');
    });
});

describe('v1.92.4: STEERING III, pacing, trapped', () => {
    test('STEERING III (HOVER): offered after a hazard; one tap one tile; the drone holds still in open space; held, about four a second', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.x = HOME_X;
        expect(priceOf(s, 'steering')).toBeNull();          // not before a hazard
        s.hoverOffer = true;
        expect(priceOf(s, 'steering')).toBe(70);
        s.levels.steering = 2;
        for (let y = 20; y <= 40; y++) s.tiles[y * W + HOME_X] = T.AIR;
        run(s, 20);
        expect(s.y).toBe(30);                                // hovers, no fall
        run(s, 1, { dir: 'up' }); run(s, 10);
        expect(s.y).toBe(29);                                // one tap, one tile
        const y0 = s.y;
        run(s, 20, { dir: 'down' });                         // held 1 s: about four
        expect(s.y - y0).toBeGreaterThanOrEqual(3);
        expect(s.y - y0).toBeLessThanOrEqual(5);
    });
    test('STEERING II: a tap up is exactly one tile', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.x = HOME_X;
        run(s, 3, { dir: 'up' });                            // a 0.15 s press
        run(s, 4);
        expect(s.y).toBe(29);
    });
    test('sealed in: the drone claws its way up through anything (slowly), whatever its drill', () => {
        const s = preparedState({ row: 30 });
        s.y = 30; s.x = HOME_X;
        s.tiles[29 * W + HOME_X] = T.STONE; s.tiles[31 * W + HOME_X] = T.STONE;
        for (const dx of [-1, 1]) s.tiles[30 * W + HOME_X + dx] = T.STONE;
        run(s, 40, { dir: 'up' });
        expect(s.y).toBeLessThan(30);
    });
});

describe('v1.92.4: never stuck', () => {
    test('ore grows back above the next wall each time the drone is home', () => {
        const s = started();
        for (let y = 3; y < 58; y++) for (let x = 5; x <= 17; x++) if (isOre(s.tiles[y * W + x])) s.tiles[y * W + x] = T.STONE;
        for (let y = 3; y < 58; y++) s.tiles[y * W + 8] = T.AIR;        // a tunnel to grow beside
        const count = () => { let n = 0; for (let y = 3; y < 58; y++) for (let x = 5; x <= 17; x++) if (isOre(s.tiles[y * W + x])) n++; return n; };
        for (let k = 0; k < 5; k++) { s.y = 3; s.x = 8; step(s, 0.05, {}); s.y = -1; s.x = HOME_X; step(s, 0.05, {}); }
        expect(count()).toBeGreaterThan(5);
    });
    test('long in front of a wall, its upgrade costs what the player has', () => {
        const s = preparedState({ row: 57 });
        s.parts = 9; s.levels.drill = 0;
        step(s, 0.05, {});
        expect(priceOf(s, 'drill')).toBe(PRICES[0]);
        s.time += STUCK_S + 1;
        expect(priceOf(s, 'drill')).toBe(9);
    });
});

describe('v1.92.6: the refinery and the duplicator', () => {
    test('the REFINERY at the WAREHOUSE after the third delivery: +25 % parts a level, said on unloading', () => {
        const s = started();
        s.tut.dug = true; s.y = -1; s.x = roomSpot('warehouse'); s.reserve = 100; s.parts = 100;
        expect(buyRefinery(s)).toBe(false);                  // not before the third delivery
        s.deliveries = 3;
        expect(buyRefinery(s)).toBe(true);
        s.levels.refinery = 4;                               // +100 %
        s.cargo = [T.SCISSORS, T.SCISSORS];
        const ev = [];
        for (let k = 0; k < 3; k++) { step(s, 0.05, {}); ev.push(...s.events); s.events.length = 0; }
        expect(ev.find((e) => e.type === 'unloaded')).toMatchObject({ ore: 2, parts: 40, refined: 20 });
        expect(LINES.unloaded(8, 4, 28, 6)).toBe('8 ORE → 4 to the generators, 28 PARTS (+6 refined)');
    });
    test('the DUPLICATOR: one piece of ore in four comes out twice', () => {
        const s = preparedState({ row: 20 });
        s.y = 20; s.x = HOME_X; s.levels.cargo = 2; s.quantum.got.push('duplicator'); s.quantum.fit.push('duplicator');
        for (let y = 21; y < 29; y++) s.tiles[y * W + HOME_X] = T.ROCK;
        run(s, 80, { dir: 'down' });
        expect(s.cargo.length).toBe(10);                     // eight dug, two doubled
    });
    test('the lamp on a new kind of ore says what it is worth', () => {
        expect(LINES.oreWorth('SCISSORS', 8)).toBe('SCISSORS ore. Worth 8.');
    });
});

describe('v1.92.6: falling is free; BOOSTER II and III', () => {
    test('falling costs no power', () => {
        const s = preparedState({ row: 40 });
        s.y = 2; s.x = HOME_X; s.levels.battery = 3; s.battery = batteryCap(s);
        const b0 = s.battery;
        for (let i = 0; i < 400 && s.y < 40; i++) step(s, 0.01, {});
        expect(s.y).toBe(40);
        expect(b0 - s.battery).toBeLessThan(0.05);         // (a breath of idle between falls)
    });
    test('BOOSTER levels in the workshop once fitted: 30 s, 20 s, 12 s', () => {
        const s = started();
        s.quantum.got.push('booster');
        s.y = -1; s.x = roomSpot('workshop');
        expect(rowShown(s, 'booster')).toBe(false);
        fit(s, 'booster');
        expect(rowShown(s, 'booster')).toBe(true);
        expect(coolOf(s, 'booster')).toBe(30);
        s.levels.booster = 2;
        expect(coolOf(s, 'booster')).toBe(12);
    });
});

describe('v1.92.7: thoughts on the way down', () => {
    test('ten thoughts, in order, by depth, each once, never two within 40 s, not while an alarm is on', () => {
        const s = preparedState({ row: 395, levels: { drill: 3, hull: 3 }, grafts: 3 });
        const got = [];
        s.x = HOME_X; s.thoughtAt = -1e9; s.thoughtN = 0;
        for (let y = 0; y < 380; y += 2) {
            s.y = y; s.time += 50;
            step(s, 0.05, {});
            for (const e of s.events) if (e.type === 'thought') got.push(e.text);
            s.events.length = 0;
        }
        expect(got).toEqual(THOUGHTS.map((t) => t[1]));
        const a = preparedState({ row: 60 });
        a.y = 40; a.thoughtN = 0; a.alarms.list.push({ id: 'c1', at: 0, until: 999, cost: 9 });
        step(a, 0.05, {});
        expect(a.events.some((e) => e.type === 'thought')).toBe(false);
        a.alarms.list = []; step(a, 0.05, {});
        expect(a.events.find((e) => e.type === 'thought').text).toBe('There is a warmth down here.');
        a.events.length = 0; a.y = 70; step(a, 0.05, {});
        expect(a.events.some((e) => e.type === 'thought')).toBe(false);   // within 40 s
    });
});
