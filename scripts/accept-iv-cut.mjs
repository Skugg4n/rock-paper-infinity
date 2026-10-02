// Chapter IV, the cut (v1.52.0): the acceptance check from
// docs/superpowers/specs/2026-09-28-chapter-iv-reduction.md, played in a real browser.
//
//   node scripts/accept-iv-cut.mjs [--seconds 60] [--headed] [--shots DIR] [--port N]
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
// deep-tree (step 1 of the tree): the level, automate and longer-sleep buttons and the Watcher's
// pill are gone; the tree has them. So, before 1 and 2:
// 0. From "IV · the deep" (awake): the old buttons are gone, the way up is a greyed teaser
//    ("survival 85 % needed"); the tree button opens the panel, a hovered Seam node writes the info
//    box, a click orders a mine level (paid, in the queue, built a few days later), Escape closes the
//    panel, and no button in the column moved.
// 1. also: from "IV · Surface" the tree shows the WATCHER branch (the steps bought filled) and
//    Surface's nodes greyed with the hollow ring.
// 2. the biological step is bought on the tree's BIOLOGICAL branch, and the line under the meter
//    asks for the sector (it was the pill).
// deep-voice (step 2 of the tree): Surface's voice and its gifts.
// V. From "IV · Surface" (three lines said, Lossless relay and Cold storage bought): force a
//    night (debug_deep('night')): the line types itself letter by letter and stays, the game with
//    Surface beside it, no lamps; the tree button carries the night's mark. Wake: the line is gone
//    from the screen; in the tree's night log it is the fourth line, with its dotted thread to
//    Quiet hands, whose ring is filled and which can be bought; buying it changes the rule's
//    output (the generators burn less ore, the rooms draw less power).
// deep-machine (step 3 of the tree): the machine.
// M. From "IV · the deep" (awake): the machine stands on top (its own plate over the lid), in the
//    window at the home view; the old floating glyph on the lid is gone; under the cursor it says
//    "The machine plays. N energy a day. Each win is a star." with the live N; and the stars a day
//    (and the machine's tempo) change when the feed changes (debug_deep('feed', n)).
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
    const nodeAt = (id) => centre(`#deep-tree g.tn[data-id="${id}"] .plate`);
    const COLUMN_RECTS = `(() => [...document.querySelectorAll('.deep-btn-col .btn')].filter((b) => b.offsetParent)
        .map((b) => { const r = b.getBoundingClientRect(); return b.id + ':' + Math.round(r.left) + ',' + Math.round(r.top); }).join(' '))()`;
    const info = () => evaluate(`(() => { const q = (c) => document.querySelector('#deep-tree-info .' + c).textContent;
        return { name: q('ib-name'), lvl: q('ib-lvl'), cost: q('ib-cost'), eff: q('ib-eff'), x: q('ib-x') }; })()`);

    // ================= 0. IV · the deep: the tree, and the buttons it replaced ==================
    await jump('iv-start', { asleep: false });
    const gone0 = await evaluate(`['deep-level-btn', 'deep-auto-btn', 'deep-cryo-up', 'deep-ladder', 'deep-ladder-pill', 'deep-group-grow']
        .filter((id) => document.getElementById(id))`);
    check(gone0.length === 0, `the level, automate and longer-sleep buttons and the Watcher's pill are gone${gone0.length ? `: still ${gone0.join(', ')}` : ''}`);
    const up0 = await evaluate(`(() => { const b = document.getElementById('deep-ascend-btn'); return { locked: b.classList.contains('is-locked'),
        caption: document.getElementById('deep-ascend-caption').textContent, shown: b.classList.contains('is-captioned') }; })()`);
    check(up0.locked && up0.shown && up0.caption === 'survival 85 % needed', `the way up is a greyed teaser: "${up0.caption}" (locked ${up0.locked})`);
    await evaluate('debug_deep("stars")');
    await sleepMs(300);
    const col0 = await evaluate(COLUMN_RECTS);
    const badge0 = await evaluate(`document.getElementById('deep-tree-badge').textContent`);
    check(Number(badge0) > 0, `the tree button's badge counts what can be bought: ${badge0}`);
    const treeBtn = await centre('#deep-tree-btn');
    await click(treeBtn.x, treeBtn.y);
    await sleepMs(400);
    const open0 = await evaluate(`({ open: rpiDeep.treeOpen, shown: !document.getElementById('deep-tree').hidden,
        watcher: rpiDeep.treeDrawn.watchdog?.visible, seam: rpiDeep.treeDrawn.seam?.status })`);
    check(open0.open && open0.shown, `the tree button opens the panel (open ${open0.open})`);
    check(open0.watcher === false && open0.seam === 'buyable', `at the descent: no WATCHER branch yet (${open0.watcher}), Seam can be bought (${open0.seam})`);
    const seam = await nodeAt('seam');
    await mouse('mouseMoved', seam.x, seam.y);
    await sleepMs(350);
    const i1 = await info();
    const lit = await evaluate(`document.querySelectorAll('#deep-tree .tt-lit path').length`);
    check(i1.name === 'SEAM' && i1.lvl === '0 / 20' && i1.cost === 'next ★ 4.4 k' && /^Doubles every mine\./.test(i1.eff) && /^click/.test(i1.x),
        `the info box on Seam: "${i1.name} | ${i1.lvl} | ${i1.cost} | ${i1.eff} | ${i1.x}"`);
    check(lit === 1, `the trace from the root lights on hover (${lit} lit)`);
    await shot('0-the-tree');
    const s0 = await evaluate('({ stars: rpiDeep.state.stars, perDay: rpiDeep.report.stars, level: rpiDeep.state.level.mine })');
    await click(seam.x, seam.y);
    await sleepMs(300);
    const s1 = await evaluate(`({ stars: rpiDeep.state.stars, level: rpiDeep.state.level.mine,
        order: rpiDeep.state.builds.filter((j) => j.kind === 'level' && j.type === 'mine').length })`);
    const i2 = await info();
    // the colony earns its stars a day while the click travels; the price is 4.4 k
    const paid = s0.stars - s1.stars;
    check(paid <= 4400 + 1 && paid >= 4400 - 2 * s0.perDay - 1 && s1.order === 1 && s1.level === 0,
        `a click on Seam ordered a mine level: ${Math.round(paid)} stars paid (less ${Math.round(s0.perDay)} a day earned), ${s1.order} order in the queue, level ${s1.level} until it is built`);
    check(i2.lvl === '0 / 20 · 1 ordered' && i2.cost === 'next ★ 40 k', `the info box follows: "${i2.lvl} | ${i2.cost}"`);
    const queued = await evaluate(`document.getElementById('deep-queue').textContent`);
    check(/lv mine/.test(queued), `the order is in the queue strip with its ring ("${queued.trim()}")`);
    await key('Escape');
    await sleepMs(300);
    const col1 = await evaluate(COLUMN_RECTS);
    check(!(await evaluate('rpiDeep.treeOpen')) && (await evaluate(`document.getElementById('deep-tree').hidden`)), 'Escape closes the panel');
    check(col0 === col1, `no button in the column moved${col0 === col1 ? '' : `: ${col0} / ${col1}`}`);
    for (let i = 0; i < 40 && (await evaluate('rpiDeep.state.level.mine')) < 1; i++) await sleepMs(250);
    check((await evaluate('rpiDeep.state.level.mine')) === 1, 'the order lands: the mines are at level 1, Seam reads 1');

    // ================= M. IV · the deep: the machine on top ==================
    await jump('iv-start', { asleep: false });
    const m0 = await evaluate(`(() => { const d = rpiDeep, m = d.scene.stats.machine;
        return { m, at: d.scene.screenOfMachine(), oldGlyph: document.querySelectorAll('#deep-labels .deep-machine').length,
            feed: d.state.feed, fed: d.report.fed, perDay: d.report.stars, games: d.report.games,
            shown: document.getElementById('deep-stars-day').textContent }; })()`);
    check(!!m0.m && m0.m.onTop && m0.m.y > 1 && m0.m.merged > 0, `the machine stands on its own plate on top of the colony (y ${m0.m?.y}, ${m0.m?.meshes} meshes, ${m0.m?.merged} merged)`);
    check(!!m0.at && m0.at.x > 0 && m0.at.x < 1440 && m0.at.y > 0 && m0.at.y < 900, `the home view frames it: at ${m0.at ? `${Math.round(m0.at.x)}, ${Math.round(m0.at.y)}` : 'off the window'}`);
    check(m0.oldGlyph === 0, `the old floating glyph on the lid is gone (${m0.oldGlyph})`);
    check(m0.feed === 0 && m0.fed > 0 && Math.abs(m0.perDay - m0.games / 3) < 1e-6 * m0.perDay, `fed ${m0.fed.toFixed(2)} energy a day: ${Math.round(m0.games)} games, ${m0.perDay.toFixed(1)} stars a day (one in three)`);
    await mouse('mouseMoved', m0.at.x, m0.at.y);
    await sleepMs(400);
    const m1 = await evaluate(`({ tip: rpiDeep.machineTip, el: document.getElementById('deep-machine-tip').textContent,
        on: !document.getElementById('deep-machine-tip').hidden, hit: rpiDeep.scene.machineAt(${m0.at.x}, ${m0.at.y}) })`);
    const n0 = m0.fed < 9.95 ? String(Math.round(m0.fed * 10) / 10) : null;
    check(m1.on && m1.hit && /^The machine plays\. .+ energy a day\. Each win is a star\.$/.test(m1.el) && (!n0 || m1.el.includes(` ${n0} energy`)),
        `the hover over the machine: "${m1.el}" (${m1.on ? 'shown' : 'hidden'})`);
    await shot('M-1-the-machine-on-top');
    const t0m = await evaluate('rpiDeep.scene.stats.machine.throws');
    await evaluate('debug_deep("feed", 6)');
    await sleepMs(300);
    const m2 = await evaluate(`({ feed: rpiDeep.state.feed, fed: rpiDeep.report.fed, perDay: rpiDeep.report.stars,
        throws: rpiDeep.scene.stats.machine.throws, drive: rpiDeep.scene.stats.machine.drive, tip: rpiDeep.machineTip.text })`);
    check(m2.feed === 6 && m2.fed > m0.fed * 3 && m2.perDay > m0.perDay * 2, `fed more (level ${m2.feed}): ${m0.fed.toFixed(1)} to ${m2.fed.toFixed(1)} energy a day, ${m0.perDay.toFixed(1)} to ${m2.perDay.toFixed(1)} stars a day`);
    check(m2.throws > t0m && m2.tip !== m1.el, `and it plays faster (${t0m.toFixed(2)} to ${m2.throws.toFixed(2)} throws a second); the hover follows: "${m2.tip}"`);
    await shot('M-2-the-machine-fed');
    await evaluate('debug_deep("feed", 0)');
    await sleepMs(200);
    const m3 = await evaluate('({ feed: rpiDeep.state.feed, perDay: rpiDeep.report.stars })');
    check(m3.feed === 0 && m3.perDay < m2.perDay, `starved again (level ${m3.feed}): ${m3.perDay.toFixed(1)} stars a day`);
    await mouse('mouseMoved', 5, 5);

    // ================= V. IV · Surface: the voice in the night, the gift in the tree ==================
    await jump('iv-surface');
    const v0 = await evaluate(`({ night: rpiDeep.state.watcher.surface.night, voice: !document.getElementById('deep-voice').hidden,
        mark: document.getElementById('deep-tree-btn').classList.contains('has-night') })`);
    check(v0.night === 3 && !v0.voice && !v0.mark, `IV · Surface: three lines said (${v0.night}), no line on screen, no mark on the tree button`);
    await evaluate('debug_deep("night")');
    await sleepMs(250);
    const v1 = await evaluate(`({ v: rpiDeep.voice, card: !document.getElementById('deep-surface').hidden,
        lamps: document.getElementById('deep-puzzle').classList.contains('is-on'),
        pe: getComputedStyle(document.getElementById('deep-voice')).pointerEvents,
        mark: document.getElementById('deep-tree-btn').classList.contains('has-night'),
        size: parseFloat(getComputedStyle(document.getElementById('deep-voice')).fontSize),
        feedSize: parseFloat(getComputedStyle(document.getElementById('deep-feed')).fontSize),
        night: rpiDeep.state.watcher.surface.night, opened: rpiDeep.state.tree.opened.slice() })`);
    check(v1.night === 4 && v1.opened.includes('quiet'), `the forced night is night 4 and opens Quiet hands (${v1.opened.join(', ')})`);
    check(!!v1.v && v1.v.shown && v1.v.typing && v1.v.typed.length > 0 && v1.v.typed.length < v1.v.text.length && v1.v.text.startsWith(v1.v.typed),
        `the line types itself: "${v1.v?.typed}" of "${v1.v?.text}"`);
    check(v1.card && !v1.lamps, `the game with Surface shares the screen with it (card ${v1.card}), the lamps do not (${v1.lamps})`);
    check(v1.pe === 'none' && v1.size > v1.feedSize, `nothing on the line can be clicked (pointer-events ${v1.pe}); its mono is larger (${v1.size} px against the feed's ${v1.feedSize})`);
    check(v1.mark, 'the tree button carries the night\'s mark');
    await shot('V-1-the-voice-typing');
    await sleepMs(Math.ceil(v1.v.text.length * 35) + 2500);
    const v2 = await evaluate(`({ v: rpiDeep.voice, asleep: rpiDeep.state.asleep })`);
    check(v2.asleep && v2.v && v2.v.shown && !v2.v.typing && v2.v.typed === v2.v.text, `the line is whole and stays while they sleep: "${v2.v?.typed}"`);
    await shot('V-2-the-voice-stays');
    await evaluate('debug_deep("alarm")');
    for (let i = 0; i < 40 && (await evaluate('rpiDeep.state.asleep')); i++) await sleepMs(100);
    await sleepMs(2200);
    const v3 = await evaluate(`({ asleep: rpiDeep.state.asleep, voice: !document.getElementById('deep-voice').hidden, v: rpiDeep.voice })`);
    check(!v3.asleep && !v3.voice && !v3.v, `awake, the line is gone from the screen (shown ${v3.voice})`);
    const fuel0 = await evaluate('({ fuel: rpiDeep.report.fuelWanted, need: rpiDeep.report.energyNeed, stars: rpiDeep.state.stars })');
    const tbv = await centre('#deep-tree-btn');
    await click(tbv.x, tbv.y);
    await sleepMs(500);
    const v4 = await evaluate(`(() => { const d = rpiDeep.treeDrawn;
        return { open: rpiDeep.treeOpen, log: rpiDeep.treeLog,
            threads: [...document.querySelectorAll('#deep-tree path.log-thread')].map((p) => p.dataset.to),
            lines: [...document.querySelectorAll('#deep-tree .tt-log text.log-line')].map((t) => t.textContent).join(' '),
            quiet: d.quiet && { status: d.quiet.status, opened: d.quiet.opened, price: d.quiet.priceText },
            ring: !!document.querySelector('#deep-tree g.tn[data-id="quiet"] circle.gift-ring'),
            mark: document.getElementById('deep-tree-btn').classList.contains('has-night') }; })()`);
    const last = v4.log[v4.log.length - 1];
    check(v4.open && v4.log.length === 4 && last && last.n === 4 && last.to === 'quiet' && last.thread,
        `the night log holds the four lines, the last tied to Quiet hands: ${v4.log.map((l) => `${l.n}>${l.to}${l.thread ? '' : '(no thread)'}`).join(' ')}`);
    check(v4.lines.includes('What use are they?') && v4.threads.includes('quiet') && v4.threads.includes('lossless'),
        `the log's text and its dotted threads are drawn (threads to ${v4.threads.join(', ')})`);
    check(!!v4.quiet && v4.quiet.status === 'buyable' && v4.quiet.opened && v4.ring, `Quiet hands: ring filled (${v4.ring}), ${v4.quiet?.status} at ${v4.quiet?.price}`);
    check(!v4.mark, 'opening the tree takes the mark away');
    const quietAt = await nodeAt('quiet');
    await mouse('mouseMoved', quietAt.x, quietAt.y);
    await sleepMs(250);
    const iq = await evaluate(`document.querySelector('#deep-tree-info .ib-q').textContent`);
    check(iq.includes('Your humans. What use are they?'), `the info box quotes the line that opened it: ${iq}`);
    await shot('V-3-the-night-log');
    const longAt = await centre('#deep-tree g.tn[data-id="longcount"] rect[stroke-dasharray]');
    await mouse('mouseMoved', longAt.x, longAt.y);
    await sleepMs(200);
    const il = await info();
    check(il.x === 'Not ours to open.', `a node Surface has not opened says "${il.x}"`);
    await mouse('mouseMoved', quietAt.x, quietAt.y);
    await sleepMs(100);
    await click(quietAt.x, quietAt.y);
    await sleepMs(400);
    const fuel1 = await evaluate(`({ fuel: rpiDeep.report.fuelWanted, need: rpiDeep.report.energyNeed, stars: rpiDeep.state.stars,
        bought: rpiDeep.state.tree.bought.slice(), status: rpiDeep.treeDrawn.quiet.status })`);
    check(fuel1.bought.includes('quiet') && fuel1.status === 'bought' && fuel0.stars - fuel1.stars > 4e15,
        `a click buys Quiet hands (${fuel1.status}, ${(fuel0.stars - fuel1.stars).toPrecision(2)} stars paid)`);
    check(fuel1.fuel < fuel0.fuel / 4 && fuel1.need < fuel0.need, `the rule's output changes: the generators burn ${fuel0.fuel.toPrecision(3)} to ${fuel1.fuel.toPrecision(3)} ore a day, the rooms draw ${fuel0.need.toPrecision(3)} to ${fuel1.need.toPrecision(3)} energy`);
    await key('Escape');
    await sleepMs(200);

    // ================= 1. IV · Surface: one demand at a time, the snap holds ==================
    await jump('iv-surface');
    // the tree asleep: the WATCHER branch, the steps bought, Surface's nodes greyed
    const tb = await centre('#deep-tree-btn');
    await click(tb.x, tb.y);
    await sleepMs(400);
    const t1 = await evaluate(`(() => { const d = rpiDeep.treeDrawn;
        const ring = (id) => !!document.querySelector('#deep-tree g.tn[data-id="' + id + '"] circle')
            && !!document.querySelector('#deep-tree g.tn[data-id="' + id + '"] rect[stroke-dasharray]');
        return { open: rpiDeep.treeOpen, watcher: ['watchdog', 'scheduler', 'deepread', 'nightvision', 'cooling', 'secondcore', 'mast', 'reactor'].map((id) => d[id].visible && d[id].status),
            surface: ['lossless', 'cold', 'longcount', 'quiet', 'question'].map((id) => d[id].status + (ring(id) ? '+ring' : '')),
            gifts: ['lossless', 'cold'].map((id) => d[id].status + (document.querySelector('#deep-tree g.tn[data-id="' + id + '"] circle.gift-ring') ? '+filled' : '')),
            seam: d.seam.reason }; })()`);
    await shot('1-the-tree-asleep');
    check(t1.open && t1.watcher.slice(0, 6).every((x) => x === 'bought') && t1.watcher[6] && t1.watcher[6] !== 'bought',
        `from IV · Surface the WATCHER branch shows: ${t1.watcher.join(', ')}`);
    // deep-voice: Lossless relay and Cold storage are bought; the other three still wait for Surface
    check(t1.surface.slice(2).every((x) => x === 'surface+ring'), `Surface's unopened nodes greyed with the hollow ring: ${t1.surface.join(', ')}`);
    check(t1.gifts.every((x) => x === 'bought+filled'), `its gifts bought, the ring filled: ${t1.gifts.join(', ')}`);
    check(t1.seam === 'The colony is asleep: wake it to buy.', `asleep, a level says why not: "${t1.seam}"`);
    await key('Escape');
    await sleepMs(300);
    check(!(await evaluate('rpiDeep.treeOpen')) && (await evaluate('rpiDeep.state.asleep')), 'Escape closes the tree; the colony sleeps on');
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
    /** The biological step, bought on the tree: open it, click Brain tissue. */
    const brainOnTree = async () => {
        const b = await centre('#deep-tree-btn');
        await click(b.x, b.y);
        await sleepMs(400);
        const n = await nodeAt('brain');
        await mouse('mouseMoved', n.x, n.y);
        await sleepMs(200);
        const said = await info();
        await click(n.x, n.y);
        await sleepMs(300);
        return said;
    };
    const ib = await brainOnTree();
    check(ib.name === 'BRAIN TISSUE' && /^BIOLOGICAL: /.test(ib.eff), `the tree's BIOLOGICAL branch: "${ib.name} | ${ib.cost} | ${ib.eff}"`);
    const c1 = await evaluate(`(() => {
        const d = window.rpiDeep;
        return { choosing: d.choosing, sealing: d.state.watcher.sealing, humans: d.state.humans, cap: d.state.watcher.capacity,
            sub: document.getElementById('deep-watcher-ask').hidden ? '' : document.getElementById('deep-watcher-ask').textContent,
            tree: d.treeOpen, cands: d.scene.stats.candidates, glow: d.scene.stats.candPlates,
            crosshair: document.getElementById('deep-scene').classList.contains('is-choosing') };
    })()`);
    await shot('1-choose-a-sector');
    check(c1.choosing && c1.sealing === 'brain' && !c1.tree, `the tree bought Brain tissue, closed, and asks for a sector (choosing ${c1.choosing}, waiting ${c1.sealing})`);
    check(c1.sub === 'BIOLOGICAL · Choose a sector to seal', `the line under the meter reads "${c1.sub}"`);
    check(c1.cands.length === 4 && c1.glow > 0 && c1.crosshair, `the arms glow as candidates: sectors ${c1.cands.join(',')}, ${c1.glow} plates, crosshair ${c1.crosshair}`);
    check(c1.humans === b0.humans && c1.cap < b0.cap, `paid in capacity (${b0.cap} to ${c1.cap}), nobody taken yet (${c1.humans})`);
    await key('Escape');
    await sleepMs(200);
    const c2 = await evaluate(`(() => { const d = window.rpiDeep; return { choosing: d.choosing, sealing: d.state.watcher.sealing, cap: d.state.watcher.capacity, glow: d.scene.stats.candPlates, asks: !document.getElementById('deep-watcher-ask').hidden }; })()`);
    // the machines keep filling the pool while they sleep; a refund would put the step's 120 back
    check(!c2.choosing && c2.sealing === 'brain' && c2.cap - c1.cap < 60 && c2.glow === 0 && c2.asks,
        `Escape: the choice put away (choosing ${c2.choosing}, glow ${c2.glow}), nothing refunded (capacity ${Math.round(c1.cap)} to ${Math.round(c2.cap)}), the line still asks (${c2.asks})`);
    const ib2 = await brainOnTree();
    check((await evaluate('rpiDeep.choosing')) && ib2.x === 'Paid. Choose a sector to seal.', `a click on the node in the tree asks again (it said "${ib2.x}")`);
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
