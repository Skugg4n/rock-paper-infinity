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

import { W, H, T, ORE, depthOf, layerIndexOf, LAYERS, FINDS, FIND_PARTS, FIND_BIO, makeWorld, rng } from './world.js';

export const SAVE_KEY = 'rpi-deep-dig';
export const SLEEPERS = 216;
export const HOME_X = 11;

// ---- the workshop -----------------------------------------------------------------------------
export const PRICES = [25, 90, 260];
export const ROWS = ['drill', 'battery', 'cargo', 'lamp', 'hull', 'radar'];
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
export const UP_TIME = 0.075, UP_COST = 0.6;
export const IDLE_DRAIN = 0.1;          // per second below the surface
export const HEAT_FROM = 1200;          // metres
export const HEAT_DRAIN = 0.8;          // per second in the heat, without SKIN
export const HEAL_RATE = 0.6;           // per second below, with the HEALING CELL
export const CHARGE_RATE = 0.6;         // share of the battery per second, at home
export const UNLOAD_EVERY = 0.08;       // seconds a piece
// ---- the colony -------------------------------------------------------------------------------
export const DRAIN_BASE = 1 / 6;        // % a second at the start
export const DRAIN_GROWS = 600;         // seconds: the drain doubles over this long
export const POD_EVERY = 3;             // seconds at 0 %
export const LOST_ON_DEATH = 10;        // % of the reserve
export const VOICE_FROM = 700;          // metres: below, the mind slips
export const VOICE_EVERY = 45;          // seconds
export const VOICES = [
    'Everyone is sleeping, but us.',
    'Two sides of the same coin.',
    'Your humans, what use are they?',
    'Come down. It is warm here.',
    'You do not need to go back up.',
];

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
        levels: { drill: 0, battery: 0, cargo: 0, lamp: 0, hull: 0, radar: 0 }, grafts: 0, dreaming: false,
        reserve: 100, podOrder: pods, dark: [], podT: 0,
        time: 0, record: -1, layerSeen: 0, voiceT: 0, voiceN: 0,
        line: { text: 'Dig down. Bring ore home.', at: 0, n: 1, kind: 'line' },
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
/** Battery to fly home from here. */
export const homeCost = (s) => Math.max(0, s.y + 1) * UP_COST;
export const drainRate = (s) => DRAIN_BASE * (1 + s.time / DRAIN_GROWS);

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

function say(s, text, kind = 'line', hold = 4) {
    const last = s.sayAt[text];
    if (last !== undefined && s.time - last < hold) return;
    s.sayAt[text] = s.time;
    s.line = { text, at: s.time, n: (s.line?.n || 0) + 1, kind };
    s.events.push({ type: 'line', text, kind });
}

function die(s) {
    s.cargo = [];
    s.reserve = Math.max(0, s.reserve - LOST_ON_DEATH);
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
    if (t === T.HEART) { touchHeart(s); return; }
    s.tiles[i] = T.AIR;
    if (isOre(t)) {
        if (s.cargo.length < cargoCap(s)) {
            s.cargo.push(t);
            s.events.push({ type: 'ore', kind: ORE[t].kind });
            if (s.cargo.length === cargoCap(s)) say(s, 'Cargo full. Go home.', 'line', 2);
        } else {
            s.events.push({ type: 'lost' });
            say(s, 'Cargo full. Go home.', 'line', 2);
        }
    } else if (t === T.GHOST) {
        s.events.push({ type: 'ghost' });
        say(s, 'It was not there.', 'voice', 6);
    } else if (t === T.FIND) {
        const n = s.finds[i];
        if (n !== undefined && !s.found.includes(n)) {
            s.found.push(n);
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
}

function touchHeart(s) {
    if (s.ended) return;
    s.ended = true;
    s.endAt = s.time;
    s.act = null;
    s.events.push({ type: 'heart' });
    say(s, 'Woke: everyone is here.', 'voice', 0);
}

/** One try at a direction: start a move or a dig, or say why not. */
function tryDir(s, dir) {
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    if (dx) s.face = dx;
    const tx = s.x + dx, ty = s.y + dy;
    const t = tileAt(s, tx, ty);
    if (t === -1) return false;
    if (t === T.AIR) {
        if (dy === -1) { s.act = { kind: 'up', tx, ty, t: 0, dur: UP_TIME, cost: UP_COST }; return true; }
        if (dy === 1) { s.act = { kind: 'fall', tx, ty, t: 0, dur: 0.1, cost: 0 }; return true; }
        s.act = { kind: 'move', tx, ty, t: 0, dur: MOVE_TIME, cost: MOVE_COST };
        return true;
    }
    if (dy === -1) { say(s, 'Up only through open ground.', 'line', 8); return false; }
    if (t === T.HEART) { touchHeart(s); return true; }
    const gate = gateOf(s, t, ty);
    if (gate) { say(s, gate, 'gate', 3); s.events.push({ type: 'gate' }); return false; }
    s.act = { kind: 'dig', tx, ty, t: 0, dur: digTime(s, t, ty), cost: digCost(t, ty), tile: t };
    s.events.push({ type: 'dig-start', t });
    return true;
}

/**
 * The world moves on by dt seconds.
 * @param {object} s state
 * @param {number} dt seconds (the caller keeps it small, under 0.1)
 * @param {{dir?: 'left'|'right'|'up'|'down'|null, decide?: (s:object) => string|null}} input
 */
export function step(s, dt, input = {}) {
    s.time += dt;
    if (s.ended) return;
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
    if (isHome(s) && !s.act) {
        s.battery = Math.min(cap, s.battery + cap * CHARGE_RATE * dt);
        if (s.cargo.length) {
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
            }
        } else s.unloadT = 0;
    } else if (s.y >= 0) {
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
            }
            if (s.ended) return;
            if (s.battery <= 0) { die(s); return; }
            continue;
        }
        // nothing under way: sideways the drone hovers and digs, up it flies, else it falls; at the
        // base it stands on the hatch until the hand says down
        const below = tileAt(s, s.x, s.y + 1);
        // a hand that thinks (the autopilot) is asked each time the drone is free
        if (input.decide) input = { ...input, dir: input.decide(s) };
        const side = input.dir === 'left' || input.dir === 'right';
        if (side && tryDir(s, input.dir)) continue;
        const wantsUp = input.dir === 'up' && tileAt(s, s.x, s.y - 1) === T.AIR;
        const onHatch = isHome(s) && input.dir !== 'down';
        if (below === T.AIR && !wantsUp && !onHatch) {
            const dur = Math.max(0.03, 0.1 - 0.012 * s.fallStreak);
            s.act = { kind: 'fall', tx: s.x, ty: s.y + 1, t: 0, dur, cost: 0 };
            continue;
        }
        if (!input.dir || side || !tryDir(s, input.dir)) break;
    }
    if (s.battery <= 0) die(s);
}

/** Can row `row` be bought now: at home, not at the top, enough parts. */
export function priceOf(s, row) {
    const lv = s.levels[row];
    return lv >= 3 ? null : PRICES[lv];
}
export function buy(s, row) {
    const price = priceOf(s, row);
    if (price === null || !isHome(s) || s.parts < price) return false;
    s.parts -= price;
    s.levels[row]++;
    if (row === 'battery') s.battery = batteryCap(s);
    s.events.push({ type: 'buy', row });
    return true;
}
export const graftShown = (s) => s.bioSeen || s.grafts > 0;
export function buyGraft(s) {
    const g = GRAFTS[s.grafts];
    if (!g || !isHome(s) || s.bio < g.price) return false;
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
        return { ...base, ...o, tiles, levels: { ...base.levels, ...o.levels }, act: null, events: [] };
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
    return s;
}
