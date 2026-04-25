export const SCHEMA_VERSION = 1;

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
    return parsed;
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
