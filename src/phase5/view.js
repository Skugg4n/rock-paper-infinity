/**
 * Chapter V · UNITY: the map, top-down, on a 2D canvas. Draws what the rules say; owns no state of
 * the game. The ground of each scale (the ruined city as blocks, streets and the river; fields,
 * poison, granite, sea, ice further out), the storm as dark bands with rain, the body as the vault's
 * flesh (muscle fibre, vessels with the pulse running out to the edge, the edge glowing where it
 * eats) and the organs on it as what they are: eyes that open and turn, brain folds with light,
 * intestines winding, nails as hard plates at the edge. Colours only from VT.
 *
 * PERFORMANCE (the owner's machine is slow): the ground is drawn once per scale and size; the body
 * (its tissue, membrane and vessels) is redrawn into its own layer only when it has grown, at most
 * four times a second; the storm is a 64 x 40 field redrawn every 150 ms and scaled up soft.
 * Per frame: three images, the edge's light, the pulses, the organs' small motion, effects.
 */
import { MAP_W, MAP_H, CELLS, cx, cy, neighbours, mapFor, stormAt, ROCK, PAPER, SCISSORS, POISON, GRANITE, SEA, COLD, RIVER, DEEP } from './terrain.js';
import { cache, front, share, mapTime } from './unity.js';
import { VT } from './style.js';
import { createGlobe, latOf, lonOf } from './globe.js';

const BEAT = 1.7;
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function rng(seed) {
    let a = (Math.floor(seed * 2654435761) >>> 0) || 1;
    return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
}
function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
/** The heartbeat: a sharp rise and a slow fall every BEAT seconds. */
export function beat(t) { const p = (t % BEAT) / BEAT; return p < 0.08 ? p / 0.08 : Math.exp(-(p - 0.08) * 6); }

export function createUnityView(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let geo = null;               // { x, y, cs, w, h }
    let ground = null;            // { key, c }
    let body = null;              // { key, c, vessels, edge, organs, centre, at }
    let tissue = null;            // the pattern
    let storm = null;             // { c, g, img, at }
    let zoom = null;              // { t0, ms, snap, from: {x,y}, resolve }
    let fog = null;               // { key, at, c }
    let globe = null;             // the planet (fas 3), made when it is first needed
    let ending = null;            // WE LOOK UP: { t0, ms, resolve }
    const cost = { body: 0 };     // ms a body redraw takes (smoothed)
    let bodyGap = 250;
    const effects = [];
    const pointer = { x: -1, y: -1 };
    const view = { busy: false };

    function offscreen(w, h, scale = dpr) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(w * scale)); c.height = Math.max(1, Math.ceil(h * scale));
        const g = c.getContext('2d');
        g.setTransform(scale, 0, 0, scale, 0, 0);
        return { c, g };
    }

    function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = canvas.getBoundingClientRect();
        W = Math.max(320, r.width); H = Math.max(320, r.height);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const left = opts.insetLeft ? opts.insetLeft() : 332, bottom = opts.insetBottom ? opts.insetBottom() : 120;
        const aw = W - left - 16, ah = H - 16 - bottom;
        const cs = Math.max(4, Math.min(aw / MAP_W, ah / MAP_H));
        const w = cs * MAP_W, h = cs * MAP_H;
        geo = { x: Math.round(left + (aw - w) / 2), y: Math.round(16 + (ah - h) / 2), cs, w, h };
        ground = null; body = null; fog = null;
    }

    const centre = (i) => [geo.x + (cx(i) + 0.5) * geo.cs, geo.y + (cy(i) + 0.5) * geo.cs];
    function cellAt(px, py) {
        if (!geo) return -1;
        const x = Math.floor((px - geo.x) / geo.cs), y = Math.floor((py - geo.y) / geo.cs);
        return x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? -1 : y * MAP_W + x;
    }

    // ---------------------------------------------------------------- the ground
    /** Colour of a cell of land, as [r, g, b] (blended soft into fields; the house palette). */
    function landColour(m, i) {
        const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
        const mix = (a, b, u) => a.map((v, k) => Math.round(v + (b[k] - v) * u));
        const base = hex('#0d1013');
        const ob = m.obst[i], k = m.cls[i], nz = m.noise[i];
        if (ob === SEA) return mix(hex('#06101a'), hex('#0a1824'), nz);
        if (ob === COLD) return mix(base, hex(VT.plate), 0.3 + nz * 0.1);
        if (ob === DEEP || ob === RIVER) return hex('#0a1722');
        if (ob === POISON) return mix(hex(VT.fBruise), hex(VT.life), 0.12 + nz * 0.1);
        if (ob === GRANITE) return mix(hex(VT.slate), hex(VT.mist), 0.12 + nz * 0.12);
        if (k === PAPER) return mix(base, hex(VT.life), 0.16 + nz * 0.12);
        if (k === ROCK) return mix(base, hex(VT.slate), 0.55 + nz * 0.15);
        return mix(base, hex(VT.steel3), 0.8);
    }
    /**
     * The land (county and out): soft fields (the cells as one pixel each, scaled up smooth and blurred), then the
     * fine detail on top: rivers as winding lines, roads between the ruins, the ruins as small dark blocks with a
     * lamp here and there, hatching on the granite, spots in the poison. Drawn once per scale and size.
     */
    function paintLand(s) {
        const m = mapFor(s.seed, s.scale);
        const o = offscreen(geo.w, geo.h);
        const g = o.g, cs = geo.cs;
        const R = rng(s.scale * 31 + 5);
        const px = document.createElement('canvas'); px.width = MAP_W; px.height = MAP_H;
        const pg = px.getContext('2d');
        const img = pg.createImageData ? pg.createImageData(MAP_W, MAP_H) : null;
        if (img && img.data) {
            for (let i = 0; i < CELLS; i++) { const c = landColour(m, i); img.data.set([c[0], c[1], c[2], 255], i * 4); }
            pg.putImageData(img, 0, 0);
        }
        g.fillStyle = '#0d1013'; g.fillRect(0, 0, geo.w, geo.h);
        g.imageSmoothingEnabled = true;
        g.save();
        g.filter = `blur(${Math.max(1, cs * 0.45)}px)`;
        g.drawImage(px, -cs * 0.5, -cs * 0.5, geo.w + cs, geo.h + cs);
        g.restore();
        // granite: fine hatching; poison: spots
        for (let i = 0; i < CELLS; i++) {
            const x = cx(i) * cs, y = cy(i) * cs, ob = m.obst[i];
            if (ob === GRANITE && R() < 0.7) {
                g.strokeStyle = rgba(VT.mist, 0.14); g.lineWidth = 0.6;
                g.beginPath(); g.moveTo(x + R() * cs * 0.3, y + cs * 0.8); g.lineTo(x + cs * (0.5 + R() * 0.4), y + cs * 0.2); g.stroke();
            } else if (ob === POISON && R() < 0.5) {
                g.fillStyle = rgba(VT.life, 0.22); g.beginPath(); g.arc(x + R() * cs, y + R() * cs, cs * 0.08, 0, Math.PI * 2); g.fill();
            } else if (!ob && m.cls[i] === SCISSORS) {
                // ruins: a few dark blocks, one lamp in many
                for (let q = 0; q < 2; q++) { g.fillStyle = rgba(VT.ink, 0.55); g.fillRect(x + R() * cs * 0.7, y + R() * cs * 0.7, cs * 0.22, cs * 0.18); }
                if (R() < 0.25) { g.fillStyle = rgba(VT.lamp, 0.6); g.fillRect(x + R() * cs, y + R() * cs, 1.3, 1.3); }
            }
        }
        // rivers: a winding line through the river cells, row by row
        const rivers = [];
        for (let i = 0; i < CELLS; i++) if (m.obst[i] === DEEP || m.obst[i] === RIVER) rivers.push(i);
        if (rivers.length) {
            const byRow = new Map();
            for (const i of rivers) { const y = cy(i); byRow.set(y, (byRow.get(y) || []).concat(cx(i))); }
            const pts = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([y, xs]) => [(xs.reduce((a, b) => a + b, 0) / xs.length + 0.5) * cs, (y + 0.5) * cs]);
            for (const [w, c] of [[cs * 1.6, 'rgba(6,14,22,0.9)'], [cs * 0.7, rgba(VT.cold, 0.16)], [1, rgba(VT.cold, 0.3)]]) {
                g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
                g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
                for (let k = 1; k < pts.length - 1; k++) g.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
                g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
                g.stroke();
            }
        }
        // roads: thin old lines from ruin to ruin
        const towns = [];
        for (let i = 0; i < CELLS; i++) if (!m.obst[i] && m.cls[i] === SCISSORS && R() < 0.08) towns.push(i);
        g.strokeStyle = rgba(VT.mist, 0.13); g.lineWidth = 0.8; g.setLineDash([3, 2]);
        for (let k = 0; k + 1 < towns.length; k += 1) {
            const a = towns[k], b = towns[(k + 3) % towns.length];
            if (Math.hypot(cx(a) - cx(b), cy(a) - cy(b)) > 14) continue;
            g.beginPath(); g.moveTo((cx(a) + 0.5) * cs, (cy(a) + 0.5) * cs);
            g.quadraticCurveTo((cx(a) + 0.5) * cs + (R() - 0.5) * cs * 3, (cy(b) + 0.5) * cs, (cx(b) + 0.5) * cs, (cy(b) + 0.5) * cs); g.stroke();
        }
        g.setLineDash([]);
        g.strokeStyle = rgba(VT.mist, 0.12); g.lineWidth = 1; g.strokeRect(0.5, 0.5, geo.w - 1, geo.h - 1);
        // where the sea shimmers (per frame)
        const sea = [];
        for (let i = 0; i < CELLS; i++) if (m.obst[i] === SEA && R() < 0.35) sea.push(i);
        o.c.sea = sea;
        return o.c;
    }

    function paintGround(s) {
        if (s.scale >= 1) return paintLand(s);
        const m = mapFor(s.seed, s.scale);
        const o = offscreen(geo.w, geo.h);
        const g = o.g, cs = geo.cs;
        const R = rng(s.scale * 31 + 5);
        g.fillStyle = s.scale === 0 ? VT.stone : '#0d1013';
        g.fillRect(0, 0, geo.w, geo.h);
        for (let i = 0; i < CELLS; i++) {
            const x = cx(i) * cs, y = cy(i) * cs, k = m.cls[i], ob = m.obst[i];
            if (ob === SEA) {
                g.fillStyle = '#08121a'; g.fillRect(x, y, cs + 0.5, cs + 0.5);
                if (R() < 0.3) { g.strokeStyle = rgba(VT.cold, 0.07); g.beginPath(); g.moveTo(x + cs * 0.2, y + cs * 0.5); g.quadraticCurveTo(x + cs * 0.5, y + cs * 0.3, x + cs * 0.8, y + cs * 0.5); g.stroke(); }
                continue;
            }
            if (ob === RIVER) {
                g.fillStyle = '#0a1520'; g.fillRect(x, y, cs + 0.5, cs + 0.5);
                g.strokeStyle = rgba(VT.cold, 0.10); g.lineWidth = 0.7;
                g.beginPath(); g.moveTo(x + cs * 0.1, y + cs * (0.3 + R() * 0.4)); g.lineTo(x + cs * 0.9, y + cs * (0.3 + R() * 0.4)); g.stroke();
                continue;
            }
            if (ob === COLD) {
                g.fillStyle = rgba(VT.plate, 0.22); g.fillRect(x, y, cs + 0.5, cs + 0.5);
                g.fillStyle = rgba(VT.paper, 0.18); g.fillRect(x + R() * cs, y + R() * cs, 1.5, 1.5);
                continue;
            }
            if (s.scale === 0) {
                // a block: streets are the gaps between
                const pad = cs * 0.12, bw = cs - pad * 2;
                const bx = x + pad, by = y + pad;
                if (k === PAPER) {
                    g.fillStyle = rgba(VT.life, 0.13); g.fillRect(bx, by, bw, bw);
                    g.fillStyle = rgba(VT.life, 0.32);
                    for (let t = 0; t < 3; t++) { g.beginPath(); g.arc(bx + R() * bw, by + R() * bw, cs * 0.09, 0, Math.PI * 2); g.fill(); }
                } else if (k === ROCK) {
                    g.fillStyle = VT.steel3; g.fillRect(bx, by, bw, bw);
                    g.fillStyle = rgba(VT.mist, 0.12); g.fillRect(bx, by, bw, 1);
                    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6;
                    g.beginPath(); g.moveTo(bx + R() * bw, by); g.lineTo(bx + R() * bw, by + bw); g.stroke();
                } else {
                    g.fillStyle = VT.steel2; g.fillRect(bx, by, bw, bw);
                    g.fillStyle = rgba(VT.slate, 0.9); g.fillRect(bx + bw * 0.2, by + bw * 0.2, bw * 0.6, bw * 0.6);
                    // dead windows, one lamp still on here and there
                    for (let t = 0; t < 4; t++) { g.fillStyle = R() < 0.12 ? rgba(VT.lamp, 0.8) : 'rgba(0,0,0,0.45)'; g.fillRect(bx + bw * (0.28 + (t % 2) * 0.3), by + bw * (0.28 + Math.floor(t / 2) * 0.3), Math.max(1, bw * 0.12), Math.max(1, bw * 0.12)); }
                }
                continue;
            }
            // the land
            if (k === PAPER) { g.fillStyle = rgba(VT.life, 0.10 + m.noise[i] * 0.08); g.fillRect(x, y, cs + 0.5, cs + 0.5); }
            else if (k === ROCK) { g.fillStyle = rgba(VT.slate, 0.55); g.fillRect(x, y, cs + 0.5, cs + 0.5); }
            else {
                g.fillStyle = rgba(VT.steel3, 0.9); g.fillRect(x, y, cs + 0.5, cs + 0.5);
                g.fillStyle = rgba(VT.lamp, R() < 0.3 ? 0.55 : 0.12); g.fillRect(x + cs * 0.3 + R() * cs * 0.4, y + cs * 0.3 + R() * cs * 0.4, 1.4, 1.4);
            }
            if (ob === POISON) {
                g.fillStyle = rgba(VT.fBruise, 0.75); g.fillRect(x, y, cs + 0.5, cs + 0.5);
                g.fillStyle = rgba(VT.life, 0.35);
                for (let t = 0; t < 2; t++) { g.beginPath(); g.arc(x + R() * cs, y + R() * cs, cs * 0.1, 0, Math.PI * 2); g.fill(); }
            } else if (ob === GRANITE) {
                g.fillStyle = rgba(VT.slate, 0.9); g.fillRect(x, y, cs + 0.5, cs + 0.5);
                g.strokeStyle = rgba(VT.mist, 0.28); g.lineWidth = 0.7;
                g.beginPath(); g.moveTo(x, y + cs); g.lineTo(x + cs, y); g.moveTo(x + cs * 0.5, y + cs); g.lineTo(x + cs, y + cs * 0.5); g.stroke();
            }
        }
        // a faint frame around the map
        g.strokeStyle = rgba(VT.mist, 0.12); g.lineWidth = 1; g.strokeRect(0.5, 0.5, geo.w - 1, geo.h - 1);
        return o.c;
    }

    // ---------------------------------------------------------------- the flesh
    /** A tile of tissue (made once): depth, bruises, fibre in bundles, wet sheen, hyphae. */
    function makeTissue() {
        const S = 160;
        const o = offscreen(S, S, 1);
        const g = o.g, R = rng(9.3);
        const depth = g.createLinearGradient(0, 0, S, S);
        depth.addColorStop(0, '#2e0c15'); depth.addColorStop(0.5, '#230a11'); depth.addColorStop(1, '#1a070c');
        g.fillStyle = depth; g.fillRect(0, 0, S, S);
        for (let k = 0; k < 5; k++) {
            const bx = R() * S, by = R() * S, br = 14 + R() * 26;
            const rg = g.createRadialGradient(bx, by, 1, bx, by, br);
            rg.addColorStop(0, rgba(VT.fBruise, 0.8)); rg.addColorStop(1, rgba(VT.fBruise, 0));
            g.fillStyle = rg; g.fillRect(0, 0, S, S);
        }
        g.lineCap = 'round';
        const bundles = [0, 1, 2].map(() => ({ x: R() * S, y: R() * S, a: R() * Math.PI }));
        for (let k = 0; k < 1300; k++) {
            const fx = R() * S, fy = R() * S;
            let b = bundles[0], bd = 1e9;
            for (const q of bundles) { const d = (q.x - fx) ** 2 + (q.y - fy) ** 2; if (d < bd) { bd = d; b = q; } }
            const a = b.a + (R() - 0.5) * 0.1, len = 9 + R() * 14;
            const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
            const pick = R();
            g.strokeStyle = pick < 0.5 ? 'rgba(16,6,9,0.55)' : pick < 0.9 ? 'rgba(88,24,38,0.42)' : 'rgba(150,52,64,0.28)';
            g.lineWidth = 1 + R() * 1.8;
            // wrap so the tile repeats without seams
            for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
                if (fx + ox < -len || fx + ox > S + len || fy + oy < -len || fy + oy > S + len) continue;
                g.beginPath(); g.moveTo(fx + ox - dx, fy + oy - dy); g.lineTo(fx + ox + dx, fy + oy + dy); g.stroke();
            }
        }
        g.lineWidth = 0.6;
        for (let k = 0; k < 10; k++) {
            let hx = R() * S, hy = R() * S, a = R() * Math.PI * 2;
            g.strokeStyle = rgba(VT.fHyphae, 0.10 + R() * 0.1);
            g.beginPath(); g.moveTo(hx, hy);
            for (let st = 0; st < 8; st++) { a += (R() - 0.5) * 0.9; hx += Math.cos(a) * 6; hy += Math.sin(a) * 6; g.lineTo(hx, hy); }
            g.stroke();
        }
        return ctx.createPattern(o.c, 'repeat');
    }

    /**
     * The body's outline: a soft field over the eaten cells (each grid corner the mean of its four cells, smoothed,
     * then sampled twice as fine), cut at one half by marching squares. Returns the filled shape and the outline.
     */
    function contour(c, cs) {
        const VW = MAP_W + 1, VH = MAP_H + 1;
        let f = new Float32Array(VW * VH);
        for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
            let sum = 0;
            for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
                const X = x + dx, Y = y + dy;
                if (X >= 0 && Y >= 0 && X < MAP_W && Y < MAP_H) sum += c.eaten[Y * MAP_W + X];
            }
            f[y * VW + x] = sum / 4;
        }
        // one soft pass: the corners of the blocks melt
        const f2 = new Float32Array(VW * VH);
        for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
            let sum = 0, n = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const X = x + dx, Y = y + dy;
                if (X < 0 || Y < 0 || X >= VW || Y >= VH) continue;
                const w = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
                sum += f[Y * VW + X] * w; n += w;
            }
            f2[y * VW + x] = sum / n;
        }
        f = f2;
        // twice as fine (bilinear), so the outline curves instead of stepping
        const S = 2, GW = MAP_W * S + 1, GH = MAP_H * S + 1;
        const g = new Float32Array(GW * GH);
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
            const fx = x / S, fy = y / S, ix = Math.min(VW - 2, Math.floor(fx)), iy = Math.min(VH - 2, Math.floor(fy)), u = fx - ix, v = fy - iy;
            g[y * GW + x] = f[iy * VW + ix] * (1 - u) * (1 - v) + f[iy * VW + ix + 1] * u * (1 - v) + f[(iy + 1) * VW + ix] * (1 - u) * v + f[(iy + 1) * VW + ix + 1] * u * v;
        }
        const step = cs / S, ISO = 0.42;
        const fill = new Path2D(), line = new Path2D();
        const at = (x, y) => g[y * GW + x];
        for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) {
            const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
            const vals = corners.map(([a, b]) => at(a, b));
            const ins = vals.map((v) => v >= ISO);
            const n = ins.filter(Boolean).length;
            if (n === 0) continue;
            if (n === 4) { fill.rect(x * step, y * step, step + 0.3, step + 0.3); continue; }
            const poly = [], cut = [];
            for (let k = 0; k < 4; k++) {
                const [ax, ay] = corners[k], [bx, by] = corners[(k + 1) % 4];
                if (ins[k]) poly.push([ax * step, ay * step]);
                if (ins[k] !== ins[(k + 1) % 4]) {
                    const t = (ISO - vals[k]) / (vals[(k + 1) % 4] - vals[k]);
                    const p = [(ax + (bx - ax) * t) * step, (ay + (by - ay) * t) * step];
                    poly.push(p); cut.push(p);
                }
            }
            fill.moveTo(poly[0][0], poly[0][1]);
            for (const p of poly.slice(1)) fill.lineTo(p[0], p[1]);
            fill.closePath();
            for (let k = 0; k + 1 < cut.length; k += 2) { line.moveTo(cut[k][0], cut[k][1]); line.lineTo(cut[k + 1][0], cut[k + 1][1]); }
        }
        return { fill, line, inside: (px, py) => { const X = Math.round(px / step), Y = Math.round(py / step); return X >= 0 && Y >= 0 && X < GW && Y < GH && at(X, Y) >= 0.55; } };
    }

    /** How many cells deep each body cell lies (0 = at the edge): organs sit deep, eyes at the rim. */
    function depthOf(c) {
        const d = new Int16Array(CELLS).fill(-1);
        const q = [];
        for (let i = 0; i < CELLS; i++) {
            if (!c.eaten[i]) continue;
            if (neighbours(i).some((j) => !c.eaten[j]) || neighbours(i).length < 4) { d[i] = 0; q.push(i); }
        }
        for (let h = 0; h < q.length; h++) {
            const i = q[h];
            for (const j of neighbours(i)) if (c.eaten[j] && d[j] < 0) { d[j] = d[i] + 1; q.push(j); }
        }
        return d;
    }

    /** The body's layer: membrane, tissue, vessels, the shading of its rim; and where the edge and the organs are. */
    function paintBody(s) {
        const c = cache(s), m = mapFor(s.seed, s.scale), cs = geo.cs;
        const o = offscreen(geo.w, geo.h);
        const g = o.g;
        if (!tissue) tissue = makeTissue();
        const cells = s.order;
        const lx = (i) => (cx(i) + 0.5) * cs, ly = (i) => (cy(i) + 0.5) * cs;
        const shape = contour(c, cs);
        // membrane: a dark lip around the mass
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.strokeStyle = VT.fDark; g.lineWidth = Math.max(2, cs * 0.45); g.stroke(shape.line);
        g.fillStyle = VT.fDark; g.fill(shape.fill);
        g.save();
        g.clip(shape.fill);
        g.fillStyle = tissue; g.fillRect(0, 0, geo.w, geo.h);
        // depth: the rim is darker, the middle wet
        g.strokeStyle = 'rgba(8,2,4,0.45)'; g.lineWidth = cs * 1.6; g.stroke(shape.line);
        g.strokeStyle = 'rgba(8,2,4,0.35)'; g.lineWidth = cs * 0.7; g.stroke(shape.line);
        const depth = depthOf(c);
        // vessels: trunks out from the heart that wander, branch and thin, the way the vault's do
        const heart = cells.length ? cells[0] : m.start;
        const hx = lx(heart), hy = ly(heart);
        const R = rng(cells.length * 0.137 + s.scale + 0.5);
        const vessels = [];
        const maxLen = Math.max(4, Math.sqrt(cells.length) * 1.4);
        function grow(x, y, a, wid, depthLeft, len) {
            const pts = [[x, y]];
            for (let st = 0; st < len; st++) {
                a += (R() - 0.5) * 0.7;
                const nx = x + Math.cos(a) * cs * 0.8, ny = y + Math.sin(a) * cs * 0.8;
                if (!shape.inside(nx, ny)) break;
                x = nx; y = ny; pts.push([x, y]);
                if (depthLeft > 0 && st > 1 && R() < 0.22) grow(x, y, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.5), wid * 0.62, depthLeft - 1, len * 0.6);
            }
            if (pts.length > 2) vessels.push({ pts, wid, delay: R() });
        }
        const trunks = Math.min(7, 3 + Math.floor(cells.length / 60));
        for (let k = 0; k < trunks; k++) grow(hx, hy, (k / trunks) * Math.PI * 2 + R() * 0.6, Math.max(1.4, Math.min(3.6, cs * 0.24)), 3, Math.round(maxLen));
        for (const v of vessels) {
            const path = () => {
                g.beginPath(); g.moveTo(v.pts[0][0], v.pts[0][1]);
                for (let k = 1; k < v.pts.length - 1; k++) g.quadraticCurveTo(v.pts[k][0], v.pts[k][1], (v.pts[k][0] + v.pts[k + 1][0]) / 2, (v.pts[k][1] + v.pts[k + 1][1]) / 2);
                const l = v.pts[v.pts.length - 1]; g.lineTo(l[0], l[1]);
            };
            path(); g.strokeStyle = VT.fArtery; g.lineWidth = v.wid + 2; g.stroke();
            path(); g.strokeStyle = VT.fCore; g.lineWidth = v.wid; g.stroke();
            g.save(); g.translate(-v.wid * 0.25, -v.wid * 0.25);
            path(); g.strokeStyle = 'rgba(255,170,175,0.2)'; g.lineWidth = Math.max(0.5, v.wid * 0.25); g.stroke();
            g.restore();
        }
        g.restore();
        // a wet line along the top of the rim
        g.save(); g.translate(-1, -1.5); g.strokeStyle = 'rgba(255,170,175,0.12)'; g.lineWidth = 1; g.stroke(shape.line); g.restore();
        // where the organs sit: eyes in the rim, the rest deep in the mass
        const edge = [], inner = [];
        for (const i of cells) { if (depth[i] === 0) edge.push(i); else if (depth[i] >= 2) inner.push(i); }
        const rim = cells.filter((i) => depth[i] === 1);
        const spots = inner.slice().sort((a, b) => hash(a * 1.7 + s.scale) - hash(b * 1.7 + s.scale));
        const rimSpots = (rim.length ? rim : edge).slice().sort((a, b) => hash(a * 2.9) - hash(b * 2.9));
        const edgeSpots = edge.slice().sort((a, b) => hash(a * 2.3) - hash(b * 2.3));
        const organs = [];
        const want = (o2, max) => (s.unlocked[o2] ? Math.max(1, Math.min(max, Math.round(share(s, o2) * 40))) : 0);
        let k = 0, r = 0, e = 0;
        for (let q = 0; q < want('eyes', 8) && r < rimSpots.length; q++) organs.push({ o: 'eyes', i: rimSpots[r++], seed: hash(r * 3.7) });
        for (const [o2, max] of [['brain', 3], ['intestines', 3], ['lungs', 3], ['stomach', 2], ['muscle', 4], ['fat', 5], ['bone', 4]]) {
            const n = want(o2, max);
            for (let q = 0; q < n && k < spots.length; q++) organs.push({ o: o2, i: spots[k++], seed: hash(k * 3.1) });
        }
        for (const [o2, max] of [['nails', 16], ['ears', 4]]) {
            const n = want(o2, max);
            for (let q = 0; q < n && e < edgeSpots.length; q++) organs.push({ o: o2, i: edgeSpots[e++], seed: hash(e * 5.7) });
        }
        // nails face out: the way to the nearest ground
        for (const org of organs) {
            if (org.o !== 'nails' && org.o !== 'ears') continue;
            const out = neighbours(org.i).find((j) => !c.eaten[j]);
            org.face = out != null ? Math.atan2(cy(out) - cy(org.i), cx(out) - cx(org.i)) : org.seed * 6.28;
        }
        // intestines: a winding path through neighbouring inner cells (a walk, seeded)
        for (const org of organs) {
            if (org.o !== 'intestines') continue;
            const walk = [org.i];
            let cur = org.i;
            const R2 = rng(org.i + 0.5);
            for (let st = 0; st < 12; st++) {
                const nb = neighbours(cur).filter((j) => c.eaten[j] && depth[j] >= 1 && !walk.includes(j));
                if (!nb.length) break;
                cur = nb[Math.floor(R2() * nb.length)];
                walk.push(cur);
            }
            org.walk = walk.map((j) => [lx(j) + (R2() - 0.5) * cs * 0.4, ly(j) + (R2() - 0.5) * cs * 0.4]);
        }
        let sx = 0, sy = 0;
        for (const i of cells) { sx += lx(i); sy += ly(i); }
        const n = Math.max(1, cells.length);
        return { c: o.c, vessels, edge, organs, heart: [hx, hy], mid: [sx / n, sy / n], line: shape.line, fill: shape.fill, depth };
    }

    /** The unseen (county and out): a soft darkness past what the eyes reach. */
    function paintFog(s, sight) {
        const c = cache(s);
        const d = new Float32Array(CELLS).fill(1e9);
        const q = [];
        for (let i = 0; i < CELLS; i++) if (c.eaten[i]) { d[i] = 0; q.push(i); }
        for (let h = 0; h < q.length; h++) {
            const i = q[h];
            for (const j of neighbours(i)) if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); }
        }
        const px = document.createElement('canvas'); px.width = MAP_W; px.height = MAP_H;
        const pg = px.getContext('2d');
        const img = pg.createImageData ? pg.createImageData(MAP_W, MAP_H) : null;
        if (!img || !img.data) return null;
        for (let i = 0; i < CELLS; i++) {
            const a = Math.max(0, Math.min(1, (d[i] - sight) / 7));
            img.data.set([4, 5, 8, Math.round(a * 115)], i * 4);
        }
        pg.putImageData(img, 0, 0);
        return px;
    }

    // ---------------------------------------------------------------- the storm
    function stepStorm(s, now) {
        if (!storm) {
            const c = document.createElement('canvas'); c.width = MAP_W; c.height = MAP_H;
            const g = c.getContext('2d');
            storm = { c, g, img: g.createImageData(MAP_W, MAP_H), at: 0, any: false };
        }
        if (now - storm.at < 150 || !storm.img || !storm.img.data) return;
        storm.at = now;
        const m = mapFor(s.seed, s.scale);
        const d = storm.img.data;
        let any = false;
        for (let i = 0; i < CELLS; i++) {
            const v = stormAt(m, i, mapTime(s), s.scale);
            if (v > 0) any = true;
            d[i * 4] = 4; d[i * 4 + 1] = 5; d[i * 4 + 2] = 8; d[i * 4 + 3] = Math.min(235, Math.round(v * 205));
        }
        storm.any = any;
        storm.g.putImageData(storm.img, 0, 0);
    }
    function drawStorm(s, t) {
        if (!storm || !storm.any) return;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(storm.c, geo.x, geo.y, geo.w, geo.h);
        // rain where it storms
        const m = mapFor(s.seed, s.scale);
        ctx.strokeStyle = rgba(VT.mist, 0.22); ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 90; k++) {
            const x = geo.x + ((hash(k) * geo.w + t * 140) % geo.w);
            const y = geo.y + ((hash(k + 50) * geo.h + t * 300) % geo.h);
            const i = cellAt(x, y);
            if (i < 0 || stormAt(m, i, mapTime(s), s.scale) < 0.3) continue;
            ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 10);
        }
        ctx.stroke();
        ctx.restore();
    }

    // ---------------------------------------------------------------- the organs
    function organ(org, t, hb, s, ui) {
        const [x, y] = [geo.x + (cx(org.i) + 0.5) * geo.cs, geo.y + (cy(org.i) + 0.5) * geo.cs];
        // organs grow with the body: a bigger body has bigger eyes
        const cs = geo.cs * (ui.organScale || 1), r = cs * 0.55;
        switch (org.o) {
            case 'eyes': {
                // an eye opens in the skin and turns toward what it looks at
                const open = Math.min(1, Math.max(0, (t - org.seed * 3) * 0.6)) * (Math.sin(t * 0.7 + org.seed * 20) > 0.985 ? 0.15 : 1);
                const look = ui.lookAt || null;
                let dx = 0, dy = 0;
                if (look) { const a = Math.atan2(look[1] - y, look[0] - x); dx = Math.cos(a) * r * 0.3; dy = Math.sin(a) * r * 0.22; }
                ctx.save();
                ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55 * open + 0.3, 0, 0, Math.PI * 2); ctx.clip();
                ctx.fillStyle = rgba(VT.fBone, 0.85); ctx.fillRect(x - r, y - r, r * 2, r * 2);
                ctx.fillStyle = VT.fCore; ctx.beginPath(); ctx.arc(x + dx, y + dy, r * 0.42, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = VT.ink; ctx.beginPath(); ctx.arc(x + dx, y + dy, r * 0.2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,240,240,0.8)'; ctx.fillRect(x + dx - r * 0.2, y + dy - r * 0.22, 1.5, 1.5);
                ctx.restore();
                ctx.strokeStyle = VT.fDark; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55 * open + 0.3, 0, 0, Math.PI * 2); ctx.stroke();
                break;
            }
            case 'brain': {
                // folds, and a light that runs along them
                const R = rng(org.i);
                ctx.fillStyle = rgba(VT.fMuscle, 0.95);
                ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 1.1, org.seed, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = rgba(VT.fBone, 0.32); ctx.lineWidth = 0.9;
                const folds = [];
                for (let f = 0; f < 4; f++) {
                    const pts = [];
                    let px = x - r * 1.2, py = y + (R() - 0.5) * r * 1.3;
                    for (let st = 0; st < 8; st++) { px += r * 0.32; py += Math.sin(st * 1.7 + f) * r * 0.25; pts.push([px, py]); }
                    folds.push(pts);
                    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
                }
                const f = folds[Math.floor((t * 0.8 + org.seed * 4) % folds.length)];
                const p = f[Math.floor(((t * 6) % f.length))];
                ctx.fillStyle = rgba(VT.paper, 0.85); ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'intestines': {
                if (!org.walk || org.walk.length < 2) break;
                const w = org.walk;
                const path = () => {
                    ctx.beginPath(); ctx.moveTo(w[0][0] + geo.x, w[0][1] + geo.y);
                    for (let q = 1; q < w.length - 1; q++) ctx.quadraticCurveTo(w[q][0] + geo.x, w[q][1] + geo.y, (w[q][0] + w[q + 1][0]) / 2 + geo.x, (w[q][1] + w[q + 1][1]) / 2 + geo.y);
                    ctx.lineTo(w[w.length - 1][0] + geo.x, w[w.length - 1][1] + geo.y);
                };
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                // under the skin: dark, the tube a little sunk
                path(); ctx.strokeStyle = VT.fDark; ctx.lineWidth = cs * 0.55; ctx.stroke();
                path(); ctx.strokeStyle = rgba(VT.fMuscle, 0.8); ctx.lineWidth = cs * 0.4; ctx.stroke();
                path(); ctx.strokeStyle = 'rgba(255,170,175,0.16)'; ctx.lineWidth = cs * 0.12; ctx.stroke();
                // food moving one way
                const u = (t * 0.35 + org.seed) % 1;
                const f = u * (org.walk.length - 1), k = Math.floor(f), fr = f - k;
                const a = org.walk[k], b = org.walk[Math.min(org.walk.length - 1, k + 1)];
                ctx.fillStyle = rgba(VT.lamp, 0.55);
                ctx.beginPath(); ctx.arc(geo.x + a[0] + (b[0] - a[0]) * fr, geo.y + a[1] + (b[1] - a[1]) * fr, cs * 0.16, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'lungs': {
                const br = 1 + Math.sin(t * 1.4 + org.seed * 9) * 0.08;
                for (const sgn of [-1, 1]) {
                    ctx.fillStyle = rgba(VT.fMuscle, 0.9);
                    ctx.beginPath(); ctx.ellipse(x + sgn * r * 0.55, y, r * 0.5 * br, r * 0.85 * br, sgn * 0.2, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = rgba(VT.fBone, 0.3); ctx.lineWidth = 0.7;
                    ctx.beginPath(); ctx.moveTo(x, y - r * 0.6); ctx.lineTo(x + sgn * r * 0.5, y); ctx.lineTo(x + sgn * r * 0.7, y + r * 0.5); ctx.stroke();
                }
                break;
            }
            case 'stomach': {
                // a curled bag of muscle with folds inside, wet; it churns with the beat
                ctx.save(); ctx.translate(x, y); ctx.rotate(org.seed * 6.28 + Math.sin(t * 0.8) * 0.05);
                ctx.fillStyle = rgba(VT.fMuscle, 0.95);
                ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25 * (1 + hb * 0.04), r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(150,52,64,0.55)'; ctx.lineWidth = 0.8;
                for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(-r * 0.9, q * r * 0.18); ctx.quadraticCurveTo(0, q * r * 0.18 + Math.sin(t * 2 + q) * r * 0.12, r * 0.9, q * r * 0.18); ctx.stroke(); }
                ctx.strokeStyle = 'rgba(255,170,175,0.25)'; ctx.beginPath(); ctx.ellipse(0, -r * 0.2, r * 0.9, r * 0.35, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
                ctx.restore();
                break;
            }
            case 'muscle': {
                const pull = ui.target ? 0.8 + 0.2 * Math.sin(t * 3) : 1;
                ctx.save(); ctx.translate(x, y); ctx.rotate(org.seed * 6);
                ctx.fillStyle = rgba(VT.fMuscle, 1); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3 * pull, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(150,52,64,0.5)'; ctx.lineWidth = 0.7;
                for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(-r * 1.2 * pull, q * r * 0.08); ctx.lineTo(r * 1.2 * pull, q * r * 0.08); ctx.stroke(); }
                ctx.restore();
                break;
            }
            case 'fat': {
                // pale soft layers, one over the other
                for (let q = 0; q < 3; q++) {
                    ctx.fillStyle = rgba(q % 2 ? VT.lamp : VT.fBone, 0.16 + q * 0.04);
                    ctx.beginPath(); ctx.ellipse(x + (q - 1) * r * 0.35, y + (q - 1) * r * 0.15, r * (1.1 - q * 0.2), r * (0.75 - q * 0.12), org.seed, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case 'bone': {
                // white arcs through the mass, two ribs
                ctx.strokeStyle = rgba(VT.fBone, 0.8); ctx.lineCap = 'round';
                for (let q = 0; q < 2; q++) {
                    ctx.lineWidth = cs * (0.16 - q * 0.04);
                    ctx.beginPath(); ctx.arc(x, y + r * (1 + q * 0.5), r * (1.4 + q * 0.4), Math.PI * 1.15 + org.seed, Math.PI * 1.85 + org.seed); ctx.stroke();
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.7;
                ctx.beginPath(); ctx.arc(x, y + r, r * 1.4, Math.PI * 1.25 + org.seed, Math.PI * 1.6 + org.seed); ctx.stroke();
                break;
            }
            case 'nails': {
                // a hard plate set in the rim, facing out, glossy
                ctx.save(); ctx.translate(x, y); ctx.rotate((org.face ?? 0) + Math.PI / 2);
                ctx.fillStyle = VT.fDark; ctx.beginPath(); ctx.roundRect(-r * 0.7, -r * 0.5, r * 1.4, r * 0.95, r * 0.3); ctx.fill();
                const lg = ctx.createLinearGradient(0, -r * 0.45, 0, r * 0.4);
                lg.addColorStop(0, rgba(VT.plate, 0.95)); lg.addColorStop(1, rgba(VT.fBone, 0.55));
                ctx.fillStyle = lg; ctx.beginPath(); ctx.roundRect(-r * 0.6, -r * 0.42, r * 1.2, r * 0.8, r * 0.25); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.25); ctx.lineTo(r * 0.35, -r * 0.3); ctx.stroke();
                ctx.restore();
                break;
            }
            case 'ears': {
                // funnels turned toward where the storms come from (the west), the rings breathing
                ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI);
                ctx.fillStyle = rgba(VT.fMuscle, 0.9); ctx.beginPath(); ctx.moveTo(0, -r * 0.25); ctx.lineTo(r * 1.2, -r * 0.8); ctx.lineTo(r * 1.2, r * 0.8); ctx.lineTo(0, r * 0.25); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = rgba(VT.fBone, 0.45); ctx.lineWidth = 1;
                for (let q = 1; q <= 3; q++) { const w = q / 3; ctx.beginPath(); ctx.ellipse(r * 1.2 * w, 0, r * 0.12, r * (0.25 + 0.55 * w) * (1 + Math.sin(t * 2 + q) * 0.04), 0, 0, Math.PI * 2); ctx.stroke(); }
                ctx.restore();
                break;
            }
            default: break;
        }
    }

    // ---------------------------------------------------------------- per frame
    function frame(s, ui, now) {
        if (!geo) return;
        const t = now / 1000;
        if (zoom) { drawZoom(now); return; }
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = VT.ink; ctx.fillRect(0, 0, W, H);
        if (s.scale >= 4) { drawPlanet(s, ui, now); return; }
        const gk = `${s.scale}|${s.seed}|${geo.w}x${geo.h}|${dpr}`;
        if (!ground || ground.key !== gk) ground = { key: gk, c: paintGround(s) };
        ctx.drawImage(ground.c, geo.x, geo.y, geo.w, geo.h);
        // the body, redrawn when it has grown (at most four times a second)
        const bk = `${s.scale}|${s.order.length}|${s.order[s.order.length - 1]}|${geo.cs}|${Object.keys(s.unlocked).length}|${Math.round(share(s, 'eyes') * 40)}|${Math.round(share(s, 'nails') * 40)}|${Math.round(share(s, 'brain') * 40)}`;
        // a slow machine keeps its frames: the body is redrawn no more often than eight times what it costs
        if (!body || (body.key !== bk && now - body.at > bodyGap)) {
            const t0 = performance.now();
            body = { key: bk, at: now, ...paintBody(s) };
            cost.body = cost.body * 0.7 + (performance.now() - t0) * 0.3;
            bodyGap = Math.max(250, cost.body * 8);
        }
        stepStorm(s, now);
        const hb = beat(t);
        // the sea shimmers, faintly
        if (ground.c.sea && ground.c.sea.length) {
            ctx.strokeStyle = rgba(VT.cold, 0.10); ctx.lineWidth = 1;
            ctx.beginPath();
            for (const i of ground.c.sea) {
                const ph = Math.sin(t * 0.8 + i * 1.7);
                if (ph < 0.6) continue;
                const [x, y] = centre(i);
                ctx.moveTo(x - geo.cs * 0.3, y + ph); ctx.lineTo(x + geo.cs * 0.3, y + ph);
            }
            ctx.stroke();
        }
        // the unseen: soft darkness past what the eyes reach (county and out)
        if (s.scale >= 1) {
            const sight = Math.round(ui.sight || 3);
            const fk = `${body.key}|${sight}`;
            if (!fog || (fog.key !== fk && now - fog.at > Math.max(400, bodyGap * 1.5))) fog = { key: fk, at: now, c: paintFog(s, sight) };
            if (fog.c) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(fog.c, geo.x - geo.cs * 0.5, geo.y - geo.cs * 0.5, geo.w + geo.cs, geo.h + geo.cs); ctx.restore(); }
        }
        ctx.drawImage(body.c, geo.x, geo.y, geo.w, geo.h);
        // the heart: a dark knot that beats where the body came up
        const [hx, hy] = [geo.x + body.heart[0], geo.y + body.heart[1]];
        const hr = geo.cs * (0.9 + hb * 0.18) * Math.min(2.2, 1 + share(s, 'heart') * 3);
        const rg = ctx.createRadialGradient(hx, hy, 1, hx, hy, hr * 1.6);
        rg.addColorStop(0, rgba(VT.pulse, 0.55 + hb * 0.35)); rg.addColorStop(0.5, rgba(VT.fCore, 0.5)); rg.addColorStop(1, rgba(VT.fCore, 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.6, 0, Math.PI * 2); ctx.fill();
        // the pulse running out along the vessels to the edge
        ctx.save(); ctx.beginPath(); ctx.translate(geo.x, geo.y); ctx.clip(body.fill); ctx.translate(-geo.x, -geo.y);
        pulses(body.vessels, t, 0.55 + 0.45 * hb);
        ctx.restore();
        // the edge: a red line of light that breathes with the heart
        ctx.save();
        ctx.translate(geo.x, geo.y);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = rgba(VT.pulse, 0.25 + 0.35 * hb); ctx.lineWidth = 1.6;
        ctx.stroke(body.line);
        ctx.strokeStyle = rgba(VT.pulse, 0.08 + 0.1 * hb); ctx.lineWidth = 6;
        ctx.stroke(body.line);
        ctx.restore();
        // where it eats: the flesh bulges into the next cells and nibbles at them
        if (s.ex && s.ex.auto) {
            const bite = Math.max(0, Math.min(1, s.bite || 0));
            ctx.save();
            for (const [k, i] of front(s, 6).entries()) {
                const [x, y] = centre(i);
                const near = neighbours(i).find((j) => cache(s).eaten[j]);
                const [nx, ny] = near != null ? centre(near) : [x, y];
                const u = 0.35 + 0.55 * ((bite + k * 0.17) % 1);
                const bx = nx + (x - nx) * u, by = ny + (y - ny) * u;
                const r = geo.cs * (0.45 + 0.15 * Math.sin(t * 6 + k));
                ctx.fillStyle = VT.fDark; ctx.beginPath(); ctx.arc(bx, by, r * 1.15, 0, Math.PI * 2); ctx.fill();
                ctx.save(); ctx.translate(geo.x, geo.y); ctx.fillStyle = tissue; ctx.beginPath(); ctx.arc(bx - geo.x, by - geo.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                const gl = ctx.createRadialGradient(bx, by, 1, bx, by, geo.cs * 1.2);
                gl.addColorStop(0, `rgba(255,80,96,${0.3 + 0.35 * hb})`); gl.addColorStop(1, 'rgba(255,80,96,0)');
                ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bx, by, geo.cs * 1.2, 0, Math.PI * 2); ctx.fill();
                // the nibble: a ragged lip toward the ground
                const a = Math.atan2(y - ny, x - nx);
                ctx.strokeStyle = `rgba(255,120,130,${0.4 + 0.4 * Math.abs(Math.sin(t * 9 + k))})`; ctx.lineWidth = 1.2;
                ctx.beginPath();
                for (let q = -3; q <= 3; q++) {
                    const aa = a + q * 0.25, rr = r * (q % 2 ? 0.85 : 1.05);
                    const px2 = bx + Math.cos(aa) * rr, py2 = by + Math.sin(aa) * rr;
                    if (q === -3) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
        ui.organScale = Math.max(1, Math.min(2.6, Math.sqrt(s.order.length) / 12));
        for (const org of body.organs) organ(org, t, hb, s, ui);
        drawStorm(s, t);
        drawMarks(s, ui, t, hb);
        drawEffects(now);
    }

    // ---------------------------------------------------------------- fas 3: the planet
    function planetRect() {
        const D = Math.min(geo.w, geo.h) * 0.94;
        return { x: geo.x + (geo.w - D) / 2, y: geo.y + (geo.h - D) / 2, D };
    }
    /** The globe turning in the stars; at WE LOOK UP the camera leaves it for the stars. */
    function drawPlanet(s, ui, now) {
        if (!globe) globe = createGlobe();
        const t = now / 1000;
        let rect = planetRect();
        let e = 0;
        if (ending) {
            const u = Math.min(1, (now - ending.t0) / ending.ms);
            e = u * u * (3 - 2 * u);
            rect = { x: rect.x + rect.D * 0.1 * e, y: rect.y + H * 0.9 * e, D: rect.D * (1 - 0.2 * e) };
        }
        globe.drawStars(ctx, W, H, t, 0.45 + e * 0.5, -e * H * 0.6);
        globe.render(ctx, s, now, rect, { allRed: s.ended ? 1 : 0 });
        // the chosen land for the next seed: a thin amber ring at its middle
        if (ui.seedTarget && !s.ended) {
            const sea = ui.seedSea;
            if (sea) {
                const p = globe.toScreen(latOf(sea.land), lonOf(sea.land), rect);
                if (p.front) {
                    ctx.strokeStyle = rgba(VT.amber, 0.6 + 0.3 * Math.sin(t * 3)); ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(p.x, p.y, rect.D * 0.06, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = VT.amber; ctx.font = "13px 'Bebas Neue', 'Arial Narrow', sans-serif"; ctx.textAlign = 'center';
                    ctx.fillText(sea.name, p.x, p.y - rect.D * 0.075);
                }
            }
        }
        if (ending && now - ending.t0 >= ending.ms) { const r = ending.resolve; ending = null; view.busy = false; r(); }
        void ui;
    }
    /** WE LOOK UP: the camera turns from the red globe to the stars (ms), then resolves. */
    function lookUp(ms) {
        view.busy = true;
        return new Promise((resolve) => { ending = { t0: performance.now(), ms, resolve }; });
    }
    function landAt(s, px, py) { if (!globe) globe = createGlobe(); return globe.landAt(s, px, py, planetRect()); }

    function pulses(vessels, t, strength) {
        ctx.lineCap = 'round';
        for (const v of vessels) {
            const p = ((t / BEAT) + v.delay * 0.25) % 1;
            const at = (q) => {
                const f = Math.max(0, Math.min(1, q)) * (v.pts.length - 1), k = Math.floor(f), u = f - k;
                const a = v.pts[k], b = v.pts[Math.min(v.pts.length - 1, k + 1)];
                return [geo.x + a[0] + (b[0] - a[0]) * u, geo.y + a[1] + (b[1] - a[1]) * u];
            };
            const [x1, y1] = at(p - 0.14), [x2, y2] = at(p - 0.05), [x3, y3] = at(p);
            ctx.strokeStyle = rgba(VT.pulse, 0.55 * strength); ctx.lineWidth = v.wid + 2.5;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
            ctx.strokeStyle = `rgba(255,80,96,${0.85 * strength})`; ctx.lineWidth = Math.max(1, v.wid * 0.6);
            ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
        }
        ctx.lineWidth = 1;
    }

    /** The direction, the vault, the edge under the hand, a stop's focus. */
    function drawMarks(s, ui, t, hb) {
        const m = mapFor(s.seed, s.scale);
        if (s.target >= 0 && body) {
            const [tx, ty] = centre(s.target);
            const [bx, by] = [geo.x + body.mid[0], geo.y + body.mid[1]];
            const a = Math.atan2(ty - by, tx - bx);
            ctx.save();
            ctx.strokeStyle = rgba(VT.paper, 0.35); ctx.setLineDash([4, 6]); ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - Math.cos(a - 0.4) * 9, ty - Math.sin(a - 0.4) * 9); ctx.moveTo(tx, ty); ctx.lineTo(tx - Math.cos(a + 0.4) * 9, ty - Math.sin(a + 0.4) * 9); ctx.stroke();
            ctx.restore();
        }
        if (m.vault >= 0 && s.seen && s.seen[s.scale] && !(s.joined && s.joined[s.scale])) {
            const [vx, vy] = centre(m.vault);
            ctx.strokeStyle = rgba(VT.amber, 0.6 + 0.3 * Math.sin(t * 3)); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(vx, vy, geo.cs * 1.2, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = VT.amber; ctx.font = "13px 'Bebas Neue', 'Arial Narrow', sans-serif"; ctx.textAlign = 'center';
            ctx.fillText('VAULT', vx, vy - geo.cs * 1.6);
        }
        if (ui.hover >= 0) {
            const [x, y] = centre(ui.hover);
            ctx.strokeStyle = rgba(VT.amber, 0.9); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, geo.cs * 0.75, 0, Math.PI * 2); ctx.stroke();
        }
        if (ui.focusEdge && body) {
            ctx.strokeStyle = rgba(VT.amber, 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 5))); ctx.lineWidth = 2;
            ctx.beginPath();
            for (const i of body.edge) { const [x, y] = centre(i); ctx.moveTo(x + geo.cs * 0.9, y); ctx.arc(x, y, geo.cs * 0.9, 0, Math.PI * 2); }
            ctx.stroke();
        }
        void hb;
    }

    function addBite(i, ok = true) {
        if (i < 0 || !geo) return;
        effects.push({ i, t0: performance.now(), ok });
    }
    function drawEffects(now) {
        for (let k = effects.length - 1; k >= 0; k--) {
            const e = effects[k];
            const u = (now - e.t0) / 600;
            if (u >= 1) { effects.splice(k, 1); continue; }
            const [x, y] = centre(e.i);
            ctx.strokeStyle = e.ok ? `rgba(255,80,96,${1 - u})` : rgba(VT.mist, 1 - u);
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, geo.cs * (0.6 + u * 1.6), 0, Math.PI * 2); ctx.stroke();
            if (e.ok && u < 0.25) { ctx.fillStyle = `rgba(255,120,130,${0.6 - u * 2})`; ctx.beginPath(); ctx.arc(x, y, geo.cs * 0.7, 0, Math.PI * 2); ctx.fill(); }
        }
    }

    // ---------------------------------------------------------------- the zoom out
    /**
     * The camera pulls out (ms): the map shrinks around the body until the body is a dot with the body's own shape,
     * and the next map fades in around it, so the dot sits where it will be on the new ground.
     */
    function startZoom(ms, ratio, s) {
        const snap = offscreen(W, H);
        snap.g.drawImage(canvas, 0, 0, W, H);
        const from = body ? [geo.x + body.mid[0], geo.y + body.mid[1]] : [geo.x + geo.w / 2, geo.y + geo.h / 2];
        let next = null, at = null;
        if (s && s.scale === 3) {
            // the continent pulls back and becomes the globe's face
            if (!globe) globe = createGlobe();
            const o = offscreen(geo.w, geo.h);
            const r = planetRect();
            globe.drawStars(o.g, geo.w, geo.h, 0, 0.45);
            globe.render(o.g, { seed: s.seed, scale: 4, order: [], seeds: {} }, performance.now(), { x: r.x - geo.x, y: r.y - geo.y, D: r.D });
            next = o.c;
            at = [geo.w / 2, geo.h / 2];
        } else if (s && s.scale < 4) {
            const ns = { seed: s.seed, scale: s.scale + 1 };
            next = paintGround(ns);
            const m = mapFor(s.seed, s.scale + 1);
            at = [(cx(m.start) + 0.5) * geo.cs, (cy(m.start) + 0.5) * geo.cs];
        }
        view.busy = true;
        return new Promise((resolve) => { zoom = { t0: performance.now(), ms, snap: snap.c, body: body ? body.c : null, from, ratio: ratio || 10, next, at, resolve }; });
    }
    function drawZoom(now) {
        const u = Math.min(1, (now - zoom.t0) / zoom.ms);
        const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        const k = 1 / (1 + (zoom.ratio - 1) * e);
        const [fx, fy] = zoom.from;
        // the anchor moves from where the body is to where it will be on the next map
        const end = zoom.at ? [geo.x + zoom.at[0], geo.y + zoom.at[1]] : [geo.x + geo.w / 2, geo.y + geo.h / 2];
        const tx = fx + (end[0] - fx) * e, ty = fy + (end[1] - fy) * e;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = VT.ink; ctx.fillRect(0, 0, W, H);
        // the next map: from very near (its cells as big as the city) to where it belongs, fading in
        if (zoom.next) {
            const kn = zoom.ratio * k;
            ctx.save();
            ctx.globalAlpha = Math.min(1, e * 1.3);
            ctx.translate(tx, ty); ctx.scale(kn, kn); ctx.translate(-zoom.at[0], -zoom.at[1]);
            ctx.drawImage(zoom.next, 0, 0, geo.w, geo.h);
            ctx.restore();
        }
        // the old picture shrinks and fades; the body stays, the same shape, smaller
        ctx.save();
        ctx.translate(tx, ty); ctx.scale(k, k); ctx.translate(-fx, -fy);
        ctx.globalAlpha = 1 - e;
        ctx.drawImage(zoom.snap, 0, 0, W, H);
        ctx.globalAlpha = 1;
        if (zoom.body) ctx.drawImage(zoom.body, geo.x, geo.y, geo.w, geo.h);
        ctx.restore();
        const hb = beat(now / 1000);
        ctx.fillStyle = rgba(VT.pulse, e * (0.35 + 0.35 * hb));
        ctx.beginPath(); ctx.arc(tx, ty, 2 + 2 * e + hb, 0, Math.PI * 2); ctx.fill();
        if (u >= 1) {
            const r = zoom.resolve;
            zoom = null; view.busy = false; body = null; ground = null; fog = null;
            r();
        }
    }

    function setPointer(x, y) { pointer.x = x; pointer.y = y; }
    function cellCentre(i) { return geo ? centre(i) : [0, 0]; }

    resize();
    view.cost = cost;
    return Object.assign(view, { lookUp, landAt, resize, frame, cellAt, cellCentre, addBite, startZoom, setPointer, get geo() { return geo; }, get edgeCells() { return body ? body.edge : []; } });
}
