/**
 * Chapter IV, the vault: the cutaway on a 2D canvas. The surface city (eroding with the years),
 * the sediment laid in the night, the shaft, three levels of eight rooms, the people walking,
 * the body creeping over what it takes. Draws what the rules say; owns no state of the game.
 *
 * THE LOOK (spec "Graphics pass"): a sibling of the strata view. Black stone with faint veins,
 * sediment bands with speckle, the act II city as rounded tiles gone to ruin, every room the same
 * frame with one lamp and a pale drawing in it. Colours only from VT (style.js). The body is the
 * one thing that is rich: muscle fibre with a direction, pale sinew, mycelium, branching vessels
 * with a pulse running through them, wet glints, a slow breath.
 *
 * PERFORMANCE: what does not move is drawn once into offscreen canvases (the world: stone, layers,
 * city, shaft; each room's tissue; the sinews between body rooms; each suite's windows) and only
 * redrawn when its key changes. Per frame: sky, rain, the rooms' small motifs, pulses, people.
 */

import { LEVELS, SLOTS, levelOf, idxOf, KINDS, awake, isFlesh, isVatRoom, organOf, PODS_PER_LEVEL, SUITE_BEDS, roomsOf } from './vault.js';
import { VT } from './style.js';

/** Seeded noise for the stone and the city, the same every frame. */
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
/** A small seeded generator for the textures. */
function rng(seed) {
    let a = (Math.floor(seed * 2654435761) >>> 0) || 1;
    return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
}
/** 'rgba' of a token at an alpha. */
function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The breath and the heart (as src/phase4/flesh.js). */
const BREATH_RATE = 0.9;
const BEAT = 1.7;
const PAD = 6;
/** After the rise, the risen body stays on screen this long before the chapter card. */
export const RISE_HOLD_MS = 1800;              // the tissue is drawn this much larger than its room, so it can swell

export function createVaultView(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let geo = null;
    const walkers = [];
    let descent = null;     // the arrival: { t0 }
    let riseAnim = null;    // the end: { t0, done }
    const pointer = { x: -1, y: -1 };
    const effects = [];     // pops, misses, wave bumps: { type, x, y, t0, text }
    // the caches
    let world = null;       // { key, c }
    const tissues = new Map();   // slot -> { key, base, glint, reach, vessels }
    let bridges = null;     // { key, c, vessels }
    const suites = new Map();    // slot -> { key, c }

    function offscreen(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(w * dpr)); c.height = Math.max(1, Math.ceil(h * dpr));
        const g = c.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { c, g };
    }

    function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = canvas.getBoundingClientRect();
        W = Math.max(320, r.width); H = Math.max(320, r.height);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        world = null; bridges = null; tissues.clear(); suites.clear();
        layout();
    }

    function layout() {
        const left = opts.insetLeft ? opts.insetLeft() : 300;
        const right = opts.insetRight ? opts.insetRight() : 300;
        const x0 = left + 20, x1 = W - right - 20;
        const shaftW = 26;
        const gap = 6;
        // the shaft is the spine in the middle: half the rooms of a level on each side of it
        // (the rules' indices stay 0..SLOTS-1 left to right; only the screen place moves)
        const half = SLOTS / 2;
        const slotW = Math.max(40, Math.floor((x1 - x0 - shaftW - gap * SLOTS) / SLOTS));
        const span = SLOTS * slotW + (SLOTS - 1) * gap + shaftW + gap;
        const xs = x0 + Math.max(0, Math.floor((x1 - x0 - span) / 2));
        const shaftX = xs + half * (slotW + gap);
        const ground = Math.round(H * 0.25);
        const levelH = Math.round(Math.min(110, Math.max(70, (H - ground - 60) / 3.4)));
        const top0 = Math.round(ground + Math.max(40, levelH * 0.55));
        const levelGap = Math.round(Math.max(18, levelH * 0.28));
        const slots = [];
        for (let lv = 0; lv < LEVELS; lv++) {
            for (let ix = 0; ix < SLOTS; ix++) {
                const x = ix < half ? xs + ix * (slotW + gap) : shaftX + shaftW + gap + (ix - half) * (slotW + gap);
                const y = top0 + lv * (levelH + levelGap);
                slots.push({ x, y, w: slotW, h: levelH });
            }
        }
        geo = { x0, x1, shaftX, shaftW, half, ground, top0, levelH, levelGap, slots, slotW };
    }

    function slotAt(px, py) {
        if (!geo) return -1;
        return geo.slots.findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    }
    function slotRect(i) { return geo ? geo.slots[i] : null; }

    // ---------------------------------------------------------------- the people
    function syncWalkers(s) {
        const want = s.phase === 'night' && awake(s) === 0 ? 0 : Math.min(48, Math.ceil(awake(s) / 6));
        while (walkers.length < want) {
            walkers.push({ lv: 0, x: Math.random(), v: (Math.random() < 0.5 ? -1 : 1) * (0.012 + Math.random() * 0.02), pause: 0, seed: Math.random() });
        }
        walkers.length = want;
    }
    function stepWalkers(s, dt) {
        // they walk on the floors of the levels that have rooms for them
        const levels = [];
        for (let lv = 0; lv < LEVELS; lv++) {
            if (s.rooms.slice(lv * SLOTS, (lv + 1) * SLOTS).some((r) => !isFlesh(r) && r.kind !== 'rock' && r.kind !== 'empty' && r.kind !== 'cryo')) levels.push(lv);
        }
        for (const w of walkers) {
            if (!levels.includes(w.lv)) w.lv = levels.length ? levels[Math.floor(w.seed * levels.length)] : 0;
            // the span of the level that is open (rooms, not rock)
            let lo = SLOTS, hi = -1;
            s.rooms.slice(w.lv * SLOTS, (w.lv + 1) * SLOTS).forEach((r, k) => { if (r.kind !== 'rock' && !isFlesh(r)) { lo = Math.min(lo, k); hi = Math.max(hi, k); } });
            const a = hi >= 0 ? lo / SLOTS + 0.01 : 0.02, b = hi >= 0 ? (hi + 1) / SLOTS - 0.01 : 0.98;
            if (w.pause > 0) { w.pause -= dt; continue; }
            w.x += w.v * dt * 3;
            if (w.x < a || w.x > b) { w.v = w.x < a ? Math.abs(w.v) : -Math.abs(w.v); w.x = Math.max(a, Math.min(b, w.x)); }
            if (Math.random() < dt * 0.15) w.pause = 0.5 + Math.random() * 2;
        }
    }

    // ---------------------------------------------------------------- drawing
    function draw(s, ui, now) {
        if (!geo) return;
        const t = now / 1000;
        ctx.clearRect(0, 0, W, H);
        drawSky(s, t);
        drawWorld(s);
        drawSpine(s, t);
        for (let i = 0; i < s.rooms.length; i++) drawSlot(s, i, ui, t);
        drawBridges(s, t);
        drawOrgans(s, t);
        drawWalkers(s, t);
        drawWishes(s, t);
        drawTalk(s);
        drawEffects(t);
        drawDescent(t);
        drawRise(s, t);
    }

    function drawSky(s, t) {
        const g = ctx.createLinearGradient(0, 0, 0, geo.ground);
        const night = s.phase !== 'palace';
        g.addColorStop(0, night ? '#040507' : '#0c0f14');
        g.addColorStop(1, night ? '#0a0c10' : '#1a2029');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, geo.ground);
        // the storm: dark clouds and slanted rain (the strata view's weather)
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        for (let k = 0; k < 7; k++) {
            const cx = ((k * 211 + t * 9) % (W + 300)) - 150;
            ctx.beginPath(); ctx.ellipse(cx, 26 + (k % 3) * 14, 140, 22, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = rgba(VT.mist, 0.14);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 80; k++) {
            const x = (hash(k) * (W + 200) + t * 260) % (W + 200) - 100;
            const y = (hash(k + 50) * geo.ground + t * 420) % geo.ground;
            ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 14);
        }
        ctx.stroke();
    }

    function layerCount(s) { return s.phase === 'palace' ? 0 : Math.floor((s.year || 0) / 1000); }
    function groundY(s) { return geo.ground - Math.min(geo.ground * 0.45, layerCount(s) * 7); }
    function cityStage(s) {
        const year = s.phase === 'palace' ? s.day / 365 : s.year;
        return year < 10 ? 0 : year < 100 ? 1 : year < 1000 ? 2 : year < 10000 ? 3 : 4;
    }

    /** The world that does not move: stone, sediment, the city, the shaft. Cached by its shape. */
    function drawWorld(s) {
        const key = `${W}x${H}|${layerCount(s)}|${cityStage(s)}|${s.phase === 'palace' ? 'p' : 'n'}`;
        if (!world || world.key !== key) {
            const o = offscreen(W, H);
            paintStone(o.g);
            paintLayers(o.g, s);
            paintCity(o.g, s);
            paintShaft(o.g, s);
            world = { key, c: o.c };
        }
        ctx.drawImage(world.c, 0, 0, W, H);
    }

    function paintStone(g) {
        g.fillStyle = VT.stone;
        g.fillRect(0, geo.ground, W, H - geo.ground);
        // faint veins in the rock, as in the strata view
        g.lineWidth = 1;
        for (let k = 0; k < 40; k++) {
            const y = geo.ground + 12 + k * 17 + hash(k) * 8;
            if (y > H) break;
            g.strokeStyle = rgba(VT.mist, 0.025 + hash(k + 3) * 0.03);
            g.beginPath();
            g.moveTo(0, y);
            for (let x = 0; x <= W; x += 80) g.lineTo(x, y + (hash(k * 31 + x) - 0.5) * 6);
            g.stroke();
        }
        // a few wandering cracks
        g.strokeStyle = rgba(VT.mist, 0.05);
        for (let k = 0; k < 9; k++) {
            let x = hash(k * 7 + 1) * W, y = geo.ground + 30 + hash(k * 7 + 2) * (H - geo.ground - 40);
            g.beginPath(); g.moveTo(x, y);
            for (let n = 0; n < 7; n++) { x += (hash(k * 13 + n) - 0.3) * 40; y += (hash(k * 17 + n) - 0.5) * 22; g.lineTo(x, y); }
            g.stroke();
        }
    }

    /** The night lays a band of sediment over the surface for every thousand years. */
    function paintLayers(g, s) {
        const n = layerCount(s);
        // the old ground: the crust they came down through
        g.fillStyle = '#151a21';
        g.fillRect(0, geo.ground, W, 5);
        g.fillStyle = rgba(VT.mist, 0.18);
        g.fillRect(0, geo.ground, W, 1);
        for (let k = 0; k < n; k++) {
            const y = geo.ground - (k + 1) * 7;
            if (y < geo.ground * 0.55) break;
            g.fillStyle = k % 2 ? '#141820' : '#1a1f27';
            g.fillRect(0, y, W, 7);
            // speckle, the strata's grain
            g.fillStyle = rgba(VT.mist, 0.16);
            for (let x = hash(k) * 9; x < W; x += 5 + hash(x + k) * 9) g.fillRect(x, y + 2 + hash(x * 3 + k) * 3, 1, 1);
            g.fillStyle = rgba(VT.mist, 0.10);
            g.fillRect(0, y, W, 1);
        }
    }

    /**
     * The city of act II gone to ruin: its rounded tiles stacked as towers, whole at year 0 (a few
     * warm windows), cracked and tipped at 10, halved at 100, rubble half sunk at 1 000, gone at 10 000.
     */
    function paintCity(g, s) {
        const stage = cityStage(s);
        const gy = groundY(s);
        if (stage >= 4) return;
        const T = 24, GAP = 4, step = T + GAP + 6;
        const n = Math.ceil(W / step) + 1;
        g.save();
        g.beginPath(); g.rect(0, 0, W, gy); g.clip();
        // the ruined skyline stands on something: the buildings' dark cores behind their tiles
        for (let k = 0; k < n; k++) {
            if (hash(k * 1.7 + 0.3) < 0.28) continue;
            const x0 = k * step + 3 + (hash(k) - 0.5) * 4;
            let tall = 1 + Math.floor(hash(k + 9) * 3) + (k % 7 === 3 ? 3 : 0) + (k % 11 === 5 ? 1 : 0);
            if (stage === 2) tall = Math.max(1, Math.ceil(tall / 2));
            if (stage === 3) tall = 1;
            const coreTop = stage === 3 ? gy - T * 0.5 : gy - tall * (T + GAP) + T * 0.35;
            g.fillStyle = VT.stone;
            g.beginPath();
            // a broken top edge, sloping where the floors fell
            g.moveTo(x0 - 2, gy);
            g.lineTo(x0 - 2, coreTop + (hash(k * 3) - 0.5) * 6);
            g.lineTo(x0 + T * 0.5, coreTop + (stage >= 1 ? hash(k * 5) * 8 : 0));
            g.lineTo(x0 + T + 2, coreTop + (hash(k * 7) - 0.5) * 6);
            g.lineTo(x0 + T + 2, gy);
            g.fill();
            g.fillStyle = rgba(VT.mist, 0.06);
            g.fillRect(x0 - 2, coreTop, 1, gy - coreTop);
        }
        // the ground they stand on: a band of rubble, higher as the city falls
        const heap = 4 + stage * 3;
        g.fillStyle = VT.stone;
        g.beginPath(); g.moveTo(0, gy);
        for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, gy - heap * (0.4 + hash(x * 0.37) * 0.8));
        g.lineTo(W, gy); g.closePath(); g.fill();
        g.fillStyle = rgba(VT.mist, 0.1);
        for (let x = hash(stage) * 7; x < W; x += 6 + hash(x) * 10) g.fillRect(x, gy - heap * 0.4 - hash(x * 3) * heap * 0.6, 2, 1);
        for (let k = 0; k < n; k++) {
            if (hash(k * 1.7 + 0.3) < 0.28) continue;     // a gap between the blocks
            const x0 = k * step + 3 + (hash(k) - 0.5) * 4;
            let tall = 1 + Math.floor(hash(k + 9) * 3) + (k % 7 === 3 ? 3 : 0) + (k % 11 === 5 ? 1 : 0);
            if (stage === 2) tall = Math.max(1, Math.ceil(tall / 2));
            if (stage === 3) tall = 1;
            for (let q = 0; q < tall; q++) {
                const top = q === tall - 1;
                if (stage === 1 && top && hash(k * 5) < 0.3 && tall > 1) continue;
                const x = x0;
                let y = gy - (q + 1) * (T + GAP), rot = 0;
                if (stage >= 1 && top) rot = (hash(k * 3 + q) - 0.5) * (stage === 1 ? 0.35 : 0.6);
                if (stage === 3) { y = gy - T * (0.35 + hash(k) * 0.4); rot = (hash(k * 7) - 0.5) * 1.2; }
                tile(g, x, y, T, rot, stage, k * 10 + q);
            }
            // fallen tiles at the foot from stage 2
            if (stage === 2 && hash(k * 19) < 0.5) tile(g, x0 + step * 0.45, gy - T * 0.55, T, 0.9 + hash(k) * 0.5, 3, k * 10 + 9);
        }
        g.restore();
        // the ground line
        g.fillStyle = rgba(VT.mist, 0.22);
        g.fillRect(0, gy, W, 1);
    }
    function tile(g, x, y, T, rot, stage, seed) {
        g.save();
        g.translate(x + T / 2, y + T / 2);
        g.rotate(rot);
        const fill = stage >= 3 ? '#151a21' : VT.steel2;
        g.fillStyle = fill;
        g.strokeStyle = stage >= 3 ? rgba(VT.mist, 0.1) : rgba(VT.mist, 0.16);
        g.lineWidth = 1;
        g.beginPath(); g.roundRect(-T / 2, -T / 2, T, T, 5); g.fill(); g.stroke();
        // the act II building glyph: a block with windows
        const ink = stage >= 2 ? rgba(VT.mist, 0.08) : rgba(VT.mist, 0.18);
        g.strokeStyle = ink;
        g.beginPath(); g.roundRect(-T * 0.22, -T * 0.26, T * 0.44, T * 0.52, 2); g.stroke();
        for (let wy = 0; wy < 3; wy++) {
            for (let wx = 0; wx < 2; wx++) {
                const px = -T * 0.12 + wx * T * 0.16, py = -T * 0.17 + wy * T * 0.13;
                const lit = stage === 0 && hash(seed * 7 + wy * 3 + wx) > 0.72;
                g.fillStyle = lit ? rgba(VT.lamp, 0.75) : ink;
                g.fillRect(px - 1.5, py - 1.5, 3, 3);
            }
        }
        if (stage >= 1) {
            // a crack across
            g.strokeStyle = 'rgba(0,0,0,0.7)';
            g.beginPath(); g.moveTo(-T / 2, -T * 0.1 + (hash(seed) - 0.5) * 10); g.lineTo(-T * 0.05, T * 0.05); g.lineTo(T / 2, (hash(seed + 1) - 0.5) * 16); g.stroke();
        }
        g.restore();
    }

    function paintShaft(g, s) {
        const x = geo.shaftX, w = geo.shaftW;
        const bottom = geo.slots[(LEVELS - 1) * SLOTS].y + geo.levelH;
        const top = groundY(s);
        g.fillStyle = VT.ink;
        g.fillRect(x, top, w, bottom - top);
        g.fillStyle = rgba(VT.mist, 0.12);
        g.fillRect(x, top, 1, bottom - top); g.fillRect(x + w - 1, top, 1, bottom - top);
        // rungs
        g.strokeStyle = rgba(VT.mist, 0.07);
        g.beginPath();
        for (let y = top + 6; y < bottom; y += 10) { g.moveTo(x + 5, y + 0.5); g.lineTo(x + w - 5, y + 0.5); }
        g.stroke();
        // the hatch at the surface
        g.fillStyle = VT.slate;
        g.fillRect(x - 6, top - 3, w + 12, 4);
        g.fillStyle = rgba(VT.mist, 0.5);
        g.fillRect(x - 6, top - 3, w + 12, 1);
        // the landings: the shaft opens onto each level on both sides, a dark door with a pale floor
        for (let lv = 0; lv < LEVELS; lv++) {
            const r = geo.slots[lv * SLOTS];
            const a = geo.slots[lv * SLOTS + geo.half - 1].x + geo.slotW, b = geo.slots[lv * SLOTS + geo.half].x;
            g.fillStyle = VT.ink;
            g.fillRect(a, r.y + r.h - 16, b - a, 16);
            g.fillStyle = rgba(VT.plate, 0.25);
            g.fillRect(a, r.y + r.h - 1, b - a, 1);
            g.fillStyle = rgba(VT.plate, 0.5);
            g.fillRect(x + w / 2 - 3, r.y + r.h - 18, 6, 2);
        }
    }

    // ---------------------------------------------------------------- the rooms: one family
    /** Every room: the same frame, the same lamp and cone of light, the same pale floor line. */
    function roomFrame(x, y, w, h, lit) {
        ctx.fillStyle = VT.ink;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = lit ? '#11151b' : '#0d1015';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        if (lit) {
            const g = ctx.createRadialGradient(x + w / 2, y + 4, 2, x + w / 2, y + 4, h * 1.05);
            g.addColorStop(0, rgba(VT.plate, 0.16));
            g.addColorStop(1, rgba(VT.plate, 0));
            ctx.fillStyle = g;
            ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
            ctx.fillStyle = rgba(VT.plate, 0.9);
            ctx.fillRect(x + w / 2 - 4, y + 2, 8, 2);
        }
        ctx.fillStyle = rgba(VT.plate, lit ? 0.55 : 0.18);
        ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
        ctx.strokeStyle = rgba(VT.mist, 0.16);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }

    function drawSlot(s, i, ui, t) {
        const r = s.rooms[i];
        const g = geo.slots[i];
        const { x, y, w, h } = g;
        const sel = ui.selected === i;
        const can = ui.placeable && ui.placeable.has(i);
        const wanted = ui.wanted && ui.wanted.has(i);
        const growingHere = r.job && r.job.op === 'grow';
        if (r.kind === 'rock' && !r.flesh && !growingHere) {
            if (r.job && r.job.op === 'dig') {
                ctx.fillStyle = '#12161c';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = rgba(VT.mist, 0.16); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
                progress(x, y, w, h, 1 - r.job.left / r.job.total, VT.plate);
                pickaxe(x + w / 2, y + h / 2, t);
            } else if (!(ui.diggable && ui.diggable.has(i))) {
                // every level is eight places wide: unworked rock still shows its place, faintly
                ctx.strokeStyle = rgba(VT.mist, 0.06);
                ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            } else {
                // a place: rock that can be dug by day, or take a vat or a Cryo Bay in the night
                ctx.setLineDash([3, 4]);
                ctx.strokeStyle = rgba(VT.mist, s.phase === 'night' ? 0.32 : 0.16);
                ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
                ctx.setLineDash([]);
            }
            if (can) glow(x, y, w, h, t);
            if (wanted && !sel) outline(x, y, w, h, rgba(VT.amber, 0.85), true, t);
            if (sel) outline(x, y, w, h, VT.paper);
            return;
        }
        const building = r.job && r.job.op === 'build';
        const taken = r.flesh === 1;
        if (!taken) {
            const dark = r.broken || building;
            roomFrame(x, y, w, h, !dark && r.kind !== 'empty' && r.kind !== 'rock');
            if (r.kind === 'empty' && !r.flesh) {
                ctx.fillStyle = rgba(VT.mist, 0.25);
                ctx.fillRect(x + w / 2 - 4, y + h / 2, 9, 1); ctx.fillRect(x + w / 2, y + h / 2 - 4, 1, 9);
            } else if (r.kind !== 'rock' && !building) {
                ctx.save();
                ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.clip();
                art(s, r, i, x + 2, y + 2, w - 4, h - 4, t, dark);
                ctx.restore();
            }
            if (building || (r.job && (r.job.op === 'upgrade' || r.job.op === 'repair'))) progress(x, y, w, h, 1 - r.job.left / r.job.total, VT.paper);
            if (building) hammer(x + w / 2, y + h / 2 - 4, t);
            if (r.broken && !r.job) {
                ctx.strokeStyle = rgba(VT.danger, 0.6);
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(x + 10, y + 10); ctx.lineTo(x + w - 10, y + h - 10); ctx.moveTo(x + w - 10, y + 10); ctx.lineTo(x + 10, y + h - 10); ctx.stroke();
                ctx.lineWidth = 1;
            }
            // the level, as small pips
            if (r.lvl > 1 && r.kind !== 'rock') {
                ctx.fillStyle = rgba(VT.paper, 0.8);
                for (let k = 0; k < r.lvl; k++) ctx.fillRect(x + w - 9 - k * 6, y + 6, 4, 4);
            }
        }
        // the body: creeping over the room from below, or the room swallowed and breathing
        if (r.flesh || growingHere) flesh(s, x, y, w, h, taken ? 1 : (r.flesh || 0), t, i, r);
        if (can) glow(x, y, w, h, t);
        if (wanted && !sel) outline(x, y, w, h, rgba(VT.amber, 0.85), true, t);
        if (ui.trouble && ui.trouble.has(i)) {
            ctx.strokeStyle = rgba(VT.danger, 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 6)));
            ctx.lineWidth = 3;
            ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
            ctx.lineWidth = 1;
        }
        if (ui.complain && ui.complain.has(i)) complainTab(x, y, ui.complain.get(i), t);
        if (sel) outline(x, y, w, h, VT.paper);
    }
    /** A room complaining: a small tab on its top-left corner with an icon. */
    function complainTab(x, y, kind, t) {
        const cx = x + 2, cy = y - 10;
        ctx.save();
        ctx.translate(cx + 9, cy + 9 + Math.sin(t * 3) * 1);
        ctx.fillStyle = VT.amber;
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = VT.steel; ctx.fillStyle = VT.steel; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath();
        if (kind === 'power') { ctx.moveTo(1.5, -6); ctx.lineTo(-3, 1); ctx.lineTo(1, 1); ctx.lineTo(-1.5, 6); ctx.stroke(); }
        else if (kind === 'food') { ctx.ellipse(0, 2.5, 6, 1.8, 0, 0, Math.PI * 2); ctx.moveTo(-4.5, 2); ctx.arc(0, 2, 4.5, Math.PI, 0); ctx.stroke(); }
        else { ctx.moveTo(0, -5); ctx.lineTo(0, 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 4.8, 1.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }

    function progress(x, y, w, h, k, c) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x + 8, y + h - 12, w - 16, 4);
        ctx.fillStyle = c;
        ctx.fillRect(x + 8, y + h - 12, (w - 16) * Math.max(0, Math.min(1, k)), 4);
    }
    function glow(x, y, w, h, t) {
        ctx.strokeStyle = rgba(VT.paper, 0.45 + 0.35 * Math.sin(t * 5));
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.lineWidth = 1;
    }
    function outline(x, y, w, h, c, dashed, t = 0) {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        if (dashed) { ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 12; }
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
    }
    function pickaxe(cx, cy, t) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(t * 8) * 0.5);
        ctx.strokeStyle = VT.plate; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -8); ctx.moveTo(-9, -6); ctx.quadraticCurveTo(0, -12, 9, -6); ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
    }
    function hammer(cx, cy, t) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.5 + Math.max(0, Math.sin(t * 7)) * 0.7);
        ctx.strokeStyle = rgba(VT.plate, 0.7); ctx.fillStyle = rgba(VT.plate, 0.7); ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -5); ctx.stroke();
        ctx.fillRect(-6, -9, 12, 5);
        ctx.restore();
        ctx.lineWidth = 1;
    }

    /** The suites' hundred windows, cached: lit per one awake, cold per one asleep, dark empty. */
    function suiteWindows(s, r, i, x, y, w, h, t, dim) {
        const list = roomsOf(s, 'suites');
        const k = Math.max(0, list.indexOf(r));
        const before = k * SUITE_BEDS;
        const total = s.residents;
        const asleepShare = total ? s.asleep / total : 0;
        const here = Math.max(0, Math.min(SUITE_BEDS, total - before));
        const tick = Math.floor(t / 6);
        const key = `${w}x${h}|${here}|${Math.round(asleepShare * 100)}|${tick}|${dim ? 1 : 0}`;
        let c = suites.get(i);
        if (!c || c.key !== key) {
            const o = offscreen(w, h);
            const gw = (w - 10) / 10, gh = (h - 12) / 10;
            for (let n = 0; n < 100; n++) {
                const cx = 5 + (n % 10) * gw, cy = 6 + Math.floor(n / 10) * gh;
                let col = '#161b22';
                if (n < here && !dim) {
                    const sleeping = hash(n * 7 + k * 101) < asleepShare;
                    col = sleeping ? rgba(VT.cold, 0.75) : (hash(n + k * 13 + tick) > 0.06 ? VT.lamp : '#6d6250');
                } else if (dim) col = hash(n * 3 + k) > 0.8 ? rgba(VT.cold, 0.35) : '#1a1215';
                o.g.fillStyle = col;
                o.g.fillRect(cx + 1, cy + 1, gw - 2, gh - 2);
            }
            c = { key, c: o.c };
            suites.set(i, c);
        }
        ctx.drawImage(c.c, x, y, w, h);
    }

    /**
     * Each room its own simple, strong motif, drawn in the room's light (plate and mist), with the
     * accent only where it means something: cold for sleep, life for plants, lamp for lit windows.
     */
    function art(s, r, i, x, y, w, h, t, dark) {
        const floor = y + h - 2;
        const P = VT.plate, M = VT.mist, S = VT.slate;
        ctx.globalAlpha = dark ? 0.25 : 1;
        ctx.lineCap = 'round';
        switch (r.kind) {
            case 'common': {
                // two sofas, a low table, a standing lamp
                ctx.fillStyle = S;
                ctx.beginPath(); ctx.roundRect(x + 8, floor - 15, w * 0.3, 11, 3); ctx.fill();
                ctx.beginPath(); ctx.roundRect(x + w - 8 - w * 0.3, floor - 15, w * 0.3, 11, 3); ctx.fill();
                ctx.fillStyle = M;
                ctx.fillRect(x + 8, floor - 21, 5, 17); ctx.fillRect(x + w - 13, floor - 21, 5, 17);
                ctx.fillStyle = P; ctx.fillRect(x + w / 2 - 8, floor - 12, 16, 3); ctx.fillRect(x + w / 2 - 1, floor - 9, 2, 7);
                ctx.fillStyle = rgba(VT.lamp, 0.9); ctx.fillRect(x + w / 2 - 3, y + h * 0.3, 6, 4);
                ctx.fillStyle = rgba(VT.lamp, 0.1);
                ctx.beginPath(); ctx.moveTo(x + w / 2 - 3, y + h * 0.3 + 4); ctx.lineTo(x + w / 2 - 22, floor - 3); ctx.lineTo(x + w / 2 + 22, floor - 3); ctx.lineTo(x + w / 2 + 3, y + h * 0.3 + 4); ctx.fill();
                break;
            }
            case 'engine': machine(x, y, w, h, t, r); break;
            case 'hydro': {
                for (let row = 0; row < 3; row++) {
                    const ry = y + 12 + row * (h - 18) / 3;
                    ctx.fillStyle = rgba(VT.plate, 0.35); ctx.fillRect(x + 6, ry - 2, w - 12, 1);       // the grow light
                    ctx.fillStyle = S; ctx.fillRect(x + 5, ry + 9, w - 10, 3);                          // the tray
                    ctx.fillStyle = VT.life;
                    for (let px = x + 9; px < x + w - 8; px += 7) { ctx.beginPath(); ctx.arc(px, ry + 6 + Math.sin(t + px) * 0.5, 2.6, 0, Math.PI * 2); ctx.fill(); }
                }
                break;
            }
            case 'suites': suiteWindows(s, r, i, x, y, w, h, t, false); break;
            case 'cinema': {
                const f = 0.55 + 0.4 * Math.abs(Math.sin(t * 7) * Math.sin(t * 3.3));
                ctx.fillStyle = rgba(VT.plate, f); ctx.fillRect(x + 8, y + 10, w - 16, h * 0.4);
                ctx.fillStyle = rgba(VT.plate, 0.06 * f);
                ctx.beginPath(); ctx.moveTo(x + 8, y + 10 + h * 0.4); ctx.lineTo(x + w - 8, y + 10 + h * 0.4); ctx.lineTo(x + w, floor); ctx.lineTo(x, floor); ctx.fill();
                ctx.fillStyle = S;
                for (let row = 0; row < 2; row++) for (let px = x + 9; px < x + w - 9; px += 8) ctx.fillRect(px, floor - 17 + row * 8, 6, 5);
                break;
            }
            case 'gym': {
                ctx.fillStyle = M;
                ctx.fillRect(x + 8, floor - 10, w * 0.32, 3);
                ctx.fillRect(x + 8 + w * 0.12, floor - 22, 3, 12);
                ctx.fillStyle = S; ctx.beginPath(); ctx.arc(x + 12, floor - 26, 5, 0, Math.PI * 2); ctx.arc(x + 12 + w * 0.22, floor - 26, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = M; ctx.fillRect(x + 12, floor - 27, w * 0.22, 2);
                if (r.lvl >= 2) { ctx.fillStyle = rgba(VT.cold, 0.7); ctx.fillRect(x + w * 0.52, floor - 10, w * 0.42, 7); }
                if (r.lvl >= 3) {
                    ctx.strokeStyle = rgba(VT.plate, 0.3);
                    for (let k = 0; k < 3; k++) { const sx = x + w * 0.6 + k * 8; ctx.beginPath(); ctx.moveTo(sx, floor - 14); ctx.quadraticCurveTo(sx + 4 * Math.sin(t * 2 + k), floor - 24, sx, floor - 34); ctx.stroke(); }
                }
                break;
            }
            case 'bar': {
                ctx.fillStyle = S; ctx.fillRect(x + 5, floor - 15, w - 10, 11);
                ctx.fillStyle = M; ctx.fillRect(x + 5, floor - 15, w - 10, 2);
                ctx.fillStyle = S; ctx.fillRect(x + 5, y + 16, w - 10, 2);
                for (let px = x + 9, n = 0; px < x + w - 8; px += 6, n++) {
                    const glint = Math.sin(t * 2 + n * 1.7) > 0.92;
                    ctx.fillStyle = glint ? VT.paper : rgba(VT.plate, 0.35 + (n % 3) * 0.15);
                    ctx.fillRect(px, y + 7, 3, 9);
                }
                break;
            }
            case 'garden': {
                ctx.fillStyle = rgba(VT.lamp, 0.95); ctx.beginPath(); ctx.arc(x + w / 2, y + 10, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = rgba(VT.lamp, 0.1); ctx.beginPath(); ctx.moveTo(x + w / 2, y + 10); ctx.lineTo(x, floor); ctx.lineTo(x + w, floor); ctx.fill();
                for (let k = 0; k < 3; k++) {
                    const tx = x + w * (0.22 + k * 0.28);
                    ctx.fillStyle = S; ctx.fillRect(tx - 1.5, floor - 14, 3, 13);
                    ctx.fillStyle = r.lvl >= 2 ? VT.life : rgba(VT.life, 0.75);
                    ctx.beginPath(); ctx.arc(tx, floor - 18, 8 + Math.sin(t + k) * 0.6, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case 'game': {
                for (let k = 0; k < 3; k++) {
                    const sw = (w - 12) / 3;
                    const sx = x + 6 + k * sw;
                    const on = Math.sin(t * (3 + k) + k) > -0.2;
                    ctx.fillStyle = on ? (k === 1 ? rgba(VT.cold, 0.85) : rgba(VT.plate, 0.85)) : '#1a2029';
                    ctx.fillRect(sx + 2, y + 12, sw - 4, h * 0.3);
                    ctx.fillStyle = S; ctx.fillRect(sx + sw / 2 - 1, y + 12 + h * 0.3, 2, 9);
                    ctx.fillRect(sx + sw / 2 - 5, y + 20 + h * 0.3, 10, 2);
                }
                break;
            }
            case 'mine': {
                ctx.fillStyle = S;
                for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + 12 + k * 7, floor - 1, 6, Math.PI, 0); ctx.fill(); }
                ctx.fillStyle = rgba(VT.lamp, 0.6);
                for (let k = 0; k < 5; k++) ctx.fillRect(x + 10 + k * 6, floor - 4 - (k % 2) * 3, 2, 2);
                const bx = x + w * 0.7, by = y + h * 0.38;
                ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(t * 1.4) * 0.15);
                ctx.fillStyle = M; ctx.fillRect(-4, -14, 8, 22);
                ctx.fillStyle = P; ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(0, 16 + Math.sin(t * 20)); ctx.lineTo(5, 8); ctx.fill();
                ctx.restore();
                break;
            }
            case 'meatlab': meatLab(x, y, w, h, t, r); break;
            case 'cryo': {
                const cols = 5 * r.lvl, rows = 2;
                const pw = (w - 10) / cols, ph = (h - 16) / rows;
                const share = s.asleep / Math.max(1, roomsOf(s, 'cryo').reduce((a, q) => a + q.lvl * PODS_PER_LEVEL, 0));
                for (let n = 0; n < cols * rows; n++) {
                    const cx = x + 5 + (n % cols) * pw, cy = y + 8 + Math.floor(n / cols) * ph;
                    const filled = n / (cols * rows) < share;
                    ctx.fillStyle = filled ? rgba(VT.cold, 0.5 + 0.15 * Math.sin(t + n)) : '#161c24';
                    ctx.beginPath(); ctx.roundRect(cx + 1.5, cy + 1.5, pw - 3, ph - 3, 3); ctx.fill();
                }
                break;
            }
            default: break;
        }
        ctx.globalAlpha = 1;
    }

    /**
     * The Meat Lab, in the palace: a clean white lab, comic and tidy. Steel vats with a red slab
     * floating in each, a lamp over a steel table with a steak on it, a hook with a cut hanging.
     * The meat is the only red; it does not glow (only the body does).
     */
    function meatLab(x, y, w, h, t, r) {
        const floor = y + h - 2;
        const P = VT.plate, M = VT.mist, S = VT.slate;
        // the lamp over the table, and its cone
        const lx = x + w * 0.68;
        ctx.fillStyle = M; ctx.fillRect(lx - 0.5, y, 1, h * 0.22);
        ctx.fillStyle = P; ctx.beginPath(); ctx.moveTo(lx - 7, y + h * 0.22 + 5); ctx.lineTo(lx - 3, y + h * 0.22); ctx.lineTo(lx + 3, y + h * 0.22); ctx.lineTo(lx + 7, y + h * 0.22 + 5); ctx.fill();
        ctx.fillStyle = rgba(VT.lamp, 0.12);
        ctx.beginPath(); ctx.moveTo(lx - 7, y + h * 0.22 + 5); ctx.lineTo(lx - w * 0.22, floor - 12); ctx.lineTo(lx + w * 0.22, floor - 12); ctx.lineTo(lx + 7, y + h * 0.22 + 5); ctx.fill();
        // the steel table and the steak on it (fat rim, a bone)
        ctx.fillStyle = S; ctx.fillRect(lx - w * 0.2, floor - 13, w * 0.4, 3);
        ctx.fillStyle = M; ctx.fillRect(lx - w * 0.2, floor - 13, w * 0.4, 1);
        ctx.fillRect(lx - w * 0.17, floor - 10, 2, 9); ctx.fillRect(lx + w * 0.17 - 2, floor - 10, 2, 9);
        ctx.fillStyle = VT.fBone; ctx.beginPath(); ctx.ellipse(lx, floor - 16, 9, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = VT.fCore; ctx.beginPath(); ctx.ellipse(lx - 0.5, floor - 16.3, 7.6, 2.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,170,175,0.35)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(lx - 5, floor - 17); ctx.quadraticCurveTo(lx, floor - 18.5, lx + 5, floor - 17); ctx.stroke();
        // the vats: steel tanks, a slab of red turning slowly in each
        const n = r.lvl >= 2 ? 3 : 2;
        const vw = Math.min(14, w * 0.15), vh = h * 0.5;
        for (let k = 0; k < n; k++) {
            const vx = x + 6 + k * (vw + 4), vy = floor - 4 - vh;
            ctx.fillStyle = '#161c24'; ctx.beginPath(); ctx.roundRect(vx, vy, vw, vh, 3); ctx.fill();
            ctx.save(); ctx.beginPath(); ctx.roundRect(vx + 1, vy + 1, vw - 2, vh - 2, 2); ctx.clip();
            const bob = Math.sin(t * 0.9 + k * 1.7) * 2;
            ctx.fillStyle = VT.fCore;
            ctx.beginPath(); ctx.ellipse(vx + vw / 2, vy + vh * 0.55 + bob, vw * 0.32, vh * 0.2, Math.sin(t * 0.4 + k) * 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = rgba(VT.fBone, 0.6);
            ctx.fillRect(vx + vw / 2 - vw * 0.2, vy + vh * 0.5 + bob, vw * 0.4, 1);
            ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(vx + 2, vy + 3, 2, vh - 6);
            ctx.restore();
            ctx.strokeStyle = rgba(M, 0.6); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(vx + 0.5, vy + 0.5, vw - 1, vh - 1, 3); ctx.stroke();
            ctx.fillStyle = S; ctx.fillRect(vx - 1, vy - 3, vw + 2, 3); ctx.fillRect(vx - 1, floor - 4, vw + 2, 3);
            ctx.fillStyle = M; ctx.fillRect(vx + vw / 2 - 0.5, y + 2, 1, vy - 3 - y - 2);
        }
        // a cut on a hook, swinging a little
        const hx = x + w - 9, sw = Math.sin(t * 1.3) * 0.08;
        ctx.save(); ctx.translate(hx, y + 4); ctx.rotate(sw);
        ctx.strokeStyle = M; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.arc(-2, 8, 2, 0, Math.PI); ctx.stroke();
        ctx.fillStyle = VT.fCore; ctx.beginPath(); ctx.ellipse(0, 16, 3.6, 6.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(VT.fBone, 0.7); ctx.fillRect(-0.5, 10, 1, 4);
        ctx.restore();
    }

    /**
     * The Engine Room: the RPS machine of the locked mockup (deep-machine-12) seen from the side.
     * Steel on a plate, a bare tube in a cage with the three hands turning in it, a cog, a stack
     * with smoke, cables to the floor with a cold pulse running inside them. No walls.
     */
    function machine(x, y, w, h, t, r) {
        const floor = y + h - 2;
        const cx = x + w / 2;
        // cables from the base into the floor, a pulse inside
        ctx.lineWidth = 3; ctx.strokeStyle = '#1d2328';
        const cables = [[-0.32, -0.2], [0.3, 0.18], [-0.1, -0.42]];
        for (const [a, b] of cables) {
            ctx.beginPath(); ctx.moveTo(cx + w * a * 0.5, floor - 12); ctx.quadraticCurveTo(cx + w * a, floor - 2, cx + w * b, floor + 2); ctx.stroke();
        }
        ctx.lineWidth = 1;
        for (let k = 0; k < cables.length; k++) {
            const [a, b] = cables[k];
            const p = (t * 0.8 + k * 0.37) % 1;
            const x0 = cx + w * a * 0.5, y0 = floor - 12, x1 = cx + w * a, y1 = floor - 2, x2 = cx + w * b, y2 = floor + 2;
            const q = 1 - p;
            const px = q * q * x0 + 2 * q * p * x1 + p * p * x2, py = q * q * y0 + 2 * q * p * y1 + p * p * y2;
            ctx.fillStyle = rgba(VT.cold, 0.9); ctx.fillRect(px - 1.5, py - 1, 3, 2);
        }
        // the plate
        ctx.fillStyle = VT.slate; ctx.fillRect(x + 6, floor - 12, w - 12, 9);
        ctx.fillStyle = VT.mist; ctx.fillRect(x + 6, floor - 12, w - 12, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let bx = x + 10; bx < x + w - 10; bx += 9) ctx.fillRect(bx, floor - 8, 2, 2);
        // the body of the machine
        const bw = Math.min(w * 0.36, 30), bh = h * 0.24;
        ctx.fillStyle = '#5a6574'; ctx.fillRect(cx - bw / 2, floor - 12 - bh, bw, bh);
        ctx.fillStyle = VT.mist; ctx.fillRect(cx - bw / 2, floor - 12 - bh, bw, 2);
        ctx.fillStyle = VT.slate; ctx.fillRect(cx - bw / 2 + 4, floor - 12 - bh + 6, bw - 8, 4);
        // the tube in its cage, the three hands turning inside
        const tw = Math.min(16, w * 0.18), th = h * 0.36, tx = cx - tw / 2, ty = floor - 12 - bh - th;
        ctx.fillStyle = rgba(VT.cold, 0.1); ctx.fillRect(tx, ty, tw, th);
        const sym = Math.floor(t * 1.5) % 3;
        ctx.strokeStyle = VT.plate; ctx.fillStyle = VT.plate; ctx.lineWidth = 1.5;
        const sy = ty + th / 2;
        if (sym === 0) { ctx.beginPath(); ctx.arc(cx, sy, 3.5, 0, Math.PI * 2); ctx.fill(); }
        else if (sym === 1) ctx.fillRect(cx - 3, sy - 4, 6, 8);
        else { ctx.beginPath(); ctx.moveTo(cx - 4, sy - 4); ctx.lineTo(cx + 4, sy + 4); ctx.moveTo(cx + 4, sy - 4); ctx.lineTo(cx - 4, sy + 4); ctx.stroke(); }
        ctx.strokeStyle = rgba(VT.mist, 0.8); ctx.lineWidth = 1;
        ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);
        ctx.beginPath(); for (let k = 1; k < 3; k++) { ctx.moveTo(tx + (tw * k) / 3, ty); ctx.lineTo(tx + (tw * k) / 3, ty + th); } ctx.stroke();
        ctx.fillStyle = VT.mist; ctx.fillRect(tx - 2, ty - 3, tw + 4, 3);
        // a cog, turning with the level's speed
        const gx = x + 15, gy = floor - 20, R = Math.min(9, w * 0.1);
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(t * 0.6 * (r.lvl || 1));
        ctx.fillStyle = '#5a6574';
        for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-1.5, -R - 2.5, 3, 4); }
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = VT.slate; ctx.beginPath(); ctx.arc(0, 0, R * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // the stack and its smoke
        const kx = x + w - 15;
        ctx.fillStyle = VT.slate; ctx.fillRect(kx - 3, floor - 12 - h * 0.42, 6, h * 0.42);
        ctx.fillStyle = VT.mist; ctx.fillRect(kx - 4, floor - 12 - h * 0.42, 8, 2);
        for (let k = 0; k < 3; k++) {
            const p = (t * 0.35 + k / 3) % 1;
            ctx.fillStyle = rgba(VT.mist, 0.28 * (1 - p));
            ctx.beginPath(); ctx.arc(kx + Math.sin(p * 4 + k) * 3, floor - 14 - h * 0.42 - p * 22, 3 + p * 5, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ---------------------------------------------------------------- the body
    /**
     * A room's tissue, drawn once: depth (dark red to near black), muscle fibre in bundles that each
     * run their own way, a band of pale sinew, mycelium hairs, branching vessels (a dark wall, a red
     * core, a wet edge), and a separate layer of wet glints. `reach` holds only the vessels and the
     * mycelium: what runs ahead of the flesh over a room it is taking.
     */
    function makeTissue(w, h, seed, mask = '') {
        const W2 = w + PAD * 2, H2 = h + PAD * 2;
        const base = offscreen(W2, H2), glint = offscreen(W2, H2), reach = offscreen(W2, H2);
        const R = rng(seed + 0.137);
        const g = base.g;
        const depth = g.createLinearGradient(0, 0, 0, H2);
        depth.addColorStop(0, '#2e0c15'); depth.addColorStop(0.5, '#200910'); depth.addColorStop(1, VT.fDark);
        g.fillStyle = depth; g.fillRect(0, 0, W2, H2);
        for (let k = 0; k < 4; k++) {
            const bx = R() * W2, by = R() * H2, br = 10 + R() * 26;
            const rg = g.createRadialGradient(bx, by, 1, bx, by, br);
            rg.addColorStop(0, rgba(VT.fBruise, 0.8)); rg.addColorStop(1, rgba(VT.fBruise, 0));
            g.fillStyle = rg; g.fillRect(0, 0, W2, H2);
        }
        // muscle: two or three bundles, each running its own way, fibre laid on fibre
        const bundles = [0, 1, 2].map(() => ({ x: R() * W2, y: R() * H2, a: (R() - 0.5) * 1.2 }));
        const fibres = [];
        const n = Math.round((W2 * H2) / 34);
        g.lineCap = 'round';
        for (let k = 0; k < n; k++) {
            const fx = R() * W2, fy = R() * H2;
            let best = bundles[0], bd = 1e9;
            for (const b of bundles) { const d = (b.x - fx) ** 2 + (b.y - fy) ** 2; if (d < bd) { bd = d; best = b; } }
            const a = best.a + (R() - 0.5) * 0.08, len = 34 + R() * 46;
            const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2, bend = (R() - 0.5) * 4;
            const pick = R();
            g.strokeStyle = pick < 0.5 ? 'rgba(16,6,9,0.6)' : pick < 0.9 ? 'rgba(88,24,38,0.42)' : 'rgba(150,52,64,0.28)';
            g.lineWidth = 1.6 + R() * 2.4;
            g.beginPath(); g.moveTo(fx - dx, fy - dy); g.quadraticCurveTo(fx - bend * Math.sin(a), fy + bend * Math.cos(a), fx + dx, fy + dy); g.stroke();
            if (R() < 0.1) fibres.push({ fx, fy, a });
        }
        // the wet sheen: broad soft light along each bundle
        for (const b of bundles) {
            g.save();
            g.translate(b.x, b.y); g.rotate(b.a);
            const sh = g.createLinearGradient(0, -12, 0, 12);
            sh.addColorStop(0, 'rgba(255,150,160,0)'); sh.addColorStop(0.5, 'rgba(255,150,160,0.10)'); sh.addColorStop(1, 'rgba(255,150,160,0)');
            g.fillStyle = sh; g.fillRect(-W2, -12, W2 * 2, 24);
            g.restore();
        }
        // sinew: a bone-pale tendon that curves across (an S, not a ruler line), striated, wet on top
        const bands = R() < 0.7 ? 1 : 0;
        for (let b = 0; b < bands; b++) {
            const yA = R() * H2, yB = R() * H2, bw = 4 + R() * 4;
            const c1 = yA + (R() - 0.5) * H2 * 0.9, c2 = yB + (R() - 0.5) * H2 * 0.9;
            const curve = (gg, off) => { gg.beginPath(); gg.moveTo(-2, yA + off); gg.bezierCurveTo(W2 * 0.33, c1 + off, W2 * 0.66, c2 + off, W2 + 2, yB + off); };
            g.lineCap = 'round';
            curve(g, 1.5); g.strokeStyle = 'rgba(12,4,7,0.55)'; g.lineWidth = bw + 3; g.stroke();
            curve(g, 0); g.strokeStyle = rgba(VT.fBone, 0.32); g.lineWidth = bw; g.stroke();
            for (let s2 = 1; s2 < 5; s2++) {
                curve(g, (s2 / 5 - 0.5) * bw);
                g.strokeStyle = s2 % 2 ? rgba(VT.fBone, 0.55 + R() * 0.2) : 'rgba(60,20,28,0.35)';
                g.lineWidth = 0.7; g.stroke();
            }
            curve(g, -bw * 0.3); g.strokeStyle = 'rgba(255,235,235,0.3)'; g.lineWidth = 0.8; g.stroke();
        }
        // mycelium: pale hairs, branching (into the reach too)
        for (const gg of [g, reach.g]) gg.lineWidth = 0.6;
        for (let k = 0; k < 14; k++) {
            let hx = R() * W2, hy = H2 - R() * H2 * 0.3, a = -Math.PI / 2 + (R() - 0.5) * 1.6;
            const pts = [[hx, hy]];
            for (let st = 0; st < 9; st++) { a += (R() - 0.5) * 0.9; hx += Math.cos(a) * 7; hy += Math.sin(a) * 7; pts.push([hx, hy]); }
            const al = 0.12 + R() * 0.16;
            for (const gg of [g, reach.g]) {
                gg.strokeStyle = rgba(VT.fHyphae, gg === g ? al * 0.6 : al * 1.6);
                gg.beginPath(); gg.moveTo(pts[0][0], pts[0][1]); for (const p of pts) gg.lineTo(p[0], p[1]); gg.stroke();
            }
        }
        // vessels: trees growing up from the bottom edge
        const vessels = [];
        function branch(bx, by, a, len, wid, depthLeft, pts) {
            pts.push([bx, by]);
            let px = bx, py = by;
            const steps = 3 + Math.floor(R() * 3);
            for (let st = 0; st < steps; st++) {
                a += (R() - 0.5) * 0.55;
                px += Math.cos(a) * len / steps; py += Math.sin(a) * len / steps;
                pts.push([px, py]);
            }
            vessels.push({ pts: pts.slice(), wid, delay: R() });
            if (depthLeft > 0) {
                const k = 1 + (R() < 0.6 ? 1 : 0);
                for (let b = 0; b < k; b++) branch(px, py, a + (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.5), len * 0.7, wid * 0.65, depthLeft - 1, [[px, py]]);
            }
        }
        const roots = 2 + Math.floor(R() * 2);
        for (let k = 0; k < roots; k++) branch(PAD + R() * w, H2, -Math.PI / 2 + (R() - 0.5) * 0.7, h * 0.5, 3.2, 2, []);
        for (const gg of [g, reach.g]) {
            for (const v of vessels) {
                const path = () => { gg.beginPath(); gg.moveTo(v.pts[0][0], v.pts[0][1]); for (const p of v.pts) gg.lineTo(p[0], p[1]); };
                gg.lineJoin = 'round'; gg.lineCap = 'round';
                path(); gg.strokeStyle = VT.fArtery; gg.lineWidth = v.wid + 2.2; gg.stroke();
                path(); gg.strokeStyle = VT.fCore; gg.lineWidth = v.wid; gg.stroke();
                gg.save(); gg.translate(-v.wid * 0.25, -v.wid * 0.25);
                path(); gg.strokeStyle = 'rgba(255,170,175,0.22)'; gg.lineWidth = Math.max(0.6, v.wid * 0.25); gg.stroke();
                gg.restore();
            }
        }
        // wet glints: short bright streaks along the fibres and on the vessels
        glint.g.lineCap = 'round';
        for (const f of fibres) {
            const len = 2 + R() * 5;
            glint.g.strokeStyle = `rgba(255,226,230,${0.35 + R() * 0.4})`;
            glint.g.lineWidth = 0.8 + R() * 0.6;
            glint.g.beginPath(); glint.g.moveTo(f.fx, f.fy); glint.g.lineTo(f.fx + Math.cos(f.a) * len, f.fy + Math.sin(f.a) * len); glint.g.stroke();
        }
        for (const v of vessels) {
            if (v.wid < 1.5) continue;
            const p = v.pts[1 + Math.floor(R() * (v.pts.length - 1))];
            glint.g.fillStyle = 'rgba(255,220,225,0.7)';
            glint.g.fillRect(p[0] - v.wid * 0.3, p[1] - v.wid * 0.4, 1.5, 1.2);
        }
        // a dark edge where the body ends; none where it runs on into a neighbour (no seam)
        const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => {
            const lg = g.createLinearGradient(x0, y0, x1, y1);
            lg.addColorStop(0, 'rgba(6,2,3,0.6)'); lg.addColorStop(1, 'rgba(6,2,3,0)');
            g.fillStyle = lg; g.fillRect(rx, ry, rw, rh);
        };
        const ew = Math.min(W2, H2) * 0.3;
        if (!mask.includes('l')) edge(0, 0, ew, 0, 0, 0, ew, H2);
        if (!mask.includes('r')) edge(W2, 0, W2 - ew, 0, W2 - ew, 0, ew, H2);
        if (!mask.includes('u')) edge(0, 0, 0, ew, 0, 0, W2, ew);
        if (!mask.includes('d')) edge(0, H2, 0, H2 - ew, 0, H2 - ew, W2, ew);
        return { base: base.c, glint: glint.c, reach: reach.c, vessels, W2, H2 };
    }
    /** Which sides of room i run on into body: l, r (not across the shaft), u, d. */
    function bodyMask(s, i) {
        const ix = idxOf(i), lv = levelOf(i);
        const f = (j) => j >= 0 && j < s.rooms.length && isFlesh(s.rooms[j]);
        return (ix > 0 && ix !== geo.half && f(i - 1) ? 'l' : '') + (ix < SLOTS - 1 && ix !== geo.half - 1 && f(i + 1) ? 'r' : '')
            + (lv > 0 && f(i - SLOTS) ? 'u' : '') + (lv < LEVELS - 1 && f(i + SLOTS) ? 'd' : '');
    }
    function tissueFor(i, w, h, mask = '') {
        const key = `${w}x${h}|${dpr}|${mask}`;
        let c = tissues.get(i);
        if (!c || c.key !== key) { c = { key, ...makeTissue(w, h, i * 7.31 + 3, mask) }; tissues.set(i, c); }
        return c;
    }
    /** The heartbeat: a sharp rise and a slow fall every BEAT seconds. */
    function beat(t) { const p = (t % BEAT) / BEAT; return p < 0.08 ? p / 0.08 : Math.exp(-(p - 0.08) * 6); }

    /** Red light running along the vessels, root to tip, timed by the heart. */
    function pulses(vessels, ox, oy, t, strength) {
        ctx.lineCap = 'round';
        for (const v of vessels) {
            if (v.wid < 2) continue;
            const p = ((t / BEAT) + v.delay * 0.35) % 1;
            const at = (q) => {
                const f = Math.max(0, Math.min(1, q)) * (v.pts.length - 1), k = Math.floor(f), u = f - k;
                const a = v.pts[k], b = v.pts[Math.min(v.pts.length - 1, k + 1)];
                return [ox + a[0] + (b[0] - a[0]) * u, oy + a[1] + (b[1] - a[1]) * u];
            };
            const [x1, y1] = at(p - 0.16), [x2, y2] = at(p - 0.06), [x3, y3] = at(p);
            ctx.strokeStyle = rgba(VT.pulse, 0.55 * strength); ctx.lineWidth = v.wid + 2.5;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
            ctx.strokeStyle = `rgba(255,80,96,${0.8 * strength})`; ctx.lineWidth = Math.max(1, v.wid * 0.6);
            ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
        }
        ctx.lineWidth = 1;
    }
    /** The ragged front of the creep across a room, k = 0..1 up from its floor. */
    function frontPath(x, y, w, h, k, t, seed, over) {
        const top = y + h * (1 - k);
        ctx.beginPath();
        ctx.moveTo(x - over, y + h + over);
        for (let px = x - over; px <= x + w + over; px += 5) {
            const e = Math.sin(px * 0.11 + seed) * 6 + Math.sin(px * 0.37 + seed * 3) * 3 + Math.sin(px * 0.05 + t * 0.7) * 2;
            ctx.lineTo(px, Math.min(y + h + over, top + e));
        }
        ctx.lineTo(x + w + over, y + h + over);
        ctx.closePath();
    }

    /** The flesh in one room: k = 0..1 grown. Taken rooms breathe; growing ones creep. */
    function flesh(s, x, y, w, h, k, t, i, r) {
        const T2 = tissueFor(i, w, h, k >= 1 ? bodyMask(s, i) : '');
        const breath = Math.sin(t * BREATH_RATE * 2 + i * 0.7);
        const hb = beat(t + i * 0.05);
        const ox = x - PAD, oy = y - PAD;
        if (k >= 1) {
            // the old room sinking under the tissue: its drawing pushed down and darkened
            const organ = organOf(r);
            const ghost = r.kind !== 'rock' && !isVatRoom(r) && r.kind !== 'empty' && (!organ || organ === 'tissue');
            ctx.save();
            const sx = 1 + 0.018 * breath, sy = 1 + 0.03 * breath;
            ctx.translate(x + w / 2, y + h);
            ctx.scale(sx, sy);
            ctx.translate(-(x + w / 2), -(y + h));
            ctx.globalAlpha = ghost ? 0.93 : 1;
            ctx.drawImage(T2.base, ox, oy, T2.W2, T2.H2);
            ctx.globalAlpha = 1;
            if (ghost) {
                ctx.save();
                ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.clip();
                ctx.globalAlpha = 0.45;
                ctx.globalCompositeOperation = 'overlay';
                if (r.kind === 'suites') { ctx.translate(0, h * 0.12); suiteWindows(s, r, i, x, y, w, h, t, true); }
                else { ctx.translate(0, h * 0.1); art(s, r, i, x + 2, y + 2, w - 4, h - 4, t, true); }
                ctx.restore();
                ctx.globalAlpha = 1;
            }
            ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, breath);
            ctx.drawImage(T2.glint, ox, oy, T2.W2, T2.H2);
            ctx.globalAlpha = 1;
            ctx.save(); ctx.beginPath(); ctx.rect(x - 2, y - 2, w + 4, h + 4); ctx.clip();
            pulses(T2.vessels, ox, oy, t + i * 0.13, 0.6 + 0.4 * hb);
            ctx.restore();
            if (r.kind === 'vat') vat(x, y, w, h, t, i, breath);
            // the meat lab grown: the same lab, its vats become two of the body's tanks under the lamp
            if (r.kind === 'meatlab' && isVatRoom(r)) {
                vat(x - w * 0.22, y, w * 0.9, h, t, i, breath);
                vat(x + w * 0.3, y, w * 0.9, h, t + 0.6, i + 3, breath);
                ctx.fillStyle = VT.plate; ctx.fillRect(x + w / 2 - 4, y + 2, 8, 2);
                ctx.fillStyle = rgba(VT.lamp, 0.08);
                ctx.beginPath(); ctx.moveTo(x + w / 2 - 4, y + 4); ctx.lineTo(x + 4, y + h - 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.lineTo(x + w / 2 + 4, y + 4); ctx.fill();
            }
            ctx.restore();
            return;
        }
        // the creep: vessels and hyphae run ahead over the room's drawing, the tissue follows
        const reachK = Math.min(1, k + 0.35);
        ctx.save();
        frontPath(x, y, w, h, reachK, t, i, 2); ctx.clip();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(T2.reach, ox, oy, T2.W2, T2.H2);
        ctx.restore();
        ctx.save();
        frontPath(x, y, w, h, k, t, i, 2); ctx.clip();
        ctx.drawImage(T2.base, ox, oy, T2.W2, T2.H2);
        ctx.globalAlpha = 0.5 + 0.5 * Math.max(0, breath);
        ctx.drawImage(T2.glint, ox, oy, T2.W2, T2.H2);
        ctx.globalAlpha = 1;
        ctx.restore();
        if (r.organ && r.organ !== 'tissue') {
            ctx.save();
            frontPath(x, y, w, h, k, t, i, 2); ctx.clip();
            organArt(r.organ, x, y, w, h, t, i, k);
            ctx.restore();
        }
        ctx.save();
        frontPath(x, y, w, h, reachK, t, i, 2); ctx.clip();
        pulses(T2.vessels, ox, oy, t, 0.5 + 0.5 * hb);
        ctx.restore();
        // the wet lip of the front
        ctx.save();
        ctx.beginPath(); ctx.rect(x - 2, y - 2, w + 4, h + 4); ctx.clip();
        const top = y + h * (1 - k);
        ctx.strokeStyle = rgba(VT.pulse, 0.6 + 0.3 * hb); ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let px = x - 2; px <= x + w + 2; px += 5) {
            const e = Math.sin(px * 0.11 + i) * 6 + Math.sin(px * 0.37 + i * 3) * 3 + Math.sin(px * 0.05 + t * 0.7) * 2;
            if (px === x - 2) ctx.moveTo(px, top + e); else ctx.lineTo(px, top + e);
        }
        ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
    }

    /**
     * A vat: a glass tank on steel, something dense and red turning inside (a knot of fibre, not a
     * sac), bubbles, a glass streak, two tubes up out of the room into the rock with the pulse in them.
     */
    function vat(x, y, w, h, t, i, breath) {
        const tw = Math.max(20, w * 0.5), th = h * 0.68;
        const tx = x + (w - tw) / 2, ty = y + h - th - 8;
        // the tubes, up through the ceiling into the rock
        const up = geo.levelGap + 4;
        for (const fx of [0.3, 0.7]) {
            const px = tx + tw * fx;
            ctx.fillStyle = '#1d2328'; ctx.fillRect(px - 2, y - up, 4, ty - y + up);
            ctx.fillStyle = rgba(VT.mist, 0.25); ctx.fillRect(px - 2, y - up, 1, ty - y + up);
            const p = (t * 0.6 + fx) % 1;
            ctx.fillStyle = rgba(VT.pulse, 0.95); ctx.fillRect(px - 1, ty - (ty - y + up) * p - 3, 2, 5);
        }
        // the inside: deep red, the mass turning
        ctx.save();
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4); ctx.clip();
        ctx.fillStyle = '#1a050a'; ctx.fillRect(tx, ty, tw, th);
        const cx = tx + tw / 2, cy = ty + th * 0.58;
        ctx.lineCap = 'round';
        for (let k = 0; k < 6; k++) {
            const a = t * 0.35 + k * 1.05 + i;
            const r1 = tw * (0.18 + 0.06 * Math.sin(t * 0.8 + k));
            const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a * 1.3) * th * 0.25;
            const x2 = cx + Math.cos(a + 2.4) * r1, y2 = cy + Math.sin(a * 1.3 + 2.4) * th * 0.25;
            ctx.strokeStyle = k % 2 ? VT.fCore : '#3c0d17';
            ctx.lineWidth = 5 + (k % 3) * 2 + breath;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx + Math.sin(a * 2) * 6, cy + Math.cos(a) * 6, x2, y2); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,120,130,0.25)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x1 - 1, y1 - 2); ctx.quadraticCurveTo(cx + Math.sin(a * 2) * 6 - 1, cy + Math.cos(a) * 6 - 2, x2 - 1, y2 - 2); ctx.stroke();
        }
        // its light, with the heart
        const hb = beat(t);
        const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, tw * 0.6);
        rg.addColorStop(0, rgba(VT.pulse, 0.35 + 0.35 * hb)); rg.addColorStop(1, rgba(VT.pulse, 0));
        ctx.fillStyle = rg; ctx.fillRect(tx, ty, tw, th);
        // bubbles
        ctx.fillStyle = 'rgba(255,200,205,0.35)';
        for (let k = 0; k < 4; k++) {
            const p = (t * 0.25 + k * 0.27 + i * 0.1) % 1;
            ctx.beginPath(); ctx.arc(tx + tw * (0.2 + 0.6 * hash(k + i)), ty + th * (1 - p), 1.2 + hash(k) * 1.2, 0, Math.PI * 2); ctx.fill();
        }
        // the liquid line and the glass
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(tx, ty, tw, th * 0.1);
        ctx.fillStyle = 'rgba(255,220,225,0.25)'; ctx.fillRect(tx, ty + th * 0.1, tw, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(tx + tw * 0.14, ty + 3, 3, th - 6);
        ctx.restore();
        ctx.strokeStyle = rgba(VT.plate, 0.45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(tx + 0.5, ty + 0.5, tw - 1, th - 1, 4); ctx.stroke();
        // steel caps
        ctx.fillStyle = VT.slate; ctx.fillRect(tx - 3, ty - 4, tw + 6, 5); ctx.fillRect(tx - 3, ty + th - 1, tw + 6, 6);
        ctx.fillStyle = VT.mist; ctx.fillRect(tx - 3, ty - 4, tw + 6, 1); ctx.fillRect(tx - 3, ty + th - 1, tw + 6, 1);
    }

    /**
     * The organs, drawn over a room's tissue in the same flesh: wet muscle, vessels with the pulse,
     * glints. `form` 0..1: how far it has formed (a growing or changing room shows it forming).
     * HEART beats, LUNGS breathe (two lobes), SKIN is stretched taut across the room, STOMACH churns.
     */
    function organArt(kind, x, y, w, h, t, i, form) {
        if (form <= 0.02) return;
        const hb = beat(t + i * 0.05);
        ctx.save();
        ctx.globalAlpha = Math.min(1, form * 1.4);
        const grow = 0.55 + 0.45 * form;
        if (kind !== 'skin') {
            const hg = ctx.createRadialGradient(x + w / 2, y + h * 0.55, 4, x + w / 2, y + h * 0.55, Math.max(w, h) * 0.6);
            hg.addColorStop(0, 'rgba(6,2,3,0.65)'); hg.addColorStop(1, 'rgba(6,2,3,0)');
            ctx.fillStyle = hg; ctx.fillRect(x, y, w, h);
        }
        if (kind === 'heart') heartArt(x, y, w, h, t, hb, grow);
        else if (kind === 'lungs') lungsArt(x, y, w, h, t, hb, grow, i);
        else if (kind === 'skin') skinArt(x, y, w, h, t, hb, form, i);
        else if (kind === 'stomach') stomachArt(x, y, w, h, t, hb, grow, i);
        ctx.restore();
        ctx.lineWidth = 1;
    }
    /** The organs of the body's rooms, over the sinews and vessels between rooms; a changing room shows its organ forming. */
    function drawOrgans(s, t) {
        for (let i = 0; i < s.rooms.length; i++) {
            const r = s.rooms[i];
            if (r.flesh !== 1) continue;
            const shaping = r.job && r.job.op === 'shape';
            const kind = shaping ? r.job.organ : organOf(r);
            if (!kind || kind === 'tissue') continue;
            const { x, y, w, h } = geo.slots[i];
            ctx.save(); ctx.beginPath(); ctx.rect(x - 2, y - 2, w + 4, h + 4); ctx.clip();
            organArt(kind, x, y, w, h, t, i, shaping ? 1 - r.job.left / r.job.total : 1);
            ctx.restore();
        }
    }
    /** A wet tube: dark wall, red core, a pale wet edge; with the pulse running if `p` is given. */
    function tube(pts, wid, hb) {
        const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); };
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        path(); ctx.strokeStyle = VT.fArtery; ctx.lineWidth = wid + 2; ctx.stroke();
        path(); ctx.strokeStyle = VT.fCore; ctx.lineWidth = wid; ctx.stroke();
        path(); ctx.strokeStyle = rgba(VT.pulse, 0.25 + 0.6 * hb); ctx.lineWidth = Math.max(1, wid * 0.45); ctx.stroke();
        ctx.save(); ctx.translate(-wid * 0.25, -wid * 0.3);
        path(); ctx.strokeStyle = 'rgba(255,170,175,0.22)'; ctx.lineWidth = Math.max(0.6, wid * 0.22); ctx.stroke();
        ctx.restore();
    }
    function heartArt(x, y, w, h, t, hb, grow) {
        const cx = x + w * 0.5, cy = y + h * 0.56;
        const R = Math.min(w * 0.46, h * 0.46) * grow;
        const sc = 1 + 0.1 * hb;
        // the great vessels first, behind: an arch up into the ceiling
        tube([[cx + R * 0.05, cy - R * 0.45], [cx + R * 0.1, cy - R * 0.95], [cx + R * 0.45, y + 4], [cx + R * 0.7, y - 4]], R * 0.22, hb);
        tube([[cx - R * 0.3, cy - R * 0.45], [cx - R * 0.45, cy - R * 0.9], [cx - R * 0.7, y + 2]], R * 0.14, hb * 0.7);
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(-0.35); ctx.scale(sc, sc * (1 - 0.04 * hb));
        // the muscle: two chambers on top, the ventricle tapering to the apex
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(R * 0.05, R * 0.95);
            ctx.bezierCurveTo(-R * 0.95, R * 0.45, -R * 1.0, -R * 0.45, -R * 0.42, -R * 0.62);
            ctx.bezierCurveTo(-R * 0.18, -R * 0.7, -R * 0.02, -R * 0.52, R * 0.08, -R * 0.5);
            ctx.bezierCurveTo(R * 0.55, -R * 0.82, R * 1.0, -R * 0.2, R * 0.05, R * 0.95);
            ctx.closePath();
        };
        const fg = ctx.createRadialGradient(-R * 0.2, -R * 0.15, R * 0.1, 0, 0, R * 1.1);
        fg.addColorStop(0, rgba(VT.pulse, 0.55 + 0.4 * hb)); fg.addColorStop(0.45, VT.fCore); fg.addColorStop(1, VT.fArtery);
        body(); ctx.fillStyle = fg; ctx.fill();
        // fibre wound round it, the way heart muscle spirals
        ctx.save(); body(); ctx.clip();
        ctx.lineCap = 'round';
        for (let k = 0; k < 9; k++) {
            ctx.strokeStyle = k % 2 ? 'rgba(16,6,9,0.45)' : 'rgba(150,52,64,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-R, -R * 0.6 + k * R * 0.2); ctx.quadraticCurveTo(0, -R * 0.2 + k * R * 0.22, R, -R * 0.9 + k * R * 0.2); ctx.stroke();
        }
        ctx.restore();
        // the coronary vessels over it, the pulse in them
        tube([[R * 0.05, -R * 0.5], [-R * 0.1, -R * 0.1], [-R * 0.05, R * 0.35], [R * 0.05, R * 0.8]], R * 0.07, hb);
        tube([[-R * 0.1, -R * 0.1], [-R * 0.5, R * 0.15], [-R * 0.55, R * 0.4]], R * 0.05, hb);
        // wet
        ctx.strokeStyle = 'rgba(255,220,225,0.45)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(-R * 0.45, -R * 0.3, R * 0.3, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(R * 0.35, -R * 0.35, R * 0.2, Math.PI * 1.2, Math.PI * 1.6); ctx.stroke();
        ctx.restore();
        // its light, on the beat
        const lg = ctx.createRadialGradient(cx, cy, 2, cx, cy, R * 1.6);
        lg.addColorStop(0, rgba(VT.pulse, 0.3 * hb)); lg.addColorStop(1, rgba(VT.pulse, 0));
        ctx.fillStyle = lg; ctx.fillRect(x, y, w, h);
    }
    function lungsArt(x, y, w, h, t, hb, grow, i) {
        const br = Math.sin(t * Math.PI * 2 / 4.2 + i);          // a slow breath, in and out
        const cx = x + w / 2, top = y + 6;
        const lw = w * 0.22 * grow * (1 + 0.08 * br), lh = h * 0.36 * grow * (1 + 0.06 * br);
        for (const side of [-1, 1]) {
            const lx = cx + side * w * 0.2, ly = y + h * 0.55;
            ctx.save();
            ctx.translate(lx, ly);
            const lobe = () => {
                ctx.beginPath();
                ctx.moveTo(-side * lw * 0.55, -lh * 0.85);
                ctx.bezierCurveTo(side * lw * 0.9, -lh * 1.1, side * lw * 1.15, lh * 0.6, side * lw * 0.3, lh * 0.95);
                ctx.bezierCurveTo(-side * lw * 0.2, lh * 1.05, -side * lw * 0.75, lh * 0.5, -side * lw * 0.6, 0);
                ctx.closePath();
            };
            const fg = ctx.createRadialGradient(side * lw * 0.2, -lh * 0.2, 2, 0, 0, lh * 1.2);
            fg.addColorStop(0, rgba(VT.pulse, 0.45 + 0.2 * Math.max(0, br))); fg.addColorStop(0.5, VT.fCore); fg.addColorStop(1, VT.fArtery);
            lobe(); ctx.fillStyle = fg; ctx.fill();
            // spongy: the small dark cells, swelling with the breath
            ctx.save(); lobe(); ctx.clip();
            for (let k = 0; k < 46; k++) {
                const px = (hash(k * 3 + side) - 0.5) * lw * 2.2, py = (hash(k * 7 + side * 5) - 0.5) * lh * 2;
                ctx.fillStyle = k % 3 ? 'rgba(16,6,9,0.45)' : 'rgba(150,52,64,0.35)';
                ctx.beginPath(); ctx.arc(px, py, 1.2 + hash(k) * 1.6 + 0.4 * br, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            ctx.strokeStyle = 'rgba(255,220,225,0.4)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(side * lw * 0.15, -lh * 0.35, lw * 0.5, Math.PI * (side > 0 ? 1.3 : 1.4), Math.PI * (side > 0 ? 1.7 : 1.8)); ctx.stroke();
            ctx.restore();
        }
        // the windpipe and its branches: bone-pale rings
        const ty = y + h * 0.42;
        const pipe = (pts, wid) => {
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]);
            ctx.strokeStyle = 'rgba(12,4,7,0.6)'; ctx.lineWidth = wid + 2; ctx.stroke();
            ctx.strokeStyle = rgba(VT.fBone, 0.75); ctx.lineWidth = wid; ctx.stroke();
        };
        pipe([[cx, top - 8], [cx, ty]], 5);
        for (let k = 0; k < 4; k++) { ctx.strokeStyle = 'rgba(60,20,28,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 3, top + k * 6); ctx.lineTo(cx + 3, top + k * 6); ctx.stroke(); }
        for (const side of [-1, 1]) {
            pipe([[cx, ty], [cx + side * w * 0.12, ty + h * 0.08], [cx + side * w * 0.2, ty + h * 0.18]], 3);
            pipe([[cx + side * w * 0.12, ty + h * 0.08], [cx + side * w * 0.26, ty + h * 0.12]], 1.6);
            pipe([[cx + side * w * 0.2, ty + h * 0.18], [cx + side * w * 0.17, ty + h * 0.32]], 1.4);
        }
        // the vessels into them, the pulse
        tube([[cx - 4, y - 4], [cx - w * 0.12, ty + 4], [cx - w * 0.2, y + h * 0.7]], 1.8, hb);
        tube([[cx + 4, y - 4], [cx + w * 0.12, ty + 6], [cx + w * 0.22, y + h * 0.72]], 1.8, hb);
    }
    function skinArt(x, y, w, h, t, hb, form, i) {
        // a membrane stretched across the whole room, pinned at the corners by tendons, pulled taut
        const sag = 3 + Math.sin(t * 0.8 + i) * 1.5;
        const mx = 4, top = y + 6, bot = y + h - 6;
        const span = (x + mx) + (w - mx * 2) * form;
        const shape = () => {
            ctx.beginPath();
            ctx.moveTo(x + mx, top);
            ctx.quadraticCurveTo((x + span) / 2, top + sag, span, top);
            ctx.lineTo(span, bot);
            ctx.quadraticCurveTo((x + span) / 2, bot - sag, x + mx, bot);
            ctx.closePath();
        };
        const fg = ctx.createLinearGradient(0, top, 0, bot);
        fg.addColorStop(0, VT.fMuscle); fg.addColorStop(0.5, VT.fCore); fg.addColorStop(1, VT.fBruise);
        shape(); ctx.fillStyle = fg; ctx.fill();
        ctx.save(); shape(); ctx.clip();
        // creases: pulled lines running along the stretch, a little wavy
        for (let k = 0; k < 7; k++) {
            const cy = top + (k + 0.5) * (bot - top) / 7;
            ctx.strokeStyle = k % 2 ? 'rgba(16,6,9,0.5)' : 'rgba(150,52,64,0.32)';
            ctx.lineWidth = k % 2 ? 1.2 : 0.8;
            ctx.beginPath(); ctx.moveTo(x, cy);
            for (let px = x; px <= x + w; px += 8) ctx.lineTo(px, cy + Math.sin(px * 0.08 + k * 1.3) * 1.6 + (k - 3) * 0.15 * Math.sin(t * 0.8 + i));
            ctx.stroke();
        }
        // pores
        ctx.fillStyle = 'rgba(10,3,6,0.7)';
        for (let k = 0; k < 70; k++) {
            const px = x + 6 + hash(k * 3 + i) * (w - 12), py = top + 4 + hash(k * 5 + i * 7) * (bot - top - 8);
            ctx.beginPath(); ctx.ellipse(px, py, 1.1, 0.7, 0, 0, Math.PI * 2); ctx.fill();
        }
        // the sheen of a surface under strain, brighter on the beat
        const sh = ctx.createLinearGradient(0, top, 0, top + (bot - top) * 0.4);
        sh.addColorStop(0, `rgba(255,170,175,${0.08 + 0.1 * hb})`); sh.addColorStop(1, 'rgba(255,170,175,0)');
        ctx.fillStyle = sh; ctx.fillRect(x, top, w, bot - top);
        ctx.restore();
        // the edge rolled thick, and the tendons that hold it at the corners
        shape(); ctx.strokeStyle = 'rgba(12,4,7,0.8)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.lineCap = 'round';
        for (const [ax, ay, bx, by] of [[x + mx, top, x, y], [span, top, x + w, y], [x + mx, bot, x, y + h], [span, bot, x + w, y + h]]) {
            ctx.strokeStyle = 'rgba(12,4,7,0.6)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2 + 3, (ay + by) / 2 - 2, bx, by); ctx.stroke();
            ctx.strokeStyle = rgba(VT.fBone, 0.7); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2 + 3, (ay + by) / 2 - 2, bx, by); ctx.stroke();
        }
    }
    function stomachArt(x, y, w, h, t, hb, grow, i) {
        // a sac of muscle bent like a J: a wide top on the left, down and round, narrowing up to the right;
        // it twists a little and a wave of squeezing runs along it
        const twist = Math.sin(t * 0.5 + i) * 0.05;
        const cx = x + w / 2, cy = y + h / 2;
        const key = [[-0.2, -0.36], [-0.27, -0.05], [-0.18, 0.24], [0.04, 0.34], [0.24, 0.24], [0.31, 0.02], [0.3, -0.22]];
        const spine = [];
        for (let k = 0; k <= 24; k++) {
            const u = k / 24, f = u * (key.length - 1), j = Math.min(key.length - 2, Math.floor(f)), v = f - j;
            const ax = key[j][0] + (key[j + 1][0] - key[j][0]) * v, ay = key[j][1] + (key[j + 1][1] - key[j][1]) * v;
            const rx = ax * Math.cos(twist) - ay * Math.sin(twist), ry = ax * Math.sin(twist) + ay * Math.cos(twist);
            spine.push([cx + rx * w * grow, cy + ry * h * grow * 1.05, u]);
        }
        const width = (u) => (h * 0.21 * grow) * (1 - 0.62 * u) * Math.min(1, 0.45 + u * 6) * (1 + 0.14 * Math.sin(u * 13 - t * 3.2)) + 2.5;
        const left = [], right = [];
        for (let k = 0; k < spine.length; k++) {
            const a = spine[Math.max(0, k - 1)], b = spine[Math.min(spine.length - 1, k + 1)];
            let nx = -(b[1] - a[1]), ny = b[0] - a[0];
            const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
            const wd = width(spine[k][2]);
            left.push([spine[k][0] + nx * wd, spine[k][1] + ny * wd]);
            right.push([spine[k][0] - nx * wd, spine[k][1] - ny * wd]);
        }
        const last = spine.length - 1;
        // the gullet in from above and the gut out
        tube([[spine[0][0] + 4, y - 4], [spine[1][0] + 4, spine[1][1]]], 5, hb * 0.5);
        tube([[spine[last][0], spine[last][1]], [spine[last][0] + 4, y - 4]], 3.5, hb * 0.5);
        const sac = () => { ctx.beginPath(); left.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]); ctx.closePath(); };
        const fg = ctx.createLinearGradient(x, y, x + w, y + h);
        fg.addColorStop(0, VT.fMuscle); fg.addColorStop(0.5, VT.fCore); fg.addColorStop(1, VT.fArtery);
        sac(); ctx.fillStyle = fg; ctx.fill();
        ctx.save(); sac(); ctx.clip();
        // folds along its length, and the squeezing rings
        ctx.lineCap = 'round';
        for (const off of [-0.5, 0, 0.5]) {
            ctx.strokeStyle = 'rgba(16,6,9,0.5)'; ctx.lineWidth = 1.4;
            ctx.beginPath();
            spine.forEach((p, k) => { const q = [p[0] + (left[k][0] - p[0]) * off, p[1] + (left[k][1] - p[1]) * off + Math.sin(k * 1.3 + t) * 0.8]; if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
            ctx.stroke();
        }
        for (let k = 1; k < spine.length - 1; k++) {
            const wave = Math.sin(spine[k][2] * 14 - t * 3.2);
            if (wave < 0.75) continue;
            ctx.strokeStyle = rgba(VT.pulse, 0.5 * wave); ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(left[k][0], left[k][1]); ctx.lineTo(right[k][0], right[k][1]); ctx.stroke();
        }
        ctx.restore();
        sac(); ctx.strokeStyle = 'rgba(12,4,7,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
        // vessels over it, the pulse; and the wet
        tube(spine.slice(4, 18).map((p, k) => [p[0] + (left[k + 4][0] - p[0]) * 0.6, p[1] + (left[k + 4][1] - p[1]) * 0.6]), 1.6, hb);
        ctx.strokeStyle = 'rgba(255,220,225,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); right.slice(6, 12).forEach((p, k) => { const q = [p[0] + (spine[k + 6][0] - p[0]) * 0.3, p[1] + (spine[k + 6][1] - p[1]) * 0.3]; if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
    }

    /**
     * Sinews and vessels stretched between body rooms: across the gap to a neighbour that is body
     * too, and down through the rock between levels. Cached by which rooms are body.
     */
    function drawBridges(s, t) {
        const sig = s.rooms.map((r) => (isFlesh(r) ? 1 : 0)).join('');
        if (!sig.includes('1')) return;
        const key = `${W}x${H}|${dpr}|${sig}`;
        if (!bridges || bridges.key !== key) {
            const o = offscreen(W, H);
            const g = o.g;
            const R = rng(sig.length + sig.split('1').length * 3.7);
            const vessels = [];
            g.lineCap = 'round';
            const strand = (x1, y1, x2, y2, sag, kind) => {
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag;
                if (kind === 'sinew') {
                    // a tendon: bone-pale, curving (an S through two pulls), striated
                    const c1x = x1 + (x2 - x1) * 0.3 + (R() - 0.5) * 14, c1y = y1 + (y2 - y1) * 0.3 + sag * 1.6;
                    const c2x = x1 + (x2 - x1) * 0.7 + (R() - 0.5) * 14, c2y = y1 + (y2 - y1) * 0.7 - sag * 0.8;
                    for (let q = 0; q < 5; q++) {
                        const off = (q - 2) * 1.1;
                        g.strokeStyle = q === 0 ? 'rgba(30,8,14,0.9)' : q === 1 ? rgba(VT.fBone, 0.55) : rgba(VT.fBone, 0.6 + R() * 0.25);
                        g.lineWidth = q === 0 ? 6 : q === 1 ? 4 : 0.8;
                        g.beginPath(); g.moveTo(x1, y1 + (q > 1 ? off : 0)); g.bezierCurveTo(c1x, c1y + (q > 1 ? off : 0), c2x, c2y + (q > 1 ? off : 0), x2, y2 + (q > 1 ? off : 0)); g.stroke();
                    }
                } else {
                    const pts = [];
                    for (let q = 0; q <= 8; q++) { const u = q / 8, a1 = 1 - u; pts.push([a1 * a1 * x1 + 2 * a1 * u * mx + u * u * x2, a1 * a1 * y1 + 2 * a1 * u * my + u * u * y2]); }
                    g.strokeStyle = VT.fArtery; g.lineWidth = 4.5;
                    g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
                    g.strokeStyle = VT.fCore; g.lineWidth = 2.2; g.stroke();
                    vessels.push({ pts, wid: 2.2, delay: R() });
                }
            };
            for (let i = 0; i < s.rooms.length; i++) {
                if (!isFlesh(s.rooms[i])) continue;
                const a = geo.slots[i];
                const ix = idxOf(i);
                // neighbours on one floor (not across the shaft): one body, no seam. The gap is filled
                // with the same deep red, and vessels run on from deep in one room into the other.
                if (ix < SLOTS - 1 && ix !== geo.half - 1 && isFlesh(s.rooms[i + 1])) {
                    const b = geo.slots[i + 1];
                    const gx0 = a.x + a.w - 14, gx1 = b.x + 14;
                    const sg = g.createLinearGradient(gx0, 0, gx1, 0);
                    sg.addColorStop(0, 'rgba(46,12,21,0)'); sg.addColorStop(0.4, 'rgba(46,12,21,0.6)'); sg.addColorStop(0.6, 'rgba(46,12,21,0.6)'); sg.addColorStop(1, 'rgba(46,12,21,0)');
                    g.fillStyle = sg; g.fillRect(gx0, a.y - 2, gx1 - gx0, a.h + 4);
                    for (let q = 0; q < 3; q++) {
                        const x1 = a.x + a.w * (0.45 + R() * 0.2), y1 = a.y + 10 + R() * (a.h - 20);
                        const x2 = b.x + b.w * (0.15 + R() * 0.25), y2 = a.y + 10 + R() * (a.h - 20);
                        const pts = [];
                        for (let k2 = 0; k2 <= 12; k2++) {
                            const u = k2 / 12;
                            pts.push([x1 + (x2 - x1) * u, y1 + (y2 - y1) * u + Math.sin(u * Math.PI * 2 + q) * 5]);
                        }
                        const wid = q === 0 ? 3 : 1.8;
                        g.strokeStyle = VT.fArtery; g.lineWidth = wid + 2;
                        g.beginPath(); pts.forEach((p, k2) => (k2 ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
                        g.strokeStyle = VT.fCore; g.lineWidth = wid; g.stroke();
                        vessels.push({ pts, wid, delay: R() });
                    }
                }
                if (ix === geo.half - 1 && isFlesh(s.rooms[i + 1])) {
                    const b = geo.slots[i + 1];
                    for (let q = 0; q < 2; q++) {
                        const y1 = a.y + 8 + R() * (a.h - 16), y2 = b.y + 8 + R() * (b.h - 16);
                        strand(a.x + a.w - 10 - R() * 12, y1, b.x + 10 + R() * 12, y2, 4 + R() * 6, q === 0 ? 'vessel' : 'sinew');
                    }
                }
                if (levelOf(i) < LEVELS - 1 && isFlesh(s.rooms[i + SLOTS])) {
                    const b = geo.slots[i + SLOTS];
                    for (let q = 0; q < 2; q++) {
                        const x1 = a.x + 8 + R() * (a.w - 16);
                        strand(x1, a.y + a.h - 8 - R() * 8, x1 + (R() - 0.5) * 20, b.y + 8 + R() * 8, (R() - 0.5) * 6, q === 0 ? 'vessel' : 'sinew');
                    }
                }
            }
            bridges = { key, c: o.c, vessels };
        }
        ctx.drawImage(bridges.c, 0, 0, W, H);
        pulses(bridges.vessels, 0, 0, t, 0.5 + 0.5 * beat(t));
    }

    /** The body climbs the shaft, the spine, as it takes the levels: fibre, a vessel, the pulse up. */
    function drawSpine(s, t) {
        const taken = s.rooms.filter(isFlesh).length;
        if (!taken || riseAnim) return;
        const x = geo.shaftX, w = geo.shaftW;
        const bottom = geo.slots[(LEVELS - 1) * SLOTS].y + geo.levelH;
        const top0 = groundY(s) + 6;
        const top = bottom - (bottom - top0) * Math.min(1, taken / s.rooms.length) * 0.92;
        const hb = beat(t);
        ctx.fillStyle = '#1c070d';
        ctx.fillRect(x + 1, top, w - 2, bottom - top);
        ctx.lineCap = 'round';
        for (let f = 0; f < 4; f++) {
            ctx.strokeStyle = f % 2 ? 'rgba(98,30,44,0.8)' : 'rgba(23,11,16,0.9)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let y = bottom; y > top; y -= 6) ctx.lineTo(x + 4 + f * (w - 8) / 3 + Math.sin(y * 0.09 + f * 2) * 1.5, y);
            ctx.stroke();
        }
        ctx.strokeStyle = VT.fCore; ctx.lineWidth = 2.4;
        ctx.beginPath(); for (let y = bottom; y > top; y -= 6) ctx.lineTo(x + w / 2 + Math.sin(y * 0.05) * 4, y); ctx.stroke();
        for (let k = 0; k < 3; k++) {
            const p = ((t / BEAT) + k / 3) % 1;
            const y = bottom - (bottom - top) * p;
            ctx.fillStyle = rgba(VT.pulse, 0.4 * (0.5 + 0.5 * hb)); ctx.beginPath(); ctx.arc(x + w / 2 + Math.sin(y * 0.05) * 4, y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255,74,92,${0.6 + 0.4 * hb})`; ctx.beginPath(); ctx.arc(x + w / 2 + Math.sin(y * 0.05) * 4, y, 2, 0, Math.PI * 2); ctx.fill();
        }
        // the ragged top, reaching
        ctx.strokeStyle = rgba(VT.fHyphae, 0.25); ctx.lineWidth = 0.6;
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + 3 + k * (w - 6) / 5, top); ctx.lineTo(x + 3 + k * (w - 6) / 5 + Math.sin(k + t * 0.5) * 3, top - 6 - hash(k) * 10); ctx.stroke(); }
        ctx.lineWidth = 1;
    }

    function drawWalkers(s, t) {
        for (const wk of walkers) {
            const a = geo.slots[wk.lv * SLOTS], b = geo.slots[wk.lv * SLOTS + SLOTS - 1];
            const x = a.x + (b.x + b.w - a.x) * wk.x;
            const idx = Math.max(0, Math.min(SLOTS - 1, Math.floor(wk.x * SLOTS)));
            const room = s.rooms[wk.lv * SLOTS + idx];
            const y = a.y + a.h - 6 - (wk.pause > 0 ? 0 : Math.abs(Math.sin(t * 9 + wk.seed * 9)) * 1.2);
            // in rock the corridor runs behind; they are drawn faint there
            const faint = room && (room.kind === 'rock' || isFlesh(room));
            if (!faint) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = faint ? rgba(VT.paper, 0.25) : VT.paper;
            ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        }
    }

    function drawDescent(t) {
        if (!descent) return;
        const k = (t * 1000 - descent.t0) / descent.ms;
        if (k > 1) { descent = null; return; }
        const x = geo.shaftX + geo.shaftW / 2;
        const top = geo.ground, bottom = geo.slots[0].y + geo.levelH - 6;
        ctx.fillStyle = VT.paper;
        for (let n = 0; n < 40; n++) {
            const p = k * 1.6 - n * 0.022;
            if (p < 0 || p > 1) continue;
            const y = top + (bottom - top) * p;
            ctx.beginPath(); ctx.arc(x + Math.sin(n * 2.3) * 6, y, 2, 0, Math.PI * 2); ctx.fill();
        }
    }

    /**
     * The rise, in three beats over riseAnim.ms: the body fills the shaft from the bottom (0 to 0.4),
     * the crust bulges and cracks (0.4 to 0.6), the mass breaks through and swells over the ruined city
     * until it is the sky (0.6 to 1).
     */
    function drawRise(s, t) {
        if (!riseAnim) return;
        const k = Math.min(1, (t * 1000 - riseAnim.t0) / riseAnim.ms);
        const x = geo.shaftX - 6, w = geo.shaftW + 12;
        const bottom = geo.slots[(LEVELS - 1) * SLOTS].y + geo.levelH;
        const gy = groundY(s);
        const fill = Math.min(1, k / 0.4);
        const top = bottom - (bottom - gy) * fill;
        ctx.fillStyle = '#2a0a12';
        ctx.fillRect(x, top, w, bottom - top);
        // fibres up the shaft, and the pulse climbing it
        ctx.strokeStyle = 'rgba(98,30,44,0.8)'; ctx.lineWidth = 2;
        for (let f = 0; f < 4; f++) { ctx.beginPath(); for (let y = bottom; y > top; y -= 8) ctx.lineTo(x + w * (0.2 + f * 0.2) + Math.sin(y * 0.15 + f) * 2, y); ctx.stroke(); }
        ctx.strokeStyle = rgba(VT.pulse, 0.9);
        ctx.beginPath(); for (let y = bottom; y > top; y -= 8) ctx.lineTo(x + w / 2 + Math.sin(y * 0.2 + t * 4) * w * 0.3, y); ctx.stroke();
        const cx = x + w / 2;
        if (k > 0.4) {
            // the crust bulges and cracks
            const b = Math.min(1, (k - 0.4) / 0.2);
            ctx.strokeStyle = 'rgba(20,10,8,0.95)';
            ctx.lineWidth = 2;
            for (let c = 0; c < 7; c++) {
                const ang = -Math.PI + (c + 0.5) * Math.PI / 7;
                ctx.beginPath(); ctx.moveTo(cx, gy);
                ctx.lineTo(cx + Math.cos(ang) * (30 + b * 160) * (0.6 + hash(c) * 0.6), gy + Math.sin(ang) * (8 + b * 40));
                ctx.stroke();
            }
            ctx.fillStyle = '#2a0a12';
            ctx.beginPath(); ctx.ellipse(cx, gy, 20 + b * 40, 6 + b * 26, 0, Math.PI, 0); ctx.fill();
        }
        if (k > 0.6) {
            // through: the mass swells over the city and becomes the sky
            const m = (k - 0.6) / 0.4;
            const R = 60 + m * Math.max(W, geo.ground * 4);
            const g = ctx.createRadialGradient(cx, gy, 10, cx, gy, R);
            g.addColorStop(0, 'rgba(60,12,22,1)');
            g.addColorStop(0.7, 'rgba(36,7,13,0.97)');
            g.addColorStop(1, 'rgba(20,4,8,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.ellipse(cx, gy, R, R * 0.55 + m * geo.ground, 0, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = rgba(VT.pulse, 0.5 + 0.4 * Math.sin(t * 3.7));
            ctx.lineWidth = 1.5;
            for (let v = 0; v < 14; v++) {
                const ang = -Math.PI + (v + 0.5) * Math.PI / 14;
                ctx.beginPath(); ctx.moveTo(cx, gy);
                for (let st = 1; st <= 6; st++) {
                    const rr = R * 0.9 * st / 6;
                    ctx.lineTo(cx + Math.cos(ang + (hash(v * 7 + st) - 0.5) * 0.3) * rr, gy + Math.sin(ang) * rr * 0.6);
                }
                ctx.stroke();
            }
            // no cut to black: the risen body holds the screen until the card comes
        }
        ctx.lineWidth = 1;
        // hold the risen body a moment, then the card
        if (t * 1000 - riseAnim.t0 >= riseAnim.ms + RISE_HOLD_MS && !riseAnim.done) { riseAnim.done = true; riseAnim.resolve?.(); }
    }

    // ---------------------------------------------------------------- the small wishes (wishes.js)
    const R = 12;
    function bubblePos(s, b) {
        const r = geo.slots[b.slot];
        if (!r) return null;
        return { x: r.x + 10 + (r.w - 20) * b.fx, y: r.y + R + 6 };
    }
    function bubbleAt(s, px, py) {
        const list = (s.wishes && s.wishes.list) || [];
        for (let k = list.length - 1; k >= 0; k--) {
            const b = list[k];
            if (b.ghost) continue;
            const p = bubblePos(s, b);
            if (p && (px - p.x) ** 2 + (py - p.y) ** 2 <= (R + 4) ** 2) return b.id;
        }
        return 0;
    }
    function drawWishes(s, t) {
        const w = s.wishes;
        if (!w || !w.list.length) return;
        let hover = null;
        for (const b of w.list) {
            const p = bubblePos(s, b);
            if (!p) continue;
            const age = w.clock - b.born;
            if (age < 0) continue;
            const left = Math.max(0, 1 - age / b.life);
            const grow = Math.min(1, age / 0.18);
            const bob = Math.sin(t * 2.2 + b.id) * 1.5;
            const x = p.x, y = p.y + bob;
            ctx.save();
            ctx.globalAlpha = b.ghost ? 0.38 * Math.min(1, left * 3) * Math.min(1, age * 2) : 1;
            ctx.translate(x, y);
            ctx.scale(grow, grow);
            // the bubble and its tail
            ctx.fillStyle = b.icon === 'bell' || b.icon === 'finger' ? '#2a1414' : VT.steel;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-4, R - 2); ctx.lineTo(0, R + 6); ctx.lineTo(4, R - 2); ctx.fill();
            ctx.strokeStyle = rgba(VT.mist, 0.35); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
            // the time left: a thin ring that runs down
            if (!b.ghost) {
                ctx.strokeStyle = left < 0.3 ? VT.danger : VT.amber;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0, 0, R + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
            }
            icon(b.icon, t);
            ctx.restore();
            if (!b.ghost && (pointer.x - x) ** 2 + (pointer.y - y) ** 2 <= (R + 4) ** 2) hover = { b, x, y };
        }
        if (hover) {
            const text = hover.b.text + (hover.b.cost ? ` ${hover.b.cost} ore.` : '');
            ctx.font = '11px system-ui, sans-serif';
            const tw = ctx.measureText(text).width;
            const bx = Math.min(W - tw - 20, hover.x + R + 8), by = hover.y - 10;
            ctx.fillStyle = rgba(VT.steel, 0.95);
            ctx.fillRect(bx, by, tw + 12, 20);
            ctx.fillStyle = VT.paper;
            ctx.textAlign = 'left';
            ctx.fillText(text, bx + 6, by + 14);
        }
    }
    // ---------------------------------------------------------------- the residents' voice (story.js speak)
    /** Words wrapped to a width. */
    function wrap(text, maxW) {
        const words = text.split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
            const next = cur ? `${cur} ${w}` : w;
            if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = w; } else cur = next;
        }
        if (cur) lines.push(cur);
        return lines;
    }
    /**
     * People speak where they are: a speech bubble over the room. A named request stays until it is met or
     * its ring (the time left) has gone round; thanks, sour words and "Computer!" pass after a few seconds.
     */
    function drawTalk(s) {
        const list = [];
        const q = s.request;
        if (q && q.slot != null && s.phase === 'palace') {
            const left = Math.max(0, Math.min(1, (q.due - s.day) / Math.max(0.001, q.due - q.at)));
            list.push({ slot: q.slot, text: q.who ? `${q.who}: ${q.text}` : q.text, ring: left, mark: q.mark, alpha: 1, req: true });
        }
        const now = s.wishes ? s.wishes.clock : 0;
        for (const b of s.talk || []) {
            const age = now - b.born;
            if (age < 0 || age > b.life) continue;
            list.push({ ...b, alpha: Math.min(1, age / 0.15, (b.life - age) / 0.6) });
        }
        if (!list.length) return;
        ctx.save();
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        const stack = new Map();
        for (const b of list) {
            const r = geo.slots[b.slot];
            if (!r) continue;
            ctx.font = `${b.computer ? '700 ' : ''}12px system-ui, -apple-system, sans-serif`;
            const ring = b.ring != null ? 22 : 0;
            const lines = wrap(b.text, 190);
            const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
            const bw = tw + 16 + ring, bh = lines.length * 15 + 9;
            const up = stack.get(b.slot) || 0;
            stack.set(b.slot, up + bh + 6);
            const cx = r.x + r.w / 2;
            const x = Math.max(4, Math.min(W - bw - 4, cx - bw / 2)), y = r.y - 10 - bh - up;
            ctx.globalAlpha = b.alpha;
            ctx.fillStyle = rgba(VT.steel, 0.95);
            ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 7); ctx.fill();
            if (!up) { ctx.beginPath(); ctx.moveTo(cx - 5, y + bh); ctx.lineTo(cx, y + bh + 7); ctx.lineTo(cx + 5, y + bh); ctx.fill(); }
            ctx.strokeStyle = b.mark ? VT.amber : b.computer ? rgba(VT.danger, 0.8) : rgba(VT.mist, 0.35);
            ctx.lineWidth = b.mark ? 1.5 : 1;
            ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, bw - 1, bh - 1, 7); ctx.stroke();
            if (b.ring != null) {
                // the ring is the time left to answer
                const rx = x + 13, ry = y + bh / 2;
                ctx.strokeStyle = rgba(VT.mist, 0.25); ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(rx, ry, 7, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = b.ring < 0.3 ? VT.danger : VT.amber;
                ctx.beginPath(); ctx.arc(rx, ry, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.ring); ctx.stroke();
                ctx.fillStyle = VT.paper; ctx.fillRect(rx - 0.75, ry - 4, 1.5, 5); ctx.fillRect(rx - 0.75, ry + 2.5, 1.5, 1.5);
            }
            ctx.fillStyle = b.sour ? VT.mist : VT.paper;
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            lines.forEach((l, k) => ctx.fillText(l, x + 8 + ring, y + 16 + k * 15));
        }
        ctx.restore();
        ctx.lineWidth = 1;
    }

    /** White line icons, about 14 px, drawn around (0, 0). */
    function icon(name, t) {
        ctx.strokeStyle = VT.paper; ctx.fillStyle = VT.paper; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        switch (name) {
            case 'drink': ctx.moveTo(-5, -6); ctx.lineTo(5, -6); ctx.lineTo(0, 0); ctx.closePath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.moveTo(-3, 5); ctx.lineTo(3, 5); ctx.moveTo(3, -6); ctx.lineTo(6, -9); break;
            case 'hand': ctx.moveTo(-4, 6); ctx.lineTo(-4, -1); ctx.moveTo(-4, 1); ctx.lineTo(-4, -5); ctx.moveTo(-1.5, 0); ctx.lineTo(-1.5, -7); ctx.moveTo(1, 0); ctx.lineTo(1, -6.5); ctx.moveTo(3.5, 1); ctx.lineTo(3.5, -5); ctx.moveTo(-4, 6); ctx.lineTo(3.5, 6); ctx.lineTo(3.5, 1); ctx.moveTo(-4, 2); ctx.lineTo(-7, -1); break;
            case 'food': ctx.ellipse(0, 4, 7, 2, 0, 0, Math.PI * 2); ctx.moveTo(-5, 3); ctx.arc(0, 3, 5, Math.PI, 0); ctx.moveTo(0, -2); ctx.lineTo(0, -4); break;
            case 'music': ctx.moveTo(-2, 4); ctx.lineTo(-2, -6); ctx.lineTo(5, -8); ctx.lineTo(5, 2); ctx.stroke(); ctx.beginPath(); ctx.arc(-4, 4, 2.2, 0, Math.PI * 2); ctx.arc(3, 2, 2.2, 0, Math.PI * 2); ctx.fill(); return;
            case 'towel': ctx.rect(-6, -5, 12, 10); ctx.moveTo(-6, -1); ctx.lineTo(6, -1); ctx.moveTo(-6, 2); ctx.lineTo(6, 2); break;
            case 'pool': ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill(); return;
            case 'bell': {
                const sw = Math.sin(t * 18) * 0.35;
                ctx.rotate(sw);
                ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-5, -7, 0, -7); ctx.quadraticCurveTo(5, -7, 6, 4); ctx.closePath(); ctx.moveTo(0, -7); ctx.lineTo(0, -9); ctx.moveTo(-1.5, 6); ctx.lineTo(1.5, 6);
                break;
            }
            case 'finger': ctx.moveTo(-7, 0); ctx.lineTo(5, 0); ctx.moveTo(-7, 0); ctx.lineTo(-7, 5); ctx.lineTo(0, 5); ctx.quadraticCurveTo(2, 3, 0, 2); ctx.moveTo(-3, 5); ctx.lineTo(-3, 2); break;
            case 'steak': {
                // a T-bone: the cut's outline, the fat rim, the bone through it
                ctx.moveTo(-7, -1); ctx.bezierCurveTo(-7, -7, 3, -8, 6, -4); ctx.bezierCurveTo(9, 0, 5, 6, -1, 6); ctx.bezierCurveTo(-5, 6, -7, 3, -7, -1);
                ctx.moveTo(-1, -6); ctx.lineTo(1, 5); ctx.moveTo(-3, -1); ctx.lineTo(3, -2);
                break;
            }
            default: ctx.arc(0, 0, 3, 0, Math.PI * 2);
        }
        ctx.stroke();
    }
    function takeEffects(s) {
        if (!s.fx || !s.fx.length) return;
        for (const e of s.fx) {
            const r = geo.slots[e.slot];
            if (!r) continue;
            effects.push({ ...e, x: r.x + 10 + (r.w - 20) * (e.fx ?? 0.5), y: r.y + R + 6, t0: performance.now() });
        }
        s.fx.length = 0;
    }
    function drawEffects() {
        const now = performance.now();
        for (let k = effects.length - 1; k >= 0; k--) {
            const e = effects[k];
            const age = (now - e.t0) / 1000;
            const life = e.type === 'wave' ? 2 : 1.4;
            if (age > life) { effects.splice(k, 1); continue; }
            const a = 1 - age / life;
            ctx.save();
            ctx.globalAlpha = a;
            if (e.type === 'miss') {
                // a grey burst and a small scowl
                ctx.strokeStyle = VT.mist; ctx.lineWidth = 1.5;
                for (let q = 0; q < 8; q++) {
                    const ang = q * Math.PI / 4, r0 = 6 + age * 18, r1 = r0 + 5;
                    ctx.beginPath(); ctx.moveTo(e.x + Math.cos(ang) * r0, e.y + Math.sin(ang) * r0); ctx.lineTo(e.x + Math.cos(ang) * r1, e.y + Math.sin(ang) * r1); ctx.stroke();
                }
                ctx.beginPath(); ctx.arc(e.x, e.y + 4, 3.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
                ctx.fillStyle = VT.mist; ctx.fillRect(e.x - 3, e.y - 2, 1.5, 1.5); ctx.fillRect(e.x + 1.5, e.y - 2, 1.5, 1.5);
                if (e.text) { ctx.fillStyle = VT.danger; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.text, e.x, e.y - 14 - age * 22); }
            } else {
                if (!e.text) { ctx.restore(); continue; }
                ctx.fillStyle = e.type === 'wave' ? VT.amber : VT.paper;
                ctx.font = `700 ${e.type === 'wave' ? 20 : 16}px system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3;
                ctx.strokeText(e.text, e.x, e.y - 6 - age * 30);
                ctx.fillText(e.text, e.x, e.y - 6 - age * 30);
            }
            ctx.restore();
        }
    }

    function frame(s, ui, now, dt) {
        takeEffects(s);
        syncWalkers(s);
        stepWalkers(s, dt);
        draw(s, ui, now);
    }

    resize();
    return {
        resize, frame, slotAt, slotRect,
        bubbleAt: (s, x, y) => bubbleAt(s, x, y),
        setPointer: (x, y) => { pointer.x = x; pointer.y = y; },
        startDescent: (ms) => { descent = { t0: performance.now(), ms }; },
        rise: (ms = 5200) => new Promise((resolve) => { riseAnim = { t0: performance.now(), ms, resolve }; }),
        /** True while something on screen moves on its own (the descent, the rise, effects). */
        get busy() { return !!descent || !!riseAnim || effects.length > 0; },
        get geo() { return geo; },
    };
}

export { levelOf, idxOf, KINDS };
