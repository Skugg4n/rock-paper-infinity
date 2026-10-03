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
    sleepTrouble, FEED_MAX, buildProgress, isQueued, RESURFACE_AT, surface, vatsLevel, feedPrice, vatsPrice,
    sleepFull, cryoName,
} from './deep.js';
import { foodDaysLeft } from './advisor.js';
import { stocks, short, ORE_SIGN, cryoRoad, list } from './readout.js';
import {
    NODES, NODE_BY_ID, canBuy, orderedOf, levelOf, nodeVisible, stateLine, priceOf, opened, cryoNode, displayName,
    nightNext, buy as treeBuyFor,
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
    // deep-fix2: one continuous scale, so the needle never jumps when the last post is filled: short
    // of crew it sits in the red by how short; fully crewed it climbs from the red's edge toward the
    // top as the share of free hands grows (full at HANDS_FULL of the people free)
    if (short0) out.H = { ...fall(0, RED_K * report.staff[short0]), room: short0 };
    else if (state.asleep) out.H = rising('H');
    else out.H = { k: handsK(report.awake > 0 ? report.hands / report.awake : 0), falling: false, red: false, days: Infinity };
    return out;
}
/** At this share of the people free the HANDS needle reaches the top of its green. */
export const HANDS_FULL = 0.5;
/** Where the HANDS needle stands for a share of free hands, fully crewed: from the red's edge up. */
export const handsK = (free) => RED_K + (GREEN_FROM + GREEN_SPAN - RED_K) * Math.max(0, Math.min(1, (free || 0) / HANDS_FULL));

/* ---- THE ONE STAMPED LABEL ----------------------------------------------------------------
   "INSTRUMENTS: BUILD FARM". The only advice in the game. It never explains itself. */
export const ADVICE_PREFIX = 'INSTRUMENTS: ';
const ROOM_UP = { mine: 'MINE', farm: 'FARM', generator: 'GENERATOR', dorm: 'DORMITORY' };
const ROOMS_UP = { mine: 'MINES', farm: 'FARMS', generator: 'GENERATORS', dorm: 'DORMITORIES' };
export const ADVICE = {
    build: (t) => `BUILD ${ROOM_UP[t]}`,
    automate: (t) => `AUTOMATE ${ROOMS_UP[t]}`,
    dig: 'DIG',
    vats: 'BUILD CULTURE VATS',
    graft: 'GRAFT A ROOM',
    question: 'THE QUESTION',
    feed: 'FEED THE MACHINE',
    longer: 'LONGER SLEEP',
    sleep: 'SLEEP',
    wait: 'WAIT',
    // deep-econ (B332): the next goal is always named, with what it waits for
    buy: (name) => `BUY ${name}`,
    save: (name) => `SAVE FOR ${name}`,
    wake: 'WAKE',
    surfaceWaits: (tier) => `SURFACE WAITS FOR ${cryoName(tier).toUpperCase()}`,
    // deep-tension: the level-ups that queued in a sleep, bought in one click
    levels: (n) => `BUY ${n} LEVELS`,
    ready: (n) => (n === 1 ? 'A LEVEL READY' : `${n} LEVELS READY`),
};
/** The label holds a word at least this long before it may change. */
export const ADVICE_HOLD_MS = 4000;

/** A room of this type ordered or dug toward: BUILD it, or DIG for a chamber to put it in. deep-tension:
 *  only when the ore is there (the tape never names what cannot be done; it said DIG with no ore). */
function buildOrDig(state, t) {
    if (freeChambers(state) > 0) return buildPending(state, 'room', t) || (state.minerals || 0) < nextPrice(state, 'room', t) ? null : ADVICE.build(t);
    return buildPending(state, 'dig') || (state.minerals || 0) < nextPrice(state, 'dig') ? null : ADVICE.dig;
}
/** deep-tension: what an automation is called when the tape saves for it: "GENERATOR AUTOMATION". */
const AUTO_NAME = { mine: 'MINE AUTOMATION', farm: 'FARM AUTOMATION', generator: 'GENERATOR AUTOMATION', dorm: 'DORMITORY AUTOMATION' };

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
            if (t && !((state.auto[t] || 0) > 0) && !buildPending(state, 'auto', t) && (state.stars || 0) >= nextPrice(state, 'auto', t)) return ADVICE.automate(t);
            const w = buildOrDig(state, 'dorm');
            if (w) return w;
        } else {
            const w = buildOrDig(state, ROOM_FOR_COLUMN[c]);
            if (w) return w;
        }
    }
    if ((state.humans || 0) < MIN_SLEEPERS) { const w = buildOrDig(state, 'dorm'); if (w) return w; }
    // deep-grow2: Surface gave a graft, and it waits for a room
    if (state.graft && state.graft.owed > 0 && !state.grow) return ADVICE.graft;
    // 2. the lever is there: the goal
    if (state.cryo < 0 && lever) return ADVICE.sleep;
    // deep-tension: after the hall, something NEW that can be paid (what the colony woke for) comes before
    // the ore's DIG and BUILD (it woke for the culture vats and the tape said DIG)
    if (state.cryo >= 0 && !state.grow) {
        const g0 = goalOf(state, { road, onlyNew: true });
        if (g0 && g0.gap <= 0 && canBuy(state, g0.id, { road, asleep: false }).ok) return g0.id === cryoNode(state.cryo + 1) ? ADVICE.longer : ADVICE.buy(g0.name);
    }
    // 3. ore for a room of the weakest kind, or for a chamber
    const t = ROOM_FOR_COLUMN[report.weakest] || 'mine';
    if (freeChambers(state) > 0) {
        if (!buildPending(state, 'room', t) && state.minerals >= nextPrice(state, 'room', t)) return ADVICE.build(t);
    } else if (!buildPending(state, 'dig') && state.minerals >= nextPrice(state, 'dig')) return ADVICE.dig;
    // 4. before the hall: the road to Cryo I, in order. deep-tension: an automation the stars cannot pay
    // yet is SAVED FOR (with the gap under it), never asked for
    let saveFor = null;
    if (state.cryo < 0 && road) {
        for (const item of road.items) {
            if (item.done || item.ordered) continue;
            if (item.key.startsWith('auto-')) {
                const t = item.key.slice(5);
                if ((state.stars || 0) >= nextPrice(state, 'auto', t)) return ADVICE.automate(t);
                saveFor = saveFor || ADVICE.save(AUTO_NAME[t]);
                continue;
            }
            if (item.key === 'food') { const w = buildOrDig(state, 'farm'); if (w) return w; }
            if (item.key === 'energy') { const w = buildOrDig(state, 'generator'); if (w) return w; }
            if (item.key === 'ore') { const w = buildOrDig(state, 'mine'); if (w) return w; }
        }
    }
    // deep-grow: The question is open and can be paid: answering it begins the body
    if (opened(state, 'question') && levelOf(state, 'question') < 1 && canBuy(state, 'question', { asleep: false }).ok) return ADVICE.question;
    // 5. after the hall, the first culture vats, when they can be paid: asleep nobody else is born
    if (state.cryo >= 0 && vatsLevel(state) < 1 && (state.stars || 0) >= vatsPrice(state)) return ADVICE.vats;
    // 6. the machine, when a level of feed can be paid (before the hall: only while nothing is saved for)
    if ((state.feed || 0) < FEED_MAX && (state.stars || 0) >= feedPrice(state) && !saveFor) return ADVICE.feed;
    if (saveFor) return saveFor;
    // deep-tension: before the hall with every lamp lit but the price: SAVE FOR CRYO I, the gap under it
    if (state.cryo < 0 && road && road.items.every((x) => x.done || x.key === 'stars')) return ADVICE.save('CRYO I');
    if (state.cryo >= 0) {
        // deep-econ (B332): THE NEXT GOAL, always named. Bought when it can be; else saved for (the
        // lever glows: a sleep is how stars come in); a night that waits for a tier says so
        const goal = goalOf(state, { road });
        const payable = goal && goal.gap <= 0 && canBuy(state, goal.id, { road, asleep: false }).ok;
        if (payable && isNewKind(state, goal.id)) return goal.id === cryoNode(state.cryo + 1) ? ADVICE.longer : ADVICE.buy(goal.name);
        // deep-tension: the levels the stars pay for, in one click
        const ready = levelsReady(state).n;
        if (ready > 1) return ADVICE.levels(ready);
        if (payable) return goal.id === cryoNode(state.cryo + 1) ? ADVICE.longer : ADVICE.buy(goal.name);
        const wait = nightNext(state, { asleep: false });
        if (wait && wait.kind === 'tier') return ADVICE.surfaceWaits(wait.tier);
        if (goal) return ADVICE.save(goal.name);
        // the colony can sleep safely: sleep
        if (lever && !sleepTrouble(state, CRYO[Math.min(CRYO.length - 1, state.cryo)].days, 1500)) return ADVICE.sleep;
    }
    return ADVICE.wait;
}

/* ---- THE NEXT GOAL (deep-econ, B332) ---------------------------------------------------------
   Ola on v1.78.0: "They have slept for 1 000 000 years. The last 600 000 nothing has happened. What
   is the user expected to do?" The instruments always name the next goal and what it waits for:
   "INSTRUMENTS: SAVE FOR CRYO VI" with "★ 2e17 to go" under it. The goal, in order: The question
   once Surface has opened it; a gift Surface opened and nobody bought; else the cheapest thing that
   waits for stars: a level, an automation, the feed, the vats, or the next cryo tier once only its
   price stands in the way. */
/** A level this much cheaper than the next tier comes before it (goalOf). */
export const TIER_OVER = 1.5;
/** What the drawer and the tape call a node: "CRYO VI", "SEAM", "DRILL AUTO", "FEED THE MACHINE". */
export function rowName(n) {
    if (n.kind === 'cryo') return `CRYO ${n.name}`;
    return n.name.replace(/\n/g, ' ').replace('AUTOMATION', 'AUTO').replace('THE MACHINE: FEED', 'FEED THE MACHINE');
}
/**
 * @param {object} state
 * @param {object} [ctx]
 * @param {object|null} [ctx.road] - readout.js cryoRoad for the next tier: the tier is a candidate once
 *        only its price is left
 * @param {boolean} [ctx.cryoReady] - overrides the road's verdict on the tier itself
 * @returns {{id:string, name:string, price:number, gap:number}|null} null before the hall, in the body,
 *          or when nothing is left to buy with stars
 */
export function goalOf(state, { road = null, cryoReady, onlyNew = false } = {}) {
    if (!((state.cryo ?? -1) >= 0) || state.grow) return null;
    const stars = state.stars || 0;
    const of = (id) => {
        const p = priceOf(state, id);
        if (!p || !(p.stars > 0) || !Number.isFinite(p.stars)) return null;
        return { id, name: rowName(NODE_BY_ID[id]), price: p.stars, gap: Math.max(0, p.stars - stars) };
    };
    const open = (id) => opened(state, id) && levelOf(state, id) < 1;
    if (open('question')) return of('question');
    for (const n of NODES) {
        if (n.kind !== 'surface' || n.id === 'question' || !open(n.id)) continue;
        const can = canBuy(state, n.id, { asleep: false });
        if (can.ok || can.kind === 'afford') return of(n.id);
    }
    // the cheapest of what stars buy: the levels, automations, the feed, the vats, and the next cryo
    // tier once nothing but its price stands in the way (deep.js PRICE_BAND puts a tier above a cheap level)
    // the first culture vats before anything else: asleep, nobody else is born (advise() says so too)
    if (vatsLevel(state) < 1) return of('vats');
    const tier = state.cryo + 1;
    const ready = tier <= CRYO_TOP && (cryoReady !== undefined ? cryoReady
        : !!road && road.items.every((x) => x.done || x.key === 'stars'));
    // a night that waits for a deeper sleep: that tier, once only its price stands in the way
    const wait = nightNext(state, { asleep: false });
    if (wait && wait.kind === 'tier' && wait.tier === tier && ready) return of(cryoNode(tier));
    let best = null;
    for (const n of NODES) {
        if (!['level', 'auto', 'feed', 'vats'].includes(n.kind) || !nodeVisible(state, n.id)) continue;
        // deep-tension: asleep the tape wakes only for something new, never the next level of the same
        if (onlyNew && !isNewKind(state, n.id)) continue;
        const can = canBuy(state, n.id, { asleep: false });
        if (!can.ok && can.kind !== 'afford') continue;
        const g = of(n.id);
        if (g && (!best || g.price < best.price)) best = g;
    }
    // the next tier is the goal once only its price stands in the way, unless something costs less than
    // TIER_OVER of it (a few cheap levels first, then the deeper sleep)
    const c = ready ? of(cryoNode(tier)) : null;
    if (c && (!best || best.price * TIER_OVER >= c.price)) best = c;
    return best;
}

/**
 * The small line under the tape (B332): "★ 2e17 to go" under SAVE FOR, why under WAKE.
 * @param {object} state
 * @param {string} word - the advice, without the prefix
 * @param {object} [ctx] - goalOf's
 */
export function adviceNote(state, word, ctx = {}) {
    if (!word) return '';
    if (word.startsWith('SAVE FOR ')) {
        // deep-tension: before the hall, an automation or Cryo I's price
        const name = word.slice('SAVE FOR '.length);
        const t = Object.keys(AUTO_NAME).find((k) => AUTO_NAME[k] === name);
        const before = t ? nextPrice(state, 'auto', t) : name === 'CRYO I' && (state.cryo ?? -1) < 0 ? priceOf(state, cryoNode(0))?.stars : null;
        if (before) { const gap = before - (state.stars || 0); return gap > 0 ? `★ ${short(gap)} to go` : ''; }
        const goal = [goalOf(state, ctx), goalOf(state, { ...ctx, onlyNew: true })].find((g) => g && word === ADVICE.save(g.name));
        const ready = state.asleep ? levelsReady(state).n : 0;
        const parts = [goal && goal.gap > 0 ? `★ ${short(goal.gap)} to go` : '', ready > 1 ? `${ready} levels ready` : ''].filter(Boolean);
        return parts.join(' · ');
    }
    if (word.startsWith('SURFACE WAITS FOR ')) {
        const wait = nightNext(state, { asleep: !!state.asleep });
        const p = wait && wait.kind === 'tier' ? priceOf(state, cryoNode(wait.tier)) : null;
        const gap = p && p.stars ? p.stars - (state.stars || 0) : 0;
        return gap > 0 ? `★ ${short(gap)} to go` : '';
    }
    if (word === ADVICE.wake) {
        if (sleepFull(state)) return 'The store is full.';
        const goal = goalOf(state, { ...ctx, onlyNew: true });
        return goal ? `${displayName(goal.id)} can be bought.` : '';
    }
    return '';
}

/**
 * The instruments asleep (B332): the night's things that can be bought (the machine's feed, a gift);
 * WAKE when the store is full or the goal can be paid; else the goal saved for. Never silent.
 * @param {object} state
 * @param {object} [ctx] - goalOf's
 */
export function adviseAsleep(state, ctx = {}) {
    if (!state.asleep || (state.watcher && state.watcher.gone) || state.grow) return '';
    // deep-tension: the feed's first level only; every level after it is a next level of the same, and
    // waits in the levels bundle (asleep the tape said FEED THE MACHINE every few seconds)
    if ((state.feed || 0) < FEED_MAX && canBuy(state, 'feed', { asleep: true }).ok && isNewKind(state, 'feed')) return ADVICE.feed;
    if (sleepFull(state)) return ADVICE.wake;
    // deep-tension: WAKE only for something new (a tier, a gift, a first level); the next level of the
    // same waits for the wake, where it is bought with the others in one click
    const goal = goalOf(state, { ...ctx, onlyNew: true });
    if (goal && goal.gap <= 0) {
        // a gift is bought in the night too
        if (NODE_BY_ID[goal.id].kind === 'surface' && canBuy(state, goal.id, { asleep: true }).ok) return ADVICE.buy(goal.name);
        return ADVICE.wake;
    }
    const wait = nightNext(state, { asleep: true });
    if (wait && wait.kind === 'tier') return ADVICE.surfaceWaits(wait.tier);
    if (goal) return ADVICE.save(goal.name);
    // nothing new left: the next level of the same, saved for, or the levels the wake will buy
    const any = goalOf(state, ctx);
    if (any && any.gap > 0) return ADVICE.save(any.name);
    const ready = levelsReady(state).n;
    return ready > 0 ? ADVICE.ready(ready) : '';
}
/** deep-tension: is this purchase a NEW kind of thing (worth waking for): a cryo tier, a gift, The
 *  question, or the first level of a level, an automation, the feed or the vats? */
export function isNewKind(state, id) {
    const n = NODE_BY_ID[id];
    if (!n) return false;
    if (n.kind === 'cryo' || n.kind === 'surface' || id === 'question') return true;
    return levelOf(state, id) + orderedOf(state, id) === 0;
}
/**
 * deep-tension: THE LEVELS READY. Every next level of something already owned (levels, automations,
 * the feed) the stars pay for, cheapest first, as a careful hand would buy them one after another.
 * Bought in one click on waking ("BUY 4 LEVELS"). Null before the hall and in the body.
 * @returns {{n:number, ids:string[], price:number}}
 */
export function levelsReady(state) {
    const none = { n: 0, ids: [], price: 0 };
    if (!((state.cryo ?? -1) >= 0) || state.grow) return none;
    const c = JSON.parse(JSON.stringify(state));
    c.asleep = false;
    const ids = [];
    let price = 0;
    for (let k = 0; k < 24; k++) {
        let best = null;
        for (const n of NODES) {
            if (!['level', 'auto', 'feed'].includes(n.kind) || !nodeVisible(c, n.id) || isNewKind(c, n.id)) continue;
            if (!canBuy(c, n.id, { asleep: false }).ok) continue;
            const p = priceOf(c, n.id)?.stars;
            // the same price: the one bought fewer times in this bundle first ("SEAM ×2" left YIELD out)
            const k = p * (1 + 0.02 * ids.filter((x) => x === n.id).length);
            if (p > 0 && (!best || k < best.k)) best = { id: n.id, p, k };
        }
        if (!best || !treeBuyFor(c, best.id)) break;
        ids.push(best.id);
        price += best.p;
    }
    return { n: ids.length, ids, price };
}

/* ---- THE LAMPS OF CRYO --------------------------------------------------------------------
   Cryo I's own road (readout.js cryoRoad), item for item: every room a crew runs must be
   automated, and a dry run of the sleep must meet no shortage of ore, power or food. Each of the
   first three lamps holds the items of one store; lit when all of them are done. deep-fix2: the
   price is the fourth lamp (Ola: "They are lit, but it ALSO needs 15 k stars. It didn't say."), its
   tape the price in stars, dim until the stars are there. The lever appears when tree.js says Cryo I
   can be bought, which is never before all four are lit. */
export const LAMPS = [
    { key: 'food', label: 'FOOD RUNS ITSELF', items: ['auto-farm', 'food'] },
    { key: 'power', label: 'POWER RUNS ITSELF', items: ['auto-generator', 'energy'] },
    { key: 'ore', label: 'ORE RUNS ITSELF', items: ['auto-mine', 'ore'] },
];
/**
 * @param {object|null} road - cryoRoad(0, state)
 * @param {number} [price] - Cryo I's price in stars: the fourth lamp's tape
 * @returns {{key:string, label:string, lit:boolean, ordered:boolean, price?:boolean}[]}
 */
export function cryoLamps(road, price = CRYO[0].cost, stars = null) {
    const items = (road && road.items) || [];
    const lamps = LAMPS.map((L) => {
        const mine = items.filter((x) => L.items.includes(x.key));
        const open = mine.filter((x) => !x.done);
        return { key: L.key, label: L.label, lit: open.length === 0, ordered: open.length > 0 && open.every((x) => x.ordered) };
    });
    const paid = items.find((x) => x.key === 'stars');
    // deep-tension: once the three are lit, the price lamp says what is left to go
    const gap = Number.isFinite(stars) && lamps.every((L) => L.lit) ? price - stars : 0;
    const label = gap > 0 ? `★ ${short(gap)} to go` : `★ ${short(price)}`;
    lamps.push({ key: 'price', label, lit: !!paid && paid.done, ordered: false, price: true });
    return lamps;
}

/* ---- THE ONE WAKE LAMP -------------------------------------------------------------------
   What woke the colony, in one word on the tape. The sentence stays in the save's log. */
export const WAKE_WORDS = ['FOOD', 'POWER', 'FAULT', 'VOICE', 'AWAKE'];
/** deep-tension: a FAULT says its cause on the lamp ("FAULT: GENERATOR"): Ola woke to a FAULT with
 *  nothing to fix. */
const FAULT_CAUSE = { mine: 'MINE', farm: 'FARM', generator: 'GENERATOR', dorm: 'DORMITORY' };
export const faultWord = (cause) => (cause ? `FAULT: ${cause}` : 'FAULT');
/**
 * @param {object} alarm - what woke the colony
 * @returns {string} one of WAKE_WORDS, a FAULT with its cause after a colon
 */
export function wakeWord(alarm) {
    const a = alarm || {};
    switch (a.kind) {
    case 'food': return 'FOOD';
    case 'energy': return 'POWER';
    case 'stall': return a.why === 'fuel' ? 'POWER' : faultWord(FAULT_CAUSE[a.type] || '');
    case 'few': return faultWord('TOO FEW PEOPLE');
    case 'scouts': return faultWord('SCOUTS');
    case 'reboot': return a.voice ? 'VOICE' : faultWord('THE MIND RESTARTED');
    default: return a.rebooted ? faultWord('THE MIND RESTARTED') : 'AWAKE';
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
/** Not in the drawer: nothing by name. deep-grow: The question is in the drawer once Surface has
 *  opened it (buying it begins movement III); the old biological steps are retired (tree.js). */
const LEFT_OUT = new Set([]);

/** deep-tension: ONE line per automation, the same before and after a purchase (it read three ways). */
const AUTO_WORDS = {
    mine: 'Mines run themselves, dig more.',
    farm: 'Farms run themselves, grow more.',
    generator: 'Generators run themselves, make more.',
    dorm: 'Machines raise the children.',
};
const DOES = {
    seam: 'Mines dig twice as much.',
    yield: 'Farms grow twice as much.',
    output: 'Generators make twice the power.',
    beds: 'Dormitories sleep twice as many.',
    feed: 'The machine plays more games.',
    lossless: 'Automated rooms make three times more and cost less to run.',
    quiet: 'Automated rooms cost almost nothing.',
    cold: 'Sleepers eat nothing at all.',
    longcount: 'A second sleeps a million years.',
    // deep-grow2: what the question does, three short lines (the drawer draws each on its own line)
    question: 'The body takes the colony, room by room.\nIt eats people. It grows them in vats.\nIt is the only way up.',
    watchdog: 'The mind drifts more slowly.',
    scheduler: 'Building goes on in sleep.',
    deepread: 'A click steadies it more.',
    nightvision: 'Alarms let them sleep longer.',
    cooling: 'Holds twice the capacity.',
    secondcore: 'The lamps steady it more.',
    mast: 'Sees further up the shaft.',
    reactor: 'Capacity fills three times faster.',
    vats: 'Grows people while the colony sleeps.',
};
const RATE_SHORT = { 30: 'a month', 365: 'a year', 3650: 'ten years', 36500: 'a century', 365000: 'a millennium', 3650000: 'ten millennia', 36500000: 'a hundred millennia' };

/** What a node does, in about five words. */
export function drawerDoes(state, id) {
    const n = NODE_BY_ID[id];
    if (!n) return '';
    if (n.kind === 'auto') return AUTO_WORDS[n.type];
    if (n.kind === 'cryo') return n.tier === 0 ? 'A hall to sleep in.' : `A second sleeps ${RATE_SHORT[CRYO[n.tier].days] || 'longer'}.`;
    return DOES[id] || '';
}
/** The price on a row: "★ 4.4 k", "★ 20 k + 20 capacity", ore always with its sign (readout.js ORE_SIGN). */
export function drawerPrice(price) {
    if (!price) return '';
    const parts = [];
    if (price.stars) parts.push(`★ ${short(price.stars)}`);
    if (price.cap) parts.push(`${short(price.cap)} capacity`);
    if (price.ore) parts.push(`${ORE_SIGN} ${short(price.ore)}`);
    if (price.beds) parts.push(price.beds === 1 ? 'a dormitory' : `${price.beds} dormitories`);
    // deep-tension: a short line that wraps between its parts (it ran out of the drawer)
    return parts.join(' · ');
}
/**
 * What a locked row needs, in a few plain words. deep-econ (B334): Ola, "Why can't I buy Cryo?" The
 * row read "Needs generators automated ✓, farms automated ✓, mines automated ✓ and ★ 3e17." with
 * ★ 9.8e16 in hand, and never said the gap. A row with a price now says the gap on a line of its own,
 * "You need ★ 2e17 more.", under the ticks of whatever else it needs.
 */
export function drawerNeed(state, id, ctx = {}) {
    const n = NODE_BY_ID[id];
    if (n.kind === 'cryo' && n.tier === 0) return 'Needs all four lamps lit.';
    const can = canBuy(state, id, ctx);
    if (n.kind === 'cryo' && (can.kind === 'gate' || can.kind === 'afford')) {
        const road = ctx.road && n.tier === (state.cryo ?? -1) + 1 ? ctx.road : cryoRoad(n.tier, state);
        const rest = road ? road.items.filter((x) => x.key !== 'stars') : [];
        const lines = [];
        if (rest.length) lines.push(`Needs ${list(rest.map((x) => `${x.text}${x.done ? ' ✓' : x.ordered ? ' (on order)' : ''}`))}.`);
        const gap = gapLine(state, id);
        if (gap) lines.push(gap);
        if (lines.length) return lines.join('\n');
    }
    return stateLine(state, id, ctx).text;
}
/** "You need ★ 2e17 more." for a node whose price in stars is not in hand, else ''. */
export function gapLine(state, id) {
    const p = priceOf(state, id);
    const gap = p && p.stars ? p.stars - (state.stars || 0) : 0;
    return gap > 0 ? `You need ★ ${short(gap)} more.` : '';
}
/** A night's line said again on the wake after the sleep it came in, this long (B335). */
export const RECALL_MS = 6000;
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
            if (asleep && (n.kind === 'level' || n.kind === 'auto' || n.kind === 'cryo' || n.kind === 'vats')) continue;
            const can = canBuy(state, n.id, { ...ctx, asleep });
            const prog = (n.kind === 'level' || n.kind === 'auto') ? orderProgress(state, n) : -1;
            const row = {
                id: n.id, name: rowName(n),
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
    // deep-tension: the levels the stars pay for, one row, one click, awake
    if (!asleep) {
        const ready = levelsReady(state);
        if (ready.n > 1) {
            const names = {};
            for (const id of ready.ids) { const nm = rowName(NODE_BY_ID[id]); names[nm] = (names[nm] || 0) + 1; }
            groups.unshift({ name: 'READY', rows: [{
                id: LEVELS_ROW, name: `${ready.n} LEVELS`, does: Object.entries(names).map(([k, v]) => (v > 1 ? `${k} ×${v}` : k)).join(', '),
                price: `★ ${short(ready.price)}`, status: 'buy', need: '', progress: -1,
            }] });
        }
    }
    // deep-grow: The question stands off the root on no branch; once Surface has opened it, it is the
    // drawer's first row (it was only in the whole tree, and Ola asked "When does Body begin?")
    if (opened(state, 'question') && levelOf(state, 'question') < 1) {
        const can = canBuy(state, 'question', { ...ctx, asleep });
        const row = {
            id: 'question', name: 'THE QUESTION', does: drawerDoes(state, 'question'),
            price: drawerPrice(priceOf(state, 'question')), status: can.ok ? 'buy' : 'next', need: can.ok ? '' : drawerNeed(state, 'question', { ...ctx, asleep }), progress: -1,
        };
        groups.unshift({ name: 'THE QUESTION', rows: [row] });
    }
    return groups;
}
/** deep-tension: the drawer row that buys every level ready (index.js buys levelsReady's ids in turn). */
export const LEVELS_ROW = 'levels-ready';
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
/** After the card fades it is gone this long later (the fade's own time). */
export const RPS_GONE_MS = RPS_FADE_MS + 600;
/**
 * deep-fix2: is Surface's card (and its line) gone from the screen? Only once a game has been
 * played AND its result shown RPS_GONE_MS ago. While the fists shake and turn the game is under way
 * (`playing`), never gone: before this the card vanished at the throw, came back at the result, and
 * the night's line typed itself a second time. A game played before a reload is gone at once.
 * @param {{result:boolean, playing:boolean, doneAt:number, now:number}} o
 * @returns {boolean}
 */
export function cardGone({ result, playing, doneAt, now }) {
    if (!result || playing) return false;
    if (!doneAt) return true;
    return now - doneAt >= RPS_GONE_MS;
}
