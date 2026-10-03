/* eslint-env jest */
/*
 * deep-econ: Ola's playtest of v1.78.0. Prices follow income, a sleep's yield is capped, nights come on
 * sleeps, the tape always names the next goal, rates are per real second, the drawer says the gap, and
 * a graft shows what it did.
 */
import {
    initialDeepState, tickDay, sleep, CRYO, PRICE_BAND, SLEEP_CAP_SECONDS, setIncome, incomeOf, banded,
    cryoPrice, nextPrice, beginSleepYield, endSleepYield, sleepFull, levelCost, roundPrice, impliedFeed,
} from './deep.js';
import { rateText, FULL_TEXT } from './readout.js';
import { priceOf, canBuy, giftPrice } from './tree.js';
import { goalOf, adviceNote, adviseAsleep, drawerNeed, drawerGroups, gapLine, ADVICE } from './instruments.js';
import { initialWatcher } from './watcher.js';
import { initialSurface, NIGHTS, nightDue } from './surface.js';
import { initialLayout } from './layout.js';
import { graftEffect, placeGraft } from './graft.js';

/** Ola's save: Cryo V, a million years slept, ★ 9.8e16, night 5 said, Cryo VI out of reach. */
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

describe('prices follow income (B330)', () => {
    test('before the hall nothing changes: no income, the old prices', () => {
        const s = initialDeepState();
        expect(setIncome(s)).toBeNull();
        expect(nextPrice(s, 'level', 'mine')).toBe(levelCost('mine', 0));
        expect(cryoPrice(s, 0)).toBe(CRYO[0].cost);
    });
    test('from the hall on, every upgrade costs between its band of seconds of income', () => {
        const s = olas();
        const inc = setIncome(s).stars;
        expect(inc).toBeGreaterThan(0);
        expect(incomeOf(s).tier).toBe(4);
        for (const id of ['seam', 'yield', 'output', 'beds', 'drill', 'feed', 'cryo-vi']) {
            const p = priceOf(s, id);
            if (!p) continue;
            const secs = p.stars / inc;
            expect(secs).toBeGreaterThanOrEqual(30 * 0.999);
            expect(secs).toBeLessThanOrEqual(100 * 1.1);
        }
        // a price never more than the high end, never less than the low end, two figures
        expect(banded(s, 'cryo', 1e40)).toBe(roundPrice(PRICE_BAND.cryo[1] * inc));
        expect(banded(s, 'level', 1)).toBe(roundPrice(PRICE_BAND.level[0] * inc));
        expect(String(roundPrice(123456789))).toBe('130000000');
    });
    test("Ola's save lands where it can buy again: Cryo VI is within reach, never ★ 3e17 against ★ 9.8e16", () => {
        const s = olas();
        setIncome(s);
        expect(cryoPrice(s, 5)).toBeLessThan(CRYO[5].cost);
        expect(cryoPrice(s, 5)).toBeLessThanOrEqual(PRICE_BAND.cryo[1] * incomeOf(s).stars * 1.1);
        // and the gifts follow too
        expect(giftPrice(s, 'question')).toBeLessThanOrEqual(PRICE_BAND.gift[1] * incomeOf(s).stars * 1.1);
    });
    test('a long sleep brings at most SLEEP_CAP_SECONDS of income, and then the store is full', () => {
        const s = olas();
        s.asleep = true;
        setIncome(s);
        beginSleepYield(s);
        const before = s.stars;
        const sum = sleep(s, CRYO[4].days * 2000, { alarms: false });
        const cap = SLEEP_CAP_SECONDS * incomeOf(s).stars;
        expect(s.stars - before).toBeLessThanOrEqual(cap * 1.0001);
        expect(sum.stars).toBeLessThanOrEqual(cap * 1.0001);
        expect(sleepFull(s)).toBe(true);
        expect(adviseAsleep(s)).toBe(ADVICE.wake);
        expect(adviceNote(s, ADVICE.wake)).toBe('The store is full.');
        endSleepYield(s);
        expect(sleepFull(s)).toBe(false);
    });
});

describe('nights follow sleeps (B330)', () => {
    test('nights 1 to 3 wait for no tier; 4, 5 and 6 wait for Cryo III, IV and V', () => {
        expect(NIGHTS.map((x) => x.tier)).toEqual([0, 0, 0, 2, 3, 4]);
        expect(nightDue({ night: 2, toLine: 0 }, 0)).toBe(true);
        expect(nightDue({ night: 3, toLine: 0 }, 1)).toBe(false);
    });
    test('a night that waits for a tier is said on the tape', () => {
        const s = olas();
        s.cryo = 2;
        s.watcher.surface.night = 4;
        s.watcher.surface.toLine = 0;
        setIncome(s);
        s.asleep = true;
        s.feed = 8;
        s.stars = 0;
        beginSleepYield(s);
        expect(adviseAsleep(s)).toBe('SURFACE WAITS FOR CRYO IV');
    });
});

describe('the tape always names the next goal (B332)', () => {
    test('asleep with nothing to buy: SAVE FOR it, with what is still to go', () => {
        const s = olas();
        setIncome(s);
        s.asleep = true;
        s.stars = 0;
        s.feed = 8;
        beginSleepYield(s);
        const word = adviseAsleep(s);
        expect(word.startsWith('SAVE FOR ')).toBe(true);
        const goal = goalOf(s);
        expect(word).toBe(`SAVE FOR ${goal.name}`);
        expect(adviceNote(s, word)).toMatch(/^★ \S+( \w)? to go$/);
        // the stars come in: the tape says WAKE, and why
        s.stars = goal.price;
        expect(adviseAsleep(s)).toBe('WAKE');
        expect(adviceNote(s, 'WAKE')).toMatch(/can be bought\.$/);
    });
    test('an opened gift is the goal before the levels; The question before everything', () => {
        const s = olas();
        setIncome(s);
        s.tree.opened.push('quiet');
        expect(goalOf(s).id).toBe('quiet');
        s.tree.opened.push('question');
        expect(goalOf(s)).toMatchObject({ id: 'question', name: 'THE QUESTION' });
    });
});

describe('the drawer says the gap (B334)', () => {
    test('a locked cryo row: the ticks, then "You need ★ X more." on its own line', () => {
        const s = olas();
        s.income = null;                  // the old prices: Cryo VI at ★ 3e17 against ★ 9.8e16
        const road = { items: [
            { key: 'auto-generator', text: 'generators automated', done: true },
            { key: 'auto-farm', text: 'farms automated', done: true },
            { key: 'auto-mine', text: 'mines automated', done: true },
            { key: 'stars', text: '★ 300e15', done: false },
        ] };
        const need = drawerNeed(s, 'cryo-vi', { road, need: { kind: 'stars' }, asleep: false });
        expect(need).toBe('Needs generators automated ✓, farms automated ✓ and mines automated ✓.\nYou need ★ 2e17 more.');
    });
    test('every locked row with a price in stars says the gap', () => {
        const s = olas();
        setIncome(s);
        s.stars = 1;
        const rows = drawerGroups(s, { asleep: false, need: { kind: 'stars' } }).flatMap((g) => g.rows).filter((r) => r.status === 'next');
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            if (canBuy(s, r.id, { asleep: false, need: { kind: 'stars' } }).kind !== 'afford') continue;
            expect(r.need).toContain(gapLine(s, r.id));
            expect(r.need).toMatch(/You need ★ .+ more\./);
        }
    });
});

describe('rates per real second (B331)', () => {
    test('plain, short, signed', () => {
        expect(rateText(3.5e12)).toBe('+3.5 T a second');
        expect(rateText(-0.42)).toBe('-0.4 a second');
        expect(rateText(0.01)).toBe('');
        expect(rateText(1234)).toBe('+1.2 k a second');
        expect(FULL_TEXT).toBe('store full');
    });
});

describe('a graft shows what it did (B336)', () => {
    test('the room before and after, in a second', () => {
        const s = olas();
        const layout = initialLayout(s);
        s.graft = { owed: 1, slots: [] };
        const i = layout.slots.indexOf('mine');
        const id = `s${i}`;
        const before = graftEffect(s, layout, tickDay(JSON.parse(JSON.stringify(s)), false), id);
        expect(before).toMatch(/^Ore \S+( \w)? → \S+( \w)? a second\.$/);
        expect(placeGraft(s, layout, id)).toBeTruthy();
        const di = layout.slots.indexOf('dorm');
        expect(graftEffect(s, layout, tickDay(JSON.parse(JSON.stringify(s)), false), `s${di}`)).toMatch(/^Beds .+\.$/);
    });
});
