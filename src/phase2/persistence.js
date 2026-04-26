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

export function serializePhase2(state) {
    return JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        ...state,
    });
}

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

export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn('persistence(phase2): setItem failed', e?.name ?? e);
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
    return deserializePhase2(raw);
}
