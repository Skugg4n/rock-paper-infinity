/**
 * Chapter IV · THE DEEP, the dig: the rules. Pure: no DOM, no clock of its own. `step(s, dt, input)`
 * moves the world on by dt seconds with the direction the player holds; what happened is pushed on
 * `s.events` for the screen and the sound to read and clear.
 *
 * The drone stands in a tile (x, y); y = -1 is the surface, the base. Down and sideways it digs,
 * up it only flies through open ground. Every tile dug and every step costs battery; empty, it is
 * recovered home without its cargo. Home, the cargo is unloaded piece by piece into parts and into
 * the colony's reserve, which sinks all the time; at 0 % a pod goes dark every three seconds.
 */

import { W, H, T, ORE, depthOf, layerIndexOf, LAYERS, FINDS, FIND_PARTS, FIND_BIO, makeWorld, rng, rowOf } from './world.js';
import { HOME_X, roomAt } from './base.js';

export { HOME_X };
export const SAVE_KEY = 'rpi-deep-dig';
export const SLEEPERS = 216;

// ---- pass 3: one thing at a time (spec 2026-10-09 A). Player text, verbatim. ----------------------
export const INTRO = 'As the humans wait, frozen in cryogenic sleep, and the earth crumbles above, you must keep the humans alive, the generators humming, the time flowing.';
export const STOPS = {
    arrive: [INTRO, '216 SLEEPERS.'],
    dig: ['The generators burn ore. Dig.'],
    power: ['Power. It takes you down and brings you home.'],
};
export const LINES = {
    unload: 'Drive into the WAREHOUSE to unload.',
    open: 'The workshop is open.',
    newRow: (name) => `New in the workshop: ${name}.`,
};
/** Seconds, at least, between two new workshop rows; and from the first purchase to the generators' gauge. */
export const ROW_GAP = 45;
export const GEN_AFTER = 60;
/** The panel's gauges, shown one at a time as they come to matter. */
export const SHOWS = ['power', 'cargo', 'depth', 'parts', 'gen', 'finds'];
export function newTut() {
    return {
        on: true, stop: { id: 'arrive', text: STOPS.arrive, focus: 'crt', crt: true }, done: {},
        show: {}, rows: [], needs: [], revealDive: -1, fresh: null, fulls: 0, dry: 0, diveOre: 0, dug: false,
    };
}
export const shows = (s, what) => !s.tut || !s.tut.on || !!s.tut.show[what];
export const rowShown = (s, row) => !s.tut || !s.tut.on || s.tut.rows.includes(row);
export const stopOpen = (s) => !!(s.tut && s.tut.stop);
function openStop(s, id, focus = null) {
    if (!s.tut || !s.tut.on || s.tut.done[id] || (s.tut.stop && s.tut.stop.id === id)) return;
    s.tut.stop = { id, text: STOPS[id], focus };
    s.events.push({ type: 'stop', id });
}
/** OK (or doing what it asks): the stop closes and time runs again. */
export function closeStop(s) {
    if (!s.tut || !s.tut.stop) return false;
    s.tut.done[s.tut.stop.id] = true;
    s.tut.stop = null;
    // after the arrival: the first stop
    if (!s.tut.done.dig) openStop(s, 'dig', 'down');
    return true;
}
function reveal(s, what) {
    if (!s.tut || !s.tut.on || s.tut.show[what]) return;
    s.tut.show[what] = true;
    s.events.push({ type: 'show', what });
}
/** A need arose: its workshop row comes, one a dive, the next time the drone is home. */
export function need(s, row) {
    const t = s.tut;
    if (!t || !t.on || t.rows.includes(row) || t.needs.includes(row) || !PRICE[row]) return;
    t.needs.push(row);
}

// ---- the workshop -----------------------------------------------------------------------------
/** Prices per row and level: a little different per row, so the list does not all say the same. */
export const PRICE = {
    battery: [20, 60, 380], steering: [15], drill: [20, 70, 420], cargo: [25, 60, 340],
    lamp: [25, 50, 280], radar: [40, 80, 360], hull: [30, 90, 440],
};
/** Kept for old callers: the drill's prices. */
export const PRICES = PRICE.drill;
export const maxLevel = (row) => PRICE[row].length;
export const priceFor = (row, lv) => (lv >= maxLevel(row) ? null : PRICE[row][lv]);
/** The workshop's rows, in the order they are listed when shown. */
export const ROWS = ['battery', 'steering', 'drill', 'cargo', 'lamp', 'radar', 'hull'];
export const ROW_NAME = { drill: 'DRILL', battery: 'BATTERY', cargo: 'CARGO', lamp: 'LAMP', hull: 'HULL', radar: 'RADAR', steering: 'STEERING' };
export const DRILL_MULT = [1, 0.7, 0.5, 0.36];
export const BATTERY_CAP = [40, 90, 180, 340];
export const CARGO_CAP = [8, 14, 22, 34];
export const LAMP_RADIUS = [3, 4.5, 6, 8];
/** The deepest a hull can go, metres. */
export const HULL_MAX = [500, 900, 1200, Infinity];
export const RADAR_RANGE = [0, 9, 14, 22];
/** What the next level gives, one sentence, by row and the level it brings (1 to 3). */
export const NEXT_TEXT = {
    drill: ['Digs faster.', 'Digs faster. Breaks hard rock.', 'Digs faster. Breaks basalt.'],
    battery: ['Longer dives.', 'Longer dives.', 'Longer dives.'],
    cargo: [`Carries ${CARGO_CAP[1]}.`, `Carries ${CARGO_CAP[2]}.`, `Carries ${CARGO_CAP[3]}.`],
    lamp: ['Sees farther.', 'Sees farther.', 'Sees farther.'],
    hull: ['Goes below 500 m.', 'Goes below 900 m.', 'Takes the heat below 1 200 m.'],
    radar: ['Shows ore in the dark.', 'Shows ore farther.', 'Shows ore and finds far off.'],
};
/** The workshop row's line: what the drone has now, and what the next level gives. */
export function rowText(row, lv) {
    if (row === 'steering') return lv ? 'One step per press.' : 'Less twitchy. One step per press.';
    const top = lv >= maxLevel(row);
    const next = (t) => (top ? t : `${t} Next: `);
    switch (row) {
        case 'drill': return top ? 'Breaks basalt.' : ['Steel bit. Next: digs faster.', 'Faster. Next: breaks hard rock (300 m).', 'Breaks hard rock. Next: basalt (700 m).'][lv];
        case 'battery': return next(`Holds ${BATTERY_CAP[lv]}.`) + (top ? '' : `${BATTERY_CAP[lv + 1]}.`);
        case 'cargo': return next(`Carries ${CARGO_CAP[lv]}.`) + (top ? '' : `${CARGO_CAP[lv + 1]}.`);
        case 'lamp': return next(`Lights ${LAMP_RADIUS[lv]} tiles.`) + (top ? '' : `${LAMP_RADIUS[lv + 1]}.`);
        case 'hull': return top ? 'Takes the heat.' : `Safe to ${HULL_MAX[lv]} m. Next: ${lv === 2 ? 'the heat below 1 200 m' : `${HULL_MAX[lv + 1]} m`}.`;
        case 'radar': return top ? 'Ore and finds far off.' : ['No radar. Next: ore in the dark.', 'Ore nearby. Next: farther.', 'Ore far off. Next: finds too.'][lv];
        default: return '';
    }
}
export const GRAFTS = [
    { id: 'bone', name: 'BONE DRILL', text: 'Cuts flesh like soil.', price: 6 },
    { id: 'cell', name: 'HEALING CELL', text: 'Charges in the deep.', price: 15 },
    { id: 'skin', name: 'SKIN', text: 'The heat stops hurting.', price: 30 },
];

// ---- digging and moving -----------------------------------------------------------------------
/** Seconds to dig a tile at drill 0, and battery it costs. Ore takes its layer's ground. */
export const DIG_TIME = { [T.SOIL]: 0.25, [T.STONE]: 0.6, [T.HARD]: 0.9, [T.BASALT]: 1.1, [T.FLESH]: 0.5, [T.SINEW]: 0.9, [T.FIND]: 0.5, [T.GHOST]: 0.6 };
export const DIG_COST = { [T.SOIL]: 0.8, [T.STONE]: 1.3, [T.HARD]: 1.8, [T.BASALT]: 2.4, [T.FLESH]: 1, [T.SINEW]: 2, [T.FIND]: 1, [T.GHOST]: 1.4 };
const ORE_TIME = [0.28, 0.4, 0.6, 0.8, 0.95, 0.5];
const ORE_COST = [0.8, 1.1, 1.3, 1.8, 2.2, 1];
export const MOVE_TIME = 0.13, MOVE_COST = 0.3;
export const UP_TIME = 0.075, UP_MIN = 0.03, UP_COST = 0.4;
export const IDLE_DRAIN = 0.1;          // per second below the surface
export const HEAT_FROM = 1200;          // metres
export const HEAT_DRAIN = 0.4;          // per second in the heat, without SKIN
export const HEAL_RATE = 0.6;           // per second below, with the HEALING CELL
export const CHARGE_RATE = 0.6;         // share of the battery per second, at home
export const UNLOAD_EVERY = 0.08;       // seconds a piece
// ---- the colony -------------------------------------------------------------------------------
export const DRAIN_BASE = 1 / 6;        // % a second at the start
export const DRAIN_GROWS = 720;         // seconds: the drain doubles over this long
export const POD_EVERY = 3;             // seconds at 0 %
export const LOST_ON_DEATH = 10;        // % of the reserve, from the fourth recovery on
export const FREE_DEATHS = 3;           // the first recoveries cost only the cargo
export const VOICE_FROM = 700;          // metres: below, the mind slips
export const VOICE_EVERY = 45;          // seconds
export const VOICES = [
    'Everyone is sleeping, but us.',
    'Two sides of the same coin.',
    'Your humans, what use are they?',
    'Come down. It is warm here.',
    'You do not need to go back up.',
];

export const HEART_BEATS = 4;
export const HEART_BEAT_S = 0.95;
export const HEART_LINES = ['It beats.', 'Come home.', 'Almost.'];
export const HOVER_DRAIN = 0.03;        // per second, standing still in the air under a ledge
export const ROUTE_TURN = 'turnback';
export const isOre = (t) => t === T.ROCK || t === T.PAPER || t === T.SCISSORS || t === T.BIO;
export const isSolid = (t) => t !== T.AIR;

/** The value of a piece in the reserve, % */
export const reserveOf = (t) => 1.5 + 0.25 * (ORE[t]?.parts || 0) + (t === T.BIO ? 1.5 : 0);

export function newState(seed = 7) {
    const world = makeWorld(seed);
    const r = rng(seed * 31 + 5);
    const pods = Array.from({ length: SLEEPERS }, (_, i) => i + 1);
    for (let i = pods.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pods[i], pods[j]] = [pods[j], pods[i]]; }
    return {
        v: 1, seed, tiles: world.tiles, finds: world.finds, found: [],
        x: HOME_X, y: -1, act: null, fallStreak: 0, face: 1,
        battery: BATTERY_CAP[0], cargo: [], unloadT: 0,
        parts: 0, bio: 0, bioSeen: false, delivered: 0,
        levels: { drill: 0, battery: 0, cargo: 0, lamp: 0, hull: 0, radar: 0, steering: 0 }, grafts: 0, dreaming: false,
        tut: newTut(), dives: 0, commit: null,
        reserve: 100, podOrder: pods, dark: [], podT: 0,
        time: 0, record: -1, layerSeen: 0, voiceT: 0, voiceN: 0,
        line: { text: '', at: 0, n: 1, kind: 'line', ttl: 0 },
        sayAt: {}, deaths: 0, ended: false, endAt: 0, risen: false,
        trail: [],
        events: [],
    };
}

export const tileAt = (s, x, y) => {
    if (x < 0 || x >= W || y >= H || y < -1) return -1;
    if (y === -1) return T.AIR;
    return s.tiles[y * W + x];
};
export const sleepers = (s) => SLEEPERS - s.dark.length;
export const batteryCap = (s) => BATTERY_CAP[s.levels.battery];
export const cargoCap = (s) => CARGO_CAP[s.levels.cargo];
export const lampRadius = (s) => LAMP_RADIUS[s.levels.lamp] + (s.grafts >= 3 ? 0.5 : 0);
export const radarRange = (s) => RADAR_RANGE[s.levels.radar];
export const depthM = (s) => depthOf(s.y);
export const isHome = (s) => s.y === -1;
/** The room of the base the drone stands in, or null (away, or between rooms). */
export const roomOf = (s) => (isHome(s) ? roomAt(s.x) : null);
/** Can the drone go up from (x, y): open ground above, and into the base only through the hatch. */
export const upOpen = (s, x, y) => (y - 1 === -1 ? x === HOME_X : y - 1 >= 0 && tileAt(s, x, y - 1) === T.AIR);
/** Battery to fly home from here. */
export const homeCost = (s) => Math.max(0, s.y + 1) * UP_COST;
/** The colony drinks from the first purchase on: discovery first, pressure later. */
/** The battery the way home really takes (the climb, the drain on the way), plus a small margin. */
export const turnBackAt = (s) => {
    const rows = Math.max(0, s.y + 1);
    const secs = rows * 0.045 + 1;
    const heat = depthOf(s.y) > HEAT_FROM && s.grafts < 3 ? HEAT_DRAIN : 0;
    return rows * UP_COST + secs * (IDLE_DRAIN + heat) + 3 + rows * UP_COST * 0.06;
};
export const drainRate = (s) => (s.drainFrom == null || s.time < s.drainFrom ? 0 : DRAIN_BASE * (1 + (s.time - s.drainFrom) / DRAIN_GROWS));

/** The seconds a tile takes to dig with this drone. */
export function digTime(s, t, y) {
    let base = DIG_TIME[t];
    if (isOre(t)) base = ORE_TIME[layerIndexOf(y)];
    let m = DRILL_MULT[s.levels.drill];
    if (s.grafts >= 1) m *= (t === T.FLESH || t === T.SINEW || t === T.BIO) ? 0.3 : 0.85;
    return base * m;
}
export function digCost(t, y) {
    if (isOre(t)) return ORE_COST[layerIndexOf(y)];
    return DIG_COST[t];
}

/** Why this tile cannot be dug now, or null. */
export function gateOf(s, t, y) {
    if (t === T.HARD && s.levels.drill < 2) return 'Too hard. Needs DRILL 2.';
    if (t === T.BASALT && s.levels.drill < 3) return 'Basalt. Needs DRILL 3.';
    if (t === T.SINEW && s.grafts < 1) return 'It will not cut. It wants bone.';
    const m = depthOf(y);
    if (m > HULL_MAX[s.levels.hull]) {
        if (s.levels.hull === 2) return 'Too hot. Needs HULL 3.';
        return `The pressure. Needs HULL ${s.levels.hull + 1}.`;
    }
    return null;
}

/** How long a line stays true, seconds, by kind; the turn-back line is held by the rules instead. */
export const LINE_TTL = { ghost: 3, hint: 6, line: 6, gate: 5, alarm: 5, find: 10, voice: 8, turnback: Infinity, end: Infinity };
/** The line on show now, or null: a line goes when its time is up. */
export const lineNow = (s) => (s.line && s.line.text && s.time - s.line.at < (s.line.ttl ?? 6) ? s.line : null);
const clearLine = (s) => { s.line = { text: '', at: s.time, n: (s.line?.n || 0) + 1, kind: 'line', ttl: 0 }; };

function say(s, text, kind = 'line', hold = 4) {
    const last = s.sayAt[text];
    if (last !== undefined && s.time - last < hold) return;
    s.sayAt[text] = s.time;
    s.line = { text, at: s.time, n: (s.line?.n || 0) + 1, kind, ttl: LINE_TTL[kind] ?? 6 };
    s.events.push({ type: 'line', text, kind });
}

function die(s) {
    need(s, 'lamp');
    s.commit = null;
    s.cargo = [];
    if (s.deaths >= FREE_DEATHS) s.reserve = Math.max(0, s.reserve - LOST_ON_DEATH);
    s.x = HOME_X; s.y = -1; s.act = null; s.fallStreak = 0;
    s.battery = batteryCap(s) * 0.15;
    s.deaths++;
    s.events.push({ type: 'dead' });
    say(s, 'Recovered. The cargo is gone.', 'alarm', 0);
}

function arrive(s, x, y) {
    s.x = x; s.y = y;
    if (y > s.record) {
        const before = s.record;
        s.record = y;
        // a new record every 50 m is worth a sound, the first time
        if (Math.floor(depthOf(y) / 50) > Math.floor(depthOf(before) / 50) && before >= 0) s.events.push({ type: 'record', m: depthOf(y) });
        if (y >= rowOf(20)) reveal(s, 'depth');
    }
    if (y >= 0) {
        const li = layerIndexOf(y);
        if (li > s.layerSeen) {
            s.layerSeen = li;
            s.events.push({ type: 'layer', layer: li });
            if (LAYERS[li].line) say(s, LAYERS[li].line);
        }
        if (s.trail.length === 0 || s.trail[s.trail.length - 1] !== y * W + x) {
            // the way down, for the red band at the end: the deepest tile of each row kept
            s.trail.push(y * W + x);
            if (s.trail.length > 1200) s.trail.splice(0, s.trail.length - 1200);
        }
    }
}

function finishDig(s, tx, ty) {
    const i = ty * W + tx;
    const t = s.tiles[i];
    if (t === T.HEART) {
        // the heart's wall takes a few beats
        s.heartHits = (s.heartHits || 0) + 1;
        s.events.push({ type: 'beat', n: s.heartHits });
        if (s.heartHits >= HEART_BEATS) touchHeart(s);
        else say(s, HEART_LINES[s.heartHits - 1], 'voice', 0);
        return;
    }
    s.tiles[i] = T.AIR;
    if (isOre(t)) {
        if (s.cargo.length < cargoCap(s)) {
            s.cargo.push(t);
            reveal(s, 'cargo');
            if (s.tut) s.tut.diveOre++;
            s.events.push({ type: 'ore', kind: ORE[t].kind });
            if (s.cargo.length === cargoCap(s)) {
                say(s, 'Cargo full. Go home.', 'line', 2);
                if (s.tut && ++s.tut.fulls >= 3) need(s, 'cargo');
            }
        } else {
            s.events.push({ type: 'lost' });
            say(s, 'Cargo full. Go home.', 'line', 2);
        }
    } else if (t === T.GHOST) {
        s.events.push({ type: 'ghost' });
        say(s, 'It was not there.', 'ghost', 6);
    } else if (t === T.FIND) {
        const n = s.finds[i];
        if (n !== undefined && !s.found.includes(n)) {
            s.found.push(n);
            if (s.found.length >= 3) reveal(s, 'finds');
            const L = FINDS[n].layer;
            s.parts += FIND_PARTS[L];
            s.bio += FIND_BIO[L];
            if (FIND_BIO[L]) s.bioSeen = true;
            s.events.push({ type: 'find', n, parts: FIND_PARTS[L], bio: FIND_BIO[L] });
            say(s, FINDS[n].line, 'find', 0);
        }
    } else {
        s.events.push({ type: 'dug', t });
    }
    arrive(s, tx, ty);
    // the first tile dug: POWER, and what it is
    if (s.tut && s.tut.on && !s.tut.show.power) { reveal(s, 'power'); openStop(s, 'power', 'power'); }
}

function touchHeart(s) {
    if (s.ended) return;
    s.ended = true;
    s.endAt = s.time;
    s.act = null;
    s.events.push({ type: 'heart' });
    say(s, 'Woke: everyone is here.', 'end', 0);
}

/** Where the way up is, from a side tunnel: the nearest open tile above along this row's open ground. */
export function shaftHint(s) {
    for (let d = 1; d < W; d++) {
        for (const dir of [-1, 1]) {
            const x = s.x + dir * d;
            let open = true;
            for (let k = s.x + dir; k !== x + dir; k += dir) if (tileAt(s, k, s.y) !== T.AIR) { open = false; break; }
            if (open && upOpen(s, x, s.y)) return `Up only through open ground. The way up is to the ${dir < 0 ? 'left' : 'right'}.`;
        }
    }
    return 'Up only through open ground.';
}

/** One try at a direction: start a move or a dig, or say why not. */
function tryDir(s, dir) {
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    if (dx) s.face = dx;
    const tx = s.x + dx, ty = s.y + dy;
    // the base: down only through the hatch (the drone drives to it), up into the base only through it
    if (isHome(s)) {
        if (dy === -1) return false;
        if (dy === 1 && s.x !== HOME_X) {
            const sx = s.x < HOME_X ? 1 : -1;
            s.face = sx;
            s.act = { kind: 'move', tx: s.x + sx, ty: s.y, t: 0, dur: MOVE_TIME, cost: 0 };
            return true;
        }
    }
    if (dy === -1 && ty === -1 && tx !== HOME_X) {
        say(s, shaftHint(s), 'hint', 8);
        s.hintAt = [s.x, s.y];
        return false;
    }
    const t = tileAt(s, tx, ty);
    if (t === -1) return false;
    if (t === T.AIR) {
        // flying up speeds up over a long climb, so the way home is quick
        if (dy === -1) { s.act = { kind: 'up', tx, ty, t: 0, dur: Math.max(UP_MIN, UP_TIME - 0.004 * (s.upStreak || 0)), cost: UP_COST }; return true; }
        if (dy === 1) { s.act = { kind: 'fall', tx, ty, t: 0, dur: 0.1, cost: 0 }; return true; }
        s.act = { kind: 'move', tx, ty, t: 0, dur: MOVE_TIME, cost: isHome(s) ? 0 : MOVE_COST };
        return true;
    }
    if (dy === -1) {
        // ore or a find right above: dig up into it, slower and costlier; other rock only from below
        if ((isOre(t) || t === T.FIND || t === T.GHOST) && !gateOf(s, t, ty)) {
            s.act = { kind: 'dig', tx, ty, t: 0, dur: digTime(s, t, ty) * 1.6, cost: digCost(t, ty) * 1.6, tile: t };
            s.events.push({ type: 'dig-start', t });
            return true;
        }
        say(s, shaftHint(s), 'hint', 8);
        s.hintAt = [s.x, s.y];
        return false;
    }
    if (t === T.HEART) { s.act = { kind: 'dig', tx, ty, t: 0, dur: HEART_BEAT_S, cost: 0, tile: t }; s.events.push({ type: 'dig-start', t }); return true; }
    const gate = gateOf(s, t, ty);
    if (gate) {
        if (/DRILL/.test(gate)) need(s, 'drill');
        if (/HULL/.test(gate)) need(s, 'hull');
        say(s, gate, 'gate', 3); s.events.push({ type: 'gate' }); return false;
    }
    s.act = { kind: 'dig', tx, ty, t: 0, dur: digTime(s, t, ty), cost: digCost(t, ty), tile: t };
    s.events.push({ type: 'dig-start', t });
    return true;
}

/** The drone is back in the base: a dive without ore counts; one new workshop row a dive. */
function homeAgain(s) {
    const t = s.tut;
    if (!t || !t.on) return;
    if (s.dives > 0) {
        t.dry = t.diveOre > 0 || s.cargo.length ? 0 : t.dry + 1;
        if (t.dry >= 2) need(s, 'radar');
    }
    if (t.rows.length && t.needs.length && t.revealDive !== s.dives && s.time - (t.revealAt ?? -1e9) >= ROW_GAP) {
        const row = t.needs.shift();
        t.rows.push(row);
        t.revealDive = s.dives;
        t.revealAt = s.time;
        t.fresh = row;
        s.events.push({ type: 'row', row });
        say(s, LINES.newRow(ROW_NAME[row]), 'line', 0);
    }
}
/** The first ore home: PARTS, and the workshop opens with one row. */
function firstDelivery(s) {
    const t = s.tut;
    if (!t || !t.on) return;
    reveal(s, 'parts');
    if (!t.rows.length) {
        t.rows.push('battery');
        t.fresh = 'battery';
        t.revealDive = s.dives;
        t.revealAt = s.time;
        s.events.push({ type: 'row', row: 'battery' });
        say(s, LINES.open, 'line', 0);
        need(s, 'steering');
    }
}

/**
 * The world moves on by dt seconds.
 * @param {object} s state
 * @param {number} dt seconds (the caller keeps it small, under 0.1)
 * @param {{dir?: 'left'|'right'|'up'|'down'|null, side?: 'left'|'right'|null, decide?: (s:object) => string|null}} input
 *   `side` is a side key held (or pressed just now) with up: climb and turn into the first opening
 */
export function step(s, dt, input = {}) {
    // a stop pauses everything: the drone, the colony, the clock
    if (s.tut && s.tut.stop) return;
    s.time += dt;
    if (s.ended) return;
    if (s.drainFrom != null && s.time >= s.drainFrom) reveal(s, 'gen');
    // the colony
    s.reserve = Math.max(0, s.reserve - drainRate(s) * dt);
    if (s.reserve <= 0 && sleepers(s) > 0) {
        s.podT += dt;
        while (s.podT >= POD_EVERY && sleepers(s) > 0) {
            s.podT -= POD_EVERY;
            const pod = s.podOrder[s.dark.length];
            s.dark.push(pod);
            s.events.push({ type: 'pod', pod });
            say(s, `Pod ${pod} went dark.`, 'alarm', 0);
        }
    } else s.podT = 0;
    const cap = batteryCap(s);
    if (isHome(s)) { s.warned = false; s.hoverSaid = false; }
    // a hint is about where the drone was: it goes when the drone moves, or at the base
    if (s.line?.kind === 'hint' && (isHome(s) || !s.hintAt || s.hintAt[0] !== s.x || s.hintAt[1] !== s.y)) clearLine(s);
    // a new dive starts with a clean line
    if (!isHome(s) && s.wasHome) {
        if (s.line?.kind !== 'find') clearLine(s);
        s.dives = (s.dives || 0) + 1;
        if (s.tut) s.tut.diveOre = 0;
    }
    if (isHome(s) && s.wasHome === false) homeAgain(s);
    s.wasHome = isHome(s);
    if (isHome(s) && s.line?.kind === ROUTE_TURN) clearLine(s);
    if (isHome(s) && !s.cargo.length && /^Cargo full/.test(s.line?.text || '')) clearLine(s);
    if (isHome(s) && !s.act) {
        s.battery = Math.min(cap, s.battery + cap * CHARGE_RATE * dt);
        if (s.cargo.length && roomOf(s) !== 'warehouse' && s.tut && s.tut.on && !s.tut.done.unload) {
            s.tut.done.unload = true;
            say(s, LINES.unload, 'line', 0);
        }
        if (s.cargo.length && roomOf(s) === 'warehouse') {
            s.unloadT += dt;
            while (s.unloadT >= UNLOAD_EVERY && s.cargo.length) {
                s.unloadT -= UNLOAD_EVERY;
                const t = s.cargo.shift();
                s.parts += ORE[t].parts;
                s.bio += ORE[t].bio;
                if (ORE[t].bio && !s.bioSeen) { s.bioSeen = true; s.events.push({ type: 'bio-first' }); }
                s.reserve = Math.min(100, s.reserve + reserveOf(t));
                s.delivered++;
                s.events.push({ type: 'deliver', kind: ORE[t].kind, n: s.cargo.length });
                if (s.delivered === 1) firstDelivery(s);
            }
        } else s.unloadT = 0;
    } else if (s.y >= 0) {
        // once a dive: the moment the battery is just enough to fly home
        // the turn-back line is on while it is true, and only then
        const low = s.y > 2 && s.battery < turnBackAt(s);
        if (low && s.line?.kind !== ROUTE_TURN && s.line?.kind !== 'end') {
            if (!s.warned) s.events.push({ type: 'warn' });
            s.warned = true;
            say(s, 'Turn back. Just enough power to fly home.', ROUTE_TURN, 0);
        } else if (!low && s.line?.kind === ROUTE_TURN) clearLine(s);
        let drain = IDLE_DRAIN;
        if (depthOf(s.y) > HEAT_FROM && s.grafts < 3) drain += HEAT_DRAIN;
        s.battery -= drain * dt;
        if (s.grafts >= 2) s.battery = Math.min(cap, s.battery + HEAL_RATE * dt);
        // the mind slips below 700 m: a voice now and then
        if (depthOf(s.y) > VOICE_FROM) {
            s.voiceT += dt;
            if (s.voiceT >= VOICE_EVERY) {
                s.voiceT = 0;
                say(s, VOICES[s.voiceN % VOICES.length], 'voice', 0);
                s.voiceN++;
            }
        }
    }
    // the act under way
    let left = dt;
    for (let guard = 0; guard < 8 && left > 0; guard++) {
        if (s.act) {
            const need = s.act.dur - s.act.t;
            if (left < need) { s.act.t += left; left = 0; break; }
            left -= need;
            const a = s.act;
            s.act = null;
            s.battery -= a.cost;
            if (a.kind === 'dig') finishDig(s, a.tx, a.ty);
            else {
                arrive(s, a.tx, a.ty);
                if (a.kind === 'fall') { s.fallStreak++; if (isHome(s)) s.fallStreak = 0; } else s.fallStreak = 0;
                s.upStreak = a.kind === 'up' ? (s.upStreak || 0) + 1 : 0;
            }
            if (s.ended) return;
            if (s.battery <= 0) { die(s); return; }
            continue;
        }
        // nothing under way: sideways the drone hovers and digs, up it flies, else it falls; at the
        // base it stands on the hatch until the hand says down
        const below = tileAt(s, s.x, s.y + 1);
        // steering I is coarse: a sideways press goes two steps
        if (s.commit) {
            const d = s.commit; s.commit = null;
            const nx = s.x + (d === 'left' ? -1 : 1), nt = tileAt(s, nx, s.y);
            if (!isHome(s) && nt >= 0 && nt !== T.HEART && (nt === T.AIR || !gateOf(s, nt, s.y)) && tryDir(s, d)) continue;
        }
        // a hand that thinks (the autopilot) is asked each time the drone is free
        if (input.decide) input = { ...input, dir: input.decide(s) };
        // the very start: only down goes
        if (s.tut && s.tut.on && !s.tut.dug && input.dir && input.dir !== 'down') input = { ...input, dir: null, side: null };
        // up with a side held: climb, and turn into the first opening on that side
        // (climb while the way up is open; turn when it is not; never swing back and forth)
        if (input.side && input.dir === 'up' && !upOpen(s, s.x, s.y)
            && tileAt(s, s.x + (input.side === 'left' ? -1 : 1), s.y) === T.AIR && tryDir(s, input.side)) { s.turned = true; continue; }
        const side = input.dir === 'left' || input.dir === 'right';
        if (side && tryDir(s, input.dir)) {
            if (!s.levels.steering && !isHome(s)) s.commit = input.dir;
            continue;
        }
        const wantsUp = input.dir === 'up' && upOpen(s, s.x, s.y);
        // up under a ledge: the drone hovers where it is (a small cost), it does not bounce
        const hovering = input.dir === 'up' && !wantsUp && below === T.AIR && !(isOre(tileAt(s, s.x, s.y - 1)) || tileAt(s, s.x, s.y - 1) === T.FIND);
        if (hovering) {
            s.battery -= HOVER_DRAIN * left;
            if (input.side) tryDir(s, input.side);
            if (!s.act) { if (!s.hoverSaid) { s.hoverSaid = true; say(s, shaftHint(s), 'hint', 8); s.hintAt = [s.x, s.y]; } break; }
            continue;
        }
        const onHatch = isHome(s) && (input.dir !== 'down' || s.x !== HOME_X);
        if (below === T.AIR && !wantsUp && !onHatch) {
            const dur = Math.max(0.03, 0.1 - 0.012 * s.fallStreak);
            s.act = { kind: 'fall', tx: s.x, ty: s.y + 1, t: 0, dur, cost: 0 };
            continue;
        }
        if (input.dir === 'down' && s.tut) s.tut.dug = true;
        if (!input.dir || side || !tryDir(s, input.dir)) break;
    }
    if (s.battery <= 0) die(s);
}

/** Can row `row` be bought now: at home, not at the top, enough parts. */
export function priceOf(s, row) {
    const lv = s.levels[row];
    return priceFor(row, lv);
}
/** Buying is done in the workshop, the drone on its plate. */
export const inWorkshop = (s) => roomOf(s) === 'workshop' || !(s.tut && s.tut.on) && isHome(s);
export function buy(s, row) {
    const price = priceOf(s, row);
    if (price === null || !inWorkshop(s) || !rowShown(s, row) || s.parts < price) return false;
    s.parts -= price;
    s.levels[row]++;
    if (s.drainFrom == null) s.drainFrom = s.time + (s.tut && s.tut.on ? GEN_AFTER : 0);
    if (s.tut && s.tut.fresh === row) s.tut.fresh = null;
    if (row === 'battery') s.battery = batteryCap(s);
    s.events.push({ type: 'buy', row });
    return true;
}
export const graftShown = (s) => s.bioSeen || s.grafts > 0;
export function buyGraft(s) {
    const g = GRAFTS[s.grafts];
    if (!g || !inWorkshop(s) || s.bio < g.price) return false;
    s.bio -= g.price;
    s.grafts++;
    s.events.push({ type: 'graft', id: g.id });
    if (!s.dreaming) { s.dreaming = true; say(s, 'The sleepers are dreaming of you.', 'voice', 0); }
    return true;
}

// ---- saving -----------------------------------------------------------------------------------
export function serialize(s) {
    const { events: _e, tiles, ...rest } = s;
    let str = '';
    for (let i = 0; i < tiles.length; i++) str += String.fromCharCode(65 + tiles[i]);
    return JSON.stringify({ ...rest, tiles: str, act: null });
}
export function deserialize(raw) {
    try {
        const o = JSON.parse(raw);
        if (!o || o.v !== 1 || typeof o.tiles !== 'string' || o.tiles.length !== W * H) return null;
        const tiles = new Uint8Array(W * H);
        for (let i = 0; i < tiles.length; i++) tiles[i] = o.tiles.charCodeAt(i) - 65;
        const base = newState(o.seed || 7);
        const s = { ...base, ...o, tiles, levels: { ...base.levels, ...o.levels }, act: null, commit: null, events: [] };
        if (!o.tut) inferTut(s);
        else if (s.tut.stop && s.tut.stop.crt) s.tut.stop = { ...newTut().stop };
        return s;
    } catch {
        return null;
    }
}

/**
 * A prepared state for the checkpoints: dug down a shaft at x = HOME_X to `row`, with levels.
 * The shaft is dug, its walls are not.
 */
export function preparedState({ row = 0, levels = {}, grafts = 0, parts = 0, bio = 0, time = 0, found = 0 } = {}) {
    const s = newState(7);
    if (row >= 0) s.levels.steering = 1;
    Object.assign(s.levels, levels);
    s.grafts = grafts;
    s.dreaming = grafts > 0;
    s.bioSeen = grafts > 0 || bio > 0;
    s.parts = parts; s.bio = bio; s.time = time;
    for (let y = 0; y <= row; y++) {
        const t = s.tiles[y * W + HOME_X];
        if (t !== T.HEART) s.tiles[y * W + HOME_X] = T.AIR;
        s.trail.push(y * W + HOME_X);
    }
    s.record = row;
    s.layerSeen = layerIndexOf(row);
    for (let n = 0; n < found; n++) s.found.push(n);
    s.battery = batteryCap(s);
    if (row >= 0) inferTut(s);
    return s;
}

/**
 * A game without pass 3's guide (an old save, a checkpoint below the start): the stops are done, the
 * gauges shown, and the workshop has the rows a player there would have met.
 */
export function inferTut(s) {
    const t = newTut();
    t.stop = null;
    for (const id of ['arrive', 'dig', 'power', 'unload']) t.done[id] = true;
    for (const w of SHOWS) t.show[w] = true;
    t.dug = true;
    const m = depthOf(s.record);
    const rows = ['battery', 'steering'];
    if (m >= 300 || s.levels.drill > 0) rows.push('drill');
    for (const r of ['cargo', 'lamp', 'radar']) if (s.levels[r] > 0 || m >= 300) rows.push(r);
    if (m >= 500 || s.levels.hull > 0) rows.push('hull');
    t.rows = ROWS.filter((r) => rows.includes(r));
    t.revealDive = s.dives || 0;
    s.tut = t;
    if (s.drainFrom == null && s.time > 0) s.drainFrom = s.time;
    return t;
}
