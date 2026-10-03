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
 * Every number is a named constant at the top, tuned with scripts/sim-phase4.mjs.
 */

import {
    graphFromSlots, reachableFrom, take, tick, hunger, outputMultiplier,
    riseReady as bodyReady, isNecrotic, slotOf, MACHINE, HEART,
} from './growth.js';
import { gift, MIN_SLEEPERS, ROOMS, vatsLevel } from './deep.js';
import { LADDER } from './watcher.js';
import { short, ORE_SIGN } from './readout.js';
import { gauges as tendGauges, fallK, GREEN_FROM, GREEN_SPAN, RED_K } from './instruments.js';

/* ------------------------------------------------------------------ the numbers */
/** Colony days a real second while the body grows (the colony is awake and does not sleep). */
export const GROW_DAYS_PER_SECOND = 120;
/** Colony days in one year of the body. */
export const BODY_YEAR_DAYS = 365;
/** A chamber costs this many units of people (hundredths of the colony at the start) ... */
export const TAKE_PEOPLE = 20;
/** ... and this many days of the mines' ore ... */
export const TAKE_ORE_DAYS = 2;
/** ... both times this per floor down ... */
export const TAKE_FLOOR = 1.25;
/** ... and times this for every chamber the body has taken before it. */
export const TAKE_STEP = 1.04;
/** ... and the machine house this many times a chamber of floor 0. */
export const TAKE_MACHINE = 2;
/** A body that took over the culture vats grows this many units a year per level of them. */
export const CULTURE_UNITS = 2;
/** The VATS row continues the culture vats (three levels) up to this level. */
export const VATS_TOP = 7;
/** Each level of VATS: the vats in the chambers grow this much more. */
export const VATS_STEP = 0.35;
/** SPREAD: real seconds between two chambers the flesh takes by itself, per level (0: never). */
export const SPREAD_SECONDS = [Infinity, 8, 4, 2];
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
/** The end of the act: the body breaks the crust. */
export const GROW_END = { roman: 'V', title: 'UNITY' };
/** The last lines, in the Watcher's own hand. */
export const RISE_LINES = ['Humans are so small.', 'So fragile.'];

/**
 * The drawer's four items. `pile`: the first level costs at least this share of the stars in hand at
 * the start; `secs`: a level costs at least this many real seconds of the machine's stars as they come
 * in when it becomes the next one, times `growth` for each level bought.
 */
export const BODY_ITEMS = [
    { id: 'vats', name: 'VATS', max: VATS_TOP, pile: 0.2, secs: 45, growth: 2 },
    { id: 'spread', name: 'SPREAD', max: SPREAD_SECONDS.length - 1, pile: 0.35, secs: 70, growth: 2 },
    { id: 'appetite', name: 'APPETITE', max: 4, pile: 0.5, secs: 80, growth: 2 },
    { id: 'muscle', name: 'MUSCLE', max: 4, pile: 0.3, secs: 60, growth: 2 },
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
const nodeOf = (graph, id) => graph.nodes.find((n) => n.id === id) || null;

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
    s.grow = {
        body: [HEART], necrotic: [], years: 0,
        unit: Math.max(1, Math.max(s.humans || 0, Number.isFinite(r.capacity) ? r.capacity : 0) / 100),
        oreDay: Math.max(50, Number.isFinite(r.minerals) ? r.minerals : 0),
        starsDay,
        prices: {},
        lv: { vats: vatsLevel(s), spread: 0, appetite: 0, muscle: 0 },
        clock: 0, spreadClock: 0, taken: 0, startDay: s.day || 0,
        overgrown: false, hands: false, risen: false, migrated: 0,
    };
    for (const x of BODY_ITEMS) setPrice(s, x.id, starsDay, s.stars || 0);
    return s.grow;
}
/** The price of an item's next level, set now: see BODY_ITEMS. */
function setPrice(s, id, starsPerDay, pile = 0, paid = 0) {
    const x = ITEM[id];
    const G = s.grow;
    const lv = G.lv[id] || 0;
    const from = id === 'vats' ? Math.min(lv, vatsLevel(s)) : 0;
    const bought = Math.max(0, lv - from);
    const income = Math.max(100, starsPerDay || 0) * GROW_DAYS_PER_SECOND;
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
/** The growth.js options for this colony: the drawer's VATS and APPETITE, the culture vats. */
export function growOpts(s) {
    const lv = s.grow.lv;
    return {
        levels: {},
        eat: Math.pow(APPETITE_STEP, lv.appetite),
        grow: 1 + VATS_STEP * lv.vats,
        extra: CULTURE_UNITS * lv.vats,
    };
}
/** What the body eats and grows a year, in people. */
export function hungerNow(s, layout) {
    const G = s.grow;
    const h = hunger(graphOf(layout), bodyState(G), {}, growOpts(s));
    return { eat: h.eat * G.unit, grow: h.grow * G.unit, net: h.net * G.unit };
}
/** Years the people available last at this hunger (Infinity when the body is fed). */
export function feedYears(s, layout) {
    const h = hungerNow(s, layout);
    return h.net >= 0 ? Infinity : feedOf(s) / -h.net;
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
    const r = tick(graphOf(layout), bodyState(G), feedOf(s) / G.unit, growOpts(s));
    s.humans = keep + r.people * G.unit;
    G.necrotic = r.state.necrotic;
    G.years = r.state.years;
    return { died: r.died, revived: r.revived, eaten: r.eaten * G.unit, grown: r.grown * G.unit };
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
    const people = Math.ceil(G.unit * TAKE_PEOPLE * k);
    const ore = Math.ceil(G.oreDay * TAKE_ORE_DAYS * k);
    const lackP = Math.max(0, people - feedOf(s));
    const lackO = Math.max(0, ore - (s.minerals || 0));
    const reachable = reach.has(id);
    return { people, ore, reachable, from: reach.get(id) || null, ok: reachable && !lackP && !lackO, short: { people: lackP, ore: lackO } };
}
/** The price in plain words, for the hover: "Costs 120 people and ⛏ 4 k." or what is missing. */
export function takeWords(s, layout, id) {
    if (!growOn(s) || risen(s)) return '';
    if (s.grow.body.includes(id)) return isNecrotic(bodyState(s.grow), id) ? 'It is starving.' : '';
    const p = takePrice(s, layout, id);
    if (!p.reachable) return '';
    if (p.ok) return `Costs ${short(p.people)} people and ${ORE_SIGN} ${short(p.ore)}.`;
    if (p.short.people) return `Needs ${short(p.short.people)} more people.`;
    return `Needs ${ORE_SIGN} ${short(p.short.ore)} more.`;
}
/**
 * The body takes `id`: the people walk in and do not come out, the ore goes into the flesh.
 * @returns {{id:string, from:string, people:number, ore:number}|null}
 */
export function takeChamber(s, layout, id) {
    if (!growOn(s) || risen(s)) return null;
    const p = takePrice(s, layout, id);
    if (!p.ok) return null;
    const G = s.grow;
    const next = take(graphOf(layout), bodyState(G), id);
    if (next.body === G.body) return null;
    s.humans -= p.people;
    s.minerals -= p.ore;
    G.body = next.body;
    G.taken = (G.taken || 0) + 1;
    return { id, from: p.from, people: p.people, ore: p.ore };
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
/** May the flesh take one more without starving? Fed, or the people last FEED_RED_YEARS after it. */
export function canAfford(s, layout, id) {
    const p = takePrice(s, layout, id);
    if (!p.ok || s.grow.necrotic.length) return false;
    const after = { ...s, humans: (s.humans || 0) - p.people, grow: { ...s.grow, body: [...s.grow.body, id] } };
    const h = hungerNow(after, layout);
    return h.net >= 0 || feedOf(after) / -h.net >= FEED_RED_YEARS + 1;
}

/**
 * The body's clock, in colony days: a body year every BODY_YEAR_DAYS, and with SPREAD the flesh takes
 * a chamber by itself every SPREAD_SECONDS[level] (only one it can afford without starving).
 * @param {object} s - mutated
 * @param {object} layout
 * @param {number} [days]
 * @returns {{years:number, died:string[], revived:string[], spread:object[]}}
 */
export function stepGrow(s, layout, days = 1) {
    const out = { years: 0, died: [], revived: [], spread: [] };
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
    const every = (SPREAD_SECONDS[G.lv.spread] ?? Infinity) * GROW_DAYS_PER_SECOND;
    if (Number.isFinite(every)) {
        G.spreadClock += days;
        while (G.spreadClock >= every) {
            G.spreadClock -= every;
            const id = spreadPick(s, layout);
            if (!id || !canAfford(s, layout, id)) break;
            const t = takeChamber(s, layout, id);
            if (t) out.spread.push(t);
        }
    }
    return out;
}

/* ------------------------------------------------------------------ what the organs make */
/**
 * What the body adds to each room type, counted in rooms of its old output (deep.js tickDay reads
 * it as `state.organs`): a living organ adds x20 and more (growth.js outputMultiplier, times MUSCLE),
 * a necrotic one takes its room away, a dormitory turned vat its beds. A chamber the monsters took or
 * the Watcher took for its hardware made nothing already and is left out. `games`: the hands.
 * `births` 0: the creches stop; from the question on only the vats grow people.
 * @returns {{mine:number, farm:number, generator:number, dorm:number, games:number, births:number}}
 */
export function organsOf(s, layout) {
    const out = { mine: 0, farm: 0, generator: 0, dorm: 0, games: 1, births: 1 };
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
        out[n.type] += outputMultiplier(graph, st, id) * muscle - 1;
    }
    return out;
}

/* ------------------------------------------------------------------ the instruments, overgrown */
/** Gauges in GROW: MASS (the ore), FEED (people), PULSE (power), FLESH (the share that is body). */
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
/**
 * The four levels, read like the needles were: 0 to 1 along the dial, red when short.
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
    const share = fleshShare(s, layout);
    return { M: tend.M, F, E: tend.E, H: { k: Math.min(GREEN_FROM + GREEN_SPAN, share), falling: false, red: false, days: Infinity } };
}

/** The stamped word in GROW, without the prefix. */
export const GROW_ADVICE = { spread: 'SPREAD', feed: 'FEED IT', vats: 'GROW VATS', rise: 'RISE' };
/** Is the body starving, or about to? */
export function hungry(s, layout) {
    return s.grow.necrotic.length > 0 || feedYears(s, layout) < FEED_RED_YEARS + 1;
}
export function adviseGrow(s, layout) {
    if (!growOn(s) || risen(s)) return '';
    if (riseReady(s, layout).ready) return GROW_ADVICE.rise;
    if (hungry(s, layout)) return canBuyBody(s, 'vats').ok ? GROW_ADVICE.vats : GROW_ADVICE.feed;
    return GROW_ADVICE.spread;
}
/** Ready to rise: the deepest floor full and the machine house body (growth.js). */
export function riseReady(s, layout) {
    if (!growOn(s)) return { ready: false, deepestFull: false, machine: false, deepest: 0 };
    return bodyReady(graphOf(layout), bodyState(s.grow));
}
/** The lamp row in GROW: the two conditions of the rise. */
export function riseLamps(s, layout) {
    const r = riseReady(s, layout);
    return [
        { key: 'floor', label: 'DEEPEST FLOOR FULL', lit: r.deepestFull, ordered: false },
        { key: 'machine', label: 'MACHINE REACHED', lit: r.machine, ordered: false },
    ];
}

/* ------------------------------------------------------------------ the drawer's body */
/** The price of the next level of a body item in stars, or Infinity at its top. */
export function bodyPrice(s, id) {
    const x = ITEM[id];
    if (!x || !growOn(s)) return Infinity;
    const lv = s.grow.lv[id] || 0;
    if (lv >= x.max) return Infinity;
    return s.grow.prices[id] || Infinity;
}
export function canBuyBody(s, id) {
    if (!growOn(s) || risen(s) || !ITEM[id]) return { ok: false, need: '' };
    const price = bodyPrice(s, id);
    if (!Number.isFinite(price)) return { ok: false, need: '', top: true };
    const lack = price - (s.stars || 0);
    return lack > 0 ? { ok: false, need: `You need ★ ${short(lack)} more.` } : { ok: true, need: '' };
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
/**
 * The drawer in GROW: one group, THE BODY, each item bright when it can be bought, dim with what it
 * needs when not; an item at its top is gone. The same rows as instruments.js drawerGroups.
 */
export function bodyGroups(s) {
    if (!growOn(s) || risen(s)) return [];
    const rows = [];
    for (const x of BODY_ITEMS) {
        const can = canBuyBody(s, x.id);
        if (can.top) continue;
        const price = bodyPrice(s, x.id);
        rows.push({
            id: `body:${x.id}`, name: x.name, does: bodyDoes(s, x.id), price: `★ ${short(price)}`,
            status: can.ok ? 'buy' : 'next', need: can.need, progress: -1,
        });
    }
    return rows.length ? [{ name: 'THE BODY', rows }] : [];
}
/**
 * Buys the next level of a body item; the level after it is priced off the machine's stars today.
 * @param {object} s - mutated
 * @param {string} id
 * @param {number} [starsPerDay] - the day's stars (tickDay's report): what the next level is set by
 */
export function buyBody(s, id, starsPerDay = 0) {
    const can = canBuyBody(s, id);
    if (!can.ok) return null;
    const price = bodyPrice(s, id);
    s.stars -= price;
    s.grow.lv[id] += 1;
    setPrice(s, id, starsPerDay, 0, price);
    return { id, level: s.grow.lv[id], price };
}

/** What the view draws: the body, the dead flesh, and the chambers it may take now. */
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
