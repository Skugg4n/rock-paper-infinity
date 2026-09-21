/**
 * Chapter IV · THE DEEP — pure rules. No DOM, no timers. The simulation
 * (scripts/sim-phase4.mjs) and the game share this file.
 * Design: docs/superpowers/specs/2026-09-21-chapter-iv-the-deep-design.md
 *
 * Units: one tick = one DAY of colony time. Real time per day is set by cryo.
 * Resources: minerals (M), food (F), energy (E), humans (H). Stars come from
 * the balance of the four: 10 × the weakest, per day. Time heals the surface.
 */

export const ROOMS = ['mine', 'farm', 'generator', 'dorm'];
/** Output per room per day at level 0; energy each room draws; people it needs while manual. */
export const ROOM = {
    mine:      { out: 6,  energy: 4, crew: 3 },
    farm:      { out: 8,  energy: 3, crew: 2 },
    generator: { out: 14, energy: 0, crew: 2, fuel: 1 },   // burns minerals
    dorm:      { out: 20, energy: 1, crew: 0 },            // capacity, not a flow
};
export const FOOD_PER_HUMAN = 1;            // per day
export const GROWTH_PER_YEAR = 0.02;        // humans toward capacity when fed
export const STARS_PER_UNIT = 10;           // stars/day = 10 × min(M, F, E, H)
export const DAYS_PER_YEAR = 365;

/** Costs. Minerals dig and build; stars buy levels, automation and cryo. */
export const digCost = (chambers) => Math.round(60 * Math.pow(1.35, chambers));
export const roomCost = (type, n) => Math.round((type === 'dorm' ? 40 : 50) * Math.pow(1.4, n));
export const levelCost = (type, level) => Math.round(400 * Math.pow(3, level));
export const automationCost = (type, auto) => Math.round(3000 * Math.pow(4, auto));
/** Cryo tiers: sleep length in days per press; the tier's price in stars. */
export const CRYO = [
    { id: 'cryo-i',   days: 30,    cost: 5000 },
    { id: 'cryo-ii',  days: 365,   cost: 60000 },
    { id: 'cryo-iii', days: 3650,  cost: 800000 },
    { id: 'cryo-iv',  days: 36500, cost: 1.2e7 },
];
/** The surface heals only with time: doomsday × e^(−years/200). Resurface below 15 %. */
export const SURFACE_HALF_LIFE_YEARS = 200 / Math.LN2;
export const surface = (doom0, days) => doom0 * Math.exp(-(days / DAYS_PER_YEAR) / 200);
export const RESURFACE_AT = 15;
/** Output multipliers: ×2 per level, ×3 per automation past the first, ×100 per advanced (after the third). */
export function roomMultiplier(level, auto) {
    const adv = Math.max(0, auto - 3);
    return Math.pow(2, level) * Math.pow(3, Math.max(0, Math.min(auto, 3) - 1)) * Math.pow(100, adv);
}

/** Fresh colony: what came down the hole. */
export function initialDeepState({ salvage = 1500, doom0 = 85, people = 50 } = {}) {
    return {
        day: 0, minerals: salvage, food: 400, stars: 0, humans: people, asleep: false,
        chambers: 3, rooms: { mine: 0, farm: 1, generator: 1, dorm: 1 },
        level: { mine: 0, farm: 0, generator: 0, dorm: 0 },
        auto: { mine: 0, farm: 0, generator: 0, dorm: 0 },
        cryo: -1, doom0,
    };
}

/**
 * One day of colony life. Mutates and returns a report of the flows, so the
 * UI can mark the bottleneck and the wake-up summary can add days up.
 * @param {object} s - state
 * @param {boolean} asleep - everyone in cryo: no eating, no growth, manual rooms stop
 */
export function tickDay(s, asleep = false) {
    const awake = asleep ? 0 : s.humans;
    // which rooms run: automated ones always, manual ones need crew (people spread across rooms)
    const run = {};
    let crewLeft = awake;
    for (const t of ROOMS) {
        const n = s.rooms[t];
        if (s.auto[t] > 0) { run[t] = n; continue; }
        const need = ROOM[t].crew;
        const staffed = need ? Math.min(n, Math.floor(crewLeft / need)) : n;
        crewLeft -= staffed * need; run[t] = staffed;
    }
    // energy: generators burn minerals; rooms draw energy; a shortfall scales everything
    const genOut = run.generator * ROOM.generator.out * roomMultiplier(s.level.generator, s.auto.generator);
    const fuel = Math.min(s.minerals, run.generator * ROOM.generator.fuel);
    const energyMade = run.generator ? genOut * (fuel / Math.max(1e-9, run.generator * ROOM.generator.fuel)) : 0;
    s.minerals -= fuel;
    const energyNeed = ROOMS.reduce((a, t) => a + run[t] * ROOM[t].energy, 0);
    const energyK = energyNeed > 0 ? Math.min(1, energyMade / energyNeed) : 1;
    const energySpare = Math.max(0, energyMade - energyNeed);
    // flows
    const minerals = run.mine * ROOM.mine.out * roomMultiplier(s.level.mine, s.auto.mine) * energyK;
    const food = run.farm * ROOM.farm.out * roomMultiplier(s.level.farm, s.auto.farm) * energyK;
    s.minerals += minerals; s.food += food;
    // people eat and grow (awake only)
    const capacity = s.rooms.dorm * ROOM.dorm.out * roomMultiplier(s.level.dorm, s.auto.dorm);
    if (!asleep) {
        const eat = s.humans * FOOD_PER_HUMAN;
        if (s.food >= eat) { s.food -= eat; s.humans = Math.min(capacity, s.humans * (1 + GROWTH_PER_YEAR / DAYS_PER_YEAR)); }
        else { s.food = 0; s.humans = Math.max(2, s.humans * (1 - 0.002)); }   // hunger: 0.2 % a day
    }
    // stars: the balance of the four. Asleep, only automated flows count and nobody is awake to play,
    // so the star engine runs on the automated colony alone (humans term = capacity kept alive).
    const hTerm = asleep ? s.humans * 0.25 : s.humans;
    const parts = { M: minerals, F: food, E: energySpare, H: hTerm };
    const weakest = Object.keys(parts).reduce((a, k) => (parts[k] < parts[a] ? k : a), 'M');
    const stars = STARS_PER_UNIT * parts[weakest];
    s.stars += stars; s.day += 1;
    return { minerals, food, energyMade, energyNeed, energySpare, stars, weakest, parts, capacity, run };
}

/** Sleep `days` days in cryo: same rules, nobody awake. Returns the summed report (the wake-up summary). */
export function sleep(s, days) {
    const sum = { days, minerals: 0, food: 0, stars: 0, weakest: {} };
    for (let i = 0; i < days; i++) {
        const r = tickDay(s, true);
        sum.minerals += r.minerals; sum.food += r.food; sum.stars += r.stars;
        sum.weakest[r.weakest] = (sum.weakest[r.weakest] || 0) + 1;
    }
    return sum;
}

export const canResurface = (s) => surface(s.doom0, s.day) <= RESURFACE_AT;
