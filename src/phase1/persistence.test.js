/* eslint-env jest */
import {
    serializeGameState,
    deserializeGameState,
    saveToStorage,
    loadFromStorage,
    SCHEMA_VERSION,
    migrate,
    sanitizeNumber,
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
            // migrate() stamps schemaVersion onto the result
            expect(result.starBalance).toBe(42);
            expect(result.energy).toBe(100);
            expect(result.schemaVersion).toBe(SCHEMA_VERSION);
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

describe('migration scaffold', () => {
    test('migrate returns object with schemaVersion stamped to current', () => {
        const input = { schemaVersion: SCHEMA_VERSION, starBalance: 99 };
        const result = migrate(input);
        expect(result.schemaVersion).toBe(SCHEMA_VERSION);
        expect(result.starBalance).toBe(99);
    });

    test('migrate on legacy save (no schemaVersion) stamps current version', () => {
        const input = { starBalance: 10 };
        const result = migrate(input);
        expect(result.schemaVersion).toBe(SCHEMA_VERSION);
        expect(result.starBalance).toBe(10);
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

describe('sanitizeNumber', () => {
    test('returns the value for finite numbers', () => {
        expect(sanitizeNumber(0)).toBe(0);
        expect(sanitizeNumber(42)).toBe(42);
        expect(sanitizeNumber(-5)).toBe(-5);
        expect(sanitizeNumber(1.5)).toBe(1.5);
    });

    test('returns null for NaN', () => {
        expect(sanitizeNumber(NaN)).toBeNull();
    });

    test('returns null for Infinity', () => {
        expect(sanitizeNumber(Infinity)).toBeNull();
        expect(sanitizeNumber(-Infinity)).toBeNull();
    });

    test('returns null for non-number types', () => {
        expect(sanitizeNumber('42')).toBeNull();
        expect(sanitizeNumber(null)).toBeNull();
        expect(sanitizeNumber(undefined)).toBeNull();
        expect(sanitizeNumber({})).toBeNull();
    });
});

describe('persistence edge cases', () => {
    test('deserializeGameState returns null for empty string ""', () => {
        expect(deserializeGameState('')).toBeNull();
    });

    test('deserializeGameState returns null for whitespace-only string', () => {
        expect(deserializeGameState('   ')).toBeNull();
    });

    test('deserializeGameState returns null for literal "undefined" string', () => {
        // localStorage.getItem() can return "undefined" if someone called
        // localStorage.setItem(key, undefined) — the value is stringified.
        expect(deserializeGameState('undefined')).toBeNull();
    });

    test('deserializeGameState returns null for literal "null" string', () => {
        expect(deserializeGameState('null')).toBeNull();
    });

    test('save with NaN starBalance: sanitizeNumber falls back to default', () => {
        // A corrupted save that somehow has NaN in a numeric field.
        // deserializeGameState still parses it, but the load code should
        // use sanitizeNumber() to reject NaN and fall back to its default.
        const corrupt = JSON.stringify({ schemaVersion: 1, starBalance: NaN, energy: 50 });
        // JSON.stringify converts NaN to null, so what arrives is null — not a number.
        const result = deserializeGameState(corrupt);
        expect(result).not.toBeNull();
        // starBalance would be null (JSON stringifies NaN as null)
        expect(result.starBalance).toBeNull();
        // sanitizeNumber(null) returns null, so callers fall back to default
        expect(sanitizeNumber(result.starBalance)).toBeNull();
    });

    test('save with Infinity: JSON stringifies to null, sanitizeNumber rejects', () => {
        const state = {
            starBalance: Infinity,
            totalStarsEarned: 0, totalGamesPlayed: 0, totalWins: 0,
            energy: 100, reserveEnergy: 0, gameSpeed: 1, starMultiplier: 1,
            quantumFoam: 0, isMetaBoardActive: false, autoPlayWantsToRun: false,
            gameBoardsCount: 1,
        };
        const json = serializeGameState(state, {});
        const result = deserializeGameState(json);
        // JSON.stringify converts Infinity to null
        expect(result.starBalance).toBeNull();
        expect(sanitizeNumber(result.starBalance)).toBeNull();
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
