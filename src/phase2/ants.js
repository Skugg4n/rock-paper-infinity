/**
 * Ants: the people of chapter II as small dark-blue dots walking the streets
 * between the plates (home → store/factory → home), cars as bigger, faster dots
 * once the car is researched, and the competitor's red dots on their island.
 * At the war threshold the red dots cross over and take one of our outer
 * houses; that is the opening of III·WAR.
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
 * @param {function(): Element[]} opts.getEnemyTiles - visible enemy tiles
 * @param {function(): number} opts.getGap - street width in px
 */
export function createAnts({ canvas, area, getSlots, getEnemyTiles, getGap }) {
    const ctx = canvas.getContext('2d');
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ants = [];
    const enemies = [];
    let rects = [];          // { rect, building, el }
    let enemyRects = [];
    let state = { population: 0, carUnlocked: false, enemyStage: 0, enemyTicks: 0, ourTier: 0, enemyTier: 0, defence: 0, guardsOff: false, hitEdges: [] };
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
    let attack = null;       // { target, arrived, needed, onDone }
    let dpr = 1;
    // War visuals: waves (red dots marching), strikes (blue dots marching),
    // arcs (shells/missiles through the air) and short-lived effects.
    const waves = [];        // { dots: [...], target, onImpact, done, kind: 'enemy'|'ours', tileRect }
    const effects = [];      // { type: 'arc'|'flash'|'tracer', ... }
    let combat = false;      // tracers on when a melee wave is on our island

    const COLORS = { person: '#1e3a8a', car: '#172554', enemy: '#b91c1c' };
    // px per second. A village of 2–4 dots must feel alive, a full city calm:
    // people run at 32 with few dots and settle toward 18 with many.
    const SPEED = { person: 18, car: 46, enemy: 20 };
    const personSpeed = () => 18 + 14 * (1 - Math.min(1, ants.length / 30));
    const speedOf = (kind) => (kind === 'person' ? personSpeed() : SPEED[kind]);
    const RADIUS = { person: 2.2, car: 3.2, enemy: 2.4 };

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
    const cross = (from, dst) => crossPath(from, dst, getGap(), gridBox(), theirBox() || from);
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

    function newEnemyTrip(e) {
        if (enemyRects.length < 1) return false;
        const from = e.at ?? pick(enemyRects);
        const others = enemyRects.filter(r => r !== from);
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
        // Enemies: none until the island has stood a while, then a few per stage
        const enemiesOut = state.enemyStage >= 1 && (state.enemyTicks || 0) >= ENEMY_DELAY_S;
        const wantEnemies = enemiesOut ? 3 + state.enemyStage * 3 : 0;
        while (enemies.length < wantEnemies && enemyRects.length) { const e = { kind: 'enemy', at: null }; if (!newEnemyTrip(e)) break; e.t = Math.random(); enemies.push(e); }
        if (enemies.length > wantEnemies) enemies.length = wantEnemies;
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
        for (const a of ants) stepDot(a, dt, speedOf(a.kind), (d) => {
            if (gather) { if (d.at !== gather.rect) { const from = d.at?.rect ?? gather.rect.rect; d.path = streetPath(from, gather.rect.rect, getGap()); d.seg = 0; d.t = 0; d.at = gather.rect; d.wait = Math.random() * 0.8; } return; }
            if (!newTrip(d)) d.wait = 1;
        });
        for (const e of enemies) {
            if (withdrawing) stepDot(e, dt, SPEED.enemy * 1.5, (d) => {
                if (d.at !== withdrawing.rect) { const from = d.at?.rect ?? d.at ?? withdrawing.rect; d.path = (from.x !== undefined && from.w !== undefined) ? streetPath(from, withdrawing.rect, Math.max(6, getGap() / 2)) : null; d.seg = 0; d.t = 0; d.at = withdrawing.rect; d.wait = Math.random() * 0.5; d.razing = false; d.homeBound = false; }
            });
            else if (attack) stepDot(e, dt, SPEED.enemy * 2, (d) => arriveAttack(d));
            else stepDot(e, dt, SPEED.enemy, (d) => { if (!newEnemyTrip(d)) d.wait = 1; });
        }
        if (attack?.done && enemies.every(e => e.settled)) { attack = null; enemies.forEach(e => { e.settled = false; }); }
        stepWar(dt);
        draw();
        drawWar();
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (document.hidden) { lastT = 0; return; }
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
        ctx.globalAlpha = 1;
    }

    // --- War opening -------------------------------------------------------
    function arriveAttack(e) {
        if (!attack) return;
        if (attack.done) {
            // Raid over: walk home to the island once, then wander there again.
            if (e.settled) { if (!newEnemyTrip(e)) e.wait = 1; return; }
            if (e.homeBound) { e.homeBound = false; e.razing = false; e.settled = true; e.at = pick(enemyRects); e.path = null; e.wait = 0.5; return; }
            const from = e.at?.rect ?? e.at ?? attack.target.rect;
            const home = pick(enemyRects);
            e.path = reversePath(cross(home, from));
            e.seg = 0; e.t = 0; e.at = home; e.homeBound = true; e.razing = false; e.wait = 0.2 + Math.random();
            return;
        }
        if (e.at === attack.target) {
            if (!e.arrivedFlag) { e.arrivedFlag = true; attack.arrived++; }
            e.wait = 1.5 + Math.random(); e.razing = true; // a moment on the plate, visibly
            if (attack.arrived >= attack.needed) {
                attack.done = true;
                // The house is razed: a burnt plate, icon gone, nothing left.
                // Scorched earth is what chapter III is about (vision.md).
                attack.target.el.querySelector('.building')?.classList.add('razed');
                const razed = attack.target.building;
                enemies.forEach(x => { x.wait = Math.min(x.wait, 1.5 + Math.random()); });
                const done = attack;
                setTimeout(() => { done.onDone?.(razed); }, 1500);
                // clear the raid once everyone is home (checked in step)
            }
            return;
        }
        // route from wherever the enemy is (its island tile) across the water to the target
        const from = e.at?.rect ?? e.at ?? pick(enemyRects);
        e.path = cross(from, attack.target.rect);
        e.seg = 0; e.t = 0; e.at = attack.target; e.wait = 0.2 + Math.random() * 1.5;
    }

    /**
     * Starts the war opening: every enemy dot marches to our outermost house
     * (bottom-right-most populated housing plate). Resolves via onDone once
     * enough have arrived and the house is marked captured.
     */
    function startAttack(onDone) {
        if (attack) return false;
        measure();
        const targets = homes();
        if (!targets.length || !enemyRects.length) return false;
        const target = targets.reduce((best, r) => (r.rect.y + r.rect.x > best.rect.y + best.rect.x ? r : best), targets[0]);
        while (enemies.length < 8 && enemyRects.length) { const e = { kind: 'enemy', at: null }; if (!newEnemyTrip(e)) break; enemies.push(e); }
        attack = { target, arrived: 0, needed: Math.min(5, enemies.length), onDone, done: false };
        enemies.forEach(e => { e.path = null; e.wait = Math.random() * 1.2; e.arrivedFlag = false; e.homeBound = false; e.razing = false; e.settled = false; });
        return true;
    }
    const raiding = () => !!attack;
    /** The enemy pulls every dot back to `tileEl` (its rocket). onDone when all are there. */
    function withdraw(tileEl, onDone) {
        measure();
        attack = null;
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
     * A wave against one of our plates. Melee: red dots march from the island
     * and hit the plate; ranged/area: one arc through the air per few units.
     * `onImpact()` fires once, when the first dots land or the arc lands.
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
    function launchWave({ targetBuildingId, count, mode, losses = 0, onImpact }) {
        measure();
        const target = rects.find(r => r.building.id === targetBuildingId);
        if (!target) { onImpact?.(); return; }
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
            const shells = mode === 'area' ? 3 : 1;
            for (let i = 0; i < shells; i++) {
                effects.push({ type: 'arc', from: c(from), to: jitter(c(target.rect), 10), t: -i * 0.35, dur: 1.4, color: COLORS.enemy, size: mode === 'area' ? 4 : 2.5,
                    onImpact: i === 0 ? () => { flash(c(target.rect), mode === 'area' ? 44 : 26, COLORS.enemy); onImpact?.(); } : () => flash(jitter(c(target.rect), 12), 22, COLORS.enemy) });
            }
        }
    }

    /** Our strike on an enemy tile (by index in enemyRects). Same shapes, blue. */
    function launchStrike({ tileIndex, count, mode, losses = 0, onImpact }) {
        measure();
        const tile = enemyRects[tileIndex] ?? enemyRects[0];
        if (!tile) { onImpact?.(); return; }
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
                dots.push({ kind: 'person', at: { rect: tile }, from: { rect: coast }, path: route, seg: 0, t: 0, wait: Math.random() * 1.2, wave: true, strike: true, fightFrom: route.crossFrom });
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
                // scripted losses: this one falls here, to the other side's fire
                if (d.fallSeg !== undefined && d.path && d.seg + d.t >= d.fallSeg) {
                    const p = pos(d); d.killed = true; d.dead = true;
                    if (p) {
                        // the shot comes from the nearest guard when it is ours that fires
                        const shooter = d.strike ? null : nearestGuard(p, 160);
                        flash(p, 9, d.strike ? COLORS.enemy : COLORS.person);
                        effects.push({ type: 'tracer', from: shooter || jitter(p, 30), to: p, t: 0, dur: 0.15, color: d.strike ? COLORS.enemy : COLORS.person });
                    }
                }
            }
            const alive = w.dots.filter(d => !d.killed).length;
            if (w.responders && w.dots.every(d => d.dead)) { w.responders.forEach(g => { g.resp = null; }); w.responders = null; }
            if (!w.done && alive === 0) { w.done = true; w.onImpact?.(0); }
            if (!w.done && arrived >= Math.ceil(alive / 2)) { w.done = true; w.onImpact?.(alive / w.dots.length); flash(c(w.target.rect), 30, w.kind === 'ours' ? COLORS.person : COLORS.enemy); }
        }
        for (let i = waves.length - 1; i >= 0; i--) if (waves[i].dots.every(d => d.dead)) waves.splice(i, 1);
        combat = waves.some(w => w.kind === 'enemy');
        // arcs and flashes
        for (const e of effects) {
            e.t += dt;
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
        // our landing party on their island: their dots fight ours
        const ourDots = waves.filter(w => w.kind === 'ours').flatMap(w => w.dots.filter(d => !d.dead && d.seg >= (d.fightFrom ?? 1)));
        if (ourDots.length) {
            for (const e of enemies) {
                const p = pos(e); if (!p) continue;
                for (const d of ourDots) { fight(p, d, state.enemyTier, COLORS.enemy, false); }
            }
        }
        // their wave on our island: the guards at the coast fight it (our people are civilians)
        stepGuards(dt);
        if (combat) {
            const hostiles = waves.filter(w => w.kind === 'enemy').flatMap(w => w.dots.filter(d => !d.dead));
            const posts = guardPositions();
            for (const g of posts) for (const d of hostiles) fight(g, d, Math.max(2, state.ourTier), COLORS.person, false);
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
    function nearestGuard(p, maxD) {
        let best = null, bd = maxD * maxD;
        for (const g of guardPositions()) { if (g.leaving) continue; const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = { x: g.x, y: g.y }; } }
        return best;
    }
    function drawWar() {
        for (const g of guardPositions()) {
            ctx.beginPath(); ctx.fillStyle = COLORS.person; ctx.globalAlpha = 0.95 * (g.fade ?? 1);
            ctx.arc(g.x, g.y, RADIUS.person + 0.3, 0, Math.PI * 2); ctx.fill();
        }
        for (const w of waves) for (const d of w.dots) {
            if (d.dead) continue;
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

    return { start, stop, step, setState, startAttack, raiding, launchWave, launchStrike, withdraw, gatherAt, measure, _debug: () => ({ guards: guards.length, guardsGone, responding: guards.filter(g => g.resp).length, guardSample: guardPositions().slice(0, 3), ants: ants.length, enemies: enemies.length, attack: !!attack, withdrawing: !!withdrawing, rocket: withdrawing?.rect, sample: enemies.slice(0, 3).map(e => ({ at: e.at === withdrawing?.rect ? 'rocket' : (e.at?.building ? 'plate' : (e.at ? 'tile' : 'none')), atXY: e.at?.rect ? [e.at.rect.x, e.at.rect.y] : (e.at ? [e.at.x, e.at.y] : null), path: !!e.path, wait: e.wait, seg: e.seg })), atRocket: enemies.filter(e => withdrawing && e.at === withdrawing.rect && !e.path).length, gather: !!gather, inHatch: ants.filter(a => gather && a.at === gather.rect && !a.path).length, waves: waves.map(w => ({ kind: w.kind, done: w.done, dots: w.dots.length, dead: w.dots.filter(d => d.dead).length, killed: w.dots.filter(d => d.killed).length, segs: w.dots.map(d => d.path ? `${d.seg}/${d.path.length}:${d.t.toFixed(2)}${d.wait ? 'w' : ''}` : (d.dead ? 'dead' : 'at')) })) }) };
}
