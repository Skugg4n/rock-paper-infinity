/**
 * Chapter IV · THE DEEP: pure rules. No DOM, no timers. The simulation
 * (scripts/sim-phase4.mjs) and the game share this file.
 * Design: docs/superpowers/specs/2026-09-21-chapter-iv-the-deep-design.md
 *
 * Units: one tick = one DAY of colony time. Real time per day is set by cryo.
 *
 * THE FOUR COLUMNS ARE READ THE SAME WAY. Each one is a SURPLUS PER DAY: what
 * the colony makes beyond what it needs to keep running.
 *   M  minerals mined      minus the minerals the generators burn as fuel
 *   F  food grown          minus the food eaten and the food a newborn costs
 *   E  energy made         minus the energy every room draws
 *   H  hands: people awake minus the people on duty in the rooms that are not automated,
 *      counted in what a day of those hands is worth to the colony. Dormitory ROOMS add beds
 *      and so add people; dormitory LEVELS add some beds and make every pair of hands worth more.
 *      Asleep there is nobody on duty, so the column is the sleepers the machines carry, and the
 *      machines are only half as good at it (SLEEP_HANDS).
 * Stars per day = 10 × the smallest of the four. The dot marks the smallest;
 * upgrading it is always the best move, and then another becomes the smallest.
 *
 * What a room costs to run grows with every upgrade too, only slower than what it makes
 * (roomMultiplier vs upkeepMultiplier): a deeper mine draws more power and needs more hands,
 * but nothing like as much more as it brings up. So no column can run away from the others and
 * the bottleneck keeps moving, while every upgrade still pays for itself.
 * Automating a room type drops its crew need to nothing: that is why automation
 * is the purchase that makes the long sleeps possible.
 */

export const ROOMS = ['mine', 'farm', 'generator', 'dorm'];
/** Column letters in the order the UI shows them; roomFor maps each to the room that fixes it. */
export const COLUMN = ['M', 'F', 'E', 'H'];
export const ROOM_FOR_COLUMN = { M: 'mine', F: 'farm', E: 'generator', H: 'dorm' };
/** Hands go to the rooms in this order: the lights first, then food, then ore, then the beds. */
export const CREW_ORDER = ['generator', 'farm', 'mine', 'dorm'];
/** Power is spread the same way, but ore comes before food: ore is what the generators burn,
 *  so the mine is the last room the colony is willing to switch off. The larder is deep enough
 *  to ride out a brownout in the farms; a colony that stops mining never lights up again. */
export const POWER_ORDER = ['generator', 'mine', 'farm', 'dorm'];
/** Output per room per day at level 0; energy it draws; people it needs while manual. */
export const ROOM = {
    mine:      { out: 12, energy: 4, crew: 3 },
    farm:      { out: 14, energy: 3, crew: 2 },
    generator: { out: 26, energy: 0, crew: 2, fuel: 1.5 },  // burns minerals
    dorm:      { out: 16, energy: 2, crew: 0 },            // BEDS per room: the only room whose
    //                                                        output is not multiplied by its level
};
export const FOOD_PER_HUMAN = 1;            // per day
export const SLEEP_HANDS = 0.5;             // asleep the machines stand in for the hands, but only this well
export const SLEEP_FOOD = 0.1;              // asleep a body burns this share of a ration: slowly, but it does,
                                            // so a larder without farms behind it runs out under the ice too
export const SLEEP_FUEL = 0.5;              // asleep a generator burns this share of its ore for the same
                                            // power: the lifts are still and nothing moves but the machines
export const WORK_PER_HAND = 25;            // what one pair of spare hands is worth to the colony in a day
                                            // at dormitory level 0: the exchange rate that puts all four
                                            // columns in the same unit
/** A better dormitory does two things at once: it holds more people (this share of its
 *  multiplier) and it makes each of them worth more (the rest). Together they come to the same
 *  ×2 a level gives any other room, so the H column climbs like the others while the colony
 *  stays a colony and not a planet. */
export const BED_SHARE = 0.3;
export const FOOD_MARGIN = 1.25;            // the creches only run while the farms bring in this much
                                            // more than the colony eats, so the F column never settles
                                            // on zero and a full colony still earns its stars
export const BIRTH_FOOD = 20;               // food from the larder a new colonist costs
export const BIRTH_SHARE = 0.02;            // at most this much of the larder goes to newcomers in a day
export const GROWTH_PER_YEAR = 6.0;         // toward the beds while the larder holds: a bed left empty
                                            // for long is the colony's own fault, not the calendar's
export const SLEEP_GROWTH = 0.3;            // the creches run slower while the colony sleeps
export const STARS_PER_UNIT = 10;           // stars/day = 10 × the smallest surplus
export const DAYS_PER_YEAR = 365;
export const HUNGER_PER_DAY = 0.002;        // people lost per day with an empty larder
/** The ice is not kind: this share of the sleepers is lost per sleeping year, and every
 *  dormitory level keeps CRYO_DEATH_DORM of it (better beds, better pods). The creches
 *  refill a fed colony, so the cost is food and the count on the wake-up strip. */
export const CRYO_DEATH_PER_YEAR = 0.003;
export const CRYO_DEATH_DORM = 0.75;
export const cryoDeathRate = (s) => CRYO_DEATH_PER_YEAR * Math.pow(CRYO_DEATH_DORM, (s.level && s.level.dorm) || 0) / 365;

/** Costs. Minerals dig and build; stars buy levels, automation and cryo. */
export const digCost = (chambers) => Math.round(100 * Math.pow(1.45, chambers));
export const roomCost = (type, n) => Math.round((type === 'dorm' ? 45 : 60) * Math.pow(1.7, n));
export const levelCost = (type, level) => Math.round(4400 * Math.pow(9, level));
/** Automation I, II, III, then ADVANCED automation (×100), which is the last thing a colony
 *  can afford and the top of that ladder. Past it, only levels are left to buy. */
export const MAX_AUTO = 4;
export const AUTOMATION_COST = [6.0e4, 2.4e6, 1.2e8, 2.0e10];
export const automationCost = (type, auto) => (auto < MAX_AUTO ? AUTOMATION_COST[auto] : Infinity);
/**
 * Cryo tiers. Since v1.43.0 a sleep is a STATE, not a press: `days` is how many colony days
 * pass per real second while the colony is under the ice, and `cost` is the tier's price in
 * stars. A month, a year, a decade, a century, a millennium, ten and a hundred millennia a
 * second. The chapter is 802 701 years long, so the top tiers are not a convenience, they are
 * the only way the calendar ever gets there.
 */
export const CRYO = [
    { id: 'cryo-i',   days: 30,       cost: 4.0e4 },
    { id: 'cryo-ii',  days: 365,      cost: 5.0e5 },
    { id: 'cryo-iii', days: 3650,     cost: 1.2e8 },
    { id: 'cryo-iv',  days: 36500,    cost: 2.0e12 },
    { id: 'cryo-v',   days: 365000,   cost: 2.0e14 },
    { id: 'cryo-vi',  days: 3650000,  cost: 2.0e16 },
    { id: 'cryo-vii', days: 36500000, cost: 2.0e18 },
];
/** "Cryo I" to "Cryo VII": what a sentence calls a tier. */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const cryoName = (tier) => `Cryo ${ROMAN[tier] || tier + 1}`;
/** Thousands are grouped with a space, never a comma: the counter reads the same in every locale. */
export const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/**
 * The badge on the snowflake: how long one press sleeps. Months until a press is worth a year,
 * years after that. The ladder reads 1 m, 1 y, 10 y, 100 y, 1 000 y, 10 000 y, 100 000 y.
 * @param {number} days
 * @returns {string}
 */
export function cryoLabel(days) {
    const d = Math.max(0, Math.round(days));
    if (d < DAYS_PER_YEAR) return `${Math.max(1, Math.round(d / 30))} m`;
    return `${group(Math.round(d / DAYS_PER_YEAR))} y`;
}
/**
 * THE ONE NUMBER THAT SETS THE LENGTH OF THE CHAPTER. The surface heals only with time:
 * doomsday × e^(−years/SURFACE_DECAY_YEARS), and the decay is derived so that a colony that went
 * down at DOOM_AT_BOOM comes up at RESURFACE_AT in exactly END_YEAR years. Nothing the player can
 * buy touches this line. Move END_YEAR and the whole calendar moves with it; the cryo ladder is
 * what has to be able to reach it.
 */
export const END_YEAR = 802701;             // the year the traveller stops at in The Time Machine
export const DOOM_AT_BOOM = 85;             // how scorched the surface is the day the exit is blown
export const RESURFACE_AT = 15;
export const SURFACE_DECAY_YEARS = END_YEAR / Math.log(DOOM_AT_BOOM / RESURFACE_AT);
export const SURFACE_HALF_LIFE_YEARS = SURFACE_DECAY_YEARS * Math.LN2;
export const surface = (doom0, days) => doom0 * Math.exp(-(days / DAYS_PER_YEAR) / SURFACE_DECAY_YEARS);
/** The day the ring opens for a colony that went down at `doom0`. */
export const resurfaceDay = (doom0) => DAYS_PER_YEAR * SURFACE_DECAY_YEARS * Math.log(doom0 / RESURFACE_AT);
/** The working title of what waits at the top. One constant, so it is renamed in one place. */
export const CHAPTER_V = { roman: 'V', title: 'RETURN' };
/** The first ones through the hatch: this share of the colony. On a surface that is not ready
 *  they are the price of trying; on one that is, everyone follows them up. */
export const ASCENT_FAIL_LOSS = 0.25;
/** A colony this small cannot send anyone up and still be a colony. */
export const ASCENT_MIN_PEOPLE = 3;
/** What the dead taught us: after a failed try the colony knows the surface this well. */
export const ASCENT_TAUGHT_SPREAD = 3;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------------------------------------------------------------------------
 * SURVIVAL, ONE WORD EVERYWHERE (v1.45.0). Ola, after playing v1.44.0:
 * "Scout party returned surface 93 %... what? Whole? Broken?" The rules count
 * DOOMSDAY, as chapter III did (85 the day the exit was blown, 15 when the
 * surface can be walked on). The player is only ever shown the other side of
 * it: the chance of SURVIVAL if the colony went up now, 100 minus doomsday, so
 * every number on screen grows toward the goal: 15 % at the descent, 85 % to go up.
 * ------------------------------------------------------------------------ */
/** The line, the way the player reads it: "need 85 %". */
export const SURVIVAL_AT = 100 - RESURFACE_AT;
/** Doomsday per cent to survival per cent. */
export const survival = (doomPct) => clamp(100 - doomPct, 0, 100);
/** The true chance of survival up there today. Nobody on screen knows this; the rules do. */
export const survivalNow = (s) => survival(surface(s.doom0, s.day));

/* ---------------------------------------------------------------------------
 * PROBES, AND WHAT THE COLONY BELIEVES ABOUT THE SURFACE
 *
 * Nobody can see up. The ring on the crust is not `surface()`, it is the
 * colony's ESTIMATE of it: a mean and a spread, wide and grey at first
 * ("40 ± 40 %"), narrowed by every probe that comes back with a reading. A
 * probe costs ore to build and spare power to launch, and it is away for years
 * of colony time, so its answer arrives at a wake-up and never while you watch.
 * Some come back wrong, some do not come back, and one in twenty comes back as
 * something that takes a chamber.
 * ------------------------------------------------------------------------ */

export const PROBE_COST_MINERALS = 3000;      // the first one; each one after costs more to build
export const PROBE_COST_GROWTH = 1.6;
export const PROBE_ENERGY = 40;               // spare power the day it is launched: the E column must carry it
export const PROBE_DAYS = 2 * DAYS_PER_YEAR;  // the first probe is away two years
export const PROBE_DAYS_FLOOR = 90;           // a later one, better aimed, is back in a season
export const PROBE_DAYS_DECAY = 0.8;
export const probeCost = (sent) => Math.round(PROBE_COST_MINERALS * Math.pow(PROBE_COST_GROWTH, Math.max(0, sent)));
export const probeDays = (sent) => Math.max(PROBE_DAYS_FLOOR, Math.round(PROBE_DAYS * Math.pow(PROBE_DAYS_DECAY, Math.max(0, sent))));

/** The outcome table from the design sketch, read in this order. Both rows sum to 1. */
export const PROBE_OUTCOMES = ['reading', 'lost', 'wrong', 'monster'];
export const PROBE_ODDS_EARLY = { reading: 0.40, lost: 0.40, wrong: 0.15, monster: 0.05 };
export const PROBE_ODDS_LATE = { reading: 0.80, lost: 0.10, wrong: 0.05, monster: 0.05 };
export const PROBE_NOISE = 14;                // points of scatter on a good reading the day of the boom
export const PROBE_WRONG_SHIFT = 25;          // how far out a lying instrument is

/** How good the colony's instruments are: 0 the day the exit was blown, 1 at END_YEAR. The
 *  calendar is logarithmic, so the skill is too, or every probe past the first millennium
 *  would be perfect. */
export function probeSkill(day) {
    const end = END_YEAR * DAYS_PER_YEAR;
    return clamp(Math.log10(1 + Math.max(0, day)) / Math.log10(1 + end), 0, 1);
}
/** @returns {{reading:number, lost:number, wrong:number, monster:number}} the odds on this day */
export function probeOdds(day) {
    const k = probeSkill(day);
    const o = {};
    for (const key of PROBE_OUTCOMES) o[key] = PROBE_ODDS_EARLY[key] + k * (PROBE_ODDS_LATE[key] - PROBE_ODDS_EARLY[key]);
    return o;
}

/** How far a good reading may be off, in points, for a party that comes home on `day`. */
export const probeScatter = (day) => Math.max(2, PROBE_NOISE * (1 - 0.7 * probeSkill(day)));

/**
 * Odds as whole per cents that add up to exactly 100 (largest remainder), so a tooltip never
 * reads 99 % or 101 % between them.
 * @param {object} odds - shares that sum to 1
 * @param {string[]} keys - which of them, in order
 * @returns {object} the same keys, integers
 */
export function wholePercents(odds, keys) {
    const raw = keys.map((k) => 100 * (odds[k] || 0));
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
    for (let j = 0; left > 0 && j < order.length; j++, left--) out[order[j][1]] += 1;
    return Object.fromEntries(keys.map((k, i) => [k, out[i]]));
}

/**
 * Everything the scout button says before it is pressed (v1.45.0): who goes, for how long, the
 * odds of each way it can end on the day they would come home, and how far a good reading may be
 * off. Nothing about a party is hidden from the player.
 * @param {object} s - state
 * @returns {{people:number, days:number, price:number, pct:{reading:number, lost:number, wrong:number, monster:number}, scatter:number}}
 */
export function scoutOdds(s) {
    const sent = s.probesSent || 0;
    const days = probeDays(sent);
    const back = (s.day || 0) + days;
    return {
        people: scoutParty(s.humans),
        days,
        price: probeCost(sent),
        pct: wholePercents(probeOdds(back), PROBE_OUTCOMES),
        scatter: Math.round(probeScatter(back)),
    };
}

/**
 * What one probe comes back with, or does not. Pure: hand it the randomness.
 *
 * @param {Function} rng - returns a number in [0, 1)
 * @param {number} day - the day it comes back; the instruments improve with the calendar
 * @param {number} surfaceTrue - what the surface really is that day, in per cent
 * @returns {{outcome:'reading'|'lost'|'wrong'|'monster', reading:number|null, spread:number}}
 *          `spread` is how much to trust the reading; 0 when there is none.
 */
export function resolveProbe(rng, day, surfaceTrue) {
    const odds = probeOdds(day);
    let roll = rng();
    let outcome = PROBE_OUTCOMES[PROBE_OUTCOMES.length - 1];
    for (const key of PROBE_OUTCOMES) {
        if (roll < odds[key]) { outcome = key; break; }
        roll -= odds[key];
    }
    const scatter = probeScatter(day);
    if (outcome === 'reading') {
        return { outcome, reading: clamp(surfaceTrue + (rng() * 2 - 1) * scatter, 0, 100), spread: scatter };
    }
    if (outcome === 'wrong') {
        // A mad probe is not noise, it is a number in the wrong place. Half of them say the
        // surface is worse than it is, half say it is safe: that one is how a colony dies.
        const sign = rng() < 0.5 ? -1 : 1;
        return { outcome, reading: clamp(surfaceTrue + sign * PROBE_WRONG_SHIFT, 0, 100), spread: scatter };
    }
    return { outcome, reading: null, spread: 0 };
}

/** Before any probe: a shrug. The ring is drawn from this until the first one returns. */
export const ESTIMATE_START = { mean: 40, spread: 40 };
export const ESTIMATE_FLOOR = 2;              // the colony is never certain, however many it sends

/**
 * Two beliefs into one: the old estimate and a new reading, each weighted by how tight it is.
 * A good reading pulls the mean toward the truth and always narrows the spread; a wrong one
 * narrows it just the same, which is why a lying probe is worse than a lost one.
 *
 * @param {{mean:number, spread:number}} est
 * @param {number|null} reading - per cent, or null for a probe that told us nothing
 * @param {number} spread - how much to trust the reading
 * @returns {{mean:number, spread:number}} a new estimate; the old one is not touched
 */
export function updateEstimate(est, reading, spread) {
    const base = est || ESTIMATE_START;
    if (reading == null || !(spread > 0)) return { mean: base.mean, spread: base.spread };
    const w0 = 1 / (base.spread * base.spread), w1 = 1 / (spread * spread);
    return {
        mean: clamp((base.mean * w0 + reading * w1) / (w0 + w1), 0, 100),
        spread: Math.max(ESTIMATE_FLOOR, Math.sqrt(1 / (w0 + w1))),
    };
}

/** What an estimate says, as the player reads it: "15 ± 40 %", the chance of survival up there. */
export const estimateText = (est) => `${Math.round(survival((est || ESTIMATE_START).mean))} ± ${Math.round((est || ESTIMATE_START).spread)} %`;

/* ---------------------------------------------------------------------------
 * THE GOAL ON SCREEN (v1.43.0, B066). The first outside playtest: "why build
 * things? what is the goal?" The fog of war had hidden the one thing the chapter
 * is about. Now the ring is there from the first second: the colony knows the
 * physics, so its belief FOLLOWS THE TRUE HEALING CURVE, with a wide band of
 * doubt round it. What it does not know is how far off its own instruments are:
 * that is `bias`, zero until a scout party comes back and moves it. Scouts narrow
 * the band; a raving one can bend the curve. The state keeps { bias, spread };
 * `estimateNow()` turns it into today's { mean, spread }.
 * ------------------------------------------------------------------------ */

/** Today's belief: the healing curve, shifted by what the colony got wrong, with its doubt. */
export function estimateNow(s) {
    const truth = surface(s.doom0, s.day);
    const e = s.est || {};
    return { mean: clamp(truth + (e.bias || 0), 0, 100), spread: e.spread ?? ESTIMATE_START.spread };
}
/** Today's belief the way the player reads it: the chance of survival up there, give or take. */
export function believedSurvival(s) {
    const e = estimateNow(s);
    return { mean: survival(e.mean), spread: e.spread };
}
/** The day the colony BELIEVES the ring reaches the line, or Infinity when it never will. */
export function estimateOpensDay(s) {
    const target = RESURFACE_AT - ((s.est && s.est.bias) || 0);
    if (!(target > 0)) return Infinity;
    if (target >= s.doom0) return 0;
    return DAYS_PER_YEAR * SURFACE_DECAY_YEARS * Math.log(s.doom0 / target);
}
/** The year printed under the ring: "survival 85 % ~ year 802 701". */
export const habitableYear = (s) => {
    const d = estimateOpensDay(s);
    return Number.isFinite(d) ? Math.round(d / DAYS_PER_YEAR) : Infinity;
};

/* ---------------------------------------------------------------------------
 * SCOUT PARTIES (v1.43.0, B058): the probes, made of people. A party leaves with
 * a share of the colony, costs ore and spare power, and is away for years. It
 * comes back with a reading, or raving, or not at all, or with something behind
 * it. The functions keep their old names (launchProbe, resolveDueProbes) so the
 * save and the tests read the same; the words on screen are "scout party".
 * ------------------------------------------------------------------------ */
export const SCOUT_SHARE = 0.05;              // a party is this share of the colony
export const SCOUT_MIN = 4;
export const SCOUT_MAX = 60;
export const scoutParty = (humans) => clamp(Math.round((humans || 0) * SCOUT_SHARE), SCOUT_MIN, SCOUT_MAX);
/** A colony under this many people cannot go under the ice: someone has to run the hall. */
export const MIN_SLEEPERS = 10;

/**
 * Send a party. The ore and the people are gone the day it leaves; the answer is years away.
 * @param {object} s - state, mutated
 * @returns {{sentDay:number, dueDay:number, people:number}|null} null when the ore or the
 *          people were not there (the colony keeps MIN_SLEEPERS at home)
 */
export function launchProbe(s) {
    const price = probeCost(s.probesSent || 0);
    const party = scoutParty(s.humans);
    if (s.minerals < price || s.humans - party < MIN_SLEEPERS) return null;
    s.minerals -= price;
    s.humans -= party;
    const p = { sentDay: s.day, dueDay: s.day + probeDays(s.probesSent || 0), people: party };
    s.probesSent = (s.probesSent || 0) + 1;
    s.probes = (s.probes || []).concat([p]);
    s.shaftOpen = true;                 // the first party clears the rubble at the top for good
    return p;
}
/** A party is out there: the button waits for it, one party at a time. */
export const scoutsOut = (s) => (s.probes || []).length > 0;

/**
 * A monster takes a chamber: it stands dark and makes nothing until it is cleared. Pure, so the
 * scene can be told which plate to mark and the tests can name the slot.
 *
 * @param {object} s - state, mutated
 * @param {(string|null)[]} slots - the layout's slots: which chamber holds which room
 * @param {Function} rng - returns a number in [0, 1)
 * @returns {number} the slot it took, or -1 when there was nothing left to take
 */
export function darkenChamber(s, slots, rng) {
    const taken = s.darkSlots || [];
    const open = [];
    (slots || []).forEach((type, i) => { if (type && ROOMS.includes(type) && taken.indexOf(i) < 0) open.push(i); });
    if (!open.length) return -1;
    const slot = open[Math.min(open.length - 1, Math.floor(rng() * open.length))];
    s.dark = s.dark || {};
    s.dark[slots[slot]] = (s.dark[slots[slot]] || 0) + 1;
    s.darkSlots = taken.concat([slot]);
    return slot;
}

/** Light one chamber again: somebody went in and cleared it. */
export function clearChamber(s, slots, slot) {
    if ((s.darkSlots || []).indexOf(slot) < 0) return false;
    const type = (slots || [])[slot];
    s.darkSlots = s.darkSlots.filter((i) => i !== slot);
    if (type && s.dark?.[type] > 0) s.dark[type] -= 1;
    return true;
}

/** Buying anything for a room type clears its dark chambers: the crew walk in with the order. */
export function clearDarkType(s, slots, type) {
    let n = 0;
    for (const slot of (s.darkSlots || []).slice()) {
        if ((slots || [])[slot] === type && clearChamber(s, slots, slot)) n++;
    }
    return n;
}

/** The loudest column of a sleep: what the wake-up strip marks as the weakest. */
export function weakestOf(hist) {
    return COLUMN.reduce((a, k) => ((hist?.[k] || 0) > (hist?.[a] || 0) ? k : a), 'M');
}

/**
 * Every party that was due home by today. Since v1.43.0 they come home on their own day, awake
 * or asleep: asleep, the return is an alarm that wakes the colony.
 *
 * A reading or a raving party comes back whole and moves the belief; a lost one is gone with
 * everyone in it; a monster comes back with half the party and takes a chamber.
 *
 * @param {object} s - state, mutated
 * @param {(string|null)[]} slots - the layout's slots, for the one that comes back as a monster
 * @param {Function} rng - returns a number in [0, 1)
 * @returns {Array<{outcome:string, reading:number|null, slot:number, people:number, back:number}>}
 */
export function resolveDueProbes(s, slots, rng) {
    const landed = [], still = [];
    for (const p of (s.probes || [])) {
        if (p.dueDay > s.day) { still.push(p); continue; }
        const truth = surface(s.doom0, p.dueDay);
        const r = resolveProbe(rng, p.dueDay, truth);
        const people = p.people || 0;
        let slot = -1, back = 0;
        if (r.outcome === 'monster') {
            slot = darkenChamber(s, slots, rng);
            back = Math.floor(people / 2);
        } else if (r.outcome !== 'lost') {
            // the reading is of the day they looked, so the belief is compared on that day
            const bias = (s.est && s.est.bias) || 0;
            const then = { mean: clamp(truth + bias, 0, 100), spread: s.est?.spread ?? ESTIMATE_START.spread };
            const next = updateEstimate(then, r.reading, r.spread);
            s.est = { bias: next.mean - truth, spread: next.spread };
            back = people;
        }
        s.humans += back;
        if (r.outcome !== 'lost') s.estRevealed = true;
        landed.push({ outcome: r.outcome, reading: r.reading, slot, people, back });
    }
    s.probes = still;
    return landed;
}

/** The next day a party is due home, or Infinity. */
export const nextScoutDue = (s) => (s.probes || []).reduce((a, p) => Math.min(a, p.dueDay), Infinity);

/* Awake people mend what the scouts let in: a dark chamber clears after REPAIR_DAYS awake days
   with at least REPAIR_HANDS free. Clicking the plate or buying for its kind still clears it at
   once; this is the colony doing it on its own. */
export const REPAIR_DAYS = 10;
export const REPAIR_HANDS = 3;
/**
 * One awake day of repair work. Pure.
 * @param {object} s - state, mutated
 * @param {(string|null)[]} slots
 * @param {number} hands - free hands today (tickDay's `hands`)
 * @returns {number} the slot that was cleared today, or -1
 */
export function repairTick(s, slots, hands) {
    if (!(s.darkSlots || []).length) { s.repair = 0; return -1; }
    if (!(hands >= REPAIR_HANDS)) return -1;
    s.repair = (s.repair || 0) + 1;
    if (s.repair < REPAIR_DAYS) return -1;
    s.repair = 0;
    const slot = s.darkSlots[0];
    clearChamber(s, slots, slot);
    return slot;
}
/** Output multipliers: ×2 per level, ×3 per automation past the first, ×100 per advanced (after the third). */
export function roomMultiplier(level, auto) {
    const adv = Math.max(0, Math.min(auto, MAX_AUTO) - 3);
    return Math.pow(2, level) * Math.pow(3, Math.max(0, Math.min(auto, 3) - 1)) * Math.pow(100, adv);
}
/**
 * What a room's UPKEEP is multiplied by: the power it draws, the hands it needs, the fuel it
 * burns. Upkeep grows with every upgrade, so the four columns stay tied to each other and the
 * bottleneck keeps moving, but it grows far slower than output: an upgrade always pays for
 * itself, and no single purchase can ever darken the colony.
 */
export function upkeepMultiplier(level, auto) {
    const adv = Math.max(0, Math.min(auto, MAX_AUTO) - 3);
    return Math.pow(1.5, level) * Math.pow(1.7, Math.max(0, Math.min(auto, 3) - 1)) * Math.pow(6, adv);
}

/* ---------------------------------------------------------------------------
 * NOTHING IS INSTANT (v1.41.1, Ola: "I buy electricity and BOOM all humans drop;
 * I cannot understand what will happen")
 *
 * A purchase is an ORDER, not an event. The ore and the stars go the moment it is
 * placed, and the colony then spends days actually digging the chamber or wiring the
 * automation. The plate and the button carry a filling ring while it is under way, so
 * the change arrives somewhere the player is already looking, at a speed they can read.
 * A sleep finishes whatever was still being built, because the machines do not stop.
 * ------------------------------------------------------------------------ */
export const BUILD_DAYS = { dig: 8, room: 5, level: 6, auto: 12 };
/* Ola's sketch said 20 / 10 / 15 / 30. Those are the right SHAPE (a chamber is quick, an
 * automation is the slow one) but at one real second to the colony's day they cost the run
 * 21 real minutes of standing about: 42m39s to resurface against the chapter's 20 to 30
 * minute target. These are the same ladder at the pace the game actually runs: 27m58s, and
 * the longest the star counter ever reads zero is 58 s, shorter than before orders existed.
 * Run scripts/sim-phase4.mjs before touching them again. */

/**
 * Place an order. The caller has already taken the price; this only says when it lands.
 * @param {object} s - state, mutated
 * @param {'dig'|'room'|'level'|'auto'} kind
 * @param {object} [opts]
 * @param {string} [opts.type] - the room type, for everything but a dig
 * @param {number} [opts.slot] - which chamber a new room goes into
 * @returns {object} the job
 */
export function startBuild(s, kind, { type = null, slot = -1 } = {}) {
    const job = { kind, type, slot, startDay: s.day, doneDay: s.day + BUILD_DAYS[kind] };
    s.builds = (s.builds || []).concat([job]);
    return job;
}

/** How far along a job is, 0 to 1. */
export function buildProgress(s, job) {
    const span = job.doneDay - job.startDay;
    if (!(span > 0)) return 1;
    return Math.max(0, Math.min(1, (s.day - job.startDay) / span));
}

/** Is this room type already waiting on an order of this kind? One at a time, per kind. */
export function buildPending(s, kind, type = null) {
    return (s.builds || []).some((j) => j.kind === kind && (type === null || j.type === type));
}

/**
 * Everything whose day has come. Called once per colony day, and by `sleep()`, never from
 * `tickDay` itself: a dry run on a clone must show today's numbers and not tomorrow's.
 *
 * @param {object} s - state, mutated
 * @returns {Array<object>} the jobs that finished, for the layout and the scene to follow
 */
export function completeBuilds(s) {
    const done = [], still = [];
    for (const job of s.builds || []) (job.doneDay <= s.day ? done : still).push(job);
    if (!done.length) return done;
    s.builds = still;
    for (const job of done) {
        if (job.kind === 'dig') s.chambers += 1;
        else if (job.kind === 'room') s.rooms[job.type] = (s.rooms[job.type] || 0) + 1;
        else if (job.kind === 'level') s.level[job.type] = (s.level[job.type] || 0) + 1;
        else if (job.kind === 'auto') s.auto[job.type] = (s.auto[job.type] || 0) + 1;
    }
    return done;
}

/** Fresh colony: what came down the hole. */
export function initialDeepState({ salvage = 1500, doom0 = DOOM_AT_BOOM, people = 10 } = {}) {
    return {
        day: 0, minerals: salvage, food: 500, stars: 0, humans: people, asleep: false,
        chambers: 3, rooms: { mine: 0, farm: 1, generator: 1, dorm: 1, cryo: 0 },
        level: { mine: 0, farm: 0, generator: 0, dorm: 0 },
        auto: { mine: 0, farm: 0, generator: 0, dorm: 0 },
        // What a monster took: rooms of this type that stand dark and make nothing until they
        // are cleared. Empty, and every number below is exactly what it was before probes existed.
        dark: { mine: 0, farm: 0, generator: 0, dorm: 0 },
        darkSlots: [],                      // which chambers those are; the scene's business, not the rules'
        stalled: {},                        // room types that stopped during the last sleep
        probes: [], probesSent: 0,          // in flight: { sentDay, dueDay }
        builds: [],                         // ordered, not yet finished: { kind, type, slot, startDay, doneDay }
        // the belief about the surface: the healing curve, off by `bias`, give or take `spread`
        est: { bias: 0, spread: ESTIMATE_START.spread }, estRevealed: false,
        repair: 0,                          // awake days spent clearing the first dark chamber
        actWokeDay: null,                   // the last "you can act" wake, so it comes at most once a decade
        ascended: false,
        shaftOpen: false,                   // the rubble at the top of the shaft up, cleared by the first party
        cryo: -1, doom0,
    };
}

/**
 * One day of colony life. Mutates and returns a report of the flows, so the
 * UI can mark the bottleneck and the wake-up summary can add days up.
 * @param {object} s - state
 * @param {boolean} asleep - everyone in cryo: no eating, no working, manual rooms stop
 */
export function tickDay(s, asleep = false) {
    const awake = asleep ? 0 : s.humans;
    const mult = (t) => roomMultiplier(s.level[t], s.auto[t]);
    const upkeep = (t) => upkeepMultiplier(s.level[t], s.auto[t]);
    // Rooms a monster has taken make nothing and need nothing until they are cleared. With
    // none taken this is s.rooms[t] exactly, so the whole economy is the one the sim balanced.
    const live = (t) => Math.max(0, (s.rooms[t] || 0) - ((s.dark && s.dark[t]) || 0));
    // Hands. A manual room type needs crew × rooms × its own multiplier; automation needs none.
    // Short of hands a room type runs at a fraction, never all-or-nothing: half the crew, half the ore.
    const staff = {}; let crewLeft = awake;
    for (const t of CREW_ORDER) {
        const need = s.auto[t] > 0 ? 0 : live(t) * ROOM[t].crew * upkeep(t);
        if (need <= 0) { staff[t] = 1; continue; }
        const got = Math.min(need, crewLeft);
        staff[t] = got / need; crewLeft -= got;
    }
    const hands = crewLeft;
    const running = (t) => live(t) * staff[t] * mult(t);
    // Energy: the generators burn minerals, every room draws power, a shortfall scales output.
    const drawing = (t) => live(t) * staff[t] * upkeep(t);      // upkeep side of a running room
    const fuelWanted = drawing('generator') * ROOM.generator.fuel * (asleep ? SLEEP_FUEL : 1);
    const fuel = Math.min(s.minerals, fuelWanted);
    const fuelK = fuelWanted > 0 ? fuel / fuelWanted : 1;
    const energyMade = running('generator') * ROOM.generator.out * fuelK;
    s.minerals -= fuel;
    const energyNeed = ROOMS.reduce((a, t) => a + drawing(t) * ROOM[t].energy, 0);
    const power = {}; let powerLeft = energyMade;
    for (const t of POWER_ORDER) {
        const need = drawing(t) * ROOM[t].energy;
        if (need <= 0) { power[t] = 1; continue; }
        const got = Math.min(need, powerLeft);
        power[t] = got / need; powerLeft -= got;
    }
    const energySpare = powerLeft;
    // Flows: a room makes what its crew and its power allow.
    const working = (t) => running(t) * power[t];
    const mined = working('mine') * ROOM.mine.out;
    const grown = working('farm') * ROOM.farm.out;
    s.minerals += mined; s.food += grown;
    // People eat, and grow toward the beds as long as the larder holds. Asleep nobody eats,
    // but the creches keep running, slower, on the food the automated farms bring in.
    const capacity = live('dorm') * power.dorm * ROOM.dorm.out * Math.pow(mult('dorm'), BED_SHARE);   // an unlit bed is not a bed
    // the ice takes its share first, and the creches then fill the beds it emptied
    const died = asleep ? s.humans * cryoDeathRate(s) : 0;
    s.humans -= died;
    const demand = s.humans * FOOD_PER_HUMAN;        // what the colony eats, or will eat when it wakes
    const eat = asleep ? demand * SLEEP_FOOD : demand;
    let born = 0, starving = false;
    if (s.food >= eat) {
        s.food -= eat;
        // The creches only run while the farms grow a margin more than the colony will eat when it
        // wakes, and while there are beds to put people in. So the colony never grows itself into a
        // famine, and never quite eats its own food surplus either. Newcomers are grown from the
        // larder, never from the day's harvest, which keeps the F column readable as "grown minus eaten".
        const rate = (asleep ? SLEEP_GROWTH : 1) * GROWTH_PER_YEAR / DAYS_PER_YEAR;
        const mouthsToSpare = grown / FOOD_MARGIN - demand;
        if (mouthsToSpare > 0) born = Math.max(0, Math.min(s.humans * rate, capacity - s.humans, mouthsToSpare, s.food * BIRTH_SHARE / BIRTH_FOOD));
        s.food -= born * BIRTH_FOOD; s.humans += born;
    } else {
        s.food = 0; starving = true;
        s.humans = Math.max(2, s.humans * (1 - HUNGER_PER_DAY));
    }
    // Stars: the balance of the four surpluses. Asleep nobody stands at a post, so the H
    // column counts the sleepers the machines carry instead of the hands on duty.
    const parts = {
        M: mined - fuel,
        F: grown - eat,
        E: energySpare,
        H: WORK_PER_HAND * Math.pow(mult('dorm'), 1 - BED_SHARE) * (asleep ? s.humans * SLEEP_HANDS : hands),
    };
    const weakest = COLUMN.reduce((a, k) => (parts[k] < parts[a] ? k : a), 'M');
    const stars = STARS_PER_UNIT * Math.max(0, parts[weakest]);
    s.stars += stars; s.day += 1;
    // What each room actually drew and who actually stood in it. The bars are hovered and have
    // to say where their number came from (Ola: "I buy electricity and BOOM all humans drop"),
    // and a sentence cannot be written from a fraction alone.
    const draw = {}, crew = {}, rooms = {};
    for (const t of ROOMS) {
        draw[t] = drawing(t) * ROOM[t].energy * power[t];
        crew[t] = s.auto[t] > 0 ? 0 : live(t) * ROOM[t].crew * upkeep(t) * staff[t];
        rooms[t] = live(t);
    }
    return { minerals: mined, food: grown, fuel, fuelWanted, energyMade, energyNeed, energySpare, hands, born, died, starving, stars, weakest, parts, capacity, staff, power, draw, crew, eaten: eat, awake, live: rooms };
}

/* ---------------------------------------------------------------------------
 * SLEEP IS A STATE (v1.43.0, B055). The playtest: "click, wait, buy buy buy,
 * cryo, wait". Now the snowflake starts a sleep and the colony runs, years rolling,
 * until something WAKES it. An alarm is a condition the player must see to, in a
 * plain sentence. The bad ones (the colony would come to harm if it slept on) are
 * what a dry run checks before a tier is offered; the benign ones (a party home, an
 * order finished with the next one paid for, the ring at the line) only wake.
 * ------------------------------------------------------------------------ */

/** Food this close to running out wakes the colony. */
export const FOOD_ALARM_DAYS = 30;
/** "You can act" wakes come at most once in this many sleeping days. */
export const ACT_WAKE_GAP_DAYS = 10 * DAYS_PER_YEAR;
/** The alarms that mean harm. A tier is only offered when a dry run meets none of them. */
export const BAD_ALARMS = ['food', 'energy', 'stall', 'few'];

/** A free chamber, counted the way the rules can count it: every room, the hall, and every
 *  room already ordered take one. */
export function freeChambers(s) {
    const used = ROOMS.reduce((a, t) => a + (s.rooms[t] || 0), 0) + (s.rooms.cryo || 0)
        + (s.builds || []).filter((j) => j.kind === 'room').length;
    return Math.max(0, s.chambers - used);
}

/** Can the colony pay for the next purchase that fixes this column: a room, a level or an automation? */
export function canActOn(s, column) {
    const t = ROOM_FOR_COLUMN[column];
    if (!t) return false;
    if (freeChambers(s) > 0 && !buildPending(s, 'room', t) && s.minerals >= roomCost(t, s.rooms[t] || 0)) return true;
    if (!buildPending(s, 'level', t) && s.stars >= levelCost(t, s.level[t] || 0)) return true;
    return !buildPending(s, 'auto', t) && s.stars >= automationCost(t, s.auto[t] || 0);
}

/**
 * What is wrong today, if anything, in the order the colony would want to hear it. Read off a
 * SLEEPING day's report: nobody is on a shift, so a manual room is a stalled room.
 *
 * @param {object} s - state after the day
 * @param {object} r - that day's report from tickDay(s, true)
 * @returns {object|null} { kind:'stall', type, why:'hands'|'fuel' } | { kind:'energy', pct }
 *          | { kind:'food', days } | { kind:'few' } | null
 */
export function troubleIn(s, r) {
    for (const t of CREW_ORDER) {
        if ((r.live?.[t] || 0) > 0 && r.staff[t] < 0.999) return { kind: 'stall', type: t, why: 'hands' };
    }
    if (r.fuelWanted > 0 && r.fuel < r.fuelWanted * 0.999) return { kind: 'stall', type: 'generator', why: 'fuel' };
    if (ROOMS.some((t) => (r.live?.[t] || 0) > 0 && r.power[t] < 0.999)) {
        const pct = r.energyNeed > 0 ? Math.floor(100 * Math.min(1, r.energyMade / r.energyNeed)) : 0;
        return { kind: 'energy', pct };
    }
    // what the sleepers eat beyond what the farms bring in while everyone is under
    const need = s.humans * FOOD_PER_HUMAN * SLEEP_FOOD - r.food;
    if (need > 0) {
        const days = s.food / need;
        if (days < FOOD_ALARM_DAYS) return { kind: 'food', days: Math.floor(days) };
    }
    if (s.humans < MIN_SLEEPERS) return { kind: 'few' };
    return null;
}

/**
 * Sleep up to `days` days in cryo: the same rules, nobody awake. Returns the summed report
 * (the wake-up summary).
 *
 * Without options this is the plain sleep of slices 1 and 2: it runs its days, finishes what
 * was being built, and only the sensor on the shaft stops it early, the day the surface has
 * truly healed. With `alarms`, it stops the day anything in `troubleIn` happens, the day a
 * scout party comes home, the day the colony's own estimate crosses the line, and on a
 * finished order when the next purchase is already paid for (at most once a decade). The
 * reason is `sum.alarm`.
 *
 * Fast forward. When a sleeping day leaves nothing that could make the next day different
 * (the people held steady, the larder did not shrink, the generators got all the ore they
 * asked for and the mines bring in at least as much as they burn, nothing is on order),
 * every day up to the next thing that can happen is that same day, and they are run in one
 * step: the same numbers exactly, not an estimate. That is how the top tier, a hundred
 * thousand years a second, stays a handful of loops in the browser.
 *
 * @param {object} s - state, mutated
 * @param {number} days - the most it may sleep
 * @param {object} [opts]
 * @param {boolean} [opts.alarms=false] - stop on alarms
 * @param {boolean} [opts.benign=true] - with alarms: also stop for the good news (scouts, a paid
 *        next purchase, the estimate at the line). A dry run turns this off.
 * @param {(string|null)[]} [opts.slots] - the layout, for a monster to take a chamber
 * @param {Function} [opts.rng] - for the scouts
 * @param {number} [opts.maxSteps] - loop budget; the caller carries on next frame if it runs out
 */
export function sleep(s, days, opts = {}) {
    const { alarms = false, benign = true, slots = [], rng = Math.random, maxSteps = Infinity } = opts;
    const sum = { days: 0, minerals: 0, food: 0, stars: 0, born: 0, died: 0, weakest: {}, ran: {}, wokenEarly: false, built: [], alarm: null, landed: [] };
    for (const t of ROOMS) sum.ran[t] = 0;
    const opens = resurfaceDay(s.doom0);
    /** How much of a room type actually turned over that day: crew and power, whichever is shorter. */
    const worked = (r, t) => Math.min(r.staff[t], r.power[t]);
    const add = (r, n) => {
        sum.minerals += n * r.minerals; sum.food += n * r.food; sum.stars += n * r.stars;
        sum.born += n * r.born; sum.died += n * r.died;
        sum.weakest[r.weakest] = (sum.weakest[r.weakest] || 0) + n;
        for (const t of ROOMS) sum.ran[t] += n * worked(r, t);
    };
    let steps = 0;
    let wasAbove = estimateNow(s).mean > RESURFACE_AT;
    const surfaced = () => {
        sum.wokenEarly = sum.days < days;
        sum.alarm = { kind: 'surface', reading: surface(s.doom0, s.day) };
        // the sensor on the shaft is a reading like any other, and the best one there is
        if (alarms) s.est = { bias: 0, spread: Math.min(s.est?.spread ?? ESTIMATE_START.spread, 4) };
    };
    while (sum.days < days && steps < maxSteps) {
        steps++;
        // the machines do not stop when the people lie down: orders land on their day
        const built = (s.builds || []).length ? completeBuilds(s) : [];
        if (built.length) sum.built = sum.built.concat(built);
        const h0 = s.humans, food0 = s.food;
        const r = tickDay(s, true);
        sum.days++;
        add(r, 1);
        if (canResurface(s)) { surfaced(); break; }
        if (alarms) {
            const bad = troubleIn(s, r);
            if (bad) { sum.alarm = bad; break; }
            if (benign) {
                if ((s.probes || []).some((p) => p.dueDay <= s.day)) {
                    sum.landed = resolveDueProbes(s, slots, rng);
                    sum.alarm = { kind: 'scouts', landed: sum.landed };
                    break;
                }
                const above = estimateNow(s).mean > RESURFACE_AT;
                if (wasAbove && !above) { sum.alarm = { kind: 'estimate', est: estimateNow(s) }; break; }
                wasAbove = above;
                if (built.length && canActOn(s, r.weakest)
                    && s.day - (s.actWokeDay ?? -Infinity) >= ACT_WAKE_GAP_DAYS) {
                    s.actWokeDay = s.day;
                    sum.alarm = { kind: 'act', job: built[built.length - 1], column: r.weakest };
                    break;
                }
            }
        }
        const steady = Math.abs(s.humans - h0) <= 1e-9 * Math.max(1, h0) && s.food >= food0
            && !r.starving && r.fuel === r.fuelWanted && r.parts.M >= 0 && !(s.builds || []).length;
        if (!steady) continue;
        let n = Math.min(days - sum.days, Math.ceil(opens - s.day));
        if (alarms && benign) {
            // stop the day before anything can happen, so the next lived day is the day it does
            const due = nextScoutDue(s);
            if (due < Infinity) n = Math.min(n, due - s.day - 1);
            if (wasAbove) n = Math.min(n, Math.ceil(estimateOpensDay(s)) - s.day - 1);
        }
        n = Math.max(0, Math.floor(n));
        if (n > 0) {
            const foodPerDay = s.food - food0;        // grown, less what the creches took
            s.minerals += n * r.parts.M; s.food += n * foodPerDay; s.stars += n * r.stars; s.day += n;
            sum.days += n;
            add(r, n);
        }
        if (canResurface(s)) { surfaced(); break; }
    }
    // The wake-up replay reads `ran` as a share of the sleep, not a count of days.
    if (sum.days > 0) for (const t of ROOMS) sum.ran[t] /= sum.days;
    return sum;
}

/**
 * Would a sleep of `days` come to harm? A dry run on a copy, with the good news switched off:
 * only the alarms in BAD_ALARMS count. This is what a cryo tier is gated on (B063): a tier is
 * offered once the colony could sleep one second of it without being woken to trouble.
 *
 * @param {object} s - state, untouched
 * @param {number} days
 * @param {number} [maxSteps] - a budget; running out of it is read as surviving
 * @returns {object|null} the alarm with `day` (sleeping days until it), or null
 */
export function sleepTrouble(s, days, maxSteps = 4000) {
    const c = JSON.parse(JSON.stringify(s));
    c.probes = [];
    if (c.humans < MIN_SLEEPERS) return { kind: 'few', day: 0 };
    const sum = sleep(c, days, { alarms: true, benign: false, maxSteps });
    if (sum.alarm && BAD_ALARMS.includes(sum.alarm.kind)) return { ...sum.alarm, day: sum.days };
    return null;
}

/** Under this share of the sleep, a room type is read as STALLED and gets the amber dot. */
export const STALL_AT = 0.5;
/** Which room types the colony owns and which of those stopped while it slept. */
export function stalledRooms(s, sum) {
    const out = {};
    for (const t of ROOMS) if ((s.rooms[t] || 0) > 0 && (sum.ran?.[t] ?? 1) < STALL_AT) out[t] = true;
    return out;
}

export const canResurface = (s) => surface(s.doom0, s.day) <= RESURFACE_AT;
/** The ending is the ring and nothing else. Until v1.44.0 the climb had a price in ore, stars and
 *  people as well; the colony that reaches the ring holds that price a hundred billion times over,
 *  so it gated nothing and the button only looked like it was waiting for money. Time is the one
 *  thing this chapter will not sell. */
export const canAscend = canResurface;

/** Who goes through the hatch first. */
export const ascentParty = (s) => Math.max(1, Math.round((s.humans || 0) * ASCENT_FAIL_LOSS));
/** Can the colony try at all? Awake, not gone, and big enough to send anyone. Never the estimate. */
export const canTryAscent = (s) => !s.ascended && (s.humans || 0) >= ASCENT_MIN_PEOPLE;

/**
 * What the ascent button says (v1.45.0): the colony's belief about survival up there, the same
 * number the ring shows, and who would go first. The truth decides; this is what the colony knows.
 * @param {object} s - state
 * @returns {{survival:number, spread:number, party:number}} survival in per cent
 */
export function ascentOdds(s) {
    const b = believedSurvival(s);
    return { survival: b.mean, spread: b.spread, party: ascentParty(s) };
}

/**
 * Open the hatch. You can always try (Ola, after v1.44.0: "Could you be allowed to try and then
 * lose people? Better than now anyway."). On a surface that is ready, everyone goes up. On one
 * that is not, the first party (ASCENT_FAIL_LOSS of the colony) dies up there, the rest wait, and
 * what the dead taught the colony sets its belief straight: the estimate is the truth, give or
 * take ASCENT_TAUGHT_SPREAD.
 *
 * @param {object} s - state, mutated
 * @returns {{tried:boolean, success:boolean, lost:number, survival:number}} survival: the truth, in per cent
 */
export function attemptAscent(s) {
    const truth = survivalNow(s);
    if (!canTryAscent(s)) return { tried: false, success: false, lost: 0, survival: truth };
    s.shaftOpen = true;
    if (canResurface(s)) {
        s.ascended = true;
        return { tried: true, success: true, lost: 0, survival: truth };
    }
    const lost = Math.min(ascentParty(s), s.humans - 2);
    s.humans -= lost;
    s.est = { bias: 0, spread: Math.min(s.est?.spread ?? ESTIMATE_START.spread, ASCENT_TAUGHT_SPREAD) };
    s.estRevealed = true;
    return { tried: true, success: false, lost, survival: truth };
}
