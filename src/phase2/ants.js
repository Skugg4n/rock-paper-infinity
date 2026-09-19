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
    let state = { population: 0, carUnlocked: false, enemyStage: 0, enemySince: 0 };
    /** Seconds after the island appears before its dots come out. */
    const ENEMY_DELAY_MS = 30000;
    let raf = null;
    let lastMeasure = 0;
    let lastT = 0;
    let attack = null;       // { target, arrived, needed, onDone }
    let dpr = 1;

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
    const homes = () => rects.filter(r => HOUSING.has(r.building.type) && r.building.population > 0 && !r.building.razed);
    const works = () => rects.filter(r => WORK.has(r.building.type));

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
        // People: match count to population; cars once researched (30 %)
        const want = state.population > 0 && homes().length ? antCount(state.population) : 0;
        while (ants.length < want) { const a = spawnAnt(state.carUnlocked && Math.random() < 0.3 ? 'car' : 'person'); if (!a) break; ants.push(a); }
        if (ants.length > want) ants.length = want;
        if (state.carUnlocked) ants.forEach(a => { if (a.kind === 'person' && Math.random() < 0.02) a.kind = 'car'; });
        // Enemies: none until the island has stood a while, then a few per stage
        const enemiesOut = state.enemyStage >= 1 && Date.now() - (state.enemySince || 0) >= ENEMY_DELAY_MS;
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
        if (now - lastMeasure > 1000) { measure(); reconcile(); lastMeasure = now; }
        for (const a of ants) stepDot(a, dt, speedOf(a.kind), (d) => { if (!newTrip(d)) d.wait = 1; });
        for (const e of enemies) {
            if (attack) stepDot(e, dt, SPEED.enemy * 2, (d) => arriveAttack(d));
            else stepDot(e, dt, SPEED.enemy, (d) => { if (!newEnemyTrip(d)) d.wait = 1; });
        }
        if (attack?.done && enemies.every(e => !e.homeBound && !e.razing)) attack = null;
        draw();
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
            // Raid over: walk home to the island, then wander there again.
            if (e.homeBound) { e.homeBound = false; e.razing = false; e.at = pick(enemyRects); e.path = null; e.wait = 0.5; return; }
            const from = e.at?.rect ?? e.at ?? attack.target.rect;
            const home = pick(enemyRects);
            e.path = streetPath(from, home, getGap());
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
        // route from wherever the enemy is (its island tile) to the target
        const from = e.at ?? pick(enemyRects);
        e.path = streetPath(from, attack.target.rect, getGap());
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
        enemies.forEach(e => { e.path = null; e.wait = Math.random() * 1.2; e.arrivedFlag = false; e.homeBound = false; e.razing = false; });
        return true;
    }
    const raiding = () => !!attack;

    function start() { if (reduced || raf) return; lastT = 0; raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    function setState(next) { state = { ...state, ...next }; }

    return { start, stop, step, setState, startAttack, raiding, measure, _debug: () => ({ ants: ants.length, enemies: enemies.length, attack: !!attack }) };
}
