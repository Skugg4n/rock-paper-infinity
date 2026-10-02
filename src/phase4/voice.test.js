/* eslint-env jest */
/*
 * deep-voice (step 2 of docs/superpowers/specs/2026-10-02-chapter-iv-tree-and-bio.md): Surface's
 * nights open its nodes in the tree, a gift is bought there, and each gift is a rule in deep.js.
 */
import {
    initialDeepState, tickDay, CRYO, CRYO_TOP, nextCryo, cryoLabel, cryoName, gift, LOSSLESS, SLEEP_FOOD,
    upkeepMultiplier, roomMultiplier, outputMultiplier, upkeepFor, FOOD_PER_HUMAN,
} from './deep.js';
import { initialWatcher, openSurface, LADDER, capacityMax } from './watcher.js';
import { NIGHTS, initialSurface } from './surface.js';
import {
    canBuy, buy, nodeStatus, nodeVisible, GIFT_PRICE, nightLog, levelOf, buyableCount, normalizeTree,
} from './tree.js';
import { deserializeDeep, SCHEMA_VERSION } from './persistence.js';
import { rateWords, buySentence } from './readout.js';

/** A colony well into the chapter: everything automated, levels bought, at Cryo `tier`. */
function colony(tier = 3) {
    const s = initialDeepState({ salvage: 1500, doom0: 85 });
    Object.assign(s, {
        humans: 400, minerals: 1e9, food: 1e9, stars: 0,
        rooms: { mine: 6, farm: 5, generator: 5, dorm: 4, cryo: 1 }, chambers: 21,
        level: { mine: 6, farm: 6, generator: 6, dorm: 4 }, auto: { mine: 2, farm: 2, generator: 2, dorm: 1 },
        cryo: tier, watcher: { ...initialWatcher(), sleeps: 5 },
    });
    return s;
}
const clone = (s) => JSON.parse(JSON.stringify(s));
const withGift = (s, id) => { const c = clone(s); c.tree = { opened: [id], bought: [id], unseen: false }; return c; };

describe('a night opens a node', () => {
    test('each of nights 2 to 6 opens its gift in the tree and marks the tree button', () => {
        const s = colony(6);
        const w = s.watcher;
        const opened = [];
        for (let i = 0; i < NIGHTS.length; i++) {
            const v = openSurface(w, s, { force: true });
            expect(v.night).toBe(i + 1);
            w.surface.visit = null;
            if (NIGHTS[i].gives) opened.push(NIGHTS[i].gives);
            expect(s.tree.opened).toEqual(opened);
        }
        expect(s.tree.unseen).toBe(true);
        expect(nightLog(s).map((l) => [l.n, l.to])).toEqual([[1, 'watchdog'], [2, 'lossless'], [3, 'cold'], [4, 'quiet'], [5, 'longcount'], [6, 'question']]);
    });

    test('not opened: "Not ours to open."; opened: buyable at its price, quoting the line', () => {
        const s = colony(3);
        s.stars = 1e30;
        expect(nodeStatus(s, 'lossless')).toMatchObject({ status: 'surface', reason: 'Not ours to open.', opened: false, quote: '' });
        s.tree = { opened: ['lossless'], bought: [] };
        const st = nodeStatus(s, 'lossless');
        expect(st).toMatchObject({ status: 'buyable', opened: true, quote: NIGHTS[1].line, priceText: '★ 100 M' });
        expect(buyableCount(s)).toBeGreaterThan(0);
        s.stars = GIFT_PRICE.lossless;
        expect(buy(s, 'lossless')).toMatchObject({ kind: 'gift', gift: 'lossless' });
        expect(s.stars).toBe(0);
        expect(gift(s, 'lossless')).toBe(true);
        expect(levelOf(s, 'lossless')).toBe(1);
        expect(nodeStatus(s, 'lossless').status).toBe('bought');
        expect(buy(s, 'lossless')).toBeNull();
    });

    test('a gift is bought awake or asleep, and says how long it is when it cannot be paid', () => {
        const s = colony(3);
        s.tree = { opened: ['cold'], bought: [] };
        s.stars = GIFT_PRICE.cold / 2;
        expect(canBuy(s, 'cold', { starsPerDay: GIFT_PRICE.cold / 100 })).toMatchObject({ ok: false, kind: 'afford' });
        s.stars = GIFT_PRICE.cold;
        s.asleep = true;
        expect(canBuy(s, 'cold').ok).toBe(true);
    });

    test('prices climb with the nights, and each is a gift a minute of play can reach (sim-phase4 --gifts)', () => {
        const order = ['lossless', 'cold', 'quiet', 'question', 'longcount'];
        for (let i = 1; i < order.length; i++) expect(GIFT_PRICE[order[i]]).toBeGreaterThan(GIFT_PRICE[order[i - 1]]);
        expect(GIFT_PRICE.longcount).toBe(CRYO[CRYO_TOP + 1].cost);
    });
});

describe('the gifts are rules', () => {
    test('Lossless relay: an automated room makes three times as much; a manual one does not', () => {
        const s = colony(3);
        s.auto.mine = 0;                               // the mines by hand
        const a = tickDay(clone(s), false), b = tickDay(withGift(s, 'lossless'), false);
        expect(b.food / a.food).toBeCloseTo(LOSSLESS, 6);          // automated farms
        expect(b.energyMade / a.energyMade).toBeCloseTo(LOSSLESS, 6);
        expect(b.minerals).toBeCloseTo(a.minerals, 6);             // the manual mines: no relay
        expect(outputMultiplier(withGift(s, 'lossless'), 'farm')).toBe(LOSSLESS * roomMultiplier(6, 2));
        s.auto.mine = 2;                               // all of it automated: more stars
        expect(tickDay(withGift(s, 'lossless'), false).stars).toBeGreaterThan(tickDay(clone(s), false).stars);
    });

    test('Cold storage: sleepers eat nothing', () => {
        const s = colony(3);
        const a = tickDay(clone(s), true), b = tickDay(withGift(s, 'cold'), true);
        expect(a.eaten).toBeCloseTo((s.humans - a.died) * FOOD_PER_HUMAN * SLEEP_FOOD, 6);
        expect(b.eaten).toBe(0);
        // awake they eat as before
        expect(tickDay(withGift(s, 'cold'), false).eaten).toBeCloseTo(tickDay(clone(s), false).eaten, 9);
    });

    test('Quiet hands: an automated room draws and burns as a level-0 room; a manual one as before', () => {
        const s = colony(3);
        const q = withGift(s, 'quiet');
        expect(upkeepFor(q, 'mine')).toBe(upkeepMultiplier(0, 2));
        expect(upkeepFor(s, 'mine')).toBe(upkeepMultiplier(6, 2));
        const a = tickDay(clone(s), false), b = tickDay(q, false);
        expect(b.fuelWanted / a.fuelWanted).toBeCloseTo(1 / Math.pow(1.5, 6), 6);
        expect(b.energyNeed).toBeLessThan(a.energyNeed);
        expect(b.parts.E).toBeGreaterThan(a.parts.E);
        // what the level tooltip says comes from the same rule
        expect(buySentence('level', 'generator', q)).toMatch(/Needs 3 ore a day/);
        expect(buySentence('level', 'generator', s)).not.toMatch(/Needs 3 ore a day/);
        q.auto.mine = 0;
        expect(upkeepFor(q, 'mine')).toBe(upkeepMultiplier(6, 0));
    });

    test('Long count: the tier past Cryo VII, a million years a second, only on Cryo VII', () => {
        expect(CRYO[CRYO_TOP + 1]).toMatchObject({ days: 365000000, gift: 'longcount' });
        expect(cryoLabel(CRYO[CRYO_TOP + 1].days)).toBe('1 000 000 y');
        expect(rateWords(CRYO[CRYO_TOP + 1].days)).toBe('a million years');
        expect(cryoName(CRYO_TOP + 1)).toBe('Cryo VIII');
        const s = colony(5);
        s.tree = { opened: ['longcount'], bought: [] };
        s.stars = 1e30;
        expect(canBuy(s, 'longcount')).toMatchObject({ ok: false, reason: 'Needs Cryo VII first.' });
        s.cryo = CRYO_TOP;
        expect(nextCryo(s)).toBe(null);                // it is never the next tier on the chain
        expect(buy(s, 'longcount')).toMatchObject({ gift: 'longcount' });
        expect(s.cryo).toBe(CRYO_TOP + 1);
        expect(nodeStatus(s, 'cryo-vii').status).toBe('bought');
    });

    test('The question: BIOLOGICAL is hidden until it is bought; a save that owns a biological step keeps it', () => {
        const s = colony(4);
        s.watcher.bought = LADDER.filter((u) => u.rung < 2).map((u) => u.id);
        s.watcher.capacity = capacityMax(s.watcher);
        s.watcher.grown = 100;
        s.asleep = true;
        s.stars = 1e30;
        expect(nodeVisible(s, 'reactor')).toBe(true);
        expect(nodeVisible(s, 'brain')).toBe(false);
        expect(canBuy(s, 'brain').ok).toBe(false);
        s.tree = { opened: ['question'], bought: [] };
        buy(s, 'question');
        expect(nodeVisible(s, 'brain')).toBe(true);
        expect(canBuy(s, 'brain').ok).toBe(true);
        const old = colony(4);
        old.watcher.bought = [...LADDER.filter((u) => u.rung < 2).map((u) => u.id), 'brain'];
        expect(nodeVisible(old, 'nervous')).toBe(true);
    });
});

describe('the save (schema 7)', () => {
    test('an old save starts at the night its Surface progress implies, its gifts opened, its words kept', () => {
        const old = {
            ...initialDeepState(), cryo: 3,
            watcher: { ...initialWatcher(), sleeps: 40, stage: 0,
                surface: { ...initialSurface(), visits: 6, words: 4, wins: 4, visit: { line: 'They dream of you.', it: 'rock', result: null } } },
            tree: { opened: [] },
        };
        delete old.watcher.surface.night;
        delete old.watcher.surface.toLine;
        const back = deserializeDeep(JSON.stringify({ schemaVersion: 6, state: old, layout: { slots: ['mine', 'farm', 'generator', 'dorm', 'cryo'] } }));
        expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(7);
        const sf = back.state.watcher.surface;
        expect(sf.night).toBe(3);
        expect(sf.words).toBe(4);
        expect(sf.visit).toMatchObject({ line: '', night: 0, it: 'rock' });
        expect(back.state.watcher.stage).toBe(1);
        expect(back.state.tree).toEqual({ opened: ['lossless', 'cold'], bought: [], unseen: false });
    });
    test('a broken tree in a save is mended: a gift bought must have been opened', () => {
        expect(normalizeTree({ opened: ['cold', 'seam'], bought: ['cold', 'quiet'], unseen: 1 }))
            .toEqual({ opened: ['cold'], bought: ['cold'], unseen: true });
    });
});
