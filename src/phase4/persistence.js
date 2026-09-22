/**
 * Chapter IV · THE DEEP: the save. Same shape as chapter II's: a schema
 * version, the state, and a migration map for the day the state grows a field.
 * The layout travels with it, so the colony is laid out the same way it was
 * left: the rules say how many chambers there are, the layout says where.
 */

import { normalizeLayout } from './layout.js';
import { initialDeepState } from './deep.js';

export const SCHEMA_VERSION = 1;

// Keyed by the version being migrated FROM. Add entries when SCHEMA_VERSION grows.
const MIGRATIONS = {};

/**
 * @param {object} parsed - a parsed, possibly stale save
 * @returns {object} the same save at the current schema version
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
 * @param {object} state - the deep state
 * @param {object} layout - which chamber holds which room
 * @returns {string} JSON for localStorage
 */
export function serializeDeep(state, layout) {
    return JSON.stringify({ schemaVersion: SCHEMA_VERSION, state, layout });
}

/**
 * Parses a raw save. Returns null for anything it cannot make sense of, so the
 * caller can start a fresh colony rather than crash on a half-written key.
 *
 * @param {string|null} raw
 * @returns {{state:object, layout:object}|null}
 */
export function deserializeDeep(raw) {
    if (!raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (parsed == null || typeof parsed !== 'object') return null;
    if ((parsed.schemaVersion ?? 1) > SCHEMA_VERSION) return null;
    parsed = migrate(parsed);
    if (!parsed.state || typeof parsed.state !== 'object') return null;
    const state = { ...initialDeepState(), ...parsed.state };
    return { state, layout: normalizeLayout(state, parsed.layout) };
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {boolean} false when the browser refused the write
 */
export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn('persistence(phase4): setItem failed', e?.name ?? e);
        return false;
    }
}

/**
 * @param {string} key
 * @returns {{state:object, layout:object}|null}
 */
export function loadFromStorage(key) {
    let raw;
    try { raw = localStorage.getItem(key); } catch { return null; }
    return deserializeDeep(raw);
}
