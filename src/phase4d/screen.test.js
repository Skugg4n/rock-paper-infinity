/* eslint-env jest */
// The dig's screen, run in jsdom with a do-nothing canvas: every frame of the act draws without an
// error (the start, a dive with the way home shown, the heart's beats, the ending and the rise).
import { JSDOM } from 'jsdom';
import { preparedState, newState, serialize, SAVE_KEY, HOME_X } from './dig.js';

function noopCtx() {
    const grad = { addColorStop() {} };
    return new Proxy({}, {
        get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => grad : k === 'measureText' ? () => ({ width: 10 }) : () => {}),
        set: (o, k, v) => { o[k] = v; return true; },
    });
}

const frames = [];
beforeAll(() => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    global.AbortController = dom.window.AbortController;
    window.matchMedia = () => ({ matches: false });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    HTMLCanvasElement.prototype.getContext = () => noopCtx();
    global.requestAnimationFrame = (f) => { frames.push(f); return frames.length; };
    global.cancelAnimationFrame = () => {};
    document.body.innerHTML = '<div id="phase-deep" class="phase-container"></div><div id="menu-dropdown"></div>';
});

// a torn-down act's last frame stays in the queue (cancelAnimationFrame does nothing here): drop it
beforeEach(() => { frames.length = 0; });

async function run(n, t0) {
    let t = t0;
    for (let i = 0; i < n; i++) { const f = frames.shift(); if (!f) break; t += 50; f(t); }
    return t;
}

test('a new game shows only the CRT; the gauges wait their turn', async () => {
    localStorage.setItem(SAVE_KEY, serialize(newState(7)));
    const m = await import('./index.js');
    m.init();
    try {
        await run(10, performance.now());
        const shown = [...document.querySelectorAll('[data-show]')].filter((e) => !e.hidden).map((e) => e.dataset.show);
        expect(shown).toEqual([]);
        expect(document.querySelector('.dig-shop').hidden).toBe(true);
        expect(window.rpiDig.state.tut.stop.id).toBe('arrive');
    } finally {
        m.teardown();
    }
});

test('Space and Enter stay in the dig: they never reach the shell (whose Space pauses the game)', async () => {
    const s0 = preparedState({ row: 20, parts: 200 });
    s0.y = -1; s0.x = 13; s0.levels.steering = 0;
    localStorage.setItem(SAVE_KEY, serialize(s0));
    const m = await import('./index.js');
    m.init();
    let leaked = 0;
    const shell = (e) => { if (e.code === 'Space' || e.key === ' ') leaked++; };
    document.addEventListener('keydown', shell);
    try {
        let t = await run(5, performance.now());
        const st = window.rpiDig.state;
        // the workshop with keys: down chooses, Space buys
        const parts = st.parts;
        const sel0 = document.querySelector('.dig-buy.is-sel')?.dataset.row;
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(document.querySelector('.dig-buy.is-sel')?.dataset.row).not.toBe(sel0);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(document.querySelector('.dig-buy.is-sel')?.dataset.row).toBe(sel0);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
        t = await run(3, t);
        expect(leaked).toBe(0);
        expect(st.parts).toBeLessThan(parts);
        expect(document.querySelector('.dig-buy.is-sel')).not.toBeNull();
        // after buying, the drone still drives
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        await run(20, t);
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
        expect(st.x).toBeLessThan(13);
    } finally {
        document.removeEventListener('keydown', shell);
        m.teardown();
    }
});

test('the CRT never says the same line twice in a row', async () => {
    localStorage.setItem(SAVE_KEY, serialize(preparedState({ row: 20 })));
    const m = await import('./index.js');
    m.init();
    try {
        const st = window.rpiDig.state;
        let t = await run(3, performance.now());
        for (let k = 0; k < 3; k++) { st.line = { text: 'It was not there.', at: st.time, n: st.line.n + 1, kind: 'ghost', ttl: 3 }; t = await run(2, t); }
        expect(document.querySelectorAll('#dig-crt .l').length).toBe(1);
    } finally {
        m.teardown();
    }
});

test('the act draws from the start to the rise without an error', async () => {
    const s = preparedState({ row: 30, levels: { drill: 1, warning: 1 } });
    s.y = 30; s.battery = 8;
    localStorage.setItem(SAVE_KEY, serialize(s));
    const m = await import('./index.js');
    m.init();
    try {
    let t = await run(30, performance.now());
    const st = window.rpiDig.state;
    expect(document.getElementById('dig-power').textContent).toMatch(/^\d+ \/ \d+$/);
    expect(st.line.kind).toBe('turnback');
    // to the heart
    st.y = 397; st.x = HOME_X; st.levels.hull = 3; st.levels.drill = 3; st.grafts = 3; st.battery = 300; st.tut.done.warm = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    t = await run(120, t);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
    expect(st.ended).toBe(true);
    expect(document.getElementById('dig-root').classList.contains('dig-ending')).toBe(true);
    t = await run(220, t);
    expect(document.getElementById('dig-rise').hidden).toBe(false);
    window.rpiDig.renderer.rise();
    await run(120, t);
    } finally {
        m.teardown();
    }
    expect(document.getElementById('dig-root')).toBeNull();
});
