/**
 * Chapter IV · THE DEEP, the dig: a plausible player, for scripts/sim-dig.mjs and the tests. It
 * dives, mines the nearest ore it can see, goes home when the battery or the cargo says so, and at
 * home buys the cheapest useful upgrade (the one a gate asked for first). It sees what a player
 * sees: ore in the lamp's circle, and on the radar. Ghost ore fools it like it fools a player.
 */

import { W, H, T } from './world.js';
import {
    tileAt, isOre, gateOf, digTime, homeCost, isHome, batteryCap, cargoCap, lampRadius, radarRange,
    PRICES, buy, buyGraft, GRAFTS, graftShown, MOVE_TIME, UP_TIME, UP_COST, MOVE_COST,
} from './dig.js';

const DIRS = [['down', 0, 1], ['left', -1, 0], ['right', 1, 0], ['up', 0, -1]];

/** The way home through open ground: first direction and the battery it costs, or null. */
export function wayHome(s) {
    if (isHome(s)) return { dir: null, cost: 0 };
    const key = (x, y) => (y + 1) * W + x;
    const prev = new Map([[key(s.x, s.y), null]]);
    const q = [[s.x, s.y]];
    let end = null;
    while (q.length) {
        const [x, y] = q.shift();
        if (y === -1) { end = [x, y]; break; }
        for (const [, dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (tileAt(s, nx, ny) !== T.AIR) continue;
            const k = key(nx, ny);
            if (prev.has(k)) continue;
            prev.set(k, [x, y, dx, dy]);
            q.push([nx, ny]);
        }
    }
    if (!end) return null;
    let cost = 0, first = null;
    let cur = end;
    while (true) {
        const p = prev.get(key(cur[0], cur[1]));
        if (!p) break;
        cost += p[3] === -1 ? UP_COST : p[2] ? MOVE_COST : 0;
        first = p;
        cur = [p[0], p[1]];
    }
    const dir = !first ? null : first[3] === -1 ? 'up' : first[3] === 1 ? 'down' : first[2] < 0 ? 'left' : 'right';
    return { dir, cost };
}

/** The cells of the way home through open ground, from the drone to the surface, or null. */
export function pathHome(s) {
    if (isHome(s)) return null;
    const key = (x, y) => (y + 1) * W + x;
    const prev = new Map([[key(s.x, s.y), null]]);
    const q = [[s.x, s.y]];
    let end = null;
    for (let qi = 0; qi < q.length; qi++) {
        const [x, y] = q[qi];
        if (y === -1) { end = [x, y]; break; }
        for (const [, dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (tileAt(s, nx, ny) !== T.AIR) continue;
            const k = key(nx, ny);
            if (prev.has(k)) continue;
            prev.set(k, [x, y]);
            q.push([nx, ny]);
        }
    }
    if (!end) return null;
    const out = [end];
    let cur = prev.get(key(end[0], end[1]));
    while (cur) { out.push(cur); cur = prev.get(key(cur[0], cur[1])); }
    return out.reverse();
}

/** Is this tile one the player would go for: ore or a find, seen in the lamp or on the radar. */
function wanted(s, x, y, t) {
    if (s.__explore && (isOre(t) || t === T.FIND) && Math.abs(x - s.x) + Math.abs(y - s.y) <= 70) return true;
    const d = Math.hypot(x - s.x, y - s.y);
    const lit = d <= lampRadius(s);
    const onRadar = d <= radarRange(s);
    if (t === T.FIND) return lit || (s.levels.radar >= 3 && onRadar);
    if (t === T.GHOST) return lit && !onRadar;        // the radar shows it is not there
    if (!isOre(t)) return false;
    // with nothing left to buy, parts are only worth it for the colony
    const maxed = ['drill', 'battery', 'cargo', 'lamp', 'hull', 'radar'].every((r) => s.levels[r] >= 3);
    if (maxed && t !== T.BIO && s.reserve > 50) return false;
    return lit || onRadar;
}

/** Dijkstra over the tiles near the drone, cost in seconds; up only through open ground. */
function nearestWanted(s, reach = 30, fixed = null) {
    const y0 = Math.max(-1, s.y - reach), y1 = Math.min(H - 1, s.y + reach);
    const rows = y1 - y0 + 1;
    const dist = new Float64Array(W * rows).fill(Infinity);
    const from = new Int32Array(W * rows).fill(-1);
    const idx = (x, y) => (y - y0) * W + x;
    const open = [[0, s.x, s.y]];
    dist[idx(s.x, s.y)] = 0;
    while (open.length) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
        const [d, x, y] = open[bi];
        open[bi] = open[open.length - 1]; open.pop();
        if (d > dist[idx(x, y)]) continue;
        const t = tileAt(s, x, y);
        if ((x !== s.x || y !== s.y) && (fixed ? (x === fixed.x && y === fixed.y) : wanted(s, x, y, t))) {
            // walk back to the first step
            let cx = x, cy = y;
            for (let g = 0; g < 4000; g++) {
                const f = from[idx(cx, cy)];
                const px = f % W, py = Math.floor(f / W) - 1;
                if (px === s.x && py === s.y) break;
                cx = px; cy = py;
            }
            const dir = cy > s.y ? 'down' : cy < s.y ? 'up' : cx < s.x ? 'left' : 'right';
            return { dir, x, y, cost: d };
        }
        for (const [, dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (ny < y0 || ny > y1 || (ny < 0 && s.y >= 0)) continue;
            const nt = tileAt(s, nx, ny);
            if (nt === -1 || nt === T.HEART) continue;
            if (nt !== T.AIR && (dy === -1 || gateOf(s, nt, ny))) continue;
            const c = nt === T.AIR ? (dy === -1 ? UP_TIME : MOVE_TIME * (dy ? 0.3 : 1)) : digTime(s, nt, ny) + 0.05;
            const nd = d + c;
            const k = idx(nx, ny);
            if (nd < dist[k]) { dist[k] = nd; from[k] = (y + 1) * W + x; open.push([nd, nx, ny]); }
        }
    }
    return null;
}

/** What blocks the way down here, as the row to buy, or null. */
function blocker(s) {
    for (const [dir, dx, dy] of DIRS) {
        if (dir === 'up') continue;
        const t = tileAt(s, s.x + dx, s.y + dy);
        if (t <= 0) continue;
        const g = gateOf(s, t, s.y + dy);
        if (!g) return null;
        if (dir === 'down') {
            if (/DRILL/.test(g)) return 'drill';
            if (/HULL/.test(g)) return 'hull';
            if (/bone/.test(g)) return 'graft';
        }
    }
    return null;
}

const USEFUL = ['drill', 'cargo', 'battery', 'radar', 'lamp', 'hull'];

/** At home: buy what the gate asked for, then the cheapest useful thing, while there is money. */
/** The next gate below the record, as the row to buy, when it is near: a player reads the workshop. */
const GATES = [[300, 'drill', 2], [500, 'hull', 1], [700, 'drill', 3], [900, 'hull', 2], [1200, 'hull', 3]];
function nextGate(s) {
    const best = (s.record + 1) * 5;
    for (const [m, row, lv] of GATES) if (s.levels[row] < lv && best >= m - 120) return row;
    return null;
}

export function shop(s, mem) {
    const bought = [];
    if (!mem.need) mem.need = nextGate(s);
    for (let guard = 0; guard < 12; guard++) {
        if (graftShown(s) && GRAFTS[s.grafts] && s.bio >= GRAFTS[s.grafts].price && buyGraft(s)) { bought.push('graft'); continue; }
        const want = mem.need && mem.need !== 'graft' ? mem.need : null;
        if (want && s.levels[want] < 3) {
            if (s.parts >= PRICES[s.levels[want]]) { buy(s, want); bought.push(want); mem.need = null; continue; }
            // save for it, but buy cheap things that do not delay it much
        }
        const cands = USEFUL.filter((r) => s.levels[r] < 3 && (r !== 'hull' || mem.need === 'hull'))
            .map((r) => ({ r, p: PRICES[s.levels[r]] }))
            .filter((c) => c.p <= s.parts && (!want || s.parts - c.p >= PRICES[s.levels[want]] * 0.5 || c.p <= 30))
            .sort((a, b) => a.p - b.p || USEFUL.indexOf(a.r) - USEFUL.indexOf(b.r));
        if (!cands.length) break;
        buy(s, cands[0].r);
        bought.push(cands[0].r);
    }
    return bought;
}

/**
 * The player's hand this moment.
 * @param {object} s state
 * @param {object} mem the player's memory (need: a row a gate asked for, going: 'home' | null)
 * @returns {{dir: string|null}}
 */
export function decide(s, mem) {
    if (s.ended) return { dir: null };
    if (isHome(s)) {
        mem.going = null; mem.target = null;
        if (s.cargo.length) return { dir: null };
        shop(s, mem);
        if (s.battery < batteryCap(s) * 0.97) return { dir: null };
        // walk to the shaft or dig a new one under the base
        return { dir: 'down' };
    }
    const home = wayHome(s);
    const homeNeed = (home ? home.cost : homeCost(s) * 1.5) * 1.12 + 2.5;
    if (mem.going === 'home' || s.cargo.length >= cargoCap(s) || s.battery < homeNeed + 3) {
        mem.going = 'home';
        return { dir: home ? home.dir : 'up' };
    }
    // a target is kept until it is dug: no dithering between two
    let tgt = null;
    if (mem.target && tileAt(s, mem.target.x, mem.target.y) > 0) tgt = nearestWanted(s, 30, mem.target);
    // saving for a gate it cannot pay yet: it explores sideways for ore, as a player would
    const saving = mem.need && mem.need !== 'graft' && s.levels[mem.need] < 3 && s.parts < PRICES[s.levels[mem.need]];
    s.__explore = saving;
    if (!tgt) { tgt = nearestWanted(s, saving ? 60 : 30); s.__explore = false; mem.target = tgt && tgt.cost < (saving ? 90 : 6) ? { x: tgt.x, y: tgt.y } : null; }
    if (tgt && tgt.cost < (saving ? 90 : 6)) return { dir: tgt.dir };
    // nothing in sight: down; at the bottom, toward the heart
    const below = tileAt(s, s.x, s.y + 1);
    if (below === -1 || (s.y >= 393 && below !== T.HEART)) {
        if (s.x < 11) return { dir: 'right' };
        if (s.x > 12) return { dir: 'left' };
        return { dir: 'down' };
    }
    if (below === T.HEART) return { dir: 'down' };
    const g = below > 0 ? gateOf(s, below, s.y + 1) : null;
    if (!g) return { dir: 'down' };
    const need = blocker(s);
    if (need) {
        mem.need = need;
        // the gate is a whole band: home, buy it
        if (need === 'graft' || /DRILL|HULL/.test(g)) {
            if (tgt) return { dir: tgt.dir };
            if (need !== 'graft' && s.parts < PRICES[s.levels[need]]) {
                // nothing seen: dig sideways into the dark
                const first = (Math.floor(s.time / 20) % 2) ? 'left' : 'right';
                for (const d of [first, first === 'left' ? 'right' : 'left']) {
                    const t = tileAt(s, s.x + (d === 'left' ? -1 : 1), s.y);
                    if (t >= 0 && !(t > 0 && gateOf(s, t, s.y))) return { dir: d };
                }
            }
            mem.going = 'home';
            return { dir: home ? home.dir : 'up' };
        }
    }
    // a hard tile under us: around it
    for (const d of ['left', 'right']) {
        const t = tileAt(s, s.x + (d === 'left' ? -1 : 1), s.y);
        if (t === T.AIR || (t > 0 && !gateOf(s, t, s.y))) return { dir: d };
    }
    if (tgt) return { dir: tgt.dir };
    mem.going = 'home';
    return { dir: home ? home.dir : 'up' };
}

