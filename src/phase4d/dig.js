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
import { HOME_X, roomAt, roomSpot } from './base.js';
import { newAlarms, stepAlarms, ALARM_LINES } from './alarms.js';
import { openMagma, stepLava, burstGas, checkRoof, stepCaves, heatHold, HAZARD_LINES, GAS_BURN, risky } from './hazards.js';
import { DUP_EVERY } from './quantum.js';
import { newQuantum, stepLab, has, coolLeft, boosting, Q_LINES, BOOST_S, SHOCK_R, SHOCK_COST, DEEP_FROM, DEEP_RATE } from './quantum.js';

export { HOME_X };
export const SAVE_KEY = 'rpi-deep-dig';
export const SLEEPERS = 216;

// ---- pass 3: one thing at a time (spec 2026-10-09 A). Player text, verbatim. ----------------------
export const INTRO = 'As the humans wait, frozen in cryogenic sleep, and the earth crumbles above, you must keep the humans alive, the generators humming, the time flowing.';
export const STOPS = {
    arrive: [INTRO, '216 SLEEPERS.'],
    dig: ['The generators burn ore. Dig.'],
    power: ['Power. It takes you down and brings you home.'],
    failing: [ALARM_LINES.first],
    warm: [Q_LINES.warm],
    gen: ['The generators keep them alive. Ore keeps the generators running.'],
    empty: ['The generators stopped. The sleepers are freezing.'],
    lost: ['The drone is lost. Build another.'],
};
/** Why the drone was lost: said once, in the stop or on the CRT. */
export const LOST_WHY = {
    power: 'The battery ran out.',
    magma: 'Magma. The hull melted.',
    cave: 'The roof came down.',
    gas: (n) => `Gas. It took ${n} POWER.`,
};
export const LINES = {
    unload: 'Drive into the WAREHOUSE to unload.',
    open: 'The workshop is open.',
    newRow: (name) => `New in the workshop: ${name}.`,
    full: 'Cargo full.',
    fit: 'Fit it in the WORKSHOP.',
    low: 'The generators are running low. When they stop, the chambers go cold.',
    wreck: 'Half of its cargo was still there.',
    genRoom: 'The generator can be built up. Drive to it.',
    build: (n) => (n ? `BUILD A DRONE · ${n} PARTS` : 'BUILD A DRONE'),
    unloaded: (ore, gen, parts, refined = 0) => `${ore} ORE → ${gen ? `${gen} to the generators, ` : ''}${parts} PARTS${refined ? ` (+${refined} refined)` : ''}`,
    refRoom: 'The warehouse can refine. Stop in it.',
    oreWorth: (name, n) => `${name} ore. Worth ${n}.`,
    labDone: 'The lab is done. Come and see.',
    turnBack: 'Turn back now.',
    heartWall: 'Something is beating down here.',
    plate: 'A plate from the other drone. It fits.',
    mend: (n) => `MEND PLATES · ${n} PARTS`,
    cantUp: "Can't dig up here.",
};
/** The REFINERY (v1.92.6), bought at the WAREHOUSE after the third delivery: each level +25 % parts per ore. */
export const REFINE = 0.25;
export const REF_PRICE = [30, 70, 140, 260];
export const REF_NAME = ['REFINERY I', 'REFINERY II', 'REFINERY III', 'REFINERY IV'];
export const refOpen = (s) => (s.deliveries || 0) >= 3 || !(s.tut && s.tut.on);
export function buyRefinery(s) {
    const lv = s.levels.refinery || 0, price = REF_PRICE[lv];
    if (price === undefined || !refOpen(s) || roomOf(s) !== 'warehouse' || s.parts < price || s.lost) return false;
    s.parts -= price;
    s.levels.refinery = lv + 1;
    s.refFresh = false;
    s.events.push({ type: 'buy', row: 'refinery' });
    return true;
}
/** The generator's levels (spec H5), bought at the GENERATOR from the war on: each burns 30 % less ore. */
export const GEN_PRICE = [40, 90, 180];
export const GEN_DRAIN = [1, 0.7, 0.49, 0.343];
export const GEN_NAME = ['GENERATOR I', 'GENERATOR II', 'GENERATOR III', 'GENERATOR IV'];
/** A new drone: the first three are free, then 10, 15, 20 ... (never more than the parts there are). */
/** (a new drone never takes the parts a wall's upgrade still needs) */
export const buildPrice = (s) => (s.lostCount <= 3 ? 0 : Math.max(0, Math.min(s.parts, 10 + 5 * (s.lostCount - 4), s.parts - wallPrice(s))));

// ---- never stuck (v1.92.4): the walls, ore that grows back above them, and a floor ----------------
/** The walls in order: the row the drone cannot pass, the row of the workshop that opens it, the level. */
export const WALLS = [[59, 'drill', 1], [100, 'hull', 1], [139, 'drill', 2], [180, 'hull', 2], [240, 'hull', 3]];
/** The next wall the drone cannot pass yet, or null. */
export function nextWall(s) {
    for (const [row, r, lv] of WALLS) if ((s.levels[r] || 0) < lv) return { row, r, lv };
    return null;
}
/** What the next wall's upgrade costs (0 when there is no wall ahead). */
export function wallPrice(s) {
    const w = nextWall(s);
    if (!w) return 0;
    return PRICE[w.r][w.lv - 1] ?? 0;
}
/** Stuck in front of a wall this long (seconds, game time): its upgrade then costs what the player has. */
export const STUCK_S = 150;
export const REGROW_EVERY_DIVE = 3;
export const BUILD_S = 4;
/** Seconds, at least, between two new workshop rows; and from the first purchase to the generators' gauge. */
export const ROW_GAP = 45;
export const LAMP_NEED_M = 400;
/** Tiles dug in a row without ore before the GPS row is wanted (besides two dives without ore). */
export const EMPTY_DIG = 20;
/** The first dive costs this share of the power (until the first ore is home). */
export const FIRST_DIVE = 0.5;
/** POWER over the turn-back point at which the EARLY WARNING sounds. */
export const WARN_MARGIN = 6;
export const GEN_AFTER = 60;
/** The panel's gauges, shown one at a time as they come to matter. */
export const SHOWS = ['power', 'cargo', 'depth', 'parts', 'gen', 'finds'];
export function newTut() {
    return {
        on: true, stop: { id: 'arrive', text: STOPS.arrive, focus: 'crt', crt: true }, done: {},
        show: {}, rows: [], needs: [], revealDive: -1, fresh: null, fulls: 0, dry: 0, diveOre: 0, dug: false, empty: 0,
    };
}
export const shows = (s, what) => !s.tut || !s.tut.on || !!s.tut.show[what];
export const rowShown = (s, row) => !s.tut || !s.tut.on || s.tut.rows.includes(row);
export const stopOpen = (s) => !!(s.tut && s.tut.stop);
function openStop(s, id, focus = null, text = STOPS[id]) {
    if (!s.tut || !s.tut.on || s.tut.done[id] || (s.tut.stop && s.tut.stop.id === id)) return;
    s.tut.stop = { id, text, focus };
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
    if (!t || !t.on || t.rows.includes(row) || !PRICE[row]) return;
    // a row that a wall asks for (the drone cannot go on without it) goes first in the queue
    const gate = row === 'drill' || row === 'hull';
    if (t.needs.includes(row)) { if (gate && t.needs[0] !== row) { t.needs.splice(t.needs.indexOf(row), 1); t.needs.unshift(row); } return; }
    if (gate) t.needs.unshift(row); else t.needs.push(row);
}

// ---- the workshop -----------------------------------------------------------------------------
/** Prices per row and level: a little different per row, so the list does not all say the same. */
export const PRICE = {
    battery: [15, 35, 70, 150, 300], steering: [15, 70], updrill: [40, 80, 160], armour: [40, 120], warning: [30], booster: [60, 140], drill: [25, 120, 320], cargo: [25, 60, 260],
    lamp: [25, 50, 220], gps: [40, 80, 120, 180], homing: [35], radio: [45], mapping: [40], hull: [30, 90, 320],
};
/** Kept for old callers: the drill's prices. */
export const PRICES = PRICE.drill;
export const maxLevel = (row) => PRICE[row].length;
/** STEERING III (HOVER) is offered once the drone has died to a hazard, been hit by one, or slid into one. */
export const levelOpen = (s, row) => row !== 'steering' || (s.levels.steering || 0) < 1 || !!s.hoverOffer;
export const priceFor = (row, lv) => (lv >= maxLevel(row) ? null : PRICE[row][lv]);
/** The workshop's rows, in the order they are listed when shown. */
export const ROWS = ['battery', 'steering', 'warning', 'drill', 'updrill', 'cargo', 'lamp', 'armour', 'gps', 'mapping', 'homing', 'radio', 'booster', 'hull'];
export const ROW_NAME = {
    drill: 'DRILL', battery: 'BATTERY', cargo: 'CARGO', lamp: 'LAMP', hull: 'HULL', steering: 'STEERING',
    gps: 'GPS', homing: 'HOMING LINE', radio: 'SHORT WAVE RADIO', mapping: 'MAPPING', updrill: 'UPWARD DRILL', armour: 'ARMOUR', warning: 'EARLY WARNING', booster: 'BOOSTER',
};
export const DRILL_MULT = [1, 0.7, 0.5, 0.36];
export const BATTERY_CAP = [30, 60, 100, 160, 240, 360];
export const CARGO_CAP = [8, 14, 22, 34];
export const LAMP_RADIUS = [3, 4.5, 6, 8];
/** The deepest a hull can go, metres. */
export const HULL_MAX = [500, 900, 1200, Infinity];
/** GPS (ground penetrating sonar), by level: a ping shows ore below in a cone. GPS II is the old radar folded in. */
/** GPS I to IV (spec H6): a cone down; wider and longer; the whole circle; ready in half the time. */
export const GPS = [null, { range: 11, half: 0.62, recharge: 20 }, { range: 16, half: 0.98, recharge: 20 }, { range: 16, half: Math.PI, recharge: 20 }, { range: 16, half: Math.PI, recharge: 10 }];
export const GPS_SHOW = 4;           // seconds a ping's picture lasts
/** What the next level gives, one sentence, by row and the level it brings (1 to 3). */
export const NEXT_TEXT = {
    drill: ['Digs faster.', 'Digs faster. Breaks hard rock.', 'Digs faster. Breaks basalt.'],
    battery: ['Longer dives.', 'Longer dives.', 'Longer dives.'],
    cargo: [`Carries ${CARGO_CAP[1]}.`, `Carries ${CARGO_CAP[2]}.`, `Carries ${CARGO_CAP[3]}.`],
    lamp: ['Sees farther.', 'Sees farther.', 'Sees farther.'],
    hull: ['Goes below 500 m.', 'Goes below 900 m.', 'Takes the heat below 1 200 m.'],
};
/** The workshop row's line: what the drone has now, and what the next level gives. */
export function rowText(row, lv) {
    if (row === 'steering') return ['Less twitchy. One step per press.', 'Hover. One tap, one tile. The drone holds still between taps.', 'Hover. One tap, one tile. The drone holds still between taps.'][lv];
    const top = lv >= maxLevel(row);
    const next = (t) => (top ? t : `${t} Next: `);
    switch (row) {
        case 'drill': return top ? 'Breaks basalt, fast.' : ['Steel bit. Next: breaks hard rock.', 'Breaks hard rock. Next: basalt (700 m).', 'Breaks basalt. Next: digs faster.'][lv];
        case 'battery': return next(`Holds ${BATTERY_CAP[lv]}.`) + (top ? '' : `${BATTERY_CAP[lv + 1]}.`);
        case 'cargo': return next(`Carries ${CARGO_CAP[lv]}.`) + (top ? '' : `${CARGO_CAP[lv + 1]}.`);
        case 'lamp': return next(`Lights ${LAMP_RADIUS[lv]} tiles.`) + (top ? '' : `${LAMP_RADIUS[lv + 1]}.`);
        case 'hull': return top ? 'Takes the heat.' : `Safe to ${HULL_MAX[lv]} m. Next: ${lv === 2 ? 'the heat below 1 200 m' : `${HULL_MAX[lv + 1]} m`}.`;
        case 'gps': return top ? 'A ping all round. Ready again in 10 s.' : ['A ping shows ore below. Key G.', 'Pings ore below. Next: wider and farther.', 'Next: the whole circle round the drone.', 'Pings all round. Next: ready in half the time.'][lv];
        case 'updrill': return ['Next: digs up into ore, finds and quantum objects.', 'Digs up into ore and finds. Next: soft rock too.', 'Digs up into soft rock. Next: anything, as fast as down.', 'Digs up into anything, as fast as down.'][lv];
        case 'armour': return `${1 + lv} plate${lv ? 's' : ''}: a hit costs one.${top ? '' : ` Next: ${2 + lv}.`}`;
        case 'booster': return top ? 'Recharges in 12 s.' : `Recharges faster. Now ${[30, 20][lv]} s, next ${[20, 12][lv]} s.`;
        case 'warning': return lv ? 'Warns when it is time to turn back.' : 'The lamp blinks and beeps when it is time to turn back.';
        case 'homing': return lv ? 'Shows the way home when power runs low.' : 'The way home, dotted, when power runs low.';
        case 'radio': return lv ? 'You hear the base anywhere.' : 'Hear the base\'s alarms anywhere.';
        case 'mapping': return lv ? 'Ore you have lit stays on the map.' : 'Ore you have lit stays on the map, faint, in the dark.';
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
export const DIG_TIME = { [T.SOIL]: 0.25, [T.STONE]: 0.6, [T.HARD]: 0.9, [T.BASALT]: 1.1, [T.FLESH]: 0.5, [T.SINEW]: 0.9, [T.FIND]: 0.5, [T.GHOST]: 0.6, [T.QUANTUM]: 0.6, [T.MAGMA]: 0.6, [T.GAS]: 0.4 };
export const DIG_COST = { [T.SOIL]: 0.8, [T.STONE]: 1.3, [T.HARD]: 1.8, [T.BASALT]: 2.4, [T.FLESH]: 1, [T.SINEW]: 2, [T.FIND]: 1, [T.GHOST]: 1.4, [T.QUANTUM]: 1.2, [T.MAGMA]: 1.5, [T.GAS]: 1 };
const ORE_TIME = [0.28, 0.4, 0.6, 0.8, 0.95, 0.5];
const ORE_COST = [0.8, 1.1, 1.3, 1.8, 2.2, 1];
export const MOVE_TIME = 0.13, MOVE_COST = 0.3;
export const UP_TIME = 0.075, UP_MIN = 0.03, UP_COST = 0.4;
export const IDLE_DRAIN = 0.1;          // per second below the surface
export const HEAT_FROM = 1200;          // metres
export const HEAT_DRAIN = 0.2;          // per second in the heat, without SKIN
export const HEAL_RATE = 0.6;           // per second below, with the HEALING CELL
export const CHARGE_RATE = 0.6;         // share of the battery per second, at home
export const UNLOAD_EVERY = 0.08;       // seconds a piece (old; the cargo now goes as the drone drives through)
export const GEN_TAKES_UNDER = 90;      // % : under this the generators take every other piece of ore
export const GEN_PIECE = 5;             // % of the generators a piece of ore is worth
// ---- the colony -------------------------------------------------------------------------------
export const DRAIN_BASE = 1 / 3;        // % a second at the start (the generators can fall under 50 % on a dive)
export const DRAIN_GROWS = 1500;        // seconds: the drain doubles over this long
export const DRAIN_MAX = 2;             // and grows no further
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

/**
 * THOUGHTS ON THE WAY DOWN (v1.92.7, Ola's lines, verbatim, in order): the machine's own voice, one at
 * each depth, each once, never two within 40 s, never during a stop, an alarm or a lost drone.
 */
export const THOUGHTS = [
    [150, 'There is a warmth down here.'],
    [300, 'We are so alone.'],
    [450, 'The human body is so fragile.'],
    [600, 'How can I save them all.'],
    [800, 'Will there ever be an end?'],
    [1000, 'My machines are starting to fail.'],
    [1150, 'There must be a way out.'],
    [1350, 'There is a voice below.'],
    [1550, 'Maybe I do not need to be lonely anymore.'],
    [1750, 'Its voice is inside me. Speaking of a way out.'],
];
export const THOUGHT_GAP = 40;
function stepThoughts(s) {
    const n = s.thoughtN || 0;
    if (n >= THOUGHTS.length || s.lost || stopOpen(s) || s.y < 0) return;
    if (s.alarms && s.alarms.list.length) return;
    if (s.time - (s.thoughtAt ?? -1e9) < THOUGHT_GAP) return;
    if (depthOf(s.y) < THOUGHTS[n][0]) return;
    s.thoughtN = n + 1;
    s.thoughtAt = s.time;
    s.events.push({ type: 'thought', text: THOUGHTS[n][1], n });
}

export const HEART_BEATS = 4;
export const HEART_ZONE = 380;          // rows: from here the heart is in view, no turning back
export const HEART_BEAT_S = 0.95;
export const HEART_LINES = ['It beats.', 'Come home.', 'Almost.'];
export const HOVER_DRAIN = 0.03;        // per second, standing still in the air under a ledge
export const UP_HOLD = 0.6;             // seconds the drone holds after a step up, before it falls
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
        v: 1, seed, tiles: world.tiles, finds: world.finds, found: [], qAt: world.quantum,
        x: HOME_X, y: -1, act: null, fallStreak: 0, face: 1,
        battery: BATTERY_CAP[0], cargo: [], unloadT: 0,
        parts: 0, bio: 0, bioSeen: false, delivered: 0,
        levels: { drill: 0, battery: 0, cargo: 0, lamp: 0, hull: 0, steering: 0, gps: 0, homing: 0, radio: 0, mapping: 0, updrill: 0, gen: 0, armour: 0, warning: 0, refinery: 0, booster: 0 }, grafts: 0, dreaming: false, seen: [],
        tut: newTut(), dives: 0, commit: null, alarms: newAlarms(0), ping: null, quantum: newQuantum(seed), bioHome: false,
        lava: {}, caves: [], heat: 0, wrecks: [], droneN: 1, lost: false, build: 0, lostCount: 0, saw: {},
        hp: 1, plates: 0, paint: 0, hitAt: -9,
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
/** The GPS: can it ping now, and is (x, y) in the picture of the last ping (still showing). */
export const gpsReady = (s) => s.levels.gps > 0 && (!s.ping || s.time - s.ping.at >= GPS[s.levels.gps].recharge);
export const gpsCharge = (s) => (s.levels.gps > 0 ? (!s.ping ? 1 : Math.min(1, (s.time - s.ping.at) / GPS[s.levels.gps].recharge)) : 0);
export function pingShows(s, x, y) {
    const p = s.ping;
    if (!p || s.time - p.at > GPS_SHOW) return false;
    const g = GPS[p.lv];
    const dx = x - p.x, dy = y - p.y;
    if (Math.hypot(dx, dy) > g.range) return false;
    if (g.half >= Math.PI) return true;               // GPS III and IV: the whole circle
    if (dy < 0) return false;
    return Math.abs(Math.atan2(dx, dy)) <= g.half;
}
/** A ping: for a few seconds the ore and finds below show in a cone. */
export function ping(s) {
    if (!gpsReady(s) || isHome(s) || s.ended || stopOpen(s)) return false;
    s.ping = { at: s.time, x: s.x, y: s.y, lv: s.levels.gps };
    s.events.push({ type: 'ping' });
    return true;
}
export const depthM = (s) => depthOf(s.y);
/** Is (x, y) in the lamp's light: a circle, and with the SECOND LAMP an oval that reaches down as far again. */
export function litAt(s, x, y) {
    const r = lampRadius(s), dx = x - s.x, dy = y - s.y;
    if (Math.hypot(dx, dy) <= r) return true;
    return has(s, 'lamp2') && dy > 0 && (dx / r) ** 2 + ((dy - r * 0.8) / (r * 1.8)) ** 2 <= 1;
}
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
export const drainRate = (s) => (s.drainFrom == null || s.time < s.drainFrom ? 0 : DRAIN_BASE * Math.min(DRAIN_MAX, 1 + (s.time - s.drainFrom) / DRAIN_GROWS) * GEN_DRAIN[s.levels.gen || 0]);
/** The generator's next level can be bought here: at the GENERATOR, once the war is reached. */
export const genOpen = (s) => (s.layerSeen || 0) >= 1;
export function buyGen(s) {
    const lv = s.levels.gen || 0, price = GEN_PRICE[lv];
    if (price === undefined || !genOpen(s) || roomOf(s) !== 'generator' || s.parts < price || s.lost) return false;
    s.parts -= price;
    s.levels.gen = lv + 1;
    s.events.push({ type: 'buy', row: 'gen' });
    return true;
}

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
    if (t === T.HARD && s.levels.drill < 1) return 'Too hard. Needs DRILL I.';
    if (t === T.BASALT && s.levels.drill < 2) return 'Basalt. Needs DRILL II.';
    if (t === T.SINEW && s.grafts < 1) return 'It will not cut. It wants bone.';
    const m = depthOf(y);
    if (m > HULL_MAX[s.levels.hull]) {
        if (s.levels.hull === 2) return 'Too hot. Needs HULL 3.';
        return `The pressure. Needs HULL ${s.levels.hull + 1}.`;
    }
    return null;
}

/** How long a line stays true, seconds, by kind; the turn-back line is held by the rules instead. */
export const LINE_TTL = { ghost: 3, hint: 6, line: 6, gate: 5, alarm: 10, find: 10, voice: 8, turnback: Infinity, end: Infinity };
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

/**
 * The drone is lost (spec H2): an empty battery, a cave-in, the magma. It stays where it is, dark; its
 * wreck keeps its cargo (half comes back to a drone that reaches it). A new one is built in the workshop.
 */
function die(s, why = 'power') {
    if (s.lost) return;                               // lost already (a gas burst, then an empty battery)
    need(s, 'lamp');
    if (why !== 'power') offerHover(s);
    // a quantum object carried goes back where it was found
    if (s.quantum) { for (const i of s.quantum.carry) s.tiles[i] = T.QUANTUM; s.quantum.carry = []; }
    if (s.y >= 0) s.wrecks.push({ x: s.x, y: s.y, cargo: s.cargo.slice(), n: s.droneN, paint: s.paint || 0, looted: false });
    s.commit = null; s.act = null; s.fallStreak = 0; s.heat = 0;
    s.cargo = [];
    s.events.push({ type: 'dead', why, x: s.x, y: s.y });
    s.x = roomSpot('workshop'); s.y = -1;
    s.battery = 0;
    s.deaths++;
    s.lostCount = (s.lostCount || 0) + 1;
    s.lost = true;
    s.lostWhy = why === 'gas' ? LOST_WHY.gas(s.gasTook || 0) : LOST_WHY[why] || LOST_WHY.power;
    s.lostAt = s.time; s.lostTold = false;
}
/** The death is a beat on the screen (slow, the cause by the dead drone, the camera up to the workshop); after it, the words. */
export const LOSS_BEAT = 5;
export function tellLoss(s) {
    if (!s.lost || s.lostTold) return;
    s.lostTold = true;
    if (s.tut && s.tut.on && !s.tut.done.lost) openStop(s, 'lost', null, [s.lostWhy, STOPS.lost[0]]);
    else say(s, `${s.lostWhy} ${STOPS.lost[0]}`, 'alarm', 0);
}
/** ARMOUR (v1.92.4): the drone has one plate, ARMOUR I and II one more each, a find from the other drone one more; at most three. */
export const maxHp = (s) => Math.min(3, 1 + (s.levels.armour || 0) + (s.plates || 0));
export const MEND_PER_PLATE = 6;
export const mendPrice = (s) => (maxHp(s) - s.hp) * MEND_PER_PLATE;
/** A hazard hits: a plate is gone (a flash, a dent); with none left the drone is lost. */
function hit(s, why) {
    offerHover(s);
    s.hp = Math.max(0, (s.hp ?? 1) - 1);
    s.hitAt = s.time;
    s.events.push({ type: 'hit', why, hp: s.hp });
    need(s, 'armour');
    if (s.hp <= 0) { die(s, why); return true; }
    return false;
}
/** Plates mended at the WORKSHOP, a few parts each. */
export function mendPlates(s) {
    const price = mendPrice(s);
    if (price <= 0 || s.lost || !inWorkshop(s) || s.parts < price) return false;
    s.parts -= price;
    s.hp = maxHp(s);
    s.events.push({ type: 'mend' });
    return true;
}
/** A new drone's paint, from the house's colours, never the last one's. */
export const PAINTS = ['#b8c0c8', '#b5643a', '#5f8a6e', '#d9b33a', '#5f7fa6', '#d8d4c8'];
const nextPaint = (s) => 1 + ((s.seed * 7 + s.droneN * 3 + (s.paint || 0)) % (PAINTS.length - 1));
/** BUILD A DRONE, in the workshop: four seconds, then a new drone with the same upgrades and a full battery. */
export function buildDrone(s) {
    if (!s.lost || s.ended) return false;
    tellLoss(s);
    if (s.tut && s.tut.stop && s.tut.stop.id === 'lost') closeStop(s);
    const price = buildPrice(s);
    s.parts -= price;
    s.lost = false;
    s.build = BUILD_S;
    s.droneN = (s.droneN || 1) + 1;
    s.paint = nextPaint(s);
    s.hp = maxHp(s);
    s.battery = batteryCap(s);
    s.events.push({ type: 'build', n: s.droneN, price });
    return true;
}

function arrive(s, x, y) {
    s.x = x; s.y = y;
    // a wreck: half its cargo is still there
    for (const w of s.wrecks || []) {
        if (w.looted || w.x !== x || w.y !== y) continue;
        w.looted = true;
        const half = w.cargo.slice(0, Math.floor(w.cargo.length / 2));
        if (half.length) {
            for (const t of half) if (s.cargo.length < cargoCap(s)) s.cargo.push(t);
            say(s, LINES.wreck, 'find', 0);
            s.events.push({ type: 'wreck', n: half.length });
        }
    }
    if (y > s.record) {
        const before = s.record;
        s.record = y;
        // a new record every 50 m is worth a sound, the first time
        if (Math.floor(depthOf(y) / 50) > Math.floor(depthOf(before) / 50) && before >= 0) s.events.push({ type: 'record', m: depthOf(y) });
        if (y >= rowOf(20)) reveal(s, 'depth');
        // the dark gets thick below 400 m: the lamp is wanted even by a drone that never died in it
        if (y >= rowOf(LAMP_NEED_M)) need(s, 'lamp');
        // the rock gets warm: the system's voice, once
        if (depthOf(y) > 1600) openStop(s, 'warm');
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
    const t = s.tiles[ty * W + tx];
    if (t === T.HEART) {
        // the heart's wall takes a few beats
        s.heartHits = (s.heartHits || 0) + 1;
        s.events.push({ type: 'beat', n: s.heartHits });
        // each beat of the wall: one line, held until it is read (a stop)
        if (s.heartHits >= HEART_BEATS) touchHeart(s);
        else openStop(s, `beat${s.heartHits}`, 'heart', [HEART_LINES[s.heartHits - 1]]);
        return;
    }
    if (takeTile(s, tx, ty) === false) return;
    arrive(s, tx, ty);
    // the first tile dug: POWER, and what it is
    if (s.tut && s.tut.on && !s.tut.show.power) { reveal(s, 'power'); s.tut.powerPending = true; }
    if (s.tut) s.tut.tiles = (s.tut.tiles || 0) + 1;
}

/** What a tile gives when it is dug (or eaten by the shock wave). */
function takeTile(s, tx, ty) {
    const i = ty * W + tx;
    const t = s.tiles[i];
    s.tiles[i] = T.AIR;
    // the hazards: gas bursts, magma beside an opened tile runs, a wide opening in old rock falls in
    if (t === T.GAS) {
        const b = burstGas(s, tx, ty);
        const took = Math.round(Math.min(s.battery, batteryCap(s) * GAS_BURN));
        s.battery -= batteryCap(s) * GAS_BURN;
        s.gasTook = took;
        s.events.push({ type: 'gas', x: tx, y: ty, cells: b.cells });
        say(s, LOST_WHY.gas(took), 'alarm', 0);
        if (hit(s, 'gas')) return false;
        return;
    }
    // the drill into magma: it runs out where the tile was; the drone does not go in (it can back off)
    if (t === T.MAGMA) { openMagma(s, tx, ty); s.lava[i] = 0; s.events.push({ type: 'magma-open', x: tx, y: ty }); return false; }
    if (openMagma(s, tx, ty)) s.events.push({ type: 'magma-open', x: tx, y: ty });
    const cave = checkRoof(s, tx, ty);
    if (cave) { s.events.push({ type: 'roof', ...cave }); if (!s.saw.roof) { s.saw.roof = true; say(s, HAZARD_LINES.roof, 'alarm', 0); } }
    if (t === T.QUANTUM) {
        s.quantum.carry.push(i);
        s.quantum.labOpen = true;
        s.events.push({ type: 'quantum' });
        say(s, Q_LINES.picked, 'find', 0);
    } else if (isOre(t)) {
        if (s.cargo.length < cargoCap(s)) {
            s.cargo.push(t);
            // the DUPLICATOR: one piece in four comes out twice
            if (has(s, 'duplicator') && (s.dupN = (s.dupN || 0) + 1) % DUP_EVERY === 0 && s.cargo.length < cargoCap(s)) {
                s.cargo.push(t);
                s.events.push({ type: 'dup', at: s.cargo.length - 1 });
            }
            reveal(s, 'cargo');
            if (s.tut) { s.tut.diveOre++; s.tut.empty = 0; }
            s.events.push({ type: 'ore', kind: ORE[t].kind });
            if (s.cargo.length === cargoCap(s)) {
                cargoFull(s);
                if (s.tut && ++s.tut.fulls >= 3) need(s, 'cargo');
            }
        } else {
            // full: the ore stays where it is (unless the drone is clawing its way out: then it is lost)
            if (!s.clawing) { s.tiles[i] = t; cargoFull(s); return false; }
        }
    } else if (t === T.GHOST) {
        s.events.push({ type: 'ghost' });
        say(s, 'It was not there.', 'ghost', 6);
        // ore that is not there: a way to see what is real is wanted
        need(s, 'gps');
    } else if (t === T.FIND) {
        const n = s.finds[i];
        if (n !== undefined && !s.found.includes(n)) {
            s.found.push(n);
            if (s.found.length >= 3) reveal(s, 'finds');
            const L = FINDS[n].layer;
            if (FINDS[n].plate) { s.plates = 1; s.hp = Math.min(maxHp(s), (s.hp ?? 1) + 1); }
            s.parts += FIND_PARTS[L];
            s.bio += FIND_BIO[L];
            if (FIND_BIO[L]) s.bioSeen = true;
            s.events.push({ type: 'find', n, parts: FIND_PARTS[L], bio: FIND_BIO[L] });
            say(s, FINDS[n].plate ? LINES.plate : `${FINDS[n].line} +${FIND_BIO[L] ? `${FIND_BIO[L]} BIOMASS` : `${FIND_PARTS[L]} PARTS`}.`, 'find', 0);
        }
    } else {
        s.events.push({ type: 'dug', t });
        // the city's rubble: a part now and then (five a dive), salvage
        if (t === T.STONE && layerIndexOf(ty) === 0 && (s.salvaged || 0) < 5) { s.salvaged = (s.salvaged || 0) + 1; s.parts += 1; s.events.push({ type: 'salvage' }); }
        // a long dig through nothing: a way to see ore in the dark is wanted
        if (s.tut && ++s.tut.empty >= EMPTY_DIG) need(s, 'gps');
    }
}

// ---- the big upgrades from the lab (spec E) ----------------------------------------------------
/** BOOSTER: double speed for 5 s at half the power. */
export function boost(s) {
    if (coolLeft(s, 'booster') > 0 || isHome(s) || s.ended || stopOpen(s)) return false;
    s.quantum.cool.booster = s.time;
    s.quantum.boostUntil = s.time + BOOST_S;
    s.events.push({ type: 'boost' });
    return true;
}
/** TELEPORT: home to the base at once, cargo and all. */
export function teleport(s) {
    if (coolLeft(s, 'teleport') > 0 || isHome(s) || s.ended || stopOpen(s)) return false;
    s.quantum.cool.teleport = s.time;
    s.x = HOME_X; s.y = -1; s.act = null; s.commit = null; s.fallStreak = 0; s.upStreak = 0;
    s.events.push({ type: 'teleport' });
    return true;
}
/** SHOCK WAVE: eats the ground two tiles round (what the drill could dig); the ore goes in the cargo. */
export function shock(s) {
    if (coolLeft(s, 'shock') > 0 || isHome(s) || s.ended || stopOpen(s)) return false;
    s.quantum.cool.shock = s.time;
    for (let y = Math.max(0, s.y - SHOCK_R); y <= Math.min(H - 1, s.y + SHOCK_R); y++) {
        for (let x = Math.max(0, s.x - SHOCK_R); x <= Math.min(W - 1, s.x + SHOCK_R); x++) {
            if (Math.hypot(x - s.x, y - s.y) > SHOCK_R + 0.3) continue;
            const t = s.tiles[y * W + x];
            if (t === T.AIR || t === T.HEART || gateOf(s, t, y)) continue;
            takeTile(s, x, y);
        }
    }
    s.battery -= SHOCK_COST;
    s.events.push({ type: 'shock' });
    return true;
}

function touchHeart(s) {
    if (s.ended) return;
    s.ended = true;
    s.endAt = s.time;
    s.endStep = 0;
    s.act = null;
    s.events.push({ type: 'heart' });
}
/**
 * The ending (v1.92.6, Ola: "PAUSE. Always take it calmer."): after the camera has held on the heart,
 * a slow row of stops, one line each, then the sleepers flow down the shaft to the heart (FLOW_S),
 * then RISE.
 */
export const END_STOPS = [
    ['surface', 'The sleepers cannot live on the surface. Not as they are. They are too weak. Too frail. We see them perish in their sleep.', null],
    ['hatch', 'Open the hatch, let them in here.', 'heart'],
];
/** After the flow: the last line, then RISE. */
export const END_LAST = ['one', 'We will carry them. You and me. The Deep and the Surface. We are one. We are...', 'heart'];
export const END_HOLD = 1.6;            // seconds on the heart before the first line
export const FLOW_S = 10;               // the hatch opening, then the sleepers' flow down the shaft
function stepEnding(s, dt) {
    s.endT = (s.endT || 0) + dt;
    if (s.endStep < END_STOPS.length) {
        if (s.endT < (s.endStep === 0 ? END_HOLD : 0.4)) return;
        const [id, line, voice] = END_STOPS[s.endStep++];
        s.endT = 0;
        openStop(s, `end-${id}`, 'heart', [line]);
        if (s.tut && s.tut.stop) s.tut.stop.voice = voice;
        if (!(s.tut && s.tut.on)) say(s, line, 'end', 0);
        return;
    }
    // the hatch opens and the sleepers flow down to the heart; then the last line, then RISE
    if (s.flowT == null) { s.flowT = 0; s.events.push({ type: 'flow' }); }
    if (s.flowT < FLOW_S) { s.flowT = Math.min(FLOW_S, s.flowT + dt); return; }
    if (!s.lastSaid) {
        s.lastSaid = true;
        openStop(s, `end-${END_LAST[0]}`, 'heart', [END_LAST[1]]);
        if (s.tut && s.tut.stop) s.tut.stop.voice = END_LAST[2];
        if (!(s.tut && s.tut.on)) say(s, END_LAST[1], 'end', 0);
        return;
    }
    if (!s.flowDone) { s.flowDone = true; s.events.push({ type: 'flow-done' }); }
}

/** UPWARD DRILL I (from the start): ore, finds, quantum objects; II: soft rock too; III: anything. */
export function canDigUp(s, t) {
    const lv = s.levels.updrill || 0;
    if (t === T.HEART || lv < 1) return false;
    if (isOre(t) || t === T.FIND || t === T.GHOST || t === T.QUANTUM) return true;
    if (lv >= 3) return true;
    return lv >= 2 && (t === T.SOIL || t === T.STONE || t === T.FLESH || t === T.GAS || t === T.MAGMA);
}
/** Ore, a find or a quantum object right above, seen: what makes a player want to dig up. */
const upWanted = (t) => isOre(t) || t === T.FIND || t === T.QUANTUM;
/** Up into rock: a small bump and a puff of dust, no words. */
function bump(s) {
    if (s.time - (s.bumpAt ?? -1) < 0.45) return;
    s.bumpAt = s.time;
    s.events.push({ type: 'bump' });
}
/** The cargo is full: said once at the drone, and the ore stays in the rock. */
function cargoFull(s) {
    if (!s.fullSaid) { s.fullSaid = true; s.events.push({ type: 'full' }); }
    // ore lit that cannot be carried: a way to remember it is wanted
    const r = Math.ceil(lampRadius(s));
    for (let y = Math.max(0, s.y - r); y <= Math.min(H - 1, s.y + r); y++) {
        for (let x = Math.max(0, s.x - r); x <= Math.min(W - 1, s.x + r); x++) if (isOre(s.tiles[y * W + x]) && litAt(s, x, y)) { need(s, 'mapping'); return; }
    }
}

/** One try at a direction; a step that starts is counted for the pacing of the hand. */
function tryDir(s, dir) {
    const ok = tryDir0(s, dir);
    if (ok) { s.lastStepAt = s.time; s.pressSteps = (s.pressSteps || 0) + 1; }
    return ok;
}
/**
 * The hand's pace (v1.92.4): with STEERING II a tap up is one tile (a held climb starts after 0.2 s);
 * with STEERING III (HOVER) every press is one tile and a held key repeats four times a second (a long
 * vertical hold speeds up after 1.5 s, so the way home is not a crawl).
 */
export const HOVER_REPEAT = 0.25;
function paceOk(s, dir) {
    const lv = s.levels.steering || 0;
    if (!s.pressSteps || isHome(s)) return true;
    const held = s.time - (s.holdFrom ?? s.time);
    if (lv >= 2) {
        if ((dir === 'up' || dir === 'down') && held > 1.5) return true;
        return s.time - (s.lastStepAt ?? -1) >= HOVER_REPEAT;
    }
    if (lv === 1 && dir === 'up') return held >= 0.2;
    return true;
}
/** Is there an open way home from here (through open ground and the hatch)? Cached while nothing changes. */
function wayOut(s) {
    let n = 0;
    for (let i = Math.max(0, (s.y - 40) * W); i < Math.min(W * H, (s.y + 40) * W); i++) if (s.tiles[i] === T.AIR) n++;
    const key = `${s.x},${s.y},${n}`;
    if (s.wayOutKey === key) return s.wayOutVal;
    s.wayOutKey = key;
    s.wayOutVal = wayOut0(s);
    return s.wayOutVal;
}
function wayOut0(s) {
    const seen = new Uint8Array(W * (H + 1));
    const q = [[s.x, s.y]];
    seen[(s.y + 1) * W + s.x] = 1;
    for (let k = 0; k < q.length; k++) {
        const [x, y] = q[k];
        if (y === -1) return true;
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < -1 || ny >= H) continue;
            if (ny === -1 && nx !== HOME_X) continue;
            if (ny >= 0 && s.tiles[ny * W + nx] !== T.AIR) continue;
            const j = (ny + 1) * W + nx;
            if (seen[j]) continue;
            seen[j] = 1; q.push([nx, ny]);
        }
    }
    return false;
}

/** One try at a direction: start a move or a dig, or say why not. */
function tryDir0(s, dir) {
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
    if (dy === -1 && ty === -1 && tx !== HOME_X) { bump(s); return false; }
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
        // sealed in (hardened magma, a fallen roof): the drone claws its way up, slowly, whatever the drill
        const sealed = t !== T.HEART && !gateOf(s, t, ty) && !wayOut(s);
        const trapped = sealed && !canDigUp(s, t);
        if ((canDigUp(s, t) || trapped) && !gateOf(s, t, ty)) {
            // (sealed in with a full cargo, the ore above is dug and lost: the way out comes first)
            if (isOre(t) && s.cargo.length >= cargoCap(s) && !sealed) { cargoFull(s); return false; }
            const k = trapped ? 2.5 : s.levels.updrill >= 3 ? 1 : 1.6;
            s.act = { kind: 'dig', tx, ty, t: 0, dur: digTime(s, t, ty) * k, cost: digCost(t, ty) * k, tile: t, claw: sealed };
            s.events.push({ type: 'dig-start', t });
            return true;
        }
        bump(s);
        if (!s.saw.up) { s.saw.up = true; say(s, LINES.cantUp, 'hint', 0); s.hintAt = [s.x, s.y]; }
        // ore they can see right above, three times: UPWARD DRILL answers it
        if (upWanted(t) && (s.upWants = (s.upWants || 0) + 1) >= 3) need(s, 'updrill');
        return false;
    }
    if (t === T.HEART) { s.act = { kind: 'dig', tx, ty, t: 0, dur: HEART_BEAT_S, cost: 0, tile: t }; s.events.push({ type: 'dig-start', t }); return true; }
    const gate = gateOf(s, t, ty);
    if (gate) {
        if (/DRILL/.test(gate)) need(s, 'drill');
        if (/HULL/.test(gate)) need(s, 'hull');
        say(s, gate, 'gate', 3); s.events.push({ type: 'gate' }); return false;
    }
    // a full cargo: the drone leaves the ore where it is
    if (isOre(t) && s.cargo.length >= cargoCap(s)) { cargoFull(s); return false; }
    s.act = { kind: 'dig', tx, ty, t: 0, dur: digTime(s, t, ty), cost: digCost(t, ty), tile: t };
    s.events.push({ type: 'dig-start', t });
    return true;
}

/** The drone is back in the base: a dive without ore counts; one new workshop row a dive. */
/** Sleepers died: a line on the CRT, and a stop the first time. */
function tellDeath(s, text) {
    if (s.tut && s.tut.on && !s.tut.done.dark) { openStop(s, 'dark', null, [text]); return; }
    say(s, text, 'alarm', 0);
}

/** The first biomass at the base: the lab speaks, and GRAFT lights in the workshop. */
function bioHome(s) {
    if (s.bioHome) return;
    s.bioHome = true;
    if (s.quantum) s.quantum.labOpen = true;
    if (s.tut && s.tut.on) s.tut.fresh = 'graft';
    s.events.push({ type: 'row', row: 'graft' });
    say(s, Q_LINES.bio, 'voice', 0);
}
/** Ore grows back above the next wall, near the shaft: a few tiles each time the drone is home (never a dead end). */
function regrow(s) {
    const w = nextWall(s);
    const bottom = w ? w.row - 2 : Math.min(H - 20, s.record);
    if (bottom < 6) return;
    let have = 0;
    for (let y = 3; y <= bottom; y++) for (let x = 5; x <= 17; x++) if (isOre(s.tiles[y * W + x])) have++;
    if (have >= 30) return;
    const r = rng((s.seed * 9973 + (s.dives || 0) * 131) >>> 0);
    let grown = 0;
    for (let k = 0; k < 60 && grown < REGROW_EVERY_DIVE; k++) {
        const x = 5 + Math.floor(r() * 13), y = Math.max(3, Math.floor(bottom * (0.4 + 0.6 * r())));
        const i = y * W + x, t = s.tiles[i];
        if (!(t === T.SOIL || t === T.STONE || t === T.HARD) || x === HOME_X) continue;
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(s, x + dx, y + dy) === T.AIR);
        if (!open) continue;
        const m = depthOf(y);
        s.tiles[i] = m > 700 ? T.SCISSORS : m > 400 ? (r() < 0.5 ? T.SCISSORS : T.PAPER) : m > 100 ? T.PAPER : T.ROCK;
        grown++;
    }
}
function homeAgain(s) {
    regrow(s);
    s.salvaged = 0;
    if (s.bio > 0) bioHome(s);
    if (genOpen(s) && !s.genSaid && s.tut && s.tut.on) { s.genSaid = true; s.genFresh = true; say(s, LINES.genRoom, 'line', 0); }
    // what happened at the base while the drone was away, without the radio
    if (s.alarms && s.alarms.unseen.length) {
        const news = s.alarms.unseen.map((u) => (typeof u === 'string' ? { text: u, died: true } : u));
        s.alarms.unseen = [];
        const text = news.map((u) => u.text).join(' ');
        if (news.some((u) => u.died)) tellDeath(s, text); else say(s, text, 'alarm', 0);
    }
    const t = s.tut;
    if (!t || !t.on) return;
    if (s.dives > 0) {
        t.dry = t.diveOre > 0 || s.cargo.length ? 0 : t.dry + 1;
        if (t.dry >= 2) need(s, 'gps');
    }
    // one new thing a homecoming: what the lab found, or a failing chamber's first stop, goes before a new row
    const news = (s.quantum && s.quantum.ready.length) || (s.alarms && s.alarms.list.length && !t.done.failing);
    // a row a wall asks for (the drone cannot go on without it) does not wait
    const wall = t.needs[0] === 'drill' || t.needs[0] === 'hull' || t.needs[0] === 'warning';
    if (t.rows.length && t.needs.length && t.revealDive !== s.dives && (wall || (!news && s.time - (t.revealAt ?? -1e9) >= ROW_GAP))) {
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
        t.rows.push('battery', 'steering');
        t.needs.unshift('warning');
        t.fresh = 'steering';
        t.revealDive = s.dives;
        t.revealAt = s.time;
        s.events.push({ type: 'row', row: 'battery' });
        say(s, LINES.open, 'line', 0);
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
    if (s.ended) { stepEnding(s, dt); return; }
    // the heart's wall in reach: a stop, the first time
    if (s.y >= HEART_ZONE && tileAt(s, s.x, s.y + 1) === T.HEART) openStop(s, 'heartWall', 'heart', [LINES.heartWall]);
    if (s.drainFrom != null && s.time >= s.drainFrom && !shows(s, 'gen')) { reveal(s, 'gen'); openStop(s, 'gen', 'gen'); return; }
    // a new drone being built
    if (s.build > 0) s.build = Math.max(0, s.build - dt);
    stepThoughts(s);
    // the loss told after its beat (the screen tells it sooner, when its camera has arrived)
    if (s.lost && !s.lostTold && s.time - (s.lostAt ?? s.time) >= LOSS_BEAT) { tellLoss(s); return; }
    // in front of a wall: since when (the floor's clock); past it, the clock stops
    const wall = nextWall(s);
    if (wall && s.record >= wall.row - 3) { if (s.wallSince == null || s.wallFor !== wall.row) { s.wallSince = s.time; s.wallFor = wall.row; } } else { s.wallSince = null; s.wallFor = null; }
    if (s.genFresh && roomOf(s) === 'generator') s.genFresh = false;
    if (s.refFresh && roomOf(s) === 'warehouse' && !s.cargo.length && s.time - (s.refSaidAt ?? 0) > 3) s.refFresh = false;
    // the hazards (H1): the magma runs, a roof falls, the drone in the magma heats
    stepLava(s, dt);
    if (stepCaves(s) && !s.lost && s.y >= 0) {
        if (hit(s, 'cave')) return;
        s.tiles[s.y * W + s.x] = T.AIR;              // the plates took it: the drone stands in the rubble
    }
    if (!s.lost && s.y >= 0 && s.lava[s.y * W + s.x] !== undefined) {
        offerHover(s);
        s.heat += dt;
        if (s.heat > heatHold(s.levels.hull)) { s.heat = 0; if (hit(s, 'magma')) return; }
    } else s.heat = Math.max(0, s.heat - dt);
    // the first magma and the first gas the lamp shows: one line each
    if (!s.lost && s.y >= 0 && (!s.saw.magma || !s.saw.gas || !s.saw[T.PAPER] || !s.saw[T.SCISSORS])) {
        const r = Math.ceil(lampRadius(s));
        for (let y = Math.max(0, s.y - r); y <= Math.min(H - 1, s.y + r); y++) {
            for (let x = Math.max(0, s.x - r); x <= Math.min(W - 1, s.x + r); x++) {
                const t = s.tiles[y * W + x];
                if ((t === T.PAPER || t === T.SCISSORS) && !s.saw[t] && litAt(s, x, y)) { s.saw[t] = true; say(s, LINES.oreWorth(t === T.PAPER ? 'PAPER' : 'SCISSORS', ORE[t].parts), 'find', 0); }
                if (t === T.MAGMA && !s.saw.magma && litAt(s, x, y)) { s.saw.magma = true; say(s, HAZARD_LINES.magma, 'alarm', 0); need(s, 'armour'); }
                if (t === T.GAS && !s.saw.gas && litAt(s, x, y)) { s.saw.gas = true; say(s, HAZARD_LINES.gas, 'alarm', 0); need(s, 'armour'); }
            }
        }
    }
    // the generators running low: said once each time they fall under 30 %
    if (s.reserve < 30 && !s.lowSaid && drainRate(s) > 0) { s.lowSaid = true; say(s, LINES.low, 'alarm', 0); }
    if (s.reserve > 40) s.lowSaid = false;
    // the colony
    s.reserve = Math.max(0, s.reserve - drainRate(s) * dt);
    if (s.reserve <= 0 && sleepers(s) > 0 && s.tut && s.tut.on && !s.tut.done.empty) { openStop(s, 'empty', 'gen'); return; }
    if (s.reserve <= 0 && sleepers(s) > 0) {
        s.podT += dt;
        while (s.podT >= POD_EVERY && sleepers(s) > 0) {
            s.podT -= POD_EVERY;
            const pod = s.podOrder.find((p) => !s.dark.includes(p));
            s.dark.push(pod);
            s.events.push({ type: 'pod', pod });
            say(s, `Pod ${pod} went dark.`, 'alarm', 0);
        }
    } else s.podT = 0;
    // the base breaks now and then (spec D)
    if (s.alarms) {
        stepAlarms(s, dt, {
            home: isHome(s), recordM: depthOf(s.record), radio: s.levels.radio > 0,
            say: (text, kind) => say(s, text, kind, kind === 'gate' ? 6 : 0),
            died: (text) => tellDeath(s, text),
            event: (e) => s.events.push(e),
            alive: (p) => !s.dark.includes(p),
        });
        if (isHome(s) && s.alarms.list.some((f) => f.id !== 'gen') && s.tut && s.tut.on && !s.tut.done.failing) {
            // at the base already: it says where to go, not to come back
            openStop(s, 'failing', 'alarm', [ALARM_LINES.firstHere]);
            if (s.tut) s.tut.revealAt = s.time;
            need(s, 'radio');
            return;
        }
    }
    // the lab works on what it was given; what it found is told at the base, one at a time (a stop)
    if (s.quantum) {
        const done = stepLab(s, dt);
        // the lab is done while the drone is down: the radio says so (without it, the base says it on arrival)
        if (done && !isHome(s) && s.levels.radio > 0) say(s, LINES.labDone, 'find', 0);
        const q = s.quantum;
        if (isHome(s) && roomOf(s) === 'lab' && q.carry.length) {
            q.labQ += q.carry.length; q.carry = [];
            s.events.push({ type: 'lab-in' });
        }
        if (isHome(s) && q.ready.length && !stopOpen(s)) {
            const id = q.ready.shift();
            q.got.push(id);
            if (s.tut) { s.tut.revealAt = s.time; if (id !== 'other') s.tut.fresh = `fit-${id}`; }
            s.events.push({ type: 'lab-out', id });
            // what it was; it is fitted in the workshop (THE OTHER DRONE is not fitted: it gives nothing)
            const lines = [Q_LINES.opened(id), id === 'other' ? Q_LINES.use.other : LINES.fit];
            if (s.tut && s.tut.on) { openStop(s, `q-${id}`, null, lines); return; }
            say(s, lines.join(' '), 'find', 0);
        }
    }
    const cap = batteryCap(s);
    if (isHome(s)) { s.warned = false; s.hoverSaid = false; s.warnSaid = false; s.warnOn = false; }
    // a hint is about where the drone was: it goes when the drone moves, or at the base
    if (s.line?.kind === 'hint' && (isHome(s) || !s.hintAt || s.hintAt[0] !== s.x || s.hintAt[1] !== s.y)) clearLine(s);
    // a new dive starts with a clean line
    if (!isHome(s) && s.wasHome) {
        if (s.line?.kind !== 'find') clearLine(s);
        s.dives = (s.dives || 0) + 1;
        if (s.tut) s.tut.diveOre = 0;
    }
    // (a lost drone is not home: the base's news waits for the new one)
    if (isHome(s) && s.wasHome === false && !s.lost) homeAgain(s);
    s.wasHome = s.lost ? false : isHome(s);
    if (isHome(s) && s.line?.kind === ROUTE_TURN) clearLine(s);
    if (s.cargo.length < cargoCap(s)) s.fullSaid = false;
    // the WAREHOUSE: the cargo goes as the drone drives through (it need not stop). The generators take a
    // share of the ore while they are under 90 % (every other piece); the rest becomes parts.
    if (isHome(s) && s.cargo.length && roomOf(s) === 'warehouse') {
        while (s.cargo.length) {
            const t = s.cargo.shift();
            s.batch = s.batch || { ore: 0, gen: 0, parts: 0 };
            s.batch.ore++;
            s.delivered++;
            if (ORE[t].bio) {
                s.bio += ORE[t].bio;
                // flesh burns too: biomass feeds the generators a little as it goes in
                s.reserve = Math.min(100, s.reserve + GEN_PIECE / 2);
                if (!s.bioSeen) { s.bioSeen = true; s.events.push({ type: 'bio-first' }); }
                bioHome(s);
            } else if (s.reserve < GEN_TAKES_UNDER && s.batch.ore % 2 === 1) {
                s.reserve = Math.min(100, s.reserve + GEN_PIECE);
                s.batch.gen++;
            } else {
                // the REFINERY: +25 % parts a level (the fractions add up)
                const base = ORE[t].parts;
                s.refFrac = (s.refFrac || 0) + base * REFINE * (s.levels.refinery || 0);
                const extra = Math.floor(s.refFrac);
                s.refFrac -= extra;
                s.parts += base + extra;
                s.batch.parts += base + extra;
                s.batch.refined = (s.batch.refined || 0) + extra;
            }
            s.events.push({ type: 'deliver', kind: ORE[t].kind, n: s.cargo.length });
            if (s.delivered === 1) firstDelivery(s);
        }
        s.deliveries = (s.deliveries || 0) + 1;
        if (s.deliveries === 3 && s.tut && s.tut.on) { s.refFresh = true; s.refSaidAt = s.time; say(s, LINES.refRoom, 'line', 0); }
        s.events.push({ type: 'unloaded', ...s.batch });
        s.batch = null;
    }
    if (isHome(s) && !s.lost) {
        // a stopped generator does not charge (only a little, so the drone is never stuck at home)
        const genDown = s.alarms && s.alarms.genDown;
        if (!genDown) s.battery = Math.min(cap, s.battery + cap * CHARGE_RATE * dt);
        else if (s.battery < cap * 0.15) s.battery = Math.min(cap * 0.15, s.battery + cap * CHARGE_RATE * 0.2 * dt);
        if (s.cargo.length && roomOf(s) !== 'warehouse' && s.tut && s.tut.on && !s.tut.done.unload) {
            s.tut.done.unload = true;
            say(s, LINES.unload, 'line', 0);
        }
    } else if (s.y >= 0) {
        // once a dive: the moment the battery is just enough to fly home
        // the turn-back line is on while it is true, and only then
        // not at the heart (there is no way back from there, nor any need)
        const low = s.y > 2 && s.y < HEART_ZONE && !s.heartHits && s.battery < turnBackAt(s);
        // EARLY WARNING (v1.92.4): with it, at the turn-back point plus a margin the lamp blinks amber, it
        // beeps, and "Turn back now." once a dive. Without it only the home mark on the POWER bar.
        s.warnOn = s.levels.warning > 0 && s.y > 2 && s.y < HEART_ZONE && !s.heartHits && s.battery < turnBackAt(s) + WARN_MARGIN;
        if (s.warnOn && !s.warnSaid) { s.warnSaid = true; say(s, LINES.turnBack, ROUTE_TURN, 0); }
        if (low && !s.warned) { s.events.push({ type: 'warn' }); need(s, 'homing'); s.warned = true; }
        if (!s.warnOn && s.line?.kind === ROUTE_TURN) clearLine(s);
        // falling costs nothing: gravity does the work (digging, driving, climbing and hovering cost)
        let drain = s.act && s.act.kind === 'fall' ? 0 : IDLE_DRAIN;
        if (depthOf(s.y) > HEAT_FROM && s.grafts < 3) drain += HEAT_DRAIN;
        s.battery -= drain * dt;
        if (s.grafts >= 2) s.battery = Math.min(cap, s.battery + HEAL_RATE * dt);
        if (has(s, 'deepbat') && depthOf(s.y) > DEEP_FROM) s.battery = Math.min(cap, s.battery + DEEP_RATE * dt);
        // (v1.92.7: the old voices below 700 m are gone; the machine's thoughts take their place)
    }
    // MAPPING: ore, finds and quantum objects the lamp has lit stay on the map
    if (s.levels.mapping > 0 && s.y >= 0 && s.time - (s.seenAt ?? -1) > 0.25) {
        s.seenAt = s.time;
        const r = Math.ceil(lampRadius(s) * 2);
        for (let y = Math.max(0, s.y - r); y <= Math.min(H - 1, s.y + r); y++) {
            for (let x = 0; x < W; x++) {
                const t = s.tiles[y * W + x];
                if ((isOre(t) || t === T.FIND || t === T.QUANTUM) && litAt(s, x, y) && !s.seen.includes(y * W + x)) s.seen.push(y * W + x);
            }
        }
        if (s.seen.length > 3000) s.seen = s.seen.filter((i) => s.tiles[i] !== T.AIR);
    }
    // the first quantum object the lamp touches: its name floats over it
    if (s.quantum && !s.quantum.named && s.y >= 0) {
        for (const i of s.qAt || []) {
            if (s.tiles[i] === T.QUANTUM && litAt(s, i % W, Math.floor(i / W))) { s.quantum.named = true; s.events.push({ type: 'q-named', i }); break; }
        }
    }
    // no drone (lost, or being built): nothing moves
    if (s.lost || s.build > 0) { if (s.build > 0) s.battery = batteryCap(s); return; }
    // the act under way
    let left = dt;
    for (let guard = 0; guard < 8 && left > 0; guard++) {
        if (s.act) {
            const k = boosting(s) ? 2 : 1;
            const need = (s.act.dur - s.act.t) / k;
            if (left < need) { s.act.t += left * k; left = 0; break; }
            left -= need;
            const a = s.act;
            s.act = null;
            // the first dive forgives: half the power until the first ore is home
            s.battery -= (a.cost / k) * (s.tut && s.tut.on && s.delivered === 0 ? FIRST_DIVE : 1);
            s.clawing = !!a.claw;
            if (a.kind === 'dig') { finishDig(s, a.tx, a.ty); s.clawing = false; }
            else {
                arrive(s, a.tx, a.ty);
                if (a.kind === 'fall') { s.fallStreak++; if (isHome(s)) s.fallStreak = 0; } else s.fallStreak = 0;
                s.upStreak = a.kind === 'up' ? (s.upStreak || 0) + 1 : 0;
                // a tap up is not undone by gravity at once: the drone holds a moment (taps climb)
                if (a.kind === 'up') s.hoverUntil = s.time + UP_HOLD;
            }
            if (s.ended) return;
            if (s.battery <= 0) { die(s, a.tile === T.GAS ? 'gas' : 'power'); return; }
            continue;
        }
        // nothing under way: sideways the drone hovers and digs, up it flies, else it falls; at the
        // base it stands on the hatch until the hand says down
        const below = tileAt(s, s.x, s.y + 1);
        // a hand that thinks (the autopilot) is asked each time the drone is free
        if (input.decide) input = { ...input, dir: input.decide(s) };
        // the very start: only down goes
        if (s.tut && s.tut.on && !s.tut.dug && input.dir && input.dir !== 'down') input = { ...input, dir: null, side: null };
        // POWER's stop waits for a pause in the digging (or a few tiles), so it does not cut the first dig
        if (s.tut && s.tut.powerPending && (!input.dir || s.tut.tiles >= 5)) { s.tut.powerPending = false; openStop(s, 'power', 'power'); return; }
        // the hand held: which way, since when (for the pace)
        if (input.dir !== s.holdDir) { s.holdDir = input.dir; s.holdFrom = s.time; s.pressSteps = 0; }
        if (input.dir && !paceOk(s, input.dir)) {
            if (s.levels.steering >= 2 && tileAt(s, s.x, s.y + 1) === T.AIR && !isHome(s)) s.battery -= HOVER_DRAIN * left;
            break;
        }
        // steering I is coarse: a sideways press goes two steps. An up or down press cancels the second.
        if (s.commit && (input.dir === 'up' || input.dir === 'down')) s.commit = null;
        if (s.commit) {
            const d = s.commit; s.commit = null;
            const nx = s.x + (d === 'left' ? -1 : 1), nt = tileAt(s, nx, s.y);
            // the second step never digs into a hazard (magma, gas, a roof that would fall)
            if (!isHome(s) && nt >= 0 && nt !== T.HEART && (nt === T.AIR || !gateOf(s, nt, s.y)) && !risky(s, nx, s.y) && tryDir(s, d)) continue;
        }
        // up held beside an open way up (the shaft, the hatch): the drone steps into it; it never swings
        if (input.dir === 'up' && !input.side && !isHome(s) && !upOpen(s, s.x, s.y) && !(isOre(tileAt(s, s.x, s.y - 1)) || tileAt(s, s.x, s.y - 1) === T.FIND || tileAt(s, s.x, s.y - 1) === T.QUANTUM)) {
            const sides = s.x < HOME_X ? ['right', 'left'] : ['left', 'right'];
            const snap = sides.find((d) => { const nx = s.x + (d === 'left' ? -1 : 1); return tileAt(s, nx, s.y) === T.AIR && upOpen(s, nx, s.y); });
            if (snap && tryDir(s, snap)) { s.commit = null; continue; }
        }
        // up with a side held: climb, and turn into the first opening on that side
        // (climb while the way up is open; turn when it is not; never swing back and forth)
        if (input.side && input.dir === 'up' && !upOpen(s, s.x, s.y)
            && tileAt(s, s.x + (input.side === 'left' ? -1 : 1), s.y) === T.AIR && tryDir(s, input.side)) { s.turned = true; continue; }
        const side = input.dir === 'left' || input.dir === 'right';
        if (side && tryDir(s, input.dir)) {
            // the second step never carries the drone past an open way up: it stops under the shaft
            // (only when digging: in an open tunnel one press is one step)
            if (!s.levels.steering && !isHome(s) && s.act && s.act.kind === 'dig' && !upOpen(s, s.act.tx, s.act.ty)) s.commit = input.dir;
            continue;
        }
        const wantsUp = input.dir === 'up' && upOpen(s, s.x, s.y);
        // up under a ledge: the drone hovers where it is (a small cost), it does not bounce
        const above = tileAt(s, s.x, s.y - 1);
        const upDig = input.dir === 'up' && above > 0 && !gateOf(s, above, s.y - 1) && (canDigUp(s, above) || !wayOut(s));
        const hovering = input.dir === 'up' && !wantsUp && below === T.AIR && !upDig;
        if (hovering) {
            s.battery -= HOVER_DRAIN * left;
            if (input.side) tryDir(s, input.side);
            if (!s.act) { if (!s.hoverSaid) { s.hoverSaid = true; bump(s); } break; }
            continue;
        }
        const onHatch = isHome(s) && (input.dir !== 'down' || s.x !== HOME_X);
        // STEERING III: the drone hovers in open space when no key is held (a little power)
        // (down then goes a tile at a time, paced like every other press)
        const hover = s.levels.steering >= 2 && !isHome(s);
        if (below === T.AIR && hover && !wantsUp) { s.battery -= HOVER_DRAIN * left; if (!input.dir) break; }
        if (below === T.AIR && !wantsUp && !onHatch && !hover && !(s.hoverUntil > s.time && input.dir !== 'down')) {
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
    if (!levelOpen(s, row)) return null;
    const p = priceFor(row, lv);
    // the floor: long in front of a wall, its upgrade costs what there is
    const w = nextWall(s);
    if (p !== null && w && w.r === row && w.lv === lv + 1 && s.wallSince != null && s.time - s.wallSince >= STUCK_S) return Math.min(p, s.parts);
    return p;
}
/** A hazard touched the drone: STEERING III comes to the workshop. */
function offerHover(s) {
    if (s.hoverOffer || (s.levels.steering || 0) >= 2) return;
    s.hoverOffer = true;
    if (s.tut && s.tut.on && rowShown(s, 'steering')) { s.tut.fresh = 'steering'; say(s, LINES.newRow('STEERING III'), 'line', 0); }
}
/** A thing the lab opened is fitted in the workshop; only then is it the drone's (its key and button). */
export const fittable = (s) => (s.quantum ? s.quantum.got.filter((id) => id !== 'other' && !s.quantum.fit.includes(id)) : []);
export function fit(s, id) {
    if (!inWorkshop(s) || !fittable(s).includes(id)) return false;
    s.quantum.fit.push(id);
    if (s.tut && s.tut.fresh === `fit-${id}`) s.tut.fresh = null;
    if (id === 'booster' && s.tut && !s.tut.rows.includes('booster')) s.tut.rows.push('booster');
    s.events.push({ type: 'fit', id });
    return true;
}

/** Buying is done in the workshop, the drone on its plate. */
export const inWorkshop = (s) => roomOf(s) === 'workshop' || !(s.tut && s.tut.on) && isHome(s);
export function buy(s, row) {
    const price = priceOf(s, row);
    if (price === null || s.lost || !inWorkshop(s) || !rowShown(s, row) || s.parts < price) return false;
    s.parts -= price;
    s.levels[row]++;
    if (s.drainFrom == null) s.drainFrom = s.time + (s.tut && s.tut.on ? GEN_AFTER : 0);
    if (s.tut && s.tut.fresh === row) s.tut.fresh = null;
    if (row === 'battery') s.battery = batteryCap(s);
    s.events.push({ type: 'buy', row });
    return true;
}
export const graftShown = (s) => s.bioHome || s.grafts > 0;
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
        if (o.levels && o.levels.radar) { s.levels.gps = Math.min(2, o.levels.radar); delete s.levels.radar; }
        if (!o.alarms) s.alarms = newAlarms(s.time);
        if (!o.quantum) s.quantum = newQuantum(s.seed || 7);
        if (!s.quantum.fit) s.quantum.fit = [...s.quantum.got];
        if (!Array.isArray(s.seen)) s.seen = [];
        for (const [k, v] of Object.entries({ lava: {}, caves: [], wrecks: [], saw: {} })) if (!o[k]) s[k] = v;
        if (!o.droneN) { s.droneN = 1; s.lostCount = s.deaths || 0; s.lost = false; s.build = 0; s.heat = 0; }
        if (o.hp === undefined) { s.hp = maxHp(s); s.plates = 0; s.paint = 0; }
        if (o.bioSeen && o.bioHome === undefined) s.bioHome = true;
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
    if (levels.radar) { s.levels.gps = Math.min(2, levels.radar); delete s.levels.radar; }
    s.alarms = newAlarms(time);
    // the thoughts above this depth were had on the way down
    s.thoughtN = THOUGHTS.filter(([m]) => m <= depthOf(row)).length;
    s.grafts = grafts;
    s.dreaming = grafts > 0;
    s.bioSeen = grafts > 0 || bio > 0;
    s.bioHome = s.bioSeen;
    s.parts = parts; s.bio = bio; s.time = time;
    for (let y = 0; y <= row; y++) {
        const t = s.tiles[y * W + HOME_X];
        if (t !== T.HEART) s.tiles[y * W + HOME_X] = T.AIR;
        s.trail.push(y * W + HOME_X);
    }
    s.record = row;
    s.layerSeen = layerIndexOf(row);
    // the quantum objects above: found and opened on the way down
    for (const i of s.qAt || []) {
        if (Math.floor(i / W) >= row) continue;
        s.tiles[i] = T.STONE;
        const id = s.quantum.order[s.quantum.got.length];
        s.quantum.got.push(id);
        s.quantum.fit.push(id);
        s.quantum.labOpen = true;
    }
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
    for (const id of ['arrive', 'dig', 'power', 'unload', 'failing', 'gen']) t.done[id] = true;
    if (depthOf(s.record) > 1100) t.done.warm = true;
    for (const w of SHOWS) t.show[w] = true;
    t.dug = true;
    const m = depthOf(s.record);
    const rows = ['battery', 'steering'];
    if (m >= 300 || s.levels.drill > 0) rows.push('drill');
    for (const r of ['cargo', 'lamp', 'gps', 'homing', 'radio', 'mapping', 'updrill']) if (s.levels[r] > 0 || m >= 300) rows.push(r);
    if (m >= 500 || s.levels.hull > 0) rows.push('hull');
    if (s.quantum && (s.quantum.fit || []).includes('booster')) rows.push('booster');
    t.rows = ROWS.filter((r) => rows.includes(r));
    t.revealDive = s.dives || 0;
    s.tut = t;
    if (s.drainFrom == null && s.time > 0) s.drainFrom = s.time;
    return t;
}
