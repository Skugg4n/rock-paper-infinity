/**
 * Chapter IV · THE DEEP, movement III · GROW (deep-organs): WHAT EACH ORGAN LOOKS LIKE, in the locked
 * flesh style (flesh.js: mycelium, sinew, vessels, one arterial red; no mushrooms, no sacs, no eyes, no
 * mirror symmetry, no beige). Both views use it: the strata view stands each organ in its chamber's
 * section, the 3D view lays it on the plate. Small and readable at the strata view's chamber size
 * (about 55 by 40 pixels), so each organ has ONE thing the eye catches:
 *
 *   VAT    curled pale figures in dark hollows (the people it grows), breathing
 *   GUT    one coiled tube of wet flesh, folded back on itself
 *   HEART  a lopsided chambered muscle that beats on the heartbeat, vessels out of it
 *   NERVE  pale branching fibres, a few of them flickering
 *
 * makeOrganArt(organ, { w, h, seed, env }) gives { group, step(dt, beat), setNecrotic(on), setGrow(k),
 * dispose() }. The group is in a local XY plane, centred, facing +z, w by h world units. `beat` is the
 * heartbeat's phase (0 on the thump). setGrow(k) 0 to 1: a take in progress grows the organ in.
 */

import * as THREE from 'three';
import { makeFleshMaterial, FLESH_COLOURS } from './flesh.js';

/** The pale of the figures and the fibres (flesh.js hyphae, a little warmer for the figures). */
const PALE = 0xc9ccc5;
const FIBRE = FLESH_COLOURS.hyphae;
const ASH = FLESH_COLOURS.ash;
const VESSEL = 0x6a1020;

function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A tube along points, thinning to its ends (flesh.js style). */
function tube(points, radius, { radial = 7, segs = 48, taper = 0.35 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
    const pos = geo.attributes.position;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let j = 0; j <= segs; j++) {
        curve.getPointAt(j / segs, c);
        const t = j / segs;
        const k = Math.max(0.15, 1 - taper * Math.pow(Math.abs(2 * t - 1), 3));
        for (let q = 0; q <= radial; q++) {
            const i = j * (radial + 1) + q;
            v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(k).add(c);
            pos.setXYZ(i, v.x, v.y, v.z);
        }
    }
    geo.computeVertexNormals();
    return { geo, len: curve.getLength() };
}

/**
 * A curled figure, seen from the side: a bean of a body bent round on itself, the head tucked at one
 * end, the knees drawn up under it. Never symmetric. Returns the shapes to fill (body, head, knees).
 */
function curlShape(r, rand) {
    const body = new THREE.Shape();
    // the back: a long arc; the belly: a shorter, tighter one inside it
    const n = 18;
    const a0 = -0.2 + rand() * 0.15, a1 = Math.PI * 1.25 + rand() * 0.15;
    const back = [], belly = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = a0 + (a1 - a0) * t;
        const th = r * (0.34 + 0.22 * Math.sin(Math.PI * t));            // thickest at the middle of the back
        back.push([Math.cos(a) * r, Math.sin(a) * r * 0.86]);
        belly.push([Math.cos(a) * (r - th), Math.sin(a) * (r - th) * 0.86]);
    }
    body.moveTo(back[0][0], back[0][1]);
    for (const p of back.slice(1)) body.lineTo(p[0], p[1]);
    for (const p of belly.reverse()) body.lineTo(p[0], p[1]);
    body.closePath();
    // the head at the start of the curl, bowed in toward the knees
    const ha = a0 - 0.35;
    const head = new THREE.Shape();
    head.absellipse(Math.cos(ha) * r * 0.78, Math.sin(ha) * r * 0.7, r * 0.42, r * 0.38, 0, Math.PI * 2, false, rand() * 0.6);
    // the knees, drawn up into the middle
    const knee = new THREE.Shape();
    const ka = a1 - 0.5;
    knee.absellipse(Math.cos(ka) * r * 0.35, Math.sin(ka) * r * 0.3, r * 0.3, r * 0.2, 0, Math.PI * 2, false, ka);
    return [body, head, knee];
}

/** A lopsided blob: the outline of a hollow or a muscle, by noisy radius. */
function blobShape(rx, ry, rand, lumps = 3) {
    const s = new THREE.Shape();
    const ph = [rand() * 6, rand() * 6, rand() * 6];
    const n = 40;
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const k = 1 + 0.12 * Math.sin(a * lumps + ph[0]) + 0.07 * Math.sin(a * (lumps + 2) + ph[1]) + 0.05 * Math.cos(a * 2 + ph[2]);
        const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    return s;
}

/**
 * @param {'vat'|'gut'|'heart'|'nerve'} organ
 * @param {{w:number, h:number, seed?:number, env?:THREE.Texture}} o
 */
export function makeOrganArt(organ, { w = 1.6, h = 1.0, seed = 1, env = null } = {}) {
    const rand = rng(seed * 97 + organ.length * 13);
    const group = new THREE.Group();
    group.name = `organ-${organ}`;
    const inner = new THREE.Group();          // what grows in and beats
    group.add(inner);
    const fleshMats = [];
    const paleMats = [];
    const flick = [];
    const flesh = (opts) => { const m = makeFleshMaterial({ envMap: env, envMapIntensity: 0.35, ...opts }); fleshMats.push(m); return m; };
    const pale = (color, opacity) => {
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
        m.userData.base = { color, opacity };
        paleMats.push(m);
        return m;
    };
    let breathe = 0;

    if (organ === 'vat') {
        // two hollows, dark, each with a pale curled figure
        const n = 2;
        for (let i = 0; i < n; i++) {
            const cx = (-0.5 + (i + 0.5) / n) * w * 0.86 + (rand() - 0.5) * w * 0.05;
            const cy = (rand() - 0.5) * h * 0.12;
            const rx = w / n * 0.42, ry = h * (0.36 + rand() * 0.06);
            const hollow = new THREE.Mesh(new THREE.ShapeGeometry(blobShape(rx, ry, rand, 3), 24), flesh({ mode: 'uv', uvScale: [2, 2], seed: seed + i * 7, pulse: 0.5, sinew: 0.1, tint: 0.7 }));
            hollow.position.set(cx, cy, 0);
            inner.add(hollow);
            const r = Math.min(rx, ry) * 0.8;
            const fig = new THREE.Group();
            const mat = pale(PALE, 0.86);
            for (const sh of curlShape(r, rand)) fig.add(new THREE.Mesh(new THREE.ShapeGeometry(sh, 10), mat));
            fig.position.set(cx, cy, 0.02);
            fig.rotation.z = (i ? 0.9 : -0.5) + rand() * 0.6;
            if (rand() < 0.5) fig.scale.x = -1;
            inner.add(fig);
        }
        breathe = 1;
    } else if (organ === 'gut') {
        // one tube, folded back and forth, its loops never quite even
        const pts = [];
        const rows = 3;
        for (let r = 0; r < rows; r++) {
            const y = h * (0.32 - 0.64 * r / (rows - 1)) + (rand() - 0.5) * h * 0.06;
            const dir = r % 2 ? -1 : 1;
            for (let k = 0; k <= 5; k++) {
                const x = dir * w * (-0.4 + 0.8 * k / 5) + (rand() - 0.5) * w * 0.04;
                pts.push(new THREE.Vector3(x, y + Math.sin(k * 1.7 + r) * h * 0.05, (rand() - 0.5) * 0.04));
            }
        }
        const t = tube(pts, h * 0.12, { segs: 90, radial: 8, taper: 0.5 });
        inner.add(new THREE.Mesh(t.geo, flesh({ mode: 'uv', uvScale: [t.len * 2.4, 0.6], seed, pulse: 1.1, sinew: 0.45, tint: 2.2 })));
        // a vessel along it
        const vp = pts.filter((_, i) => i % 2 === 0).map((p) => p.clone().add(new THREE.Vector3(0, h * 0.06, 0.06)));
        const vt = tube(vp, h * 0.022, { segs: 60, radial: 5 });
        inner.add(new THREE.Mesh(vt.geo, pale(VESSEL, 0.9)));
    } else if (organ === 'heart') {
        // a lopsided chambered muscle, its vessels out to the walls: THE red of the body (flesh.js
        // PULSE_RED), so it reads at the strata view's size; a darker chamber in it, a paler lobe
        const muscle = pale(0x7d1222, 0.96);
        const body = new THREE.Mesh(new THREE.ShapeGeometry(blobShape(w * 0.24, h * 0.37, rand, 2), 30), muscle);
        body.position.set(-w * 0.04, -h * 0.02, 0.02);
        body.rotation.z = -0.35 + rand() * 0.2;
        inner.add(body);
        const wall = new THREE.Mesh(new THREE.ShapeGeometry(blobShape(w * 0.16, h * 0.24, rand, 3), 24), flesh({ mode: 'uv', uvScale: [1.4, 1.8], seed, pulse: 2.2, sinew: 0.75, tint: 1.6 }));
        wall.position.set(-w * 0.07, -h * 0.06, 0.03);
        wall.rotation.z = -0.5;
        inner.add(wall);
        const lobe = new THREE.Mesh(new THREE.ShapeGeometry(blobShape(w * 0.13, h * 0.19, rand, 3), 20), pale(0xb8263a, 0.95));
        lobe.position.set(w * 0.13, h * 0.17, 0.04);
        inner.add(lobe);
        const ends = [[-0.5, 0.3], [0.5, -0.1], [-0.42, -0.42], [0.3, 0.48], [0.46, 0.3]];
        for (const [ex, ey] of ends) {
            const a = new THREE.Vector3(0, 0, 0.01);
            const b = new THREE.Vector3(ex * w, ey * h, 0.01);
            const m = a.clone().lerp(b, 0.5).add(new THREE.Vector3((rand() - 0.5) * w * 0.12, (rand() - 0.5) * h * 0.2, 0));
            const vt = tube([a, m, b], h * 0.04, { segs: 24, radial: 5, taper: 0.7 });
            inner.add(new THREE.Mesh(vt.geo, pale(VESSEL, 0.95)));
        }
    } else {
        // nerve fibres: branching pale walks from a root, a few groups that flicker
        const groups = 3;
        for (let g = 0; g < groups; g++) {
            const pos = [];
            const roots = 2;
            for (let r = 0; r < roots; r++) {
                const x = -w * 0.46 + rand() * w * 0.1, y = (rand() - 0.5) * h * 0.6, a = (rand() - 0.5) * 0.6;
                const walk = (x0, y0, a0, steps, depth) => {
                    let px = x0, py = y0, pa = a0;
                    for (let i = 0; i < steps; i++) {
                        pa += (rand() - 0.5) * 0.7;
                        const nx = px + Math.cos(pa) * w * 0.06, ny = Math.max(-h * 0.45, Math.min(h * 0.45, py + Math.sin(pa) * w * 0.06));
                        if (nx > w * 0.48) break;
                        pos.push(px, py, 0.03, nx, ny, 0.03);
                        if (depth < 2 && rand() < 0.22) walk(nx, ny, pa + (rand() < 0.5 ? -0.8 : 0.8), Math.floor(steps * 0.5), depth + 1);
                        px = nx; py = ny;
                    }
                };
                walk(x, y, a, 16, 0);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            const m = new THREE.LineBasicMaterial({ color: FIBRE, transparent: true, opacity: 0.5, depthWrite: false });
            m.userData.base = { color: FIBRE, opacity: 0.5 };
            paleMats.push(m);
            const line = new THREE.LineSegments(geo, m);
            inner.add(line);
            flick.push({ m, t: rand() * 3, next: 0.4 + rand() * 1.6 });
        }
        // a sheath of tissue where they meet
        const knot = new THREE.Mesh(new THREE.ShapeGeometry(blobShape(w * 0.08, h * 0.16, rand, 3), 16), flesh({ mode: 'uv', uvScale: [1, 1], seed, pulse: 0.8, sinew: 0.8, tint: 2 }));
        knot.position.set(-w * 0.42, 0, 0.04);
        inner.add(knot);
    }

    let necro = false, grow = 1, clock = rand() * 10;
    const apply = () => inner.scale.setScalar(0.12 + 0.88 * grow);
    apply();
    return {
        group,
        organ,
        /** One frame. `beat`: the heartbeat's phase (0 on the thump, toward 1 before the next). */
        step(dt, beat = null) {
            clock += dt;
            const s = 0.12 + 0.88 * grow;
            if (necro) { inner.scale.setScalar(s); return; }
            if (organ === 'heart') {
                const ph = Number.isFinite(beat) ? beat : (clock % 1);
                const k = 1 + 0.13 * Math.exp(-ph * 9) + 0.07 * Math.exp(-Math.max(0, ph - 0.2) * 10) * (ph > 0.2 ? 1 : 0);
                inner.scale.set(s * k, s * (1 + (k - 1) * 0.8), s);
            } else if (breathe) {
                inner.scale.setScalar(s * (1 + 0.025 * Math.sin(clock * 1.4)));
            } else inner.scale.setScalar(s);
            for (const f of flick) {
                f.t += dt;
                if (f.t > f.next) { f.t = 0; f.next = 0.25 + Math.random() * 2.2; f.m.opacity = 1; }
                else f.m.opacity += (f.m.userData.base.opacity - f.m.opacity) * Math.min(1, dt * 6);
            }
        },
        /** Dead flesh: grey, still. */
        setNecrotic(on) {
            necro = !!on;
            for (const m of fleshMats) m.userData.flesh.uNecro.value = necro ? 1 : 0;
            for (const m of paleMats) { m.color.setHex(necro ? ASH : m.userData.base.color); m.opacity = necro ? 0.35 : m.userData.base.opacity; }
        },
        /** A take in progress grows the organ in, k from 0 to 1. */
        setGrow(k) { grow = Math.max(0, Math.min(1, Number(k) || 0)); apply(); },
        get grow() { return grow; },
        get necrotic() { return necro; },
        dispose() {
            group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
            for (const m of [...fleshMats, ...paleMats]) m.dispose();
            group.removeFromParent();
        },
    };
}

/**
 * The organs as small glyphs for the ring and the tape (inline SVG, currentColor): the same one thing
 * each organ's picture shows. 24 by 24.
 */
export const ORGAN_GLYPH = {
    vat: '<path d="M4.5 12c0-4.4 3.4-7.6 7.7-7.6 4.6 0 7.6 3.3 7.6 7.4 0 4.5-3.4 7.7-7.8 7.7C7.6 19.5 4.5 16.4 4.5 12z" opacity="0.45"/>'
        + '<path d="M10.2 8.4a2.1 2.1 0 1 1-.1 0zM9.5 11.2c-1.9 1.6-1.7 4.5.6 5.6 2.2 1 4.8-.1 5.3-2.4.3-1.4-.6-2.5-1.8-2.6"/>',
    gut: '<path d="M4 7.5c3-1.8 6.5 1.6 9.6-.2 2.2-1.3 4.6-.6 6 1.2M20 11.6c-3 1.7-6.4-1.5-9.6.3-2 1.1-4.3.5-6-.9M4.2 15.8c2.8-1.6 6.3 1.6 9.4-.2 2.3-1.3 4.7-.5 6.2 1.4"/>'
        + '<path d="M19.6 8.5c1.4 1 1.5 2.4.4 3.1M4.4 11.9c-1.3.9-1.4 2.5-.2 3.9"/>',
    heart: '<path d="M8.6 6.3c2.7-1.6 6.6-.6 7.8 2.4 1.1 2.9-.4 6.6-3.4 8.4-2.6 1.6-5.5 1-6.6-1.6-1.2-2.8-.8-7.4 2.2-9.2z"/>'
        + '<path d="M14.6 6.6c1.6-1.8 3.4-2.5 5.2-2.1M16.7 12.4c1.7.4 2.9 1.6 3.4 3.2M7.2 14.6c-1.6.8-2.7 2.3-2.9 4.1M8.9 6.6C8 5.1 6.4 4.1 4.6 4"/>',
    nerve: '<path d="M3.5 13c3-.4 4.9-2.6 7.4-2.8 2.2-.2 3.3 1.3 5.6.6 1.6-.5 2.4-2.1 4-2.6M10.9 10.2c.4-2.2 1.9-3.9 3.6-5M11.6 10.3c1.4 2.2 1.2 5 2.9 7.4M16.5 10.8c1.1 1.7 2.8 2.6 4.4 2.7M7.2 12.1c-.8 1.9-.6 3.9.6 5.7"/>',
    hands: '<path d="M8 13V6.2a1.4 1.4 0 0 1 2.8 0V12M10.8 11V4.8a1.4 1.4 0 0 1 2.8 0V11.4M13.6 11.2V6a1.4 1.4 0 0 1 2.8 0v7.4"/>'
        + '<path d="M16.4 10.4a1.4 1.4 0 0 1 2.8 0V14c0 3.6-2.6 6.4-6.2 6.4h-1c-2.2 0-3.6-1-4.9-2.6l-2.5-3.3a1.5 1.5 0 0 1 2.2-2L8 13.6"/>',
};
/** An organ's glyph as an inline SVG element string. */
export function organGlyph(organ, cls = '') {
    return `<svg class="deep-organ-glyph ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" `
        + `stroke-linecap="round" stroke-linejoin="round" aria-label="${organ}" role="img">${ORGAN_GLYPH[organ] || ''}</svg>`;
}
