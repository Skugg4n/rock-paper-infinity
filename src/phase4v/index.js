/* global lucide */
/**
 * Chapter IV · THE DEEP, the vault (docs/superpowers/specs/2026-10-05-deep-vault.md): the phase.
 * Builds its own screen (a cutaway canvas, the instrument panel with the CRT, the BUILD bar, the
 * info box, the time buttons), runs the clock and saves. The rules are in vault.js.
 */
import * as V from './vault.js';
import { popWish, waveKind } from './wishes.js';
import { createVaultView } from './view.js';
import { VAULT_CSS, VT } from './style.js';
import { createVaultSound } from './sound.js';
import { audio } from '../audio.js';
import { playChapterCard } from '../chapterCard.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS } from '../constants.js';

/** The arrival: nothing to do, something to see. */
export const INTRO_MS = 8000;
/** Letters typed on the CRT, ms each. */
export const TYPE_MS = 26;
export const CRT_LINES = 6;
/** The rise: the body fills the shaft, breaks the crust and the city, before the card. */
export const RISE_MS = 5200;
const SAVE_EVERY_MS = 4000;
const ICONS = { suites: 'bed-double', mine: 'pickaxe', hydro: 'sprout', cinema: 'film', gym: 'dumbbell', bar: 'wine', garden: 'trees', game: 'gamepad-2', cryo: 'snowflake', vat: 'droplet' };

let root = null, styleEl = null, rafId = 0, abort = null, sound = null, saveTimer = null, beforeUnload = null, view = null;
let savingEnabled = true;
let timers = [];

export function init() {
    abort = new AbortController();
    const signal = abort.signal;
    savingEnabled = true;
    document.body.classList.add('in-vault');
    styleEl = document.createElement('style');
    styleEl.textContent = VAULT_CSS;
    document.head.appendChild(styleEl);

    let s = null;
    try { s = V.deserialize(localStorage.getItem(V.SAVE_KEY)); } catch { /* ignore */ }
    const fresh = !s;
    if (!s) s = V.newVault();

    root = document.createElement('div');
    root.id = 'phase-vault';
    root.className = 'phase-container';
    root.innerHTML = `
      <canvas class="v-cut"></canvas>
      <div class="v-panel">
        <div class="v-crt" data-v="crt"></div>
        <div class="v-req" data-v="req" hidden><i data-v="req-bar"></i></div>
        <div class="v-gauge" data-v="g-power"><div class="row"><span class="dymo">Power</span><span class="val" data-v="power"></span></div><div class="v-bar"><i data-v="power-bar"></i></div><div class="sub" data-v="power-sub"></div></div>
        <div class="v-gauge" data-v="g-ore"><div class="row"><span class="dymo">Ore</span><span class="val" data-v="ore"></span></div><div class="sub" data-v="ore-sub"></div></div>
        <div class="v-gauge" data-v="g-bio" hidden><div class="row"><span class="dymo">Biomass</span><span class="val" data-v="bio"></span></div><div class="sub" data-v="bio-sub"></div></div>
        <div class="v-gauge" data-v="g-mood"><div class="row"><span class="dymo">Mood</span><span class="val" data-v="mood"></span></div><div class="v-bar"><i data-v="mood-bar"></i></div><div class="sub" data-v="mood-sub"></div></div>
        <div class="v-gauge" data-v="g-body" hidden><div class="row"><span class="dymo">Body</span><span class="val" data-v="body"></span></div><div class="v-bar"><i data-v="body-bar" style="background:var(--v-pulse)"></i></div></div>
        <div class="v-check" data-v="checklist" hidden>
          <div class="c" data-v="chk-heart"><i class="box"></i><span class="dymo">Heart</span></div>
          <div class="c" data-v="chk-lungs"><i class="box"></i><span class="dymo">Lungs</span></div>
          <div class="c" data-v="chk-skin"><i class="box"></i><span class="dymo">Skin</span></div>
          <div class="c" data-v="chk-stomach"><i class="box"></i><span class="dymo">Stomach</span></div>
        </div>
        <div class="v-rows">
          <div class="r" data-v="r-res"><span class="dymo">Residents</span><span class="val" data-v="res"></span></div>
          <div class="r" data-v="r-asleep" hidden><span class="dymo">Asleep</span><span class="val" data-v="asleep"></span></div>
          <div class="r" data-v="r-here" hidden><span class="dymo">In the body</span><span class="val" data-v="here"></span></div>
          <div class="r" data-v="r-time"><span class="dymo" data-v="time-label">Day</span><span class="val" data-v="time"></span></div>
        </div>
      </div>
      <div class="v-time" data-v="speed">
        <button type="button" data-speed="0" aria-label="Pause">II</button>
        <button type="button" data-speed="1" aria-label="Play">&#9654;</button>
        <button type="button" data-speed="2" aria-label="Fast">&#9654;&#9654;</button>
      </div>
      <div class="v-build">
        <button type="button" class="v-build-btn on" data-v="build-btn"><i data-lucide="hammer"></i><span class="dymo">Build</span></button>
        <div class="v-cards" data-v="cards"></div>
      </div>
      <div class="v-info" data-v="info" hidden></div>
      <button type="button" class="v-rise" data-v="rise" hidden>RISE</button>`;
    document.body.appendChild(root);
    const $ = (k) => root.querySelector(`[data-v="${k}"]`);
    const canvas = root.querySelector('canvas');
    const infoEl = $('info');
    view = createVaultView(canvas, {
        insetLeft: () => 324,
        insetRight: () => 270,
    });
    sound = createVaultSound(audio);

    let speed = s.speed ?? 1;
    let selected = -1;
    let armed = null;           // a card picked: its kind
    let buildOpen = true;
    const crt = { lines: [], queue: [], typing: null };
    let introUntil = 0;

    // ---------------------------------------------------------------- the CRT
    function pushLines() {
        for (const o of s.out) crt.queue.push(o);
        s.out.length = 0;
        for (const e of s.sfx) {
            sound.event(e);
            // a bubble answered or missed: the mood gauge flashes with it
            if (e === 'pop' || e === 'miss') { const g = $('g-mood'); g.classList.remove('flash-up', 'flash-down'); void g.offsetWidth; g.classList.add(e === 'pop' ? 'flash-up' : 'flash-down'); }
            // they bang on the screen: it shakes
            if (e === 'bang') { const c = $('crt'); c.classList.remove('bang'); void c.offsetWidth; c.classList.add('bang'); }
        }
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
            if (n !== crt.typing.shown) { crt.typing.shown = n; sound.tick(); }
            if (n >= crt.typing.text.length) { crt.typing.done = true; crt.typing = null; }
        }
        const el = $('crt');
        const html = crt.lines.map((l, k) => {
            const text = l.done ? l.text : l.text.slice(0, l.shown);
            const cls = `l ${l.who}${k === crt.lines.length - 1 ? ' new' : ''}`;
            return `<div class="${cls}">${esc(text)}${!l.done && l === crt.typing ? '<span class="cur"></span>' : ''}</div>`;
        }).join('');
        if (el.__html !== html) { el.innerHTML = html; el.__html = html; }
    }

    // ---------------------------------------------------------------- the panel
    function paintPanel() {
        const night = s.phase !== 'palace';
        root.classList.toggle('is-night', night);
        // the night: half the panel goes dark (the people's half)
        for (const k of ['r-res', 'r-asleep', 'r-here']) $(k).classList.toggle('v-dim', night);
        const p = V.power(s);
        $('power').textContent = V.num(p.make);
        $('power-sub').textContent = `${V.num(p.use)} in use`;
        const pb = $('power-bar');
        pb.style.width = `${Math.min(100, p.make ? (p.use / p.make) * 100 : 100)}%`;
        pb.style.background = p.short ? VT.danger : VT.cold;
        $('g-power').classList.toggle('is-red', p.short);
        $('ore').textContent = V.num(Math.floor(s.ore));
        const oreRate = s.phase === 'palace' ? V.oreRate(s) : null;
        $('ore-sub').textContent = oreRate != null ? `+${V.num(oreRate)} a day` : '';
        const showBio = s.reclaimed > 0 || s.bio > 0 || V.hasVat(s);
        $('g-bio').hidden = !showBio;
        if (showBio) {
            $('bio').textContent = V.num(Math.floor(s.bio));
            const br = V.bioRate(s);
            $('bio-sub').textContent = br > 0 ? `+${br < 10 ? br.toFixed(1) : V.num(br)} a year` : '';
        }
        // MOOD is the awake's: it shows while someone is awake (the woken in the night too); BODY from the first vat
        const body = V.hasVat(s);
        const anyAwake = V.awake(s) > 0;
        $('g-mood').hidden = s.phase !== 'palace' && !anyAwake;
        const m = V.mood(s);
        $('mood').textContent = anyAwake ? `${m} %` : '-';
        const mb = $('mood-bar');
        mb.style.width = `${anyAwake ? m : 0}%`;
        mb.style.background = m > 75 ? VT.life : m >= 40 ? VT.amber : VT.danger;
        $('g-mood').classList.toggle('is-red', anyAwake && m < 40);
        $('mood-sub').textContent = !anyAwake ? '' : m <= V.DESPAIR_AT ? 'At 0 % they try to leave.' : m < V.RIOT_BELOW ? 'They are breaking things.' : m < 40 ? 'Under 25 % they break things.' : '';
        $('g-body').hidden = !body;
        if (body) {
            const b = Math.round(V.bodyShare(s) * 100);
            $('body').textContent = `${b} %`;
            $('body-bar').style.width = `${b}%`;
        }
        // at the end nobody is a resident: the row goes, IN THE BODY stays
        $('r-res').hidden = s.residents === 0 && s.here > 0;
        $('res').textContent = V.num(s.residents);
        $('r-asleep').hidden = !(s.asleep > 0);
        $('asleep').textContent = V.num(s.asleep);
        $('r-here').hidden = !(s.here > 0);
        $('here').textContent = V.num(s.here);
        $('time-label').textContent = s.phase === 'palace' ? 'Day' : 'Year';
        $('time').textContent = s.phase === 'palace' ? V.num(Math.floor(s.day)) : V.num(Math.floor(s.year));
        for (const b of root.querySelectorAll('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === speed);
        // the request's time: a bar under the screen that runs down
        const q = s.request;
        $('req').hidden = !(q && q.kind && s.phase === 'palace');
        if (q && q.kind) {
            const left = Math.max(0, (q.due - s.day) / (q.due - q.at));
            const bar = $('req-bar');
            bar.style.width = `${left * 100}%`;
            bar.style.background = left < 0.3 ? VT.danger : VT.amber;
            $('req').title = `${Math.ceil(q.due - s.day)} days to answer`;
        }
        $('rise').hidden = !V.riseReady(s);
    }

    // ---------------------------------------------------------------- the BUILD bar
    function placeable(kind) {
        const out = new Set();
        s.rooms.forEach((r, i) => { if (V.canPlace(s, kind, i)) out.add(i); });
        return out;
    }
    function paintCards() {
        const host = $('cards');
        // at the end there is nothing to build: the RISE lever has the place
        host.hidden = !buildOpen || s.risen || V.riseReady(s);
        $('build-btn').hidden = s.risen || V.riseReady(s);
        $('build-btn').classList.toggle('on', buildOpen);
        const want = s.request && s.request.kind && !(s.request.lvl > 1) ? s.request.kind : null;
        const wave = waveKind(s);
        // in the night a card with no place left is not shown (nobody can dig)
        const parts = V.cards(s).filter((k) => s.phase !== 'night' || placeable(k).size > 0).map((k) => {
            const K = V.KINDS[k];
            const needOre = Math.max(0, Math.ceil(K.price - s.ore));
            const needBio = K.bio ? Math.max(0, Math.ceil(K.bio - s.bio)) : 0;
            const spots = placeable(k).size;
            let need = '';
            if (needOre) need = `Need ${V.num(needOre)} more ore.`;
            else if (needBio) need = `Need ${V.num(needBio)} more biomass.`;
            else if (!spots) need = K.deep ? 'Dig a place on level 2 or 3.' : 'Dig a place first.';
            const price = K.bio ? `${K.price} ore · ${K.bio} bio` : `${K.price} ore`;
            return `<button type="button" class="v-card${need ? ' off' : ''}${armed === k ? ' armed' : ''}" data-card="${k}">
                ${want === k || wave === k ? '<span class="mark"></span>' : ''}
                <span class="top"><i data-lucide="${ICONS[k]}" style="width:15px;height:15px"></i><span class="p">${price}</span></span>
                <span class="n">${K.name}</span><span class="d">${V.cardLine(k, s)}</span>${need ? `<span class="need">${need}</span>` : ''}</button>`;
        }).join('');
        if (host.__html !== parts) { host.innerHTML = parts; host.__html = parts; icons(); }
    }

    // ---------------------------------------------------------------- the info box
    function paintInfo() {
        if (selected < 0) { if (!infoEl.hidden) { infoEl.hidden = true; view.resize(); } return; }
        const r = s.rooms[selected];
        const acts = V.actionsFor(s, selected);
        const lvl = !['rock', 'empty'].includes(r.kind) && !r.flesh && r.kind !== 'vat' ? `Level ${r.lvl}` : '';
        const html = `<div class="t"><span class="dymo">${esc(V.nameOf(s, selected))}</span><span class="lv">${lvl}</span></div>
            <div class="desc">${esc(V.describe(s, selected))}</div>
            <div class="acts">${acts.map((a) => `<button type="button" class="a${a.id === 'grow' ? ' flesh' : a.dark ? ' dark' : a.id === 'reclaim' || a.id === 'bury' ? ' quiet' : ''}" data-act="${a.id}" ${a.ok ? '' : 'disabled'}>${esc(a.label)}</button>${a.need ? `<div class="need">${esc(a.need)}</div>` : ''}${a.hint ? `<div class="hint">${esc(a.hint)}</div>` : ''}`).join('')}</div>`;
        if (infoEl.__html !== html) { infoEl.innerHTML = html; infoEl.__html = html; }
        if (infoEl.hidden) { infoEl.hidden = false; view.resize(); }
    }

    /**
     * One meaning per marker: the gold dashed frame = the body can grow in here; a red pulse = pods in
     * trouble (the dead waiting, the power short); a small tab with an icon = a room complaining.
     */
    function uiState() {
        const ui = { selected, placeable: armed ? placeable(armed) : null, diggable: new Set(), wanted: new Set(), trouble: new Set(), complain: new Map() };
        s.rooms.forEach((r, i) => { if (V.canDig(s, i)) ui.diggable.add(i); });
        // in the night nobody digs: the places are the rock a vat or a Cryo Bay can go into
        if (s.phase === 'night') V.cards(s).forEach((k) => placeable(k).forEach((i) => ui.diggable.add(i)));
        if (s.phase === 'night' && V.hasVat(s) && !V.growing(s)) s.rooms.forEach((r, i) => { if (V.canGrowInto(s, i)) ui.wanted.add(i); });
        const q = s.request;
        if (q && q.kind && (q.lvl > 1 || q.kind === 'engine')) {
            s.rooms.forEach((r, i) => { if (r.kind === q.kind && !r.flesh && (q.kind === 'engine' || r.lvl < q.lvl)) ui.complain.set(i, 'ask'); });
        }
        // what is short shows on the room that makes it: the engine when dark, the farm when hungry
        if (s.phase === 'palace' && V.awake(s) > 0) {
            if (V.power(s).short) s.rooms.forEach((r, i) => { if (r.kind === 'engine') ui.complain.set(i, 'power'); });
            if (V.awake(s) > V.food(s)) s.rooms.forEach((r, i) => { if (r.kind === 'hydro' && !r.flesh) ui.complain.set(i, 'food'); });
        }
        // pods in trouble: the dead waiting, or the power short in the night
        if (s.fallen.length || (s.phase === 'night' && s.asleep > 0 && V.power(s).short)) {
            s.rooms.forEach((r, i) => { if (r.kind === 'cryo' && !r.flesh) ui.trouble.add(i); });
        }
        return ui;
    }

    // ---------------------------------------------------------------- input
    canvas.addEventListener('click', (e) => {
        if (performance.now() < introUntil) return;
        const rect = canvas.getBoundingClientRect();
        const bx = e.clientX - rect.left, by = e.clientY - rect.top;
        // a wish first: it floats over the room
        const wish = view.bubbleAt(s, bx, by);
        if (wish) { popWish(s, wish); afterAct(); return; }
        const i = view.slotAt(bx, by);
        if (armed && i >= 0 && V.canPlace(s, armed, i)) {
            if (V.build(s, armed, i)) { armed = null; selected = i; }
            afterAct();
            return;
        }
        armed = null;
        selected = i;
        if (i >= 0) sound.event('click');
        afterAct();
    }, { signal });
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        view.setPointer(x, y);
        canvas.style.cursor = view.bubbleAt(s, x, y) || view.slotAt(x, y) >= 0 ? 'pointer' : 'default';
    }, { signal });
    canvas.addEventListener('mouseleave', () => view.setPointer(-1, -1), { signal });
    root.querySelector('.v-build').addEventListener('click', (e) => {
        const card = e.target.closest('[data-card]');
        if (e.target.closest('[data-v="build-btn"]')) { buildOpen = !buildOpen; armed = null; afterAct(); return; }
        if (!card || card.classList.contains('off')) return;
        const k = card.dataset.card;
        // a place already picked: build right there
        if (selected >= 0 && V.canPlace(s, k, selected)) { V.build(s, k, selected); armed = null; afterAct(); return; }
        armed = armed === k ? null : k;
        sound.event('click');
        afterAct();
    }, { signal });
    infoEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        V.act(s, b.dataset.act, selected);
        afterAct();
    }, { signal });
    root.querySelector('.v-time').addEventListener('click', (e) => {
        const b = e.target.closest('[data-speed]');
        if (!b) return;
        speed = Number(b.dataset.speed);
        s.speed = speed;
        sound.event('click');
        paintPanel();
    }, { signal });
    $('rise').addEventListener('click', () => { riseUp(); }, { signal });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { armed = null; selected = -1; afterAct(); } }, { signal });
    window.addEventListener('resize', () => view.resize(), { signal });
    // a hidden tab is silent (the frame loop that sets the sound stops with it)
    document.addEventListener('visibilitychange', () => { if (document.hidden) sound?.set(false, false); }, { signal });
    document.getElementById('reset-btn')?.addEventListener('click', () => {
        if (!confirm('Reset all progress? This cannot be undone.')) return;
        savingEnabled = false;
        try {
            for (const k of [V.SAVE_KEY, PHASE4_CONSTANTS.SAVE_KEY, PHASE2_CONSTANTS.SAVE_KEY, PHASE1_CONSTANTS.SAVE_KEY, PHASE_KEY]) localStorage.removeItem(k);
        } catch { /* ignore */ }
        location.reload();
    }, { signal });

    function afterAct() {
        pushLines();
        paintPanel(); paintCards(); paintInfo();
    }

    async function riseUp() {
        if (!V.rise(s)) return;
        pushLines();
        save();
        $('rise').hidden = true;
        $('cards').hidden = true;
        selected = -1; paintInfo();
        root.classList.add('is-rising');
        await view.rise(RISE_MS);
        playChapterCard({ roman: 'V', title: 'UNITY', mode: 'to-come', dark: true });
    }

    // ---------------------------------------------------------------- save
    function save() {
        if (!savingEnabled || window.__rpiSkipSave) return;
        try { localStorage.setItem(V.SAVE_KEY, V.serialize(s)); } catch { /* full */ }
    }
    saveTimer = setInterval(save, SAVE_EVERY_MS);
    beforeUnload = () => save();
    window.addEventListener('beforeunload', beforeUnload);

    // ---------------------------------------------------------------- the frame
    let last = performance.now();
    let slowAt = 0;
    let drewAt = 0, drawDt = 0;
    function frame(now) {
        rafId = requestAnimationFrame(frame);
        const dt = Math.min(0.25, (now - last) / 1000);
        last = now;
        const held = window.__rpiPaused || now < introUntil || document.querySelector('#chapter-card.is-active');
        if (!held && !s.risen) V.advance(s, dt, speed);
        if (s.out.length || s.sfx.length) pushLines();
        stepCrt(now);
        // the picture at 30 fps, 10 when held or paused and nothing on it moves by itself
        // (the owner's machine is slow; the rules above still step every frame)
        drawDt += held ? 0 : dt;
        const still = (held || speed === 0) && !view.busy;
        if (now - drewAt >= (still ? 100 : 33) - 2) {
            drewAt = now;
            view.frame(s, uiState(), now, drawDt);
            drawDt = 0;
        }
        if (now - slowAt > 200) {
            slowAt = now;
            paintPanel(); paintCards(); paintInfo();
            sound.set(s.phase === 'night', V.hasVat(s) && !s.risen);
        }
    }

    // ---------------------------------------------------------------- the arrival
    if (s.risen) {
        playChapterCard({ roman: 'V', title: 'UNITY', mode: 'to-come', dark: true });
    } else if (fresh || !s.introDone) {
        introUntil = performance.now() + INTRO_MS;
        s.introDone = true;
        if (!s.out.length && !crt.queue.length) crt.queue.push(...V.LINES.online.map((text) => ({ text, who: 'sys' })));
        view.startDescent(INTRO_MS * 0.8);
        const parts = [...root.querySelectorAll('.v-panel > *, .v-build, .v-time')];
        parts.forEach((p) => p.classList.add('v-lamp-off'));
        parts.forEach((p, k) => timers.push(setTimeout(() => p.classList.remove('v-lamp-off'), 600 + k * 650)));
    }
    pushLines();
    afterAct();
    icons();
    rafId = requestAnimationFrame(frame);

    // for the playtest and the checkpoints
    window.rpiVault = { get state() { return s; }, view, act: (id, i) => { V.act(s, id, i); afterAct(); }, setSpeed: (v) => { speed = v; }, select: (i) => { selected = i; afterAct(); } };
}

function icons() {
    try { lucide.createIcons(); } catch { /* the CDN is not there */ }
}
function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

export function teardown() {
    try { if (savingEnabled && !window.__rpiSkipSave && window.rpiVault) localStorage.setItem(V.SAVE_KEY, V.serialize(window.rpiVault.state)); } catch { /* ignore */ }
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
    document.body.classList.remove('in-vault');
    delete window.rpiVault;
}
