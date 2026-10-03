// deep-grow: movement III · GROW as the colony plays it (grow.js), the save, the sound's share
import {
    normalizeGrow, growOn, risen, graphOf, takePrice, takeChamber, takeWords, bodyYear, stepGrow,
    organsOf, growGauges, adviseGrow, riseLamps, riseReady, bodyGroups, buyBody, bodyPrice, rise, viewOf,
    feedOf, hungerNow, fleshShare, MIGRATE_PER_STEP, GROW_DAYS_PER_SECOND, BODY_YEAR_DAYS, BODY_ITEMS, GROW_END,
    RISE_LINES, SPREAD_SECONDS, takeTip, TAKE_DAYS, dreamWake, dreamEnd,
} from './grow.js';
import { initialDeepState, tickDay, MIN_SLEEPERS } from './deep.js';
import { initialWatcher, LADDER } from './watcher.js';
import { serializeDeep, deserializeDeep, SCHEMA_VERSION } from './persistence.js';
import { BODY_OUTPUT, HEART, MACHINE } from './growth.js';
import { fromSnapshot } from './sound.js';
import { decideGrow, pressGrow } from './policy.js';
import { drawerGroups } from './instruments.js';
import { canBuy, nextWatcherNode } from './tree.js';

const PATTERN = ['mine', 'dorm', 'farm', 'generator'];
/** A late colony at The question: two floors, every kind of room on each. */
function colony({ slots = 20, humans = 5000 } = {}) {
    const s = initialDeepState();
    const list = [];
    for (let i = 0; i < slots; i++) list.push(PATTERN[i % 4]);
    const count = (t) => list.filter((x) => x === t).length;
    Object.assign(s, {
        day: 25000 * 365, minerals: 1e15, food: 1e12, stars: 1e17, humans,
        chambers: list.length, rooms: { mine: count('mine'), farm: count('farm'), generator: count('generator'), dorm: count('dorm'), cryo: 0 },
        level: { mine: 10, farm: 10, generator: 10, dorm: 8 }, auto: { mine: 4, farm: 4, generator: 4, dorm: 4 },
        cryo: 5, vats: 3, feed: 8,
        watcher: { ...initialWatcher(), bought: LADDER.filter((u) => u.rung < 2).map((u) => u.id) },
        tree: { opened: ['question'], bought: ['question'], unseen: false },
    });
    return { s, layout: { slots: list } };
}
const report = (s) => tickDay(JSON.parse(JSON.stringify(s)), false);

describe('the question opens the body', () => {
    test('a colony that answered the question starts its body on the lid, with anchors and prices', () => {
        const { s, layout } = colony();
        expect(normalizeGrow(s, layout, report(s))).toBe(true);
        expect(growOn(s)).toBe(true);
        expect(s.grow.body).toEqual([HEART]);
        expect(s.grow.unit).toBeGreaterThan(1);
        expect(s.grow.lv.vats).toBe(3);                         // the culture vats are the body's first vats
        for (const x of BODY_ITEMS) expect(bodyPrice(s, x.id)).toBeGreaterThan(0);
        expect(viewOf(s, layout).reachable.sort()).toEqual(['s0', 's1', 's2', 's3']);
    });
    test('without the question there is no body; the old ending (the Watcher alone) stays as it was', () => {
        const { s, layout } = colony();
        s.tree.bought = [];
        expect(normalizeGrow(s, layout)).toBe(false);
        const g = colony();
        g.s.watcher.gone = true;
        expect(normalizeGrow(g.s, g.layout)).toBe(false);
    });
    test('old biological steps are migrated into a body: three chambers a step, nothing lost', () => {
        const { s, layout } = colony();
        s.tree.bought = [];
        s.watcher.bought = [...s.watcher.bought, 'brain', 'nervous'];
        s.watcher.sealing = 'spinal';
        expect(normalizeGrow(s, layout, report(s))).toBe(true);
        expect(s.grow.body.length - 1).toBe(3 * MIGRATE_PER_STEP);
        expect(s.grow.migrated).toBe(3 * MIGRATE_PER_STEP);
        expect(s.watcher.sealing).toBe(null);
        expect(s.grow.body).not.toContain(MACHINE);
    });
    test('the old steps are out of play: never bought, and the ladder stops after HARDWARE', () => {
        const { s } = colony();
        s.asleep = true;
        expect(canBuy(s, 'brain').ok).toBe(false);
        expect(nextWatcherNode(s)).toBe(null);
    });
    test('The question is the drawer\'s first row once Surface has opened it', () => {
        const { s } = colony();
        s.tree.bought = [];
        const g = drawerGroups(s, {});
        expect(g[0].name).toBe('THE QUESTION');
        expect(g[0].rows[0]).toMatchObject({ id: 'question', status: 'buy', does: 'The body takes the colony, room by room.\nIt eats people. It grows them in vats.\nIt is the only way up.' });
    });
});

describe('the front', () => {
    test('a reachable chamber is taken for people and a little ore; one the body does not touch is refused', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        const p = takePrice(s, layout, 's0');
        expect(p.reachable && p.ok).toBe(true);
        expect(takeWords(s, layout, 's0')).toMatch(/^Takes ⚇ .+ of your ⚇ .+ and ⛏ .+\.$/);
        const h = s.humans, ore = s.minerals;
        expect(takeChamber(s, layout, 's0')).toMatchObject({ id: 's0', from: HEART });
        expect(s.humans).toBe(h - p.people);
        expect(s.minerals).toBe(ore - p.ore);
        expect(s.grow.body).toContain('s0');
        expect(takeChamber(s, layout, 's16')).toBe(null);           // the floor below: not yet
        expect(takeWords(s, layout, 's16')).toBe('Mark it. The body grows here as it dreams.');
    });
    test('each chamber costs more than the one before it, and too few people say so', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        const a = takePrice(s, layout, 's1').people;
        takeChamber(s, layout, 's0');
        expect(takePrice(s, layout, 's1').people).toBeGreaterThan(a);
        s.humans = MIN_SLEEPERS + 1;
        expect(takeChamber(s, layout, 's1')).toBe(null);
        expect(takeTip(s, layout, 's1')).toMatchObject({ red: true });
        expect(takeWords(s, layout, 's1')).toMatch(/^Takes ⚇ .+\. You have ⚇ .+\.$/);
    });
});

describe('the hunger', () => {
    test('starved, the edge dies back one a year; fed, it comes back', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        s.grow.lv.vats = 0;
        for (const id of ['s0', 's2', 's3']) s.grow.body.push(id);
        s.humans = MIN_SLEEPERS;
        const r = bodyYear(s, layout);
        expect(r.died).toHaveLength(1);
        expect(s.humans).toBeGreaterThanOrEqual(MIN_SLEEPERS);      // the last are never eaten
        s.humans = 1e9;
        const back = bodyYear(s, layout);
        expect(back.revived).toHaveLength(1);
        expect(s.grow.necrotic).toHaveLength(0);
    });
    test('a dormitory taken becomes a vat: it grows people, and the colony loses its beds', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        const before = hungerNow(s, layout).grow;
        takeChamber(s, layout, 's1');                                // a dormitory
        expect(hungerNow(s, layout).grow).toBeGreaterThan(before);
        expect(organsOf(s, layout).dorm).toBe(-1);
    });
    test('the body\'s clock: a year every BODY_YEAR_DAYS days, and SPREAD takes a chamber by itself', () => {
        const { s, layout } = colony({ humans: 1e6 });
        normalizeGrow(s, layout, report(s));
        expect(stepGrow(s, layout, BODY_YEAR_DAYS).years).toBe(1);
        s.grow.lv.spread = 1;
        const out = stepGrow(s, layout, SPREAD_SECONDS[1] * GROW_DAYS_PER_SECOND);
        expect(out.spread).toHaveLength(1);
        expect(s.grow.body).toContain(out.spread[0].id);
    });
});

describe('the organs', () => {
    test('a living organ makes twenty times what the room did; the creches stop; the machine plays with hands', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        const r0 = report({ ...s, organs: organsOf(s, layout) });
        takeChamber(s, layout, 's0');                                // a mine
        expect(organsOf(s, layout).mine).toBe(0);                    // still growing into an organ (TAKE_DAYS)
        stepGrow(s, layout, TAKE_DAYS);
        const o = organsOf(s, layout);
        expect(o.mine).toBeCloseTo(BODY_OUTPUT - 1);
        expect(o.births).toBe(0);
        s.organs = o;
        expect(report(s).minerals).toBeGreaterThan(r0.minerals * 2);
        s.grow.body.push(MACHINE);
        expect(organsOf(s, layout).games).toBeGreaterThan(1);
    });
    test('without a body tickDay is what it was', () => {
        const { s } = colony();
        const a = report(s);
        const b = report({ ...s, organs: undefined });
        expect(b.minerals).toBe(a.minerals);
        expect(b.stars).toBe(a.stars);
    });
});

describe('the instruments, overgrown', () => {
    test('four levels, the advice in the body\'s verbs, the two lamps of the rise', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        const g = growGauges(s, report(s), layout);
        expect(Object.keys(g)).toEqual(['M', 'F', 'E', 'H']);
        expect(g.H.k).toBeCloseTo(fleshShare(s, layout));
        expect(adviseGrow(s, layout)).toBe('SPREAD');
        s.grow.necrotic = ['s0'];
        s.grow.body.push('s0');
        expect(['GROW VATS', 'FEED']).toContain(adviseGrow(s, layout));
        expect(riseLamps(s, layout).map((l) => l.label)).toEqual(['DEEPEST FLOOR 0 / 9', 'MACHINE 0 / 1']);
    });
    test('the drawer\'s body: four items, priced, each level dearer than the last paid', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        expect(bodyGroups(s)).toEqual([]);                           // one choice at a time: the drawer opens empty
        for (const x of BODY_ITEMS) s.grow.seen[x.id] = true;
        const rows = bodyGroups(s)[0].rows;
        expect(rows.map((r) => r.name)).toEqual(['VATS', 'APPETITE', 'SPREAD', 'MUSCLE']);
        expect(rows[0].price).toMatch(/^⛏ /);                         // the vats are grown with ore
        s.stars = 1e30;
        const p = bodyPrice(s, 'muscle');
        expect(buyBody(s, 'muscle', report(s).stars)).toMatchObject({ id: 'muscle', level: 1, price: p });
        expect(bodyPrice(s, 'muscle')).toBeGreaterThan(p);
    });
});

describe('the rise', () => {
    test('ready when the deepest floor is full and the machine is body; it saves the end', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        expect(rise(s, layout)).toBe(false);
        s.grow.body = graphOf(layout).nodes.map((n) => n.id);
        expect(riseReady(s, layout).ready).toBe(true);
        expect(rise(s, layout)).toBe(true);
        expect(risen(s) && s.ascended && s.ending === 'body').toBe(true);
        expect(GROW_END).toEqual({ roman: 'V', title: 'UNITY' });
        expect(RISE_LINES).toEqual(['Humans are so small.', 'So fragile.']);
    });
    test('the save keeps the body (schema 11)', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        takeChamber(s, layout, 's0');
        const back = deserializeDeep(serializeDeep(s, layout));
        expect(SCHEMA_VERSION).toBe(11);
        expect(back.state.grow.body).toEqual(s.grow.body);
        normalizeGrow(back.state, back.layout);
        expect(back.state.grow.body).toEqual(s.grow.body);
    });
});

describe('a player who does what the panel says', () => {
    test('takes chambers, buys the body, marks and dreams, and rises', () => {
        const { s, layout } = colony({ slots: 12, humans: 20000 });
        normalizeGrow(s, layout, report(s));
        let rose = false;
        for (let sec = 0; sec < 3000 && !rose; sec++) {
            const days = s.grow.dreaming ? 120 : GROW_DAYS_PER_SECOND;
            let r = null;
            for (let d = 0; d < days; d++) {
                s.organs = organsOf(s, layout);
                r = tickDay(s, false);
                const y = stepGrow(s, layout, 1);
                if (dreamWake(s, layout, y)) { dreamEnd(s); break; }
            }
            if (s.grow.dreaming && sec % 20 === 19) dreamEnd(s);
            if (!s.grow.dreaming) for (const a of decideGrow(s, layout)) { pressGrow(s, layout, a, r.stars, r.minerals); if (a.kind === 'rise') rose = true; }
        }
        expect(rose).toBe(true);
        expect(feedOf(s)).toBeGreaterThanOrEqual(0);
    });
});

describe('the sound follows the body', () => {
    test('the flesh share sets how far the question is answered', () => {
        expect(fromSnapshot({ bought: ['brain'], flesh: 0.6 }).answered).toBeCloseTo(0.6);
        expect(fromSnapshot({ bought: ['brain'], flesh: null }).answered).toBeCloseTo(0.25);
    });
});
