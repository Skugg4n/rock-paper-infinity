// Mobile layout check (v1.94.1, the mobile pass). Loads every chapter state that has its own
// controls at three phone sizes in headless Chrome with mobile emulation (touch, Android UA,
// pointer: coarse) and fails when two visible tappable controls overlap, or when the element at a
// control's centre (elementFromPoint) is not that control (something lies on top of it).
// It fails too when a control that takes taps reaches outside the visible screen (the last button of a
// column under the browser's own bar). Targets under 44×44 CSS px and gaps under 8 px are warnings.
//   node scripts/check-mobile.mjs                         all screens, 412×915 412×780 360×780 390×844
//   node scripts/check-mobile.mjs --only i-factory,ii-mid --sizes 412x915
//   node scripts/check-mobile.mjs --shots docs/playtests/mobile/after-   screenshots at 412×915
//   node scripts/check-mobile.mjs --desktop out.json      1440×900, no emulation: dumps every control's box
// No dependencies: the DevTools protocol over Node's own WebSocket (like scripts/play-vault.mjs).
// The server and Chrome are closed at the end, always. Sound off, muted browser.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(opt('--port', 8128));
const DESKTOP = opt('--desktop', null);
// 412×780 is Ola's phone with the browser's own bars taking their share of the 915 px screen
const SIZES = DESKTOP ? [[1440, 900]] : opt('--sizes', '412x915,412x780,360x780,390x844').split(',').map((s) => s.split('x').map(Number));
const SHOTS = opt('--shots', null);          // a path prefix; the shot is taken at the first size
const SHOT_SCALE = Number(opt('--shot-scale', 0.6));
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// Every chapter state with its own controls. `then` runs after the jump (the interim is reached
// from the war by window.debug_interim, then waits for its choice).
const SCREENS = [
    'i-start', 'i-bulk', 'i-factory', 'i-running',
    'ii-start', 'ii-mid', 'ii-complete', 'iii-start', 'iii-late',
    { id: 'interim', from: 'iii-late', then: async (ev) => {
        await ev('window.debug_interim(); true');
        for (let i = 0; i < 120; i++) {
            if (await ev(`!!document.querySelector('#interim [data-choice], #interim .in-choice button, #interim button')`)) break;
            await sleepMs(250);
        }
        await sleepMs(800);
    } },
    'iv-vault-start', 'iv-vault-night', 'iv-vault-flesh',
    'iv-dig-start', 'iv-dig-alarm', 'iv-dig-heart',
    'iv-start', 'iv-grow',
    'v-start', 'v-land', 'v-planet',
].map((s) => (typeof s === 'string' ? { id: s, from: s } : s));
const only = opt('--only', null);
const screens = only ? SCREENS.filter((s) => only.split(',').includes(s.id)) : SCREENS;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rpi-mobile-'));
const chrome = spawn(CHROME, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1440,900',
    '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });

// Runs in the page: the visible tappable controls, their overlaps and what lies on top of them.
const PROBE = `(() => {
    const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [onclick]';
    const vw = innerWidth, vh = innerHeight;
    const name = (e) => {
        if (!e) return 'null';
        let s = e.tagName.toLowerCase();
        if (e.id) s += '#' + e.id;
        else if (e.className && typeof e.className === 'string') s += '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.');
        const label = e.getAttribute && (e.getAttribute('aria-label') || e.getAttribute('data-choice') || e.getAttribute('data-throw'));
        if (label) s += '[' + label.slice(0, 24) + ']';
        return s;
    };
    // a tap target is the box plus an absolutely placed ::after (the plates' and the silo's enlarged
    // hit areas); getComputedStyle gives the pseudo's used left/top and its translate
    const hitRect = (e, b) => {
        const cs = getComputedStyle(e, '::after');
        if (!cs || cs.content === 'none' || cs.display === 'none' || cs.position !== 'absolute') return b;
        // the box may be transformed (the war tilts the city): scale the pseudo's own px by the box's
        const sx = e.offsetWidth ? b.width / e.offsetWidth : 1, sy = e.offsetHeight ? b.height / e.offsetHeight : 1;
        const w = parseFloat(cs.width) * sx, h = parseFloat(cs.height) * sy;
        if (!(w > 0 && h > 0)) return b;
        const es = getComputedStyle(e);
        let x = b.left + ((parseFloat(es.borderLeftWidth) || 0) + (parseFloat(cs.left) || 0)) * sx;
        let y = b.top + ((parseFloat(es.borderTopWidth) || 0) + (parseFloat(cs.top) || 0)) * sy;
        const m = /matrix\(([^)]+)\)/.exec(cs.transform || '');
        if (m) { const v = m[1].split(',').map(Number); x += v[4] * sx; y += v[5] * sy; }
        const l = Math.min(b.left, x), t = Math.min(b.top, y), r = Math.max(b.right, x + w), bt = Math.max(b.bottom, y + h);
        return { left: l, top: t, right: r, bottom: bt, width: r - l, height: bt - t };
    };
    const shown = (e) => {
        for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
            if (Number(cs.opacity) < 0.05) return false;
        }
        return true;
    };
    const live = (e) => getComputedStyle(e).pointerEvents !== 'none';
    // A control that does not take taps right now (pointer-events: none, disabled) still counts
    // for overlaps: it is drawn, and it takes taps again later (the resting hands, a locked buy).
    // cursor: pointer marks the clickable divs too (the topmost one of a pointer subtree)
    const all = new Set(document.querySelectorAll(SEL));
    for (const e of document.body.querySelectorAll('div, span, li, label, svg, canvas')) {
        if (getComputedStyle(e).cursor === 'pointer' && !(e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer')) all.add(e);
    }
    const ctl = [];
    for (const e of all) {
        if (e.closest('#debug-menu, #p2-debug-menu, #menu-dropdown, #debug-trigger, #debug-toggle-btn')) continue;
        if (e.tagName === 'CANVAS' || e.closest('.chapter-card')) continue;
        if (!shown(e)) continue;
        const b0 = e.getBoundingClientRect();
        if (b0.width < 1 || b0.height < 1) continue;
        // what a scrolling ancestor shows of it (a button scrolled out of a column is not on screen)
        let l = b0.left, t = b0.top, rr = b0.right, bb = b0.bottom;
        for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
            const c = n.getBoundingClientRect();
            l = Math.max(l, c.left); t = Math.max(t, c.top); rr = Math.min(rr, c.right); bb = Math.min(bb, c.bottom);
        }
        if (rr - l < 1 || bb - t < 1) continue;
        const r = { left: l, top: t, right: rr, bottom: bb, width: rr - l, height: bb - t, full: b0 };
        const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(vw, r.right), y1 = Math.min(vh, r.bottom);
        if (x1 - x0 < 1 || y1 - y0 < 1) continue;
        ctl.push({ e, r, vis: { x0, y0, x1, y1 }, live: live(e) });
    }
    // nested controls (a button in a clickable card) count once: the outermost
    // a full-screen layer (the interim's CRT, an open sheet) puts what is under it out of play:
    // the controls behind it are not on screen, so they count for nothing
    const fullLayer = (n) => {
        for (; n && n !== document.body; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.position !== 'fixed') continue;
            const b = n.getBoundingClientRect();
            if (b.width >= vw * 0.95 && b.height >= vh * 0.95) return n;
        }
        return null;
    };
    const behind = (c) => {
        const hit = document.elementFromPoint((c.vis.x0 + c.vis.x1) / 2, (c.vis.y0 + c.vis.y1) / 2);
        const layer = fullLayer(hit);
        return !!layer && !layer.contains(c.e);
    };
    const gone = new Set(ctl.filter(behind));
    const top = ctl.filter((c) => !gone.has(c) && !ctl.some((o) => o !== c && o.e.contains(c.e)));
    const out = { controls: [], overlaps: [], covered: [], small: [], tight: [], offscreen: [], plates: [], coarse: matchMedia('(pointer: coarse)').matches };
    // the city's plates: no two hit areas (+, −, fort, clear) may overlap, on one plate or on neighbours
    const plate = top.filter((c) => c.live && c.e.matches('.building-action-btn')).map((c) => ({ c, h: hitRect(c.e, c.r.full) }));
    for (let i = 0; i < plate.length; i++) for (let j = i + 1; j < plate.length; j++) {
        const a = plate[i].h, b = plate[j].h;
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 0.5 && iy > 0.5) out.plates.push(name(plate[i].c.e) + ' (' + (plate[i].c.e.closest('.building-slot')?.getAttribute('aria-label') || '') + ') × ' + name(plate[j].c.e) + ' (' + (plate[j].c.e.closest('.building-slot')?.getAttribute('aria-label') || '') + ') ' + Math.round(ix) + '×' + Math.round(iy));
    }
    for (const c of ctl) {
        const box = { x: Math.round(c.r.left), y: Math.round(c.r.top), w: Math.round(c.r.width), h: Math.round(c.r.height) };
        out.controls.push({ n: name(c.e), ...box });
        if (c.live && !gone.has(c) && (c.r.left < -0.5 || c.r.top < -0.5 || c.r.right > vw + 0.5 || c.r.bottom > vh + 0.5)) out.offscreen.push(name(c.e) + ' ' + JSON.stringify(box));
    }
    for (const c of top) {
        const hr = hitRect(c.e, c.r.full);
        if (c.live && (hr.width < 44 - 0.5 || hr.height < 44 - 0.5)) out.small.push(name(c.e) + ' ' + Math.round(hr.width) + '×' + Math.round(hr.height));
        if (!c.live) continue;   // resting (pointer-events: none): not tapped now
        const cx = (c.vis.x0 + c.vis.x1) / 2, cy = (c.vis.y0 + c.vis.y1) / 2;
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !(hit === c.e || c.e.contains(hit))) out.covered.push(name(c.e) + ' under ' + name(hit) + (hit ? ' (' + [hit.parentElement, hit.parentElement?.parentElement].map(name).join(' < ') + ')' : ''));
    }
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
        const a = top[i].r, b = top[j].r;
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 0.5 && iy > 0.5) out.overlaps.push(name(top[i].e) + ' × ' + name(top[j].e) + ' (' + Math.round(ix) + '×' + Math.round(iy) + ')');
        else {
            const gx = Math.max(b.left - a.right, a.left - b.right), gy = Math.max(b.top - a.bottom, a.top - b.bottom);
            const gap = Math.max(gx, gy);
            if (gap < 8 - 0.5) out.tight.push(name(top[i].e) + ' · ' + name(top[j].e) + ' ' + Math.round(gap) + ' px');
        }
    }
    return out;
})()`;

let failed = 0;
const report = [];

// Statically: a phase that sizes itself to the screen uses the VISIBLE height. 100vh on a phone is the
// height without the browser's bars, so the bottom of the game falls under them (the city's last
// build button, v1.94.0). Every 100vh needs a dvh/svh line right after it; h-screen is not used.
if (!DESKTOP) {
    const files = ['index.html', ...fs.readdirSync(ROOT).filter((f) => /^style.*\.css$/.test(f))];
    const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.js$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [path.join(d, e.name)] : []));
    files.push(...walk('src'));
    for (const f of files) {
        const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
        lines.forEach((l, i) => {
            const bad = (/100vh/.test(l) && !/[ds]vh/.test(l) && !/[ds]vh/.test(lines[i + 1] || '')) || /\b(min-)?h-screen\b/.test(l);
            if (bad) { failed++; console.log(`FAIL ${f}:${i + 1}  100vh without a dvh/svh after it: ${l.trim().slice(0, 90)}`); }
        });
    }
}
const dump = {};
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
    };
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    const ev = async (expr) => {
        const out = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (out.result?.exceptionDetails) throw new Error(`page: ${out.result.exceptionDetails.exception?.description || expr}`);
        return out.result?.result?.value;
    };
    await send('Runtime.enable'); await send('Page.enable');
    const emulate = async (w, h) => {
        if (DESKTOP) {
            await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
            await send('Emulation.setTouchEmulationEnabled', { enabled: false });
            await send('Emulation.setEmitTouchEventsForMouse', { enabled: false });
            return;
        }
        await send('Emulation.setUserAgentOverride', { userAgent: UA, platform: 'Linux armv8l' });
        await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2.6, mobile: true, screenWidth: w, screenHeight: h });
        await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    };
    const load = async (sc) => {
        await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?go` });
        await sleepMs(900);
        await ev(`localStorage.setItem('rpi-audio', JSON.stringify({ sfx: false, music: false })); true`);
        await ev(`import('/src/checkpoints.js').then((m) => { window.__rpiSkipSave = true; m.jumpTo(${JSON.stringify(sc.from)}); return true; })`);
        await sleepMs(4500);   // the reload, the chapter's start, any card
        if (sc.then) await sc.then(ev);
        await ev(`document.querySelectorAll('.update-pill').forEach((p) => p.remove()); true`);
        // touch: the city's minus shows on the picked plate only (src/phase2/index.js); pick one in the middle
        await ev(`(() => { if (!matchMedia('(hover: none)').matches) return false;
            const slots = [...document.querySelectorAll('#land-grid > .building-slot')].filter((sl) => sl.querySelector('.sell-btn'));
            const mid = slots.find((sl) => [...sl.parentElement.children].indexOf(sl) >= 6) || slots[0];
            if (mid) mid.classList.add('is-picked');
            return !!mid; })()`);
        await sleepMs(500);   // its fade
    };
    for (const [w, h] of SIZES) {
        await emulate(w, h);
        for (const sc of screens) {
            const key = `${sc.id} @ ${w}×${h}`;
            try {
                await load(sc);
                if (opt('--eval', null)) { console.log(key, JSON.stringify(await ev(opt('--eval'))), '\n'); continue; }
                const r = await ev(PROBE);
                const bad = r.overlaps.length + r.covered.length + r.offscreen.length + r.plates.length;
                if (bad) failed++;
                if (DESKTOP) dump[sc.id] = r.controls;
                report.push({ key, ...r });
                const line = [`${bad ? 'FAIL' : 'ok  '} ${key}  ${r.controls.length} controls${DESKTOP ? '' : r.coarse ? ' (coarse)' : ' (NOT coarse)'}`];
                for (const o of r.overlaps) line.push(`    overlap  ${o}`);
                for (const o of r.covered) line.push(`    covered  ${o}`);
                for (const o of r.offscreen) line.push(`    clipped  ${o}`);
                for (const o of r.plates) line.push(`    plates   ${o}`);
                if (argv.includes('--warn')) {
                    for (const o of r.small) line.push(`    small    ${o}`);
                    for (const o of r.tight) line.push(`    tight    ${o}`);
                } else if (r.small.length || r.tight.length) line.push(`    (${r.small.length} small, ${r.tight.length} tight: --warn lists them)`);
                console.log(line.join('\n'));
                if (SHOTS && w === SIZES[0][0] && h === SIZES[0][1]) {
                    const out = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: SHOT_SCALE } });
                    const file = path.resolve(ROOT, `${SHOTS}${sc.id}.png`);
                    fs.mkdirSync(path.dirname(file), { recursive: true });
                    fs.writeFileSync(file, Buffer.from(out.result.data, 'base64'));
                }
            } catch (e) {
                failed++;
                console.log(`FAIL ${key}  ${e.message}`);
            }
        }
    }
    if (errors.length) console.log('PAGE ERRORS:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
    if (DESKTOP) fs.writeFileSync(path.resolve(DESKTOP), JSON.stringify(dump, null, 1));
    if (argv.includes('--json')) fs.writeFileSync(path.resolve(opt('--json', 'check-mobile.json')), JSON.stringify(report, null, 1));
} catch (e) {
    console.error(e); failed++;
} finally {
    try { chrome.kill('SIGTERM'); } catch { /* gone */ }
    server.close();
    await sleepMs(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
if (!DESKTOP) console.log(failed ? `\n${failed} screen(s) failed` : '\nall screens pass');
process.exit(DESKTOP ? 0 : failed ? 1 : 0);
