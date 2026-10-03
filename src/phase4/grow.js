/**
 * Chapter IV · THE DEEP, movement III · GROW, as the colony plays it. Pure: no DOM, no three.js, no
 * clock of its own. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "III · GROW" and the
 * passes after it.
 *
 * growth.js holds the body's rules on a graph of chambers (the front, the hunger, the vats, the
 * rise); organs.js (deep-organs) the organs the player grows. This file puts them on the colony:
 * where the body lives in the save (`state.grow`), the take in progress and its pumps, the body's own
 * clock, what the organs make (deep.js reads `state.organs`), the four gauges, the one word of advice,
 * the two lamps of the rise and the drawer's four items.
 *
 * deep-organs (Ola on v1.78.0: "From when you start becoming flesh you have zero things to do"):
 *   - EVERY TAKE IS A CHOICE OF ORGAN, paid in MASS (the body's currency; its guts make it). A click on
 *     a chamber in reach opens a ring of four organs, each with its price (organs.js).
 *   - PUMPING TAKES CHAMBERS. A take in progress (`grow.take`) needs WORK; the player's pumps fill it
 *     (on the beat double, off it half, more with every heart), the body fills it slowly by itself
 *     awake and a little faster dreaming. The active player is clearly faster.
 *   - THE FOUR GAUGES ARE THE FOUR ORGANS (MASS guts, FEED vats, PULSE hearts, FLESH nerves); the
 *     weakest sets the pace of every take, and the tape names the organ to grow.
 *   - THE EDGE STARVES two ways: FEED empty (growth.js, a dead room a body year) or the hearts'
 *     reach short of the body's size (organs.js beyondReach). Both revive by themselves once fixed.
 *   - A FULL FLOOR cascades: its organs give twice, the landing below becomes spine by itself.
 *
 * THE BODY'S TIME is real seconds now (it was colony days): awake a body second is a real second, a
 * body year every BODY_YEAR_S of them; the colony's calendar runs a day a second awake and dives in a
 * dream, as before.
 *
 * THE BODY'S PEOPLE. The body eats people every year. The colony's numbers differ by orders of
 * magnitude from one save to the next, so the body counts people in UNITS: a hundredth of the colony on
 * the day The question was answered (`grow.unit`). The body never eats the last MIN_SLEEPERS.
 *
 * Every number is a named constant, here or in organs.js, tuned with scripts/sim-phase4.mjs.
 */

import {
    graphFromSlots, reachableFrom, take, tick, hunger, outputMultiplier, floorFull, distances, mass as bodyMass,
    riseReady as bodyReady, isNecrotic, slotOf, MACHINE, HEART, hubId,
} from './growth.js';
import { gift, MIN_SLEEPERS, ROOMS, vatsLevel, tickDay } from './deep.js';
import { LADDER } from './watcher.js';
import { short, ORE_SIGN, PEOPLE_SIGN, MASS_SIGN } from './readout.js';
import { fallK, GREEN_FROM, GREEN_SPAN, RED_K } from './instruments.js';
import { graftOrgans, normalizeGraft } from './graft.js';
import {
    ORGANS, ORGAN_NAME, ORGAN_DOES, GAUGE_ORGAN, cheapOrgans, organOf, bodySums, pulseRatio, nerveRatio, massRate,
    paceOf, nerveSpeed, weakestOf, heartPump, beyondReach, fitsReach, takeMass, regrowMass, takeWork, pumpFill, trickleFill,
    migrateOrgans, fullFloors, nodeOf as organNode, PUMP_ON_BEAT, PUMP_OFF_BEAT, PUMP_MASS_S, gutRate, vatMass, surgeOf,
    SURGE_MAX, SURGE_IDLE_S, LID_MASS, PUMP_MASS_FLAT,
} from './organs.js';

/* ------------------------------------------------------------------ the numbers */
/** Awake in GROW the calendar runs as in TEND, a day a real second; time moves in the dreams. */
export const GROW_DAYS_PER_SECOND = 1;
/** A dream runs this many colony days a real second at full pace (the dive, as a sleep does). */
export const DREAM_DAYS_PER_SECOND = 120;
/** The dream's dive: it starts at DREAM_START of the pace, is at full pace after DREAM_FULL_S real
 *  seconds, then deepens toward DREAM_DEEP times it with a DREAM_TAU second time constant. */
export const DREAM_START = 0.8;
export const DREAM_FULL_S = 3;
export const DREAM_DEEP = 2;
export const DREAM_TAU = 30;
/** The colony days a dream runs between `t` and `t + dt` real seconds into it (the dive). */
export function dreamDaysAt(t, dt) {
    const pace = (x) => (x < DREAM_FULL_S
        ? DREAM_START + (1 - DREAM_START) * x / DREAM_FULL_S
        : 1 + (DREAM_DEEP - 1) * (1 - Math.exp(-(x - DREAM_FULL_S) / DREAM_TAU)));
    const n = Math.max(1, Math.ceil(dt / 0.05));
    let days = 0;
    for (let i = 0; i < n; i++) days += pace(t + (i + 0.5) * dt / n) * DREAM_DAYS_PER_SECOND * dt / n;
    return days;
}
/** The drawer's prices count real seconds of income at the dream's pace. */
export const INCOME_DAYS = DREAM_DAYS_PER_SECOND;
/** deep-organs: a year of the body every this many body seconds (awake, real seconds). */
export const BODY_YEAR_S = 3;
/** Kept for older callers: the body's year in colony days at a day a second. */
export const BODY_YEAR_DAYS = 365;
/** A body that took over the culture vats grows this many units a year per level of them. */
export const CULTURE_UNITS = 2;
/** The question gives the body at least this many vats at once (the culture vats the colony owns). */
export const QUESTION_VATS = 2;
/** The VATS row continues the vats up to this level. */
export const VATS_TOP = 8;
/** Each level of VATS: the vats grow this much more. */
export const VATS_STEP = 0.15;
/** deep-organs: a vat the player grows (growth.js VAT_GROWTH a year) counts this share of it: one vat feeds
 *  about three organs, so a body of one in four vats is a little more than fed. */
export const VAT_SCALE = 0.45;
/** Hunger grows with the body: a body of n organs eats EAT_SMALL + (1 - EAT_SMALL) * n / EAT_FULL of
 *  the full appetite (all of it from EAT_FULL organs on). The first takes eat little. */
export const EAT_SMALL = 0.35;
export const EAT_FULL = 14;
/** SPREAD: each level makes a take fill by itself this many times faster. */
export const SPREAD_STEP = 2;
export const SPREAD_TOP = 3;
/** At most this many marks at once. */
export const MARKS_MAX = 6;
/** APPETITE: what a chamber eats, times this per level. */
export const APPETITE_STEP = 0.7;
/** MUSCLE: what a living organ gives, times this per level. */
export const MUSCLE_STEP = 1.5;
/** The machine house as hands plays this many times the games on the same energy, times its PULSE. */
export const HANDS_GAMES = 3;
/** ... PULSE, as a factor on the hands, between these. */
export const HANDS_PULSE = [0.6, 2.5];
/** A colony with old biological steps (before deep-grow) starts with this many chambers a step. */
export const MIGRATE_PER_STEP = 3;
/** FEED is red under this many body years of the people. */
export const FEED_RED_YEARS = 4;
/** FEED limits the pace only when the people last fewer than this many body years. */
export const FEED_COVER_YEARS = 12;
/** THE EDGE STARVES: while organs stand beyond the hearts' reach, one dies every this many seconds. */
export const PULSE_STARVE_S = 3;
/** A dead room comes back every this many seconds while there are people and the reach for it. */
export const REVIVE_S = 3;
/** A pump with no take and a dead room: this share of a revival (on the beat double). */
export const PUMP_REVIVE = 0.35;
/** The body starts with this much mass: a few takes. */
export const START_MASS = 40;
/** MASS counts the mass in hand plus this many seconds of the guts against the next price. */
export const MASS_SECONDS = 12;
/** The tape says DREAM when the next take is further off than this many seconds of mass. */
export const DREAM_ADVISE_S = 25;
/** deep-tension: dreaming, the guts make this many times the mass. */
export const DREAM_MASS = 3;
/** A dream lasts this many body seconds, times FLESH (between DREAM_NERVE). */
export const DREAM_S = 30;
export const DREAM_NERVE = [0.6, 1.6];
/** SPREAD comes into the drawer after this many chambers taken by hand. */
export const SPREAD_AFTER = 10;
/** THE HEART's rhythm: the beat's window, the cooldown, and its own clock without the sound. */
export const BEAT_WINDOW = 0.15;
export const PUMP_COOLDOWN_MS = 380;
export const BEAT_MS = 1000;
/** Kept for older callers: what a pump counts on and off the beat. */
export { PUMP_ON_BEAT, PUMP_OFF_BEAT };
/** The end of the act: the body breaks the crust. */
export const GROW_END = { roman: 'V', title: 'UNITY' };
/** The last lines, in the Watcher's own hand. */
export const RISE_LINES = ['Humans are so small.', 'So fragile.'];

/**
 * The drawer's four items. `pile`: the first level costs at least this share of what is in hand at
 * the start; `secs`: a level costs at least this many real seconds of income at the dream's pace when
 * it becomes the next one, times `growth` for each level bought. VATS are paid in ore, the rest in
 * stars. `after`: when the item first comes into the drawer (unlockBody).
 */
export const BODY_ITEMS = [
    { id: 'vats', name: 'VATS', max: VATS_TOP, pile: 0.05, secs: 12, growth: 1.6, pay: 'ore', after: 'FEED falls' },
    { id: 'appetite', name: 'APPETITE', max: 4, pile: 0.5, secs: 80, growth: 2, pay: 'stars', after: 'the first necrosis' },
    { id: 'spread', name: 'SPREAD', max: SPREAD_TOP, pile: 0.35, secs: 70, growth: 2, pay: 'stars', after: `${SPREAD_AFTER} taken by hand` },
    { id: 'muscle', name: 'MUSCLE', max: 4, pile: 0.3, secs: 60, growth: 2, pay: 'stars', after: 'a floor full' },
];
const ITEM = Object.fromEntries(BODY_ITEMS.map((x) => [x.id, x]));

/* ------------------------------------------------------------------ the graph */
let cached = { key: null, graph: null };
/**
 * deep-swap: WHERE A CHAMBER SITS, AS THE PLAYER SEES IT. The body's neighbours must be the
 * neighbours on screen, so the active view says where chamber number i is. null: growth.js's default.
 */
let placeFn = null;
/** @param {((index:number)=>{floor:number, x:number, z:number})|null} fn */
export function setChamberPlace(fn) {
    const next = typeof fn === 'function' ? fn : null;
    if (next === placeFn) return;
    placeFn = next;
    cached = { key: null, graph: null };
}
/** The placement the body's graph is built with now (null: growth.js's default). */
export const chamberPlace = () => placeFn;
/** The colony's graph of chambers (growth.js graphFromSlots), kept while the layout is the same. */
export function graphOf(layout) {
    const slots = (layout && layout.slots) || [];
    const key = slots.map((t) => t || '.').join(',');
    if (cached.key !== key) cached = { key, graph: placeFn ? graphFromSlots(slots, placeFn) : graphFromSlots(slots) };
    return cached.graph;
}
const nodeOf = (graph, id) => organNode(graph, id);

/* ------------------------------------------------------------------ the save */
/** Is movement III under way (or over)? */
export const growOn = (s) => !!(s && s.grow && typeof s.grow === 'object');
/** Has the body risen (the act is over)? */
export const risen = (s) => growOn(s) && !!s.grow.risen;
/** The old biological steps a save owns (before deep-grow), a step paid and waiting counted too. */
export function bioOwned(w) {
    const bought = (w && Array.isArray(w.bought)) ? w.bought : [];
    const n = bought.filter((id) => LADDER.some((u) => u.id === id && u.rung === 2)).length;
    return n + (w && w.sealing && !bought.includes(w.sealing) ? 1 : 0);
}
/** The body's own state, as growth.js and organs.js read it. */
const bodyState = (G) => ({ body: G.body, necrotic: G.necrotic, years: G.years || 0, organs: G.organs || {} });
const muscleOf = (G) => Math.pow(MUSCLE_STEP, (G.lv && G.lv.muscle) || 0);

/**
 * The question is answered: the body begins. The lid is its first organ (a heart); the culture vats
 * the colony built for the sleep are the body's first vats.
 * @param {object} s - mutated
 * @param {object} [report] - tickDay's report for the day (the anchors)
 * @returns {object} s.grow
 */
export function startGrow(s, report = null) {
    // deep-tension: the body's prices read the machine's own stars, not the awake floor (deep.js
    // AWAKE_SHARE), which ends with the question
    let r = report || {};
    if (s.income && (s.cryo ?? -1) >= 0) { const dry = JSON.parse(JSON.stringify(s)); dry.grow = {}; r = { ...r, stars: tickDay(dry, false).stars }; }
    const starsDay = Math.max(100, Number.isFinite(r.stars) ? r.stars : 0);
    const oreDay = Math.max(50, Number.isFinite(r.minerals) ? r.minerals : 0);
    const vats = Math.max(QUESTION_VATS, vatsLevel(s));
    s.grow = {
        body: [HEART], necrotic: [], years: 0,
        unit: Math.max(1, (s.humans || 0) / 100),
        oreDay, starsDay,
        prices: {},
        lv: { vats, spread: 0, appetite: 0, muscle: 0 },
        clock: 0, taken: 0, startDay: s.day || 0,
        overgrown: false, hands: false, risen: false, migrated: 0,
        vatsBase: vats, hand: 0, seen: { vats: false, appetite: false, spread: false, muscle: false },
        marks: [], dreaming: false, dreamFed: false, dreamMarks: 0, dreamS: 0,
        // deep-organs
        organs: {}, mass: START_MASS, take: null, full: [], starve: 0, revive: 0, regrown: 0,
    };
    for (const x of BODY_ITEMS) setPrice(s, x.id, { stars: starsDay, ore: oreDay }, x.pay === 'ore' ? s.minerals || 0 : s.stars || 0);
    return s.grow;
}
/** The price of an item's next level, set now: see BODY_ITEMS. `perDay`: { stars, ore } a day. */
function setPrice(s, id, perDay, pile = 0, paid = 0) {
    const x = ITEM[id];
    const G = s.grow;
    const lv = G.lv[id] || 0;
    const from = id === 'vats' ? Math.min(lv, G.vatsBase ?? vatsLevel(s)) : 0;
    const bought = Math.max(0, lv - from);
    const day = typeof perDay === 'object' && perDay ? (x.pay === 'ore' ? perDay.ore : perDay.stars) : perDay;
    const income = Math.max(x.pay === 'ore' ? 50 : 100, day || 0) * INCOME_DAYS;
    G.prices[id] = Math.round(Math.max(pile * x.pile, paid * x.growth, income * x.secs * Math.pow(x.growth, bought)));
}

/**
 * Makes the save's body fit the colony, and starts it for a save that has answered The question
 * (or owns old biological steps) but has none. deep-organs: a body from before the organs is given
 * them (organs.js migrateOrgans: each chamber the organ its room made cheap) and mass for a few takes;
 * nothing it had is lost. A colony at the old ending (the Watcher alone) stays there.
 * @param {object} s - mutated
 * @param {object} layout
 * @param {object} [report]
 * @returns {boolean} whether movement III is on
 */
export function normalizeGrow(s, layout, report = null) {
    const w = s.watcher || {};
    if (!growOn(s)) {
        if (w.gone || s.ascended) return false;
        const steps = bioOwned(w);
        if (!gift(s, 'question') && steps === 0) return false;
        startGrow(s, report);
        s.graft = normalizeGraft(s.graft);
        s.graft.owed = 0;               // a graft not placed before the question is not placed now
        if (steps > 0) {
            const graph = graphOf(layout);
            let st = bodyState(s.grow);
            for (let i = 0; i < steps * MIGRATE_PER_STEP; i++) {
                const next = [...reachableFrom(graph, st).keys()].filter((id) => id !== MACHINE).sort(nearFirst(graph))[0];
                if (!next) break;
                st = take(graph, st, next);
            }
            s.grow.body = st.body;
            s.grow.organs = migrateOrgans(graph, st.body);
            s.grow.migrated = st.body.length - 1;
            s.grow.taken = s.grow.migrated;
            s.grow.seen.vats = true;
        }
        w.sealing = null;
        return true;
    }
    const G = s.grow;
    const graph = graphOf(layout);
    const ids = new Set(graph.nodes.map((n) => n.id));
    G.body = [...new Set((Array.isArray(G.body) ? G.body : []).filter((id) => ids.has(id)))];
    if (!G.body.includes(HEART)) G.body.unshift(HEART);
    G.necrotic = [...new Set((Array.isArray(G.necrotic) ? G.necrotic : []).filter((id) => G.body.includes(id) && id !== HEART))];
    G.lv = { vats: 0, spread: 0, appetite: 0, muscle: 0, ...(G.lv || {}) };
    for (const x of BODY_ITEMS) G.lv[x.id] = Math.max(0, Math.min(x.max, Math.floor(Number(G.lv[x.id]) || 0)));
    for (const k of ['unit', 'oreDay', 'starsDay']) if (!(Number(G[k]) > 0)) G[k] = k === 'unit' ? 1 : 100;
    G.prices = G.prices && typeof G.prices === 'object' ? G.prices : {};
    for (const x of BODY_ITEMS) if (!(Number(G.prices[x.id]) > 0)) setPrice(s, x.id, G.starsDay, s.stars || 0);
    for (const k of ['clock', 'years', 'taken']) G[k] = Number.isFinite(G[k]) ? G[k] : 0;
    // deep-grow2: each drawer item it has bought, or whose moment has already come, is seen
    const old = !G.seen || typeof G.seen !== 'object';
    if (!Number.isFinite(G.vatsBase)) G.vatsBase = Math.min(G.lv.vats, Math.max(QUESTION_VATS, vatsLevel(s)));
    if (!Number.isFinite(G.hand)) G.hand = Math.max(0, (G.taken || 0) - (G.migrated || 0));
    G.seen = { vats: false, appetite: false, spread: false, muscle: false, ...(old ? {} : G.seen) };
    if (old) G.seen.vats = G.lv.vats > G.vatsBase || G.body.length > 1;
    for (const k of ['appetite', 'spread', 'muscle']) if (G.lv[k] > 0) G.seen[k] = true;
    G.marks = Array.isArray(G.marks) ? [...new Set(G.marks.filter((id) => ids.has(id) && !G.body.includes(id)))].slice(0, MARKS_MAX) : [];
    for (const k of ['dreamMarks', 'dreamS']) G[k] = Number.isFinite(G[k]) ? G[k] : 0;
    // a dream is not kept over a reload: the body wakes
    G.dreaming = false;
    G.dreamFed = !!G.dreamFed;
    // deep-organs: a body from before the organs is given them, and mass for a few takes
    const fresh = !G.organs || typeof G.organs !== 'object';
    G.organs = fresh ? migrateOrgans(graph, G.body) : Object.fromEntries(Object.entries(G.organs)
        .filter(([id, o]) => G.body.includes(id) && ORGANS.includes(o) && nodeOf(graph, id)?.kind === 'room'));
    for (const id of G.body) if (nodeOf(graph, id)?.kind === 'room' && !G.organs[id]) Object.assign(G.organs, migrateOrgans(graph, [id]));
    if (!Number.isFinite(G.mass)) G.mass = fresh ? Math.max(START_MASS, 2 * takeMass(graph, HEART, 'heart', G.taken)) : START_MASS;
    G.mass = Math.max(0, G.mass);
    for (const k of ['starve', 'revive', 'regrown']) G[k] = Number.isFinite(G[k]) ? G[k] : 0;
    G.full = Array.isArray(G.full) ? G.full.filter((f) => Number.isInteger(f)) : [];
    const T = G.take;
    G.take = T && typeof T === 'object' && ids.has(T.id) && (ORGANS.includes(T.organ) || T.organ === 'hands') && Number(T.work) > 0
        ? { id: T.id, organ: T.organ, work: Number(T.work), done: Math.max(0, Math.min(Number(T.work), Number(T.done) || 0)), regrow: T.regrow || null, by: T.by === 'dream' ? 'dream' : 'hand' }
        : null;
    if (G.take && !G.take.regrow && G.body.includes(G.take.id)) G.take = null;
    // the old SPREAD (a chamber by itself every few seconds) is a faster trickle now: nothing to migrate
    delete G.growing; delete G.spreadClock; delete G.dreamClock;
    // the floors already full have cascaded; their landings below are spine (silently, on a load)
    settleFloors(s, layout, { silent: true });
    unlockBody(s, layout);
    w.sealing = null;
    return true;
}
/** Nearest the heart first (the floor, then the ring, then the slot). */
const nearFirst = (graph) => (a, b) => {
    const na = nodeOf(graph, a), nb = nodeOf(graph, b);
    return (na.floor - nb.floor) || ((Math.abs(na.x) + Math.abs(na.z)) - (Math.abs(nb.x) + Math.abs(nb.z))) || (slotOf(a) - slotOf(b));
};

/* ------------------------------------------------------------------ the people */
/** The people the body may eat: all but the last MIN_SLEEPERS. */
export const feedOf = (s) => Math.max(0, (s.humans || 0) - MIN_SLEEPERS);
/** The living organs that eat (not the vats, the heart, the landings or the dead). */
function eaters(s, layout) {
    const graph = graphOf(layout);
    let n = 0;
    for (const id of s.grow.body) {
        if (id === HEART || isNecrotic(bodyState(s.grow), id)) continue;
        const o = organOf(graph, bodyState(s.grow), id);
        if (o && o !== 'vat' && o !== 'spine') n++;
    }
    return n;
}
/** How much of its full appetite a body of n eating organs has: little at first (EAT_SMALL). */
export const sizeAppetite = (n) => Math.min(1, EAT_SMALL + (1 - EAT_SMALL) * Math.max(0, n) / EAT_FULL);
/** The growth.js options for this colony: the drawer's VATS and APPETITE, the culture vats, the
 *  body's size (a small body eats little) and MUSCLE on the vats. */
export function growOpts(s, layout = null) {
    const lv = s.grow.lv;
    const size = layout ? sizeAppetite(eaters(s, layout)) : 1;
    return {
        levels: {},
        eat: Math.pow(APPETITE_STEP, lv.appetite) * size,
        grow: VAT_SCALE * (1 + VATS_STEP * lv.vats) * muscleOf(s.grow) * (layout ? vatsFed(s, layout) : 1),
        extra: CULTURE_UNITS * lv.vats,
    };
}
/**
 * deep-tension: THE VATS EAT MASS. With mass in hand they are fed; with none, they grow only as much as
 * the guts' mass covers of what they eat (a body of vats and no guts grows nobody).
 */
export function vatsFed(s, layout) {
    const G = s.grow;
    if (!G || (G.mass || 0) > 1e-6) return 1;
    const graph = graphOf(layout);
    const sums = bodySums(graph, bodyState(G));
    const ask = vatMass(sums);
    return ask > 0 ? Math.max(0, Math.min(1, gutRate(sums, muscleOf(G)) / ask)) : 1;
}
/** What the body eats and grows a year, in people. */
export function hungerNow(s, layout) {
    const G = s.grow;
    const h = hunger(graphOf(layout), bodyState(G), {}, growOpts(s, layout));
    return { eat: h.eat * G.unit, grow: h.grow * G.unit, net: h.net * G.unit };
}
/** Body years the people available last at this hunger (Infinity when the body is fed). */
export function feedYears(s, layout) {
    const h = hungerNow(s, layout);
    return h.net >= 0 ? Infinity : feedOf(s) / -h.net;
}
/** deep-organs: the people the colony gains (+) or loses (-) a real second, awake (the counter). */
export function peoplePerSecond(s, layout) {
    if (!growOn(s) || risen(s)) return 0;
    return hungerNow(s, layout).net / BODY_YEAR_S;
}
/** Kept for older callers: the people a colony day, at a day a second awake. */
export const peoplePerDay = (s, layout) => peoplePerSecond(s, layout);

/**
 * One year of the body: the vats grow, the body eats; short, the outermost organ dies back; fed
 * again the innermost revives (growth.js tick), but only where the hearts reach (organs.js).
 * @returns {{died:string[], revived:string[], eaten:number, grown:number}}
 */
export function bodyYear(s, layout) {
    const G = s.grow;
    const graph = graphOf(layout);
    const keep = Math.min(s.humans || 0, MIN_SLEEPERS);
    const r = tick(graph, bodyState(G), feedOf(s) / G.unit, growOpts(s, layout));
    s.humans = keep + r.people * G.unit;
    G.necrotic = r.state.necrotic;
    G.years = r.state.years;
    // a revival the hearts cannot reach stays dead (it would only starve again)
    const revived = [];
    for (const id of r.revived) {
        if (fitsReach(graph, bodySums(graph, bodyState(G)), id)) revived.push(id);
        else G.necrotic = [...G.necrotic, id];
    }
    if (G.take && G.take.regrow && G.necrotic.includes(G.take.id)) G.take = null;
    return { died: r.died, revived, eaten: r.eaten * G.unit, grown: r.grown * G.unit };
}

/* ------------------------------------------------------------------ the four gauges */
/**
 * deep-organs: THE FOUR RATIOS, one per organ (1 is enough), and what follows from them.
 *   M MASS: the mass in hand and MASS_SECONDS of the guts against the cheapest take in reach
 *   F FEED: what the vats grow over what the body eats
 *   E PULSE: the hearts' reach over the body's size
 *   H FLESH: the nerves' speed over the body's size
 * `pace`: the weakest of F (while the people run short), E and H, between PACE_MIN and 1: every take
 * fills at it. MASS limits by itself (a take must be paid). `weakest`: the lowest of the four.
 */
export function bodyRatios(s, layout) {
    const G = s.grow;
    const graph = graphOf(layout);
    const st = bodyState(G);
    const sums = bodySums(graph, st);
    const rate = massRate(sums, muscleOf(G));
    const price = nextPrice(s, layout);
    const M = Number.isFinite(price) ? (G.mass + rate * MASS_SECONDS) / price : 2;
    const h = hungerNow(s, layout);
    const F = h.eat > 0 ? h.grow / h.eat : 2;
    const E = pulseRatio(sums);
    const H = nerveRatio(sums);
    const years = h.net >= 0 ? Infinity : feedOf(s) / -h.net;
    const Feff = years >= FEED_COVER_YEARS ? Math.max(1, F) : F;
    const ratios = { M, F, E, H };
    // the speed of a take: the pace the weakest allows, and the nerves to spare on top (organs.js)
    const pace = paceOf({ F: Feff, E, H });
    return { ratios, pace, speed: pace * nerveSpeed(H), weakest: weakestOf(ratios), sums, massRate: rate, price, years };
}
/** The cheapest take in reach (its cheap organ where it has one), or Infinity with none. */
export function nextPrice(s, layout) {
    const G = s.grow;
    const graph = graphOf(layout);
    let best = Infinity;
    for (const id of reachableFrom(graph, bodyState(G)).keys()) {
        const n = nodeOf(graph, id);
        if (!n || n.kind === 'hub') continue;
        const organs = n.kind === 'machine' ? ['hands'] : ORGANS;
        for (const o of organs) best = Math.min(best, takeMass(graph, id, o, G.taken));
    }
    return best;
}
/** The pace of a take now (0.3 to 1). */
export const paceNow = (s, layout) => bodyRatios(s, layout).pace;

/* ------------------------------------------------------------------ one choice at a time */
/**
 * The drawer opens empty; each item comes when it is needed. VATS when FEED first falls, APPETITE
 * after the first necrosis, SPREAD after SPREAD_AFTER chambers taken by hand, MUSCLE once the first
 * floor is full.
 * @returns {string[]} the items seen for the first time now
 */
export function unlockBody(s, layout) {
    if (!growOn(s)) return [];
    const G = s.grow;
    const fresh = [];
    const see = (id, cond) => { if (!G.seen[id] && cond) { G.seen[id] = true; fresh.push(id); } };
    see('vats', G.necrotic.length > 0 || (!G.seen.vats && hungerNow(s, layout).net < 0));
    see('appetite', G.necrotic.length > 0);
    see('spread', (G.hand || 0) >= SPREAD_AFTER);
    see('muscle', floorFull(graphOf(layout), bodyState(G), 0));
    return fresh;
}

/* ------------------------------------------------------------------ taking a chamber */
/** Is a take in progress? */
export const taking = (s) => (growOn(s) && s.grow.take ? s.grow.take : null);
/** The chambers in reach that a ring may open on (the landings come by themselves). */
function inReach(s, layout) {
    const graph = graphOf(layout);
    return [...reachableFrom(graph, bodyState(s.grow)).keys()].filter((id) => nodeOf(graph, id)?.kind !== 'hub');
}
/**
 * THE RING: what each organ costs on chamber `id`, and whether it can be had now. A chamber in reach
 * offers the four (the machine house only its hands); a living organ of the body offers the other
 * three, to grow it again (`regrow`).
 * @returns {{id:string, regrow:string|null, organs:{organ:string, mass:number, ok:boolean, cheap:boolean, need:string}[]}|null}
 */
export function takeOffer(s, layout, id, { dream = false } = {}) {
    if (!growOn(s) || risen(s) || (s.grow.dreaming && !dream)) return null;
    const G = s.grow;
    const graph = graphOf(layout);
    const n = nodeOf(graph, id);
    if (!n || n.kind === 'hub') return null;
    const busy = !!G.take;
    const row = (organ, mass) => {
        const cheap = n.kind === 'room' && cheapOrgans(n.type).includes(organ);
        const lack = mass - G.mass;
        const need = busy ? 'The body is taking another chamber.' : lack > 0 ? `You need ${MASS_SIGN} ${short(Math.ceil(lack))} more.` : '';
        return { organ, mass, ok: !busy && lack <= 0, cheap, need };
    };
    if (G.body.includes(id)) {
        if (n.kind !== 'room' || isNecrotic(bodyState(G), id)) return null;
        const now = G.organs[id];
        return { id, regrow: now || null, organs: ORGANS.filter((o) => o !== now).map((o) => row(o, regrowMass(graph, id, o, G.taken))) };
    }
    if (!inReach(s, layout).includes(id)) return null;
    if (n.kind === 'machine') return { id, regrow: null, organs: [row('hands', takeMass(graph, id, 'hands', G.taken))] };
    return { id, regrow: null, organs: ORGANS.map((o) => row(o, takeMass(graph, id, o, G.taken))) };
}
/** Can a take of `id` begin now, with the cheapest organ it offers? */
export function canAfford(s, layout, id) {
    const o = takeOffer(s, layout, id);
    return !!o && !o.regrow && o.organs.some((r) => r.ok);
}
/**
 * The body begins to take `id` as `organ` (or grows a living organ again into it): the mass is paid
 * now; the take fills with work (pumps, the trickle, the dream) and is the body's when full.
 * @returns {{id:string, organ:string, mass:number, work:number, regrow:string|null}|null}
 */
export function startTake(s, layout, id, organ, { by = 'hand' } = {}) {
    const offer = takeOffer(s, layout, id, { dream: by === 'dream' });
    if (!offer) return null;
    const row = offer.organs.find((r) => r.organ === organ);
    if (!row || !row.ok) return null;
    const G = s.grow;
    const graph = graphOf(layout);
    G.mass -= row.mass;
    const work = takeWork(graph, id, { regrow: !!offer.regrow });
    G.take = { id, organ, work, done: 0, regrow: offer.regrow, by };
    return { id, organ, mass: row.mass, work, regrow: offer.regrow };
}
/**
 * Work into the take in progress. Full, it is the body's (or the organ is grown again).
 * @returns {object|null} the finished take (finishTake), or null
 */
export function fillTake(s, layout, work) {
    const T = taking(s);
    if (!T || !(work > 0)) return null;
    T.done = Math.min(T.work, T.done + work);
    if (T.done < T.work - 1e-9) return null;
    return finishTake(s, layout, { by: T.by || 'hand' });
}
/** The take in progress is done: the chamber is body (or its organ is new); a full floor cascades. */
function finishTake(s, layout, { by = 'hand' } = {}) {
    const G = s.grow;
    const T = G.take;
    G.take = null;
    const graph = graphOf(layout);
    if (T.regrow) {
        G.organs = { ...G.organs, [T.id]: T.organ };
        G.regrown = (G.regrown || 0) + 1;
        return { id: T.id, organ: T.organ, regrow: T.regrow, by, cascade: [], spine: [] };
    }
    const next = take(graph, bodyState(G), T.id);
    if (next.body === G.body) return null;
    G.body = next.body;
    if (T.organ !== 'hands') G.organs = { ...G.organs, [T.id]: T.organ };
    G.taken = (G.taken || 0) + 1;
    // the player's own choices: a click, or a mark it set reached in a dream (SPREAD comes after ten)
    if (by === 'hand' || (G.marks || []).includes(T.id)) G.hand = (G.hand || 0) + 1;
    G.marks = (G.marks || []).filter((m) => m !== T.id);
    const c = settleFloors(s, layout);
    return { id: T.id, organ: T.organ, regrow: null, by, from: reachFrom(graph, G, T.id), cascade: c.floors, spine: c.spine };
}
const reachFrom = (graph, G, id) => {
    const d = distances(graph, bodyState(G));
    let best = null;
    for (const e of graph.edges) {
        const o = e.a === id ? e.b : e.b === id ? e.a : null;
        if (o && o !== id && G.body.includes(o) && (best === null || (d.get(o) ?? 1e9) < (d.get(best) ?? 1e9))) best = o;
    }
    return best;
};
/**
 * THE CASCADE: every floor that has become full gives its organs FULL_FLOOR times (organs.js reads
 * the full floors from the body) and its landing below becomes spine by itself.
 * @returns {{floors:number[], spine:string[]}} what cascaded now
 */
export function settleFloors(s, layout, { silent = false } = {}) {
    const G = s.grow;
    const graph = graphOf(layout);
    const out = { floors: [], spine: [] };
    for (let guard = 0; guard < 64; guard++) {
        const full = fullFloors(graph, bodyState(G));
        let changed = false;
        for (const f of [...full].sort((a, b) => a - b)) {
            if (!G.full.includes(f)) { G.full.push(f); if (!silent) out.floors.push(f); changed = true; }
            const below = hubId(f + 1);
            if (nodeOf(graph, below) && !G.body.includes(below)) {
                G.body = [...G.body, below];
                if (!silent) out.spine.push(below);
                changed = true;
            }
        }
        if (!changed) break;
    }
    return out;
}
/**
 * Takes `id` at once (start and finish): the tests, an old caller, a migration. The organ defaults to
 * the room's cheap one, else what the body needs most.
 */
export function takeChamber(s, layout, id, { organ = null, by = 'hand' } = {}) {
    if (!growOn(s) || risen(s) || s.grow.take) return null;
    const graph = graphOf(layout);
    const n = nodeOf(graph, id);
    const pick = organ || (n && n.kind === 'machine' ? 'hands' : (cheapOrgans(n && n.type)[0] || GAUGE_ORGAN[bodyRatios(s, layout).weakest]));
    const t = startTake(s, layout, id, pick, { by });
    if (!t) return null;
    const done = fillTake(s, layout, t.work + 1);
    return done ? { ...done, mass: t.mass } : null;
}

/* ------------------------------------------------------------------ the hover */
/**
 * The words over the chamber under the cursor, in plain words (red when it is a warning).
 * @returns {{text:string, red:boolean}}
 */
export function takeTip(s, layout, id) {
    const none = { text: '', red: false };
    if (!growOn(s) || risen(s) || !id) return none;
    const G = s.grow;
    const graph = graphOf(layout);
    const n = nodeOf(graph, id);
    if (!n) return none;
    if (id === HEART) return { text: 'The heart. Click it to pump.', red: false };
    if (G.take && G.take.id === id) return { text: G.take.regrow ? `Growing into a ${ORGAN_NAME[G.take.organ].toLowerCase()}. Pump the heart.` : 'Taking it. Pump the heart.', red: false };
    if (G.body.includes(id)) {
        if (isNecrotic(bodyState(G), id)) return { text: starveWords(s, layout), red: true };
        if (n.kind !== 'room') return none;
        const o = G.organs[id];
        const word = adviseGrow(s, layout);
        const into = Object.keys(ORGAN_NAME).find((x) => word === growWord(x) && x !== o);
        const name = o ? ORGAN_NAME[o].toLowerCase() : 'chamber';
        return { text: into ? `A ${name}. Click to grow it into a ${ORGAN_NAME[into].toLowerCase()}.` : `A ${name}. Click to grow it into another.`, red: false };
    }
    if (inReach(s, layout).includes(id)) {
        if (G.take) return { text: 'The body is taking another chamber.', red: false };
        const offer = takeOffer(s, layout, id);
        const cheapest = Math.min(...offer.organs.map((r) => r.mass));
        const you = `${MASS_SIGN} ${short(Math.floor(G.mass))}`;
        if (cheapest > G.mass) return { text: `Needs ${MASS_SIGN} ${short(cheapest)}. You have ${you}.`, red: true };
        return { text: n.kind === 'machine' ? `The machine. Takes ${MASS_SIGN} ${short(cheapest)}.` : `Grow an organ here. From ${MASS_SIGN} ${short(cheapest)}.`, red: false };
    }
    const marked = (G.marks || []).includes(id);
    // deep-pass3: "Marked. Click to unmark." (marked for what?)
    return { text: marked ? 'Marked. Pull DREAM and the body grows toward it.' : 'Mark it. The body grows here as it dreams.', red: false };
}
/** The tip's words only (tests, older callers). */
export const takeWords = (s, layout, id) => takeTip(s, layout, id).text;

/* ------------------------------------------------------------------ the marks and the dream */
/** Mark a chamber the body should grow toward as it dreams, or take the mark off.
 *  @returns {boolean} whether it is marked now */
export function toggleMark(s, layout, id) {
    if (!growOn(s) || risen(s)) return false;
    const G = s.grow;
    if (!nodeOf(graphOf(layout), id) || G.body.includes(id)) return false;
    if ((G.marks || []).includes(id)) { G.marks = G.marks.filter((m) => m !== id); return false; }
    if ((G.marks || []).length >= MARKS_MAX) return false;
    G.marks = [...(G.marks || []), id];
    return true;
}
/** Graph steps from every node to the nearest of `targets`, over every edge (the rules aside). */
function stepsTo(graph, targets) {
    const adj = new Map(graph.nodes.map((n) => [n.id, []]));
    for (const e of graph.edges) { adj.get(e.a)?.push(e.b); adj.get(e.b)?.push(e.a); }
    const d = new Map(targets.map((t) => [t, 0]));
    const q = targets.slice();
    while (q.length) {
        const id = q.shift();
        for (const to of adj.get(id) || []) if (!d.has(to)) { d.set(to, d.get(id) + 1); q.push(to); }
    }
    return d;
}
/** The chamber in reach that brings the body nearest a mark, the cheaper on a tie; null without marks. */
export function markPick(s, layout) {
    const G = s.grow;
    if (!(G.marks || []).length) return null;
    const graph = graphOf(layout);
    const d = stepsTo(graph, G.marks);
    const ids = inReach(s, layout).filter((id) => d.has(id));
    const price = (id) => Math.min(...(takeOffer(s, layout, id, { dream: true })?.organs || [{ mass: Infinity }]).map((r) => r.mass));
    ids.sort((a, b) => (d.get(a) - d.get(b)) || (price(a) - price(b)) || nearFirst(graph)(a, b));
    return ids[0] || null;
}
/** For each mark, the body node its thread starts from (the nearest by the graph), for the view. */
export function markThreads(s, layout) {
    if (!growOn(s)) return [];
    const G = s.grow;
    const graph = graphOf(layout);
    return (G.marks || []).map((m) => {
        const d = stepsTo(graph, [m]);
        const from = G.body.filter((id) => d.has(id)).sort((a, b) => d.get(a) - d.get(b))[0] || HEART;
        return { id: m, from };
    });
}
/** The organ the dream grows in a chamber: the room's cheap one when the body needs it, else the weakest gauge's. */
export function dreamOrgan(s, layout, id) {
    const graph = graphOf(layout);
    const n = nodeOf(graph, id);
    if (!n) return null;
    if (n.kind === 'machine') return 'hands';
    const want = GAUGE_ORGAN[bodyRatios(s, layout).weakest];
    const offer = takeOffer(s, layout, id, { dream: true });
    const okNow = (o) => offer && offer.organs.some((r) => r.organ === o && r.ok);
    if (okNow(want)) return want;
    const cheap = cheapOrgans(n.type).find(okNow);
    return cheap || (offer ? (offer.organs.filter((r) => r.ok).sort((a, b) => a.mass - b.mass)[0] || {}).organ || null : null);
}
/** How long a dream lasts, in body seconds: FLESH lengthens it. */
export function dreamLength(s, layout) {
    const H = bodyRatios(s, layout).ratios.H;
    return DREAM_S * Math.max(DREAM_NERVE[0], Math.min(DREAM_NERVE[1], H));
}
/** The body lies down to dream. */
export function dreamStart(s, _layout) {
    if (!growOn(s) || risen(s)) return false;
    const G = s.grow;
    G.dreaming = true;
    G.dreamS = 0;
    G.dreamFed = feedOf(s) > 0;
    G.dreamMarks = (G.marks || []).length;
    return true;
}
export const dreaming = (s) => growOn(s) && !!s.grow.dreaming;
/**
 * Why the dream ends now, or '': HUNGER when a room dies while it dreams (after there were people to
 * spare), REACHED when every mark is body (or the body can rise), SPENT when its length is dreamt.
 * @param {object} out - stepGrow's report for the time just dreamt
 */
export function dreamWake(s, layout, out) {
    if (!dreaming(s)) return '';
    const G = s.grow;
    if (out && out.died && out.died.length && G.dreamFed) return 'HUNGER';
    if (feedOf(s) > 0) G.dreamFed = true;
    if (riseReady(s, layout).ready) return 'REACHED';
    if (G.dreamMarks > 0 && !(G.marks || []).length && !G.take) return 'REACHED';
    if (G.dreamS >= dreamLength(s, layout)) return 'SPENT';
    return '';
}
export function dreamEnd(s) { if (growOn(s)) s.grow.dreaming = false; }

/**
 * THE BODY'S CLOCK, in body seconds (awake, real seconds): a body year every BODY_YEAR_S; the guts make
 * mass; organs beyond the hearts' reach die one every PULSE_STARVE_S; a dead room revives every
 * REVIVE_S while there are people and the reach for it; the take in progress fills by itself (the
 * trickle, faster with SPREAD and in a dream); dreaming, the body begins a take toward the marks.
 * @param {object} s - mutated
 * @param {object} layout
 * @param {number} [secs]
 * @returns {{years:number, died:string[], revived:string[], done:object[], started:object[], seen:string[], mass:number}}
 */
export function stepGrow(s, layout, secs = 1) {
    const out = { years: 0, died: [], revived: [], done: [], started: [], seen: [], mass: 0 };
    if (!growOn(s) || risen(s) || !(secs > 0)) return out;
    const G = s.grow;
    const graph = graphOf(layout);
    G.clock += secs;
    while (G.clock >= BODY_YEAR_S) {
        G.clock -= BODY_YEAR_S;
        const r = bodyYear(s, layout);
        out.years++;
        out.died.push(...r.died);
        out.revived.push(...r.revived);
    }
    const R = bodyRatios(s, layout);
    // the guts make mass, the vats eat some of it (deep-tension); never below none
    // deep-tension: a dreaming body digests: the guts make DREAM_MASS times as much (a dream wakes to a
    // pile of mass to spend: the idle player's payoff)
    const made = (G.mass > 0 ? R.massRate : Math.max(LID_MASS, R.massRate)) * secs * (G.dreaming ? DREAM_MASS : 1);
    G.mass = Math.max(0, G.mass + made);
    out.mass = made;
    // deep-tension: the surge fades when the heart is left alone
    G.idle = (G.idle || 0) + secs;
    if (G.idle >= SURGE_IDLE_S) G.streak = 0;
    // the edge beyond the hearts' reach starves, one at a time
    const far = beyondReach(graph, bodyState(G), R.sums, distances(graph, bodyState(G)));
    if (far.length) {
        G.starve = (G.starve || 0) + secs;
        if (G.starve >= PULSE_STARVE_S) {
            G.starve = 0;
            const id = far[0];
            if (!G.necrotic.includes(id)) { G.necrotic = [...G.necrotic, id]; out.died.push(id); }
            if (G.take && G.take.regrow && G.take.id === id) G.take = null;
        }
    } else G.starve = 0;
    // a dead room comes back when there are people and the reach for it
    if (G.necrotic.length && feedOf(s) > 0 && !far.length) {
        G.revive = (G.revive || 0) + secs / REVIVE_S;
        if (G.revive >= 1) {
            G.revive = 0;
            const id = reviveOne(s, layout);
            if (id) out.revived.push(id);
        }
    } else if (!G.necrotic.length) G.revive = 0;
    // dreaming, the body begins a take toward the marks itself
    if (G.dreaming) {
        G.dreamS = (G.dreamS || 0) + secs;
        if (!G.take) {
            const id = markPick(s, layout);
            const organ = id ? dreamOrgan(s, layout, id) : null;
            const t = organ ? startTake(s, layout, id, organ, { by: 'dream' }) : null;
            if (t) out.started.push(t);
        }
    }
    // the take fills by itself: slowly awake, a little faster dreaming
    if (G.take) {
        const spread = Math.pow(SPREAD_STEP, G.lv.spread || 0);
        const w = trickleFill({ pace: R.speed, dreaming: !!G.dreaming, spread }) * secs;
        const done = fillTake(s, layout, w);
        if (done) out.done.push(done);
    }
    out.seen = unlockBody(s, layout);
    return out;
}
/** The innermost dead room that the hearts can reach comes back. */
function reviveOne(s, layout) {
    const G = s.grow;
    if (!G.necrotic.length) return null;
    const graph = graphOf(layout);
    const st = bodyState(G);
    const sums = bodySums(graph, st);
    const d = distances(graph, st);
    const order = G.necrotic.slice().sort((a, b) => (d.get(a) ?? 1e9) - (d.get(b) ?? 1e9));
    const id = order.find((x) => fitsReach(graph, sums, x));
    if (!id) return null;
    G.necrotic = G.necrotic.filter((x) => x !== id);
    return id;
}

/**
 * deep-organs: the way the pump's wave runs: from the heart through the body to `to` (a body node, or
 * the chamber being taken, reached from the body node beside it). @returns {string[]} ids, the heart first
 */
export function pumpPath(s, layout, to) {
    if (!growOn(s) || !to) return [];
    const graph = graphOf(layout);
    const body = new Set(s.grow.body);
    const adj = new Map(graph.nodes.map((n) => [n.id, []]));
    for (const e of graph.edges) { adj.get(e.a)?.push(e.b); adj.get(e.b)?.push(e.a); }
    const prev = new Map([[HEART, null]]);
    const q = [HEART];
    while (q.length) {
        const id = q.shift();
        if (id === to) break;
        for (const nx of adj.get(id) || []) {
            if (prev.has(nx) || (!body.has(nx) && nx !== to)) continue;
            prev.set(nx, id);
            q.push(nx);
        }
    }
    if (!prev.has(to)) return [HEART];
    const out = [];
    for (let id = to; id; id = prev.get(id)) out.unshift(id);
    return out;
}
/** Why a dead organ starves, in plain words: beyond the hearts' reach, or no people to eat. */
export function starveWords(s, layout) {
    const R = bodyRatios(s, layout);
    return R.ratios.E < 1 || feedOf(s) > 0 ? 'Starving. The hearts do not reach it.' : 'Starving. There are no people to eat.';
}

/* ------------------------------------------------------------------ the heart */
/**
 * Where a moment falls in the heart's beat: 0 on the thump, rising to 1 just before the next. `beat`
 * is the sound's ({ phase }) when it gives one, else the heart's own clock.
 */
export function beatPhase(nowMs, beat = null) {
    if (beat && Number.isFinite(beat.phase)) return ((beat.phase % 1) + 1) % 1;
    return ((nowMs % BEAT_MS) + BEAT_MS) % BEAT_MS / BEAT_MS;
}
export const onBeat = (phase) => phase <= BEAT_WINDOW || phase >= 1 - BEAT_WINDOW * 0.5;
/**
 * A PUMP of the heart. With a take in progress it fills it (organs.js pumpFill: the beat, the hearts,
 * the pace); with a dead room and people, it pushes the blood there (a share of a revival); else it
 * sends the blood to the guts (PUMP_MASS_S seconds of their mass). On the beat it counts double.
 * @param {object} s - mutated
 * @param {object} layout
 * @param {{beat?:boolean}} [o]
 * @returns {{k:number, to:string[], fill:number, take:object|null, done:object|null, revived:string|null, mass:number}|null}
 */
export function pump(s, layout, { beat = false } = {}) {
    if (!growOn(s) || risen(s) || s.grow.dreaming) return null;
    const G = s.grow;
    const R = bodyRatios(s, layout);
    const k = beat ? PUMP_ON_BEAT : PUMP_OFF_BEAT;
    // deep-tension: THE DRUM. On the beat the streak grows (the surge), off it the streak breaks and the
    // pump does nothing
    G.streak = beat ? Math.min(SURGE_MAX, (G.streak || 0) + 1) : 0;
    G.idle = 0;
    const surge = surgeOf(G.streak);
    const out = { k, surge, streak: G.streak, to: [], fill: 0, take: null, done: null, revived: null, mass: 0, miss: !beat };
    if (G.take) {
        const T = G.take;
        out.fill = pumpFill({ beat, hearts: heartPump(R.sums), pace: R.speed, surge });
        out.to = [T.id];
        out.take = { id: T.id, organ: T.organ };
        out.done = fillTake(s, layout, out.fill);
        return out;
    }
    if (G.necrotic.length && feedOf(s) > 0) {
        const graph = graphOf(layout);
        const d = distances(graph, bodyState(G));
        out.to = [G.necrotic.slice().sort((a, b) => (d.get(a) ?? 1e9) - (d.get(b) ?? 1e9))[0]];
        G.revive = (G.revive || 0) + PUMP_REVIVE * k * surge;
        if (G.revive >= 1) { G.revive = 0; out.revived = reviveOne(s, layout); }
        return out;
    }
    const guts = G.body.filter((id) => G.organs[id] === 'gut' && !G.necrotic.includes(id));
    out.mass = (gutRate(R.sums, muscleOf(G)) * PUMP_MASS_S * k + (beat ? PUMP_MASS_FLAT : 0)) * surge;
    G.mass += out.mass;
    out.to = guts.length ? guts : [HEART];
    return out;
}

/* ------------------------------------------------------------------ what the organs make */
/** How many times its old output a living organ makes now (MUSCLE and a full floor in), for the "×20". */
export function organMultiplier(s, layout, id) {
    if (!growOn(s)) return 1;
    const graph = graphOf(layout);
    const st = bodyState(s.grow);
    const n = nodeOf(graph, id);
    const full = n && s.grow.full.includes(n.floor) ? 2 : 1;
    return outputMultiplier(graph, st, id) * muscleOf(s.grow) * full;
}
/** What the colony counts each organ as (deep.js's room types): a vat feeds (a farm), a gut digests
 *  the rock (a mine), a heart drives (a generator); a nerve is speed only. */
export const ORGAN_ROOM = { vat: 'farm', gut: 'mine', heart: 'generator', nerve: null };
/**
 * What the body adds to each room type, counted in rooms of their old output (deep.js tickDay reads it
 * as `state.organs`). deep-organs: a chamber the body took no longer works as its room (its type loses
 * one) and works as its organ instead: x20 and more of that organ's room (growth.js outputMultiplier,
 * MUSCLE, a full floor). A dead organ makes nothing. `games`: the hands, with PULSE. `births` 0: from
 * the question on only the vats grow people. A lone graft (graft.js) makes GRAFT_MULT times.
 * @returns {{mine:number, farm:number, generator:number, dorm:number, games:number, births:number, eat:number}}
 */
export function organsOf(s, layout) {
    const g = graftOrgans(s, layout);
    const out = { mine: g.mine, farm: g.farm, generator: g.generator, dorm: g.dorm, games: 1, births: 1, eat: g.eat };
    if (!growOn(s)) return out;
    out.births = 0;
    const G = s.grow;
    const graph = graphOf(layout);
    const st = bodyState(G);
    const skip = new Set([...(s.darkSlots || []), ...(s.takenSlots || [])]);
    for (const id of G.body) {
        const n = nodeOf(graph, id);
        if (!n) continue;
        if (n.kind === 'machine') { if (!isNecrotic(st, id)) out.games = handsGames(s, layout); continue; }
        if (n.kind !== 'room' || skip.has(slotOf(id))) continue;
        if (ROOMS.includes(n.type)) out[n.type] -= 1;              // it is flesh now, not the room
        if (isNecrotic(st, id)) continue;
        const t = ORGAN_ROOM[G.organs[id]];
        if (t) out[t] += organMultiplier(s, layout, id);
    }
    return out;
}
/** The hands' games: HANDS_GAMES times PULSE (the hearts drive them), between HANDS_PULSE. */
export function handsGames(s, layout) {
    if (!growOn(s)) return 1;
    const E = bodyRatios(s, layout).ratios.E;
    return HANDS_GAMES * Math.max(HANDS_PULSE[0], Math.min(HANDS_PULSE[1], E));
}

/* ------------------------------------------------------------------ the instruments, overgrown */
/** Gauges in GROW: MASS (guts), FEED (vats), PULSE (hearts), FLESH (nerves). */
export const GROW_GAUGES = [
    { c: 'M', label: 'MASS' },
    { c: 'F', label: 'FEED' },
    { c: 'E', label: 'PULSE' },
    { c: 'H', label: 'FLESH' },
];
/** The share of the colony's chambers (the landings and the machine house too) that is body. */
export function fleshShare(s, layout) {
    if (!growOn(s)) return 0;
    const n = graphOf(layout).nodes.length;
    return n ? s.grow.body.length / n : 0;
}
/** The body's living mass as a share of what the whole colony would weigh as body. */
export function massShare(s, layout) {
    if (!growOn(s)) return 0;
    const graph = graphOf(layout);
    const all = bodyMass(graph, { body: graph.nodes.map((n) => n.id), necrotic: [] });
    return all > 0 ? bodyMass(graph, bodyState(s.grow)) / all : 0;
}
/** A ratio on the dial: under 1 in the red arc, 1 at its edge, 2.5 and more at the top. */
export function ratioK(r) {
    if (!Number.isFinite(r)) return GREEN_FROM + GREEN_SPAN;
    if (r < 1) return RED_K * Math.max(0, r);
    return Math.min(GREEN_FROM + GREEN_SPAN, RED_K + (GREEN_FROM + GREEN_SPAN - RED_K) * Math.min(1, (r - 1) / 1.5));
}
/**
 * The four levels, read like the needles were: 0 to 1 along the dial, red when short, the weakest
 * with the dot. MASS carries the mass in hand, FEED the people (`num`).
 */
export function growGauges(s, report, layout) {
    const R = bodyRatios(s, layout);
    const G = s.grow;
    const dying = G.necrotic.length > 0;
    // deep-pass3 (B401): the ring marks the gauge whose organ the tape names, and only then (the dot came at
    // 1.25 and the tape at 1, so the two disagreed)
    const want = wantOrgan(s, layout);
    const g = {};
    for (const c of ['M', 'F', 'E', 'H']) {
        const r = R.ratios[c];
        g[c] = { k: ratioK(r), falling: r < 1, red: r < 1, days: Infinity, weakest: !!want && GAUGE_ORGAN[c] === want };
    }
    // FEED: a falling store reads its years left, as the food did
    if (Number.isFinite(R.years)) {
        const k = fallK(R.years * 10);
        g.F = { ...g.F, k: Math.min(g.F.k, dying ? Math.min(RED_K * 0.5, k) : k), red: g.F.red || dying || R.years < FEED_RED_YEARS, falling: true };
    }
    if (dying) g.E.red = g.E.red || R.ratios.E < 1;
    g.F.num = `${PEOPLE_SIGN} ${short(Math.max(0, s.humans || 0))}`;
    g.M.num = `${MASS_SIGN} ${short(Math.floor(G.mass))}`;
    return g;
}

/** The stamped word in GROW, without the prefix: always a thing the player can do now. */
export const GROW_ADVICE = { take: 'TAKE A CHAMBER', pump: 'PUMP', rise: 'RISE', dream: 'DREAM' };
/** The tape's words for growing an organ. */
export const growWord = (organ) => `GROW A ${ORGAN_NAME[organ]}`;
/** Is the body starving, or about to? */
export function hungry(s, layout) {
    return s.grow.necrotic.length > 0 || feedYears(s, layout) < FEED_RED_YEARS + 1;
}
/**
 * The word: RISE when it can; PUMP while a take fills; GROW A <ORGAN> for the weakest gauge when it is
 * short and a take can be paid; TAKE A CHAMBER when one can be paid; PUMP (the blood goes to the guts,
 * or to the dead) while the next take is near; else DREAM (time makes mass).
 */
export function adviseGrow(s, layout) {
    if (!growOn(s) || risen(s) || s.grow.dreaming) return '';
    if (riseReady(s, layout).ready) return GROW_ADVICE.rise;
    const G = s.grow;
    if (G.take) return GROW_ADVICE.pump;
    const R = bodyRatios(s, layout);
    // dead flesh that cannot come back blocks the front: the hearts' reach (or the people) first
    const fix = deadFix(s, layout);
    if (fix) return canGrow(s, layout, fix) ? growWord(fix) : GROW_ADVICE.pump;
    const want = GAUGE_ORGAN[R.weakest];
    // deep-tension: the weakest short is THE answer: grow its organ, or pump the mass for it (the pump
    // sends the blood to the guts). The tape never names a take the mass cannot pay.
    if (R.ratios[R.weakest] < 1) {
        if (canGrow(s, layout, want)) return growWord(want);
        // deep-pass3 (B402): the organ is far off in mass: DREAM (the guts make three times the mass while it
        // dreams), not a minute of drumming (the human pass drummed a minute for a hand at ⧫ 65 of 28)
        const far = (organPrice(s, layout, want) - G.mass) / Math.max(1e-9, R.massRate);
        return far > DREAM_ADVISE_S ? GROW_ADVICE.dream : GROW_ADVICE.pump;
    }
    if (inReach(s, layout).some((id) => canAfford(s, layout, id))) return GROW_ADVICE.take;
    if (G.necrotic.length && feedOf(s) > 0) return GROW_ADVICE.pump;
    const wait = Number.isFinite(R.price) ? (R.price - G.mass) / Math.max(1e-9, R.massRate) : Infinity;
    return wait > DREAM_ADVISE_S ? GROW_ADVICE.dream : GROW_ADVICE.pump;
}
/**
 * deep-pass3 (B402): WHERE THE TAPE POINTS. The human pass read TAKE A CHAMBER with nothing glowing in
 * view (the chamber it meant lay on a floor the camera had left for the machine house). Now the tape's
 * word has a place: TAKE A CHAMBER, the cheapest chamber in reach it can pay (the machine house only
 * when nothing else is in reach); GROW A <ORGAN>, the chamber in reach (or the spare organ) that gives
 * it cheapest. The view rings it and the camera goes to its floor. Null for PUMP, DREAM and RISE (the
 * heart and the lever are always in view).
 * @returns {string|null} a chamber id
 */
export function growTarget(s, layout, word = adviseGrow(s, layout)) {
    if (!growOn(s) || risen(s) || s.grow.dreaming || !word) return null;
    const best = (ids, organ = null) => {
        let pick = null;
        for (const id of ids) {
            const o = takeOffer(s, layout, id);
            if (!o) continue;
            for (const r of o.organs) {
                if (!r.ok || (organ && r.organ !== organ)) continue;
                const k = r.mass + (id === 'machine' ? 1e6 : 0);
                if (!pick || k < pick.k) pick = { id, k };
            }
        }
        return pick ? pick.id : null;
    };
    if (word === GROW_ADVICE.take) return best(inReach(s, layout));
    const organ = Object.keys(ORGAN_NAME).find((o) => word === growWord(o));
    if (!organ) return null;
    return best(inReach(s, layout), organ) || best(spareOrgans(s, layout, organ), organ);
}
/**
 * deep-pass3 (B402): CAN THE TAPE'S WORD BE DONE NOW? The tests and the sim hold the tape to it, every
 * moment: PUMP always does something (it fills the take, brings the dead back or sends the blood to the
 * guts); DREAM while not dreaming; RISE when the body can; TAKE and GROW only with a chamber to do it in.
 */
export function growDoable(s, layout, word = adviseGrow(s, layout)) {
    if (!word) return true;
    if (!growOn(s) || risen(s)) return false;
    if (word === GROW_ADVICE.rise) return riseReady(s, layout).ready;
    if (word === GROW_ADVICE.pump) return !s.grow.dreaming;
    if (word === GROW_ADVICE.dream) return !s.grow.dreaming;
    if (word === GROW_ADVICE.take || Object.keys(ORGAN_NAME).some((o) => word === growWord(o))) return !!growTarget(s, layout, word);
    return false;
}
/** deep-tension: the organ the body is short of now (dead flesh's fix, else the red gauge's), or null. */
export function wantOrgan(s, layout) {
    if (!growOn(s) || risen(s)) return null;
    const fix = deadFix(s, layout);
    if (fix) return fix;
    const R = bodyRatios(s, layout);
    return R.ratios[R.weakest] < 1 ? GAUGE_ORGAN[R.weakest] : null;
}
/** deep-tension: the cheapest mass this organ can be had for now (a take in reach, or a living organ
 *  grown again), or Infinity. */
export function organPrice(s, layout, organ) {
    let best = Infinity;
    const ids = [...inReach(s, layout), ...spareOrgans(s, layout, organ)];
    for (const id of ids) {
        const o = takeOffer(s, layout, id, { dream: true });
        const r = o && o.organs.find((x) => x.organ === organ);
        if (r) best = Math.min(best, r.mass);
    }
    return best;
}
/**
 * deep-tension: the small line under the tape in GROW: what the pump is for ("A HEART: ⧫ 7 TO GO"), or
 * which gauge is short, so the tape is never a bare PUMP or WAIT.
 */
export function growNote(s, layout) {
    if (!growOn(s) || risen(s) || s.grow.dreaming) return '';
    const G = s.grow;
    const word = adviseGrow(s, layout);
    if (word !== GROW_ADVICE.pump) {
        const organ = Object.keys(ORGAN_NAME).find((o) => word === growWord(o));
        if (!organ) return '';
        const c = Object.keys(GAUGE_ORGAN).find((k) => GAUGE_ORGAN[k] === organ);
        const label = GROW_GAUGES.find((x) => x.c === c)?.label || '';
        return `${label} is short.`;
    }
    if (G.take) return 'On the beat.';
    const R = bodyRatios(s, layout);
    const fix = deadFix(s, layout);
    const want = fix || (R.ratios[R.weakest] < 1 ? GAUGE_ORGAN[R.weakest] : null);
    const price = want ? organPrice(s, layout, want) : R.price;
    const gap = Math.ceil(price - G.mass);
    if (!Number.isFinite(gap) || gap <= 0) return '';
    return want ? `A ${ORGAN_NAME[want]}: ${MASS_SIGN} ${short(gap)} to go.` : `${MASS_SIGN} ${short(gap)} to go.`;
}
/**
 * deep-organs: the organ that brings the dead back, or null: a VAT when there are no people to eat, a
 * HEART when the hearts cannot reach the innermost dead room (dead flesh does not spread, so until then
 * the front is blocked there).
 */
export function deadFix(s, layout) {
    const G = s.grow;
    if (!G.necrotic.length) return null;
    if (feedOf(s) <= 0) return 'vat';
    const graph = graphOf(layout);
    const sums = bodySums(graph, bodyState(G));
    return G.necrotic.some((id) => fitsReach(graph, sums, id)) ? null : 'heart';
}
/**
 * deep-organs: the living organs to grow again when the tape names an organ that no chamber in reach
 * can be (the front blocked, or nothing in reach paid for): they glow as the chambers in reach do, and
 * a click opens the ring of the other three. Nearest the dead first.
 */
export function regrowGlow(s, layout) {
    if (!growOn(s) || risen(s) || s.grow.take || s.grow.dreaming) return [];
    const word = adviseGrow(s, layout);
    const organ = Object.keys(ORGAN_NAME).find((o) => word === growWord(o));
    if (!organ) return [];
    if (inReach(s, layout).some((id) => takeOffer(s, layout, id)?.organs.some((r) => r.organ === organ && r.ok))) return [];
    const G = s.grow;
    const graph = graphOf(layout);
    const d = distances(graph, bodyState(G));
    return spareOrgans(s, layout, organ)
        .filter((id) => takeOffer(s, layout, id)?.organs.some((r) => r.organ === organ && r.ok))
        .sort((a, b) => (d.get(b) ?? 0) - (d.get(a) ?? 0))
        .slice(0, 6);
}
/** Can the body grow this organ now: a take in reach, or a spare living organ grown again into it? */
export function canGrow(s, layout, organ) {
    const G = s.grow;
    if (G.take) return false;
    for (const id of inReach(s, layout)) if (takeOffer(s, layout, id)?.organs.some((r) => r.organ === organ && r.ok)) return true;
    for (const id of spareOrgans(s, layout, organ)) {
        if (takeOffer(s, layout, id)?.organs.some((r) => r.organ === organ && r.ok)) return true;
    }
    return false;
}
/** deep-tension: a living organ is SPARE when its own gauge stands at REGROW_SPARE or more: growing it
 *  into another does not make a new shortage (it made the tape swing between two organs for ever). */
export const REGROW_SPARE = 1.5;
export function spareOrgans(s, layout, organ = null) {
    const G = s.grow;
    const R = bodyRatios(s, layout);
    const key = { gut: 'M', vat: 'F', heart: 'E', nerve: 'H' };
    const ids = Object.keys(G.organs).filter((id) => G.organs[id] !== organ && !G.necrotic.includes(id) && (R.ratios[key[G.organs[id]]] ?? 0) >= REGROW_SPARE);
    // and its gauge still green without it (one kind checked once: the farthest of that kind first)
    const ok = {};
    return ids.filter((id) => {
        const o = G.organs[id];
        if (ok[o] === undefined) {
            const organs = { ...G.organs, [id]: organ || 'gone' };
            const r = bodyRatios({ ...s, grow: { ...G, organs } }, layout).ratios[key[o]];
            ok[o] = r >= 1.05;
        }
        return ok[o];
    });
}
/** Ready to rise: the deepest floor full and the machine house body (growth.js). */
export function riseReady(s, layout) {
    if (!growOn(s)) return { ready: false, deepestFull: false, machine: false, deepest: 0 };
    return bodyReady(graphOf(layout), bodyState(s.grow));
}
/** The lamp row in GROW: the two conditions of the rise, as counts ("DEEPEST FLOOR 3 / 13"). */
export function riseLamps(s, layout) {
    const r = riseReady(s, layout);
    const graph = graphOf(layout);
    // deep-tension: the floors full, counted (it read "DEEPEST FLOOR 0 / 12" with floor 1 full)
    const floors = [...new Set(graph.nodes.filter((n) => n.floor >= 0).map((n) => n.floor))];
    const st = growOn(s) ? bodyState(s.grow) : { body: [], necrotic: [] };
    const full = floors.filter((f) => floorFull(graph, st, f)).length;
    return [
        { key: 'floor', label: `FLOORS ${full} / ${floors.length}`, lit: r.deepestFull, ordered: false },
        { key: 'machine', label: `MACHINE ${r.machine ? 1 : 0} / 1`, lit: r.machine, ordered: false },
    ];
}

/* ------------------------------------------------------------------ the drawer's body */
/** The price of the next level of a body item (stars, or ore for VATS), or Infinity at its top. */
export function bodyPrice(s, id) {
    const x = ITEM[id];
    if (!x || !growOn(s)) return Infinity;
    const lv = s.grow.lv[id] || 0;
    if (lv >= x.max) return Infinity;
    return s.grow.prices[id] || Infinity;
}
/** What an item is paid with: 'ore' or 'stars'. */
export const bodyPays = (id) => (ITEM[id] ? ITEM[id].pay : 'stars');
const wallet = (s, id) => (bodyPays(id) === 'ore' ? s.minerals || 0 : s.stars || 0);
const sign = (id) => (bodyPays(id) === 'ore' ? ORE_SIGN : '★');
export function canBuyBody(s, id) {
    if (!growOn(s) || risen(s) || !ITEM[id]) return { ok: false, need: '' };
    const price = bodyPrice(s, id);
    if (!Number.isFinite(price)) return { ok: false, need: '', top: true };
    const lack = price - wallet(s, id);
    return lack > 0 ? { ok: false, need: `You need ${sign(id)} ${short(lack)} more.` } : { ok: true, need: '' };
}
/** What an item does, in about five words. */
export function bodyDoes(s, id) {
    switch (id) {
    case 'vats': return 'The vats grow more people.';
    case 'spread': return 'A take fills by itself, twice as fast.';
    case 'appetite': return 'Each chamber eats less.';
    case 'muscle': return 'Guts and vats make half again.';
    default: return '';
    }
}
/** Is the item in the drawer yet? (One choice at a time: unlockBody.) */
export const bodySeen = (s, id) => growOn(s) && !!(s.grow.seen && s.grow.seen[id]);
/**
 * The drawer in GROW: one group, THE BODY, each item that has come (bodySeen) bright when it can be
 * bought, dim with what it needs when not; an item at its top is gone.
 */
export function bodyGroups(s) {
    if (!growOn(s) || risen(s)) return [];
    const rows = [];
    for (const x of BODY_ITEMS) {
        if (!bodySeen(s, x.id)) continue;
        const can = canBuyBody(s, x.id);
        if (can.top) continue;
        const price = bodyPrice(s, x.id);
        rows.push({
            id: `body:${x.id}`, name: x.name, does: bodyDoes(s, x.id), price: `${sign(x.id)} ${short(price)}`,
            status: can.ok ? 'buy' : 'next', need: can.need, progress: -1,
        });
    }
    return rows.length ? [{ name: 'THE BODY', rows }] : [];
}
/**
 * Buys the next level of a body item; the level after it is priced off the day's income.
 * @param {object} s - mutated
 * @param {string} id
 * @param {number} [starsPerDay] - the day's stars (tickDay's report)
 * @param {number} [orePerDay] - the day's ore (tickDay's report), for VATS
 */
export function buyBody(s, id, starsPerDay = 0, orePerDay = 0) {
    const can = canBuyBody(s, id);
    if (!can.ok) return null;
    const price = bodyPrice(s, id);
    if (bodyPays(id) === 'ore') s.minerals -= price; else s.stars -= price;
    s.grow.lv[id] += 1;
    s.grow.seen[id] = true;
    setPrice(s, id, { stars: starsPerDay, ore: orePerDay || s.grow.oreDay }, 0, price);
    return { id, level: s.grow.lv[id], price };
}

/**
 * What the view draws: the body, the dead flesh, the chambers it may take now, the organs, the take in
 * progress (`taking`: { id, organ, k } with k its share filled), the full floors.
 */
export function viewOf(s, layout) {
    if (!growOn(s)) return { body: [], necrotic: [], reachable: [], glow: [], organs: {}, taking: null, full: [] };
    const G = s.grow;
    const T = G.take;
    return {
        body: G.body.slice(), necrotic: G.necrotic.slice(),
        reachable: risen(s) ? [] : inReach(s, layout),
        glow: risen(s) ? [] : [...inReach(s, layout), ...regrowGlow(s, layout)],
        organs: { ...G.organs },
        taking: T ? { id: T.id, organ: T.organ, k: T.work > 0 ? T.done / T.work : 0, regrow: T.regrow || null } : null,
        full: G.full.slice(),
    };
}

/** The body rises: the act is over. The save keeps it, so a reload shows the wall. */
export function rise(s, layout) {
    if (!growOn(s) || risen(s) || !riseReady(s, layout).ready) return false;
    s.grow.risen = true;
    s.grow.take = null;
    s.ascended = true;
    s.ending = 'body';
    return true;
}

export { ORGANS, ORGAN_NAME, ORGAN_DOES, GAUGE_ORGAN };
