/* eslint-env jest */
// The vault's screen in jsdom (a stub canvas): it builds, paints the panel, the info box with its
// night hints, keeps markers apart, and tears down to nothing.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="menu-dropdown"><button id="reset-btn"></button></div></body></html>', { url: 'http://127.0.0.1/?deep=vault', pretendToBeVisual: true });
for (const k of ['window', 'document', 'localStorage', 'HTMLCanvasElement', 'MouseEvent', 'Event', 'getComputedStyle', 'AbortController']) globalThis[k] = k === 'window' ? dom.window : dom.window[k];

const ctxStub = new Proxy({}, {
    get(target, k) {
        if (k in target) return target[k];
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (k === 'measureText') return () => ({ width: 40 });
        return () => {};
    },
    set(target, k, v) { target[k] = v; return true; },
});

let frames = [];
beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = () => ctxStub;
    window.requestAnimationFrame = (f) => { frames.push(f); return frames.length; };
    window.cancelAnimationFrame = () => {};
    globalThis.requestAnimationFrame = window.requestAnimationFrame;
    globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
    globalThis.lucide = { createIcons() {} };
});
function tick(n = 3) {
    for (let k = 0; k < n; k++) { const f = frames; frames = []; f.forEach((fn) => fn(performance.now())); }
}

describe('the vault screen', () => {
    test('builds, shows the night hints and the dark TAKE ONE, and tears down', async () => {
        const { VAULT_CHECKPOINTS } = await import('./checkpoints.js');
        const V = await import('./vault.js');
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        s.fallen = ['Pod'];
        localStorage.setItem(V.SAVE_KEY, V.serialize(s));
        const m = await import('./index.js');
        m.init();
        tick();
        const root = document.getElementById('phase-vault');
        expect(root).toBeTruthy();
        expect(root.querySelector('[data-v="g-body"]').hidden).toBe(false);
        expect(root.querySelector('[data-v="g-mood"]').hidden).toBe(true);     // nobody awake
        const cryo = window.rpiVault.state.rooms.findIndex((r) => r.kind === 'cryo');
        window.rpiVault.select(cryo);
        const info = root.querySelector('[data-v="info"]');
        // G1: two buttons, the one that makes sense (big) and the dark one (small)
        expect(info.querySelectorAll('button.a')).toHaveLength(2);
        expect(info.querySelector('[data-act="take10"]').className).toContain('dark');
        expect(info.textContent).toContain('They feed the others.');
        // TAKE TEN: three wake, the mood gauge comes back, the info box still answers
        info.querySelector('[data-act="take10"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        tick();
        expect(V.awake(window.rpiVault.state)).toBe(3);
        expect(root.querySelector('[data-v="g-mood"]').hidden).toBe(false);
        expect(root.querySelector('[data-v="r-here"] .dymo').textContent).toBe('In the body');
        m.teardown();
        expect(document.getElementById('phase-vault')).toBe(null);
        expect(document.body.classList.contains('in-vault')).toBe(false);
        expect(window.rpiVault).toBeUndefined();
    });
});
