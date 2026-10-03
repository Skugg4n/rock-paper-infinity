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
 * The room ring itself is drawn here, in the DOM, over whatever view is below it. The 3D
 * implementation calls into scene.js, flesh.js and hands.js.
 */

import * as THREE from 'three';
import { ROOM_ICON } from './scene.js';
import { signHtml } from './readout.js';
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
export function createViewHooks(scene, { ringHost, isEmpty, onIcons, graph = () => null }) {
    let ring = null;            // { slot, pick }
    const shown = { lamp: false, figure: false, breathe: false };
    const body = createBody(scene, graph);

    function closeRoomRing() {
        if (!ring) return;
        ring = null;
        ringHost.classList.remove('is-open');
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
            ringHost.innerHTML = '<span class="deep-ring-hub"><span class="dymo is-small deep-ring-say"></span></span>';
            const say = ringHost.querySelector('.deep-ring-say');
            say.hidden = true;
            ROOM_ORDER.forEach((t, i) => {
                const r = rooms[t];
                const a = -Math.PI / 2 + i * Math.PI / 2 - Math.PI / 4;
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `deep-ring-room${r.ok ? ' is-ok' : ''}`;
                b.dataset.room = t;
                b.style.left = `${(RING_R * Math.cos(a)).toFixed(1)}px`;
                b.style.top = `${(RING_R * Math.sin(a)).toFixed(1)}px`;
                b.innerHTML = `<i data-lucide="${ROOM_ICON[t]}" class="w-6 h-6"></i><span class="deep-ring-price deep-mono">${signHtml(r.price)}</span>`;
                b.addEventListener('pointerenter', () => { say.innerHTML = signHtml(r.ok ? ROOM_NAME[t] : r.need); say.hidden = false; });
                b.addEventListener('pointerleave', () => { say.hidden = true; });
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
        setBody: (ids, necrotic, reachable) => body.setBody(ids, necrotic, reachable),
        onChamberClick: (cb) => body.onClick(cb),
        onChamberHover: (cb) => body.onHover(cb),
        setHands: (on, o) => body.setHands(on, o),
        rise: (onDone) => body.rise(onDone),
        step: (dt, throws) => body.step(dt, throws),
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
   deep-grow: THE BODY IN THE 3D VIEW. flesh.js on scene.js's plates, bridges, shaft and the machine
   house; hands.js on the machine's arm heads. See docs/mockups/deep-flesh-proto.html.
   ============================================================================================= */
function createBody(scene, graphOf) {
    const fl = {
        build: -1, body: new Set(), necrotic: new Set(), reach: new Set(), hover: '',
        meshes: new Set(), tendrils: new Map(), spine: false, vertebrae: new Set(), env: null,
        hands: null, handsOn: false, clickCb: null, hoverCb: null, rising: null, later: [], clock: 0,
        bone: null, listening: false,
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
        const ns = neighbours(id).filter((x) => fl.body.has(x.to));
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
        for (const { to, kind } of neighbours(id)) {
            if (kind !== 'bridge' || !fl.body.has(to)) continue;
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
        setBody(ids, necrotic, reachable) {
            if (!scene) return;
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
