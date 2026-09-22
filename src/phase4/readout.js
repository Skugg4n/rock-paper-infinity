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
    FOOD_PER_HUMAN, DAYS_PER_YEAR, MIN_SLEEPERS, CRYO, cryoName, cryoLabel, group, digCost, roomCost,
    freeChambers, sleepTrouble, BAD_ALARMS, MAX_AUTO, buildPending,
} from './deep.js';
import { ROOM_WORD, ROOM_WORDS, foodDaysLeft } from './advisor.js';

/**
 * EVERY NUMBER IN CHAPTER IV (v1.45.0). Ola, after v1.44.0: the numbers over the bars ran into
 * each other ("313031.1 2280.6M d 9M"). One short form everywhere, the counters and the rates
 * included: whole numbers under a thousand, then k, M, B, T with at most one decimal, and the
 * decimal only below ten: "313 k", "2.3 B", "9 M". Past a thousand trillion, "4.8e15".
 * @param {number} v
 * @returns {string}
 */
const UNITS = [[1e3, 'k'], [1e6, 'M'], [1e9, 'B'], [1e12, 'T']];
export function short(v) {
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '-';
    const sign = v < 0 ? '-' : '';
    const a = Math.abs(v);
    if (a >= 9.995e14) return `${sign}${a.toExponential(1).replace('+', '').replace('.0e', 'e')}`;
    if (Math.round(a) < 1000) return `${sign}${Math.round(a)}`;
    for (const [unit, name] of UNITS) {
        const x = a / unit;
        const r = x < 9.95 ? Math.round(x * 10) / 10 : Math.round(x);
        // 999.7 k is 1 M, never "1000 k": a number that rounds to a thousand moves up a unit
        if (r < 1000 || name === 'T') return `${sign}${r} ${name}`;
    }
    return `${sign}${Math.round(a)}`;
}
/** Numbers in a sentence use the same short form: nobody reads 47.3182 spare energy. */
const n = short;
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

/** How long until a party is home, the way the scout button says it: "1 y 3 m", "4 m", "12 d". */
export function backIn(days) {
    const d = Math.max(0, Math.ceil(days));
    let y = Math.floor(d / DAYS_PER_YEAR);
    let m = Math.floor((d - y * DAYS_PER_YEAR) / 30);
    // a year is twelve months of thirty days and five over: days 360 to 364 of a year are its
    // last month, and read as the next whole year, never "1 y 12 m" (v1.48.0)
    if (m >= 12) { y += 1; m = 0; }
    if (y && m) return `${group(y)} y ${m} m`;
    if (y) return `${group(y)} y`;
    if (m) return `${m} m`;
    return `${Math.max(1, d)} d`;
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
export const AFFORD_FAR_DAYS = 1000 * DAYS_PER_YEAR;
export function affordText({ price, have, perDay, blocked }) {
    if (blocked === 'pending') return 'Already being built.';
    if (blocked === 'top') return 'The ladder is at its top.';
    if (blocked === 'asleep') return 'The colony is asleep: wake it to buy.';
    if (blocked === 'people') return `Needs at least ${MIN_SLEEPERS} people to stay behind.`;
    if (blocked === 'chamber') return have >= price ? 'Needs a free chamber: dig one first.' : `Needs a free chamber, and ${affordText({ price, have, perDay }).toLowerCase()}`;
    if (!(price > have)) return '';
    if (!(perDay > 0)) return 'Not affordable at today\'s flow.';
    const wait = (price - have) / perDay;
    // "Affordable in 1 695 937 617 years" is true and useless: past a millennium, say so
    if (wait > AFFORD_FAR_DAYS) return 'More than a thousand years away at today\'s flow; asleep, the stars come faster.';
    return `Affordable in ${span(wait)}.`;
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
 * The same reason in a few words, for the caption UNDER a locked cryo button (v1.45.0: Ola saw
 * "100 y/s" greyed and could not tell what it wanted). "needs food for 100 y".
 * @param {number} tier - index into CRYO
 * @param {object|null} trouble - sleepTrouble()'s answer
 * @param {object} [o]
 * @param {number} [o.stars] - stars in hand, for a tier that is only waiting on its price
 * @returns {string} '' when nothing stands in the way
 */
export function cryoGateShort(tier, trouble, { stars = Infinity } = {}) {
    if (trouble) {
        if (trouble.kind === 'few') return `needs ${MIN_SLEEPERS} people`;
        if (trouble.kind === 'stall') return trouble.why === 'fuel' ? 'needs more mines' : `needs ${ROOM_WORDS[trouble.type] || trouble.type} automated`;
        if (trouble.kind === 'energy') return 'needs spare power';
        if (trouble.kind === 'food') return `needs food for ${cryoLabel(CRYO[tier].days)}`;
        return 'not safe yet';
    }
    const price = CRYO[tier]?.cost ?? 0;
    return stars < price ? `needs ${short(price)} stars` : '';
}
/**
 * THE ONE REASON a cryo tier cannot be had yet (v1.48.0). The overnight playtest: the caption
 * beside the snowflake said "needs a free chamber" while its tooltip said "Cryo I needs the
 * generators to run without hands". Now both are read off this one answer: the caption is its
 * `short`, the tooltip its `long`, which begins with the same words.
 *
 * In order: too few people; what a dry run of the sleep still meets once every order on the
 * books is built (`planned`: that is what the player still has to BUY, and `button` says which
 * button sells it); orders that are still being built; the tier's price.
 *
 * @param {number} tier - index into CRYO
 * @param {object} o
 * @param {object} o.state
 * @param {object|null} o.trouble - sleepTrouble() on the colony as it is today
 * @param {object|null} o.planned - sleepTrouble() on ordersDone(state)
 * @param {number} [o.starsPerDay]
 * @returns {{kind:string, button?:'auto'|'level', type?:string, short:string, long:string}|null}
 */
export function cryoNeed(tier, { state, trouble = null, planned = null, starsPerDay = 0 }) {
    const name = cryoName(tier);
    const say = (kind, shortText, detail, extra = {}) => ({ kind, ...extra, short: shortText, long: `${name} ${shortText}${detail ? `: ${detail}` : ''}.` });
    if ((state.humans || 0) < MIN_SLEEPERS) return say('few', `needs ${MIN_SLEEPERS} people`, `${Math.floor(state.humans || 0)} today`);
    const t = planned;
    if (t) {
        if (t.kind === 'few') return say('few', `needs ${MIN_SLEEPERS} people`, `${Math.floor(state.humans || 0)} today`);
        if (t.kind === 'stall' && t.why !== 'fuel') {
            const words = ROOM_WORDS[t.type] || t.type;
            return say('stall', `needs ${words} automated`, 'asleep, nobody runs them', { button: 'auto', type: t.type });
        }
        if (t.kind === 'stall') return say('fuel', 'needs more ore', 'asleep, the generators would burn it all', { button: 'level', type: 'mine' });
        if (t.kind === 'energy') return say('energy', 'needs spare power', `asleep, the rooms would run at ${t.pct} %`, { button: 'level', type: 'generator' });
        if (t.kind === 'food') return say('food', `needs food for ${cryoLabel(CRYO[tier].days)}`, `${group(Math.floor((t.day || 0) + (t.days || 0)))} days today`, { button: 'level', type: 'farm' });
        return say('other', 'is not safe yet', '');
    }
    if (trouble) {
        const left = (state.builds || []).reduce((a, j) => Math.max(a, j.doneDay - state.day), 0);
        return { kind: 'wait', short: `ready in ${backIn(left)}`, long: `${name} is ready in ${backIn(left)}: it waits for the orders being built.` };
    }
    const price = CRYO[tier]?.cost ?? 0;
    if ((state.stars || 0) < price) {
        return say('stars', `needs ${short(price)} stars`, affordText({ price, have: state.stars || 0, perDay: starsPerDay }).replace(/\.$/, '').toLowerCase());
    }
    return null;
}

/** The room type a column is fixed by, and the column's name in a "why". */
const COLUMN_NOUN = { M: 'ore', F: 'food', E: 'energy', H: 'free hands' };

/**
 * Which room type the level or the automate button offers, and why (v1.48.0). The overnight
 * playtest: cryo said "needs the generators automated" and the automate button only ever sold
 * the weakest column's room, so a player who followed the game never got to sleep. Now:
 *   1. the NEXT GOAL: what the next cryo tier needs, when this button sells it;
 *   2. for the level button, what runs low (the dot, when a store is falling);
 *   3. the weakest column, which is what makes the stars.
 * A type is only offered when there is a room of it to improve and no order of this kind for it
 * on the books; a goal that cannot be offered falls through to the next rule.
 *
 * @param {'level'|'auto'} kind
 * @param {object} state
 * @param {object} report - today's report
 * @param {object|null} need - cryoNeed() for the next tier
 * @param {object|null} [low] - lowPoint(), for the level button
 * @returns {{type:string, why:string, goal:boolean, head:string}}
 */
export function offerFor(kind, state, report, need, low = null) {
    const has = (t) => (state.rooms[t] || 0) > 0 || buildPending(state, 'room', t);
    const open = (t) => has(t) && !buildPending(state, kind, t) && (kind !== 'auto' || (state.auto[t] || 0) < MAX_AUTO);
    const verb = kind === 'auto' ? 'Automate' : 'Level';
    const pick = (type, why, goal) => ({ type, why, goal, head: `${verb} ${ROOM_WORDS[type]} (${why}).` });
    if (need && need.button === kind && need.type && open(need.type)) return pick(need.type, 'so the colony can sleep', true);
    if (kind === 'level' && low && low.falling && low.column) {
        const t = ROOM_FOR_COLUMN[low.column];
        if (open(t)) return pick(t, low.why, false);
    }
    const t = ROOM_FOR_COLUMN[report.weakest];
    const noun = COLUMN_NOUN[report.weakest];
    return pick(t, `${noun} ${report.weakest === 'H' ? 'limit' : 'limits'} the stars`, false);
}

/** How each column is named when it grows slowest. */
const GROWS = { M: 'Ore grows', F: 'Food grows', E: 'Spare energy grows', H: 'Free hands grow' };
/** A bar this full reads as full on screen, and never carries the dot. */
export const FULL_AT = 0.995;
/** Ties at zero days of cover are broken in this order: power reaches every room. */
const TIE = ['E', 'H', 'F', 'M'];

/**
 * THE DOT MARKS WHAT IS RUNNING LOW (v1.48.0). The overnight playtest: a full bar, "96 M d" of
 * food, carried the red dot and the advisor said "the farm is the bottleneck"; a human reads that
 * as "we are short of food". The dot is now scarcity:
 *   - when any store is falling (and its bar is not full), the one with the fewest DAYS OF COVER (stock divided by net
 *     outflow): ore mined less than burned, food grown less than eaten; energy short or a room
 *     short of hands is a shortage today, zero days;
 *   - when nothing falls, the slowest-growing column (the smallest surplus in the rules' one
 *     unit) among the bars that are not full;
 *   - a full bar never carries it, and when every bar is full there is no dot.
 * deep.js's own `weakest` still sets the stars; this is only what the screen marks.
 *
 * @param {object} state
 * @param {object} report - a day's report from tickDay
 * @param {object} [st] - stocks(state, report), for which bars are full
 * @returns {{column:string|null, falling:boolean, days:number, line:string, why:string}}
 */
export function lowPoint(state, report, st = stocks(state, report)) {
    // full as the bar draws it: 160 px rounds up from 99.7 %, and a full bar is not running low,
    // even when it is falling (1.5 k ore burning for three years is a full bar)
    const full = (c) => !!(st[c] && st[c].frac >= FULL_AT);
    const cover = [];
    if (report.parts.M < 0) cover.push({ c: 'M', days: Math.max(0, state.minerals / -report.parts.M) });
    const food = foodDaysLeft(state, report);
    if (Number.isFinite(food)) cover.push({ c: 'F', days: food });
    const powered = report.energyNeed > 0 ? Math.min(1, report.energyMade / report.energyNeed) : 1;
    if (powered < 0.995) cover.push({ c: 'E', days: 0, pct: Math.floor(powered * 100) });
    const shortRoom = crewShort(report);
    if (shortRoom) cover.push({ c: 'H', days: 0, room: shortRoom, pct: Math.floor(report.staff[shortRoom] * 100) });
    const falling = cover.filter((x) => !full(x.c));
    if (falling.length) {
        const cover = falling;
        cover.sort((a, b) => a.days - b.days || TIE.indexOf(a.c) - TIE.indexOf(b.c));
        const x = cover[0];
        let why;
        if (x.c === 'E') why = `energy is short, rooms run at ${x.pct} %`;
        else if (x.c === 'H') why = `hands are short, the ${ROOM_WORD[x.room]} runs at ${x.pct} %`;
        else {
            const what = x.c === 'M' ? 'ore' : 'food';
            why = x.days < 1 ? `the ${what} has run out` : `${what} runs out in ${span(x.days)}`;
        }
        return { column: x.c, falling: true, days: x.days, why, line: `${why[0].toUpperCase()}${why.slice(1)}.` };
    }
    const open = COLUMN.filter((c) => !full(c));
    if (!open.length) return { column: null, falling: false, days: Infinity, why: 'every store is full', line: 'Nothing is falling. Every store is full.' };
    const c = open.reduce((a, k) => (report.parts[k] < report.parts[a] ? k : a), open[0]);
    const grows = GROWS[c];
    return { column: c, falling: false, days: Infinity, why: `${grows.toLowerCase()} slowest`, line: `Nothing is falling. ${grows} slowest.` };
}
/** The first room type that stands short of hands today, or null. */
function crewShort(report) {
    for (const t of ROOMS) if ((report.live?.[t] || 0) > 0 && report.staff[t] < 0.999) return t;
    return null;
}

/**
 * Does a reward show on the counter it lands on? (v1.48.0) "+46 B" on a counter that reads
 * "600 T" before and after changes nothing anyone can see. Formatted with the counter's own
 * short form: the number is only worth putting on screen when the counter moves.
 * @param {number} counter - what the counter holds before
 * @param {number} reward
 * @returns {boolean}
 */
export const rewardShows = (counter, reward) => reward > 0 && short((counter || 0) + reward) !== short(counter || 0);

/** What the advisor says the day a longer sleep is there to be had. */
export const cryoReadyLine = (tier) => `${cryoName(tier)} is ready: ${rateWords(CRYO[tier].days)} a second.`;

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
