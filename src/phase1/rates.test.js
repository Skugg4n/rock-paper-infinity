/* eslint-env jest */
import { getSPS, getEPS, getVisibleDots, formatCount } from './rates.js';

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
            const metaSPS = getSPS(1, true, 1, 1);
            const nineBoardSPS = getSPS(1, false, 9, 1);
            expect(metaSPS).toBeCloseTo(nineBoardSPS);
        });

        test('uses hyper speed formula at threshold', () => {
            // At speed >= 10 (HYPER_SPEED_THRESHOLD), formula changes
            const hyperSPS = getSPS(10, false, 1, 1);
            expect(hyperSPS).toBeGreaterThan(0);
            // In hyper mode: gameSpeed * boardMultiplier * (1/3) * starMultiplier
            expect(hyperSPS).toBeCloseTo(10 * 1 * (1 / 3) * 1);
        });

        test('hyper speed scales linearly with game speed', () => {
            const sps10 = getSPS(10, false, 1, 1);
            const sps20 = getSPS(20, false, 1, 1);
            expect(sps20).toBeCloseTo(sps10 * 2);
        });
    });

    describe('getEPS', () => {
        test('equals gameSpeed * boardCount', () => {
            expect(getEPS(5, false, 3)).toBe(15);
        });

        test('uses 9 for meta board', () => {
            expect(getEPS(5, true, 1)).toBe(45);
        });
    });
});
