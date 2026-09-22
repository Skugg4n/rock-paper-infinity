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

import { ROOMS, ROOM_FOR_COLUMN, FOOD_PER_HUMAN, survival, SURVIVAL_AT } from './deep.js';

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

/* ---------------------------------------------------------------------------
 * v1.43.0: SLEEP IS A STATE. What woke the colony, what the scouts brought home,
 * and the line that says what all of it is for. Pure, so the wording is tested.
 * ------------------------------------------------------------------------ */

/** The advisor's first line at the descent: the reason for everything that follows. */
export const DESCENT_LINE = 'The surface will heal. Not in our lifetimes. We dig, we build, we sleep.';

/** The glyph each alarm puts on the wake-up strip. */
export const ALARM_GLYPH = {
    food: 'wheat', energy: 'zap', stall: 'triangle-alert', few: 'user-minus', scouts: 'radar',
    estimate: 'sunrise', surface: 'sunrise', act: 'check', manual: 'sun', debug: 'bell',
};
/** A stalled room shows its own glyph instead: the mine that stopped, not a warning sign. */
export const alarmGlyph = (alarm, roomIcon = {}) => (alarm?.kind === 'stall' && roomIcon[alarm.type])
    || ALARM_GLYPH[alarm?.kind] || 'bell';

const chamberNo = (slot) => (slot >= 0 ? `chamber ${slot + 1}` : 'a chamber');

/** Where a reading leaves the colony, in two words. */
export const GETTING_THERE_AT = 50;
export function verdict(pct) {
    if (pct >= SURVIVAL_AT) return 'We could go up.';
    if (pct >= GETTING_THERE_AT) return 'Getting there.';
    return 'Not yet.';
}
/**
 * A reading as the player reads it (v1.45.0): the rules count doomsday, the screen says the
 * chance of survival if we went up now, and what that means. "survival 7 %. Not yet."
 * @param {number} doomPct - the reading, in the rules' doomsday per cent
 */
export function readingText(doomPct) {
    const pct = Math.round(survival(doomPct));
    return `survival ${pct} %. ${verdict(pct)}`;
}

/**
 * One line per party that came home, awake, for the feed.
 * @param {{outcome:string, reading:number|null, slot:number}} l
 * @returns {string}
 */
export function scoutLine(l) {
    if (l.outcome === 'reading') return `Scout party returned: ${readingText(l.reading)}`;
    if (l.outcome === 'wrong') return 'Scout party returned raving: reading unreliable.';
    if (l.outcome === 'monster') return `Something came back with the scouts: ${chamberNo(l.slot)} dark.`;
    return 'Scout party lost.';
}
/** The line the feed gets the day a party leaves. */
export const scoutSentLine = (people) => `Scout party sent (${Math.round(people)} ${Math.round(people) === 1 ? 'person' : 'people'}).`;

const JOB_DONE = {
    dig: () => 'the new chamber is dug',
    room: (t) => `the new ${ROOM_WORD[t]} is running`,
    level: (t) => `the ${ROOM_WORDS[t]} are levelled`,
    auto: (t) => `the ${ROOM_WORDS[t]} are automated`,
};

/**
 * What woke the colony, in one sentence that starts with "Woke:". The strip carries the glyph;
 * this is the words.
 * @param {object} alarm - `sum.alarm` from sleep(), or { kind:'manual' }
 * @returns {string}
 */
export function alarmLine(alarm) {
    const a = alarm || { kind: 'manual' };
    switch (a.kind) {
    case 'food':
        return a.days > 0 ? `Woke: food will run out in ${a.days} ${a.days === 1 ? 'day' : 'days'}.` : 'Woke: the food has run out.';
    case 'energy':
        return `Woke: energy is short, rooms run at ${a.pct} %.`;
    case 'stall':
        return a.why === 'fuel'
            ? 'Woke: the generators stalled, no ore to burn.'
            : `Woke: the ${ROOM_WORD[a.type] || a.type} stalled, no hands.`;
    case 'few':
        return 'Woke: too few of us left to keep the hall running.';
    case 'scouts': {
        const l = (a.landed || [])[0];
        if (!l) return 'Woke: a scout party is home.';
        if (l.outcome === 'reading') return `Woke: scout party returned, ${readingText(l.reading)}`;
        if (l.outcome === 'wrong') return 'Woke: scout party returned raving. Reading unreliable.';
        if (l.outcome === 'monster') return `Woke: something came back with the scouts. ${chamberNo(l.slot).replace(/^c/, 'C')} dark.`;
        return 'Woke: scout party lost.';
    }
    case 'estimate':
        return `Woke: we may survive up there. Survival ${Math.round(survival(a.est.mean))} ± ${Math.round(a.est.spread)} %, need ${SURVIVAL_AT} %.`;
    case 'surface':
        return `Woke: the sensor on the shaft reads survival ${Math.round(survival(a.reading ?? 15))} %. The surface has healed.`;
    case 'act': {
        const done = a.job && JOB_DONE[a.job.kind] ? JOB_DONE[a.job.kind](a.job.type) : 'the order is in';
        return `Woke: ${done}, and the next one is paid for.`;
    }
    case 'debug':
        return 'Woke: a test alarm.';
    default:
        return 'Woke: the hall was opened by hand.';
    }
}

/** The same trouble as a clause, for a tooltip that warns before the sleep: "the mine stalls, no hands". */
export function troubleClause(t) {
    if (!t) return '';
    if (t.kind === 'stall') return t.why === 'fuel' ? 'the generators run out of ore' : `the ${ROOM_WORD[t.type] || t.type} stalls, no hands`;
    if (t.kind === 'energy') return `energy runs short, rooms at ${t.pct} %`;
    if (t.kind === 'food') return `food runs out in ${t.days} ${t.days === 1 ? 'day' : 'days'}`;
    if (t.kind === 'few') return 'too few of us are left';
    return 'something wakes it';
}

/**
 * The line a failed try at the surface writes (v1.45.0).
 * @param {{lost:number, survival:number}} out - attemptAscent()'s answer
 * @param {Function} [fmt] - number formatter
 */
export function ascentFailLine(out, fmt = (v) => String(Math.round(v))) {
    return `${fmt(Math.round(out.lost))} went up and did not come back. Survival up there is ${Math.round(out.survival)} %; we need ${SURVIVAL_AT}.`;
}
