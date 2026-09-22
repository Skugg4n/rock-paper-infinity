/* eslint-env jest */
import {
    initialDeepState, tickDay, sleep, startBuild, completeBuilds, buildProgress, buildPending,
    BUILD_DAYS, digCost, CRYO,
} from './deep.js';
import { conditions, advisorLines, pushFeed, foodDaysLeft, FEED_MAX, FOOD_WARN_DAYS } from './advisor.js';
import { ledger, buySentence, preview, deltaText, list, cloneState } from './readout.js';

const colony = () => {
    const s = initialDeepState();
    s.rooms = { mine: 3, farm: 2, generator: 2, dorm: 1, cryo: 0 };
    s.humans = 14;
    return s;
};

describe('nothing is instant: a purchase is an order', () => {
    test('an order lands on its day, and not a day before', () => {
        const s = colony();
        const rooms0 = s.rooms.mine;
        startBuild(s, 'room', { type: 'mine', slot: 4 });
        expect(buildPending(s, 'room', 'mine')).toBe(true);
        expect(buildPending(s, 'room', 'farm')).toBe(false);
        expect(buildProgress(s, s.builds[0])).toBe(0);
        for (let i = 0; i < BUILD_DAYS.room - 1; i++) { s.day += 1; expect(completeBuilds(s)).toHaveLength(0); }
        expect(buildProgress(s, s.builds[0])).toBeCloseTo((BUILD_DAYS.room - 1) / BUILD_DAYS.room, 6);
        expect(s.rooms.mine).toBe(rooms0);              // still nothing
        s.day += 1;
        const done = completeBuilds(s);
        expect(done).toHaveLength(1);
        expect(done[0].slot).toBe(4);
        expect(s.rooms.mine).toBe(rooms0 + 1);          // and now it is there
        expect(s.builds).toHaveLength(0);
        expect(completeBuilds(s)).toHaveLength(0);      // it does not land twice
    });

    test('every kind of order has a length, and each lands in its own time', () => {
        const s = colony();
        for (const kind of ['dig', 'room', 'level', 'auto']) expect(BUILD_DAYS[kind]).toBeGreaterThan(0);
        startBuild(s, 'dig');
        startBuild(s, 'level', { type: 'mine' });
        startBuild(s, 'auto', { type: 'farm' });
        const chambers0 = s.chambers;
        s.day += BUILD_DAYS.room;                        // shorter than any of the three
        expect(completeBuilds(s)).toHaveLength(0);
        s.day = BUILD_DAYS.level;
        expect(completeBuilds(s).map((j) => j.kind)).toEqual(['level']);
        expect(s.level.mine).toBe(1);
        s.day = BUILD_DAYS.dig;
        expect(completeBuilds(s).map((j) => j.kind)).toEqual(['dig']);
        expect(s.chambers).toBe(chambers0 + 1);
        s.day = BUILD_DAYS.auto;
        expect(completeBuilds(s).map((j) => j.kind)).toEqual(['auto']);
        expect(s.auto.farm).toBe(1);
    });

    test('a sleep finishes what was still being built, and cannot skip over it', () => {
        const s = colony();
        s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 };
        startBuild(s, 'auto', { type: 'dorm' });
        const sum = sleep(s, CRYO[1].days);
        expect(s.builds).toHaveLength(0);
        expect(s.auto.dorm).toBe(1);
        expect(sum.built.map((j) => j.kind)).toEqual(['auto']);
        expect(sum.days).toBe(CRYO[1].days);             // still exactly the tier's length
    });

    test('a dry run on a clone shows today, never the day the order lands', () => {
        const s = colony();
        startBuild(s, 'level', { type: 'mine' });
        const before = tickDay(cloneState(s));
        s.day += BUILD_DAYS.level;
        // tickDay alone must not finish anything: only completeBuilds does
        const stillPending = tickDay(cloneState(s));
        expect(stillPending.minerals).toBeCloseTo(before.minerals, 6);
        expect(s.builds).toHaveLength(1);
    });
});

describe('the advisor speaks when something changes, not on a timer', () => {
    test('the same day twice says nothing the second time', () => {
        const s = colony();
        const r = tickDay(cloneState(s));
        const c1 = conditions(s, r);
        const first = advisorLines(null, c1);
        expect(first.length).toBeGreaterThan(0);          // the first day always says where we stand
        expect(advisorLines(c1, c1)).toEqual([]);         // and then holds its tongue
    });

    test('a moved bottleneck is named from and to', () => {
        const a = { bottleneck: 'M', foodWarn: -1, hungry: false, shortRoom: null, shortHands: 0, powerShort: -1 };
        const b = { ...a, bottleneck: 'F' };
        expect(advisorLines(a, b)).toEqual(['The bottleneck moved from minerals to food.']);
    });

    test('food, hunger and power each have their own line', () => {
        const base = { bottleneck: 'M', foodWarn: -1, hungry: false, shortRoom: null, shortHands: 0, powerShort: -1 };
        expect(advisorLines(base, { ...base, foodWarn: 20 })).toEqual(['We are running low on food: 20 days left.']);
        expect(advisorLines(base, { ...base, hungry: true })).toEqual(['People are hungry; the colony is shrinking.']);
        expect(advisorLines(base, { ...base, powerShort: 60 })).toEqual(['Energy is short: rooms run at 60 %.']);
        const hands = advisorLines(base, { ...base, shortRoom: 'generator', shortHands: 2 });
        expect(hands[0]).toMatch(/^The generator needs 2 more hands; the \w+ is idle\.$/);
        // hunger outranks the countdown: one line about food, not two
        expect(advisorLines(base, { ...base, hungry: true, foodWarn: 0 })).toHaveLength(1);
    });

    test('days of food left is a real number while the larder is draining', () => {
        const s = colony();
        const full = { parts: { F: 5 } };
        expect(foodDaysLeft(s, full)).toBe(Infinity);
        s.food = 100;
        expect(foodDaysLeft(s, { parts: { F: -10 } })).toBe(10);
        expect(FOOD_WARN_DAYS).toBeGreaterThan(0);
    });

    test('the feed keeps the last five lines, newest last', () => {
        let feed = [];
        for (let i = 1; i <= 8; i++) feed = pushFeed(feed, [`line ${i}`]);
        expect(feed).toHaveLength(FEED_MAX);
        expect(feed[FEED_MAX - 1]).toBe('line 8');
        expect(feed[0]).toBe('line 4');
        expect(pushFeed(feed, [])).toBe(feed);            // nothing to say, nothing changes
    });
});

describe('the bars explain themselves, and a purchase says what it will do', () => {
    test('every column writes one sentence: the store, then what comes in and goes out (B062)', () => {
        const s = colony();
        const r = tickDay(cloneState(s));
        const lines = { M: ledger('M', s, r), F: ledger('F', s, r), E: ledger('E', s, r), H: ledger('H', s, r) };
        expect(lines.M).toMatch(/^Ore: [\d.]+( k)? in store\. \+\d+ mined, -\d+ burned a day\.$/);
        expect(lines.F).toMatch(/^Food: \d+ days left\. \+\d+ grown, -\d+ eaten a day\.$/);
        expect(lines.E).toMatch(/^Energy: \d+ spare\. \+\d+ made, -\d+ used a day\.$/);
        expect(lines.H).toContain('free of');
        expect(lines.H).toContain('on duty in the');
        expect(lines.H).toContain('Beds for');
        // the food line is exactly the playtest's example, from the numbers themselves
        const f = { ...s, food: 45 * s.humans };
        expect(ledger('F', f, { ...r, food: 84, eaten: 39, born: 0 })).toBe('Food: 45 days left. +84 grown, -39 eaten a day.');
        // a colony that runs itself has nobody on a shift, and must still read as English
        const idle = { ...s, auto: { mine: 1, farm: 1, generator: 1, dorm: 1 } };
        const ir = tickDay(cloneState(idle));
        expect(ledger('H', idle, ir)).toContain('Nobody on duty');
        expect(ledger('H', idle, ir)).not.toContain('in the nothing');
        // asleep the people are in the ice, and nobody eats
        const sl = { ...idle, asleep: true };
        expect(ledger('H', sl, tickDay(cloneState(sl), true))).toContain('asleep in the ice');
        expect(ledger('F', sl, tickDay(cloneState(sl), true))).toContain('eaten a day in the ice');
        for (const k of Object.keys(lines)) {
            expect(lines[k].endsWith('.')).toBe(true);
            expect(lines[k]).not.toMatch(/NaN|undefined/);
        }
        expect(list(['a'])).toBe('a');
        expect(list(['a', 'b'])).toBe('a and b');
        expect(list(['a', 'b', 'c'])).toBe('a, b and c');
    });

    test('the preview is the rules run forward, not a guess', () => {
        const s = colony();
        const r = tickDay(cloneState(s));
        const p = preview(s, 'room', 'generator', r);
        // what the preview promises is exactly what buying it actually gives
        const real = cloneState(s);
        real.rooms.generator += 1;
        const got = tickDay(real);
        for (const k of ['M', 'F', 'E', 'H']) {
            expect(p.parts[k]).toBeCloseTo(got.parts[k], 9);
            expect(p.delta[k]).toBeCloseTo(got.parts[k] - r.parts[k], 9);
        }
        expect(preview(s, 'dig', null, r)).toBeNull();    // a bare chamber moves no column
        // and the state it was tried on is untouched
        expect(s.rooms.generator).toBe(2);
        expect(s.day).toBe(0);
    });

    test('a generator warns about the hands it will take', () => {
        const s = colony();
        const sentence = buySentence('room', 'generator', s);
        expect(sentence).toContain('hands');
        expect(sentence).toContain('makes');
        expect(buySentence('dig', null, s)).toContain('chamber');
        expect(buySentence('auto', 'mine', s)).toContain('without people');
        s.auto.mine = 1;
        expect(buySentence('auto', 'mine', s)).toContain('Triples');
        expect(buySentence('level', 'farm', s)).toContain('Doubles');
        expect(digCost(s.chambers)).toBeGreaterThan(0);
    });

    test('the number over a bar is signed, and silent when it would be noise', () => {
        expect(deltaText(6.2, 'M')).toBe('+6');
        expect(deltaText(-2, 'H')).toBe('-2 hands');
        expect(deltaText(0.1, 'M')).toBe('');
        expect(deltaText(NaN, 'M')).toBe('');
    });
});
