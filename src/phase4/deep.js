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
 * Cryo tiers: sleep length in days per press, and the tier's price in stars. A month, a year, a
 * decade, a century, a millennium, ten millennia. The chapter is 50000 years long, so the top
 * tiers are not a convenience, they are the only way the calendar ever gets there.
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
/** The way up is built, not waited for: the ring opens the door, this pays for it. */
export const ASCENT = { minerals: 2e6, stars: 2e9, humans: 200 };
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

/** Fresh colony: what came down the hole. */
export function initialDeepState({ salvage = 1500, doom0 = DOOM_AT_BOOM, people = 10 } = {}) {
    return {
        day: 0, minerals: salvage, food: 500, stars: 0, humans: people, asleep: false,
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
 * @param {boolean} asleep - everyone in cryo: no eating, no working, manual rooms stop
 */
export function tickDay(s, asleep = false) {
    const awake = asleep ? 0 : s.humans;
    const mult = (t) => roomMultiplier(s.level[t], s.auto[t]);
    const upkeep = (t) => upkeepMultiplier(s.level[t], s.auto[t]);
    // Hands. A manual room type needs crew × rooms × its own multiplier; automation needs none.
    // Short of hands a room type runs at a fraction, never all-or-nothing: half the crew, half the ore.
    const staff = {}; let crewLeft = awake;
    for (const t of CREW_ORDER) {
        const need = s.auto[t] > 0 ? 0 : s.rooms[t] * ROOM[t].crew * upkeep(t);
        if (need <= 0) { staff[t] = 1; continue; }
        const got = Math.min(need, crewLeft);
        staff[t] = got / need; crewLeft -= got;
    }
    const hands = crewLeft;
    const running = (t) => s.rooms[t] * staff[t] * mult(t);
    // Energy: the generators burn minerals, every room draws power, a shortfall scales output.
    const drawing = (t) => s.rooms[t] * staff[t] * upkeep(t);   // upkeep side of a running room
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
    const capacity = s.rooms.dorm * power.dorm * ROOM.dorm.out * Math.pow(mult('dorm'), BED_SHARE);   // an unlit bed is not a bed
    const demand = s.humans * FOOD_PER_HUMAN;        // what the colony eats, or will eat when it wakes
    const eat = asleep ? 0 : demand;
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
    return { minerals: mined, food: grown, fuel, fuelWanted, energyMade, energyNeed, energySpare, hands, born, starving, stars, weakest, parts, capacity, staff, power };
}

/**
 * Sleep `days` days in cryo: same rules, nobody awake. The sensor on the shaft wakes the colony
 * early the day the surface ring opens, so the last sleep never overshoots the ending by a
 * century. Returns the summed report (the wake-up summary).
 */
export function sleep(s, days) {
    const sum = { days: 0, minerals: 0, food: 0, stars: 0, born: 0, weakest: {}, wokenEarly: false };
    const opens = resurfaceDay(s.doom0);
    for (let i = 0; i < days;) {
        const r = tickDay(s, true);
        i++; sum.days++;
        sum.minerals += r.minerals; sum.food += r.food; sum.stars += r.stars; sum.born += r.born;
        sum.weakest[r.weakest] = (sum.weakest[r.weakest] || 0) + 1;
        if (canResurface(s)) { sum.wokenEarly = i < days; break; }
        // Fast forward. When a sleeping day leaves nothing that could make the next day different
        // (nobody was born, the larder held, the generators got all the ore they asked for and the
        // mines bring in at least as much as they burn), every remaining day is that same day. Run
        // them in one step: the same numbers exactly, not an estimate. Without this, one press of
        // the top cryo tier would be tens of millions of loops, in the browser as well as here.
        if (r.born === 0 && !r.starving && r.fuel === r.fuelWanted && r.parts.M >= 0) {
            const n = Math.max(0, Math.min(days - i, Math.ceil(opens - s.day)));
            if (n > 0) {
                s.minerals += n * r.parts.M; s.food += n * r.food; s.stars += n * r.stars; s.day += n;
                i += n; sum.days += n; sum.minerals += n * r.minerals; sum.food += n * r.food; sum.stars += n * r.stars;
                sum.weakest[r.weakest] += n;
            }
            if (canResurface(s)) { sum.wokenEarly = i < days; break; }
        }
    }
    return sum;
}

export const canResurface = (s) => surface(s.doom0, s.day) <= RESURFACE_AT;
/** The ending: the ring is open AND the colony can pay for the climb. */
export const canAscend = (s) => canResurface(s) && s.minerals >= ASCENT.minerals && s.stars >= ASCENT.stars && s.humans >= ASCENT.humans;
