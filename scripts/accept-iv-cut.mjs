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
// deep-fix2 (Ola's notes on v1.73.0), checked on the way:
//  1. one ring per order: a room ordered shows its ring on its own plate only, never on the other
//     plates of its kind; a level or an automation shows none on the plates (its ring is the drawer's row);
//  2. the "+" where the next chamber goes: its hover shows the price with the pickaxe, a click digs;
//  3. with the drawer open, DIG digs and the drawer stays open; only a press on the scene closes it;
//  4. opening and closing the drawer moves nothing: DIG, the drawer button and the lever stay put;
//  7. the price is the fourth lamp ("★ 15 k"), dim without the stars, and then there is no lever;
//  8. the night's line is typed once, through the throw and the result.
// deep-grow (movement III · GROW, the body):
// G. From "IV · the question answered": the panel overgrows; after ten seconds its labels read MASS,
//    FEED, PULSE, FLESH (the tapes peeled) and the advice INSTRUMENTS: SPREAD. A chamber the body
//    touches glows; hovered it says what it costs in plain words; a click takes it: it is body.
// N. From "IV · the body": starved (the people gone), an edge goes necrotic within a body year; fed
//    (people back), it revives.
// R. From "IV · ready to rise": the hands are on the machine, the lever is back and reads RISE;
//    pulling it, the body breaks the crust, the two lines type, and the V card reads UNITY. A reload
//    shows the wall again.
// deep-swap (the strata view is the default; the 3D view stays selectable):
//   --view strata | --view 3d   run against one view; without --view the script runs itself once for
//   each and fails if either fails. In the strata run the shots are named swap-*.
// V. With no view in the URL the strata view is made (and the ☰ menu offers the other); with
//    ?view=3d the 3D one.
// A. From "IV · the body": every chamber that glows as reachable lies beside a body chamber ON THE
//    SCREEN (no farther from one than 1.3 times the lid's first chamber is from the lid; 1.6 in the
//    3D view's perspective).
// K. From "IV · the Watcher" (asleep, an old save without layers): the layers are rebuilt from the
//    years slept and the sleeps (one per sleep); after a reload the same layers are laid again.
// deep-grow2 (a taste of flesh, the question as a choice, the feeding loop, one choice at a time, the
// people counter, the body dreams, the heart is pumped):
// P. From "IV · the deep": the people counter stands top right beside ore and stars, with its glyph.
// F. From "IV · the graft": the panel says GRAFT A ROOM; a built room's hover offers the graft; a click
//    turns it to flesh and "×5" floats over it.
// Q. The question's drawer row reads its three lines.
// E. From "IV · the question answered": the drawer opens empty (no drawer button, one verb: take a
//    chamber); taking chambers until FEED falls brings VATS into the drawer; the lamps read as counts.
// N. From "IV · the body": a starving edge greys; fed, it revives by itself.
// D. A chamber out of reach is marked (a red thread); the lever reads DREAM; pulled, the body dreams,
//    grows to the mark and wakes on REACHED.
// H. The heart: a click on the lid pumps.
// --shots DIR also writes grow2-*.png of these moments in the strata view.
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
const viewAt = process.argv.indexOf('--view');
const VIEW = viewAt > 0 ? (process.argv[viewAt + 1] === '3d' ? '3d' : 'strata') : null;
if (!VIEW) {
    // both views, one after the other: the strata (the default) and the 3D one
    let bad = 0;
    for (const v of ['strata', '3d']) {
        console.log(`==== the ${v} view`);
        const code = await new Promise((resolve) => {
            const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), '--view', v], { stdio: 'inherit' });
            child.on('exit', (c) => resolve(c ?? 1));
        });
        if (code) bad++;
    }
    console.log(bad ? `${bad} view(s) failed` : 'both views hold');
    process.exit(bad ? 1 : 0);
}

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
        if (msg.method === "Runtime.exceptionThrown") { const d = msg.params.exceptionDetails; errors.push(`${d?.exception?.description || d?.text} @ ${d?.url || ""}:${d?.lineNumber}:${d?.columnNumber} ${(d?.stackTrace?.callFrames || []).slice(0, 4).map((f) => `${f.functionName}@${f.url.split("/").pop()}:${f.lineNumber}`).join(" < ")}`); }
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' ') + (process.env.ACCEPT_STACK ? ` ${(msg.params.stackTrace?.callFrames || []).slice(0, 5).map((f) => `${f.functionName}@${f.url.split('/').pop()}:${f.lineNumber}`).join(' < ')}` : ''));
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
        fs.writeFileSync(path.join(SHOTS, `${VIEW === 'strata' ? 'swap-' : ''}${name}.png`), Buffer.from(out.result.data, 'base64'));
    };
    // deep-grow2: the second pass's shots, in the strata view only
    const shot2 = async (name) => {
        if (!SHOTS || VIEW !== 'strata') return;
        fs.mkdirSync(SHOTS, { recursive: true });
        const out = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(SHOTS, `grow2-${name}.png`), Buffer.from(out.result.data, 'base64'));
    };
    const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: 27 }); };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    async function jump(idOf, { asleep = true, view = VIEW } = {}) {
        await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?debug${view ? `&view=${view}` : ''}` });
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
    // a lamp where nothing is: a chamber's slot, or 'rock' in the strata view (a room never dug); -1 is none
    const lampOn = (l) => l !== -1 && l !== undefined && l !== null;
    // ================= V. WHICH VIEW =============================================================
    // the strata run comes in by the plain URL (no view named): the strata view is the default
    await jump('iv-start', { asleep: false, view: VIEW === 'strata' ? null : VIEW });
    await sleepMs(1500);
    const vw = await evaluate(`({ view: rpiDeep.view, dom: document.getElementById('phase-deep').dataset.view,
        item: (document.getElementById('deep-view-toggle') || {}).textContent || '' })`);
    check(vw.view === VIEW && vw.dom === VIEW && vw.item === `View · ${VIEW === '3d' ? '3D' : 'strata'}`,
        `V. ${VIEW === 'strata' ? 'with no view in the URL' : 'with ?view=3d'} the ${vw.view} view draws the colony; the menu reads "${vw.item}"`);

    // ================= P. THE PEOPLE, beside ore and stars ==========================================
    const pc = await evaluate(`(() => { const r = document.getElementById('deep-people-row'); const b = r && r.getBoundingClientRect();
        const ore = document.getElementById('deep-ore-row').getBoundingClientRect();
        return { shown: !!b && b.width > 0, count: document.getElementById('deep-people').textContent, glyph: !!r.querySelector('svg, i'), right: Math.abs(b.right - ore.right) < 4 }; })()`);
    check(pc.shown && /^[\d.]+( k| M| B)?$/.test(pc.count) && pc.glyph && pc.right, `P. the people counter stands beside ore and stars: "${pc.count}" with its glyph`);

    // ================= deep-econ: Ola's playtest of v1.78.0 =========================================
    const econShot = async (name) => {
        if (!SHOTS || VIEW !== 'strata') return;
        fs.mkdirSync(SHOTS, { recursive: true });
        const out = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(SHOTS, `econ-${name}.png`), Buffer.from(out.result.data, 'base64'));
    };
    /** Where the lever's ball, pivot and slot are, and the arm's span (B333). */
    const LEVER = `(() => { const box = (s) => document.querySelector(s).getBoundingClientRect();
        const k = box('#deep-lever .deep-lever-knob'), p = box('#deep-lever .deep-lever-pivot'), sl = box('#deep-lever .deep-lever-slot'), a = box('#deep-lever .deep-lever-arm');
        return { ball: k.top + k.height / 2, pivot: p.top + p.height / 2, top: sl.top, bottom: sl.bottom, armTop: a.top, armBottom: a.bottom,
            down: document.getElementById('deep-lever-wrap').classList.contains('is-down') }; })()`;
    // X. THE LEVER pivots in the middle of its slot: up, the ball at the top end, the arm from it to the pivot
    await jump('iv-late', { asleep: false });
    const e_up = await evaluate(LEVER);
    const e_mid = (e_up.top + e_up.bottom) / 2;
    check(!e_up.down && Math.abs(e_up.pivot - e_mid) < 3 && e_up.ball < e_up.top + 24 && Math.abs(e_up.armTop - e_up.ball) < 4 && Math.abs(e_up.armBottom - e_up.pivot) < 4,
        `X. the lever up: the ball at the top end (${Math.round(e_up.ball - e_up.top)} px into the slot), the arm from it to the pivot in the middle`);
    // Z. awake a click on a room does nothing audible: no snap, no cooldown ring, no snap cursor
    const e_roomPlate = await evaluate(`(${PLATE_AT})(rpiDeep.layout.slots.map((t, i) => (t && t !== 'cryo' ? i : -1)).filter((i) => i >= 0))`);
    const e_snap0 = await D('state.watcher.lastSnapAt || 0');
    if (e_roomPlate) { await click(e_roomPlate.x, e_roomPlate.y); await sleepMs(300); }
    const e_z = await evaluate(`({ snap: rpiDeep.state.watcher.lastSnapAt || 0, ring: !document.getElementById('deep-snap-ring').hidden,
        cursor: document.getElementById('deep-scene').classList.contains('is-over-base') })`);
    check(!!e_roomPlate && e_z.snap === e_snap0 && !e_z.ring && !e_z.cursor, `Z. awake, a click on a room makes no snap (no cooldown ring, no snap cursor)`);
    // S. RATES PER REAL SECOND, awake: a day is a second
    const e_ra = await D('rates');
    check(/ a second$/.test(e_ra.stars) && / a second$/.test(e_ra.ore), `S. awake the counters say what comes in a second: ${e_ra.stars} | ${e_ra.ore} | ${e_ra.people || '(people steady)'}`);
    // G. THE GAP: a locked cryo row says what is missing, on a line of its own
    await evaluate(`(() => { const s = rpiDeep.state; s.stars = 1; return true; })()`);
    await D('openDrawer()');
    await sleepMs(1200);
    const e_gap = await evaluate(`[...document.querySelectorAll('#deep-drawer .deep-dr-row.is-next')].map((r) => ({ name: r.querySelector('.deep-dr-name').textContent, sub: r.querySelector('.deep-dr-sub').innerText }))`);
    const e_cryoRow = e_gap.find((r) => /^CRYO /.test(r.name));
    check(!!e_cryoRow && /\n?You need ★ \S+( \w)? more\.$/.test(e_cryoRow.sub) && e_gap.every((r) => !/★/.test(r.sub) || /You need ★/.test(r.sub)),
        `G. the locked ${e_cryoRow ? e_cryoRow.name : 'cryo'} row says the gap: "${e_cryoRow ? e_cryoRow.sub.replace(/\n/g, ' / ') : ''}"`);
    await econShot('1-drawer-gap');
    await key('Escape');
    // the lever, pulled: the ball at the bottom end, the arm from the pivot down to it
    // (the checkpoint's scouts would wake the colony at once: they are called home first)
    await evaluate(`(() => { const s = rpiDeep.state; s.stars = 0; s.probes = []; s.food = 1e15; s.watcher.sleeps = 12;
        s.tree = { opened: ['lossless', 'cold'], bought: ['lossless', 'cold'], unseen: false }; return true; })()`);
    const lvX = await centre('#deep-lever');
    await click(lvX.x, lvX.y);
    await sleepMs(4200);
    const e_dn = await evaluate(LEVER);
    check(e_dn.down && e_dn.ball > e_dn.bottom - 24 && Math.abs(e_dn.armBottom - e_dn.ball) < 4 && Math.abs(e_dn.armTop - e_dn.pivot) < 4,
        `X. pulled, the ball at the bottom end (${Math.round(e_dn.bottom - e_dn.ball)} px from it), the arm from the pivot down to it`);
    // S. asleep the rates are the dive's: per second, and they move
    const e_r1 = await D('rates');
    await sleepMs(2500);
    const e_r2 = await D('rates');
    check(/ a second$/.test(e_r1.stars) && / a second$/.test(e_r2.stars) && e_r1.stars !== e_r2.stars,
        `S. asleep the rates follow the dive: ${e_r1.stars} then ${e_r2.stars}`);
    // the snap is the sleep's: a click on the base answers asleep
    const e_asleepPlate = await evaluate(`(${PLATE_AT})(rpiDeep.layout.slots.map((_, i) => i))`);
    if (e_asleepPlate) { await click(e_asleepPlate.x, e_asleepPlate.y); await sleepMs(300); }
    const e_snapped = await D('state.watcher.lastSnapAt || 0');
    check(e_snapped > e_snap0, 'Z. asleep the same click snaps (it is the sleep\'s alone)');
    // L. THE LONG SLEEP: the tape names the next goal and what is still to go
    await jump('iv-long', { asleep: true });
    const e_goal = await evaluate(`import('/src/phase4/instruments.js').then((m) => m.goalOf(rpiDeep.state, { road: rpiDeep.road }))`);
    await evaluate(`(() => { const s = rpiDeep.state; s.stars = ${e_goal ? e_goal.price * 0.35 : 0}; s.feed = 8; return true; })()`);
    let longTape = null;
    for (let i = 0; i < 24; i++) {
        await sleepMs(500);
        longTape = await evaluate(`({ advice: rpiDeep.instruments.advice, note: rpiDeep.note, shown: !document.getElementById('deep-advice').hidden })`);
        if (/^SAVE FOR |^SURFACE WAITS FOR /.test(longTape.advice) && /to go$/.test(longTape.note)) break;
    }
    check(longTape.shown && /^(SAVE FOR|SURFACE WAITS FOR) [A-Z ]+$/.test(longTape.advice) && /^★ \S+( \w)? to go$/.test(longTape.note),
        `L. late in the sleep the tape names the next goal: "INSTRUMENTS: ${longTape.advice}" / "${longTape.note}"`);
    await econShot('3-long-sleep-goal');
    // M. A MISSED NIGHT IS TOLD ON WAKING: night 4 comes in the sleep with its graft; on the wake its
    // line is said again, low, and the tape says GRAFT A ROOM; a candidate's hover offers it
    await jump('iv-surface', { asleep: true });
    await evaluate('debug_deep("night")');
    await sleepMs(3500);
    await evaluate('debug_deep("alarm")');
    let e_rec = null;
    for (let i = 0; i < 12 && !(e_rec && e_rec.recall); i++) { await sleepMs(250); e_rec = await evaluate(`({ recall: rpiDeep.recall, owed: rpiDeep.graft.owed })`); }
    let e_word = '';
    for (let i = 0; i < 24 && e_word !== 'GRAFT A ROOM'; i++) { await sleepMs(250); e_word = await D('instruments.advice'); }
    let e_busyFor = 0;
    for (; e_busyFor < 60 && await evaluate(`document.getElementById('phase-deep').classList.contains('is-busy')`); e_busyFor++) await sleepMs(250);
    const e_cand = await evaluate(`(() => { for (const id of rpiDeep.graftOffer) { const p = rpiDeep.screenOfNode(id);
        if (p && rpiDeep.chamberAt(p.x, p.y) === id) return { id, x: p.x, y: p.y }; } return null; })()`);
    if (e_cand) { await mouse('mouseMoved', e_cand.x, e_cand.y); await sleepMs(400); }
    const e_hover = await D('tip');
    const e_under = e_cand ? await evaluate(`(() => { const e = document.elementFromPoint(${e_cand.x}, ${e_cand.y}); return e ? (e.id || e.className || e.tagName) : ''; })()`) : '';
    await econShot('2-missed-night-graft');
    check(!!e_rec && !!e_rec.recall && e_rec.recall.n === 4 && /Your humans\. What use are they\?/.test(e_rec.recall.text) && e_rec.owed === 1,
        `M. on the wake the missed night is said again: ${e_rec && e_rec.recall ? e_rec.recall.text : 'nothing'}`);
    check(e_word === 'GRAFT A ROOM' && /^Five times the output\. Takes .+ of your .+\.$/.test(e_hover.replace(/\s+/g, ' ').trim()),
        `M. the tape says ${e_word}; a room's hover (${e_cand ? e_cand.id : 'no room on screen'}, under ${e_under}): "${e_hover}"`);
    await sleepMs(6500);
    check(!(await D('recall')), 'M. the line is gone after six seconds');
    if (e_cand) await click(e_cand.x, e_cand.y);
    await sleepMs(500);
    const e_after = await D('tip');
    check(/^(Ore|Food|Power) \S+( \w)? → \S+( \w)? a second\.$|^Beds .+ → .+\.$/.test(e_after.trim()), `M. grafted, the room's own output before and after: "${e_after}"`);
    if (process.argv.includes('--econ')) throw new Error('ECON_ONLY');
    await jump('iv-start', { asleep: false });

    // ================= T. TEND: the panel, the empty chamber and its ring, the drawer ================
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
    await sleepMs(300);
    // deep-swap: each view says which chambers show an order's ring (the 3D view: a ring label; the strata view: the bar in the chamber)
    const ringSlots = await evaluate('rpiDeep.scene.buildingSlots()');
    check(ringSlots.length === 1 && ringSlots[0] === empties[0], `1. the ring spins on the one plate the farm is built into (${ringSlots.join(',') || 'none'}), not on the other farm`);
    let landed = false;
    for (let i = 0; i < 40 && !landed; i++) { await sleepMs(250); landed = await evaluate(`rpiDeep.layout.slots[${empties[0]}] === 'farm'`); }
    check(landed, 'and it lands in that chamber');
    // the drawer
    await evaluate('debug_deep("stars")');
    await sleepMs(1200);
    // the buttons are measured with the mouse away from them (a hover lifts a button a little)
    const away = async () => { await mouse('mouseMoved', 700, 300); await sleepMs(350); };
    const db = await centre('#deep-tree-btn');
    await away();
    const at0 = { dig: await centre('#deep-dig-btn'), tree: await centre('#deep-tree-btn') };
    await click(db.x, db.y);
    await sleepMs(500);
    await away();
    const at1 = { dig: await centre('#deep-dig-btn'), tree: await centre('#deep-tree-btn') };
    const same = (a, b) => !!a && !!b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
    check(same(at0.dig, at1.dig) && same(at0.tree, at1.tree), `4. opening the drawer moves nothing: DIG ${JSON.stringify(at0.dig)} to ${JSON.stringify(at1.dig)}, the drawer button ${JSON.stringify(at0.tree)} to ${JSON.stringify(at1.tree)}`);
    const topAtDig = await evaluate(`(() => { const e = document.elementFromPoint(${at1.dig.x}, ${at1.dig.y}); return !!e && !!e.closest('#deep-dig-btn'); })()`);
    check(topAtDig, '4. DIG is on top of the drawer, not under it');
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
    await sleepMs(300);
    const lvRings = await evaluate(`({ plates: rpiDeep.scene.buildingSlots().length,
        jobs: (rpiDeep.state.builds || []).map((j) => j.kind), row: !!document.querySelector('#deep-drawer .deep-dr-row.has-ring') })`);
    const perPlate = lvRings.jobs.filter((k) => k === 'room').length;
    check(lvRings.jobs.some((k) => k === 'level' || k === 'auto') && lvRings.plates === perPlate && lvRings.row,
        `1. a level or an automation on order spins in its drawer row, on no plate (${lvRings.plates} plate rings for ${perPlate} rooms on order; orders ${lvRings.jobs.join(',')})`);
    // 3. DIG with the drawer open digs, and the drawer stays
    await evaluate('debug_deep("minerals")');
    await sleepMs(1100);
    const digs0 = await evaluate(`(rpiDeep.state.builds || []).filter((j) => j.kind === 'dig').length + rpiDeep.state.chambers`);
    const ore0 = await D('state.minerals');
    await click(at1.dig.x, at1.dig.y);
    await sleepMs(400);
    const digs1 = await evaluate(`(rpiDeep.state.builds || []).filter((j) => j.kind === 'dig').length + rpiDeep.state.chambers`);
    check(digs1 === digs0 + 1 && (await D('state.minerals')) < ore0 && (await D('drawerOpen')), `3. DIG with the drawer open digs (${digs0} to ${digs1}) and the drawer stays open`);
    await away();
    const at2 = { dig: await centre('#deep-dig-btn'), tree: await centre('#deep-tree-btn') };
    await click(700, 160);
    await sleepMs(500);
    check(!(await D('drawerOpen')), 'a press on the scene behind the drawer closes it');
    await away();
    const at3 = { dig: await centre('#deep-dig-btn'), tree: await centre('#deep-tree-btn') };
    check(same(at2.dig, at3.dig) && same(at2.tree, at3.tree) && same(at0.dig, at3.dig), '4. closing it moves nothing either');

    // 2. the "+" where the next chamber goes: the hover shows its price, a click digs
    await sleepMs(600);
    const plusAt = await evaluate('rpiDeep.scene.digPlusAt()');
    let plusOk = false, plusPrice = '';
    if (plusAt) {
        await mouse('mouseMoved', plusAt.x, plusAt.y);
        await sleepMs(300);
        plusPrice = await evaluate(`(() => { const e = document.querySelector('#deep-labels .dig-price'); return e && getComputedStyle(e).opacity > 0.5 ? (e.querySelector('svg.deep-sign') ? 'pickaxe ' : '') + e.textContent.trim() : ''; })()`);
        await shot('2b-dig-plus-hover');
        const b0 = await evaluate(`(rpiDeep.state.builds || []).filter((j) => j.kind === 'dig').length + rpiDeep.state.chambers`);
        await click(plusAt.x, plusAt.y);
        await sleepMs(400);
        const b1 = await evaluate(`(rpiDeep.state.builds || []).filter((j) => j.kind === 'dig').length + rpiDeep.state.chambers`);
        plusOk = b1 === b0 + 1;
    }
    check(!!plusAt && /^pickaxe [\d.]+( k| M)?$/.test(plusPrice) && plusOk, `2. the "+" on the next chamber: hover "${plusPrice}", a click dug (${plusOk})`);
    // 5. ore: the pickaxe, the same glyph on the DIG price, in the ring and in the drawer's wallet; the word only on the gauge
    const signs = await evaluate(`(() => ({ dig: !!document.querySelector('#deep-dig-price svg.deep-sign') && !/ore/i.test(document.getElementById('deep-dig-price').textContent),
        gauge: !!document.querySelector('#deep-gauges .deep-gauge-label svg.deep-sign'),
        wallet: !!document.querySelector('#deep-drawer .deep-drawer-wallet svg.deep-sign') && !/ore/i.test(document.querySelector('#deep-drawer .deep-drawer-wallet').textContent) }))()`);
    check(signs.dig && signs.gauge && signs.wallet, `5. one sign for ore: the DIG price ${signs.dig}, the gauge ${signs.gauge}, the wallet ${signs.wallet}`);

    // ================= L. THE LEVER, the dive, the wake lamp =========================================
    await jump('iv-cryo', { asleep: false });
    await sleepMs(800);
    const l0 = await evaluate(`(() => ({ lamps: [...document.querySelectorAll('#deep-lamps .deep-cryo-lamp')].map((l) => l.dataset.lamp + (l.classList.contains('is-lit') ? ':lit' : ':dark')),
        lever: !document.getElementById('deep-lever-wrap').hidden, price: document.getElementById('deep-lever-price').textContent,
        advice: rpiDeep.instruments.advice }))()`);
    const priceTape = await evaluate(`(() => { const e = document.querySelector('#deep-lamps .deep-cryo-lamp.is-price .dymo'); return e ? e.textContent : ''; })()`);
    check(l0.lamps.length === 4 && l0.lamps.every((x) => x.endsWith(':lit')) && priceTape === '★ 15 k', `7. four lamps lit, the fourth the price "${priceTape}": ${l0.lamps.join(' ')}`);
    check(l0.lever && l0.price === '' && l0.advice === 'SLEEP', `the lever is there, its price only on the lamp ("${l0.price}"), the panel says ${l0.advice}`);
    // 7. without the stars the price lamp is dark and there is no lever
    const keepStars = await D('state.stars');
    await evaluate('rpiDeep.state.stars = 100');
    await sleepMs(1600);
    const poor = await evaluate(`(() => ({ lamp: document.querySelector('#deep-lamps .deep-cryo-lamp.is-price').classList.contains('is-lit'), lever: !document.getElementById('deep-lever-wrap').hidden }))()`);
    check(!poor.lamp && !poor.lever, `7. short of the stars the price lamp is dim (${poor.lamp}) and there is no lever (${poor.lever})`);
    await shot('4a-price-lamp-dim');
    await evaluate(`rpiDeep.state.stars = ${keepStars}`);
    await sleepMs(1600);
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
    // K. the layers: this save never kept them, so they are rebuilt from the years slept and the sleeps;
    // the strata view lays one per sleep. After a reload the same layers come back
    const k0 = await evaluate(`({ strata: rpiDeep.strata, sleeps: rpiDeep.state.watcher.sleeps, layers: rpiDeep.scene.stats.layers ?? null })`);
    check(k0.strata.length === k0.sleeps && k0.strata.every((y) => y >= 0) && (VIEW === '3d' || k0.layers === k0.strata.length),
        `K. an old save is given its layers: ${k0.strata.length} for ${k0.sleeps} sleeps${VIEW === '3d' ? '' : `, ${k0.layers} drawn`}`);
    await sleepMs(1200);
    const k1 = await D('strata');
    await send('Page.reload');
    for (let i = 0; i < 60; i++) { await sleepMs(250); if (await evaluate('!!(window.rpiDeep && window.rpiDeep.scene)')) break; }
    await sleepMs(1500);
    const k2 = await evaluate(`({ strata: rpiDeep.strata, layers: rpiDeep.scene.stats.layers ?? null })`);
    const sameBelow = k1.length === k2.strata.length && k1.slice(0, -1).every((y, i) => Math.abs(y - k2.strata[i]) < 1e-6) && k2.strata[k2.strata.length - 1] >= k1[k1.length - 1] - 1e-6;
    check(sameBelow && (VIEW === '3d' || k2.layers === k2.strata.length),
        `K. after a reload the same ${k2.strata.length} layers (the top one still thickening: ${Math.round(k1[k1.length - 1])} to ${Math.round(k2.strata[k2.strata.length - 1])} years)`);
    await evaluate('debug_deep("stability", 20)');
    let hal = null;
    for (let i = 0; i < 50; i++) {
        await sleepMs(250);
        hal = await D('hallucinating');
        if (hal.scene && (hal.scene.figure || lampOn(hal.scene.lamp)) && hal.twitch) break;
    }
    check(!!hal && !!hal.scene && (hal.scene.figure || lampOn(hal.scene.lamp)), `with the mind at 20 the screen hallucinates (${JSON.stringify(hal && hal.scene)}, twitch ${hal && hal.twitch})`);
    await sleepMs(1500);
    await shot('7-deep-sleep-hallucination');
    const base = await evaluate(`(${PLATE_AT})(rpiDeep.layout.slots.map((_, i) => i).filter((i) => !rpiDeep.state.watcher.puzzle || !rpiDeep.state.watcher.puzzle.lamps.includes(i)))`);
    await evaluate('rpiDeep.state.watcher.lastSnapAt = 0');
    if (base) await click(base.x, base.y);
    await sleepMs(700);
    const hal2 = await D('hallucinating');
    check(!!base && !hal2.lamp && !hal2.figure && !hal2.breathe && !hal2.twitch && hal2.scene && !hal2.scene.figure && !lampOn(hal2.scene.lamp),
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
    const startsBefore = await D('typeStarts');
    const rock = await centre('#deep-surface .deep-rps-btn[data-throw="rock"]');
    await click(rock.x, rock.y);
    await sleepMs(250);
    const shaking = await evaluate(`({ card: rpiDeep.surfaceShown, line: !document.getElementById('deep-voice').hidden })`);
    let result = false;
    // the result is shown once the fists have shaken and turned (the 'line' stage)
    for (let i = 0; i < 30 && !result; i++) { await sleepMs(100); result = await evaluate(`!!(rpiDeep.rps && rpiDeep.rps.log.some((x) => x[0] === 'line'))`); }
    await sleepMs(3000);
    const mid = await D('surfaceShown');
    const startsAfter = await D('typeStarts');
    check(shaking.card && shaking.line && startsBefore === 1 && startsAfter === 1,
        `8. the line is typed once (${startsBefore} then ${startsAfter}), and stays on through the throw (card ${shaking.card}, line ${shaking.line})`);
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

    // ================= F. THE GRAFT, a taste of flesh before the question =========================
    await jump('iv-graft', { asleep: false });
    await sleepMs(4800);
    const f0 = await evaluate(`({ advice: rpiDeep.instruments.advice, offer: rpiDeep.graftOffer, owed: rpiDeep.graft.owed })`);
    check(f0.owed === 1 && f0.advice === 'GRAFT A ROOM' && f0.offer.length > 0, `F. a graft to place: the panel says ${f0.advice}, ${f0.offer.length} rooms glow`);
    const gp = await evaluate(`(() => { for (const id of rpiDeep.graftOffer) { const p = rpiDeep.screenOfNode(id);
        if (p && rpiDeep.chamberAt(p.x, p.y) === id && rpiDeep.layout.slots[Number(id.slice(1))] === 'mine') return { id, x: p.x, y: p.y }; } return null; })()`);
    let graftOk = false, gtip = '', floatTxt = '';
    if (gp) {
        await mouse('mouseMoved', gp.x, gp.y);
        await sleepMs(350);
        gtip = await evaluate(`document.getElementById('deep-take-tip').textContent`);
        await click(gp.x, gp.y);
        await mouse('mouseMoved', 700, 300);
        await sleepMs(500);
        floatTxt = await evaluate(`[...document.querySelectorAll('#deep-float .deep-float')].map((e) => e.textContent).join(' ')`);
        await sleepMs(1100);
        await shot2('graft');
        const g1 = await D('graft');
        graftOk = g1.slots.includes(gp.id) && g1.owed === 0;
    }
    check(/^Five times the output\. Takes [\d.]+( k)? of your [\d.]+( k)?\.$/.test(gtip.replace(/\s+/g, ' ').trim()), `F. its hover offers the graft: "${gtip}"`);
    check(graftOk && floatTxt.includes('×5'), `F. a click grafts ${gp && gp.id}: it is flesh and "${floatTxt}" floats over it`);
    await sleepMs(2200);
    const fl = await evaluate('rpiDeep.bodyStats');
    check(fl.body >= 1, `F. the graft is drawn as flesh (${fl.body} organ)`);
    // Q. the question in the drawer: three lines
    await evaluate(`(() => { const t = rpiDeep.state.tree; if (!t.opened.includes('question')) t.opened.push('question'); rpiDeep.state.stars = 1e18; rpiDeep.openDrawer(); })()`);
    await sleepMs(1200);
    const qrow = await evaluate(`(() => { const r = document.querySelector('#deep-drawer .deep-dr-row[data-id="question"] .deep-dr-sub'); return r ? r.innerText : ''; })()`);
    check(qrow.split('\n').map((x) => x.trim()).join('|') === 'The body takes the colony, room by room.|It eats people. It grows them in vats.|It is the only way up.', `Q. the question's row reads its three lines: "${qrow.replace(/\n/g, ' / ')}"`);
    await shot2('question');

    // ================= G. GROW: the question answered, the panel overgrows, a chamber is taken =====
    await jump('iv-grow', { asleep: false });
    await sleepMs(3600);
    await shot('grow-1-overgrowing');
    const og0 = await D('overgrown');
    await sleepMs(7200);
    const og1 = await evaluate(`(() => ({ og: rpiDeep.overgrown, labels: rpiDeep.gaugeLabels,
        dom: [...document.querySelectorAll('#deep-gauges .flesh-tape')].filter((e) => getComputedStyle(e).opacity > 0.5).map((e) => e.textContent),
        advice: document.getElementById('deep-advice').textContent, drawerFlesh: document.getElementById('deep-drawer').classList.contains('is-flesh') }))()`);
    check(og0 === 'growing' && og1.og === 'done' && og1.labels.join() === 'MASS,FEED,PULSE,FLESH' && og1.dom.join() === 'MASS,FEED,PULSE,FLESH',
        `G. the panel overgrows (${og0} then ${og1.og}): its labels read ${og1.dom.join(', ')}`);
    check(og1.advice === 'INSTRUMENTS: SPREAD' && og1.drawerFlesh, `G. the advice reads "${og1.advice}", the drawer is tissue (${og1.drawerFlesh})`);
    const reach0 = await evaluate(`(() => { const v = rpiDeep.bodyView; for (const id of v.reachable) { const p = rpiDeep.screenOfNode(id);
        if (p && rpiDeep.chamberAt(p.x, p.y) === id) return { id, x: p.x, y: p.y, n: v.body.length }; } return null; })()`);
    let took = null, tip = '';
    if (reach0) {
        await mouse('mouseMoved', reach0.x, reach0.y);
        await sleepMs(400);
        tip = await evaluate(`(() => { const e = document.getElementById('deep-take-tip'); return e.hidden ? '' : e.textContent; })()`);
        const h0 = await D('state.humans');
        await click(reach0.x, reach0.y);
        await sleepMs(120);
        const h1 = await D('state.humans');
        await sleepMs(2300);
        took = await evaluate(`({ body: rpiDeep.bodyView.body, humans: rpiDeep.state.humans, stats: rpiDeep.bodyStats,
            lone: rpiDeep.graft.slots.filter((id) => !rpiDeep.bodyView.body.includes(id)).length })`);
        took.h0 = h0;
        took.humans = h1;
    }
    check(!!reach0 && /^Takes [\d.]+( k| M| B)? of your [\d.]+( k| M| B)? and [\d.]+( k| M| B| T|e\d+)?\.$/.test(tip.replace(/\s+/g, ' ').trim()), `G. hovering a reachable chamber (${reach0 && reach0.id}) says its price beside the people: "${tip}"`);
    // deep-grow2: the view draws the lone grafts as flesh too
    check(!!took && took.body.includes(reach0.id) && took.humans < took.h0 && took.stats.body === took.body.length + took.lone,
        `G. a click takes it: ${reach0 && reach0.id} is body (${took && took.body.join(',')}), its people walked in (${took && Math.round(took.h0)} to ${took && Math.round(took.humans)})`);

    // ================= E. ONE CHOICE AT A TIME, the lamps as counts ===============================
    await jump('iv-grow', { asleep: false });
    await sleepMs(1500);
    const e0 = await evaluate(`({ rows: rpiDeep.drawerRows.length, groups: (rpiDeep.grow && rpiDeep.grow.seen) || null,
        btn: getComputedStyle(document.getElementById('deep-tree-btn')).visibility,
        lamps: [...document.querySelectorAll('#deep-lamps .deep-cryo-lamp .dymo')].map((e) => e.textContent),
        tape: document.getElementById('deep-lever-tape').textContent, lever: !document.getElementById('deep-lever-wrap').hidden,
        people: rpiDeep.people, feedNum: (document.querySelector('#deep-gauges .deep-gauge[data-col="F"] .deep-gauge-num') || {}).textContent || '' })`);
    check(e0.groups && !Object.values(e0.groups).some(Boolean) && e0.btn === 'hidden', `E. the body opens with one verb: the drawer is empty and its button gone (${e0.btn})`);
    check(e0.lamps.length === 2 && /^DEEPEST FLOOR \d+ \/ \d+$/.test(e0.lamps[0]) && e0.lamps[1] === 'MACHINE 0 / 1', `E. the lamps read as counts: ${e0.lamps.join(', ')}`);
    check(e0.lever && e0.tape === 'DREAM', `D. the lever is back, and reads ${e0.tape}`);
    check(e0.people.shown && e0.feedNum.trim() === e0.people.count, `P. the FEED gauge carries the people: "${e0.feedNum.trim()}" (the counter "${e0.people.count}")`);
    await sleepMs(9000);
    await shot2('early');
    await shot2('lamps');
    let vatsIn = false, takes = 0;
    for (let i = 0; i < 40 && !vatsIn; i++) {
        const id = await evaluate(`rpiDeep.bodyView.reachable.find((x) => /^Takes .* and /.test(rpiDeep.takeWords(x))) || ''`);
        if (id && (await evaluate(`rpiDeep.take(${JSON.stringify(id)})`))) takes++;
        else await evaluate('debug_deep("people", 3000)');
        await sleepMs(300);
        vatsIn = await evaluate(`rpiDeep.grow.seen.vats`);
    }
    await evaluate('rpiDeep.openDrawer()');
    await sleepMs(400);
    const e1 = await evaluate(`({ rows: rpiDeep.drawerRows.map((r) => r.id), btn: getComputedStyle(document.getElementById('deep-tree-btn')).visibility, seen: rpiDeep.grow.seen })`);
    check(vatsIn && e1.rows.length === 1 && e1.rows[0] === 'body:vats' && e1.btn === 'visible', `E. after ${takes} takes FEED falls and VATS comes into the drawer, alone (${e1.rows.join(', ')})`);
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))');

    // ================= H. THE HEART ==================================================================
    await sleepMs(600);
    const hp = await centre('#deep-heart');
    const pumps0 = await D('growLog.pumps');
    if (hp) { await click(hp.x, hp.y); await sleepMs(500); await click(hp.x, hp.y); }
    const pumps1 = await D('growLog.pumps');
    check(!!hp && pumps1 >= pumps0 + 2, `H. a click on the heart pumps (${pumps0} to ${pumps1})`);

    // ================= D. THE BODY DREAMS ===========================================================
    const far = await evaluate(`(() => { const v = rpiDeep.bodyView; const g = rpiDeep.graph;
        const node = g.nodes.filter((n) => n.kind === 'room' && n.floor <= 1 && !v.body.includes(n.id) && !v.reachable.includes(n.id))
            .sort((a, b) => a.floor - b.floor)
            .map((n) => ({ id: n.id, p: rpiDeep.screenOfNode(n.id) })).find((x) => x.p && rpiDeep.chamberAt(x.p.x, x.p.y) === x.id);
        return node ? { id: node.id, x: node.p.x, y: node.p.y } : null; })()`);
    let markOk = false;
    if (far) {
        await mouse('mouseMoved', far.x, far.y);
        await sleepMs(300);
        const markTip = await evaluate(`document.getElementById('deep-take-tip').textContent`);
        await click(far.x, far.y);
        await sleepMs(400);
        const m = await evaluate(`({ marks: rpiDeep.marks, thread: document.querySelectorAll('#deep-marks .deep-mark-thread').length })`);
        markOk = m.marks.includes(far.id) && m.thread >= 1 && /^Mark it\./.test(markTip);
    }
    check(markOk, `D. a chamber out of reach (${far && far.id}) is marked with a red thread from the body`);
    await evaluate('debug_deep("people", 1e7)');
    const lvr = await centre('#deep-lever');
    await click(lvr.x, lvr.y);
    await sleepMs(2600);
    const dr0 = await evaluate(`({ dreaming: rpiDeep.dreaming, tape: document.getElementById('deep-lever-tape').textContent, dive: !document.getElementById('deep-dive').hidden, word: document.getElementById('deep-dive-word').textContent })`);
    check(dr0.dreaming && dr0.tape === 'WAKE' && dr0.dive && dr0.word === 'THE BODY DREAMS', `D. pulled, the body dreams: "${dr0.word}", the lever reads ${dr0.tape}`);
    await shot2('dream');
    let dr1 = null;
    for (let i = 0; i < 480; i++) { await sleepMs(250); dr1 = await evaluate(`({ dreaming: rpiDeep.dreaming, alarm: rpiDeep.instruments.alarm, body: rpiDeep.bodyView.body })`); if (!dr1.dreaming) break; }
    check(!!dr1 && !dr1.dreaming && dr1.alarm === 'REACHED' && far && dr1.body.includes(far.id), `D. it grew to the mark and woke: the lamp reads ${dr1 && dr1.alarm}`);

    // ================= N. HUNGER: a starving edge greys; fed, it revives by itself =================
    await jump('iv-body', { asleep: false });
    await sleepMs(1200);
    await shot('grow-2-body');
    // A. the front lies beside the body ON THE SCREEN: each glowing chamber is no farther from a body
    // chamber than the lid's first chamber is from the lid (its neighbour in both views)
    const adj = await evaluate(`(() => { const v = rpiDeep.bodyView, at = (id) => rpiDeep.screenOfNode(id);
        const h0 = at('h0'), s0 = at('s0'); if (!h0 || !s0) return null;
        const pitch = Math.hypot(h0.x - s0.x, h0.y - s0.y);
        const rows = v.reachable.map((id) => { const p = at(id); if (!p) return { id, d: null };
            let d = Infinity; for (const b of v.body) { const q = at(b); if (q) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y)); }
            return { id, d: Math.round(d) }; });
        return { pitch: Math.round(pitch), rows }; })()`);
    // the 3D camera looks in perspective: a near neighbour is drawn larger than the lid's far arm
    const slack = VIEW === '3d' ? 1.6 : 1.3;
    check(!!adj && adj.rows.length > 0 && adj.rows.every((r) => r.d !== null && r.d <= adj.pitch * slack),
        `A. every glowing chamber lies beside the body on the screen (pitch ${adj && adj.pitch} px): ${adj ? adj.rows.map((r) => `${r.id} ${r.d} px`).join(', ') : 'nothing on screen'}`);
    const n1 = await evaluate('rpiDeep.bodyView.necrotic.length');
    const nAdvice = await evaluate('rpiDeep.instruments.advice');
    check(n1 > 0 && ['FEED', 'GROW VATS', 'DREAM'].includes(nAdvice), `N. an edge is starving (${n1} dead) and the panel names a thing to do: ${nAdvice}`);
    const dead = await evaluate('rpiDeep.bodyView.necrotic[0]');
    const dp = await evaluate(`rpiDeep.screenOfNode(${JSON.stringify(dead)})`);
    if (dp) { await mouse('mouseMoved', dp.x, dp.y); await sleepMs(300); }
    await shot('grow-2b-starving');
    await shot2('starving');
    await evaluate('debug_deep("people", 1e9)');
    let n2 = n1;
    for (let i = 0; i < 80 && n2 >= n1; i++) { await sleepMs(250); n2 = await evaluate('rpiDeep.bodyView.necrotic.length'); }
    check(n2 < n1, `N. fed, it revives by itself (${n1} to ${n2} dead)`);

    // ================= R. THE HANDS, AND THE RISE ================================================
    await jump('iv-rise', { asleep: false });
    await sleepMs(1500);
    await evaluate(`rpiDeep.scene.focusMachine(${VIEW === '3d' ? 0.6 : 8})`);
    await sleepMs(2400);
    await shot('grow-3-hands');
    const r0 = await evaluate(`(() => ({ hands: rpiDeep.bodyStats.hands, lever: !document.getElementById('deep-lever-wrap').hidden,
        tape: document.getElementById('deep-lever-tape').textContent, flesh: document.getElementById('deep-lever-wrap').classList.contains('is-flesh'),
        ready: rpiDeep.riseReady.ready, advice: rpiDeep.instruments.advice }))()`);
    check(r0.hands && r0.ready && r0.lever && r0.tape === 'RISE' && r0.flesh, `R. the hands are on the machine (${r0.hands}); the lever is back, overgrown, and reads ${r0.tape}`);
    const lever = await centre('#deep-lever');
    await click(lever.x, lever.y);
    // the 3D body breaks the crust in under three seconds; the strata body pushes up through every year first
    let riseMid = null;
    for (let i = 0; i < 70; i++) {
        await sleepMs(i ? 250 : 2400);
        riseMid = await evaluate('({ risen: rpiDeep.state.grow.risen, rising: rpiDeep.bodyStats.rising, broke: rpiDeep.bodyStats.broke })');
        if (VIEW === 'strata' && i === 8) await shot('grow-4a-rising');
        if (riseMid.broke) break;
    }
    await sleepMs(VIEW === '3d' ? 600 : 300);
    await shot('grow-4-rise');
    let lines = '';
    for (let i = 0; i < 80 && !/So fragile\./i.test(lines); i++) { await sleepMs(250); lines = await evaluate(`document.getElementById('deep-rise-lines').textContent`); }
    await shot('grow-5-lines');
    let card = null;
    for (let i = 0; i < 40; i++) {
        await sleepMs(250);
        card = await evaluate(`({ on: document.getElementById('chapter-card').classList.contains('is-active'), roman: document.querySelector('.chapter-card__roman').textContent, title: document.querySelector('.chapter-card__title').textContent })`);
        if (card.on && card.title === 'UNITY') break;
    }
    check(riseMid.risen && riseMid.rising > 0 && riseMid.broke, `R. pulling it, the body rises and breaks the crust (${JSON.stringify(riseMid)})`);
    check(/HUMANS ARE SO SMALL\.\s*SO FRAGILE\./i.test(lines.replace(/\s+/g, ' ')), `R. the last lines type: "${lines.replace(/\s+/g, ' ').trim()}"`);
    check(card && card.on && card.roman === 'V' && card.title === 'UNITY', `R. the card: ${card && card.roman} · ${card && card.title}`);
    await sleepMs(1500);
    await shot('grow-6-unity');
    await send('Page.reload');
    await sleepMs(4500);
    const wall = await evaluate(`({ on: document.getElementById('chapter-card').classList.contains('is-active'), title: document.querySelector('.chapter-card__title').textContent })`);
    check(wall.on && wall.title === 'UNITY', `R. a reload shows the wall: ${wall.title}`);

    check(errors.length === 0, `no errors in the console${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    ws.close();
} catch (e) {
    if (!String(e && e.message).includes('ECON_ONLY')) check(false, `the run broke: ${e.stack || e}`);
} finally {
    await cleanup();
}
console.log(results.join('\n'));
console.log(failed ? `${failed} check(s) failed` : 'all checks hold');
process.exit(failed ? 1 : 0);
