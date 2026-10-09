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
const PASS3 = process.argv.includes('--pass3') || process.argv.includes('--step2') || process.argv.includes('--step3');
const SHOTS = path.join(ROOT, PASS3 ? 'docs/playtests/dig-pass3' : 'docs/playtests/dig-shots');
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
        const st = await ev(`(() => { const s = window.rpiDig?.state; if (!s) return null; const vis = [...document.querySelectorAll('[data-show]')].filter((e) => !e.hidden).map((e) => e.dataset.show); return { x: s.x, y: s.y, depth: document.getElementById('dig-depth')?.textContent, power: document.getElementById('dig-power')?.textContent, cargo: s.cargo.length, parts: s.parts, crt: document.getElementById('dig-crt')?.textContent.slice(-90), stop: s.tut?.stop?.id || null, shown: vis.join(','), rows: s.tut?.rows.join(','), shop: !document.querySelector('.dig-shop').hidden, ended: s.ended }; })()`);
        console.log(`[${name}]`, JSON.stringify(st));
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const jump = async (cp) => {
        await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?debug` });
        await sleep(1200);
        await ev(`localStorage.setItem('rpi-audio', JSON.stringify(${process.argv.includes('--sound') ? '{ sfx: true, music: true }' : '{ sfx: false, music: false }'})); true`);
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
    const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: VK[k] || 13 }); await sleep(60); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: VK[k] || 13 }); };
    const st = (expr) => ev(`(() => { const s = window.rpiDig.state; return ${expr}; })()`);
    if (PASS3 && !process.argv.includes('--step2')) {
        // pass 3, step by step as a new player: the arrival, the first stop, the first dive, home, the warehouse, the workshop
        await jump('iv-dig-start');
        await sleep(600);
        await shot('p3-01-crt-fades-in');
        await sleep(4000);
        await shot('p3-02-typing');
        for (let i = 0; i < 30 && (await st('s.tut.stop && s.tut.stop.id')) === 'arrive'; i++) await sleep(500);
        await sleep(400);
        await shot('p3-03-stop-dig');
        await hold('ArrowLeft', 400);
        console.log('left at the start moves?', await st('s.x'));
        await key('ArrowDown');
        await hold('ArrowDown', 700);
        await sleep(300);
        await shot('p3-04-stop-power');
        await key('ArrowDown');
        // dig down a little, look for ore sideways
        await hold('ArrowDown', 2500);
        await shot('p3-05-first-dive');
        for (let k = 0; k < 6 && !(await st('s.cargo.length')); k++) { await hold(k % 2 ? 'ArrowLeft' : 'ArrowRight', 500); await hold('ArrowDown', 500); }
        await shot('p3-06-ore');
        // home: the autopilot's way
        await ev(`import('/src/phase4d/autopilot.js').then((m) => { window.__pilot = m; return true; })`);
        for (let i = 0; i < 200 && !(await st('s.y === -1')); i++) {
            const d = await st('(window.__pilot.wayHome(s) || {}).dir');
            if (!d) break;
            await hold({ left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }[d], 120);
        }
        await sleep(800);
        await shot('p3-07-home-with-cargo');
        await hold('ArrowLeft', 500);
        await sleep(1500);
        await shot('p3-08-warehouse');
        await hold('ArrowRight', 900);
        await sleep(600);
        await shot('p3-09-workshop');
        const b = await ev(`(() => { const e = [...document.querySelectorAll('.dig-buy')].find((x) => !x.disabled && !x.hidden); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }; })()`);
        if (b) { await click(b.x, b.y); await sleep(400); }
        await shot('p3-10-bought');
        await hold('ArrowDown', 1500);
        await shot('p3-11-down-again');
        for (const [cp, name] of [['iv-dig-war', 'p3-12-war'], ['iv-dig-machine', 'p3-13-machine']]) {
            await jump(cp);
            await hold('ArrowDown', 1200);
            await shot(name);
        }
        const t0 = await ev('performance.now()');
        await sleep(2000);
        const fps = await ev(`new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); })`);
        console.log('rAF per second', fps, t0 > 0);
    }
    if (process.argv.includes('--step2')) {
        // step 2: a chamber failing at home, the repair; the GPS ping, the ruler, the radio's alarm, the homing line
        await jump('iv-dig-alarm');
        await sleep(800);
        await shot('p3-20-failing-stop');
        await key('Enter');
        await sleep(300);
        await shot('p3-21-failing-arrow');
        const spot = await ev(`import('/src/phase4d/alarms.js').then((m) => m.spotOf('c2'))`);
        for (let i = 0; i < 12 && (await st('s.x')) !== spot; i++) await hold((await st('s.x')) < spot ? 'ArrowRight' : 'ArrowLeft', 140);
        await sleep(900);
        await shot('p3-22-repairing');
        await sleep(2000);
        await shot('p3-23-repaired');
        await jump('iv-dig-machine');
        await hold('ArrowDown', 900);
        await key('g');
        await sleep(900);
        await shot('p3-24-ping');
        await ev(`(() => { const s = window.rpiDig.state; s.alarms.list.push({ id: 'c2', at: s.time, until: s.time + 40 }); return true; })()`);
        await sleep(600);
        await shot('p3-25-radio-alarm');
        await ev(`(() => { const s = window.rpiDig.state; s.battery = 60; return true; })()`);
        await hold('ArrowLeft', 900);
        await sleep(500);
        await shot('p3-26-homing-line');
    }
    if (!process.argv.includes('--long') && !PASS3 && !process.argv.includes('--step2')) {
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
    // the ☰ item and a clean teardown
    const menu = await ev(`(document.getElementById('deep-version-toggle') || {}).textContent || null`);
    const td0 = await ev(`import('/src/gamePhase.js').then(async (m) => { await m.setPhase('INDUSTRY'); await new Promise((r) => setTimeout(r, 300));
        return { root: !!document.getElementById('dig-root'), pilot: !!window.rpiDig, item: !!document.getElementById('deep-version-toggle'), cls: document.getElementById('phase-deep').className }; })`);
    console.log('menu item:', menu, '| after leaving IV:', JSON.stringify(td0));
    for (const [cp, name] of [['iv-dig-war', '07-war'], ['iv-dig-machine', '08-machine'], ['iv-dig-flesh', '09-flesh']]) {
        await jump(cp);
        await hold('ArrowDown', 1500);
        await hold('ArrowLeft', 1500);
        await shot(name);
    }
    await jump('iv-dig-heart');
    await shot('10-heart-near');
    await hold('ArrowDown', 4200);          // the heart's wall takes four beats
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
