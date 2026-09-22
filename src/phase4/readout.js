/**
 * Chapter IV · THE DEEP: saying what a number is made of, and what a purchase will do
 * to it, BEFORE the player clicks (Ola, after playing v1.40.0: "I buy electricity and
 * BOOM all humans drop; I cannot understand what will happen").
 *
 * Two jobs, both pure so both can be tested:
 *   1. `ledger()` writes the sentence behind a bar: where the number came from.
 *   2. `preview()` runs the rules forward on a CLONE with the purchase already
 *      finished, and hands back what the four columns would then read. That is what
 *      the ghost segments and the signed deltas on the bars are drawn from, so the
 *      answer on screen is the rules' own answer and never an estimate of it.
 */

import { COLUMN, ROOMS, ROOM, ROOM_FOR_COLUMN, tickDay, roomMultiplier, upkeepMultiplier } from './deep.js';
import { ROOM_WORD, ROOM_WORDS } from './advisor.js';

/** Numbers in a sentence are rounded; nobody reads 47.3182 spare energy. */
const n = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return `${Math.round(v / 1e5) / 10}M`;
    if (a >= 1e4) return `${Math.round(v / 100) / 10}k`;
    return String(Math.round(v));
};
/** "mine, farm and dorm", the way a person would say it. */
export function list(words) {
    if (!words.length) return 'nothing';
    if (words.length === 1) return words[0];
    return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * The sentence behind one bar.
 * @param {string} column - 'M', 'F', 'E' or 'H'
 * @param {object} state
 * @param {object} report - a day's report from tickDay
 * @returns {string}
 */
export function ledger(column, state, report) {
    const p = report.parts;
    if (column === 'M') {
        const mines = state.rooms.mine || 0;
        return `Minerals ${n(p.M)} a day: ${mines} ${mines === 1 ? 'mine brings' : 'mines bring'} up `
            + `${n(report.minerals)}; the generators burn ${n(report.fuel)}.`;
    }
    if (column === 'F') {
        const farms = state.rooms.farm || 0;
        return `Food ${n(p.F)} a day: ${farms} ${farms === 1 ? 'farm grows' : 'farms grow'} ${n(report.food)}; `
            + `${n(state.humans)} people eat ${n(report.eaten)}.`;
    }
    if (column === 'E') {
        const users = ROOMS.filter((t) => report.draw[t] > 0.5).map((t) => `${ROOM_WORD[t]} ${n(report.draw[t])}`);
        return `Energy ${n(p.E)}: generators make ${n(report.energyMade)}; `
            + `${list(users)} use ${n(report.energyNeed)}; spare ${n(report.energySpare)}.`;
    }
    const onDuty = ROOMS.filter((t) => report.crew[t] > 0.5);
    const busy = onDuty.reduce((a, t) => a + report.crew[t], 0);
    // a fully automated colony has nobody on a shift at all, and "0 on duty in nothing"
    // is not a sentence anyone would write
    const duty = onDuty.length
        ? `${n(busy)} on duty in ${list(onDuty.map((t) => ROOM_WORD[t]))}; ${n(report.hands)} free`
        : `nobody on duty, the rooms run themselves; all ${n(report.hands)} free`;
    return `People ${n(report.awake)} awake: ${duty}; `
        + `eat ${n(report.eaten)} food a day; capacity ${n(report.capacity)}.`;
}

/**
 * What a purchase costs the colony to RUN and what it gives back, in one sentence.
 * This is the tooltip that answers "what will happen": a generator says it needs hands
 * and ore, so the people column dropping is no longer a surprise.
 *
 * @param {'dig'|'room'|'level'|'auto'} kind
 * @param {string|null} type - the room type
 * @param {object} state
 * @returns {string}
 */
export function buySentence(kind, type, state) {
    if (kind === 'dig') return 'Opens one more chamber to put a room in.';
    const lvl = state.level[type] || 0;
    const auto = state.auto[type] || 0;
    if (kind === 'auto') {
        return auto === 0
            ? `Runs the ${ROOM_WORDS[type]} without people; every hand goes back to the others.`
            : `Triples what the ${ROOM_WORDS[type]} make; they draw more power for it.`;
    }
    const after = kind === 'level' ? lvl + 1 : lvl;
    const mult = roomMultiplier(after, auto), up = upkeepMultiplier(after, auto);
    const made = ROOM[type].out * mult;
    const hands = auto > 0 ? 0 : ROOM[type].crew * up;
    const power = ROOM[type].energy * up;
    const needs = [];
    if (hands > 0) needs.push(`${n(hands)} ${Math.round(hands) === 1 ? 'hand' : 'hands'}`);
    if (power > 0) needs.push(`${n(power)} energy`);
    if (type === 'generator') needs.push(`${n(ROOM.generator.fuel * up)} ore a day`);
    const gives = type === 'dorm' ? `${n(made)} beds` : `${n(made)} ${{ mine: 'ore', farm: 'food', generator: 'energy' }[type]}`;
    const head = kind === 'level' ? `Doubles every ${ROOM_WORD[type]}.` : `One more ${ROOM_WORD[type]}.`;
    return needs.length ? `${head} Needs ${list(needs)}; makes ${gives}.` : `${head} Makes ${gives}.`;
}

/** A state a purchase can be tried on without touching the real one. */
export function cloneState(state) {
    return {
        ...state,
        rooms: { ...state.rooms }, level: { ...state.level }, auto: { ...state.auto },
        dark: { ...(state.dark || {}) }, darkSlots: (state.darkSlots || []).slice(),
        builds: [], probes: (state.probes || []).slice(), stalled: { ...(state.stalled || {}) },
    };
}

/**
 * The four columns as they would read once this purchase is FINISHED. The rules do the
 * work: a clone with the change applied, one day run on it, and the difference taken.
 *
 * @param {object} state
 * @param {'dig'|'room'|'level'|'auto'} kind
 * @param {string|null} type
 * @param {object} report - today's report, to compare against
 * @returns {{parts:object, delta:object, weakest:string}|null} null when there is nothing to show
 */
export function preview(state, kind, type, report) {
    if (kind === 'dig') return null;            // a chamber on its own changes no column
    const c = cloneState(state);
    if (kind === 'room') c.rooms[type] = (c.rooms[type] || 0) + 1;
    else if (kind === 'level') c.level[type] = (c.level[type] || 0) + 1;
    else if (kind === 'auto') c.auto[type] = (c.auto[type] || 0) + 1;
    else return null;
    const after = tickDay(c, !!state.asleep);
    const delta = {};
    for (const k of COLUMN) delta[k] = after.parts[k] - report.parts[k];
    return { parts: after.parts, delta, weakest: after.weakest, stars: after.stars };
}

/** The signed number over a bar: "+6", "-2", or nothing worth showing. */
export function deltaText(v, column) {
    if (!Number.isFinite(v) || Math.abs(v) < 0.5) return '';
    const sign = v > 0 ? '+' : '-';
    const body = n(Math.abs(v));
    return column === 'H' ? `${sign}${body} hands` : `${sign}${body}`;
}

/** Which room type a purchase button is about, for the preview and the sentence. */
export const typeForColumn = (column) => ROOM_FOR_COLUMN[column];
