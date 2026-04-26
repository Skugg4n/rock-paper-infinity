import { fillFraction } from './rates.js';

// --- fillFraction(balance, upgrade) ---

test('returns 0 when balance is 0', () => {
    expect(fillFraction(0, { cost: 100, level: 0, maxLevel: 10 })).toBe(0);
});

test('returns 0.5 when balance is half of nextCost', () => {
    expect(fillFraction(50, { cost: 100, level: 0, maxLevel: 10 })).toBe(0.5);
});

test('returns 1 when balance equals nextCost', () => {
    expect(fillFraction(100, { cost: 100, level: 0, maxLevel: 10 })).toBe(1);
});

test('returns 1 (clamped) when balance exceeds nextCost', () => {
    expect(fillFraction(9999, { cost: 100, level: 0, maxLevel: 10 })).toBe(1);
});

test('returns 1 when upgrade is at maxLevel (regardless of balance)', () => {
    expect(fillFraction(0, { cost: 100, level: 10, maxLevel: 10 })).toBe(1);
    expect(fillFraction(50, { cost: 100, level: 55, maxLevel: 55 })).toBe(1);
});

test('handles cost as a function', () => {
    const upgrade = { cost: () => 200, level: 0, maxLevel: 5 };
    expect(fillFraction(100, upgrade)).toBe(0.5);
    expect(fillFraction(200, upgrade)).toBe(1);
    expect(fillFraction(0, upgrade)).toBe(0);
});

test('handles upgrade without maxLevel (no level cap)', () => {
    // maxLevel is undefined — should skip the level cap check
    const upgrade = { cost: 50 };
    expect(fillFraction(25, upgrade)).toBe(0.5);
    expect(fillFraction(50, upgrade)).toBe(1);
});

test('handles upgrade with cost function that scales with level', () => {
    // Simulates upgrades.speed: cost = 10 + level * 2
    const upgrade = { level: 3, maxLevel: 55, cost: () => 10 + 3 * 2 };
    expect(fillFraction(8, upgrade)).toBe(0.5);
    expect(fillFraction(16, upgrade)).toBe(1);
    expect(fillFraction(0, upgrade)).toBe(0);
});
