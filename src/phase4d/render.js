/**
 * Chapter IV · THE DEEP, the dig: the picture. Canvas 2D, only the tiles in view. On top the ruined
 * city in the storm, a shaft down through the rock, and the base under the ground (pass 3, B): six cryo
 * chambers, the generator, the rooms the drone drives into. Below, the ground in its layers, dark
 * from the start outside the lamp's circle; the drone; the flesh that breathes; the heart.
 *
 * The owner's machine is slow: the base, the city and the ground (in chunks of 16 rows) are drawn once
 * into offscreen canvases and redrawn only when what they show changes; per frame only what moves.
 */

import { W, H, T, HEART, layerIndexOf, LAYERS } from './world.js';
import { lampRadius, isOre, SLEEPERS, HOME_X, pingShows, GPS, GPS_SHOW, shows, PRICE, BUILD_S } from './dig.js';
import { spotOf, REPAIR_S } from './alarms.js';
import { has, boosting, LAB_S } from './quantum.js';
import { ROOMS, ROOM_NAME, CHAMBERS, PER_CHAMBER, ROOM_TOP, CHAMBER_TOP, CITY_ROW, TOP_ROW, roomSpot } from './base.js';

export const TS = 32;
export const RISE_S = 5;
const CHUNK = 16;                          // rows of ground per cached canvas
const KEEP_CHUNKS = 6;
// the vault's palette (src/phase4v/style.js VT), the colours the base is drawn in
const C = {
    ink: '#07080a', stone: '#0b0d10', steel: '#12171e', steel2: '#1a2029', steel3: '#2a313b', slate: '#3a4350',
    mist: '#8fa1b6', plate: '#d5dbe3', paper: '#f1efe8', lamp: '#f2e2b8', cold: '#8fd0ff', amber: '#ffd678',
    danger: '#ff6b5a', pulse: '#a8132c',
};
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
    const main = canvas.getContext('2d');
    let ctx = main;
    const skyline = makeSkyline(7);
    let dpr = 1;
    const off = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * dpr)); c.height = Math.max(1, Math.ceil(h * dpr)); const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return { c, x }; };
    let baseCache = null, baseKey = '', cityCache = null;
    const chunks = new Map();             // chunk index -> { c, x, sum, used }
    const sparks = [];
    let flash = 0, flashAt = 4;
    const r = { cam: { x: 0, y: -6 * TS }, originX: 0, ending: 0, rising: null };
    const pops = [];
    const trail = [], labels = [];
    /** A name that floats over a tile for a few seconds. */
    function label(i, text) { labels.push({ i, text, life: 3.5 }); }
    /** Up into rock: a puff of dust over the drone. */
    function bump(s) {
        const p = dronePos(s);
        burst(r.originX + p.x * TS + TS / 2, p.y * TS - r.cam.y + 2, '#8f8676', 8);
    }
    /** A number that floats up from the drone: a find's worth. */
    function pop(text, col = '#f2d98a', big = true, sub = '') { pops.push({ text, col, big, sub, life: 2.2 }); }
    /** RISE: the red mass climbs from the heart to the city in RISE_S seconds. */
    function rise() { r.rising = 0; }
    function riseY() { const k = Math.min(1, (r.rising || 0) / (RISE_S * 0.8)); const e = k * k * (3 - 2 * k); return HEART.cy + (-6 - HEART.cy) * e; }

    function resize() {
        dpr = Math.min(1.5, window.devicePixelRatio || 1);
        canvas.width = Math.floor(canvas.clientWidth * dpr);
        canvas.height = Math.floor(canvas.clientHeight * dpr);
        main.setTransform(dpr, 0, 0, dpr, 0, 0);
        baseCache = null; baseKey = ''; cityCache = null; chunks.clear();
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
        // at the base: the whole base in view, the city faint at the top
        if (p.y < 0) { focusY = (CHAMBER_TOP + 1) / 2 + 0.3; mid = 0.45; }
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
        const want = Math.max(TOP_ROW * TS, Math.min((H + 6) * TS - vh * 0.5, focusY * TS - vh * mid));
        r.cam.y += (want - r.cam.y) * Math.min(1, dt * 6);
        if (Math.abs(want - r.cam.y) > vh && !(s.ended && r.ending > 2.6)) r.cam.y = want;
        if ((s.ended && r.ending > 2.6) || r.rising !== null) r.cam.y = want;
        const camY = r.cam.y;
        const t = s.time;
        const deep = p.y * 5;                            // metres, roughly
        const mad = deep > 700 ? Math.min(1, (deep - 700) / 1000) : 0;

        // ---- the void; the city and the base are drawn after the dark (they have their own light)
        ctx.fillStyle = C.ink;
        ctx.fillRect(0, 0, vw, vh);
        const groundY = -camY;                            // screen y of row 0's top: the base's floor

        // ---- the ground, only the rows in view
        const y0 = Math.max(0, Math.floor(camY / TS)), y1 = Math.min(H - 1, Math.ceil((camY + vh) / TS));
        // the walls left and right of the 24 columns
        if (y1 >= y0) {
            const top = Math.max(0, groundY);
            ctx.fillStyle = '#08090b';
            ctx.fillRect(0, top, r.originX, vh - top);
            ctx.fillRect(r.originX + W * TS, top, vw - r.originX - W * TS, vh - top);
        }
        // the ground from its cached chunks, then what moves on it (glints, ghosts, the flesh's breath)
        for (let c = Math.floor(y0 / CHUNK); c <= Math.floor(y1 / CHUNK) && y1 >= y0; c++) {
            const ch = chunk(s, c);
            ctx.drawImage(ch.c, r.originX, c * CHUNK * TS - camY, W * TS, CHUNK * TS);
        }
        for (let y = y0; y <= y1; y++) {
            const li = layerIndexOf(y);
            const sy = y * TS - camY;
            for (let x = 0; x < W; x++) {
                const tt = s.tiles[y * W + x];
                if (tt === T.AIR) continue;
                const sx = r.originX + x * TS;
                if (li === 5 || tt === T.FLESH) {
                    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 - y * 0.35 + x * 0.2);
                    ctx.fillStyle = `rgba(255,70,90,${(0.1 * pulse).toFixed(3)})`;
                    ctx.fillRect(sx, sy, TS, TS);
                }
                if (isOre(tt)) glint(sx, sy, hash(x, y), t);
                if (tt === T.MAGMA) { ctx.fillStyle = `rgba(255,120,30,${(0.15 + 0.15 * Math.sin(t * 3 + x + y)).toFixed(3)})`; ctx.fillRect(sx, sy, TS, TS); }
                else if (tt === T.GHOST) {
                    const h = hash(x, y);
                    if (Math.sin(t * 1.3 + h * 40) >= 0.2 - mad * 0.6) { drawOre(h < 0.5 ? T.SCISSORS : T.PAPER, sx, sy, h); glint(sx, sy, h, t); }
                }
            }
        }

        // ---- running magma over the open ground; the dust of a roof that is moving
        if (s.lava) {
            for (const k of Object.keys(s.lava)) {
                const i = Number(k), yy = Math.floor(i / W);
                if (yy < y0 || yy > y1) continue;
                const age = s.lava[k], cool = Math.min(1, age / 20);
                const lx = r.originX + (i % W) * TS, ly = yy * TS - camY;
                ctx.fillStyle = `rgb(${Math.round(255 - 120 * cool)},${Math.round(110 - 70 * cool)},${Math.round(20 + 10 * cool)})`;
                ctx.fillRect(lx, ly + 6, TS, TS - 6);
                ctx.fillStyle = 'rgba(255,220,120,0.5)';
                ctx.fillRect(lx + ((t * 20 + i) % TS), ly + 8, 6, 2);
            }
        }
        for (const c of s.caves || []) {
            const cy = c.y * TS - camY;
            for (let k = 0; k < 6; k++) {
                const dx2 = r.originX + (c.x0 + hash(k, Math.floor(performance.now() / 120)) * (c.x1 - c.x0 + 1)) * TS;
                ctx.fillStyle = 'rgba(190,180,160,0.7)';
                ctx.fillRect(dx2, cy + ((performance.now() / 4 + k * 37) % TS), 2, 3);
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
        // dark from the start (pass 3): only the base's lamps and the drone's
        const under = 1;
        if (!s.ended) {
            // no drone (lost, or not yet built): no lamp
            let rad = s.lost || s.build > 0 ? 4 : lampRadius(s) * TS;
            if (mad > 0) rad *= 1 - mad * 0.12 * (hash(Math.floor(t * 9), 5) > 0.8 ? 1 : 0);
            const top = Math.max(0, groundY + CITY_ROW * TS);
            ctx.save();
            ctx.beginPath(); ctx.rect(0, top, vw, vh - top); ctx.clip();
            // the SECOND LAMP: the circle of light becomes an oval that reaches down
            const two = has(s, 'lamp2') && p.y >= 0;
            ctx.translate(dx, dy + (two ? rad * 0.8 : 0));
            if (two) ctx.scale(1, 1.8);
            const g = ctx.createRadialGradient(0, 0, rad * 0.45, 0, 0, rad);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(0,0,0,${(0.995 * under).toFixed(3)})`);
            ctx.fillStyle = g;
            ctx.fillRect(-vw * 2, -vh * 2, vw * 4, vh * 4);
            ctx.restore();
            // MAPPING: what the lamp has lit stays as a dim mark in the dark
            if (s.levels.mapping > 0) {
                for (const i of s.seen) {
                    const yy = Math.floor(i / W);
                    if (yy < y0 || yy > y1) continue;
                    const tt = s.tiles[i];
                    if (!(isOre(tt) || tt === T.FIND)) continue;
                    ctx.fillStyle = tt === T.FIND ? 'rgba(255,214,120,0.35)' : tt === T.BIO ? 'rgba(255,90,110,0.35)' : 'rgba(160,225,255,0.3)';
                    const mx = r.originX + (i % W) * TS + TS / 2, my = yy * TS + TS / 2 - camY;
                    ctx.beginPath(); ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 5, my); ctx.lineTo(mx, my + 5); ctx.lineTo(mx - 5, my); ctx.fill();
                }
            }
            // magma glows: it lights the dark round it (a warning, not a trap)
            for (let y = Math.max(0, y0); y <= y1 && y1 >= y0; y++) {
                for (let x = 0; x < W; x++) {
                    const i = y * W + x;
                    if (s.tiles[i] !== T.MAGMA && !(s.lava && s.lava[i] !== undefined)) continue;
                    const gx = r.originX + x * TS + TS / 2, gy = y * TS + TS / 2 - camY;
                    const gl = ctx.createRadialGradient(gx, gy, 2, gx, gy, TS * 1.4);
                    gl.addColorStop(0, `rgba(255,120,40,${(0.35 + 0.1 * Math.sin(t * 3 + x)).toFixed(3)})`); gl.addColorStop(1, 'rgba(255,120,40,0)');
                    ctx.fillStyle = gl; ctx.fillRect(gx - TS * 1.4, gy - TS * 1.4, TS * 2.8, TS * 2.8);
                }
            }
            // what is not from here flickers faintly even in the dark
            for (let y = Math.max(0, y0); y <= y1 && y1 >= y0; y++) {
                for (let x = 0; x < W; x++) if (s.tiles[y * W + x] === T.QUANTUM) quantumTile(r.originX + x * TS, y * TS - camY, x, y, t);
            }
            // the remembered map: what was dug stays faintly drawn in the dark
            ctx.fillStyle = 'rgba(150,170,195,0.10)';
            for (let y = Math.max(0, y0); y <= y1 && y1 >= y0; y++) {
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
            // the GPS ping: a cone below, the ore and the finds in it for a few seconds
            const pg = s.ping;
            if (pg && s.time - pg.at < GPS_SHOW) {
                const age = s.time - pg.at, g = GPS[pg.lv];
                const fade = 1 - age / GPS_SHOW;
                const ox = r.originX + pg.x * TS + TS / 2, oy = pg.y * TS + TS / 2 - camY;
                const reach = g.range * TS * Math.min(1, age / 0.6);
                ctx.save();
                ctx.beginPath(); ctx.rect(r.originX, 0, W * TS, vh); ctx.clip();
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, reach, Math.PI / 2 - g.half, Math.PI / 2 + g.half); ctx.closePath();
                const cg = ctx.createRadialGradient(ox, oy, 4, ox, oy, g.range * TS);
                cg.addColorStop(0, `rgba(143,208,255,${(0.16 * fade).toFixed(3)})`); cg.addColorStop(1, 'rgba(143,208,255,0)');
                ctx.fillStyle = cg; ctx.fill();
                ctx.strokeStyle = `rgba(143,208,255,${(0.5 * fade).toFixed(3)})`; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(ox, oy, reach, Math.PI / 2 - g.half, Math.PI / 2 + g.half); ctx.stroke();
                ctx.restore();
                for (let y = pg.y; y <= Math.min(H - 1, pg.y + g.range); y++) {
                    for (let x = 0; x < W; x++) {
                        const tt = s.tiles[y * W + x];
                        if (!(isOre(tt) || tt === T.FIND || tt === T.MAGMA || tt === T.GAS) || !pingShows(s, x, y)) continue;
                        if (Math.hypot(x - pg.x, y - pg.y) * TS > reach) continue;
                        ctx.fillStyle = tt === T.MAGMA ? `rgba(255,120,40,${(0.9 * fade).toFixed(3)})` : tt === T.GAS ? `rgba(140,230,110,${(0.9 * fade).toFixed(3)})` : tt === T.FIND ? `rgba(255,214,120,${(0.9 * fade).toFixed(3)})` : tt === T.BIO ? `rgba(255,90,110,${(0.9 * fade).toFixed(3)})` : `rgba(160,225,255,${(0.9 * fade).toFixed(3)})`;
                        ctx.fillRect(r.originX + x * TS + TS / 2 - 4, y * TS + TS / 2 - camY - 4, 8, 8);
                    }
                }
            }
        }

        // ---- the depth ruler, right of the shaft: metres down, the layers marked once they are known
        if (shows(s, 'depth') && vw - (r.originX + W * TS) >= 64) drawRuler(s, vw, vh, camY, p);

        // ---- the city in the storm and the base with its own lamps, over the dark
        if (groundY + TOP_ROW * TS < vh && groundY > -2 * TS) {
            drawCity(groundY, vw, dt, t);
            drawBase(s, groundY, t, view);
        }

        // ---- the drone
        // ---- the wrecks: dark drones with dead lamps, where they were lost
        for (const w of s.wrecks || []) {
            const wy = w.y * TS + TS / 2 - camY;
            if (wy < -40 || wy > vh + 40) continue;
            const wx = r.originX + w.x * TS + TS / 2;
            ctx.save(); ctx.translate(wx, wy);
            ctx.fillStyle = w.looted ? '#15181d' : '#1f242b'; roundRect(-19, -13, 38, 26, 8); ctx.fill();
            ctx.fillStyle = '#2c323a'; roundRect(-13, -9, 26, 16, 3); ctx.fill();
            ctx.fillStyle = '#3a3226'; ctx.fillRect(12, -6, 4, 4);
            if (!w.looted && w.cargo.length) { ctx.fillStyle = 'rgba(160,225,255,0.5)'; ctx.fillRect(-6, -12, 3, 3); ctx.fillRect(-1, -12, 3, 3); }
            ctx.restore();
        }
        // a new drone being built on the workshop's plate: a frame, then the parts, four seconds
        if (s.build > 0 && r.rising === null) {
            const k = 1 - s.build / BUILD_S;
            ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
            ctx.strokeRect(dx - 22, dy - 16, 44, 32); ctx.setLineDash([]);
            ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.2);
            ctx.beginPath(); ctx.rect(dx - 30, dy + 18 - 40 * k, 60, 40 * k + 10); ctx.clip();
            drawDrone(s, dx, dy); ctx.restore();
            if (Math.random() < 0.5) burst(dx + (Math.random() - 0.5) * 40, dy + 18 - 40 * k, '#ffd678', 1);
        }
        if (r.rising === null && !s.lost && !(s.build > 0)) {
            // the BOOSTER is felt: a trail of the drone where it was, and speed lines
            if (boosting(s)) {
                trail.push({ x: dx, y: dy + camY, life: 0.35 });
                ctx.strokeStyle = 'rgba(143,208,255,0.55)'; ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let k = 0; k < 7; k++) {
                    const a = hash(k, Math.floor(performance.now() / 60)) * Math.PI * 2, r0 = 26 + 10 * hash(k, 3);
                    ctx.moveTo(dx + Math.cos(a) * r0, dy + Math.sin(a) * r0); ctx.lineTo(dx + Math.cos(a) * (r0 + 16), dy + Math.sin(a) * (r0 + 16));
                }
                ctx.stroke();
            }
            for (let k = trail.length - 1; k >= 0; k--) {
                const q = trail[k];
                q.life -= dt;
                if (q.life <= 0) { trail.splice(k, 1); continue; }
                ctx.fillStyle = `rgba(143,208,255,${(q.life * 0.9).toFixed(3)})`;
                ctx.beginPath(); ctx.ellipse(q.x, q.y - camY, 16, 11, 0, 0, Math.PI * 2); ctx.fill();
            }
            drawDrone(s, dx, dy); drawRings(dx, dy, dt);
        }
        // a name over a tile (the first quantum object the lamp touches)
        for (let k = labels.length - 1; k >= 0; k--) {
            const q = labels[k];
            q.life -= dt;
            if (q.life <= 0) { labels.splice(k, 1); continue; }
            const lx = r.originX + (q.i % W) * TS + TS / 2, ly = Math.floor(q.i / W) * TS - camY - 10 - (3 - q.life) * 6;
            ctx.globalAlpha = Math.min(1, q.life);
            ctx.font = '600 16px "Bebas Neue", "Arial Narrow", sans-serif'; ctx.textAlign = 'center';
            ctx.fillStyle = '#0b0c0e'; ctx.fillRect(lx - 58, ly - 14, 116, 20);
            ctx.fillStyle = '#c9b8ff'; ctx.fillText(q.text, lx, ly + 1);
            ctx.textAlign = 'left'; ctx.globalAlpha = 1;
        }
        // a stop that says down: an amber arrow under the drone
        if (view.focus === 'down' && r.rising === null) { const k = performance.now() / 1000; ctx.save(); ctx.translate(dx, dy + 52 + 6 * Math.sin(k * 5)); ctx.scale(1.6, 1.6); arrow(0, 0, 1); ctx.restore(); }
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

    /** A quantum object: a tile that flickers between realities (not ore: no glint, no crystal). */
    function quantumTile(sx, sy, x, y, t) {
        const f = hash(x * 7 + Math.floor(performance.now() / 90), y);
        const a = 0.65 + 0.35 * f;
        // a steady violet core, so it shows in a still picture too; the edges jump between realities
        ctx.fillStyle = 'rgba(150,120,230,0.55)';
        ctx.fillRect(sx + 9, sy + 9, TS - 18, TS - 18);
        ctx.fillStyle = `rgba(200,190,255,${(a * 0.5).toFixed(3)})`;
        ctx.fillRect(sx + 7, sy + 7, TS - 14, TS - 14);
        const o = (f - 0.5) * 5;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(120,240,255,${a.toFixed(3)})`; ctx.strokeRect(sx + 6.5 + o, sy + 6.5, TS - 13, TS - 13);
        ctx.strokeStyle = `rgba(255,110,220,${a.toFixed(3)})`; ctx.strokeRect(sx + 6.5 - o, sy + 6.5 + o * 0.4, TS - 13, TS - 13);
        if (f > 0.8) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx + 4, sy + 10 + f * 10, TS - 8, 1.5); }
        void t;
    }

    /** A glint that travels over ore now and then: treasure. */
    function glint(sx, sy, h, t) {
        const g = (t * 0.7 + h * 7) % 2.4;
        if (g >= 0.35) return;
        const a = Math.sin(g / 0.35 * Math.PI);
        ctx.fillStyle = `rgba(255,255,255,${(0.9 * a).toFixed(3)})`;
        const gx = sx + 10 + h * 12, gy = sy + 10 + (1 - h) * 8;
        ctx.fillRect(gx - 4 * a, gy - 0.75, 8 * a, 1.5); ctx.fillRect(gx - 0.75, gy - 4 * a, 1.5, 8 * a);
    }

    /** A chunk of 16 rows, drawn once; redrawn when a tile in it changes. */
    function chunk(s, c) {
        let sum = 0;
        const y0 = c * CHUNK, y1 = Math.min(H, y0 + CHUNK);
        for (let i = y0 * W; i < y1 * W; i++) sum = (sum * 31 + s.tiles[i] + 1) | 0;
        let ch = chunks.get(c);
        if (ch && ch.sum === sum) { ch.used = performance.now(); return ch; }
        if (!ch) {
            if (chunks.size >= KEEP_CHUNKS) {
                let old = null;
                for (const [k, v] of chunks) if (!old || v.used < old[1].used) old = [k, v];
                chunks.delete(old[0]);
            }
            ch = { ...off(W * TS, CHUNK * TS), sum: 0, used: 0 };
            chunks.set(c, ch);
        }
        ch.sum = sum; ch.used = performance.now();
        const save = ctx;
        ctx = ch.x;
        ctx.clearRect(0, 0, W * TS, CHUNK * TS);
        for (let y = y0; y < y1; y++) {
            const li = layerIndexOf(y), pal = PAL[li], sy = (y - y0) * TS;
            for (let x = 0; x < W; x++) {
                const tt = s.tiles[y * W + x], sx = x * TS;
                if (tt === T.AIR) { ctx.fillStyle = li === 5 ? '#1a0a0e' : '#0d0e10'; ctx.fillRect(sx, sy, TS, TS); continue; }
                drawTile(tt === T.GHOST || tt === T.QUANTUM ? T.STONE : tt, x, y, sx, sy, pal, li);
            }
        }
        ctx = save;
        return ch;
    }

    function drawTile(tt, x, y, sx, sy, pal, li) {
        const h = hash(x, y);
        let base = h < 0.5 ? pal.a : pal.b;
        if (tt === T.SOIL) base = pal.soil;
        if (tt === T.HARD) base = '#1f2226';
        if (tt === T.BASALT) base = '#131416';
        if (tt === T.SINEW) base = '#6e2a33';
        if (tt === T.MAGMA) base = '#7a2a10';
        if (tt === T.GAS) base = '#24331f';
        if (tt === T.HEART) base = '#5a0d1a';
        if (tt === T.FLESH || tt === T.BIO || li === 5) {
            const pulse = 0.5 + 0.5 * Math.sin(-y * 0.35 + x * 0.2);
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
        // ore (the ore that is not there is drawn per frame: it flickers)
        if (ORE_COL[tt]) drawOre(tt, sx, sy, h);
        if (tt === T.MAGMA) {         // glowing rock: cracks of orange
            ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx + 4, sy + 10 + h * 8); ctx.lineTo(sx + 14, sy + 16); ctx.lineTo(sx + 12, sy + 26); ctx.moveTo(sx + 14, sy + 16); ctx.lineTo(sx + 27, sy + 12 + h * 6); ctx.stroke();
        }
        if (tt === T.GAS) {           // a pocket of green, an old bunker's breath
            ctx.fillStyle = 'rgba(140,220,110,0.55)';
            for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(sx + 8 + hash(x + k, y) * 16, sy + 8 + hash(y + k, x) * 16, 2.5 + 2 * hash(k, x + y), 0, Math.PI * 2); ctx.fill(); }
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

    /** The ruler: a tick every 25 m, a number every 100 m, the layers' tops once reached, the drone and its best. */
    function drawRuler(s, vw, vh, camY, p) {
        const x0 = r.originX + W * TS + 16;
        const yTop = Math.max(0, -camY), yBot = vh;
        if (yBot <= yTop) return;
        ctx.fillStyle = 'rgba(11,13,16,0.85)'; ctx.fillRect(x0 - 6, yTop, 52, yBot - yTop);
        ctx.strokeStyle = 'rgba(143,161,182,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0 + 0.5, yTop); ctx.lineTo(x0 + 0.5, yBot); ctx.stroke();
        ctx.font = '600 11px "Bebas Neue", "Arial Narrow", sans-serif'; ctx.textBaseline = 'middle';
        const m0 = Math.max(0, Math.floor((camY / TS) * 5 / 25) * 25), m1 = ((camY + vh) / TS + 1) * 5;
        for (let m = m0; m <= m1 && m <= 2000; m += 25) {
            const y = (m / 5) * TS - camY;
            if (y < yTop) continue;
            const big = m % 100 === 0;
            ctx.strokeStyle = big ? 'rgba(213,219,227,0.7)' : 'rgba(143,161,182,0.45)';
            ctx.beginPath(); ctx.moveTo(x0, y + 0.5); ctx.lineTo(x0 + (big ? 10 : 5), y + 0.5); ctx.stroke();
            if (big) { ctx.fillStyle = C.mist; ctx.fillText(`${m} m`, x0 + 13, y); }
        }
        // the layers the drone has reached: a line and the name
        for (let li = 1; li <= s.layerSeen && li < LAYERS.length; li++) {
            const y = (LAYERS[li].from / 5) * TS - camY;
            if (y < yTop || y > yBot) continue;
            ctx.strokeStyle = 'rgba(255,214,120,0.6)';
            ctx.beginPath(); ctx.moveTo(x0 - 6, y + 0.5); ctx.lineTo(x0 + 46, y + 0.5); ctx.stroke();
            ctx.fillStyle = C.amber; ctx.fillText(LAYERS[li].name, x0 + 2, y + 9);
        }
        // the best so far, and the drone
        const by = (s.record + 1) * TS - camY;
        if (s.record >= 0 && by > yTop && by < yBot) { ctx.fillStyle = C.paper; ctx.fillRect(x0 - 6, by - 1, 12, 2); }
        const dy = (p.y + 0.5) * TS - camY;
        if (p.y >= 0 && dy > yTop && dy < yBot) {
            ctx.fillStyle = C.cold;
            ctx.beginPath(); ctx.moveTo(x0 - 6, dy - 5); ctx.lineTo(x0, dy); ctx.lineTo(x0 - 6, dy + 5); ctx.fill();
        }
        ctx.textBaseline = 'alphabetic';
    }

    /** An amber arrow pointing down (dir 1) or up (-1): look here. */
    function arrow(x, y, dir = 1) {
        ctx.save();
        ctx.fillStyle = C.amber;
        ctx.shadowColor = 'rgba(255,214,120,0.6)'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(x - 9, y - 6 * dir); ctx.lineTo(x + 9, y - 6 * dir); ctx.lineTo(x, y + 7 * dir); ctx.closePath(); ctx.fill();
        ctx.fillRect(x - 3, y - 16 * dir, 6, 10 * dir);
        ctx.restore();
    }

    /** A dymo label: black tape, pale letters. */
    function dymo(x, text, cx, cy, size = 11) {
        x.font = `600 ${size}px "Bebas Neue", "Arial Narrow", sans-serif`;
        const w = x.measureText(text).width + 12;
        x.fillStyle = '#0b0c0e'; x.fillRect(cx - w / 2, cy - size / 2 - 3, w, size + 6);
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(cx - w / 2, cy - size / 2 - 3, w, 2);
        x.fillStyle = C.paper; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(text, cx, cy + 1);
        x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    }

    /** The ruined city above, faint in the storm: the sky per frame, the ruins cached. */
    function drawCity(groundY, vw, dt, t) {
        const skyTop = groundY + TOP_ROW * TS, street = groundY + CITY_ROW * TS;
        if (street < 0) return;
        const g = ctx.createLinearGradient(0, skyTop, 0, street);
        g.addColorStop(0, '#0b0e13'); g.addColorStop(1, '#1b2029');
        ctx.fillStyle = g;
        ctx.fillRect(0, Math.max(0, skyTop), vw, street - Math.max(0, skyTop));
        flashAt -= dt;
        if (flashAt <= 0) { flash = 1; flashAt = 5 + Math.random() * 9; }
        if (flash > 0) { ctx.fillStyle = `rgba(200,210,230,${(flash * 0.18).toFixed(3)})`; ctx.fillRect(0, Math.max(0, skyTop), vw, street - Math.max(0, skyTop)); flash -= dt * 3; }
        const hh = (CITY_ROW - TOP_ROW) * TS, cw = 2400;
        if (!cityCache) {
            cityCache = off(cw, hh);
            const x = cityCache.x;
            for (const b of skyline) {
                const bx = b.x, h = Math.min(hh - 20, 24 + b.h * 0.55), by = hh - h;
                x.fillStyle = '#10141a';
                x.beginPath();
                x.moveTo(bx, hh); x.lineTo(bx, by + (b.broken ? 12 : 0)); x.lineTo(bx + b.w * 0.4, by);
                x.lineTo(bx + b.w * 0.6, by + (b.broken ? 18 : 0)); x.lineTo(bx + b.w, by + 4); x.lineTo(bx + b.w, hh); x.fill();
                // a dead window here and there
                x.fillStyle = 'rgba(143,161,182,0.08)';
                for (let k = 0; k < 4; k++) if (hash(b.x | 0, k) > 0.6) x.fillRect(bx + 6 + hash(k, b.x | 0) * (b.w - 14), by + 14 + k * 14, 4, 5);
            }
            // the shaft's headframe over the hatch, in the middle
            const hx = cw / 2 - W * TS / 2 + HOME_X * TS + TS / 2;
            x.strokeStyle = '#1c222b'; x.lineWidth = 4;
            x.beginPath(); x.moveTo(hx - 22, hh); x.lineTo(hx - 4, hh - 70); x.moveTo(hx + 22, hh); x.lineTo(hx + 4, hh - 70); x.stroke();
            x.beginPath(); x.arc(hx, hh - 72, 9, 0, Math.PI * 2); x.stroke();
            x.fillStyle = '#161b22'; x.fillRect(0, hh - 5, cw, 5);
        }
        ctx.globalAlpha = 0.85;
        ctx.drawImage(cityCache.c, r.originX + W * TS / 2 - cw / 2, street - hh, cw, hh);
        ctx.globalAlpha = 1;
        // rain
        ctx.strokeStyle = 'rgba(150,170,190,0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const top = Math.max(0, skyTop), span = Math.max(1, street - top);
        for (let i = 0; i < 50; i++) {
            const rx = (hash(i, 1) * vw + t * 60 * (1 + hash(i, 2))) % vw;
            const ry = top + (hash(i, 3) * span + t * 500 * (0.7 + hash(i, 4))) % span;
            ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 10);
        }
        ctx.stroke();
    }

    /** The base under the ground: rock and the shaft, the six chambers, the rooms. Cached; redrawn when it changes. */
    function baseImage(s) {
        const dark = s.dark.length, emptied = s.ended ? Math.floor(Math.min(1, r.ending / 2.4) * SLEEPERS) : 0;
        const shop = !s.tut || !s.tut.on || s.tut.rows.length > 0;
        const lab = !!(s.quantum && s.quantum.labOpen);
        const other = has(s, 'other');
        const key = `${dark}|${s.dreaming}|${shop}|${lab}|${other}|${emptied}`;
        const hh = -CITY_ROW * TS;
        if (baseCache && key === baseKey) return baseCache;
        baseKey = key;
        baseCache = baseCache || off(W * TS, hh);
        const x = baseCache.x;
        const Y = (row) => (row - CITY_ROW) * TS;        // a row's top in the cache
        x.clearRect(0, 0, W * TS, hh);
        // the rock between the city and the base, with faint strata
        x.fillStyle = C.stone; x.fillRect(0, 0, W * TS, Y(CHAMBER_TOP));
        x.strokeStyle = 'rgba(143,161,182,0.05)'; x.lineWidth = 1;
        for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(0, 8 + k * 14); for (let i = 0; i <= 12; i++) x.lineTo(i * 64, 8 + k * 14 + Math.sin(i * 1.7 + k) * 4); x.stroke(); }
        // the hall: chambers above, rooms below
        x.fillStyle = '#0e1217'; x.fillRect(0, Y(CHAMBER_TOP), W * TS, Y(0) - Y(CHAMBER_TOP));
        x.fillStyle = C.steel3; x.fillRect(0, Y(CHAMBER_TOP) - 4, W * TS, 4); x.fillRect(0, Y(ROOM_TOP) - 3, W * TS, 6);
        // the shaft: from the street down through the rock and the hall to the hatch
        const sx = HOME_X * TS;
        x.fillStyle = '#050608'; x.fillRect(sx + 3, 0, TS - 6, Y(0));
        x.fillStyle = C.slate; x.fillRect(sx + 3, 0, 2, Y(0)); x.fillRect(sx + TS - 5, 0, 2, Y(0));
        x.strokeStyle = 'rgba(143,161,182,0.35)'; x.beginPath(); x.moveTo(sx + TS / 2, 0); x.lineTo(sx + TS / 2, Y(-2)); x.stroke();
        for (let row = CITY_ROW + 1; row < 0; row += 2) { x.fillStyle = 'rgba(242,226,184,0.35)'; x.fillRect(sx + 6, Y(row) + 4, 3, 3); }
        // the life support: pipes along the hall's ceiling, from the generator out to the chambers
        x.fillStyle = '#2b333d';
        x.fillRect(0, Y(ROOM_TOP) + 6, W * TS, 5);
        x.fillRect(0, Y(ROOM_TOP) + 14, 5.5 * TS, 3);
        for (const [a] of CHAMBERS) x.fillRect(a * TS + 8, Y(ROOM_TOP) - 4, 3, 12);
        // the six chambers, 36 windows each
        const deadSet = new Set(s.dark);
        CHAMBERS.forEach(([a, b], k) => {
            const cx = a * TS + 4, cw = (b - a) * TS - 8, cy = Y(CHAMBER_TOP) + 6, chh = (ROOM_TOP - CHAMBER_TOP) * TS - 16;
            x.fillStyle = C.steel; x.fillRect(cx, cy, cw, chh);
            x.strokeStyle = 'rgba(143,161,182,0.25)'; x.strokeRect(cx + 0.5, cy + 0.5, cw - 1, chh - 1);
            // its lamp
            x.fillStyle = C.lamp; x.fillRect(cx + cw / 2 - 6, cy + 2, 12, 2);
            const pitch = 13, gx = cx + (cw - 6 * pitch) / 2 + 2, gy = cy + 12;
            for (let i = 0; i < PER_CHAMBER; i++) {
                const pod = k * PER_CHAMBER + i + 1;
                const wx = gx + (i % 6) * pitch, wy = gy + Math.floor(i / 6) * pitch;
                let col = s.dreaming ? '#d33a4a' : C.cold;
                if (deadSet.has(pod) || pod <= emptied) col = '#151a20';
                x.fillStyle = col; x.fillRect(wx, wy, 9, 9);
                if (col !== '#151a20') { x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(wx + 1, wy + 1, 3, 2); }
            }
            x.fillStyle = C.mist; x.font = '600 10px "Bebas Neue", "Arial Narrow", sans-serif'; x.textAlign = 'center';
            x.fillText(`CHAMBER ${k + 1}`, cx + cw / 2, cy + chh - 5);
            x.textAlign = 'left';
        });
        // the rooms
        const top = Y(ROOM_TOP), floor = Y(0);
        const room = (id, draw, lit = true) => {
            const [a, b] = ROOMS[id];
            const rx = a * TS, rw = (b - a + 1) * TS;
            x.fillStyle = lit ? '#141a21' : '#0b0e12'; x.fillRect(rx + 2, top + 4, rw - 4, floor - top - 4);
            if (lit) {
                const lg = x.createRadialGradient(rx + rw / 2, top + 10, 2, rx + rw / 2, top + 10, rw * 0.7);
                lg.addColorStop(0, 'rgba(242,226,184,0.22)'); lg.addColorStop(1, 'rgba(242,226,184,0)');
                x.fillStyle = lg; x.fillRect(rx + 2, top + 4, rw - 4, floor - top - 4);
                x.fillStyle = C.lamp; x.fillRect(rx + rw / 2 - 8, top + 6, 16, 3);
            }
            x.fillStyle = C.slate; x.fillRect(rx, top, 2, floor - top); x.fillRect(rx + rw - 2, top, 2, floor - top);
            draw(rx, rw);
            // a room that is not open yet has no name: it is a dark door until it matters
            if (lit) dymo(x, ROOM_NAME[id], rx + rw / 2, top + 20, 12);
        };
        room('generator', (rx, rw) => {
            // two tanks and the drum
            x.fillStyle = '#2b333d'; x.fillRect(rx + 8, top + 34, 16, floor - top - 38); x.fillRect(rx + 28, top + 40, 14, floor - top - 44);
            x.fillStyle = 'rgba(143,161,182,0.3)'; x.fillRect(rx + 10, top + 36, 3, floor - top - 42);
            x.fillStyle = C.steel3; x.fillRect(rx + 50, top + 36, rw - 58, floor - top - 40);
            x.fillStyle = '#0a0d11'; x.fillRect(rx + 58, top + 46, rw - 74, 18);
        });
        room('warehouse', (rx, rw) => {
            for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? '#3a4350' : '#2f3742'; x.fillRect(rx + 8 + k * 22, floor - 22 - (k === 1 ? 18 : 0), 20, 20); }
            x.fillStyle = '#3a4350'; x.fillRect(rx + 8 + 22, floor - 40, 20, 18);
            // the hopper the ore goes into
            x.fillStyle = C.steel3; x.beginPath(); x.moveTo(rx + rw - 54, top + 36); x.lineTo(rx + rw - 10, top + 36); x.lineTo(rx + rw - 22, floor - 6); x.lineTo(rx + rw - 42, floor - 6); x.fill();
            x.fillStyle = 'rgba(143,208,255,0.35)'; x.fillRect(rx + rw - 46, top + 40, 28, 3);
        });
        room('workshop', (rx, rw) => {
            if (!shop) { x.fillStyle = '#10141a'; for (let k = 0; k < 8; k++) x.fillRect(rx + 4, top + 32 + k * 8, rw - 8, 5); return; }
            // the tool wall, the crane arm, the plate the drone stands on
            x.strokeStyle = C.slate; x.lineWidth = 3; x.beginPath(); x.moveTo(rx + 14, top + 10); x.lineTo(rx + 14, top + 40); x.lineTo(rx + 70, top + 40); x.lineTo(rx + 70, top + 52); x.stroke();
            x.fillStyle = C.mist; for (let k = 0; k < 5; k++) x.fillRect(rx + rw - 60 + k * 10, top + 36 + (k % 2) * 4, 3, 14);
            x.fillStyle = C.steel3; x.fillRect(rx + 6, floor - 5, 2 * TS, 5);
            x.fillStyle = C.amber; x.fillRect(rx + 6, floor - 5, 2 * TS, 1.5);
        }, shop);
        room('lab', (rx, rw) => {
            if (!lab) {
                x.fillStyle = '#0d1116'; x.fillRect(rx + 10, top + 34, rw - 20, floor - top - 34);
                x.strokeStyle = 'rgba(58,67,80,0.8)'; x.lineWidth = 1; x.strokeRect(rx + 10.5, top + 34.5, rw - 21, floor - top - 35);
                return;
            }
            // the tank on its stand, a bench with glass
            const tx = rx + rw - 52;
            x.fillStyle = C.steel3; x.fillRect(tx - 4, floor - 8, 44, 8);
            x.fillStyle = 'rgba(143,208,255,0.10)'; x.fillRect(tx, top + 34, 36, floor - top - 42);
            x.strokeStyle = 'rgba(213,219,227,0.45)'; x.lineWidth = 1; x.strokeRect(tx + 0.5, top + 34.5, 35, floor - top - 43);
            x.fillStyle = '#2b333d'; x.fillRect(rx + 10, floor - 26, 54, 4); x.fillRect(rx + 12, floor - 22, 3, 22); x.fillRect(rx + 60, floor - 22, 3, 22);
            x.fillStyle = 'rgba(143,208,255,0.5)'; x.fillRect(rx + 20, floor - 34, 5, 8); x.fillRect(rx + 32, floor - 32, 4, 6);
            // THE OTHER DRONE: it sits on the bench, dark, like ours
            if (other) {
                x.fillStyle = '#20262e'; x.beginPath(); x.ellipse(rx + 46, floor - 34, 14, 8, 0, 0, Math.PI * 2); x.fill();
                x.fillStyle = '#4a2a36'; x.fillRect(rx + 40, floor - 38, 6, 4);
            }
        }, lab);
        // the spaces between the rooms: LIFE SUPPORT (tanks, filters) and PUMPS (wheels, pipes)
        const space = (a, b, name, draw) => {
            const rx = a * TS, rw = (b - a + 1) * TS;
            x.fillStyle = '#11161c'; x.fillRect(rx + 2, top + 4, rw - 4, floor - top - 4);
            draw(rx, rw);
            dymo(x, name, rx + rw / 2, top + 20, 10);
        };
        space(4, 5, 'LIFE SUPPORT', (rx, rw) => {
            x.fillStyle = '#2b333d'; x.fillRect(rx + 8, top + 36, 18, floor - top - 40); x.fillRect(rx + rw - 26, top + 44, 18, floor - top - 48);
            x.fillStyle = 'rgba(143,208,255,0.35)'; x.fillRect(rx + 12, top + 42, 4, floor - top - 52); x.fillRect(rx + rw - 22, top + 50, 4, floor - top - 60);
        });
        space(17, 18, 'PUMPS', (rx, rw) => {
            x.strokeStyle = '#3a4350'; x.lineWidth = 3;
            x.beginPath(); x.arc(rx + rw / 2, floor - 26, 13, 0, Math.PI * 2); x.stroke();
            x.beginPath(); x.moveTo(rx + rw / 2 - 13, floor - 26); x.lineTo(rx + rw / 2 + 13, floor - 26); x.moveTo(rx + rw / 2, floor - 39); x.lineTo(rx + rw / 2, floor - 13); x.stroke();
            x.fillStyle = '#2b333d'; x.fillRect(rx + 4, top + 34, rw - 8, 5);
        });
        // the floor, and the hatch in it
        x.fillStyle = '#20262e'; x.fillRect(0, floor - 2, W * TS, 2);
        x.fillStyle = '#050608'; x.fillRect(sx + 2, floor - 3, TS - 4, 3);
        for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? C.amber : '#0b0c0e'; x.fillRect(sx - 6 + k * 3, floor - 2, 3, 2); x.fillRect(sx + TS + k * 3 - 6, floor - 2, 3, 2); }
        return baseCache;
    }

    function drawBase(s, groundY, t, view) {
        const img = baseImage(s);
        ctx.drawImage(img.c, r.originX, groundY + CITY_ROW * TS, W * TS, -CITY_ROW * TS);
        // the generator hums: its window glows and breathes
        const [ga, gb] = ROOMS.generator;
        const gw = (gb - ga + 1) * TS, top = groundY + ROOM_TOP * TS;
        const al = s.alarms;
        const genDown = al && al.genDown;
        const hum = genDown ? 0 : 0.55 + 0.25 * Math.sin(t * 6) + 0.1 * Math.sin(t * 17);
        ctx.fillStyle = `rgba(143,208,255,${(0.35 * hum).toFixed(3)})`;
        ctx.fillRect(r.originX + ga * TS + 58, top + 46, gw - 74, 18);
        // what is failing: a red lamp that blinks (the generator stopped: a steady one)
        const blink = Math.floor(performance.now() / 350) % 2 === 0;
        const redLamp = (x, y, on) => {
            ctx.fillStyle = on ? C.danger : '#4a1a16';
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
            if (on) { const rg = ctx.createRadialGradient(x, y, 2, x, y, 34); rg.addColorStop(0, 'rgba(255,107,90,0.45)'); rg.addColorStop(1, 'rgba(255,107,90,0)'); ctx.fillStyle = rg; ctx.fillRect(x - 34, y - 34, 68, 68); }
        };
        if (al) {
            for (const f of al.list) {
                if (f.id === 'gen') redLamp(r.originX + ga * TS + gw / 2 + 30, top + 28, blink);
                else {
                    const [a, b] = CHAMBERS[Number(f.id.slice(1))];
                    redLamp(r.originX + (a + b) / 2 * TS, groundY + CHAMBER_TOP * TS + 4, blink);
                }
            }
            if (genDown) redLamp(r.originX + ga * TS + gw / 2 + 30, top + 28, true);
            // at home: an arrow to the first thing to mend
            const first = al.list[0] || (genDown ? { id: 'gen' } : null);
            if (first && s.y === -1 && !s.cargo.length) arrow(r.originX + spotOf(first.id) * TS + TS / 2, top + 46 + 4 * Math.sin(t * 5), 1);
            // mending: a bar over the drone
            if (al.repair) {
                const k = Math.min(1, al.repair.t / REPAIR_S), bx = r.originX + s.x * TS + TS / 2 - 22, byy = groundY - TS - 30;
                ctx.fillStyle = '#0b0c0e'; ctx.fillRect(bx, byy, 44, 6);
                ctx.fillStyle = C.amber; ctx.fillRect(bx + 1, byy + 1, 42 * k, 4);
            }
        }
        // the lab at work: the object turning in the tank, a bar on the room
        const q = s.quantum;
        if (q && q.labOpen && (q.lab !== null || q.labQ)) {
            const [la, lb] = ROOMS.lab, lw = (lb - la + 1) * TS, lx = r.originX + la * TS;
            const tx = lx + lw - 52 + 18, ty = top + 60;
            quantumTile(tx - TS / 2 + 2, ty - TS / 2, 3, 3, t);
            const k = q.lab === null ? 0 : Math.min(1, q.lab / LAB_S);
            ctx.fillStyle = '#0b0c0e'; ctx.fillRect(lx + 10, top + 34, lw - 70, 6);
            ctx.fillStyle = C.cold; ctx.fillRect(lx + 11, top + 35, (lw - 72) * k, 4);
        }
        // the generator can be built up: an arrow there until the drone has been
        if (s.genFresh && !(s.y === -1 && s.x >= ROOMS.generator[0] && s.x <= ROOMS.generator[1])) arrow(r.originX + 2 * TS, top + 46 + 4 * Math.sin(t * 5), 1);
        // the carried object goes to the lab: an arrow there
        if (q && q.carry.length && s.y === -1 && !s.cargo.length && !(s.x >= ROOMS.lab[0] && s.x <= ROOMS.lab[1])) arrow(r.originX + roomSpot('lab') * TS + TS * 1.5, top + 46 + 4 * Math.sin(t * 5), 1);
        // look here: the warehouse with cargo aboard, the workshop with something new
        const home = s.y === -1, rx = s.x;
        if (home && s.cargo.length && !(rx >= ROOMS.warehouse[0] && rx <= ROOMS.warehouse[1])) {
            arrow(r.originX + roomSpot('warehouse') * TS - TS, top + 46 + 4 * Math.sin(t * 5), 1);
        }
        // the workshop's arrow only when what is new there can be had now
        const fresh = s.tut && s.tut.on && s.tut.fresh;
        const can = fresh && (String(fresh).startsWith('fit-') || fresh === 'graft' || (PRICE[fresh] && s.parts >= (PRICE[fresh][s.levels[fresh]] ?? Infinity)));
        if (can && !(home && rx >= ROOMS.workshop[0] && rx <= ROOMS.workshop[1])) {
            arrow(r.originX + roomSpot('workshop') * TS + TS * 1.5, top + 46 + 4 * Math.sin(t * 5), 1);
        }
        void view;
    }

    /**
     * The drone (spec G): a body inside a loop of tracks (it climbs and digs), a drill on an arm that
     * turns toward the dig and spins while it bites, a lamp with its cone, a cargo hatch on top that
     * opens at the WAREHOUSE. Every upgrade shows: a longer drill, a bigger lamp, a wider hold, armour
     * plates (HULL), a dish (GPS), a mast (RADIO), nozzles (BOOSTER), a second lamp below. GRAFT turns
     * it to flesh: a drill of bone, a body that heals in red patches, then skin with veins and tracks of sinew.
     */
    function drawDrone(s, dx, dy) {
        const g = s.grafts, L = s.levels, face = s.face || 1;
        const now = performance.now() / 1000;
        const digging = s.act && s.act.kind === 'dig';
        const moving = !!s.act;
        const body = g >= 3 ? '#9a4452' : g === 2 ? '#b98a86' : '#b8c0c8';
        const trackCol = g >= 3 ? '#5a1c26' : '#1b1f25';
        const tread = g >= 3 ? '#8a2c3a' : '#3a4350';
        ctx.save();
        ctx.translate(dx, dy);
        ctx.scale(1.12, 1.12);
        // the lamp's beam forward, and with the SECOND LAMP one down
        const beam = 46 + 16 * L.lamp;
        const bg = ctx.createLinearGradient(face * 14, 0, face * (14 + beam), 0);
        bg.addColorStop(0, 'rgba(255,240,200,0.20)'); bg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.moveTo(face * 16, -5); ctx.lineTo(face * (16 + beam), -5 - beam * 0.35); ctx.lineTo(face * (16 + beam), -5 + beam * 0.35); ctx.fill();
        if (has(s, 'lamp2')) {
            const dg = ctx.createLinearGradient(0, 14, 0, 14 + beam);
            dg.addColorStop(0, 'rgba(255,240,200,0.16)'); dg.addColorStop(1, 'rgba(255,240,200,0)');
            ctx.fillStyle = dg;
            ctx.beginPath(); ctx.moveTo(-4, 14); ctx.lineTo(-beam * 0.32, 14 + beam); ctx.lineTo(beam * 0.32, 14 + beam); ctx.fill();
        }
        // the booster's flame
        if (has(s, 'booster') && boosting(s)) {
            ctx.fillStyle = `rgba(143,208,255,${(0.5 + 0.4 * Math.sin(now * 40)).toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(-face * 20, -6); ctx.lineTo(-face * (34 + 6 * Math.sin(now * 33)), -2); ctx.lineTo(-face * 20, 2); ctx.fill();
        }
        // the tracks all round: a loop with treads that run when it moves
        ctx.fillStyle = trackCol;
        roundRect(-21, -15, 42, 30, 9); ctx.fill();
        const off = moving ? (now * 30) % 6 : 0;
        ctx.fillStyle = tread;
        for (let k = -18 + off; k < 18; k += 6) { ctx.fillRect(k, -15, 3, 2); ctx.fillRect(k, 13, 3, 2); }
        for (let k = -11 + off; k < 11; k += 6) { ctx.fillRect(-21, k, 2, 3); ctx.fillRect(19, k, 2, 3); }
        // armour plates, one a HULL level
        ctx.fillStyle = g >= 3 ? '#6e2a33' : '#5c6673';
        for (let k = 0; k < L.hull; k++) { ctx.fillRect(-19 + k * 7, 9, 5, 4); ctx.fillRect(14 - k * 7, 9, 5, 4); }
        // the body
        ctx.fillStyle = body;
        roundRect(-15, -10, 30, 19, 4); ctx.fill();
        if (g >= 2) {
            // patches that heal, red, breathing
            ctx.fillStyle = `rgba(168,19,44,${(0.45 + 0.2 * Math.sin(now * 3.3)).toFixed(3)})`;
            ctx.beginPath(); ctx.ellipse(-6, 2, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(7, -3, 4, 3, -0.4, 0, Math.PI * 2); ctx.fill();
        }
        if (g >= 3) {
            ctx.strokeStyle = 'rgba(60,0,12,0.8)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(-14, -4); ctx.bezierCurveTo(-6, -11, 4, 6, 14, -6); ctx.moveTo(-10, 7); ctx.bezierCurveTo(-2, 1, 6, 9, 12, 4); ctx.stroke();
        }
        // the cargo hold on top, wider with each CARGO level; its hatch opens at the warehouse
        // the hatch stays open a moment after the last piece is out
        const inStore = s.y === -1 && s.x >= ROOMS.warehouse[0] && s.x <= ROOMS.warehouse[1];
        if (inStore && s.cargo.length) r.hatchUntil = now + 1.2;
        const hw = 12 + 3 * L.cargo, open = inStore && now < (r.hatchUntil || 0);
        ctx.fillStyle = g >= 3 ? '#7a3040' : '#7d8794';
        ctx.fillRect(-hw / 2 - 2, -14, hw, 5);
        ctx.save();
        ctx.translate(-hw / 2 - 2, -14);
        ctx.rotate(open ? -1.1 - 0.1 * Math.sin(now * 8) : 0);
        ctx.fillStyle = g >= 3 ? '#9a4452' : '#9aa4b0'; ctx.fillRect(0, -2, hw, 3);
        ctx.restore();
        if (open && s.cargo.length) { ctx.fillStyle = '#9fd8e8'; ctx.fillRect(-hw / 2, -14 - 3 - (now * 20) % 6, 3, 3); }
        // the window
        ctx.fillStyle = g >= 2 ? '#7a2030' : '#2a3442';
        ctx.fillRect(face > 0 ? 2 : -10, -7, 8, 6);
        ctx.fillStyle = 'rgba(143,208,255,0.6)'; ctx.fillRect(face > 0 ? 3 : -9, -6, 3, 2);
        // the lamp, bigger with each LAMP level
        ctx.fillStyle = '#ffe9a8';
        const lw = 3 + L.lamp;
        ctx.fillRect(face > 0 ? 14 : -14 - lw, -7, lw, 5);
        if (has(s, 'lamp2')) ctx.fillRect(-3, 9, 6, 3);
        // the GPS dish, the radio's mast, the booster's nozzles
        if (L.gps > 0) { ctx.strokeStyle = '#d5dbe3'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(9, -17, 4 + L.gps, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.fillRect(8.5, -17, 1, 3); }
        if (L.radio > 0) { ctx.strokeStyle = '#8fa1b6'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-14, -26); ctx.stroke(); ctx.fillStyle = Math.floor(now * 2) % 2 ? '#ff6b5a' : '#4a1a16'; ctx.fillRect(-15, -28, 3, 3); }
        if (has(s, 'booster')) { ctx.fillStyle = '#3a4350'; ctx.fillRect(face > 0 ? -21 : 17, -8, 4, 4); ctx.fillRect(face > 0 ? -21 : 17, -2, 4, 4); }
        // the drill, on its arm toward the dig; it spins while it bites; bone after the first graft
        const dir = digging ? { x: s.act.tx - s.x, y: s.act.ty - s.y } : (s.act && s.act.kind === 'fall') ? { x: 0, y: 1 } : { x: face, y: 0 };
        const ang = Math.atan2(dir.y, dir.x);
        const len = 10 + 3 * L.drill;
        ctx.save();
        ctx.rotate(ang);
        ctx.translate(dir.y ? 15 : 21, 0);
        if (digging) ctx.translate(Math.sin(now * 70) * 0.8, 0);
        ctx.fillStyle = g >= 1 ? '#e8dcc8' : '#7d8794';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(len, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
        // the spiral grooves run when it bites
        ctx.strokeStyle = g >= 1 ? 'rgba(120,90,70,0.8)' : 'rgba(30,36,44,0.8)'; ctx.lineWidth = 1.2;
        const ph = digging ? (now * 24) % 1 : 0;
        for (let k = 0; k < 3; k++) {
            const u = ((k + ph) / 3) * len, hh = 6 * (1 - u / len);
            ctx.beginPath(); ctx.moveTo(u, -hh); ctx.lineTo(u + 2, hh); ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
    }
    function roundRect(x, y, w, h, r0) {
        ctx.beginPath();
        ctx.moveTo(x + r0, y); ctx.lineTo(x + w - r0, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r0);
        ctx.lineTo(x + w, y + h - r0); ctx.quadraticCurveTo(x + w, y + h, x + w - r0, y + h);
        ctx.lineTo(x + r0, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r0);
        ctx.lineTo(x, y + r0); ctx.quadraticCurveTo(x, y, x + r0, y); ctx.closePath();
    }

    /** A ring that spreads from the drone: the shock wave; a flash at the base: the teleport. */
    const rings = [];
    function ring(kind) { rings.push({ kind, life: kind === 'shock' ? 0.5 : 0.7 }); }
    function drawRings(dx, dy, dt) {
        for (let i = rings.length - 1; i >= 0; i--) {
            const q = rings[i];
            q.life -= dt;
            if (q.life <= 0) { rings.splice(i, 1); continue; }
            if (q.kind === 'shock') {
                const k = 1 - q.life / 0.5;
                ctx.strokeStyle = `rgba(255,214,120,${(0.8 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 6 * (1 - k) + 1;
                ctx.beginPath(); ctx.arc(dx, dy, 10 + k * 2.6 * TS, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.fillStyle = `rgba(200,230,255,${(0.5 * q.life / 0.7).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(dx, dy, 30 + (0.7 - q.life) * 80, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    return { draw, resize, burst, screenOf, tileAtScreen, r, pop, rise, ring, label, bump, worldWidth: W * TS };
}
