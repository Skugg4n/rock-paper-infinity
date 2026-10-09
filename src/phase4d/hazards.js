/**
 * Chapter IV · THE DEEP, the dig, pass 3 (spec 2026-10-09 H1): the hazards. Pure.
 * - MAGMA (below 600 m): a pocket opened (dug into, or a tile beside it dug) runs out into the open
 *   tunnel, a tile every 1.5 s, down and to the sides; it hardens to hard rock after 20 s. In it the
 *   drone heats; the HULL holds a while, then the drone is lost.
 * - GAS (the war's old bunkers): touched by the drill it explodes and takes the tiles round it.
 * - CAVE-INS (old rock, 300 to 700 m): an opening more than three tiles wide under a roof falls in
 *   after two seconds of sifting dust.
 * State: s.lava { index: age }, s.caves [{ x0, x1, y, at }], s.heat (seconds in the magma).
 */
import { W, H, T, depthOf, LAYERS } from './world.js';

export const LAVA_STEP = 1.5;
export const LAVA_HARDEN = 20;
export const CAVE_WARN = 2;
export const CAVE_SPAN = 4;            // an opening this wide under a roof falls
export const GAS_R = 1.5;
export const GAS_BURN = 0.55;          // the share of the battery a gas burst takes
/** Seconds in the magma the drone takes, by HULL level. */
export const heatHold = (hull) => 1 + 1.2 * hull;

export const HAZARD_LINES = {
    magma: 'Magma. Do not open it.',
    gas: 'Gas from the war. It burns.',
    roof: 'The roof is moving.',
};

const OLD = LAYERS.find((L) => L.id === 'old');
export const caveLayer = (y) => { const m = depthOf(y); return m > OLD.from && m <= OLD.to; };

/** A tile was opened at (x, y): magma in it or beside it starts to run. */
export function openMagma(s, x, y) {
    let opened = false;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const i = ny * W + nx;
        if (s.tiles[i] === T.MAGMA) { s.tiles[i] = T.AIR; s.lava[i] = 0; opened = true; }
    }
    return opened;
}

/** The magma runs and hardens; returns true when it moved (for the picture). */
export function stepLava(s, dt) {
    const keys = Object.keys(s.lava);
    if (!keys.length) return false;
    s.lavaT = (s.lavaT || 0) + dt;
    const spread = s.lavaT >= LAVA_STEP;
    if (spread) s.lavaT -= LAVA_STEP;
    const add = [];
    for (const k of keys) {
        const i = Number(k);
        s.lava[i] += dt;
        if (s.lava[i] >= LAVA_HARDEN) {
            delete s.lava[i];
            if (!(s.y >= 0 && s.y * W + s.x === i)) s.tiles[i] = T.HARD;
            continue;
        }
        if (!spread || s.lava[i] > LAVA_HARDEN - 4) continue;
        const x = i % W, y = Math.floor(i / W);
        for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (s.tiles[j] === T.AIR && s.lava[j] === undefined) add.push(j);
            // the rest of the pocket follows
            if (s.tiles[j] === T.MAGMA) { s.tiles[j] = T.AIR; add.push(j); }
        }
    }
    for (const j of add) if (s.lava[j] === undefined) s.lava[j] = 0;
    return spread;
}

/** The drill touched gas: it bursts and takes the tiles round it (a pocket goes off together). */
export function burstGas(s, x, y) {
    const queue = [[x, y]], seen = new Set();
    const taken = [];
    while (queue.length) {
        const [cx, cy] = queue.pop();
        const k = cy * W + cx;
        if (seen.has(k)) continue;
        seen.add(k);
        s.tiles[k] = T.AIR;
        for (let yy = Math.max(0, cy - 2); yy <= Math.min(H - 1, cy + 2); yy++) {
            for (let xx = Math.max(0, cx - 2); xx <= Math.min(W - 1, cx + 2); xx++) {
                if (Math.hypot(xx - cx, yy - cy) > GAS_R) continue;
                const j = yy * W + xx, t = s.tiles[j];
                if (t === T.GAS) { queue.push([xx, yy]); continue; }
                if (t === T.AIR || t === T.HEART || t === T.SINEW || t === T.QUANTUM || t === T.FIND || t === T.MAGMA) continue;
                s.tiles[j] = T.AIR;
                taken.push(j);
            }
        }
    }
    return { cells: [...seen], taken };
}

/**
 * After a tile at (x, y) is opened in the old rock: the open span along that row under a roof. If it is
 * CAVE_SPAN or wider and nothing is falling there yet, it will in CAVE_WARN seconds.
 */
export function checkRoof(s, x, y) {
    if (!caveLayer(y) || y < 1) return null;
    const roofed = (xx) => s.tiles[y * W + xx] === T.AIR && s.tiles[(y - 1) * W + xx] !== T.AIR;
    if (!roofed(x)) return null;
    let x0 = x, x1 = x;
    while (x0 - 1 >= 0 && roofed(x0 - 1)) x0--;
    while (x1 + 1 < W && roofed(x1 + 1)) x1++;
    if (x1 - x0 + 1 < CAVE_SPAN) return null;
    if (s.caves.some((c) => c.y === y && c.x0 <= x1 && c.x1 >= x0)) return null;
    const cave = { x0, x1, y, at: s.time + CAVE_WARN };
    s.caves.push(cave);
    return cave;
}
/** The roofs whose time is up fall: their span fills with rubble. Returns true if the drone was under one. */
export function stepCaves(s) {
    let crushed = false;
    for (let k = s.caves.length - 1; k >= 0; k--) {
        const c = s.caves[k];
        if (s.time < c.at) continue;
        s.caves.splice(k, 1);
        for (let x = c.x0; x <= c.x1; x++) {
            const i = c.y * W + x;
            if (s.tiles[i] === T.AIR) s.tiles[i] = T.STONE;
            delete s.lava[i];
            if (s.y === c.y && s.x === x) crushed = true;
        }
        s.events.push({ type: 'cave', x0: c.x0, x1: c.x1, y: c.y });
    }
    return crushed;
}
/** Is the drone under a roof that is moving: the span and the seconds left. */
export const caveOver = (s, x = s.x, y = s.y) => s.caves.find((c) => c.y === y && x >= c.x0 && x <= c.x1) || null;

const tileOf = (s, x, y) => (x < 0 || x >= W || y < 0 || y >= H ? -1 : s.tiles[y * W + x]);
/**
 * Would digging (or entering) (x, y) be a hazard a careful player sees and leaves: magma or gas,
 * a tile beside magma (it would open), running magma, or an opening in old rock that would fall in.
 */
export function risky(s, x, y) {
    if (y < 0 || x < 0 || x >= W || y >= H) return false;
    const t = s.tiles[y * W + x];
    if (t === T.MAGMA || t === T.GAS) return true;
    if (s.lava && s.lava[y * W + x] !== undefined) return true;
    if (t !== T.AIR) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileOf(s, x + dx, y + dy) === T.MAGMA) return true;
        if (caveLayer(y) && y >= 1 && tileOf(s, x, y - 1) !== T.AIR) {
            const roofed = (xx) => tileOf(s, xx, y) === T.AIR && tileOf(s, xx, y - 1) > 0;
            let n = 1;
            for (let xx = x - 1; xx >= 0 && roofed(xx); xx--) n++;
            for (let xx = x + 1; xx < W && roofed(xx); xx++) n++;
            if (n >= CAVE_SPAN) return true;
        }
    }
    return false;
}
