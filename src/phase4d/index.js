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
import { setPhase, phases } from '../gamePhase.js';
import { SAVE_KEY as UNITY_KEY, serialize as serializeUnity, fromVault } from '../phase5/unity.js';
import {
    SAVE_KEY, newState, deserialize, serialize, step, buy, buyGraft, priceOf, ROWS, ROW_NAME, rowText, GRAFTS, graftShown,
    batteryCap, cargoCap, turnBackAt, isHome, sleepers, depthM, lineNow, BATTERY_CAP, SLEEPERS, maxLevel,
    shows, rowShown, stopOpen, closeStop, inWorkshop, roomOf, ping, gpsCharge, gpsReady, boost, teleport, shock,
    fittable, fit, LINE_TTL, buildDrone, buildPrice, buyGen, genOpen, GEN_PRICE, GEN_NAME, LINES,
    tellLoss, maxHp, mendPrice, mendPlates, FLOW_S, HOME_X, buyRefinery, refOpen, REF_PRICE, REF_NAME,
} from './dig.js';
import { has, coolLeft, coolOf, LAB_S, Q_NAME, Q_LINES } from './quantum.js';
import { worstAlarm, ALARM_LINES } from './alarms.js';
import { depthOf, FINDS } from './world.js';
import { createRenderer, RISE_S } from './render.js';
import { pathHome } from './autopilot.js';
import { createDigSound } from './sound.js';

const END = { roman: 'V', title: 'UNITY' };
const COLUMN = 300;                   // the panel's column, px
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
/** The CRT types this fast, ms a letter (as the vault's); the arrival waits this long after the last line. */
const TYPE_MS = 40;
const ARRIVE_HOLD_MS = 1400;
const FRAME_MS = 1000 / 30;           // the picture at 30 fps at most: the owner's machine is slow

const BEAT_SLOW = 1.5, BEAT_END = 4.6;
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
@keyframes dig-crt-in { from { opacity: 0; filter: brightness(2.2) blur(1px); } to { opacity: 1; filter: none; } }
.dig-crt { position: relative; background: #030604; border-radius: 6px; padding: 10px 12px 8px; min-height: 64px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-end;
  box-shadow: inset 0 0 18px rgba(0,0,0,.9), 0 0 0 2px #07080a, 0 0 0 3px #3a4350; font: 14px/20px ui-monospace, 'SF Mono', Menlo, monospace; color: #8dff9e; text-shadow: 0 0 6px rgba(120,255,140,.45); overflow: hidden; margin-bottom: 10px; }
.dig-crt.is-arriving { animation: dig-crt-in 1.4s ease-out both; }
.dig-crt::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px); border-radius: 6px; }
.dig-crt .l { white-space: pre-wrap; word-break: break-word; opacity: .5; }
.dig-crt .l.is-now { opacity: 1; }
.dig-crt .l + .l { margin-top: 4px; }
.dig-crt .l.is-voice { color: #ff8a9a; text-shadow: 0 0 6px rgba(255,120,140,.4); }
.dig-crt .l.is-alarm, .dig-crt .l.is-turnback { color: #ff6b5a; text-shadow: 0 0 6px rgba(255,107,90,.4); }
.dig-crt .l.is-find { color: #ffd678; text-shadow: 0 0 6px rgba(255,214,120,.4); }
.dig-crt .cur { display: inline-block; width: 8px; height: 14px; background: currentColor; vertical-align: -1px; animation: dig-cur 1s steps(1) infinite; }
@keyframes dig-cur { 50% { opacity: 0; } }
.dig-card [data-show] { transition: opacity .6s ease; }
.dig-card .is-new { animation: dig-new 1.6s ease-out; }
@keyframes dig-new { 0% { background: rgba(255,214,120,.35); } 100% { background: transparent; } }
.dig-focus { animation: dig-focus 1s ease-in-out infinite; border-radius: 4px; box-shadow: 0 0 0 2px #ffd678; }
@keyframes dig-focus { 50% { box-shadow: 0 0 0 2px #ffd678, 0 0 16px rgba(255,214,120,.6); } }
.dig-panel.is-bare { background: transparent; box-shadow: none; }
.dig-shop h3 .dig-val { font-size: 16px; }
.dig-buy.is-fresh { box-shadow: inset 0 0 0 2px #ffd678; }
#dig-power-box .dig-row .dig-val, [data-show="parts"] .dig-val, [data-show="cargo"] .dig-val { display: inline-flex; align-items: center; white-space: nowrap; }
.dig-shop { overflow-x: hidden; scrollbar-color: #3a4350 transparent; }
.dig-buy .dig-price.is-short { max-width: 72px; white-space: normal; text-align: right; font-size: 12px; }
.dig-ico { flex: none; width: 15px; height: 15px; margin-right: 5px; vertical-align: -2px; fill: none; stroke: #8fa1b6; stroke-width: 2; stroke-linecap: round; }
.dig-ore { font: 12px/1 system-ui; letter-spacing: 0; margin-right: 8px; }
.dig-ore b { font-weight: 600; margin-left: 5px; }
.dig-ore i { display: inline-block; width: 8px; height: 8px; transform: rotate(45deg); margin-right: 2px; }
#dig-power-box .dig-bar { height: 10px; border-radius: 9999px; background: #cbd5e1; padding: 2px; box-sizing: border-box; }
#dig-power-box .dig-bar > i { border-radius: 9999px; top: 2px; bottom: 2px; left: 2px; background: #64748b; }
#dig-power-box .dig-bar > i.is-red { background: #ff5a5a; }
#dig-gen-box.is-low .dig-val { color: #ff5a5a; animation: dig-blink .8s steps(2) infinite; }
.dig-buy.is-build .dymo { background: #3a2a10; }
.dig-buy.is-sel { background: rgba(255,255,255,.12); outline: 2px solid #f1efe8; outline-offset: -2px; }
.dig-buy.is-fit .dymo { background: #2a1838; }
.dig-buy.is-fit .dig-price { color: #c9b8ff; }
#dig-power-box .dig-bar { margin-bottom: 20px; }
.dig-stop { position: absolute; left: calc(50% + ${COLUMN / 2}px); top: 18px; transform: translateX(-50%); z-index: 30; max-width: 440px; min-width: 280px; padding: 16px 20px 14px; border-radius: 10px; box-sizing: border-box;
  background: rgba(7,8,10,.94); box-shadow: 0 0 0 1.5px #ffd678, 0 20px 60px rgba(0,0,0,.7), 0 0 30px rgba(255,214,120,.15);
  font: 15px/22px ui-monospace, 'SF Mono', Menlo, monospace; color: #ffd678; text-shadow: 0 0 6px rgba(255,214,120,.35); display: flex; flex-direction: column; gap: 12px; }
.dig-stop[hidden] { display: none; }
.dig-stop .ok { align-self: flex-end; border: 0; border-radius: 6px; padding: 6px 20px; background: #ffd678; color: #07080a; font: 600 18px/1 'Bebas Neue', 'Arial Narrow', sans-serif; letter-spacing: .12em; cursor: pointer; }
#dig-root.has-stop #dig-canvas { filter: brightness(.82); }
.dig-alarm { margin: 6px 0 4px; padding: 6px 8px; border-radius: 4px; background: rgba(255,107,90,.12); box-shadow: inset 0 0 0 1px rgba(255,107,90,.6); color: #ff6b5a; font: 600 17px/1 'Bebas Neue', 'Arial Narrow', sans-serif; letter-spacing: .08em; animation: dig-alarm 1s steps(2) infinite; }
.dig-alarm.is-calm { animation: none; font: 13px/1.3 system-ui, sans-serif; letter-spacing: 0; }
.dig-alarm[hidden] { display: none; }
@keyframes dig-alarm { 50% { background: rgba(255,107,90,.28); } }
.dig-ping { position: relative; display: flex; align-items: center; justify-content: space-between; width: 100%; margin: 8px 0 2px; padding: 7px 10px; border: 0; border-radius: 6px; background: #2a313b; color: #f1efe8; cursor: pointer; overflow: hidden;
  font: 600 16px/1 'Bebas Neue', 'Arial Narrow', sans-serif; letter-spacing: .14em; }
.dig-ping[hidden] { display: none; }
.dig-ping > i { position: absolute; left: 0; bottom: 0; height: 3px; background: #8fd0ff; }
.dig-ping.is-ready { background: #3a4350; box-shadow: inset 0 0 0 1px #8fd0ff; }
.dig-ping small { font: 11px/1 system-ui; letter-spacing: 0; color: #8fa1b6; }
#dig-help { position: absolute; right: 16px; bottom: 16px; font: 12px/1.4 system-ui; color: #5d6a78; text-align: right; pointer-events: none; }
`;

/** Rows whose level 0 is a real thing the drone has (a battery, a steel bit): it is a filled box. */
const HAS_BASE = ['battery', 'steering', 'drill', 'cargo', 'lamp', 'hull', 'armour', 'booster'];
const ORE_COLOUR = { 8: '#9fd8e8', 9: '#efe6c8', 10: '#9fe3ff', 11: '#ff4d6d' };
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

function buildDom(host) {
    root = el('div'); root.id = 'dig-root';
    const canvas = el('canvas'); canvas.id = 'dig-canvas';
    const col = el('div', 'dig-col');
    const panel = el('div', 'dig-card dig-panel');
    // pass 3: everything after the CRT is shown one at a time (data-show), as it comes to matter
    panel.innerHTML = `
      <div class="dig-crt" id="dig-crt"></div>
      <div class="dig-alarm" id="dig-alarm" hidden></div>
      <div data-show="sleepers"><div class="dig-row"><span class="dymo is-small">SLEEPERS</span><span class="dig-val" id="dig-sleepers">216</span></div>
      <canvas class="dig-pods" id="dig-pods" width="240" height="26"></canvas></div>
      <div class="dig-row" id="dig-drone-row" hidden><span class="dymo is-small" id="dig-drone">DRONE 2</span><span class="dig-val" id="dig-drone-state"></span></div>
      <div data-show="power" id="dig-power-box"><div class="dig-row"><span class="dymo is-small">POWER</span><span class="dig-val"><svg class="dig-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2"/></svg><span id="dig-power">100 %</span></span></div>
      <div class="dig-bar" id="dig-power-track"><i id="dig-power-fill"></i><s id="dig-power-zone"></s><b id="dig-power-home"></b><em id="dig-power-home-label">HOME</em></div></div>
      <div class="dig-row" id="dig-hp-row" hidden><span class="dymo is-small">ARMOUR</span><span class="dig-val" id="dig-hp"></span></div>
      <div data-show="cargo" class="dig-row" style="margin-top:12px"><span class="dymo is-small">CARGO</span><span class="dig-val"><span id="dig-ore" class="dig-ore"></span><span id="dig-cargo">0 / 8</span></span></div>
      <div data-show="depth" class="dig-row"><span class="dymo is-small">DEPTH</span><span class="dig-val" id="dig-depth">0 m</span></div>
      <div data-show="parts" class="dig-row"><span class="dymo is-small">PARTS</span><span class="dig-val"><svg class="dig-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg><span id="dig-parts">0</span></span></div>
      <div data-show="gen" id="dig-gen-box"><div class="dig-row"><span class="dymo is-small">GENERATORS</span><span class="dig-val" id="dig-colony">100 %</span></div>
      <div class="dig-bar"><i id="dig-colony-fill" style="background:#5fb4ff"></i></div></div>
      <div class="dig-row" id="dig-bio-row" hidden><span class="dymo is-small">BIOMASS</span><span class="dig-val" id="dig-bio">0</span></div>
      <div data-show="finds" class="dig-row"><span class="dymo is-small">FINDS</span><span class="dig-val" id="dig-finds">0 / 12</span></div>
      <div class="dig-row" id="dig-q-row" hidden><span class="dymo is-small">QUANTUM OBJECT</span><span class="dig-val" id="dig-q">1</span></div>
      <button type="button" class="dig-ping" id="dig-ping" hidden><span>PING</span><small>G</small><i id="dig-ping-bar"></i></button>
      <button type="button" class="dig-ping" data-q="booster" hidden><span>BOOSTER</span><small>B</small><i></i></button>
      <button type="button" class="dig-ping" data-q="teleport" hidden><span>TELEPORT</span><small>T</small><i></i></button>
      <button type="button" class="dig-ping" data-q="shock" hidden><span>SHOCK WAVE</span><small>Q</small><i></i></button>`;
    const shop = el('div', 'dig-card dig-shop');
    shop.innerHTML = `<h3><span class="dymo is-small" id="dig-shop-title">WORKSHOP</span><span class="dig-val" id="dig-shop-note"></span></h3><div id="dig-shop-rows"></div>`;
    col.append(panel, shop);
    const stop = el('div', 'dig-stop'); stop.id = 'dig-stop'; stop.hidden = true;
    stop.innerHTML = '<div class="txt" id="dig-stop-text"></div><button type="button" class="ok" id="dig-stop-ok">OK</button>';
    const rise = el('button', '', 'RISE'); rise.id = 'dig-rise'; rise.hidden = true; rise.type = 'button';
    const help = el('div', '', 'Arrows or WASD. Or hold the mouse beside the drone.'); help.id = 'dig-help';
    root.append(canvas, col, rise, help, stop);
    host.appendChild(root);
    const $ = (id) => root.querySelector('#' + id);
    return {
        canvas, rise, help,
        powerTrack: $('dig-power-track'), powerZone: $('dig-power-zone'), pods: $('dig-pods'), root,
        power: $('dig-power'), powerFill: $('dig-power-fill'), powerHome: $('dig-power-home'), powerHomeLabel: $('dig-power-home-label'),
        cargo: $('dig-cargo'), depth: $('dig-depth'), colony: $('dig-colony'), colonyFill: $('dig-colony-fill'),
        sleepers: $('dig-sleepers'), parts: $('dig-parts'), bio: $('dig-bio'), bioRow: $('dig-bio-row'), finds: $('dig-finds'),
        crt: $('dig-crt'), shopTitle: $('dig-shop-title'), shopNote: $('dig-shop-note'), shopRows: $('dig-shop-rows'), shop, panel,
        stop, stopText: $('dig-stop-text'), stopOk: $('dig-stop-ok'), powerBox: $('dig-power-box'), genBox: $('dig-gen-box'),
        showEls: [...panel.querySelectorAll('[data-show]')],
        hpRow: $('dig-hp-row'), hp: $('dig-hp'),
        ore: $('dig-ore'), droneRow: $('dig-drone-row'), drone: $('dig-drone'), droneState: $('dig-drone-state'),
        alarm: $('dig-alarm'), ping: $('dig-ping'), pingBar: $('dig-ping-bar'), qRow: $('dig-q-row'), q: $('dig-q'),
        qBtns: [...panel.querySelectorAll('[data-q]')],
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
    /** The dig's end leads into chapter V as the vault's does: the sleepers still alive are its minds. */
    function toUnity(fresh = false) {
        save();
        try { if (fresh || !localStorage.getItem(UNITY_KEY)) localStorage.setItem(UNITY_KEY, serializeUnity(fromVault(sleepers(s)))); } catch { /* full */ }
        playChapterCard({ roman: END.roman, title: END.title, dark: true, hold: 2200, onMidpoint: () => setPhase(phases.UNITY) });
    }
    if (s.risen) riseTimer = setTimeout(() => toUnity(false), 0);

    // ---- the hands
    let beat = null, flowPath = null, flowRows = 0;
    const held = [];
    let mouse = null;              // {x, y} while the button is held on the world
    const pressedAt = { left: -1e9, right: -1e9 };
    const press = (dir) => { const i = held.indexOf(dir); if (i >= 0) held.splice(i, 1); held.push(dir); if (dir in pressedAt) pressedAt[dir] = performance.now(); };
    const release = (dir) => { const i = held.indexOf(dir); if (i >= 0) held.splice(i, 1); };
    // Captured on the window, before the shell's own keys: Space and Enter belong to the dig (stops, the
    // workshop) and must never reach the shell's pause (v1.92.0: Space paused the game, the drone "locked").
    window.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey) return;
        const d = KEYS[e.key];
        const confirmKey = e.key === 'Enter' || e.key === ' ' || e.code === 'Space';
        if (confirmKey) { e.preventDefault(); e.stopPropagation(); }
        // the death beat: nothing is taken (no input is lost) until the camera has arrived
        if (beat) { e.preventDefault(); return; }
        // a stop closes only on OK, Enter or Space (the Dig stop also on down, which is what it asks), and not
        // in its first 0.8 s (a click or key in flight does not eat it); the arrival is typed: a key finishes it
        if (stopOpen(s)) {
            e.preventDefault();
            if (s.tut.stop.crt) { if (d || confirmKey) crtSkip(); return; }
            const doing = d === 'down' && s.tut.stop.id === 'dig';
            if (!e.repeat && (confirmKey || doing) && stopReady()) closeStop(s);
            if (!doing) return;
            if (stopOpen(s)) return;
        }
        // the workshop with keys: up and down choose a row, Enter or Space buys it (left and right still drive)
        if (!stopOpen(s) && !ui.shop.hidden) {
            // down past the last row leaves the workshop: the drone drives to the hatch and down
            if ((d === 'up' || d === 'down') && moveSel(d === 'up' ? -1 : 1)) { e.preventDefault(); return; }
            if (confirmKey && !e.repeat) { buySel(); return; }
        }
        if (confirmKey) return;
        if ((e.key === 'g' || e.key === 'G') && !stopOpen(s)) { e.preventDefault(); ping(s); return; }
        // the lab's gifts: B, T, Q
        const qk = { b: boost, t: teleport, q: shock }[e.key.toLowerCase()];
        if (qk && !stopOpen(s)) { e.preventDefault(); qk(s); return; }
        if (!d) return;
        e.preventDefault();
        press(d);
    }, { signal, capture: true });
    ui.ping.addEventListener('click', () => ping(s), { signal });
    for (const b of ui.qBtns) b.addEventListener('click', () => ({ booster: boost, teleport, shock })[b.dataset.q](s), { signal });
    window.addEventListener('keyup', (e) => { const d = KEYS[e.key]; if (d) release(d); }, { signal });
    window.addEventListener('blur', () => { held.length = 0; mouse = null; }, { signal });
    ui.canvas.addEventListener('pointerdown', (e) => { if (beat || stopOpen(s)) return; mouse = { x: e.clientX, y: e.clientY }; ui.canvas.setPointerCapture?.(e.pointerId); }, { signal });
    ui.canvas.addEventListener('pointermove', (e) => { if (mouse) mouse = { x: e.clientX, y: e.clientY }; }, { signal });
    const up = () => { mouse = null; };
    ui.canvas.addEventListener('pointerup', up, { signal });
    ui.canvas.addEventListener('pointercancel', up, { signal });
    // the way home is drawn when the power is short; worked out a few times a second
    let path = null, pathAt = -1;
    const view = () => {
        const short = s.levels.homing > 0 && !isHome(s) && !s.ended && s.y > 2 && s.battery < turnBackAt(s) * 1.4 + 4;
        if (!short) path = null;
        else if (s.time - pathAt > 0.4) { pathAt = s.time; path = pathHome(s); }
        const st = s.tut && s.tut.stop;
        if (s.flowT != null && !flowPath) { const p = pathHome(s); flowPath = p && p.length > 1 ? p.slice().reverse() : [[HOME_X, -1], [s.x, s.y]]; }
        return { w: ui.canvas.clientWidth, h: ui.canvas.clientHeight, left: COLUMN, path, focus: st && !st.crt ? st.focus : null, beat, flowPath };
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
        b.addEventListener('click', () => { if (buy(s, r)) refreshShop(true); b.blur(); }, { signal });
        b.dataset.row = r;
        ui.shopRows.appendChild(b);
        rows[r] = b;
        b.querySelector('.dymo').textContent = ROW_NAME[r];
    }
    // the lab's things are fitted here: FIT BOOSTER and what it does
    const fits = {};
    for (const id of Object.keys(Q_NAME)) {
        if (id === 'other') continue;
        const b = el('button', 'dig-buy is-fit'); b.type = 'button';
        b.innerHTML = `<span class="dymo is-small">FIT ${Q_NAME[id]}</span><span class="dig-dash"></span><span class="dig-price">FIT</span><span class="dig-desc"></span>`;
        b.querySelector('.dig-desc').textContent = Q_LINES.use[id];
        b.addEventListener('click', () => { if (fit(s, id)) refreshShop(true); b.blur(); }, { signal });
        b.dataset.row = `fit-${id}`;
        ui.shopRows.prepend(b);
        fits[id] = b;
    }
    // the selected row (keys): the first one that can be bought, kept by name
    let sel = null;
    const shopButtons = () => [...ui.shopRows.querySelectorAll('.dig-buy')].filter((b) => !b.hidden);
    let selFresh = null;
    function paintSel() {
        const list = shopButtons();
        // something new in the workshop is the row chosen when it comes
        const fresh = s.tut && s.tut.on ? s.tut.fresh : null;
        if (fresh !== selFresh) { selFresh = fresh; if (fresh && list.some((b) => b.dataset.row === fresh)) sel = fresh; }
        if (!list.some((b) => b.dataset.row === sel)) sel = (list.find((b) => !b.disabled) || list[0])?.dataset.row ?? null;
        for (const b of ui.shopRows.querySelectorAll('.dig-buy')) b.classList.toggle('is-sel', b.dataset.row === sel);
    }
    function moveSel(k) {
        const list = shopButtons();
        if (!list.length) return false;
        const i = Math.max(0, list.findIndex((b) => b.dataset.row === sel));
        if (i + k >= list.length) return false;           // past the last row: not a choice, the way down
        sel = list[Math.max(0, i + k)].dataset.row;
        paintSel();
        list.find((b) => b.dataset.row === sel)?.scrollIntoView?.({ block: 'nearest' });
        return true;
    }
    function buySel() {
        const b = shopButtons().find((x) => x.dataset.row === sel);
        if (b && !b.disabled) b.click();
    }
    const graftBtn = el('button', 'dig-buy is-graft'); graftBtn.type = 'button';
    graftBtn.innerHTML = '<span class="dymo is-small">GRAFT</span><span class="dig-dash"></span><span class="dig-price"></span><span class="dig-desc"></span>';
    graftBtn.addEventListener('click', () => { if (buyGraft(s)) refreshShop(true); graftBtn.blur(); }, { signal });
    graftBtn.dataset.row = 'graft';
    ui.shopRows.appendChild(graftBtn);
    // a lost drone: BUILD A DRONE (spec H2); the generator's levels at the GENERATOR (H5)
    const buildBtn = el('button', 'dig-buy is-build'); buildBtn.type = 'button';
    buildBtn.innerHTML = '<span class="dymo is-small"></span><span class="dig-dash"></span><span class="dig-price"></span><span class="dig-desc"></span>';
    buildBtn.addEventListener('click', () => { if (buildDrone(s)) refreshShop(true); buildBtn.blur(); }, { signal });
    buildBtn.dataset.row = 'build';
    ui.shopRows.prepend(buildBtn);
    const mendBtn = el('button', 'dig-buy'); mendBtn.type = 'button';
    mendBtn.innerHTML = '<span class="dymo is-small">MEND PLATES</span><span class="dig-dash"></span><span class="dig-price"></span><span class="dig-desc">A dent hammered out, a plate bolted on.</span>';
    mendBtn.addEventListener('click', () => { if (mendPlates(s)) refreshShop(true); mendBtn.blur(); }, { signal });
    mendBtn.dataset.row = 'mend';
    ui.shopRows.prepend(mendBtn);
    const refBtn = el('button', 'dig-buy'); refBtn.type = 'button';
    refBtn.innerHTML = '<span class="dymo is-small"></span><span class="dig-dash"></span><span class="dig-price"></span><span class="dig-desc">+25 % PARTS per ore.</span>';
    refBtn.addEventListener('click', () => { if (buyRefinery(s)) refreshShop(true); refBtn.blur(); }, { signal });
    refBtn.dataset.row = 'refinery';
    ui.shopRows.appendChild(refBtn);
    const genBtn = el('button', 'dig-buy'); genBtn.type = 'button';
    genBtn.innerHTML = '<span class="dymo is-small"></span><span class="dig-dash"></span><span class="dig-price"></span><span class="dig-desc">Burns ore slower.</span>';
    genBtn.addEventListener('click', () => { if (buyGen(s)) refreshShop(true); genBtn.blur(); }, { signal });
    genBtn.dataset.row = 'gen';
    ui.shopRows.appendChild(genBtn);
    let shopKey = '';
    function refreshShop(force = false) {
        const lost = !!s.lost && !s.ended;
        const atGen = !lost && roomOf(s) === 'generator' && genOpen(s) && !s.ended;
        // the REFINERY is sold at the WAREHOUSE, from the third delivery on
        const atRef = !lost && roomOf(s) === 'warehouse' && refOpen(s) && !s.ended;
        const here = !lost && inWorkshop(s) && !s.ended;
        const fresh = s.tut && s.tut.on ? s.tut.fresh : null;
        const key = `${here}|${lost}|${atGen}|${roomOf(s)}|${s.deliveries}|${s.refFresh}|${s.hp}|${s.hoverOffer}|${s.parts}|${s.bio}|${JSON.stringify(s.levels)}|${s.grafts}|${graftShown(s)}|${s.tut?.rows.join()}|${fresh}|${fittable(s).join()}|${s.lostCount}`;
        if (!force && key === shopKey) return;
        shopKey = key;
        // the workshop is a place: its card is up while the drone stands in it (or while there is none);
        // at the GENERATOR the same card sells the generator's levels
        ui.shop.hidden = !(here || lost || atGen || atRef);
        ui.shopTitle.textContent = atGen ? 'GENERATOR' : atRef ? 'WAREHOUSE' : 'WORKSHOP';
        const rl = s.levels.refinery || 0, refP = REF_PRICE[rl];
        refBtn.hidden = !atRef;
        refBtn.querySelector('.dymo').textContent = refP === undefined ? REF_NAME[rl - 1] : REF_NAME[rl];
        refBtn.querySelector('.dig-dash').textContent = '■'.repeat(rl) + '□'.repeat(4 - rl);
        const rpe = refBtn.querySelector('.dig-price');
        if (refP === undefined) { rpe.textContent = 'DONE'; rpe.className = 'dig-price is-short'; }
        else if (s.parts >= refP) { rpe.textContent = `${refP} PARTS`; rpe.className = 'dig-price'; }
        else { rpe.textContent = `Need ${refP - s.parts} more.`; rpe.className = 'dig-price is-short'; }
        refBtn.disabled = refP === undefined || s.parts < refP;
        refBtn.classList.toggle('is-ready', !refBtn.disabled);
        refBtn.classList.toggle('is-fresh', !!s.refFresh);
        ui.shopNote.textContent = `${s.parts} PARTS`;
        const bp = buildPrice(s);
        buildBtn.hidden = !lost;
        const mp = mendPrice(s);
        mendBtn.hidden = !here || mp <= 0;
        mendBtn.querySelector('.dig-price').textContent = `${mp} PARTS`;
        mendBtn.disabled = s.parts < mp;
        mendBtn.classList.toggle('is-ready', !mendBtn.disabled);
        buildBtn.querySelector('.dymo').textContent = LINES.build(bp);
        buildBtn.querySelector('.dig-desc').textContent = 'The same upgrades. A full battery.';
        buildBtn.querySelector('.dig-price').textContent = bp ? `${bp} PARTS` : 'FREE';
        buildBtn.classList.toggle('is-ready', lost);
        const gl = s.levels.gen || 0, genP = GEN_PRICE[gl];
        genBtn.hidden = !atGen;
        genBtn.querySelector('.dymo').textContent = genP === undefined ? GEN_NAME[gl] : GEN_NAME[gl + 1];
        genBtn.querySelector('.dig-dash').textContent = '■'.repeat(gl + 1) + '□'.repeat(3 - gl);
        const gpe = genBtn.querySelector('.dig-price');
        if (genP === undefined) { gpe.textContent = 'DONE'; gpe.className = 'dig-price is-short'; }
        else if (s.parts >= genP) { gpe.textContent = `${genP} PARTS`; gpe.className = 'dig-price'; }
        else { gpe.textContent = `Need ${genP - s.parts} more.`; gpe.className = 'dig-price is-short'; }
        genBtn.disabled = genP === undefined || s.parts < genP;
        genBtn.classList.toggle('is-ready', !genBtn.disabled);
        for (const r of ROWS) {
            const b = rows[r], lv = s.levels[r], price = priceOf(s, r), top = maxLevel(r);
            // a one-level upgrade leaves the list once it is bought
            b.hidden = !here || !rowShown(s, r) || (top === 1 && lv >= 1);
            b.classList.toggle('is-fresh', fresh === r);
            // the boxes mean the same on every row: the levels that exist; the ones the drone has are filled
            const base = HAS_BASE.includes(r) ? 1 : 0;
            b.querySelector('.dig-dash').textContent = '■'.repeat(lv + base) + '□'.repeat(top - lv);
            b.querySelector('.dig-desc').textContent = rowText(r, lv);
            const pe = b.querySelector('.dig-price');
            if (price === null) { pe.textContent = 'DONE'; pe.className = 'dig-price is-short'; }
            else if (s.parts >= price) { pe.textContent = `${price} PARTS`; pe.className = 'dig-price'; }
            else { pe.textContent = `Need ${price - s.parts} more.`; pe.className = 'dig-price is-short'; }
            b.disabled = !here || price === null || s.parts < price;
            b.classList.toggle('is-ready', !b.disabled);
        }
        graftBtn.hidden = !here || !graftShown(s);
        graftBtn.classList.toggle('is-fresh', fresh === 'graft');
        const g = GRAFTS[s.grafts];
        graftBtn.querySelector('.dig-dash').textContent = '■'.repeat(s.grafts) + '□'.repeat(3 - s.grafts);
        graftBtn.querySelector('.dig-desc').textContent = g ? `${g.name}. ${g.text}` : 'All flesh now.';
        const gp = graftBtn.querySelector('.dig-price');
        if (!g) { gp.textContent = 'DONE'; gp.className = 'dig-price is-short'; }
        else if (s.bio >= g.price) { gp.textContent = `${g.price} BIOMASS`; gp.className = 'dig-price'; }
        else { gp.textContent = `Need ${g.price - s.bio} more.`; gp.className = 'dig-price is-short'; }
        graftBtn.disabled = !here || !g || s.bio < g.price;
        graftBtn.classList.toggle('is-ready', !graftBtn.disabled);
        const canFit = fittable(s);
        for (const [id, b] of Object.entries(fits)) {
            b.hidden = !here || !canFit.includes(id);
            b.disabled = !here;
            b.classList.toggle('is-ready', !b.hidden && here);
            b.classList.toggle('is-fresh', fresh === `fit-${id}`);
        }
        paintSel();
    }

    // ---- the CRT: the arrival typed (40 ms a letter), then the lines the rules say
    const crt = { lines: [], n: -1 };
    let crtAt = performance.now(), crtDoneAt = 0;
    function crtSkip() {
        if (!crtDoneAt) crtAt = -1e9;
        else { crtDoneAt = -1e9; }
    }
    // the act comes in under the IV · DEEP card: the CRT waits until the card has lifted
    const cardUp = () => !!document.getElementById('chapter-card')?.classList.contains('is-active');
    let crtLit = false;
    function stepCrt(nowMs) {
        let html;
        const st = s.tut && s.tut.stop;
        if (st && st.crt && cardUp()) {
            crtAt = nowMs; crtDoneAt = 0;
            ui.crt.style.opacity = '0';
            return;
        }
        if (st && st.crt && !crtLit) { crtLit = true; crtAt = Math.max(crtAt, nowMs); ui.crt.style.opacity = ''; ui.crt.classList.add('is-arriving'); }
        if (st && st.crt) {
            // the arrival: line after line, 40 ms a letter, a short pause between
            let ms = nowMs - crtAt - 900, done = true;
            const parts = [];
            for (const l of st.text) {
                const n = Math.max(0, Math.min(l.length, Math.floor(ms / TYPE_MS)));
                if (n > 0 || !parts.length) parts.push(`<div class="l is-now">${esc(l.slice(0, n))}${n < l.length ? '<span class="cur"></span>' : ''}</div>`);
                if (n < l.length) { done = false; break; }
                ms -= l.length * TYPE_MS + 500;
                if (ms < 0) { done = false; break; }
            }
            if (done && !crtDoneAt) crtDoneAt = nowMs;
            if (done && nowMs - crtDoneAt > ARRIVE_HOLD_MS) {
                closeStop(s);
                crt.lines = st.text.map((text) => ({ text, kind: 'sys', shown: text.length, n: -1 }));
            }
            html = parts.join('');
        } else {
            const line = s.line;
            if (line && line.n !== crt.n) {
                crt.n = line.n;
                const last = crt.lines[crt.lines.length - 1];
                if (line.text && last && last.text === line.text) {
                    // never the same line twice in a row: the one there is renewed
                    last.at = nowMs; last.n = line.n; last.ttl = LINE_TTL[line.kind] ?? 6;
                } else if (line.text) {
                    // the arrival's words go when the first real line comes
                    crt.lines = crt.lines.filter((l) => l.kind !== 'sys');
                    crt.lines.push({ text: line.text, kind: line.kind, shown: 0, n: line.n, at: nowMs, ttl: LINE_TTL[line.kind] ?? 6 });
                    if (crt.lines.length > 4) crt.lines.splice(0, crt.lines.length - 4);
                } else if (last && last.n === line.n - 1) {
                    // the line stopped being true (turn back, a hint): it goes
                    crt.lines.pop();
                }
            }
            // a line whose time is up goes (it is no longer true)
            const cur = lineNow(s);
            crt.lines = crt.lines.filter((l) => l.kind === 'sys'
                || (l.ttl === Infinity ? !!cur && cur.n === l.n : nowMs - l.at < (l.ttl ?? 6) * 1000 + 1500));
            const on = lineNow(s);
            html = crt.lines.map((l, k) => {
                if (l.n >= 0 && l.shown < l.text.length) l.shown = Math.min(l.text.length, Math.floor((nowMs - l.at) / (TYPE_MS * 0.6)));
                const now = k === crt.lines.length - 1 && on && on.n === l.n;
                return `<div class="l is-${l.kind}${now ? ' is-now' : ''}">${esc(l.text.slice(0, l.shown))}${l.shown < l.text.length ? '<span class="cur"></span>' : ''}</div>`;
            }).join('');
        }
        if (ui.crt.__html !== html) { ui.crt.innerHTML = html; ui.crt.__html = html; }
    }

    // ---- the stop: the amber box (the arrival is on the CRT instead)
    ui.stopOk.addEventListener('click', () => { if (stopReady()) closeStop(s); }, { signal });
    // a stop is not dismissed in its first 0.8 s
    let stopSeen = null, stopSince = 0;
    const stopReady = () => performance.now() - stopSince >= 800;
    let stopHtml = '';
    function refreshStop() {
        const st = s.tut && s.tut.stop;
        if (st !== stopSeen) { stopSeen = st; stopSince = performance.now(); }
        const box = !!st && !st.crt && !beat;
        ui.stop.hidden = !box;
        ui.root.classList.toggle('has-stop', box);
        const html = box ? st.text.map((l) => `<div>${esc(l)}</div>`).join('') : '';
        if (html !== stopHtml) { stopHtml = html; ui.stopText.innerHTML = html; }
        ui.powerBox.classList.toggle('dig-focus', box && st.focus === 'power');
        ui.genBox.classList.toggle('dig-focus', box && st.focus === 'gen');
    }

    // ---- the panel
    const last = {};
    const put = (k, node, text) => { if (last[k] !== text) { last[k] = text; node.textContent = text; } };
    const drainLog = [];
    const shown = {};
    function refreshPanel() {
        const arriving = stopOpen(s) && s.tut.stop.crt;
        for (const e of ui.showEls) {
            const w = e.dataset.show;
            const on = w === 'sleepers' ? !arriving : shows(s, w);
            if (on !== shown[w]) {
                if (on && shown[w] === false) { e.classList.remove('is-new'); void e.offsetWidth; e.classList.add('is-new'); }
                shown[w] = on;
                e.hidden = !on;
            }
        }
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
        // ORE in the cargo, one mark a kind (ROCK, PAPER, SCISSORS; biomass red)
        const counts = {};
        for (const t of s.cargo) counts[t] = (counts[t] || 0) + 1;
        const oreHtml = Object.entries(counts).map(([t, n]) => `<i style="background:${ORE_COLOUR[t] || '#ccc'}"></i><b>${n}</b>`).join(' ');
        if (ui.ore.__h !== oreHtml) { ui.ore.__h = oreHtml; ui.ore.innerHTML = oreHtml; }
        // the drone's number, from the second
        ui.droneRow.hidden = (s.droneN || 1) < 2 && !s.lost;
        put('drone', ui.drone, s.lost ? `DRONE ${s.droneN}` : `DRONE ${s.droneN || 1}`);
        put('dronestate', ui.droneState, s.lost ? 'LOST' : s.build > 0 ? 'BUILDING' : '');
        ui.genBox.classList.toggle('is-low', s.reserve < 30);
        // the plates: filled while whole, empty when a hit has taken one
        const mh = maxHp(s);
        ui.hpRow.hidden = mh < 2 && (s.hp ?? 1) >= mh;
        put('hp', ui.hp, '▮'.repeat(Math.max(0, s.hp ?? 1)) + '▯'.repeat(Math.max(0, mh - (s.hp ?? 1))));
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
        // the base's alarm: at home, or anywhere with the radio
        const al = s.alarms;
        const hear = isHome(s) || s.levels.radio > 0;
        const worst = worstAlarm(s);
        let alarm = '', calm = false;
        if (hear && worst) alarm = ALARM_LINES.tag(worst.id, worst.until - s.time, worst.cost) + (al.list.length > 1 ? ` +${al.list.length - 1}` : '');
        else if (hear && al && al.genDown) { alarm = ALARM_LINES.genStop; calm = true; }
        put('alarm', ui.alarm, alarm);
        ui.alarm.hidden = !alarm || (stopOpen(s) && s.tut.stop.crt);
        ui.alarm.classList.toggle('is-calm', calm);
        ui.alarm.classList.toggle('dig-focus', !!(s.tut && s.tut.stop && s.tut.stop.focus === 'alarm'));
        // what the drone carries from the other side, and the lab at work
        const q = s.quantum;
        const qText = q ? (q.carry.length ? String(q.carry.length) : q.lab !== null ? `LAB ${Math.ceil(LAB_S - q.lab)} s` : q.labQ ? 'LAB' : '') : '';
        ui.qRow.hidden = !qText;
        put('q', ui.q, qText);
        for (const b of ui.qBtns) {
            const id = b.dataset.q;
            b.hidden = !has(s, id);
            if (b.hidden) continue;
            const left = coolLeft(s, id);
            b.querySelector('i').style.width = `${Math.round(100 * (1 - left / coolOf(s, id)))}%`;
            b.classList.toggle('is-ready', left === 0 && !isHome(s));
        }
        // the GPS: a button with its charge
        ui.ping.hidden = !(s.levels.gps > 0);
        if (s.levels.gps > 0) {
            ui.pingBar.style.width = `${Math.round(100 * gpsCharge(s))}%`;
            ui.ping.classList.toggle('is-ready', gpsReady(s) && !isHome(s));
        }
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
    ui.rise.addEventListener('click', () => {
        s.risen = true;
        save();
        ui.rise.hidden = true;
        // something rises first: the red mass climbs the shaft and breaks through the city
        rnd.rise();
        riseTimer = setTimeout(() => {
            sound?.stop();
            toUnity(true);
        }, RISE_S * 1000);
    }, { signal });

    // ---- the loop
    let prev = performance.now(), drawnAt = -1e9, wasInShop = false, warnT = 0;
    function frame(now) {
        raf = requestAnimationFrame(frame);
        let dt = Math.min(0.1, (now - prev) / 1000);
        prev = now;
        if (window.__rpiPaused || document.hidden) dt = 0;
        // a stop: the world stands still (the rules see it too); the picture keeps breathing
        if (stopOpen(s)) dt = 0;
        // the death beat (v1.92.4): slow for 1.5 s, a hold on the dead drone, the camera up to the workshop
        if (beat) {
            beat.t += Math.min(0.1, (now - (beat.last || now)) / 1000); beat.last = now;
            if (beat.t < BEAT_SLOW) dt *= 0.2;
            if (beat.t >= BEAT_END) { beat = null; tellLoss(s); }
        }
        if (dt > 0) {
            const input = s.ended || beat ? {} : hand();
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
                if (e.type === 'dead' && e.y >= 0) { beat = { t: 0, x: e.x, y: e.y, why: s.lostWhy, last: now }; held.length = 0; mouse = null; }
                if (e.type === 'build' || e.type === 'buy' || e.type === 'fit' || e.type === 'mend' || e.type === 'graft') rnd.arms(e.type === 'build' ? 'build' : 'fit');
                if (e.type === 'hit') rnd.hitFlash();
                if (e.type === 'shock' || e.type === 'teleport') rnd.ring(e.type);
                if (e.type === 'full') { rnd.pop('Cargo full.', '#f1efe8', false); rnd.fullFlash(); }
                if (e.type === 'unloaded') rnd.pop(LINES.unloaded(e.ore, e.gen || 0, e.parts, e.refined || 0), '#f2d98a', false);
                if (e.type === 'dup') rnd.dupFlash(e.at);
                if (e.type === 'bump') rnd.bump(s);
                if (e.type === 'q-named') rnd.label(e.i, 'QUANTUM OBJECT');
                if (e.type === 'heart') ui.root.classList.add('dig-ending');
                if (e.type === 'flow') {
                    // the way the drone came, from the base down to the heart
                    const p = pathHome(s);
                    flowPath = p && p.length > 1 ? p.slice().reverse() : [[HOME_X, -1], [s.x, s.y]];
                }
                if (e.type === 'buy' || e.type === 'graft' || e.type === 'deliver') shopKey = '';
            }
            s.events.length = 0;
            sound?.update(depthM(s), dt, s.ended);
            // EARLY WARNING: a soft beep, repeating while it holds
            if (s.warnOn && !s.lost) { warnT -= dt; if (warnT <= 0) { warnT = 1.1; sound?.beep(); } } else warnT = 0;
            // RISE once the sleepers have reached the heart
            if (s.flowDone && !s.risen) ui.rise.hidden = false;
            // the windows going dark: a soft sound for each row of them
            if (s.flowT != null) {
                const rows = Math.floor(Math.min(1, s.flowT / (FLOW_S * 0.7)) * 36);
                if (rows > flowRows) { flowRows = rows; sound?.window(); }
            }
            if (!ui.rise.hidden) ui.rise.style.left = `${rnd.r.originX + rnd.worldWidth / 2}px`;
        }
        // the new row is seen once the drone has been in the workshop and left
        const inShop = roomOf(s) === 'workshop';
        if (wasInShop && !inShop && s.tut && s.tut.fresh) s.tut.fresh = null;
        wasInShop = inShop;
        stepCrt(now);
        refreshStop();
        refreshPanel();
        refreshShop();
        // the picture: 30 fps at most, 10 while a stop holds the world
        const every = stopOpen(s) ? 100 : FRAME_MS;
        if (now - drawnAt >= every) {
            const since = Math.min(0.2, (now - drawnAt) / 1000);
            drawnAt = now;
            rnd.draw(s, since, view());
        }
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

