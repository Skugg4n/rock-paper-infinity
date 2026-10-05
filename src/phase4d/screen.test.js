/* eslint-env jest */
// The dig's screen, run in jsdom with a do-nothing canvas: every frame of the act draws without an
// error (the start, a dive with the way home shown, the heart's beats, the ending and the rise).
import { JSDOM } from 'jsdom';
import { preparedState, serialize, SAVE_KEY, HOME_X } from './dig.js';

function noopCtx() {
    const grad = { addColorStop() {} };
    return new Proxy({}, {
        get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => grad : () => {}),
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

async function run(n, t0) {
    let t = t0;
    for (let i = 0; i < n; i++) { const f = frames.shift(); if (!f) break; t += 50; f(t); }
    return t;
}

test('the act draws from the start to the rise without an error', async () => {
    const s = preparedState({ row: 30, levels: { drill: 1 } });
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
    st.y = 397; st.x = HOME_X; st.levels.hull = 3; st.levels.drill = 3; st.grafts = 3; st.battery = 300;
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
