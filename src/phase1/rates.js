import { PHASE1_CONSTANTS } from '../constants.js';

const { HYPER_SPEED_THRESHOLD } = PHASE1_CONSTANTS;

export function getSPS(gameSpeed, isMetaBoardActive, boardCount, starMultiplier) {
    const boardMultiplier = isMetaBoardActive ? 9 : boardCount;
    const baseWinRate = 1 / 3;
    const baseSPS = (gameSpeed < HYPER_SPEED_THRESHOLD)
        ? (1000 / (((1.2 / gameSpeed) * 1000 + 450) / boardMultiplier)) * baseWinRate
        : (gameSpeed * boardMultiplier) * baseWinRate;
    return baseSPS * starMultiplier;
}

export function getEPS(gameSpeed, isMetaBoardActive, boardCount) {
    const boardMultiplier = isMetaBoardActive ? 9 : boardCount;
    return gameSpeed * boardMultiplier;
}

export function getVisibleDots(totalStarsEarned) {
    if (totalStarsEarned >= 30) return 100;
    if (totalStarsEarned >= 10) return 20;
    if (totalStarsEarned >= 5) return 10;
    return 5;
}

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
