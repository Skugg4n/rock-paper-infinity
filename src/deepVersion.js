/**
 * Which chapter IV is played: 'colony' (the old act, src/phase4) or 'vault' (the new one,
 * src/phase4v; docs/superpowers/specs/2026-10-05-deep-vault.md). `?deep=vault` or `?deep=colony`
 * in the URL wins; else what is kept under DEEP_VERSION_KEY; else the old act.
 */
export const DEEP_VERSION_KEY = 'rpi-deep-version';
export const DEEP_VERSIONS = ['colony', 'vault'];

export function chosenDeep(search, stored) {
    const m = /[?&]deep=(vault|colony)(?=&|$)/.exec(search || '');
    if (m) return m[1];
    return stored === 'vault' ? 'vault' : 'colony';
}
export const otherDeep = (v) => (v === 'vault' ? 'colony' : 'vault');
export const deepModule = (v) => (v === 'vault' ? './phase4v/index.js' : './phase4/index.js');

/** The choice as the page has it now. */
export function currentDeep() {
    let stored = null;
    try { stored = localStorage.getItem(DEEP_VERSION_KEY); } catch { /* ignore */ }
    return chosenDeep(typeof location !== 'undefined' ? location.search : '', stored);
}
