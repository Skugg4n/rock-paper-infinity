/* eslint-env jest */
import { initialDeepState, tickDay, sleep, surface, canResurface, roomMultiplier, digCost, CRYO, DAYS_PER_YEAR } from './deep.js';

describe('the deep', () => {
    test('the surface heals only with time: ~350 years from 85 % to 15 %', () => {
        expect(surface(85, 0)).toBe(85);
        expect(surface(85, 340 * DAYS_PER_YEAR)).toBeGreaterThan(15);
        expect(surface(85, 360 * DAYS_PER_YEAR)).toBeLessThan(15);
        const s = initialDeepState(); s.day = 400 * DAYS_PER_YEAR;
        expect(canResurface(s)).toBe(true);
    });
    test('a day: people eat, rooms run when staffed, stars follow the weakest', () => {
        const s = initialDeepState();
        const r = tickDay(s);
        expect(r.food).toBeGreaterThan(0);
        expect(r.minerals).toBe(0);            // no mine yet: minerals is the weakest
        expect(r.weakest).toBe('M');
        expect(r.stars).toBe(0);
        expect(s.food).toBeLessThan(400 + r.food);
    });
    test('asleep: nobody eats, manual rooms stop, automated ones run', () => {
        const s = initialDeepState(); s.rooms.mine = 2; s.auto.mine = 1; s.auto.generator = 1;
        const food0 = s.food, sum = sleep(s, 10);
        expect(s.food).toBe(food0);            // manual farm stopped, nobody ate
        expect(sum.minerals).toBeGreaterThan(0);
        expect(s.humans).toBe(50);
    });
    test('ladders climb', () => {
        expect(roomMultiplier(0, 0)).toBe(1);
        expect(roomMultiplier(1, 1)).toBe(2);
        expect(roomMultiplier(0, 3)).toBe(9);
        expect(roomMultiplier(0, 4)).toBe(900);
        expect(digCost(5)).toBeGreaterThan(digCost(0));
        for (let i = 1; i < CRYO.length; i++) { expect(CRYO[i].days).toBeGreaterThan(CRYO[i - 1].days); expect(CRYO[i].cost).toBeGreaterThan(CRYO[i - 1].cost); }
    });
});
