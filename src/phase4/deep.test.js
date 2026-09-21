/* eslint-env jest */
import {
    initialDeepState, tickDay, sleep, surface, canResurface, canAscend, roomMultiplier, upkeepMultiplier,
    digCost, levelCost, automationCost, CRYO, DAYS_PER_YEAR, ROOM, MAX_AUTO, ASCENT, BED_SHARE,
} from './deep.js';

describe('the deep', () => {
    test('the surface heals only with time: ~350 years from 85 % to 15 %', () => {
        expect(surface(85, 0)).toBe(85);
        expect(surface(85, 340 * DAYS_PER_YEAR)).toBeGreaterThan(15);
        expect(surface(85, 360 * DAYS_PER_YEAR)).toBeLessThan(15);
        const s = initialDeepState(); s.day = 400 * DAYS_PER_YEAR;
        expect(canResurface(s)).toBe(true);
    });

    test('a day: the four columns are surpluses, and the weakest is the one to fix', () => {
        const s = initialDeepState();
        const food0 = s.food;
        const r = tickDay(s);
        expect(r.food).toBeGreaterThan(0);
        expect(r.minerals).toBe(0);                      // no mine yet, but the generator burns fuel
        expect(r.parts.M).toBeLessThan(0);
        expect(r.weakest).toBe('M');                     // so minerals is the column with the dot
        expect(r.stars).toBe(0);                         // a column in the red pays nothing
        expect(r.parts.F).toBeCloseTo(r.food - s.humans * 1, 6);
        expect(r.parts.E).toBeCloseTo(r.energyMade - r.energyNeed, 6);
        expect(r.parts.H).toBeGreaterThan(0);            // hands not on duty
        expect(s.food).toBe(food0 + r.food - s.humans);  // grown, minus what was eaten
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
        s.day = 340 * DAYS_PER_YEAR;
        const sum = sleep(s, 100 * DAYS_PER_YEAR);
        expect(sum.wokenEarly).toBe(true);
        expect(sum.days).toBeLessThan(100 * DAYS_PER_YEAR);
        expect(canResurface(s)).toBe(true);
        expect(surface(s.doom0, s.day)).toBeGreaterThan(14);   // barely under 15 %, not a century past it
    });

    test('the way up needs the ring and the means', () => {
        const s = initialDeepState();
        s.day = 400 * DAYS_PER_YEAR;
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
