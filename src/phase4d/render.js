/**
 * Chapter IV · THE DEEP, the dig: the picture. Canvas 2D, one frame at a time, only the tiles in
 * view. On top the ruined city under a storm and the base with its pods; below, the ground in its
 * layers, dark outside the lamp's circle; the drone; the flesh that breathes; the heart.
 */

import { W, H, T, HEART, layerIndexOf } from './world.js';
import { lampRadius, radarRange, isOre, SLEEPERS, HOME_X } from './dig.js';

export const TS = 32;
export const RISE_S = 5;
const BASE_X0 = 7, BASE_X1 = 16;          // the base's tiles, on the surface
// per layer: the ground's two tones and a mark colour
const PAL = [
    { a: '#3a3633', b: '#2d2a28', m: '#5c5650', soil: '#4a3f35' },      // city: concrete, rebar
    { a: '#3b2c24', b: '#2e221c', m: '#7a4a2a', soil: '#45332a' },      // war: rust
    { a: '#34373b', b: '#2a2c30', m: '#55595f', soil: '#3b3e42' },      // old rock: grey, fossils
    { a: '#22282c', b: '#1a1f22', m: '#3f6b5a', soil: '#2a3034' },      // the machine: boards, gears
    { a: '#3d1a17', b: '#2f1311', m: '#8a2c1f', soil: '#4a1f1a' },      // warm: dark red, veins
    { a: '#5a1f2a', b: '#45161f', m: '#a8132c', soil: '#5a1f2a' },      // flesh
];
const ORE_COL = { [T.ROCK]: '#9fd8e8', [T.PAPER]: '#efe6c8', [T.SCISSORS]: '#9fe3ff', [T.BIO]: '#ff4d6d' };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** The ruins on the skyline, made once. */
function makeSkyline(seed) {
    const out = [];
    let x = -200, i = 0;
    while (x < 4000) {
        const w = 30 + hash(i, seed) * 90, h = 40 + hash(seed, i) * 170;
        out.push({ x, w, h, broken: hash(i, i + seed) > 0.5 });
        x += w + hash(i + 3, seed) * 20; i++;
    }
    return out;
}

export function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    const skyline = makeSkyline(7);
    const sparks = [];
    let flash = 0, flashAt = 4;
    const r = { cam: { x: 0, y: -6 * TS }, originX: 0, ending: 0, rising: null };
    const pops = [];
    /** A number that floats up from the drone: a find's worth. */
    function pop(text, col = '#f2d98a', big = true, sub = '') { pops.push({ text, col, big, sub, life: 2.2 }); }
    /** RISE: the red mass climbs from the heart to the city in RISE_S seconds. */
    function rise() { r.rising = 0; }
    function riseY() { const k = Math.min(1, (r.rising || 0) / (RISE_S * 0.8)); const e = k * k * (3 - 2 * k); return HEART.cy + (-6 - HEART.cy) * e; }

    function resize() {
        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        canvas.width = Math.floor(canvas.clientWidth * dpr);
        canvas.height = Math.floor(canvas.clientHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Dust and sparks where the drill bites. */
    function burst(x, y, col, n = 6) {
        for (let i = 0; i < n && sparks.length < 80; i++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 80, life: 0.5 + Math.random() * 0.4, col });
    }

    /** Where the drone is on the screen (for the mouse). */
    function screenOf(s, view) {
        const p = dronePos(s);
        return { x: r.originX + p.x * TS + TS / 2, y: p.y * TS + TS / 2 - r.cam.y, w: view.w, h: view.h };
    }
    function tileAtScreen(px, py) {
        return { x: Math.floor((px - r.originX) / TS), y: Math.floor((py + r.cam.y) / TS) };
    }

    function dronePos(s) {
        if (!s.act) return { x: s.x, y: s.y };
        const k = s.act.kind === 'dig' ? Math.max(0, (s.act.t / s.act.dur - 0.6) / 0.4) * 0.5 : s.act.t / s.act.dur;
        return { x: s.x + (s.act.tx - s.x) * k, y: s.y + (s.act.ty - s.y) * k };
    }

    function draw(s, dt, view) {
        const vw = view.w, vh = view.h;
        const left = view.left;                       // the panel's column
        r.originX = Math.round(left + Math.max(0, (vw - left - W * TS) / 2));
        const p = dronePos(s);
        // the camera: the drone a little above the middle; the sky shown at the top
        // at the end the camera goes up to the pods, then follows the red band down to the heart
        let focusY = p.y;
        let mid = 0.42;
        if (p.y >= 380) { focusY = HEART.cy - 0.5; mid = 0.5; }
        if (r.rising !== null) { focusY = riseY(); mid = 0.5; }
        else if (s.ended) {
            if (r.ending < 2.6) focusY = -3;
            else {
                const k = Math.min(1, (r.ending - 2.6) / 6);
                focusY = -1 + (HEART.cy + 0.5) * k;
                mid = 0.5;
            }
        }
        // the bottom may scroll past the world's end, so the heart can sit in the middle
        const want = Math.max(-8 * TS, Math.min((H + 6) * TS - vh * 0.5, focusY * TS - vh * mid));
        r.cam.y += (want - r.cam.y) * Math.min(1, dt * 6);
        if (Math.abs(want - r.cam.y) > vh && !(s.ended && r.ending > 2.6)) r.cam.y = want;
        if ((s.ended && r.ending > 2.6) || r.rising !== null) r.cam.y = want;
        const camY = r.cam.y;
        const t = s.time;
        const deep = p.y * 5;                            // metres, roughly
        const mad = deep > 700 ? Math.min(1, (deep - 700) / 1000) : 0;

        // ---- the sky and the city, when in view
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, vw, vh);
        const groundY = -camY;                            // screen y of row 0's top
        if (groundY > 0) {
            const g = ctx.createLinearGradient(0, groundY - 8 * TS, 0, groundY);
            g.addColorStop(0, '#11151c'); g.addColorStop(0.7, '#2a2f38'); g.addColorStop(1, '#3a3d42');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, vw, groundY);
            // the storm: a flash now and then
            flashAt -= dt;
            if (flashAt <= 0) { flash = 1; flashAt = 5 + Math.random() * 9; }
            if (flash > 0) { ctx.fillStyle = `rgba(200,210,230,${(flash * 0.25).toFixed(3)})`; ctx.fillRect(0, 0, vw, groundY); flash -= dt * 3; }
            // the ruins
            ctx.fillStyle = '#0c0f14';
            for (const b of skyline) {
                const bx = b.x - 200, by = groundY - TS - b.h;
                if (bx > vw || bx + b.w < 0) continue;
                ctx.beginPath();
                ctx.moveTo(bx, groundY - TS);
                ctx.lineTo(bx, by + (b.broken ? 18 : 0));
                ctx.lineTo(bx + b.w * 0.4, by);
                ctx.lineTo(bx + b.w * 0.6, by + (b.broken ? 26 : 0));
                ctx.lineTo(bx + b.w, by + 6);
                ctx.lineTo(bx + b.w, groundY - TS);
                ctx.fill();
            }
            // rain
            ctx.strokeStyle = 'rgba(150,170,190,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 70; i++) {
                const rx = (hash(i, 1) * vw + t * 60 * (1 + hash(i, 2))) % vw;
                const ry = (hash(i, 3) * groundY + t * 500 * (0.7 + hash(i, 4))) % Math.max(1, groundY);
                ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 10);
            }
            ctx.stroke();
            drawBase(s, groundY);
        }

        // ---- the ground, only the rows in view
        const y0 = Math.max(0, Math.floor(camY / TS)), y1 = Math.min(H - 1, Math.ceil((camY + vh) / TS));
        // the walls left and right of the 24 columns
        if (y1 >= y0) {
            const top = Math.max(0, groundY);
            ctx.fillStyle = '#08090b';
            ctx.fillRect(0, top, r.originX, vh - top);
            ctx.fillRect(r.originX + W * TS, top, vw - r.originX - W * TS, vh - top);
        }
        for (let y = y0; y <= y1; y++) {
            const li = layerIndexOf(y);
            const pal = PAL[li];
            const sy = y * TS - camY;
            for (let x = 0; x < W; x++) {
                const tt = s.tiles[y * W + x];
                const sx = r.originX + x * TS;
                if (tt === T.AIR) {
                    ctx.fillStyle = li === 5 ? '#1a0a0e' : '#0d0e10';
                    ctx.fillRect(sx, sy, TS, TS);
                    continue;
                }
                drawTile(tt, x, y, sx, sy, pal, li, t, mad);
            }
        }

        // ---- the heart, big, under everything else it touches
        const hy = HEART.cy * TS - camY, hx = r.originX + HEART.cx * TS;
        if (hy - 6 * TS < vh) {
            const beat = 1 + 0.06 * Math.pow(Math.max(0, Math.sin(t * 3.2)), 8) + 0.03 * Math.pow(Math.max(0, Math.sin(t * 3.2 - 0.6)), 8);
            ctx.save();
            ctx.translate(hx, hy);
            ctx.scale(beat, beat);
            const hg = ctx.createRadialGradient(-20, -30, 10, 0, 0, HEART.rx * TS * 1.2);
            hg.addColorStop(0, '#d23a4f'); hg.addColorStop(0.6, '#8e1426'); hg.addColorStop(1, '#3a0610');
            ctx.fillStyle = hg;
            ctx.beginPath();
            ctx.ellipse(0, 0, HEART.rx * TS * 1.1, HEART.ry * TS * 1.25, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(40,0,8,0.7)'; ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(-60, -HEART.ry * TS); ctx.bezierCurveTo(-90, -140, -40, -200, -20, -260);
            ctx.moveTo(50, -HEART.ry * TS); ctx.bezierCurveTo(90, -150, 60, -210, 80, -270);
            ctx.stroke();
            ctx.restore();
        }

        // ---- the red band at the end, from the base down the way the drone came
        if (s.ended) {
            r.ending += dt;
            const k = Math.max(0, Math.min(1, (r.ending - 2.6) / 6));
            const pts = [{ x: HOME_X, y: -1 }, ...s.trail.map((i) => ({ x: i % W, y: Math.floor(i / W) })), { x: s.x, y: s.y + 1 }];
            const n = Math.min(pts.length, Math.max(2, Math.ceil(pts.length * k)));
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const q = pts[i];
                const qx = r.originX + q.x * TS + TS / 2, qy = q.y * TS + TS / 2 - camY;
                if (i === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
            }
            ctx.strokeStyle = 'rgba(255,40,70,0.25)'; ctx.lineWidth = 24; ctx.stroke();
            ctx.strokeStyle = '#c8142d'; ctx.lineWidth = 12; ctx.stroke();
            ctx.strokeStyle = `rgba(255,150,165,${(0.35 + 0.35 * Math.max(0, Math.sin(t * 3.2))).toFixed(3)})`; ctx.lineWidth = 3; ctx.stroke();
        }

        // ---- the dark: a circle of light around the drone; daylight near the top
        const dx = r.originX + p.x * TS + TS / 2, dy = p.y * TS + TS / 2 - camY;
        // daylight fades over the first 150 m, never all at once
        const u0 = Math.max(0, Math.min(1, (p.y + 1) / 30));
        const under = u0 * u0 * (3 - 2 * u0);
        if (under > 0 && !s.ended) {
            let rad = lampRadius(s) * TS * (1 + 2.2 * (1 - under));
            if (mad > 0) rad *= 1 - mad * 0.12 * (hash(Math.floor(t * 9), 5) > 0.8 ? 1 : 0);
            const g = ctx.createRadialGradient(dx, dy, rad * 0.35, dx, dy, rad);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(0,0,0,${(0.995 * under).toFixed(3)})`);
            ctx.fillStyle = g;
            const top = Math.max(0, groundY);
            ctx.fillRect(0, top, vw, vh - top);
            // the remembered map: what was dug stays faintly drawn in the dark
            ctx.fillStyle = 'rgba(150,170,195,0.10)';
            for (let y = Math.max(0, y0); y <= y1; y++) {
                for (let x = 0; x < W; x++) if (s.tiles[y * W + x] === T.AIR) ctx.fillRect(r.originX + x * TS + 3, y * TS - camY + 3, TS - 6, TS - 6);
            }
            // the way home, when the power is short: a faint dotted line along the open ground
            if (view.path && view.path.length > 1) {
                ctx.strokeStyle = 'rgba(255,220,150,0.55)';
                ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
                ctx.beginPath();
                view.path.forEach(([x, y], i) => { const px = r.originX + x * TS + TS / 2, py = y * TS + TS / 2 - camY; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
                ctx.stroke(); ctx.setLineDash([]);
            }
            // the radar: true ore as faint dots outside the light
            const rr = radarRange(s);
            if (rr > 0) {
                for (let y = Math.max(0, Math.floor(p.y - rr)); y <= Math.min(H - 1, Math.ceil(p.y + rr)); y++) {
                    for (let x = 0; x < W; x++) {
                        const tt = s.tiles[y * W + x];
                        const real = isOre(tt) || (tt === T.FIND && s.levels.radar >= 3);
                        if (!real) continue;
                        const d = Math.hypot(x - p.x, y - p.y);
                        if (d > rr || d < lampRadius(s) * 0.8) continue;
                        ctx.fillStyle = tt === T.FIND ? 'rgba(255,220,120,0.55)' : `rgba(${tt === T.BIO ? '255,90,110' : '140,220,255'},${(0.5 - 0.35 * d / rr).toFixed(3)})`;
                        ctx.fillRect(r.originX + x * TS + TS / 2 - 3, y * TS + TS / 2 - camY - 3, 6, 6);
                    }
                }
            }
        }

        // ---- the drone
        if (r.rising === null) drawDrone(s, dx, dy, t);
        // ---- what rises: the red mass climbs the shaft and breaks through the city
        if (r.rising !== null) {
            r.rising += dt;
            const by = riseY() * TS - camY, bx = r.originX + HOME_X * TS + TS / 2;
            const hy2 = HEART.cy * TS - camY;
            ctx.strokeStyle = '#a3102a'; ctx.lineWidth = 40; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(bx, hy2); ctx.lineTo(bx, by); ctx.stroke();
            const pulse = 1 + 0.08 * Math.sin(t * 9);
            const rg = ctx.createRadialGradient(bx, by, 6, bx, by, 70 * pulse);
            rg.addColorStop(0, '#ff5a6e'); rg.addColorStop(0.6, '#b0122d'); rg.addColorStop(1, 'rgba(90,6,20,0)');
            ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(bx, by, 70 * pulse, 0, Math.PI * 2); ctx.fill();
            const k = Math.max(0, (r.rising - RISE_S * 0.72) / (RISE_S * 0.28));
            if (k > 0) {                 // it breaks through: red over the ruins and the sky
                ctx.fillStyle = `rgba(150,10,30,${Math.min(0.85, k).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(bx, by, 80 + k * vw, 0, Math.PI * 2); ctx.fill();
            }
        }
        for (let i = pops.length - 1; i >= 0; i--) {
            const q = pops[i];
            q.life -= dt; if (q.life <= 0) { pops.splice(i, 1); continue; }
            ctx.globalAlpha = Math.min(1, q.life);
            ctx.font = `600 ${q.big ? 30 : 20}px "Bebas Neue", "Arial Narrow", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = q.col;
            ctx.fillText(q.text, dx, dy - 30 - (2.2 - q.life) * 30);
            if (q.sub) { ctx.font = '13px system-ui, sans-serif'; ctx.fillText(q.sub, dx, dy - 8 - (2.2 - q.life) * 30); }
            ctx.textAlign = 'left';
        }
        ctx.globalAlpha = 1;
        // dust
        for (let i = sparks.length - 1; i >= 0; i--) {
            const k = sparks[i];
            k.life -= dt; if (k.life <= 0) { sparks.splice(i, 1); continue; }
            k.vy += 220 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
            ctx.fillStyle = k.col; ctx.globalAlpha = Math.min(1, k.life * 2);
            ctx.fillRect(k.x - camY * 0 + 0, k.y - camY, 2, 2);
        }
        ctx.globalAlpha = 1;
        if (s.act && s.act.kind === 'dig' && Math.random() < 0.6) {
            burst(r.originX + (s.x + s.act.tx) / 2 * TS + TS / 2, ((s.y + s.act.ty) / 2) * TS + TS / 2, s.act.tile === T.FLESH || s.act.tile === T.SINEW ? '#c23048' : '#c9b79c', 1);
        }
    }

    function drawTile(tt, x, y, sx, sy, pal, li, t, mad) {
        const h = hash(x, y);
        let base = h < 0.5 ? pal.a : pal.b;
        if (tt === T.SOIL) base = pal.soil;
        if (tt === T.HARD) base = '#1f2226';
        if (tt === T.BASALT) base = '#131416';
        if (tt === T.SINEW) base = '#6e2a33';
        if (tt === T.HEART) base = '#5a0d1a';
        if (tt === T.FLESH || tt === T.BIO || li === 5) {
            const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 - y * 0.35 + x * 0.2);
            base = `rgb(${Math.round(80 + 30 * pulse)},${Math.round(22 + 6 * pulse)},${Math.round(34 + 8 * pulse)})`;
            if (tt === T.SINEW) base = `rgb(${Math.round(92 + 18 * pulse)},${Math.round(28 + 6 * pulse)},40)`;
        }
        ctx.fillStyle = base;
        ctx.fillRect(sx, sy, TS, TS);
        // texture: what the layer is made of
        ctx.fillStyle = pal.m;
        if (li === 0 && tt === T.STONE) {        // rubble: dull rock, nothing to want
            ctx.fillStyle = '#3f3c3a'; ctx.beginPath(); ctx.moveTo(sx + 4, sy + 26); ctx.lineTo(sx + 8, sy + 8); ctx.lineTo(sx + 22, sy + 5); ctx.lineTo(sx + 28, sy + 20); ctx.lineTo(sx + 20, sy + 28); ctx.fill();
            ctx.fillStyle = '#2c2a28'; ctx.fillRect(sx + 10, sy + 14, 4, 3); ctx.fillRect(sx + 18, sy + 18, 3, 3);
        }
        else if (li === 1 && h > 0.6) { ctx.fillRect(sx + h * 18, sy + 6, 8, 4); ctx.fillRect(sx + 6, sy + 18 + h * 6, 12, 3); }
        else if (li === 2 && h > 0.85) { ctx.strokeStyle = '#7a7d80'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 7, 0.3, 5.5); ctx.stroke(); }
        else if (li === 3) {
            if (h > 0.7) { ctx.fillRect(sx + 4, sy + 10, TS - 8, 2); ctx.fillRect(sx + 10, sy + 4, 2, TS - 8); ctx.fillStyle = '#c9a54a'; ctx.fillRect(sx + 9, sy + 9, 4, 4); }
            else if (h < 0.08) { ctx.strokeStyle = '#4b5258'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 9, 0, Math.PI * 2); ctx.stroke(); }
        } else if (li === 4 && h > 0.55) { ctx.strokeStyle = '#a3321f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, sy + h * TS); ctx.quadraticCurveTo(sx + 16, sy + 8, sx + TS, sy + (1 - h) * TS); ctx.stroke(); }
        else if (li === 5 && h > 0.7) { ctx.strokeStyle = 'rgba(30,0,8,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy + 10); ctx.bezierCurveTo(sx + 10, sy + 20, sx + 20, sy, sx + TS, sy + 22); ctx.stroke(); }
        if (tt === T.HARD || tt === T.BASALT) {
            ctx.strokeStyle = tt === T.BASALT ? '#2b2e33' : '#3a3e44'; ctx.lineWidth = 1;
            ctx.strokeRect(sx + 1.5, sy + 1.5, TS - 3, TS - 3);
            if (tt === T.BASALT) { ctx.beginPath(); ctx.moveTo(sx + 16, sy + 2); ctx.lineTo(sx + 16, sy + TS - 2); ctx.stroke(); }
        }
        // ore and the ore that is not there
        let ore = tt;
        if (tt === T.GHOST) {
            if (Math.sin(t * 1.3 + h * 40) < 0.2 - mad * 0.6) return;
            ore = h < 0.5 ? T.SCISSORS : T.PAPER;
        }
        if (ORE_COL[ore]) {
            drawOre(ore, sx, sy, h);
            // a glint that travels over it now and then: treasure
            const g = (t * 0.7 + h * 7) % 2.4;
            if (g < 0.35) {
                const a = Math.sin(g / 0.35 * Math.PI);
                ctx.fillStyle = `rgba(255,255,255,${(0.9 * a).toFixed(3)})`;
                const gx = sx + 10 + h * 12, gy = sy + 10 + (1 - h) * 8;
                ctx.fillRect(gx - 4 * a, gy - 0.75, 8 * a, 1.5); ctx.fillRect(gx - 0.75, gy - 4 * a, 1.5, 8 * a);
            }
        }
        if (tt === T.FIND) {
            ctx.fillStyle = '#e9c46a';
            ctx.fillRect(sx + 8, sy + 10, 16, 12);
            ctx.fillStyle = '#1b1b1b'; ctx.fillRect(sx + 11, sy + 14, 10, 2);
            ctx.strokeStyle = 'rgba(255,230,150,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(sx + 6.5, sy + 8.5, 19, 15);
        }
    }

    function drawOre(ore, sx, sy, h) {
        ctx.fillStyle = ORE_COL[ore];
        if (ore === T.ROCK) {           // pale blue crystals on a dark seat
            ctx.fillStyle = 'rgba(20,40,50,0.55)'; ctx.fillRect(sx + 6, sy + 22, 21, 4); ctx.fillStyle = ORE_COL[ore];
            ctx.beginPath(); ctx.moveTo(sx + 9, sy + 24); ctx.lineTo(sx + 13, sy + 9); ctx.lineTo(sx + 17, sy + 24); ctx.fill();
            ctx.beginPath(); ctx.moveTo(sx + 16, sy + 25); ctx.lineTo(sx + 21, sy + 12); ctx.lineTo(sx + 25, sy + 25); ctx.fill();
        } else if (ore === T.PAPER) {   // pale flakes, old paper in the stone
            ctx.save(); ctx.translate(sx + 16, sy + 16); ctx.rotate(h - 0.5);
            ctx.fillRect(-9, -7, 14, 9); ctx.fillStyle = '#cfc3a0'; ctx.fillRect(-3, -1, 12, 8);
            ctx.fillStyle = '#7d7462'; ctx.fillRect(-1, 2, 8, 1); ctx.restore();
        } else if (ore === T.SCISSORS) { // bright shards
            ctx.beginPath(); ctx.moveTo(sx + 6, sy + 20); ctx.lineTo(sx + 22, sy + 8); ctx.lineTo(sx + 14, sy + 22); ctx.fill();
            ctx.beginPath(); ctx.moveTo(sx + 14, sy + 26); ctx.lineTo(sx + 27, sy + 14); ctx.lineTo(sx + 22, sy + 27); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 18, sy + 11, 2, 2);
        } else {                        // a knot of flesh, red
            ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd0d8'; ctx.beginPath(); ctx.arc(sx + 14, sy + 14, 2, 0, Math.PI * 2); ctx.fill();
        }
    }

    function drawBase(s, groundY) {
        const bx = r.originX + BASE_X0 * TS, bw = (BASE_X1 - BASE_X0 + 1) * TS;
        const top = groundY - TS - 4 * TS;
        // the surface walkway
        ctx.fillStyle = '#1b1e23';
        ctx.fillRect(r.originX, groundY - 4, W * TS, 4);
        // the base: a low bunker with the pods' windows
        ctx.fillStyle = '#1d2229';
        ctx.fillRect(bx, top, bw, 4 * TS - 6);
        ctx.fillStyle = '#262c35';
        ctx.fillRect(bx - 6, top - 6, bw + 12, 8);
        // 216 windows: 24 by 9
        const cols = 24, pitch = 10;   // nine rows
        const wx = bx + (bw - cols * pitch) / 2, wy = top + 14;
        const dark = new Set(s.dark);
        const emptied = s.ended ? Math.floor(Math.min(1, r.ending / 2.4) * SLEEPERS) : 0;
        for (let i = 0; i < SLEEPERS; i++) {
            const pod = i + 1;
            const cx = wx + (i % cols) * pitch, cy = wy + Math.floor(i / cols) * pitch;
            let col = s.dreaming ? '#d33a4a' : '#5fb4ff';
            if (dark.has(pod) || i < emptied) col = '#14181d';
            ctx.fillStyle = col;
            ctx.fillRect(cx, cy, 6, 6);
        }
        // the hatch
        ctx.fillStyle = '#0d1014';
        ctx.fillRect(r.originX + HOME_X * TS + 4, groundY - TS - 2, TS - 8, TS - 2);
        // the store and the workshop: two signs
        ctx.font = '600 11px "Bebas Neue", "Arial Narrow", sans-serif';
        ctx.fillStyle = '#8fa1b6';
        ctx.fillText('STORE', bx + 4, top + 4 * TS - 12);
        ctx.fillText('WORKSHOP', bx + bw - 52, top + 4 * TS - 12);
    }

    function drawDrone(s, dx, dy, t) {
        const g = s.grafts;
        const body = g === 0 ? '#b8c0c8' : g === 1 ? '#c9a9a0' : g === 2 ? '#b77a7a' : '#a54a58';
        ctx.save();
        ctx.translate(dx, dy);
        ctx.scale(1.5, 1.5);
        // the lamp's beam forward
        ctx.fillStyle = 'rgba(255,240,200,0.10)';
        ctx.beginPath(); ctx.moveTo(s.face * 8, -2); ctx.lineTo(s.face * 60, -22); ctx.lineTo(s.face * 60, 18); ctx.fill();
        ctx.fillStyle = body;
        ctx.fillRect(-11, -9, 22, 15);
        ctx.fillStyle = '#2a3038';
        ctx.fillRect(-11, 6, 22, 4);
        ctx.fillStyle = g >= 2 ? '#7a2030' : '#556070';
        ctx.fillRect(-7, -6, 8, 6);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(s.face > 0 ? 8 : -11, -5, 3, 4);
        // the drill: steel, then bone
        ctx.fillStyle = g >= 1 ? '#e8dcc8' : '#7d8794';
        const dir = s.act && s.act.kind === 'dig' ? { x: s.act.tx - s.x, y: s.act.ty - s.y } : { x: 0, y: 1 };
        const wob = s.act && s.act.kind === 'dig' ? Math.sin(t * 60) * 1.5 : 0;
        ctx.beginPath();
        if (dir.y > 0) { ctx.moveTo(-6 + wob, 10); ctx.lineTo(6 + wob, 10); ctx.lineTo(wob, 18); }
        else { const sx = dir.x; ctx.moveTo(sx * 11, -6 + wob); ctx.lineTo(sx * 11, 4 + wob); ctx.lineTo(sx * 19, -1 + wob); }
        ctx.fill();
        if (g >= 3) { ctx.strokeStyle = '#d33a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-11, -2); ctx.bezierCurveTo(-4, -10, 4, 6, 11, -3); ctx.stroke(); }
        ctx.restore();
    }

    return { draw, resize, burst, screenOf, tileAtScreen, r, pop, rise, worldWidth: W * TS };
}
