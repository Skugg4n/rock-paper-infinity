// deep-grow, rebuilt in deep-organs: movement III · GROW as the colony plays it (grow.js): the organ
// ring, the take that pumps fill, the four gauges, the starving edge, the cascade, the hands, the
// dream, the save, the player who reads the gauges.
import {
    normalizeGrow, growOn, risen, graphOf, takeChamber, takeWords, takeTip, takeOffer, startTake, fillTake, taking,
    bodyYear, stepGrow, organsOf, growGauges, adviseGrow, riseLamps, riseReady, bodyPrice, rise,
    viewOf, feedOf, hungerNow, bodyRatios, pump, handsGames, peoplePerSecond, settleFloors, toggleMark, dreamStart,
    dreamWake, dreamEnd, markThreads, MIGRATE_PER_STEP, GROW_DAYS_PER_SECOND, BODY_YEAR_S, BODY_ITEMS, GROW_END,
    RISE_LINES, START_MASS, PULSE_STARVE_S, QUESTION_VATS, ORGAN_ROOM, growWord,
} from './grow.js';
import { initialDeepState, tickDay, MIN_SLEEPERS } from './deep.js';
import { initialWatcher, LADDER } from './watcher.js';
import { serializeDeep, deserializeDeep, SCHEMA_VERSION } from './persistence.js';
import { BODY_OUTPUT, HEART, MACHINE } from './growth.js';
import { CHEAP, FULL_FLOOR, bodySums, takeWork } from './organs.js';
import { fromSnapshot } from './sound.js';
import { decideGrow, pressGrow, PUMP_EVERY_S } from './policy.js';
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
const begun = (o) => { const c = colony(o); normalizeGrow(c.s, c.layout, report(c.s)); return c; };
/** Lay a body on at once: these chambers, as these organs. */
function lay(s, layout, organs) {
    for (const [id, o] of Object.entries(organs)) { s.grow.body.push(id); if (o !== 'hands') s.grow.organs[id] = o; }
    settleFloors(s, layout, { silent: true });
}

describe('the question opens the body', () => {
    test('the body starts on the lid with mass for a few takes; the culture vats are its first vats', () => {
        const { s, layout } = begun();
        expect(growOn(s)).toBe(true);
        expect(s.grow.body).toEqual([HEART]);
        expect(s.grow.mass).toBe(START_MASS);
        expect(s.grow.lv.vats).toBe(3);
        expect(s.grow.take).toBe(null);
        for (const x of BODY_ITEMS) expect(bodyPrice(s, x.id)).toBeGreaterThan(0);
        expect(viewOf(s, layout).reachable.sort()).toEqual(['s0', 's1', 's2', 's3']);
        expect(QUESTION_VATS).toBe(2);
    });
    test('without the question there is no body; the old ending (the Watcher alone) stays as it was', () => {
        const { s, layout } = colony();
        s.tree.bought = [];
        expect(normalizeGrow(s, layout)).toBe(false);
        const g = colony();
        g.s.watcher.gone = true;
        expect(normalizeGrow(g.s, g.layout)).toBe(false);
    });
    test('old biological steps are migrated into a body of organs: three chambers a step, nothing lost', () => {
        const { s, layout } = colony();
        s.tree.bought = [];
        s.watcher.bought = [...s.watcher.bought, 'brain', 'nervous'];
        s.watcher.sealing = 'spinal';
        expect(normalizeGrow(s, layout, report(s))).toBe(true);
        expect(s.grow.body.length - 1).toBe(3 * MIGRATE_PER_STEP);
        expect(s.watcher.sealing).toBe(null);
        expect(s.grow.body).not.toContain(MACHINE);
        for (const id of s.grow.body.filter((x) => x !== HEART)) expect(['vat', 'gut', 'heart', 'nerve']).toContain(s.grow.organs[id]);
    });
    test('the old steps are out of play; The question is the drawer\'s first row once opened', () => {
        const { s } = colony();
        s.asleep = true;
        expect(canBuy(s, 'brain').ok).toBe(false);
        expect(nextWatcherNode(s)).toBe(null);
        const q = colony().s;
        q.tree.bought = [];
        expect(drawerGroups(q, {})[0].name).toBe('THE QUESTION');
    });
});

describe('every take is a choice of organ', () => {
    test('a chamber in reach opens a ring of four organs, each priced in mass; the room\'s own is cheap', () => {
        const { s, layout } = begun();
        const o = takeOffer(s, layout, 's0');                       // a mine
        expect(o.organs.map((r) => r.organ)).toEqual(['vat', 'gut', 'heart', 'nerve']);
        const gut = o.organs.find((r) => r.organ === 'gut'), vat = o.organs.find((r) => r.organ === 'vat');
        expect(gut.cheap && !vat.cheap).toBe(true);
        expect(gut.mass).toBe(Math.ceil(vat.mass * CHEAP));
        expect(o.organs.every((r) => r.ok)).toBe(true);
        expect(takeOffer(s, layout, 's16')).toBe(null);             // a floor below: not yet
        expect(takeWords(s, layout, 's16')).toBe('Mark it. The body grows here as it dreams.');
        expect(takeWords(s, layout, 's0')).toMatch(/^Grow an organ here\. From ⬮ \d+\.$/);
    });
    test('the take is paid now and is the body\'s when the work is done; one at a time', () => {
        const { s, layout } = begun();
        const m = s.grow.mass;
        const t = startTake(s, layout, 's0', 'gut');
        expect(t).toMatchObject({ id: 's0', organ: 'gut' });
        expect(s.grow.mass).toBe(m - t.mass);
        expect(s.grow.body).not.toContain('s0');
        expect(takeOffer(s, layout, 's1').organs.every((r) => !r.ok)).toBe(true);
        expect(takeTip(s, layout, 's1').text).toBe('The body is taking another chamber.');
        expect(takeTip(s, layout, 's0').text).toBe('Taking it. Pump the heart.');
        expect(fillTake(s, layout, t.work / 2)).toBe(null);
        expect(viewOf(s, layout).taking).toMatchObject({ id: 's0', organ: 'gut', k: 0.5 });
        expect(fillTake(s, layout, t.work)).toMatchObject({ id: 's0', organ: 'gut', from: HEART });
        expect(s.grow.body).toContain('s0');
        expect(s.grow.organs.s0).toBe('gut');
        expect(taking(s)).toBe(null);
    });
    test('too little mass says so in red, with what the player has', () => {
        const { s, layout } = begun();
        s.grow.mass = 1;
        expect(takeTip(s, layout, 's2')).toMatchObject({ red: true });
        expect(takeWords(s, layout, 's2')).toMatch(/^Needs ⬮ \d+\. You have ⬮ 1\.$/);
        expect(startTake(s, layout, 's2', 'vat')).toBe(null);
    });
    test('a living organ can be grown again into another, for a price', () => {
        const { s, layout } = begun();
        takeChamber(s, layout, 's0', { organ: 'gut' });
        s.grow.mass = 1e6;
        const o = takeOffer(s, layout, 's0');
        expect(o.regrow).toBe('gut');
        expect(o.organs.map((r) => r.organ)).toEqual(['vat', 'heart', 'nerve']);
        const t = startTake(s, layout, 's0', 'heart');
        expect(t.work).toBeLessThan(takeWork(graphOf(layout), 's0'));
        fillTake(s, layout, t.work);
        expect(s.grow.organs.s0).toBe('heart');
        expect(takeWords(s, layout, 's0')).toBe('A heart. Click to grow it into another.');
    });
});

describe('pumping takes chambers', () => {
    test('a pump fills the take a visible step: on the beat four times off it; with no take the guts make mass', () => {
        const { s, layout } = begun();
        const t = startTake(s, layout, 's0', 'gut');
        const on = pump(s, layout, { beat: true });
        expect(on.to).toEqual(['s0']);
        const off = pump(s, layout, { beat: false });
        expect(on.fill / off.fill).toBeCloseTo(4);
        expect(s.grow.take.done).toBeCloseTo(on.fill + off.fill);
        let n = 2;
        while (taking(s)) { pump(s, layout, { beat: true }); n++; }
        expect(n).toBeLessThan(t.work);                                 // a handful of pumps, not dozens
        const m = s.grow.mass;
        const free = pump(s, layout, { beat: true });
        expect(free.mass).toBeGreaterThan(0);
        expect(free.to).toEqual(['s0']);                                  // the blood goes to the gut
        expect(s.grow.mass).toBeCloseTo(m + free.mass);
    });
    test('left alone the take fills slowly by itself; pumping on the human rate is much faster', () => {
        const { s, layout } = begun();
        const t = startTake(s, layout, 's2', 'vat');
        let alone = 0;
        while (taking(s) && alone < 1000) { stepGrow(s, layout, 1); alone++; }
        const b = begun();
        startTake(b.s, b.layout, 's2', 'vat');
        let pumped = 0, k = 0;
        while (taking(b.s) && pumped < 1000) {
            stepGrow(b.s, b.layout, 1);
            pumped++;
            for (; k * PUMP_EVERY_S <= pumped; k++) pump(b.s, b.layout, { beat: k % 2 === 0 });
        }
        expect(t.work).toBeGreaterThan(0);
        expect(alone).toBeGreaterThan(3 * pumped);
    });
    test('hearts make each pump bigger', () => {
        const a = begun();
        const b = begun();
        lay(b.s, b.layout, { s0: 'heart', s1: 'heart', s3: 'heart' });
        startTake(a.s, a.layout, 's2', 'vat');
        b.s.grow.mass = 1e6;
        startTake(b.s, b.layout, 's4', 'vat');
        expect(pump(b.s, b.layout, { beat: true }).fill).toBeGreaterThan(pump(a.s, a.layout, { beat: true }).fill);
    });
});

describe('the four gauges are the four organs', () => {
    test('MASS FEED PULSE FLESH; the weakest has the dot; the tape names the organ to grow', () => {
        const { s, layout } = begun();
        const g = growGauges(s, report(s), layout);
        expect(Object.keys(g)).toEqual(['M', 'F', 'E', 'H']);
        expect(g.M.num).toMatch(/^⬮ /);
        expect(g.F.num).toMatch(/^⚇ /);
        expect(adviseGrow(s, layout)).toBe('TAKE A CHAMBER');
        // a body of guts only: the nerves fall short first
        s.grow.mass = 1e6;
        lay(s, layout, { s0: 'gut', s1: 'gut', s2: 'gut', s3: 'gut', s4: 'gut', s5: 'gut', s6: 'gut' });
        const R = bodyRatios(s, layout);
        expect(R.ratios[R.weakest]).toBeLessThan(1);
        const g2 = growGauges(s, report(s), layout);
        expect(g2[R.weakest].weakest).toBe(true);
        expect(g2[R.weakest].red).toBe(true);
        expect(adviseGrow(s, layout)).toBe(growWord({ M: 'gut', F: 'vat', E: 'heart', H: 'nerve' }[R.weakest]));
        startTake(s, layout, 's7', 'nerve');
        expect(adviseGrow(s, layout)).toBe('PUMP');
        expect(R.pace).toBeLessThan(1);                                   // the weakest slows every take
    });
    test('the lamps of the rise as counts', () => {
        const { s, layout } = begun();
        expect(riseLamps(s, layout).map((l) => l.label)).toEqual(['DEEPEST FLOOR 0 / 9', 'MACHINE 0 / 1']);
    });
});

describe('the hunger is a slope with a way back', () => {
    test('beyond the hearts\' reach the edge starves, one at a time; a heart brings it back', () => {
        const { s, layout } = begun({ humans: 1e6 });
        s.grow.mass = 1e6;
        const ring = graphOf(layout).nodes.filter((n) => n.floor === 0 && n.kind === 'room').map((n) => n.id);
        lay(s, layout, Object.fromEntries(ring.slice(0, -1).map((id) => [id, 'vat'])));
        const y = stepGrow(s, layout, PULSE_STARVE_S);
        expect(y.died.length).toBe(1);
        expect(bodyRatios(s, layout).ratios.E).toBeLessThan(1.05);
        // grow two of the living vats into hearts: the reach comes back and the dead revive
        for (const id of s.grow.body.filter((x) => s.grow.organs[x] === 'vat' && !s.grow.necrotic.includes(x)).slice(0, 2)) s.grow.organs[id] = 'heart';
        let back = [];
        for (let i = 0; i < 20 && !back.length; i++) back = stepGrow(s, layout, 1).revived;
        expect(back.length).toBe(1);
    });
    test('FEED empty: the edge dies back a body year at a time, the last people never eaten; fed, it comes back', () => {
        const { s, layout } = begun();
        s.grow.lv.vats = 0;
        lay(s, layout, { s0: 'gut', s2: 'nerve', s3: 'heart' });
        s.humans = MIN_SLEEPERS;
        const r = bodyYear(s, layout);
        expect(r.died).toHaveLength(1);
        expect(s.humans).toBeGreaterThanOrEqual(MIN_SLEEPERS);
        s.humans = 1e9;
        expect(bodyYear(s, layout).revived).toHaveLength(1);
    });
    test('a vat grows people; the counter says a second', () => {
        const { s, layout } = begun();
        const before = hungerNow(s, layout).grow;
        takeChamber(s, layout, 's1', { organ: 'vat' });
        expect(hungerNow(s, layout).grow).toBeGreaterThan(before);
        expect(peoplePerSecond(s, layout)).toBeCloseTo(hungerNow(s, layout).net / BODY_YEAR_S);
        expect(feedOf(s)).toBeGreaterThan(0);
    });
});

describe('what the organs make', () => {
    test('a chamber taken stops being its room and works as its organ, twenty times over; the creches stop', () => {
        const { s, layout } = begun();
        const r0 = report({ ...s, organs: organsOf(s, layout) });
        takeChamber(s, layout, 's0', { organ: 'heart' });                 // a mine, grown as a heart
        const o = organsOf(s, layout);
        expect(o.mine).toBe(-1);
        expect(o.generator).toBeCloseTo(BODY_OUTPUT);
        expect(o.births).toBe(0);
        s.organs = o;
        expect(report(s).energyMade).toBeGreaterThan(r0.energyMade * 2);
        expect(ORGAN_ROOM).toEqual({ vat: 'farm', gut: 'mine', heart: 'generator', nerve: null });
    });
    test('THE HANDS: the machine house plays more games, and more with PULSE', () => {
        const { s, layout } = begun();
        s.grow.body.push(MACHINE);
        const weak = handsGames(s, layout);
        expect(organsOf(s, layout).games).toBe(weak);
        expect(weak).toBeGreaterThan(1);
        lay(s, layout, { s0: 'heart', s1: 'heart', s2: 'heart' });
        expect(handsGames(s, layout)).toBeGreaterThanOrEqual(weak);
    });
    test('without a body tickDay is what it was', () => {
        const { s } = colony();
        const a = report(s);
        const b = report({ ...s, organs: undefined });
        expect(b.minerals).toBe(a.minerals);
        expect(b.stars).toBe(a.stars);
    });
});

describe('a full floor cascades', () => {
    test('its organs give FULL_FLOOR times and the landing below becomes spine by itself', () => {
        const { s, layout } = begun({ humans: 1e6 });
        s.grow.mass = 1e6;
        const graph = graphOf(layout);
        const ring = graph.nodes.filter((n) => n.floor === 0 && n.kind === 'room').map((n) => n.id);
        lay(s, layout, Object.fromEntries(ring.slice(0, -1).map((id, i) => [id, ['vat', 'gut', 'heart', 'nerve'][i % 4]])));
        const before = bodySums(graph, { body: s.grow.body, necrotic: [], organs: s.grow.organs });
        expect(s.grow.body).not.toContain('h1');
        startTake(s, layout, ring[ring.length - 1], 'heart');
        const done = fillTake(s, layout, 1e6);
        expect(done.cascade).toEqual([0]);
        expect(done.spine).toEqual(['h1']);
        expect(s.grow.body).toContain('h1');
        const after = bodySums(graph, { body: s.grow.body, necrotic: [], organs: s.grow.organs });
        expect(after.give.gut).toBeCloseTo(before.give.gut * FULL_FLOOR);
        expect(viewOf(s, layout).reachable).toContain(MACHINE);
    });
});

describe('the body dreams', () => {
    test('a mark: the dream takes toward it by itself, choosing what the body needs, and wakes REACHED', () => {
        const { s, layout } = begun({ humans: 1e7 });
        s.grow.mass = 1e6;
        expect(toggleMark(s, layout, 's8')).toBe(true);
        expect(markThreads(s, layout)).toEqual([{ id: 's8', from: HEART }]);
        dreamStart(s, layout);
        let woke = '';
        for (let t = 0; t < 2000 && !woke; t++) woke = dreamWake(s, layout, stepGrow(s, layout, 1));
        expect(['REACHED', 'SPENT']).toContain(woke);
        if (woke === 'REACHED') expect(s.grow.body).toContain('s8');
        expect(s.grow.body.length).toBeGreaterThan(1);
        dreamEnd(s);
        expect(s.grow.dreaming).toBe(false);
    });
    test('a dream ends SPENT when its length is dreamt, and HUNGER when a room dies', () => {
        const { s, layout } = begun();
        dreamStart(s, layout);
        let woke = '';
        for (let t = 0; t < 500 && !woke; t++) woke = dreamWake(s, layout, stepGrow(s, layout, 1));
        expect(woke).toBe('SPENT');
        dreamEnd(s);
        const h = begun();
        h.s.grow.lv.vats = 0;
        lay(h.s, h.layout, { s0: 'gut', s2: 'nerve', s3: 'heart', s4: 'gut' });
        h.s.humans = MIN_SLEEPERS + 30;
        dreamStart(h.s, h.layout);
        woke = '';
        for (let t = 0; t < 500 && !woke; t++) woke = dreamWake(h.s, h.layout, stepGrow(h.s, h.layout, 1));
        expect(woke).toBe('HUNGER');
    });
});

describe('the rise', () => {
    test('ready when the deepest floor is full and the machine is body; it saves the end', () => {
        const { s, layout } = begun();
        expect(rise(s, layout)).toBe(false);
        s.grow.body = graphOf(layout).nodes.map((n) => n.id);
        expect(riseReady(s, layout).ready).toBe(true);
        expect(adviseGrow(s, layout)).toBe('RISE');
        expect(rise(s, layout)).toBe(true);
        expect(risen(s) && s.ascended && s.ending === 'body').toBe(true);
        expect(GROW_END).toEqual({ roman: 'V', title: 'UNITY' });
        expect(RISE_LINES).toEqual(['Humans are so small.', 'So fragile.']);
    });
});

describe('the save', () => {
    test('keeps the body, its organs, its mass and the take in progress (schema 11)', () => {
        const { s, layout } = begun();
        takeChamber(s, layout, 's0', { organ: 'gut' });
        startTake(s, layout, 's1', 'vat');
        fillTake(s, layout, 3);
        const back = deserializeDeep(serializeDeep(s, layout));
        expect(SCHEMA_VERSION).toBe(11);
        normalizeGrow(back.state, back.layout);
        const G = back.state.grow;
        expect(G.body).toEqual(s.grow.body);
        expect(G.organs).toEqual({ s0: 'gut' });
        expect(G.mass).toBeCloseTo(s.grow.mass);
        expect(G.take).toMatchObject({ id: 's1', organ: 'vat', done: 3 });
    });
    test('a save in the middle of GROW from before the organs is given organs and mass, nothing lost', () => {
        const { s, layout } = begun();
        s.grow.body.push('s0', 's1', 's2', 's3');
        for (const k of ['organs', 'mass', 'take', 'full', 'starve', 'revive', 'regrown']) delete s.grow[k];
        s.grow.growing = { s3: 4 };
        s.grow.spreadClock = 3;
        s.grow.lv.spread = 1;
        const back = deserializeDeep(serializeDeep(s, layout));
        normalizeGrow(back.state, back.layout);
        const G = back.state.grow;
        expect(G.body).toEqual(s.grow.body);
        expect(G.organs).toEqual({ s0: 'gut', s1: 'vat', s2: 'vat', s3: 'heart' });
        expect(G.mass).toBeGreaterThanOrEqual(START_MASS);
        expect(G.take).toBe(null);
        expect(G.growing).toBeUndefined();
        expect(G.lv.spread).toBe(1);
        expect(G.seen.spread).toBe(true);
        expect(adviseGrow(back.state, back.layout)).not.toBe('');
    });
});

describe('a player who reads the gauges', () => {
    test('takes chambers as organs, pumps, buys the body, and rises', () => {
        const { s, layout } = colony({ slots: 12, humans: 20000 });
        normalizeGrow(s, layout, report(s));
        let rose = false, k = 0;
        const chosen = new Set();
        for (let sec = 0; sec < 3000 && !rose; sec++) {
            const days = s.grow.dreaming ? 120 : GROW_DAYS_PER_SECOND;
            let r = null;
            for (let d = 0; d < days; d++) { s.organs = organsOf(s, layout); r = tickDay(s, false); }
            const y = stepGrow(s, layout, 1);
            if (dreamWake(s, layout, y)) dreamEnd(s);
            for (; !s.grow.dreaming && k * PUMP_EVERY_S <= sec; k++) pump(s, layout, { beat: k % 2 === 0 });
            if (!s.grow.dreaming) {
                for (const a of decideGrow(s, layout)) {
                    if (a.kind === 'take') chosen.add(a.organ);
                    pressGrow(s, layout, a, r.stars, r.minerals);
                    if (a.kind === 'rise') rose = true;
                }
            }
        }
        expect(rose).toBe(true);
        expect(chosen.size).toBeGreaterThanOrEqual(3);
    });
});

describe('the sound follows the body', () => {
    test('the flesh share sets how far the question is answered', () => {
        expect(fromSnapshot({ bought: ['brain'], flesh: 0.6 }).answered).toBeCloseTo(0.6);
        expect(fromSnapshot({ bought: ['brain'], flesh: null }).answered).toBeCloseTo(0.25);
    });
});
