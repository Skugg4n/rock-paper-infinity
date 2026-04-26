export const SCHEMA_VERSION = 1;

// Migration map: keyed by the version being migrated FROM.
// Each function takes the parsed state and returns an updated state.
// Add entries here when SCHEMA_VERSION is bumped:
//   1: (state) => ({ ...state, newField: defaultValue }),
const MIGRATIONS = {
    // placeholder: no migrations needed yet for v1 → v2
};

export function migrate(parsed) {
    let version = parsed.schemaVersion ?? 1;
    while (version < SCHEMA_VERSION && MIGRATIONS[version]) {
        parsed = MIGRATIONS[version](parsed);
        version++;
    }
    parsed.schemaVersion = SCHEMA_VERSION;
    return parsed;
}

export function serializeGameState(state, upgrades) {
    const data = {
        schemaVersion: SCHEMA_VERSION,
        starBalance: state.starBalance,
        totalStarsEarned: state.totalStarsEarned,
        totalGamesPlayed: state.totalGamesPlayed,
        totalWins: state.totalWins,
        energy: state.energy,
        reserveEnergy: state.reserveEnergy,
        gameSpeed: state.gameSpeed,
        starMultiplier: state.starMultiplier,
        quantumFoam: state.quantumFoam,
        isMetaBoardActive: state.isMetaBoardActive,
        autoPlayWantsToRun: state.autoPlayWantsToRun,
        gameBoards: state.gameBoardsCount,
        upgrades: {},
    };
    for (const key in upgrades) {
        const u = upgrades[key];
        data.upgrades[key] = { level: u.level, purchased: u.purchased };
    }
    return JSON.stringify(data);
}

/**
 * Sanitizes a numeric value from a save: returns the value if it is a finite
 * number, otherwise returns null so callers can fall back to a default.
 * Guards against NaN and Infinity that can appear in corrupted saves.
 */
export function sanitizeNumber(value) {
    if (typeof value !== 'number') return null;
    if (!isFinite(value)) return null;
    return value;
}

export function deserializeGameState(raw) {
    if (!raw) return null;
    if (typeof raw === 'string' && raw.trim() === '') return null;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (parsed == null || typeof parsed !== 'object') return null;
    const version = parsed.schemaVersion ?? 1; // missing = legacy v1
    if (version > SCHEMA_VERSION) return null;
    return migrate(parsed);
}

export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn('persistence: setItem failed', e?.name ?? e);
        return false;
    }
}

export function loadFromStorage(key) {
    let raw;
    try {
        raw = localStorage.getItem(key);
    } catch {
        return null;
    }
    return deserializeGameState(raw);
}
