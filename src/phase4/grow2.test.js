// deep-grow2: a taste of flesh before the question (graft.js), the feeding loop, one choice at a
// time, the dream along the marks, the heart's pump, and the save in the middle of GROW.
import {
    placeGraft, graftCandidates, graftOwed, graftOrgans, graftWords, normalizeGraft, GRAFT_MULT, loneGrafts,
} from './graft.js';
import {
    normalizeGrow, graphOf, takeChamber, takePrice, canAfford, wouldStarve, takeTip, stepGrow, organsOf, bodyGroups,
    unlockBody, toggleMark, dreamStart, dreamWake, dreamEnd, markPick, markThreads, pump, onBeat, beatPhase,
    adviseGrow, riseLamps, peoplePerDay, hungerNow, feedOf, dreamDaysAt, PUMP_ON_BEAT, PUMP_OFF_BEAT, TAKE_DAYS,
    QUESTION_VATS, DREAM_DAYS_PER_SECOND, SPREAD_AFTER, BODY_YEAR_DAYS, GROW_DAYS_PER_SECOND,
} from './grow.js';
import { initialDeepState, tickDay, MIN_SLEEPERS, upkeepFor } from './deep.js';
import { initialWatcher, LADDER, openSurface } from './watcher.js';
import { serializeDeep, deserializeDeep } from './persistence.js';
import { HEART } from './growth.js';
import { initialSurface } from './surface.js';

const PATTERN = ['mine', 'dorm', 'farm', 'generator'];
function colony({ slots = 20, humans = 5000, question = true } = {}) {
    const s = initialDeepState();
    const list = [];
    for (let i = 0; i < slots; i++) list.push(PATTERN[i % 4]);
    const count = (t) => list.filter((x) => x === t).length;
    Object.assign(s, {
        day: 25000 * 365, minerals: 1e15, food: 1e12, stars: 1e17, humans,
        chambers: list.length, rooms: { mine: count('mine'), farm: count('farm'), generator: count('generator'), dorm: count('dorm'), cryo: 0 },
        level: { mine: 10, farm: 10, generator: 10, dorm: 8 }, auto: { mine: 4, farm: 4, generator: 4, dorm: 4 },
        cryo: 5, vats: 1, feed: 8,
        watcher: { ...initialWatcher(), bought: LADDER.filter((u) => u.rung < 2).map((u) => u.id) },
        tree: { opened: ['question'], bought: question ? ['question'] : [], unseen: false },
    });
    return { s, layout: { slots: list } };
}
const report = (s) => tickDay(JSON.parse(JSON.stringify(s)), false);

describe('the graft (a taste of flesh before the question)', () => {
    test('nights 4 and 5 give a graft; Quiet hands is folded into Lossless relay', () => {
        const { s } = colony({ question: false });
        s.watcher.surface = { ...initialSurface(), night: 3, toLine: 0 };
        s.cryo = 4;
        openSurface(s.watcher, s, { force: true });
        expect(graftOwed(s)).toBe(true);
        s.watcher.surface.visit = null;
        openSurface(s.watcher, s, { force: true });
        expect(s.graft.owed).toBe(2);
        const lossless = { ...s, tree: { opened: ['lossless'], bought: ['lossless'] } };
        expect(upkeepFor(lossless, 'mine')).toBe(upkeepFor({ ...s, level: { ...s.level, mine: 0 } }, 'mine'));
    });
    test('one built room turns to flesh: five times its output, its people walk in, a few a year eaten', () => {
        const { s, layout } = colony({ question: false });
        s.graft = { owed: 1, slots: [] };
        expect(graftCandidates(s, layout)).toContain('s0');
        expect(graftWords(s, layout, 's0')).toMatch(/^Five times the output\. Takes ⚇ .+ of your ⚇ .+\.$/);
        const before = report({ ...s, organs: organsOf(s, layout) }).minerals;
        const h = s.humans;
        const r = placeGraft(s, layout, 's0');
        expect(r).toMatchObject({ id: 's0', type: 'mine' });
        expect(s.humans).toBe(h - r.people);
        expect(graftOwed(s)).toBe(false);
        expect(placeGraft(s, layout, 's4')).toBe(null);             // one graft, one room
        const o = graftOrgans(s, layout);
        expect(o.mine).toBe(GRAFT_MULT - 1);
        expect(o.eat).toBeGreaterThan(0);
        s.organs = organsOf(s, layout);
        expect(report(s).minerals).toBeGreaterThan(before * 1.1);
        expect(report(s).died).toBeGreaterThan(0);
    });
    test('the grafts are drawn as lone organs until the body takes them', () => {
        const { s, layout } = colony();
        s.graft = { owed: 0, slots: ['s4'] };
        normalizeGrow(s, layout, report(s));
        expect(loneGrafts(s)).toEqual(['s4']);
        s.grow.body.push('s4');
        expect(loneGrafts(s)).toEqual([]);
    });
    test('a save past night 4 is given its grafts (schema 11); a body under way keeps what it has', () => {
        const { s, layout } = colony({ question: false });
        s.watcher.surface = { ...initialSurface(), night: 5 };
        delete s.graft;
        const raw = JSON.parse(serializeDeep(s, layout));
        raw.schemaVersion = 10;
        const back = deserializeDeep(JSON.stringify(raw));
        expect(normalizeGraft(back.state.graft)).toEqual({ owed: 2, slots: [] });
    });
});

describe('the feeding loop', () => {
    test('the question gives the body two vats at once, FEED rising, and the drawer opens empty', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        expect(s.grow.lv.vats).toBe(QUESTION_VATS);
        expect(hungerNow(s, layout).net).toBeGreaterThan(0);
        expect(bodyGroups(s)).toEqual([]);
        expect(adviseGrow(s, layout)).toBe('SPREAD');
    });
    test('a take that would starve the body is refused: its price red, the word GROW VATS', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        for (const id of ['s0', 's2', 's3']) { s.grow.body.push(id); }
        s.grow.lv.vats = 0;
        // enough people to pay for one more, not enough to feed it
        const p = takePrice(s, layout, 's4');
        s.humans = MIN_SLEEPERS + p.people + 1;
        expect(wouldStarve(s, layout, 's4')).toBe(true);
        expect(takeTip(s, layout, 's4')).toMatchObject({ red: true });
        expect(takeTip(s, layout, 's4').text).toMatch(/The body would starve\.$/);
        expect(takeChamber(s, layout, 's4')).toBe(null);
        unlockBody(s, layout);
        expect(adviseGrow(s, layout)).toBe('GROW VATS');
        expect(bodyGroups(s)[0].rows.map((r) => r.id)).toEqual(['body:vats']);
    });
    test('one choice at a time: VATS, APPETITE after necrosis, SPREAD after ten by hand, MUSCLE with a floor full', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        s.grow.necrotic = ['s0']; s.grow.body.push('s0');
        expect(unlockBody(s, layout).sort()).toEqual(['appetite', 'vats']);
        s.grow.necrotic = [];
        s.grow.hand = SPREAD_AFTER;
        expect(unlockBody(s, layout)).toEqual(['spread']);
        s.grow.body = graphOf(layout).nodes.filter((n) => n.floor === 0).map((n) => n.id);
        expect(unlockBody(s, layout)).toEqual(['muscle']);
    });
    test('starving, the edge greys and the heart keeps making; a dead room revives by itself once fed', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        for (const id of ['s0', 's2', 's3', 's4']) s.grow.body.push(id);
        s.grow.lv.vats = 0;
        s.humans = MIN_SLEEPERS;
        const y = stepGrow(s, layout, BODY_YEAR_DAYS);
        expect(y.died.length).toBe(1);
        expect(s.grow.necrotic.length).toBe(1);
        expect(organsOf(s, layout).mine + organsOf(s, layout).farm + organsOf(s, layout).generator).toBeGreaterThan(0);
        s.humans = 1e6;
        let back = [];
        for (let d = 0; d < 30 && !back.length; d++) back = stepGrow(s, layout, GROW_DAYS_PER_SECOND).revived;
        expect(back.length).toBe(1);
        expect(s.grow.necrotic).toEqual([]);
    });
    test('the people a day, and the lamps as counts', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        expect(peoplePerDay(s, layout)).toBeCloseTo(hungerNow(s, layout).net / BODY_YEAR_DAYS);
        expect(riseLamps(s, layout).map((l) => l.label)).toEqual(['DEEPEST FLOOR 0 / 9', 'MACHINE 0 / 1']);
    });
});

describe('the body dreams', () => {
    test('a mark far off: the dream grows toward it and wakes REACHED', () => {
        const { s, layout } = colony({ humans: 1e7 });
        normalizeGrow(s, layout, report(s));
        expect(toggleMark(s, layout, 's8')).toBe(true);
        expect(markThreads(s, layout)).toEqual([{ id: 's8', from: HEART }]);
        expect(markPick(s, layout)).toBeTruthy();
        dreamStart(s, layout);
        let woke = '';
        for (let d = 0; d < 20000 && !woke; d++) {
            s.organs = organsOf(s, layout);
            tickDay(s, false);
            woke = dreamWake(s, layout, stepGrow(s, layout, 1));
        }
        expect(woke).toBe('REACHED');
        expect(s.grow.body).toContain('s8');
        dreamEnd(s);
        expect(s.grow.dreaming).toBe(false);
    });
    test('the dream dives: it starts slower than its pace and deepens past it', () => {
        expect(dreamDaysAt(0, 1)).toBeLessThan(DREAM_DAYS_PER_SECOND);
        expect(dreamDaysAt(60, 1)).toBeGreaterThan(DREAM_DAYS_PER_SECOND);
    });
    test('a dream that runs out of people wakes HUNGER', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        for (const id of ['s0', 's2', 's3', 's4', 's6']) s.grow.body.push(id);
        s.grow.lv.vats = 0;
        s.humans = MIN_SLEEPERS + 50;
        dreamStart(s, layout);
        let woke = '';
        for (let d = 0; d < 5000 && !woke; d++) woke = dreamWake(s, layout, stepGrow(s, layout, 1));
        expect(woke).toBe('HUNGER');
    });
});

describe('the heart', () => {
    test('a pump on the beat counts double, off it half: a growing organ grows, a dead room revives, ore comes', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        takeChamber(s, layout, 's0');
        expect(s.grow.growing.s0).toBe(TAKE_DAYS);
        const ore = s.minerals;
        const on = pump(s, layout, { beat: true, orePerDay: 100 });
        expect(on.k).toBe(PUMP_ON_BEAT);
        expect(s.minerals).toBeGreaterThan(ore);
        const left = s.grow.growing.s0;
        pump(s, layout, { beat: false, orePerDay: 100 });
        expect(TAKE_DAYS - left).toBeCloseTo(4 * (left - (s.grow.growing.s0 ?? 0)), 5);
        expect(PUMP_OFF_BEAT).toBeLessThan(1);
        s.grow.necrotic = ['s0'];
        let back = null;
        for (let i = 0; i < 10 && !back; i++) back = pump(s, layout, { beat: true }).revived;
        expect(back).toBe('s0');
    });
    test('on the beat: near the thump of the sound\'s heartbeat, or of the heart\'s own clock', () => {
        expect(onBeat(beatPhase(0, { phase: 0.03 }))).toBe(true);
        expect(onBeat(beatPhase(0, { phase: 0.5 }))).toBe(false);
        expect(onBeat(beatPhase(10000))).toBe(true);
        expect(onBeat(beatPhase(10500))).toBe(false);
    });
});

describe('a save in the middle of GROW loads into the second pass', () => {
    test('its body, its bought items in the drawer, the moments that have come', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        s.humans = 1e6;
        for (const id of ['s0', 's1', 's2', 's3']) expect(takeChamber(s, layout, id)).toBeTruthy();
        // as a save from before deep-grow2 would hold it
        for (const k of ['seen', 'growing', 'marks', 'hand', 'vatsBase', 'revive', 'dreamClock', 'dreaming', 'dreamFed', 'dreamMarks']) delete s.grow[k];
        s.grow.lv.spread = 1;
        const back = deserializeDeep(serializeDeep(s, layout));
        normalizeGrow(back.state, back.layout);
        const G = back.state.grow;
        expect(G.body).toEqual(s.grow.body);
        expect(G.seen.spread).toBe(true);
        expect(G.seen.vats).toBe(true);
        expect(G.dreaming).toBe(false);
        expect(feedOf(back.state)).toBeGreaterThan(0);
        expect(canAfford(back.state, back.layout, 's4')).toBe(true);
    });
});
