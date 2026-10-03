/* eslint-env jest */
import {
    initialDeepState, tickDay, sleep, FEED_MAX, FEED_SHARE0, feedShare, feedCost, gamesFor, starsFor,
    machineFed, WIN_ODDS, GAMES_EXP, impliedFeed,
} from './deep.js';
import { machineTempo, machineSays, lampLevel, MAX_THROWS, SLEEP_PACE, LAMP_PERIOD } from './machine.js';
import { nodeStatus, buy, buyMany, canBuy, levelOf, priceOf, doesOf, effectLine } from './tree.js';
import { deserializeDeep, serializeDeep, SCHEMA_VERSION } from './persistence.js';
import { decide, press, screen } from './policy.js';

const colony = () => {
    const s = initialDeepState();
    s.rooms = { mine: 3, farm: 3, generator: 3, dorm: 2, cryo: 0 };
    s.chambers = 11;
    return s;
};
const day = (s, asleep = false) => tickDay(JSON.parse(JSON.stringify(s)), asleep);

describe('the machine: the stars are its wins', () => {
    test('energy fed buys games on a concave curve; one game in three is a win, each win a star', () => {
        expect(GAMES_EXP).toBeLessThan(1);
        expect(gamesFor(0)).toBe(0);
        expect(gamesFor(-5)).toBe(0);
        // twice the energy is less than twice the games, and still more games
        expect(gamesFor(200)).toBeGreaterThan(gamesFor(100));
        expect(gamesFor(200)).toBeLessThan(2 * gamesFor(100));
        expect(starsFor(100)).toBeCloseTo(gamesFor(100) * WIN_ODDS, 9);
        expect(WIN_ODDS).toBeCloseTo(1 / 3, 12);
    });

    test('a day: the machine is fed its share of the spare energy, and nothing else makes stars', () => {
        const s = colony();
        const r = day(s);
        expect(r.parts.E).toBeGreaterThan(0);
        expect(r.fed).toBeCloseTo(r.parts.E * FEED_SHARE0, 9);
        expect(r.games).toBeCloseTo(gamesFor(r.fed), 9);
        expect(r.stars).toBeCloseTo(starsFor(r.fed), 9);
        // the weakest column is still read, and no longer the star rule
        const t = colony(); t.rooms.mine = 0;
        const rt = day(t);
        expect(rt.weakest).toBe('M');
        expect(rt.stars).toBeGreaterThan(0);
        // no spare energy, no games
        const d = colony(); d.rooms.generator = 0;
        expect(day(d).stars).toBe(0);
    });

    test('each level of feed raises the share the machine may draw, and so the stars a day', () => {
        expect(feedShare(0)).toBeCloseTo(FEED_SHARE0, 12);
        for (let k = 1; k <= FEED_MAX; k++) expect(feedShare(k)).toBeGreaterThan(feedShare(k - 1));
        expect(feedShare(FEED_MAX)).toBeGreaterThan(0.95);
        expect(feedShare(FEED_MAX)).toBeLessThanOrEqual(1);
        expect(feedShare(FEED_MAX + 5)).toBe(feedShare(FEED_MAX));
        const s = colony();
        let last = day(s).stars;
        for (let k = 1; k <= FEED_MAX; k++) {
            s.feed = k;
            const r = day(s);
            expect(r.stars).toBeGreaterThan(last);
            expect(r.fed).toBeCloseTo(machineFed(s, r.energySpare), 9);
            last = r.stars;
        }
        // feeding it changes nothing else: the columns stay as they were
        const a = day({ ...colony(), feed: 0 }), b = day({ ...colony(), feed: FEED_MAX });
        expect(b.parts).toEqual(a.parts);
        expect(b.energySpare).toBe(a.energySpare);
    });

    test('the price of feed climbs level by level, and there is none past the top', () => {
        for (let k = 1; k < FEED_MAX; k++) expect(feedCost(k)).toBeGreaterThan(feedCost(k - 1));
        expect(feedCost(FEED_MAX)).toBe(Infinity);
    });

    test('a sleep earns the machine\'s stars too, fast forwarded or lived day by day', () => {
        const make = () => { const s = colony(); s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 }; s.feed = 3; return s; };
        const bulk = make(), slow = make();
        const sum = sleep(bulk, 5000);
        let stars = 0;
        for (let i = 0; i < 5000; i++) stars += tickDay(slow, true).stars;
        expect(sum.stars).toBeGreaterThan(0);
        expect(sum.stars / stars).toBeCloseTo(1, 10);
        expect(bulk.stars / slow.stars).toBeCloseTo(1, 10);
    });
});

describe('the tree: "The machine: feed" has its rule', () => {
    test('it is bought one level a click, awake or asleep, with stars, at once', () => {
        const s = colony();
        s.stars = feedCost(0) - 1;
        expect(nodeStatus(s, 'feed').status).toBe('locked');
        expect(canBuy(s, 'feed').kind).toBe('afford');
        s.stars = feedCost(0);
        expect(nodeStatus(s, 'feed')).toMatchObject({ status: 'buyable', level: 0, max: FEED_MAX });
        expect(priceOf(s, 'feed')).toEqual({ currency: 'stars', stars: feedCost(0) });
        const before = day(s).stars;
        expect(buy(s, 'feed')).toMatchObject({ kind: 'feed', level: 1, price: feedCost(0) });
        expect(s.stars).toBe(0);
        expect(levelOf(s, 'feed')).toBe(1);
        expect(day(s).stars).toBeGreaterThan(before);
        // asleep too: the machine runs itself
        s.asleep = true;
        s.stars = feedCost(1);
        expect(canBuy(s, 'feed', { asleep: true }).ok).toBe(true);
        expect(buy(s, 'feed', { asleep: true })).toBeTruthy();
        expect(s.feed).toBe(2);
    });

    test('shift-click buys as many levels as can be paid, and it stops at the top', () => {
        const s = colony();
        s.stars = 1e30;
        const got = buyMany(s, 'feed');
        expect(got.length).toBe(FEED_MAX);
        expect(s.feed).toBe(FEED_MAX);
        expect(nodeStatus(s, 'feed')).toMatchObject({ status: 'bought', price: null });
        expect(buy(s, 'feed')).toBeNull();
    });

    test('its info box says how much of the spare energy the machine draws now and next', () => {
        const s = colony();
        // deep-copy: the sentence in words; the share before and after is the info box's quiet numbers line
        expect(doesOf(s, 'feed')).toBe('The machine gets a bigger share of the spare energy, and plays more.');
        expect(effectLine(s, 'feed')).toMatch(/^Its share 6 % → 9 %/);
    });
});

describe('what the player sees', () => {
    test('the tempo is the stars a day: more games, faster throws, up to a blur', () => {
        const slow = machineTempo({ games: 300 }, { feed: 0 });
        const fast = machineTempo({ games: 3e11 }, { feed: FEED_MAX });
        expect(slow.throws).toBeGreaterThan(0.5);
        expect(slow.throws).toBeLessThan(2);
        expect(fast.throws).toBeGreaterThan(slow.throws * 4);
        expect(fast.throws).toBeLessThanOrEqual(MAX_THROWS);
        expect(slow.drive).toBeLessThan(0.25);
        expect(fast.drive).toBeGreaterThan(0.9);
        expect(slow.starved).toBe(true);
        expect(fast.starved).toBe(false);
        // nothing fed: it stands still with its arms down
        expect(machineTempo({ games: 0 })).toMatchObject({ throws: 0, drive: 0, starved: true });
        expect(machineTempo(null).throws).toBe(0);
    });

    test('asleep it keeps running, slower and quieter, unless it is fed', () => {
        const awake = machineTempo({ games: 1e6 }, { feed: 0 });
        const starved = machineTempo({ games: 1e6 }, { asleep: true, feed: 0 });
        const fed = machineTempo({ games: 1e6 }, { asleep: true, feed: FEED_MAX });
        expect(starved.throws).toBeGreaterThan(0);
        expect(starved.throws).toBeCloseTo(awake.throws * (SLEEP_PACE + (1 - SLEEP_PACE) * feedShare(0)), 9);
        expect(starved.quiet).toBeLessThan(0.5);
        expect(fed.quiet).toBeGreaterThan(0.99);
        expect(fed.throws).toBeGreaterThan(starved.throws);
    });

    test('its hover reads what it plays on, live, in the readouts\' short form (deep-fix)', () => {
        // the playtest of v1.66.0: "1 energy a day" next to "+81/d" stars; the games say how
        expect(machineSays({ fed: 1.0, games: 243, stars: 81 })).toBe('The machine plays 243 games a day on 1 energy and wins 81. Each win is a star.');
        expect(machineSays({ fed: 2.3e9, games: 6.1e10, stars: 2.03e10 })).toBe('The machine plays 61 B games a day on 2.3 B energy and wins 20 B. Each win is a star.');
        expect(machineSays({ fed: 0.3, games: 81, stars: 27 })).toBe('The machine plays 81 games a day on less than 1 energy and wins 27. Each win is a star.');
        expect(machineSays(0)).toBe('The machine plays 0 games a day on 0 energy and wins 0. Each win is a star.');
        // a bare number is the energy fed; the games and the stars are the rule's
        expect(machineSays(1)).toBe(machineSays({ fed: 1, games: gamesFor(1), stars: starsFor(1) }));
    });

    test('asleep its lamp keeps the automated rooms\' rhythm', () => {
        expect(lampLevel(0)).toBeCloseTo(0.25, 6);
        expect(lampLevel(LAMP_PERIOD / 2)).toBeCloseTo(1, 6);
        expect(lampLevel(LAMP_PERIOD)).toBeCloseTo(0.25, 6);
    });
});

describe('the save and the scripted player', () => {
    test('schema 8 keeps the feed; a schema 7 save is given the feed of its cryo tier', () => {
        expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(8);
        const s = colony(); s.feed = 4;
        const back = deserializeDeep(serializeDeep(s, { slots: ['mine', 'farm', 'generator', 'dorm'] }));
        expect(back.state.feed).toBe(4);
        for (const [cryo, want] of [[-1, 0], [0, 1], [1, 3], [2, 5], [3, 8], [4, 8], [7, 8]]) {
            const old = { ...colony(), cryo };
            delete old.feed;
            const st = deserializeDeep(JSON.stringify({ schemaVersion: 7, state: old, layout: { slots: ['mine', 'farm', 'generator', 'dorm'] } })).state;
            expect(st.feed).toBe(want);
            expect(impliedFeed(cryo)).toBe(want);
        }
    });

    test('the player who follows the screen feeds the machine with what is left over', () => {
        // a colony that runs itself and is saving for nothing nearer than its next tier
        const s = colony();
        s.cryo = 0;
        s.rooms.cryo = 1;
        s.auto = { mine: 1, farm: 1, generator: 1, dorm: 1 };
        s.stars = feedCost(0) + 10;
        const acts = decide(s, screen(s));
        const f = acts.find((a) => a.kind === 'feed');
        expect(f).toBeTruthy();
        expect(press(s, f)).toBe(true);
        expect(s.feed).toBe(1);
    });
});
