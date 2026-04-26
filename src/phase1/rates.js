import { PHASE1_CONSTANTS } from '../constants.js';

const { HYPER_SPEED_THRESHOLD } = PHASE1_CONSTANTS;

/**
 * Calculates stars per second (SPS) for the current game state.
 *
 * @param {number} gameSpeed - Current game speed multiplier
 * @param {boolean} isMetaBoardActive - Whether the meta board (factory) is active
 * @param {number} boardCount - Number of active game boards
 * @param {number} starMultiplier - Current star multiplier from upgrades
 * @returns {number} Stars earned per second
 */
export function getSPS(gameSpeed, isMetaBoardActive, boardCount, starMultiplier) {
    const boardMultiplier = isMetaBoardActive ? 9 : boardCount;
    const baseWinRate = 1 / 3;
    const baseSPS = (gameSpeed < HYPER_SPEED_THRESHOLD)
        ? (1000 / (((1.2 / gameSpeed) * 1000 + 450) / boardMultiplier)) * baseWinRate
        : (gameSpeed * boardMultiplier) * baseWinRate;
    return baseSPS * starMultiplier;
}

/**
 * Calculates energy consumed per second (EPS) for the current game state.
 *
 * @param {number} gameSpeed - Current game speed multiplier
 * @param {boolean} isMetaBoardActive - Whether the meta board (factory) is active
 * @param {number} boardCount - Number of active game boards
 * @returns {number} Energy consumed per second
 */
export function getEPS(gameSpeed, isMetaBoardActive, boardCount) {
    const boardMultiplier = isMetaBoardActive ? 9 : boardCount;
    return gameSpeed * boardMultiplier;
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
