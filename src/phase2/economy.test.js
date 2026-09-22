/* eslint-env jest */
import {
    siloFraction, stallCost, harvestAmount, spendHarvestEfficiency, recoverHarvestEfficiency,
    SILO_SECONDS, STALL_SUPPLY, formatCount,
} from './economy.js';

describe('phase2 economy', () => {
    test('silo shows seconds of food relative to consumption', () => {
        expect(siloFraction(0, 10)).toBe(0);
        expect(siloFraction(10 * SILO_SECONDS, 10)).toBe(1);
        expect(siloFraction(5 * SILO_SECONDS, 10)).toBeCloseTo(0.5);
        expect(siloFraction(1e9, 10)).toBe(1);
        expect(siloFraction(50, 0)).toBe(1);
    });

    test('stall cost grows geometrically', () => {
        expect(stallCost(0)).toBe(2000);
        expect(stallCost(1)).toBe(2500);
        expect(stallCost(10)).toBeGreaterThan(stallCost(9));
        expect(STALL_SUPPLY).toBeGreaterThan(0);
    });

    test('hand harvest pays two seconds of food and never nothing', () => {
        expect(harvestAmount(30, 1)).toBe(60);
        expect(harvestAmount(0, 1)).toBe(5);
        expect(harvestAmount(30, 0)).toBe(3);
    });

    test('harvest efficiency drops per click and recovers with rest', () => {
        let e = 1;
        for (let i = 0; i < 10; i++) e = spendHarvestEfficiency(e);
        expect(e).toBeLessThan(0.25);
        for (let i = 0; i < 10; i++) e = recoverHarvestEfficiency(e);
        expect(e).toBe(1);
    });

    test('formatCount keeps astronomical numbers readable', () => {
        expect(formatCount(1902143493053)).toBe('1.90 T');
        expect(formatCount(0)).toBe('0');
        expect(formatCount(999.4)).toBe('999');
        expect(formatCount(1234)).toBe('1.23 k');
        expect(formatCount(12345)).toBe('12.3 k');
        expect(formatCount(123456)).toBe('123 k');
        expect(formatCount(999600)).toBe('1.00 M');          // rounding carries into the next suffix
        expect(formatCount(2.5e15)).toBe('2.50 Qa');
        expect(formatCount(-45000)).toBe('-45.0 k');
        expect(formatCount(1e40)).toBe('1.00e40');
    });
});
