// Chapter V, UNITY: a playtest driver in headless Chrome (no dependencies; the DevTools
// protocol over Node's own WebSocket, like scripts/accept-iv-cut.mjs). Sound off, muted browser.
//   node scripts/play-vault.mjs <scenario.mjs> [--shots DIR] [--w 1280 --h 800]
// The scenario exports `default async function (h)`; h has jump, click, clickSlot, clickSel, shot,
// wait, ev (evaluate), state(). The server and Chrome are closed at the end, always.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const SHOTS = path.resolve(opt('--shots', path.join(ROOT, 'docs/playtests/unity-shots')));
const W = Number(opt('--w', 1280)), H = Number(opt('--h', 800));
const PORT = 8126;
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
const scenario = (await import(pathToFileURL(path.resolve(argv[0])).href)).default;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rpi-unity-'));
const chrome = spawn(CHROME, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
let code = 0;
try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleepMs(100);
    const devPort = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const page = (await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map(); const errors = [];
    ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
        if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    };
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    const ev = async (expr) => {
        const out = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (out.result?.exceptionDetails) throw new Error(`page: ${out.result.exceptionDetails.exception?.description || expr}`);
        return out.result?.result?.value;
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    const click = async (x, y) => { await mouse('mouseMoved', x, y); await sleepMs(30); await mouse('mousePressed', x, y); await sleepMs(30); await mouse('mouseReleased', x, y); await sleepMs(60); };
    fs.mkdirSync(SHOTS, { recursive: true });
    const h = {
        ev, click, errors,
        wait: sleepMs,
        async jump(cp) {
            await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?debug` });
            await sleepMs(1200);
            await ev(`localStorage.setItem('rpi-audio', JSON.stringify({ sfx: false, music: false })); true`);
            await ev(`import('/src/checkpoints.js').then((m) => { m.jumpTo(${JSON.stringify(cp)}); return true; })`);
            await sleepMs(2000);
            for (let i = 0; i < 40 && !(await ev('!!window.rpiUnity')); i++) await sleepMs(250);
        },
        state: () => ev(`(() => { const s = rpiUnity.state, U = rpiUnity.U, f = U.flows(s); return { t: Math.round(s.t), scale: s.scale, body: U.areaText(s), red: f.red && f.red.word, yellow: f.yellow && f.yellow.word, thought: Math.floor(s.thought), cap: f.cap, auto: !!s.ex.auto, stop: s.tut.stop && s.tut.stop.id, mode: s.mode, at: f.at, eat: +f.eat.toFixed(2), p: +f.p.toFixed(2) }; })()`),
        async clickCell(i) {
            const r = await ev(`(() => { const [x, y] = rpiUnity.view.cellCentre(${i}); const c = document.querySelector('#phase-unity canvas').getBoundingClientRect(); return { x: c.left + x, y: c.top + y }; })()`);
            await click(r.x, r.y);
        },
        async clickSel(sel) {
            const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; })()`);
            if (!r) throw new Error(`not on screen: ${sel}`);
            await click(r.x, r.y);
        },
        async shot(name) {
            const out = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(out.result.data, 'base64'));
            const st = await h.state().catch(() => null);
            const text = await ev(`(() => { const t = (s) => (document.querySelector(s) || {}).innerText || ''; return { crt: t('[data-v="crt"]'), stop: t('[data-v="stop"]'), panel: t('.u-flows'), guide: document.querySelector('.u-guide.gone') ? '' : t('[data-v="guide"]'), cards: [...document.querySelectorAll('.v-card')].map((c) => (c.classList.contains('off') ? '(off) ' : '') + c.innerText.replace(/\\n/g, ' | ')).join(' // ') }; })()`).catch(() => null);
            console.log(`--- ${name}`, JSON.stringify(st), '\n    CRT:', text?.crt?.replace(/\n/g, ' / '), '\n    STOP:', text?.stop?.replace(/\n/g, ' / '), '\n    FLOWS:', text?.panel?.replace(/\n/g, ' / '), '\n    GUIDE:', text?.guide?.replace(/\n/g, ' / '), '\n    CARDS:', text?.cards);
        },
    };
    await scenario(h);
    if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); code = 1; }
} catch (e) {
    console.error(e); code = 1;
} finally {
    try { chrome.kill('SIGTERM'); } catch { /* gone */ }
    server.close();
    await sleepMs(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.exit(code);
