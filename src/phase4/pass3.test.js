/**
 * deep-pass3 (B400 to B407): the second human pass of v1.83.0 said GROW alone was worth ten minutes and the
 * chapter was not yet worth Ola's time. These hold the fixes: the Watcher warns and teaches before it
 * punishes, GROW's tape is always doable and points somewhere, the gauges ring the short one, TEND says what
 * a room does to the stars, SLEEP orders in the night and wakes for a deeper sleep, the drawer lists and
 * rings what the tape names, and the asleep tape never asks for an awake thing.
 */
import { initialDeepState, tickDay, setIncome, impliedFeed, CRYO } from './deep.js';
import {
    initialWatcher, mindWarning, steadyHint, STEADY_HINT, WARN_BELOW, STEADY_AT, openPuzzle, pressLamp, puzzleDue,
    lampHint, taughtLamps, LAMP_HINT, normalizeWatcher, REBOOT_TO, watchSleep,
} from './watcher.js';
import {
    adviseAsleep, adviceNote, advise, ADVICE, wakeWhy, WAKE_WHY, roomStarsLine, calledRow, drawerGroups, LEVELS_ROW,
    tierDue, URGENT_ADVICE,
} from './instruments.js';
import { cryoRoad } from './readout.js';
import { initialTree, canBuy, buy as treeBuy, NODE_BY_ID } from './tree.js';
import { initialSurface } from './surface.js';
import {
    normalizeGrow, adviseGrow, growDoable, growTarget, growGauges, stepGrow, pump, GROW_ADVICE, wantOrgan, risen,
} from './grow.js';
import { decideGrow, pressGrow } from './policy.js';
import { GAUGE_ORGAN, massRate, bodySums, LID_MASS, takeMass, TAKE_REF } from './organs.js';
import { graphFromSlots, HEART } from './growth.js';
import { LADDER } from './watcher.js';

const asleepWatcher = (o = {}) => ({ ...initialWatcher(), sleeps: 4, capacity: 100, nextPuzzleYears: 0, ...o });

describe('the Watcher explains itself (B400)', () => {
    test('the mind warns under WARN_BELOW and stops at STEADY_AT, never in the first sleep', () => {
        const w = asleepWatcher({ stability: WARN_BELOW + 5 });
        expect(mindWarning(w, true)).toBe(false);
        w.stability = WARN_BELOW - 1;
        expect(mindWarning(w, true)).toBe(true);
        expect(w.warned).toBe(1);
        w.stability = STEADY_AT - 1;
        expect(mindWarning(w, true)).toBe(true);           // one snap is not enough: it stays until steady
        w.stability = STEADY_AT;
        expect(mindWarning(w, true)).toBe(false);
        const first = { ...initialWatcher(), sleeps: 1, stability: 5 };
        expect(mindWarning(first, true)).toBe(false);
        expect(mindWarning(asleepWatcher({ stability: 5 }), false)).toBe(false);
    });
    test('asleep the tape says STEADY THE MIND first, with the hint only the first time', () => {
        const s = { ...initialDeepState(), cryo: 1, asleep: true, tree: initialTree() };
        s.watcher = asleepWatcher({ stability: 10 });
        mindWarning(s.watcher, true);
        const word = adviseAsleep(s);
        expect(word).toBe('STEADY THE MIND');
        expect(adviceNote(s, word)).toBe(STEADY_HINT);
        expect(URGENT_ADVICE).toContain(word);
        s.watcher.stability = 90; mindWarning(s.watcher, true);
        s.watcher.stability = 10; mindWarning(s.watcher, true);
        expect(s.watcher.warned).toBe(2);
        expect(steadyHint(s.watcher)).toBe('');
    });
    test('a lost sequence costs, never below the warning, and never restarts the mind', () => {
        const lamps = [1, 2, 3, 4];
        for (const stability of [WARN_BELOW + 2, WARN_BELOW, 12, 1]) {
            const w = asleepWatcher({ stability });
            const p = openPuzzle(w, lamps, 2, { kind: 'lamps' });
            const r = pressLamp(w, lamps.find((x) => x !== p.answer[0]), 2);
            expect(r.rebooted).toBe(false);
            expect(w.stability).toBe(Math.max(Math.min(stability, WARN_BELOW), stability - 5));
            expect(w.reboots || 0).toBe(0);
        }
    });
    test('no lamp event while the mind warns', () => {
        const w = asleepWatcher({ stability: WARN_BELOW - 1, sleptYears: 1e9 });
        expect(puzzleDue(w, { asleep: true })).toBe(false);
        w.stability = 90;
        expect(puzzleDue(w, { asleep: true })).toBe(true);
    });
    test('each kind of lamp event says what to do the first time, and a save keeps what was taught', () => {
        const w = asleepWatcher();
        const p = openPuzzle(w, [1, 2, 3], 2, { kind: 'lamps' });
        expect(lampHint(w, p)).toBe('Repeat the lamps. Click the rooms in the order they lit.');
        taughtLamps(w, 'lamps');
        expect(lampHint(w, p)).toBe('');
        expect(lampHint(w, { kind: 'dark' })).toBe(LAMP_HINT.dark);
        expect(normalizeWatcher(JSON.parse(JSON.stringify(w))).taught).toEqual(['lamps']);
    });
    test('a restart says why on the wake; a restart comes back at REBOOT_TO', () => {
        expect(wakeWhy({ kind: 'reboot' }, true)).toBe(WAKE_WHY.reboot);
        expect(wakeWhy({ kind: 'first' })).toMatch(/first sleep/);
        expect(wakeWhy({ kind: 'food' })).toBe('');
        const w = asleepWatcher({ stability: 0.5 });
        expect(watchSleep(w, { days: 365 * 1000, tier: 2 }).rebooted).toBe(true);
        expect(w.stability).toBe(REBOOT_TO);
    });
});

/* ---- GROW ------------------------------------------------------------------------------------ */
const PATTERN = ['mine', 'dorm', 'farm', 'generator'];
function colony(n = 24) {
    const s = initialDeepState();
    const list = Array.from({ length: n }, (_, i) => PATTERN[i % 4]);
    const count = (t) => list.filter((x) => x === t).length;
    Object.assign(s, {
        day: 25000 * 365, minerals: 1e15, food: 1e12, stars: 1e17, humans: 3000,
        chambers: list.length, rooms: { mine: count('mine'), farm: count('farm'), generator: count('generator'), dorm: count('dorm'), cryo: 0 },
        level: { mine: 10, farm: 10, generator: 10, dorm: 8 }, auto: { mine: 4, farm: 4, generator: 4, dorm: 4 },
        cryo: 5, vats: 1, feed: 8,
        watcher: { ...initialWatcher(), bought: LADDER.filter((u) => u.rung < 2).map((u) => u.id) },
        tree: { opened: ['question'], bought: ['question'], unseen: false },
    });
    const layout = { slots: list };
    normalizeGrow(s, layout, tickDay(JSON.parse(JSON.stringify(s)), false));
    return { s, layout };
}

describe('GROW never names what cannot be done (B402)', () => {
    for (const style of ['balanced', 'naive']) {
        test(`a ${style} player: the tape's word is doable every second, and a TAKE or GROW points at a chamber`, () => {
            const { s, layout } = colony();
            let checked = 0;
            for (let t = 0; t < 420 && !risen(s); t++) {
                stepGrow(s, layout, 1);
                const word = adviseGrow(s, layout);
                expect(growDoable(s, layout, word)).toBe(true);
                if (word === GROW_ADVICE.take || word.startsWith('GROW A ')) expect(growTarget(s, layout, word)).toBeTruthy();
                checked++;
                if (s.grow.dreaming) continue;
                pump(s, layout, { beat: t % 5 !== 0 });
                for (const a of decideGrow(s, layout, style)) pressGrow(s, layout, a, 0, 0);
            }
            expect(checked).toBeGreaterThan(100);
        });
    }
    test('the vats eat the guts\' mass, never the lid\'s: the mass never stops for good', () => {
        const graph = graphFromSlots(['dorm', 'dorm', 'dorm', 'mine']);
        const st = { body: [HEART, 's0', 's1', 's2'], necrotic: [], organs: { s0: 'vat', s1: 'vat', s2: 'vat' } };
        expect(massRate(bodySums(graph, st))).toBeCloseTo(LID_MASS, 9);
    });
    test('a bigger colony spreads the step of a take over its chambers', () => {
        const small = graphFromSlots(Array.from({ length: TAKE_REF }, (_, i) => PATTERN[i % 4]));
        const big = graphFromSlots(Array.from({ length: TAKE_REF * 1.25 }, (_, i) => PATTERN[i % 4]));
        expect(takeMass(big, 's1', 'gut', 60)).toBeCloseTo(takeMass(small, 's1', 'gut', 48), -1);
        expect(takeMass(small, 's1', 'gut', 10)).toBe(takeMass(graphFromSlots(PATTERN.concat(PATTERN)), 's1', 'gut', 10));
    });
});

describe('the gauges ring the short one, as the tape names it (B401)', () => {
    test('the ring is on the gauge whose organ the tape asks for, and nowhere when nothing is short', () => {
        const { s, layout } = colony();
        for (let t = 0; t < 200; t++) {
            stepGrow(s, layout, 1);
            const g = growGauges(s, null, layout);
            const want = wantOrgan(s, layout);
            const ringed = Object.keys(g).filter((c) => g[c].weakest);
            if (!want) expect(ringed).toEqual([]);
            else expect(ringed).toEqual([Object.keys(GAUGE_ORGAN).find((c) => GAUGE_ORGAN[c] === want)]);
            pump(s, layout, { beat: true });
            for (const a of decideGrow(s, layout)) pressGrow(s, layout, a, 0, 0);
        }
    });
});

/* ---- TEND, SLEEP and the drawer ---------------------------------------------------------------- */
const start = (o = {}) => ({ ...initialDeepState({ salvage: 1500, doom0: 85 }), tree: initialTree(), watcher: initialWatcher(), ...o });
const dry = (s) => tickDay(JSON.parse(JSON.stringify(s)), !!s.asleep);

describe('TEND says what a room does to the stars (B403)', () => {
    test('a farm draws the machine\'s power; a generator gives it', () => {
        const s = start({ stars: 0, feed: 1, minerals: 5000 });
        s.rooms.generator = 2;
        const farm = roomStarsLine(s, 'farm');
        expect(farm.line).toMatch(/^★ \S+ → \S+ a second\.$/);
        expect(farm.why).toBe('It draws the machine\'s power.');
        const gen = roomStarsLine(s, 'generator');
        expect(gen.why).toBe('');
    });
    test('Cryo I costs ★ 7.5 k', () => expect(CRYO[0].cost).toBe(7.5e3));
});

/** Ola's save: Cryo V, a million years slept (econ.test.js). */
function olas() {
    const s = {
        ...initialDeepState(), day: 3e5 * 365, minerals: 4e9, food: 4e7, stars: 9.8e16, humans: 4000,
        chambers: 40, rooms: { mine: 10, farm: 9, generator: 10, dorm: 8, cryo: 1 },
        level: { mine: 9, farm: 8, generator: 9, dorm: 6 }, auto: { mine: 3, farm: 3, generator: 3, dorm: 2 },
        cryo: 4, vats: 3, feed: impliedFeed(4),
    };
    s.watcher = { ...initialWatcher(), sleeps: 30, surface: { ...initialSurface(), visits: 14, night: 5, toLine: 1, lastSleep: 30 } };
    s.tree = { opened: ['lossless', 'cold', 'longcount'], bought: ['lossless', 'cold'], unseen: false };
    return s;
}

describe('SLEEP orders in the night and wakes for a deeper sleep (B404)', () => {
    test('a level is ordered in the night after the hall, and builds while they sleep', () => {
        const s = olas();
        setIncome(s);
        s.asleep = true;
        expect(canBuy(s, 'seam', { asleep: true }).ok).toBe(true);
        expect(canBuy(s, 'cryo-vi', { asleep: true }).ok).toBe(false);
        const r = treeBuy(s, 'seam', { asleep: true });
        expect(r.job.night).toBe(true);
        // before the hall the night orders nothing
        const t = start({ stars: 1e9 }); t.rooms.mine = 1; t.asleep = true;
        expect(canBuy(t, 'seam', { asleep: true }).ok).toBe(false);
    });
    test('the asleep tape never asks for an awake thing', () => {
        const s = olas();
        setIncome(s);
        s.asleep = true;
        const road = cryoRoad(s.cryo + 1, s);
        for (const stars of [0, 1e10, 1e14, 1e16, 9.8e16, 1e18, 1e20]) {
            s.stars = stars;
            const word = adviseAsleep(s, { road });
            expect(word).not.toMatch(/^(BUILD|DIG|AUTOMATE|SLEEP|LONGER)/);
            // what it names to BUY can be bought asleep
            if (word.startsWith('BUY ')) {
                const id = calledRow(s, word);
                expect(id).toBeTruthy();
                if (id !== LEVELS_ROW) expect(canBuy(s, id, { asleep: true, road }).ok).toBe(true);
            }
        }
    });
    test('once only its price stands in the way, the deeper sleep is saved for, and the tape wakes for it', () => {
        const s = olas();
        setIncome(s);
        s.asleep = true;
        const road = { items: [{ key: 'auto-farm', done: true }, { key: 'stars', done: false }] };
        const due = tierDue(s, road);
        expect(due.id).toBe('cryo-vi');
        s.stars = due.price / 2;
        expect(adviseAsleep(s, { road })).toBe(`SAVE FOR ${due.name}`);
        s.stars = due.price * 10;
        expect(adviseAsleep(s, { road })).toBe('WAKE');
        s.asleep = false;
        expect(advise(s, dry(s), { road, lever: true })).toBe(ADVICE.longer);
    });
});

describe('the drawer lists and rings what the panel names (B406)', () => {
    test('every word naming an item has its row in the drawer, ringed', () => {
        const s = olas();
        setIncome(s);
        const road = cryoRoad(s.cryo + 1, s);
        for (const asleep of [false, true]) {
            s.asleep = asleep;
            for (const stars of [0, 1e14, 9.8e16, 1e20]) {
                s.stars = stars;
                const word = asleep ? adviseAsleep(s, { road }) : advise(s, dry(s), { road, lever: true });
                const id = calledRow(s, word);
                if (!id) continue;
                const rows = drawerGroups(s, { road, asleep, called: id }).flatMap((g) => g.rows);
                const row = rows.find((r) => r.id === id);
                expect(row).toBeTruthy();
                expect(row.called).toBe(true);
            }
        }
    });
    test('the names map to their rows', () => {
        const s = olas();
        expect(calledRow(s, 'SAVE FOR GENERATOR AUTO')).toBe('genauto');
        expect(calledRow(s, 'AUTOMATE MINES')).toBe('drill');
        expect(calledRow(s, 'BUY 3 LEVELS')).toBe(LEVELS_ROW);
        expect(calledRow(s, 'FEED THE MACHINE')).toBe('feed');
        expect(calledRow(s, 'LONGER SLEEP')).toBe('cryo-vi');
        expect(calledRow(s, 'SURFACE WAITS FOR CRYO VI')).toBe('cryo-vi');
        expect(calledRow(s, 'BUY SEAM')).toBe('seam');
        expect(calledRow(s, 'DIG')).toBe(null);
        expect(NODE_BY_ID[calledRow(s, 'SAVE FOR CRYO I')].kind).toBe('cryo');
    });
});
