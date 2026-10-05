// Chapter IV, the dig: played in headless Chrome over the DevTools protocol (no dependencies),
// muted, at 1280x800. Real key presses and clicks from each checkpoint; a screenshot at each
// moment into docs/playtests/dig-shots/. Prints what the page says at each one, and any errors.
//   node scripts/play-dig.mjs [--port 8127]
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = path.join(ROOT, 'docs/playtests/dig-shots');
const PORT = 8127;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rpi-dig-'));
const chrome = spawn(CHROME, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,800',
    '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
const errors = [];
try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
    const devPort = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const page = (await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map();
    ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
        if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    };
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
    const VK = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
    const hold = async (k, ms) => {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: VK[k] });
        await sleep(ms);
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: VK[k] });
    };
    const click = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await sleep(60);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };
    fs.mkdirSync(SHOTS, { recursive: true });
    const shot = async (name) => {
        const out = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(out.result.data, 'base64'));
        const st = await ev(`(() => { const s = window.rpiDig?.state; if (!s) return null; return { depth: document.getElementById('dig-depth')?.textContent, power: document.getElementById('dig-power')?.textContent, cargo: document.getElementById('dig-cargo')?.textContent, parts: s.parts, line: document.getElementById('dig-line')?.textContent, levels: s.levels, home: s.y === -1, ended: s.ended }; })()`);
        console.log(`[${name}]`, JSON.stringify(st));
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const jump = async (cp) => {
        await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?debug` });
        await sleep(1200);
        await ev(`localStorage.setItem('rpi-audio', JSON.stringify({ sfx: false, music: false })); true`);
        await ev(`import('/src/checkpoints.js').then((m) => { m.jumpTo(${JSON.stringify(cp)}); return true; })`);
        await sleep(2500);
    };
    if (process.argv.includes('--long')) {
        // a long session from the start: the hand is the autopilot's choice, sent as real key presses
        // and real clicks on the workshop; a screenshot every 30 s
        await jump('iv-dig-start');
        await ev(`import('/src/phase4d/autopilot.js').then((m) => { window.__pilot = m; window.__mem = {}; return true; })`);
        const MIN = Number(process.argv[process.argv.indexOf('--long') + 1]) || 4;
        let held = null, next = 30, t0 = Date.now();
        while ((Date.now() - t0) / 1000 < MIN * 60) {
            const st = await ev(`(() => { const s = window.rpiDig.state; if (s.y === -1 && !s.cargo.length) { const b = [...document.querySelectorAll('.dig-buy')].find((x) => !x.disabled && !x.hidden); if (b) { const r = b.getBoundingClientRect(); return { buy: { x: r.left + 30, y: r.top + 12 } }; } }
                const d = s.act ? (window.__last || null) : window.__pilot.decide({ ...s, events: [] }, window.__mem).dir; window.__last = d; return { dir: d }; })()`);
            if (st.buy) { if (held) { await send('Input.dispatchKeyEvent', { type: 'keyUp', key: held, code: held, windowsVirtualKeyCode: VK[held] }); held = null; } await click(st.buy.x, st.buy.y); await sleep(150); continue; }
            const key = st.dir ? { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }[st.dir] : null;
            if (key !== held) {
                if (held) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: held, code: held, windowsVirtualKeyCode: VK[held] });
                if (key) await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: VK[key] });
                held = key;
            }
            if ((Date.now() - t0) / 1000 >= next) { await shot(`long-${String(next).padStart(3, '0')}s`); next += 30; }
            await sleep(40);
        }
    }
    if (!process.argv.includes('--long')) {
    // 1. the start: dig down, mine sideways, come home, buy
    await jump('iv-dig-start');
    await shot('01-start');
    await hold('ArrowDown', 2500);
    await shot('02-first-dive');
    await hold('ArrowRight', 1200);
    await hold('ArrowLeft', 2400);
    await shot('03-sideways');
    await hold('ArrowRight', 1200);
    await hold('ArrowUp', 3000);
    await sleep(1500);
    await shot('04-home');
    const b = await ev(`(() => { const e = [...document.querySelectorAll('.dig-buy')].find((x) => !x.disabled); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }; })()`);
    if (b) { await click(b.x, b.y); await sleep(300); }
    await shot('05-bought');
    // the mouse: hold below the drone
    const d = await ev(`(() => { const r = window.rpiDig.renderer.screenOf(window.rpiDig.state, window.rpiDig.view()); return r; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d.x, y: d.y + 60 });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: d.x, y: d.y + 60, button: 'left', clickCount: 1 });
    await sleep(2000);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: d.x, y: d.y + 60, button: 'left', clickCount: 1 });
    await shot('06-mouse-dig');
    for (const [cp, name] of [['iv-dig-war', '07-war'], ['iv-dig-machine', '08-machine'], ['iv-dig-flesh', '09-flesh']]) {
        await jump(cp);
        await hold('ArrowDown', 1500);
        await hold('ArrowLeft', 1500);
        await shot(name);
    }
    await jump('iv-dig-heart');
    await shot('10-heart-near');
    await hold('ArrowDown', 400);
    await sleep(1500);
    await shot('11a-pods-empty');
    await sleep(3500);
    await shot('11b-band');
    await sleep(5500);
    await shot('11-woke');
    const rise = await ev(`(() => { const e = document.getElementById('dig-rise'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (rise) { await click(rise.x, rise.y); await sleep(3500); }
    await shot('12-unity');
    console.log('rise button:', !!rise);
    // teardown leaves nothing behind: back to the colony version
    const td = await ev(`import('/src/gamePhase.js').then(async (m) => { localStorage.setItem('rpi-deep-version', 'colony'); return true; })`);
    console.log('teardown check', td);
    }
} finally {
    console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
    try { chrome.kill('SIGTERM'); } catch { /* gone */ }
    server.close();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
