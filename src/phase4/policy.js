/**
 * Chapter IV · THE DEEP: a player who does what the screen says (v1.48.0). Pure, shared by the
 * test that holds the chapter to its promise (policy.test.js) and the browser check.
 *
 * The overnight playtest followed the dot for ten minutes and never got to sleep: cryo asked for
 * automated generators and no button sold them. This is that player, written down, so the promise
 * "Cryo I is bought inside eight minutes by following the game" is a test and not a hope.
 *
 * The policy, once a colony day (a real second awake):
 *   - the cryo button unlocked: press it;
 *   - STARS FOLLOW THE CAPTION: the button that sells what cryo needs (it says so by name) is
 *     bought the moment it can be paid; while its tooltip says it is affordable within SAVE_DAYS,
 *     the stars are saved for it; further off than that, the level button is bought when it is
 *     lit (it says why too), which is what makes the stars grow;
 *   - ORE FOLLOWS THE DOT: a room of the kind the dot marks, or the chamber to put it in.
 */

import {
    tickDay, sleepTrouble, ordersDone, CRYO, ROOM_FOR_COLUMN, roomCost, digCost, levelCost,
    automationCost, freeChambers, buildPending,
} from './deep.js';
import { cryoNeed, offerFor, lowPoint, stocks, nextOrePrice } from './readout.js';

/** "Affordable in N days": a player waits for the goal when N is under this, a minute of play. */
export const SAVE_DAYS = 60;

/**
 * What the screen shows the player today: the same pure calls the phase makes.
 * @param {object} state
 * @returns {{report:object, need:object|null, low:object, offers:{level:object, auto:object}, autoShown:boolean}}
 */
export function screen(state) {
    const report = tickDay(JSON.parse(JSON.stringify(state)), !!state.asleep);
    const tier = state.cryo + 1;
    const days = CRYO[Math.min(CRYO.length - 1, tier)].days;
    const trouble = CRYO[tier] ? sleepTrouble(state, days) : null;
    const planned = CRYO[tier] ? sleepTrouble(ordersDone(state), days) : null;
    const need = CRYO[tier] ? cryoNeed(tier, { state, trouble, planned, starsPerDay: report.stars }) : null;
    const low = lowPoint(state, report, stocks(state, report, nextOrePrice(state, report)));
    const offers = { level: offerFor('level', state, report, need, low), auto: offerFor('auto', state, report, need) };
    const autoShown = Object.values(state.level).some((l) => l > 0) || need?.button === 'auto';
    return { report, need, low, offers, autoShown };
}

/**
 * One decision: what the player presses today, or null.
 * @param {object} state
 * @param {ReturnType<typeof screen>} [view]
 * @returns {{kind:'cryo'|'level'|'auto'|'room'|'dig', type?:string}[]} in the order pressed
 */
export function decide(state, view = screen(state)) {
    const out = [];
    const { need, low, offers, autoShown } = view;
    if (state.cryo < 0 && !need) return [{ kind: 'cryo' }];
    // stars: the goal's button when it can be paid, else save for it when it is near, else level
    const priceOf = (kind, t) => (kind === 'auto' ? automationCost(t, state.auto[t] || 0) : levelCost(t, state.level[t] || 0));
    const perDay = view.report.stars;
    let saving = false;
    for (const kind of ['auto', 'level']) {
        const o = offers[kind];
        if (!o.goal || (kind === 'auto' && !autoShown)) continue;
        const t = o.type;
        if (!((state.rooms[t] || 0) > 0) || buildPending(state, kind, t)) continue;
        const price = priceOf(kind, t);
        if (state.stars >= price) out.push({ kind, type: t });
        else if (perDay > 0 && (price - state.stars) / perDay <= SAVE_DAYS) saving = true;
    }
    // the hall's own price, when it is all that is left
    if (need && need.kind === 'stars' && perDay > 0 && (CRYO[state.cryo + 1].cost - state.stars) / perDay <= SAVE_DAYS) saving = true;
    if (!saving && !out.length) {
        const o = offers.level;
        const t = o.type;
        if ((state.rooms[t] || 0) > 0 && !buildPending(state, 'level', t) && state.stars >= priceOf('level', t)) out.push({ kind: 'level', type: t });
    }
    // ore: what the dot marks
    const t = low.column ? ROOM_FOR_COLUMN[low.column] : null;
    if (t) {
        if (freeChambers(state) > 0) {
            if (!buildPending(state, 'room', t) && state.minerals >= roomCost(t, state.rooms[t] || 0)) out.push({ kind: 'room', type: t });
        } else if (!buildPending(state, 'dig') && state.minerals >= digCost(state.chambers)) {
            out.push({ kind: 'dig' });
        }
    }
    return out;
}
