/* global lucide */
/**
 * Chapter V · UNITY (docs/superpowers/specs/2026-10-06-chapter-v-unity.md): the phase.
 * Builds its own screen in the vault's house style (the map canvas, the panel with the CRT, the four
 * flows and their red word, GROW AS, EDGE, MINDS, the EXPERIMENTS bar, the guide box, the stop box,
 * the time buttons), runs the clock and saves. The rules are in unity.js.
 */
import * as U from './unity.js';
import { createUnityView } from './view.js';
import { UNITY_CSS } from './style.js';
import { createUnitySound } from './sound.js';
import { audio } from '../audio.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS } from '../constants.js';

export const TYPE_MS = 26;
export const CRT_LINES = 4;
/** The camera pulls out this long at the end of a map. */
export const ZOOM_MS = 3600;
/** A guide's box stays this long. */
export const GUIDE_MS = 8000;
const SAVE_EVERY_MS = 4000;
/** Cards in the EXPERIMENTS bar at most. */
export const MAX_CARDS = 6;
/** Fast is this many times. */
export const FAST = 3;
/** What the edge modes beat, on their buttons. */
export const MODE_SUB = { WRAP: 'beats rock', CUT: 'beats paper', CRUSH: 'beats scissors' };
/** New words of this screen (the rest are the rules'). */
export const WORDS = {
    atEdge: (k) => `At the edge: ${k}.`,
    two: 'Eating at two thirds.',
    knows: 'The edge knows.',
    biteHint: 'Click the edge.',
    gut: (v) => `In the gut: ${v}`,
    next: (k) => ` Next: ${k}.`,
    dirHint: 'Click the map to grow that way.',
    perDay: (v) => `${v} a day`,
    insight: (v) => `Insight ${v}`,
    spare: (v) => `${v} % spare`,
    of: (p, where) => `${p} % of ${where}`,
    memory: (n) => `Memory ${n}`,
    processing: (n) => `Processing ${n}`,
    free: 'free',
};
const WHERE = ['the city', 'the county', 'the country', 'the continent', 'the land'];

let root = null, styleEl = null, rafId = 0, abort = null, sound = null, saveTimer = null, beforeUnload = null, view = null;
let savingEnabled = true;
let timers = [];

export function init() {
    abort = new AbortController();
    const signal = abort.signal;
    savingEnabled = true;
    document.body.classList.add('in-unity');
    styleEl = document.createElement('style');
    styleEl.textContent = UNITY_CSS;
    document.head.appendChild(styleEl);

    let s = null;
    try { s = U.deserialize(localStorage.getItem(U.SAVE_KEY)); } catch { /* ignore */ }
    const fresh = !s;
    if (!s) s = U.newUnity();

    root = document.createElement('div');
    root.id = 'phase-unity';
    root.className = 'phase-container';
    root.innerHTML = `
      <canvas class="v-cut"></canvas>
      <div class="v-panel">
        <div class="v-goal" data-v="goal"></div>
        <div class="v-crt" data-v="crt"></div>
        <div class="v-gauge u-body"><div class="row"><span class="dymo">Body</span><span class="val" data-v="body"></span></div><div class="v-bar"><i data-v="prog" style="background:var(--v-pulse)"></i></div><div class="sub" data-v="body-sub"></div></div>
        <div class="u-flows">
          ${U.FLOWS.map((f) => `<div class="u-flow" data-f="${f}"><span class="dymo">${U.FLOW_NAMES[f]}</span><span class="val" data-v="f-${f}"></span>${f === 'thought' ? `<div class="v-bar"><i data-v="tbar" style="background:var(--v-cold)"></i></div>` : ''}<div class="sub" data-v="fs-${f}"></div><div class="word" data-v="fw-${f}"></div></div>`).join('')}
        </div>
        <div data-v="buys-box"><div class="u-sec"><span class="dymo">Grow</span><span class="hint" data-v="buys-hint"></span></div>
          <div class="u-buys">${['skin', 'stomach', 'heart'].map((o) => `<button type="button" class="u-btn flesh" data-buy="${o}">${U.ORGANS[o].name} +<span class="p"></span></button>`).join('')}</div></div>
        <div data-v="edge-box" hidden><div class="u-sec"><span class="dymo">Edge</span><span class="hint" data-v="edge-at"></span></div>
          <div class="u-buys">${U.MODES.map((m) => `<button type="button" class="u-btn" data-mode="${m}">${m}<span class="p">${MODE_SUB[m]}</span></button>`).join('')}</div>
          <div class="u-edge-line" data-v="edge-line"></div></div>
        <div data-v="grow-box" hidden><div class="u-sec"><span class="dymo">Grow as</span><span class="hint">sums to 100</span></div><div class="u-grow" data-v="grow"></div></div>
        <div data-v="minds-box" hidden><div class="u-sec"><span class="dymo">Minds</span><span class="val" data-v="minds" style="font-family:'Bebas Neue','Arial Narrow',sans-serif;font-size:19px"></span></div>
          <div class="u-minds"><input type="range" min="0" data-v="mem" aria-label="Memory"><div class="lbl"><span data-v="mem-l"></span><span data-v="proc-l"></span></div></div></div>
        <div class="v-log" data-v="log"></div>
      </div>
      <div class="v-build" data-v="exbar" hidden>
        <button type="button" class="v-build-btn" data-v="ex-btn"><i data-lucide="flask-conical"></i><span class="dymo">Experiments</span><span data-v="wallet" style="font-size:10px;color:var(--v-mist);text-align:center;line-height:12px"></span></button>
        <div class="v-cards" data-v="cards"></div>
      </div>
      <div class="v-time" data-v="speed">
        <button type="button" data-speed="0" aria-label="Pause">II</button>
        <button type="button" data-speed="1" aria-label="Play">&#9654;</button>
        <button type="button" data-speed="${FAST}" aria-label="Fast">&#9654;&#9654;</button>
      </div>
      <div class="u-guide gone" data-v="guide"><div class="who" data-v="g-who"></div><div class="txt" data-v="g-txt"></div></div>
      <div class="v-stop" data-v="stop" hidden><div class="txt" data-v="stop-text"></div><button type="button" class="ok" data-v="stop-ok">OK</button></div>`;
    document.body.appendChild(root);
    const $ = (k) => root.querySelector(`[data-v="${k}"]`);
    const canvas = root.querySelector('canvas');
    view = createUnityView(canvas, { insetLeft: () => 332, insetBottom: () => 116 });
    sound = createUnitySound(audio);

    let speed = s.speed ?? 1;
    let zooming = false;
    let hover = -1;
    let guideShownAt = -1, guideHideAt = 0;
    const crt = { lines: [], queue: [], typing: null };
    let growKey = '';
    let dragging = false;
    let lastSight = 3;

    // ---------------------------------------------------------------- the CRT and the sounds
    function pushLines() {
        for (const o of s.out) crt.queue.push(o);
        s.out.length = 0;
        for (const e of s.sfx) sound.event(e);
        s.sfx.length = 0;
    }
    function stepCrt(now) {
        if (!crt.typing && crt.queue.length) {
            const o = crt.queue.shift();
            crt.typing = { ...o, shown: 0, at: now };
            crt.lines.push(crt.typing);
            if (crt.lines.length > CRT_LINES) crt.lines.splice(0, crt.lines.length - CRT_LINES);
        }
        if (crt.typing) {
            const per = crt.queue.length > 3 ? TYPE_MS / 3 : TYPE_MS;
            const n = Math.min(crt.typing.text.length, Math.floor((now - crt.typing.at) / per));
            crt.typing.shown = n;
            if (n >= crt.typing.text.length) { crt.typing.done = true; crt.typing = null; }
        }
        const html = crt.lines.map((l, k) => {
            const text = l.done ? l.text : l.text.slice(0, l.shown);
            return `<div class="l sys${k === crt.lines.length - 1 ? ' new' : ''}${l.mark ? ' mark' : ''}">${esc(text)}${!l.done ? '<span class="cur"></span>' : ''}</div>`;
        }).join('');
        const el = $('crt');
        if (el.__html !== html) { el.innerHTML = html; el.__html = html; }
    }

    // ---------------------------------------------------------------- the panel
    const set = (k, v) => { const el = $(k); if (el && el.textContent !== v) el.textContent = v; };
    function paintPanel() {
        const f = U.flows(s);
        lastSight = s.unlocked.eyes ? f.sight : 3;
        const before = !s.ex.auto;
        set('goal', U.LINES.goal[s.scale]);
        set('body', U.areaText(s));
        const pr = U.progress(s);
        $('prog').style.width = `${Math.round(pr * 100)}%`;
        set('body-sub', s.scale < 4 ? WORDS.of(Math.round((U.area(s) / U.CELLS) * 100), WHERE[s.scale]) : '');
        // the four flows
        const unit = U.nutUnit(s);
        // the wallet stays: by hand the nutrient to spend, after that what waits in the gut
        set('f-nutrient', before ? U.big(s.nutrient * unit) : WORDS.perDay(`+${U.big(f.nutrientDay)}`));
        set('fs-nutrient', before ? WORDS.perDay(`+${U.big(f.nutrientDay)}`) : WORDS.gut(U.big(s.pool * unit)));
        // before the edge eats by itself MASS is what the body weighs, and how far it can stretch
        set('f-mass', before ? `${U.big(U.totalMass(s) * unit)} t` : WORDS.perDay(U.perDayText(f.areaDay)));
        set('fs-mass', before ? U.LINES.room(U.roomLeft(s)) : '');
        set('f-power', `${Math.round(f.p * 100)} %`);
        set('fs-power', f.p >= 1 && f.use > 0 ? WORDS.spare(Math.max(0, Math.round((f.make / f.use - 1) * 100))) : '');
        set('f-thought', `${U.num(Math.floor(s.thought))} / ${U.num(f.cap)}`);
        $('tbar').style.width = `${Math.min(100, (s.thought / Math.max(1, f.cap)) * 100)}%`;
        set('fs-thought', `${WORDS.perDay(`+${f.thoughtRate < 10 ? f.thoughtRate.toFixed(1) : U.num(f.thoughtRate)}`)}${s.insight > 0 || s.capHit ? ` · ${WORDS.insight(s.insight.toFixed(1))}` : ''}`);
        for (const fl of U.FLOWS) {
            const red = f.red && f.red.flow === fl ? f.red : null;
            const yel = !red && f.yellow && f.yellow.flow === fl ? f.yellow : null;
            const w = $(`fw-${fl}`);
            const txt = red ? red.word : yel ? yel.word : '';
            if (w.textContent !== txt) w.textContent = txt;
            w.className = `word${red ? ' red' : yel ? ' yellow' : ''}`;
            root.querySelector(`[data-f="${fl}"]`).classList.toggle('is-red', !!red);
        }
        // fas 1: the three buys
        $('buys-box').hidden = !before;
        if (before) {
            // the hint says why the hand cannot bite: full (grow first), or nothing to grow with
            const lb = s.lastBite;
            const room = U.roomLeft(s);
            // a refusal is said while it is still true (no room) or, for the other reasons, for three seconds
            const refused = lb && !lb.ok && s.t - lb.t < 3 && !((lb.why === 'full' || lb.why === 'starving') && room > 0);
            set('buys-hint', refused ? U.BITE_NO[lb.why] : room > 0 ? WORDS.biteHint : U.BITE_NO[s.nutrient >= U.cheapestBuy(s) ? 'full' : 'starving']);
            $('buys-hint').classList.toggle('warn', !!refused || room === 0);
            const st = s.tut.stop;
            for (const b of root.querySelectorAll('[data-buy]')) {
                const o = b.dataset.buy;
                const p = U.buyPrice(s, o);
                b.querySelector('.p').textContent = U.big(p * unit);
                b.disabled = s.nutrient < p || !!st;
                b.classList.toggle('want', !!f.red && (f.red.organ === o || (f.red.word === 'Full.' && s.nutrient >= p)));
                b.classList.toggle('focus', !!st && st.focus === 'skin' && o === 'skin');
            }
        }
        // EDGE
        const showEdge = s.ex.auto && s.scale < 4;
        $('edge-box').hidden = !showEdge;
        if (showEdge) {
            const knows = !!s.ex.edgeknows;
            set('edge-at', f.at >= 0 ? WORDS.atEdge(U.CLASS_NAMES[f.at]) + (f.nextAt >= 0 && f.nextAt !== f.at ? WORDS.next(U.CLASS_NAMES[f.nextAt]) : '') : '');
            for (const b of root.querySelectorAll('[data-mode]')) {
                b.classList.toggle('on', b.dataset.mode === f.effMode);
                b.disabled = knows;
            }
            const mm = f.at >= 0 ? U.modeMult(f.effMode, f.at) : 1;
            const line = knows ? WORDS.knows : mm < 0.5 ? U.LINES.third : mm < 1 ? WORDS.two : '';
            set('edge-line', line);
            $('edge-line').classList.toggle('bad', !knows && mm < 1);
        }
        // GROW AS: the organs grown, and the ones about to be (dimmed)
        $('grow-box').hidden = !s.ex.auto;
        if (s.ex.auto) paintGrow(f);
        // MINDS (fas 2)
        const showMinds = s.scale >= 1 || !!s.ex.parallel;
        $('minds-box').hidden = !showMinds;
        if (showMinds) {
            set('minds', U.num(s.minds));
            const r = $('mem');
            if (Number(r.max) !== s.minds) r.max = String(s.minds);
            if (document.activeElement !== r) r.value = String(s.memory);
            set('mem-l', WORDS.memory(U.num(s.memory)));
            set('proc-l', WORDS.processing(U.num(s.minds - s.memory)));
        }
        // the log: three grey lines
        // the log: three lines, two when GROW AS is long (so it never falls below the panel at 900 px)
        const logN = growOrgans().length > 8 ? 2 : 3;
        const log = (s.log || []).slice(-logN).map((l) => `<div>${esc(l)}</div>`).join('');
        if ($('log').__html !== log) { $('log').innerHTML = log; $('log').__html = log; }
        for (const b of root.querySelectorAll('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === speed);
        paintStop();
        paintGuide();
    }
    function growOrgans() {
        // only the organs grown (UNITY test 1: with locked rows MINDS and the log fell below the panel)
        return U.ORGAN_ORDER.filter((o) => s.unlocked[o] && s.grow[o] != null);
    }
    function paintGrow(f) {
        const organs = growOrgans();
        const key = organs.map((o) => o + (s.unlocked[o] ? '' : '?')).join(',');
        const host = $('grow');
        if (key !== growKey && !dragging) {
            growKey = key;
            host.innerHTML = organs.map((o) => {
                const locked = !s.unlocked[o];
                return `<div class="u-row${locked ? ' locked' : ''}" data-row="${o}"><span class="n">${U.ORGANS[o].name}</span><span class="pc"></span><input type="range" min="0" max="100" step="5" data-grow="${o}" ${locked ? 'disabled' : ''} aria-label="${U.ORGANS[o].name}"></div>`;
            }).join('');
        }
        for (const row of host.querySelectorAll('[data-row]')) {
            const o = row.dataset.row;
            const v = s.unlocked[o] ? (s.grow[o] || 0) : 0;
            const inp = row.querySelector('input');
            if (document.activeElement !== inp || !dragging) inp.value = String(v);
            const pc = row.querySelector('.pc');
            const t = `${v}`;
            if (pc.textContent !== t) pc.textContent = t;
            row.classList.toggle('zero', s.unlocked[o] && v === 0);
            row.classList.toggle('red', !!f.red && f.red.organ === o);
            row.classList.toggle('yellow', !!f.yellow && f.yellow.organ === o && !(f.red && f.red.organ === o));
        }
    }
    function paintCards() {
        // the big ones first, then the small ones; as many as the bar holds
        const all = U.visibleExperiments(s).filter((e) => e.kind !== 'seed');
        const fr0 = U.flows(s).red;
        const ans0 = fr0 && fr0.fix ? fr0.fix : null;
        const vis = [...all.filter((e) => e.id === ans0), ...all.filter((e) => e.kind !== 'multi' && e.id !== ans0), ...all.filter((e) => e.kind === 'multi')].slice(0, MAX_CARDS);
        $('exbar').hidden = !vis.length || zooming;
        const ins = s.insight > 0 || s.capHit;
        set('wallet', `${U.num(Math.floor(s.thought))} thought${ins ? `\n${s.insight.toFixed(1)} insight` : ''}`);
        $('wallet').style.whiteSpace = 'pre';
        let any = false;
        // the card that answers the red word wears the amber mark (UNITY test 1: which card helps?)
        const fr = U.flows(s).red;
        const answer = fr && fr.fix && !s.ex[fr.fix] ? fr.fix : null;
        const html = vis.map((e) => {
            const need = U.needText(s, e);
            if (!need) any = true;
            const price = e.kind === 'join' ? WORDS.free : e.ins ? `${e.ins} insight` : `${U.num(e.price)} thought`;
            return `<button type="button" class="v-card${need ? ' off' : ''}${e.ins ? ' ins' : ''}${e.kind === 'join' ? ' join' : ''}${e.kind === 'multi' ? ' multi' : ''}${answer === e.id ? ' answer' : ''}" data-ex="${e.id}">${answer === e.id ? '<span class="mark"></span>' : ''}
                <span class="top"><span class="p">${esc(price)}</span></span><span class="n">${esc(e.title)}</span><span class="d">${esc(e.line)}</span>${need ? `<span class="need">${esc(need)}</span>` : ''}</button>`;
        }).join('');
        const host = $('cards');
        if (host.__html !== html) { host.innerHTML = html; host.__html = html; }
        // a stop holds the game: nothing in the bar can be bought then, and it looks it
        $('exbar').classList.toggle('paused', !!s.tut.stop);
        $('ex-btn').classList.toggle('has', any);
    }
    let typingStop = null;
    function paintStop() {
        const st = s.tut.stop;
        $('stop').hidden = !st;
        root.classList.toggle('has-stop', !!st);
        if (!st) { typingStop = null; return; }
        if (!typingStop || typingStop.st !== st) typingStop = { st, at: performance.now() };
        // typed, line by line, OK at the end
        let ms = performance.now() - typingStop.at, done = true;
        const parts = [];
        for (const l of st.text) {
            const n = Math.max(0, Math.min(l.length, Math.floor(ms / 34)));
            if (n > 0 || !parts.length) parts.push(`<div>${esc(l.slice(0, n))}${n < l.length ? '<span class="cur"></span>' : ''}</div>`);
            if (n < l.length) { done = false; break; }
            ms -= l.length * 34 + 300;
            if (ms < 0) { done = false; break; }
        }
        const html = parts.join('');
        if ($('stop-text').__html !== html) { $('stop-text').innerHTML = html; $('stop-text').__html = html; }
        $('stop-ok').hidden = !done;
    }
    function paintGuide() {
        const g = s.guide;
        const el = $('guide');
        const now = performance.now();
        if (g && g.at !== guideShownAt) {
            guideShownAt = g.at; guideHideAt = now + GUIDE_MS;
            set('g-who', g.who); set('g-txt', g.text);
        }
        el.classList.toggle('gone', !(g && now < guideHideAt));
    }

    // ---------------------------------------------------------------- input
    function shakeStop() {
        const b = $('stop'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        sound.event('click');
    }
    function closeStop() {
        if (!s.tut.stop) return;
        U.closeStop(s);
        sound.event('click');
        pushLines(); paintPanel(); paintCards();
    }
    $('stop-ok').addEventListener('click', closeStop, { signal });
    canvas.addEventListener('click', (e) => {
        if (zooming) return;
        const r = canvas.getBoundingClientRect();
        const i = view.cellAt(e.clientX - r.left, e.clientY - r.top);
        const st = s.tut.stop;
        if (!s.ex.auto) {
            // fas 1: a click on the edge bites it (the first stop says so, and the bite closes it)
            const edge = i >= 0 ? U.nearestEdge(s, i) : -1;
            if (st && !(st.focus === 'edge' && edge >= 0)) { shakeStop(); return; }
            if (st) U.closeStop(s);
            if (edge < 0) return;
            const got = U.bite(s, edge);
            view.addBite(edge, got >= 0);
            pushLines(); paintPanel();
            return;
        }
        if (st) { shakeStop(); return; }
        if (i >= 0) { U.setTarget(s, i); sound.event('click'); }
    }, { signal });
    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        view.setPointer(x, y);
        const i = view.cellAt(x, y);
        hover = !s.ex.auto && i >= 0 ? U.nearestEdge(s, i) : -1;
    }, { signal });
    canvas.addEventListener('mouseleave', () => { hover = -1; view.setPointer(-1, -1); }, { signal });
    root.querySelector('.v-panel').addEventListener('click', (e) => {
        const b = e.target.closest('[data-buy]');
        if (b && !b.disabled) { if (s.tut.stop) { shakeStop(); return; } U.buyMass(s, b.dataset.buy); pushLines(); paintPanel(); return; }
        const m = e.target.closest('[data-mode]');
        if (m && !m.disabled) { if (s.tut.stop) { shakeStop(); return; } U.setMode(s, m.dataset.mode); pushLines(); paintPanel(); }
    }, { signal });
    root.querySelector('.v-panel').addEventListener('input', (e) => {
        const g = e.target.closest('[data-grow]');
        if (g) { dragging = true; U.setGrow(s, g.dataset.grow, Number(g.value)); paintPanel(); return; }
        if (e.target === $('mem')) { U.setMemory(s, Number(e.target.value)); paintPanel(); }
    }, { signal });
    root.querySelector('.v-panel').addEventListener('change', () => { dragging = false; sound.event('grow'); }, { signal });
    $('cards').addEventListener('click', (e) => {
        const c = e.target.closest('[data-ex]');
        if (!c || c.classList.contains('off')) return;
        if (s.tut.stop) { shakeStop(); return; }
        U.buy(s, c.dataset.ex);
        pushLines(); paintPanel(); paintCards();
    }, { signal });
    root.querySelector('.v-time').addEventListener('click', (e) => {
        const b = e.target.closest('[data-speed]');
        if (!b) return;
        speed = Number(b.dataset.speed); s.speed = speed;
        sound.event('click');
        paintPanel();
    }, { signal });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && s.ex.auto && !s.tut.stop) U.setTarget(s, s.target); }, { signal });
    window.addEventListener('resize', () => view.resize(), { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) sound?.set(false); }, { signal });
    document.getElementById('reset-btn')?.addEventListener('click', () => {
        if (!confirm('Reset all progress? This cannot be undone.')) return;
        savingEnabled = false;
        try { for (const k of [U.SAVE_KEY, 'rpi-deep-vault', PHASE4_CONSTANTS.SAVE_KEY, PHASE2_CONSTANTS.SAVE_KEY, PHASE1_CONSTANTS.SAVE_KEY, PHASE_KEY]) localStorage.removeItem(k); } catch { /* ignore */ }
        location.reload();
    }, { signal });

    // ---------------------------------------------------------------- the zoom out
    async function zoomOut() {
        zooming = true;
        root.classList.add('is-zooming');
        sound.event('zoom');
        const ratio = Math.sqrt(U.SCALES[s.scale + 1].size / U.SCALES[s.scale].size) * 0.9;
        await view.startZoom(ZOOM_MS, ratio, s);
        if (!root) return;
        U.zoomDone(s);
        zooming = false;
        root.classList.remove('is-zooming');
        save();
        paintPanel(); paintCards();
    }

    // ---------------------------------------------------------------- save
    function save() {
        if (!savingEnabled || window.__rpiSkipSave) return;
        try { localStorage.setItem(U.SAVE_KEY, U.serialize(s)); } catch { /* full */ }
    }
    saveTimer = setInterval(save, SAVE_EVERY_MS);
    beforeUnload = () => save();
    window.addEventListener('beforeunload', beforeUnload);

    // ---------------------------------------------------------------- the frame
    let last = performance.now(), drewAt = 0, slowAt = 0;
    function frame(now) {
        rafId = requestAnimationFrame(frame);
        const dt = Math.max(0, Math.min(0.25, (now - last) / 1000));
        last = now;
        const held = window.__rpiPaused || zooming || document.querySelector('#chapter-card.is-active');
        if (!held && speed > 0) U.advance(s, dt * speed);
        if (s.zoom && !zooming) zoomOut();
        if (s.out.length || s.sfx.length) pushLines();
        stepCrt(now);
        // the picture at 30 fps, 10 when paused or held (the owner's machine is slow)
        const still = (held || speed === 0) && !view.busy;
        if (now - drewAt >= (still ? 100 : 33) - 2) {
            drewAt = now;
            const m = U.mapFor(s.seed, s.scale);
            const look = m.vault >= 0 && s.seen[s.scale] && !s.joined[s.scale] ? view.cellCentre(m.vault) : s.target >= 0 ? view.cellCentre(s.target) : null;
            view.frame(s, { hover, focusEdge: !!(s.tut.stop && s.tut.stop.focus === 'edge'), lookAt: look, target: s.target >= 0, sight: lastSight }, now);
        }
        if (s.tut.stop) paintStop();
        if (now - slowAt > 200) {
            slowAt = now;
            paintPanel(); paintCards();
            sound.set(!s.tut.stop && speed > 0 && !held, s.scale);
        }
    }

    // ---------------------------------------------------------------- the arrival
    if (fresh || !s.introDone) {
        s.introDone = true;
        const parts = [...root.querySelectorAll('.v-panel > *')];
        parts.forEach((p) => p.classList.add('v-lamp-off'));
        parts.forEach((p, k) => timers.push(setTimeout(() => p.classList.remove('v-lamp-off'), 300 + k * 260)));
    }
    pushLines();
    paintPanel(); paintCards();
    icons();
    rafId = requestAnimationFrame(frame);

    // for the playtest and the checkpoints
    window.rpiUnity = {
        get state() { return s; }, view, U,
        buy: (id) => { U.buy(s, id); pushLines(); paintPanel(); paintCards(); },
        ok: closeStop,
        setSpeed: (v) => { speed = v; },
    };
}

function icons() {
    try { lucide.createIcons(); } catch { /* the CDN is not there */ }
}
function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

export function teardown() {
    try { if (savingEnabled && !window.__rpiSkipSave && window.rpiUnity) localStorage.setItem(U.SAVE_KEY, U.serialize(window.rpiUnity.state)); } catch { /* ignore */ }
    abort?.abort(); abort = null;
    cancelAnimationFrame(rafId); rafId = 0;
    clearInterval(saveTimer); saveTimer = null;
    timers.forEach(clearTimeout); timers = [];
    if (beforeUnload) window.removeEventListener('beforeunload', beforeUnload);
    beforeUnload = null;
    try { sound?.stop(); } catch { /* gone */ }
    sound = null;
    root?.remove(); root = null;
    styleEl?.remove(); styleEl = null;
    view = null;
    document.body.classList.remove('in-unity');
    delete window.rpiUnity;
}
