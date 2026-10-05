/**
 * Which chapter IV runs: 'colony' (src/phase4, the act as it was), 'dig' (src/phase4d, the digging
 * game) or 'vault' (src/phase4v). `?deep=` in the URL wins, then the stored choice, else 'colony'.
 */
export const DEEP_VERSION_KEY = 'rpi-deep-version';
export const DEEP_VERSIONS = ['colony', 'vault', 'dig'];

/** @param {string} search location.search  @param {string|null} stored localStorage value */
export function chosenDeep(search, stored) {
    let q = null;
    try { q = new URLSearchParams(search || '').get('deep'); } catch { /* ignore */ }
    if (DEEP_VERSIONS.includes(q)) return q;
    if (DEEP_VERSIONS.includes(stored)) return stored;
    return 'colony';
}

/** The next one in the ☰ cycle. */
export const nextDeep = (v) => DEEP_VERSIONS[(DEEP_VERSIONS.indexOf(v) + 1) % DEEP_VERSIONS.length];

/** The module path for a version. */
export const deepModule = (v) => (v === 'dig' ? './phase4d/index.js' : v === 'vault' ? './phase4v/index.js' : './phase4/index.js');

/** The URL without ?deep=, so the stored choice decides after a switch. */
export function urlWithoutDeep(href) {
    try { const u = new URL(href); u.searchParams.delete('deep'); return u.toString(); } catch { return href; }
}

/**
 * ☰ → "Deep: colony / vault / dig" while chapter IV is open: a click stores the next one and loads
 * the page again. Returns the button (the caller removes it when IV closes).
 */
export function mountDeepItem(current) {
    document.getElementById('deep-version-toggle')?.remove();
    const menu = document.getElementById('menu-dropdown');
    if (!menu) return null;
    const b = document.createElement('button');
    b.id = 'deep-version-toggle';
    b.type = 'button';
    b.className = 'block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 whitespace-nowrap border-b border-slate-100';
    b.textContent = `Deep · ${current}`;
    b.title = `Switch chapter IV to ${nextDeep(current)}`;
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        try { localStorage.setItem(DEEP_VERSION_KEY, nextDeep(current)); } catch { /* ignore */ }
        const url = urlWithoutDeep(window.location.href);
        if (url === window.location.href) window.location.reload(); else window.location.assign(url);
    });
    const after = document.getElementById('deep-view-toggle');
    menu.insertBefore(b, after ? after.nextSibling : document.getElementById('reset-btn'));
    return b;
}
