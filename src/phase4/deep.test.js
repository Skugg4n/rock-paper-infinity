/* eslint-env jest */
import {
    initialDeepState, tickDay, sleep, surface, canResurface, canAscend, roomMultiplier, upkeepMultiplier,
    digCost, levelCost, automationCost, CRYO, DAYS_PER_YEAR, ROOM, MAX_AUTO, ASCENT, BED_SHARE,
    END_YEAR, DOOM_AT_BOOM, RESURFACE_AT, SURFACE_DECAY_YEARS, resurfaceDay,
    resolveProbe, probeOdds, probeSkill, probeCost, probeDays, updateEstimate, ESTIMATE_START,
    ESTIMATE_FLOOR, PROBE_OUTCOMES, PROBE_ODDS_EARLY, PROBE_ODDS_LATE, PROBE_WRONG_SHIFT,
    stalledRooms, STALL_AT, ascentOffered, attemptAscent, ASCENT_FAIL_LOSS, ASCENT_FAIL_SPREAD,
    ROOMS, cryoLabel, group, launchProbe, resolveDueProbes, darkenChamber, clearChamber,
    clearDarkType, weakestOf, estimateText,
} from './deep.js';

/** A rng that hands out exactly the numbers a test wants, then zeroes. */
const feed = (...xs) => { let i = 0; return () => (i < xs.length ? xs[i++] : 0); };
/**
 * A roll that lands squarely on `outcome` whatever day the probe comes home on. The odds walk
 * from the early row to the late one with the calendar, so a hard-coded 0.7 means "lost" in
 * year 0 and "reading" a few centuries later. Derive it, and the test holds on any day.
 */
const rollFor = (day, outcome) => {
    const odds = probeOdds(day);
    let acc = 0;
    for (const k of PROBE_OUTCOMES) {
        if (k === outcome) return acc + odds[k] / 2;
        acc += odds[k];
    }
    return 0.999;
};

describe('the deep', () => {
    test('the surface heals only with time, and END_YEAR is the one number that sets how long', () => {
        expect(surface(DOOM_AT_BOOM, 0)).toBe(DOOM_AT_BOOM);
        expect(surface(DOOM_AT_BOOM, 0.99 * END_YEAR * DAYS_PER_YEAR)).toBeGreaterThan(RESURFACE_AT);
        expect(surface(DOOM_AT_BOOM, 1.01 * END_YEAR * DAYS_PER_YEAR)).toBeLessThan(RESURFACE_AT);
        expect(surface(DOOM_AT_BOOM, END_YEAR * DAYS_PER_YEAR)).toBeCloseTo(RESURFACE_AT, 6);
        expect(SURFACE_DECAY_YEARS).toBeCloseTo(END_YEAR / Math.log(DOOM_AT_BOOM / RESURFACE_AT), 6);
        expect(resurfaceDay(DOOM_AT_BOOM) / DAYS_PER_YEAR).toBeCloseTo(END_YEAR, 6);
        const s = initialDeepState(); s.day = 1.1 * END_YEAR * DAYS_PER_YEAR;
        expect(canResurface(s)).toBe(true);
    });

    test('a day: the four columns are surpluses, and the weakest is the one to fix', () => {
        const s = initialDeepState();
        const food0 = s.food, people0 = s.humans;
        const r = tickDay(s);
        expect(r.food).toBeGreaterThan(0);
        expect(r.minerals).toBe(0);                      // no mine yet, but the generator burns fuel
        expect(r.parts.M).toBeLessThan(0);
        expect(r.weakest).toBe('M');                     // so minerals is the column with the dot
        expect(r.stars).toBe(0);                         // a column in the red pays nothing
        expect(r.parts.F).toBeCloseTo(r.food - people0 * 1, 6);
        expect(r.parts.E).toBeCloseTo(r.energyMade - r.energyNeed, 6);
        expect(r.parts.H).toBeGreaterThan(0);            // hands not on duty
        expect(s.food).toBeCloseTo(food0 + r.food - people0 - r.born * 20, 6);   // grown, minus eaten, minus the creches
    });

    test('asleep: nobody eats, manual rooms stop, automated ones run', () => {
        const s = initialDeepState(); s.rooms.mine = 2; s.auto.mine = 1; s.auto.generator = 1;
        const food0 = s.food, people0 = s.humans, sum = sleep(s, 10);
        expect(s.food).toBe(food0);            // manual farm stopped, nobody ate, no beds to grow into
        expect(sum.minerals).toBeGreaterThan(0);
        expect(s.humans).toBe(people0);
    });

    test('hands and power are shared out in order, a fraction at a time', () => {
        const s = initialDeepState({ people: 2 });       // two people cannot crew a generator and a farm
        const r = tickDay(s);
        expect(r.staff.generator).toBe(1);               // the lights come first
        expect(r.staff.farm).toBe(0);                    // and there is nobody left for the farm
        expect(r.food).toBe(0);
        const short = initialDeepState(); short.rooms.mine = 40; short.auto.mine = 1;   // more mine than the grid can carry
        const r2 = tickDay(short);
        expect(r2.energyMade).toBeLessThan(r2.energyNeed);
        expect(r2.power.mine).toBeGreaterThan(0);        // the mine is powered before the farm
        expect(r2.power.farm).toBe(0);
        expect(r2.parts.E).toBe(0);
    });

    test('ladders climb, and output always outruns upkeep', () => {
        expect(roomMultiplier(0, 0)).toBe(1);
        expect(roomMultiplier(1, 1)).toBe(2);
        expect(roomMultiplier(0, 3)).toBe(9);
        expect(roomMultiplier(0, 4)).toBe(900);
        expect(roomMultiplier(0, 9)).toBe(roomMultiplier(0, MAX_AUTO));   // the ladder has a top
        expect(upkeepMultiplier(0, 0)).toBe(1);
        for (let lv = 0; lv <= 12; lv++) {
            for (let au = 0; au <= MAX_AUTO; au++) {
                // no purchase may ever make a room cost more per unit of output than before
                expect(upkeepMultiplier(lv, au)).toBeLessThanOrEqual(roomMultiplier(lv, au));
            }
        }
        expect(digCost(5)).toBeGreaterThan(digCost(0));
        expect(levelCost('mine', 3)).toBeGreaterThan(levelCost('mine', 2));
        expect(automationCost('mine', MAX_AUTO)).toBe(Infinity);
        for (let i = 1; i < CRYO.length; i++) { expect(CRYO[i].days).toBeGreaterThan(CRYO[i - 1].days); expect(CRYO[i].cost).toBeGreaterThan(CRYO[i - 1].cost); }
        // the top tier has to be able to carry the calendar to the end on its own in a handful of presses
        expect(CRYO[CRYO.length - 1].days * 15).toBeGreaterThan(END_YEAR * DAYS_PER_YEAR);
    });

    test('the colony never grows itself into a famine', () => {
        const s = initialDeepState({ people: 10 });
        s.rooms = { mine: 4, farm: 4, generator: 4, dorm: 50 };   // beds for hundreds, farms for a few
        s.auto = { mine: 1, farm: 1, generator: 1, dorm: 1 };
        for (let i = 0; i < 4000; i++) tickDay(s);
        const r = tickDay(s);
        expect(r.starving).toBe(false);
        expect(s.humans).toBeGreaterThan(10);  // it did grow
        expect(r.parts.F).toBeGreaterThan(0);  // but never past what the farms bring in
    });

    test('a dormitory holds more people and makes each of them worth more', () => {
        const flat = initialDeepState(), levelled = initialDeepState();
        levelled.level.dorm = 4; levelled.rooms.dorm = 1;
        const a = tickDay(flat), b = tickDay(levelled);
        const beds = b.capacity / a.capacity, worth = b.parts.H / a.parts.H;
        expect(beds).toBeCloseTo(Math.pow(16, BED_SHARE), 6);
        expect(worth).toBeCloseTo(Math.pow(16, 1 - BED_SHARE), 6);
        expect(beds * worth).toBeCloseTo(roomMultiplier(4, 0), 6);   // together, the same ×2 a level gives anything else
    });

    test('the sensor wakes the colony the day the ring opens', () => {
        const s = initialDeepState();
        s.day = (END_YEAR - 5000) * DAYS_PER_YEAR;
        const sum = sleep(s, CRYO[CRYO.length - 1].days);
        expect(sum.wokenEarly).toBe(true);
        expect(sum.days).toBeLessThan(CRYO[CRYO.length - 1].days);
        expect(canResurface(s)).toBe(true);
        // barely under the line, not a hundred thousand years past it
        expect(surface(s.doom0, s.day)).toBeGreaterThan(RESURFACE_AT - 0.5);
    });

    test('fast forwarding a sleep gives the same numbers as living every day of it', () => {
        const make = () => {
            const s = initialDeepState();
            s.rooms = { mine: 3, farm: 3, generator: 3, dorm: 4 };
            s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 };
            return s;
        };
        const bulk = make(), slow = make();
        const sum = sleep(bulk, 20000);
        let stars = 0;
        for (let i = 0; i < 20000; i++) stars += tickDay(slow, true).stars;
        expect(sum.days).toBe(20000);
        expect(bulk.day).toBe(slow.day);
        expect(bulk.stars).toBeCloseTo(slow.stars, 6);
        expect(bulk.minerals).toBeCloseTo(slow.minerals, 6);
        expect(bulk.humans).toBeCloseTo(slow.humans, 9);
        expect(sum.stars).toBeCloseTo(stars, 6);
    });

    test('the way up needs the ring and the means', () => {
        const s = initialDeepState();
        s.day = 1.1 * END_YEAR * DAYS_PER_YEAR;
        expect(canAscend(s)).toBe(false);
        s.minerals = ASCENT.minerals; s.stars = ASCENT.stars; s.humans = ASCENT.humans;
        expect(canAscend(s)).toBe(true);
        s.day = 0;
        expect(canAscend(s)).toBe(false);   // no amount of ore buys the years
    });

    test('the room table stays readable: every room makes something and only the dorm needs nobody', () => {
        expect(ROOM.dorm.crew).toBe(0);
        for (const t of Object.keys(ROOM)) expect(ROOM[t].out).toBeGreaterThan(0);
    });
});

describe('probes: what comes back, and what the colony then believes', () => {
    test('the odds walk from the early row to the late one, and each row is a whole', () => {
        const early = probeOdds(0), late = probeOdds(END_YEAR * DAYS_PER_YEAR);
        for (const k of PROBE_OUTCOMES) {
            expect(early[k]).toBeCloseTo(PROBE_ODDS_EARLY[k], 6);
            expect(late[k]).toBeCloseTo(PROBE_ODDS_LATE[k], 6);
        }
        const sum = (o) => PROBE_OUTCOMES.reduce((a, k) => a + o[k], 0);
        expect(sum(early)).toBeCloseTo(1, 9);
        expect(sum(late)).toBeCloseTo(1, 9);
        expect(sum(probeOdds(50 * DAYS_PER_YEAR))).toBeCloseTo(1, 9);
        expect(probeSkill(0)).toBe(0);
        expect(probeSkill(END_YEAR * DAYS_PER_YEAR)).toBeCloseTo(1, 6);
        expect(probeSkill(3650)).toBeGreaterThan(probeSkill(365));
    });

    test('resolveProbe reads the table in order, and only two outcomes carry a number', () => {
        // the day of the boom: reading .40, lost .40, wrong .15, monster .05
        expect(resolveProbe(feed(0.10, 0.5), 0, 30).outcome).toBe('reading');
        expect(resolveProbe(feed(0.50), 0, 30).outcome).toBe('lost');
        expect(resolveProbe(feed(0.85, 0.9), 0, 30).outcome).toBe('wrong');
        expect(resolveProbe(feed(0.99), 0, 30).outcome).toBe('monster');
        expect(resolveProbe(feed(0.50), 0, 30).reading).toBeNull();
        expect(resolveProbe(feed(0.99), 0, 30).spread).toBe(0);
        // a good reading sits around the truth; a wrong one is a fixed step away from it
        const good = resolveProbe(feed(0.10, 0.5), 0, 30);
        expect(good.reading).toBeCloseTo(30, 6);
        expect(good.spread).toBeGreaterThan(0);
        expect(resolveProbe(feed(0.85, 0.9), 0, 30).reading).toBeCloseTo(30 + PROBE_WRONG_SHIFT, 6);
        expect(resolveProbe(feed(0.85, 0.1), 0, 30).reading).toBeCloseTo(30 - PROBE_WRONG_SHIFT, 6);
        // nothing ever reads outside the dial
        expect(resolveProbe(feed(0.85, 0.1), 0, 5).reading).toBeGreaterThanOrEqual(0);
        expect(resolveProbe(feed(0.85, 0.9), 0, 95).reading).toBeLessThanOrEqual(100);
        // late in the chapter the instruments are tight: the scatter has shrunk
        expect(resolveProbe(feed(0.10, 0.99), END_YEAR * DAYS_PER_YEAR, 15).spread)
            .toBeLessThan(resolveProbe(feed(0.10, 0.99), 0, 15).spread);
    });

    test('a probe costs more and comes back sooner the more the colony has sent', () => {
        expect(probeCost(1)).toBeGreaterThan(probeCost(0));
        expect(probeDays(0)).toBe(2 * DAYS_PER_YEAR);
        expect(probeDays(4)).toBeLessThan(probeDays(0));
        expect(probeDays(99)).toBeGreaterThan(0);
    });

    test('the estimate narrows toward the truth, and a lost probe leaves it alone', () => {
        const truth = 22;
        let est = { ...ESTIMATE_START };
        expect(updateEstimate(est, null, 0)).toEqual(est);      // lost: nothing moves
        let n = 7;
        const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < 24; i++) {
            // an honest probe every time, but each with its own scatter: the mean must land
            // on the truth even though no single reading does
            const r = resolveProbe(feed(0.05, rng()), 3650, truth);
            est = updateEstimate(est, r.reading, r.spread);
        }
        expect(est.spread).toBeLessThan(ESTIMATE_START.spread / 3);
        expect(Math.abs(est.mean - truth)).toBeLessThan(6);
        expect(est.spread).toBeGreaterThanOrEqual(ESTIMATE_FLOOR);
        // one wrong probe pushes the mean the wrong way, and the next good ones pull it back
        const bent = updateEstimate(est, truth + PROBE_WRONG_SHIFT, est.spread);
        expect(bent.mean).toBeGreaterThan(est.mean);
        let fixed = bent;
        for (let i = 0; i < 6; i++) fixed = updateEstimate(fixed, truth, 4);
        expect(Math.abs(fixed.mean - truth)).toBeLessThan(Math.abs(bent.mean - truth));
        // however many come back, the colony never claims certainty
        let sure = { ...ESTIMATE_START };
        for (let i = 0; i < 400; i++) sure = updateEstimate(sure, truth, 3);
        expect(sure.spread).toBe(ESTIMATE_FLOOR);
    });

    test('a chamber a monster took makes nothing, and an empty dark list changes no number', () => {
        const make = () => {
            const s = initialDeepState();
            s.rooms.mine = 4; s.rooms.generator = 6;
            s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 };   // nobody on shift: the ore is the rooms'
            return s;
        };
        const plain = make(), zeroed = make();
        zeroed.dark = { mine: 0, farm: 0, generator: 0, dorm: 0 };
        expect(tickDay(zeroed)).toEqual(tickDay(plain));
        const taken = make(); taken.dark.mine = 2;
        expect(tickDay(taken).minerals).toBeCloseTo(tickDay(make()).minerals / 2, 6);
    });
});

describe('the wake-up report', () => {
    test('a sleep advances the calendar by exactly its days, once', () => {
        const s = initialDeepState();
        s.rooms = { mine: 3, farm: 3, generator: 3, dorm: 4, cryo: 1 };
        s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 };
        for (const days of [30, 365, 3650, 36500]) {
            const before = s.day;
            const sum = sleep(s, days);
            expect(sum.days).toBe(days);
            expect(s.day - before).toBe(days);      // never twice, never a day short
            expect(sum.wokenEarly).toBe(false);
        }
    });

    test('what ran and what stalled comes out of the sleep, not out of a guess', () => {
        const s = initialDeepState();
        s.rooms = { mine: 3, farm: 3, generator: 3, dorm: 2, cryo: 1 };
        s.auto = { mine: 1, farm: 0, generator: 1, dorm: 0 };   // the farm has nobody, and everyone is asleep
        const sum = sleep(s, 200);
        for (const t of ROOMS) expect(sum.ran[t]).toBeGreaterThanOrEqual(0);
        expect(sum.ran.mine).toBeGreaterThan(STALL_AT);         // automated: it ran
        expect(sum.ran.farm).toBeLessThan(STALL_AT);            // manual: it stopped
        const stalled = stalledRooms(s, sum);
        expect(stalled.farm).toBe(true);
        expect(stalled.mine).toBeUndefined();
        expect(stalled.cryo).toBeUndefined();                   // the cryo hall is not one of the four
    });
});

describe('the ascent is a decision, not a countdown', () => {
    test('the door opens on the estimate, and the truth decides what is behind it', () => {
        const rich = () => {
            const s = initialDeepState();
            s.minerals = ASCENT.minerals * 2; s.stars = ASCENT.stars * 2; s.humans = ASCENT.humans * 2;
            return s;
        };
        const wrong = rich();
        wrong.est = { mean: 12, spread: 5 };       // the colony believes the surface is clear
        expect(ascentOffered(wrong)).toBe(true);
        expect(canAscend(wrong)).toBe(false);      // on day 0 it very much is not
        const people = wrong.humans;
        const out = attemptAscent(wrong);
        expect(out.tried).toBe(true);
        expect(out.success).toBe(false);
        expect(out.lost).toBeCloseTo(people * ASCENT_FAIL_LOSS, 6);
        expect(wrong.humans).toBeCloseTo(people * (1 - ASCENT_FAIL_LOSS), 6);
        expect(wrong.est.spread).toBeGreaterThanOrEqual(ASCENT_FAIL_SPREAD);   // wide again
        expect(wrong.est.mean).toBeGreaterThan(12);                            // and pointing the right way
        expect(wrong.ascended).toBeFalsy();
        expect(wrong.minerals).toBeLessThan(ASCENT.minerals * 2);              // the party took the ore with it

        const right = rich();
        right.day = 1.1 * END_YEAR * DAYS_PER_YEAR;
        right.est = { mean: 14, spread: 4 };
        expect(canAscend(right)).toBe(true);
        expect(attemptAscent(right)).toEqual({ tried: true, success: true, lost: 0 });
        expect(right.ascended).toBe(true);

        const poor = initialDeepState();
        poor.est = { mean: 5, spread: 2 };
        expect(ascentOffered(poor)).toBe(false);
        expect(attemptAscent(poor)).toEqual({ tried: false, success: false, lost: 0 });
    });
});

describe('cryo: the badge, and what a press is worth', () => {
    test('every tier reads as a length of time, months first and then years', () => {
        expect(CRYO.map((c) => cryoLabel(c.days)))
            .toEqual(['1 m', '1 y', '10 y', '100 y', '1 000 y', '10 000 y', '100 000 y']);
        expect(cryoLabel(0)).toBe('1 m');
        expect(cryoLabel(3650000)).toBe('10 000 y');
        expect(group(1234567)).toBe('1 234 567');   // spaces, never commas
    });
});

describe('probes in flight, and what they do on the way home', () => {
    const slots = () => ['mine', 'farm', 'generator', 'dorm', null];

    test('launching one costs the ore that day and sets the day it is due', () => {
        const s = initialDeepState();
        s.minerals = probeCost(0) * 3;
        const before = s.minerals;
        const p = launchProbe(s);
        expect(p.sentDay).toBe(s.day);
        expect(p.dueDay).toBe(s.day + probeDays(0));
        expect(s.minerals).toBe(before - probeCost(0));
        expect(s.probesSent).toBe(1);
        expect(s.probes).toHaveLength(1);
        // the second one costs more, and an empty pocket launches nothing
        s.minerals = 0;
        expect(launchProbe(s)).toBeNull();
        expect(s.probes).toHaveLength(1);
    });

    test('only what is due comes home, and the ring is drawn from the first one that did', () => {
        const s = initialDeepState();
        s.minerals = 1e9;
        launchProbe(s);                                  // due in probeDays(0)
        launchProbe(s);
        s.probes[1].dueDay = s.day + 1e9;                // this one is still out there
        expect(s.estRevealed).toBe(false);
        s.day += probeDays(0);
        const landed = resolveDueProbes(s, slots(), feed(rollFor(s.day, 'reading'), 0.5));
        expect(landed).toHaveLength(1);
        expect(landed[0].outcome).toBe('reading');
        expect(s.probes).toHaveLength(1);                // the far one is untouched
        expect(s.estRevealed).toBe(true);
        expect(s.est.spread).toBeLessThan(ESTIMATE_START.spread);
    });

    test('a lost probe moves nothing, and a monster takes a chamber instead of a reading', () => {
        const s = initialDeepState();
        s.minerals = 1e9;
        launchProbe(s); s.day += probeDays(0);
        const est = { ...s.est };
        resolveDueProbes(s, slots(), feed(rollFor(s.day, 'lost')));      // lost: nothing came home
        expect(s.est).toEqual(est);
        expect(s.estRevealed).toBe(false);

        launchProbe(s); s.day += probeDays(1);
        const out = resolveDueProbes(s, slots(), feed(rollFor(s.day, 'monster'), 0));   // monster, first chamber
        expect(out[0].outcome).toBe('monster');
        expect(out[0].slot).toBe(0);
        expect(s.dark.mine).toBe(1);
        expect(s.darkSlots).toEqual([0]);
        expect(s.est).toEqual(est);                      // it brought no news, only teeth
    });

    test('a dark chamber is cleared by going in, or by buying anything for its kind', () => {
        const s = initialDeepState();
        const sl = slots();
        expect(darkenChamber(s, sl, () => 0)).toBe(0);
        expect(darkenChamber(s, sl, () => 0.3)).toBe(1);
        expect(s.darkSlots).toEqual([0, 1]);
        expect(clearChamber(s, sl, 0)).toBe(true);
        expect(clearChamber(s, sl, 0)).toBe(false);      // already lit
        expect(s.dark.mine).toBe(0);
        expect(clearDarkType(s, sl, 'farm')).toBe(1);
        expect(s.darkSlots).toEqual([]);
        expect(s.dark.farm).toBe(0);
        // nothing dug, nothing to take
        expect(darkenChamber(initialDeepState(), [null, null], () => 0)).toBe(-1);
    });

    test('the wake-up strip reads the weakest column out of the histogram', () => {
        expect(weakestOf({ M: 3, F: 40, E: 1, H: 0 })).toBe('F');
        expect(weakestOf({})).toBe('M');
        expect(estimateText({ mean: 39.6, spread: 40.4 })).toBe('40 ± 40 %');
    });
});
