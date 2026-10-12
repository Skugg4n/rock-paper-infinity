/**
 * Which acts the player has reached, ever. One save, but the start screen's list never forgets:
 * a set under REACHED_KEY, kept through New game and every checkpoint (KEEP_KEYS). The chapter
 * cards mark I, II, III, V and VI by their numeral; the interim marks the chapter IV chosen
 * (drone or vault). Pure: no DOM; storage is anything with getItem/setItem.
 */
import { REACHED_KEY, PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS } from './constants.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

export { REACHED_KEY };
export const ACT_IDS = ['trivial', 'capital', 'war', 'drone', 'vault', 'unity', 'infinity'];
/** The numeral on a chapter card → the act it opens. IV is the interim's to mark. */
export const ACT_OF_ROMAN = { I: 'trivial', II: 'capital', III: 'war', V: 'unity', VI: 'infinity' };

function defaultStorage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
function get(storage, k) { try { return storage?.getItem(k) ?? null; } catch { return null; } }
function write(storage, set) {
    try { storage?.setItem(REACHED_KEY, JSON.stringify(ACT_IDS.filter((a) => set.has(a)))); } catch { /* full or absent */ }
}

/** The acts reached, in the acts' order. */
export function reachedSet(storage = defaultStorage()) {
    try {
        const arr = JSON.parse(get(storage, REACHED_KEY) || '[]');
        return new Set(Array.isArray(arr) ? ACT_IDS.filter((a) => arr.includes(a)) : []);
    } catch { return new Set(); }
}

/** Adds one act. Unknown ids are ignored. */
export function markReached(id, storage = defaultStorage()) {
    const set = reachedSet(storage);
    if (!ACT_IDS.includes(id) || set.has(id)) return set;
    set.add(id);
    write(storage, set);
    return set;
}

/** From the saves an older game left: run once, when there is no REACHED_KEY yet. */
export function migrateReached(storage = defaultStorage()) {
    if (!storage || get(storage, REACHED_KEY) !== null) return reachedSet(storage);
    const set = new Set();
    if (get(storage, PHASE1_CONSTANTS.SAVE_KEY)) set.add('trivial');
    const city = get(storage, PHASE2_CONSTANTS.SAVE_KEY);
    if (city) {
        set.add('capital');
        let c = null;
        try { c = JSON.parse(city); } catch { /* an old save that is not JSON */ }
        if (c && (c.war || c.interimPending || c.interimChosen)) set.add('war');
    }
    if (get(storage, 'rpi-deep-dig')) set.add('drone');
    if (get(storage, 'rpi-deep-vault')) set.add('vault');
    if (get(storage, 'rpi-unity')) set.add('unity');
    const phase = get(storage, PHASE_KEY);
    if (phase === 'DEEP') {
        const v = get(storage, DEEP_VERSION_KEY);
        if (v === 'dig') set.add('drone');
        if (v === 'vault') set.add('vault');
        set.add('war');   // the colony too: you came through the war
    }
    if (phase === 'UNITY') set.add('unity');
    // everything below a reached act was reached on the way
    if (set.has('unity')) { set.add('war'); }
    if (set.has('drone') || set.has('vault') || set.has('war')) { set.add('war'); set.add('capital'); }
    if (set.has('capital')) set.add('trivial');
    write(storage, set);
    return reachedSet(storage);
}
