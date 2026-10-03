/* eslint-env jest */
/*
 * deep-rebuild: movements I (TEND) and II (SLEEP) of docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md.
 * The instruments read the rules; the dive speeds the sleep up; Surface comes only to a low mind;
 * every room ordered has its chamber; an old save opens in the new panel with its economy intact.
 */
import { initialDeepState, tickDay, impliedFeed, CRYO, orderBuild, DAYS_PER_YEAR } from './deep.js';
import { cryoRoad } from './readout.js';
import { canBuy, NODE_BY_ID } from './tree.js';
import {
    gauges, advise, ADVICE, cryoLamps, wakeWord, WAKE_WORDS, hallucinationsAt, drawerGroups, drawerCount,
    healing, surfaceTape, RED_K, GREEN_FROM, fallK, RED_DAYS, drawerDoes,
} from './instruments.js';
import { sleepPace, sleepDaysAt, RAMP, surfaceDue, SURFACE_BELOW, initialWatcher } from './watcher.js';
import { VISIT_AFTER_SECONDS } from './surface.js';
import { initialLayout, claimChambers, emptyChambers } from './layout.js';
import { serializeDeep, deserializeDeep } from './persistence.js';
import { springStep } from './panel.js';

const start = (o = {}) => ({ ...initialDeepState({ salvage: 1500, doom0: 85 }), watcher: initialWatcher(), ...o });
const dry = (s) => tickDay(JSON.parse(JSON.stringify(s)), !!s.asleep);
/** iv-cryo: every room automated, stars for Cryo I, the hall not yet bought. */
function leverReady() {
    const s = start();
    Object.assign(s, {
        day: 400, minerals: 26000, food: 9000, stars: 9.0e4, humans: 16,
        chambers: 9, rooms: { mine: 3, farm: 2, generator: 2, dorm: 1, cryo: 0 },
        level: { mine: 1, farm: 1, generator: 1, dorm: 0 }, auto: { mine: 1, farm: 1, generator: 1, dorm: 0 },
        cryo: -1, feed: impliedFeed(0),
    });
    return s;
}

describe('the gauges', () => {
    test('a store that does not fall rests in the green; one that falls points at its days of cover', () => {
        const s = start();
        const g = gauges(s, dry(s));
        for (const c of ['M', 'F', 'E', 'H']) expect(g[c].k).toBeGreaterThanOrEqual(GREEN_FROM);
        // no farms: the larder falls
        const t = start({ food: 300, rooms: { mine: 1, farm: 0, generator: 1, dorm: 1, cryo: 0 } });
        const f = gauges(t, dry(t)).F;
        expect(f.falling).toBe(true);
        expect(f.k).toBeLessThan(GREEN_FROM);
        expect(f.red).toBe(f.days < RED_DAYS);
    });
    test('the red arc is the first RED_DAYS of cover', () => {
        expect(fallK(0)).toBe(0);
        expect(fallK(RED_DAYS)).toBeCloseTo(RED_K, 9);
        expect(fallK(1e9)).toBeLessThan(GREEN_FROM);
    });
    test('the needle rides a damped spring to its target', () => {
        let x = 0, v = 0;
        let over = false;
        for (let i = 0; i < 200; i++) { ({ x, v } = springStep(x, v, 0.5, 1 / 60)); if (x > 0.5) over = true; }
        expect(over).toBe(true);
        expect(x).toBeCloseTo(0.5, 3);
    });
});

describe('the one stamped word', () => {
    test('at the descent, with ore for a chamber: DIG', () => {
        const s = start();
        expect(advise(s, dry(s), { road: cryoRoad(0, s), lever: false })).toBe(ADVICE.dig);
    });
    test('an empty chamber and ore for the weakest room: BUILD it', () => {
        const s = start({ chambers: 5 });
        const r = dry(s);
        expect(advise(s, r, { road: cryoRoad(0, s), lever: false })).toMatch(/^BUILD [A-Z]+$/);
    });
    test('the road to the hall, in order: AUTOMATE the rooms a crew runs', () => {
        // ore to burn, but not enough for a chamber
        const s = start({ minerals: 300, stars: 0 });
        expect(advise(s, dry(s), { road: cryoRoad(0, s), lever: false })).toBe('AUTOMATE GENERATORS');
    });
    test('the lamps lit and Cryo I paid for: SLEEP', () => {
        const s = leverReady();
        expect(canBuy(s, 'cryo-i', {}).ok).toBe(true);
        expect(advise(s, dry(s), { road: cryoRoad(0, s), lever: true })).toBe('SLEEP');
    });
    test('every word is one of the instruments\' own, in capitals', () => {
        const s = start();
        const w = advise(s, dry(s), { road: cryoRoad(0, s) });
        expect(w).toMatch(/^[A-Z ]+$/);
    });
});

describe('the three lamps are Cryo I\'s own road', () => {
    test('at the descent all three are dark; with every room automated all three are lit', () => {
        expect(cryoLamps(cryoRoad(0, start())).map((l) => l.lit)).toEqual([false, false, false]);
        const lit = cryoLamps(cryoRoad(0, leverReady()));
        expect(lit.map((l) => l.key)).toEqual(['food', 'power', 'ore']);
        expect(lit.every((l) => l.lit)).toBe(true);
    });
    test('an automation on order is not done: its lamp blinks', () => {
        const s = leverReady();
        s.auto.farm = 0;
        s.stars = 1e6;
        orderBuild(s, 'auto', { type: 'farm' });
        const food = cryoLamps(cryoRoad(0, s)).find((l) => l.key === 'food');
        expect(food.lit).toBe(false);
        expect(food.ordered).toBe(true);
    });
    test('lit lamps and the hall that can be bought agree', () => {
        const s = leverReady();
        expect(cryoLamps(cryoRoad(0, s)).every((l) => l.lit)).toBe(canBuy(s, 'cryo-i', {}).ok);
    });
});

describe('the wake lamp says one word', () => {
    test.each([
        [{ kind: 'food', days: 3 }, 'FOOD'], [{ kind: 'energy', pct: 50 }, 'POWER'], [{ kind: 'stall', type: 'generator', why: 'fuel' }, 'POWER'],
        [{ kind: 'stall', type: 'mine', why: 'hands' }, 'FAULT'], [{ kind: 'reboot' }, 'FAULT'], [{ kind: 'reboot', voice: true }, 'VOICE'],
        [{ kind: 'manual' }, 'AWAKE'], [{ kind: 'act' }, 'AWAKE'], [{ kind: 'first' }, 'AWAKE'],
    ])('%j: %s', (alarm, word) => {
        expect(wakeWord(alarm)).toBe(word);
        expect(WAKE_WORDS).toContain(word);
    });
});

describe('the mind goes', () => {
    test('one kind more under each line', () => {
        expect(hallucinationsAt(90)).toEqual([]);
        expect(hallucinationsAt(65)).toEqual(['lamp']);
        expect(hallucinationsAt(50)).toEqual(['lamp', 'figure']);
        expect(hallucinationsAt(30)).toEqual(['lamp', 'figure', 'twitch']);
        expect(hallucinationsAt(10)).toEqual(['lamp', 'figure', 'twitch', 'breathe']);
    });
    test('Surface comes only to a mind under the line', () => {
        const w = { ...initialWatcher(), sleeps: 3 };
        const due = VISIT_AFTER_SECONDS * CRYO[1].days;
        w.stability = SURFACE_BELOW + 5;
        expect(surfaceDue(w, due, CRYO[1].days)).toBe(false);
        w.stability = SURFACE_BELOW - 5;
        expect(surfaceDue(w, due, CRYO[1].days)).toBe(true);
    });
    test('from night 4 SURFACE is written more and more on the Watcher\'s tape', () => {
        expect([1, 3, 4, 5, 6].map((n) => surfaceTape(n))).toEqual([0, 0, 2, 4, 7]);
    });
});

describe('the dive: time accelerates within a sleep', () => {
    test('slow at first, the full rate after the ramp, toward three times it the longer it runs', () => {
        expect(sleepPace(0)).toBeCloseTo(RAMP.from, 9);
        expect(sleepPace(RAMP.rampS)).toBeCloseTo(1, 9);
        expect(sleepPace(60)).toBeGreaterThan(2);
        expect(sleepPace(1e4)).toBeLessThanOrEqual(RAMP.top);
        for (let t = 0; t < 120; t += 0.5) expect(sleepPace(t + 0.5)).toBeGreaterThanOrEqual(sleepPace(t));
    });
    test('the days are the pace summed: none while paused, more for each later second', () => {
        const a = sleepDaysAt(0, 1, 365), b = sleepDaysAt(5, 1, 365), c = sleepDaysAt(30, 1, 365);
        expect(a).toBeLessThan(b);
        expect(b).toBeLessThan(c);
        expect(sleepDaysAt(10, 1, 365, true)).toBe(0);
        // split or whole, the same days
        expect(sleepDaysAt(2, 0.5, 30) + sleepDaysAt(2.5, 0.5, 30)).toBeCloseTo(sleepDaysAt(2, 1, 30), 6);
    });
});

describe('the drawer: only what can be bought now, and the next thing', () => {
    test('awake: no WATCHER, no body, no question; every bright row can be bought', () => {
        const s = leverReady();
        s.stars = 1e9;
        const groups = drawerGroups(s, {});
        expect(groups.map((g) => g.name)).not.toContain('WATCHER');
        const ids = groups.flatMap((g) => g.rows.map((r) => r.id));
        expect(ids.some((id) => ['brain', 'nervous', 'spinal', 'skin', 'question'].includes(id))).toBe(false);
        for (const r of groups.flatMap((g) => g.rows).filter((x) => x.status === 'buy')) {
            expect(canBuy(s, r.id, {}).ok).toBe(true);
            expect(r.price).toMatch(/★/);
            expect(r.does.split(' ').length).toBeLessThanOrEqual(6);
        }
        expect(drawerCount(groups)).toBeGreaterThan(0);
    });
    test('at most one dim row per branch, and it says what it needs', () => {
        const groups = drawerGroups(start({ stars: 0 }), {});
        for (const g of groups) {
            const next = g.rows.filter((r) => r.status === 'next');
            expect(next.length).toBeLessThanOrEqual(1);
            for (const r of next) expect(r.need.length).toBeGreaterThan(0);
        }
        expect(groups.find((g) => g.name === 'CRYO').rows[0]).toMatchObject({ id: 'cryo-i', status: 'next', need: 'Needs the three lamps lit.' });
    });
    test('asleep: only the night\'s things (no levels), the Watcher\'s steps once its branch is open', () => {
        const s = leverReady();
        s.cryo = 0;
        s.asleep = true;
        s.stars = 1e9;
        s.watcher.sleeps = 3;
        s.watcher.capacity = 100;
        const groups = drawerGroups(s, {});
        const rows = groups.flatMap((g) => g.rows);
        expect(rows.some((r) => ['level', 'auto', 'cryo'].includes(NODE_BY_ID[r.id].kind))).toBe(false);
        expect(rows.find((r) => r.id === 'watchdog')?.status).toBe('buy');
    });
    test('an order under way shows its ring in its row', () => {
        const s = start({ stars: 1e5 });
        orderBuild(s, 'level', { type: 'mine' });
        const row = drawerGroups(s, {}).flatMap((g) => g.rows).find((r) => r.id === 'seam');
        expect(row.progress).toBeGreaterThanOrEqual(0);
    });
    test('five words or so for every node', () => {
        const s = start();
        for (const id of ['seam', 'drill', 'yield', 'farmauto', 'output', 'genauto', 'feed', 'beds', 'creche', 'cryo-i', 'cryo-iv', 'watchdog', 'reactor']) {
            const d = drawerDoes(s, id);
            expect(d.length).toBeGreaterThan(0);
            expect(d.split(' ').length).toBeLessThanOrEqual(6);
        }
    });
});

describe('every room ordered has its chamber', () => {
    test('a room ordered takes the first empty chamber nobody claimed; it keeps the one it has', () => {
        const s = start({ chambers: 6, minerals: 1e6 });
        const layout = initialLayout(s);
        expect(emptyChambers(s, layout)).toEqual([4, 5]);
        const a = orderBuild(s, 'room', { type: 'farm' });
        a.slot = 5;
        const b = orderBuild(s, 'room', { type: 'mine' });
        claimChambers(s, layout);
        expect(a.slot).toBe(5);
        expect(b.slot).toBe(4);
        expect(emptyChambers(s, layout)).toEqual([]);
    });
    test('an order whose chamber was taken gets another, or waits for a dig', () => {
        const s = start({ chambers: 5 });
        const layout = initialLayout(s);
        const j = orderBuild(s, 'room', { type: 'farm' });
        j.slot = 2;                     // a chamber that has a room in it
        claimChambers(s, layout);
        expect(j.slot).toBe(4);
        const k = orderBuild(s, 'room', { type: 'mine' });
        claimChambers(s, layout);
        expect(k.slot).toBe(-1);
    });
});

describe('the counter in the night', () => {
    test('the ring is the true healing: empty at the descent, full at the line', () => {
        expect(healing({ doom0: 85, day: 0 })).toBe(0);
        expect(healing({ doom0: 85, day: 802701 * DAYS_PER_YEAR })).toBeCloseTo(1, 3);
        expect(healing({ doom0: 85, day: 100000 * DAYS_PER_YEAR })).toBeGreaterThan(0.1);
    });
});

describe('an old save opens in the new panel', () => {
    test('a schema 8 save asleep with Surface: the economy as it was, and the instruments read it', () => {
        const s = leverReady();
        s.cryo = 2; s.asleep = true;
        s.est = { bias: -4, spread: 20 }; s.estRevealed = true; s.probesSent = 1;
        s.probes = [{ sentDay: s.day, dueDay: s.day + 90, people: 4 }];
        const raw = serializeDeep(s, initialLayout(s));
        const back = deserializeDeep(raw);
        expect(back.state.minerals).toBe(s.minerals);
        expect(back.state.stars).toBe(s.stars);
        expect(back.state.probes.length).toBe(1);
        const r = dry(back.state);
        expect(() => gauges(back.state, r)).not.toThrow();
        expect(() => drawerGroups(back.state, {})).not.toThrow();
        claimChambers(back.state, back.layout);
        expect(back.state.minerals).toBe(s.minerals);
    });
});
