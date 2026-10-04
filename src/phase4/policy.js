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
    tickDay, sleepTrouble, ordersDone, CRYO, ROOM_FOR_COLUMN, roomCost, digCost, nextPrice,
    freeChambers, buildPending, startBuild, feedPrice, cryoPrice, FEED_MAX,
} from './deep.js';
import { cryoNeed, offerFor, lowPoint, stocks, nextOrePrice } from './readout.js';
import { buy as treeBuy, LEVEL_NODE, AUTO_NODE, cryoNode } from './tree.js';
import {
    growOn, risen, riseReady, hungry, bodyPrice, buyBody, viewOf, graphOf, rise, bodySeen, bodyPays, toggleMark, dreamStart,
    taking, takeOffer, startTake, bodyRatios, adviseGrow, deadFix, spareOrgans, growTarget, HANDS_KEEP,
} from './grow.js';
import { neededOrgan } from './organs.js';

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
    // deep-econ: the prices the drawer shows (deep.js banded)
    const priceOf = (kind, t) => nextPrice(state, kind, t);
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
    if (need && need.kind === 'stars' && perDay > 0 && (cryoPrice(state, state.cryo + 1) - state.stars) / perDay <= SAVE_DAYS) saving = true;
    if (!saving && !out.length) {
        const o = offers.level;
        const t = o.type;
        if ((state.rooms[t] || 0) > 0 && !buildPending(state, 'level', t) && state.stars >= priceOf('level', t)) out.push({ kind: 'level', type: t });
        // and the machine, with what is left over
        const spent = out.reduce((a, x) => a + priceOf(x.kind, x.type), 0);
        const feed = state.feed || 0;
        if (feed < FEED_MAX && state.stars - spent >= feedPrice(state)) out.push({ kind: 'feed' });
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
   deep-organs: the player READS THE GAUGES. With no take in progress it grows the organ of the weakest
   gauge (the tape's GROW A ...), in the chamber where that organ is cheap if there is one, else the
   cheapest in reach; the machine house the moment it can be paid (the hands). With a take in progress
   it pumps (the sim pumps at a human rate, PUMP_EVERY_S, on the beat half the time). Every body item the
   drawer shows is bought when it can be paid (VATS first while the body is hungry). When the next take
   is further off than the tape's DREAM, it marks the next chambers and dreams. RISE when it can. */
/** A human clicks this many chambers a second at most. */
export const TAKES_PER_SECOND = 1;
/** Marks the player sets before a dream. */
export const DREAM_MARKS = 6;
/** A human pumps once every this many seconds, on the beat this share of the time. */
export const PUMP_EVERY_S = 1;
export const PUMP_ON_SHARE = 0.8;
/** deep-tension: which pumps of a drummer land on the beat: four in five, the fifth breaks the streak. */
export const onBeatTurn = (n) => (n % 5) !== 4;
/**
 * @param {object} state
 * @param {object} layout
 * @returns {{kind:'rise'|'body'|'take'|'mark'|'dream', id?:string, organ?:string, ids?:string[]}[]} in the order pressed
 */
export function decideGrow(state, layout, style = 'balanced') {
    if (!growOn(state) || risen(state) || state.grow.dreaming) return [];
    if (riseReady(state, layout).ready) return [{ kind: 'rise' }];
    const out = [];
    const short = hungry(state, layout);
    const order = short ? ['vats', 'appetite', 'muscle', 'spread'] : ['muscle', 'spread', 'appetite', 'vats'];
    const purse = { stars: state.stars || 0, ore: state.minerals || 0 };
    for (const id of order) {
        if (!bodySeen(state, id)) continue;
        if (id === 'vats' && !short) continue;
        const price = bodyPrice(state, id);
        const pay = bodyPays(id);
        // one item a moment, as a hand in the drawer buys
        if (Number.isFinite(price) && purse[pay] >= price) { out.push({ kind: 'body', id }); purse[pay] -= price; break; }
    }
    if (taking(state)) return out;
    const pick = pickTake(state, layout, style);
    if (pick) { out.push({ kind: 'take', ...pick }); return out; }
    if (out.length) return out;
    // nothing to take: dream when the tape says so (the next take is far off), else wait and pump
    if (adviseGrow(state, layout) === 'DREAM') {
        out.push({ kind: 'mark', ids: nextMarks(state, layout, DREAM_MARKS) });
        out.push({ kind: 'dream' });
    }
    return out;
}
/**
 * deep-tension: THE TAKE, two players. `style`:
 *   'balanced' (the sim's player, the default) reads the gauges like a human who has learnt them: while
 *     every gauge is green it takes what is cheap here, unless the gauge that organ feeds is already
 *     high (the price weighed by that gauge); a gauge in the red, or dead flesh, and it grows THAT organ
 *     (in reach, or a living organ grown again), or pumps for the mass for it;
 *   'naive' always takes the cheapest organ it can pay (the green one), and never reads a gauge.
 * The machine house first, as soon as it can be paid.
 */
export function pickTake(state, layout, style = 'balanced') {
    const reach = viewOf(state, layout).reachable;
    if (reach.includes('machine')) {
        const o = takeOffer(state, layout, 'machine');
        if (o && o.organs[0].ok) return { id: 'machine', organ: 'hands' };
    }
    const opts = [];
    for (const id of reach) {
        if (id === 'machine') continue;
        const o = takeOffer(state, layout, id);
        if (!o) continue;
        for (const r of o.organs) if (r.ok) opts.push({ id, organ: r.organ, mass: r.mass, cheap: r.cheap });
    }
    let best = null;
    if (style === 'naive') {
        for (const x of opts) if (!best || x.mass < best.mass) best = x;
        // deep-pass4 (B413): with nothing in reach it does what the tape names (a heart for the dead)
        if (!best && !reach.length) {
            const id = growTarget(state, layout);
            const word = adviseGrow(state, layout);
            const organ = ['vat', 'gut', 'heart', 'nerve'].find((o) => word === `GROW A ${o.toUpperCase()}`);
            if (id && organ) return { id, organ };
        }
    } else {
        const R = bodyRatios(state, layout);
        const want = deadFix(state, layout) || (R.ratios[R.weakest] < 1 ? neededOrgan(R.ratios) : null);
        if (want) {
            for (const x of opts) if (x.organ === want && (!best || x.mass < best.mass)) best = x;
            if (!best) {
                // grow a living organ again into it (the front may be blocked)
                for (const id of spareOrgans(state, layout, want)) {
                    const o = takeOffer(state, layout, id);
                    const r = o && o.organs.find((y) => y.organ === want && y.ok);
                    if (r && (!best || r.mass < best.mass)) best = { id, organ: want, mass: r.mass };
                }
            }
            if (!best) return null;
        } else {
            const gauge = { gut: R.ratios.M, vat: R.ratios.F, heart: R.ratios.E, nerve: R.ratios.H };
            const w = (o) => Math.max(0.6, Math.min(3, Number.isFinite(gauge[o]) ? gauge[o] : 3));
            for (const x of opts) if (!best || x.mass * w(x.organ) < best.mass * w(best.organ)) best = x;
        }
    }
    if (best && reach.includes('machine')) {
        // saving for the hands: a take in the meantime only while it leaves half the price in hand
        const m = takeOffer(state, layout, 'machine').organs[0];
        if (state.grow.mass - best.mass < m.mass * HANDS_KEEP) return null;
    }
    return best ? { id: best.id, organ: best.organ } : null;
}
/** The chambers the body should reach next: the machine house once in reach, else the nearest. */
export function nextMarks(state, layout, n = DREAM_MARKS) {
    const graph = graphOf(layout);
    const body = new Set(state.grow.body);
    const reach = viewOf(state, layout).reachable;
    if (reach.includes('machine')) return ['machine'];
    const near = (id) => { const x = graph.nodes.find((m) => m.id === id); return x.floor * 100 + Math.abs(x.x) + Math.abs(x.z); };
    return graph.nodes.filter((x) => !body.has(x.id) && x.id !== 'machine' && x.kind !== 'hub').map((x) => x.id).sort((a, b) => near(a) - near(b)).slice(0, n);
}
/** Do what decideGrow chose. `starsPerDay`, `orePerDay` (the day's report) price the next level of an item. */
export function pressGrow(state, layout, a, starsPerDay = 0, orePerDay = 0) {
    if (a.kind === 'rise') return rise(state, layout);
    if (a.kind === 'body') return !!buyBody(state, a.id, starsPerDay, orePerDay);
    if (a.kind === 'take') return !!startTake(state, layout, a.id, a.organ);
    if (a.kind === 'mark') {
        for (const id of state.grow.marks.slice()) toggleMark(state, layout, id);
        for (const id of a.ids || []) toggleMark(state, layout, id);
        return true;
    }
    if (a.kind === 'dream') return dreamStart(state, layout);
    return false;
}
