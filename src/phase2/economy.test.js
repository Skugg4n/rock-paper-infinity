/* eslint-env jest */
import {
    siloFraction, stallCost, harvestAmount, spendHarvestEfficiency, recoverHarvestEfficiency,
    SILO_SECONDS, STALL_SUPPLY,
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
});
