export const SCHEMA_VERSION = 1;

// Migration map: keyed by the version being migrated FROM.
// Each function takes the parsed state and returns an updated state.
// Add entries here when SCHEMA_VERSION is bumped:
//   1: (state) => ({ ...state, newField: defaultValue }),
const MIGRATIONS = {
    // placeholder: no migrations needed yet for v1 → v2
};

/**
 * Runs all pending schema migrations on a parsed Phase 2 save object.
 * Stamps `schemaVersion` to the current version on return.
 *
 * @param {object} parsed - Parsed (but possibly stale) save object
 * @returns {object} Migrated save object with `schemaVersion` set
 */
export function migrate(parsed) {
    let version = parsed.schemaVersion ?? 1;
    while (version < SCHEMA_VERSION && MIGRATIONS[version]) {
        parsed = MIGRATIONS[version](parsed);
        version++;
    }
    parsed.schemaVersion = SCHEMA_VERSION;
    return parsed;
}

/**
 * Serializes the full Phase 2 game state into a JSON string.
 *
 * @param {object} state - Full gameState object from init()
 * @returns {string} JSON string ready for localStorage
 */
export function serializePhase2(state) {
    return JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        ...state,
    });
}

/**
 * Parses and validates a raw localStorage string into a Phase 2 game state object.
 * Runs schema migrations and returns null for invalid/corrupt input.
 *
 * @param {string | null} raw - Raw string from localStorage (may be null or corrupt)
 * @returns {object | null} Parsed and migrated state, or null on failure
 */
export function deserializePhase2(raw) {
    if (!raw) return null;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (parsed == null || typeof parsed !== 'object') return null;
    const version = parsed.schemaVersion ?? 1;
    if (version > SCHEMA_VERSION) return null;
    return migrate(parsed);
}

/**
 * Writes a value to localStorage, silently swallowing QuotaExceededError.
 *
 * @param {string} key - localStorage key
 * @param {string} value - Serialized value to store
 * @returns {boolean} true on success, false if the write failed
 */
export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn('persistence(phase2): setItem failed', e?.name ?? e);
        return false;
    }
}

/**
 * Loads and deserializes the Phase 2 game state from localStorage.
 *
 * @param {string} key - localStorage key to read
 * @returns {object | null} Parsed game state, or null if absent or corrupt
 */
export function loadFromStorage(key) {
    let raw;
    try {
        raw = localStorage.getItem(key);
    } catch {
        return null;
    }
    return deserializePhase2(raw);
}
