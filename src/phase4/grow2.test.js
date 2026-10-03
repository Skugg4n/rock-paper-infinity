// deep-grow2: a taste of flesh before the question (graft.js), the feeding loop, one choice at a
// time, the dream along the marks, the heart's pump, and the save in the middle of GROW.
import {
    placeGraft, graftCandidates, graftOwed, graftOrgans, graftWords, normalizeGraft, GRAFT_MULT, loneGrafts,
} from './graft.js';
import {
    normalizeGrow, graphOf, takeChamber, canAfford, organsOf, bodyGroups, unlockBody, onBeat, beatPhase, feedOf,
    dreamDaysAt, DREAM_DAYS_PER_SECOND, SPREAD_AFTER,
} from './grow.js';
import { initialDeepState, tickDay, upkeepFor } from './deep.js';
import { initialWatcher, LADDER, openSurface } from './watcher.js';
import { serializeDeep, deserializeDeep } from './persistence.js';
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

describe('the body dreams (the second pass, kept)', () => {
    test('the dream dives: it starts slower than its pace and deepens past it', () => {
        expect(dreamDaysAt(0, 1)).toBeLessThan(DREAM_DAYS_PER_SECOND);
        expect(dreamDaysAt(60, 1)).toBeGreaterThan(DREAM_DAYS_PER_SECOND);
    });
});

describe('the heart\'s rhythm', () => {
    test('on the beat: near the thump of the sound\'s heartbeat, or of the heart\'s own clock', () => {
        expect(onBeat(beatPhase(0, { phase: 0.03 }))).toBe(true);
        expect(onBeat(beatPhase(0, { phase: 0.5 }))).toBe(false);
        expect(onBeat(beatPhase(10000))).toBe(true);
        expect(onBeat(beatPhase(10500))).toBe(false);
    });
});

describe('one choice at a time', () => {
    test('VATS when FEED falls, APPETITE after necrosis, SPREAD after ten by hand, MUSCLE with a floor full', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        expect(bodyGroups(s)).toEqual([]);
        s.grow.necrotic = ['s0']; s.grow.body.push('s0');
        expect(unlockBody(s, layout).sort()).toEqual(['appetite', 'vats']);
        s.grow.necrotic = [];
        s.grow.hand = SPREAD_AFTER;
        expect(unlockBody(s, layout)).toEqual(['spread']);
        s.grow.body = graphOf(layout).nodes.filter((n) => n.floor === 0).map((n) => n.id);
        expect(unlockBody(s, layout)).toEqual(['muscle']);
    });
});

describe('a save in the middle of GROW loads into the third pass', () => {
    test('its body, its bought items in the drawer, the moments that have come, organs for its chambers', () => {
        const { s, layout } = colony();
        normalizeGrow(s, layout, report(s));
        s.humans = 1e6;
        s.grow.mass = 1e6;
        for (const id of ['s0', 's1', 's2', 's3']) expect(takeChamber(s, layout, id)).toBeTruthy();
        // as a save from before deep-grow2 would hold it
        for (const k of ['seen', 'marks', 'hand', 'vatsBase', 'revive', 'dreaming', 'dreamFed', 'dreamMarks', 'organs', 'mass']) delete s.grow[k];
        s.grow.lv.spread = 1;
        const back = deserializeDeep(serializeDeep(s, layout));
        normalizeGrow(back.state, back.layout);
        const G = back.state.grow;
        expect(G.body).toEqual(s.grow.body);
        expect(G.seen.spread).toBe(true);
        expect(G.seen.vats).toBe(true);
        expect(G.dreaming).toBe(false);
        expect(Object.keys(G.organs).sort()).toEqual(['s0', 's1', 's2', 's3']);
        expect(feedOf(back.state)).toBeGreaterThan(0);
        expect(canAfford(back.state, back.layout, 's4')).toBe(true);
    });
});
