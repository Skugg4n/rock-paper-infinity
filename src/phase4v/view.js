/**
 * Chapter IV, the vault: the cutaway on a 2D canvas. The surface city (eroding with the years),
 * the sediment laid in the night, the shaft, three levels of eight rooms, the people walking,
 * the body creeping over what it takes. Draws what the rules say; owns no state of the game.
 */

import { LEVELS, SLOTS, levelOf, idxOf, KINDS, awake, isFlesh, PODS_PER_LEVEL, SUITE_BEDS, roomsOf } from './vault.js';

const STONE = '#0d0f12';
const STONE_LINE = 'rgba(255,255,255,0.035)';
const ROOM_WALL = '#1b2028';

/** Seeded noise for the stone and the city, the same every frame. */
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export function createVaultView(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let geo = null;
    const walkers = [];
    let descent = null;     // the arrival: { t0 }
    let riseAnim = null;    // the end: { t0, done }

    function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = canvas.getBoundingClientRect();
        W = Math.max(320, r.width); H = Math.max(320, r.height);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        layout();
    }

    function layout() {
        const left = opts.insetLeft ? opts.insetLeft() : 300;
        const right = opts.insetRight ? opts.insetRight() : 300;
        const x0 = left + 20, x1 = W - right - 20;
        const shaftW = 26;
        const gap = 6;
        const slotW = Math.max(40, (x1 - x0 - shaftW - gap * SLOTS) / SLOTS);
        const ground = Math.round(H * 0.25);
        const levelH = Math.min(110, Math.max(70, (H - ground - 60) / 3.4));
        const top0 = ground + Math.max(40, levelH * 0.55);
        const levelGap = Math.max(18, levelH * 0.28);
        const slots = [];
        for (let lv = 0; lv < LEVELS; lv++) {
            for (let ix = 0; ix < SLOTS; ix++) {
                const x = x0 + shaftW + gap + ix * (slotW + gap);
                const y = top0 + lv * (levelH + levelGap);
                slots.push({ x, y, w: slotW, h: levelH });
            }
        }
        geo = { x0, x1, shaftX: x0, shaftW, ground, top0, levelH, levelGap, slots, slotW };
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
        drawStone();
        drawLayers(s);
        drawCity(s, t);
        drawShaft(s);
        for (let i = 0; i < s.rooms.length; i++) drawSlot(s, i, ui, t);
        drawWalkers(s, t);
        drawDescent(t);
        drawRise(s, t);
    }

    function drawSky(s, t) {
        const g = ctx.createLinearGradient(0, 0, 0, geo.ground);
        const night = s.phase !== 'palace';
        g.addColorStop(0, night ? '#05060a' : '#10141c');
        g.addColorStop(1, night ? '#0b0d12' : '#232a35');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, geo.ground);
        // the storm: dark clouds and slanted rain
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let k = 0; k < 7; k++) {
            const cx = ((k * 211 + t * 9) % (W + 300)) - 150;
            ctx.beginPath(); ctx.ellipse(cx, 26 + (k % 3) * 14, 140, 22, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(160,175,200,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 90; k++) {
            const x = (hash(k) * (W + 200) + t * 260) % (W + 200) - 100;
            const y = (hash(k + 50) * geo.ground + t * 420) % geo.ground;
            ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 16);
        }
        ctx.stroke();
    }

    function layerCount(s) { return s.phase === 'palace' ? 0 : Math.floor((s.year || 0) / 1000); }
    function groundY(s) { return geo.ground - Math.min(geo.ground * 0.45, layerCount(s) * 7); }

    function drawStone() {
        ctx.fillStyle = STONE;
        ctx.fillRect(0, geo.ground, W, H - geo.ground);
        ctx.strokeStyle = STONE_LINE;
        ctx.lineWidth = 1;
        for (let k = 0; k < 40; k++) {
            const y = geo.ground + 12 + k * 17 + hash(k) * 8;
            if (y > H) break;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= W; x += 80) ctx.lineTo(x, y + (hash(k * 31 + x) - 0.5) * 6);
            ctx.stroke();
        }
    }

    /** The night lays a stripe of sediment over the surface for every thousand years. */
    function drawLayers(s) {
        const n = layerCount(s);
        for (let k = 0; k < n; k++) {
            const y = geo.ground - (k + 1) * 7;
            if (y < geo.ground * 0.55) break;
            ctx.fillStyle = k % 2 ? '#1a1712' : '#221d16';
            ctx.fillRect(0, y, W, 7);
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(0, y, W, 1);
        }
    }

    /** The city: whole at year 0, windows broken at 10, roofs gone at 100, ruins at 1 000, gravel at 10 000. */
    function drawCity(s, t) {
        const year = s.phase === 'palace' ? s.day / 365 : s.year;
        const stage = year < 10 ? 0 : year < 100 ? 1 : year < 1000 ? 2 : year < 10000 ? 3 : 4;
        const gy = groundY(s);
        if (stage >= 4) return;
        const n = Math.floor(W / 46);
        for (let k = 0; k < n; k++) {
            const x = k * 46 + hash(k) * 18;
            let h = 40 + hash(k + 9) * 90 + (k % 7 === 3 ? 60 : 0);
            const w = 26 + hash(k + 3) * 18;
            if (stage === 2) h *= 0.8;
            if (stage === 3) h = 8 + hash(k + 4) * 20;
            ctx.fillStyle = stage >= 3 ? '#15130f' : '#0a0c10';
            if (stage === 3) {
                ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w * 0.3, gy - h); ctx.lineTo(x + w * 0.6, gy - h * 0.6); ctx.lineTo(x + w, gy); ctx.fill();
                continue;
            }
            ctx.fillRect(x, gy - h, w, h);
            if (stage === 0) {
                // a roof or a spire on some
                if (k % 5 === 1) { ctx.beginPath(); ctx.moveTo(x, gy - h); ctx.lineTo(x + w / 2, gy - h - 16); ctx.lineTo(x + w, gy - h); ctx.fill(); }
            } else {
                // broken tops
                ctx.fillStyle = '#05060a';
                ctx.beginPath(); ctx.moveTo(x + w * 0.2, gy - h); ctx.lineTo(x + w * 0.5, gy - h + 10 + hash(k) * 14); ctx.lineTo(x + w * 0.85, gy - h); ctx.fill();
            }
            // windows: lit in the palace's first years, broken after
            for (let wy = gy - h + 8; wy < gy - 6; wy += 9) {
                for (let wx = x + 4; wx < x + w - 5; wx += 7) {
                    const r = hash(wx * 13 + wy);
                    if (stage === 0 && r > 0.82) { ctx.fillStyle = `rgba(255,214,150,${0.25 + 0.15 * Math.sin(t + r * 9)})`; ctx.fillRect(wx, wy, 3, 4); }
                    else if (stage === 1 && r > 0.6) { ctx.fillStyle = '#14171c'; ctx.fillRect(wx, wy, 3, 4); }
                }
            }
        }
    }

    function drawShaft(s) {
        const x = geo.shaftX, w = geo.shaftW;
        const bottom = geo.slots[(LEVELS - 1) * SLOTS].y + geo.levelH;
        const top = groundY(s);
        ctx.fillStyle = '#07080a';
        ctx.fillRect(x, top, w, bottom - top);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(x + 0.5, top, w - 1, bottom - top);
        // rungs
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        for (let y = top + 6; y < bottom; y += 10) { ctx.moveTo(x + 5, y); ctx.lineTo(x + w - 5, y); }
        ctx.stroke();
        // the hatch at the surface
        ctx.fillStyle = '#2a2f37';
        ctx.fillRect(x - 6, top - 3, w + 12, 4);
        // corridors from the shaft into each level
        for (let lv = 0; lv < LEVELS; lv++) {
            const r = geo.slots[lv * SLOTS];
            ctx.fillStyle = '#07080a';
            ctx.fillRect(x + w, r.y + r.h - 16, r.x - x - w, 16);
        }
    }

    function roomLight(r) {
        const map = {
            common: '#e8c48a', engine: '#9cc7ff', hydro: '#b48cff', suites: '#d8dde6', cinema: '#cfd6e6',
            gym: '#dfe5ee', bar: '#e2b27a', garden: '#c7e6a8', game: '#9fd8ff', mine: '#c9b79a', cryo: '#8fd0ff', vat: '#a8132c',
        };
        return map[r.kind] || '#d5dbe3';
    }

    function drawSlot(s, i, ui, t) {
        const r = s.rooms[i];
        const g = geo.slots[i];
        const { x, y, w, h } = g;
        const sel = ui.selected === i;
        const can = ui.placeable && ui.placeable.has(i);
        const wanted = ui.wanted && ui.wanted.has(i);
        if (r.kind === 'rock' && !r.flesh && !(r.job && r.job.op === 'grow')) {
            // rock: a faint outline where a room could be dug
            if (r.job && r.job.op === 'dig') {
                ctx.fillStyle = '#15181d';
                ctx.fillRect(x, y, w, h);
                progress(x, y, w, h, 1 - r.job.left / r.job.total, '#c9b79a');
                pickaxe(x + w / 2, y + h / 2, t);
            } else if (ui.diggable && ui.diggable.has(i)) {
                ctx.setLineDash([3, 4]);
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
                ctx.setLineDash([]);
            }
            if (can) glow(x, y, w, h, t);
            if (sel) outline(x, y, w, h, '#f1efe8');
            return;
        }
        ctx.fillStyle = ROOM_WALL;
        ctx.fillRect(x, y, w, h);
        const building = r.job && r.job.op === 'build';
        if (r.kind === 'empty' || (r.kind === 'rock')) {
            ctx.fillStyle = '#151a20';
            ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
            if (r.kind === 'empty' && !r.flesh) {
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                ctx.font = '600 11px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('+', x + w / 2, y + h / 2 + 4);
            }
        } else {
            ctx.save();
            ctx.beginPath(); ctx.rect(x + 3, y + 3, w - 6, h - 6); ctx.clip();
            const dark = r.broken || building;
            const light = roomLight(r);
            ctx.fillStyle = dark ? '#191d23' : shade(light, 0.16);
            ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
            if (!building) art(s, r, i, x + 3, y + 3, w - 6, h - 6, t, dark);
            ctx.restore();
            if (building) {
                progress(x, y, w, h, 1 - r.job.left / r.job.total, '#f1efe8');
            } else if (r.job && (r.job.op === 'upgrade' || r.job.op === 'repair')) {
                progress(x, y, w, h, 1 - r.job.left / r.job.total, '#f1efe8');
            }
            if (r.broken && !r.job) {
                ctx.strokeStyle = 'rgba(255,90,70,0.6)';
                ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + w - 8, y + h - 8); ctx.moveTo(x + w - 8, y + 8); ctx.lineTo(x + 8, y + h - 8); ctx.stroke();
            }
            // the level, as small pips
            if (r.lvl > 1 && !r.flesh) {
                ctx.fillStyle = 'rgba(241,239,232,0.75)';
                for (let k = 0; k < r.lvl; k++) ctx.fillRect(x + w - 8 - k * 6, y + 6, 4, 4);
            }
        }
        // the body: over the room from below, breathing
        if (r.flesh || (r.job && r.job.op === 'grow')) flesh(x, y, w, h, r.flesh === 1 ? 1 : (r.flesh || 0), t, i, r);
        if (can) glow(x, y, w, h, t);
        if (wanted && !sel) outline(x, y, w, h, 'rgba(255,214,120,0.85)', true, t);
        if (sel) outline(x, y, w, h, '#f1efe8');
    }

    function shade(hex, k) {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        return `rgb(${Math.round(r * k + 14)},${Math.round(g * k + 16)},${Math.round(b * k + 20)})`;
    }
    function progress(x, y, w, h, k, c) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x + 6, y + h - 12, w - 12, 5);
        ctx.fillStyle = c;
        ctx.fillRect(x + 6, y + h - 12, (w - 12) * Math.max(0, Math.min(1, k)), 5);
    }
    function glow(x, y, w, h, t) {
        ctx.strokeStyle = `rgba(241,239,232,${0.45 + 0.35 * Math.sin(t * 5)})`;
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
        ctx.strokeStyle = '#c9b79a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -8); ctx.moveTo(-9, -6); ctx.quadraticCurveTo(0, -12, 9, -6); ctx.stroke();
        ctx.restore();
    }

    /** Each room its own picture: simple but recognisable. */
    function art(s, r, i, x, y, w, h, t, dark) {
        const floor = y + h;
        const a = dark ? 0.25 : 1;
        ctx.globalAlpha = a;
        switch (r.kind) {
            case 'common': {
                ctx.fillStyle = 'rgba(255,200,130,0.18)';
                ctx.beginPath(); ctx.arc(x + w / 2, y + 10, w * 0.55, 0, Math.PI); ctx.fill();
                ctx.fillStyle = '#7a4f3a';
                ctx.fillRect(x + 6, floor - 16, w * 0.32, 10); ctx.fillRect(x + 6, floor - 22, 6, 16);
                ctx.fillRect(x + w - 6 - w * 0.32, floor - 16, w * 0.32, 10); ctx.fillRect(x + w - 12, floor - 22, 6, 16);
                ctx.fillStyle = '#c9a77a'; ctx.fillRect(x + w / 2 - 8, floor - 14, 16, 4); ctx.fillRect(x + w / 2 - 1, floor - 10, 2, 8);
                break;
            }
            case 'engine': {
                const cx = x + w / 2, cy = y + h * 0.45, R = Math.min(w, h) * 0.28;
                ctx.strokeStyle = '#9cc7ff'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#cfe3ff';
                for (let k = 0; k < 3; k++) {
                    const ang = t * 2 + k * Math.PI * 2 / 3;
                    const px = cx + Math.cos(ang) * R * 0.62, py = cy + Math.sin(ang) * R * 0.62;
                    if (k === 0) { ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill(); }
                    else if (k === 1) ctx.fillRect(px - 3, py - 4, 6, 8);
                    else { ctx.beginPath(); ctx.moveTo(px - 4, py - 3); ctx.lineTo(px + 4, py + 3); ctx.moveTo(px + 4, py - 3); ctx.lineTo(px - 4, py + 3); ctx.stroke(); }
                }
                if (Math.sin(t * 3.1) > 0.7) {
                    ctx.strokeStyle = '#6fb6ff';
                    ctx.beginPath(); ctx.moveTo(cx + R, cy - 4); ctx.lineTo(cx + R + 6, cy); ctx.lineTo(cx + R + 2, cy + 3); ctx.lineTo(cx + R + 10, cy + 8); ctx.stroke();
                }
                ctx.strokeStyle = '#2b3442'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(x, floor - 5); ctx.quadraticCurveTo(cx, floor - 2, cx - R * 0.7, cy + R); ctx.stroke();
                ctx.lineWidth = 1;
                break;
            }
            case 'hydro': {
                ctx.fillStyle = 'rgba(180,120,255,0.25)'; ctx.fillRect(x, y, w, 6);
                for (let row = 0; row < 3; row++) {
                    const ry = y + 16 + row * (h - 22) / 3;
                    ctx.fillStyle = '#3a2f4a'; ctx.fillRect(x + 4, ry + 8, w - 8, 3);
                    ctx.fillStyle = '#6fbf5a';
                    for (let px = x + 7; px < x + w - 7; px += 6) { ctx.beginPath(); ctx.arc(px, ry + 6 + Math.sin(t + px) * 0.6, 2.6, 0, Math.PI * 2); ctx.fill(); }
                }
                break;
            }
            case 'suites': {
                // 100 windows: lit per one awake, blue per one asleep, dark empty or dead
                const list = roomsOf(s, 'suites');
                const k = list.indexOf(r);
                const before = k * SUITE_BEDS;
                const total = s.residents;
                const asleepShare = total ? s.asleep / total : 0;
                const here = Math.max(0, Math.min(SUITE_BEDS, total - before));
                const gw = (w - 8) / 10, gh = (h - 8) / 10;
                for (let n = 0; n < 100; n++) {
                    const cx = x + 4 + (n % 10) * gw, cy = y + 4 + Math.floor(n / 10) * gh;
                    let c = '#0d1015';
                    if (n < here) {
                        const sleeping = hash(n * 7 + k * 101) < asleepShare;
                        c = sleeping ? '#4f8fd8' : (hash(n + k * 13 + Math.floor(t / 6)) > 0.06 ? '#f2d9a0' : '#7d6a48');
                    }
                    ctx.fillStyle = c;
                    ctx.fillRect(cx + 0.8, cy + 0.8, gw - 1.6, gh - 1.6);
                }
                break;
            }
            case 'cinema': {
                const f = 0.6 + 0.4 * Math.abs(Math.sin(t * 7) * Math.sin(t * 3.3));
                ctx.fillStyle = `rgba(220,230,255,${f})`; ctx.fillRect(x + 6, y + 8, w - 12, h * 0.42);
                ctx.fillStyle = '#2a2f3a';
                for (let row = 0; row < 2; row++) for (let px = x + 8; px < x + w - 8; px += 8) ctx.fillRect(px, floor - 18 + row * 8, 6, 5);
                break;
            }
            case 'gym': {
                ctx.fillStyle = '#5a6270';
                ctx.fillRect(x + 6, floor - 10, w * 0.35, 4);
                ctx.fillRect(x + 6 + w * 0.12, floor - 22, 3, 12);
                ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(x + 10, floor - 26, 5, 0, Math.PI * 2); ctx.arc(x + 10 + w * 0.22, floor - 26, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(x + 10, floor - 27, w * 0.22, 2);
                if (r.lvl >= 2) { ctx.fillStyle = '#3d8fd6'; ctx.fillRect(x + w * 0.5, floor - 12, w * 0.45, 8); }
                if (r.lvl >= 3) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                    for (let k = 0; k < 3; k++) { const sx = x + w * 0.58 + k * 8; ctx.beginPath(); ctx.moveTo(sx, floor - 16); ctx.quadraticCurveTo(sx + 4 * Math.sin(t * 2 + k), floor - 26, sx, floor - 36); ctx.stroke(); }
                }
                break;
            }
            case 'bar': {
                ctx.fillStyle = '#6b4630'; ctx.fillRect(x + 4, floor - 16, w - 8, 10);
                ctx.fillStyle = '#3a2a20'; ctx.fillRect(x + 4, y + 12, w - 8, 3);
                for (let px = x + 8, n = 0; px < x + w - 8; px += 6, n++) {
                    const glint = Math.sin(t * 2 + n * 1.7) > 0.92;
                    ctx.fillStyle = glint ? '#fff4d0' : ['#7fae6a', '#b06a3a', '#c9b06a'][n % 3];
                    ctx.fillRect(px, y + 4, 3, 8);
                }
                break;
            }
            case 'garden': {
                ctx.fillStyle = 'rgba(255,240,180,0.9)'; ctx.beginPath(); ctx.arc(x + w / 2, y + 9, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,240,180,0.12)'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 9); ctx.lineTo(x, floor); ctx.lineTo(x + w, floor); ctx.fill();
                for (let k = 0; k < 3; k++) {
                    const tx = x + w * (0.22 + k * 0.28);
                    ctx.fillStyle = '#5a3d2a'; ctx.fillRect(tx - 1.5, floor - 14, 3, 12);
                    ctx.fillStyle = r.lvl >= 2 ? '#6fcf6a' : '#4f9a4a';
                    ctx.beginPath(); ctx.arc(tx, floor - 18, 8 + Math.sin(t + k) * 0.6, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case 'game': {
                for (let k = 0; k < 3; k++) {
                    const sx = x + 6 + k * (w - 12) / 3;
                    const on = Math.sin(t * (3 + k) + k) > -0.2;
                    ctx.fillStyle = on ? ['#7fd0ff', '#ff9fd0', '#b8ff9f'][k] : '#1a2a3a';
                    ctx.fillRect(sx + 2, y + 12, (w - 12) / 3 - 4, h * 0.3);
                    ctx.fillStyle = '#2b2f36'; ctx.fillRect(sx + (w - 12) / 6 - 1, y + 12 + h * 0.3, 2, 8);
                }
                break;
            }
            case 'mine': {
                ctx.fillStyle = '#6a5a44';
                for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + 10 + k * 7, floor - 4, 6, Math.PI, 0); ctx.fill(); }
                const bx = x + w * 0.72, by = y + h * 0.4;
                ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(t * 1.4) * 0.15);
                ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-4, -14, 8, 22);
                ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(0, 16 + Math.sin(t * 20)); ctx.lineTo(5, 8); ctx.fill();
                ctx.restore();
                break;
            }
            case 'cryo': {
                const cols = 5 * r.lvl, rows = 2;
                const pw = (w - 8) / cols, ph = (h - 14) / rows;
                for (let n = 0; n < cols * rows; n++) {
                    const cx = x + 4 + (n % cols) * pw, cy = y + 6 + Math.floor(n / cols) * ph;
                    const filled = n / (cols * rows) < (s.asleep / Math.max(1, roomsOf(s, 'cryo').reduce((a, q) => a + q.lvl * PODS_PER_LEVEL, 0)));
                    ctx.fillStyle = filled ? `rgba(120,200,255,${0.55 + 0.15 * Math.sin(t + n)})` : '#1d2630';
                    ctx.fillRect(cx + 1.5, cy + 1.5, pw - 3, ph - 3);
                }
                ctx.fillStyle = 'rgba(220,240,255,0.15)'; ctx.fillRect(x, y, w, 3);
                break;
            }
            default: break;
        }
        ctx.globalAlpha = 1;
    }

    /** The flesh: dark red tissue rising over the room, veins, a slow breath. k = 0..1 grown. */
    function flesh(x, y, w, h, k, t, i, r) {
        const top = y + h * (1 - k);
        ctx.save();
        ctx.beginPath(); ctx.rect(x, top, w, y + h - top); ctx.clip();
        const breath = 0.5 + 0.5 * Math.sin(t * 1.4 + i);
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, `rgba(58,14,24,${0.86 + 0.08 * breath})`);
        g.addColorStop(1, `rgba(24,6,10,0.96)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        // the room shows faintly under it
        if (r.kind !== 'vat' && r.kind !== 'rock') { ctx.fillStyle = 'rgba(213,219,227,0.05)'; ctx.fillRect(x + 6, y + 6, w - 12, h - 12); }
        // veins
        ctx.strokeStyle = `rgba(168,19,44,${0.55 + 0.35 * breath})`;
        ctx.lineWidth = 1.4;
        for (let v = 0; v < 5; v++) {
            ctx.beginPath();
            let vx = x + hash(i * 17 + v) * w, vy = y + h;
            ctx.moveTo(vx, vy);
            for (let s2 = 0; s2 < 6; s2++) {
                vx += (hash(i * 31 + v * 7 + s2) - 0.5) * w * 0.35;
                vy -= h / 6;
                ctx.lineTo(Math.max(x, Math.min(x + w, vx)), vy);
            }
            ctx.stroke();
        }
        // sinew: pale threads
        ctx.strokeStyle = 'rgba(185,196,202,0.12)';
        ctx.lineWidth = 0.8;
        for (let v = 0; v < 4; v++) {
            ctx.beginPath();
            ctx.moveTo(x, y + hash(i + v * 3) * h);
            ctx.quadraticCurveTo(x + w / 2, y + hash(i * 5 + v) * h + Math.sin(t + v) * 3, x + w, y + hash(i * 9 + v) * h);
            ctx.stroke();
        }
        if (r.kind === 'vat') {
            ctx.strokeStyle = 'rgba(200,210,215,0.35)'; ctx.lineWidth = 2;
            ctx.strokeRect(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.7);
            ctx.fillStyle = `rgba(168,19,44,${0.4 + 0.3 * breath})`;
            ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.6, w * 0.22, h * 0.22 * (0.9 + 0.1 * breath), 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.lineWidth = 1;
        if (k < 1) {
            ctx.strokeStyle = 'rgba(168,19,44,0.9)';
            ctx.beginPath(); ctx.moveTo(x, top); for (let px = x; px <= x + w; px += 6) ctx.lineTo(px, top + Math.sin(px * 0.4 + t * 3) * 2); ctx.stroke();
        }
    }

    function drawWalkers(s, t) {
        for (const wk of walkers) {
            const a = geo.slots[wk.lv * SLOTS], b = geo.slots[wk.lv * SLOTS + SLOTS - 1];
            const x = a.x + (b.x + b.w - a.x) * wk.x;
            const idx = Math.max(0, Math.min(SLOTS - 1, Math.floor(wk.x * SLOTS)));
            const room = s.rooms[wk.lv * SLOTS + idx];
            const y = a.y + a.h - 5 - (wk.pause > 0 ? 0 : Math.abs(Math.sin(t * 9 + wk.seed * 9)) * 1.2);
            // in rock the corridor runs behind; they are drawn faint there
            ctx.fillStyle = room && (room.kind === 'rock' || isFlesh(room)) ? 'rgba(241,239,232,0.25)' : 'rgba(255,248,230,0.95)';
            ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        }
    }

    function drawDescent(t) {
        if (!descent) return;
        const k = (t * 1000 - descent.t0) / descent.ms;
        if (k > 1) { descent = null; return; }
        const x = geo.shaftX + geo.shaftW / 2;
        const top = geo.ground, bottom = geo.slots[0].y + geo.levelH - 6;
        ctx.fillStyle = 'rgba(255,248,230,0.95)';
        for (let n = 0; n < 40; n++) {
            const p = k * 1.6 - n * 0.022;
            if (p < 0 || p > 1) continue;
            const y = top + (bottom - top) * p;
            ctx.beginPath(); ctx.arc(x + Math.sin(n * 2.3) * 6, y, 2, 0, Math.PI * 2); ctx.fill();
        }
    }

    function drawRise(s, t) {
        if (!riseAnim) return;
        const k = Math.min(1, (t * 1000 - riseAnim.t0) / riseAnim.ms);
        const x = geo.shaftX - 6, w = geo.shaftW + 12;
        const bottom = geo.slots[(LEVELS - 1) * SLOTS].y + geo.levelH;
        const gy = groundY(s);
        const top = bottom - (bottom - gy + 80) * Math.min(1, k * 1.25);
        ctx.fillStyle = '#2a0a12';
        ctx.fillRect(x, top, w, bottom - top);
        ctx.strokeStyle = 'rgba(168,19,44,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); for (let y = bottom; y > top; y -= 8) ctx.lineTo(x + w / 2 + Math.sin(y * 0.2 + t * 4) * w * 0.3, y); ctx.stroke();
        ctx.lineWidth = 1;
        if (k > 0.8) {
            const b = (k - 0.8) / 0.2;
            ctx.fillStyle = `rgba(42,10,18,${b})`;
            ctx.beginPath(); ctx.ellipse(x + w / 2, gy, 40 + b * 160, 20 + b * 60, 0, Math.PI, 0); ctx.fill();
        }
        if (k >= 1 && !riseAnim.done) { riseAnim.done = true; riseAnim.resolve?.(); }
    }

    function frame(s, ui, now, dt) {
        syncWalkers(s);
        stepWalkers(s, dt);
        draw(s, ui, now);
    }

    resize();
    return {
        resize, frame, slotAt, slotRect,
        startDescent: (ms) => { descent = { t0: performance.now(), ms }; },
        rise: (ms = 3200) => new Promise((resolve) => { riseAnim = { t0: performance.now(), ms, resolve }; }),
        get geo() { return geo; },
    };
}

export { levelOf, idxOf, KINDS };
