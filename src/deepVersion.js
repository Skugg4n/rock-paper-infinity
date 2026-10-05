/**
 * Which chapter IV is played: 'colony' (the old act, src/phase4), 'vault' (src/phase4v;
 * docs/superpowers/specs/2026-10-05-deep-vault.md) or 'dig' (src/phase4d). `?deep=` in the URL
 * wins; else what is kept under DEEP_VERSION_KEY; else the old act.
 */
export const DEEP_VERSION_KEY = 'rpi-deep-version';
export const DEEP_VERSIONS = ['colony', 'vault', 'dig'];

export function chosenDeep(search, stored) {
    const m = /[?&]deep=(\w+)(?=&|$)/.exec(search || '');
    if (m && DEEP_VERSIONS.includes(m[1])) return m[1];
    return DEEP_VERSIONS.includes(stored) ? stored : 'colony';
}
/** The next one in the ☰ → Debug cycle: colony, vault, dig, colony. */
export const nextDeep = (v) => DEEP_VERSIONS[(DEEP_VERSIONS.indexOf(v) + 1) % DEEP_VERSIONS.length];
export const deepModule = (v) => ({ vault: './phase4v/index.js', dig: './phase4d/index.js' })[v] || './phase4/index.js';

/** The choice as the page has it now. */
export function currentDeep() {
    let stored = null;
    try { stored = localStorage.getItem(DEEP_VERSION_KEY); } catch { /* ignore */ }
    return chosenDeep(typeof location !== 'undefined' ? location.search : '', stored);
}
