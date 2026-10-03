/**
 * Chapter IV · THE DEEP: what the colony view must answer to (deep-rebuild).
 *
 * Ola, 2026-10-03: the 3D colony may be replaced after a mockup round. The panel, the drawer, the
 * lever and the night are HUD and do not care what draws the colony. What lives IN the view goes
 * through this small set of hooks, so another view can implement the same calls later:
 *
 *   emptyAt(x, y)                   the empty chamber under a point of the screen, or -1
 *   openRoomRing(slot, x, y, opts)  the ring of four rooms around the cursor, over an empty chamber
 *   closeRoomRing()
 *   hallucinate(kind, on)           'lamp' | 'figure' | 'breathe' (the scene's), 'twitch' is the HUD's
 *   snapClear()                     every false thing goes, with a short flicker
 *
 * deep-grow, MOVEMENT III (the body). The same contract for the strata view (strata-view.js) and
 * this 3D one. Ids are growth.js node ids: 'h0' the lid (the heart), 'h1' the landing a floor down,
 * 's12' chamber 12, 'machine' the machine house.
 *
 *   setBody(bodyIds, necroticIds, reachableIds)   draw the body: a chamber new to it turns to flesh
 *                                   from the edge that touches the body (about 2 s), with sinew across
 *                                   the bridge; necrotic ones grey; reachable ones glow faintly. The
 *                                   first call after the view was (re)built lays it all on at once.
 *   onChamberClick(cb)              cb(chamberId) on a click (not a drag) on a chamber of the view
 *   setHands(on)                    the machine's tubes are overgrown and become hands
 *   rise(onDone)                    the body pushes up through the shaft and the crust; onDone after
 *
 * and two the phase uses besides: onChamberHover(cb) (cb(chamberId or '', x, y), for the price
 * under the cursor) and step(dt, throws) once a frame (the flesh's own clock, the hands' throws).
 *
 * deep-grow2. setBody takes a fourth argument, `lone`: ids among the body that are LONE organs (the
 * grafts, graft.js): flesh like the rest, but joined to nothing (no sinew, no roots). Three calls on
 * an overlay over whatever view is below (screen positions through the view's screenOfNode):
 *   markChamber(id, on, fromId)    a mark on a chamber the body should dream toward, with a faint red
 *                                  thread from the body node `fromId` to it
 *   clearMarks()
 *   floatText(id, text, cls)       a word that floats up over a chamber and fades ("×5", "×20")
 *
 * The room ring itself is drawn here, in the DOM, over whatever view is below it. The 3D
 * implementation calls into scene.js, flesh.js and hands.js.
 *
 * deep-swap: the strata view (strata-view.js) is the default; index.js wraps these hooks with its
 * extendHooks there, which answers every call above from the strata view itself. This 3D body is used
 * with `?view=3d` or "View · 3D" in the ☰ menu.
 */

import * as THREE from 'three';
import { ROOM_ICON } from './scene.js';
import { signHtml, short, MASS_SIGN } from './readout.js';
import { ORGAN_NAME, ORGAN_DOES } from './organs.js';
import { makeOrganArt, organGlyph } from './organ-art.js';
import {
    fleshify, setNecrotic, setReachable, growTendrils, setTendrilsNecrotic, stepFlesh, makeWetEnvironment,
    setFleshEnvironment, forget, forgetTendrils, makeFleshMaterial, FLESH_SECONDS,
} from './flesh.js';
import { createHands, OVERGROW_SECONDS } from './hands.js';

/** Seconds the rise takes, from the pull to onDone. */
export const RISE_SECONDS = 5.2;
/** A click is a click, not the end of a drag that turned the camera. */
const CLICK_PX = 6, CLICK_MS = 500;

const ROOM_ORDER = ['mine', 'farm', 'generator', 'dorm'];
const ROOM_NAME = { mine: 'MINE', farm: 'FARM', generator: 'GENERATOR', dorm: 'DORMITORY' };
/** The ring's radius around the cursor, in pixels. */
export const RING_R = 58;

/**
 * @param {object|null} scene - scene.js's createScene(), or null without WebGL
 * @param {object} opts
 * @param {HTMLElement} opts.ringHost - an element over the view for the ring (index.html #deep-ring)
 * @param {(slot:number)=>boolean} opts.isEmpty - is this chamber dug, empty and unclaimed?
 * @param {()=>void} [opts.onIcons] - draw the ring's glyphs
 * @returns {object}
 */
export function createViewHooks(scene, { ringHost, isEmpty, onIcons, graph = () => null, marksHost = null, floatHost = null }) {
    let ring = null;            // { slot, pick }
    let oring = null;           // deep-organs: { id } while the ring of organs is open
    const shown = { lamp: false, figure: false, breathe: false };
    const body = createBody(scene, graph);
    const over = createOverlay(scene, { marksHost, floatHost });

    function closeRoomRing() {
        if (!ring) return;
        ring = null;
        ringHost.classList.remove('is-open');
        ringHost.hidden = true;
        ringHost.textContent = '';
    }
    function closeOrganRing() {
        if (!oring) return;
        oring = null;
        ringHost.classList.remove('is-open', 'is-organs');
        ringHost.hidden = true;
        ringHost.textContent = '';
    }

    return {
        /** The empty chamber under this point, or -1. */
        emptyAt(x, y) {
            if (!scene) return -1;
            const slot = scene.slotAt(x, y);
            return slot >= 0 && isEmpty(slot) ? slot : -1;
        },
        /**
         * The ring of four rooms around the cursor, with their prices: bright when they can be paid,
         * dim when not (the amount missing shows in the ring's middle on hover).
         * @param {number} slot
         * @param {number} x - client pixels
         * @param {number} y
         * @param {object} o
         * @param {Object<string,{price:string, ok:boolean, need:string}>} o.rooms
         * @param {(type:string)=>void} o.onPick
         */
        openRoomRing(slot, x, y, { rooms, onPick }) {
            closeRoomRing();
            ring = { slot };
            const mx = Math.max(RING_R + 40, Math.min(window.innerWidth - RING_R - 40, x));
            const my = Math.max(RING_R + 40, Math.min(window.innerHeight - RING_R - 50, y));
            ringHost.style.left = `${mx}px`;
            ringHost.style.top = `${my}px`;
            ringHost.innerHTML = '<span class="deep-ring-hub"><span class="dymo is-small deep-ring-say"></span></span>'
                + '<span class="deep-ring-effect deep-mono" hidden></span>';
            const say = ringHost.querySelector('.deep-ring-say');
            const eff = ringHost.querySelector('.deep-ring-effect');
            say.hidden = true;
            ROOM_ORDER.forEach((t, i) => {
                const r = rooms[t];
                const a = -Math.PI / 2 + i * Math.PI / 2 - Math.PI / 4;
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `deep-ring-room${r.ok ? ' is-ok' : ''}${r.called ? ' is-called' : ''}`;
                b.dataset.room = t;
                b.style.left = `${(RING_R * Math.cos(a)).toFixed(1)}px`;
                b.style.top = `${(RING_R * Math.sin(a)).toFixed(1)}px`;
                b.innerHTML = `<i data-lucide="${ROOM_ICON[t]}" class="w-6 h-6"></i><span class="deep-ring-price deep-mono">${signHtml(r.price)}</span>`;
                b.addEventListener('pointerenter', () => {
                    say.innerHTML = signHtml(r.ok ? ROOM_NAME[t] : r.need);
                    say.hidden = false;
                    // deep-pass3 (B403): what the room does to the stars, under the ring
                    const text = r.stars ? `${r.stars}${r.why ? `<br>${r.why}` : ''}` : '';
                    eff.innerHTML = text;
                    eff.hidden = !text;
                    eff.classList.toggle('is-down', !!r.why);
                });
                b.addEventListener('pointerleave', () => { say.hidden = true; eff.hidden = true; });
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!r.ok) {
                        b.classList.remove('is-no');
                        void b.offsetWidth;
                        b.classList.add('is-no');
                        return;
                    }
                    closeRoomRing();
                    onPick(t);
                });
                ringHost.appendChild(b);
            });
            ringHost.hidden = false;
            void ringHost.offsetWidth;
            ringHost.classList.add('is-open');
            onIcons?.();
        },
        closeRoomRing,
        get ringSlot() { return ring ? ring.slot : -1; },
        /**
         * deep-organs: THE RING OF ORGANS over a chamber the body can take (or a living organ it can grow
         * again): each organ's glyph and its price in mass, bright when it can be paid, the room's own
         * organ marked cheap. The middle says the wallet, and on hover what the organ does (or what is
         * missing). A click on a bright one picks it.
         * @param {string} id - the chamber (growth.js id)
         * @param {number} x - client pixels (the click), used when the chamber is off the screen
         * @param {number} y
         * @param {{organs:{organ:string, mass:number, ok:boolean, cheap:boolean, need:string}[], have:number,
         *          regrow?:string|null, onPick:(organ:string)=>void}} o
         */
        openOrganRing(id, x, y, { organs, have = 0, regrow = null, want = null, short: shortWord = '', onPick }) {
            closeRoomRing();
            closeOrganRing();
            oring = { id };
            const at = scene && typeof scene.screenOfNode === 'function' ? scene.screenOfNode(id) : null;
            const px = at ? at.x : x, py = at ? at.y : y;
            const mx = Math.max(RING_R + 40, Math.min(window.innerWidth - RING_R - 40, px));
            const my = Math.max(RING_R + 40, Math.min(window.innerHeight - RING_R - 50, py));
            ringHost.style.left = `${mx}px`;
            ringHost.style.top = `${my}px`;
            ringHost.innerHTML = '<span class="deep-ring-hub is-organs"><span class="dymo is-small deep-ring-say"></span></span>';
            const say = ringHost.querySelector('.deep-ring-say');
            // deep-tension: the gauge that is short is said in the middle, its organ marked in the ring
            const wallet = `${regrow ? `${ORGAN_NAME[regrow]} now. ` : ''}You have ${MASS_SIGN} ${short(Math.floor(have))}.${shortWord ? ` ${shortWord}` : ''}`;
            const rest = () => { say.innerHTML = signHtml(wallet); say.classList.add('is-rest'); };
            rest();
            const n = organs.length;
            organs.forEach((r, i) => {
                const a = n === 1 ? -Math.PI / 2 : -Math.PI / 2 + i * (2 * Math.PI / n) - (n === 4 ? Math.PI / 4 : 0);
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `deep-ring-room deep-ring-organ${r.ok ? ' is-ok' : ''}${r.cheap ? ' is-cheap' : ''}${want === r.organ ? ' is-want' : ''}`;
                b.dataset.organ = r.organ;
                b.style.left = `${(RING_R * Math.cos(a)).toFixed(1)}px`;
                b.style.top = `${(RING_R * Math.sin(a)).toFixed(1)}px`;
                b.innerHTML = `${organGlyph(r.organ)}<span class="deep-ring-price deep-mono">${signHtml(`${MASS_SIGN} ${short(r.mass)}`)}</span>`;
                const name = r.organ === 'hands' ? 'HANDS' : ORGAN_NAME[r.organ];
                const does = r.organ === 'hands' ? 'The machine plays with hands.' : ORGAN_DOES[r.organ];
                b.addEventListener('pointerenter', () => { say.classList.remove('is-rest'); say.innerHTML = signHtml(r.ok ? `${name}. ${does}` : `${name}. ${r.need}`); });
                b.addEventListener('pointerleave', rest);
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!r.ok) {
                        b.classList.remove('is-no');
                        void b.offsetWidth;
                        b.classList.add('is-no');
                        return;
                    }
                    closeOrganRing();
                    onPick(r.organ);
                });
                ringHost.appendChild(b);
            });
            ringHost.classList.add('is-organs');
            ringHost.hidden = false;
            void ringHost.offsetWidth;
            ringHost.classList.add('is-open');
        },
        closeOrganRing,
        /** The chamber the ring of organs is open over, or ''. */
        get organRingAt() { return oring ? oring.id : ''; },
        /** Bring a kind of hallucination on or off. 'twitch' is the HUD's own and is ignored here. */
        hallucinate(kind, on) {
            if (!(kind in shown)) return false;
            shown[kind] = !!on;
            return scene ? scene.hallucinate(kind, on) : false;
        },
        /** After the view was rebuilt (a chamber dug, a room landed): draw what shows again. */
        reapply() { if (scene) for (const k of Object.keys(shown)) if (shown[k]) scene.hallucinate(k, true); },
        /** What shows now. */
        get showing() { return { ...shown }; },
        /* ---- deep-grow: the body ---- */
        setBody: (ids, necrotic, reachable, lone) => body.setBody(ids, necrotic, reachable, lone),
        /* ---- deep-organs: the organs in their chambers, the take in progress, the pump's wave ---- */
        setOrgans: (map, o) => body.setOrgans(map, o),
        setBeat: (phase) => body.setBeat(phase),
        get organArt() { return body.organArt; },
        setTaking: (t) => over.setTaking(t),
        pumpWave: (ids, o) => over.pumpWave(ids, o),
        get waves() { return over.waves; },
        onChamberClick: (cb) => body.onClick(cb),
        onChamberHover: (cb) => body.onHover(cb),
        setHands: (on, o) => body.setHands(on, o),
        rise: (onDone) => body.rise(onDone),
        step: (dt, throws) => { body.step(dt, throws); over.step(); },
        /* ---- deep-grow2: the marks of a dream, and the words that float over a plate ---- */
        markChamber: (id, on, from) => over.markChamber(id, on, from),
        clearMarks: () => over.clearMarks(),
        floatText: (id, text, cls) => over.floatText(id, text, cls),
        callChamber: (id) => over.callChamber(id),
        stepOverlay: () => over.step(),
        get marks() { return over.marks; },
        get bodyStats() { return body.stats; },
        /**
         * The snap: a short flicker, and every false thing goes.
         * @returns {Promise<void>}
         */
        snapClear() {
            const any = Object.values(shown).some(Boolean);
            if (!scene || !any) { for (const k of Object.keys(shown)) shown[k] = false; return Promise.resolve(); }
            const steps = [true, false, true, false];
            return new Promise((resolve) => {
                steps.forEach((on, i) => setTimeout(() => scene.flickerHallucinations(on), i * 60));
                setTimeout(() => {
                    scene.flickerHallucinations(false);
                    for (const k of Object.keys(shown)) { shown[k] = false; scene.hallucinate(k, false); }
                    resolve();
                }, steps.length * 60 + 30);
            });
        },
    };
}

/* =============================================================================================
   deep-grow2: THE OVERLAY over either view. Marks (a ring on the chamber, a faint red thread from
   the body to it) and the words that float up over a plate. Screen positions come from the view's
   own screenOfNode, a frame at a time, so they follow the camera in both views.
   ============================================================================================= */
const SVGNS = 'http://www.w3.org/2000/svg';
/** A floating word rises this far (px) and is gone after this long (ms). */
export const FLOAT_PX = 40, FLOAT_MS = 2600;
/** deep-organs: the pump's wave runs from the heart to the front in this long (ms), its bright head this
 *  long (px); the fill ring's radius when the view cannot say how big a chamber is. */
export const WAVE_MS = 520, WAVE_HEAD = 34, FILL_R = 17;
/** ... and at least this many ms a pixel of its way. */
export const WAVE_MS_PER_PX = 2.4;
function createOverlay(scene, { marksHost, floatHost }) {
    const marks = new Map();        // id -> { from, path, ring }
    const floats = [];              // { id, el, t0 }
    const waves = [];               // deep-organs: { ids, path, glow, t0, ms, onArrive, arrived }
    let fill = null;                // deep-organs: { id, k, shown, g, back, arc, pulse }
    let call = null;                // deep-tension: { id, ring } the chamber the tape points at
    const at = (id) => (scene && typeof scene.screenOfNode === 'function' ? scene.screenOfNode(id) : null);
    const origin = () => {
        const r = marksHost ? marksHost.getBoundingClientRect() : { left: 0, top: 0 };
        return { x: r.left, y: r.top };
    };
    function drawMark(m, id) {
        const p = at(id), q = at(m.from);
        const o = origin();
        const on = !!p;
        m.ring.setAttribute('visibility', on ? 'visible' : 'hidden');
        m.path.setAttribute('visibility', on && q ? 'visible' : 'hidden');
        if (!p) return;
        m.ring.setAttribute('cx', (p.x - o.x).toFixed(1));
        m.ring.setAttribute('cy', (p.y - o.y).toFixed(1));
        if (!q) return;
        // a thread that sags a little, never a ruler line
        const x0 = q.x - o.x, y0 = q.y - o.y, x1 = p.x - o.x, y1 = p.y - o.y;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + Math.min(40, Math.hypot(x1 - x0, y1 - y0) * 0.18);
        m.path.setAttribute('d', `M ${x0.toFixed(1)} ${y0.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`);
    }
    return {
        markChamber(id, on, from = 'h0') {
            if (!marksHost) return false;
            const had = marks.get(id);
            if (!on) {
                if (had) { had.path.remove(); had.ring.remove(); marks.delete(id); }
                return false;
            }
            if (had) { had.from = from || 'h0'; drawMark(had, id); return true; }
            const path = document.createElementNS(SVGNS, 'path');
            path.setAttribute('class', 'deep-mark-thread');
            const ring = document.createElementNS(SVGNS, 'circle');
            ring.setAttribute('class', 'deep-mark-ring');
            ring.setAttribute('r', '11');
            marksHost.appendChild(path);
            marksHost.appendChild(ring);
            const m = { from: from || 'h0', path, ring };
            marks.set(id, m);
            drawMark(m, id);
            return true;
        },
        clearMarks() { for (const id of [...marks.keys()]) this.markChamber(id, false); },
        floatText(id, text, cls = '') {
            if (!floatHost || !text) return false;
            const p = at(id);
            if (!p) return false;
            // deep-tension: ONE word per spot: a new one takes over the old one's place (they piled up,
            // "42 % 60 % 79 %" over one chamber)
            const old = floats.find((f) => f.id === id);
            if (old) {
                old.el.className = `deep-float ${cls}`.trim();
                old.el.textContent = text;
                old.t0 = performance.now();
                this.step();
                return true;
            }
            const el = document.createElement('span');
            el.className = `deep-float ${cls}`.trim();
            el.textContent = text;
            floatHost.appendChild(el);
            floats.push({ id, el, t0: performance.now() });
            this.step();
            return true;
        },
        /** deep-tension: a slow ring on the chamber the tape points at (BUILD MINE with an empty one), so it
         *  is found even with the drawer open. null: none. */
        callChamber(id) {
            if (!marksHost) return;
            if (!id) { if (call) { call.ring.remove(); call = null; } return; }
            if (call && call.id === id) return;
            if (call) call.ring.remove();
            const ring = document.createElementNS(SVGNS, 'circle');
            ring.setAttribute('class', 'deep-call-ring');
            ring.setAttribute('r', '22');
            marksHost.appendChild(ring);
            call = { id, ring };
            this.step();
        },
        step() {
            for (const [id, m] of marks) drawMark(m, id);
            const now = performance.now();
            const o0 = origin();
            if (call) {
                const p = at(call.id);
                call.ring.setAttribute('visibility', p ? 'visible' : 'hidden');
                if (p) { call.ring.setAttribute('cx', (p.x - o0.x).toFixed(1)); call.ring.setAttribute('cy', (p.y - o0.y).toFixed(1)); }
            }
            // the fill ring follows its chamber, its arc easing to the new share
            if (fill) {
                const p = at(fill.id);
                fill.g.setAttribute('visibility', p ? 'visible' : 'hidden');
                fill.shown += (fill.k - fill.shown) * 0.22;
                fill.pulse = Math.max(0, fill.pulse - 0.06);
                if (p) {
                    const r = (scene && typeof scene.nodeRadius === 'function' ? scene.nodeRadius(fill.id) : 0) || FILL_R;
                    const cx = p.x - o0.x, cy = p.y - o0.y;
                    const rr = Math.max(10, r) * (1 + 0.12 * fill.pulse);
                    fill.back.setAttribute('cx', cx.toFixed(1));
                    fill.back.setAttribute('cy', cy.toFixed(1));
                    fill.back.setAttribute('r', rr.toFixed(1));
                    const k = Math.min(0.9999, Math.max(0, fill.shown));
                    const a0 = -Math.PI / 2, a1 = a0 + k * Math.PI * 2;
                    const large = k > 0.5 ? 1 : 0;
                    fill.arc.setAttribute('d', k <= 0 ? '' : `M ${(cx + rr * Math.cos(a0)).toFixed(1)} ${(cy + rr * Math.sin(a0)).toFixed(1)} A ${rr.toFixed(1)} ${rr.toFixed(1)} 0 ${large} 1 ${(cx + rr * Math.cos(a1)).toFixed(1)} ${(cy + rr * Math.sin(a1)).toFixed(1)}`);
                    fill.arc.style.strokeWidth = `${(3 + 3 * fill.pulse).toFixed(2)}px`;
                }
            }
            // the waves run along the body; their arrivals are answered after the loop (an arrival may
            // redraw, and a redraw steps this again)
            const arrived = [];
            for (let i = waves.length - 1; i >= 0; i--) {
                const w = waves[i];
                if (!w) continue;
                const pts = w.ids.map((id) => at(id)).filter(Boolean);
                const k = (now - w.t0) / w.ms;
                if (pts.length < 2 || k >= 1.35) {
                    if (!w.arrived) { w.arrived = true; arrived.push(w); }
                    w.path.remove(); w.glow.remove(); w.drop.remove(); waves.splice(i, 1);
                    continue;
                }
                const d = pts.map((q, j) => `${j ? 'L' : 'M'} ${(q.x - o0.x).toFixed(1)} ${(q.y - o0.y).toFixed(1)}`).join(' ');
                w.path.setAttribute('d', d);
                w.glow.setAttribute('d', d);
                const len = typeof w.path.getTotalLength === 'function' ? w.path.getTotalLength() : 200;
                // a long way takes a little longer, so the drop is seen on its way (set once, on the first frame)
                if (!w.sized) { w.sized = true; w.ms = Math.max(w.ms, len * WAVE_MS_PER_PX); }
                const e = Math.min(1, k);
                const ease = 1 - Math.pow(1 - e, 2);
                const head = Math.max(8, Math.min(WAVE_HEAD, len * 0.4));
                w.path.style.strokeDasharray = `${head.toFixed(1)} ${(len + head * 2).toFixed(1)}`;
                w.path.style.strokeDashoffset = (-(ease * (len + head)) + head).toFixed(1);
                w.glow.style.strokeDasharray = `${(ease * len).toFixed(1)} ${(len * 2).toFixed(1)}`;
                w.glow.style.opacity = String(Math.max(0, 0.55 * (1 - Math.max(0, k - 0.6) / 0.75)));
                // the drop: along the way, then it bursts on the chamber it was sent to
                if (typeof w.path.getPointAtLength === 'function') {
                    const q = w.path.getPointAtLength(Math.min(len, ease * len));
                    w.drop.setAttribute('cx', q.x.toFixed(1));
                    w.drop.setAttribute('cy', q.y.toFixed(1));
                }
                const burst = k > 1 ? (k - 1) / 0.35 : 0;
                w.drop.setAttribute('r', ((w.beat ? 7 : 5) * (1 + 3.2 * burst)).toFixed(1));
                w.drop.style.opacity = String(k > 1 ? Math.max(0, 1 - burst) : 1);
                if (!w.arrived && k >= 1) { w.arrived = true; arrived.push(w); }
            }
            for (const w of arrived) w.onArrive?.();
            const o = floatHost ? floatHost.getBoundingClientRect() : { left: 0, top: 0 };
            for (let i = floats.length - 1; i >= 0; i--) {
                const f = floats[i];
                const k = (now - f.t0) / FLOAT_MS;
                const p = at(f.id);
                if (k >= 1 || !p) { f.el.remove(); floats.splice(i, 1); continue; }
                f.el.style.transform = `translate(${(p.x - o.left).toFixed(1)}px, ${(p.y - o.top - FLOAT_PX * k).toFixed(1)}px) translate(-50%, -100%)`;
                f.el.style.opacity = String(k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4));
            }
        },
        get marks() { return [...marks.keys()]; },
        get floats() { return floats.map((f) => f.el.textContent); },
        /**
         * deep-organs: THE FILL RING on the chamber the body is taking: a faint circle and a red arc of
         * how much is filled (k, 0 to 1). It eases to a new k, so each pump is seen as a step. null: none.
         */
        setTaking(t) {
            if (!marksHost) return;
            if (!t) { if (fill) { fill.g.remove(); fill = null; } return; }
            if (!fill || fill.id !== t.id) {
                if (fill) fill.g.remove();
                const g = document.createElementNS(SVGNS, 'g');
                g.setAttribute('class', 'deep-fill');
                const back = document.createElementNS(SVGNS, 'circle');
                back.setAttribute('class', 'deep-fill-back');
                const arc = document.createElementNS(SVGNS, 'path');
                arc.setAttribute('class', 'deep-fill-arc');
                g.appendChild(back);
                g.appendChild(arc);
                marksHost.appendChild(g);
                fill = { id: t.id, k: 0, shown: 0, g, back, arc, pulse: 0 };
            }
            if (t.k > fill.k + 1e-6) fill.pulse = 1;
            fill.k = Math.max(0, Math.min(1, t.k));
            fill.g.classList.toggle('is-regrow', !!t.regrow);
            this.step();
        },
        /**
         * deep-organs: THE PUMP'S WAVE: a red pulse runs from the first id to the last along the body
         * (the ids in order), over WAVE_MS; `onArrive` when it gets there (the fill ring steps then).
         */
        pumpWave(ids, { beat = false, onArrive = null } = {}) {
            if (!marksHost || !ids || ids.length < 2) { onArrive?.(); return false; }
            const path = document.createElementNS(SVGNS, 'path');
            path.setAttribute('class', `deep-wave${beat ? ' is-beat' : ''}`);
            const glow = document.createElementNS(SVGNS, 'path');
            glow.setAttribute('class', `deep-wave-trail${beat ? ' is-beat' : ''}`);
            // the bolus of blood itself, a bright drop running ahead of the trail
            const drop = document.createElementNS(SVGNS, 'circle');
            drop.setAttribute('class', `deep-wave-drop${beat ? ' is-beat' : ''}`);
            drop.setAttribute('r', beat ? '7' : '5');
            marksHost.appendChild(glow);
            marksHost.appendChild(path);
            marksHost.appendChild(drop);
            waves.push({ ids: ids.slice(), path, glow, drop, beat, t0: performance.now(), ms: WAVE_MS * (beat ? 1 : 1.15), onArrive, arrived: false });
            this.step();
            return true;
        },
        get waves() { return waves.length; },
        get filling() { return fill ? { id: fill.id, k: fill.k, shown: +fill.shown.toFixed(3) } : null; },
    };
}

/* =============================================================================================
   deep-grow: THE BODY IN THE 3D VIEW. flesh.js on scene.js's plates, bridges, shaft and the machine
   house; hands.js on the machine's arm heads. See docs/mockups/deep-flesh-proto.html.
   ============================================================================================= */
function createBody(scene, graphOf) {
    const fl = {
        build: -1, body: new Set(), necrotic: new Set(), reach: new Set(), hover: '',
        meshes: new Set(), tendrils: new Map(), spine: false, vertebrae: new Set(), env: null,
        hands: null, handsOn: false, clickCb: null, hoverCb: null, rising: null, later: [], clock: 0,
        bone: null, listening: false, lone: new Set(),
        organs: new Map(), organMap: null, beat: null,      // deep-organs
    };
    const later = (sec, fn) => fl.later.push({ at: fl.clock + sec, fn });
    const parts = () => scene.fleshParts();
    const nodeOf = (id) => { const g = graphOf(); return g ? g.nodes.find((n) => n.id === id) || null : null; };
    const neighbours = (id) => {
        const g = graphOf();
        if (!g) return [];
        const out = [];
        for (const e of g.edges) {
            if (e.a === id) out.push({ to: e.b, kind: e.kind });
            else if (e.b === id) out.push({ to: e.a, kind: e.kind });
        }
        return out;
    };
    const plateOf = (P, id) => (id === 'machine' ? P.machinePlate : P.plates.get(id));
    const edgeKey = (a, b) => [a, b].sort().join('|');
    function env(P) {
        if (!fl.env) {
            fl.env = makeWetEnvironment(P.renderer);
            setFleshEnvironment(fl.env);
            fl.bone = new THREE.MeshPhysicalMaterial({ color: 0x77786f, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.35, envMap: fl.env, envMapIntensity: 0.6 });
        }
        return fl.env;
    }
    /** The point on `id`'s slab edge that faces `from`, at the top of the slab. */
    function edgePoint(P, id, from) {
        const m = plateOf(P, id), f = plateOf(P, from);
        const c = m.getWorldPosition(new THREE.Vector3());
        c.y += P.plateH / 2;
        if (!f) return c;
        const fc = f.getWorldPosition(new THREE.Vector3());
        if (Math.abs(fc.y - (c.y - P.plateH / 2)) > 0.1) return c;          // another floor: from the middle
        const d = fc.sub(c).setY(0);
        if (d.lengthSq() < 1e-6) return c;
        d.normalize();
        return c.addScaledVector(d, P.plateW / 2);
    }
    /** The body neighbour a chamber grew from: over a bridge first, then up the spine. */
    function grewFrom(id) {
        if (fl.lone.has(id)) return null;
        const ns = neighbours(id).filter((x) => fl.body.has(x.to) && !fl.lone.has(x.to));
        return (ns.find((x) => x.kind === 'bridge') || ns[0] || {}).to || null;
    }
    function turn(mesh, opts) {
        if (!mesh) return;
        fleshify(mesh, opts);
        fl.meshes.add(mesh);
    }
    function vertebrae(P, floor, instant) {
        if (fl.vertebrae.has(floor)) return;
        fl.vertebrae.add(floor);
        const top = P.floorY(floor - 1) - P.plateH / 2 - 0.05, bottom = P.floorY(floor) + P.plateH / 2;
        let seed = floor * 31 + 7;
        const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const n = 6;
        for (let i = 0; i < n; i++) {
            // uneven: never a coil spring. Each a little thicker or thinner, tilted, off the axis
            const y = top - (i + 0.35 + r() * 0.3) * (top - bottom) / n;
            const g = new THREE.TorusGeometry(P.shaftR + 0.02 + r() * 0.04, 0.04 + r() * 0.035, 7, 26);
            g.rotateX(Math.PI / 2);
            g.scale(1, 0.6 + r() * 0.6, 1);
            const m = new THREE.Mesh(g, fl.bone);
            m.position.set((r() - 0.5) * 0.06, y, (r() - 0.5) * 0.06);
            m.rotation.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3);
            m.userData.vertebra = true;
            P.world.add(m);
            if (instant) continue;
            m.scale.setScalar(0.001);
            later(0.3 + i * 0.3, () => { m.userData.grow = 0; });
        }
    }
    /** A chamber becomes body: its slab turns from the edge it grew in from, sinew over its bridges. */
    function takeInto(P, id, instant) {
        const n = nodeOf(id);
        if (!n) return;
        const from = grewFrom(id);
        const dur = instant ? 0.01 : FLESH_SECONDS;
        const seed = 20 + Math.abs([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 97;
        if (n.kind === 'machine') {
            turn(P.neck, { from: new THREE.Vector3(0, P.lidTop, 0), duration: instant ? 0.01 : 1.8, breathe: false, seed: 9 });
            const go = () => turn(P.machinePlate, { from: new THREE.Vector3(0, P.machY - P.plateH / 2, 0), duration: instant ? 0.01 : 2.4, bulge: 0.04, breathe: false, seed: 10 });
            if (instant) go(); else later(1.2, go);
            return;
        }
        const plate = P.plates.get(id);
        if (!plate) return;
        const top = plate.getWorldPosition(new THREE.Vector3()).setY(plate.position.y + P.plateH / 2);
        if (n.kind === 'hub' && n.floor === 0) {
            // the heart: the lid turns first, from its middle, and the rim and the bar with it
            turn(plate, { from: top.clone().setY(top.y + 0.1), duration: instant ? 0.01 : 2.6, swallow: P.cuts.get(id) || [], bulge: 0.05, seed: 3 });
            for (const m of P.extras.get(id) || []) turn(m, { from: top, duration: instant ? 0.01 : 2.2, breathe: false, seed: 4 });
            return;
        }
        if (n.kind === 'hub') {
            // the spine: the shaft turns from the top down, vertebra by vertebra, then the landing
            if (!fl.spine) { turn(P.shaft, { from: new THREE.Vector3(0, -0.05, 0), duration: instant ? 0.01 : 3.4, breathe: false, seed: 12 }); fl.spine = true; }
            vertebrae(P, n.floor, instant);
            const go = () => turn(plate, { from: top, duration: dur, swallow: P.cuts.get(id) || [], bulge: 0.05, seed: 13 });
            if (instant) go(); else later(2.4, go);
            return;
        }
        turn(plate, { from: from ? edgePoint(P, id, from) : top, duration: dur, swallow: P.cuts.get(id) || [], bulge: 0.06, seed });
        // every bridge to the body turns, the one it grew over first, with sinew across it
        if (fl.lone.has(id)) return;           // deep-grow2: a graft is joined to nothing
        for (const { to, kind } of neighbours(id)) {
            if (kind !== 'bridge' || !fl.body.has(to) || fl.lone.has(to)) continue;
            const b = P.bridges.get(edgeKey(id, to));
            if (!b) continue;
            const first = to === from;
            const o = first ? edgePoint(P, to, id) : b.getWorldPosition(new THREE.Vector3()).setY(b.position.y + P.plateH / 2);
            turn(b, { from: o, duration: instant ? 0.01 : (first ? 0.9 : 1.6), swallow: b.userData.lane ? [b.userData.lane] : [], bulge: 0.04, seed: seed + 1 });
            const toPlate = P.plates.get(to);
            if (!toPlate) continue;
            const grp = growTendrils(toPlate, plate, { count: first ? 4 : 2, duration: instant ? 0.01 : (first ? 1.4 : 2.0), parent: P.world, seed: seed * 13 + to.length });
            if (!fl.tendrils.has(id)) fl.tendrils.set(id, []);
            fl.tendrils.get(id).push(grp);
        }
    }
    function markNecrotic(P, id, on) {
        const m = plateOf(P, id);
        if (m) setNecrotic(m, on);
        for (const g of fl.tendrils.get(id) || []) setTendrilsNecrotic(g, on);
        for (const { to, kind } of neighbours(id)) {
            if (kind !== 'bridge' || !fl.body.has(to)) continue;
            const b = P.bridges.get(edgeKey(id, to));
            if (b) setNecrotic(b, on || fl.necrotic.has(to));
        }
    }
    function hint(P) {
        for (const id of fl.reach) {
            const m = plateOf(P, id);
            if (!m) continue;
            const from = grewFromReach(id);
            setReachable(m, fl.hover === id ? 1.5 : 0.9, { from: from ? edgePoint(P, id, from) : undefined });
        }
    }
    function grewFromReach(id) {
        const ns = neighbours(id).filter((x) => fl.body.has(x.to) && !fl.necrotic.has(x.to));
        return (ns.find((x) => x.kind === 'bridge') || ns[0] || {}).to || null;
    }
    function listen(P) {
        if (fl.listening) return;
        fl.listening = true;
        const el = P.renderer.domElement;
        let press = null;
        el.addEventListener('pointerdown', (e) => { press = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
        el.addEventListener('pointerup', (e) => {
            const p = press;
            press = null;
            if (!p || e.button !== 0 || !fl.clickCb) return;
            if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_PX || performance.now() - p.t > CLICK_MS) return;
            const id = scene.chamberAt(e.clientX, e.clientY);
            if (id) fl.clickCb(id);
        });
        el.addEventListener('pointermove', (e) => {
            const id = scene.chamberAt(e.clientX, e.clientY);
            if (id !== fl.hover) {
                fl.hover = id;
                if (fl.reach.size) hint(parts());
            }
            fl.hoverCb?.(id, e.clientX, e.clientY);
        });
        el.addEventListener('pointerleave', () => { fl.hover = ''; fl.hoverCb?.('', 0, 0); if (fl.reach.size) hint(parts()); });
    }
    return {
        setBody(ids, necrotic, reachable, lone) {
            if (!scene) return;
            fl.lone = new Set(lone || []);
            const P = parts();
            env(P);
            listen(P);
            let instant = false;
            if (P.build !== fl.build) {
                // the world was rebuilt: its meshes are new; let go of the old and lay the body on at once
                for (const m of fl.meshes) forget(m);
                fl.meshes.clear();
                forgetTendrils(null);
                fl.tendrils.clear();
                fl.vertebrae.clear();
                fl.spine = false;
                fl.body = new Set();
                fl.necrotic = new Set();
                fl.reach = new Set();
                instant = true;
                fl.build = P.build;
                // the machine house is not rebuilt with the world: it keeps its flesh
                if (fl.machineDone) { fl.body.add('machine'); fl.meshes.add(P.neck); fl.meshes.add(P.machinePlate); }
            }
            const want = new Set(ids || []);
            scene.setFleshCells([...want]);
            for (const id of want) {
                if (fl.body.has(id)) continue;
                fl.body.add(id);
                if (id === 'machine') fl.machineDone = true;
                takeInto(P, id, instant);
            }
            const dead = new Set(necrotic || []);
            for (const id of dead) if (!fl.necrotic.has(id)) { fl.necrotic.add(id); markNecrotic(P, id, true); }
            for (const id of [...fl.necrotic]) if (!dead.has(id)) { fl.necrotic.delete(id); markNecrotic(P, id, false); }
            const reach = new Set(reachable || []);
            for (const id of fl.reach) if (!reach.has(id)) { const m = plateOf(P, id); if (m) setReachable(m, 0); }
            fl.reach = reach;
            hint(P);
        },
        /** deep-organs: the organs on their plates (organ-art.js, laid flat on the slab), the take in progress growing in. */
        setOrgans(map, { taking = null, dead = [] } = {}) {
            if (!scene) return;
            const P = parts();
            fl.organMap = map ? { ...map } : null;
            const want = new Map();
            for (const [id, o] of Object.entries(fl.organMap || {})) if (fl.body.has(id) && P.plates.get(id)) want.set(id, { organ: o, k: 1 });
            if (taking && taking.organ && taking.organ !== 'hands' && P.plates.get(taking.id)) want.set(taking.id, { organ: taking.organ, k: Math.max(0.04, taking.k || 0) });
            for (const [id, rec] of fl.organs) {
                const w = want.get(id);
                if (!w || w.organ !== rec.organ || rec.build !== P.build) { rec.art.dispose(); fl.organs.delete(id); }
            }
            const deadSet = new Set(dead || []);
            for (const [id, w] of want) {
                let rec = fl.organs.get(id);
                if (!rec) {
                    const plate = P.plates.get(id);
                    const art = makeOrganArt(w.organ, { w: P.plateW * 0.82, h: P.plateW * 0.62, seed: id.length * 7 + (Number(id.slice(1)) || 0), env: env(P) });
                    art.group.rotation.x = -Math.PI / 2;
                    const c = plate.getWorldPosition(new THREE.Vector3());
                    art.group.position.set(c.x, c.y + P.plateH / 2 + 0.03, c.z);
                    art.group.rotation.z = Math.atan2(c.x, c.z);
                    P.world.add(art.group);
                    rec = { organ: w.organ, art, build: P.build };
                    fl.organs.set(id, rec);
                }
                rec.art.setGrow(w.k);
                rec.art.setNecrotic(deadSet.has(id));
            }
        },
        setBeat(phase) { fl.beat = Number.isFinite(phase) ? phase : null; },
        get organArt() { return [...fl.organs.entries()].map(([id, r]) => ({ id, organ: r.organ, grow: r.art.grow, necrotic: r.art.necrotic })); },
        onClick(cb) { fl.clickCb = cb; if (scene) listen(parts()); },
        onHover(cb) { fl.hoverCb = cb; if (scene) listen(parts()); },
        setHands(on, { instant = false } = {}) {
            if (!scene) return false;
            if (!on || fl.handsOn) return fl.handsOn;
            const P = parts();
            fl.handsOn = true;
            fl.hands = createHands({ envMap: env(P) });
            fl.hands.attach(P.armHeads);
            fl.hands.overgrow(instant ? 0.05 : OVERGROW_SECONDS);
            return true;
        },
        /**
         * The rise: thick sinew climbs out of the lid, up past the machine house and through the
         * crust, which breaks; the camera looks up at it. onDone after RISE_SECONDS.
         */
        rise(onDone) {
            if (!scene) { setTimeout(() => onDone?.(), 300); return; }
            const P = parts();
            env(P);
            scene.focusRise(2.6);
            const cols = [];
            const top = P.crustTop + 1.6;
            let seed = 4242;
            const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
            const N = 8;
            for (let i = 0; i < N; i++) {
                // sinew out of the lid, twisting round the neck and the machine house, splaying out
                // through the crust and thinning to a point: never a pipe
                const a = (i / N) * Math.PI * 2 + r() * 0.5;
                const rad = 0.3 + r() * 0.35;
                const reach = top + (r() - 0.3) * 1.4;
                const twist = (r() < 0.5 ? -1 : 1) * (1 + r() * 1.2);
                const pts = [];
                for (let k = 0; k <= 10; k++) {
                    const t = k / 10;
                    const y = P.lidTop - 0.1 + (reach - P.lidTop) * t;
                    const out = t > 0.72 ? Math.pow((t - 0.72) / 0.28, 1.6) * (1.2 + r() * 1.4) : 0;
                    const rr = rad * (0.7 + 0.5 * Math.sin(t * 5 + i * 1.7)) + out;
                    pts.push(new THREE.Vector3(Math.cos(a + t * twist) * rr, y, Math.sin(a + t * twist) * rr));
                }
                const curve = new THREE.CatmullRomCurve3(pts);
                const thick = 0.1 + r() * 0.14;
                const segs = 80, radial = 12;
                const geo = new THREE.TubeGeometry(curve, segs, thick, radial, false);
                const pos = geo.attributes.position;
                const c = new THREE.Vector3(), v = new THREE.Vector3();
                for (let j = 0; j <= segs; j++) {
                    curve.getPointAt(j / segs, c);
                    const t = j / segs;
                    const k = Math.max(0.04, (1 - 0.92 * Math.pow(t, 1.3)) * (0.85 + 0.25 * Math.sin(t * 23 + i * 2)) * (t < 0.06 ? 1.4 - t * 6 : 1));
                    for (let q = 0; q <= radial; q++) {
                        const idx = j * (radial + 1) + q;
                        v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
                        pos.setXYZ(idx, v.x, v.y, v.z);
                    }
                }
                geo.computeVertexNormals();
                const mat = makeFleshMaterial({ mode: 'uv', uvScale: [7, 0.8], seed: 70 + i * 13, envMap: fl.env, pulse: 1.3, sinew: 0.55, tint: 1.5 });
                const m = new THREE.Mesh(geo, mat);
                geo.setDrawRange(0, 0);
                P.above.add(m);
                cols.push({ m, total: geo.index.count, ring: radial * 6, segs, delay: i * 0.12 + r() * 0.2 });
            }
            fl.rising = { t: 0, t0: performance.now(), cols, broke: false, shards: [], P, onDone };
            // a wall clock behind it, so a slow frame rate (or a hidden tab) still ends it on time
            setTimeout(() => { if (fl.rising && fl.rising.onDone) { const f = fl.rising.onDone; fl.rising.onDone = null; f(); } }, RISE_SECONDS * 1000 + 600);
        },
        step(dt, throws = 0) {
            dt = Math.max(0, Number(dt) || 0);
            fl.clock += dt;
            for (let i = fl.later.length - 1; i >= 0; i--) if (fl.later[i].at <= fl.clock) { const f = fl.later[i].fn; fl.later.splice(i, 1); f(); }
            stepFlesh(dt);
            for (const rec of fl.organs.values()) rec.art.step(dt, fl.beat);
            if (scene) {
                const P = parts();
                P.world.traverse((o) => {
                    if (!o.userData || !o.userData.vertebra || !(o.userData.grow >= 0) || o.userData.grow >= 1) return;
                    o.userData.grow = Math.min(1, o.userData.grow + dt / 0.6);
                    const e = 1 - Math.pow(1 - o.userData.grow, 3);
                    o.scale.set(Math.max(0.001, e), Math.max(0.001, 0.7 * e), Math.max(0.001, e));
                });
                if (fl.hands) { fl.hands.sync(P.machineGc()); fl.hands.step(dt, throws); }
            }
            const R = fl.rising;
            if (R) {
                R.t = Math.max(R.t + dt, (performance.now() - R.t0) / 1000);
                for (const c of R.cols) {
                    const k = Math.max(0, Math.min(1, (R.t - 0.4 - c.delay) / 3.0));
                    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
                    c.m.geometry.setDrawRange(0, Math.min(c.total, Math.ceil(e * c.segs) * c.ring));
                }
                if (!R.broke && R.t > 2.6) {
                    R.broke = true;
                    // the crust breaks: the slab goes, its pieces are thrown up and out
                    const crust = R.P.crust;
                    crust.visible = false;
                    const box = new THREE.Box3().setFromObject(crust);
                    for (let i = 0; i < 16; i++) {
                        const w = 0.3 + Math.random() * 0.7, d = 0.3 + Math.random() * 0.7;
                        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), crust.material);
                        m.position.set(box.min.x + Math.random() * (box.max.x - box.min.x), box.max.y - 0.15, box.min.z + Math.random() * (box.max.z - box.min.z));
                        const out = m.position.clone().setY(0).normalize();
                        R.P.above.add(m);
                        R.shards.push({ m, v: new THREE.Vector3(out.x * (1 + Math.random() * 2), 3 + Math.random() * 3, out.z * (1 + Math.random() * 2)), w: new THREE.Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3) });
                    }
                }
                for (const sh of R.shards) {
                    sh.v.y -= 6 * dt;
                    sh.m.position.addScaledVector(sh.v, dt);
                    sh.m.rotation.x += sh.w.x * dt; sh.m.rotation.y += sh.w.y * dt; sh.m.rotation.z += sh.w.z * dt;
                }
                if (R.t >= RISE_SECONDS && R.onDone) { const f = R.onDone; R.onDone = null; f(); }
            }
        },
        get stats() {
            return {
                body: fl.body.size, necrotic: fl.necrotic.size, reach: fl.reach.size, hands: fl.handsOn,
                handsGrow: fl.hands ? fl.hands.stats.grow : -1, rising: fl.rising ? +fl.rising.t.toFixed(2) : -1,
                broke: !!(fl.rising && fl.rising.broke), meshes: fl.meshes.size, spine: fl.spine,
            };
        },
    };
}
/** The hands take this long to grow out of the tubes (hands.js), for the first throw's sound. */
export const HANDS_SECONDS = OVERGROW_SECONDS;
