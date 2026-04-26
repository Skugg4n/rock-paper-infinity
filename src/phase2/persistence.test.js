import {
    serializePhase2,
    deserializePhase2,
    saveToStorage,
    loadFromStorage,
    SCHEMA_VERSION,
    migrate,
} from './persistence.js';

test('serializePhase2 includes schemaVersion', () => {
    const json = serializePhase2({ population: 100 });
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.population).toBe(100);
});

test('deserializePhase2 treats missing schemaVersion as legacy v1', () => {
    const result = deserializePhase2(JSON.stringify({ population: 50 }));
    expect(result.population).toBe(50);
});

test('deserializePhase2 returns null for higher schemaVersion', () => {
    expect(deserializePhase2(JSON.stringify({ schemaVersion: 999 }))).toBeNull();
});

test('deserializePhase2 returns null for corrupt JSON', () => {
    expect(deserializePhase2('not json')).toBeNull();
});

describe('migration scaffold', () => {
    test('migrate returns parsed object with schemaVersion set to current', () => {
        // Migration policy: if saved version === SCHEMA_VERSION, no-op.
        // MIGRATIONS map is empty for now (no v1→v2 migration needed yet).
        const input = { schemaVersion: SCHEMA_VERSION, population: 42 };
        const result = migrate(input);
        expect(result.schemaVersion).toBe(SCHEMA_VERSION);
        expect(result.population).toBe(42);
    });

    test('migrate on legacy save (no schemaVersion) stamps current version', () => {
        const input = { population: 10 };
        const result = migrate(input);
        expect(result.schemaVersion).toBe(SCHEMA_VERSION);
        expect(result.population).toBe(10);
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

    test('saveToStorage returns false on QuotaExceededError', () => {
        global.localStorage.setItem = () => {
            const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err;
        };
        expect(saveToStorage('k', '{}')).toBe(false);
    });

    test('loadFromStorage returns null for corrupt JSON', () => {
        storage['k'] = 'bad';
        expect(loadFromStorage('k')).toBeNull();
    });
});
