/**
 * Chapter IV · THE DEEP: the save. Same shape as chapter II's: a schema
 * version, the state, and a migration map for the day the state grows a field.
 * The layout travels with it, so the colony is laid out the same way it was
 * left: the rules say how many chambers there are, the layout says where.
 */

import { normalizeLayout } from './layout.js';
import { initialDeepState, surface, DOOM_AT_BOOM, ESTIMATE_START } from './deep.js';
import { initialWatcher, normalizeWatcher } from './watcher.js';
import { normalizeTree } from './tree.js';

export const SCHEMA_VERSION = 6;

// Keyed by the version being migrated FROM. Add entries when SCHEMA_VERSION grows.
const MIGRATIONS = {
    /* v1.43.0: the belief about the surface is the healing curve plus a `bias`, no longer a
       bare mean, and the ring is on screen from the first second. A colony that never had a
       probe back believed nothing, so it starts on the curve; one that had keeps its mean,
       measured against the curve on the day it was saved. Scout parties carry people now;
       the probes already out were sent empty. */
    1: (p) => {
        const st = p.state || {};
        if (st.est && st.est.bias === undefined) {
            const truth = surface(st.doom0 ?? DOOM_AT_BOOM, st.day || 0);
            const spread = st.est.spread ?? ESTIMATE_START.spread;
            st.est = st.estRevealed && Number.isFinite(st.est.mean)
                ? { bias: st.est.mean - truth, spread }
                : { bias: 0, spread };
        }
        st.probes = (st.probes || []).map((q) => ({ people: 0, ...q }));
        p.state = st;
        return p;
    },
    /* v1.46.0: the Watcher. A colony that has slept before this version did so unwatched: its
       Watcher starts fresh (full stability, no years counted) and shows itself at the next sleep. */
    2: (p) => {
        const st = p.state || {};
        st.watcher = normalizeWatcher(st.watcher || initialWatcher());
        p.state = st;
        return p;
    },
    /* v1.49.0: the Watcher's ladder and Surface, the build queue, and the dormitories the Watcher
       takes. Nothing is bought, nobody has come, no dormitory is taken; every order already on the
       books is one that was started (the queue is new), so it keeps its days. */
    3: (p) => {
        const st = p.state || {};
        st.watcher = normalizeWatcher(st.watcher || initialWatcher());
        st.taken = { mine: 0, farm: 0, generator: 0, dorm: 0, ...(st.taken || {}) };
        st.takenSlots = Array.isArray(st.takenSlots) ? st.takenSlots : [];
        p.state = st;
        return p;
    },
    /* v1.50.0: the body. No sector sealed, nothing grown, nobody gone; and a colony that was
       already woken by the sensor at the ring (it can only have stayed down by reloading) is
       counted as woken, so it may sleep on. */
    4: (p) => {
        const st = p.state || {};
        st.watcher = normalizeWatcher(st.watcher || initialWatcher());
        st.ringWoke = !!st.ringWoke;
        p.state = st;
        return p;
    },
    /* deep-tree (step 1 of the tree): the upgrades move into the skill tree. The tree READS every
       level, automation, cryo tier and Watcher step off the fields the colony already keeps
       (tree.js levelOf), so nothing an old save bought is lost or copied: Seam is the mines'
       level, Drill automation their automation, Cryo III the tier, Reactor tap the ladder's step.
       The tree's own memory is new and empty: Surface has opened nothing yet. */
    5: (p) => {
        const st = p.state || {};
        st.watcher = normalizeWatcher(st.watcher || initialWatcher());
        st.tree = normalizeTree(st.tree);
        p.state = st;
        return p;
    },
};

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
    state.watcher = normalizeWatcher(state.watcher);
    state.tree = normalizeTree(state.tree);
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
