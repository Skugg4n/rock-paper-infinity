/**
 * Chapter IV · THE DEEP, the dig (docs/superpowers/specs/2026-10-05-deep-dig.md): a digging game.
 * 216 people sleep in pods under the ruins; their power runs out; you are the drone that digs for
 * ore and carries it up. The rules are dig.js's; this file holds the loop, the hands (keys and
 * mouse), the panel and the workshop, and hands the picture to render.js.
 *
 * init() builds its own layer inside #phase-deep (the old act's pieces are hidden while it runs);
 * teardown() stops every interval, frame, listener and sound and takes the layer away.
 */

import { playChapterCard } from '../chapterCard.js';
import {
    SAVE_KEY, newState, deserialize, serialize, step, buy, buyGraft, priceOf, ROWS, rowText, GRAFTS, graftShown,
    batteryCap, cargoCap, turnBackAt, isHome, sleepers, depthM, lineNow, BATTERY_CAP, SLEEPERS,
} from './dig.js';
import { depthOf, FINDS } from './world.js';
import { createRenderer, RISE_S } from './render.js';
import { pathHome } from './autopilot.js';
import { createDigSound } from './sound.js';

const END = { roman: 'V', title: 'UNITY' };
const COLUMN = 300;                   // the panel's column, px
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
const ROW_NAME = { drill: 'DRILL', battery: 'BATTERY', cargo: 'CARGO', lamp: 'LAMP', hull: 'HULL', radar: 'RADAR' };

let ac = null, raf = 0, saveTimer = 0, riseTimer = 0, root = null, style = null, sound = null, state = null;

const CSS = `
#phase-deep.is-dig > :not(#dig-root) { display: none !important; }
#dig-root { position: absolute; inset: 0; background: #05070a; }
#dig-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: crosshair; touch-action: none; }
.dig-col { position: absolute; left: 16px; top: 16px; bottom: 76px; width: ${COLUMN - 32}px; display: flex; flex-direction: column; gap: 10px; pointer-events: none; }
.dig-card { pointer-events: auto; padding: 12px 14px; border-radius: 8px; background: linear-gradient(180deg, #1a2029 0%, #12171e 100%); box-shadow: 0 6px 18px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.04); color: #c9d3de; font: 13px/1.3 system-ui, sans-serif; }
.dig-row[hidden], .dig-buy[hidden] { display: none !important; }
.dig-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 3px 0; }
.dig-val { font: 600 18px/1 'Bebas Neue', 'Arial Narrow', sans-serif; letter-spacing: .08em; color: #f1efe8; font-variant-numeric: tabular-nums; }
.dig-val.is-red { color: #ff5a5a; }
.dig-val small { font-size: 13px; color: #8fa1b6; letter-spacing: .06em; }
.dig-bar { position: relative; height: 8px; background: #0b0d10; border-radius: 2px; margin: 2px 0 8px; overflow: visible; }
.dig-bar > i { position: absolute; left: 0; top: 0; bottom: 0; background: #7fd18b; border-radius: 2px; }
.dig-bar > i.is-red { background: #ff5a5a; }
.dig-bar > b { position: absolute; top: -4px; bottom: -4px; width: 3px; background: #ffe08a; box-shadow: 0 0 6px rgba(255,224,138,.8); }
.dig-bar > em { position: absolute; top: 11px; font: 700 10px/1 system-ui; letter-spacing: .08em; color: #ffe08a; font-style: normal; transform: translateX(-50%); white-space: nowrap; }
.dig-bar > s { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255,90,90,.28); text-decoration: none; }
@keyframes dig-blink { 50% { opacity: .25; } }
.dig-bar.is-draining { animation: dig-blink .35s steps(2) infinite; outline: 1px solid #ff5a5a; }
.dig-pods { display: block; width: 100%; height: 26px; margin: 2px 0 6px; image-rendering: pixelated; }
.dig-ending .dig-col, .dig-ending #dig-help { opacity: 0; transition: opacity 1.2s ease; pointer-events: none; }
.dig-line { transition: opacity .8s ease; }
.dig-line.is-gone { opacity: 0; }
.dig-line.is-turnback { color: #ff6a5a; }
.dig-line { min-height: 34px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.06); font: 14px/1.35 'Courier New', monospace; color: #e8e1c8; }
.dig-line.is-voice { color: #ff8a9a; }
.dig-line.is-alarm { color: #ff6a5a; }
.dig-line.is-find { color: #f2d98a; }
.dig-shop { min-height: 0; overflow-y: auto; scrollbar-width: thin; }
.dig-shop h3 { margin: 0 0 6px; display: flex; justify-content: space-between; align-items: center; }
.dig-shop .dig-note { font-size: 13px; color: #c9d3de; }
.dig-buy { display: grid; grid-template-columns: 74px 1fr auto; align-items: center; gap: 2px 8px; width: 100%; text-align: left; padding: 3px 6px; margin: 1px 0; border-radius: 4px; background: rgba(255,255,255,.03); color: inherit; border: 0; cursor: pointer; font: inherit; }
.dig-buy:hover:not(:disabled) { background: rgba(255,255,255,.09); }
.dig-buy:disabled { cursor: default; }
.dig-buy .dig-dash { letter-spacing: 2px; color: #7fd18b; font-size: 11px; }
.dig-buy .dig-desc { grid-column: 1 / 3; font-size: 13px; line-height: 1.25; color: #dfe6ee; }
.dig-buy .dig-price { grid-row: 1 / 3; grid-column: 3; font: 600 15px/1 'Bebas Neue', 'Arial Narrow', sans-serif; letter-spacing: .06em; color: #f2d98a; text-align: right; white-space: nowrap; }
.dig-buy .dig-price.is-short { color: #c9d3de; font: 13px/1.2 system-ui; }
.dig-buy.is-graft .dig-dash { color: #ff6a7d; }
.dig-buy.is-ready { box-shadow: inset 0 0 0 1px rgba(242,217,138,.45); }
.dig-away .dig-buy { opacity: .55; }
#dig-rise { position: absolute; left: 50%; top: 22%; transform: translate(-50%, -50%); padding: 14px 34px; font: 600 30px/1 'Bebas Neue', 'Arial Narrow', sans-serif; letter-spacing: .3em; color: #ffe1e6; background: #7a1022; border: 0; border-radius: 6px; box-shadow: 0 0 40px rgba(200,20,45,.6); cursor: pointer; }
#dig-rise[hidden] { display: none; }
#dig-help { position: absolute; right: 16px; bottom: 16px; font: 12px/1.4 system-ui; color: #5d6a78; text-align: right; pointer-events: none; }
`;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

function buildDom(host) {
    root = el('div'); root.id = 'dig-root';
    const canvas = el('canvas'); canvas.id = 'dig-canvas';
    const col = el('div', 'dig-col');
    const panel = el('div', 'dig-card dig-panel');
    panel.innerHTML = `
      <div class="dig-row"><span class="dymo is-small">POWER</span><span class="dig-val" id="dig-power">100 %</span></div>
      <div class="dig-bar" id="dig-power-track"><i id="dig-power-fill"></i><s id="dig-power-zone"></s><b id="dig-power-home"></b><em id="dig-power-home-label">HOME</em></div>
      <div class="dig-row" style="margin-top:12px"><span class="dymo is-small">CARGO</span><span class="dig-val" id="dig-cargo">0 / 8</span></div>
      <div class="dig-row"><span class="dymo is-small">DEPTH</span><span class="dig-val" id="dig-depth">0 m</span></div>
      <div class="dig-row"><span class="dymo is-small">COLONY</span><span class="dig-val" id="dig-colony">100 %</span></div>
      <div class="dig-bar"><i id="dig-colony-fill" style="background:#5fb4ff"></i></div>
      <div class="dig-row"><span class="dymo is-small">SLEEPERS</span><span class="dig-val" id="dig-sleepers">216</span></div>
      <canvas class="dig-pods" id="dig-pods" width="240" height="26"></canvas>
      <div class="dig-row"><span class="dymo is-small">PARTS</span><span class="dig-val" id="dig-parts">0</span></div>
      <div class="dig-row" id="dig-bio-row" hidden><span class="dymo is-small">BIOMASS</span><span class="dig-val" id="dig-bio">0</span></div>
      <div class="dig-row"><span class="dymo is-small">FINDS</span><span class="dig-val" id="dig-finds">0 / 12</span></div>
      <div class="dig-line" id="dig-line"></div>`;
    const shop = el('div', 'dig-card dig-shop');
    shop.innerHTML = `<h3><span class="dymo is-small">WORKSHOP</span><span class="dig-note" id="dig-shop-note"></span></h3><div id="dig-shop-rows"></div>`;
    col.append(panel, shop);
    const rise = el('button', '', 'RISE'); rise.id = 'dig-rise'; rise.hidden = true; rise.type = 'button';
    const help = el('div', '', 'Arrows or WASD. Or hold the mouse beside the drone.'); help.id = 'dig-help';
    root.append(canvas, col, rise, help);
    host.appendChild(root);
    const $ = (id) => root.querySelector('#' + id);
    return {
        canvas, rise, help,
        powerTrack: $('dig-power-track'), powerZone: $('dig-power-zone'), pods: $('dig-pods'), root,
        power: $('dig-power'), powerFill: $('dig-power-fill'), powerHome: $('dig-power-home'), powerHomeLabel: $('dig-power-home-label'),
        cargo: $('dig-cargo'), depth: $('dig-depth'), colony: $('dig-colony'), colonyFill: $('dig-colony-fill'),
        sleepers: $('dig-sleepers'), parts: $('dig-parts'), bio: $('dig-bio'), bioRow: $('dig-bio-row'), finds: $('dig-finds'),
        line: $('dig-line'), shopNote: $('dig-shop-note'), shopRows: $('dig-shop-rows'), shop,
    };
}

function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch { /* ignore */ }
    return (raw && deserialize(raw)) || newState(7);
}
function save() {
    if (!state || window.__rpiSkipSave) return;
    try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch { /* ignore */ }
}

export function init() {
    ac = new AbortController();
    const signal = ac.signal;
    const host = document.getElementById('phase-deep');
    host.classList.remove('hidden');
    host.classList.add('is-dig');
    document.body.classList.add('in-deep');
    style = el('style'); style.textContent = CSS; document.head.appendChild(style);
    const ui = buildDom(host);
    state = load();
    const s = state;
    sound = createDigSound();
    const rnd = createRenderer(ui.canvas);
    rnd.resize();
    window.addEventListener('resize', () => rnd.resize(), { signal });

    if (s.ended && !s.risen) ui.root.classList.add('dig-ending');
    if (s.risen) {
        // the act is over: the wall again
        playChapterCard({ roman: END.roman, title: END.title, mode: 'to-come', dark: true });
    }

    // ---- the hands
    const held = [];
    let mouse = null;              // {x, y} while the button is held on the world
    const pressedAt = { left: -1e9, right: -1e9 };
    const press = (dir) => { const i = held.indexOf(dir); if (i >= 0) held.splice(i, 1); held.push(dir); if (dir in pressedAt) pressedAt[dir] = performance.now(); };
    const release = (dir) => { const i = held.indexOf(dir); if (i >= 0) held.splice(i, 1); };
    window.addEventListener('keydown', (e) => {
        const d = KEYS[e.key];
        if (!d || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        press(d);
    }, { signal });
    window.addEventListener('keyup', (e) => { const d = KEYS[e.key]; if (d) release(d); }, { signal });
    window.addEventListener('blur', () => { held.length = 0; mouse = null; }, { signal });
    ui.canvas.addEventListener('pointerdown', (e) => { mouse = { x: e.clientX, y: e.clientY }; ui.canvas.setPointerCapture?.(e.pointerId); }, { signal });
    ui.canvas.addEventListener('pointermove', (e) => { if (mouse) mouse = { x: e.clientX, y: e.clientY }; }, { signal });
    const up = () => { mouse = null; };
    ui.canvas.addEventListener('pointerup', up, { signal });
    ui.canvas.addEventListener('pointercancel', up, { signal });
    // the way home is drawn when the power is short; worked out a few times a second
    let path = null, pathAt = -1;
    const view = () => {
        const short = !isHome(s) && !s.ended && s.y > 2 && s.battery < turnBackAt(s) * 1.4 + 4;
        if (!short) path = null;
        else if (s.time - pathAt > 0.4) { pathAt = s.time; path = pathHome(s); }
        return { w: ui.canvas.clientWidth, h: ui.canvas.clientHeight, left: COLUMN, path };
    };
    /** The hand: a direction, and with up a side (held, or pressed in the last 250 ms) to turn into. */
    function hand() {
        const nowMs = performance.now();
        const sideHeld = ['left', 'right'].filter((d) => held.includes(d) || nowMs - pressedAt[d] < 250);
        if (held.includes('up')) return { dir: 'up', side: sideHeld.length ? sideHeld[sideHeld.length - 1] : null };
        return { dir: handDir(), side: null };
    }
    function handDir() {
        if (held.length) return held[held.length - 1];
        if (!mouse) return null;
        const p = rnd.screenOf(s, view());
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return null;
        return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    }

    // ---- the workshop
    const rows = {};
    for (const r of ROWS) {
        const b = el('button', 'dig-buy'); b.type = 'button';
        b.innerHTML = '<span class="dymo is-small"></span><span class="dig-dash"></span><span class="dig-price"></span><span class="dig-desc"></span>';
        b.addEventListener('click', () => { if (buy(s, r)) refreshShop(true); }, { signal });
        ui.shopRows.appendChild(b);
        rows[r] = b;
        b.querySelector('.dymo').textContent = ROW_NAME[r];
    }
    const graftBtn = el('button', 'dig-buy is-graft'); graftBtn.type = 'button';
    graftBtn.innerHTML = '<span class="dymo is-small">GRAFT</span><span class="dig-dash"></span><span class="dig-price"></span><span class="dig-desc"></span>';
    graftBtn.addEventListener('click', () => { if (buyGraft(s)) refreshShop(true); }, { signal });
    ui.shopRows.appendChild(graftBtn);
    let shopKey = '';
    function refreshShop(force = false) {
        const home = isHome(s);
        const key = `${home}|${s.parts}|${s.bio}|${JSON.stringify(s.levels)}|${s.grafts}|${graftShown(s)}`;
        if (!force && key === shopKey) return;
        shopKey = key;
        ui.shop.classList.toggle('dig-away', !home);
        ui.shopNote.textContent = home ? 'At the base.' : 'Buy at the base.';
        for (const r of ROWS) {
            const b = rows[r], lv = s.levels[r], price = priceOf(s, r);
            b.querySelector('.dig-dash').textContent = '■'.repeat(lv) + '□'.repeat(3 - lv);
            b.querySelector('.dig-desc').textContent = rowText(r, lv);
            const pe = b.querySelector('.dig-price');
            if (price === null) { pe.textContent = 'DONE'; pe.className = 'dig-price is-short'; }
            else if (s.parts >= price) { pe.textContent = `${price} PARTS`; pe.className = 'dig-price'; }
            else { pe.textContent = `Need ${price - s.parts} more.`; pe.className = 'dig-price is-short'; }
            b.disabled = !home || price === null || s.parts < price;
            b.classList.toggle('is-ready', !b.disabled);
        }
        graftBtn.hidden = !graftShown(s);
        const g = GRAFTS[s.grafts];
        graftBtn.querySelector('.dig-dash').textContent = '■'.repeat(s.grafts) + '□'.repeat(3 - s.grafts);
        graftBtn.querySelector('.dig-desc').textContent = g ? `${g.name}. ${g.text}` : 'All flesh now.';
        const gp = graftBtn.querySelector('.dig-price');
        if (!g) { gp.textContent = 'DONE'; gp.className = 'dig-price is-short'; }
        else if (s.bio >= g.price) { gp.textContent = `${g.price} BIOMASS`; gp.className = 'dig-price'; }
        else { gp.textContent = `Need ${g.price - s.bio} more.`; gp.className = 'dig-price is-short'; }
        graftBtn.disabled = !home || !g || s.bio < g.price;
        graftBtn.classList.toggle('is-ready', !graftBtn.disabled);
    }

    // ---- the line, typed
    let typed = { n: -1, text: '', shown: 0, kind: 'line' };
    function typeLine(dt) {
        const on = lineNow(s);
        ui.line.classList.toggle('is-gone', !on);
        if (s.line && s.line.n !== typed.n) typed = { n: s.line.n, text: s.line.text, shown: 0, kind: s.line.kind };
        if (typed.shown < typed.text.length) {
            typed.shown = Math.min(typed.text.length, typed.shown + dt * 40);
            ui.line.textContent = typed.text.slice(0, Math.ceil(typed.shown));
            ui.line.className = `dig-line is-${typed.kind}${on ? '' : ' is-gone'}`;
        }
    }

    // ---- the panel
    const last = {};
    const put = (k, node, text) => { if (last[k] !== text) { last[k] = text; node.textContent = text; } };
    const drainLog = [];
    function refreshPanel() {
        const cap = batteryCap(s);
        const pct = Math.max(0, Math.round(100 * s.battery / cap));
        const homePct = Math.min(100, 100 * turnBackAt(s) / cap);
        const low = pct < 25 || (!isHome(s) && s.battery < turnBackAt(s));
        // power running out fast (a corner, the heat): the bar blinks
        const nowMs = performance.now();
        drainLog.push([nowMs, s.battery]);
        while (drainLog.length && nowMs - drainLog[0][0] > 1000) drainLog.shift();
        const fast = !isHome(s) && drainLog.length > 3 && (drainLog[0][1] - s.battery) > cap * 0.05;
        ui.powerTrack.classList.toggle('is-draining', fast);
        put('power', ui.power, `${Math.max(0, Math.round(s.battery))} / ${cap}`);
        // the bar is as long as the battery: an upgrade is seen
        const maxCap = BATTERY_CAP[BATTERY_CAP.length - 1];
        ui.powerTrack.style.width = `${Math.round(30 + 70 * (cap - BATTERY_CAP[0]) / (maxCap - BATTERY_CAP[0]))}%`;
        ui.powerZone.style.width = `${homePct}%`;
        ui.power.classList.toggle('is-red', low);
        ui.powerFill.style.width = `${pct}%`;
        ui.powerFill.classList.toggle('is-red', low);
        const showHome = !isHome(s) && s.y > 2;
        ui.powerHome.style.display = showHome ? '' : 'none';
        ui.powerZone.style.display = showHome ? '' : 'none';
        ui.powerHomeLabel.style.display = showHome ? '' : 'none';
        ui.powerHome.style.left = `${homePct}%`;
        ui.powerHomeLabel.style.left = `${homePct}%`;
        put('cargo', ui.cargo, `${s.cargo.length} / ${cargoCap(s)}`);
        ui.cargo.classList.toggle('is-red', s.cargo.length >= cargoCap(s));
        const best = depthOf(s.record);
        const now = depthM(s);
        put('depth', ui.depth, now < best ? `${now} m · best ${best}` : `${now} m`);
        const col = Math.round(s.reserve);
        put('colony', ui.colony, `${col} %`);
        ui.colony.classList.toggle('is-red', col < 25);
        ui.colonyFill.style.width = `${s.reserve}%`;
        ui.colonyFill.style.background = s.reserve < 25 ? '#ff5a5a' : s.dreaming ? '#c46a92' : '#5fb4ff';
        put('sleepers', ui.sleepers, String(sleepers(s)));
        drawPods();
        put('parts', ui.parts, String(s.parts));
        ui.bioRow.hidden = !(s.bioSeen || s.grafts > 0);
        put('bio', ui.bio, String(s.bio));
        put('finds', ui.finds, `${s.found.length} / ${FINDS.length}`);
    }

    // ---- the pods, small: one goes dark where you can see it
    let blinkPod = null, podsKey = '';
    const pctx = ui.pods.getContext('2d');
    function drawPods() {
        const blinking = blinkPod && performance.now() - blinkPod.at < 2500;
        const key = `${s.dark.length}|${s.dreaming}|${blinking ? Math.floor(performance.now() / 160) % 2 : 'x'}`;
        if (key === podsKey) return;
        podsKey = key;
        pctx.clearRect(0, 0, 240, 26);
        const dark = new Set(s.dark);
        for (let i = 0; i < SLEEPERS; i++) {
            const pod = i + 1, x = (i % 72) * 3.33, y = Math.floor(i / 72) * 9;
            let col = s.dreaming ? '#d33a4a' : '#5fb4ff';
            if (dark.has(pod)) col = '#1a2028';
            if (blinking && pod === blinkPod.pod) col = Math.floor(performance.now() / 160) % 2 ? '#ffffff' : '#ff5a5a';
            pctx.fillStyle = col;
            pctx.fillRect(x, y, 2.4, 7);
        }
    }

    // ---- the end
    let riseShownAt = 0;
    ui.rise.addEventListener('click', () => {
        s.risen = true;
        save();
        ui.rise.hidden = true;
        // something rises first: the red mass climbs the shaft and breaks through the city
        rnd.rise();
        riseTimer = setTimeout(() => {
            sound?.stop();
            playChapterCard({ roman: END.roman, title: END.title, mode: 'to-come', dark: true });
        }, RISE_S * 1000);
    }, { signal });

    // ---- the loop
    let prev = performance.now();
    function frame(now) {
        raf = requestAnimationFrame(frame);
        let dt = Math.min(0.1, (now - prev) / 1000);
        prev = now;
        if (window.__rpiPaused || document.hidden) dt = 0;
        if (dt > 0) {
            const input = s.ended ? {} : hand();
            // small steps, so a slow frame does not skip a tile
            let left = dt;
            while (left > 0) { const h = Math.min(0.05, left); step(s, h, input); left -= h; }
            // a buffered side press turns once; a held key goes on
            if (s.turned) { s.turned = false; for (const d of ['left', 'right']) if (!held.includes(d)) pressedAt[d] = -1e9; }
            for (const e of s.events) {
                sound?.event(e);
                if (e.type === 'find') {
                    const first = !s.findSaid;
                    s.findSaid = true;
                    rnd.pop(e.bio ? `+${e.bio} BIOMASS` : `+${e.parts} PARTS`, '#f2d98a', true, first ? 'Finds are worth more than ore.' : '');
                }
                if (e.type === 'pod') blinkPod = { pod: e.pod, at: performance.now() };
                if (e.type === 'heart') ui.root.classList.add('dig-ending');
                if (e.type === 'buy' || e.type === 'graft' || e.type === 'deliver') shopKey = '';
            }
            s.events.length = 0;
            sound?.update(depthM(s), dt, s.ended);
            if (s.ended && !s.risen && !riseShownAt) riseShownAt = s.time;
            if (riseShownAt && !s.risen && s.time - riseShownAt > 9.5) ui.rise.hidden = false;
            if (!ui.rise.hidden) ui.rise.style.left = `${rnd.r.originX + rnd.worldWidth / 2}px`;
        }
        typeLine(dt);
        refreshPanel();
        refreshShop();
        rnd.draw(s, dt, view());
    }
    raf = requestAnimationFrame(frame);
    saveTimer = setInterval(save, 5000);
    window.addEventListener('beforeunload', save, { signal });
    window.rpiDig = { state: s, save, view, renderer: rnd };
}

export function teardown() {
    save();
    if (ac) ac.abort();
    ac = null;
    cancelAnimationFrame(raf); raf = 0;
    clearInterval(saveTimer); saveTimer = 0;
    clearTimeout(riseTimer); riseTimer = 0;
    try { sound?.stop(); } catch { /* gone */ }
    sound = null;
    root?.remove(); root = null;
    style?.remove(); style = null;
    document.getElementById('phase-deep')?.classList.remove('is-dig');
    document.body.classList.remove('in-deep');
    delete window.rpiDig;
    state = null;
}

