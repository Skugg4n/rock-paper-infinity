/* eslint-env jest */
// Chapter V's screen in jsdom (a stub canvas): it builds, bites, buys, the experiments bar and GROW AS
// come with AUTONOMIC EDGE, and it tears down to nothing.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="menu-dropdown"><button id="reset-btn"></button></div></body></html>', { url: 'http://127.0.0.1/', pretendToBeVisual: true });
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
let mod = null;
afterAll(() => { try { mod?.teardown(); } catch { /* gone */ } });
beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = () => ctxStub;
    window.requestAnimationFrame = (f) => { frames.push(f); return frames.length; };
    window.cancelAnimationFrame = () => {};
    globalThis.requestAnimationFrame = window.requestAnimationFrame;
    globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
    globalThis.lucide = { createIcons() {} };
    globalThis.Path2D = class { moveTo() {} lineTo() {} closePath() {} rect() {} };
});
function tick(n = 3) {
    for (let k = 0; k < n; k++) { const f = frames; frames = []; f.forEach((fn) => fn(performance.now())); }
}

describe('the unity screen', () => {
    test('fas 1: the start stop, a bite on the edge, the buys; then GROW AS; teardown leaves nothing', async () => {
        const U = await import('./unity.js');
        const m = await import('./index.js');
        mod = m;
        m.init();
        tick();
        const root = document.getElementById('phase-unity');
        expect(root).toBeTruthy();
        const s = window.rpiUnity.state;
        U.advance(s, 0.1);
        tick();
        expect(root.querySelector('[data-v="stop"]').hidden).toBe(false);
        window.rpiUnity.ok();
        // a bite, as a click on the edge does
        const a0 = U.area(s);
        expect(U.bite(s, U.front(s, 1)[0])).toBeGreaterThanOrEqual(0);
        expect(U.area(s)).toBe(a0 + 1);
        tick();
        expect(root.querySelector('[data-v="buys-box"]').hidden).toBe(false);
        expect(root.querySelector('[data-v="grow-box"]').hidden).toBe(true);
        expect(root.querySelector('[data-v="exbar"]').hidden).toBe(false);
        expect(root.querySelector('.v-card').textContent).toContain('AUTONOMIC EDGE');
        // the first experiment: the buys go, GROW AS comes, the sliders sum to 100
        s.thought = 400;
        window.rpiUnity.buy('auto');
        tick();
        expect(root.querySelector('[data-v="buys-box"]').hidden).toBe(true);
        expect(root.querySelector('[data-v="grow-box"]').hidden).toBe(false);
        const rows = [...root.querySelectorAll('[data-grow]')];
        expect(rows.map((r) => r.dataset.grow)).toEqual(expect.arrayContaining(['skin', 'stomach', 'heart', 'nerve']));
        expect(Object.values(s.grow).reduce((x, y) => x + y, 0)).toBe(100);
        expect(root.querySelector('[data-v="edge-box"]').hidden).toBe(false);
        m.teardown();
        expect(document.getElementById('phase-unity')).toBe(null);
        expect(document.body.classList.contains('in-unity')).toBe(false);
        expect(window.rpiUnity).toBeUndefined();
    });

    test('every checkpoint builds a playable state at its scale', async () => {
        const { UNITY_CHECKPOINTS } = await import('./checkpoints.js');
        const U = await import('./unity.js');
        const want = { 'v-start': 0, 'v-city-done': 0, 'v-land': 1, 'v-continent': 3, 'v-planet': 4 };
        for (const [id, scale] of Object.entries(want)) {
            const s = UNITY_CHECKPOINTS[id]();
            expect(s.scale).toBe(scale);
            expect(U.area(s)).toBeGreaterThan(0);
            const t = U.deserialize(U.serialize(s));
            for (let k = 0; k < 20; k++) U.advance(t, 0.25);
            expect(Number.isFinite(t.thought)).toBe(true);
        }
        // the city almost eaten: the zoom comes within a minute
        const s = UNITY_CHECKPOINTS['v-city-done']();
        for (let k = 0; k < 240 && !s.zoom; k++) { U.advance(s, 0.25); while (s.tut.stop) U.closeStop(s); }
        expect(s.zoom).toBeTruthy();
    });
});
