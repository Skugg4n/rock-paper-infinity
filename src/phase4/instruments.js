/**
 * Chapter IV · THE DEEP: the instruments (deep-rebuild, movement I · TEND, and II · SLEEP).
 * docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md. Pure: no DOM, no clock.
 *
 * Everything the instrument panel, the drawer and the night show is READ here off the rules that
 * already exist (deep.js, tree.js, readout.js, watcher.js). Nothing in the economy moves because
 * the screen changed: the gauges read days of cover, the one stamped label reads the next thing to
 * do, the three cryo lamps read Cryo I's own road, and the drawer reads tree.js's canBuy.
 *
 * The words on screen are few and fixed: they are all in this file, so a test can read them.
 */

import {
    ROOM_FOR_COLUMN, MIN_SLEEPERS, freeChambers, buildPending, nextPrice, CRYO, CRYO_TOP,
    sleepTrouble, feedCost, FEED_MAX, buildProgress, isQueued, RESURFACE_AT, surface,
} from './deep.js';
import { foodDaysLeft } from './advisor.js';
import { stocks, short } from './readout.js';
import {
    NODES, NODE_BY_ID, canBuy, orderedOf, levelOf, nodeVisible, stateLine, priceOf, opened,
} from './tree.js';

/* ---- THE GAUGES ---------------------------------------------------------------------------
   Four round gauges: ORE, FOOD, POWER, HANDS. The needle stands on a scale of 0 to 1 along the
   dial's sweep. A store that FALLS points at its days of cover (0 days at the left stop, the red
   arc up to RED_DAYS); one that does not fall rests in the soft green at the right, a little
   further the fuller it is. */
export const GAUGES = [
    { c: 'M', label: 'ORE' },
    { c: 'F', label: 'FOOD' },
    { c: 'E', label: 'POWER' },
    { c: 'H', label: 'HANDS' },
];
/** Under this many days of cover a falling store is in the red. */
export const RED_DAYS = 30;
/** Where a falling store's needle stands: 0 at no days left, approaching FALL_TOP for long cover. */
export const FALL_TOP = 0.8;
const FALL_HALF = 60;
export const fallK = (days) => (Number.isFinite(days) ? FALL_TOP * Math.max(0, days) / (Math.max(0, days) + FALL_HALF) : FALL_TOP);
/** The red arc runs from the left stop to here. */
export const RED_K = fallK(RED_DAYS);
/** The green arc: where a store that is not falling rests. */
export const GREEN_FROM = 0.86;
export const GREEN_SPAN = 0.12;

/**
 * The four needles, read off the day's report (a dry run of the next day).
 * @param {object} state
 * @param {object} report - tickDay's report
 * @returns {Object<string,{k:number, falling:boolean, red:boolean, days:number}>}
 */
export function gauges(state, report) {
    const st = stocks(state, report);
    const out = {};
    const rising = (c) => ({ k: GREEN_FROM + GREEN_SPAN * Math.max(0, Math.min(1, st[c].frac)), falling: false, red: false, days: Infinity });
    const fall = (days, k = fallK(days)) => ({ k, falling: true, red: days < RED_DAYS, days });
    // ore: what the generators burn beyond what the mines bring
    out.M = report.parts.M < 0 ? fall(Math.max(0, state.minerals / -report.parts.M)) : rising('M');
    // food: the larder at today's flow
    const food = foodDaysLeft(state, report);
    out.F = Number.isFinite(food) ? fall(food) : rising('F');
    // power: a flow, not a store. Short of it, the needle sits in the red by how short
    const powered = report.energyNeed > 0 ? Math.min(1, report.energyMade / report.energyNeed) : 1;
    out.E = powered < 0.995 ? fall(0, RED_K * powered) : rising('E');
    // hands: a room short of crew, in the red by how short
    let short0 = null;
    for (const t of Object.keys(report.staff || {})) {
        if ((report.live?.[t] || 0) > 0 && report.staff[t] < 0.999) { short0 = t; break; }
    }
    out.H = short0 ? { ...fall(0, RED_K * report.staff[short0]), room: short0 } : rising('H');
    return out;
}

/* ---- THE ONE STAMPED LABEL ----------------------------------------------------------------
   "INSTRUMENTS: BUILD FARM". The only advice in the game. It never explains itself. */
export const ADVICE_PREFIX = 'INSTRUMENTS: ';
const ROOM_UP = { mine: 'MINE', farm: 'FARM', generator: 'GENERATOR', dorm: 'DORMITORY' };
const ROOMS_UP = { mine: 'MINES', farm: 'FARMS', generator: 'GENERATORS', dorm: 'DORMITORIES' };
export const ADVICE = {
    build: (t) => `BUILD ${ROOM_UP[t]}`,
    automate: (t) => `AUTOMATE ${ROOMS_UP[t]}`,
    dig: 'DIG',
    feed: 'FEED THE MACHINE',
    longer: 'LONGER SLEEP',
    sleep: 'SLEEP',
    wait: 'WAIT',
};
/** The label holds a word at least this long before it may change. */
export const ADVICE_HOLD_MS = 4000;

/** A room of this type ordered or dug toward: BUILD it, or DIG for a chamber to put it in. */
function buildOrDig(state, t) {
    if (freeChambers(state) > 0) return buildPending(state, 'room', t) ? null : ADVICE.build(t);
    return buildPending(state, 'dig') ? null : ADVICE.dig;
}

/**
 * The instruments' word for now.
 * @param {object} state
 * @param {object} report - tickDay's report for the day ahead
 * @param {object} ctx
 * @param {object|null} ctx.road - readout.js cryoRoad for the next tier (Cryo I before the hall)
 * @param {boolean} ctx.lever - the lever can be pulled (Cryo I can be bought, or the hall stands)
 * @param {object} [ctx.g] - gauges(), when the caller has it
 * @returns {string} one of ADVICE's words, without the prefix
 */
export function advise(state, report, { road = null, lever = false, g = gauges(state, report) } = {}) {
    if (state.watcher && state.watcher.gone) return '';
    // 1. a needle in the red: the room that fixes it
    const red = Object.entries(g).filter(([, x]) => x.red).sort((a, b) => a[1].k - b[1].k)[0];
    if (red) {
        const [c, x] = red;
        if (c === 'H') {
            const t = x.room;
            if (t && !((state.auto[t] || 0) > 0) && !buildPending(state, 'auto', t)) return ADVICE.automate(t);
            const w = buildOrDig(state, 'dorm');
            if (w) return w;
        } else {
            const w = buildOrDig(state, ROOM_FOR_COLUMN[c]);
            if (w) return w;
        }
    }
    if ((state.humans || 0) < MIN_SLEEPERS) { const w = buildOrDig(state, 'dorm'); if (w) return w; }
    // 2. the lever is there: the goal
    if (state.cryo < 0 && lever) return ADVICE.sleep;
    // 3. ore for a room of the weakest kind, or for a chamber
    const t = ROOM_FOR_COLUMN[report.weakest] || 'mine';
    if (freeChambers(state) > 0) {
        if (!buildPending(state, 'room', t) && state.minerals >= nextPrice(state, 'room', t)) return ADVICE.build(t);
    } else if (!buildPending(state, 'dig') && state.minerals >= nextPrice(state, 'dig')) return ADVICE.dig;
    // 4. before the hall: the road to Cryo I, in order
    if (state.cryo < 0 && road) {
        for (const item of road.items) {
            if (item.done || item.ordered) continue;
            if (item.key.startsWith('auto-')) return ADVICE.automate(item.key.slice(5));
            if (item.key === 'food') { const w = buildOrDig(state, 'farm'); if (w) return w; }
            if (item.key === 'energy') { const w = buildOrDig(state, 'generator'); if (w) return w; }
            if (item.key === 'ore') { const w = buildOrDig(state, 'mine'); if (w) return w; }
        }
    }
    // 5. the machine, when a level of feed can be paid
    if ((state.feed || 0) < FEED_MAX && (state.stars || 0) >= feedCost(state.feed || 0)) return ADVICE.feed;
    if (state.cryo >= 0) {
        // 6. a longer sleep can be bought
        const tier = state.cryo + 1;
        if (tier <= CRYO_TOP && road && road.open) return ADVICE.longer;
        // 7. the colony can sleep safely: sleep
        if (lever && !sleepTrouble(state, CRYO[Math.min(CRYO.length - 1, state.cryo)].days, 1500)) return ADVICE.sleep;
    }
    return ADVICE.wait;
}

/* ---- THE THREE LAMPS OF CRYO --------------------------------------------------------------
   Cryo I's own road (readout.js cryoRoad), item for item: every room a crew runs must be
   automated, and a dry run of the sleep must meet no shortage of ore, power or food. Each lamp
   holds the items of one store; lit when all of them are done. The price and the people are the
   lever's: it appears when tree.js says Cryo I can be bought. */
export const LAMPS = [
    { key: 'food', label: 'FOOD RUNS ITSELF', items: ['auto-farm', 'food'] },
    { key: 'power', label: 'POWER RUNS ITSELF', items: ['auto-generator', 'energy'] },
    { key: 'ore', label: 'ORE RUNS ITSELF', items: ['auto-mine', 'ore'] },
];
/**
 * @param {object|null} road - cryoRoad(0, state)
 * @returns {{key:string, label:string, lit:boolean, ordered:boolean}[]}
 */
export function cryoLamps(road) {
    const items = (road && road.items) || [];
    return LAMPS.map((L) => {
        const mine = items.filter((x) => L.items.includes(x.key));
        const open = mine.filter((x) => !x.done);
        return { key: L.key, label: L.label, lit: open.length === 0, ordered: open.length > 0 && open.every((x) => x.ordered) };
    });
}

/* ---- THE ONE WAKE LAMP -------------------------------------------------------------------
   What woke the colony, in one word on the tape. The sentence stays in the save's log. */
export const WAKE_WORDS = ['FOOD', 'POWER', 'FAULT', 'VOICE', 'AWAKE'];
/**
 * @param {object} alarm - what woke the colony
 * @returns {string} one of WAKE_WORDS
 */
export function wakeWord(alarm) {
    const a = alarm || {};
    switch (a.kind) {
    case 'food': return 'FOOD';
    case 'energy': return 'POWER';
    case 'stall': return a.why === 'fuel' ? 'POWER' : 'FAULT';
    case 'few': case 'scouts': return 'FAULT';
    case 'reboot': return a.voice ? 'VOICE' : 'FAULT';
    default: return a.rebooted ? 'FAULT' : 'AWAKE';
    }
}

/* ---- THE MIND GOES ------------------------------------------------------------------------
   As the Watcher's stability falls in the sleep, the screen hallucinates. Each kind comes under
   its line and stays until a snap clears them all. Nothing explains it. */
export const HALLUCINATIONS = [
    { kind: 'lamp', below: 70 },        // a lamp burns in an empty chamber
    { kind: 'figure', below: 55 },      // a tall thin figure stands on the crust
    { kind: 'twitch', below: 40 },      // a needle points where nothing is, a year digit reads wrong
    { kind: 'breathe', below: 25 },     // the walls of a plate breathe
];
/** The kinds the mind is low enough for. */
export const hallucinationsAt = (stability) => HALLUCINATIONS.filter((h) => stability < h.below).map((h) => h.kind);
/** After a snap the screen is clean for this long before anything comes back. */
export const SNAP_CLEAR_MS = 7000;

/* ---- THE SLEEP'S COUNTER ------------------------------------------------------------------ */
/** The surface's true healing as a share of the way, 0 the day the exit was blown, 1 at the line. */
export function healing(state) {
    const d0 = state.doom0 || 85;
    if (!(d0 > RESURFACE_AT)) return 1;
    const now = surface(d0, state.day || 0);
    return Math.max(0, Math.min(1, (d0 - now) / (d0 - RESURFACE_AT)));
}

/* ---- THE DRAWER ---------------------------------------------------------------------------
   Only what can be bought NOW, bright, one line each, and per branch the NEXT thing, dim, with
   what it needs. Awake the day's things, asleep the night's. */
export const DRAWER_GROUPS = ['EXTRACTION', 'CULTURE', 'POWER', 'HABITAT', 'CRYO', 'WATCHER'];
/** Not in the drawer: the body's steps and the question that opens them (movement III), and the
 *  nodes with no rule behind them. */
const LEFT_OUT = new Set(['question']);

const AUTO_WORDS = {
    mine: ['Mines run without people.', 'Mines make three times more.', 'Mines make a hundredfold more.'],
    farm: ['Farms run without people.', 'Farms grow three times more.', 'Farms grow a hundredfold more.'],
    generator: ['Generators run without people.', 'Generators make three times more.', 'Generators make a hundredfold more.'],
    dorm: ['Machines raise the children.', 'Dormitories hold three times more.', 'Dormitories hold a hundredfold more.'],
};
const DOES = {
    seam: 'Mines dig twice as much.',
    yield: 'Farms grow twice as much.',
    output: 'Generators make twice the power.',
    beds: 'Dormitories sleep twice as many.',
    feed: 'The machine plays more games.',
    lossless: 'Automated rooms make three times more.',
    quiet: 'Automated rooms cost almost nothing.',
    cold: 'Sleepers eat nothing at all.',
    longcount: 'A second sleeps a million years.',
    watchdog: 'The mind drifts more slowly.',
    scheduler: 'Building goes on in sleep.',
    deepread: 'A click steadies it more.',
    nightvision: 'Alarms let them sleep longer.',
    cooling: 'Holds twice the capacity.',
    secondcore: 'The lamps steady it more.',
    mast: 'Sees further up the shaft.',
    reactor: 'Capacity fills three times faster.',
};
const RATE_SHORT = { 30: 'a month', 365: 'a year', 3650: 'ten years', 36500: 'a century', 365000: 'a millennium', 3650000: 'ten millennia', 36500000: 'a hundred millennia' };

/** What a node does, in about five words. */
export function drawerDoes(state, id) {
    const n = NODE_BY_ID[id];
    if (!n) return '';
    if (n.kind === 'auto') {
        const k = levelOf(state, id) + orderedOf(state, id) + 1;
        const w = AUTO_WORDS[n.type];
        return k <= 1 ? w[0] : (k <= 3 ? w[1] : w[2]);
    }
    if (n.kind === 'cryo') return n.tier === 0 ? 'A hall to sleep in.' : `A second sleeps ${RATE_SHORT[CRYO[n.tier].days] || 'longer'}.`;
    return DOES[id] || '';
}
/** The price on a row: "★ 4.4 k", "★ 20 k + 20 capacity". */
export function drawerPrice(price) {
    if (!price) return '';
    const parts = [];
    if (price.stars) parts.push(`★ ${short(price.stars)}`);
    if (price.cap) parts.push(`${short(price.cap)} capacity`);
    if (price.ore) parts.push(`${short(price.ore)} ore`);
    if (price.beds) parts.push(price.beds === 1 ? 'a dormitory' : `${price.beds} dormitories`);
    return parts.join(' + ');
}
/** What a locked row needs, in a few plain words. */
export function drawerNeed(state, id, ctx) {
    const n = NODE_BY_ID[id];
    if (n.kind === 'cryo' && n.tier === 0) return 'Needs the three lamps lit.';
    return stateLine(state, id, ctx).text;
}
/** How far along the order of this node under way is, 0 to 1, or -1 when none is. */
function orderProgress(state, n) {
    const jobs = (state.builds || []).filter((j) => j.kind === n.kind && j.type === n.type);
    if (!jobs.length) return -1;
    const going = jobs.filter((j) => !isQueued(j));
    return going.length ? Math.max(...going.map((j) => buildProgress(state, j))) : 0;
}

/**
 * The drawer's rows, group by group.
 * @param {object} state
 * @param {object} ctx - tree.js's ctx ({ need, road, starsPerDay, asleep })
 * @returns {{name:string, rows:{id:string, name:string, does:string, price:string, status:'buy'|'next'|'building', need:string, progress:number}[]}[]}
 */
export function drawerGroups(state, ctx = {}) {
    const asleep = ctx.asleep ?? !!state.asleep;
    const groups = [];
    for (const g of DRAWER_GROUPS) {
        if (g === 'WATCHER' && !asleep) continue;
        const rows = [];
        let next = null;
        for (const n of NODES) {
            if (n.branch !== g || LEFT_OUT.has(n.id) || n.kind === 'teaser' || n.kind === 'bio' || n.kind === 'root') continue;
            if (!nodeVisible(state, n.id)) continue;
            if (n.kind === 'surface' && !opened(state, n.id)) continue;
            // asleep only the night's things: the levels, automations and cryo tiers wait for the wake
            if (asleep && (n.kind === 'level' || n.kind === 'auto' || n.kind === 'cryo')) continue;
            const can = canBuy(state, n.id, { ...ctx, asleep });
            const prog = (n.kind === 'level' || n.kind === 'auto') ? orderProgress(state, n) : -1;
            const row = {
                id: n.id, name: n.kind === 'cryo' ? `CRYO ${n.name}` : n.name.replace(/\n/g, ' ').replace('AUTOMATION', 'AUTO').replace('THE MACHINE: FEED', 'FEED THE MACHINE'),
                does: drawerDoes(state, n.id), price: drawerPrice(priceOf(state, n.id)), status: 'buy', need: '', progress: prog,
            };
            if (can.ok) { rows.push(row); continue; }
            if (prog >= 0) { rows.push({ ...row, status: 'building', price: '' }); continue; }
            if (['bought', 'surface', 'teaser', 'mode'].includes(can.kind)) continue;
            if (!next) next = { ...row, status: 'next', need: drawerNeed(state, n.id, { ...ctx, asleep }) };
        }
        if (next) rows.push(next);
        if (rows.length) groups.push({ name: g, rows });
    }
    return groups;
}
/** How many rows of the drawer can be bought now: the badge on its button. */
export const drawerCount = (groups) => groups.reduce((a, g) => a + g.rows.filter((r) => r.status === 'buy').length, 0);

/* ---- SURFACE IS THE WATCHER --------------------------------------------------------------- */
/** How many letters of SURFACE are on the Watcher's tape by night n: none before night 4. */
export function surfaceTape(night, word = 'SURFACE') {
    const n = night | 0;
    const share = n >= 6 ? 1 : n === 5 ? 0.6 : n === 4 ? 0.3 : 0;
    return Math.round(word.length * share);
}
/** At night 6 the label flickers to WATCHER for this long before the question types. */
export const MERGE_MS = 1800;
/** Surface's card fades out this long after a game's result. */
export const RPS_FADE_MS = 6000;
