/**
 * Chapter IV · THE DEEP, movement III · GROW, third pass (deep-organs): THE BODY IS BUILT FROM ORGANS
 * YOU CHOOSE. Pure: no DOM, no three.js, no clock. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md,
 * "GROW, third pass".
 *
 * Ola on v1.78.0: "From when you start becoming flesh you have zero things to do. You click a piece of
 * flesh that does something unclear. Still it makes no noticeable difference to anything."
 *
 * EVERY TAKE IS A CHOICE OF ORGAN. A chamber the body takes becomes one of four:
 *   VAT    grows people (FEED)
 *   GUT    turns the rock into MASS, the body's currency: every take is paid in mass
 *   HEART  reaches the edge (PULSE): the body's hearts can feed so much flesh and no more; flesh beyond
 *          their reach starves. Each heart also makes the player's pumps stronger.
 *   NERVE  speed (FLESH): takes fill faster, dreams last longer
 * The room's old function makes one organ cheap (CHEAP_FOR): a dormitory a vat, a mine a gut, a
 * generator a heart, a farm a vat or a gut, the cryo hall a nerve. A living organ can be grown again
 * into another, for a price.
 *
 * THE FOUR GAUGES ARE THE FOUR ORGANS. Each reads a ratio: what its organs give over what the body's
 * size asks (1 is enough). The weakest limits the body (`pace`): every take fills at that pace, as the
 * four bars limited the colony at the start of the chapter. The lid (the first heart) gives a little of
 * each, so a small body is green everywhere and the gauges fall one by one as it grows.
 *
 * UPHILL AND DOWNHILL, PER FLOOR. A deeper chamber costs more mass (TAKE_FLOOR), takes more work
 * (WORK_FLOOR) and asks more of the hearts and nerves (DEMAND_FLOOR) than its organ gives back
 * (SUPPLY_FLOOR): the floor is uphill. A full floor cascades: its organs give FULL_FLOOR times, and the
 * landing below becomes spine by itself.
 *
 * The graph is growth.js's. `st` here is { body, necrotic, organs } (grow.js bodyState).
 */

import { floorFull, MACHINE, HEART, isNecrotic } from './growth.js';

/* ------------------------------------------------------------------ the organs */
export const ORGANS = ['vat', 'gut', 'heart', 'nerve'];
export const ORGAN_NAME = { vat: 'VAT', gut: 'GUT', heart: 'HEART', nerve: 'NERVE' };
/** Which gauge each organ fills, and back. */
export const ORGAN_GAUGE = { gut: 'M', vat: 'F', heart: 'E', nerve: 'H' };
export const GAUGE_ORGAN = { M: 'gut', F: 'vat', E: 'heart', H: 'nerve' };
/** What each does, in one short line (the ring's hover). deep-tension: each says what it costs too. */
export const ORGAN_DOES = {
    vat: 'Grows people. Eats mass.',
    gut: 'Turns rock into mass. The only one that does.',
    heart: 'Reaches the edge. Pumps harder.',
    nerve: 'Every pump counts for more.',
};
/** The organ the room's old function makes cheap. */
export const CHEAP_FOR = { dorm: ['vat'], mine: ['gut'], generator: ['heart'], farm: ['vat', 'gut'], cryo: ['nerve'] };
/** A cheap organ costs this share of the price. deep-tension: a temptation, not the answer. */
export const CHEAP = 0.5;
/** Growing an organ again into another costs this share of a take there. */
export const REGROW = 0.6;
export const cheapOrgans = (type) => CHEAP_FOR[type] || [];

/* ------------------------------------------------------------------ the numbers */
/** What a chamber asks of the body a floor down, times this a floor (uphill). */
export const DEMAND_FLOOR = 1.5;
/** What an organ gives a floor down, times this a floor (less than it asks: uphill). */
export const SUPPLY_FLOOR = 1.35;
/** A full floor: its organs give this many times (the cascade, downhill). */
export const FULL_FLOOR = 1.5;
/** The machine house as hands asks this much of the body. */
export const MACHINE_DEMAND = 2;
/** One organ of a kind gives this much against one unit of size. deep-tension: a heart reaches two
 *  and a half (more than one organ in three must be a heart where the floors ask more), a nerve speeds four. */
export const ORGAN_K = 4;
export const HEART_K = 2.5;
export const NERVE_K = 4;
/** The lid gives this much reach (PULSE) and this much speed (FLESH) by itself: a small body is green. */
export const LID_REACH = 5;
export const LID_NERVE = 4;
/** The weakest gauge sets the pace of every take; never slower than this. */
export const PACE_MIN = 0.2;

/** A take costs this much MASS on floor 0 ... */
export const TAKE_MASS = 12;
/** ... times this for every chamber taken before it (the price grows with the body) ... */
export const TAKE_STEP = 1.05;
/** deep-pass3: the colony size TAKE_STEP is tuned on; a bigger one spreads the step over its chambers. */
export const TAKE_REF = 48;
/** deep-pass3 (B402): a floor below the fourth costs (in mass and in work) what the fourth does: a colony a
 *  floor deeper than TAKE_REF's spent a third of GROW on its fifth floor alone. */
export const FLOOR_TOP = 3;
const floorK = (floor) => Math.max(0, Math.min(FLOOR_TOP, floor || 0));
const roomCache = new WeakMap();
function roomCount(graph) {
    let n = roomCache.get(graph);
    if (n === undefined) {
        n = graph.nodes.filter((x) => x.kind === 'room').length;
        roomCache.set(graph, n);
    }
    return n;
}
/** ... times this a floor down ... */
export const TAKE_FLOOR = 1.6;
/** ... and the machine house this many times. */
export const TAKE_MACHINE = 3;
/** A take needs this much WORK (a pump on the beat with one heart is 3) on floor 0: four pumps on the beat ... */
export const TAKE_WORK = 13;
/** ... times this a floor down, and the machine house this many times. */
export const WORK_FLOOR = 1.35;
export const WORK_MACHINE = 2;
/** A regrow needs this share of a take's work. */
export const REGROW_WORK = 0.5;

/** THE PUMP IS A DRUM (deep-tension). One pump fills PUMP_STEP of work times PUMP_ON_BEAT on the beat
 *  and PUMP_OFF_BEAT off it: off the beat it does nothing and breaks the streak. */
export const PUMP_STEP = 1;
export const PUMP_ON_BEAT = 3;
export const PUMP_OFF_BEAT = 0;
/** THE SURGE: every pump on the beat in a row adds SURGE_STEP to every pump after it, up to SURGE_MAX
 *  pumps in a row; a pump off the beat, or SURGE_IDLE_S seconds without one, ends it. It carries from
 *  one take into the next. */
export const SURGE_STEP = 0.12;
export const SURGE_MAX = 5;
export const SURGE_IDLE_S = 3;
export const surgeOf = (streak) => 1 + SURGE_STEP * Math.max(0, Math.min(SURGE_MAX, streak || 0));
/** Each heart beyond the lid makes a pump this much stronger, up to PUMP_HEARTS_MAX times. */
export const PUMP_PER_HEART = 0.12;
export const PUMP_HEARTS_MAX = 1.8;
/** Left alone, awake, a take fills by itself this much work a second at full pace (a drummer fills about
 *  ten times that). */
export const TRICKLE = 0.3;
/** Dreaming, this much a second (the idle player still grows; the active one is clearly faster). */
export const DREAM_TRICKLE = 1.0;

/** A gut makes this much mass a second on floor 0. deep-tension: the guts are the ONLY source. */
export const GUT_MASS = 0.19;
/** The lid makes this much mass a second by itself (deep-tension): barely anything, but never nothing, so
 *  a body that spent its mass on vats is slow to come back, not stuck. The vats never eat the lid's. */
export const LID_MASS = 0.1;
/** deep-tension: every living vat eats this much mass a second (times what it asks a floor down). */
export const VAT_MASS = 0.12;
/** A pump with no take in progress sends the blood to the guts: this many seconds of their mass. */
export const PUMP_MASS_S = 0.35;
/** deep-tension: and on the beat the blood brings this much mass by itself (a young body with one gut
 *  drummed ten times for one take in the play pass) times the surge. */
export const PUMP_MASS_FLAT = 0;

/* ------------------------------------------------------------------ reading the body */
/** Every node of the graph by id (cached per graph). */
const byIdCache = new WeakMap();
export function nodeOf(graph, id) {
    let m = byIdCache.get(graph);
    if (!m) { m = new Map(graph.nodes.map((n) => [n.id, n])); byIdCache.set(graph, m); }
    return m.get(id) || null;
}
/** The organ a body node is: 'heart' for the lid, 'spine' for a landing, 'hands' for the machine
 *  house, else what was chosen (st.organs), or null. */
export function organOf(graph, st, id) {
    if (id === HEART) return 'heart';
    const n = nodeOf(graph, id);
    if (!n) return null;
    if (n.kind === 'hub') return 'spine';
    if (n.kind === 'machine') return 'hands';
    return (st.organs && st.organs[id]) || null;
}
/** The floors that are full, as a set. */
export function fullFloors(graph, st) {
    const out = new Set();
    const floors = new Set(graph.nodes.filter((n) => n.floor >= 0).map((n) => n.floor));
    for (const f of floors) if (floorFull(graph, st, f)) out.add(f);
    return out;
}
const demandOf = (n) => (n.kind === 'machine' ? MACHINE_DEMAND : Math.pow(DEMAND_FLOOR, Math.max(0, n.floor)));
const supplyOf = (n, full) => Math.pow(SUPPLY_FLOOR, Math.max(0, n.floor)) * (full.has(n.floor) ? FULL_FLOOR : 1);

/**
 * The body's size (what it asks of its hearts and nerves) and what each kind of organ gives.
 * Living organs only: dead flesh asks nothing and gives nothing. The lid counts 1, a landing 0.
 * (MUSCLE is not in here: it doubles what the guts and the vats MAKE, grow.js, not the reach or the speed.)
 * @returns {{size:number, give:{vat:number,gut:number,heart:number,nerve:number}, count:object, full:Set<number>}}
 */
export function bodySums(graph, st) {
    const full = fullFloors(graph, st);
    const give = { vat: 0, gut: 0, heart: 0, nerve: 0 };
    const count = { vat: 0, gut: 0, heart: 0, nerve: 0 };
    let size = 0, vatAsk = 0;
    for (const id of st.body) {
        if (isNecrotic(st, id)) continue;
        const n = nodeOf(graph, id);
        if (!n) continue;
        if (id === HEART) { size += 1; continue; }
        if (n.kind === 'hub') continue;
        size += demandOf(n);
        const o = organOf(graph, st, id);
        if (ORGANS.includes(o)) { give[o] += supplyOf(n, full); count[o]++; }
        if (o === 'vat') vatAsk += demandOf(n);
    }
    // deep-pass3 (B402): a colony bigger than TAKE_REF's makes its mass in proportion, so GROW lasts about as
    // long whatever the colony's size (a colony of 60 chambers rose after half an hour)
    const scale = Math.max(1, roomCount(graph) / TAKE_REF);
    return { size, give, count, full, vatAsk, scale };
}
/** PULSE: the hearts' reach over the body's size (1: every organ is fed to the edge). */
export function pulseRatio(sums) { return reachOf(sums) / Math.max(1, sums.size); }
/** What the hearts can carry: the lid and HEART_K for each heart. */
export const reachOf = (sums) => LID_REACH + HEART_K * sums.give.heart;
/** FLESH: the nerves' speed over the body's size. */
export function nerveRatio(sums) { return (LID_NERVE + NERVE_K * sums.give.nerve) / Math.max(1, sums.size); }
/** The mass the guts make a second (times MUSCLE's `muscle`), before the vats eat theirs. */
export function gutRate(sums, muscle = 1) { return LID_MASS + GUT_MASS * sums.give.gut * muscle * (sums.scale || 1); }
/** What the living vats eat of it a second. */
export function vatMass(sums) { return VAT_MASS * (sums.vatAsk || 0) * (sums.scale || 1); }
/** The mass the body gains a second: the guts' less the vats'. deep-pass3 (B402): the vats eat the guts'
 *  mass, never the lid's, so it never falls under LID_MASS (below zero the mass sat at nothing for good: a
 *  body with more vats than guts read PUMP for half an hour in the sim, and the pumped mass was eaten). */
export function massRate(sums, muscle = 1) { return LID_MASS + Math.max(0, gutRate(sums, muscle) - LID_MASS - vatMass(sums)); }
/** The pace of a take: the weakest of the four ratios, never under PACE_MIN, never over 1. */
export const paceOf = (ratios) => Math.max(PACE_MIN, Math.min(1, ...Object.values(ratios)));
/** Nerves to spare (FLESH over 1) make every take quicker still: up to NERVE_SPEED more at FLESH 2. */
export const NERVE_SPEED = 0.4;
export const nerveSpeed = (H) => 1 + NERVE_SPEED * Math.max(0, Math.min(1, (Number(H) || 0) - 1));
/** The weakest gauge ('M' | 'F' | 'E' | 'H'): the lowest ratio, the first in M F E H order on a tie. */
export function weakestOf(ratios) {
    let best = null;
    for (const c of ['M', 'F', 'E', 'H']) if (Number.isFinite(ratios[c]) && (best === null || ratios[c] < ratios[best] - 1e-9)) best = c;
    return best || 'M';
}
/** How much stronger the player's pumps are for the hearts (beyond the lid). */
export const heartPump = (sums) => Math.min(PUMP_HEARTS_MAX, 1 + PUMP_PER_HEART * sums.count.heart);

/**
 * THE EDGE STARVES. The organs beyond the hearts' reach: walking out from the heart through the body,
 * the farthest living organs whose size the reach cannot carry. The lid, the landings and the machine
 * house never starve this way. @returns {string[]} ids, farthest first
 */
export function beyondReach(graph, st, sums, dist) {
    const cap = reachOf(sums);
    let over = sums.size - cap;
    if (over <= 1e-9) return [];
    const living = st.body.filter((id) => !isNecrotic(st, id) && id !== HEART && id !== MACHINE && nodeOf(graph, id)?.kind === 'room');
    living.sort((a, b) => ((dist.get(b) ?? 0) - (dist.get(a) ?? 0)) || (st.body.indexOf(b) - st.body.indexOf(a)));
    const out = [];
    for (const id of living) {
        if (over <= 1e-9) break;
        out.push(id);
        over -= demandOf(nodeOf(graph, id));
    }
    return out;
}
/** May a dead organ come back without starving the edge again? (Its size fits under the reach.) */
export function fitsReach(graph, sums, id) {
    const n = nodeOf(graph, id);
    if (!n) return false;
    return sums.size + demandOf(n) <= reachOf(sums) + 1e-9;
}

/* ------------------------------------------------------------------ prices and work */
/** The mass a take of `id` costs as `organ` after `taken` takes (CHEAP for the room's own organ). */
export function takeMass(graph, id, organ, taken = 0) {
    const n = nodeOf(graph, id);
    if (!n) return Infinity;
    // deep-pass3 (B402): the step per take is spread over a bigger colony, so its last take costs what the
    // last take of a TAKE_REF colony does (1.05 a take made a colony of 60 chambers cost 45 times as much at
    // the end, and GROW ran half an hour)
    const per = Math.max(0, taken) * TAKE_REF / Math.max(TAKE_REF, roomCount(graph));
    const k = Math.pow(TAKE_STEP, per) * Math.pow(TAKE_FLOOR, floorK(n.floor));
    if (n.kind === 'machine') return Math.ceil(TAKE_MASS * TAKE_MACHINE * k);
    const cheap = cheapOrgans(n.type).includes(organ) ? CHEAP : 1;
    return Math.ceil(TAKE_MASS * k * cheap);
}
/** The mass to grow a living organ again into `organ`. */
export function regrowMass(graph, id, organ, taken = 0) {
    return Math.ceil(takeMass(graph, id, organ, taken) * REGROW);
}
/** The work a take of `id` needs (pumps fill it; the trickle and the dream too). */
export function takeWork(graph, id, { regrow = false } = {}) {
    const n = nodeOf(graph, id);
    if (!n) return Infinity;
    // deep-pass3 (B402): in a colony bigger than TAKE_REF's a take is that much less work (more of them)
    const w = TAKE_WORK * Math.pow(WORK_FLOOR, floorK(n.floor)) * (n.kind === 'machine' ? WORK_MACHINE : 1)
        * TAKE_REF / Math.max(TAKE_REF, roomCount(graph));
    return regrow ? w * REGROW_WORK : w;
}
/** What one pump fills: the beat, the hearts, the pace, the surge. */
export function pumpFill({ beat = false, hearts = 1, pace = 1, surge = 1 } = {}) {
    return PUMP_STEP * (beat ? PUMP_ON_BEAT : PUMP_OFF_BEAT) * hearts * pace * surge;
}
/** What a second fills by itself: awake (TRICKLE) or dreaming (DREAM_TRICKLE); `spread` is SPREAD's factor. */
export function trickleFill({ pace = 1, dreaming = false, spread = 1 } = {}) {
    return (dreaming ? DREAM_TRICKLE : TRICKLE) * pace * spread;
}

/**
 * The organ the body needs most: the weakest gauge's, unless that is MASS while a gut cannot be had
 * cheaper than the weakest after it. The dream picks with it, and the sim's player.
 */
export function neededOrgan(ratios) { return GAUGE_ORGAN[weakestOf(ratios)]; }

/**
 * The organ a save from before deep-organs gives each chamber of its body: the cheap one for the room
 * (a farm alternates vat and gut), an empty or unknown chamber a nerve then a heart, in turn.
 * @returns {Object<string,string>}
 */
export function migrateOrgans(graph, body) {
    const out = {};
    let farm = 0, other = 0;
    for (const id of body) {
        const n = nodeOf(graph, id);
        if (!n || n.kind !== 'room') continue;
        if (n.type === 'farm') out[id] = (farm++ % 2) ? 'gut' : 'vat';
        else if (cheapOrgans(n.type).length) out[id] = cheapOrgans(n.type)[0];
        else out[id] = (other++ % 2) ? 'heart' : 'nerve';
    }
    return out;
}
