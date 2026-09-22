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

import {
    COLUMN, ROOMS, ROOM, ROOM_FOR_COLUMN, tickDay, roomMultiplier, upkeepMultiplier, BIRTH_FOOD,
    FOOD_PER_HUMAN, DAYS_PER_YEAR, MIN_SLEEPERS, CRYO, cryoName, group, digCost, roomCost,
    freeChambers, sleepTrouble, BAD_ALARMS,
} from './deep.js';
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
 * The sentence behind one bar (B062): one line, the store first, then what comes in and what
 * goes out in a day. "Food: 45 days left. +84 grown, -39 eaten a day."
 * @param {string} column - 'M', 'F', 'E' or 'H'
 * @param {object} state
 * @param {object} report - a day's report from tickDay
 * @returns {string}
 */
export function ledger(column, state, report) {
    const asleep = !!state.asleep;
    if (column === 'M') {
        return `Ore: ${n(state.minerals)} in store. +${n(report.minerals)} mined, -${n(report.fuel)} burned a day.`;
    }
    if (column === 'F') {
        const days = foodDays(state);
        const left = Number.isFinite(days) ? `${n(days)} ${Math.round(days) === 1 ? 'day' : 'days'} left` : 'nobody to feed';
        if (asleep) return `Food: ${left} when we wake. +${n(report.food)} grown, -${n(report.eaten + report.born * BIRTH_FOOD)} eaten a day in the ice.`;
        return `Food: ${left}. +${n(report.food)} grown, -${n(report.eaten + report.born * BIRTH_FOOD)} eaten a day.`;
    }
    if (column === 'E') {
        const used = ROOMS.reduce((a, t) => a + report.draw[t], 0);
        return `Energy: ${n(report.energySpare)} spare. +${n(report.energyMade)} made, -${n(used)} used a day.`;
    }
    if (asleep) return `People: ${n(state.humans)} asleep in the ice. Beds for ${n(report.capacity)}.`;
    const onDuty = ROOMS.filter((t) => report.crew[t] > 0.5);
    const busy = onDuty.reduce((a, t) => a + report.crew[t], 0);
    // a fully automated colony has nobody on a shift at all, and "0 on duty in nothing"
    // is not a sentence anyone would write
    const duty = onDuty.length
        ? `${n(busy)} on duty in the ${list(onDuty.map((t) => ROOM_WORD[t]))}.`
        : 'Nobody on duty; the rooms run themselves.';
    return `People: ${n(report.hands)} free of ${n(report.awake)} awake. ${duty} Beds for ${n(report.capacity)}.`;
}

/** Days the larder feeds the colony awake: the food store in the only unit that means anything. */
export const foodDays = (state) => (state.humans > 0 ? state.food / (state.humans * FOOD_PER_HUMAN) : Infinity);

/** The cheapest thing ore buys next: a room for the weakest column if there is a chamber for
 *  it, otherwise the next chamber. The ore bar is full when it is paid for. */
export function nextOrePrice(state, report) {
    const t = ROOM_FOR_COLUMN[report.weakest] || 'mine';
    const dig = digCost(state.chambers);
    return freeChambers(state) > 0 ? Math.min(dig, roomCost(t, state.rooms[t] || 0)) : dig;
}

export const FOOD_FULL_DAYS = 365;      // the food bar is full at a year of eating in store

/**
 * The four columns as STORES (B056): each bar on its own absolute scale, never against the
 * others. Ore against the next thing ore buys; food in days of eating, full at a year; energy
 * as the share of what is made that is left spare; people as the share of hands that are free
 * (asleep: the share of the beds that are filled).
 *
 * @param {object} state
 * @param {object} report
 * @param {number} [orePrice] - what a full ore bar means; nextOrePrice() by default
 * @returns {Object<string,{value:number, frac:number, head:string}>}
 */
export function stocks(state, report, orePrice = nextOrePrice(state, report)) {
    const f = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
    const days = foodDays(state);
    const asleep = !!state.asleep;
    return {
        M: { value: state.minerals, frac: f(state.minerals / Math.max(1, orePrice)), head: n(state.minerals) },
        F: { value: days, frac: f(days / FOOD_FULL_DAYS), head: Number.isFinite(days) ? `${n(days)} d` : '-' },
        E: { value: report.energySpare, frac: f(report.energyMade > 0 ? report.energySpare / report.energyMade : 0), head: n(report.energySpare) },
        H: asleep
            ? { value: state.humans, frac: f(report.capacity > 0 ? state.humans / report.capacity : 0), head: n(state.humans) }
            : { value: report.hands, frac: f(report.awake > 0 ? report.hands / report.awake : 0), head: n(report.hands) },
    };
}

/**
 * What comes into each store and what goes out of it in a day, for the "+in -out" under a bar.
 * @param {object} state
 * @param {object} report
 * @returns {Object<string,{in:number, out:number}>}
 */
export function flows(state, report) {
    const used = ROOMS.reduce((a, t) => a + report.draw[t], 0);
    const duty = ROOMS.reduce((a, t) => a + report.crew[t], 0);
    return {
        M: { in: report.minerals, out: report.fuel },
        F: { in: report.food, out: report.eaten + report.born * BIRTH_FOOD },
        E: { in: report.energyMade, out: used },
        H: state.asleep ? { in: report.born, out: report.died || 0 } : { in: report.awake, out: duty },
    };
}
/** "+84" / "-39": the two numbers under a bar, rounded the way a sentence rounds them. */
export const flowText = (v, sign) => `${sign}${n(Math.abs(v))}`;

/** A length of colony time, in the unit a person would use. */
export function span(days) {
    const d = Math.max(0, days);
    if (d < 1.5) return '1 day';
    if (d < DAYS_PER_YEAR) return `${Math.round(d)} days`;
    const y = Math.round(d / DAYS_PER_YEAR);
    return y === 1 ? '1 year' : `${group(y)} years`;
}

/** What a tier sleeps in a second, the way a person says it: "a month", "a century". */
const RATE_WORDS = {
    30: 'a month', 365: 'a year', 3650: 'ten years', 36500: 'a century', 365000: 'a thousand years',
    3650000: 'ten thousand years', 36500000: 'a hundred thousand years',
};
export const rateWords = (days) => RATE_WORDS[days] || span(days);

/**
 * The line every price ends with when it cannot be paid yet (B064): what is missing and how
 * long, at today's flow, it takes to come in.
 * @param {object} o
 * @param {number} o.price
 * @param {number} o.have
 * @param {number} o.perDay - what comes in a day, in the same currency
 * @param {string} [o.blocked] - 'chamber' | 'pending' | 'top' | 'asleep' | 'people'
 * @returns {string} '' when it can be bought now
 */
export function affordText({ price, have, perDay, blocked }) {
    if (blocked === 'pending') return 'Already being built.';
    if (blocked === 'top') return 'The ladder is at its top.';
    if (blocked === 'asleep') return 'The colony is asleep: wake it to buy.';
    if (blocked === 'people') return `Needs at least ${MIN_SLEEPERS} people to stay behind.`;
    if (blocked === 'chamber') return have >= price ? 'Needs a free chamber: dig one first.' : `Needs a free chamber, and ${affordText({ price, have, perDay }).toLowerCase()}`;
    if (!(price > have)) return '';
    if (!(perDay > 0)) return 'Not affordable at today\'s flow.';
    return `Affordable in ${span((price - have) / perDay)}.`;
}

/**
 * Why a cryo tier is not offered yet, in one sentence (B063): "Cryo II needs food for 365 days:
 * 210 today." Read off the dry run's first alarm.
 * @param {number} tier - index into CRYO
 * @param {object} trouble - sleepTrouble()'s answer
 * @param {object} state
 * @returns {string}
 */
export function cryoGateText(tier, trouble, state) {
    const name = cryoName(tier);
    if (!trouble) return '';
    if (trouble.kind === 'few') return `${name} needs at least ${MIN_SLEEPERS} people to go under: ${Math.floor(state.humans)} today.`;
    if (trouble.kind === 'stall') {
        return trouble.why === 'fuel'
            ? `${name} needs the mines to keep up with what the generators burn.`
            : `${name} needs the ${ROOM_WORDS[trouble.type] || trouble.type} to run without hands.`;
    }
    if (trouble.kind === 'energy') return `${name} needs spare power: asleep, the rooms would run at ${trouble.pct} %.`;
    if (trouble.kind === 'food') return `${name} needs food for ${group(CRYO[tier].days)} days: ${group(Math.floor((trouble.day || 0) + trouble.days))} today.`;
    return '';
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

/**
 * The state the colony would be in once a purchase is paid for AND finished: the price gone,
 * the room, level, automation or chamber in place. A copy; the real state is not touched.
 */
export function applyPurchase(state, kind, type, price = 0, currency = 'minerals') {
    const c = cloneState(state);
    if (kind === 'dig') c.chambers += 1;
    else if (kind === 'room') c.rooms[type] = (c.rooms[type] || 0) + 1;
    else if (kind === 'level') c.level[type] = (c.level[type] || 0) + 1;
    else if (kind === 'auto') c.auto[type] = (c.auto[type] || 0) + 1;
    c[currency] = Math.max(0, (c[currency] || 0) - price);
    return c;
}

/** The ghosts on the bars: each store as it would stand once the purchase is paid and done. */
export function previewStocks(state, kind, type, price, currency, orePrice) {
    const after = applyPurchase(state, kind, type, price, currency);
    const r = tickDay(cloneState(after), !!state.asleep);
    return stocks(after, r, orePrice);
}

const more = (days) => span(days).replace(/^(\d[\d ]*|1) /, '$1 more ');

/**
 * What a purchase does for the GOAL (B060), the last line of its tooltip. The bottleneck dot
 * alone was never a reason to buy; this is. Worked out by dry runs, never estimated:
 *   1. the sleep: how long the colony could sleep at today's tier before an alarm, before and
 *      after. "Lets the colony sleep 3 more years without an alarm."
 *   2. otherwise the stars: how many more a day, toward the next thing stars buy.
 *
 * @param {object} state
 * @param {'dig'|'room'|'level'|'auto'} kind
 * @param {string|null} type
 * @param {object} o
 * @param {number} o.price
 * @param {'minerals'|'stars'} o.currency
 * @param {number} o.tierDays - days per real second of the tier the colony would sleep at
 * @param {object} o.report - today's report
 * @param {string} [o.goal] - what the stars are for next ("Cryo II")
 * @param {Function} [o.clause] - troubleClause from the advisor
 * @returns {string}
 */
export function consequence(state, kind, type, { price = 0, currency = 'minerals', tierDays = 30, report, goal = 'the next level', clause = () => 'an alarm' }) {
    if (kind === 'dig') return 'Room for one more room.';
    const after = applyPurchase(state, kind, type, price, currency);
    const horizon = Math.max(3650, tierDays * 10);
    const tb = sleepTrouble({ ...cloneState(state), asleep: false }, horizon, 3000);
    const ta = sleepTrouble({ ...after, asleep: false }, horizon, 3000);
    const db = tb ? tb.day : horizon, da = ta ? ta.day : horizon;
    if (da > db && BAD_ALARMS.includes(tb?.kind)) {
        return tb.kind === 'food'
            ? `Food for ${more(da - db)} of sleep.`
            : `Lets the colony sleep ${more(da - db)}${ta ? '' : ' or longer'} without an alarm.`;
    }
    if (da < db) return `The colony would wake ${span(db - da)} sooner: ${clause(ta)}.`;
    const ra = tickDay(cloneState(after), !!state.asleep).stars;
    const delta = ra - (report?.stars || 0);
    if (delta >= 0.5) return `+${n(delta)} stars a day toward ${goal}.`;
    if (delta <= -0.5) return `-${n(-delta)} stars a day until the other columns catch up.`;
    if (type === 'dorm') return 'More beds; the colony grows into them while it is fed.';
    return 'No change to the stars until the weakest column moves.';
}
