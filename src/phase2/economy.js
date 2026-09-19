/**
 * Phase 2 pure economy helpers (no DOM, no game-state closures).
 * Silo display, hand harvest and market stalls: the "helpers" beside the
 * power line (vision.md, "The power line and the helpers").
 */

/** Seconds of food a full silo represents. */
export const SILO_SECONDS = 120;

/** Base supply rate of one market stall, per second (before GMO). */
export const STALL_SUPPLY = 5;

/**
 * Fill fraction (0–1) of the silo: how many seconds of food are in stock,
 * relative to SILO_SECONDS at the current consumption. With no consumption
 * the silo reads full whenever there is any stock.
 *
 * @param {number} supplies - stock
 * @param {number} consumption - supplies consumed per second
 */
export function siloFraction(supplies, consumption) {
    if (!(supplies > 0)) return 0;
    if (!(consumption > 0)) return 1;
    return Math.min(1, supplies / (SILO_SECONDS * consumption));
}

/**
 * Cost of the next market stall. Cheap and repeatable; each one matters a
 * little less as the city grows, until GMO multiplies them.
 *
 * @param {number} owned - stalls already built
 */
export function stallCost(owned) {
    return Math.round(2000 * Math.pow(1.25, owned));
}

/**
 * Supplies gained from one hand harvest click. Worth two seconds of food at
 * full efficiency; efficiency drops per click and recovers over time (see
 * decayHarvestEfficiency), so hammering the button pays less and less.
 *
 * @param {number} consumption - supplies consumed per second
 * @param {number} efficiency - 0–1
 */
export function harvestAmount(consumption, efficiency) {
    const base = Math.max(5, consumption * 2);
    return Math.max(1, Math.round(base * Math.max(0.05, efficiency)));
}

/** Efficiency after one click: loses 15 % of what is left. */
export function spendHarvestEfficiency(efficiency) {
    return Math.max(0, efficiency * 0.85);
}

/** Efficiency after `seconds` of rest: back to 1 in ~10 s. */
export function recoverHarvestEfficiency(efficiency, seconds = 1) {
    return Math.min(1, efficiency + 0.1 * seconds);
}
