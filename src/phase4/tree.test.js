/* eslint-env jest */
/*
 * deep-tree, step 1: the skill tree, mechanical state. The upgrades move into the tree with their
 * costs and effects as they were: the tree reads the colony, and buying a node does what the old
 * button did.
 */
import {
    initialDeepState, levelCost, automationCost, CRYO, QUEUE_MAX, isQueued, MAX_AUTO, startBuild, CRYO_TOP,
} from './deep.js';
import { initialWatcher, LADDER, buyStep, capacityMax, nextStep } from './watcher.js';
import { deserializeDeep, SCHEMA_VERSION } from './persistence.js';
import {
    NODES, NODE_BY_ID, BOARD, LEVEL_NODE, AUTO_NODE, cryoNode, STEP_NODE, levelOf, treeLevels,
    canBuy, buy, buyMany, nodeStatus, buyableCount, tracePath, chainTo, watcherBranchOpen,
    nextWatcherNode, priceText, priceOf, LEVEL_MAX,
} from './tree.js';

const start = () => ({ ...initialDeepState({ salvage: 1500, doom0: 85 }), watcher: initialWatcher() });

describe('the board', () => {
    test('every node is on the board, its parent exists, and every trace runs at right angles', () => {
        const ids = new Set();
        for (const n of NODES) {
            expect(ids.has(n.id)).toBe(false);
            ids.add(n.id);
            expect(n.x).toBeGreaterThanOrEqual(0);
            expect(n.x).toBeLessThanOrEqual(BOARD.w);
            expect(n.y).toBeGreaterThanOrEqual(0);
            expect(n.y).toBeLessThanOrEqual(BOARD.h);
            if (n.id === 'root') continue;
            expect(NODE_BY_ID[n.parent]).toBeDefined();
            const pts = tracePath(n.id);
            for (let i = 1; i < pts.length; i++) {
                expect(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1]).toBe(true);
            }
            expect(pts[pts.length - 1]).toEqual([n.x, n.y]);
        }
        expect(chainTo('cryo-iii')).toEqual(['cryo-i', 'cryo-ii', 'cryo-iii']);
    });

    test('every room type has a level node and an automation node; every Watcher step a node', () => {
        for (const t of ['mine', 'farm', 'generator', 'dorm']) {
            expect(NODE_BY_ID[LEVEL_NODE[t]]).toMatchObject({ kind: 'level', type: t });
            expect(NODE_BY_ID[AUTO_NODE[t]]).toMatchObject({ kind: 'auto', type: t, max: MAX_AUTO });
        }
        for (const step of LADDER) expect(NODE_BY_ID[STEP_NODE[step.id]]).toBeDefined();
        CRYO.slice(0, CRYO_TOP + 1).forEach((_, i) => expect(NODE_BY_ID[cryoNode(i)]).toMatchObject({ kind: 'cryo', tier: i }));
        expect(cryoNode(CRYO_TOP + 1)).toBe('longcount');     // the tier past VII is Surface's gift
        const surface = NODES.filter((n) => n.kind === 'surface').map((n) => n.id).sort();
        expect(surface).toEqual(['cold', 'longcount', 'lossless', 'question', 'quiet']);
    });
});

describe('the tree reads the colony', () => {
    test('levels, automations, the cryo tier and the ladder, off the fields the rules keep', () => {
        const s = start();
        s.level.mine = 3; s.auto.farm = 2; s.cryo = 2;
        s.watcher.bought = ['watchdog', 'scheduler'];
        const lv = treeLevels(s);
        expect(lv.seam).toBe(3);
        expect(lv.farmauto).toBe(2);
        expect([lv['cryo-i'], lv['cryo-ii'], lv['cryo-iii'], lv['cryo-iv']]).toEqual([1, 1, 1, 0]);
        expect([lv.watchdog, lv.scheduler, lv.deepread]).toEqual([1, 1, 0]);
        expect(lv.root).toBe(1);
    });
});

describe('buying a level or an automation is the order the button placed', () => {
    test('Seam: paid at the level price and ordered into the queue; the next costs the level after', () => {
        const s = start();
        s.stars = levelCost('mine', 0) * 20;
        expect(canBuy(s, 'seam').ok).toBe(true);
        const r = buy(s, 'seam');
        expect(r).toMatchObject({ kind: 'level', type: 'mine', price: levelCost('mine', 0) });
        expect(s.stars).toBe(levelCost('mine', 0) * 19);
        expect(s.builds).toHaveLength(1);
        expect(s.builds[0]).toMatchObject({ kind: 'level', type: 'mine' });
        expect(isQueued(s.builds[0])).toBe(false);
        expect(levelOf(s, 'seam')).toBe(0);                 // built in six days, as before
        expect(nodeStatus(s, 'seam').ordered).toBe(1);
        expect(priceOf(s, 'seam').stars).toBe(levelCost('mine', 1));
        // a second order waits in its lane behind the first
        buy(s, 'seam');
        expect(isQueued(s.builds[1])).toBe(true);
    });

    test('an automation needs no level first: at the descent cryo asks for automated generators', () => {
        const s = start();
        s.stars = automationCost('generator', 0);
        expect(canBuy(s, 'genauto').ok).toBe(true);
        buy(s, 'genauto');
        expect(s.builds[0]).toMatchObject({ kind: 'auto', type: 'generator' });
        expect(s.stars).toBe(0);
    });

    test('the reasons, in plain words', () => {
        const s = start();
        expect(canBuy(s, 'seam', { starsPerDay: 40 }).reason).toMatch(/^Affordable in \d+ days\.$/);
        expect(canBuy(s, 'seam').reason).toBe('Not affordable at today\'s flow.');
        s.rooms.mine = 0;
        expect(canBuy(s, 'seam').reason).toBe('Build a mine first: there is none to improve.');
        s.rooms.mine = 1;
        s.stars = 1e12;
        s.asleep = true;
        expect(canBuy(s, 'seam').reason).toBe('The colony is asleep: wake it to buy.');
        s.asleep = false;
        for (let i = 0; i < QUEUE_MAX; i++) startBuild(s, 'dig');
        expect(canBuy(s, 'seam').reason).toBe('Eight orders are on the books: wait for one to land.');
        expect(canBuy(s, 'seam', { queueMax: Infinity }).ok).toBe(true);
    });

    test('shift-click buys as many as can be paid, into the queue, up to its cap', () => {
        const s = start();
        s.stars = 1e30;
        const got = buyMany(s, 'output');
        expect(got).toHaveLength(QUEUE_MAX);
        expect(s.builds.filter((j) => j.kind === 'level' && j.type === 'generator')).toHaveLength(QUEUE_MAX);
        const t = start();
        t.stars = levelCost('farm', 0) + levelCost('farm', 1) + 1;
        expect(buyMany(t, 'yield')).toHaveLength(2);
    });

    test('automation stops at four; levels draw twenty pips', () => {
        const s = start();
        s.auto.mine = MAX_AUTO;
        s.stars = 1e30;
        expect(nodeStatus(s, 'drill').status).toBe('bought');
        expect(buy(s, 'drill')).toBeNull();
        expect(NODE_BY_ID.seam.max).toBe(LEVEL_MAX);
    });
});

describe('cryo: a chain of single nodes with today\'s gates', () => {
    test('Cryo I at the descent says what it needs; Cryo III says Cryo II first', () => {
        const s = start();
        s.stars = 1e9;
        const r = canBuy(s, 'cryo-i');
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('Cryo I needs generators automated: asleep, nobody runs them.');
        expect(canBuy(s, 'cryo-iii').reason).toBe('Needs Cryo II first.');
    });

    test('the hall: paid, dug with its own chamber, the tier set; then Cryo II is next', () => {
        const s = start();
        s.stars = CRYO[0].cost + 5;
        const chambers = s.chambers;
        const r = buy(s, 'cryo-i', { need: null });
        expect(r).toMatchObject({ kind: 'cryo', tier: 0 });
        expect(s).toMatchObject({ cryo: 0, chambers: chambers + 1, stars: 5 });
        expect(s.rooms.cryo).toBe(1);
        expect(nodeStatus(s, 'cryo-i').status).toBe('bought');
        s.stars = CRYO[1].cost;
        expect(buy(s, 'cryo-ii', { need: null })).toMatchObject({ tier: 1 });
        expect(s.cryo).toBe(1);
        expect(s.stars).toBe(0);
    });
});

describe('Surface\'s nodes and the teasers', () => {
    test('greyed with the hollow ring, never buyable until Surface opens them', () => {
        const s = start();
        s.stars = 1e30;
        for (const id of ['lossless', 'cold', 'longcount', 'quiet', 'question']) {
            expect(nodeStatus(s, id)).toMatchObject({ status: 'surface', price: null, reason: 'Not ours to open.' });
            expect(buy(s, id)).toBeNull();
        }
        for (const id of ['deepseam', 'hydro', 'hands']) {
            expect(nodeStatus(s, id).status).toBe('locked');
            expect(buy(s, id)).toBeNull();
        }
    });
});

describe('the Watcher\'s branch', () => {
    test('it shows itself after the first sleep, and buys only asleep, in order', () => {
        const s = start();
        expect(watcherBranchOpen(s)).toBe(false);
        s.watcher.sleeps = 1; s.asleep = true;
        expect(watcherBranchOpen(s)).toBe(false);           // the first sleep only teaches
        s.asleep = false;
        expect(watcherBranchOpen(s)).toBe(true);
        s.watcher.capacity = capacityMax(s.watcher);
        s.stars = 1e30; s.minerals = 1e30;
        expect(canBuy(s, 'watchdog').reason).toBe('Only while the colony sleeps.');
        s.asleep = true;
        s.watcher.sleeps = 2;
        expect(canBuy(s, 'scheduler').reason).toBe('Needs Watchdog first.');
        expect(nextWatcherNode(s)).toBe('watchdog');
        expect(buy(s, 'watchdog', { slots: [] })).toMatchObject({ kind: 'watcher' });
        expect(s.watcher.bought).toEqual(['watchdog']);
        expect(nextWatcherNode(s)).toBe('scheduler');
    });

    test('a step bought on the tree is the step buyStep sells, at the same price', () => {
        const a = start(), b = start();
        for (const s of [a, b]) { s.asleep = true; s.watcher.sleeps = 3; s.stars = 1e9; s.watcher.capacity = 100; }
        buy(a, 'watchdog');
        buyStep(b.watcher, b, []);
        expect(a.stars).toBe(b.stars);
        expect(a.watcher).toEqual(b.watcher);
        expect(priceText(priceOf(a, 'scheduler'))).toBe('30 cap + ★ 200 k');
    });

    test('a biological step waits for its sector, and its node says so', () => {
        const s = start();
        s.asleep = true;
        s.watcher.sleeps = 9;
        s.watcher.bought = LADDER.filter((u) => u.rung < 2).map((u) => u.id);
        s.watcher.capacity = capacityMax(s.watcher);
        s.watcher.grown = 100;
        s.humans = 400;
        s.stars = 1e30;
        s.tree = { opened: ['question'], bought: ['question'] };       // deep-voice: BIOLOGICAL grows out of The question
        const r = buy(s, 'brain', { slots: ['mine', 'farm', 'generator', 'dorm'], choose: true });
        expect(r.step.pending).toBe(true);
        expect(s.watcher.sealing).toBe('brain');
        const st = nodeStatus(s, 'brain');
        expect(st).toMatchObject({ status: 'buyable', kind: 'choose', reason: 'Paid. Choose a sector to seal.' });
        expect(buy(s, 'brain')).toMatchObject({ choose: true });
        expect(nextStep(s.watcher).id).toBe('brain');
    });
});

describe('the badge and the save', () => {
    test('the badge counts what can be bought now', () => {
        const s = start();
        expect(buyableCount(s)).toBe(0);
        s.stars = levelCost('mine', 0);
        expect(buyableCount(s, { need: { kind: 'stall' } })).toBe(5);   // the four levels and the machine's feed
        s.stars = automationCost('mine', 0);
        expect(buyableCount(s, { need: { kind: 'stall' } })).toBe(9);   // and the four automations
    });

    test('a schema 5 save keeps every level, automation, cryo tier and Watcher step, read as nodes', () => {
        const old = {
            ...initialDeepState(),
            level: { mine: 7, farm: 6, generator: 8, dorm: 5 },
            auto: { mine: 3, farm: 4, generator: 2, dorm: 1 },
            cryo: 3,
            watcher: { ...initialWatcher(), sleeps: 6, bought: ['watchdog', 'scheduler', 'deepread', 'nightvision', 'cooling'] },
        };
        const back = deserializeDeep(JSON.stringify({ schemaVersion: 5, state: old, layout: { slots: ['mine', 'farm', 'generator', 'dorm', 'cryo'] } }));
        expect(SCHEMA_VERSION).toBe(8);
        expect(back.state.tree).toEqual({ opened: [], bought: [], unseen: false });
        const lv = treeLevels(back.state);
        expect([lv.seam, lv.yield, lv.output, lv.beds]).toEqual([7, 6, 8, 5]);
        expect([lv.drill, lv.farmauto, lv.genauto, lv.creche]).toEqual([3, 4, 2, 1]);
        expect(['cryo-i', 'cryo-ii', 'cryo-iii', 'cryo-iv', 'cryo-v'].map((id) => lv[id])).toEqual([1, 1, 1, 1, 0]);
        expect(['watchdog', 'scheduler', 'deepread', 'nightvision', 'cooling', 'secondcore'].map((id) => lv[id])).toEqual([1, 1, 1, 1, 1, 0]);
    });
});
