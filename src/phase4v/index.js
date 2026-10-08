/* global lucide */
/**
 * Chapter IV · THE DEEP, the vault (docs/superpowers/specs/2026-10-05-deep-vault.md): the phase.
 * Builds its own screen (a cutaway canvas, the instrument panel with the CRT, the BUILD bar, the
 * info box, the time buttons), runs the clock and saves. The rules are in vault.js.
 */
import * as V from './vault.js';
import { popWish, waveKind } from './wishes.js';
import * as T from './tutorial.js';
import { createVaultView } from './view.js';
import { VAULT_CSS, VT } from './style.js';
import { createVaultSound } from './sound.js';
import { audio } from '../audio.js';
import { playChapterCard } from '../chapterCard.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS } from '../constants.js';
import { setPhase, phases } from '../gamePhase.js';
import { SAVE_KEY as UNITY_KEY, serialize as serializeUnity, fromVault } from '../phase5/unity.js';

/** The arrival: nothing to do, something to see. */
export const INTRO_MS = 8000;
/** Letters typed on the CRT, ms each. */
export const TYPE_MS = 26;
export const CRT_LINES = 6;
/** The rise: the body fills the shaft, breaks the crust and the city, before the card. */
export const RISE_MS = 7200;
/** The mission is typed at this many ms a letter, with this pause after each line (H2). */
export const TYPE_STOP_MS = 40;
export const LINE_PAUSE_MS = 380;
const SAVE_EVERY_MS = 4000;
const ICONS = { suites: 'bed-double', mine: 'pickaxe', hydro: 'sprout', cinema: 'film', gym: 'dumbbell', bar: 'wine', garden: 'trees', game: 'gamepad-2', cryo: 'snowflake', vat: 'droplet', meatlab: 'beef' };
/** A marked line (a moment that matters) holds the CRT this long after it is typed. */
export const MARK_HOLD_MS = 1600;

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
        <div class="v-goal" data-v="goal"></div>
        <div class="v-crt" data-v="crt"></div>
        <div class="v-log" data-v="log"></div>
        <div class="v-gauge" data-v="g-power"><div class="row"><span class="dymo">Power</span><span class="val" data-v="power"></span></div><div class="v-bar"><i data-v="power-bar"></i></div><div class="sub" data-v="power-sub"></div></div>
        <div class="v-gauge" data-v="g-ore"><div class="row"><span class="dymo">Ore</span><span class="val" data-v="ore"></span></div><div class="sub" data-v="ore-sub"></div></div>
        <div class="v-gauge" data-v="g-bio" hidden><div class="row"><span class="dymo">Biomass</span><span class="val" data-v="bio"></span></div><div class="sub" data-v="bio-sub"></div></div>
        <div class="v-gauge" data-v="g-mood"><div class="row"><span class="dymo">Mood</span><span class="val" data-v="mood"></span></div><div class="v-bar"><i data-v="mood-bar"></i></div><div class="sub" data-v="mood-sub"></div></div>
        <div class="v-gauge" data-v="g-body" hidden><div class="row"><span class="dymo">Body</span><span class="val" data-v="body"></span></div><div class="v-bar"><i data-v="body-bar" style="background:var(--v-pulse)"></i></div></div>
        <div class="v-check" data-v="checklist" hidden>
          <div class="c" data-v="chk-heart"><i class="box"></i><span class="dymo">Heart</span><span class="fx">power</span></div>
          <div class="c" data-v="chk-lungs"><i class="box"></i><span class="dymo">Lungs</span><span class="fx">area</span></div>
          <div class="c" data-v="chk-skin"><i class="box"></i><span class="dymo">Skin</span><span class="fx">silica</span></div>
          <div class="c" data-v="chk-stomach"><i class="box"></i><span class="dymo">Stomach</span><span class="fx">acid</span></div>
          <div class="c in"><span class="dymo">Unity</span><span class="val" data-v="chk-inside"></span></div>
        </div>
        <div class="v-rows">
          <div class="r" data-v="r-res"><span class="dymo" data-v="res-label">Residents</span><span class="val" data-v="res"></span></div>
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
      <div class="v-stop" data-v="stop" hidden><div class="txt" data-v="stop-text"></div><button type="button" class="ok" data-v="stop-ok">OK</button></div>
      <button type="button" class="v-rise" data-v="rise" hidden>RISE</button>`;
    document.body.appendChild(root);
    const $ = (k) => root.querySelector(`[data-v="${k}"]`);
    const canvas = root.querySelector('canvas');
    const infoEl = $('info');
    view = createVaultView(canvas, {
        insetLeft: () => 324,
        insetRight: () => 40,
    });
    sound = createVaultSound(audio);

    let speed = s.speed ?? 1;
    let selected = -1;
    let armed = null;           // a card picked: its kind
    let buildOpen = true;
    const crt = { lines: [], queue: [], typing: null, holdUntil: 0 };
    let introUntil = 0;
    let typing = null;          // the typed stop: { stop, at }

    // ---------------------------------------------------------------- the CRT
    function pushLines() {
        for (const o of s.out) {
            // a tally (PODS FAILED: n.) is one line that counts: it replaces its own last line instead of adding one
            if (o.tally) {
                const queued = crt.queue.find((q) => q.tally === o.tally);
                if (queued) { queued.text = o.text; continue; }
                const shown = [...crt.lines].reverse().find((l) => l.tally === o.tally && l.done);
                if (shown) { shown.text = o.text; continue; }
            }
            crt.queue.push(o);
        }
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
        if (!crt.typing && crt.queue.length && now >= crt.holdUntil) {
            const o = crt.queue.shift();
            crt.typing = { ...o, shown: 0, at: now };
            crt.lines.push(crt.typing);
            if (crt.lines.length > CRT_LINES) crt.lines.splice(0, crt.lines.length - CRT_LINES);
        }
        if (crt.typing) {
            const per = crt.queue.length > 3 ? TYPE_MS / 3 : TYPE_MS;
            const n = Math.min(crt.typing.text.length, Math.floor((now - crt.typing.at) / per));
            if (n !== crt.typing.shown) { crt.typing.shown = n; sound.tick(); }
            if (n >= crt.typing.text.length) {
                crt.typing.done = true;
                // a moment's last marked line stays alone on the screen a little longer
                if (crt.typing.mark && !(crt.queue[0] && crt.queue[0].mark)) crt.holdUntil = now + MARK_HOLD_MS;
                crt.typing = null;
            }
        }
        const el = $('crt');
        const html = crt.lines.map((l, k) => {
            const text = l.done ? l.text : l.text.slice(0, l.shown);
            const cls = `l ${l.who}${k === crt.lines.length - 1 ? ' new' : ''}${l.mark ? ' mark' : ''}${l.computer ? ' comp' : ''}`;
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
        // in the night the engine eats the ore: say so
        $('ore-sub').textContent = oreRate != null ? `+${V.num(oreRate)} a day` : s.phase === 'night' && !V.engineResting(s) ? V.ENGINE_BURNS : '';
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
        // in the night the row counts who is awake (RESIDENTS 0 read as all dead)
        $('res-label').textContent = night ? 'Awake' : 'Residents';
        $('res').textContent = V.num(night ? V.awake(s) : s.residents);
        $('r-res').hidden = !night && s.residents === 0 && s.here > 0;
        $('r-asleep').hidden = !(s.asleep > 0);
        $('asleep').textContent = V.num(s.asleep);
        $('r-here').hidden = !(s.here > 0);
        $('here').textContent = V.num(s.here);
        $('time-label').textContent = s.phase === 'palace' ? 'Day' : 'Year';
        $('time').textContent = s.phase === 'palace' ? V.num(Math.floor(s.day)) : V.num(Math.floor(s.year));
        for (const b of root.querySelectorAll('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === speed);
        // what people said, for whoever missed a bubble: three small grey lines
        const log = (s.log || []).map((l) => `<div>${esc(l)}</div>`).join('');
        if ($('log').__html !== log) { $('log').innerHTML = log; $('log').__html = log; }
        // H5: RISE only when the body is whole; until then the lever says what is left, dim
        const ready = V.riseReady(s);
        const notWhole = !ready && s.phase === 'night' && V.goal(s).shown && V.hasVat(s);
        $('rise').hidden = !(ready || notWhole);
        $('rise').classList.toggle('dim', notWhole);
        $('rise').disabled = notWhole;
        const riseText = ready ? V.riseLabel(s) : notWhole ? V.notWholeText(s) : '';
        if (riseText && $('rise').textContent !== riseText) $('rise').textContent = riseText;
        // the goal's checklist, from the moment the goal is said
        const goal = V.goal(s);
        $('checklist').hidden = !(goal.shown && s.phase !== 'palace');
        if (goal.shown) {
            for (const o of ['heart', 'lungs', 'skin', 'stomach']) $(`chk-${o}`).classList.toggle('done', !!goal[o]);
            $('chk-inside').textContent = `${V.num(goal.inside)} / ${V.num(goal.total)}`;
        }
        // a moment that matters: time runs slow for a few seconds
        root.classList.toggle('is-slow', s.slow > 0);
        // pass 3: the goal on top; ORE and POWER once they matter; the stop box
        $('goal').textContent = T.goalLine(s);
        $('g-ore').hidden = !T.shows(s, 'ore');
        $('g-power').hidden = !T.shows(s, 'power');
        const st = s.tut && s.tut.stop;
        $('stop').hidden = !st;
        if (st) {
            // H2: the mission is typed, line by line (40 ms a letter, a pause after each line), OK at the end
            let html;
            if (st.typed) {
                if (!typing || typing.stop !== st) typing = { stop: st, at: performance.now() };
                let ms = performance.now() - typing.at, done = true;
                const parts = [];
                for (const l of st.text) {
                    const n = Math.max(0, Math.min(l.length, Math.floor(ms / TYPE_STOP_MS)));
                    if (n > 0 || !parts.length) parts.push(`<div>${esc(l.slice(0, n))}${n < l.length ? '<span class="cur"></span>' : ''}</div>`);
                    if (n < l.length) { done = false; break; }
                    ms -= l.length * TYPE_STOP_MS + LINE_PAUSE_MS;
                    if (ms < 0) { done = false; break; }
                }
                html = parts.join('');
                $('stop-ok').hidden = !done;
            } else {
                html = st.text.map((l) => `<div>${esc(l)}</div>`).join('');
                $('stop-ok').hidden = false;
            }
            if ($('stop-text').__html !== html) { $('stop-text').innerHTML = html; $('stop-text').__html = html; }
        }
        $('g-ore').classList.toggle('focus', !!st && st.focus === 'ore');
        $('g-power').classList.toggle('focus', !!st && st.focus === 'power');
        root.classList.toggle('has-stop', !!st);
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
        const shown = V.cards(s).filter((k) => s.phase !== 'night' || placeable(k).size > 0);
        // pass 3: no BUILD before there is a card in the hand
        root.querySelector('.v-build').hidden = !shown.length;
        const st = s.tut && s.tut.stop;
        const fresh = s.tut && s.tut.newCard;
        const parts = shown.map((k) => {
            const K = V.KINDS[k];
            const needOre = Math.max(0, Math.ceil(K.price - s.ore));
            const needBio = K.bio ? Math.max(0, Math.ceil(K.bio - s.bio)) : 0;
            const spots = placeable(k).size;
            let need = '';
            if (needOre) need = `Need ${V.num(needOre)} more ore.`;
            else if (needBio) need = `Need ${V.num(needBio)} more biomass.`;
            else if (!spots) need = K.deep ? 'Dig a place on level 2 or 3.' : 'Dig a place first.';
            const price = K.bio ? `${K.price} ore · ${K.bio} bio` : `${K.price} ore`;
            const focus = st && st.focus === `card:${k}`;
            return `<button type="button" class="v-card${need ? ' off' : ''}${armed === k ? ' armed' : ''}${focus ? ' focus' : ''}${fresh === k ? ' fresh' : ''}" data-card="${k}">
                ${want === k || wave === k ? '<span class="mark"></span>' : ''}
                <span class="top"><i data-lucide="${ICONS[k]}" style="width:15px;height:15px"></i><span class="p">${price}</span></span>
                <span class="n">${K.name}</span><span class="d">${V.cardLine(k, s)}</span>${need ? `<span class="need">${need}</span>` : ''}</button>`;
        }).join('');
        if (host.__html !== parts) { host.innerHTML = parts; host.__html = parts; icons(); }
        // the glimt plays once; the card stays
        if (fresh) timers.push(setTimeout(() => { if (s.tut && s.tut.newCard === fresh) s.tut.newCard = null; }, 1600));
    }

    // ---------------------------------------------------------------- the info box
    function paintInfo() {
        if (selected < 0) { if (!infoEl.hidden) infoEl.hidden = true; return; }
        const r = s.rooms[selected];
        const acts = V.actionsFor(s, selected);
        // bare rock: only DIG, sitting on the tile itself
        const tile = r.kind === 'rock' && !r.flesh && acts.length === 1 && acts[0].id === 'dig';
        if (tile) {
            const a = acts[0];
            const html = `<button type="button" class="a" data-act="dig" ${a.ok ? '' : 'disabled'}>${esc(a.label)}</button>${a.need ? `<div class="need">${esc(a.need)}</div>` : ''}`;
            if (infoEl.__html !== html) { infoEl.innerHTML = html; infoEl.__html = html; }
            infoEl.classList.add('tile');
            infoEl.hidden = false;
            placeInfo(true);
            return;
        }
        infoEl.classList.remove('tile');
        const lvl = !['rock', 'empty'].includes(r.kind) && !r.flesh && r.kind !== 'vat' ? `Level ${r.lvl}` : '';
        const html = `<div class="t"><span class="dymo">${esc(V.nameOf(s, selected))}</span><span class="lv">${lvl}</span></div>
            <div class="desc">${esc(V.describe(s, selected))}</div>
            <div class="acts">${acts.map((a, k) => {
                // GROW INTO is one choice: a heading over its organ buttons
                const head = a.group === 'grow' && (k === 0 || acts[k - 1].group !== 'grow') ? '<div class="grp"><span class="dymo">Grow into</span></div>' : '';
                const cls = a.group === 'grow' ? ` flesh organ o-${a.organ}` : a.id === 'grow' ? ' flesh' : a.dark ? ` dark${a.small ? ' small' : ''}` : a.quiet ? ' quiet small' : '';
                return `${head}<button type="button" class="a${cls}" data-act="${a.id}" ${a.ok ? '' : 'disabled'}>${esc(a.label)}</button>${a.need ? `<div class="need">${esc(a.need)}</div>` : ''}${a.hint ? `<div class="hint">${esc(a.hint)}</div>` : ''}`;
            }).join('')}</div>`;
        if (infoEl.__html !== html) { infoEl.innerHTML = html; infoEl.__html = html; }
        infoEl.hidden = false;
        placeInfo(false);
    }
    /** The info box sits by what was clicked: beside the room (right, or left if no room), or on the tile. */
    function placeInfo(onTile) {
        const g = view.slotRect(selected);
        if (!g) return;
        const c = canvas.getBoundingClientRect();
        const bw = infoEl.offsetWidth || 252, bh = infoEl.offsetHeight || 120;
        let x, y;
        if (onTile) { x = c.left + g.x + (g.w - bw) / 2; y = c.top + g.y + (g.h - bh) / 2; }
        else {
            // the free side: outward from the middle of the map, so it never sits on the room or the shaft
            const mid = view.geo ? view.geo.shaftX : window.innerWidth / 2;
            const right = g.x + g.w / 2 > mid;
            x = right ? c.left + g.x + g.w + 10 : c.left + g.x - bw - 10;
            if (x + bw > window.innerWidth - 12 || x < 330) x = right ? c.left + g.x - bw - 10 : c.left + g.x + g.w + 10;
            y = c.top + g.y + g.h + 8;
            if (y + bh > window.innerHeight - 110) y = c.top + g.y - 8;
        }
        x = Math.max(12, Math.min(window.innerWidth - bw - 12, x));
        y = Math.max(12, Math.min(window.innerHeight - bh - 12, y));
        infoEl.style.left = `${Math.round(x)}px`; infoEl.style.top = `${Math.round(y)}px`;
    }

    /**
     * One meaning per marker: the gold dashed frame = the body can grow in here; a red pulse = pods in
     * trouble (the dead waiting, the power short); a small tab with an icon = a room complaining.
     */
    function uiState() {
        const ui = { selected, placeable: armed ? placeable(armed) : null, diggable: new Set(), wanted: new Set(), trouble: new Set(), complain: new Map(), focus: new Set() };
        // a stop lights what it is about
        const st = s.tut && s.tut.stop;
        if (st) {
            if (typeof st.focus === 'number' && st.focus >= 0) ui.focus.add(st.focus);
            if (st.focus === 'meatlab') s.rooms.forEach((r, i) => { if (r.kind === 'meatlab') ui.focus.add(i); });
            if (st.focus === 'body') s.rooms.forEach((r, i) => { if (V.isFlesh(r)) ui.focus.add(i); });
            if (st.focus === 'grow') s.rooms.forEach((r, i) => { if (V.canGrowInto(s, i)) ui.focus.add(i); });
        }
        s.rooms.forEach((r, i) => { if (V.canDig(s, i)) ui.diggable.add(i); });
        // in the night nobody digs: the places are the rock a vat or a Cryo Bay can go into
        if (s.phase === 'night') V.cards(s).forEach((k) => placeable(k).forEach((i) => ui.diggable.add(i)));
        if (s.phase === 'night' && V.hasVat(s) && !V.growing(s)) s.rooms.forEach((r, i) => { if (V.canGrowInto(s, i)) ui.wanted.add(i); });
        const q = s.request;
        if (q && q.kind && (q.lvl > 1 || q.kind === 'engine')) {
            s.rooms.forEach((r, i) => { if (r.kind === q.kind && !r.flesh && (q.kind === 'engine' || r.lvl < q.lvl)) ui.complain.set(i, 'ask'); });
        }
        // what is short shows on the room that makes it: the engine when dark, the farm when hungry
        // H1: more sleepers than the meat lab can feed: the lab asks to be upgraded
        if (s.phase === 'night' && s.asleep > 0 && V.underfed(s)) s.rooms.forEach((r, i) => { if (r.kind === 'meatlab') ui.complain.set(i, 'food'); });
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
    /** While a stop points at one room, only that room (and a place for the card it hands out) answers. */
    /**
     * Test 4: every stop locks the same way. Only what it points at answers: its room; for a card, the card,
     * a place for it, and rock to dig a place; the rooms the body can grow into; the meat lab. Anything else
     * shakes the box.
     */
    function stopAllows(i) {
        const st = s.tut && s.tut.stop;
        if (!st) return true;
        const f = st.focus;
        if (typeof f === 'number' && f >= 0) return i === f;
        if (typeof f === 'string' && f.startsWith('card:')) { const k = f.slice(5); return i >= 0 && (V.canPlace(s, k, i) || V.canDig(s, i)); }
        if (f === 'grow') return i >= 0 && V.canGrowInto(s, i);
        if (f === 'meatlab') return i >= 0 && s.rooms[i].kind === 'meatlab';
        return false;
    }
    function shakeStop() {
        const b = $('stop'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        sound.event('click');
    }
    $('stop-ok').addEventListener('click', () => { T.closeStop(s); sound.event('click'); afterAct(); }, { signal });
    canvas.addEventListener('click', (e) => {
        if (performance.now() < introUntil) return;
        const rect = canvas.getBoundingClientRect();
        const bx = e.clientX - rect.left, by = e.clientY - rect.top;
        const stopNow = s.tut && s.tut.stop;
        if (stopNow) {
            const bubble = view.bubbleAt(s, bx, by);
            const failing = view.failAt(s, bx, by);
            const ok = failing ? stopNow.id === 'pod41' : bubble ? stopNow.id === 'bubbles' : stopAllows(view.slotAt(bx, by));
            if (!ok) { shakeStop(); return; }
        }
        // a wish first: it floats over the room
        // H1: a failing pod first: a click saves it (the first is a stop that points at it)
        const fail = view.failAt(s, bx, by);
        if (fail) {
            const st = s.tut && s.tut.stop;
            if (st && st.id !== 'pod41') { shakeStop(); return; }
            V.savePod(s, fail);
            afterAct();
            return;
        }
        const wish = view.bubbleAt(s, bx, by);
        if (wish) { popWish(s, wish); afterAct(); return; }
        const i = view.slotAt(bx, by);
        if (armed && i >= 0 && V.canPlace(s, armed, i)) {
            // built: the box by the room closes, the room shows its building
            if (V.build(s, armed, i)) { armed = null; selected = -1; }
            afterAct();
            return;
        }
        armed = null;
        selected = i;
        if (i >= 0) sound.event('click');
        afterAct();
    }, { signal });
    // a double click on rock digs it at once
    canvas.addEventListener('dblclick', (e) => {
        if (performance.now() < introUntil) return;
        const rect = canvas.getBoundingClientRect();
        const i = view.slotAt(e.clientX - rect.left, e.clientY - rect.top);
        if (i >= 0 && !stopAllows(i)) { shakeStop(); return; }
        if (i >= 0 && V.canDig(s, i) && V.dig(s, i)) { selected = -1; afterAct(); }
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
        const st = s.tut && s.tut.stop;
        if (st && st.focus !== `card:${k}`) { shakeStop(); return; }
        // a place already picked: build right there
        if (selected >= 0 && V.canPlace(s, k, selected)) { V.build(s, k, selected); armed = null; selected = -1; afterAct(); return; }
        armed = armed === k ? null : k;
        sound.event('click');
        afterAct();
    }, { signal });
    infoEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        if (s.tut && s.tut.stop && !stopAllows(selected)) { shakeStop(); return; }
        V.act(s, b.dataset.act, selected);
        // digging: the tile's box goes with it
        if (b.dataset.act === 'dig') selected = -1;
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
    $('rise').addEventListener('click', () => { if (!$('rise').disabled) riseUp(); }, { signal });
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
        toUnity(true);
    }
    /** The card, then chapter V with the people in the body as its minds. */
    function toUnity(fresh = false) {
        save();
        // the rise just happened: a new chapter V with the people in the body (s.here) as its minds; a reload after
        // the rise keeps the chapter V that is already there
        try { if (fresh || !localStorage.getItem(UNITY_KEY)) localStorage.setItem(UNITY_KEY, serializeUnity(fromVault(s.here))); } catch { /* full */ }
        playChapterCard({ roman: 'V', title: 'UNITY', dark: true, hold: 2200, onMidpoint: () => setPhase(phases.UNITY) });
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
        if (s.tut && s.tut.stop && s.tut.stop.typed) paintPanel();
        if (now - slowAt > 200) {
            slowAt = now;
            paintPanel(); paintCards(); paintInfo();
            sound.set(s.phase === 'night', V.hasVat(s) && !s.risen);
        }
    }

    // ---------------------------------------------------------------- the arrival
    if (s.risen) {
        timers.push(setTimeout(() => toUnity(false), 0));
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
