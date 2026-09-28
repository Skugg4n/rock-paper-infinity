// Chapter IV, the cut (v1.52.0): the acceptance check from
// docs/superpowers/specs/2026-09-28-chapter-iv-reduction.md, played in a real browser.
//
//   node scripts/accept-iv-cut.mjs [--seconds 60] [--headed] [--shots DIR]
//
// It serves the repo on a free port, starts Google Chrome headless (new headless, WebGL through
// SwiftShader) with a throwaway profile, drives it over the DevTools protocol with Node's own
// WebSocket (no dependencies), and closes both at the end, pass or fail.
//
// 1. From "IV · Surface": sleep for 60 real seconds, clicking the base (a real mouse click on a
//    plate) every 12 s. Sampled every 250 ms: never two demand cards on screen (Surface and the
//    lamps), stability never under 60 while asleep, and while asleep the advisor is quiet and the
//    feed shows one line at most.
//    Then a test alarm wakes them: the alarm line and the wake-up strip show, and are gone after
//    six and five seconds.
// 2. From "IV · the body": buy a biological step on the pill, see the choice (pill asks, arms
//    glow), Escape (nothing refunded, the pill still asks), ask again, click a plate of one arm:
//    that arm's plates are sealed, the people fell by the step's cost with a red delta on the H
//    bar, its walkers leave, the Watcher's glyph class changed, and a sealed plate says "part of
//    the body" under the cursor.
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
const SLEEP_SECONDS = arg('--seconds', 60);
const CLICK_EVERY = 12;
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
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

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
    server.close();
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

    async function jump(idOf) {
        await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?debug` });
        await sleepMs(1500);
        await evaluate(`import('/src/checkpoints.js').then((m) => { m.jumpTo(${JSON.stringify(idOf)}); return true; })`);
        await sleepMs(2500);
        for (let i = 0; i < 60; i++) {
            if (await evaluate('!!(window.rpiDeep && window.rpiDeep.scene && window.rpiDeep.state.asleep)')) break;
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

    // ================= 1. IV · Surface: one demand at a time, the snap holds ==================
    await jump('iv-surface');
    const start = await evaluate('({ stab: rpiDeep.state.watcher.stability, cryo: rpiDeep.state.cryo })');
    let both = 0, samples = 0, lowAsleep = 100, asleepSamples = 0, clicks = 0, snaps = 0, loudFeed = 0, loudAdvisor = 0, surfaceSeen = 0, lampsSeen = 0;
    const t0 = Date.now();
    let nextClick = t0 + 1000;
    while (Date.now() - t0 < SLEEP_SECONDS * 1000) {
        const s = await evaluate(`(() => {
            const d = window.rpiDeep;
            const surface = !document.getElementById('deep-surface').hidden;
            const lamps = document.getElementById('deep-puzzle').classList.contains('is-on');
            return { asleep: !!d.state.asleep, stab: d.state.watcher.stability, surface, lamps,
                feed: document.getElementById('deep-feed').childElementCount,
                advisor: document.getElementById('deep-advisor').textContent };
        })()`);
        samples++;
        if (s.surface && s.lamps) both++;
        if (s.surface) surfaceSeen++;
        if (s.lamps) lampsSeen++;
        if (s.asleep) {
            asleepSamples++;
            lowAsleep = Math.min(lowAsleep, s.stab);
            if (s.feed > 1) loudFeed++;
            if (s.advisor) loudAdvisor++;
        } else {
            // an alarm woke them: back to sleep, as a player would
            await evaluate('window.debug_deep && window.debug_deep("sleep")');
        }
        if (Date.now() >= nextClick && s.asleep) {
            nextClick += CLICK_EVERY * 1000;
            // a plate that is not one of the lamps (a click there could be an answer, not a snap)
            const target = await evaluate(`(${PLATE_AT})((() => {
                const d = window.rpiDeep, p = d.state.watcher.puzzle;
                const slots = d.layout.slots.map((_, i) => i).filter((i) => !(p && p.lamps.includes(i)));
                const cryo = d.layout.slots.indexOf('cryo');
                return cryo >= 0 ? [cryo, ...slots] : slots;
            })())`);
            if (target) {
                const before = await evaluate('rpiDeep.state.watcher.stability');
                await click(target.x, target.y);
                clicks++;
                await sleepMs(60);
                if (await evaluate('rpiDeep.state.watcher.stability') > before) snaps++;
            }
        }
        await sleepMs(250);
    }
    check(samples > SLEEP_SECONDS * 2 && asleepSamples > SLEEP_SECONDS * 2, `Surface: sampled ${samples} times over ${SLEEP_SECONDS} s, ${asleepSamples} asleep (tier ${start.cryo + 1}, from stability ${Math.round(start.stab)})`);
    check(both === 0, `never two demand cards on screen (Surface seen ${surfaceSeen}, lamps seen ${lampsSeen}, both ${both})`);
    check(clicks >= Math.floor(SLEEP_SECONDS / CLICK_EVERY) && snaps === clicks, `the base clicked every ${CLICK_EVERY} s: ${clicks} clicks, ${snaps} snapped`);
    check(lowAsleep >= 60, `stability stayed at or over 60 asleep: lowest ${lowAsleep.toFixed(1)}`);
    check(loudFeed === 0 && loudAdvisor === 0, `asleep, one voice: the feed showed more than one line ${loudFeed} times, the advisor spoke ${loudAdvisor} times`);

    // ================= the wake: the alarm line for six seconds, the strip for five ==================
    if (!(await evaluate('rpiDeep.state.asleep'))) { await evaluate('debug_deep("sleep")'); await sleepMs(4000); }
    await evaluate('debug_deep("alarm")');
    const wokeAt = Date.now();
    let stripAt = 0;
    for (let i = 0; i < 40 && !stripAt; i++) { if (await evaluate(`!document.getElementById('deep-replay').hidden`)) stripAt = Date.now(); else await sleepMs(50); }
    await sleepMs(Math.max(0, wokeAt + 1800 - Date.now()));
    const w1 = await evaluate(`(() => ({ asleep: rpiDeep.state.asleep, advisor: document.getElementById('deep-advisor').textContent,
        strip: !document.getElementById('deep-replay').hidden, feed: document.getElementById('deep-feed').childElementCount }))()`);
    check(!w1.asleep && /Woke: a test alarm/.test(w1.advisor) && w1.strip && w1.feed <= 3, `at the wake: the alarm line ("${w1.advisor}"), the strip, ${w1.feed} feed lines (3 at most awake)`);
    // the strip counts from when it shows (after the walk out of the hall), the line from the wake
    await sleepMs(Math.max(0, stripAt + 4600 - Date.now()));
    const w2a = await evaluate(`!document.getElementById('deep-replay').hidden`);
    await sleepMs(Math.max(0, stripAt + 5400 - Date.now()));
    const w2 = await evaluate(`!document.getElementById('deep-replay').hidden`);
    await sleepMs(Math.max(0, wokeAt + 7200 - Date.now()));
    const w3 = await evaluate(`document.getElementById('deep-advisor').textContent`);
    check(!!stripAt && w2a && !w2, `the strip shows for 5 s (${Math.round((stripAt - wokeAt) / 100) / 10} s after the wake; at 4.6 s ${w2a ? 'there' : 'gone'}, at 5.4 s ${w2 ? 'there' : 'gone'})`);
    check(!/Woke:/.test(w3), `the alarm line gone after 6 s (now "${w3}")`);

    // ================= 2. IV · the body: the choice, the picture ==================
    await jump('iv-body');
    const b0 = await evaluate(`(() => {
        const d = window.rpiDeep;
        return { humans: d.state.humans, cap: d.state.watcher.capacity,
            glyph: document.querySelector('#deep-watcher .deep-watcher-pulse').className,
            sealed: d.state.watcher.sealed.slice() };
    })()`);
    const pillAt = async () => evaluate(`(() => { const r = document.getElementById('deep-ladder-pill').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    let pill = await pillAt();
    await click(pill.x, pill.y);
    await sleepMs(300);
    const c1 = await evaluate(`(() => {
        const d = window.rpiDeep;
        return { choosing: d.choosing, sealing: d.state.watcher.sealing, humans: d.state.humans, cap: d.state.watcher.capacity,
            sub: document.getElementById('deep-pill-sub').textContent, cands: d.scene.stats.candidates, glow: d.scene.stats.candPlates,
            crosshair: document.getElementById('deep-scene').classList.contains('is-choosing') };
    })()`);
    await shot('1-choose-a-sector');
    check(c1.choosing && c1.sealing === 'brain', `the pill bought Brain tissue and asks for a sector (choosing ${c1.choosing}, waiting ${c1.sealing})`);
    check(c1.sub === 'Choose a sector to seal', `the pill reads "${c1.sub}"`);
    check(c1.cands.length === 4 && c1.glow > 0 && c1.crosshair, `the arms glow as candidates: sectors ${c1.cands.join(',')}, ${c1.glow} plates, crosshair ${c1.crosshair}`);
    check(c1.humans === b0.humans && c1.cap < b0.cap, `paid in capacity (${b0.cap} to ${c1.cap}), nobody taken yet (${c1.humans})`);
    await key('Escape');
    await sleepMs(200);
    const c2 = await evaluate(`(() => { const d = window.rpiDeep; return { choosing: d.choosing, sealing: d.state.watcher.sealing, cap: d.state.watcher.capacity, glow: d.scene.stats.candPlates, asks: document.getElementById('deep-ladder-pill').classList.contains('is-asking') }; })()`);
    // the machines keep filling the pool while they sleep; a refund would put the step's 120 back
    check(!c2.choosing && c2.sealing === 'brain' && c2.cap - c1.cap < 60 && c2.glow === 0 && c2.asks,
        `Escape: the choice put away (choosing ${c2.choosing}, glow ${c2.glow}), nothing refunded (capacity ${Math.round(c1.cap)} to ${Math.round(c2.cap)}), the pill still asks (${c2.asks})`);
    pill = await pillAt();
    await click(pill.x, pill.y);
    await sleepMs(300);
    check(await evaluate('rpiDeep.choosing'), 'a click on the pill asks again');
    // a plate of one arm, found where the camera shows it
    const target = await evaluate(`(${PLATE_AT})(rpiDeep.layout.slots.map((_, i) => i).reverse())`);
    check(!!target, `a plate to click: chamber ${target?.slot}`);
    await mouse('mouseMoved', target.x, target.y);
    await sleepMs(200);
    const hover = await evaluate('rpiDeep.scene.stats.candHover');
    await shot('2-hover-an-arm');
    await click(target.x, target.y);
    await sleepMs(250);
    const c3 = await evaluate(`(async () => {
        const d = window.rpiDeep;
        const { sectorOf } = await import('/src/phase4/layout.js');
        const k = sectorOf(${target.slot});
        const own = d.layout.slots.map((_, i) => i).filter((i) => sectorOf(i) === k);
        return { k, sealed: d.state.watcher.sealed.slice(), sealing: d.state.watcher.sealing, humans: d.state.humans,
            own: own.length, bodyPlates: d.scene.stats.bodyPlates, bodySectors: d.scene.stats.bodySectors,
            leaving: d.scene.stats.leaving, delta: document.getElementById('deep-delta-H').textContent,
            deltaOn: document.getElementById('deep-delta-H').classList.contains('is-drop'),
            glyph: document.querySelector('#deep-watcher .deep-watcher-pulse').className,
            choosing: d.choosing, bought: d.state.watcher.bought.slice(-1)[0], drop: d.hDrop };
    })()`);
    await shot('3-sealed');
    check(hover === c3.k, `the arm under the cursor glows more (hovered sector ${hover}, chosen ${c3.k})`);
    check(c3.sealed.includes(c3.k) && !c3.sealing && c3.bought === 'brain' && !c3.choosing, `THAT arm sealed: sector ${c3.k + 1} (sealed ${c3.sealed.map((x) => x + 1).join(',')})`);
    check(c3.bodySectors.includes(c3.k) && c3.bodyPlates === c3.own, `every plate of the arm is part of the body: ${c3.bodyPlates} of ${c3.own}`);
    // Brain tissue takes a tenth of the colony as it stood at the click (watcher.js LADDER, peopleFor);
    // the colony keeps growing asleep, so the drop is read off the H bar's own roll
    const people = c3.drop ? Math.max(1, Math.round(c3.drop.from * 0.10)) : NaN;
    check(!!c3.drop && Math.abs(c3.drop.from - c3.drop.to - people) < 1e-6, `people fell by the step's cost: ${Math.round(c3.drop?.from)} to ${Math.round(c3.drop?.to)} (a tenth: ${people})`);
    check(c3.deltaOn && c3.delta === c3.drop?.text && c3.delta.startsWith('\u2212'), `the H bar shows "${c3.delta}" in red`);
    check(!!c3.leaving && c3.leaving.sector === c3.k && c3.leaving.dots > 0, `its walkers leave: ${c3.leaving?.dots} dots`);
    check(c3.glyph !== b0.glyph && /is-dot/.test(c3.glyph), `the Watcher's glyph changed: "${b0.glyph}" to "${c3.glyph}"`);
    // the walkers go on the scene's clock (frames, capped at 50 ms each: slower in a software GL),
    // the delta on the wall clock
    await sleepMs(2600);
    const c4 = await evaluate(`(() => ({ delta: document.getElementById('deep-delta-H').textContent, head: document.getElementById('deep-head-H').textContent }))()`);
    check(c4.delta === '', `after 2.6 s the delta has faded (H reads ${c4.head})`);
    let gone = false;
    for (let i = 0; i < 40 && !gone; i++) { gone = !(await evaluate('rpiDeep.scene.stats.leaving')); if (!gone) await sleepMs(250); }
    check(gone, 'the walkers are gone');
    // a sealed plate says what it is under the cursor
    await mouse('mouseMoved', target.x + 2, target.y + 1);
    await sleepMs(300);
    const tip = await evaluate(`(() => { const t = document.getElementById('deep-body-tip'); return { on: !t.hidden, text: t.textContent }; })()`);
    await shot('4-part-of-the-body');
    check(tip.on && tip.text === 'part of the body', `a sealed plate's tooltip: "${tip.text}" (${tip.on ? 'shown' : 'hidden'})`);
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
