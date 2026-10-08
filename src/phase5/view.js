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
import { MAP_W, MAP_H, CELLS, cx, cy, neighbours, mapFor, stormAt, ROCK, PAPER, POISON, GRANITE, SEA, COLD, RIVER } from './terrain.js';
import { cache, front, share } from './unity.js';
import { VT } from './style.js';

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
        ground = null; body = null;
    }

    const centre = (i) => [geo.x + (cx(i) + 0.5) * geo.cs, geo.y + (cy(i) + 0.5) * geo.cs];
    function cellAt(px, py) {
        if (!geo) return -1;
        const x = Math.floor((px - geo.x) / geo.cs), y = Math.floor((py - geo.y) / geo.cs);
        return x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? -1 : y * MAP_W + x;
    }

    // ---------------------------------------------------------------- the ground
    function paintGround(s) {
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

    /** The body's layer: membrane, tissue, vessels; and where the edge and the organs are. */
    function paintBody(s) {
        const c = cache(s), m = mapFor(s.seed, s.scale), cs = geo.cs;
        const o = offscreen(geo.w, geo.h);
        const g = o.g;
        if (!tissue) tissue = makeTissue();
        const cells = s.order;
        const lx = (i) => (cx(i) + 0.5) * cs, ly = (i) => (cy(i) + 0.5) * cs;
        // membrane, then tissue a little inside it: the union of discs reads as one soft mass
        g.fillStyle = VT.fDark;
        g.beginPath();
        for (const i of cells) { g.moveTo(lx(i) + cs * 0.82, ly(i)); g.arc(lx(i), ly(i), cs * 0.82, 0, Math.PI * 2); }
        g.fill();
        g.fillStyle = tissue;
        g.beginPath();
        for (const i of cells) { g.moveTo(lx(i) + cs * 0.7, ly(i)); g.arc(lx(i), ly(i), cs * 0.7, 0, Math.PI * 2); }
        g.fill();
        // the edge cells (body next to ground) and the interior
        const edge = [], inner = [];
        for (const i of cells) {
            let n = 0;
            for (const j of neighbours(i)) n += c.eaten[j];
            (n < neighbours(i).length ? edge : inner).push(i);
        }
        // vessels: from the heart out to the edge, branching a little
        const heart = cells.length ? cells[0] : m.start;
        const hx = lx(heart), hy = ly(heart);
        const R = rng(cells.length * 0.13 + s.scale);
        const pick = edge.slice().sort((a, b) => Math.atan2(ly(a) - hy, lx(a) - hx) - Math.atan2(ly(b) - hy, lx(b) - hx));
        const N = Math.min(pick.length, 16);
        const vessels = [];
        for (let k = 0; k < N; k++) {
            const tgt = pick[Math.floor((k / N) * pick.length)];
            const tx = lx(tgt), ty = ly(tgt);
            const pts = [[hx, hy]];
            const steps = Math.max(3, Math.round(Math.hypot(tx - hx, ty - hy) / (cs * 1.5)));
            for (let st = 1; st <= steps; st++) {
                const u = st / steps;
                const j = (1 - Math.abs(u - 0.5) * 2) * cs * 0.9;
                pts.push([hx + (tx - hx) * u + (R() - 0.5) * j, hy + (ty - hy) * u + (R() - 0.5) * j]);
            }
            vessels.push({ pts, wid: Math.max(1.2, Math.min(3.4, cs * 0.22)), delay: R() });
        }
        g.lineJoin = 'round'; g.lineCap = 'round';
        for (const v of vessels) {
            const path = () => { g.beginPath(); g.moveTo(v.pts[0][0], v.pts[0][1]); for (const p of v.pts) g.lineTo(p[0], p[1]); };
            path(); g.strokeStyle = VT.fArtery; g.lineWidth = v.wid + 2; g.stroke();
            path(); g.strokeStyle = VT.fCore; g.lineWidth = v.wid; g.stroke();
            g.save(); g.translate(-v.wid * 0.25, -v.wid * 0.25);
            path(); g.strokeStyle = 'rgba(255,170,175,0.2)'; g.lineWidth = Math.max(0.5, v.wid * 0.25); g.stroke();
            g.restore();
        }
        // where the organs sit (seeded among the inner cells; nails and ears on the edge)
        const spots = inner.slice().sort((a, b) => hash(a * 1.7 + s.scale) - hash(b * 1.7 + s.scale));
        const edgeSpots = edge.slice().sort((a, b) => hash(a * 2.3) - hash(b * 2.3));
        const organs = [];
        let k = 0;
        const want = (o2, max) => (s.unlocked[o2] ? Math.max(1, Math.min(max, Math.round(share(s, o2) * 40))) : 0);
        for (const [o2, max] of [['eyes', 8], ['brain', 4], ['intestines', 3], ['lungs', 3], ['stomach', 2], ['muscle', 4], ['fat', 5], ['bone', 4]]) {
            const n = want(o2, max);
            for (let q = 0; q < n && k < spots.length; q++) organs.push({ o: o2, i: spots[k++], seed: hash(k * 3.1) });
        }
        let e = 0;
        for (const [o2, max] of [['nails', 14], ['ears', 4]]) {
            const n = want(o2, max);
            for (let q = 0; q < n && e < edgeSpots.length; q++) organs.push({ o: o2, i: edgeSpots[e++], seed: hash(e * 5.7) });
        }
        // intestines: a winding path through neighbouring inner cells (a walk, seeded)
        for (const org of organs) {
            if (org.o !== 'intestines') continue;
            const walk = [org.i];
            let cur = org.i;
            const R2 = rng(org.i + 0.5);
            for (let st = 0; st < 10; st++) {
                const nb = neighbours(cur).filter((j) => c.eaten[j] && !walk.includes(j));
                if (!nb.length) break;
                cur = nb[Math.floor(R2() * nb.length)];
                walk.push(cur);
            }
            org.walk = walk.map((j) => [lx(j) + (R2() - 0.5) * cs * 0.4, ly(j) + (R2() - 0.5) * cs * 0.4]);
        }
        // the far points of the body, for the camera of the zoom
        let sx = 0, sy = 0;
        for (const i of cells) { sx += lx(i); sy += ly(i); }
        const n = Math.max(1, cells.length);
        return { c: o.c, vessels, edge, organs, heart: [hx, hy], mid: [sx / n, sy / n] };
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
            const v = stormAt(m, i, s.t, s.scale);
            if (v > 0) any = true;
            d[i * 4] = 4; d[i * 4 + 1] = 5; d[i * 4 + 2] = 8; d[i * 4 + 3] = Math.round(v * 205);
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
            if (i < 0 || stormAt(m, i, s.t, s.scale) < 0.3) continue;
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
                const path = () => { ctx.beginPath(); ctx.moveTo(org.walk[0][0] + geo.x, org.walk[0][1] + geo.y); for (const p of org.walk) ctx.lineTo(p[0] + geo.x, p[1] + geo.y); };
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                path(); ctx.strokeStyle = VT.fDark; ctx.lineWidth = cs * 0.55; ctx.stroke();
                path(); ctx.strokeStyle = rgba(VT.fMuscle, 1); ctx.lineWidth = cs * 0.4; ctx.stroke();
                path(); ctx.strokeStyle = 'rgba(255,170,175,0.16)'; ctx.lineWidth = cs * 0.12; ctx.stroke();
                // food moving one way
                const u = (t * 0.35 + org.seed) % 1;
                const f = u * (org.walk.length - 1), k = Math.floor(f), w = f - k;
                const a = org.walk[k], b = org.walk[Math.min(org.walk.length - 1, k + 1)];
                ctx.fillStyle = rgba(VT.lamp, 0.55);
                ctx.beginPath(); ctx.arc(geo.x + a[0] + (b[0] - a[0]) * w, geo.y + a[1] + (b[1] - a[1]) * w, cs * 0.16, 0, Math.PI * 2); ctx.fill();
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
                ctx.fillStyle = rgba(VT.lamp, 0.28);
                ctx.beginPath(); ctx.ellipse(x, y, r * 0.9, r * 0.7, org.seed, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = rgba(VT.lamp, 0.18);
                ctx.beginPath(); ctx.ellipse(x + r * 0.4, y + r * 0.2, r * 0.6, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'bone': {
                ctx.strokeStyle = rgba(VT.fBone, 0.75); ctx.lineWidth = cs * 0.16; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(x, y + r, r * 1.4, Math.PI * 1.15 + org.seed, Math.PI * 1.85 + org.seed); ctx.stroke();
                break;
            }
            case 'nails': {
                // a hard plate at the edge, facing out
                ctx.save(); ctx.translate(x, y); ctx.rotate(org.seed * 6.28);
                ctx.fillStyle = rgba(VT.plate, 0.85); ctx.beginPath(); ctx.roundRect(-r * 0.6, -r * 0.4, r * 1.2, r * 0.8, r * 0.25); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.2); ctx.lineTo(r * 0.3, -r * 0.25); ctx.stroke();
                ctx.restore();
                break;
            }
            case 'ears': {
                ctx.strokeStyle = rgba(VT.fBone, 0.6); ctx.lineWidth = 1.2;
                for (let q = 1; q <= 3; q++) { ctx.beginPath(); ctx.arc(x, y, r * 0.3 * q, -0.8 + org.seed * 3, 1.4 + org.seed * 3); ctx.stroke(); }
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
        const gk = `${s.scale}|${s.seed}|${geo.w}x${geo.h}|${dpr}`;
        if (!ground || ground.key !== gk) ground = { key: gk, c: paintGround(s) };
        ctx.drawImage(ground.c, geo.x, geo.y, geo.w, geo.h);
        // the body, redrawn when it has grown (at most four times a second)
        const bk = `${s.scale}|${s.order.length}|${s.order[s.order.length - 1]}|${geo.cs}|${Object.keys(s.unlocked).length}|${Math.round(share(s, 'eyes') * 40)}|${Math.round(share(s, 'nails') * 40)}|${Math.round(share(s, 'brain') * 40)}`;
        if (!body || (body.key !== bk && now - body.at > 250)) body = { key: bk, at: now, ...paintBody(s) };
        stepStorm(s, now);
        const hb = beat(t);
        ctx.drawImage(body.c, geo.x, geo.y, geo.w, geo.h);
        // the heart: a dark knot that beats where the body came up
        const [hx, hy] = [geo.x + body.heart[0], geo.y + body.heart[1]];
        const hr = geo.cs * (0.9 + hb * 0.18) * Math.min(2.2, 1 + share(s, 'heart') * 3);
        const rg = ctx.createRadialGradient(hx, hy, 1, hx, hy, hr * 1.6);
        rg.addColorStop(0, rgba(VT.pulse, 0.55 + hb * 0.35)); rg.addColorStop(0.5, rgba(VT.fCore, 0.5)); rg.addColorStop(1, rgba(VT.fCore, 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.6, 0, Math.PI * 2); ctx.fill();
        // the pulse running out along the vessels to the edge
        pulses(body.vessels, t, 0.55 + 0.45 * hb);
        // the edge: a red line of light that breathes with the heart; brighter where it eats
        ctx.save();
        ctx.strokeStyle = rgba(VT.pulse, 0.22 + 0.3 * hb); ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (const i of body.edge) { const [x, y] = centre(i); ctx.moveTo(x + geo.cs * 0.78, y); ctx.arc(x, y, geo.cs * 0.78, 0, Math.PI * 2); }
        ctx.stroke();
        if (s.ex && s.ex.auto) {
            for (const i of front(s, 6)) {
                const [x, y] = centre(i);
                const gl = ctx.createRadialGradient(x, y, 1, x, y, geo.cs * 1.1);
                gl.addColorStop(0, `rgba(255,80,96,${0.35 + 0.35 * hb})`); gl.addColorStop(1, 'rgba(255,80,96,0)');
                ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, geo.cs * 1.1, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
        ui.organScale = Math.max(1, Math.min(2.6, Math.sqrt(s.order.length) / 12));
        for (const org of body.organs) organ(org, t, hb, s, ui);
        drawStorm(s, t);
        drawMarks(s, ui, t, hb);
        drawEffects(now);
    }

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
    /** The camera pulls out (ms): the map shrinks around the body until the body is a dot. */
    function startZoom(ms, ratio) {
        const snap = offscreen(W, H);
        snap.g.drawImage(canvas, 0, 0, W, H);
        const from = body ? [geo.x + body.mid[0], geo.y + body.mid[1]] : [geo.x + geo.w / 2, geo.y + geo.h / 2];
        view.busy = true;
        return new Promise((resolve) => { zoom = { t0: performance.now(), ms, snap: snap.c, from, ratio: ratio || 10, resolve }; });
    }
    function drawZoom(now) {
        const u = Math.min(1, (now - zoom.t0) / zoom.ms);
        const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        const k = 1 / (1 + (zoom.ratio - 1) * e);
        const [fx, fy] = zoom.from;
        const tx = fx + (geo.x + geo.w / 2 - fx) * e, ty = fy + (geo.y + geo.h / 2 - fy) * e;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = VT.ink; ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.translate(tx, ty); ctx.scale(k, k); ctx.translate(-fx, -fy);
        ctx.globalAlpha = 1;
        ctx.drawImage(zoom.snap, 0, 0, W, H);
        ctx.restore();
        // the body becomes a dot: a red point that beats where it was
        const hb = beat(now / 1000);
        ctx.fillStyle = rgba(VT.pulse, Math.min(1, e * 1.5) * (0.6 + 0.4 * hb));
        ctx.beginPath(); ctx.arc(tx, ty, 2 + 3 * e + hb * 1.5, 0, Math.PI * 2); ctx.fill();
        if (u >= 1) {
            const r = zoom.resolve;
            zoom = null; view.busy = false; body = null; ground = null;
            r();
        }
    }

    function setPointer(x, y) { pointer.x = x; pointer.y = y; }
    function cellCentre(i) { return geo ? centre(i) : [0, 0]; }

    resize();
    return Object.assign(view, { resize, frame, cellAt, cellCentre, addBite, startZoom, setPointer, get geo() { return geo; }, get edgeCells() { return body ? body.edge : []; } });
}
