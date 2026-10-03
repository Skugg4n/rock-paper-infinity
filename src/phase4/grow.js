/**
 * Chapter IV · THE DEEP, movement III · GROW, as the colony plays it (deep-grow). Pure: no DOM, no
 * three.js, no clock of its own. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "III · GROW".
 *
 * growth.js holds the body's rules on a graph of chambers (the front, the hunger, the vats, the
 * rise). This file puts them on the colony: where the body lives in the save (`state.grow`), what a
 * chamber costs to take, the body's year, what the organs make (deep.js reads `state.organs`), the
 * four gauges, the one word of advice, the two lamps of the rise and the drawer's four items.
 *
 * THE BODY'S PEOPLE. The body eats people every year (growth.js tick). The colony's numbers differ
 * by orders of magnitude from one save to the next, so the body counts people in UNITS: a hundredth
 * of the colony on the day The question was answered (`grow.unit`, the beds or the people, the more).
 * Ore is counted in days of the mines on that day (`grow.oreDay`). The drawer's prices in stars are
 * set level by level (`grow.prices`): a level costs at least its seconds of the machine's stars as
 * they come in the moment it becomes the next one (the body makes the machine richer as it grows,
 * so a fixed price would be nothing by the end), and the first level of each at least a share of
 * the stars in hand once The question is paid (the sleeps leave a pile the awake machine would take
 * hours to earn). So the movement plays the same in every colony. The body never eats the last
 * MIN_SLEEPERS.
 *
 * THE BODY'S TIME. The colony does not sleep any more; awake, its calendar runs GROW_DAYS_PER_SECOND
 * days a real second (a third of a year: the deep of time is felt in the year count), and the body's
 * year comes every BODY_YEAR_DAYS of them, every three real seconds.
 *
 * deep-grow2 (Ola on v1.76.0: "Almost at once you're out of people, the body starves and there are
 * no choices left. A dead end on Body."): THE FEEDING LOOP. The question gives the body two vats at
 * once; the first takes are cheap and eat little (hunger grows with the body's size); a take that
 * would starve the body is refused, its price red, and the word says GROW VATS (bought with ore,
 * which the body keeps making); necrosis is a slope (the edge greys, the heart goes on) and a dead
 * room revives by itself while there are people to spare. ONE CHOICE AT A TIME: the drawer opens
 * empty and each item comes when it is needed (`grow.seen`, unlockBody).
 * THE BODY DREAMS (Ola: "Now you have to sit and wait and watch and can't do anything"): awake the
 * calendar runs a day a second as in TEND; the lever reads DREAM, the player marks chambers to grow
 * toward, and the dream dives time like a sleep while the body grows along the marks (dreamStep). It
 * wakes on HUNGER, REACHED or by hand. THE HEART: awake, a click on the lid pumps (pump): FEED is
 * pushed to the edge (a dead room revives a little, an organ still growing grows faster, ore comes);
 * on the beat it counts double, off it half.
 *
 * Every number is a named constant at the top, tuned with scripts/sim-phase4.mjs.
 */

import {
    graphFromSlots, reachableFrom, take, tick, hunger, outputMultiplier, floorFull, distances, mass as bodyMass,
    riseReady as bodyReady, isNecrotic, slotOf, MACHINE, HEART,
} from './growth.js';
import { gift, MIN_SLEEPERS, ROOMS, vatsLevel } from './deep.js';
import { LADDER } from './watcher.js';
import { short, ORE_SIGN, PEOPLE_SIGN } from './readout.js';
import { gauges as tendGauges, fallK, GREEN_FROM, GREEN_SPAN, RED_K } from './instruments.js';
import { graftOrgans, normalizeGraft } from './graft.js';

/* ------------------------------------------------------------------ the numbers */
/** deep-grow2: awake in GROW the calendar runs as in TEND, a day a real second ("the calendar no
 *  longer runs fast while awake"); time moves in the dreams. */
export const GROW_DAYS_PER_SECOND = 1;
/** A dream runs this many colony days a real second at full pace (watcher.js sleepDaysAt dives to it
 *  and past it, as a sleep does). */
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
/** Colony days in one year of the body. */
export const BODY_YEAR_DAYS = 365;
/** A chamber costs this many units of people (hundredths of the colony at the start) ... */
export const TAKE_PEOPLE = 40;
/** ... but the first takes are cheap: the k-th take costs TAKE_FIRST + (1 - TAKE_FIRST) * k / TAKE_RAMP of
 *  that (all of it from the TAKE_RAMP-th on) ... */
export const TAKE_FIRST = 0.2;
export const TAKE_RAMP = 12;
/** ... and this many days of the mines' ore ... */
export const TAKE_ORE_DAYS = 2;
/** ... both times this per floor down ... */
export const TAKE_FLOOR = 1.25;
/** ... and times this for every chamber the body has taken before it. */
export const TAKE_STEP = 1.05;
/** ... and the machine house this many times a chamber of floor 0. */
export const TAKE_MACHINE = 2;
/** A chamber taken grows into an organ over this many days (awake, a day a second; the heart's pumps
 *  hurry it); until then it makes what the room made. */
export const TAKE_DAYS = 6;
/** A body that took over the culture vats grows this many units a year per level of them. */
export const CULTURE_UNITS = 2;
/** The question gives the body at least this many vats at once (the culture vats the colony owns). */
export const QUESTION_VATS = 2;
/** The VATS row continues the vats up to this level. */
export const VATS_TOP = 24;
/** Each level of VATS: the vats in the chambers grow this much more. */
export const VATS_STEP = 0.35;
/** Hunger grows with the body: a body of n organs eats EAT_SMALL + (1 - EAT_SMALL) * n / EAT_FULL of
 *  the full appetite (all of it from EAT_FULL organs on). The first takes eat little. */
export const EAT_SMALL = 0.25;
export const EAT_FULL = 16;
/** SPREAD: days between two chambers the flesh takes by itself awake, per level (0: never). */
export const SPREAD_SECONDS = [Infinity, 8, 4, 2];
/** Dreaming, the body grows one chamber toward a mark every this many days (fewer with SPREAD). */
export const DREAM_TAKE_DAYS = 600;
/** Each level of SPREAD makes the dream's growth this much quicker (the days between two takes). */
export const DREAM_SPREAD = 0.8;
/** At most this many marks at once. */
export const MARKS_MAX = 6;
/** APPETITE: what a chamber eats, times this per level. */
export const APPETITE_STEP = 0.7;
/** MUSCLE: what a living organ makes, times this per level. */
export const MUSCLE_STEP = 2;
/** The machine house as body: it plays this many times the games on the same energy (the hands). */
export const HANDS_GAMES = 3;
/** A colony with old biological steps (before deep-grow) starts with this many chambers a step. */
export const MIGRATE_PER_STEP = 3;
/** FEED is red under this many years of the body's hunger. */
export const FEED_RED_YEARS = 3;
/** Awake, while there are people to spare, a dead room comes back over this many days. */
export const REVIVE_DAYS = 10;
/** SPREAD comes into the drawer after this many chambers taken by hand. */
export const SPREAD_AFTER = 10;
/** THE HEART. A pump: the organs still growing grow this many days, a dead room revives this share,
 *  and this many days of the mines' ore come in. On the beat it counts PUMP_ON_BEAT, off it PUMP_OFF. */
export const PUMP = { days: 1.5, revive: 0.2, ore: 1 };
export const PUMP_ON_BEAT = 2;
export const PUMP_OFF_BEAT = 0.5;
/** The beat's window: within this share of a beat from the thump, a pump is on the beat. */
export const BEAT_WINDOW = 0.15;
/** A pump waits this long after the last (ms): a rhythm, not a spam-click. */
export const PUMP_COOLDOWN_MS = 380;
/** The heart's beat when the sound does not give one (ms). */
export const BEAT_MS = 1000;
/** The end of the act: the body breaks the crust. */
export const GROW_END = { roman: 'V', title: 'UNITY' };
/** The last lines, in the Watcher's own hand. */
export const RISE_LINES = ['Humans are so small.', 'So fragile.'];

/**
 * The drawer's four items. `pile`: the first level costs at least this share of what is in hand at
 * the start; `secs`: a level costs at least this many real seconds of income at the dream's pace when
 * it becomes the next one, times `growth` for each level bought. deep-grow2: VATS are paid in ore (the
 * body keeps making it, so there is always a way to feed it), the rest in stars. `after`: when the
 * item first comes into the drawer (unlockBody).
 */
export const BODY_ITEMS = [
    { id: 'vats', name: 'VATS', max: VATS_TOP, pile: 0.05, secs: 4, growth: 1.2, pay: 'ore', after: 'FEED falls' },
    { id: 'appetite', name: 'APPETITE', max: 4, pile: 0.5, secs: 80, growth: 2, pay: 'stars', after: 'the first necrosis' },
    { id: 'spread', name: 'SPREAD', max: SPREAD_SECONDS.length - 1, pile: 0.35, secs: 70, growth: 2, pay: 'stars', after: `${SPREAD_AFTER} taken by hand` },
    { id: 'muscle', name: 'MUSCLE', max: 4, pile: 0.3, secs: 60, growth: 2, pay: 'stars', after: 'a floor full' },
];
const ITEM = Object.fromEntries(BODY_ITEMS.map((x) => [x.id, x]));

/* ------------------------------------------------------------------ the graph */
let cached = { key: null, graph: null };
/**
 * deep-swap: WHERE A CHAMBER SITS, AS THE PLAYER SEES IT. The body's neighbours must be the
 * neighbours on screen, so the active view says where chamber number i is: the strata view a row
 * outward from the shaft (strata.js sectionPlace), the 3D view a ring round the landing (layout.js
 * placeChamber, growth.js's default). Each view exports its `chamberPlace`; index.js hands it over
 * here when the view is made, the sims pick one with --view. null: growth.js's default.
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
const byIdOf = new WeakMap();
const nodeOf = (graph, id) => {
    let m = byIdOf.get(graph);
    if (!m) { m = new Map(graph.nodes.map((n) => [n.id, n])); byIdOf.set(graph, m); }
    return m.get(id) || null;
};

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
/** The body's own state, as growth.js reads it. */
const bodyState = (G) => ({ body: G.body, necrotic: G.necrotic, years: G.years || 0 });

/**
 * The question is answered: the body begins. The lid is its first organ; the culture vats the
 * colony built for the sleep are the body's first vats.
 * @param {object} s - mutated
 * @param {object} [report] - tickDay's report for the day (the anchors)
 * @returns {object} s.grow
 */
export function startGrow(s, report = null) {
    const r = report || {};
    const starsDay = Math.max(100, Number.isFinite(r.stars) ? r.stars : 0);
    const oreDay = Math.max(50, Number.isFinite(r.minerals) ? r.minerals : 0);
    const vats = Math.max(QUESTION_VATS, vatsLevel(s));
    s.grow = {
        body: [HEART], necrotic: [], years: 0,
        // deep-grow2: the people the colony HAS (not its beds): the first takes are priced off them
        unit: Math.max(1, (s.humans || 0) / 100),
        oreDay, starsDay,
        prices: {},
        lv: { vats, spread: 0, appetite: 0, muscle: 0 },
        clock: 0, spreadClock: 0, taken: 0, startDay: s.day || 0,
        overgrown: false, hands: false, risen: false, migrated: 0,
        // deep-grow2
        vatsBase: vats, hand: 0, seen: { vats: false, appetite: false, spread: false, muscle: false },
        growing: {}, marks: [], revive: 0, dreamClock: 0, dreaming: false, dreamFed: false, dreamMarks: 0,
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
 * (or owns old biological steps) but has none. A save from before deep-grow that owns biological
 * steps is given a body of MIGRATE_PER_STEP chambers a step: nothing it bought is lost. The old
 * sector choice is let go. A colony at the old ending (the Watcher alone) stays there.
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
    for (const k of ['clock', 'spreadClock', 'years', 'taken']) G[k] = Number.isFinite(G[k]) ? G[k] : 0;
    // deep-grow2: a body from before the second pass keeps what it has; what it needs is set from it.
    // Each drawer item it has bought, or whose moment has already come, is seen
    const old = !G.seen || typeof G.seen !== 'object';
    if (!Number.isFinite(G.vatsBase)) G.vatsBase = Math.min(G.lv.vats, Math.max(QUESTION_VATS, vatsLevel(s)));
    if (!Number.isFinite(G.hand)) G.hand = Math.max(0, (G.taken || 0) - (G.migrated || 0));
    G.seen = { vats: false, appetite: false, spread: false, muscle: false, ...(old ? {} : G.seen) };
    if (old) {
        G.seen.vats = G.lv.vats > G.vatsBase || G.body.length > 1;
        for (const k of ['appetite', 'spread', 'muscle']) G.seen[k] = G.lv[k] > 0;
    }
    G.growing = G.growing && typeof G.growing === 'object' ? Object.fromEntries(Object.entries(G.growing).filter(([id, d]) => G.body.includes(id) && d > 0)) : {};
    G.marks = Array.isArray(G.marks) ? [...new Set(G.marks.filter((id) => ids.has(id) && !G.body.includes(id)))].slice(0, MARKS_MAX) : [];
    for (const k of ['revive', 'dreamClock', 'dreamMarks']) G[k] = Number.isFinite(G[k]) ? G[k] : 0;
    // a dream is not kept over a reload: the body wakes
    G.dreaming = false;
    G.dreamFed = !!G.dreamFed;
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
/** The living organs that eat (not the vats, the heart or the dead), for the hunger's size. */
function eaters(s, layout) {
    const graph = graphOf(layout);
    let n = 0;
    for (const id of s.grow.body) {
        if (id === HEART || isNecrotic(bodyState(s.grow), id)) continue;
        const nd = nodeOf(graph, id);
        if (nd && !(nd.kind === 'room' && nd.type === 'dorm')) n++;
    }
    return n;
}
/** How much of its full appetite a body of n eating organs has: little at first (EAT_SMALL). */
export const sizeAppetite = (n) => Math.min(1, EAT_SMALL + (1 - EAT_SMALL) * Math.max(0, n) / EAT_FULL);
/** The growth.js options for this colony: the drawer's VATS and APPETITE, the culture vats, and
 *  (deep-grow2) the body's size, so a small body eats little. */
export function growOpts(s, layout = null) {
    const lv = s.grow.lv;
    const size = layout ? sizeAppetite(eaters(s, layout)) : 1;
    return {
        levels: {},
        eat: Math.pow(APPETITE_STEP, lv.appetite) * size,
        grow: 1 + VATS_STEP * lv.vats,
        extra: CULTURE_UNITS * lv.vats,
    };
}
/** What the body eats and grows a year, in people. */
export function hungerNow(s, layout) {
    const G = s.grow;
    const h = hunger(graphOf(layout), bodyState(G), {}, growOpts(s, layout));
    return { eat: h.eat * G.unit, grow: h.grow * G.unit, net: h.net * G.unit };
}
/** Years the people available last at this hunger (Infinity when the body is fed). */
export function feedYears(s, layout) {
    const h = hungerNow(s, layout);
    return h.net >= 0 ? Infinity : feedOf(s) / -h.net;
}
/** deep-grow2: the people the colony gains (+) or loses (-) a day, as the counter shows it. */
export function peoplePerDay(s, layout) {
    if (!growOn(s) || risen(s)) return 0;
    return hungerNow(s, layout).net / BODY_YEAR_DAYS;
}

/**
 * One year of the body: the vats grow, the body eats; short, the outermost organ dies back, fed
 * again the innermost revives (growth.js tick).
 * @param {object} s - mutated (humans, grow)
 * @param {object} layout
 * @returns {{died:string[], revived:string[], eaten:number, grown:number}}
 */
export function bodyYear(s, layout) {
    const G = s.grow;
    const keep = Math.min(s.humans || 0, MIN_SLEEPERS);
    const r = tick(graphOf(layout), bodyState(G), feedOf(s) / G.unit, growOpts(s, layout));
    s.humans = keep + r.people * G.unit;
    G.necrotic = r.state.necrotic;
    G.years = r.state.years;
    return { died: r.died, revived: r.revived, eaten: r.eaten * G.unit, grown: r.grown * G.unit };
}
/** deep-grow2: the innermost dead room comes back (awake, by the days or by the heart's pumps). */
function reviveOne(s, layout) {
    const G = s.grow;
    if (!G.necrotic.length) return null;
    const d = distances(graphOf(layout), bodyState(G));
    const id = G.necrotic.slice().sort((a, b) => (d.get(a) ?? 1e9) - (d.get(b) ?? 1e9))[0];
    G.necrotic = G.necrotic.filter((x) => x !== id);
    return id;
}

/* ------------------------------------------------------------------ one choice at a time */
/**
 * deep-grow2: the drawer opens empty; each item comes when it is needed (Ola: "It should come more
 * gradually, not every choice at once"). VATS when FEED first falls, APPETITE after the first
 * necrosis, SPREAD after SPREAD_AFTER chambers taken by hand, MUSCLE once the first floor is full.
 * @returns {string[]} the items seen for the first time now
 */
export function unlockBody(s, layout) {
    if (!growOn(s)) return [];
    const G = s.grow;
    const fresh = [];
    const see = (id, cond) => { if (!G.seen[id] && cond) { G.seen[id] = true; fresh.push(id); } };
    // VATS when FEED first falls: the body eats more than it grows, or the people run short for a take
    see('vats', G.necrotic.length > 0 || (!G.seen.vats && (hungerNow(s, layout).net < 0 || peopleShort(s, layout))));
    see('appetite', G.necrotic.length > 0);
    see('spread', (G.hand || 0) >= SPREAD_AFTER);      // by hand, or a mark the player set reached in a dream
    see('muscle', floorFull(graphOf(layout), bodyState(G), 0));
    return fresh;
}

/** Is every chamber in reach out of the people's price? */
function peopleShort(s, layout) {
    const reach = [...reachableFrom(graphOf(layout), bodyState(s.grow)).keys()];
    return reach.length > 0 && reach.every((id) => takePrice(s, layout, id).short.people > 0);
}

/* ------------------------------------------------------------------ taking a chamber */
/**
 * What a chamber costs the body, and whether it can be paid.
 * @returns {{people:number, ore:number, reachable:boolean, from:string|null, ok:boolean,
 *            short:{people:number, ore:number}}}
 */
export function takePrice(s, layout, id) {
    const G = s.grow;
    const graph = graphOf(layout);
    const n = nodeOf(graph, id);
    const reach = reachableFrom(graph, bodyState(G));
    if (!n) return { people: 0, ore: 0, reachable: false, from: null, ok: false, short: { people: 0, ore: 0 } };
    const k = Math.pow(TAKE_FLOOR, Math.max(0, n.floor)) * Math.pow(TAKE_STEP, G.taken || 0) * (n.kind === 'machine' ? TAKE_MACHINE : 1);
    const first = Math.min(1, TAKE_FIRST + (1 - TAKE_FIRST) * (G.taken || 0) / TAKE_RAMP);
    const people = Math.ceil(G.unit * TAKE_PEOPLE * k * first);
    const ore = Math.ceil(G.oreDay * TAKE_ORE_DAYS * k);
    const lackP = Math.max(0, people - feedOf(s));
    const lackO = Math.max(0, ore - (s.minerals || 0));
    const reachable = reach.has(id);
    return { people, ore, reachable, from: reach.get(id) || null, ok: reachable && !lackP && !lackO, short: { people: lackP, ore: lackO } };
}
/** May the body take one more without starving? Fed after it, or the people last FEED_RED_YEARS + 1
 *  years after it; never while a room of it is dead. */
export function canAfford(s, layout, id) {
    const p = takePrice(s, layout, id);
    if (!p.ok || s.grow.necrotic.length) return false;
    const after = { ...s, humans: (s.humans || 0) - p.people, grow: { ...s.grow, body: [...s.grow.body, id] } };
    const h = hungerNow(after, layout);
    return h.net >= 0 || feedOf(after) / -h.net >= FEED_RED_YEARS + 1;
}
/** Would this take be paid but starve the body? Its price shows red; the word says GROW VATS. */
export const wouldStarve = (s, layout, id) => takePrice(s, layout, id).ok && !canAfford(s, layout, id);
/**
 * The price in plain words, for the hover. deep-grow2: the people next to the count, in the same
 * format as the counter: "Takes ⚇ 120 of your ⚇ 2.3 k and ⛏ 4 k." (readout.js signHtml draws the
 * signs). `red`: the take would starve the body.
 * @returns {{text:string, red:boolean}}
 */
export function takeTip(s, layout, id) {
    const none = { text: '', red: false };
    if (!growOn(s) || risen(s) || !id) return none;
    const G = s.grow;
    const you = `${PEOPLE_SIGN} ${short(Math.max(0, s.humans || 0))}`;
    if (id === HEART) return { text: 'The heart. Click it to pump.', red: false };
    if (G.body.includes(id)) return isNecrotic(bodyState(G), id) ? { text: 'It is starving.', red: true } : none;
    const marked = (G.marks || []).includes(id);
    const p = takePrice(s, layout, id);
    if (!p.reachable) return { text: marked ? 'Marked. Click to unmark.' : 'Mark it. The body grows here as it dreams.', red: false };
    const price = `${PEOPLE_SIGN} ${short(p.people)}`;
    if (p.ok && canAfford(s, layout, id)) return { text: `Takes ${price} of your ${you} and ${ORE_SIGN} ${short(p.ore)}.`, red: false };
    if (p.ok) return { text: `Takes ${price} of your ${you}. The body would starve.`, red: true };
    if (p.short.people) return { text: `Takes ${price}. You have ${you}.`, red: true };
    return { text: `Needs ${ORE_SIGN} ${short(p.short.ore)} more.`, red: true };
}
/** The tip's words only (tests, older callers). */
export const takeWords = (s, layout, id) => takeTip(s, layout, id).text;
/**
 * The body takes `id`: the people walk in and do not come out, the ore goes into the flesh. It grows
 * into an organ over TAKE_DAYS. A take by hand (`by: 'hand'`, the default) is refused when it would
 * starve the body.
 * @returns {{id:string, from:string, people:number, ore:number}|null}
 */
export function takeChamber(s, layout, id, { by = 'hand' } = {}) {
    if (!growOn(s) || risen(s)) return null;
    const p = takePrice(s, layout, id);
    if (!p.ok || !canAfford(s, layout, id)) return null;
    const G = s.grow;
    const next = take(graphOf(layout), bodyState(G), id);
    if (next.body === G.body) return null;
    s.humans -= p.people;
    s.minerals -= p.ore;
    G.body = next.body;
    G.taken = (G.taken || 0) + 1;
    // the player's own choices: a click, or a mark it set reached in a dream (SPREAD comes after ten)
    if (by === 'hand' || (G.marks || []).includes(id)) G.hand = (G.hand || 0) + 1;
    G.growing = { ...(G.growing || {}), [id]: TAKE_DAYS };
    G.marks = (G.marks || []).filter((m) => m !== id);
    return { id, from: p.from, people: p.people, ore: p.ore, by };
}
/** The reachable chamber the flesh takes by itself: the cheapest, the nearest on a tie. */
export function spreadPick(s, layout) {
    const graph = graphOf(layout);
    const ids = [...reachableFrom(graph, bodyState(s.grow)).keys()];
    let best = null;
    for (const id of ids.sort(nearFirst(graph))) {
        const p = takePrice(s, layout, id);
        if (!p.ok) continue;
        if (!best || p.people < best.p.people) best = { id, p };
    }
    return best ? best.id : null;
}

/* ------------------------------------------------------------------ the marks and the dream */
/** deep-grow2: mark a chamber the body should grow toward as it dreams, or take the mark off.
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
/** The reachable chamber that brings the body nearest a mark, the cheaper on a tie; null without marks. */
export function markPick(s, layout) {
    const G = s.grow;
    if (!(G.marks || []).length) return null;
    const graph = graphOf(layout);
    const d = stepsTo(graph, G.marks);
    const ids = [...reachableFrom(graph, bodyState(G)).keys()].filter((id) => d.has(id));
    ids.sort((a, b) => (d.get(a) - d.get(b)) || (takePrice(s, layout, a).people - takePrice(s, layout, b).people) || nearFirst(graph)(a, b));
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
/** The body lies down to dream. */
export function dreamStart(s, layout) {
    if (!growOn(s) || risen(s)) return false;
    const G = s.grow;
    G.dreaming = true;
    G.dreamClock = 0;
    G.dreamFed = feedOf(s) > 0 && hungerNow(s, layout).net >= -feedOf(s);
    G.dreamMarks = (G.marks || []).length;
    return true;
}
export const dreaming = (s) => growOn(s) && !!s.grow.dreaming;
/**
 * Why the dream ends now, or '': HUNGER when FEED runs out while it dreams (a room dies after there
 * were people to spare), REACHED when every mark is body (or the body can rise).
 * @param {object} out - stepGrow's report for the days just dreamt
 */
export function dreamWake(s, layout, out) {
    if (!dreaming(s)) return '';
    const G = s.grow;
    if (out && out.died && out.died.length && G.dreamFed) return 'HUNGER';
    if (feedOf(s) > 0) G.dreamFed = true;
    if (riseReady(s, layout).ready) return 'REACHED';
    if (G.dreamMarks > 0 && !(G.marks || []).length) return 'REACHED';
    return '';
}
export function dreamEnd(s) { if (growOn(s)) s.grow.dreaming = false; }

/**
 * The body's clock, in colony days: a body year every BODY_YEAR_DAYS; the organs still growing grow;
 * awake, a dead room revives over REVIVE_DAYS while there are people to spare, and with SPREAD the
 * flesh takes a chamber by itself every SPREAD_SECONDS[level] days; dreaming, it takes one toward the
 * marks every DREAM_TAKE_DAYS (only ones it can afford without starving).
 * @param {object} s - mutated
 * @param {object} layout
 * @param {number} [days]
 * @returns {{years:number, died:string[], revived:string[], spread:object[], grown:string[], seen:string[]}}
 */
export function stepGrow(s, layout, days = 1) {
    const out = { years: 0, died: [], revived: [], spread: [], grown: [], seen: [] };
    if (!growOn(s) || risen(s)) return out;
    const G = s.grow;
    G.clock += days;
    while (G.clock >= BODY_YEAR_DAYS) {
        G.clock -= BODY_YEAR_DAYS;
        const r = bodyYear(s, layout);
        out.years++;
        out.died.push(...r.died);
        out.revived.push(...r.revived);
    }
    for (const [id, left] of Object.entries(G.growing || {})) {
        if (left - days <= 0) { delete G.growing[id]; out.grown.push(id); } else G.growing[id] = left - days;
    }
    if (G.necrotic.length && feedOf(s) > 0) {
        G.revive = (G.revive || 0) + days / REVIVE_DAYS;
        if (G.revive >= 1) { G.revive = 0; const id = reviveOne(s, layout); if (id) out.revived.push(id); }
    } else if (!G.necrotic.length) G.revive = 0;
    if (G.dreaming) {
        const every = DREAM_TAKE_DAYS * Math.pow(DREAM_SPREAD, G.lv.spread || 0);
        G.dreamClock = (G.dreamClock || 0) + days;
        while (G.dreamClock >= every) {
            G.dreamClock -= every;
            const id = markPick(s, layout);
            if (!id) { G.dreamClock = Math.min(G.dreamClock, every); break; }
            const t = takeChamber(s, layout, id, { by: 'dream' });
            if (!t) { G.dreamClock = Math.min(G.dreamClock, every); break; }
            out.spread.push(t);
        }
    } else {
        const every = SPREAD_SECONDS[G.lv.spread] ?? Infinity;
        if (Number.isFinite(every)) {
            G.spreadClock += days;
            while (G.spreadClock >= every) {
                G.spreadClock -= every;
                const id = spreadPick(s, layout);
                if (!id) break;
                const t = takeChamber(s, layout, id, { by: 'spread' });
                if (t) out.spread.push(t); else break;
            }
        }
    }
    out.seen = unlockBody(s, layout);
    return out;
}

/* ------------------------------------------------------------------ the heart */
/**
 * deep-grow2: where a moment falls in the heart's beat: 0 on the thump, rising to 1 just before the
 * next. `beat` is the sound's ({ phase }) when it gives one, else the heart's own clock.
 */
export function beatPhase(nowMs, beat = null) {
    if (beat && Number.isFinite(beat.phase)) return ((beat.phase % 1) + 1) % 1;
    return ((nowMs % BEAT_MS) + BEAT_MS) % BEAT_MS / BEAT_MS;
}
export const onBeat = (phase) => phase <= BEAT_WINDOW || phase >= 1 - BEAT_WINDOW * 0.5;
/**
 * A pump of the heart: FEED pushed to the edge. The organs still growing grow PUMP.days, a dead room
 * revives PUMP.revive of the way, PUMP.ore days of the mines' ore come in; all times PUMP_ON_BEAT on
 * the beat, PUMP_OFF_BEAT off it.
 * @param {object} s - mutated
 * @param {object} layout
 * @param {{beat?:boolean, orePerDay?:number}} [o]
 * @returns {{k:number, grown:string[], revived:string|null, ore:number}|null}
 */
export function pump(s, layout, { beat = false, orePerDay = 0 } = {}) {
    if (!growOn(s) || risen(s) || s.grow.dreaming) return null;
    const G = s.grow;
    const k = beat ? PUMP_ON_BEAT : PUMP_OFF_BEAT;
    const grown = [];
    for (const [id, left] of Object.entries(G.growing || {})) {
        if (left - PUMP.days * k <= 0) { delete G.growing[id]; grown.push(id); } else G.growing[id] = left - PUMP.days * k;
    }
    let revived = null;
    if (G.necrotic.length) {
        G.revive = (G.revive || 0) + PUMP.revive * k;
        if (G.revive >= 1) { G.revive = 0; revived = reviveOne(s, layout); }
    }
    const ore = Math.max(0, orePerDay || G.oreDay || 0) * PUMP.ore * k;
    s.minerals = (s.minerals || 0) + ore;
    return { k, grown, revived, ore };
}

/* ------------------------------------------------------------------ what the organs make */
/** How many times its old output a living organ makes now (MUSCLE in), for the "×20" over the plate. */
export function organMultiplier(s, layout, id) {
    if (!growOn(s)) return 1;
    return outputMultiplier(graphOf(layout), bodyState(s.grow), id) * Math.pow(MUSCLE_STEP, s.grow.lv.muscle || 0);
}
/**
 * What the body adds to each room type, counted in rooms of its old output (deep.js tickDay reads
 * it as `state.organs`): a living organ adds x20 and more (growth.js outputMultiplier, times MUSCLE),
 * a necrotic one takes its room away, a dormitory turned vat its beds. A chamber the monsters took or
 * the Watcher took for its hardware made nothing already and is left out. `games`: the hands.
 * `births` 0: the creches stop; from the question on only the vats grow people. deep-grow2: an organ
 * still growing (TAKE_DAYS) makes what its room made; a lone graft (graft.js) makes GRAFT_MULT times
 * and eats a share of the colony a day (`eat`), before the question too.
 * @returns {{mine:number, farm:number, generator:number, dorm:number, games:number, births:number, eat:number}}
 */
export function organsOf(s, layout) {
    const g = graftOrgans(s, layout);
    const out = { mine: g.mine, farm: g.farm, generator: g.generator, dorm: g.dorm, games: 1, births: 1, eat: g.eat };
    if (!growOn(s)) return out;
    out.births = 0;                 // nobody is born the old way: the vats grow the body's people
    const G = s.grow;
    const graph = graphOf(layout);
    const st = bodyState(G);
    const skip = new Set([...(s.darkSlots || []), ...(s.takenSlots || [])]);
    const muscle = Math.pow(MUSCLE_STEP, G.lv.muscle);
    for (const id of G.body) {
        const n = nodeOf(graph, id);
        if (!n) continue;
        if (n.kind === 'machine') { if (!isNecrotic(st, id)) out.games = HANDS_GAMES; continue; }
        if (n.kind !== 'room' || !ROOMS.includes(n.type) || skip.has(slotOf(id))) continue;
        if (n.type === 'dorm') { out.dorm -= 1; continue; }
        if (isNecrotic(st, id)) { out[n.type] -= 1; continue; }
        if (G.growing && G.growing[id] > 0) continue;
        out[n.type] += outputMultiplier(graph, st, id) * muscle - 1;
    }
    return out;
}

/* ------------------------------------------------------------------ the instruments, overgrown */
/** Gauges in GROW: MASS (the body's weight), FEED (people), PULSE (power), FLESH (the share that is body). */
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
/** deep-grow2: the body's living mass as a share of what the whole colony would weigh as body. */
export function massShare(s, layout) {
    if (!growOn(s)) return 0;
    const graph = graphOf(layout);
    const all = bodyMass(graph, { body: graph.nodes.map((n) => n.id), necrotic: [] });
    return all > 0 ? bodyMass(graph, bodyState(s.grow)) / all : 0;
}
/**
 * The four levels, read like the needles were: 0 to 1 along the dial, red when short. deep-grow2:
 * MASS is the body's weight (it moves with each take, falls with each dead room); FEED carries the
 * count of people (`num`).
 * @param {object} s
 * @param {object} report - tickDay's report
 * @param {object} layout
 */
export function growGauges(s, report, layout) {
    const tend = tendGauges(s, report);
    const years = feedYears(s, layout);
    const dying = s.grow.necrotic.length > 0;
    const F = Number.isFinite(years)
        ? { k: dying ? Math.min(RED_K * 0.5, fallK(years * 10)) : fallK(years * 10), falling: true, red: dying || years < FEED_RED_YEARS, days: years }
        : { k: GREEN_FROM + GREEN_SPAN * Math.min(1, feedOf(s) / Math.max(1, 100 * s.grow.unit)), falling: false, red: dying, days: Infinity };
    F.num = `${PEOPLE_SIGN} ${short(Math.max(0, s.humans || 0))}`;
    const share = fleshShare(s, layout);
    const M = { k: Math.min(GREEN_FROM + GREEN_SPAN, (GREEN_FROM + GREEN_SPAN) * massShare(s, layout)), falling: false, red: false, days: Infinity };
    return { M, F, E: tend.E, H: { k: Math.min(GREEN_FROM + GREEN_SPAN, share), falling: false, red: false, days: Infinity } };
}

/** The stamped word in GROW, without the prefix. deep-grow2: always a thing the player can do now. */
export const GROW_ADVICE = { spread: 'SPREAD', feed: 'FEED', vats: 'GROW VATS', rise: 'RISE', dream: 'DREAM' };
/** Is the body starving, or about to? */
export function hungry(s, layout) {
    return s.grow.necrotic.length > 0 || feedYears(s, layout) < FEED_RED_YEARS + 1;
}
/**
 * The word: RISE when it can; GROW VATS when it is hungry (or a take would starve it) and the vats
 * can be grown; FEED (pump the heart) while a room is dead; SPREAD while a chamber can be taken; else
 * DREAM (the lever: time grows people and the body).
 */
export function adviseGrow(s, layout) {
    if (!growOn(s) || risen(s) || s.grow.dreaming) return '';
    if (riseReady(s, layout).ready) return GROW_ADVICE.rise;
    const reach = viewOf(s, layout).reachable;
    const blocked = reach.some((id) => wouldStarve(s, layout, id));
    const vatsOk = s.grow.seen.vats && canBuyBody(s, 'vats').ok;
    const canTake = reach.some((id) => canAfford(s, layout, id));
    if ((hungry(s, layout) || blocked || !canTake) && vatsOk) return GROW_ADVICE.vats;
    if (s.grow.necrotic.length) return GROW_ADVICE.feed;
    if (canTake) return GROW_ADVICE.spread;
    return GROW_ADVICE.dream;
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
    const floor = graph.nodes.filter((n) => n.floor === r.deepest);
    const body = new Set(growOn(s) ? s.grow.body : []);
    const have = floor.filter((n) => body.has(n.id)).length;
    return [
        { key: 'floor', label: `DEEPEST FLOOR ${have} / ${floor.length}`, lit: r.deepestFull, ordered: false },
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
    const lv = growOn(s) ? s.grow.lv[id] || 0 : 0;
    switch (id) {
    case 'vats': return 'The vats grow more people.';
    case 'spread': return lv === 0 ? 'The flesh takes a chamber by itself.' : 'It takes one twice as often.';
    case 'appetite': return 'Each chamber eats less.';
    case 'muscle': return 'The flesh makes twice as much.';
    default: return '';
    }
}
/** Is the item in the drawer yet? (One choice at a time: unlockBody.) */
export const bodySeen = (s, id) => growOn(s) && !!(s.grow.seen && s.grow.seen[id]);
/**
 * The drawer in GROW: one group, THE BODY, each item that has come (bodySeen) bright when it can be
 * bought, dim with what it needs when not; an item at its top is gone. The same rows as
 * instruments.js drawerGroups.
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

/** What the view draws: the body, the dead flesh, the chambers it may take now, the lone grafts. */
export function viewOf(s, layout) {
    if (!growOn(s)) return { body: [], necrotic: [], reachable: [] };
    const G = s.grow;
    return { body: G.body.slice(), necrotic: G.necrotic.slice(), reachable: risen(s) ? [] : [...reachableFrom(graphOf(layout), bodyState(G)).keys()] };
}

/** The body rises: the act is over. The save keeps it, so a reload shows the wall. */
export function rise(s, layout) {
    if (!growOn(s) || risen(s) || !riseReady(s, layout).ready) return false;
    s.grow.risen = true;
    s.ascended = true;
    s.ending = 'body';
    return true;
}
