/**
 * Chapter IV · THE DEEP: THE STRATA, as numbers. Pure: no DOM, no three.js. The strata view
 * (strata-view.js) asks this module where things sit in the cross-section, how thick the years are,
 * and where the camera rests; the tests read the same answers.
 *
 * THE SECTION. A vertical cut through the earth, in the 3D scene's own units (a chamber is 2.0 wide,
 * as a plate is in scene.js, so the flesh material's numbers hold). y is up; y = 0 is YEAR 0: the
 * ground the colony went down through, the crust of the dead surface. Above it the years the colony
 * slept lie down as layers, one per sleep. Below it: the old ground, the machine house, then the
 * floors, each a row of chambers on a corridor, the shaft through their middle.
 *
 * A ROW, NOT A RING. layout.js digs a floor ring by ring around its landing (twelve cells). The
 * section cannot show a ring, so chamber number i on a floor takes column -1, +1, -2, +2, ... in dig
 * order: the floor grows outward from the shaft on both sides, never with a hole. `sectionPlace` is
 * that rule in the shape growth.js graphFromSlots takes, so the body's graph is the row the player
 * sees: a chamber touches its neighbours in the row, the first two touch the landing.
 */

import { CHAMBERS_PER_FLOOR } from './layout.js';

/** Column to column, and floor to floor (scene.js PITCH). */
export const PITCH = 2.6;
export const FLOOR_PITCH = 2.6;
/** A chamber: as wide as a plate, its arched room this tall. */
export const CH_W = 2.0;
export const CH_H = 1.44;
/** The floor line (the bottom of the chambers) of floor 0. */
export const FLOOR0 = -8.54;
/** The machine house, on top of the colony, under the old ground. */
export const HOUSE = { x0: -2.6, x1: 2.6, y0: -6.05, y1: -4.2 };
/** The shaft's width. It runs from YEAR 0 (sealed there by the lid) down to the deepest floor. */
export const SHAFT_W = 0.4;
/** The corridor: a dark bore this tall over the floor line, with a mid-grey lane on it. */
export const CORRIDOR_H = 0.48;
/** The old ground under YEAR 0: the crust band, four bands of what was there before, then bedrock. */
export const OLD_GROUND = [0, -0.48, -1.22, -1.78, -2.52, -3.04];
/** The most layers the view draws; older sleeps are merged in pairs past this. */
export const MAX_LAYERS = 48;
/** The thinnest a layer is (a sleep of a few days), and how much each decade of years adds. */
export const LAYER_MIN = 0.32;
export const LAYER_PER_DECADE = 0.3;
/** Pixels per unit at most (the mockup's scale), and the room kept for the year ruler on the right. */
export const MAX_PPU = 46;
export const RULER_PX = 118;

/** The column of chamber number `index` on its floor: -1, +1, -2, +2, ... (never 0: the shaft). */
export function sectionColumn(index) {
    const j = Math.max(0, Math.floor(index)) % CHAMBERS_PER_FLOOR;
    const k = Math.floor(j / 2) + 1;
    return j % 2 ? k : -k;
}

/** growth.js graphFromSlots's `place`: the floor, and the column as x, every chamber at z = 0. */
export function sectionPlace(index) {
    const i = Math.max(0, Math.floor(index));
    return { floor: Math.floor(i / CHAMBERS_PER_FLOOR), x: sectionColumn(i), z: 0 };
}

/** The floor line (the bottom of the chambers) of floor `f`. */
export const floorLine = (f) => FLOOR0 - FLOOR_PITCH * f;

/** Where chamber `index` is: its floor and column, its middle x, its floor line y, its middle y. */
export function chamberPos(index) {
    const p = sectionPlace(index);
    const y = floorLine(p.floor);
    return { floor: p.floor, col: p.x, x: p.x * PITCH, y, cy: y + CH_H / 2 };
}

/** How thick a sleep of `years` lies: a log, so a million years is not a mile. */
export function layerThickness(years) {
    return LAYER_MIN + LAYER_PER_DECADE * Math.log10(1 + Math.max(0, years || 0));
}

/**
 * Years per sleep for a colony that has slept `total` years in `sleeps` sleeps but kept no history
 * (an old save, a reload): each sleep deeper than the last, as the cryo tiers make them.
 * @returns {number[]}
 */
export function reconstructHistory(total, sleeps) {
    const n = Math.max(0, Math.floor(sleeps || 0));
    if (!(total > 0) || !n) return [];
    const w = [];
    let sum = 0;
    for (let i = 0; i < n; i++) { const v = Math.pow(1.6, i); w.push(v); sum += v; }
    return w.map((v) => total * v / sum);
}

/**
 * Keeps the per-sleep history in step with the watcher: a new sleep opens a new layer, the sleep
 * under way thickens the top one, a reset (fewer years than drawn) starts again from the totals.
 * Returns the same array when nothing changed, else a new one.
 * @param {number[]} history - years per sleep, oldest first
 * @param {number} total - watcher.sleptYears
 * @param {number} sleeps - watcher.sleeps
 * @returns {number[]}
 */
export function trackHistory(history, total, sleeps) {
    const h = Array.isArray(history) ? history : [];
    const t = Math.max(0, total || 0);
    const n = Math.max(0, Math.floor(sleeps || 0));
    if (t <= 0 && !n) return h.length ? [] : h;
    const sum = h.reduce((a, b) => a + b, 0);
    if (!h.length || sum > t + 0.5) return compactHistory(reconstructHistory(t, Math.max(1, n)).concat(t > 0 ? [] : [0]));
    if (n > h.length) return compactHistory(h.concat([Math.max(0, t - sum)]));
    if (Math.abs(t - sum) < 1e-9) return h;
    const out = h.slice();
    out[out.length - 1] += t - sum;
    return out;
}

/** At most MAX_LAYERS layers: the oldest are merged in pairs (they are the thinnest, deepest). */
export function compactHistory(history, max = MAX_LAYERS) {
    const h = history.slice();
    while (h.length > max) {
        const merged = [];
        const over = h.length - max;
        for (let i = 0; i < h.length; i++) {
            if (i < over * 2 && i % 2 === 0 && i + 1 < h.length) { merged.push(h[i] + h[i + 1]); i++; } else merged.push(h[i]);
        }
        h.length = 0;
        h.push(...merged);
    }
    return h;
}

/**
 * The layers, YEAR 0 upward: each with its years, the years slept to its top, and its bottom and top.
 * @param {number[]} history
 * @returns {{years:number, cum:number, y0:number, y1:number}[]}
 */
export function strataLayers(history) {
    const out = [];
    let y = 0, cum = 0;
    for (const years of history || []) {
        const t = layerThickness(years);
        cum += years;
        out.push({ years, cum, y0: y, y1: y + t });
        y += t;
    }
    return out;
}

/** Where the surface is now: the top of the last layer (YEAR 0 when the colony never slept). */
export const surfaceY = (layers) => (layers && layers.length ? layers[layers.length - 1].y1 : 0);

/**
 * The year labels on the ruler: YEAR 0 always, the surface always, and between them the boundary
 * of every layer that is not too close to the last label drawn (counted from the top down).
 * @returns {{y:number, years:number, kind:'zero'|'year'|'surface'}[]}
 */
export function strataLabels(layers, minGap = 0.42) {
    const out = [];
    if (!layers || !layers.length) return [{ y: 0, years: 0, kind: 'surface' }];
    const top = layers[layers.length - 1];
    out.push({ y: top.y1, years: top.cum, kind: 'surface' });
    let last = top.y1;
    for (let i = layers.length - 2; i >= 0; i--) {
        const L = layers[i];
        if (last - L.y1 < minGap || L.y1 < minGap) continue;
        out.push({ y: L.y1, years: L.cum, kind: 'year' });
        last = L.y1;
    }
    out.push({ y: 0, years: 0, kind: 'zero' });
    return out;
}

/** Thousands with a thin gap, as the counter writes them. */
export function formatYears(y) {
    const n = Math.round(Math.max(0, y || 0));
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** The widest column dug on any floor (at least 3, so an early colony is not drawn huge). */
export function widestColumn(chambers) {
    const n = Math.max(0, Math.floor(chambers || 0));
    let w = 3;
    for (let i = 0; i < n; i++) w = Math.max(w, Math.abs(sectionColumn(i)));
    return w;
}

/**
 * Pixels per unit and where the shaft stands on the screen: the colony's widest floor fits between
 * the panel (insetLeft) and the ruler, at the mockup's scale or smaller.
 * @returns {{ppu:number, shaftPx:number}}
 */
export function fitScale(width, insetLeft, maxCol) {
    const avail = Math.max(200, width - insetLeft - RULER_PX - 32);
    const half = maxCol * PITCH + CH_W / 2 + 0.7;
    const ppu = Math.min(MAX_PPU, avail / (2 * half));
    return { ppu, shaftPx: insetLeft + 16 + avail / 2 };
}

/**
 * The camera at rest (its middle, in y): the deepest floor a fifth up from the bottom, the years and
 * the sky over it; a shallow colony is not drawn sunk to the middle (YEAR 0 at most 40 % down).
 * @param {number} viewH - the view's height in units
 * @param {number} floors - floors dug
 */
export function homeY(viewH, floors) {
    const deepest = floorLine(Math.max(0, floors - 1));
    return Math.min(-0.1 * viewH, deepest + 0.32 * viewH);
}

/** How far the camera may go: up to see the surface over the years, down a little past the deepest floor. */
export function cameraLimits(viewH, floors, surface, out = {}) {
    const home = homeY(viewH, floors);
    const deepest = floorLine(Math.max(0, floors - 1));
    out.min = Math.min(home, deepest - 2.4 + 0.5 * viewH);
    out.max = Math.max(home, surface + 1.6 - 0.5 * viewH + 0.12 * viewH);
    return out;
}
