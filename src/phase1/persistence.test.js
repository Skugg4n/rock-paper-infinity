/* eslint-env jest */
import { jest } from '@jest/globals';
import {
    serializeGameState,
    deserializeGameState,
    saveToStorage,
    loadFromStorage,
    SCHEMA_VERSION,
} from './persistence.js';

describe('persistence', () => {
    describe('serializeGameState', () => {
        test('serializes state and upgrade levels/purchased flags', () => {
            const state = {
                starBalance: 100,
                totalStarsEarned: 500,
                totalGamesPlayed: 200,
                totalWins: 80,
                energy: 50,
                reserveEnergy: 300,
                gameSpeed: 5,
                starMultiplier: 1.5,
                quantumFoam: 100,
                isMetaBoardActive: false,
                autoPlayWantsToRun: true,
                gameBoardsCount: 3
            };
            const upgrades = {
                speed: { level: 4, purchased: undefined },
                autoPlay: { level: undefined, purchased: true },
                luck: { level: undefined, purchased: false }
            };

            const json = serializeGameState(state, upgrades);
            const data = JSON.parse(json);

            expect(data.starBalance).toBe(100);
            expect(data.totalStarsEarned).toBe(500);
            expect(data.totalGamesPlayed).toBe(200);
            expect(data.totalWins).toBe(80);
            expect(data.energy).toBe(50);
            expect(data.reserveEnergy).toBe(300);
            expect(data.gameSpeed).toBe(5);
            expect(data.starMultiplier).toBe(1.5);
            expect(data.quantumFoam).toBe(100);
            expect(data.isMetaBoardActive).toBe(false);
            expect(data.autoPlayWantsToRun).toBe(true);
            expect(data.gameBoards).toBe(3);
            expect(data.upgrades.speed).toEqual({ level: 4, purchased: undefined });
            expect(data.upgrades.autoPlay).toEqual({ level: undefined, purchased: true });
            expect(data.upgrades.luck).toEqual({ level: undefined, purchased: false });
        });

        test('returns valid JSON string', () => {
            const state = {
                starBalance: 0, totalStarsEarned: 0, totalGamesPlayed: 0,
                totalWins: 0, energy: 100, reserveEnergy: 0, gameSpeed: 1,
                starMultiplier: 1, quantumFoam: 0, isMetaBoardActive: false,
                autoPlayWantsToRun: false, gameBoardsCount: 1
            };
            const json = serializeGameState(state, {});
            expect(() => JSON.parse(json)).not.toThrow();
        });
    });

    describe('deserializeGameState', () => {
        test('returns parsed object from valid JSON', () => {
            const data = { starBalance: 42, energy: 100 };
            const result = deserializeGameState(JSON.stringify(data));
            expect(result).toEqual(data);
        });

        test('returns null for null input', () => {
            expect(deserializeGameState(null)).toBeNull();
        });

        test('returns null for undefined input', () => {
            expect(deserializeGameState(undefined)).toBeNull();
        });

        test('returns null for invalid JSON', () => {
            expect(deserializeGameState('not json')).toBeNull();
            expect(deserializeGameState('{broken')).toBeNull();
        });

        test('returns null for empty string', () => {
            expect(deserializeGameState('')).toBeNull();
        });

        test('roundtrips with serializeGameState', () => {
            const state = {
                starBalance: 999, totalStarsEarned: 2000, totalGamesPlayed: 500,
                totalWins: 200, energy: 75, reserveEnergy: 100, gameSpeed: 3,
                starMultiplier: 10, quantumFoam: 500, isMetaBoardActive: true,
                autoPlayWantsToRun: true, gameBoardsCount: 5
            };
            const upgrades = {
                speed: { level: 10, purchased: undefined },
                autoPlay: { level: undefined, purchased: true }
            };
            const json = serializeGameState(state, upgrades);
            const result = deserializeGameState(json);
            expect(result.starBalance).toBe(999);
            expect(result.isMetaBoardActive).toBe(true);
            expect(result.upgrades.speed.level).toBe(10);
        });
    });
});

describe('schema versioning', () => {
    test('serialized state includes schemaVersion', () => {
        const state = {
            starBalance: 0, totalStarsEarned: 0, totalGamesPlayed: 0, totalWins: 0,
            energy: 100, reserveEnergy: 0, gameSpeed: 1, starMultiplier: 1,
            quantumFoam: 0, isMetaBoardActive: false, autoPlayWantsToRun: false,
            gameBoardsCount: 1,
        };
        const json = serializeGameState(state, {});
        const parsed = JSON.parse(json);
        expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    });

    test('save with no schemaVersion (legacy) is treated as v1', () => {
        const legacy = JSON.stringify({ starBalance: 42, upgrades: {} });
        const result = deserializeGameState(legacy);
        expect(result).not.toBeNull();
        expect(result.starBalance).toBe(42);
    });

    test('save with higher schemaVersion than known returns null', () => {
        const future = JSON.stringify({ schemaVersion: 999, starBalance: 1 });
        const result = deserializeGameState(future);
        expect(result).toBeNull();
    });
});

describe('storage wrappers', () => {
    let storage;
    beforeEach(() => {
        storage = {};
        global.localStorage = {
            getItem: (k) => storage[k] ?? null,
            setItem: (k, v) => { storage[k] = v; },
            removeItem: (k) => { delete storage[k]; },
        };
    });
    afterEach(() => { delete global.localStorage; });

    test('saveToStorage returns true on success', () => {
        expect(saveToStorage('test-key', '{"a":1}')).toBe(true);
        expect(storage['test-key']).toBe('{"a":1}');
    });

    test('saveToStorage returns false on QuotaExceededError, does not throw', () => {
        global.localStorage.setItem = () => {
            const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err;
        };
        expect(() => saveToStorage('test-key', '{}')).not.toThrow();
        expect(saveToStorage('test-key', '{}')).toBe(false);
    });

    test('loadFromStorage returns null for corrupt JSON, leaves key alone', () => {
        storage['test-key'] = 'not valid json';
        const result = loadFromStorage('test-key');
        expect(result).toBeNull();
        expect(storage['test-key']).toBe('not valid json');
    });

    test('loadFromStorage returns null for missing key', () => {
        expect(loadFromStorage('nope')).toBeNull();
    });
});
