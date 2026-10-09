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
const PASS3 = ['--pass3', '--step2', '--step3', '--nosteer', '--hazards', '--v1923', '--v1924', '--v1926', '--v1927', '--v1928'].some((a) => process.argv.includes(a));
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
    const key0 = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k === 'Enter' ? 'Enter' : k, windowsVirtualKeyCode: VK[k] || 13 }); await sleep(60); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k === 'Enter' ? 'Enter' : k, windowsVirtualKeyCode: VK[k] || 13 }); };
    if (process.argv.includes('--long')) {
        // a long session from the start: the hand is the autopilot's choice, sent as real key presses
        // and real clicks on the workshop; a screenshot every 30 s
        await jump('iv-dig-start');
        await ev(`import('/src/phase4d/autopilot.js').then((m) => { window.__pilot = m; window.__mem = {}; return true; })`);
        const MIN = Number(process.argv[process.argv.indexOf('--long') + 1]) || 4;
        let held = null, next = 30, t0 = Date.now();
        const window0 = { last: null, hist: [] };
        while ((Date.now() - t0) / 1000 < MIN * 60) {
            const st = await ev(`(() => { const s = window.rpiDig.state; if (s.tut && s.tut.stop) return { stop: s.tut.stop.crt ? 'crt' : s.tut.stop.id };
                if (s.y === -1 && !s.cargo.length) { const b = [...document.querySelectorAll('.dig-buy')].find((x) => !x.disabled && !x.hidden && !(${process.argv.includes('--nosteer')} && x.dataset.row === 'steering')); if (b) { const r = b.getBoundingClientRect(); return { buy: { x: r.left + 30, y: r.top + 12 } }; } }
                const d = s.act ? (window.__last || null) : window.__pilot.decide({ ...s, events: [] }, window.__mem).dir; window.__last = d; return { dir: d, free: !s.act && !s.commit, snap: { x: s.x, y: s.y, b: Math.round(s.battery * 10) / 10, deaths: s.deaths, going: window.__mem.going, line: s.line.text, cargo: s.cargo.length } }; })()`);
            if (st.snap) { if (window0.last && st.snap.deaths > window0.last.deaths) console.log('DIED after', JSON.stringify(window0.hist.slice(-12))); window0.last = st.snap; window0.hist.push([st.dir, st.snap.x, st.snap.y, st.snap.b, st.snap.going]); if (window0.hist.length > 60) window0.hist.shift(); }
            if (st.stop) { if (held) { await send('Input.dispatchKeyEvent', { type: 'keyUp', key: held, code: held, windowsVirtualKeyCode: VK[held] }); held = null; } if (st.stop !== 'crt') { await sleep(1200); await key0('Enter'); } else await sleep(300); continue; }
            if (st.buy) { if (held) { await send('Input.dispatchKeyEvent', { type: 'keyUp', key: held, code: held, windowsVirtualKeyCode: VK[held] }); held = null; } await click(st.buy.x, st.buy.y); await sleep(150); continue; }
            const key = st.dir ? { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }[st.dir] : null;
            if (process.argv.includes('--tap')) {
                // a player who taps: one press a decision (sideways that is two steps with STEERING I)
                if (key && st.free) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: VK[key] }); await sleep(30); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: VK[key] }); }
            } else if (key !== held) {
                if (held) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: held, code: held, windowsVirtualKeyCode: VK[held] });
                if (key) await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: VK[key] });
                held = key;
            }
            if ((Date.now() - t0) / 1000 >= next) { await shot(`long-${String(next).padStart(3, '0')}s`); next += 30; console.log('deaths', await ev('window.rpiDig.state.deaths'), 'steering', await ev('window.rpiDig.state.levels.steering')); }
            await sleep(40);
        }
    }
    const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: VK[k] || 13 }); await sleep(60); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: VK[k] || 13 }); };
    const st = (expr) => ev(`(() => { const s = window.rpiDig.state; return ${expr}; })()`);
    if (PASS3 && !['--step2', '--step3', '--long', '--hazards', '--v1923', '--v1924', '--v1926', '--v1927', '--v1928'].some((a) => process.argv.includes(a))) {
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
        await hold('ArrowLeft', 400);
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
    if (process.argv.includes('--step3')) {
        // step 3: a quantum object to the lab, the lab's stop, the gifts used; the warm stop; the drone close up; the flesh
        await jump('iv-dig-lab');
        await sleep(600);
        await shot('p3-30-carrying');
        const lab = await ev(`import('/src/phase4d/base.js').then((m) => m.roomSpot('lab'))`);
        for (let i = 0; i < 14 && (await st('s.x')) !== lab; i++) await hold('ArrowRight', 140);
        await sleep(1500);
        await shot('p3-31-lab-working');
        await ev(`(() => { window.rpiDig.state.quantum.lab = 59.5; return true; })()`);
        await sleep(1200);
        await shot('p3-32-lab-stop');
        await key('Enter');
        // fitted in the workshop: drive there, Enter fits the chosen row
        for (let i = 0; i < 12 && (await st('s.x')) > 15; i++) await hold('ArrowLeft', 140);
        await sleep(500);
        await shot('p3-32b-fit-row');
        await key('Enter');
        await sleep(300);
        await shot('p3-32c-fitted');
        await hold('ArrowLeft', 500);
        await hold('ArrowDown', 1600);
        await key('b');
        await hold('ArrowDown', 1200);
        await shot('p3-33-booster');
        await ev(`(() => { const s = window.rpiDig.state; for (const id of ['shock', 'teleport', 'lamp2']) { if (!s.quantum.got.includes(id)) s.quantum.got.push(id); if (!s.quantum.fit.includes(id)) s.quantum.fit.push(id); } return true; })()`);
        await key('q');
        await sleep(200);
        await shot('p3-34-shock');
        await sleep(600);
        await shot('p3-35-second-lamp');
        await key('t');
        await sleep(500);
        await shot('p3-36-teleported');
        await jump('iv-dig-machine');
        await ev(`(() => { const s = window.rpiDig.state; s.tut.done.warm = false; s.levels.hull = 3; s.y = 218; s.x = 11; for (let y = 140; y < 219; y++) s.tiles[y * 24 + 11] = 0; return true; })()`);
        await hold('ArrowDown', 1500);
        await shot('p3-37-warm-stop');
        await jump('iv-dig-flesh');
        await hold('ArrowDown', 800);
        await shot('p3-38-flesh-drone');
        // the drone close up at the base, every upgrade
        await jump('iv-dig-heart');
        await ev(`(() => { const s = window.rpiDig.state; s.y = -1; s.x = 8; s.cargo = [8, 8, 8]; s.quantum.got = ['booster', 'lamp2']; s.grafts = 0; return true; })()`);
        await sleep(900);
        const d = await ev(`(() => { const r = window.rpiDig.renderer.screenOf(window.rpiDig.state, window.rpiDig.view()); return r; })()`);
        const z = await send('Page.captureScreenshot', { format: 'png', clip: { x: d.x - 120, y: d.y - 90, width: 240, height: 150, scale: 3 } });
        fs.writeFileSync(path.join(SHOTS, 'p3-39-drone-closeup.png'), Buffer.from(z.result.data, 'base64'));
        await ev(`(() => { const s = window.rpiDig.state; s.grafts = 3; s.y = 300; s.x = 11; s.cargo = []; s.act = { kind: 'dig', tx: 11, ty: 301, t: 0, dur: 99, cost: 0, tile: 5 }; return true; })()`);
        await sleep(700);
        const d2 = await ev(`(() => window.rpiDig.renderer.screenOf(window.rpiDig.state, window.rpiDig.view()))()`);
        const z2 = await send('Page.captureScreenshot', { format: 'png', clip: { x: d2.x - 120, y: d2.y - 90, width: 240, height: 150, scale: 3 } });
        fs.writeFileSync(path.join(SHOTS, 'p3-40-drone-flesh-closeup.png'), Buffer.from(z2.result.data, 'base64'));
    }
    if (process.argv.includes('--v1928')) {
        // v1.92.8: the heart in the dark, lit by the drone's lamp at two angles
        await jump('iv-dig-heart');
        await sleep(3500);
        await ev(`(() => { const s = window.rpiDig.state; s.tut.done.heartWall = true; s.face = 1; return true; })()`);
        await sleep(1500);
        await shot('p3-a1-heart-lamp-right');
        await ev(`(() => { const s = window.rpiDig.state; s.face = -1; return true; })()`);
        await sleep(1500);
        await shot('p3-a2-heart-lamp-left');
        await ev(`(() => { const s = window.rpiDig.state; s.x = 7; s.y = 396; s.face = 1; for (let x = 7; x <= 11; x++) s.tiles[396 * 24 + x] = 0; return true; })()`);
        await sleep(1500);
        await shot('p3-a3-heart-lamp-side');
        const d = await ev(`(() => { const s = window.rpiDig.state; s.x = 11; s.y = 397; s.face = 1; return true; })()`);
        void d;
        await sleep(1200);
        const z = await send('Page.captureScreenshot', { format: 'png', clip: { x: 520, y: 150, width: 520, height: 600, scale: 1.5 } });
        fs.writeFileSync(path.join(SHOTS, 'p3-a4-heart-close.png'), Buffer.from(z.result.data, 'base64'));
    }
    if (process.argv.includes('--v1927')) {
        // v1.92.7: thoughts on a dive from 700 m; the ending with the heart's voice; the heart in 3D
        await jump('iv-dig-machine');
        await ev(`(() => { const s = window.rpiDig.state; s.levels.hull = 3; s.levels.drill = 3; s.levels.battery = 5; s.battery = 360; s.grafts = 3; s.alarms.next = 1e9; for (let y = s.y; y < 390; y++) s.tiles[y * 24 + 11] = 0; return true; })()`);
        let seen = await st('s.thoughtN');
        const t0 = Date.now();
        let shots = 0;
        while (Date.now() - t0 < 140000 && shots < 4) {
            await hold('ArrowDown', 300);
            await ev(`(() => { const s = window.rpiDig.state; s.battery = 360; s.reserve = 100; return true; })()`);
            const n = await st('s.thoughtN');
            if (n !== seen) { seen = n; await sleep(2600); await shot(`p3-9${2 + shots}-thought-${n}`); shots++; await sleep(500); }
            // wait at depth for the 40 s gap, as a player mining would
            if (await st('s.time - (s.thoughtAt ?? -1e9) < 40')) await sleep(1500);
        }
        console.log('thoughts had on the dive:', await st('s.thoughtN'), 'depth', await st('s.y * 5'));
        await jump('iv-dig-heart');
        await sleep(2500);
        await shot('p3-91-heart-3d');
        const names = [];
        let k = 0;
        for (let guard = 0; guard < 120 && k < 8; guard++) {
            const id = await st('s.tut.stop && s.tut.stop.id');
            if (id) {
                await sleep(3000);
                const still = await st('s.tut.stop && s.tut.stop.id');
                names.push(`${id}${still === id ? '' : ' (VANISHED)'}`);
                await shot(`p3-96-end-${String(k).padStart(2, '0')}-${id}`);
                await key('Enter'); k++;
                await sleep(400);
                if (id === 'end-hatch') { for (const [ms, name] of [[1500, 'p3-97-hatch-open'], [3500, 'p3-98-flow'], [3000, 'p3-98-flow-heart']]) { await sleep(ms); await shot(name); } }
                continue;
            }
            if (await st('s.flowDone')) break;
            if (!(await st('s.ended'))) await hold('ArrowDown', 400); else await sleep(400);
        }
        console.log('stops in order:', names.join(' | '));
        await sleep(800);
        await shot('p3-99-rise');
        console.log('rise shown:', await ev(`!document.getElementById('dig-rise').hidden`), '| 3D heart:', await ev(`!!window.rpiDig.renderer`));
    }
    if (process.argv.includes('--v1926')) {
        // v1.92.6: the refinery at the warehouse, and the heart's ending as slow stops and a stream of sleepers
        await jump('iv-dig-war');
        await ev(`(() => { const s = window.rpiDig.state; s.y = -1; s.x = 9; s.deliveries = 3; s.parts = 120; s.reserve = 60; s.cargo = [9, 9, 10, 10, 8, 8, 8, 9]; return true; })()`);
        await sleep(900);
        await shot('p3-80-warehouse-refinery');
        await key('Enter');
        await ev(`(() => { const s = window.rpiDig.state; s.cargo = [9, 9, 10, 10, 8, 8, 8, 9]; return true; })()`);
        await sleep(600);
        await shot('p3-81-refined');
        await jump('iv-dig-heart');
        await ev(`(() => { const s = window.rpiDig.state; s.tut.done.heartWall = false; return true; })()`);
        let n = 0;
        const names = [];
        for (let guard = 0; guard < 80 && n < 9; guard++) {
            const id = await st('s.tut.stop && s.tut.stop.id');
            if (id) {
                await sleep(3500);                              // nothing vanishes while unread
                const still = await st('s.tut.stop && s.tut.stop.id');
                names.push(`${id}${still === id ? '' : ' (VANISHED)'}`);
                await shot(`p3-82-end-${String(n).padStart(2, '0')}-${id}`);
                await key('Enter'); n++;
                await sleep(400);
                continue;
            }
            if (await st('s.ended')) { await sleep(500); if (await st('s.flowT != null')) break; continue; }
            await hold('ArrowDown', 400);
        }
        console.log('stops in order:', names.join(' | '));
        for (const [ms, name] of [[2000, 'p3-83-flow-a'], [3000, 'p3-84-flow-b'], [3500, 'p3-85-flow-c']]) { await sleep(ms); await shot(name); }
        await sleep(1500);
        await shot('p3-86-rise');
        console.log('rise shown:', await ev(`!document.getElementById('dig-rise').hidden`));
    }
    if (process.argv.includes('--v1924')) {
        // v1.92.4: stops that stay, the cargo gauge, armour, the warning, the death beat, the arms
        await jump('iv-dig-start');
        for (let i = 0; i < 30 && (await st('s.tut.stop && s.tut.stop.id')) === 'arrive'; i++) await sleep(500);
        await sleep(200);
        await click(700, 600);                              // a click elsewhere: the stop stays
        await key('Enter');                                 // too soon (under 0.8 s): it stays
        const still = await st('s.tut.stop && s.tut.stop.id');
        await sleep(900);
        await key('Enter');
        console.log('stop after a click and an early Enter:', still, '| after a late Enter:', await st('s.tut.stop && s.tut.stop.id'));
        await jump('iv-dig-war');
        await ev(`(() => { const s = window.rpiDig.state; s.cargo = [8, 8, 9, 10, 9, 8, 8]; s.levels.armour = 1; s.hp = 1; s.levels.warning = 1; s.battery = 12; return true; })()`);
        await sleep(900);
        const d = await ev(`(() => window.rpiDig.renderer.screenOf(window.rpiDig.state, window.rpiDig.view()))()`);
        const z = await send('Page.captureScreenshot', { format: 'png', clip: { x: d.x - 120, y: d.y - 90, width: 240, height: 150, scale: 3 } });
        fs.writeFileSync(path.join(SHOTS, 'p3-70-drone-gauge-warning-dent.png'), Buffer.from(z.result.data, 'base64'));
        await shot('p3-71-warning');
        // the death beat
        await ev(`(() => { const s = window.rpiDig.state; s.levels.warning = 0; s.hp = 1; s.lava[s.y * 24 + s.x] = 0; s.heat = 99; return true; })()`);
        await sleep(400);
        await shot('p3-72-beat-slow');
        await sleep(1500);
        await shot('p3-73-beat-cause');
        await sleep(1500);
        await shot('p3-74-beat-glide');
        await sleep(2000);
        await shot('p3-75-beat-workshop-stop');
        await key('Enter');
        await sleep(300);
        await key('Enter');                                  // BUILD A DRONE (the chosen row)
        await sleep(1600);
        await shot('p3-76-arms-build');
        await sleep(3000);
        await shot('p3-77-new-paint');
        console.log('drone', await st('s.droneN'), 'paint', await st('s.paint'), 'wrecks', await st('s.wrecks.length'));
    }
    if (process.argv.includes('--v1923')) {
        // v1.92.3: why the drone died, a base with teeth, into chapter V
        await jump('iv-dig-alarm');
        await key('Enter');
        await ev(`(() => { const s = window.rpiDig.state; s.alarms.list[0].cost = 12; s.cargo = [8, 8, 9, 9, 8, 8]; s.reserve = 55; s.x = 15; return true; })()`);
        await sleep(400);
        await shot('p3-60-alarm-price');
        await hold('ArrowLeft', 900);                      // drives through the warehouse without stopping
        await sleep(300);
        await shot('p3-61-unload-driving');
        // down from the workshop's last row: the drone leaves for the hatch
        await ev(`(() => { const s = window.rpiDig.state; s.x = 13; return true; })()`);
        await sleep(300);
        for (let i = 0; i < 4; i++) await key('ArrowDown');
        await hold('ArrowDown', 1500);
        await shot('p3-62-down-from-workshop');
        // up into rock with nothing to dig up
        await ev(`(() => { const s = window.rpiDig.state; s.x = 13; s.y = 8; for (let x = 12; x <= 13; x++) { s.tiles[8 * 24 + x] = 0; s.tiles[7 * 24 + x] = 2; } s.tiles[9 * 24 + 13] = 2; return true; })()`);
        await hold('ArrowUp', 600);
        await shot('p3-63-cant-dig-up');
        // magma: the heat bar, then the reason
        await jump('iv-dig-machine');
        await ev(`(() => { const s = window.rpiDig.state; s.lava[s.y * 24 + s.x] = 0; return true; })()`);
        await sleep(1500);
        await shot('p3-64-heat-bar');
        await sleep(4000);
        await shot('p3-65-magma-reason');
        // the heart and RISE into chapter V
        await jump('iv-dig-heart');
        await hold('ArrowDown', 4200);
        await sleep(11000);
        const rise = await ev(`(() => { const e = document.getElementById('dig-rise'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await shot('p3-66-heart');
        if (rise) await click(rise.x, rise.y);
        await sleep(9000);
        await shot('p3-67-chapter-v');
        console.log('phase after RISE:', await ev(`localStorage.getItem('rpi-phase') || localStorage.getItem('rpi-game-phase') || [...Object.keys(localStorage)].join(',')`), '| unity save:', await ev(`!!localStorage.getItem('rpi-unity')`));
    }
    if (process.argv.includes('--hazards')) {
        // v1.92.2: ore and parts, magma, gas, a cave-in, a lost drone and its wreck, the generator's levels
        await jump('iv-dig-war');
        await ev(`(() => { const s = window.rpiDig.state; s.cargo = [8, 8, 9, 10]; return true; })()`);
        await sleep(500);
        await shot('p3-50-cargo-ore');
        // gas beside the drone
        await ev(`(() => { const s = window.rpiDig.state; s.tiles[(s.y + 1) * 24 + 11] = 16; s.tiles[(s.y + 1) * 24 + 12] = 16; return true; })()`);
        await sleep(700);
        await shot('p3-51-gas-seen');
        await hold('ArrowDown', 700);
        await sleep(300);
        await shot('p3-52-gas-burst');
        // the old rock: a wide opening under a roof
        await jump('iv-dig-war');
        await ev(`(() => { const s = window.rpiDig.state; s.y = 70; s.x = 11; s.levels.battery = 4; s.battery = 240; for (let y = 59; y <= 70; y++) s.tiles[y * 24 + 11] = 0; for (let x = 12; x <= 14; x++) s.tiles[70 * 24 + x] = 0; for (let x = 11; x <= 16; x++) s.tiles[69 * 24 + x] = x === 11 ? 0 : 2; s.tiles[70 * 24 + 15] = 2; return true; })()`);
        await hold('ArrowRight', 300);
        await ev(`(() => { const s = window.rpiDig.state; s.cargo = [8, 8, 9, 9]; s.caves.push({ x0: 11, x1: 15, y: 70, at: s.time + 2 }); s.act = null; s.x = 13; return true; })()`);
        await sleep(400);
        await shot('p3-53-roof-moving');
        await sleep(2500);
        await shot('p3-54-lost-workshop');
        const bb = await ev(`(() => { const e = document.querySelector('.dig-buy.is-build'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.left + 30, y: r.top + 12 }; })()`);
        if (bb) { await key('Enter'); await sleep(500); await key('Enter'); }
        await sleep(1500);
        await shot('p3-55-building');
        await sleep(3500);
        await shot('p3-56-built');
        await ev(`(() => { const s = window.rpiDig.state; const w = s.wrecks[s.wrecks.length - 1]; if (w) { s.y = w.y - 2; s.x = w.x; for (let y = w.y - 3; y <= w.y; y++) s.tiles[y * 24 + w.x] = 0; } return !!w; })()`);
        await sleep(400);
        await shot('p3-56b-wreck');
        await hold('ArrowDown', 500);
        await sleep(400);
        await shot('p3-56c-wreck-looted');
        // magma below 600 m
        await jump('iv-dig-machine');
        await ev(`(() => { const s = window.rpiDig.state; s.tiles[(s.y) * 24 + 13] = 15; s.tiles[(s.y + 1) * 24 + 13] = 15; s.tiles[s.y * 24 + 12] = 2; return true; })()`);
        await sleep(700);
        await shot('p3-57-magma-seen');
        await hold('ArrowRight', 600);
        await sleep(2500);
        await shot('p3-58-magma-runs');
        // the generator's levels at the GENERATOR
        await jump('iv-dig-war');
        await ev(`(() => { const s = window.rpiDig.state; s.y = -1; s.x = 2; s.parts = 300; return true; })()`);
        await sleep(800);
        await shot('p3-59-generator');
        console.log('build button seen:', !!bb);
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
