import { PHASE1_CONSTANTS } from '../constants.js';

const { HYPER_SPEED_THRESHOLD } = PHASE1_CONSTANTS;

/** Win probability without / with the luck upgrade (RNG bias, see pickOutcome). */
export const BASE_WIN_RATE = 1 / 3;
export const LUCK_WIN_RATE = 2 / 3;

/**
 * Timing of one hand-played (non-bulk) round at a given speed.
 * The countdown shows 3/2/1 frames as speed rises; the result is then held on
 * screen before the board is free again. Every part has a floor so a round is
 * always perceivable, and the total is strictly monotonic in gameSpeed (the old
 * interval-based loop had dead zones at speed 4–5 where rounds were skipped).
 *
 * @param {number} gameSpeed
 * @returns {{ frames: number, frameMs: number, holdMs: number, gapMs: number, totalMs: number }}
 */
export function roundTiming(gameSpeed) {
    const s = Math.max(1, gameSpeed);
    const frames = s <= 5 ? 3 : s <= 6 ? 2 : 1;
    const frameMs = Math.max(120, 400 / s);
    const holdMs = Math.max(160, 500 / s);
    const gapMs = 100;
    return { frames, frameMs, holdMs, gapMs, totalMs: frames * frameMs + holdMs + gapMs };
}

/**
 * Games played per second by the auto-player.
 *
 * @param {number} gameSpeed
 * @param {boolean} isMetaBoardActive
 * @param {number} boardCount
 */
export function getGamesPerSecond(gameSpeed, isMetaBoardActive, boardCount) {
    const boardMultiplier = isMetaBoardActive ? 9 : boardCount;
    if (gameSpeed <= 0) return 0;
    if (gameSpeed >= HYPER_SPEED_THRESHOLD || isMetaBoardActive) {
        return gameSpeed * boardMultiplier;
    }
    return boardMultiplier * (1000 / roundTiming(gameSpeed).totalMs);
}

/**
 * Theoretical stars per second (SPS) at full energy. Used for the quantum-foam
 * bonus and tests; the on-screen rate is the MEASURED one (see updateMeasuredRate).
 *
 * @param {number} gameSpeed - Current game speed multiplier
 * @param {boolean} isMetaBoardActive - Whether the meta board (factory) is active
 * @param {number} boardCount - Number of active game boards
 * @param {number} starMultiplier - Current star multiplier from upgrades
 * @param {number} [winRate=BASE_WIN_RATE] - Probability of a win per game
 * @returns {number} Stars earned per second
 */
export function getSPS(gameSpeed, isMetaBoardActive, boardCount, starMultiplier, winRate = BASE_WIN_RATE) {
    return getGamesPerSecond(gameSpeed, isMetaBoardActive, boardCount) * winRate * starMultiplier;
}

/**
 * Energy consumed per second (EPS). The factory runs on its own reactor and
 * consumes nothing; hands are free too, only the auto-player pays.
 *
 * @param {number} gameSpeed - Current game speed multiplier
 * @param {boolean} isMetaBoardActive - Whether the meta board (factory) is active
 * @param {number} boardCount - Number of active game boards
 * @returns {number} Energy consumed per second
 */
export function getEPS(gameSpeed, isMetaBoardActive, boardCount) {
    if (isMetaBoardActive) return 0;
    return getGamesPerSecond(gameSpeed, false, boardCount);
}

/**
 * Exponential moving average of the measured star income. Called once per
 * second with the stars gained during that second. Time constant ≈ 5 s, so
 * the number settles quickly but doesn't flicker at low rates.
 *
 * @param {number} previous - previous EMA value
 * @param {number} gainedThisSecond - stars gained since last call
 * @param {number} [alpha=0.2]
 */
export function updateMeasuredRate(previous, gainedThisSecond, alpha = 0.2) {
    if (!(previous >= 0)) previous = 0;
    return previous + alpha * (gainedThisSecond - previous);
}

/**
 * Picks a round outcome from a uniform random number, given the win rate.
 * Draw and loss share the remainder equally. Pure, so bulk mode and the
 * animated mode agree and it can be unit tested.
 *
 * @param {number} rand - uniform in [0, 1)
 * @param {number} winRate
 * @returns {'win'|'draw'|'lose'}
 */
export function pickOutcome(rand, winRate) {
    if (rand < winRate) return 'win';
    const rest = (1 - winRate) / 2;
    return rand < winRate + rest ? 'draw' : 'lose';
}

/**
 * Returns the number of win-tracker dots to display based on total stars earned.
 * Progressive disclosure: starts at 5 dots, unlocks more as the player earns stars.
 *
 * @param {number} totalStarsEarned - Lifetime stars earned
 * @returns {number} Number of dots to render (5, 10, 20, or 100)
 */
export function getVisibleDots(totalStarsEarned) {
    if (totalStarsEarned >= 30) return 100;
    if (totalStarsEarned >= 10) return 20;
    if (totalStarsEarned >= 5) return 10;
    return 5;
}

/**
 * Formats a large number as a compact string (e.g. 1500 → "1.5k", 2000000 → "2.0M").
 *
 * @param {number} n - Number to format
 * @returns {string} Human-readable compact representation
 */
export function formatCount(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return n.toLocaleString();
}

/**
 * Formats a per-second rate: one decimal below 100, compact above.
 *
 * @param {number} rate
 */
export function formatRate(rate) {
    if (rate < 100) return rate.toFixed(1);
    return formatCount(Math.round(rate));
}

/**
 * Returns the fill fraction (0–1) for a progress ring, representing how
 * far the player's star balance is toward the next purchase cost.
 * Clamped at 1. Returns 1 if the upgrade is already at maxLevel.
 *
 * @param {number} balance - Current star balance
 * @param {{ cost: number|function, level?: number, maxLevel?: number }} upgrade
 */
export function fillFraction(balance, upgrade) {
    if (upgrade.maxLevel !== undefined && upgrade.level >= upgrade.maxLevel) return 1;
    const nextCost = typeof upgrade.cost === 'function' ? upgrade.cost() : upgrade.cost;
    return Math.min(1, balance / nextCost);
}
