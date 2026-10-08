/**
 * Chapter V · UNITY, fas 3 · THE PLANET: the globe, drawn on a 2D canvas (no 3D library: the owner's machine
 * is slow). An orthographic sphere sampled from the planet's map: every pixel of a small buffer knows, once,
 * which latitude it shows and how much light it gets; each frame only adds the turn and looks the colour up.
 * Continents in the house palette, the sea dark with a shimmer, ice at the poles, storms as dark bands drifting,
 * the body as red flesh with fine vessels and the heartbeat in it. Seeds fly as red motes over the sea.
 * Draws what the rules say; owns no state of the game except where the camera looks.
 */
import { MAP_W, MAP_H, CELLS, cx, cy, mapFor, SEA, COLD, POISON, GRANITE, PAPER, ROCK } from './terrain.js';
void cx; void cy;
import { cache, SEED_FLIGHT_S } from './unity.js';
import { VT } from './style.js';

/** Pixels across the globe's buffer (it is scaled up smooth). */
export const GLOBE_RES = 190;
/** The axis leans toward the viewer this much (radians). */
export const TILT = 0.32;
const BEAT = 1.7;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
function beat(t) { const p = (t % BEAT) / BEAT; return p < 0.08 ? p / 0.08 : Math.exp(-(p - 0.08) * 6); }

/** A cell's longitude and latitude (radians); the map is equirectangular. */
export const lonOf = (i) => ((cx(i) + 0.5) / MAP_W) * Math.PI * 2 - Math.PI;
export const latOf = (i) => Math.PI / 2 - ((cy(i) + 0.5) / MAP_H) * Math.PI;

/** A point on the sphere at (lat, lon), seen with the globe turned by rot: [x, y, z] (z toward the viewer, y down). */
export function project(lat, lon, rot, tilt = TILT, r = 1) {
    const l = lon - rot;
    const x = Math.cos(lat) * Math.sin(l), yUp = Math.sin(lat), z = Math.cos(lat) * Math.cos(l);
    // lean the axis: rotate about x by tilt
    const y2 = yUp * Math.cos(tilt) - z * Math.sin(tilt);
    const z2 = yUp * Math.sin(tilt) + z * Math.cos(tilt);
    return [x * r, -y2 * r, z2 * r];
}
/** The inverse: a point of the disc (x, y in -1..1, y down) to (lat, lon), or null outside. */
export function unproject(x, y, rot, tilt = TILT) {
    const d = x * x + y * y;
    if (d > 1) return null;
    const z2 = Math.sqrt(1 - d), y2 = -y;
    const yUp = y2 * Math.cos(tilt) + z2 * Math.sin(tilt);
    const z = -y2 * Math.sin(tilt) + z2 * Math.cos(tilt);
    const lat = Math.asin(Math.max(-1, Math.min(1, yUp)));
    const lon = Math.atan2(x, z) + rot;
    return { lat, lon: ((lon + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI };
}
/** The map cell at (lat, lon). */
export function cellAtLatLon(lat, lon) {
    const x = Math.floor(((lon + Math.PI) / (Math.PI * 2)) * MAP_W);
    const y = Math.floor(((Math.PI / 2 - lat) / Math.PI) * MAP_H);
    return Math.max(0, Math.min(MAP_H - 1, y)) * MAP_W + ((x % MAP_W) + MAP_W) % MAP_W;
}

export function createGlobe() {
    const N = GLOBE_RES;
    const buf = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (buf) { buf.width = N; buf.height = N; }
    const g = buf ? buf.getContext('2d') : null;
    const img = g && g.createImageData ? g.createImageData(N, N) : null;
    // per pixel, once: inside?, the row it shows, its longitude before the turn, its light
    const inside = new Uint8Array(N * N), row = new Int32Array(N * N), lon0 = new Float32Array(N * N), lat0 = new Float32Array(N * N), light = new Float32Array(N * N);
    const L = [-0.45, -0.55, 0.7];
    const ln = Math.hypot(...L);
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        const k = py * N + px;
        const x = (px + 0.5) / N * 2 - 1, y = (py + 0.5) / N * 2 - 1;
        const p = unproject(x, y, 0);
        if (!p) continue;
        inside[k] = 1;
        lat0[k] = p.lat; lon0[k] = p.lon;
        row[k] = Math.max(0, Math.min(MAP_H - 1, Math.floor(((Math.PI / 2 - p.lat) / Math.PI) * MAP_H))) * MAP_W;
        const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
        light[k] = 0.28 + 0.72 * Math.max(0, (x * L[0] + y * L[1] + z * L[2]) / ln);
    }
    // the colour of each cell (and whether it is body, sea), rebuilt when the body changes
    const col = new Float32Array(CELLS * 3);
    const kind = new Uint8Array(CELLS);   // 0 land, 1 sea, 2 body, 3 ice
    let colKey = '';
    const view = { rot: null, red: 0 };
    const stars = Array.from({ length: 140 }, (_, k) => [Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1, Math.abs(Math.sin(k * 78.233) * 12345.678) % 1, (k % 7) / 7]);

    function colours(s) {
        const m = mapFor(s.seed, 4);
        const c = cache(s);
        const key = `${s.order.length}|${s.order[s.order.length - 1]}|${s.seed}`;
        if (key === colKey) return;
        colKey = key;
        const base = hex('#0d1013'), life = hex(VT.life), slate = hex(VT.slate), steel = hex(VT.steel3), bruise = hex(VT.fBruise), plate = hex(VT.plate), mist = hex(VT.mist);
        const flesh = hex('#5c1422'), deep = hex('#2e0c15');
        for (let i = 0; i < CELLS; i++) {
            const o = m.obst[i], nz = m.noise[i];
            let rgb;
            if (c.eaten[i]) { rgb = mix(deep, flesh, 0.45 + nz * 0.5); kind[i] = 2; }
            else if (o === SEA) { rgb = mix(hex('#06101a'), hex('#0b1a28'), nz); kind[i] = 1; }
            else if (o === COLD) { rgb = mix(base, plate, 0.55 + nz * 0.15); kind[i] = 3; }
            else {
                kind[i] = 0;
                rgb = o === POISON ? mix(bruise, life, 0.15) : o === GRANITE ? mix(slate, mist, 0.15) : m.cls[i] === PAPER ? mix(base, life, 0.35 + nz * 0.15) : m.cls[i] === ROCK ? mix(base, slate, 0.8) : mix(base, steel, 0.9);
            }
            col[i * 3] = rgb[0]; col[i * 3 + 1] = rgb[1]; col[i * 3 + 2] = rgb[2];
        }
    }

    /** Where the camera wants to look: our continent, or the middle of a seed's flight. */
    function aim(s, t) {
        const m = mapFor(s.seed, 4);
        let target = lonOf(m.start) + Math.sin(t * 0.05) * 0.5;
        const fl = (s.seeds && s.seeds.flying) || [];
        if (fl.length) {
            const f = fl[fl.length - 1];
            const a = lonOf(f.from), b = lonOf(f.to);
            let d = b - a; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
            target = a + d / 2;
        }
        if (view.lookAt != null) target = view.lookAt;
        if (view.rot == null) view.rot = target;
        // the shortest way round
        let d = target - view.rot;
        d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        view.rot += d * 0.02;
    }

    /** Draw the globe into ctx inside a square at (x, y) of size D. allRed 0..1 turns the whole world to flesh. */
    function render(ctx, s, now, rect, opts = {}) {
        if (!img) return;
        const t = now / 1000;
        colours(s);
        aim(s, t);
        const hb = beat(t);
        const d = img.data;
        const rot = view.rot;
        const red = opts.allRed || 0;
        const TWO = Math.PI * 2;
        for (let k = 0; k < N * N; k++) {
            if (!inside[k]) { d[k * 4 + 3] = 0; continue; }
            const lon = lon0[k] + rot;
            const u = ((lon + Math.PI) / TWO) % 1;
            const mx = Math.floor((u < 0 ? u + 1 : u) * MAP_W);
            const i = row[k] + mx;
            let r = col[i * 3], gg = col[i * 3 + 1], b = col[i * 3 + 2];
            const kd = kind[i];
            let li = light[k];
            if (kd === 2 || red > 0) {
                // flesh: fine vessels and the heartbeat
                const v = Math.abs(Math.sin(lon * 47 + Math.sin(lat0[k] * 39) * 2.2));
                const vein = v < 0.09 ? 1 : 0;
                const fr = kd === 2 ? 1 : red;
                const fr0 = 46 + 46 * (0.6 + 0.4 * hb), fg = 12, fb = 20;
                r = r * (1 - fr) + (fr0 + vein * (80 + 60 * hb)) * fr;
                gg = gg * (1 - fr) + (fg + vein * 24) * fr;
                b = b * (1 - fr) + (fb + vein * 30) * fr;
                li = li * 0.85 + 0.15;
            } else if (kd === 1) {
                // the sea shimmers a little where the light is
                const sh = Math.sin(lon * 60 + lat0[k] * 25 + t * 1.6) * Math.sin(lat0[k] * 41 - t * 0.9);
                if (sh > 0.82) { r += 18; gg += 26; b += 34; }
            }
            // storms: dark bands that drift
            const band = Math.sin(lat0[k] * 7 + lon * 2 - t * 0.35) + Math.sin(lon * 3 + t * 0.2);
            if (band > 1.45 && kd !== 3) li *= 0.62;
            d[k * 4] = r * li; d[k * 4 + 1] = gg * li; d[k * 4 + 2] = b * li; d[k * 4 + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        const { x, y, D } = rect;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(buf, x, y, D, D);
        // the rim: a thin atmosphere, warmer as the body grows
        const cxp = x + D / 2, cyp = y + D / 2, R = D / 2;
        const at = ctx.createRadialGradient(cxp, cyp, R * 0.92, cxp, cyp, R * 1.08);
        at.addColorStop(0, 'rgba(143,208,255,0)'); at.addColorStop(0.45, `rgba(${143 + red * 60},${208 - red * 150},${255 - red * 180},0.22)`); at.addColorStop(1, 'rgba(143,208,255,0)');
        ctx.fillStyle = at; ctx.beginPath(); ctx.arc(cxp, cyp, R * 1.08, 0, Math.PI * 2); ctx.fill();
        // the night side: a soft shadow
        const sh = ctx.createRadialGradient(cxp - R * 0.45, cyp - R * 0.5, R * 0.2, cxp, cyp, R * 1.02);
        sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.75, 'rgba(0,0,0,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cxp, cyp, R, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        drawSeeds(ctx, s, t, rect);
    }

    /** A screen point for (lat, lon), and whether it faces us. */
    function toScreen(lat, lon, rect, lift = 1) {
        const [px, py, pz] = project(lat, lon, view.rot, TILT, lift);
        return { x: rect.x + rect.D / 2 + px * rect.D / 2, y: rect.y + rect.D / 2 + py * rect.D / 2, front: pz > 0 };
    }
    /** The seeds in flight: red motes on an arc over the sea; the ones that landed a moment ago: a ring (grown) or a fading grey (lost). */
    function drawSeeds(ctx, s, t, rect) {
        const fl = (s.seeds && s.seeds.flying) || [];
        for (const f of fl) {
            const u = Math.min(1, (s.t - f.t0) / SEED_FLIGHT_S);
            const a = [latOf(f.from), lonOf(f.from)], b = [latOf(f.to), lonOf(f.to)];
            for (let q = 0; q < 6; q++) {
                const uu = Math.max(0, u - q * 0.03);
                const p = slerp(a, b, uu);
                const sc = toScreen(p[0], p[1], rect, 1 + 0.16 * Math.sin(Math.PI * uu));
                if (!sc.front) continue;
                ctx.fillStyle = q === 0 ? `rgba(255,80,96,${0.9})` : `rgba(168,19,44,${0.5 - q * 0.08})`;
                ctx.beginPath(); ctx.arc(sc.x, sc.y, q === 0 ? 3.2 : 2.2 - q * 0.25, 0, Math.PI * 2); ctx.fill();
            }
        }
        for (const l of s.landed || []) {
            const age = s.t - l.t;
            if (age > 4 || age < 0) continue;
            const sc = toScreen(latOf(l.to), lonOf(l.to), rect);
            if (!sc.front) continue;
            const grew = l.res === 'joined' || l.res === 'apart' || l.res === 'stuck';
            ctx.strokeStyle = grew ? `rgba(255,80,96,${1 - age / 4})` : `rgba(143,161,182,${1 - age / 4})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sc.x, sc.y, 4 + age * (grew ? 9 : 4), 0, Math.PI * 2); ctx.stroke();
        }
    }
    /** The way between two points on the sphere, u = 0..1. */
    function slerp(a, b, u) {
        const v = (p) => [Math.cos(p[0]) * Math.cos(p[1]), Math.cos(p[0]) * Math.sin(p[1]), Math.sin(p[0])];
        const A = v(a), B = v(b);
        const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
        const w = Math.acos(dot);
        if (w < 1e-4) return a;
        const sa = Math.sin((1 - u) * w) / Math.sin(w), sb = Math.sin(u * w) / Math.sin(w);
        const P = [A[0] * sa + B[0] * sb, A[1] * sa + B[1] * sb, A[2] * sa + B[2] * sb];
        return [Math.asin(P[2]), Math.atan2(P[1], P[0])];
    }
    /** Stars behind the globe (and, at the end, everywhere). */
    function drawStars(ctx, W, H, t, alpha = 0.6, shift = 0) {
        for (const [sx, sy, b] of stars) {
            const tw = 0.6 + 0.4 * Math.sin(t * (1 + b) + sx * 40);
            ctx.fillStyle = `rgba(241,239,232,${alpha * tw * (0.3 + b * 0.7)})`;
            ctx.fillRect(sx * W, ((sy * H + shift) % H + H) % H, 1 + b, 1 + b);
        }
    }
    /** Which continent is under a screen point (its land number, for a seed's target), or 0. */
    function landAt(s, px, py, rect) {
        const p = unproject((px - rect.x) / (rect.D / 2) - 1, (py - rect.y) / (rect.D / 2) - 1, view.rot);
        if (!p) return 0;
        const m = mapFor(s.seed, 4);
        const i = cellAtLatLon(p.lat, p.lon);
        return m.land[i] || 0;
    }
    return { render, drawStars, landAt, toScreen, view, buffer: buf };
}
