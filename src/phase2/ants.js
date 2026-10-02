/**
 * Ants: the people of chapter II as small dark-blue dots walking the streets
 * between the plates (home → store/factory → home), cars as bigger, faster dots
 * once the car is researched, and the competitor's red dots on their island.
 * The neighbour's watchmen walk their coast; when the city is complete they
 * board the boat, cross the water, raze one of our outer houses and sail home.
 * That is the opening of III·WAR (B191: nobody walks on the water). In the
 * war itself their landings and our strikes sail too, each side from its own
 * pier, and our guards meet a landing on the beach (v1.63.0).
 *
 * Rendering is a canvas overlay (`#ants-canvas`) over the city area; the
 * simulation reads building slot rectangles from the DOM once a second. Pure
 * helpers (streetPath, antCount) are exported for tests.
 *
 * Exception to vision.md "contained animations": these dots deliberately
 * leave the plates and walk the gaps, so the gaps read as streets (Ola,
 * 2026-09-18).
 */

import { layoutRect } from './layout.js';

const HOUSING = new Set(['home', 'apartment', 'skyscraper', 'district']);
const WORK = new Set(['store', 'superStore', 'factory', 'bank']);

/**
 * Number of dots for a population. Grows with the square root so a village
 * has a few and a metropolis is busy but never a swarm.
 * @param {number} population
 * @param {number} [cap=60]
 */
export function antCount(population, cap = 60) {
    if (!(population > 0)) return 0;
    return Math.min(cap, Math.max(2, Math.ceil(Math.sqrt(population))));
}

/**
 * A Manhattan route between two plates that stays on the streets (the gaps):
 * leave the source plate downwards to the street under its row, walk along it
 * to a vertical street between the two columns, up/down to the street under
 * the destination's row, along it, then into the destination.
 *
 * @param {{x:number,y:number,w:number,h:number}} src
 * @param {{x:number,y:number,w:number,h:number}} dst
 * @param {number} gap - width of the street between plates
 * @returns {Array<{x:number,y:number}>} waypoints, first = src centre, last = dst centre
 */
export function streetPath(src, dst, gap) {
    const g = Math.max(2, gap);
    const c = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const a = c(src), b = c(dst);
    const streetBelow = (r) => r.y + r.h + g / 2;
    const ySrc = streetBelow(src);
    const yDst = streetBelow(dst);
    const sameRow = Math.abs(src.y - dst.y) < 1;
    if (sameRow) {
        return [a, { x: a.x, y: ySrc }, { x: b.x, y: ySrc }, b];
    }
    // vertical street: the gap on the side of the source that faces the destination
    const vx = b.x > a.x ? src.x + src.w + g / 2 : src.x - g / 2;
    return [a, { x: a.x, y: ySrc }, { x: vx, y: ySrc }, { x: vx, y: yDst }, { x: b.x, y: yDst }, b];
}

/**
 * The coast road round our island: a rectangle just outside the plates'
 * bounding box, in the water's edge. Guards stand on it; landings arrive on it.
 * @param {{x,y,w,h}} grid - bounding box of all plates
 * @param {number} gap
 */
export function coastRing(grid, gap) {
    const off = Math.max(2, gap) * 0.9;
    return { x: grid.x - off, y: grid.y - off, w: grid.w + 2 * off, h: grid.h + 2 * off };
}
/** Perimeter of the ring. Ring coordinate s runs clockwise from the top-left corner. */
export const ringLength = (R) => 2 * (R.w + R.h);
/** The point at ring coordinate s. */
export function ringPoint(R, s) {
    const P = ringLength(R);
    let u = ((s % P) + P) % P;
    if (u < R.w) return { x: R.x + u, y: R.y };
    u -= R.w; if (u < R.h) return { x: R.x + R.w, y: R.y + u };
    u -= R.h; if (u < R.w) return { x: R.x + R.w - u, y: R.y + R.h };
    u -= R.w; return { x: R.x, y: R.y + R.h - u };
}
/** Ring coordinate of the ring point nearest to p. */
export function ringCoord(R, p) {
    const cx = Math.max(R.x, Math.min(R.x + R.w, p.x)), cy = Math.max(R.y, Math.min(R.y + R.h, p.y));
    const d = { n: Math.abs(p.y - R.y), e: Math.abs(p.x - (R.x + R.w)), s: Math.abs(p.y - (R.y + R.h)), w: Math.abs(p.x - R.x) };
    const edge = Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a), 'n');
    if (edge === 'n') return cx - R.x;
    if (edge === 'e') return R.w + (cy - R.y);
    if (edge === 's') return R.w + R.h + (R.x + R.w - cx);
    return 2 * R.w + R.h + (R.y + R.h - cy);
}
/** Signed shortest distance along the ring from s0 to s1. */
export function ringDelta(R, s0, s1) {
    const P = ringLength(R);
    let d = ((s1 - s0) % P + P) % P;
    if (d > P / 2) d -= P;
    return d;
}
/** The walk along the ring from s0 to s1 the short way: corners included, so every leg is straight. */
export function ringWalk(R, s0, s1) {
    const d = ringDelta(R, s0, s1);
    const corners = [0, R.w, R.w + R.h, 2 * R.w + R.h];
    const P = ringLength(R);
    const pts = [ringPoint(R, s0)];
    const passed = [];
    for (const c of corners) {
        for (const k of [-1, 0, 1]) {
            const cc = c + k * P;
            const rel = cc - s0;
            if ((d > 0 && rel > 0 && rel < d) || (d < 0 && rel < 0 && rel > d)) passed.push(rel);
        }
    }
    passed.sort((a, b) => (d > 0 ? a - b : b - a)).forEach(rel => pts.push(ringPoint(R, s0 + rel)));
    pts.push(ringPoint(R, s1));
    return pts;
}
/**
 * Which coast a landing on `dst` arrives at: the nearest edge of the island,
 * the side facing the enemy winning ties and counted one plate closer.
 * @returns {'n'|'e'|'s'|'w'}
 */
export function nearestEdge(dst, grid, facing = 's') {
    const unit = dst.h || 1;
    const d = {
        s: grid.y + grid.h - (dst.y + dst.h), n: dst.y - grid.y,
        e: grid.x + grid.w - (dst.x + dst.w), w: dst.x - grid.x,
    };
    d[facing] -= unit;
    const order = [facing, ...['e', 'w', 's', 'n'].filter(e => e !== facing)];
    return order.reduce((a, b) => (d[b] < d[a] - 0.5 ? b : a), order[0]);
}
/**
 * The last stretch: where on the coast a party lands for `dst`, and the
 * streets from there to the plate (never through another plate).
 */
function landingRoute(dst, gap, R, edge) {
    const g = Math.max(2, gap);
    const b = { x: dst.x + dst.w / 2, y: dst.y + dst.h / 2 };
    const vx = dst.x - g / 2;                 // the street left of its column
    const below = dst.y + dst.h + g / 2;      // the street under its row
    const above = dst.y - g / 2;              // the street over its row
    if (edge === 'n') return [{ x: vx, y: R.y }, { x: vx, y: above }, { x: b.x, y: above }, b];
    if (edge === 'e') return [{ x: R.x + R.w, y: below }, { x: b.x, y: below }, b];
    if (edge === 'w') return [{ x: R.x, y: below }, { x: b.x, y: below }, b];
    return [{ x: vx, y: R.y + R.h }, { x: vx, y: below }, { x: b.x, y: below }, b];
}
/**
 * A route between the islands, every leg straight: from a tile along their
 * coast to the crossing point, straight across the water to our coast, along
 * our coast to the landing point nearest the target, then up the streets and
 * in. Never through a plate, never a diagonal. The enemy island lies south.
 *
 * The returned array carries markers (indices into it): `theirCoast` (first
 * point on their coast road), `crossFrom` (leaving their coast), `ourCoast`
 * (reaching ours), `land` (the landing point) and `edge` (n/e/s/w). Reverse
 * it with `reversePath` to walk it the other way with the markers kept.
 *
 * @param {{x,y,w,h}} from - tile on the other island
 * @param {{x,y,w,h}} dst - target plate
 * @param {number} gap
 * @param {{x,y,w,h}} grid - bounding box of all plates
 * @param {{x,y,w,h}} [theirs] - bounding box of their tiles (defaults to `from`)
 */
export function crossPath(from, dst, gap, grid, theirs = from) {
    const g = Math.max(2, gap);
    const R = coastRing(grid, g);
    const a = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const edge = nearestEdge(dst, grid, 's');
    const inland = landingRoute(dst, g, R, edge);
    const L = inland[0];
    // the crossing: straight below the landing point if we can, else below the ring corner we walk round
    let X = L.x;
    if (edge === 'e') X = R.x + R.w;
    else if (edge === 'w') X = R.x;
    else if (edge === 'n') X = L.x > R.x + R.w / 2 ? R.x + R.w : R.x;
    const Xc = Math.max(theirs.x - g, Math.min(theirs.x + theirs.w + g, X));
    const Ty = theirs.y - g * 0.8;           // their coast road, on the side facing us
    const C2 = { x: Math.max(R.x, Math.min(R.x + R.w, Xc)), y: R.y + R.h };
    const walk = ringWalk(R, ringCoord(R, C2), ringCoord(R, L)).slice(1, -1);
    const path = [a, { x: a.x, y: Ty }, { x: Xc, y: Ty }, C2, ...walk, ...inland];
    path.theirCoast = 1; path.crossFrom = 2; path.ourCoast = 3; path.land = 4 + walk.length; path.edge = edge;
    return path;
}
/**
 * Whether a dot at (seg, t) on a crossing has reached the island it is
 * heading for. Every crossPath has exactly one leg over open water: between
 * the point where it leaves their coast (`crossFrom`) and the point where it
 * reaches ours (`ourCoast`). Which of the two comes later depends on the
 * direction (reversePath keeps both on the same places), and everything past
 * the later one is the destination's coast road and streets. Before the
 * water leg the dot is still on the island it set out from, which counts as
 * not there yet. A path without markers is a street walk and never leaves
 * its island.
 * @param {Array<{x:number,y:number}>} path
 * @param {number} seg
 * @param {number} [t=0]
 */
export function onIsland(path, seg, t = 0) {
    if (!path || path.crossFrom === undefined || path.ourCoast === undefined) return true;
    return seg + t >= Math.max(path.crossFrom, path.ourCoast) - 1e-9;
}
/**
 * Where a boat is at k (0-1) of its course from `from` to `to`: a straight
 * line with a gentle bend to one side, eased at both ends. The bend keeps the
 * hull from looking like a dot on a wire.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} k
 * @param {number} [bend=0.08] - sideways bow as a share of the distance
 * @returns {{x:number,y:number}}
 */
export function boatCourse(from, to, k, bend = 0.08) {
    const kk = Math.max(0, Math.min(1, k));
    const e = kk < 0.5 ? 2 * kk * kk : 1 - Math.pow(-2 * kk + 2, 2) / 2;
    const dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy) || 1;
    const side = Math.sin(e * Math.PI) * bend * L;
    return { x: from.x + dx * e - dy / L * side, y: from.y + dy * e + dx / L * side };
}

/**
 * A course through several points with the corners rounded (radius r), so a
 * hull turns instead of pivoting. Points closer than half a pixel are merged.
 * @param {Array<{x:number,y:number}>} points
 * @param {number} [r=28]
 * @returns {Array<{x:number,y:number}>} a dense polyline from the first point to the last
 */
export function roundCourse(points, r = 28) {
    const pts = [];
    for (const p of points) if (!pts.length || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 0.5) pts.push({ x: p.x, y: p.y });
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1];
        const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
        const rr = Math.min(r, l1 / 2, l2 / 2);
        const p0 = { x: b.x + (a.x - b.x) * rr / l1, y: b.y + (a.y - b.y) * rr / l1 };
        const p2 = { x: b.x + (c.x - b.x) * rr / l2, y: b.y + (c.y - b.y) * rr / l2 };
        for (let k = 0; k <= 6; k++) {
            const t = k / 6, u = 1 - t;
            out.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * b.y + t * t * p2.y });
        }
    }
    out.push(pts[pts.length - 1]);
    return out;
}
/** Length of a polyline in px. */
export const courseLength = (poly) => poly.reduce((s, p, i) => (i ? s + Math.hypot(p.x - poly[i - 1].x, p.y - poly[i - 1].y) : 0), 0);
/**
 * Where a boat is at k (0-1) of a course (a polyline from roundCourse), eased
 * at both ends like boatCourse, with its heading in radians.
 * @param {Array<{x:number,y:number}>} poly
 * @param {number} k
 * @returns {{x:number,y:number,angle:number|undefined}}
 */
export function courseAt(poly, k) {
    const kk = Math.max(0, Math.min(1, k));
    const e = kk < 0.5 ? 2 * kk * kk : 1 - Math.pow(-2 * kk + 2, 2) / 2;
    if (poly.length < 2) return { x: poly[0]?.x ?? 0, y: poly[0]?.y ?? 0, angle: undefined };
    let left = e * courseLength(poly);
    for (let i = 1; i < poly.length; i++) {
        const a = poly[i - 1], b = poly[i], L = Math.hypot(b.x - a.x, b.y - a.y);
        if (left <= L || i === poly.length - 1) {
            const t = L > 0 ? Math.min(1, left / L) : 1;
            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: L > 0 ? Math.atan2(b.y - a.y, b.x - a.x) : undefined };
        }
        left -= L;
    }
    return { x: poly[poly.length - 1].x, y: poly[poly.length - 1].y, angle: undefined };
}
/**
 * How long a crossing takes: real seconds that grow with the distance, 5 to 9.
 * @param {number} px - length of the course
 */
export const sailSeconds = (px) => Math.max(5, Math.min(9, px / 55));

/** Reverses a crossPath, keeping its markers pointing at the same places. */
export function reversePath(path) {
    const r = [...path].reverse();
    const n = path.length - 1;
    for (const k of ['theirCoast', 'crossFrom', 'ourCoast', 'land']) if (path[k] !== undefined) r[k] = n - path[k];
    r.edge = path.edge;
    return r;
}

/**
 * Creates the ant layer.
 *
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {HTMLElement} opts.area - the city container the canvas covers
 * @param {function(): Array<{el: Element, building: object}>} opts.getSlots
 * @param {function(): Element[]} opts.getEnemyTiles - visible enemy tiles the war can target (five, in DOM order)
 * @param {function(): number} opts.getGap - street width in px
 * @param {function(): Element[]} [opts.getCivilTiles] - their visible civil tiles (houses, store): walked between, never targets
 * @param {function(): Element|null} [opts.getTown] - the element that holds all their tiles (their island's bounding box)
 * @param {function(): Element|null} [opts.getPier] - their pier; the boat lies at its end
 * @param {function(): Element|null} [opts.getOurPier] - our pier (chapter III); our boat lies at its end
 */
export function createAnts({ canvas, area, getSlots, getEnemyTiles, getGap, getCivilTiles = () => [], getTown = () => null, getPier = () => null, getOurPier = () => null }) {
    const ctx = canvas.getContext('2d');
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ants = [];
    const enemies = [];
    let rects = [];          // { rect, building, el }
    let enemyRects = [];
    let civilRects = [];     // their civil tiles (walked between, never targets)
    let townRect = null;     // their whole island's tiles
    let pierRect = null;
    let ourPierRect = null;
    let state = { population: 0, carUnlocked: false, enemyStage: 0, enemyTicks: 0, ourTier: 0, enemyTier: 0, defence: 0, airDefence: 0, guardsOff: false, hitEdges: [], war: false };
    let clock = 0;           // seconds, for the guards' bob
    /** Weapon reach in px by tier: fists/swords fight in the clinch, gunpowder shoots. */
    const reach = (tier) => (tier <= 1 ? 0 : tier === 2 ? 40 : tier === 3 ? 70 : 110);
    let gather = null;       // { rect, onDone } — everyone walks to one plate (THE DEEP)
    let withdrawing = null;  // { rect, onDone } — the enemy pulls back to its rocket
    let enemiesGone = false; // after the launch nobody comes back
    let peopleGone = false;  // after the descent nobody comes back
    /** Seconds of PLAY after the island appears before its dots come out. */
    const ENEMY_DELAY_S = 30;
    let raf = null;
    let lastMeasure = 0;
    let lastT = 0;
    let dpr = 1;
    // War visuals: waves (red dots marching), strikes (blue dots marching),
    // arcs (shells/missiles through the air) and short-lived effects.
    const waves = [];        // { dots: [...], target, onImpact, done, kind: 'enemy'|'ours', tileRect }
    const effects = [];      // { type: 'arc'|'flash'|'tracer', ... }
    let combat = false;      // tracers on when a melee wave is on our island

    const COLORS = { person: '#1e3a8a', car: '#172554', enemy: '#b91c1c', watchman: '#7f1d1d' };
    // px per second. A village of 2–4 dots must feel alive, a full city calm:
    // people run at 32 with few dots and settle toward 18 with many.
    const SPEED = { person: 18, car: 46, enemy: 20 };
    const personSpeed = () => 18 + 14 * (1 - Math.min(1, ants.length / 30));
    const speedOf = (kind) => (kind === 'person' ? personSpeed() : SPEED[kind]);
    const RADIUS = { person: 2.2, car: 3.2, enemy: 2.4, watchman: 2.6 };

    let layoutKey = '';
    function measure() {
        rects = getSlots()
            .filter(s => s.building)
            .map(s => ({ rect: layoutRect(s.el, area), building: s.building, el: s.el }));
        // If the plates moved (new land, the island appearing, resize), rebuild
        // every route between the SAME two buildings at the same progress, so
        // nobody vanishes or jumps: they just continue on the new street.
        const first = rects[0]?.rect;
        const key = first ? `${Math.round(first.x)},${Math.round(first.y)}` : '';
        if (key !== layoutKey) {
            layoutKey = key;
            const byId = new Map(rects.map(r => [r.building.id, r]));
            for (const a of ants) {
                const from = a.from && byId.get(a.from.building.id);
                const to = a.at && byId.get(a.at.building.id);
                if (from && to) {
                    a.from = from; a.at = to;
                    if (a.path) a.path = streetPath(from.rect, to.rect, getGap());
                } else { a.path = null; a.at = to || null; a.wait = Math.random() * 0.5; }
            }
        } else {
            // Same layout: keep `at`/`from` pointing at fresh rect entries
            const byId = new Map(rects.map(r => [r.building.id, r]));
            for (const a of ants) {
                if (a.at?.building?.id === 'hatch') continue;   // walking into THE DEEP
                if (a.at) a.at = byId.get(a.at.building.id) || null;
                if (a.from) a.from = byId.get(a.from.building.id) || null;
                if (!a.at) { a.path = null; }
            }
        }
        enemyRects = getEnemyTiles().map(el => layoutRect(el, area));
        civilRects = getCivilTiles().map(el => layoutRect(el, area));
        const town = getTown(); townRect = town ? layoutRect(town, area) : null;
        const pier = getPier(); pierRect = pier ? layoutRect(pier, area) : null;
        const ourPier = getOurPier(); ourPierRect = ourPier ? layoutRect(ourPier, area) : null;
        dpr = window.devicePixelRatio || 1;
        const w = area.offsetWidth, h = area.offsetHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr; canvas.height = h * dpr;
            canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
        }
    }

    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const gridBox = () => {
        if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
        const xs = rects.map(r => r.rect.x), ys = rects.map(r => r.rect.y);
        const x2 = Math.max(...rects.map(r => r.rect.x + r.rect.w)), y2 = Math.max(...rects.map(r => r.rect.y + r.rect.h));
        return { x: Math.min(...xs), y: Math.min(...ys), w: x2 - Math.min(...xs), h: y2 - Math.min(...ys) };
    };
    const theirBox = () => {
        if (!enemyRects.length) return null;
        const x = Math.min(...enemyRects.map(r => r.x)), y = Math.min(...enemyRects.map(r => r.y));
        return { x, y, w: Math.max(...enemyRects.map(r => r.x + r.w)) - x, h: Math.max(...enemyRects.map(r => r.y + r.h)) - y };
    };
    const townBox = () => townRect || theirBox();
    const cross = (from, dst) => crossPath(from, dst, getGap(), gridBox(), townBox() || from);
    const homes = () => rects.filter(r => HOUSING.has(r.building.type) && r.building.population > 0 && !r.building.razed);
    const works = () => rects.filter(r => WORK.has(r.building.type) && !r.building.razed);

    function newTrip(ant) {
        const from = ant.at || pick(homes());
        if (!from) return false;
        const goingHome = ant.at && !HOUSING.has(ant.at.building.type);
        const pool = goingHome ? homes() : (works().length ? works() : homes());
        const candidates = pool.filter(r => r !== from);
        const to = candidates.length ? pick(candidates) : null;
        if (!to) return false;
        ant.path = streetPath(from.rect, to.rect, getGap());
        ant.seg = 0; ant.t = 0; ant.from = from; ant.at = to; ant.wait = 0;
        return true;
    }

    function spawnAnt(kind) {
        const ant = { kind, at: null, path: null, seg: 0, t: 0, wait: Math.random() * 2 };
        if (!newTrip(ant)) return null;
        // start somewhere along the first segment so a new batch doesn't march in lockstep
        ant.t = Math.random();
        return ant;
    }

    const theirTiles = () => [...enemyRects, ...civilRects];
    function newEnemyTrip(e) {
        const tiles = theirTiles();
        if (tiles.length < 1) return false;
        const from = e.at ?? pick(tiles);
        const others = tiles.filter(r => r !== from);
        const to = others.length ? pick(others) : from;
        e.path = streetPath(from, to, Math.max(6, getGap() / 2));
        e.seg = 0; e.t = 0; e.at = to; e.wait = 0;
        return true;
    }

    function reconcile() {
        if (gather || withdrawing) return;
        if (peopleGone) { ants.length = 0; }
        if (enemiesGone) { enemies.length = 0; return; }
        // People: match count to population; cars once researched (30 %)
        const want = !peopleGone && state.population > 0 && homes().length ? antCount(state.population) : 0;
        while (ants.length < want) { const a = spawnAnt(state.carUnlocked && Math.random() < 0.3 ? 'car' : 'person'); if (!a) break; ants.push(a); }
        if (ants.length > want) ants.length = want;
        if (state.carUnlocked) ants.forEach(a => { if (a.kind === 'person' && Math.random() < 0.02) a.kind = 'car'; });
        // Their civilians: none until the island has stood a while; a lived-in
        // town at stage 2, fewer as it turns to war (the watchmen take over).
        const enemiesOut = state.enemyStage >= 1 && (state.enemyTicks || 0) >= ENEMY_DELAY_S;
        const wantEnemies = enemiesOut ? [0, 2, 6, 5, 3, state.war ? 4 : 2][Math.min(5, state.enemyStage)] : 0;
        while (enemies.length < wantEnemies && theirTiles().length) { const e = { kind: 'enemy', at: null }; if (!newEnemyTrip(e)) break; e.t = Math.random(); enemies.push(e); }
        if (enemies.length > wantEnemies) enemies.length = wantEnemies;
        reconcileWatchmen();
    }

    function stepDot(d, dt, speed, onArrive) {
        if (d.wait > 0) { d.wait -= dt; return; }
        if (!d.path) { onArrive(d); return; }
        const p0 = d.path[d.seg], p1 = d.path[d.seg + 1];
        if (!p1) { onArrive(d); return; }
        const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
        d.t += (speed * dt) / len;
        if (d.t >= 1) { d.seg++; d.t = 0; if (d.seg >= d.path.length - 1) { d.path = null; d.wait = 0.6 + Math.random() * 1.6; } }
    }

    function pos(d) {
        if (!d.path) { const p = d.at?.rect ?? d.at; return p ? { x: p.x + p.w / 2, y: p.y + p.h / 2 } : null; }
        const p0 = d.path[d.seg], p1 = d.path[d.seg + 1] ?? p0;
        return { x: p0.x + (p1.x - p0.x) * d.t, y: p0.y + (p1.y - p0.y) * d.t };
    }

    /** Advances the simulation by dt seconds and draws. */
    function step(dt, now = performance.now()) {
        clock += dt;
        if (now - lastMeasure > 1000) { measure(); reconcile(); reconcileGuards(); lastMeasure = now; }
        // The raid is coming ashore: our people near the house hurry into the
        // nearest building and stay in until the boat has left. Nobody fights.
        const scare = raidAlarm();
        for (const a of ants) {
            const afraid = scare && a.kind === 'person' && Math.hypot((pos(a)?.x ?? 1e9) - scare.x, (pos(a)?.y ?? 1e9) - scare.y) < 170;
            stepDot(a, dt, speedOf(a.kind) * (afraid ? 2.4 : 1), (d) => {
                if (gather) { if (d.at !== gather.rect) { const from = d.at?.rect ?? gather.rect.rect; d.path = streetPath(from, gather.rect.rect, getGap()); d.seg = 0; d.t = 0; d.at = gather.rect; d.wait = Math.random() * 0.8; } return; }
                if (afraid) { d.wait = 1; return; }      // stays in
                if (!newTrip(d)) d.wait = 1;
            });
        }
        for (const e of enemies) {
            if (withdrawing) stepDot(e, dt, SPEED.enemy * 1.5, (d) => {
                if (d.at !== withdrawing.rect) { const from = d.at?.rect ?? d.at ?? withdrawing.rect; d.path = (from.x !== undefined && from.w !== undefined) ? streetPath(from, withdrawing.rect, Math.max(6, getGap() / 2)) : null; d.seg = 0; d.t = 0; d.at = withdrawing.rect; d.wait = Math.random() * 0.5; d.razing = false; d.homeBound = false; }
            });
            else stepDot(e, dt, SPEED.enemy, (d) => { if (!newEnemyTrip(d)) d.wait = 1; });
        }
        stepWatchmen(dt);
        stepRaid(dt);
        stepLandings(dt);
        stepSorties(dt);
        stepWar(dt);
        draw();
        drawWar();
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        // hidden tab or paused game (window.__rpiPaused, main.js): the picture holds still
        if (document.hidden || window.__rpiPaused) { lastT = 0; return; }
        const dt = Math.min(0.1, (now - (lastT || now)) / 1000); lastT = now;
        step(dt, now);
    }

    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const d of [...ants, ...enemies]) {
            if (!d.path && !d.razing) continue;            // inside a building
            const p = pos(d); if (!p) continue;
            // Walk out of a plate: fade in on the first segment; walk in: fade out on the last.
            let edge = 1;
            if (d.path) {
                if (d.seg === 0) edge = Math.min(1, d.t * 2.2);
                if (d.seg === d.path.length - 2) edge = Math.min(1, (1 - d.t) * 2.2);
            }
            ctx.beginPath();
            ctx.fillStyle = COLORS[d.kind];
            ctx.globalAlpha = (d.kind === 'enemy' ? 0.9 : 0.75) * edge;
            const r = RADIUS[d.kind];
            if (d.kind === 'car') ctx.roundRect(p.x - r, p.y - r * 0.7, r * 2, r * 1.4, 1);
            else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        // their watchmen, and the ones standing on the house they are razing
        for (const m of watchmen) {
            if (m.hidden) continue;
            const p = watchPos(m); if (!p) continue;
            ctx.beginPath(); ctx.fillStyle = COLORS.watchman; ctx.globalAlpha = 0.95;
            ctx.arc(p.x, p.y, RADIUS.watchman, 0, Math.PI * 2); ctx.fill();
        }
        drawBoat();
        ctx.globalAlpha = 1;
    }

    // --- The neighbour's watchmen -------------------------------------------
    // From stage 3 they walk the coast of their island in pairs; from stage 4
    // some stand on the shore that faces us; from stage 5 two wait by the pier.
    // They are the ones who raid. Not the war's `guards` (ours, below).
    const watchmen = [];      // { id, duty: 'patrol'|'watch'|'pier', s, k, walk, hidden, x, y }
    let watchSeq = 0;
    const WATCH_SPEED = 16;   // px/s along the coast
    const townRing = () => { const b = townBox(); return b ? coastRing(b, Math.max(6, getGap() / 2)) : null; };
    const watchmenAt = (stage) => [0, 0, 0, 4, 8, 10][Math.max(0, Math.min(5, stage))];
    function dutyOf(i, stage) {
        if (stage >= 5 && i >= 8) return 'pier';
        if (stage >= 4 && i >= 4 && i < 7) return 'watch';
        return 'patrol';
    }
    /** Where a watchman stands or walks right now. */
    function watchPos(m) {
        if (m.walk?.path) return pos(m.walk);
        if (m.x !== undefined && (m.walk || raid)) return { x: m.x, y: m.y };
        const R = townRing(); if (!R) return null;
        if (m.duty === 'pier' && pierRect) return { x: pierRect.x + pierRect.w / 2 + (m.id % 2 ? -7 : 7), y: pierRect.y + pierRect.h + 7 };
        const p = ringPoint(R, m.s);
        return { x: p.x, y: p.y + (m.duty === 'watch' ? Math.sin(clock * 2 + m.id) * 0.6 : 0) };
    }
    function reconcileWatchmen() {
        if (raid || withdrawing || enemiesGone) return;
        const R = townRing();
        const out = state.enemyStage >= 1 && (state.enemyTicks || 0) >= ENEMY_DELAY_S;
        const want = out && R ? watchmenAt(state.enemyStage) : 0;
        const P = R ? ringLength(R) : 1;
        while (watchmen.length < want) {
            const i = watchmen.length;
            // pairs walk together: the same spot on the ring, seven px apart
            watchmen.push({ id: watchSeq++, s: (Math.floor(i / 2) * 0.37 * P + (i % 2) * 7) % P, walk: null, hidden: false });
        }
        if (watchmen.length > want) watchmen.length = want;
        watchmen.forEach((m, i) => {
            m.duty = dutyOf(i, state.enemyStage);
            if (m.duty === 'watch') m.k = i - 4;
        });
    }
    function stepWatchmen(dt) {
        const R = townRing(); if (!R) return;
        const P = ringLength(R);
        for (const m of watchmen) {
            if (raid) continue;                            // the raid moves them
            if (m.duty === 'patrol') m.s = (m.s + WATCH_SPEED * dt) % P;
            else if (m.duty === 'watch') m.s = R.w * (0.3 + 0.2 * (m.k ?? 0));   // the north side: the shore that faces us
        }
    }

    // --- The boat ---------------------------------------------------------------
    // One hull, drawn from above, moored at the end of their pier from stage 5.
    // `sailBoat` is the shared building block: it carries `boat.aboard` dots
    // from one point to another over `seconds`, with the heading along the
    // course and a wake while it moves. The war can use it for its landings.
    // In the war (v1.63.0) there are two hulls: theirs at their pier, ours at
    // the pier we build on our south coast. `owner` is the landing or sortie
    // that holds a boat; one boat carries one party at a time, the rest queue.
    const boat = { x: 0, y: 0, angle: -Math.PI / 2, aboard: 0, shown: 0, trip: null, moored: true, owner: null, scale: 1, crew: COLORS.watchman };
    const ourBoat = { x: 0, y: 0, angle: Math.PI / 2, aboard: 0, shown: 0, trip: null, moored: true, owner: null, scale: 1, crew: COLORS.person };
    const dockPoint = () => (pierRect ? { x: pierRect.x + pierRect.w / 2, y: pierRect.y - 10 } : null);
    /** Where our boat lies: past the end of our pier, which runs from our south coast into the water. */
    const ourDockPoint = () => (ourPierRect ? { x: ourPierRect.x + ourPierRect.w / 2, y: ourPierRect.y + ourPierRect.h + 10 } : null);
    /**
     * Sends a hull on its way. Without `via` the course is boatCourse (a
     * straight line with a bow); with `via` (water lanes) it is a rounded
     * course through those points.
     */
    function sail(b, from, to, seconds, onArrive, via) {
        b.trip = { from, to, seconds, t: 0, onArrive, poly: via ? roundCourse([from, ...via, to]) : null };
        b.moored = false;
    }
    function sailBoat(from, to, seconds, onArrive, via) { sail(boat, from, to, seconds, onArrive, via); }
    function stepOneBoat(b, dock, want, mooredAngle, dt) {
        if (b.moored && dock) { b.x = dock.x; b.y = dock.y; b.angle = mooredAngle; }
        b.shown += (want - b.shown) * Math.min(1, dt * 1.2);
        const trip = b.trip; if (!trip) return;
        trip.t += dt;
        const k = Math.min(1, trip.t / trip.seconds);
        if (trip.poly) {
            const p = courseAt(trip.poly, k);
            if (p.angle !== undefined) b.angle = p.angle;
            b.x = p.x; b.y = p.y;
        } else {
            const p = boatCourse(trip.from, trip.to, k), q = boatCourse(trip.from, trip.to, Math.min(1, k + 0.01));
            if (Math.hypot(q.x - p.x, q.y - p.y) > 0.01) b.angle = Math.atan2(q.y - p.y, q.x - p.x);
            b.x = p.x; b.y = p.y;
        }
        if (k >= 1) { b.trip = null; trip.onArrive?.(); }
    }
    function stepBoat(dt) {
        const dock = dockPoint();
        stepOneBoat(boat, dock, state.enemyStage >= 5 && !enemiesGone && dock ? 1 : 0, -Math.PI / 2, dt);
        const ours = ourDockPoint();
        stepOneBoat(ourBoat, ours, state.war && !peopleGone && ours ? 1 : 0, Math.PI / 2, dt);
    }
    function drawOneBoat(b) {
        if (b.shown < 0.02) return;
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.angle + Math.PI / 2); ctx.scale(b.scale || 1, b.scale || 1); ctx.globalAlpha = b.shown;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.10)'; ctx.beginPath(); ctx.ellipse(2, 3, 9, 17, 0, 0, Math.PI * 2); ctx.fill();   // its shadow on the water
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.bezierCurveTo(9, -8, 8, 10, 6, 15); ctx.lineTo(-6, 15); ctx.bezierCurveTo(-8, 10, -9, -8, 0, -18); ctx.fill();
        ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.ellipse(0, 1, 4.5, 10.5, 0, 0, Math.PI * 2); ctx.fill();            // the deck
        for (let i = 0; i < Math.min(b.aboard, 12); i++) {
            ctx.fillStyle = b.crew; ctx.beginPath(); ctx.arc(i % 2 ? 2.1 : -2.1, -7 + Math.floor(i / 2) * 3.4, 1.6, 0, Math.PI * 2); ctx.fill();
        }
        if (b.trip) { ctx.globalAlpha = 0.45 * b.shown; ctx.fillStyle = '#eef3f8'; ctx.beginPath(); ctx.moveTo(-5, 16); ctx.lineTo(0, 36); ctx.lineTo(5, 16); ctx.fill(); }   // the wake
        ctx.restore();
    }
    function drawBoat() { drawOneBoat(boat); drawOneBoat(ourBoat); }

    // --- The raid (the war's opening) ------------------------------------------
    // The watchmen walk the coast to the pier and board; the boat crosses to the
    // beach nearest the target; they go ashore in pairs and up the streets, stand
    // on the house until it is razed, go back, and the boat sails home; they return
    // to their posts. `onRazed(building)` fires as the plate goes dark, `onOver()`
    // when they are home again, `onPhase(name)` at every step (for the sound).
    let raid = null;
    const RAID_WALK = 44, RAID_SAIL_S = 4.6;
    /** Walks a path at `speed`; true once the end is reached (the walker is then at `w.end`). */
    function advance(w, dt, speed) {
        if (!w.path) return true;
        if (w.wait > 0) { w.wait -= dt; return false; }
        let left = speed * dt;
        while (left > 0) {
            const p0 = w.path[w.seg], p1 = w.path[w.seg + 1];
            if (!p1) break;
            const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
            const remain = (1 - w.t) * len;
            if (left >= remain) { left -= remain; w.seg++; w.t = 0; if (w.seg >= w.path.length - 1) break; }
            else { w.t += left / len; left = 0; }
        }
        if (w.seg >= w.path.length - 1) { w.end = w.path[w.path.length - 1]; w.path = null; return true; }
        return false;
    }
    const pairDelay = (i, step = 0.3) => Math.floor(i / 2) * step;
    /**
     * Where the boat lies for a landing: the landing point pushed out past the
     * beach into the water. The coast road is just outside the plates; the
     * island's shore lies about ISLAND_PAD further out (islands.js, index.js).
     */
    const ISLAND_PAD = 48;
    function offshore(land) {
        const g = gridBox(), cx = g.x + g.w / 2, cy = g.y + g.h / 2;
        const dx = land.x - cx, dy = land.y - cy, L = Math.hypot(dx, dy) || 1;
        const out = ISLAND_PAD + 14;
        return { x: land.x + dx / L * out, y: land.y + dy / L * out };
    }
    function startAttack(onRazed, onOver, onPhase) {
        if (raid || boat.owner) return false;      // the boat is out with a landing (III)
        measure();
        const targets = homes();
        const R = townRing(), dock = dockPoint();
        if (!targets.length || !enemyRects.length || !R || !pierRect || !dock) return false;
        const target = targets.reduce((best, r) => (r.rect.y + r.rect.x > best.rect.y + best.rect.x ? r : best), targets[0]);
        while (watchmen.length < 6) watchmen.push({ id: watchSeq++, duty: 'patrol', s: Math.random() * ringLength(R), walk: null, hidden: false });
        const route = cross(pierRect, target.rect);
        const land = route[route.land];
        const pierFoot = { x: pierRect.x + pierRect.w / 2, y: pierRect.y + pierRect.h + 4 };
        const sPier = ringCoord(R, pierFoot);
        raid = { phase: 'muster', target, route, land, shore: offshore(land), dock, t: 0, arrived: 0, needed: Math.min(5, watchmen.length), onRazed, onOver, onPhase, razed: false };
        onPhase?.('muster');
        watchmen.forEach((m, i) => {
            const from = watchPos(m) || ringPoint(R, m.s);
            m.hidden = false; m.aboard = false; m.x = from.x; m.y = from.y; m.home = m.duty === 'patrol' ? m.s : (m.duty === 'watch' ? R.w * (0.3 + 0.2 * (m.k ?? 0)) : sPier);
            m.walk = { path: [from, ...ringWalk(R, ringCoord(R, from), sPier).slice(1), pierFoot, dock], seg: 0, t: 0, wait: pairDelay(i) };
        });
        boat.aboard = 0;
        return true;
    }
    /** Where the danger is while the boat is at our coast; null when there is none. */
    function raidAlarm() {
        if (!raid) return null;
        if (raid.phase === 'cross' && boat.trip && boat.trip.t / boat.trip.seconds > 0.55) return raid.land;
        if (raid.phase === 'ashore' || raid.phase === 'raze' || raid.phase === 'back') return raid.land;
        return null;
    }
    function stepRaid(dt) {
        stepBoat(dt);
        const r = raid; if (!r) return;
        r.t += dt;
        const walkAll = (speed, onDone) => {
            for (const m of watchmen) {
                if (!m.walk) continue;
                const was = m.walk.wait > 0;
                const done = advance(m.walk, dt, speed);
                if (was && m.walk.wait <= 0 && m.aboard) { m.aboard = false; m.hidden = false; boat.aboard = Math.max(0, boat.aboard - 1); }   // steps off the boat
                const p = m.walk.path ? pos(m.walk) : m.walk.end;
                if (p) { m.x = p.x; m.y = p.y; }
                if (done) { m.walk = null; onDone?.(m); }
            }
        };
        const allDone = () => watchmen.every(m => !m.walk);
        if (r.phase === 'muster') {
            walkAll(RAID_WALK, (m) => { m.hidden = true; m.aboard = true; boat.aboard++; });
            if (allDone()) { r.phase = 'cross'; r.onPhase?.('cross'); sailBoat(r.dock, r.shore, RAID_SAIL_S, () => {
                r.phase = 'ashore'; r.onPhase?.('ashore'); boat.angle = -Math.PI / 2 + Math.atan2(r.land.y - r.shore.y, r.land.x - r.shore.x) + Math.PI / 2;
                const streets = r.route.slice(r.route.land + 1);
                watchmen.forEach((m, i) => { m.walk = { path: [r.shore, r.land, ...streets], seg: 0, t: 0, wait: pairDelay(i, 0.26) }; m.side = i % 2 ? 3 : -3; });
            }); }
        } else if (r.phase === 'ashore') {
            walkAll(RAID_WALK, (m) => { m.razing = true; r.arrived++; });
            if (r.arrived >= r.needed && !r.razed) {
                r.razed = true; r.phase = 'raze'; r.t = 0; r.onPhase?.('raze');
                // The house is razed: a burnt plate, icon gone, nothing left.
                // Scorched earth is what chapter III is about (vision.md).
                r.target.el.querySelector('.building')?.classList.add('razed');
                const razed = r.target.building, cb = r.onRazed;
                setTimeout(() => { cb?.(razed); }, 1500);
            }
        } else if (r.phase === 'raze') {
            if (r.t > 2.6) {
                r.phase = 'back'; r.onPhase?.('back');
                const back = [...r.route.slice(r.route.land + 1)].reverse().concat([r.land, r.shore]);
                watchmen.forEach((m, i) => { m.razing = false; m.walk = { path: [{ x: m.x, y: m.y }, ...back.slice(1)], seg: 0, t: 0, wait: pairDelay(i, 0.22) }; });
            }
        } else if (r.phase === 'back') {
            walkAll(RAID_WALK, (m) => { m.hidden = true; m.aboard = true; boat.aboard++; });
            if (allDone()) { r.phase = 'home'; r.onPhase?.('home'); sailBoat(r.shore, r.dock, RAID_SAIL_S, () => {
                r.phase = 'dismiss'; boat.moored = true;
                const R = townRing(), pierFoot = { x: pierRect.x + pierRect.w / 2, y: pierRect.y + pierRect.h + 4 }, sPier = ringCoord(R, pierFoot);
                watchmen.forEach((m, i) => {
                    const walkHome = m.duty === 'pier' ? [pierFoot] : ringWalk(R, sPier, m.home ?? m.s);
                    m.walk = { path: [r.dock, pierFoot, ...walkHome], seg: 0, t: 0, wait: pairDelay(i, 0.26) };
                    if (m.duty === 'patrol') m.s = m.home ?? m.s;
                });
            }); }
        } else if (r.phase === 'dismiss') {
            walkAll(RAID_WALK, (m) => { m.x = undefined; m.y = undefined; });
            if (allDone()) { const cb = r.onOver, ph = r.onPhase; raid = null; ph?.('over'); cb?.(); }
        }
    }
    const raiding = () => !!raid;
    /** The enemy pulls every dot back to `tileEl` (its rocket). onDone when all are there. */
    function withdraw(tileEl, onDone) {
        measure();
        raid = null;
        if (!boat.owner) { boat.trip = null; boat.moored = true; }   // a landing already at sea finishes and sails home
        watchmen.length = 0;      // they board the rocket with everyone else
        const rect = layoutRect(tileEl, area);
        withdrawing = { rect, onDone };
        enemies.forEach(e => { e.path = null; e.wait = Math.random() * 1.5; e.razing = false; e.homeBound = false; });
        dismissGuards(null);      // the war is over for them: our guards stand down and walk home
        if (!enemies.length) { withdrawing = null; onDone?.(); }
    }
    /** Everyone walks into one plate (the hatch down). onDone when all are in. */
    function gatherAt(slotEl, onDone) {
        measure();
        const rect = { rect: layoutRect(slotEl, area), building: { id: 'hatch' } };
        gather = { rect, onDone };
        ants.forEach(a => { a.path = null; a.wait = Math.random() * 1.2; });
        dismissGuards(rect);      // the guards leave the coast and go down with everyone
        if (!ants.length && !guards.length) { gather = null; peopleGone = true; onDone?.(); }
    }

    /**
     * A wave against one of our plates. Melee: a landing by boat (see the war
     * by boat above; `push` fills the boat, `first` sails slowly and holds the
     * impact a second, `onCastOff(seconds)` fires as the boat leaves their
     * pier). Ranged/area: one arc through the air per few units.
     * `onImpact()` fires once, when the survivors reach the plate or the arc lands.
     */
    /**
     * Marks `losses` (0-1) of the dots to fall: what the other side's defence
     * absorbs, made visible. They fall on the defenders' ground, never at sea:
     * a landing party falls where our guards meet it (from `from`, the point it
     * reaches our coast, to shortly after the landing point), a strike of ours
     * falls on their island (after it reaches their coast). `fallSeg` is a
     * position along the path in segments (seg + t).
     */
    function scriptLosses(dots, losses, from, to) {
        const fall = Math.round(dots.length * Math.max(0, Math.min(1, losses || 0)));
        dots.forEach((d, i) => {
            if (i >= fall || !d.path) return;
            const last = d.path.length - 1 - 0.15;
            const lo = Math.min(from, last), hi = Math.max(lo, Math.min(to, last));
            d.fallSeg = lo + Math.random() * (hi - lo);
        });
    }
    // --- The war by boat (v1.63.0) -------------------------------------------
    // A landing musters on their pier, sails the water lanes to the beach
    // nearest the target, goes ashore and walks the streets to the plate. Our
    // strikes do the same from our pier to their island, and the survivors sail
    // home. Nobody walks on the water. The rules are untouched: `losses` are
    // scripted to fall on the beach and the first street (onIsland from the first
    // step ashore) and `onImpact` fires when the survivors reach the plate.
    const landings = [];      // theirs, in order: { targetId, dots, phase, go, push, first, ... }
    const sorties = [];       // ours, in order
    const MUSTER_SPEED = 60, BOARD_SPEED = 55, RETURN_SPEED = 44;
    const SEA_OFF = ISLAND_PAD + 14;
    const boatFree = (b) => b.moored && !b.trip && !b.owner && !(b === boat && raid);
    /** The water between the islands: halfway from our plates to theirs. */
    function channelY() {
        const t = townBox();
        if (!t || !rects.length) return null;
        const g = gridBox();
        return (g.y + g.h + t.y) / 2;
    }
    /** The lanes round our island: off the coast on three sides, the channel on the south. */
    function seaOurs() {
        const R = ring(), ch = channelY();
        const low = R.y + R.h + SEA_OFF;
        const bottom = ch === null ? low : Math.max(R.y + R.h + 10, Math.min(low, ch));
        return { x: R.x - SEA_OFF, y: R.y - SEA_OFF, w: R.w + 2 * SEA_OFF, h: bottom - (R.y - SEA_OFF) };
    }
    /** The lanes round their island: the channel on the north, off the coast elsewhere. */
    function seaTheirs() {
        const R = townRing(); if (!R) return null;
        const ch = channelY();
        const high = R.y - SEA_OFF;
        const top = ch === null ? high : Math.min(R.y - 10, Math.max(high, ch));
        return { x: R.x - SEA_OFF, y: top, w: R.w + 2 * SEA_OFF, h: R.y + R.h + SEA_OFF - top };
    }
    /** Where a boat lies for a beach at L on coast `edge`: straight out on the lane. */
    function shoreOf(S, L, edge) {
        if (edge === 'n') return { x: L.x, y: S.y };
        if (edge === 'e') return { x: S.x + S.w, y: L.y };
        if (edge === 'w') return { x: S.x, y: L.y };
        return { x: L.x, y: S.y + S.h };
    }
    /** The points a boat passes between a and b along the lanes S (corners included). */
    const lane = (S, a, b) => ringWalk(S, ringCoord(S, a), ringCoord(S, b));
    /** Their pier's foot on their coast road, and ours on ours. */
    function theirFoot() { const R = townRing(); return R && pierRect ? ringPoint(R, ringCoord(R, { x: pierRect.x + pierRect.w / 2, y: pierRect.y + pierRect.h })) : null; }
    function ourFoot() { const R = ring(); return ourPierRect ? ringPoint(R, ringCoord(R, { x: ourPierRect.x + ourPierRect.w / 2, y: ourPierRect.y })) : null; }
    /** Marks a shore walk: the first leg (boat to beach) is water, everything after is the island. */
    function ashorePath(shore, inland) {
        const path = [shore, ...inland];
        path.crossFrom = 0; path.ourCoast = 1; path.land = 1;
        return path;
    }
    /** A party gathers on the coast road before a pier: walkers to a queue, a pair at a time. */
    function musterParty(n, R, foot, starts, kind) {
        const sFoot = ringCoord(R, foot);
        return Array.from({ length: n }, (_, i) => {
            const a = starts[i % starts.length];
            const spot = sFoot - 6 - Math.floor(i / 2) * 5;
            const path = [a, ...ringWalk(R, ringCoord(R, a), spot)];
            const end = path[path.length - 1];
            path[path.length - 1] = { x: end.x, y: end.y + (i % 2 ? 2.5 : -2.5) };   // side by side on the road
            return { kind, path, seg: 0, t: 0, wait: Math.random() * 1.2 };
        });
    }
    /**
     * Their landing party for a target starts to gather on their pier (at the
     * radar's sighting). launchWave casts it off. Returns false if they have no pier.
     */
    function musterLanding({ targetBuildingId, count = 10, push = false } = {}) {
        measure();
        const R = townRing(), foot = theirFoot();
        if (!R || !foot || !dockPoint() || !theirTiles().length) return false;
        if (landings.some(l => l.targetId === targetBuildingId && !l.go)) return true;
        const n = Math.min(push ? 16 : 10, Math.max(3, Math.round(count / 3)));
        // from the tiles nearest their pier, so the party is aboard by the time the warning is up
        const near = [...theirTiles()].sort((x, y) => Math.hypot(c(x).x - foot.x, c(x).y - foot.y) - Math.hypot(c(y).x - foot.x, c(y).y - foot.y)).slice(0, 3);
        const starts = near.map(c);
        landings.push({ targetId: targetBuildingId, dots: musterParty(n, R, foot, starts, 'enemy'), phase: 'muster', go: false, push });
        return true;
    }
    /**
     * A landing that will not sail (its plate fell before the boat left): the
     * party leaves the pier and walks back into town. The boat is free again.
     */
    function cancelLanding(targetBuildingId) {
        const l = landings.find(x => x.targetId === targetBuildingId && !x.go);
        if (!l) return;
        landings.splice(landings.indexOf(l), 1);
        if (boat.owner === l) { boat.owner = null; boat.aboard = 0; boat.scale = 1; }
        const R = townRing(), foot = theirFoot(), dock = dockPoint();
        if (!R || !foot) return;
        disbanded.push(...l.dots.map((d, i) => {
            const at = d.aboard ? dock : (d.path ? pos(d) : d.end) || foot;
            const home = c(pick(theirTiles().length ? theirTiles() : [{ x: foot.x, y: foot.y, w: 0, h: 0 }]));
            const path = d.aboard || d.boarding ? [at, foot] : [at];
            path.push(...ringWalk(R, ringCoord(R, foot), ringCoord(R, home)), home);
            return { kind: 'enemy', path, seg: 0, t: 0, wait: pairDelay(i, 0.2) };
        }));
    }
    const disbanded = [];     // walkers on their way back into town
    function stepLandings(dt) {
        for (let i = disbanded.length - 1; i >= 0; i--) if (advance(disbanded[i], dt, MUSTER_SPEED)) disbanded.splice(i, 1);
        const dock = dockPoint(), foot = theirFoot();
        for (let li = landings.length - 1; li >= 0; li--) {
            const l = landings[li];
            if (l.phase === 'muster' && l === landings[0] && boatFree(boat) && dock && foot) {
                // the boat is theirs to take: whoever has reached the pier goes aboard
                l.phase = 'board'; boat.owner = l; boat.aboard = 0; boat.scale = l.push ? 1.25 : 1;
            }
            if (l.phase === 'muster' || l.phase === 'board') boardParty(l.dots, l.phase === 'board', boat, foot, dock, dt);
            if (l.phase === 'board' && l.go && l.dots.every(d => d.aboard)) castOff(l);
            else if (l.phase === 'ashore') {
                // they step off in pairs; the hull empties as they go
                for (const d of l.dots) if (d.boarded && !(d.wait > 0)) d.boarded = false;
                boat.aboard = l.dots.filter(d => d.boarded && !d.dead).length;
                if (!boat.aboard) { l.phase = 'leave'; l.leaveAt = clock + 0.6; }
            } else if (l.phase === 'leave' && clock >= l.leaveAt) {
                l.phase = 'return';
                const back = [...l.via].reverse();
                sail(boat, l.shore, dock || l.dock, Math.max(4, Math.min(8, courseLength(roundCourse([l.shore, ...back, l.dock])) / 70)), () => {
                    boat.moored = true; boat.owner = null; boat.scale = 1;
                    landings.splice(landings.indexOf(l), 1);
                }, back);
            }
        }
    }
    /**
     * Moves a party along: to the queue by the pier, and once `boarding` (the
     * boat is theirs), each one at the queue walks the pier and steps aboard.
     */
    function boardParty(dots, boarding, b, foot, dock, dt) {
        for (const d of dots) {
            if (d.aboard) continue;
            const done = advance(d, dt, d.boarding ? BOARD_SPEED : MUSTER_SPEED);
            if (!done || !boarding) continue;
            if (!d.boarding) { d.boarding = true; d.path = [d.end, foot, dock]; d.seg = 0; d.t = 0; d.wait = 0.15; }
            else { d.aboard = true; d.boarding = false; b.aboard++; }
        }
    }
    function castOff(l) {
        measure();
        const target = rects.find(r => r.building.id === l.targetId) || l.target;
        const route = cross(pierRect, target.rect);
        const land = route[route.land];
        const S = seaOurs(), dock = dockPoint();
        const shore = shoreOf(S, land, route.edge);
        const via = lane(S, dock, shore);
        const seconds = l.first ? 9 : sailSeconds(courseLength(roundCourse([dock, ...via, shore])));
        Object.assign(l, { phase: 'sail', target, route, land, shore, dock, via });
        // sighted: the nearest guards walk the coast to the beach it is heading for
        l.responders = respond(land);
        l.onCastOff?.(seconds);
        sail(boat, dock, shore, seconds, () => {
            l.phase = 'ashore';
            boat.angle = Math.atan2(land.y - shore.y, land.x - shore.x);
            const streets = route.slice(route.land + 1);
            l.dots.forEach((d, i) => {
                Object.assign(d, { kind: 'enemy', at: target, path: ashorePath(shore, [land, ...streets]), seg: 0, t: 0, wait: 0.2 + pairDelay(i, 0.26), wave: true, boarded: true, aboard: false });
            });
            // our guards meet them on the beach; the fallen fall there and in the first street
            scriptLosses(l.dots, l.losses, 1, 2.9);
            waves.push({ dots: l.dots, target, onImpact: l.onImpact, done: false, kind: 'enemy', responders: l.responders, hold: l.first ? 1 : 0 });
            combat = true;
        }, via);
    }

    /**
     * Our strike by boat: the force gathers at our pier from the nearest plates,
     * sails to the shore of their island nearest the tile, goes ashore and walks
     * to the tile. Their watchmen and people meet it on their beach. The
     * survivors (the share `onImpact` returns) walk back, sail home and go
     * indoors; `onHome` fires when our boat is back at the pier.
     */
    function launchSortie({ tile, tileIndex, count, losses, onImpact, onHome }) {
        const R = ring(), foot = ourFoot();
        const standing = rects.filter(r => !r.building.razed);
        if (!foot || !standing.length) return false;
        const bottom = Math.max(...standing.map(r => r.rect.y));
        const near = standing.filter(r => Math.abs(r.rect.y - bottom) < 1).sort((a, b) => Math.abs(c(a.rect).x - foot.x) - Math.abs(c(b.rect).x - foot.x)).slice(0, 3);
        const n = Math.min(14, Math.max(3, Math.round(count / 3)));
        sorties.push({ tile, tileIndex, dots: musterParty(n, R, foot, near.map(r => c(r.rect)), 'person'), phase: 'muster', losses, onImpact, onHome, home: [] });
        return true;
    }
    function stepSorties(dt) {
        const dock = ourDockPoint(), foot = ourFoot();
        for (let si = sorties.length - 1; si >= 0; si--) {
            const s = sorties[si];
            if (s.phase === 'muster' && s === sorties.find(x => x.phase !== 'home') && boatFree(ourBoat) && dock && foot) {
                s.phase = 'board'; ourBoat.owner = s; ourBoat.aboard = 0;
            }
            if (s.phase === 'muster' || s.phase === 'board') boardParty(s.dots, s.phase === 'board', ourBoat, foot, dock, dt);
            if (s.phase === 'board' && s.dots.every(d => d.aboard)) sortieCastOff(s);
            else if (s.phase === 'ashore') {
                for (const d of s.dots) if (d.boarded && !(d.wait > 0)) d.boarded = false;
                ourBoat.aboard = s.dots.filter(d => d.boarded && !d.dead).length;
                // the boat waits off their beach until the fighting is over
                if (s.wave.done && s.dots.every(d => d.dead)) {
                    const share = typeof s.homeShare === 'number' ? Math.max(0, Math.min(1, s.homeShare)) : 0;
                    const m = share > 0 ? Math.max(1, Math.min(s.dots.length, Math.round(s.dots.length * share))) : 0;
                    const back = [...s.path].reverse();
                    s.back = Array.from({ length: m }, (_, i) => ({ kind: 'person', path: back.map(p => ({ x: p.x, y: p.y })), seg: 0, t: 0, wait: 0.4 + pairDelay(i, 0.3) }));
                    s.phase = 'regroup';
                }
            } else if (s.phase === 'regroup') {
                for (const d of s.back) { if (!d.aboard && advance(d, dt, RETURN_SPEED)) { d.aboard = true; ourBoat.aboard++; } }
                if (s.back.every(d => d.aboard)) {
                    s.phase = 'return';
                    const back = [...s.via].reverse();
                    sail(ourBoat, s.shore, dock || s.dock, sailSeconds(courseLength(roundCourse([s.shore, ...back, s.dock]))), () => {
                        ourBoat.moored = true; ourBoat.owner = null;
                        // home: down the gangway, along the pier and indoors
                        const R = ring();
                        const indoors = rects.filter(r => !r.building.razed).sort((a, b) => Math.hypot(c(a.rect).x - foot.x, c(a.rect).y - foot.y) - Math.hypot(c(b.rect).x - foot.x, c(b.rect).y - foot.y))[0];
                        const inPt = indoors ? ringPoint(R, ringCoord(R, c(indoors.rect))) : foot;
                        s.home = s.back.map((d, i) => ({ kind: 'person', path: [s.dock, foot, ...ringWalk(R, ringCoord(R, foot), ringCoord(R, inPt)).slice(1), indoors ? c(indoors.rect) : foot], seg: 0, t: 0, wait: pairDelay(i, 0.3) }));
                        ourBoat.aboard = 0;
                        s.phase = 'home';
                        s.onHome?.();
                    }, back);
                }
            } else if (s.phase === 'home') {
                for (const d of s.home) if (!d.inside && advance(d, dt, BOARD_SPEED)) d.inside = true;
                if (s.home.every(d => d.inside)) sorties.splice(si, 1);
            }
        }
    }
    function sortieCastOff(s) {
        measure();
        const tile = enemyRects[s.tileIndex] ?? s.tile;
        const Rt = townRing(), S = seaTheirs(), dock = ourDockPoint();
        const edge = nearestEdge(tile, townBox(), 'n');
        const inland = landingRoute(tile, Math.max(6, getGap() / 2), Rt, edge);
        const land = inland[0], shore = shoreOf(S, land, edge);
        const via = lane(S, dock, shore);
        const seconds = sailSeconds(courseLength(roundCourse([dock, ...via, shore])));
        const path = ashorePath(shore, inland);
        Object.assign(s, { phase: 'sail', tile, land, shore, dock, via, path });
        sail(ourBoat, dock, shore, seconds, () => {
            s.phase = 'ashore';
            ourBoat.angle = Math.atan2(land.y - shore.y, land.x - shore.x);
            s.dots.forEach((d, i) => {
                Object.assign(d, { kind: 'person', at: { rect: tile }, path: ashorePath(shore, inland), seg: 0, t: 0, wait: 0.2 + pairDelay(i, 0.26), wave: true, strike: true, boarded: true, aboard: false });
            });
            // their defence meets them on their beach and in the first street
            scriptLosses(s.dots, s.losses, 1, Math.min(3, inland.length));
            s.wave = { dots: s.dots, target: { rect: tile }, done: false, kind: 'ours',
                onImpact: (f) => { const share = s.onImpact?.(f); s.homeShare = typeof share === 'number' ? share : 0; } };
            waves.push(s.wave);
        }, via);
    }
    /** Mustering, boarding and homecoming dots (the ones not yet in a wave). */
    function drawParties() {
        const dot = (p, color) => { ctx.beginPath(); ctx.fillStyle = color; ctx.globalAlpha = 0.9; ctx.arc(p.x, p.y, RADIUS.enemy, 0, Math.PI * 2); ctx.fill(); };
        for (const l of landings) if (l.phase === 'muster' || l.phase === 'board') for (const d of l.dots) { if (d.aboard) continue; const p = d.path ? pos(d) : d.end; if (p) dot(p, COLORS.enemy); }
        for (const d of disbanded) { const p = d.path ? pos(d) : d.end; if (p) dot(p, COLORS.enemy); }
        for (const s of sorties) {
            if (s.phase === 'muster' || s.phase === 'board') for (const d of s.dots) { if (d.aboard) continue; const p = d.path ? pos(d) : d.end; if (p) dot(p, COLORS.person); }
            if (s.phase === 'regroup') for (const d of s.back) { if (d.aboard || d.wait > 0) continue; const p = d.path ? pos(d) : d.end; if (p) dot(p, COLORS.person); }
            if (s.phase === 'home') for (const d of s.home) { if (d.inside || d.wait > 0) continue; const p = d.path ? pos(d) : d.end; if (p) dot(p, COLORS.person); }
        }
    }

    function launchWave({ targetBuildingId, count, mode, losses = 0, onImpact, push = false, first = false, onCastOff }) {
        measure();
        const target = rects.find(r => r.building.id === targetBuildingId);
        if (!target) { onImpact?.(); return; }
        if (mode === 'melee' && pierRect && dockPoint() && townRing() && theirTiles().length) {
            // By boat: the party already gathering for this plate (musterLanding), or a new one
            let l = landings.find(x => x.targetId === targetBuildingId && !x.go);
            if (!l) { musterLanding({ targetBuildingId, count, push }); l = landings.find(x => x.targetId === targetBuildingId && !x.go); }
            if (l) {
                Object.assign(l, { go: true, target, losses, onImpact, onCastOff, first: !!first });
                const edge = nearestEdge(target.rect, gridBox(), 's');
                if (edge !== 's' && !state.hitEdges.includes(edge)) state.hitEdges = [...state.hitEdges, edge];
                return edge;
            }
        }
        const from = enemyRects.length ? pick(enemyRects) : { x: canvas.width / dpr / 2, y: canvas.height / dpr, w: 0, h: 0 };
        if (mode === 'melee') {
            const dots = [];
            let route = null;
            for (let i = 0; i < Math.min(14, Math.max(3, Math.round(count / 3))); i++) {
                route = cross(from, target.rect);
                dots.push({ kind: 'enemy', at: target, from: { rect: from }, path: route, seg: 0, t: 0, wait: Math.random() * 1.5, wave: true });
            }
            // our guards meet them on the coast; the fallen fall there, on our island
            scriptLosses(dots, losses, Math.max(route.ourCoast, route.land - 0.3), route.land + 0.9);
            const responders = respond(route[route.land]);
            if (route.edge && route.edge !== 's' && !state.hitEdges.includes(route.edge)) state.hitEdges = [...state.hitEdges, route.edge];
            waves.push({ dots, target, onImpact, done: false, kind: 'enemy', responders });
            combat = true;
            return route.edge;
        } else {
            // Through the air. Our air defence shoots down its share (`losses`,
            // scripted from the rule) over our own island, near the end of the
            // flight; at least one shell always gets through (MAX_ABSORB).
            const base = mode === 'area' ? 3 : 1;
            const shells = losses > 0 ? Math.max(base, 3) : base;
            const down = Math.min(shells - 1, Math.round(shells * Math.max(0, Math.min(1, losses))));
            let first = true;
            for (let i = 0; i < shells; i++) {
                const intercepted = i >= shells - down;
                const hit = !intercepted && first;
                if (hit) first = false;
                effects.push({ type: 'arc', from: c(from), to: jitter(c(target.rect), 10), t: -i * 0.3, dur: 1.4, color: COLORS.enemy, size: mode === 'area' ? 4 : 2.5,
                    interceptAt: intercepted ? 0.72 + Math.random() * 0.16 : undefined,
                    onImpact: hit ? () => { flash(c(target.rect), mode === 'area' ? 44 : 26, COLORS.enemy); onImpact?.(); } : () => flash(jitter(c(target.rect), 12), 22, COLORS.enemy) });
            }
        }
    }
    /** Where a shell is at k (0-1) of its flight: a parabola between from and to. */
    function arcPos(e, k) {
        const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
        const h = Math.hypot(dx, dy) * 0.35;
        return { x: e.from.x + dx * k, y: e.from.y + dy * k - h * 4 * k * (1 - k) };
    }
    /** Air defence, made visible: small posts around the whole coast road, one per ten units. */
    function airPosts() {
        const n = Math.min(16, Math.round((state.airDefence || 0) / 10));
        if (!n || !rects.length || guardsGone) return [];
        const R = ring(), P = ringLength(R);
        return Array.from({ length: n }, (_, i) => ringPoint(R, (i + 0.5) * P / n));
    }

    /** Our strike on an enemy tile (by index in enemyRects). Melee by boat from our pier, blue; ranged/area as arcs. */
    function launchStrike({ tileIndex, count, mode, losses = 0, onImpact, onHome }) {
        measure();
        const tile = enemyRects[tileIndex] ?? enemyRects[0];
        if (!tile) { onImpact?.(); return; }
        // By boat from our pier, when we have one (chapter III builds it)
        // ('boat': onHome will fire when the survivors are back at our pier)
        if (mode === 'melee' && ourPierRect && ourDockPoint() && townRing() && launchSortie({ tile, tileIndex, count, losses, onImpact, onHome })) return 'boat';
        // they set out from the standing plate on our south coast closest to the tile
        const standing = rects.filter(r => !r.building.razed);
        const lowest = Math.max(...standing.map(r => r.rect.y), -Infinity);
        const tc = c(tile);
        const coast = standing.filter(r => Math.abs(r.rect.y - lowest) < 1).sort((a, b) => Math.abs(c(a.rect).x - tc.x) - Math.abs(c(b.rect).x - tc.x))[0]?.rect ?? { x: 0, y: 0, w: 0, h: 0 };
        if (mode === 'melee') {
            const dots = [];
            let route = null;
            for (let i = 0; i < Math.min(14, Math.max(3, Math.round(count / 3))); i++) {
                route = reversePath(cross(tile, coast));
                dots.push({ kind: 'person', at: { rect: tile }, from: { rect: coast }, path: route, seg: 0, t: 0, wait: Math.random() * 1.2, wave: true, strike: true });
            }
            // their defence meets them on their island, never out at sea
            scriptLosses(dots, losses, route.crossFrom, route.length - 1);
            waves.push({ dots, target: { rect: tile }, onImpact, done: false, kind: 'ours' });
        } else {
            const shells = mode === 'area' ? 3 : 1;
            for (let i = 0; i < shells; i++) {
                effects.push({ type: 'arc', from: c(coast), to: jitter(c(tile), 8), t: -i * 0.35, dur: 1.4, color: COLORS.person, size: mode === 'area' ? 4 : 2.5,
                    onImpact: i === 0 ? () => { flash(c(tile), mode === 'area' ? 40 : 24, COLORS.person); onImpact?.(); } : () => flash(jitter(c(tile), 10), 20, COLORS.person) });
            }
        }
    }

    const c = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const jitter = (p, a) => ({ x: p.x + (Math.random() * 2 - 1) * a, y: p.y + (Math.random() * 2 - 1) * a });
    function flash(p, size, color) { effects.push({ type: 'flash', x: p.x, y: p.y, t: 0, dur: 0.5, size, color }); }

    function stepWar(dt) {
        // waves and strikes: dots march; first arrivals trigger the impact
        for (const w of waves) {
            let arrived = 0;
            for (const d of w.dots) {
                if (d.dead) { if (!d.killed) arrived++; continue; }   // the fallen never arrive
                stepDot(d, dt, d.strike ? SPEED.enemy * 2.2 : SPEED.enemy * 2, (x) => { x.dead = true; x.wait = 0; });
                // arrived this frame: count it now, or a lone survivor's wave is cleared before it lands
                if (d.dead) { arrived++; flash(c(w.target.rect), 10, d.strike ? COLORS.person : COLORS.enemy); continue; }
                // scripted losses: this one falls here, to the other side's fire.
                // Never at sea (onIsland), and with fists or swords there is no
                // shot at all: only the clinch, a small burst where they meet.
                if (d.fallSeg !== undefined && d.path && d.seg + d.t >= d.fallSeg && onIsland(d.path, d.seg, d.t)) {
                    const p = pos(d); d.killed = true; d.dead = true; d.fellAt = d.seg + d.t;
                    if (p) {
                        const color = d.strike ? COLORS.enemy : COLORS.person;
                        const r = reach(d.strike ? state.enemyTier : state.ourTier);
                        if (r === 0) flash(p, 7, color);
                        else {
                            // the shot comes from the nearest defender on that island, else from inland
                            const shooter = d.strike ? nearestEnemy(p, r * 1.5) : nearestGuard(p, Math.max(r * 1.5, 160));
                            flash(p, 9, color);
                            effects.push({ type: 'tracer', from: shooter || toward(p, c(w.target.rect), 30), to: p, t: 0, dur: 0.15, color });
                        }
                    }
                }
            }
            const alive = w.dots.filter(d => !d.killed).length;
            if (w.responders && w.dots.every(d => d.dead)) { w.responders.forEach(g => { g.resp = null; }); w.responders = null; }
            // The first landing holds its impact a second (`hold`): everything keeps moving, only the blow waits.
            const due = !w.done && (alive === 0 || arrived >= Math.ceil(alive / 2));
            if (due && w.hold > 0 && w.heldAt === undefined) w.heldAt = clock;
            if (due && (!(w.hold > 0) || clock - w.heldAt >= w.hold)) {
                w.done = true;
                if (alive === 0) w.onImpact?.(0);
                else { w.onImpact?.(alive / w.dots.length); flash(c(w.target.rect), 30, w.kind === 'ours' ? COLORS.person : COLORS.enemy); }
            }
        }
        for (let i = waves.length - 1; i >= 0; i--) if (waves[i].done && waves[i].dots.every(d => d.dead)) waves.splice(i, 1);
        combat = waves.some(w => w.kind === 'enemy');
        // arcs and flashes
        for (const e of effects) {
            e.t += dt;
            if (e.type === 'arc' && !e.hit && e.interceptAt !== undefined && e.t >= e.dur * e.interceptAt) {
                // shot down over our island: a tracer from the nearest post, a small burst, gone
                e.hit = true;
                const p = arcPos(e, e.interceptAt);
                const posts = airPosts();
                const post = posts.length ? posts.reduce((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 <= (b.x - p.x) ** 2 + (b.y - p.y) ** 2 ? a : b)) : jitter(p, 40);
                effects.push({ type: 'tracer', from: post, to: p, t: 0, dur: 0.18, color: COLORS.person });
                flash(p, 10, COLORS.person);
                e.t = e.dur;        // the shell is gone
                continue;
            }
            if (e.type === 'arc' && !e.hit && e.t >= e.dur) { e.hit = true; e.onImpact?.(); }
        }
        for (let i = effects.length - 1; i >= 0; i--) { const e = effects[i]; if (e.t >= e.dur + (e.type === 'arc' ? 0 : 0)) effects.splice(i, 1); }
        // Fighting, visual only. Reach depends on the tier: fists and swords
        // clinch (a small burst where they meet), gunpowder and up shoot lines
        // from further away. Who falls is scripted from the rules (scriptLosses),
        // so what you see is what the numbers do.
        const fight = (shooterPos, targetDot, shooterTier, color, canKill) => {
            const h = pos(targetDot); if (!h) return;
            const r = reach(shooterTier);
            const d2 = (shooterPos.x - h.x) ** 2 + (shooterPos.y - h.y) ** 2;
            if (r === 0) {
                if (d2 < 26 * 26 && Math.random() < 0.15) {
                    flash({ x: (shooterPos.x + h.x) / 2, y: (shooterPos.y + h.y) / 2 }, 7, color);
                    if (canKill && Math.random() < 0.12) { targetDot.killed = true; targetDot.dead = true; }
                }
            } else if (d2 < r * r && Math.random() < 0.06) {
                effects.push({ type: 'tracer', from: shooterPos, to: h, t: 0, dur: 0.12, color });
                if (canKill && Math.random() < 0.25) { targetDot.killed = true; targetDot.dead = true; flash(h, 8, color); }
            }
        };
        // our landing party on their island: their dots fight ours, never over the water
        const ourDots = waves.filter(w => w.kind === 'ours').flatMap(w => w.dots.filter(d => !d.dead && d.path && onIsland(d.path, d.seg, d.t)));
        if (ourDots.length) {
            for (const e of enemies) {
                if (!enemyAtHome(e)) continue;
                const p = pos(e); if (!p) continue;
                for (const d of ourDots) { fight(p, d, state.enemyTier, COLORS.enemy, false); }
            }
            for (const m of watchmen) {
                if (m.hidden || raid) continue;
                const p = watchPos(m); if (!p) continue;
                for (const d of ourDots) { fight(p, d, state.enemyTier, COLORS.enemy, false); }
            }
        }
        // their wave on our island: the guards at the coast fight it (our people are civilians)
        stepGuards(dt);
        if (combat) {
            // only once they are ashore: nobody fires at a boat
            const hostiles = waves.filter(w => w.kind === 'enemy').flatMap(w => w.dots.filter(d => !d.dead && d.path && onIsland(d.path, d.seg, d.t)));
            const posts = guardPositions().filter(g => !g.leaving);
            for (const g of posts) for (const d of hostiles) fight(g, d, state.ourTier, COLORS.person, false);
            // and they fire back at the guards
            for (const d of hostiles) {
                const p = pos(d); if (!p) continue;
                for (const g of posts) { if (Math.random() < 0.3) fight(p, { at: { x: g.x - 1, y: g.y - 1, w: 2, h: 2 } }, state.enemyTier, COLORS.enemy, false); }
            }
        }
        // withdraw: everyone home to the rocket; gather: everyone (guards too) into the hatch
        if (withdrawing && enemies.every(e => e.at === withdrawing.rect && !e.path)) { const cb = withdrawing.onDone; withdrawing = null; enemiesGone = true; enemies.length = 0; cb?.(); }
        if (gather && !guards.length && ants.every(a => a.at === gather.rect && !a.path)) { const cb = gather.onDone; gather = null; peopleGone = true; ants.length = 0; cb?.(); }
    }

    // --- Guards: our defence, made visible ---------------------------------
    // One guard per five defence units, standing on the coast road. Most face
    // the enemy island (south); once a landing has come ashore on another
    // coast, a share of them holds that coast too. When a landing party comes,
    // the nearest walk along the coast to where it lands and fire. They stand
    // down when the enemy leaves and go down the hatch with everyone else.
    const guards = [];        // { s, resp: {s}|null, leaving: {path,seg,t}|null, id }
    let guardSeq = 0;
    let guardsGone = false;
    const GUARD_SPEED = 55;   // px/s along the coast
    const ring = () => coastRing(gridBox(), getGap());
    /** Home positions (ring coordinates) for n guards, spread over the coasts that have seen a landing. */
    function guardHomes(n, R) {
        if (!n) return [];
        const others = (state.hitEdges || []).filter(e => e !== 's');
        const edges = ['s', ...others];
        const share = edges.map(e => (e === 's' ? (others.length ? 0.5 : 1) : 0.5 / others.length));
        const span = { n: [0, R.w], e: [R.w, R.w + R.h], s: [R.w + R.h, 2 * R.w + R.h], w: [2 * R.w + R.h, 2 * (R.w + R.h)] };
        const homes = [];
        let left = n;
        edges.forEach((e, k) => {
            const m = k === edges.length - 1 ? left : Math.min(left, Math.round(n * share[k]));
            left -= m;
            const [a, b] = span[e], pad = (b - a) * 0.08;
            for (let i = 0; i < m; i++) homes.push(a + pad + (b - a - 2 * pad) * (m === 1 ? 0.5 : i / (m - 1)));
        });
        return homes.sort((x, y) => x - y);
    }
    function reconcileGuards() {
        if (!rects.length) return;
        if (state.guardsOff && !guardsGone && guards.some(g => !g.leaving)) dismissGuards(null);
        const want = guardsGone || state.guardsOff ? 0 : Math.min(40, Math.round((state.defence || 0) / 5));
        const R = ring();
        const posted = guards.filter(g => !g.leaving);
        const homeS = R.w + R.h + R.w / 2;             // new guards step out onto the south coast
        while (posted.length < want) { const g = { s: homeS + (Math.random() - 0.5) * 20, resp: null, leaving: null, id: guardSeq++ }; guards.push(g); posted.push(g); }
        while (posted.length > want) { const g = posted.pop(); guards.splice(guards.indexOf(g), 1); }
        // hand out the homes in ring order so nobody crosses anybody
        const homes = guardHomes(posted.length, R);
        const P = ringLength(R);
        posted.sort((a, b) => ((a.s % P) + P) % P - ((b.s % P) + P) % P).forEach((g, i) => { g.home = homes[i]; });
    }
    function stepGuards(dt) {
        if (!rects.length) return;
        const R = ring();
        for (let i = guards.length - 1; i >= 0; i--) {
            const g = guards[i];
            if (g.leaving) {
                stepDot(g.leaving, dt, GUARD_SPEED * 0.8, () => {});
                if (!g.leaving.path) guards.splice(i, 1);
                continue;
            }
            const target = g.resp ? g.resp.s : (g.home ?? g.s);
            const d = ringDelta(R, g.s, target);
            const step = GUARD_SPEED * (g.resp ? 1.4 : 1) * dt;
            g.s += Math.abs(d) <= step ? d : Math.sign(d) * step;
        }
    }
    /** Sends the guards nearest to point `p` (on the coast) to meet a landing there. */
    function respond(p) {
        const posted = guards.filter(x => !x.leaving);
        if (!posted.length || !p) return [];
        const R = ring(), sL = ringCoord(R, p);
        const k = Math.max(1, Math.ceil(posted.length * 0.6));
        const chosen = [...posted].sort((a, b) => Math.abs(ringDelta(R, a.s, sL)) - Math.abs(ringDelta(R, b.s, sL))).slice(0, k);
        chosen.forEach((g, i) => { g.resp = { s: sL + (i - (k - 1) / 2) * 5 }; });
        return chosen;
    }
    /** The guards leave the coast: into the nearest plate, and on to `hatch` if given. */
    function dismissGuards(hatch) {
        if (!rects.length) { guards.length = 0; guardsGone = true; return; }
        const R = ring();
        for (const g of guards) {
            if (g.leaving && !hatch) continue;
            const p = g.leaving ? pos(g.leaving) || ringPoint(R, g.s) : ringPoint(R, g.s);
            const near = rects.filter(r => !r.building.razed).sort((a, b) => Math.hypot(c(a.rect).x - p.x, c(a.rect).y - p.y) - Math.hypot(c(b.rect).x - p.x, c(b.rect).y - p.y))[0];
            if (!near) { g.leaving = { path: null }; continue; }
            // step straight off the coast onto the street beside that plate, then in
            const edgeX = Math.max(near.rect.x - 1, Math.min(near.rect.x + near.rect.w + 1, p.x));
            const edgeY = Math.max(near.rect.y - 1, Math.min(near.rect.y + near.rect.h + 1, p.y));
            let path = [p, { x: edgeX, y: edgeY }, c(near.rect)];
            if (hatch && near.rect !== hatch.rect) path = [p, { x: edgeX, y: edgeY }, ...streetPath(near.rect, hatch.rect, getGap())];
            g.leaving = { path, seg: 0, t: 0, wait: Math.random() * 0.8 };
            g.resp = null;
        }
        guardsGone = true;
    }
    /** Where each guard is right now (for drawing and for the fighting). */
    function guardPositions() {
        if (!rects.length) return [];
        const R = ring();
        return guards.map((g, i) => {
            if (g.leaving) { const p = g.leaving.path ? pos(g.leaving) : null; return p ? { ...p, i, leaving: true, fade: g.leaving.seg >= (g.leaving.path?.length || 2) - 2 ? 1 - g.leaving.t : 1 } : null; }
            const p = ringPoint(R, g.s);
            return { x: p.x, y: p.y + Math.sin(clock * 2.2 + g.id * 1.3) * 0.7, i };
        }).filter(Boolean);
    }
    /** Is this enemy dot on its own island (not crossing, not on our plates)? */
    function enemyAtHome(e) {
        if (e.razing || e.at?.building) return false;
        if (e.path && e.path.crossFrom !== undefined) return onIsland(e.path, e.seg, e.t);
        return true;
    }
    function nearestEnemy(p, maxD) {
        let best = null, bd = maxD * maxD;
        const consider = (q) => { if (!q) return; const d2 = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = q; } };
        for (const e of enemies) { if (enemyAtHome(e)) consider(pos(e)); }
        for (const m of watchmen) { if (!m.hidden && !raid) consider(watchPos(m)); }
        return best;
    }
    /** A point `dist` px from p toward q (inland, when q is on the island). */
    function toward(p, q, dist) {
        const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dist / L);
        return { x: p.x + dx * k, y: p.y + dy * k };
    }
    function nearestGuard(p, maxD) {
        let best = null, bd = maxD * maxD;
        for (const g of guardPositions()) { if (g.leaving) continue; const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = { x: g.x, y: g.y }; } }
        return best;
    }
    function drawWar() {
        for (const p of airPosts()) {
            ctx.fillStyle = COLORS.person; ctx.globalAlpha = 0.8;
            ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        }
        for (const g of guardPositions()) {
            ctx.beginPath(); ctx.fillStyle = COLORS.person; ctx.globalAlpha = 0.95 * (g.fade ?? 1);
            ctx.arc(g.x, g.y, RADIUS.person + 0.3, 0, Math.PI * 2); ctx.fill();
        }
        drawParties();
        for (const w of waves) for (const d of w.dots) {
            if (d.dead || d.boarded) continue;            // still on the boat
            const p = pos(d); if (!p) continue;
            ctx.beginPath(); ctx.fillStyle = d.strike ? COLORS.person : COLORS.enemy; ctx.globalAlpha = 0.9;
            ctx.arc(p.x, p.y, RADIUS.enemy, 0, Math.PI * 2); ctx.fill();
        }
        for (const e of effects) {
            if (e.t < 0) continue;
            if (e.type === 'tracer') {
                ctx.beginPath(); ctx.strokeStyle = e.color; ctx.globalAlpha = 0.8 * (1 - e.t / e.dur); ctx.lineWidth = 1;
                ctx.moveTo(e.from.x, e.from.y); ctx.lineTo(e.to.x, e.to.y); ctx.stroke();
            } else if (e.type === 'flash') {
                const k = e.t / e.dur;
                ctx.beginPath(); ctx.strokeStyle = e.color; ctx.globalAlpha = 0.7 * (1 - k); ctx.lineWidth = 2;
                ctx.arc(e.x, e.y, e.size * (0.3 + 0.7 * k), 0, Math.PI * 2); ctx.stroke();
            } else if (e.type === 'arc') {
                // a shell through the air: a parabola between from and to
                if (e.hit && e.interceptAt !== undefined) continue;
                const k = Math.min(1, e.t / e.dur);
                const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
                const dist = Math.hypot(dx, dy);
                const h = dist * 0.35;
                const x = e.from.x + dx * k, y = e.from.y + dy * k - h * 4 * k * (1 - k);
                ctx.beginPath(); ctx.fillStyle = e.color; ctx.globalAlpha = 0.95;
                ctx.arc(x, y, e.size, 0, Math.PI * 2); ctx.fill();
                // short trail
                const k2 = Math.max(0, k - 0.06);
                const x2 = e.from.x + dx * k2, y2 = e.from.y + dy * k2 - h * 4 * k2 * (1 - k2);
                ctx.beginPath(); ctx.strokeStyle = e.color; ctx.globalAlpha = 0.35; ctx.lineWidth = e.size * 0.8;
                ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    function start() { if (reduced || raf) return; lastT = 0; raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    function setState(next) { state = { ...state, ...next }; }

    const boatInfo = (b) => ({ x: Math.round(b.x), y: Math.round(b.y), aboard: b.aboard, shown: +b.shown.toFixed(2), trip: !!b.trip, moored: b.moored, owner: !!b.owner });
    return { start, stop, step, setState, startAttack, raiding, launchWave, launchStrike, musterLanding, cancelLanding, withdraw, gatherAt, measure, sailBoat, dockPoint, ourDockPoint, _debug: () => ({ raid: raid?.phase, boat: boatInfo(boat), ourBoat: boatInfo(ourBoat),
        landings: landings.map(l => ({ phase: l.phase, go: l.go, dots: l.dots.length, shore: l.shore && [Math.round(l.shore.x), Math.round(l.shore.y)], land: l.land && [Math.round(l.land.x), Math.round(l.land.y)] })),
        sorties: sorties.map(s => ({ phase: s.phase, dots: s.dots.length, back: s.back?.length ?? 0, shore: s.shore && [Math.round(s.shore.x), Math.round(s.shore.y)] })), watchmen: watchmen.map(m => ({ duty: m.duty, hidden: m.hidden, walk: !!m.walk })), guards: guards.length, guardsGone, responding: guards.filter(g => g.resp).length, guardSample: guardPositions().slice(0, 3), ants: ants.length, enemies: enemies.length, withdrawing: !!withdrawing, rocket: withdrawing?.rect, sample: enemies.slice(0, 3).map(e => ({ at: e.at === withdrawing?.rect ? 'rocket' : (e.at?.building ? 'plate' : (e.at ? 'tile' : 'none')), atXY: e.at?.rect ? [e.at.rect.x, e.at.rect.y] : (e.at ? [e.at.x, e.at.y] : null), path: !!e.path, wait: e.wait, seg: e.seg })), atRocket: enemies.filter(e => withdrawing && e.at === withdrawing.rect && !e.path).length, gather: !!gather, inHatch: ants.filter(a => gather && a.at === gather.rect && !a.path).length, waves: waves.map(w => ({ kind: w.kind, done: w.done, dots: w.dots.length, dead: w.dots.filter(d => d.dead).length, killed: w.dots.filter(d => d.killed).length, fellAt: w.dots.filter(d => d.killed).map(d => +(d.fellAt ?? -1).toFixed(2)), segs: w.dots.map(d => d.path ? `${d.seg}/${d.path.length}:${d.t.toFixed(2)}${d.wait ? 'w' : ''}` : (d.dead ? 'dead' : 'at')) })) }) };
}
