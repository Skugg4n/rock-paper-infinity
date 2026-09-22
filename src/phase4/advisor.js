/**
 * Chapter IV · THE DEEP: the advisor's feed.
 *
 * TEXT IS THE EXPLANATION MODEL IN THIS CHAPTER (Ola, after playing v1.40.0).
 * Icons alone failed here: four numbers moved at once and nothing said why. So the
 * deep gets a small feed of plain sentences, top right, the way chapter III's war
 * room does it.
 *
 * The rule that keeps it from becoming noise: a line is written when a CONDITION
 * CHANGES, never on a timer. The colony is boiled down to a handful of coarse
 * conditions once a day; the only lines that come out are the ones whose condition
 * is not what it was. Everything here is pure, so the wording is testable and the
 * phase only has to print what it is handed.
 */

import { ROOMS, ROOM_FOR_COLUMN, FOOD_PER_HUMAN } from './deep.js';

/** What the advisor calls each room and each column, in a sentence. */
export const ROOM_WORD = { mine: 'mine', farm: 'farm', generator: 'generator', dorm: 'dormitory' };
export const ROOM_WORDS = { mine: 'mines', farm: 'farms', generator: 'generators', dorm: 'dormitories' };
export const COLUMN_WORD = { M: 'minerals', F: 'food', E: 'energy', H: 'people' };

export const FEED_MAX = 5;             // the feed holds this many lines
export const FOOD_WARN_DAYS = 40;      // "running low" starts here
const bucket = (v, step) => Math.round(v / step) * step;

/**
 * How many days of food are left at today's rate, or Infinity while the farms keep up.
 * @param {object} state
 * @param {object} report - a day's report from tickDay
 * @returns {number}
 */
export function foodDaysLeft(state, report) {
    const net = report.parts.F;
    if (net >= 0) return Infinity;
    return Math.max(0, state.food / -net);
}

/**
 * The colony boiled down to the few things worth interrupting the player about. Coarse on
 * purpose: bucketed, so a number drifting by one does not write a line.
 *
 * @param {object} state
 * @param {object} report - a day's report from tickDay
 * @returns {object} a comparable snapshot
 */
export function conditions(state, report) {
    const days = foodDaysLeft(state, report);
    const short = ROOMS.filter((t) => (state.rooms[t] || 0) > 0 && report.staff[t] < 0.999);
    const powered = report.energyNeed > 0 ? Math.min(1, report.energyMade / report.energyNeed) : 1;
    return {
        bottleneck: report.weakest,
        foodWarn: days <= FOOD_WARN_DAYS ? bucket(days, 10) : -1,
        hungry: !!report.starving,
        shortRoom: short.length ? short[0] : null,
        shortHands: short.length ? Math.max(1, Math.round(report.crew[short[0]] / Math.max(0.001, report.staff[short[0]]) - report.crew[short[0]])) : 0,
        powerShort: powered < 0.995 ? bucket(powered * 100, 10) : -1,
    };
}

/**
 * The lines to add to the feed, given what was true a moment ago and what is true now.
 * Empty when nothing changed, which is most days.
 *
 * @param {object|null} was - the previous `conditions()`, or null on the first day
 * @param {object} now - this day's `conditions()`
 * @returns {string[]} plain sentences, newest last
 */
export function advisorLines(was, now) {
    const out = [];
    const first = !was;
    if (now.hungry && (first || !was.hungry)) {
        out.push('People are hungry; the colony is shrinking.');
    } else if (now.foodWarn >= 0 && (first || was.foodWarn !== now.foodWarn)) {
        out.push(`We are running low on food: ${Math.round(now.foodWarn)} days left.`);
    }
    if (now.powerShort >= 0 && (first || was.powerShort !== now.powerShort)) {
        out.push(`Energy is short: rooms run at ${Math.round(now.powerShort)} %.`);
    }
    if (now.shortRoom && (first || was.shortRoom !== now.shortRoom || was.shortHands !== now.shortHands)) {
        const idle = ROOMS.filter((t) => t !== now.shortRoom);
        out.push(`The ${ROOM_WORD[now.shortRoom]} needs ${now.shortHands} more `
            + `${now.shortHands === 1 ? 'hand' : 'hands'}; the ${ROOM_WORD[idle[idle.length - 1]]} is idle.`);
    }
    if (!first && was.bottleneck !== now.bottleneck) {
        out.push(`The bottleneck moved from ${COLUMN_WORD[was.bottleneck]} to ${COLUMN_WORD[now.bottleneck]}.`);
    } else if (first) {
        out.push(`The ${ROOM_WORD[ROOM_FOR_COLUMN[now.bottleneck]]} is the bottleneck.`);
    }
    return out;
}

/**
 * The feed itself: the last FEED_MAX lines, newest last, with the year each was written.
 * @param {string[]} feed - the lines so far
 * @param {string[]} lines - what to add
 * @returns {string[]} a new feed
 */
export function pushFeed(feed, lines) {
    if (!lines.length) return feed;
    return feed.concat(lines).slice(-FEED_MAX);
}

/** Food eaten per day, for the people ledger. */
export const foodEaten = (state) => (state.humans || 0) * FOOD_PER_HUMAN;
