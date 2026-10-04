/* eslint-env jest */
/*
 * v1.43.0: sleep is a state. What wakes the colony, what a tier is gated on, what the
 * scouts say, what the ice costs, and what an old save becomes.
 */
import {
    initialDeepState, sleep, sleepTrouble, troubleIn, tickDay, CRYO, DAYS_PER_YEAR, MIN_SLEEPERS,
    FOOD_ALARM_DAYS, startBuild, launchProbe, probeOdds, PROBE_OUTCOMES,
    estimateNow, estimateOpensDay, habitableYear, END_YEAR, RESURFACE_AT, surface, cryoDeathRate,
    CRYO_DEATH_PER_YEAR, CRYO_DEATH_DORM, SLEEP_FOOD, repairTick, REPAIR_DAYS, darkenChamber,
    scoutParty, levelCost, BED_FILL, VAT_ROOM,
} from './deep.js';
import {
    alarmLine, alarmGlyph, scoutLine, scoutSentLine, troubleClause, DESCENT_LINE,
} from './advisor.js';
import { cryoGateText, affordText, stocks, flows, consequence, span, cloneState } from './readout.js';
import { deserializeDeep, serializeDeep, SCHEMA_VERSION } from './persistence.js';

/** A colony that runs itself: nothing on a shift, power and food to spare. */
const automated = () => {
    const s = initialDeepState({ people: 16 });
    s.rooms = { mine: 3, farm: 2, generator: 2, dorm: 1, cryo: 1 };
    s.level = { mine: 1, farm: 1, generator: 1, dorm: 0 };
    s.auto = { mine: 1, farm: 1, generator: 1, dorm: 0 };
    s.chambers = 9; s.minerals = 26000; s.food = 9000; s.stars = 9e4; s.cryo = 0;
    s.vats = 1;            // deep-fix2: the first culture vats, so the ice is refilled in the sleep
    return s;
};
const rollFor = (day, outcome) => {
    const odds = probeOdds(day);
    let acc = 0;
    for (const k of PROBE_OUTCOMES) {
        if (k === outcome) return acc + odds[k] / 2;
        acc += odds[k];
    }
    return 0.999;
};
const feed = (...xs) => { let i = 0; return () => (i < xs.length ? xs[i++] : 0); };

describe('alarms: what wakes a sleeping colony, and the sentence it says', () => {
    test('a colony that runs itself sleeps the whole stretch, and nothing wakes it', () => {
        const s = automated();
        const sum = sleep(s, 20 * 30, { alarms: true });
        expect(sum.alarm).toBeNull();
        expect(sum.days).toBe(600);
    });

    test('a manual room stalls on the first night, and says so', () => {
        const s = automated();
        s.auto.farm = 0;
        const sum = sleep(s, 365, { alarms: true });
        expect(sum.days).toBe(1);
        expect(sum.alarm).toEqual({ kind: 'stall', type: 'farm', why: 'hands' });
        expect(alarmLine(sum.alarm)).toBe('Woke: the farm stalled, no hands.');
        expect(alarmGlyph(sum.alarm, { farm: 'sprout' })).toBe('sprout');
    });

    test('generators with no mine behind them run dry, and the colony wakes that day', () => {
        const s = automated();
        s.rooms.mine = 0; s.minerals = 40;
        const sum = sleep(s, 365, { alarms: true });
        expect(sum.alarm).toEqual({ kind: 'stall', type: 'generator', why: 'fuel' });
        expect(sum.days).toBeLessThan(365);
        expect(alarmLine(sum.alarm)).toBe('Woke: the generators stalled, no ore to burn.');
    });

    test('more rooms than the grid can carry wake the colony with the share they run at', () => {
        const s = automated();
        s.rooms.mine = 30;
        const sum = sleep(s, 30, { alarms: true });
        expect(sum.alarm.kind).toBe('energy');
        expect(sum.alarm.pct).toBeGreaterThanOrEqual(0);
        expect(sum.alarm.pct).toBeLessThan(100);
        expect(alarmLine(sum.alarm)).toMatch(/^Woke: energy is short, rooms run at \d+ %\.$/);
    });

    test('food: the sleepers eat a tenth of a ration, and a larder with no farm behind it runs out', () => {
        const s = automated();
        s.rooms.farm = 0; s.humans = 16;
        s.food = 16 * SLEEP_FOOD * 50;       // fifty sleeping days of food
        const sum = sleep(s, 365, { alarms: true });
        expect(sum.alarm.kind).toBe('food');
        expect(sum.alarm.days).toBeLessThan(FOOD_ALARM_DAYS);
        expect(sum.days).toBeGreaterThanOrEqual(20);    // it slept until the line, not a day before
        expect(alarmLine({ kind: 'food', days: 21 })).toBe('Woke: food will run out in 21 days.');
        expect(alarmLine({ kind: 'food', days: 0 })).toBe('Woke: the food has run out.');
    });

    test('a scout party comes home on its own day, and wakes the colony with its news', () => {
        const s = automated();
        s.humans = 40;
        const p = launchProbe(s);
        expect(scoutSentLine(p.people)).toBe(`${p.people} people went up the shaft.`);
        const due = p.dueDay;
        const sum = sleep(s, CRYO[3].days, { alarms: true, slots: ['mine', 'farm'], rng: feed(rollFor(due, 'reading'), 0.5) });
        expect(s.day).toBe(due);
        expect(sum.alarm.kind).toBe('scouts');
        const l = sum.alarm.landed[0];
        expect(l.outcome).toBe('reading');
        expect(alarmLine(sum.alarm)).toBe(`Woke: the scouts are back. Survival ${Math.round(100 - l.reading)} %. Not yet.`);
        expect(s.humans).toBeCloseTo(40, 0);     // they came home: a few may have died in the ice meanwhile
    });

    test('every way a party can come home has its own plain line', () => {
        // the rules count doomsday; the line says survival, and what it means (v1.45.0)
        expect(scoutLine({ outcome: 'reading', reading: 93 })).toBe('The scouts are back. Survival 7 %. Not yet.');
        expect(scoutLine({ outcome: 'reading', reading: 38 })).toBe('The scouts are back. Survival 62 %. Getting there.');
        expect(scoutLine({ outcome: 'reading', reading: 14 })).toBe('The scouts are back. Survival 86 %. We could go up.');
        expect(scoutLine({ outcome: 'lost' })).toBe('The scouts did not come back.');
        expect(scoutLine({ outcome: 'wrong', reading: 3 })).toBe('The scouts came back raving. Their reading is no use.');
        expect(scoutLine({ outcome: 'monster', slot: 6 })).toBe('Something came back with the scouts. Chamber 7 is dark.');
        expect(alarmLine({ kind: 'scouts', landed: [{ outcome: 'monster', slot: 6 }] })).toBe('Woke: something came back with the scouts. Chamber 7 is dark.');
        expect(alarmLine({ kind: 'scouts', landed: [{ outcome: 'lost' }] })).toBe('Woke: the scouts did not come back.');
        expect(alarmLine({ kind: 'manual' })).toBe('Woke: the hall was opened by hand.');
    });

    test('deep-tension: an order done wakes nobody: the long sleep wakes for something new (instruments.js)', () => {
        const s = automated();
        s.stars = 1e12;                              // anything for the weakest column is paid for
        s.chambers += 3; s.minerals = 1e12;
        startBuild(s, 'level', { type: 'mine' });
        const sum = sleep(s, 365, { alarms: true });
        expect(sum.alarm).toBeNull();
        expect(s.level.mine).toBe(2);
        expect(alarmLine({ kind: 'act', job: { kind: 'level', type: 'mine' } })).toBe('Woke: the mines are levelled, and the next one is paid for.');
    });

    test('the estimate crossing the line wakes the colony, on the day it crosses', () => {
        const s = automated();
        s.day = Math.floor(0.98 * END_YEAR * DAYS_PER_YEAR);
        s.est = { bias: -0.5, spread: 3 };           // a little hopeful: it crosses before the truth does
        const opens = estimateOpensDay(s);
        const sum = sleep(s, CRYO[6].days, { alarms: true });
        expect(sum.alarm.kind).toBe('estimate');
        expect(s.day).toBe(Math.ceil(opens));
        expect(estimateNow(s).mean).toBeLessThanOrEqual(RESURFACE_AT);
        expect(alarmLine(sum.alarm)).toMatch(/^Woke: we may survive up there\. About 8[56] %, and we need 85 %\.$/);
    });

    test('the sensor on the shaft is the truth: it wakes the colony and sets the belief straight', () => {
        const s = automated();
        s.day = Math.floor(0.99 * END_YEAR * DAYS_PER_YEAR);
        s.est = { bias: 3, spread: 20 };             // gloomy: the truth gets there first
        const sum = sleep(s, CRYO[6].days, { alarms: true });
        expect(sum.alarm.kind).toBe('surface');
        expect(s.est.bias).toBe(0);
        expect(s.est.spread).toBeLessThanOrEqual(4);
        expect(alarmLine(sum.alarm)).toMatch(/^Woke: the sensor on the shaft reads survival 85 %\. The surface has healed\.$/);
    });

    test('the top tier is a handful of loops, not a hundred million days', () => {
        const s = automated();
        const sum = sleep(s, CRYO[6].days, { alarms: true, maxSteps: 400 });
        expect(sum.days).toBe(CRYO[6].days);
        expect(sum.alarm).toBeNull();
    });

    test('the troubles are read in the order the colony wants to hear them', () => {
        const s = automated();
        const r = tickDay(cloneState(s), true);
        expect(troubleIn(s, r)).toBeNull();
        expect(troubleIn({ ...s, humans: MIN_SLEEPERS - 1 }, r)).toEqual({ kind: 'few' });
        expect(troubleClause({ kind: 'stall', type: 'mine', why: 'hands' })).toBe('the mine stops for lack of hands');
    });
});

describe('cryo tiers are offered when a sleep at their rate would be safe (B063)', () => {
    test('a colony with a manual room cannot sleep safely at any rate, and is told why', () => {
        const s = automated();
        s.auto.generator = 0;
        const t = sleepTrouble(s, CRYO[1].days);
        expect(t).toMatchObject({ kind: 'stall', type: 'generator', why: 'hands', day: 1 });
        expect(cryoGateText(1, t, s)).toBe('Cryo II needs the generators to run without hands.');
        // and the real state is untouched by the dry run
        expect(s.day).toBe(0);
        expect(s.minerals).toBe(26000);
    });

    test('a larder that lasts a month but not a year opens Cryo I and not Cryo II', () => {
        const s = automated();
        s.rooms.farm = 0;
        s.food = 16 * SLEEP_FOOD * 240;           // 240 sleeping days of food
        expect(sleepTrouble(s, CRYO[0].days)).toBeNull();
        const t = sleepTrouble(s, CRYO[1].days);
        expect(t.kind).toBe('food');
        expect(cryoGateText(1, t, s)).toMatch(/^Cryo II needs food for 365 days: 2[34]\d today\.$/);
    });

    test('too few people cannot go under at all', () => {
        const s = automated();
        s.humans = MIN_SLEEPERS - 2;
        const t = sleepTrouble(s, CRYO[0].days);
        expect(t.kind).toBe('few');
        expect(cryoGateText(0, t, s)).toBe(`Cryo I needs at least ${MIN_SLEEPERS} people to go under: 8 today.`);
    });

    test('a party away is not counted: the dry run is about the colony, not the dice', () => {
        const s = automated();
        s.humans = 60;
        launchProbe(s);
        s.probes[0].dueDay = s.day + 3;
        expect(sleepTrouble(s, CRYO[2].days)).toBeNull();
        expect(s.probes).toHaveLength(1);
    });
});

describe('people: the ice takes some, the scouts take some, the awake mend', () => {
    test('a share of the sleepers is lost every sleeping year, less with better dormitories', () => {
        const s = initialDeepState({ people: 1000 });
        expect(cryoDeathRate(s) * 365).toBeCloseTo(CRYO_DEATH_PER_YEAR, 12);
        s.level.dorm = 2;
        expect(cryoDeathRate(s) * 365).toBeCloseTo(CRYO_DEATH_PER_YEAR * CRYO_DEATH_DORM ** 2, 12);
        // a colony whose farm is stopped cannot refill the pods: the losses show
        const t = initialDeepState({ people: 1000 });
        t.auto.generator = 1; t.food = 1e6;          // fed from the larder, so nobody starves
        const sum = sleep(t, 365);
        expect(sum.died).toBeCloseTo(1000 * (1 - Math.pow(1 - CRYO_DEATH_PER_YEAR / 365, 365)), 3);
        expect(t.humans).toBeCloseTo(1000 - sum.died, 6);
    });

    test('a fed colony refills its pods: the ice costs food and a number on the strip', () => {
        const s = automated();
        const people = s.humans;
        const beds = tickDay(JSON.parse(JSON.stringify(s)), false).capacity;
        const sum = sleep(s, 10 * DAYS_PER_YEAR);
        expect(sum.died).toBeGreaterThan(0);
        // deep-fix2: the vats fill a share of the empty pods a day, so the count rests a hair under;
        // deep-pass4 (B416): and past the beds, into the vats' own places (VAT_ROOM of the beds)
        expect(s.humans).toBeGreaterThanOrEqual(people - 0.01);
        expect(s.humans).toBeCloseTo(beds * (1 + VAT_ROOM[s.vats || 0]), 1);
    });

    test('deep-fix2: without culture vats nobody is born asleep; the ice thins the sleepers and the sleep is still a handful of loops', () => {
        const s = automated();
        s.vats = 0;
        s.humans = 40; s.food = 1e9;
        const sum = sleep(s, 100 * DAYS_PER_YEAR, { alarms: true, benign: false, maxSteps: 400 });
        expect(sum.days).toBe(100 * DAYS_PER_YEAR);
        expect(sum.born).toBe(0);
        const keep = Math.pow(1 - CRYO_DEATH_PER_YEAR / 365, 100 * DAYS_PER_YEAR);
        expect(s.humans).toBeCloseTo(40 * keep, 3);
        expect(sum.died).toBeCloseTo(40 * (1 - keep), 3);
        // a longer sleep wakes them when a whole sleeper is missing under ten, not for a fraction
        const t = automated();
        t.vats = 0; t.humans = 12; t.food = 1e9;
        const out = sleep(t, 1000 * DAYS_PER_YEAR, { alarms: true, benign: false, maxSteps: 400 });
        expect(out.alarm && out.alarm.kind).toBe('few');
        expect(t.humans).toBeLessThan(MIN_SLEEPERS - 0.5);
        expect(t.humans).toBeGreaterThan(MIN_SLEEPERS - 0.6);
    });

    test('deep-fix2: with culture vats people are grown in the sleep, more at each level', () => {
        const grown = (vats) => {
            const s = automated();
            s.vats = vats; s.humans = 12; s.rooms.dorm = 4; s.food = 1e9;
            return sleep(s, DAYS_PER_YEAR).born;
        };
        expect(grown(0)).toBe(0);
        expect(grown(1)).toBeGreaterThan(0);
        expect(grown(2)).toBeGreaterThan(grown(1));
        expect(grown(3)).toBeGreaterThan(grown(2));
    });

    test('deep-fix2: new beds fill a share at a time: the people grow into them over weeks, never in a day', () => {
        const s = automated();
        s.humans = 400; s.rooms.dorm = 60; s.food = 1e9; s.vats = 0;
        s.rooms.generator += 4;              // deep-tension: a generator makes 21: the beds need the power
        const beds = tickDay(JSON.parse(JSON.stringify(s))).capacity;
        expect(beds - s.humans).toBeGreaterThan(100);
        const day1 = tickDay(s).born;
        expect(day1).toBeLessThanOrEqual((beds - 400) * BED_FILL + 1e-9);
        let d = 1;
        while (s.humans < beds * 0.95 && d < 400) { tickDay(s); d++; }
        expect(d).toBeGreaterThan(14);
    });

    test('a party is a share of the colony, never fewer than four', () => {
        expect(scoutParty(10)).toBe(4);
        expect(scoutParty(120)).toBe(6);
        expect(scoutParty(1e6)).toBe(60);
    });

    test('awake hands clear a dark chamber after some days of work', () => {
        const s = automated();
        const slots = ['mine', 'farm', 'generator', 'dorm'];
        darkenChamber(s, slots, () => 0);
        for (let i = 0; i < REPAIR_DAYS - 1; i++) expect(repairTick(s, slots, 10)).toBe(-1);
        expect(repairTick(s, slots, 0)).toBe(-1);             // nobody free, no progress
        expect(repairTick(s, slots, 10)).toBe(0);
        expect(s.darkSlots).toEqual([]);
        expect(s.dark.mine).toBe(0);
    });
});

describe('the goal on screen, and the stores behind the bars', () => {
    test('the ring follows the healing curve from the first day, with the year under it', () => {
        const s = initialDeepState();
        expect(estimateNow(s).mean).toBeCloseTo(surface(s.doom0, 0), 9);
        expect(estimateNow(s).spread).toBe(40);
        expect(habitableYear(s)).toBe(END_YEAR);
        s.est = { bias: 5, spread: 10 };             // gloomier than the truth: later
        expect(habitableYear(s)).toBeGreaterThan(END_YEAR);
        expect(DESCENT_LINE).toBe('The surface will heal. Not in our lifetimes. We dig, we build, we sleep.');
    });

    test('each bar is a store on its own scale, with what comes in and what goes out', () => {
        const s = automated();
        const r = tickDay(cloneState(s));
        const st = stocks(s, r, 52000);
        expect(st.M.frac).toBeCloseTo(0.5, 6);             // half the next thing ore buys
        expect(st.F.value).toBeCloseTo(9000 / 16, 6);      // days of eating in store
        expect(st.F.frac).toBe(1);                         // more than a year: full
        expect(st.E.frac).toBeCloseTo(r.energySpare / r.energyMade, 9);
        for (const c of ['M', 'F', 'E', 'H']) { expect(st[c].frac).toBeGreaterThanOrEqual(0); expect(st[c].frac).toBeLessThanOrEqual(1); }
        const fl = flows(s, r);
        expect(fl.M).toEqual({ in: r.minerals, out: r.fuel });
        expect(fl.F.in).toBe(r.food);
    });

    test('an unaffordable price says how long it is at today\'s flow, or what else it needs (B064)', () => {
        expect(affordText({ price: 100, have: 40, perDay: 6 })).toBe('Affordable in 10 days.');
        expect(affordText({ price: 1e6, have: 0, perDay: 1000 })).toBe('Affordable in 3 years.');
        expect(affordText({ price: 100, have: 40, perDay: 0 })).toBe("Not affordable at today's flow.");
        expect(affordText({ price: 1e16, have: 0, perDay: 3e4 })).toBe("More than a thousand years away at today's flow.");
        expect(affordText({ price: 100, have: 400, perDay: 6 })).toBe('');
        expect(affordText({ price: 100, have: 400, blocked: 'chamber' })).toBe('Dig a chamber first.');
        expect(span(1)).toBe('1 day');
        expect(span(3650000)).toBe('10 000 years');
    });

    test('every purchase ends with what it does for the goal, from a dry run (B060)', () => {
        // automating the last manual room is what lets the colony sleep
        const s = automated();
        s.auto.farm = 0;
        const r = tickDay(cloneState(s));
        const said = consequence(s, 'auto', 'farm', { price: 6e4, currency: 'stars', tierDays: 30, report: r });
        expect(said).toMatch(/^Lets the colony sleep .* more .* without an alarm\.$/);
        // a level in a colony that already sleeps safely is read in stars toward the next tier
        const t = automated();
        t.stars = levelCost('mine', 1) * 2;
        const tr = tickDay(cloneState(t));
        const lv = consequence(t, 'level', tr.weakest === 'M' ? 'mine' : { F: 'farm', E: 'generator', H: 'dorm' }[tr.weakest],
            { price: 1, currency: 'stars', tierDays: 30, report: tr, goal: 'Cryo II' });
        expect(lv).toMatch(/stars a day|No change|More beds/);
    });
});

describe('an old save keeps its colony (never delete saves)', () => {
    test('a v1 save becomes a v2 save: the belief moves onto the curve, parties get their people', () => {
        const old = initialDeepState();
        old.day = 1000;
        old.est = { mean: 40, spread: 40 }; old.estRevealed = false;
        old.probes = [{ sentDay: 900, dueDay: 1200 }];
        const raw = JSON.stringify({ schemaVersion: 1, state: old, layout: { slots: ['farm', 'generator', 'dorm'] } });
        const back = deserializeDeep(raw);
        expect(back.state.est.bias).toBe(0);
        expect(back.state.est.spread).toBe(40);
        expect(back.state.probes[0].people).toBe(0);
        expect(back.state.day).toBe(1000);
        // a colony that had read the sky keeps what it believed that day
        const read = { ...old, est: { mean: 60, spread: 12 }, estRevealed: true };
        const b2 = deserializeDeep(JSON.stringify({ schemaVersion: 1, state: read, layout: { slots: [] } }));
        expect(estimateNow(b2.state).mean).toBeCloseTo(60, 9);
        expect(b2.state.est.spread).toBe(12);
        // and a new save round-trips as it is
        expect(JSON.parse(serializeDeep(back.state, back.layout)).schemaVersion).toBe(SCHEMA_VERSION);
    });
});
