/* eslint-env jest */
/**
 * v1.45.0, after Ola's playtest of v1.44.0: survival in one word, scouts that tell their odds
 * before they go, you can always try to go up, and every number in one short form.
 */
import {
    initialDeepState, surface, survival, survivalNow, believedSurvival, SURVIVAL_AT, RESURFACE_AT,
    DOOM_AT_BOOM, END_YEAR, DAYS_PER_YEAR, ESTIMATE_START, scoutOdds, wholePercents, probeOdds,
    probeScatter, probeDays, probeCost, scoutParty, PROBE_OUTCOMES, launchProbe, scoutsOut,
    attemptAscent, ascentOdds, ascentParty, canTryAscent, ASCENT_MIN_PEOPLE, ASCENT_FAIL_LOSS,
    ASCENT_TAUGHT_SPREAD, estimateNow, CRYO, MOURN_DAYS,
} from './deep.js';
import { short, backIn, cryoGateShort, cryoReadyLine } from './readout.js';
import { verdict, readingText, ascentFailLine, GETTING_THERE_AT } from './advisor.js';
import { crustLabel, bandArc, ESTIMATE_CAPTION } from './crust.js';

describe('survival: one word, and every number on screen grows toward the goal', () => {
    test('doomsday and survival are two sides of one number', () => {
        expect(SURVIVAL_AT).toBe(100 - RESURFACE_AT);
        expect(survival(DOOM_AT_BOOM)).toBe(15);
        expect(survival(RESURFACE_AT)).toBe(85);
        expect(survival(120)).toBe(0);
        expect(survival(-5)).toBe(100);
    });

    test('the truth and the belief read the same way, and both climb with the years', () => {
        const s = initialDeepState();
        expect(survivalNow(s)).toBeCloseTo(15, 9);
        expect(believedSurvival(s)).toEqual({ mean: survival(estimateNow(s).mean), spread: ESTIMATE_START.spread });
        s.day = END_YEAR * DAYS_PER_YEAR;
        expect(survivalNow(s)).toBeCloseTo(85, 6);
        s.day = END_YEAR * DAYS_PER_YEAR / 2;
        expect(survivalNow(s)).toBeCloseTo(100 - surface(s.doom0, s.day), 9);
    });

    test('a reading says what it means in two words', () => {
        expect(verdict(7)).toBe('Not yet.');
        expect(verdict(GETTING_THERE_AT)).toBe('Getting there.');
        expect(verdict(84.4)).toBe('Getting there.');
        expect(verdict(SURVIVAL_AT)).toBe('We could go up.');
        expect(readingText(93)).toBe('survival 7 %. Not yet.');
    });

    test('the ring on the crust: the label, the line, and the band of doubt', () => {
        expect(crustLabel(7.4)).toBe('survival 7 % · need 85 %');
        expect(ESTIMATE_CAPTION).toBe('survival if we go up now');
        const [len, off] = bandArc(62, 10);
        expect(len).toBeCloseTo(113 * 0.2, 9);          // 52 to 72 %
        expect(off).toBeCloseTo(-113 * 0.52, 9);
        const [edge] = bandArc(5, 40);                   // never below empty
        expect(edge).toBeCloseTo(113 * 0.45, 9);
        const [top] = bandArc(95, 40);                   // never past full
        expect(top).toBeCloseTo(113 * 0.45, 9);
    });
});

describe('scout parties tell their odds before they go', () => {
    test('whole per cents always add up to a hundred', () => {
        expect(wholePercents({ a: 1 / 3, b: 1 / 3, c: 1 / 3 }, ['a', 'b', 'c'])).toEqual({ a: 34, b: 33, c: 33 });
        for (const day of [0, 400, 5000 * DAYS_PER_YEAR, END_YEAR * DAYS_PER_YEAR]) {
            const p = wholePercents(probeOdds(day), PROBE_OUTCOMES);
            expect(PROBE_OUTCOMES.reduce((a, k) => a + p[k], 0)).toBe(100);
        }
    });

    test('the button says who goes, for how long, every way it can end, and how far off a reading is', () => {
        const s = initialDeepState({ people: 30 });
        s.day = 400;
        const o = scoutOdds(s);
        expect(o.people).toBe(scoutParty(30));
        expect(o.days).toBe(probeDays(0));
        expect(o.price).toBe(probeCost(0));
        // the odds are those of the day they would come home, not the day they leave
        expect(o.pct).toEqual(wholePercents(probeOdds(400 + probeDays(0)), PROBE_OUTCOMES));
        expect(o.scatter).toBe(Math.round(probeScatter(400 + probeDays(0))));
        expect(Object.keys(o.pct)).toEqual(['reading', 'lost', 'wrong', 'monster']);
        // a colony that has sent more sends them shorter and better
        s.probesSent = 5;
        s.day = 5000 * DAYS_PER_YEAR;
        const later = scoutOdds(s);
        expect(later.days).toBeLessThan(o.days);
        expect(later.pct.reading).toBeGreaterThan(o.pct.reading);
        expect(later.scatter).toBeLessThanOrEqual(o.scatter);
    });

    test('a party out is one party at a time, and the first clears the rubble for good', () => {
        const s = initialDeepState({ people: 30 });
        s.minerals = 1e6;
        expect(scoutsOut(s)).toBe(false);
        expect(s.shaftOpen).toBe(false);
        expect(launchProbe(s)).not.toBeNull();
        expect(scoutsOut(s)).toBe(true);
        expect(s.shaftOpen).toBe(true);
    });

    test('"back in" is said the way the button says it', () => {
        expect(backIn(455)).toBe('1 y 3 m');
        expect(backIn(365)).toBe('1 y');
        expect(backIn(120)).toBe('4 m');
        expect(backIn(12.2)).toBe('13 d');
        expect(backIn(0)).toBe('1 d');
        // the last five days of a year are its last month, never "1 y 12 m" (v1.48.0)
        for (let d = 360; d < 365; d++) expect(backIn(365 + d)).toBe('2 y');
        expect(backIn(725)).toBe('2 y');
        expect(backIn(362)).toBe('1 y');
        expect(backIn(359)).toBe('11 m');
    });
});

describe('you can always try to go up', () => {
    test('the button says the same number as the ring, and who goes first', () => {
        const s = initialDeepState({ people: 40 });
        const o = ascentOdds(s);
        expect(o.survival).toBe(believedSurvival(s).mean);
        expect(o.spread).toBe(believedSurvival(s).spread);
        expect(o.party).toBe(13);                        // a third of 40
        expect(ascentParty({ humans: 2 })).toBe(1);
    });

    test('below the line a third dies, the rest wait and mourn, and the estimate is a poor reading', () => {
        const s = initialDeepState({ people: 40 });
        s.day = 200000 * DAYS_PER_YEAR;
        s.est = { bias: 20, spread: 30 };                // hopeless and unsure
        const truth = survivalNow(s);
        const out = attemptAscent(s, () => 0.5);         // a reading that happens to land on the truth
        expect(out).toEqual({ tried: true, success: false, lost: Math.round(40 * ASCENT_FAIL_LOSS), survival: truth });
        expect(s.humans).toBe(27);
        expect(believedSurvival(s).mean).toBeCloseTo(truth, 9);
        expect(believedSurvival(s).spread).toBe(ASCENT_TAUGHT_SPREAD);
        expect(s.mournUntil).toBe(s.day + MOURN_DAYS);   // and nobody is born for a year
        expect(s.shaftOpen).toBe(true);
        expect(ascentFailLine(out)).toBe(`13 went up and did not come back. Survival up there is ${Math.round(truth)} %; we need 85.`);
    });

    test('a failed try is a worse instrument than a scout party: a third of the colony for ± 15', () => {
        const s = initialDeepState({ people: 120 });
        s.day = 200000 * DAYS_PER_YEAR;
        const scouts = scoutOdds(s);
        expect(scouts.people).toBeLessThan(ascentParty(s) / 4);
        expect(scouts.scatter).toBeLessThan(ASCENT_TAUGHT_SPREAD);
        // the lesson is never better than ± 15, whatever the dice say
        for (const r of [0, 0.25, 0.99]) {
            const c = initialDeepState({ people: 120 });
            c.day = s.day;
            attemptAscent(c, () => r);
            expect(believedSurvival(c).spread).toBe(ASCENT_TAUGHT_SPREAD);
            expect(Math.abs(believedSurvival(c).mean - survivalNow(c))).toBeLessThanOrEqual(ASCENT_TAUGHT_SPREAD + 1e-9);
        }
    });

    test('a tiny colony still tries, down to the last few; below that it cannot', () => {
        const s = initialDeepState({ people: ASCENT_MIN_PEOPLE });
        expect(canTryAscent(s)).toBe(true);
        expect(attemptAscent(s)).toMatchObject({ tried: true, success: false, lost: 1 });
        expect(s.humans).toBe(2);
        expect(canTryAscent(s)).toBe(false);
        expect(attemptAscent(s)).toMatchObject({ tried: false, lost: 0 });
        expect(s.humans).toBe(2);
    });

    test('at the line it is the ending, and after the ending nothing more is tried', () => {
        const s = initialDeepState({ people: 5 });
        s.day = END_YEAR * DAYS_PER_YEAR + 1;
        expect(attemptAscent(s)).toMatchObject({ tried: true, success: true, lost: 0 });
        expect(s.ascended).toBe(true);
        expect(canTryAscent(s)).toBe(false);
    });
});

describe('every number in one short form', () => {
    test('k, M, B, T with at most one decimal, and only below ten', () => {
        expect(short(0.4)).toBe('0');
        expect(short(999)).toBe('999');
        expect(short(1500)).toBe('1.5 k');
        expect(short(-1500)).toBe('-1.5 k');
        expect(short(313031.1)).toBe('313 k');
        expect(short(999.7e3)).toBe('1 M');          // never "1000 k"
        expect(short(9e6)).toBe('9 M');
        expect(short(2280.6e6)).toBe('2.3 B');
        expect(short(1.2e13)).toBe('12 T');
        expect(short(4.8e15)).toBe('4.8e15');
        for (const v of [1, 12, 123, 1234, 12345, 123456, 1.2e7, 3.4e10, 5.6e13]) expect(short(v).length).toBeLessThanOrEqual(6);
    });

    test('a locked cryo tier says why in a few words, and the day it opens in one line', () => {
        expect(cryoGateShort(3, { kind: 'food', days: 20 })).toBe('needs food for 100 y');
        expect(cryoGateShort(1, { kind: 'stall', type: 'farm', why: 'hands' })).toBe('needs farms automated');
        expect(cryoGateShort(1, { kind: 'stall', type: 'generator', why: 'fuel' })).toBe('needs more mines');
        expect(cryoGateShort(1, { kind: 'energy', pct: 80 })).toBe('needs spare power');
        expect(cryoGateShort(2, null, { stars: 0 })).toBe(`needs ${short(CRYO[2].cost)} stars`);
        expect(cryoGateShort(2, null, { stars: CRYO[2].cost })).toBe('');
        expect(cryoReadyLine(3)).toBe('Cryo IV is ready: a century a second.');
    });
});
