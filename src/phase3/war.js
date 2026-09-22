/**
 * Chapter III · WAR — pure rules. No DOM, no timers. Everything the war does
 * to numbers lives here so the simulation (scripts/sim-phase3.mjs) and the
 * game run the same code. Design: docs/superpowers/specs/2026-09-19-chapter-iii-war-design.md
 *
 * Vocabulary
 * - arms: the war currency, made by the factory (slider goods ↔ arms)
 * - defence: units that absorb incoming power; force: units released in a strike
 * - tier: the weapon ladder, fists → nuclear; each has power per unit and a cost
 * - HP: what a plate can take before it is razed; fortification adds to it
 * - scorch: damage to the land; never goes down; feeds the doomsday clock
 */

/**
 * The ladder. A unit always costs UNIT_COST arms; the tier (research) is what
 * makes it strong. `mode`: melee = dots walk, ranged = a projectile in an arc,
 * area = neighbours are hit too.
 */
export const UNIT_COST = 10;
export const TIERS = [
    { id: 'fists',      numeral: 'I',    power: 1,   mode: 'melee',  scorch: 0.15 },
    { id: 'swords',     numeral: 'II',   power: 2,   mode: 'melee',  scorch: 0.25 },
    { id: 'gunpowder',  numeral: 'III',  power: 4,   mode: 'melee',  scorch: 0.5 },
    { id: 'repeaters',  numeral: 'IV',   power: 8,   mode: 'melee',  scorch: 1 },
    { id: 'artillery',  numeral: 'V',    power: 20,  mode: 'ranged', scorch: 3 },
    { id: 'missiles',   numeral: 'VI',   power: 50,  mode: 'ranged', scorch: 6 },
    { id: 'chemical',   numeral: 'VII',  power: 120, mode: 'area',   scorch: 20 },
    { id: 'biological', numeral: 'VIII', power: 250, mode: 'area',   scorch: 35 },
    { id: 'nuclear',    numeral: 'IX',   power: 800, mode: 'area',   scorch: 100 },
];

/** Arms per second at full war production (slider = 1). The factory's war output. */
export const ARMS_PER_SECOND = 20;
/** Better weapons research also means a better arms factory: +25 % per tier. */
export const armsPerSecond = (tier) => ARMS_PER_SECOND * (1 + 0.25 * tier);
/** Stars of upkeep per unit (defence + force) per second, as a share of star income. */
export const UPKEEP_SHARE_PER_UNIT = 0.0004;
/** Food eaten per unit per second (troops eat like people). */
export const FOOD_PER_UNIT = 1;
/** HP of plates by building type. Fortification adds FORT_HP per level. */
export const PLATE_HP = { home: 10, apartment: 20, skyscraper: 40, district: 90, store: 15, superStore: 30, factory: 60, bank: 30 };
export const FORT_HP = 12;
export const FORT_COST = (level) => Math.round(40 * Math.pow(1.6, level));
/** Enemy tiles: HP per tile (in units of an equal strike). */
export const ENEMY_TILE_HP = 120;
/**
 * Enemy defence: starting units, regrowth per second, cap per wave. Both climb
 * with OUR tier, so their shield is always worth about what our force is worth:
 * a landing on their island takes a real build-up or the raiding party, never
 * a strike every few seconds.
 */
export const ENEMY_DEFENCE_START = 45;
export const ENEMY_DEFENCE_REGROW = (tier = 0) => 0.3 * (1 + 0.6 * tier);
export const enemyDefenceCap = (waveCount, tier = 0) => (40 + waveCount * 0.8) * (1 + 0.8 * tier);
/** Seconds a razed enemy tile stays down. They rebuild quickly. */
export const ENEMY_REBUILD_S = 40;
/**
 * How much of their island still stands, as a factor 0-1. Landings thin with
 * it, their defence does not thin at all (floor 1): knocking their buildings
 * down is not a way to disarm them, only to take salvage and buy a little
 * quiet until they have rebuilt.
 */
export const WAVE_STANDING_FLOOR = 0.3;
export const DEFENCE_STANDING_FLOOR = 1;
export const waveStandingK = (standing) => (standing > 0 ? Math.max(WAVE_STANDING_FLOOR, standing / 5) : 0);
export const defenceStandingK = (standing) => (standing > 0 ? Math.max(DEFENCE_STANDING_FLOOR, standing / 5) : 0);
/** Salvage per razed enemy tile (× tier power of the strike). */
export const SALVAGE_PER_TILE = 120;
/** The enemy leaves when the doomsday clock (both islands' scorch) passes this percent. */
export const DOOMSDAY_LEAVE = 85;
/** Bombed out (nothing standing), the enemy digs in and returns all at once after this many seconds, rebuilt, with full defence and at least our tier. */
export const ENEMY_REGROUP_S = 90;
/** What scorch does to yield: stars and food per second are multiplied by this. */
export const scorchYield = (doomPercent) => 1 - 0.6 * Math.max(0, Math.min(100, doomPercent)) / 100;
/** Seconds of development between our tier purchases. */
export const TIER_COOLDOWN_S = 45;
/** The enemy never falls more than this many tiers behind us (checkpoint). */
export const ENEMY_MAX_LAG = 1;
/** One-time price (arms) of the auto quartermaster: buys units and strikes for you. */
export const AUTO_COST = 400;
/** Intel office: shows the enemy's tier and the Intel lines in the war room. */
export const INTEL_COST = 150;
/** Raiding party (helper): knocks their defence to zero for RAID_S seconds; the price climbs per raid. */
export const RAID_S = 20;
export const raidCost = (raids = 0) => Math.round(250 * Math.pow(1.5, raids));
/** Seconds between a wave being spotted (radar) and its departure. */
export const WAVE_WARNING_S = 4;
/** Salvage needed to open the ship down. */
export const SHIP_SALVAGE = 1500;

/** Fresh war state. */
export function initialWarState(now = 0) {
    return {
        active: true, startedAt: now,
        arms: 0, armsShare: 0.3,
        defence: 0, force: 0, tier: 0,
        enemyTier: 0, enemyDefence: ENEMY_DEFENCE_START, waveCount: 0, lastWaveAt: now, nextTierAt: now + 75,
        scorchOurs: 0, scorchTheirs: 0, salvage: 0,
        enemyLeft: false, shipReady: false,
        autoStrike: false,
    };
}

/**
 * Mulberry32 PRNG so waves are reproducible in the sim.
 * @param {number} seed
 */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Scorch at which the doomsday clock stands at 63 %; ~90 % at 2.3×. */
export const DOOMSDAY_SCALE = 2500;
/** Doomsday 0–100 from total scorch: slow at first, steep later. */
export function doomsday(scorchTotal) {
    return 100 * (1 - Math.exp(-Math.max(0, scorchTotal) / DOOMSDAY_SCALE));
}

/**
 * Seconds between waves: 40 s at the start, down to 20 s. The floor is what
 * gives us time to repair a plate between landings.
 * @param {number} waveCount
 */
export function waveInterval(waveCount) {
    return Math.max(20, 40 - waveCount * 1.5);
}

/** Units in the next wave: grows for twenty waves, then holds at 50. */
export function waveSize(waveCount) {
    return 10 + Math.min(waveCount, 20) * 2;
}

/** How much harder they push their laboratory per tier they are behind us. */
export const ENEMY_PUSH_PER_TIER = 1;
/**
 * When the enemy takes its next tier: 95 s for the first, 15 % longer for each
 * after, with a small jitter (±15 %) so the clock is steady and the swings in
 * the war come from the rules rather than from luck. A weapon they have never
 * seen sends them back to the drawing board (the caller restarts this clock
 * whenever we take the lead), but while they are behind they push twice as
 * hard: one tier behind halves the wait.
 * @param {number} now - seconds
 * @param {function} rand
 * @param {number} [tierReached=0] - the tier they just reached
 * @param {number} [behindBy=0] - tiers they are behind us right now
 */
export function nextEnemyTierAt(now, rand, tierReached = 0, behindBy = 0) {
    const push = 1 + ENEMY_PUSH_PER_TIER * Math.max(0, behindBy);
    return now + 95 * Math.pow(1.15, tierReached) * (0.85 + rand() * 0.3) / push;
}

/**
 * Picks a target plate: weighted random, weighted toward the smart choice
 * (weak fortification, valuable building, close to the water's edge = high
 * row index). Never fully predictable.
 *
 * @param {Array<{id:number,type:string,fort:number,row:number,razed:boolean}>} plates
 * @param {function} rand - uniform [0,1)
 * @returns {object|null} the chosen plate
 */
export function pickTarget(plates, rand) {
    const alive = plates.filter(p => !p.razed && p.type !== 'factory' && p.type !== 'bank');
    if (!alive.length) return null;
    const maxRow = Math.max(...alive.map(p => p.row));
    const value = { home: 1, apartment: 2, skyscraper: 3, district: 5, store: 1.5, superStore: 2 };
    const weights = alive.map(p => {
        const weak = 1 / (1 + (p.fort || 0));            // weak fortification
        const worth = value[p.type] || 1;                 // valuable
        const coast = 0.6 + 0.4 * (p.row / Math.max(1, maxRow)); // near the water (south)
        return (0.4 + weak) * worth * coast;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < alive.length; i++) { r -= weights[i]; if (r <= 0) return alive[i]; }
    return alive[alive.length - 1];
}

/**
 * The one rule. Incoming power against our defence and the plate.
 * Defence units absorb power first (and some die); what is left hits the
 * plate's HP (base + fortification). If HP runs out the plate is razed.
 *
 * @param {object} args
 * @param {number} args.power - wave power (units × tier power)
 * @param {number} args.defence - our defence units
 * @param {number} args.defencePower - power per defence unit (our tier)
 * @param {number} args.hp - plate HP left (including fortification)
 * @returns {{ razed: boolean, hpLeft: number, defenceLost: number, absorbed: number }}
 */
/** Defence can absorb at most this share of a wave; the rest always reaches the plate. */
export const MAX_ABSORB = 0.7;
export function resolveHit({ power, defence, defencePower, hp }) {
    const absorbed = Math.min(power * MAX_ABSORB, defence * defencePower);
    const rest = power - absorbed;
    // defenders take losses proportional to what they absorbed
    const defenceLost = Math.min(defence, Math.ceil((absorbed / Math.max(1, defencePower)) * 0.1));
    const hpLeft = Math.max(0, hp - rest);
    return { razed: hpLeft <= 0 && rest > 0, hpLeft, defenceLost, absorbed };
}

/**
 * Our strike on the enemy island. Force units × our tier power against
 * their defence, then a tile. Half the force is spent.
 *
 * @param {object} args
 * @param {number} args.force
 * @param {number} args.power - our tier power
 * @param {number} args.enemyDefence - their defence units
 * @param {number} args.enemyPower - their tier power
 * @param {number} args.tileHp
 * @returns {{ razed: boolean, tileHpLeft: number, forceLeft: number, enemyDefenceLeft: number }}
 */
export function resolveStrike({ force, power, enemyDefence, enemyPower, tileHp }) {
    const P = force * power;
    const absorbed = Math.min(P, enemyDefence * enemyPower);
    const rest = P - absorbed;
    const enemyDefenceLeft = Math.max(0, enemyDefence - Math.ceil((absorbed / Math.max(1, enemyPower)) * 0.5));
    const tileHpLeft = Math.max(0, tileHp - rest);
    return { razed: tileHpLeft <= 0 && rest > 0, tileHpLeft, forceLeft: Math.floor(force / 2), enemyDefenceLeft };
}

/**
 * Weapons are relative. A unit of `tier` measured against a side at
 * `against`: equal tiers = 1, one tier ahead ≈ 2, one behind ≈ 0.5. Plate HP,
 * fortification and defence units are all counted in units of the equal
 * enemy, so the ladder never outruns the plates: what decides a landing is
 * who is ahead, and by how much.
 * @param {number} tier - tier index of the acting side
 * @param {number} against - tier index of the other side
 */
export const relativePower = (tier, against) => TIERS[tier].power / TIERS[against].power;

/** A landing: `size` enemy units at their tier against our defence and a plate. */
export function resolveLanding({ size, enemyTier, ourTier, defence, hp }) {
    return resolveHit({ power: size * relativePower(enemyTier, ourTier), defence, defencePower: 1, hp });
}

/** Our strike: `force` units at our tier against their defence and a tile. */
export function resolveOurStrike({ force, ourTier, enemyTier, enemyDefence, tileHp }) {
    return resolveStrike({ force, power: relativePower(ourTier, enemyTier), enemyDefence, enemyPower: 1, tileHp });
}

/** Would a strike with `force` raze a tile of `tileHp` behind `enemyDefence`? */
export function canRazeTile(force, ourTier, enemyTier, enemyDefence, tileHp = ENEMY_TILE_HP) {
    return force > 0 && force * relativePower(ourTier, enemyTier) > enemyDefence + tileHp;
}

/** Cost multiplier per tier the enemy holds over us; its inverse while we lead. */
export const RESEARCH_CATCHUP = 1.9;
/**
 * Science cost of tier k, scaled to the science the city COULD make per second
 * (population × 0.5, i.e. everyone researching) when the war began, so a small
 * city and a huge one both take ~90 s of full research for tier II and more
 * for each after. Using potential, not the current slider, means a banked
 * science pile from chapter II cannot buy the whole ladder at once.
 * Research under fire is slow. Every tier they hold over us multiplies the
 * price by RESEARCH_CATCHUP (their better weapon is landing on our labs), and
 * a tier we hold over them divides it: a lead is worth keeping, and being
 * behind is a hole to climb out of. Counted over at most two tiers either way.
 * @param {number} k - tier index (1..)
 * @param {number} sciencePotential0 - population × 0.5 at war start
 * @param {number} [behindBy=0] - tiers we are behind the enemy
 */
export function tierScienceCost(k, sciencePotential0, behindBy = 0) {
    const base = Math.max(500, sciencePotential0) * 70;
    const pressure = Math.pow(RESEARCH_CATCHUP, Math.max(-1, Math.min(2, behindBy)));
    return Math.round(base * Math.pow(1.26, k - 1) * pressure);
}

/**
 * Checkpoint: after we research, the enemy is pulled up to at most ENEMY_MAX_LAG
 * tiers behind us (their clock restarts). Keeps the war a race, not a rout.
 * @param {number} ourTier
 * @param {number} enemyTier
 */
export function enemyCatchUp(ourTier, enemyTier) {
    return Math.max(enemyTier, ourTier - ENEMY_MAX_LAG);
}

/**
 * Auto quartermaster: how to spend `arms` this second. Keeps defence at least
 * equal to force, then alternates. Returns { defence, force } units to buy.
 * @param {number} arms
 * @param {number} defence
 * @param {number} force
 * @param {number} unitCost
 */
export function autoBuy(arms, defence, force, unitCost, stance = 'balanced') {
    let d = 0, f = 0, left = arms;
    while (left >= unitCost) {
        if (stance === 'defend') d++;
        else if (stance === 'attack') f++;
        else if (defence + d <= force + f) d++; else f++;
        left -= unitCost;
    }
    return { defence: d, force: f };
}
/** The quartermaster's three stances, cycled with one button. */
export const STANCES = ['defend', 'balanced', 'attack'];

/** Base HP for a plate of `type` plus fortification. */
export function plateMaxHp(type, fort = 0) {
    return (PLATE_HP[type] || 10) + fort * FORT_HP;
}
