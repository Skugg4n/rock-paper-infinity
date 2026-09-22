/* eslint-env jest */
/*
 * v1.48.0, after the overnight playtest of v1.47.0 (docs/playtests/2026-09-23-chapter-iv-overnight.md):
 * Cryo I reachable by following the game, one reason for a locked cryo tier, the dot marks what runs
 * low, weight to people (mourning), rewards only where they show.
 */
import {
    initialDeepState, tickDay, sleepTrouble, ordersDone, completeBuilds, startBuild, repairTick,
    resolveDueProbes, CRYO, MOURN_DAYS, mourning, automationCost, levelCost, roomCost, digCost,
    DAYS_PER_YEAR,
} from './deep.js';
import { cryoNeed, offerFor, lowPoint, stocks, rewardShows, short, cloneState } from './readout.js';
import { screen, decide } from './policy.js';

/** The colony the chapter starts with (checkpoint iv-start). */
const start = () => initialDeepState({ salvage: 1500, doom0: 85 });
const needOf = (s, tier = s.cryo + 1) => cryoNeed(tier, {
    state: s,
    trouble: sleepTrouble(s, CRYO[tier].days),
    planned: sleepTrouble(ordersDone(s), CRYO[tier].days),
    starsPerDay: tickDay(cloneState(s)).stars,
});

describe('one reason for a locked cryo tier, the same in the caption and the tooltip', () => {
    test('at the descent Cryo I needs the generators automated, and says so twice in the same words', () => {
        const s = start();
        const need = needOf(s, 0);
        expect(need.short).toBe('needs generators automated');
        expect(need.long.startsWith(`Cryo I ${need.short}`)).toBe(true);
        expect(need).toMatchObject({ button: 'auto', type: 'generator' });
    });

    test('an automation already ordered is not asked for again: the next room type is', () => {
        const s = start();
        s.stars = 1e6;
        startBuild(s, 'auto', { type: 'generator' });
        const need = needOf(s, 0);
        expect(need.short).toBe('needs farms automated');
        expect(need.type).toBe('farm');
    });

    test('with everything ordered it waits for the orders, then only for its price', () => {
        const s = start();
        for (const t of ['generator', 'farm', 'mine']) startBuild(s, 'auto', { type: t });
        expect(needOf(s, 0).kind).toBe('wait');
        expect(needOf(s, 0).short).toMatch(/^ready in \d+ d$/);
        for (const j of s.builds) j.doneDay = s.day;
        completeBuilds(s);
        s.stars = 0;
        expect(needOf(s, 0)).toMatchObject({ kind: 'stars', short: `needs ${short(CRYO[0].cost)} stars` });
        s.stars = CRYO[0].cost;
        expect(needOf(s, 0)).toBeNull();                 // no free chamber needed: the hall digs its own
    });
});

describe('the automate and level buttons sell what the next goal needs, and say why', () => {
    test('when cryo needs generators automated, the automate button offers generators', () => {
        const s = start();
        const r = tickDay(cloneState(s));
        const o = offerFor('auto', s, r, needOf(s, 0));
        expect(o).toMatchObject({ type: 'generator', goal: true });
        expect(o.head).toBe('Automate generators (so the colony can sleep).');
    });

    test('a food need offers the farms on the level button; without a goal, the weakest column', () => {
        const s = start();
        const r = tickDay(cloneState(s));
        const food = { kind: 'food', button: 'level', type: 'farm' };
        expect(offerFor('level', s, r, food)).toMatchObject({ type: 'farm', goal: true });
        const plain = offerFor('level', s, r, null);
        expect(plain.goal).toBe(false);
        expect(plain.head).toMatch(/limits? the stars\)\.$/);
    });
});

describe('the dot marks what runs low, never a full bar', () => {
    const report = (over) => {
        const s = start();
        const r = tickDay(cloneState(s));
        return { s, r: { ...r, ...over, parts: { ...r.parts, ...(over.parts || {}) } } };
    };

    test('a full larder of 96 M days never carries the dot, even with the smallest surplus', () => {
        const { s, r } = report({ parts: { M: 50, F: 1, E: 40, H: 60 } });
        s.food = 96e6 * s.humans;
        const low = lowPoint(s, r, stocks(s, r, 10));
        expect(low.column).not.toBe('F');
        expect(low.falling).toBe(false);
        expect(low.line).toMatch(/^Nothing is falling\. .+ slowest\.$/);
    });

    test('a falling store wins: the fewest days of cover, said in days', () => {
        const { s, r } = report({ parts: { M: 5, F: -10, E: 40, H: 60 } });
        s.food = 210;
        const low = lowPoint(s, r, stocks(s, r));
        expect(low).toMatchObject({ column: 'F', falling: true });
        expect(low.line).toBe('Food runs out in 21 days.');
        s.minerals = 30;
        const ore = lowPoint(s, { ...r, parts: { ...r.parts, M: -10 } }, stocks(s, r));
        expect(ore.column).toBe('M');
        expect(ore.line).toBe('Ore runs out in 3 days.');
    });

    test('a falling store with a full bar is not running low', () => {
        const { s, r } = report({ parts: { M: -2, F: 5, E: 5, H: 5 } });
        const st = { M: { frac: 1 }, F: { frac: 0.5 }, E: { frac: 0.5 }, H: { frac: 0.5 } };
        const low = lowPoint(s, r, st);
        expect(low.column).not.toBe('M');
        expect(low.falling).toBe(false);
        expect(lowPoint(s, r, { ...st, M: { frac: 0.996 } }).column).not.toBe('M');   // drawn full
    });

    test('every bar full: no dot at all', () => {
        const { s, r } = report({ parts: { M: 5, F: 5, E: 5, H: 5 } });
        const full = { M: { frac: 1 }, F: { frac: 1 }, E: { frac: 1 }, H: { frac: 1 } };
        expect(lowPoint(s, r, full)).toMatchObject({ column: null, line: 'Nothing is falling. Every store is full.' });
    });
});

describe('people and rewards have weight', () => {
    test('a lost party is mourned: nobody is born for a colony year, then the creches run again', () => {
        const t = start();
        t.food = 1e6;
        t.probes = [{ sentDay: 0, dueDay: 0, people: 4 }];
        // on day 0 the odds are 40 % a reading, 40 % lost: a roll of 0.5 is a party lost
        const [l] = resolveDueProbes(t, [], () => 0.5);
        expect(l.outcome).toBe('lost');
        expect(mourning(t)).toBe(true);
        expect(t.mournUntil).toBe(t.day + MOURN_DAYS);
        const h = t.humans;
        for (let d = 0; d < MOURN_DAYS - 1; d++) expect(tickDay(t).born).toBe(0);
        expect(t.humans).toBeLessThanOrEqual(h);
        tickDay(t);
        let born = 0;
        for (let d = 0; d < 30; d++) born += tickDay(t).born;
        expect(born).toBeGreaterThan(0);
    });

    test('a reward is only a number on screen when the counter moves', () => {
        expect(rewardShows(600e12, 46e9)).toBe(false);      // "600 T" before and after
        expect(rewardShows(600e12, 734e9)).toBe(true);      // "601 T"
        expect(rewardShows(1200, 30)).toBe(false);          // "1.2 k" either way
        expect(rewardShows(1200, 100)).toBe(true);
        expect(rewardShows(5, 0)).toBe(false);
    });
});

describe('a player who follows the dot and the captions gets to sleep (the overnight playtest could not)', () => {
    /** The phase's own purchases, done the way its buttons do them. */
    function press(s, a) {
        if (a.kind === 'cryo') { s.stars -= CRYO[0].cost; s.cryo = 0; s.chambers += 1; s.rooms.cryo = 1; return; }
        if (a.kind === 'auto') { s.stars -= automationCost(a.type, s.auto[a.type]); startBuild(s, 'auto', { type: a.type }); }
        if (a.kind === 'level') { s.stars -= levelCost(a.type, s.level[a.type]); startBuild(s, 'level', { type: a.type }); }
        if (a.kind === 'room') { s.minerals -= roomCost(a.type, s.rooms[a.type]); startBuild(s, 'room', { type: a.type }); }
        if (a.kind === 'dig') { s.minerals -= digCost(s.chambers); startBuild(s, 'dig'); }
    }

    test('Cryo I is bought inside eight real minutes from the descent', () => {
        const s = start();
        let at = null;
        for (let sec = 1; sec <= 8 * 60 && at === null; sec++) {
            completeBuilds(s);
            const r = tickDay(s, false);
            repairTick(s, [], r.hands);
            const view = screen(s);
            for (const a of decide(s, view)) {
                press(s, a);
                if (a.kind === 'cryo') { at = sec; break; }
            }
            // every locked cryo caption the player read was the tooltip's own reason
            if (view.need) expect(view.need.long.includes(view.need.short)).toBe(true);
        }
        expect(at).not.toBeNull();
        expect(at).toBeLessThan(8 * 60);
        expect(s.day / DAYS_PER_YEAR).toBeLessThan(2);
    });
});
