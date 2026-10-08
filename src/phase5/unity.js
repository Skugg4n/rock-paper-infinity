/**
 * Chapter V · UNITY (docs/superpowers/specs/2026-10-06-chapter-v-unity.md): the rules. Pure.
 *
 * The body eats the earth. The edge eats cells of ground (ROCK, PAPER, SCISSORS) into the gut; the
 * STOMACH digests the gut into NUTRIENT; nutrient becomes new mass, shared between the organs by
 * GROW AS; the HEART powers all of it; the NERVE and the MINDS think, and THOUGHT pays for
 * EXPERIMENTS, which change the rules. Four flows: NUTRIENT, MASS (how fast the body grows), POWER,
 * THOUGHT. Each turn of the rules finds the one thing that slows the body most: the red word.
 *
 * Units: the rules count in CELLS of the current map (64 x 40 per scale). A cell of the city is a
 * block, a cell of the planet a country. Masses are in cells too (1 = enough to cover one cell).
 * At a zoom everything is rescaled to the new map's cells; the screen shows km² and tonnes.
 * Organ effects that should not shrink at a zoom (thought, power, memory, reach) use SHARES of the
 * body, so they are the same before and after.
 */
import {
    mapFor, stormAt, neighbours, CELLS, MAP_W, cx, cy, idx,
    ROCK, PAPER, SCISSORS, CLASS_NAMES, NONE, POISON, GRANITE, SEA, COLD, RIVER, DEEP, RICH, OBST_RICH,
} from './terrain.js';

export const SAVE_KEY = 'rpi-unity';
export const VERSION = 1;

// ------------------------------------------------------------------ the scales
/** Five maps. size = km² of the whole map; the body zooms out at ZOOM_AT of it eaten. */
export const SCALES = [
    { id: 'city', name: 'THE CITY', size: 14, phase: 1 },
    { id: 'county', name: 'THE COUNTY', size: 1600, phase: 2 },
    { id: 'country', name: 'THE COUNTRY', size: 140000, phase: 2 },
    { id: 'continent', name: 'THE CONTINENT', size: 9000000, phase: 2 },
    { id: 'planet', name: 'THE PLANET', size: 510000000, phase: 3 },
];
export const ZOOM_AT = 0.8;
export const tileKm2 = (scale) => SCALES[scale].size / CELLS;
/** Seconds on the current map (the weather counts from the arrival). */
export const mapTime = (s) => s.t - (s.scale > 0 ? (s.scaleAt || 0) : 0);

// ------------------------------------------------------------------ the organs
/**
 * The thirteen organs (spec "Organen, hela listan") plus TISSUE, the cheap filler.
 * flow: the panel line its word sits under. draw: power per mass. word: what lights red when it is missing.
 */
export const ORGANS = {
    skin: { name: 'SKIN', flow: 'mass', draw: 0.25, word: 'Thin.' },
    stomach: { name: 'STOMACH', flow: 'nutrient', draw: 0.5, word: 'Starving.' },
    heart: { name: 'HEART', flow: 'power', draw: 0, word: 'Weak pulse.' },
    nerve: { name: 'NERVE', flow: 'thought', draw: 0.9, word: 'Slow mind.' },
    tissue: { name: 'TISSUE', flow: 'mass', draw: 0.03, word: null, cost: 0.5 },
    eyes: { name: 'EYES', flow: 'thought', draw: 0.7, word: 'Blind.' },
    lungs: { name: 'LUNGS', flow: 'nutrient', draw: 0.5, word: 'Choking.' },
    intestines: { name: 'INTESTINES', flow: 'nutrient', draw: 0.4, word: 'Far from the gut.' },
    brain: { name: 'BRAIN', flow: 'thought', draw: 1.0, word: 'Forgetting.' },
    nails: { name: 'NAILS', flow: 'mass', draw: 0.03, word: 'Exposed.' },
    ears: { name: 'EARS', flow: 'mass', draw: 0.6, word: 'Deaf.' },
    muscle: { name: 'MUSCLE', flow: 'mass', draw: 0.7, word: 'Stuck.' },
    fat: { name: 'FAT', flow: 'nutrient', draw: 0.02, word: 'Hungry at night.' },
    bone: { name: 'BONE', flow: 'mass', draw: 0.02, word: 'Sagging.' },
};
/** GROW AS lists them in this order; the ones not yet grown are not there. */
export const ORGAN_ORDER = ['skin', 'stomach', 'heart', 'nerve', 'tissue', 'eyes', 'lungs', 'intestines', 'brain', 'nails', 'ears', 'muscle', 'fat', 'bone'];
export const FLOWS = ['nutrient', 'mass', 'power', 'thought'];
export const FLOW_NAMES = { nutrient: 'NUTRIENT', mass: 'MASS', power: 'POWER', thought: 'THOUGHT' };

// ------------------------------------------------------------------ the numbers
export const START_MINDS = 197;
export const START_MEMORY = 100;
/** Fas 1: the body that comes out of the vault, in cells. */
export const START_MASS = { skin: 2, stomach: 1.5, heart: 1.5, tissue: 1 };
/** A click bites while the body can stretch over the new ground: area up to this times its mass. */
export const STRETCH = 1.6;
/** Mass needed per cell for the edge to push at full speed (the body is "full"). */
export const DENS = 1;
/** Stomach: gut digested per second per stomach mass. */
export const DIG = 0.075;
/** By hand the stomach keeps up with the hand: it digests this many times faster before AUTONOMIC EDGE. */
export const HAND_DIG = 3;
/** The edge: cells a second per edible edge cell at full skin, full power. */
export const ACID0 = 0.07;
/** The city is eaten by hand first and then slowly; the land faster. */
export const ACID_SCALE = [0.7, 0.62, 0.62, 0.62, 0.75];
/** Skin per edge cell for the whole edge to eat. */
export const THICK0 = 0.5;
/** Skin per edge cell the storm needs to find to not tear, by scale. */
export const STORM_NEED = [2.2, 2.6, 3.2, 3.8, 4];
/** Cells a second torn per edge cell in full storm with no skin. */
export const TEAR = 0.03;
/** Heart: power per heart mass. */
export const HEART_K = 2.1;
/** Thought: per processing mind a second; the nerve's share times this, by scale. */
export const PROC_K = 0.05;
export const NERVE_RATE = [40, 80, 150, 260, 600];
/** Memory: thought per memory mind; the brain's share times this, by scale. */
export const MEM_K = 20;
export const BRAIN_CAP = [0, 30000, 60000, 110000, 160000];
/** At the cap the thought runs over into insight: per mind a second. */
export const INSIGHT_K = 0.0005;
/** Below the cap the people still give insight, at this part of the rate. */
export const INSIGHT_SLOW = 0.25;
/** Reach of the gut in cells without intestines; intestines add this times their share. */
export const GUT0 = 14;
export const GUT_K = 160;
/** Sight in cells: without eyes nothing past the edge; eyes give this plus their share times EYE_K. */
export const EYE0 = 6;
export const EYE_K = 220;
/** The body reshapes toward GROW AS at this share a second (so a turn of the dial is felt). */
export const RESHAPE = 0.012;
/** Fas 1 buttons: mass a buy, the price in mass-nutrient, rising. */
export const BUY_MASS = 1.5;
export const BUY_RISE = 1.03;
/** The minds in each vault (county, country, continent). */
export const VAULT_MINDS = [0, 140, 260, 410, 0];
/** Guides speak at most this often (s). */
export const GUIDE_GAP = 40;
/** RPS at the edge: [mode][class] = how well it eats. Wrong mode eats at a third; a draw stands still a beat in three. */
export const MODES = ['WRAP', 'CUT', 'CRUSH'];
export const MODE_BEATS = { WRAP: ROCK, CUT: PAPER, CRUSH: SCISSORS };
export const MODE_LOSES = { WRAP: SCISSORS, CUT: ROCK, CRUSH: PAPER };
export function modeMult(mode, k) {
    if (MODE_BEATS[mode] === k) return 1;
    if (MODE_LOSES[mode] === k) return 1 / 3;
    return 2 / 3;
}
/** The mode that beats a class. */
export const bestMode = (k) => MODES.find((m) => MODE_BEATS[m] === k);

// ------------------------------------------------------------------ the experiments
/**
 * EXPERIMENTS (spec table, plus the organs' own and the small multipliers). price: thought; ins: insight.
 * when(s): the row lights. The words are the player's (verbatim from the spec where it has them).
 */
export const EXPERIMENTS = [
    { id: 'auto', title: 'AUTONOMIC EDGE', line: 'The edge eats by itself.', price: 400, when: (s) => s.tut.done.start },
    { id: 'gravel', title: 'GRAVEL IN THE SKIN', line: 'Storms tear 60 % less.', price: 1200, when: (s) => s.torn > 0.5 || s.scale > 0 },
    { id: 'stomach2', title: 'A SECOND STOMACH', line: 'Twice the nutrient from what we eat.', price: 2000, when: (s) => s.ex.auto && (s.seenRed.stomach || s.ex.gravel) },
    { id: 'eyes', title: 'WE REMEMBER THE MAP', line: 'Eyes. We see past the edge.', ins: 1, when: (s) => s.ex.auto && (s.insight >= 0.5 || s.capHit) },
    { id: 'edgeknows', title: 'THE EDGE KNOWS', line: 'The edge picks its own way to eat.', price: 2500, when: (s) => s.scale >= 1 || (s.ex.gravel && s.ex.auto) },
    { id: 'lungs', title: 'FILTER LUNGS', line: 'Poison becomes food.', price: 3000, when: (s) => s.scale >= 1 },
    { id: 'gut', title: 'A LONGER GUT', line: 'Intestines carry food out to the far edge.', price: 3200, when: (s) => s.scale >= 1 && s.seenRed.intestines },
    { id: 'ears', title: 'WE HEAR THE WEATHER', line: 'Ears. The skin thickens before the storm.', price: 3600, when: (s) => s.scale >= 1 && s.torn > 30 },
    { id: 'granite', title: 'ACID FOR GRANITE', line: 'Mountains become food.', price: 6000, when: (s) => s.scale >= 2 },
    { id: 'parallel', title: 'WE THINK IN PARALLEL', line: 'Twice the processing. A brain to remember.', ins: 3, when: (s) => s.ex.eyes && s.scale >= 1 },
    { id: 'muscle', title: 'WE CAN PULL', line: 'Muscle. The edge pulls past what blocks it.', price: 6500, when: (s) => s.scale >= 1 && (s.stuckFor > 10 || s.seenRed.muscle || s.seenDeep) },
    { id: 'heart2', title: 'A HEART FOR A COUNTRY', line: 'Three times the power. Twice the hunger.', price: 9000, when: (s) => s.scale >= 2 },
    { id: 'nails', title: 'HARD AT THE EDGE', line: 'Nails cover what is tender at the edge.', price: 8000, when: (s) => s.scale >= 3 && (s.ex.salt || s.seenRed.nails) },
    { id: 'salt', title: 'SALT SKIN', line: 'We can cross the sea, slowly.', price: 9000, when: (s) => s.scale >= 3 },
    { id: 'seeds', title: 'SEEDS', line: 'We send seeds across the sea.', ins: 5, when: (s) => s.scale >= 4 },
    { id: 'bone', title: 'BONES FOR A CONTINENT', line: 'Bone. We can carry our own weight.', price: 10000, when: (s) => s.scale >= 3 && (s.seenRed.bone || s.scale >= 4) },
    { id: 'fat', title: 'A STORE OF FAT', line: 'Fat. Food for the long nights.', price: 15000, when: (s) => s.scale >= 4 && s.seenRed.fat },
    { id: 'warm', title: 'WARM ALL THE WAY THROUGH', line: 'The cold becomes food.', price: 30000, when: (s) => s.scale >= 4 && s.ex.seeds },
    { id: 'lookup', title: 'WE LOOK UP', line: 'There is more above.', ins: 10, when: (s) => s.scale >= 4 && s.one && s.ex.warm },
];
/** The small ones: five levels each, cheap, and every level is felt at once. */
export const MULTIS = [
    { id: 'fibre', title: 'THICKER FIBRE', line: 'Skin holds 25 % more.', base: 250, when: (s) => s.ex.auto && (s.torn > 0.5 || s.scale > 0) },
    { id: 'acid', title: 'FASTER ACID', line: 'The edge eats 25 % faster.', base: 300, when: (s) => s.ex.auto },
    { id: 'vessels', title: 'WIDER VESSELS', line: '20 % more power.', base: 280, when: (s) => s.ex.auto && (s.seenRed.heart || s.scale > 0) },
    // one for every organ that is grown (phase C: something small lights every 20 to 40 s)
    { id: 'walls', organ: 'stomach', title: 'THICKER WALLS', line: 'The stomach digests 20 % more.', base: 300, when: (s) => s.ex.auto && (s.seenRed.stomach || s.scale > 0) },
    { id: 'nerves', organ: 'nerve', title: 'QUICKER NERVES', line: 'The nerve thinks 20 % faster.', base: 300, when: (s) => s.ex.auto && s.scale > 0 },
    { id: 'wide', organ: 'eyes', title: 'WIDER EYES', line: 'The eyes see 25 % further.', base: 300, when: (s) => s.ex.auto && s.unlocked.eyes },
    { id: 'filters', organ: 'lungs', title: 'FINER FILTERS', line: 'The lungs clean 25 % more poison.', base: 300, when: (s) => s.ex.auto && s.unlocked.lungs },
    { id: 'loops', organ: 'intestines', title: 'LONGER LOOPS', line: 'The gut reaches 20 % further.', base: 300, when: (s) => s.ex.auto && s.unlocked.intestines },
    { id: 'folds', organ: 'brain', title: 'MORE FOLDS', line: 'The brain remembers 20 % more.', base: 300, when: (s) => s.ex.auto && s.unlocked.brain },
    { id: 'hard', organ: 'nails', title: 'HARDER NAILS', line: 'Nails cover 25 % more.', base: 300, when: (s) => s.ex.auto && s.unlocked.nails },
    { id: 'keen', organ: 'ears', title: 'KEENER EARS', line: 'The ears hear 25 % sooner.', base: 300, when: (s) => s.ex.auto && s.unlocked.ears },
    { id: 'pull', organ: 'muscle', title: 'STRONGER PULL', line: 'Muscle pulls 25 % harder.', base: 300, when: (s) => s.ex.auto && s.unlocked.muscle },
    { id: 'dense', organ: 'fat', title: 'DENSER FAT', line: 'Fat lasts 25 % longer.', base: 300, when: (s) => s.ex.auto && s.unlocked.fat },
    { id: 'heavy', organ: 'bone', title: 'HEAVIER BONE', line: 'Bone carries 25 % more.', base: 300, when: (s) => s.ex.auto && s.unlocked.bone },
];
/** A multiplier's effect: base ** level. */
export const mlt = (s, id, base = 1.2) => base ** (s.multi[id] || 0);
/** Phase C: prices follow the thought we make. A big experiment is about BIG_S seconds of thought away when it lights
 *  (never more than its price in the spec, never under a third of it); a small one MULTI_S0 + MULTI_S1 a level. */
export const BIG_S = 80;
export const MULTI_S0 = 22;
export const MULTI_S1 = 9;
/** Two significant figures. */
export function nice(n) {
    if (n < 100) return Math.max(10, Math.round(n / 10) * 10);
    const p = 10 ** (Math.floor(Math.log10(n)) - 1);
    return Math.round(n / p) * p;
}
/** What an experiment costs now (frozen when it lit; the spec's price before). */
export function priceOf(s, e) {
    if (!e.price) return 0;
    const k = s.prices && s.prices[e.id];
    return k != null ? k : e.price;
}
/** Freeze the prices of what has just lit, from the thought rate of this moment. */
function lightPrices(s, rate) {
    s.prices = s.prices || {};
    for (const e of EXPERIMENTS) {
        if (!e.price || e.id === 'auto' || s.ex[e.id] || s.prices[e.id] != null || !e.when(s)) continue;
        s.prices[e.id] = nice(Math.max(e.price * 0.3, Math.min(e.price, rate * BIG_S)));
    }
    for (const m of MULTIS) {
        const lv = s.multi[m.id] || 0;
        const k = `${m.id}:${lv}`;
        if (lv >= MULTI_MAX || s.prices[k] != null || !m.when(s)) continue;
        s.prices[k] = nice(Math.max(m.base * 0.5, rate * (MULTI_S0 + MULTI_S1 * lv)));
    }
}
export const MULTI_RISE = 1.8;
export const MULTI_MAX = 5;
export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
/** Which experiment grows an organ (a new GROW AS row). */
export const ORGAN_FROM = { nerve: 'auto', eyes: 'eyes', lungs: 'lungs', intestines: 'gut', brain: 'parallel', nails: 'nails', ears: 'ears', muscle: 'muscle', fat: 'fat', bone: 'bone' };
/** A small multiplier's price for its next level (scaled up with the map). */
export function multiPrice(s, m) {
    const lv = s.multi[m.id] || 0;
    const k = s.prices && s.prices[`${m.id}:${lv}`];
    if (k != null) return k;
    return Math.round(m.base * MULTI_RISE ** lv * (1 + s.scale) / 10) * 10;
}

// ------------------------------------------------------------------ the words (player text)
export const LINES = {
    start: (n) => [`${num(n)} MINDS. ONE BODY.`, 'THE CITY ABOVE US IS EMPTY. IT IS FOOD.'],
    bit: 'Click the edge to bite.',
    goal: ['MISSION: EAT THE CITY.', 'MISSION: EAT THE COUNTY.', 'MISSION: EAT THE COUNTRY.', 'MISSION: EAT THE CONTINENT.', 'MISSION: BE ONE.'],
    ours: ['The city is ours.', 'The county is ours.', 'The country is ours.', 'The continent is ours.'],
    one: 'We are one.',
    end: 'WE LOOK UP.',
    third: 'Eating at a third.',
    blocked: 'Nothing here we can eat.',
    vault: (n) => `${num(n)} minds join us.`,
    torn: 'STORM. THE EDGE IS TORN.',
    out: 'THE HATCH IS OPEN. WE ARE OUT.',
    room: (n) => (n > 0 ? `Room for ${n} more ${n === 1 ? 'block' : 'blocks'}.` : ''),
};
/** What the system says when an experiment is done (the CRT). */
export const DONE_LINES = {
    auto: 'THE EDGE EATS BY ITSELF.', gravel: 'GRAVEL IN THE SKIN.', stomach2: 'A SECOND STOMACH.', eyes: 'WE SEE.', edgeknows: 'THE EDGE KNOWS.',
    lungs: 'WE BREATHE POISON.', gut: 'THE GUT REACHES.', ears: 'WE HEAR.', granite: 'THE MOUNTAINS SOFTEN.', parallel: 'WE THINK IN PARALLEL.', muscle: 'WE PULL.',
    heart2: 'A HEART FOR A COUNTRY.', nails: 'HARD AT THE EDGE.', salt: 'SALT SKIN.', seeds: 'SEEDS.', bone: 'BONE.', fat: 'FAT.', warm: 'WARM ALL THE WAY THROUGH.', lookup: 'WE LOOK UP.',
};

// ------------------------------------------------------------------ format
export function num(n) {
    const v = Math.round(n);
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
/** Big numbers in words a person reads: 340, 12 400, 2.1 M, 4.3 B. No e-notation. */
export function big(n) {
    const a = Math.abs(n);
    if (a < 100000) return num(n);
    if (a < 1e9) return `${(n / 1e6).toFixed(n / 1e6 < 10 ? 1 : 0)} M`.replace(/^0\.0 M$/, '0.1 M');
    if (a < 1e12) return `${(n / 1e9).toFixed(n / 1e9 < 10 ? 1 : 0)} B`;
    return `${(n / 1e12).toFixed(1)} T`;
}
/** The body in the unit of its scale: 3.2 km², 410 km², 38 000 km², 2.1 M km², 41 % of the surface. */
export function areaText(s, cells = area(s)) {
    const km = cells * tileKm2(s.scale);
    if (s.scale >= 4) return `${Math.max(1, Math.round((km / SCALES[4].size) * 100))} % of the surface`;
    if (km < 1) return `${km.toFixed(2)} km²`;
    if (km < 10) return `${km.toFixed(1)} km²`;
    if (km < 1e6) return `${num(km)} km²`;
    return `${(km / 1e6).toFixed(1)} M km²`;
}
/** Growth a day in a unit that moves: m² while it is small (never "+0.00 km²"), km² after. */
export function perDayText(km) {
    const a = Math.abs(km), sign = km < 0 ? '-' : '+';
    if (a < 0.1) return `${sign}${num(Math.round(a * 1e6 / 10) * 10)} m²`;
    if (a < 10) return `${sign}${a.toFixed(1)} km²`;
    return `${sign}${big(a)} km²`;
}
/** Nutrient in tonnes: a cell of mass is this many. */
export const nutUnit = (s) => tileKm2(s.scale) * 50000;

// ------------------------------------------------------------------ state
export function newUnity({ minds = START_MINDS, seed = 7 } = {}) {
    const s = {
        v: VERSION, seed, t: 0, scale: 0,
        order: [], bite: 0,
        mass: Object.fromEntries(ORGAN_ORDER.map((o) => [o, 0])),
        grow: { skin: 30, stomach: 30, heart: 25, nerve: 0, tissue: 15 },
        unlocked: { skin: true, stomach: true, heart: true, tissue: true },
        pool: 0, nutrient: 0, buys: { skin: 0, stomach: 0, heart: 0 },
        thought: 0, insight: 0, minds, memory: Math.min(minds, START_MEMORY), capHit: false,
        ex: {}, multi: {}, mode: 'CUT', target: -1,
        seen: {}, joined: {}, torn: 0, stuckFor: 0, seenRed: {},
        red: null, redSince: 0, redLog: [],
        seeds: { design: { drift: 2, acid: 2, skin: 2, roots: 2, mind: 2 }, sent: [], continents: {} },
        one: false, ended: false, zoom: null,
        out: [], sfx: [], log: [],
        guide: null, guideAt: -GUIDE_GAP, said: {},
        tut: { stop: null, done: {} },
        events: [],
    };
    Object.assign(s.mass, START_MASS);
    // the body comes up out of the vault: a few blocks around the start
    const m = mapFor(seed, 0);
    seedBlob(s, m.start, 6);
    return s;
}
/** Eat n cells around a cell, closest first (a zoom, a landing seed, a checkpoint). */
export function seedBlob(s, at, n, edibleOnly = true) {
    const m = mapFor(s.seed, s.scale);
    const c = cache(s);
    const want = [];
    for (let i = 0; i < CELLS; i++) {
        if (c.eaten[i]) continue;
        if (edibleOnly && edible(s, m, i) <= 0) continue;
        want.push([Math.hypot(cx(i) - cx(at), (cy(i) - cy(at)) * 1.1) + m.noise[i] * 0.8, i]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, i] of want.slice(0, n)) eatCell(s, i, false);
}

// ------------------------------------------------------------------ the body on the map (derived, cached)
const caches = new WeakMap();
/** eaten (Uint8Array), frontier (Set of cells next to the body), for the state's order. */
export function cache(s) {
    let c = caches.get(s);
    if (!c || c.scale !== s.scale || c.n > s.order.length || c.seed !== s.seed) {
        c = { scale: s.scale, seed: s.seed, n: 0, eaten: new Uint8Array(CELLS), frontier: new Set() };
        caches.set(s, c);
    }
    while (c.n < s.order.length) {
        const i = s.order[c.n++];
        c.eaten[i] = 1;
        c.frontier.delete(i);
        for (const j of neighbours(i)) if (!c.eaten[j]) c.frontier.add(j);
    }
    return c;
}
export const area = (s) => s.order.length;
export const totalMass = (s) => ORGAN_ORDER.reduce((a, o) => a + s.mass[o], 0);
export const share = (s, o) => { const M = totalMass(s); return M > 0 ? s.mass[o] / M : 0; };
export const lvl = (s) => ({
    skin: s.ex.salt ? 3 : s.ex.gravel ? 2 : 1,
    stomach: s.ex.granite ? 3 : s.ex.stomach2 ? 2 : 1,
    heart: s.ex.warm ? 3 : s.ex.heart2 ? 2 : 1,
});
/** How well a cell can be eaten now: 0 = not at all. */
export function edible(s, m, i) {
    const o = m.obst[i];
    if (o === NONE || o === RIVER) return 1;
    if (o === POISON) return s.ex.lungs ? Math.min(1, 0.25 + share(s, 'lungs') * 12 * mlt(s, 'filters', 1.25)) : 0;
    if (o === DEEP) return s.ex.muscle ? 0.6 : 0;
    if (o === GRANITE) return s.ex.granite ? 1 : 0;
    // salt skin crosses the coast's seas; the oceans between continents only a seed crosses
    if (o === SEA) return s.ex.salt && s.scale < 4 ? 0.18 : 0;
    if (o === COLD) return s.ex.warm ? 1 : 0;
    return 1;
}
/** Food in a cell. */
export function richOf(m, i) {
    const o = m.obst[i];
    return o && OBST_RICH[o] != null ? OBST_RICH[o] : RICH[m.cls[i]];
}
function eatCell(s, i, food = true) {
    s.order.push(i);
    cache(s);
    if (food) s.pool += richOf(mapFor(s.seed, s.scale), i);
    const m = mapFor(s.seed, s.scale);
    if (m.vault === i && !s.joined[s.scale]) s.vaultReached = true;
}
/** The storm takes the newest edge back. */
function tearCells(s, n) {
    for (let k = 0; k < n && s.order.length > 3; k++) s.order.pop();
    cache(s);
}
/** The edge's next cells: the best few edible frontier cells (toward the target, else round and close). */
export function front(s, k = 6) {
    const m = mapFor(s.seed, s.scale);
    const c = cache(s);
    const tx = s.target >= 0 ? cx(s.target) : -1, ty = s.target >= 0 ? cy(s.target) : -1;
    const sc = [];
    for (const i of c.frontier) {
        const e = edible(s, m, i);
        if (e <= 0) continue;
        let n = 0;
        for (const j of neighbours(i)) n += c.eaten[j];
        const x = cx(i), y = cy(i);
        let score = m.noise[i] * 2.2 - n * 0.6;
        if (tx >= 0) score += Math.hypot(x - tx, y - ty) * 0.9;
        else score += Math.hypot(x - cx(m.start), (y - cy(m.start)) * 1.3) * 0.55;
        score += (1 - e) * 4;
        sc.push([score, i]);
    }
    sc.sort((a, b) => a[0] - b[0]);
    return sc.slice(0, k).map((p) => p[1]);
}

// ------------------------------------------------------------------ the flows
/**
 * Everything that is measured each moment. Pure (reads s, never writes).
 * Returns rates per second (= per day on the screen), the factors that slow the body, and the red one.
 */
export function flows(s) {
    const m = mapFor(s.seed, s.scale);
    const c = cache(s);
    const A = area(s), M = totalMass(s);
    const L = lvl(s);
    const sh = (o) => (M > 0 ? s.mass[o] / M : 0);
    // power
    const acidLv = s.multi.acid || 0;
    let use = 0;
    for (const o of ORGAN_ORDER) {
        let d = ORGANS[o].draw;
        if (o === 'skin') d *= 1.12 ** acidLv;
        if (o === 'stomach') d *= L.stomach >= 2 ? 1.4 : 1;
        use += s.mass[o] * d;
    }
    if (s.ex.heart2) use *= 2;
    const make = s.mass.heart * HEART_K * (s.ex.heart2 ? 3 : 1) * (s.ex.warm ? 1.3 : 1) * 1.2 ** (s.multi.vessels || 0);
    const p = use > 0 ? Math.min(1, make / use) : 1;

    // the edge
    let perim = 0, edibleN = 0, stormSum = 0;
    const blockedBy = { [POISON]: 0, [GRANITE]: 0, [SEA]: 0, [COLD]: 0, [DEEP]: 0 };
    for (const i of c.frontier) {
        perim++;
        const e = edible(s, m, i);
        if (e > 0) edibleN += e;
        else blockedBy[m.obst[i]] = (blockedBy[m.obst[i]] || 0) + 1;
        stormSum += stormAt(m, i, mapTime(s), s.scale);
    }
    perim = Math.max(1, perim);
    const thick = s.mass.skin / perim;
    const cover = Math.min(1, thick / THICK0);
    const ears = s.unlocked.ears ? Math.min(1.6 * mlt(s, 'keen', 1.1), 1 + sh('ears') * 12 * mlt(s, 'keen', 1.25)) : 1;
    const prot = thick * (s.ex.gravel ? 2.5 : 1) * 1.25 ** (s.multi.fibre || 0) * (s.ex.salt ? 1.4 : 1) * ears;
    // the storm: where it lies on the edge, the skin must be STORM_NEED thick or it tears
    let stormLoss = 0;
    for (const i of c.frontier) {
        const st = stormAt(m, i, mapTime(s), s.scale);
        if (st > 0) stormLoss += st * Math.max(0, 1 - prot / (STORM_NEED[s.scale] * st));
    }
    stormLoss = Math.min(0.9, stormLoss / perim);
    const stormFrac = stormSum / perim;
    const fr = front(s, 6);
    const mix = [0, 0, 0];
    for (const i of fr) mix[m.cls[i]]++;
    const at = fr.length ? mix.indexOf(Math.max(...mix)) : -1;
    // the patch after this one: what the edge will meet a little further on
    const ahead = front(s, 30).slice(8);
    const mix2 = [0, 0, 0];
    for (const i of ahead) mix2[m.cls[i]]++;
    const nextAt = ahead.length ? mix2.indexOf(Math.max(...mix2)) : -1;
    let mode = 0;
    const effMode = s.ex.edgeknows ? (at >= 0 ? bestMode(at) : s.mode) : s.mode;
    for (const i of fr) mode += modeMult(effMode, m.cls[i]);
    mode = fr.length ? mode / fr.length : 1;
    // the body has to be full behind the edge
    const fill = A > 0 ? M / (A * DENS) : 1;
    const fillMult = Math.max(0.12, Math.min(1, (fill - 0.55) / 0.4));
    // muscle pulls the edge past what blocks it
    const blockedFrac = 1 - Math.min(1, edibleN / perim);
    const pull = s.unlocked.muscle ? Math.min(2 * mlt(s, 'pull', 1.1), 1 + sh('muscle') * 10 * mlt(s, 'pull', 1.25)) : 1;
    // bone: on the planet the body sags without it
    const need = s.scale >= 3 ? A / CELLS : 0;
    const support = (s.scale >= 4 ? 0.3 : 0.42) + (s.unlocked.bone ? sh('bone') * 8 * mlt(s, 'heavy', 1.25) : 0);
    const sag = need > support ? Math.max(0.2, support / need) : 1;
    const acid = ACID0 * ACID_SCALE[s.scale] * 1.25 ** acidLv;
    const eat = s.ex.auto ? edibleN * acid * cover * p * fillMult * mode * (1 - stormLoss) * pull * sag : 0;
    const tear = stormLoss * perim * TEAR;

    // the gut: digest, and how far it reaches
    const radius = Math.sqrt(A / Math.PI);
    const reach = GUT0 + (s.unlocked.intestines ? sh('intestines') * GUT_K * mlt(s, 'loops') : 0);
    const gut = s.scale >= 1 ? Math.min(1, reach / Math.max(1, radius)) : 1;
    const night = s.scale >= 4 && Math.sin(s.t * 0.06) < -0.2;
    const fatMult = night ? Math.min(1, 0.45 + (s.unlocked.fat ? sh('fat') * 10 * mlt(s, 'dense', 1.25) : 0)) : 1;
    const digestCap = (s.ex.auto ? 1 : HAND_DIG) * mlt(s, 'walls') * s.mass.stomach * DIG * (L.stomach >= 2 ? 2 : 1) * (L.stomach >= 3 ? 1.3 : 1) * p * gut * fatMult;
    const digest = Math.min(digestCap, s.pool * 0.5 + 0.0001);

    // thought
    const proc = (s.minds - s.memory) * (s.ex.parallel ? 2 : 1);
    const grownK = 0.5 + Math.min(1, A / (CELLS * ZOOM_AT));
    const thoughtRate = proc * PROC_K + sh('nerve') * NERVE_RATE[s.scale] * grownK * p * mlt(s, 'nerves');
    const cap = s.memory * MEM_K + (s.unlocked.brain ? sh('brain') * BRAIN_CAP[s.scale] * mlt(s, 'folds') : 0);
    // insight is what only the people give: slowly always, four times faster when the thought is full
    const atCap = s.thought >= cap * 0.995 - 0.01;
    const insightRate = s.minds * INSIGHT_K * (atCap ? 1 : INSIGHT_SLOW);
    const sight = s.unlocked.eyes ? (EYE0 + sh('eyes') * EYE_K) * mlt(s, 'wide', 1.25) : 0;

    // tender organs at the edge (eyes, brain, gut) in a storm: nails cover them
    const tender = sh('eyes') + sh('brain') + sh('intestines');
    const exposed = s.unlocked.nails || s.scale >= 3 ? Math.max(0, stormFrac * tender * 6 - (s.unlocked.nails ? sh('nails') * 25 * mlt(s, 'hard', 1.25) : 0)) : 0;

    // the next experiment and when we can pay it
    const nxt = nextExperiment(s);
    const eta = nxt ? (nxt.ins ? (nxt.ins - s.insight) / Math.max(1e-6, insightRate || s.minds * INSIGHT_K * 0.5) : (nxt.price - s.thought) / Math.max(1e-6, thoughtRate)) : 0;

    // ---------------------------------------------------- the factors: what slows the body
    const F = [];
    const add = (organ, value, why, fix = null) => F.push({ organ, value: Math.max(0, Math.min(1, value)), word: ORGANS[organ].word, flow: ORGANS[organ].flow, why, fix });
    // (a factor's word can be more exact than its organ's: see the stomach below)
    const frac = (o) => blockedBy[o] / perim;
    // a block the organ cannot fix by growing: the fix is an experiment (granite, sea, cold, poison)
    // (it only bites once it holds a good part of the edge: under a quarter the rest of the edge eats on)
    const bfrac = (o) => Math.max(0, frac(o) - 0.25) * 1.6;
    const block = (o, ex, k) => (!s.ex[ex] ? 1 - bfrac(o) * k : 1);
    const gr = block(GRANITE, 'granite', 1.2), se = block(SEA, 'salt', 1.1), co = block(COLD, 'warm', 1.2);
    const digestVal = Math.min(digest >= digestCap * 0.98 && s.pool > digestCap * 6 ? 0.5 * fillMult + 0.3 : 1, fillMult);
    add('stomach', Math.min(digestVal, gr), 'gut', gr < digestVal ? 'granite' : null);
    // a block says what it is, not a hunger (UNITY test 1: "Starving." with the gut full)
    if (gr < digestVal) F[F.length - 1].word = BLOCK_WORDS.granite;
    // a gut full of what we cannot digest yet is "Full.", not "Starving."
    if (digest >= digestCap * 0.98 && s.pool > digestCap * 6 && digestVal <= gr) F[F.length - 1].word = 'Full.';
    const skinVal = Math.min(cover, 1 - stormLoss * 1.6);
    add('skin', Math.min(skinVal, se), 'edge', se < skinVal ? 'salt' : null);
    if (se < skinVal) F[F.length - 1].word = BLOCK_WORDS.sea;
    add('heart', Math.min(p, co), 'power', co < p ? 'warm' : null);
    if (co < p) F[F.length - 1].word = BLOCK_WORDS.cold;
    // the mind is red only when the body itself is not worse off (never under 0.7)
    if (s.ex.auto) add('nerve', nxt && !nxt.ins && nxt.price <= cap ? Math.max(0.7, Math.min(1, 90 / Math.max(1, eta))) : 1, 'thought');
    if (s.scale >= 1) add('intestines', gut, 'reach', s.unlocked.intestines ? null : 'gut');
    if (s.scale >= 1 && s.ex.auto) add('lungs', 1 - (s.ex.lungs ? frac(POISON) * 0.5 : bfrac(POISON) * 1.2), 'poison', s.ex.lungs ? null : 'lungs');
    if (nxt && !nxt.ins && nxt.price > cap) add('brain', 0.55, 'cap');
    if (s.scale >= 1 && m.vault >= 0 && !s.seen[s.scale] && !s.joined[s.scale] && s.t - (s.scaleAt || 0) > 60) add('eyes', 0.75, 'vault');
    if (exposed > 0) add('nails', 1 - exposed, 'storm');
    if (s.unlocked.ears && stormFrac > 0.15) add('ears', Math.min(1, 0.6 + sh('ears') * 12), 'storm');
    if (s.scale >= 4 && !s.ex.seeds && blockedFrac > 0.55) add('muscle', 1.2 - blockedFrac, 'sea', 'seeds');
    if (s.scale >= 1 && s.ex.auto && !s.ex.muscle && frac(DEEP) > 0.02) add('muscle', 1 - bfrac(DEEP) * 2, 'river', 'muscle');
    if (s.scale >= 2 && s.scale < 4 && s.ex.auto) add('muscle', blockedFrac > 0.55 ? 1.4 - blockedFrac * (s.unlocked.muscle ? 1 / pull : 1) : 1, 'blocked');
    if (night) add('fat', fatMult, 'night');
    if (s.scale >= 3) add('bone', sag, 'weight', s.unlocked.bone ? null : 'bone');
    if (blockedBy[DEEP] > 0) s.seenDeep = true;
    // the red word: the lowest factor under 0.8; a block only an experiment fixes counts as a quarter better, so a
    // slider that can help now (a weak heart while the sea blocks) is said first
    let red = null;
    const rank = (f) => f.value + (f.fix ? 0.25 : 0);
    for (const f of F) if (f.value < 0.8 && (!red || rank(f) < rank(red))) red = f;
    // what will break next: the lowest of the rest, yellow, before it is red
    let yellow = null;
    for (const f of F) if (f.value < 0.92 && (!yellow || f.value < yellow.value) && (!red || f.organ !== red.organ)) yellow = f;
    if (!s.ex.auto) yellow = null;
    // the bottleneck even when nothing is red: the lowest factor
    let low = null;
    for (const f of F) if (!low || f.value < low.value) low = f;
    // nothing at the edge can be eaten: say that, with the block's own fix
    if (s.ex.auto && edibleN < 0.5 && red) red = { ...red, word: 'Nowhere to grow.' };
    // the fix is an experiment we cannot hold in mind: then what is wrong is the memory
    if (red && red.fix) {
        const e = EXPERIMENTS.find((x) => x.id === red.fix);
        if (e && e.price && priceOf(s, e) > cap) red = { organ: 'brain', value: red.value, word: ORGANS.brain.word, flow: 'thought', why: 'cap', fix: s.unlocked.brain ? null : 'parallel', blocked: red };
    }
    // before the edge eats by itself the only thing that holds the hand back is the stretch
    if (!s.ex.auto) {
        // by hand the only things that hold the hand back: no room (with the nutrient to grow: "Full."), nothing to
        // grow with ("Starving."), a weak heart
        const canBite = A < M * STRETCH;
        if (!canBite) red = s.nutrient >= cheapestBuy(s) ? { organ: null, flow: 'mass', word: 'Full.', value: 0.3, why: 'room' } : { ...F.find((f) => f.organ === 'stomach'), word: 'Starving.', value: 0.3 };
        else red = p < 0.8 ? F.find((f) => f.organ === 'heart') : null;
    }
    return {
        p, make, use, perim, edibleN, thick, cover, prot, stormLoss, stormFrac, mix, at, effMode, mode, fill, fillMult, blockedFrac,
        nextAt, eat, tear, digest, digestCap, gut, reach, radius, thoughtRate, cap, insightRate, sight, eta, next: nxt, factors: F, red, yellow, low, night, sag,
        areaDay: (eat - tear) * tileKm2(s.scale), nutrientDay: digest * nutUnit(s),
    };
}

/** Experiments the player can see now: lit, not bought (the multipliers' next level, in their place). */
export function visibleExperiments(s) {
    // a price is set the moment its row lights and never moves after (UNITY test 1: GRAVEL 1 200 -> 360)
    lightPrices(s, flows(s).thoughtRate);
    const out = [];
    for (const e of EXPERIMENTS) if (!s.ex[e.id] && e.when(s)) out.push({ ...e, price: priceOf(s, e), kind: 'ex' });
    // a vault reached and seen: JOIN
    const m = mapFor(s.seed, s.scale);
    if (m.vault >= 0 && s.seen[s.scale] && !s.joined[s.scale]) {
        out.push({ id: 'join', kind: 'join', title: `JOIN · ${VAULT_MINDS[s.scale]} minds`, line: 'They wake inside us.', price: 0, ready: cache(s).eaten[m.vault] === 1 });
    }
    if (s.ex.seeds) out.push({ id: 'seed', kind: 'seed', title: 'SEED DESIGN', line: 'Choose what a seed carries.', price: 0 });
    for (const mu of MULTIS) {
        const lv = s.multi[mu.id] || 0;
        if (lv >= MULTI_MAX || !mu.when(s)) continue;
        out.push({ id: mu.id, kind: 'multi', title: `${mu.title} ${ROMAN[lv]}`, line: mu.line, price: multiPrice(s, mu) });
    }
    return out;
}
/** The next thing to think toward: the cheapest lit experiment (not the small ones). */
export function nextExperiment(s) {
    let best = null;
    for (const e of EXPERIMENTS) {
        if (s.ex[e.id] || !e.when(s)) continue;
        const pe = { ...e, price: priceOf(s, e) };
        if (!best || (pe.ins || 0) * 10000 + (pe.price || 0) < (best.ins || 0) * 10000 + (best.price || 0)) best = pe;
    }
    return best;
}
/** "Need 300 more thought." or null when it can be paid. */
export function needText(s, e) {
    if (e.kind === 'join') return e.ready ? null : 'Grow to it first.';
    if (e.kind === 'seed') return null;
    if (e.ins) return s.insight >= e.ins ? null : `Need ${num(Math.ceil(e.ins - s.insight))} more insight.`;
    if (e.price > flows(s).cap) return 'More than we can remember.';
    return s.thought >= e.price ? null : `Need ${num(Math.ceil(e.price - s.thought))} more thought.`;
}

// ------------------------------------------------------------------ actions
/** Buy an experiment (or a multiplier level, or JOIN). */
export function buy(s, id) {
    if (s.tut.stop) return false;
    const e = visibleExperiments(s).find((x) => x.id === id);
    if (!e || needText(s, e)) return false;
    if (e.kind === 'join') return join(s);
    if (e.kind === 'seed') return false;
    if (e.ins) s.insight -= e.ins; else s.thought -= e.price;
    if (e.kind === 'multi') {
        s.multi[id] = (s.multi[id] || 0) + 1;
        say(s, `${e.title}.`);
        s.sfx.push('buy');
        s.events.push({ t: s.t, what: e.title });
        return true;
    }
    s.ex[id] = true;
    for (const [o, from] of Object.entries(ORGAN_FROM)) {
        if (from === id && !s.unlocked[o]) {
            s.unlocked[o] = true;
            // a new organ starts with a little of the body and a share in GROW AS
            s.mass[o] = Math.max(s.mass[o], totalMass(s) * 0.02);
            s.grow[o] = 10;
            normalizeGrow(s, o);
        }
    }
    if (id === 'auto') { s.grow.nerve = 10; normalizeGrow(s, 'nerve'); s.nutrient = 0; }
    say(s, DONE_LINES[id] || e.title, true);
    s.sfx.push('experiment');
    s.events.push({ t: s.t, what: e.title });
    if (id === 'parallel') guide(s, 'parallel', 'Ms Ito', 'We think faster now.', 9);
    if (id === 'lookup') { s.ended = true; stop(s, 'end', [LINES.end]); }
    return true;
}
/** Fas 1: SKIN +, STOMACH +, HEART + (mass for nutrient, before GROW AS). */
export function buyPrice(s, o) { return BUY_MASS * BUY_RISE ** (s.buys[o] || 0); }
export function buyMass(s, o) {
    if (s.ex.auto || s.tut.stop || !['skin', 'stomach', 'heart'].includes(o)) return false;
    const pr = buyPrice(s, o);
    if (s.nutrient < pr) return false;
    s.nutrient -= pr;
    s.mass[o] += BUY_MASS;
    s.buys[o] = (s.buys[o] || 0) + 1;
    s.sfx.push('grow');
    s.events.push({ t: s.t, what: `${ORGANS[o].name} +` });
    return true;
}
/** Fas 1 before AUTONOMIC EDGE: a click on the edge bites a block. Returns the cell or -1. */
/** What a block is called when it is what slows the body (the experiment that ends it wears the mark). */
export const BLOCK_WORDS = { granite: 'Mountains.', sea: 'Sea.', cold: 'Too cold.' };
/** The cheapest of SKIN +, STOMACH +, HEART +. */
export const cheapestBuy = (s) => Math.min(...['skin', 'stomach', 'heart'].map((o) => buyPrice(s, o)));
/** Why a bite was refused, for the hand (UNITY test 1: 49 clicks, nothing said). */
export const BITE_NO = { full: 'Full. Grow first.', starving: 'Still digesting. A moment.', blocked: 'We cannot eat that yet.', far: 'Click the edge.' };
/** Fas 1: how many more blocks the body can stretch over before it must grow. */
export const roomLeft = (s) => Math.max(0, Math.ceil(totalMass(s) * STRETCH - area(s)));
export function bite(s, i) {
    if (s.ex.auto || s.tut.stop) return -1;
    const m = mapFor(s.seed, s.scale);
    const c = cache(s);
    const no = (why) => { s.lastBite = { ok: false, why, t: s.t }; s.sfx.push('nobite'); return -1; };
    if (!c.frontier.has(i)) return no('far');
    if (edible(s, m, i) <= 0) return no('blocked');
    if (area(s) >= totalMass(s) * STRETCH) return no(s.nutrient >= cheapestBuy(s) ? 'full' : 'starving');
    s.lastBite = { ok: true, t: s.t };
    eatCell(s, i);
    s.sfx.push('bite');
    s.bites = (s.bites || 0) + 1;
    return i;
}
/** The nearest edge cell to a map cell (a click near the edge bites the closest block). */
export function nearestEdge(s, i) {
    const m = mapFor(s.seed, s.scale);
    const c = cache(s);
    let best = -1, bd = 1e9;
    for (const j of c.frontier) {
        if (edible(s, m, j) <= 0) continue;
        const d = Math.hypot(cx(j) - cx(i), cy(j) - cy(i));
        if (d < bd) { bd = d; best = j; }
    }
    return bd <= 2.5 ? best : -1;
}
/** A click on the map after the edge eats by itself: grow toward there (again: no target). */
export function setTarget(s, i) {
    s.target = s.target === i ? -1 : i;
    return s.target;
}
export function setMode(s, mode) {
    if (!MODES.includes(mode) || s.ex.edgeknows) return false;
    s.mode = mode; s.sfx.push('mode');
    return true;
}
/** GROW AS: set one organ's share; the others give or take in proportion so the sum stays 100. */
export function setGrow(s, o, v) {
    if (!s.unlocked[o] || !s.ex.auto) return false;
    s.grow[o] = Math.max(0, Math.min(100, Math.round(v)));
    normalizeGrow(s, o);
    return true;
}
export function normalizeGrow(s, keep) {
    const keys = ORGAN_ORDER.filter((o) => s.unlocked[o] && (o !== 'nerve' || s.ex.auto));
    for (const o of Object.keys(s.grow)) if (!keys.includes(o)) delete s.grow[o];
    for (const o of keys) if (s.grow[o] == null) s.grow[o] = 0;
    const others = keys.filter((o) => o !== keep);
    const rest = 100 - (keep ? s.grow[keep] : 0);
    const sum = others.reduce((a, o) => a + s.grow[o], 0);
    if (sum <= 0) others.forEach((o, k) => { s.grow[o] = k === 0 ? rest : 0; });
    else {
        let used = 0;
        others.forEach((o) => { s.grow[o] = Math.floor((s.grow[o] / sum) * rest); used += s.grow[o]; });
        // the rounding left over goes to the biggest
        const big1 = others.reduce((a, o) => (s.grow[o] > s.grow[a] ? o : a), others[0]);
        if (big1) s.grow[big1] += rest - used;
    }
}
/** MINDS: how many remember (the rest process). */
export function setMemory(s, n) {
    if (s.scale < 1 && !s.ex.parallel) return false;
    s.memory = Math.max(0, Math.min(s.minds, Math.round(n)));
    return true;
}
function join(s) {
    const n = VAULT_MINDS[s.scale];
    s.joined[s.scale] = true;
    s.minds += n;
    s.memory += Math.round(n / 2);
    say(s, `JOIN · ${num(n)} MINDS.`, true);
    s.sfx.push('join');
    s.events.push({ t: s.t, what: `JOIN ${n}` });
    stop(s, `join${s.scale}`, [LINES.vault(n)]);
    const dream = ['They dreamed of the sea.', 'They dreamed of their own beds.', 'They dreamed of the sun on a wall.'][s.scale - 1];
    // the dream is said once: by Mrs Vance in the box (and its log line), or in the log when Dr Okafor speaks
    if (s.scale === 1) s.log.push(dream);
    guide(s, `joined${s.scale}`, s.scale === 1 ? 'Dr Okafor' : 'Mrs Vance', s.scale === 1 ? 'They did not choose this.' : dream, 10, true);
    return true;
}

// ------------------------------------------------------------------ SEEDS (fas 3, the rules only)
export const SEED_POINTS = 10;
export const SEED_KEYS = ['drift', 'acid', 'skin', 'roots', 'mind'];
export const SEED_WORDS = { sea: 'The seed died in the sea.', salt: 'The salt ate the seed.', stuck: 'The seed landed and sits there. It cannot think.', apart: 'The seed grows, but not with us.', joined: 'The seed grows into us.' };
/** Set the design (ten points). */
export function setDesign(s, d) {
    const v = Object.fromEntries(SEED_KEYS.map((k) => [k, Math.max(0, Math.round(d[k] || 0))]));
    if (SEED_KEYS.reduce((a, k) => a + v[k], 0) > SEED_POINTS) return false;
    s.seeds.design = v;
    return true;
}
/** Each other continent, across its sea: how far, how salt, how hard to grow into us. */
export function seas(s) {
    const m = mapFor(s.seed, 4);
    const home = m.land[m.start];
    const cent = {};
    for (let i = 0; i < CELLS; i++) {
        const k = m.land[i];
        if (!k) continue;
        cent[k] = cent[k] || { x: 0, y: 0, n: 0, cells: [] };
        cent[k].x += cx(i); cent[k].y += cy(i); cent[k].n++; cent[k].cells.push(i);
    }
    const h = cent[home];
    const out = [];
    for (const [k, c] of Object.entries(cent)) {
        if (Number(k) === home || c.n < 25) continue;
        const d = Math.hypot(c.x / c.n - h.x / h.n, c.y / c.n - h.y / h.n);
        const land = c.cells.reduce((b, i) => (Math.hypot(cx(i) - c.x / c.n, cy(i) - c.y / c.n) < Math.hypot(cx(b) - c.x / c.n, cy(b) - c.y / c.n) ? i : b), c.cells[0]);
        out.push({ k: Number(k), cells: c.n, land, dist: Math.max(1, Math.min(6, Math.round(d / 8))), salt: 1 + (Number(k) % 3), join: 1 + (Number(k) % 2) * 2 });
    }
    return out;
}
/** Send a seed to a continent; the result is one of SEED_WORDS' keys. Costs a tenth of the body's mass. */
export function sendSeed(s, k) {
    if (!s.ex.seeds) return null;
    const sea = seas(s).find((x) => x.k === k);
    if (!sea || s.seeds.continents[k] === 'joined') return null;
    const d = s.seeds.design;
    const M = totalMass(s);
    for (const o of ORGAN_ORDER) s.mass[o] *= 0.9;
    let res;
    if (d.drift < sea.dist) res = 'sea';
    else if (d.skin < sea.salt) res = 'salt';
    else if (d.mind < 1) res = 'stuck';
    else if (d.roots < sea.join) res = 'apart';
    else res = 'joined';
    s.seeds.sent.push({ t: s.t, k, res, design: { ...d } });
    if (res === 'joined' || res === 'apart' || res === 'stuck') {
        if (s.seeds.continents[k] !== 'apart' || res === 'joined') s.seeds.continents[k] = res;
        seedBlob(s, sea.land, res === 'stuck' ? 2 : 4 + d.acid * 6);
        s.mass.tissue += M * 0.02;
    }
    say(s, SEED_WORDS[res].toUpperCase());
    s.sfx.push(res === 'joined' ? 'join' : 'seed');
    s.events.push({ t: s.t, what: `seed ${k} ${res}` });
    s.one = seas(s).every((x) => s.seeds.continents[x.k] === 'joined');
    if (s.one && !s.tut.done.one) stop(s, 'one', [LINES.one]);
    return res;
}

// ------------------------------------------------------------------ voices
export function say(s, text, mark = false) { s.out.push({ text, who: 'sys', mark }); }
/** A guide speaks (one at a time, never more often than GUIDE_GAP, each line once). */
export function guide(s, key, who, text, prio = 5, force = false) {
    if (s.said[key]) return false;
    if (!force && s.t - s.guideAt < GUIDE_GAP) return false;
    s.said[key] = true;
    s.guide = { who, text, at: s.t, prio };
    s.guideAt = s.t;
    s.log.push(`${who}: ${text}`);
    if (s.log.length > 3) s.log.splice(0, s.log.length - 3);
    return true;
}
/** The guides' lines for a red word (Dr Okafor the body, Mr Lund the ground, Ms Ito the mind). */
export const RED_GUIDE = {
    // (muscle has two: the deep river before WE CAN PULL, nowhere to go after)
    stomach: ['Dr Okafor', 'We eat faster than we digest. More stomach.'],
    skin: ['Dr Okafor', 'The skin is thin at the edge. More skin.'],
    heart: ['Dr Okafor', 'The heart cannot keep up. More heart.'],
    nerve: ['Ms Ito', 'We think too slowly. More nerve.'],
    eyes: ['Mr Lund', 'Something is out there. We cannot see it.'],
    lungs: ['Dr Okafor', 'The ground is poison. We need lungs.'],
    intestines: ['Dr Okafor', 'The far edge is starving. The gut does not reach.'],
    brain: ['Ms Ito', 'We forget what we think. More memory.'],
    nails: ['Dr Okafor', 'What is tender lies at the edge, in the storm.'],
    ears: ['Mr Lund', 'The storms come without warning.'],
    muscle: ['Mr Lund', 'The edge has nowhere to go.'],
    fat: ['Dr Okafor', 'The nights are long here. We need a store.'],
    bone: ['Dr Okafor', 'We are too heavy.'],
};
export const VANCE = [
    'That was the station. I left from there once.',
    'The school. My boys were loud there.',
    'My street. I knew every door.',
];
/** A stop: the game holds, a box says one or two lines, OK goes on. Each comes once. */
export function stop(s, id, text, focus = null) {
    if (s.tut.done[id]) return false;
    s.tut.done[id] = true;
    s.tut.stop = { id, text, focus };
    return true;
}
export function closeStop(s) {
    const st = s.tut.stop;
    s.tut.stop = null;
    void st;
}

// ------------------------------------------------------------------ the clock
/** Progress through the current map, 0..1 of what has to be eaten for the zoom. */
export const progress = (s) => Math.min(1, area(s) / (CELLS * ZOOM_AT));

export function advance(s, dt) {
    if (s.ended) return;
    if (s.tut.stop || s.zoom) { lightPrices(s, flows(s).thoughtRate); return; }
    s.t += dt;
    const f = flows(s);
    lightPrices(s, f.thoughtRate);
    // the edge eats; the storm tears
    s.bite += (f.eat - f.tear) * dt;
    if (s.bite >= 1) {
        const n = Math.floor(s.bite);
        s.bite -= n;
        const fr = front(s, n + 2);
        for (let k = 0; k < n && k < fr.length; k++) eatCell(s, fr[k]);
    } else if (s.bite <= -1) {
        const n = Math.floor(-s.bite);
        s.bite += n;
        tearCells(s, n);
        s.torn += n;
        s.sfx.push('tear');
    }
    if (f.tear > 0.02) s.torn += f.tear * dt * 0.2;
    // the gut becomes nutrient; the nutrient becomes body
    const dig = f.digest * dt;
    s.pool = Math.max(0, s.pool - dig);
    if (!s.ex.auto) s.nutrient += dig;
    else {
        const N = dig + s.nutrient;
        s.nutrient = 0;
        for (const o of Object.keys(s.grow)) {
            const g = s.grow[o] / 100;
            if (g > 0 && s.unlocked[o]) s.mass[o] += (N * g) / (ORGANS[o].cost || 1);
        }
    }
    // the body reshapes itself toward GROW AS, slowly, even when nothing new comes in
    if (s.ex.auto) {
        const M = totalMass(s);
        const k = Math.min(1, RESHAPE * dt);
        for (const o of Object.keys(s.grow)) if (s.unlocked[o]) s.mass[o] += (M * (s.grow[o] / 100) - s.mass[o]) * k;
    }
    // the storm takes skin and, without nails, what is tender at the edge
    if (f.stormLoss > 0) s.mass.skin = Math.max(0.2, s.mass.skin - f.stormLoss * s.mass.skin * 0.01 * dt);
    // thought, its cap, the overflow
    s.thought = Math.min(f.cap, s.thought + f.thoughtRate * dt);
    s.insight += f.insightRate * dt;
    if (s.thought >= f.cap * 0.995 - 0.01) s.capHit = true;
    // what the eyes see: the vault of this map
    const m = mapFor(s.seed, s.scale);
    if (m.vault >= 0 && !s.seen[s.scale] && f.sight > 0) {
        const c = cache(s);
        for (const i of c.frontier) {
            if (Math.hypot(cx(i) - cx(m.vault), cy(i) - cy(m.vault)) <= f.sight) { s.seen[s.scale] = true; break; }
        }
        if (s.seen[s.scale]) {
            const where = ['', 'under the old capital', 'under the mountains', 'under the coast'][s.scale];
            guide(s, `vault${s.scale}`, 'Mr Lund', `Something ${where}. A vault. ${VAULT_MINDS[s.scale]} asleep.`, 9, true);
            say(s, 'A VAULT.', true);
        }
    }
    // blocked
    s.stuckFor = f.blockedFrac > 0.55 ? s.stuckFor + dt : Math.max(0, s.stuckFor - dt * 2);
    // the red word
    const key = f.red ? f.red.organ : null;
    if (key !== s.red) {
        s.red = key; s.redSince = s.t;
        if (key) { s.seenRed[key] = true; s.redLog.push({ t: s.t, key }); }
    }
    if (s.red && s.t - s.redSince > 4) {
        const [who, text] = RED_GUIDE[s.red] || [];
        if (who) guide(s, `red-${s.red}-${s.scale}`, who, text, 6);
    }
    stepStory(s, f);
    // the map eaten: zoom out
    if (progress(s) >= 1 && !s.zoom && s.scale < 4 && !s.tut.stop) {
        s.zoom = { from: s.scale, at: s.t };
        s.sfx.push('zoom');
    }
}

/** The stops and the guides that are not about the red word. */
function stepStory(s, f) {
    if (!s.tut.done.start) { stop(s, 'start', [...LINES.start(s.minds), LINES.bit], 'edge'); say(s, LINES.out); }
    if (s.scale === 0 && s.torn > 0.5 && !s.tut.done.storm) stop(s, 'storm', [LINES.torn, 'It tears the edge where the skin is thin.'], 'skin');
    if (s.scale === 0) {
        const pr = progress(s);
        VANCE.forEach((t, k) => { if (pr > 0.25 * (k + 1)) guide(s, `vance${k}`, 'Mrs Vance', t, 3); });
    }
    if (f.stormFrac > 0.1 && s.scale >= 1) guide(s, `storm${s.scale}`, 'Mr Lund', 'Storm from the west.', 4);
    if (s.thought >= f.cap * 0.995 && f.cap > 0) guide(s, 'cap', 'Ms Ito', 'We are full. What we think now becomes insight.', 5);
    const nx = f.next;
    if (nx && !nx.ins && s.thought >= nx.price) guide(s, `afford-${nx.id}`, 'Ms Ito', `${nx.title} is within reach.`, 4);
}

/**
 * The zoom (after the stop "The city is ours."): the next map, the body a dot on it.
 * Everything in cells is rescaled by the ratio of the cells' sizes.
 */
export function doZoom(s) {
    const from = s.scale;
    if (from >= 4) return;
    const ratio = tileKm2(from) / tileKm2(from + 1);
    const A = area(s) * ratio;
    for (const o of ORGAN_ORDER) s.mass[o] *= ratio;
    s.pool *= ratio;
    s.scale = from + 1;
    s.scaleAt = s.t;
    s.order = [];
    s.bite = 0;
    s.target = -1;
    s.zoom = null;
    const m = mapFor(s.seed, s.scale);
    seedBlob(s, m.start, Math.max(6, Math.round(A)));
    say(s, SCALES[s.scale].name + '.', true);
    s.sfx.push('arrive');
}
/** The zoom has played on the screen (or the sim skips it): the stop that says it. */
export function zoomDone(s) {
    if (!s.zoom || s.tut.stop) return;
    const from = s.zoom.from;
    s.tut.done[`zoom${from}`] = true;
    // the next map comes first, so it is there under the box (UNITY test 1: a black screen with a red dot)
    doZoom(s);
    s.tut.stop = { id: 'ours', text: [LINES.ours[from]], focus: null };
}

// ------------------------------------------------------------------ save
export function serialize(s) {
    const { out: _o, sfx: _f, ...rest } = s;
    return JSON.stringify(rest);
}
export function deserialize(raw) {
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== VERSION) return null;
    const s = newUnity({ minds: d.minds, seed: d.seed });
    Object.assign(s, d, { out: [], sfx: [] });
    return s;
}
/** The vault's end hands over this many minds (the people in the body). */
export function fromVault(here) { return newUnity({ minds: Math.max(1, Math.round(here || START_MINDS)) }); }

export { CLASS_NAMES, CELLS, MAP_W, idx, cx, cy, mapFor, stormAt };
