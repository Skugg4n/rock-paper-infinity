/**
 * Chapter IV · THE DEEP, the dig: a plausible player, for scripts/sim-dig.mjs and the tests. It
 * dives, mines the nearest ore it can see, goes home when the battery or the cargo says so, and at
 * home buys the cheapest useful upgrade (the one a gate asked for first). It sees what a player
 * sees: ore in the lamp's circle, and in a GPS ping. Ghost ore fools it like it fools a player.
 * At home it unloads, mends what is failing, shops; with the radio it comes home in time for an alarm.
 */

import { W, H, T } from './world.js';
import {
    tileAt, isOre, gateOf, digTime, homeCost, isHome, batteryCap, cargoCap, lampRadius, pingShows, ping, gpsReady,
    priceFor, buy, buyGraft, GRAFTS, graftShown, MOVE_TIME, UP_TIME, UP_COST, MOVE_COST, rowShown, maxLevel, ROWS, roomOf,
    stopOpen, closeStop, STOPS, litAt, boost, teleport, shock, fittable, fit,
} from './dig.js';
import { coolLeft } from './quantum.js';
import { caveOver, risky } from './hazards.js';

export { risky };
import { buildDrone, genOpen, buyGen, GEN_PRICE } from './dig.js';


import { HOME_X, roomSpot } from './base.js';
import { spotOf, repairCost, worstAlarm } from './alarms.js';
import { depthOf } from './world.js';

/** Into the base only through the hatch. */
const passUp = (x, ny) => ny !== -1 || x === HOME_X;

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
            if (tileAt(s, nx, ny) !== T.AIR || !passUp(nx, ny)) continue;
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
            if (tileAt(s, nx, ny) !== T.AIR || !passUp(nx, ny)) continue;
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

/** Is this tile one the player would go for: ore or a find, seen in the lamp or in the last ping. */
function wanted(s, x, y, t) {
    if (s.__explore && (isOre(t) || t === T.FIND) && Math.abs(x - s.x) + Math.abs(y - s.y) <= 70) return true;
    const d = Math.hypot(x - s.x, y - s.y);
    const lit = litAt(s, x, y) || d <= lampRadius(s);
    const onRadar = pingShows(s, x, y) || (s.pingSeen && s.pingSeen.has(y * W + x)) || (s.levels.mapping > 0 && d <= 12 && s.seen.includes(y * W + x));
    if (t === T.FIND || t === T.QUANTUM) return lit || onRadar || (t === T.QUANTUM && d <= lampRadius(s) * 1.5);
    if (t === T.GHOST) return lit && !(s.pingSeen && s.pingSeen.size);  // a ping shows it is not there
    if (!isOre(t)) return false;
    // with nothing left to buy, parts are only worth it for the colony
    // (nothing it can see in the workshop that the parts in hand do not already pay for)
    let left = 0;
    for (const r of ROWS) if (rowShown(s, r)) for (let lv = s.levels[r]; lv < maxLevel(r); lv++) left += priceFor(r, lv);
    const maxed = s.parts >= left && s.levels.drill >= 3 && s.levels.hull >= 3;
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
            if (risky(s, nx, ny)) continue;
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

const USEFUL = ['steering', 'radio', 'drill', 'cargo', 'battery', 'gps', 'mapping', 'updrill', 'homing', 'lamp', 'hull'];

/** At home: buy what the gate asked for, then the cheapest useful thing, while there is money. */
/** The next gate below the record, as the row to buy, when it is near: a player reads the workshop. */
const GATES = [[300, 'drill', 2], [500, 'hull', 1], [700, 'drill', 3], [900, 'hull', 2], [1200, 'hull', 3]];
function nextGate(s) {
    const best = (s.record + 1) * 5;
    for (const [m, row, lv] of GATES) if (rowShown(s, row) && s.levels[row] < lv && best >= m - 120) return row;
    return null;
}

/**
 * Steering I goes two steps a press: a player who swings back and forth past a target presses down
 * (or up) instead, to come at it from another side.
 */
function unswing(s, mem, dir) {
    if (s.levels.steering || (dir !== 'left' && dir !== 'right')) return dir;
    mem.hist = (mem.hist || []).filter((h) => s.time - h[1] < 3);
    const last = mem.hist[mem.hist.length - 1];
    if (!last || last[0] !== dir) mem.hist.push([dir, s.time]);
    if (mem.hist.length >= 4) {
        mem.hist = [];
        const below = tileAt(s, s.x, s.y + 1);
        if (below === T.AIR || (below > 0 && !gateOf(s, below, s.y + 1) && below !== T.HEART)) return 'down';
    }
    return dir;
}

/** Would the player walk to the workshop now: something there they can pay. */
function wantsToShop(s, mem) {
    if (fittable(s).length) return true;
    // what shop() would buy, tried on a copy
    const c = { ...s, x: roomSpot('workshop'), y: -1, levels: { ...s.levels }, tut: s.tut && { ...s.tut, rows: [...s.tut.rows] }, events: [], sayAt: { ...s.sayAt } };
    return shop(c, { ...mem }).length > 0;
}

/** A player reads a stop: the arrival is typed (40 ms a letter), the others take a moment. Seconds. */
export function readStop(s) {
    if (!stopOpen(s)) return 0;
    const st = s.tut.stop;
    const secs = st.crt ? STOPS.arrive.join(' ').length * 0.04 + 1.5 : 2.5;
    closeStop(s);
    return secs;
}

export function shop(s, mem) {
    const bought = [];
    for (const id of fittable(s)) if (fit(s, id)) bought.push(`fit ${id}`);
    if (!mem.need) mem.need = nextGate(s);
    for (let guard = 0; guard < 12; guard++) {
        if (graftShown(s) && GRAFTS[s.grafts] && s.bio >= GRAFTS[s.grafts].price && buyGraft(s)) { bought.push('graft'); continue; }
        const want = mem.need && mem.need !== 'graft' && rowShown(s, mem.need) ? mem.need : null;
        if (want && s.levels[want] < maxLevel(want)) {
            if (s.parts >= priceFor(want, s.levels[want])) { buy(s, want); bought.push(want); mem.need = null; continue; }
            // save for it, but buy cheap things that do not delay it much
        }
        const cands = USEFUL.filter((r) => rowShown(s, r) && s.levels[r] < maxLevel(r) && (r !== 'hull' || mem.need === 'hull'))
            .map((r) => ({ r, p: priceFor(r, s.levels[r]) }))
            .filter((c) => c.p <= s.parts && (!want || s.parts - c.p >= priceFor(want, s.levels[want]) * 0.5 || c.p <= 30))
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
    if (s.lost) { buildDrone(s); return { dir: null }; }
    // a roof that is moving overhead: out from under it, now
    const cave = !isHome(s) && caveOver(s);
    if (cave) {
        if (tileAt(s, s.x, s.y - 1) === T.AIR) return { dir: 'up' };
        return { dir: s.x - cave.x0 < cave.x1 - s.x ? 'left' : 'right' };
    }
    // magma in the drone's own tile or right beside it: up and away
    if (!isHome(s) && s.lava) {
        const hot = (x, y) => s.lava[y * W + x] !== undefined;
        if (hot(s.x, s.y) || hot(s.x - 1, s.y) || hot(s.x + 1, s.y)) {
            if (tileAt(s, s.x, s.y - 1) === T.AIR && !hot(s.x, s.y - 1)) return { dir: 'up' };
            for (const d of [-1, 1]) if (tileAt(s, s.x + d, s.y) === T.AIR && !hot(s.x + d, s.y)) return { dir: d < 0 ? 'left' : 'right' };
        }
    }
    if (isHome(s)) {
        mem.going = null; mem.target = null; s.pingSeen = null; mem.hist = [];
        const toward = (x) => (s.x < x ? 'right' : s.x > x ? 'left' : null);
        // the cargo to the warehouse
        if (s.cargo.length) return { dir: roomOf(s) === 'warehouse' ? null : toward(roomSpot('warehouse')) };
        // a quantum object to the lab
        if (s.quantum && s.quantum.carry.length) return { dir: roomOf(s) === 'lab' ? null : toward(roomSpot('lab')) };
        // something failing: stand under it while it is mended
        const al = s.alarms;
        const broken = al && (al.list[0] || (al.genDown ? { id: 'gen' } : null));
        if (broken && !mem.noRepair && s.parts >= repairCost(depthOf(s.record))) {
            const x = spotOf(broken.id);
            return { dir: toward(x) };
        }
        // something to buy: to the workshop
        if (wantsToShop(s, mem)) {
            if (roomOf(s) !== 'workshop') return { dir: toward(roomSpot('workshop')) };
            shop(s, mem);
        }
        // the generator's next level, when the parts are plenty
        const gp = GEN_PRICE[s.levels.gen || 0];
        if (genOpen(s) && gp !== undefined && s.parts >= gp * 1.6 && s.reserve < 70) {
            if (roomOf(s) !== 'generator') return { dir: toward(roomSpot('generator')) };
            buyGen(s);
        }
        if (s.battery < batteryCap(s) * 0.97) return { dir: null };
        // down: the drone drives to the hatch
        return { dir: 'down' };
    }
    const home = wayHome(s);
    // with the TELEPORT ready, the way home is a key press
    const homeNeed = coolLeft(s, 'teleport') === 0 && s.y > 25 ? 4 : (home ? home.cost : homeCost(s) * 1.5) * 1.12 + 2.5;
    // the radio: an alarm, and not much time to spare
    const worst = s.levels.radio > 0 ? worstAlarm(s) : null;
    const tripS = (s.y + 1) * 0.05 + 4;
    if (worst && worst.until - s.time < tripS + 25) mem.going = 'home';
    if (mem.going === 'home' || s.cargo.length >= cargoCap(s) || s.battery < homeNeed + 3) {
        mem.going = 'home';
        // the TELEPORT, when the way home is long
        if (s.y > 25 && coolLeft(s, 'teleport') === 0 && teleport(s)) return { dir: null };
        return { dir: home ? home.dir : 'up' };
    }
    // a ping whenever the GPS is ready: it costs nothing (what it showed is remembered for this dive)
    if (gpsReady(s) && s.y > 1 && !s.act && ping(s)) {
        s.pingSeen = s.pingSeen || new Set();
        for (let y = s.y; y < Math.min(H, s.y + 20); y++) for (let x = 0; x < W; x++) if (pingShows(s, x, y) && (isOre(tileAt(s, x, y)) || tileAt(s, x, y) === T.FIND)) s.pingSeen.add(y * W + x);
    }
    // a target is kept until it is dug: no dithering between two
    let tgt = null;
    if (mem.target && tileAt(s, mem.target.x, mem.target.y) > 0) tgt = nearestWanted(s, 30, mem.target);
    // saving for a gate it cannot pay yet: it explores sideways for ore, as a player would
    const saving = mem.need && mem.need !== 'graft' && s.levels[mem.need] < maxLevel(mem.need) && s.parts < priceFor(mem.need, s.levels[mem.need]);
    s.__explore = saving;
    // with parts enough for what the workshop shows, a player wants depth: only ore on the way
    let cheapest = Infinity;
    for (const r of ROWS) if (rowShown(s, r) && s.levels[r] < maxLevel(r)) cheapest = Math.min(cheapest, priceFor(r, s.levels[r]));
    const near = saving ? 90 : s.parts >= cheapest * 1.5 && s.reserve > 60 && depthOf(s.y) < 1600 ? 1.2 : 6;
    if (!tgt) { tgt = nearestWanted(s, saving ? 60 : 30); s.__explore = false; mem.target = tgt && tgt.cost < near ? { x: tgt.x, y: tgt.y } : null; }
    // a player who finds themself going up and down over the same spot gives up on that target for a while
    if (tgt && tgt.cost < near && (tgt.dir === 'up' || tgt.dir === 'down')) {
        mem.vh = (mem.vh || []).filter((h) => s.time - h[1] < 2);
        const lastV = mem.vh[mem.vh.length - 1];
        if (!lastV || lastV[0] !== tgt.dir) mem.vh.push([tgt.dir, s.time]);
        if (mem.vh.length >= 4) { mem.vh = []; mem.target = null; mem.calmUntil = s.time + 6; }
    }
    if (mem.calmUntil > s.time) tgt = null;
    if (tgt && tgt.cost < near) return { dir: unswing(s, mem, tgt.dir) };
    // the BOOSTER on the way down; the SHOCK WAVE when solid ground is in the way
    if (coolLeft(s, 'booster') === 0 && s.y > 3) boost(s);
    if (coolLeft(s, 'shock') === 0 && s.y > 3) {
        const below = tileAt(s, s.x, s.y + 1);
        if (below > 0 && below !== T.HEART && !gateOf(s, below, s.y + 1)) shock(s);
    }
    // nothing in sight: down; at the bottom, toward the heart
    const below = tileAt(s, s.x, s.y + 1);
    if (below === -1 || (s.y >= 393 && below !== T.HEART)) {
        if (s.x < 11) return { dir: 'right' };
        if (s.x > 12) return { dir: 'left' };
        return { dir: 'down' };
    }
    if (below === T.HEART) return { dir: 'down' };
    const g = below > 0 ? gateOf(s, below, s.y + 1) : null;
    if (!g && !risky(s, s.x, s.y + 1)) return { dir: 'down' };
    if (!g) {
        // a hazard below: around it
        for (const d of ['left', 'right']) {
            const nx = s.x + (d === 'left' ? -1 : 1), t = tileAt(s, nx, s.y);
            if ((t === T.AIR || (t > 0 && !gateOf(s, t, s.y))) && !risky(s, nx, s.y)) return { dir: d };
        }
        mem.going = 'home';
        return { dir: home ? home.dir : 'up' };
    }
    const need = blocker(s);
    if (need) {
        mem.need = need;
        // a player presses into it once and reads why not (that is what puts its row in the workshop)
        mem.tried = mem.tried || {};
        if (need !== 'graft' && !rowShown(s, need) && !mem.tried[need]) { mem.tried[need] = true; return { dir: 'down' }; }
        // the gate is a whole band: home, buy it
        if (need === 'graft' || /DRILL|HULL/.test(g)) {
            if (tgt) return { dir: tgt.dir };
            if (need !== 'graft' && s.parts < priceFor(need, s.levels[need])) {
                // nothing seen: dig sideways into the dark
                const first = (Math.floor(s.time / 20) % 2) ? 'left' : 'right';
                for (const d of [first, first === 'left' ? 'right' : 'left']) {
                    const nx = s.x + (d === 'left' ? -1 : 1), t = tileAt(s, nx, s.y);
                    if (t >= 0 && !(t > 0 && gateOf(s, t, s.y)) && !risky(s, nx, s.y)) return { dir: d };
                }
            }
            mem.going = 'home';
            return { dir: home ? home.dir : 'up' };
        }
    }
    // a hard tile under us: around it
    for (const d of ['left', 'right']) {
        const nx = s.x + (d === 'left' ? -1 : 1), t = tileAt(s, nx, s.y);
        if ((t === T.AIR || (t > 0 && !gateOf(s, t, s.y))) && !risky(s, nx, s.y)) return { dir: d };
    }
    if (tgt) return { dir: tgt.dir };
    mem.going = 'home';
    return { dir: home ? home.dir : 'up' };
}

