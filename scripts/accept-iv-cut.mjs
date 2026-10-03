// Chapter IV, deep-rebuild: the acceptance check for movements I (TEND) and II (SLEEP), from
// docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, played in a real browser.
//
//   node scripts/accept-iv-cut.mjs [--headed] [--shots DIR] [--port N]
//
// It serves the repo on a free port (or uses one already running with --port), starts Google
// Chrome headless (WebGL through SwiftShader) with a throwaway profile, drives it over the
// DevTools protocol with Node's own WebSocket (no dependencies), and closes both at the end.
//
// T. From "IV · the deep" (awake): the panel shows four gauges labelled ORE, FOOD, POWER, HANDS and
//    one stamped advice ("INSTRUMENTS: ..."); the old bars, advisor, feed, scout and sleep pills are
//    gone. DIG makes a chamber; once it lands the panel says "EMPTY 1" and the plate has its "+".
//    A click on the empty plate opens the ring of four rooms; a click on the farm orders it into
//    that chamber (paid, in the queue, the plate shows the farm), and it lands there.
//    The drawer button opens the drawer: only rows that can be bought now are bright, each has a
//    price; a press outside closes it.
// L. From "IV · cryo I": the three lamps are lit and the lever is there with Cryo I's price. Pulling
//    it buys Cryo I and starts the sleep: the panel's lights go out, the counter "THE COLONY HAS
//    SLEPT" shows in the middle; the year count is sampled twice and the second gain is larger than
//    the first (time accelerates). A forced alarm wakes them: one lamp with one word, the panel lit.
// H. Asleep with stability forced low, a hallucination appears (the lamp in an empty chamber or the
//    figure on the crust); a real click on the base snaps them away.
// S. Surface: a forced night types its line, the game comes, a throw; 7 s after the result the card
//    is gone from the screen.
// Exit code 0 when every check holds.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : dflt; };
const shotsAt = process.argv.indexOf('--shots');
const SHOTS = shotsAt > 0 ? path.resolve(process.argv[shotsAt + 1]) : null;     // screenshots at the key moments
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- a static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
});
// --port N: use a server that is already running there (python3 -m http.server N) instead of our own
const OWN_PORT = arg('--port', 0);
if (!OWN_PORT) await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = OWN_PORT || server.address().port;

// ---- Chrome ----
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rpi-accept-'));
const chrome = spawn(CHROME, [
    ...(process.argv.includes('--headed') ? [] : ['--headless=new']),
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1440,900',
    '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank',
], { stdio: 'ignore' });
let failed = 0;
const results = [];
function check(ok, what) {
    results.push(`${ok ? 'ok  ' : 'FAIL'}  ${what}`);
    if (!ok) failed++;
}
async function cleanup() {
    try { chrome.kill('SIGTERM'); } catch { /* gone */ }
    if (!OWN_PORT) server.close();
    await sleepMs(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}

try {
    // the port Chrome picked
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleepMs(100);
    const devPort = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const targets = await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0;
    const pending = new Map();
    const errors = [];
    ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
        if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    };
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async (expr) => {
        const out = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (out.result?.exceptionDetails) throw new Error(`page: ${out.result.exceptionDetails.exception?.description || expr}`);
        return out.result?.result?.value;
    };
    const mouse = async (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    const click = async (x, y) => { await mouse('mouseMoved', x, y); await sleepMs(40); await mouse('mousePressed', x, y); await sleepMs(40); await mouse('mouseReleased', x, y); };
    const shot = async (name) => {
        if (!SHOTS) return;
        fs.mkdirSync(SHOTS, { recursive: true });
        const out = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(out.result.data, 'base64'));
    };
    const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: 27 }); };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    async function jump(idOf, { asleep = true } = {}) {
        await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?debug` });
        await sleepMs(1500);
        await evaluate(`import('/src/checkpoints.js').then((m) => { m.jumpTo(${JSON.stringify(idOf)}); return true; })`);
        await sleepMs(2500);
        for (let i = 0; i < 60; i++) {
            if (await evaluate(`!!(window.rpiDeep && window.rpiDeep.scene && ${asleep ? 'window.rpiDeep.state.asleep' : 'true'})`)) break;
            await sleepMs(250);
        }
        await sleepMs(800);     // a few frames: the camera framed, the labels drawn
    }
    /** A plate to click: its slot and where it is on the screen, checked by the scene's own ray. */
    const PLATE_AT = `(slots) => {
        const d = window.rpiDeep;
        for (const slot of slots) {
            const p = d.scene.screenOfSlot(slot);
            if (p && d.scene.slotAt(p.x, p.y) === slot) return { slot, x: p.x, y: p.y };
        }
        return null;
    }`;

    /** The centre of an element on screen, or null when it is not drawn. */
    const centre = async (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
        const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`);
    /** Is this element on screen: in the layout, not hidden, not faded out? */
    const shown = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden) return false;
        const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
        const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
    const D = (expr) => evaluate(`window.rpiDeep.${expr}`);
    // ================= T. TEND: the panel, the empty chamber and its ring, the drawer ================
    await jump('iv-start', { asleep: false });
    await sleepMs(1500);
    await shot('0-iv-start');
    const p0 = await evaluate(`(() => ({
        gauges: [...document.querySelectorAll('#deep-gauges .deep-gauge')].map((g) => g.querySelector('.dymo').textContent),
        needles: document.querySelectorAll('#deep-gauges .needle').length,
        advice: [...document.querySelectorAll('#deep-panel .dymo.is-advice')].filter((e) => !e.hidden).map((e) => e.textContent),
        old: ['deep-columns', 'deep-advisor', 'deep-feed', 'deep-probe-btn', 'deep-cryo-btn', 'deep-wake-btn', 'deep-replay', 'deep-room-farm']
            .filter((id) => document.getElementById(id)),
    }))()`);
    check(p0.gauges.join(',') === 'ORE,FOOD,POWER,HANDS' && p0.needles === 4, `the panel has four gauges on tape: ${p0.gauges.join(', ')} (${p0.needles} needles)`);
    check(p0.advice.length === 1 && /^INSTRUMENTS: [A-Z ]+$/.test(p0.advice[0]), `one stamped advice: "${p0.advice.join(' | ')}"`);
    check(p0.old.length === 0, `the bars, the advisor's feed, the scouts and the old pills are gone${p0.old.length ? `: still ${p0.old.join(', ')}` : ''}`);
    check(!(await shown('#deep-lever-wrap')), 'before the lamps are lit there is no lever');
    check(await shown('#deep-lamps'), 'the three lamps of cryo are on the panel');
    // dig, and wait for the chamber
    await evaluate('debug_deep("minerals")');
    await sleepMs(300);
    const dig = await centre('#deep-dig-btn');
    await click(dig.x, dig.y);
    let empties = [];
    for (let i = 0; i < 60 && !empties.length; i++) { await sleepMs(250); empties = await D('empties'); }
    await sleepMs(1200);
    const em = await evaluate(`(() => { const e = document.getElementById('deep-empty'); return e.hidden ? '' : e.textContent; })()`);
    const plus = await evaluate('rpiDeep.scene.emptySlots()');
    check(empties.length === 1 && em === 'EMPTY 1' && plus.includes(empties[0]), `DIG made a chamber: "${em}", a "+" on plate ${plus.join(',')}`);
    await shot('1-iv-start-empty-chamber');
    // the ring on the empty plate
    const plate = await evaluate(`(${PLATE_AT})(${JSON.stringify(empties)})`);
    let ring = null;
    if (plate) {
        await click(plate.x, plate.y);
        await sleepMs(500);
        ring = await evaluate(`(() => ({ slot: rpiDeep.ringSlot, rooms: [...document.querySelectorAll('#deep-ring .deep-ring-room')].map((b) => b.dataset.room + (b.classList.contains('is-ok') ? '+' : '-')) }))()`);
    }
    check(!!ring && ring.slot === empties[0] && ring.rooms.length === 4 && ring.rooms.every((r) => r.endsWith('+')),
        `a click on the empty plate opens the ring of four rooms: ${ring ? ring.rooms.join(' ') : 'no plate on screen'}`);
    const farmAt = await centre('#deep-ring .deep-ring-room[data-room="farm"]');
    await mouse('mouseMoved', farmAt.x, farmAt.y);
    await sleepMs(250);
    await shot('2-iv-start-ring');
    const before = await evaluate('({ ore: rpiDeep.state.minerals, farms: rpiDeep.state.rooms.farm })');
    await click(farmAt.x, farmAt.y);
    await sleepMs(400);
    const ordered = await evaluate(`({ ore: rpiDeep.state.minerals, job: (rpiDeep.state.builds || []).find((j) => j.kind === 'room'), ring: rpiDeep.ringSlot })`);
    check(ordered.ore < before.ore && ordered.job && ordered.job.type === 'farm' && ordered.job.slot === empties[0] && ordered.ring === -1,
        `the farm is ordered into that chamber (slot ${ordered.job?.slot}, ore ${Math.round(before.ore)} to ${Math.round(ordered.ore)}), the ring closed`);
    let landed = false;
    for (let i = 0; i < 40 && !landed; i++) { await sleepMs(250); landed = await evaluate(`rpiDeep.layout.slots[${empties[0]}] === 'farm'`); }
    check(landed, 'and it lands in that chamber');
    // the drawer
    await evaluate('debug_deep("stars")');
    await sleepMs(1200);
    const db = await centre('#deep-tree-btn');
    await click(db.x, db.y);
    await sleepMs(500);
    const dr = await evaluate(`(() => ({ open: rpiDeep.drawerOpen, rows: rpiDeep.drawerRows,
        dom: [...document.querySelectorAll('#deep-drawer .deep-dr-row')].map((r) => ({ id: r.dataset.id, buy: r.classList.contains('is-buy'),
            price: (r.querySelector('.deep-dr-price') || {}).textContent || '', color: getComputedStyle(r.querySelector('.deep-dr-name')).color })),
        width: document.getElementById('deep-drawer').getBoundingClientRect().width, tree: !!document.querySelector('#deep-drawer .deep-drawer-tree') }))()`);
    const bright = dr.dom.filter((r) => r.buy);
    const okNow = await evaluate(`(() => { const s = rpiDeep.state; return ${JSON.stringify(bright.map((r) => r.id))}; })()`);
    check(dr.open && bright.length > 0 && bright.every((r) => r.price), `the drawer opens with ${bright.length} bright rows, each priced (${bright.map((r) => r.id).join(', ')})`);
    check(dr.dom.filter((r) => !r.buy).every((r) => r.color !== bright[0].color), 'what cannot be bought now is dim, not bright');
    check(dr.width >= 340 && dr.width <= 1440 * 0.3 && dr.tree, `it takes a quarter of the screen (${Math.round(dr.width)} px), with "the whole tree" at the bottom`);
    void okNow;
    await shot('3-drawer-open');
    // buy the first bright row
    const firstRow = await centre(`#deep-drawer .deep-dr-row.is-buy[data-id="${bright[0].id}"]`);
    const stars0 = await D('state.stars');
    await click(firstRow.x, firstRow.y);
    await sleepMs(400);
    check((await D('state.stars')) < stars0, `a bright row buys (${bright[0].id})`);
    await click(700, 160);
    await sleepMs(500);
    check(!(await D('drawerOpen')), 'a press outside the drawer closes it');

    // ================= L. THE LEVER, the dive, the wake lamp =========================================
    await jump('iv-cryo', { asleep: false });
    await sleepMs(800);
    const l0 = await evaluate(`(() => ({ lamps: [...document.querySelectorAll('#deep-lamps .deep-cryo-lamp')].map((l) => l.dataset.lamp + (l.classList.contains('is-lit') ? ':lit' : ':dark')),
        lever: !document.getElementById('deep-lever-wrap').hidden, price: document.getElementById('deep-lever-price').textContent,
        advice: rpiDeep.instruments.advice }))()`);
    check(l0.lamps.length === 3 && l0.lamps.every((x) => x.endsWith(':lit')), `the three lamps are lit: ${l0.lamps.join(' ')}`);
    check(l0.lever && /^★ /.test(l0.price) && l0.advice === 'SLEEP', `the lever is there with the price "${l0.price}", the panel says ${l0.advice}`);
    await shot('4-the-lever');
    const lv = await centre('#deep-lever');
    await click(lv.x, lv.y);
    await sleepMs(500);
    const off = await evaluate(`[...document.querySelectorAll('#deep-panel .deep-light')].filter((e) => e.classList.contains('is-off')).length`);
    check((await D('state.cryo')) === 0, 'pulling the lever bought Cryo I');
    check(off >= 4, `the panel's lights go out (${off} out half a second in)`);
    for (let i = 0; i < 40 && !(await D('state.asleep')); i++) await sleepMs(100);
    await sleepMs(1800);
    const dv = await evaluate(`(() => ({ shown: !document.getElementById('deep-dive').hidden, word: document.querySelector('#deep-dive .deep-dive-word').textContent,
        years: document.getElementById('deep-dive-years').textContent, clock: getComputedStyle(document.getElementById('deep-time')).visibility }))()`);
    check(dv.shown && dv.word === 'THE COLONY HAS SLEPT' && dv.clock === 'hidden', `the counter takes the middle: "${dv.word} ${dv.years} YEARS"`);
    // time accelerates: the days slept over two equal stretches, the second larger
    const d0 = await D('state.day');
    await sleepMs(1500);
    const d1 = await D('state.day');
    await sleepMs(1500);
    const d2 = await D('state.day');
    const asleepStill = await D('state.asleep');
    check(asleepStill && (d2 - d1) > (d1 - d0) * 1.08, `time accelerates: ${Math.round(d1 - d0)} days, then ${Math.round(d2 - d1)} days in the same 1.5 s`);
    await shot('5-the-dive');
    await evaluate('debug_deep("alarm", "food")');
    for (let i = 0; i < 40 && (await D('state.asleep')); i++) await sleepMs(100);
    await sleepMs(1600);
    const wk = await evaluate(`(() => ({ word: rpiDeep.instruments.alarm, lit: document.getElementById('deep-alarm').classList.contains('is-lit'),
        tapes: [...document.querySelectorAll('#deep-alarm .dymo')].filter((e) => !e.hidden).map((e) => e.textContent),
        off: [...document.querySelectorAll('#deep-panel .deep-light')].filter((e) => e.classList.contains('is-off')).length,
        dive: !document.getElementById('deep-dive').hidden, voice: !document.getElementById('deep-voice').hidden }))()`);
    check(wk.lit && wk.word === 'FOOD' && wk.tapes.join() === 'FOOD', `a forced alarm lights one lamp with one word: ${wk.tapes.join(', ')}`);
    check(wk.off === 0 && !wk.dive, `the panel's lights are back (${wk.off} out), the counter gone`);
    await shot('6-the-wake-lamp');

    // ================= H. THE MIND GOES, and the snap ==============================================
    await jump('iv-watcher');
    await evaluate('debug_deep("stability", 20)');
    let hal = null;
    for (let i = 0; i < 50; i++) {
        await sleepMs(250);
        hal = await D('hallucinating');
        if (hal.scene && (hal.scene.figure || hal.scene.lamp >= 0) && hal.twitch) break;
    }
    check(!!hal && !!hal.scene && (hal.scene.figure || hal.scene.lamp >= 0), `with the mind at 20 the screen hallucinates (${JSON.stringify(hal && hal.scene)}, twitch ${hal && hal.twitch})`);
    await sleepMs(1500);
    await shot('7-deep-sleep-hallucination');
    const base = await evaluate(`(${PLATE_AT})(rpiDeep.layout.slots.map((_, i) => i).filter((i) => !rpiDeep.state.watcher.puzzle || !rpiDeep.state.watcher.puzzle.lamps.includes(i)))`);
    await evaluate('rpiDeep.state.watcher.lastSnapAt = 0');
    if (base) await click(base.x, base.y);
    await sleepMs(700);
    const hal2 = await D('hallucinating');
    check(!!base && !hal2.lamp && !hal2.figure && !hal2.breathe && !hal2.twitch && hal2.scene && !hal2.scene.figure && hal2.scene.lamp < 0,
        `a click on the base snaps them away (${JSON.stringify(hal2)})`);

    // ================= S. SURFACE: the line, the game, and the card fades =========================
    await jump('iv-surface');
    await evaluate('debug_deep("night")');
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) { await sleepMs(250); ready = await evaluate(`(() => { const e = document.getElementById('deep-surface'); return !e.hidden && !e.classList.contains('is-waiting'); })()`); }
    const tape = await evaluate(`[...document.querySelectorAll('#deep-surface-name span')].filter((s) => s.classList.contains('is-tape')).length`);
    check(ready, 'a forced night types its line and the game comes under it');
    check(tape > 0, `night 4: some of SURFACE's letters are on the Watcher's tape (${tape})`);
    await shot('8-surface');
    const rock = await centre('#deep-surface .deep-rps-btn[data-throw="rock"]');
    await click(rock.x, rock.y);
    let result = false;
    // the result is shown once the fists have shaken and turned (the 'line' stage)
    for (let i = 0; i < 30 && !result; i++) { await sleepMs(100); result = await evaluate(`!!(rpiDeep.rps && rpiDeep.rps.log.some((x) => x[0] === 'line'))`); }
    await sleepMs(3000);
    const mid = await D('surfaceShown');
    await sleepMs(4000);
    const late = await evaluate(`(() => ({ card: rpiDeep.surfaceShown, voice: !document.getElementById('deep-voice').hidden,
        stage: getComputedStyle(document.getElementById('deep-night')).opacity }))()`);
    check(result && mid && !late.card && !late.voice, `the card stays a moment (${mid}) and is gone 7 s after the result (card ${late.card}, line ${late.voice})`);

    // night 6: before the question, SURFACE flickers to WATCHER for a moment
    await evaluate('rpiDeep.state.watcher.surface.night = 5; rpiDeep.state.watcher.surface.toLine = 0; debug_deep("night")');
    await sleepMs(500);
    const m1 = await evaluate(`(() => { const e = document.getElementById('deep-surface-name'); return { text: e.textContent, merging: e.classList.contains('is-merging'), typed: document.getElementById('deep-voice-text').textContent }; })()`);
    await sleepMs(2600);
    const m2 = await evaluate(`(() => { const e = document.getElementById('deep-surface-name'); return { text: e.textContent, tape: e.classList.contains('is-tape'), typed: document.getElementById('deep-voice-text').textContent }; })()`);
    check(m1.text === 'WATCHER' && m1.merging && m1.typed === '' && m2.text === 'SURFACE' && m2.tape && m2.typed.length > 0,
        `night 6: the label reads ${m1.text} before the question, then ${m2.text} on the tape as "${m2.typed}" types`);
    await shot('9-night-six');

    check(errors.length === 0, `no errors in the console${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    ws.close();
} catch (e) {
    check(false, `the run broke: ${e.stack || e}`);
} finally {
    await cleanup();
}
console.log(results.join('\n'));
console.log(failed ? `${failed} check(s) failed` : 'all checks hold');
process.exit(failed ? 1 : 0);
