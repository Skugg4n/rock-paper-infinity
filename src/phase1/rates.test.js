/* eslint-env jest */
import {
    getSPS, getEPS, getGamesPerSecond, roundTiming, updateMeasuredRate, pickOutcome,
    getVisibleDots, formatCount, formatRate, BASE_WIN_RATE, LUCK_WIN_RATE,
} from './rates.js';

describe('rates', () => {
    describe('formatCount', () => {
        test('returns number as-is for small values', () => {
            expect(formatCount(0)).toBe('0');
            expect(formatCount(42)).toBe('42');
            expect(formatCount(9999)).toBe('9,999');
        });

        test('formats thousands with k suffix', () => {
            expect(formatCount(10000)).toBe('10.0k');
            expect(formatCount(15500)).toBe('15.5k');
            expect(formatCount(999999)).toBe('1000.0k');
        });

        test('formats millions with M suffix', () => {
            expect(formatCount(1000000)).toBe('1.0M');
            expect(formatCount(2500000)).toBe('2.5M');
        });

        test('formats billions with B suffix', () => {
            expect(formatCount(1000000000)).toBe('1.0B');
            expect(formatCount(5300000000)).toBe('5.3B');
        });
    });

    describe('formatRate', () => {
        test('one decimal below 100', () => {
            expect(formatRate(0.33)).toBe('0.3');
            expect(formatRate(99.94)).toBe('99.9');
        });
        test('compact above 100', () => {
            expect(formatRate(164.4)).toBe('164');
            expect(formatRate(24600)).toBe('24.6k');
        });
    });

    describe('getVisibleDots', () => {
        test('returns 5 for low star counts', () => {
            expect(getVisibleDots(0)).toBe(5);
            expect(getVisibleDots(4)).toBe(5);
        });

        test('returns 10 at 5 stars', () => {
            expect(getVisibleDots(5)).toBe(10);
            expect(getVisibleDots(9)).toBe(10);
        });

        test('returns 20 at 10 stars', () => {
            expect(getVisibleDots(10)).toBe(20);
            expect(getVisibleDots(29)).toBe(20);
        });

        test('returns 100 at 30+ stars', () => {
            expect(getVisibleDots(30)).toBe(100);
            expect(getVisibleDots(1000)).toBe(100);
        });
    });

    describe('roundTiming', () => {
        test('round length is strictly monotonic in speed (no dead zones)', () => {
            let prev = Infinity;
            for (let s = 1; s <= 9; s++) {
                const { totalMs } = roundTiming(s);
                expect(totalMs).toBeLessThanOrEqual(prev);
                prev = totalMs;
            }
        });

        test('shows 3/2/1 countdown frames as speed rises', () => {
            expect(roundTiming(1).frames).toBe(3);
            expect(roundTiming(5).frames).toBe(3);
            expect(roundTiming(6).frames).toBe(2);
            expect(roundTiming(7).frames).toBe(1);
        });

        test('frames and hold never drop below the perceivable floor', () => {
            expect(roundTiming(9).frameMs).toBe(120);
            expect(roundTiming(9).holdMs).toBe(160);
        });
    });

    describe('getGamesPerSecond', () => {
        test('animated mode follows round timing', () => {
            expect(getGamesPerSecond(1, false, 1)).toBeCloseTo(1000 / 1800);
            expect(getGamesPerSecond(1, false, 2)).toBeCloseTo(2000 / 1800);
        });

        test('bulk mode is speed × boards, and the jump at 10 is upward', () => {
            expect(getGamesPerSecond(10, false, 1)).toBe(10);
            expect(getGamesPerSecond(9, false, 1)).toBeLessThan(10);
        });

        test('factory counts as 9 boards', () => {
            expect(getGamesPerSecond(10, true, 1)).toBe(90);
        });
    });

    describe('getSPS', () => {
        test('returns 0 when speed is 0', () => {
            expect(getSPS(0, false, 1, 1)).toBe(0);
        });

        test('scales with star multiplier', () => {
            const base = getSPS(1, false, 1, 1);
            const doubled = getSPS(1, false, 1, 2);
            expect(doubled).toBeCloseTo(base * 2);
        });

        test('uses 9 as board multiplier when meta board active', () => {
            const metaSPS = getSPS(10, true, 1, 1);
            const nineBoardSPS = getSPS(10, false, 9, 1);
            expect(metaSPS).toBeCloseTo(nineBoardSPS);
        });

        test('uses hyper speed formula at threshold', () => {
            const hyperSPS = getSPS(10, false, 1, 1);
            expect(hyperSPS).toBeCloseTo(10 * 1 * (1 / 3) * 1);
        });

        test('hyper speed scales linearly with game speed', () => {
            const sps10 = getSPS(10, false, 1, 1);
            const sps20 = getSPS(20, false, 1, 1);
            expect(sps20).toBeCloseTo(sps10 * 2);
        });

        test('luck doubles the win rate in bulk mode too', () => {
            expect(getSPS(10, false, 1, 1, LUCK_WIN_RATE)).toBeCloseTo(getSPS(10, false, 1, 1, BASE_WIN_RATE) * 2);
        });
    });

    describe('getEPS', () => {
        test('equals games per second for boards in bulk mode', () => {
            expect(getEPS(15, false, 3)).toBe(45);
        });

        test('factory consumes no energy', () => {
            expect(getEPS(5, true, 1)).toBe(0);
        });
    });

    describe('updateMeasuredRate', () => {
        test('converges toward a steady income', () => {
            let r = 0;
            for (let i = 0; i < 40; i++) r = updateMeasuredRate(r, 3);
            expect(r).toBeCloseTo(3, 1);
        });

        test('decays to zero when income stops', () => {
            let r = 10;
            for (let i = 0; i < 40; i++) r = updateMeasuredRate(r, 0);
            expect(r).toBeLessThan(0.01);
        });

        test('treats NaN/undefined previous as zero', () => {
            expect(updateMeasuredRate(undefined, 5)).toBeCloseTo(1);
            expect(updateMeasuredRate(NaN, 5)).toBeCloseTo(1);
        });
    });

    describe('pickOutcome', () => {
        test('splits evenly without luck', () => {
            expect(pickOutcome(0.1, BASE_WIN_RATE)).toBe('win');
            expect(pickOutcome(0.5, BASE_WIN_RATE)).toBe('draw');
            expect(pickOutcome(0.9, BASE_WIN_RATE)).toBe('lose');
        });

        test('luck makes wins twice as likely', () => {
            expect(pickOutcome(0.6, LUCK_WIN_RATE)).toBe('win');
            expect(pickOutcome(0.75, LUCK_WIN_RATE)).toBe('draw');
            expect(pickOutcome(0.95, LUCK_WIN_RATE)).toBe('lose');
        });
    });
});
