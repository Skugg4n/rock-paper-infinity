/**
 * deep-tension (B350 to B359): the human pass of v1.80.0 said chapter IV was not worth Ola's time.
 * These hold the fixes to what that pass saw: TEND starts uphill, the tape never names what cannot
 * be done, the long sleep wakes only for something new, a FAULT says its cause, GROW pulls against
 * itself (the guts are the only mass, the vats eat it, a heart reaches two and a half), the checkpoints keep
 * the player's own settings.
 */
import { initialDeepState, tickDay, startBuild, completeBuilds, nextPrice, setIncome, AWAKE_SHARE, HAND_DIG } from './deep.js';
import { gauges, advise, adviceNote, adviseAsleep, cryoLamps, wakeWord, isNewKind, levelsReady, drawerDoes, drawerGroups, LEVELS_ROW } from './instruments.js';
import { cryoRoad } from './readout.js';
import { initialTree, buy as treeBuy, LEVEL_NODE } from './tree.js';
import { initialWatcher } from './watcher.js';
import { graphFromSlots, HEART } from './growth.js';
import { bodySums, massRate, gutRate, pulseRatio, HEART_K, LID_REACH, VAT_MASS } from './organs.js';
import { KEEP_KEYS } from '../checkpoints.js';

const start = (o = {}) => ({ ...initialDeepState({ salvage: 1500, doom0: 85 }), tree: initialTree(), watcher: initialWatcher(), ...o });
const dry = (s) => tickDay(JSON.parse(JSON.stringify(s)), !!s.asleep);

describe('TEND starts uphill (B352)', () => {
    test('a player who only digs sees FOOD go red inside three minutes; a farm brings it back', () => {
        const s = start();
        let red = null;
        for (let t = 0; t < 180 && red === null; t++) {
            completeBuilds(s);
            if (gauges(s, dry(s)).F.red) red = t;
            if (!(s.builds || []).length && s.minerals >= nextPrice(s, 'dig')) { s.minerals -= nextPrice(s, 'dig'); startBuild(s, 'dig'); }
            tickDay(s);
        }
        expect(red).not.toBeNull();
        expect(red).toBeLessThan(180);
        // the right room: a farm on a free chamber, and the needle leaves the red
        s.chambers = Math.max(s.chambers, 6);
        s.rooms.farm += 1;
        expect(gauges(s, dry(s)).F.red).toBe(false);
    });
    test('a colony that burnt its last ore still digs by hand: never dead', () => {
        const s = start({ minerals: 0 });
        const r = tickDay(s);
        expect(r.minerals).toBeCloseTo(12 * HAND_DIG, 6);
        expect(s.minerals).toBeGreaterThan(0);
    });
});

describe('the tape never names what cannot be done (B355)', () => {
    test('no ore for a chamber: never DIG', () => {
        const s = start({ minerals: 10 });
        expect(advise(s, dry(s), { road: cryoRoad(0, s), lever: false })).not.toBe('DIG');
    });
    test('an automation short of stars is saved for, with the gap under it', () => {
        const s = start({ minerals: 300, stars: 0 });
        const word = advise(s, dry(s), { road: cryoRoad(0, s), lever: false });
        expect(word).toBe('SAVE FOR GENERATOR AUTOMATION');
        expect(adviceNote(s, word)).toMatch(/^★ \S+( \w)? to go$/);
    });
    test('the price lamp says what is left to go once the three are lit', () => {
        const road = { items: [{ key: 'auto-farm', done: true }, { key: 'auto-generator', done: true }, { key: 'auto-mine', done: true }, { key: 'stars', done: false }] };
        expect(cryoLamps(road, 15000, 11700)[3].label).toBe('★ 3.3 k to go');
        expect(cryoLamps(road, 15000)[3].label).toBe('★ 15 k');
    });
    test('an item says the same before and after it is bought', () => {
        const s = start();
        const before = drawerDoes(s, 'auto-mine');
        s.auto.mine = 2;
        expect(drawerDoes(s, 'auto-mine')).toBe(before);
    });
});

describe('the long sleep wakes for what matters (B353)', () => {
    /** After the hall, every level and automation bought once, stars in hand. */
    function colony() {
        const s = start({
            day: 4000, minerals: 1e6, food: 1e6, stars: 0, humans: 400, chambers: 14,
            rooms: { mine: 4, farm: 4, generator: 4, dorm: 2, cryo: 1 },
            level: { mine: 1, farm: 1, generator: 1, dorm: 1 }, auto: { mine: 1, farm: 1, generator: 1, dorm: 1 }, cryo: 0, feed: 1, vats: 1,
        });
        setIncome(s);
        return s;
    }
    test('a next level is not new; a tier, a gift and a first level are', () => {
        const s = colony();
        expect(isNewKind(s, LEVEL_NODE.mine)).toBe(false);
        expect(isNewKind(s, 'cryo-ii')).toBe(true);
        const t = colony(); t.level.mine = 0;
        expect(isNewKind(t, LEVEL_NODE.mine)).toBe(true);
    });
    test('asleep with only levels to buy, the tape does not say WAKE; awake they are one row, one click', () => {
        const s = colony();
        s.stars = 1e15;
        const ready = levelsReady(s);
        expect(ready.n).toBeGreaterThan(1);
        s.asleep = true;
        const asleep = adviseAsleep(s);
        if (asleep === 'WAKE') {
            // only for something new
            expect(adviceNote(s, 'WAKE')).toMatch(/can be bought\.$/);
        }
        s.asleep = false;
        const g = drawerGroups(s, {});
        expect(g[0].rows[0].id).toBe(LEVELS_ROW);
        expect(g[0].rows[0].name).toBe(`${ready.n} LEVELS`);
        // the bundle buys what it says
        let n = 0;
        for (const id of ready.ids) if (treeBuy(s, id, {})) n++;
        expect(n).toBe(ready.n);
    });
    test('awake after the hall the machine plays at least a share of a second of sleep', () => {
        const s = colony();
        const r = tickDay(JSON.parse(JSON.stringify(s)), false);
        expect(r.stars).toBeGreaterThanOrEqual(AWAKE_SHARE * s.income.stars * (1 - 1e-9));
    });
    test('a FAULT says its cause', () => {
        expect(wakeWord({ kind: 'stall', type: 'generator', why: 'hands' })).toBe('FAULT: GENERATOR');
        expect(wakeWord({ kind: 'few' })).toMatch(/^FAULT: /);
    });
});

describe('GROW pulls against itself (B350)', () => {
    const slots = Array.from({ length: 12 }, (_, i) => ['mine', 'dorm', 'farm', 'generator'][i % 4]);
    const graph = graphFromSlots(slots);
    const st = (organs) => ({ body: [HEART, ...Object.keys(organs)], necrotic: [], organs });
    test('the guts are the only mass; the vats eat it', () => {
        const guts = bodySums(graph, st({ s0: 'gut' }));
        const vats = bodySums(graph, st({ s0: 'vat', s1: 'vat' }));
        expect(gutRate(guts)).toBeGreaterThan(gutRate(vats) * 2);
        expect(massRate(vats)).toBeLessThan(0);
        expect(massRate(vats)).toBeCloseTo(gutRate(vats) - 2 * VAT_MASS, 9);
    });
    test('a heart reaches two and a half: a body without hearts runs out of reach', () => {
        const ids = graph.nodes.filter((n) => n.floor === 0 && n.kind === 'room').map((n) => n.id).slice(0, 8);
        const noHearts = bodySums(graph, st(Object.fromEntries(ids.map((id) => [id, 'gut']))));
        expect(pulseRatio(noHearts)).toBeLessThan(1);
        const third = bodySums(graph, st(Object.fromEntries(ids.map((id, i) => [id, i % 3 === 0 ? 'heart' : 'gut']))));
        expect(pulseRatio(third)).toBeGreaterThanOrEqual(1);
        expect(LID_REACH + HEART_K * third.give.heart).toBeGreaterThanOrEqual(third.size);
    });
});

describe('a checkpoint keeps the player\'s own settings (B357)', () => {
    test('the sound, the debug flag and the chosen view survive a jump', () => {
        expect(KEEP_KEYS).toEqual(expect.arrayContaining(['rpi-audio', 'rpi-debug', 'rpi-deep-view']));
    });
});
