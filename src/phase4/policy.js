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
 *
 * deep-tree (step 1): the level, automation and cryo buttons are gone; the player buys those on
 * the skill tree (tree.js), and `press()` does it the same way: the node Cryo I's reason names, the
 * level node of the room type the offer picks. Rooms and chambers are still the BUILD buttons.
 *
 * deep-machine (step 3): the stars are the machine's wins, and the machine is fed on the tree. When
 * nothing nearer is being saved for, the player feeds it ("The machine: feed") whenever the stars
 * cover the next level on top of whatever else it buys that day.
 */

import {
    tickDay, sleepTrouble, ordersDone, CRYO, ROOM_FOR_COLUMN, roomCost, digCost, levelCost,
    automationCost, freeChambers, buildPending, startBuild, feedCost, FEED_MAX,
} from './deep.js';
import { cryoNeed, offerFor, lowPoint, stocks, nextOrePrice } from './readout.js';
import { buy as treeBuy, LEVEL_NODE, AUTO_NODE, cryoNode } from './tree.js';
import {
    growOn, risen, riseReady, hungry, bodyPrice, buyBody, viewOf, graphOf, canAfford, takePrice, takeChamber, rise,
    wouldStarve, bodySeen, bodyPays, toggleMark, dreamStart,
} from './grow.js';

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
 * @returns {{kind:'cryo'|'level'|'auto'|'feed'|'room'|'dig', type?:string}[]} in the order pressed
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
        // and the machine, with what is left over
        const spent = out.reduce((a, x) => a + priceOf(x.kind, x.type), 0);
        const feed = state.feed || 0;
        if (feed < FEED_MAX && state.stars - spent >= feedCost(feed)) out.push({ kind: 'feed' });
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

/**
 * Do what `decide()` chose, the way the screen does it: levels, automations and the cryo hall on
 * the tree, rooms and chambers on the BUILD buttons.
 * @param {object} state - mutated
 * @param {{kind:string, type?:string}} a
 * @param {ReturnType<typeof screen>} [view] - the screen the choice was read off (its cryo reason)
 * @returns {boolean} false when the purchase could not be made
 */
export function press(state, a, view = null) {
    const ctx = { need: view ? view.need : undefined, starsPerDay: view ? view.report.stars : 0 };
    if (a.kind === 'cryo') return !!treeBuy(state, cryoNode(state.cryo + 1), ctx);
    if (a.kind === 'level') return !!treeBuy(state, LEVEL_NODE[a.type], ctx);
    if (a.kind === 'auto') return !!treeBuy(state, AUTO_NODE[a.type], ctx);
    if (a.kind === 'feed') return !!treeBuy(state, 'feed', ctx);
    if (a.kind === 'room') {
        const price = roomCost(a.type, state.rooms[a.type] || 0);
        if (state.minerals < price) return false;
        state.minerals -= price;
        startBuild(state, 'room', { type: a.type });
        return true;
    }
    if (a.kind === 'dig') {
        const price = digCost(state.chambers);
        if (state.minerals < price) return false;
        state.minerals -= price;
        startBuild(state, 'dig');
        return true;
    }
    return false;
}

/* ---- deep-grow: MOVEMENT III, the body, as a player who does what the panel says ---------------
   Once The question is answered: every body item the drawer shows is bought when it can be paid (the
   vats first while the body is hungry or a take would starve it); reachable chambers are taken while
   they can be paid and the body would not starve for them (grow.js canAfford), the machine house
   first, a dormitory next (it becomes a vat), then the cheapest; the lever is pulled the moment it
   reads RISE. deep-grow2: when nothing can be taken, the player marks the next chambers the body
   should reach and pulls DREAM; the heart is never pumped (the sim leaves it out). */
/** A human clicks this many chambers a second at most. */
export const TAKES_PER_SECOND = 1;
/** Marks the player sets before a dream. */
export const DREAM_MARKS = 6;
/**
 * @param {object} state
 * @param {object} layout
 * @returns {{kind:'rise'|'body'|'take'|'mark'|'dream', id?:string, ids?:string[]}[]} in the order pressed
 */
export function decideGrow(state, layout) {
    if (!growOn(state) || risen(state) || state.grow.dreaming) return [];
    if (riseReady(state, layout).ready) return [{ kind: 'rise' }];
    const out = [];
    const reach = viewOf(state, layout).reachable;
    const blocked = reach.some((id) => wouldStarve(state, layout, id));
    const canTake = reach.some((id) => canAfford(state, layout, id));
    const short = hungry(state, layout) || blocked || !canTake;
    const order = short ? ['vats', 'appetite', 'muscle', 'spread'] : ['spread', 'muscle', 'appetite', 'vats'];
    const purse = { stars: state.stars || 0, ore: state.minerals || 0 };
    for (const id of order) {
        if (!bodySeen(state, id)) continue;
        if (id === 'vats' && !short) continue;
        const price = bodyPrice(state, id);
        const pay = bodyPays(id);
        // one item a moment, as a hand in the drawer buys
        if (Number.isFinite(price) && purse[pay] >= price) { out.push({ kind: 'body', id }); purse[pay] -= price; break; }
    }
    const graph = graphOf(layout);
    const typeOf = (id) => graph.nodes.find((n) => n.id === id)?.type;
    // the machine the moment it can be had (the hands), then a dormitory (a vat), then the cheapest
    const rank = (id) => (id === 'machine' ? 0 : typeOf(id) === 'dorm' ? 1 : 2);
    // deep-swap: with the machine house in reach, the player saves the people for it rather than
    // spending them on cheaper chambers (in the strata row the dormitories come late)
    const saving = reach.includes('machine') && !canAfford(state, layout, 'machine');
    const picks = saving ? [] : reach
        .filter((id) => canAfford(state, layout, id))
        .sort((a, b) => (rank(a) - rank(b)) || (takePrice(state, layout, a).people - takePrice(state, layout, b).people));
    if (picks.length) { out.push({ kind: 'take', id: picks[0] }); return out; }
    if (out.length) return out;
    // nothing to take: mark where the body should go, and dream
    out.push({ kind: 'mark', ids: nextMarks(state, layout, DREAM_MARKS) });
    out.push({ kind: 'dream' });
    return out;
}
/** The chambers the body should reach next: the machine house once in reach, else the nearest. */
export function nextMarks(state, layout, n = DREAM_MARKS) {
    const graph = graphOf(layout);
    const body = new Set(state.grow.body);
    const reach = viewOf(state, layout).reachable;
    if (reach.includes('machine')) return ['machine'];
    const near = (id) => { const x = graph.nodes.find((m) => m.id === id); return x.floor * 100 + Math.abs(x.x) + Math.abs(x.z); };
    return graph.nodes.filter((x) => !body.has(x.id) && x.id !== 'machine').map((x) => x.id).sort((a, b) => near(a) - near(b)).slice(0, n);
}
/** Do what decideGrow chose. `starsPerDay`, `orePerDay` (the day's report) price the next level of an item. */
export function pressGrow(state, layout, a, starsPerDay = 0, orePerDay = 0) {
    if (a.kind === 'rise') return rise(state, layout);
    if (a.kind === 'body') return !!buyBody(state, a.id, starsPerDay, orePerDay);
    if (a.kind === 'take') return !!takeChamber(state, layout, a.id);
    if (a.kind === 'mark') {
        for (const id of state.grow.marks.slice()) toggleMark(state, layout, id);
        for (const id of a.ids || []) toggleMark(state, layout, id);
        return true;
    }
    if (a.kind === 'dream') return dreamStart(state, layout);
    return false;
}
