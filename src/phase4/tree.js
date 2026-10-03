/**
 * Chapter IV · THE DEEP: the skill tree, mechanical state (step 1 of
 * docs/superpowers/specs/2026-10-02-chapter-iv-tree-and-bio.md). Pure: no DOM, no timers.
 *
 * The tree is a LENS over rules that already exist. Every node reads its level off the colony's
 * own state (a room type's level and automation, the cryo tier, the Watcher's ladder) and buying
 * one does exactly what the old buttons did: a level or an automation is an ORDER in the build
 * queue, a cryo tier is paid at once, a Watcher step goes through watcher.js's buyStep. So no
 * number in the game moves because the buttons moved into a tree. The save holds no second copy
 * of a level (`state.tree` only keeps what Surface has opened, for step 2).
 *
 * Kinds of node:
 *   root     THE COLONY, always there.
 *   level    a room type's level (Seam, Yield, Output, Beds): many levels, one order a click.
 *   auto     a room type's automation (Drill, Farm, Generator automation, Creche): four levels.
 *   cryo     Cryo I to VII, a chain of single nodes, gated as the cryo buttons were.
 *   watcher  the Watcher's SYSTEM and HARDWARE steps, bought asleep with capacity and stars.
 *   bio      the four biological steps, kept as they work today (a sector is chosen) until the
 *            biological step of the design is built.
 *   surface  greyed, with a hollow ring: only Surface opens them. Since deep-voice (step 2) a
 *            night of Surface's script opens one (`state.tree.opened`): the ring fills, it has a
 *            price in stars, and once bought (`state.tree.bought`) it is a rule in deep.js.
 *   feed     The machine: feed (deep-machine, step 3): each level raises the share of the spare
 *            energy the machine may draw (deep.js feedShare), paid in stars at once, awake or asleep.
 *            Kept in `state.feed`.
 *   teaser   a node of the design with no rule behind it yet (Deep seam, Hydroponics, Hands).
 *            Shown locked; never buyable until a later step gives it a rule.
 *
 * Positions are on the mockup's board (docs/mockups/deep-tree-10.html, tab "early"): 1000 x 730
 * units, square nodes of 36, traces at right angles.
 */

import {
    CRYO, CRYO_TOP, MAX_AUTO, QUEUE_MAX, cryoName, nextPrice, orderBuild, buildPending, ordered,
    tickDay, sleepTrouble, ordersDone, gift, FEED_MAX, feedCost, feedShare, ROOMS, BIRTH_FOOD,
    FOOD_ALARM_DAYS, NIGHT_VISION_LATE, scoutOdds, isQueued, MIN_SLEEPERS, buildEta,
} from './deep.js';
import { NIGHTS, nightsSaid, visitDue } from './surface.js';
import {
    LADDER, has as watcherHas, nextStep, stepNeed, buyStep, peopleFor, firstSleep,
    DRIFT_PER_SECOND, driftFactor, snapGain, capacityMax, capacityGain, puzzleGain, CAPACITY_PER_SECOND,
} from './watcher.js';
import { affordText, cryoNeed, cryoRoad, rateWords, short, span, list } from './readout.js';
import { ROOM_WORD, ROOM_WORDS } from './advisor.js';

export const BOARD = { w: 1000, h: 730 };
export const NODE = 36;
export const ROOT_SIZE = 72;
/** The ladder of levels has no top in the rules; the tree draws this many pips. The simulated
 *  run buys up to 18 levels of a room type, so 20 changes nothing (the design said 10). */
export const LEVEL_MAX = 20;

/** The branches, in the order the tags are drawn. */
export const BRANCHES = ['EXTRACTION', 'CULTURE', 'POWER', 'HABITAT', 'CRYO', 'WATCHER', 'BIOLOGICAL'];
/** Where each branch's tag sits on the board: [x, y, anchor]. */
export const TAGS = {
    EXTRACTION: [470, 24, 'middle'],
    HABITAT: [104, 199, 'end'],
    CULTURE: [104, 434, 'end'],
    POWER: [882, 374, 'start'],
    CRYO: [264, 562, 'middle'],
    WATCHER: [588, 208, 'end'],
    BIOLOGICAL: [588, 49, 'end'],
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Every node. `parent` draws the trace (and is the prerequisite for the chains); `path` is the
 * trace's corners when it is not a straight line from the parent. `lab`: where the name goes
 * ('l' left, 't' top, below otherwise).
 */
export const NODES = [
    { id: 'root', branch: null, x: 500, y: 370, kind: 'root', name: 'THE COLONY', max: 1, does: 'Everything grows from here.' },

    // EXTRACTION
    { id: 'seam', branch: 'EXTRACTION', x: 470, y: 255, lab: 'l', kind: 'level', type: 'mine', name: 'SEAM', max: LEVEL_MAX,
        parent: 'root', path: [[470, 370], [470, 255]] },
    { id: 'drill', branch: 'EXTRACTION', x: 470, y: 160, lab: 'l', kind: 'auto', type: 'mine', name: 'DRILL\nAUTOMATION', max: MAX_AUTO, parent: 'seam' },
    { id: 'deepseam', branch: 'EXTRACTION', x: 470, y: 65, lab: 'l', kind: 'teaser', name: 'DEEP SEAM', max: 1, parent: 'drill',
        does: "The mines on the next floor run richer." },

    // CULTURE
    { id: 'yield', branch: 'CULTURE', x: 360, y: 430, kind: 'level', type: 'farm', name: 'YIELD', max: LEVEL_MAX,
        parent: 'root', path: [[500, 385], [440, 385], [440, 430], [360, 430]] },
    { id: 'farmauto', branch: 'CULTURE', x: 250, y: 430, kind: 'auto', type: 'farm', name: 'FARM\nAUTOMATION', max: MAX_AUTO, parent: 'yield' },
    { id: 'hydro', branch: 'CULTURE', x: 140, y: 430, kind: 'teaser', name: 'HYDROPONICS', max: 1, parent: 'farmauto',
        does: 'Food grows on any floor.' },

    // POWER
    { id: 'output', branch: 'POWER', x: 610, y: 370, kind: 'level', type: 'generator', name: 'OUTPUT', max: LEVEL_MAX, parent: 'root' },
    { id: 'genauto', branch: 'POWER', x: 720, y: 370, kind: 'auto', type: 'generator', name: 'GENERATOR\nAUTOMATION', max: MAX_AUTO, parent: 'output' },
    { id: 'feed', branch: 'POWER', x: 830, y: 370, kind: 'feed', name: 'THE MACHINE:\nFEED', max: FEED_MAX, parent: 'genauto' },
    { id: 'lossless', branch: 'POWER', x: 720, y: 480, kind: 'surface', name: 'LOSSLESS\nRELAY', max: 1, parent: 'genauto',
        does: 'Automated rooms make three times as much.' },

    // HABITAT
    { id: 'beds', branch: 'HABITAT', x: 360, y: 195, kind: 'level', type: 'dorm', name: 'BEDS', max: LEVEL_MAX,
        parent: 'root', path: [[500, 355], [420, 355], [420, 195], [360, 195]] },
    { id: 'creche', branch: 'HABITAT', x: 250, y: 195, kind: 'auto', type: 'dorm', name: 'CRECHE', max: MAX_AUTO, parent: 'beds' },
    { id: 'hands', branch: 'HABITAT', x: 140, y: 195, kind: 'teaser', name: 'HANDS', max: 6, parent: 'creche',
        does: 'What a pair of hands is worth.' },
    { id: 'quiet', branch: 'HABITAT', x: 140, y: 90, lab: 't', kind: 'surface', name: 'QUIET\nHANDS', max: 1, parent: 'hands',
        does: 'Automated rooms cost no more to run than a bare room.' },

    // CRYO: a chain, root to VII, right to left
    ...ROMAN.map((r, i) => ({
        id: `cryo-${r.toLowerCase()}`, branch: 'CRYO', x: 450 - 62 * i, y: 590, kind: 'cryo', tier: i, name: r, max: 1,
        parent: i === 0 ? 'root' : `cryo-${ROMAN[i - 1].toLowerCase()}`,
        path: i === 0 ? [[485, 370], [485, 590], [450, 590]] : undefined,
    })),
    { id: 'cold', branch: 'CRYO', x: 326, y: 680, kind: 'surface', name: 'COLD\nSTORAGE', max: 1, parent: 'cryo-iii',
        does: 'Sleepers eat nothing.' },
    { id: 'longcount', branch: 'CRYO', x: 78, y: 680, kind: 'surface', name: 'LONG\nCOUNT', max: 1, parent: 'cryo-vii',
        does: 'A sleep longer than Cryo VII.' },

    // the question, straight off the root
    { id: 'question', branch: null, x: 610, y: 540, kind: 'surface', name: 'THE QUESTION', max: 1,
        parent: 'root', path: [[515, 370], [515, 540], [610, 540]], does: 'Opens the BIOLOGICAL branch.' },

    // WATCHER: the ladder as it is bought, SYSTEM along the lower row, HARDWARE back along the upper
    { id: 'watchdog', branch: 'WATCHER', x: 620, y: 250, kind: 'watcher', step: 'watchdog', name: 'WATCHDOG', max: 1,
        parent: 'root', path: [[530, 370], [530, 250], [620, 250]] },
    { id: 'scheduler', branch: 'WATCHER', x: 730, y: 250, kind: 'watcher', step: 'scheduler', name: 'SCHEDULER', max: 1, parent: 'watchdog' },
    { id: 'deepread', branch: 'WATCHER', x: 840, y: 250, kind: 'watcher', step: 'deepread', name: 'DEEP READ', max: 1, parent: 'scheduler' },
    { id: 'nightvision', branch: 'WATCHER', x: 950, y: 250, kind: 'watcher', step: 'nightvision', name: 'NIGHT\nVISION', max: 1, parent: 'deepread' },
    { id: 'cooling', branch: 'WATCHER', x: 950, y: 145, kind: 'watcher', step: 'cooling', name: 'COOLING', max: 1, parent: 'nightvision' },
    { id: 'secondcore', branch: 'WATCHER', x: 840, y: 145, kind: 'watcher', step: 'secondcore', name: 'SECOND\nCORE', max: 1, parent: 'cooling' },
    { id: 'mast', branch: 'WATCHER', x: 730, y: 145, kind: 'watcher', step: 'mast', name: 'SENSOR\nMAST', max: 1, parent: 'secondcore' },
    { id: 'reactor', branch: 'WATCHER', x: 620, y: 145, kind: 'watcher', step: 'reactor', name: 'REACTOR\nTAP', max: 1, parent: 'mast' },

    // BIOLOGICAL, for now a plain branch after the Watcher: the four steps as they work today
    { id: 'brain', branch: 'BIOLOGICAL', x: 620, y: 45, kind: 'bio', step: 'brain', name: 'BRAIN\nTISSUE', max: 1, parent: 'reactor' },
    { id: 'nervous', branch: 'BIOLOGICAL', x: 730, y: 45, kind: 'bio', step: 'nervous', name: 'NERVOUS\nSYSTEM', max: 1, parent: 'brain' },
    { id: 'spinal', branch: 'BIOLOGICAL', x: 840, y: 45, kind: 'bio', step: 'spinal', name: 'SPINAL\nFLUID', max: 1, parent: 'nervous' },
    { id: 'skin', branch: 'BIOLOGICAL', x: 950, y: 45, kind: 'bio', step: 'skin', name: 'SKIN\nRECEPTORS', max: 1, parent: 'spinal' },
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
/** The node that sells a level or an automation of a room type: LEVEL_NODE.mine is 'seam'. */
export const LEVEL_NODE = { mine: 'seam', farm: 'yield', generator: 'output', dorm: 'beds' };
export const AUTO_NODE = { mine: 'drill', farm: 'farmauto', generator: 'genauto', dorm: 'creche' };
/** The node of a cryo tier (0 is Cryo I, the hall; the tier past VII is Surface's Long count). */
export const cryoNode = (tier) => (tier > CRYO_TOP ? 'longcount' : `cryo-${(ROMAN[tier] || '').toLowerCase()}`);

/**
 * SURFACE'S GIFTS (deep-voice). The price of each in stars, set so that it is about a minute of
 * play at the point Surface opens it (the night's tier, scripts/sim-phase4.mjs): the stars a day
 * there, times sixty. Long count is the tier past Cryo VII and costs what one more tier would.
 */
export const GIFT_PRICE = {
    lossless: 1.0e8,
    cold: 1.0e10,
    quiet: 5.0e15,
    longcount: CRYO[CRYO_TOP + 1].cost,
    question: 1.0e17,
};
/** What a gift needs besides its price: Long count stands on Cryo VII. */
const GIFT_NEEDS = { longcount: CRYO_TOP };
/** Has Surface opened this node? */
export const opened = (state, id) => !!(state.tree && Array.isArray(state.tree.opened) && state.tree.opened.includes(id));
/** The line that opened a node, or ''. */
export const quoteOf = (id) => NIGHTS.find((x) => x.gives === id)?.line || '';
/** The night log: every line Surface has said, in order, and the node each one ties to. */
export const nightLog = (state) => nightsSaid(state.watcher && state.watcher.surface);
/** BIOLOGICAL is open once The question is bought; a colony that already owns a biological step
 *  (a save from before deep-voice) keeps it open. */
export function bioOpen(state) {
    if (gift(state, 'question')) return true;
    const w = state.watcher;
    return !!(w && ((w.bought || []).some((id) => LADDER.some((u) => u.id === id && u.rung === 2)) || w.sealing));
}

/* ---- WHAT THE NEXT NIGHT WAITS FOR (deep-night, step 3b) ------------------------------------
   Ola on v1.61.0: "it is hard to tell whether things are unfinished, or just hard to play, or must
   be played longer". The night log ends with one line that says, in plain words, what the next
   night waits for; the same line is said once on a wake that brought no night. And under the
   Watcher one quiet line says where the sleep world stands. */
/** The biological steps, in all, and how many of them the body has taken. */
export const BODY_STEPS = LADDER.filter((u) => u.rung === 2).length;
export const bodyTaken = (w) => ((w && w.bought) || []).filter((id) => LADDER.some((u) => u.id === id && u.rung === 2)).length;
/** How far ahead nightNext() looks for Surface's next visit, in sleeps. */
const SLEEPS_AHEAD = 40;
/**
 * What the next night waits for: a cryo tier, sleeps (the visits still to come on the game's own
 * schedule, quiet ones first), the body, or nothing. Null before Surface has spoken at all: the
 * first night is not announced.
 * @param {object} state
 * @param {{asleep?:boolean}} [o] - asleep, a visit not yet come in this sleep may still come in it
 * @returns {{kind:'tier'|'sleep'|'body'|'none', text:string, tier?:number, sleeps?:number}|null}
 */
export function nightNext(state, { asleep = !!(state && state.asleep) } = {}) {
    const w = state && state.watcher;
    const sf = w && w.surface;
    const n = sf ? sf.night | 0 : 0;
    if (n < 1) return null;
    if (n >= NIGHTS.length) {
        return bioOpen(state) && bodyTaken(w) < BODY_STEPS
            ? { kind: 'body', text: 'The body comes next.' }
            : { kind: 'none', text: 'Surface has nothing more to say.' };
    }
    const next = NIGHTS[n];
    if ((state.cryo ?? -1) < next.tier) return { kind: 'tier', tier: next.tier, text: `Surface waits for ${cryoName(next.tier)}.` };
    // the visits to come, as surface.js schedules them: the quiet ones still owed, then the line
    const sim = { ...sf, visit: null };
    let owed = Math.max(0, sf.toLine | 0);
    const now = w.sleeps | 0;
    let k = asleep && !sf.visit ? 0 : 1;
    for (; k <= SLEEPS_AHEAD; k++) {
        if (!visitDue(sim, now + k)) continue;
        sim.visits += 1;
        sim.lastSleep = now + k;
        if (owed > 0) { owed -= 1; continue; }
        break;
    }
    // deep-copy: plain words, no "next:" label, and no hint at how to hurry it
    const text = k === 0 ? 'Surface comes in this sleep.'
        : k === 1 ? 'Surface comes when you sleep again.'
            : `Surface speaks again in ${k} sleeps.`;
    return { kind: 'sleep', sleeps: k, text };
}
/** May a night still come? (A wake that brought none says what it waits for, once.) */
export const nightAhead = (state) => { const x = nightNext(state); return !!x && (x.kind === 'tier' || x.kind === 'sleep'); };
/**
 * The one line under the Watcher: "night 3 of 6" while Surface's script runs, "the question is
 * open" after the sixth, then the body as it is taken. '' before the first night.
 * @param {object} state
 */
export function nightArc(state) {
    const w = state && state.watcher;
    const n = w && w.surface ? w.surface.night | 0 : 0;
    if (n < 1) return '';
    if (n < NIGHTS.length) return `night ${n} of ${NIGHTS.length}`;
    if (!bioOpen(state)) return 'the question is open';
    return `the body ${bodyTaken(w)} of ${BODY_STEPS}`;
}
/** The node of a Watcher step (its id in watcher.js's LADDER is the node's id too). */
export const STEP_NODE = Object.fromEntries(NODES.filter((n) => n.step).map((n) => [n.step, n.id]));

/** The corners of a node's trace from its parent, or [] for the root. */
export function tracePath(id) {
    const n = NODE_BY_ID[id];
    if (!n || !n.parent) return [];
    if (n.path) return n.path;
    const p = NODE_BY_ID[n.parent];
    return [[p.x, p.y], [n.x, n.y]];
}
/** The chain of nodes from the root out to this one (the root left out), for the hover. */
export function chainTo(id) {
    const out = [];
    let c = NODE_BY_ID[id];
    while (c && c.parent) { out.unshift(c.id); c = NODE_BY_ID[c.parent]; }
    return out;
}

/* ---------------------------------------------------------------- reading the colony */

/** The tree's own memory in the save: what Surface has opened (schema 6), and since schema 7 the
 *  gifts bought and whether a node was opened since the tree was last looked at (the mark). */
export const initialTree = () => ({ opened: [], bought: [], unseen: false });
export function normalizeTree(t) {
    const had = t && typeof t === 'object' ? t : {};
    const ok = (a) => (Array.isArray(a) ? [...new Set(a.filter((id) => NODE_BY_ID[id]?.kind === 'surface'))] : []);
    const open = ok(had.opened);
    return { ...initialTree(), opened: open, bought: ok(had.bought).filter((id) => open.includes(id)), unseen: !!had.unseen };
}

/**
 * A node's level, read off the rules' own state: the levels and automations BUILT (orders on the
 * books are counted apart, `orderedOf`), the cryo tier, the Watcher's ladder.
 * @param {object} state
 * @param {string} id
 * @returns {number}
 */
export function levelOf(state, id) {
    const n = NODE_BY_ID[id];
    if (!n) return 0;
    switch (n.kind) {
        case 'root': return 1;
        case 'level': return (state.level && state.level[n.type]) || 0;
        case 'auto': return (state.auto && state.auto[n.type]) || 0;
        case 'cryo': return (state.cryo ?? -1) >= n.tier ? 1 : 0;
        case 'watcher': case 'bio': return watcherHas(state.watcher, n.step) ? 1 : 0;
        case 'surface': return gift(state, id) ? 1 : 0;
        case 'feed': return Math.max(0, Math.min(FEED_MAX, Math.floor(state.feed || 0)));
        default: return 0;
    }
}
/** Orders of this node already on the books (levels and automations only). */
export function orderedOf(state, id) {
    const n = NODE_BY_ID[id];
    if (!n || (n.kind !== 'level' && n.kind !== 'auto')) return 0;
    return ordered(state, n.kind, n.type);
}
/** Every node's level, as the tree reads the colony: { seam: 3, drill: 1, 'cryo-i': 1, ... }. */
export function treeLevels(state) {
    return Object.fromEntries(NODES.map((n) => [n.id, levelOf(state, n.id)]));
}

/** The WATCHER branch shows itself once the first sleep is over (or once anything on it is bought). */
export function watcherBranchOpen(state) {
    const w = state.watcher;
    if (!w) return false;
    if ((w.bought || []).length) return true;
    if (!((w.sleeps || 0) >= 1)) return false;
    return !(state.asleep && firstSleep(w));
}
/** Is the node on the board at all? */
export function nodeVisible(state, id) {
    const n = NODE_BY_ID[id];
    if (!n) return false;
    if (n.branch === 'WATCHER') return watcherBranchOpen(state);
    // deep-voice: BIOLOGICAL grows out of The question
    if (n.branch === 'BIOLOGICAL') return watcherBranchOpen(state) && bioOpen(state);
    return true;
}

/**
 * The price of the next level of a node: { currency, stars, cap, ore, people, beds }, or null for
 * a node that has none (the root, a teaser, a node at its top).
 */
export function priceOf(state, id) {
    const n = NODE_BY_ID[id];
    if (!n) return null;
    if (n.kind === 'level' || n.kind === 'auto') {
        const p = nextPrice(state, n.kind, n.type);
        return Number.isFinite(p) ? { currency: 'stars', stars: p } : null;
    }
    if (n.kind === 'cryo') return CRYO[n.tier] ? { currency: 'stars', stars: CRYO[n.tier].cost } : null;
    if (n.kind === 'surface') return GIFT_PRICE[id] ? { currency: 'stars', stars: GIFT_PRICE[id] } : null;
    if (n.kind === 'feed') {
        const p = feedCost(levelOf(state, id));
        return Number.isFinite(p) ? { currency: 'stars', stars: p } : null;
    }
    if (n.kind === 'watcher' || n.kind === 'bio') {
        const step = LADDER.find((u) => u.id === n.step);
        if (!step) return null;
        return {
            currency: 'cap+stars', cap: step.cap, stars: step.stars, ore: step.ore || 0, beds: step.beds || 0,
            people: step.people ? peopleFor(step, state) : 0,
        };
    }
    return null;
}
/** The price as the info box writes it: "★ 4.4 k", "120 cap + ★ 1 B + 1 M ore + a dormitory". */
export function priceText(price) {
    if (!price) return '';
    const parts = [];
    if (price.cap) parts.push(`${short(price.cap)} cap`);
    if (price.stars) parts.push(`★ ${short(price.stars)}`);
    if (price.ore) parts.push(`${short(price.ore)} ore`);
    if (price.beds) parts.push(price.beds === 1 ? 'a dormitory' : `${price.beds} dormitories`);
    if (price.people) parts.push(`${short(price.people)} people`);
    return parts.join(' + ');
}

/** The next cryo tier's one reason (readout.js cryoNeed), worked out by dry runs when the caller
 *  has not already got it. The phase passes its own, which it keeps once a colony day. */
export function cryoNeedNow(state, starsPerDay = null) {
    const tier = (state.cryo ?? -1) + 1;
    if (!CRYO[tier] || tier > CRYO_TOP) return null;
    const days = CRYO[tier].days;
    const perDay = starsPerDay ?? tickDay(JSON.parse(JSON.stringify(state)), false).stars;
    // as the phase reads it: the colony as it stands, and as it will once every order is built
    const trouble = sleepTrouble(state, days);
    const planned = sleepTrouble(ordersDone(state), days);
    return cryoNeed(tier, { state, trouble, planned, starsPerDay: perDay });
}

const sentenceCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const nameOf = (id) => NODE_BY_ID[id].name.replace(/\n/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
/** "Cryo II", "Reactor tap": what a reason calls a node. */
export function displayName(id) {
    const n = NODE_BY_ID[id];
    if (!n) return '';
    if (n.kind === 'cryo') return cryoName(n.tier);
    if (n.kind === 'watcher' || n.kind === 'bio') return LADDER.find((u) => u.id === n.step)?.name || nameOf(id);
    return nameOf(id);
}

/**
 * Can the next level of this node be bought now, and if not, why, in plain words.
 * @param {object} state
 * @param {string} id
 * @param {object} [ctx]
 * @param {boolean} [ctx.asleep] - defaults to state.asleep
 * @param {object|null} [ctx.need] - the next cryo tier's cryoNeed(); computed when left out
 * @param {number} [ctx.starsPerDay] - for "affordable in"; 0 when left out
 * @param {number} [ctx.queueMax] - QUEUE_MAX; the simulation passes Infinity (it never kept the cap)
 * @returns {{ok:boolean, reason:string, kind:string}} kind: 'ok' | 'bought' | 'surface' | 'teaser'
 *          | 'prereq' | 'mode' | 'room' | 'queue' | 'gate' | 'afford' | 'choose'
 */
export function canBuy(state, id, ctx = {}) {
    const n = NODE_BY_ID[id];
    const no = (kind, reason) => ({ ok: false, reason, kind });
    if (!n || n.kind === 'root') return no('bought', '');
    if (n.kind === 'surface' && !opened(state, id)) return no('surface', 'Not ours to open.');
    if (n.kind === 'teaser') return no('teaser', 'Not open yet.');
    const asleep = ctx.asleep ?? !!state.asleep;
    const lvl = levelOf(state, id) + orderedOf(state, id);
    if (lvl >= n.max) return no('bought', '');
    if (state.watcher && state.watcher.gone) return no('mode', 'Nobody is left to build it.');
    const perDay = ctx.starsPerDay || 0;

    // Surface's gifts: bought awake or asleep, with stars, once opened (and Long count on Cryo VII)
    if (n.kind === 'surface') {
        if (GIFT_NEEDS[id] !== undefined && (state.cryo ?? -1) < GIFT_NEEDS[id]) return no('prereq', `Needs ${cryoName(GIFT_NEEDS[id])} first.`);
        const miss = affordText({ price: GIFT_PRICE[id], have: state.stars || 0, perDay });
        return miss ? no('afford', miss) : { ok: true, reason: '', kind: 'ok' };
    }

    // the machine runs itself: its feed is bought awake or asleep, with stars, at once
    if (n.kind === 'feed') {
        const miss = affordText({ price: feedCost(levelOf(state, id)), have: state.stars || 0, perDay });
        return miss ? no('afford', miss) : { ok: true, reason: '', kind: 'ok' };
    }

    if (n.kind === 'level' || n.kind === 'auto') {
        if (asleep) return no('mode', 'The colony is asleep: wake it to buy.');
        if (!((state.rooms[n.type] || 0) > 0) && !buildPending(state, 'room', n.type)) {
            return no('room', `Build a ${ROOM_WORD[n.type]} first: there is none to improve.`);
        }
        if ((state.builds || []).length >= (ctx.queueMax ?? QUEUE_MAX)) return no('queue', affordText({ blocked: 'full' }));
        const price = nextPrice(state, n.kind, n.type);
        const miss = affordText({ price, have: state.stars || 0, perDay });
        return miss ? no('afford', miss) : { ok: true, reason: '', kind: 'ok' };
    }

    if (n.kind === 'cryo') {
        const tier = n.tier;
        const now = state.cryo ?? -1;
        if (tier > now + 1) return no('prereq', `Needs ${cryoName(tier - 1)} first.`);
        if (asleep) return no('mode', 'The colony is asleep: wake it to buy.');
        const need = ctx.need !== undefined ? ctx.need : cryoNeedNow(state, ctx.starsPerDay);
        if (need) {
            if (need.kind === 'stars') return no('afford', affordText({ price: CRYO[tier].cost, have: state.stars || 0, perDay }));
            return no('gate', need.long);
        }
        if ((state.stars || 0) < CRYO[tier].cost) return no('afford', affordText({ price: CRYO[tier].cost, have: state.stars || 0, perDay }));
        return { ok: true, reason: '', kind: 'ok' };
    }

    // the Watcher's ladder and the body: in order, asleep, priced by watcher.js
    const w = state.watcher;
    if (!w || !nodeVisible(state, id)) return no('prereq', 'Something has to stay awake first.');
    const next = nextStep(w);
    if (!next || next.id !== n.step) return no('prereq', `Needs ${displayName(n.parent)} first.`);
    if (!asleep) return no('mode', 'Only while the colony sleeps.');
    const need = stepNeed(w, state);
    switch (need && need.missing) {
        case '': return { ok: true, reason: '', kind: 'ok' };
        case 'sector': return { ok: true, reason: 'Paid. Choose a sector to seal.', kind: 'choose' };
        case 'capacity': return no('afford', `Needs ${short(next.cap)} capacity: ${Math.floor(w.capacity)} now.`);
        case 'stars': return no('afford', affordText({ price: next.stars, have: state.stars || 0, perDay }));
        case 'ore': return no('afford', `Needs ${short(next.ore)} ore: ${short(state.minerals || 0)} now.`);
        case 'dorm': return no('gate', 'Needs a dormitory to spare.');
        case 'people': return no('gate', 'Needs more people: some must stay under the ice.');
        case 'growing': return no('gate', 'It is still growing.');
        default: return no('prereq', '');
    }
}

/**
 * Everything the panel draws for a node, and the info box writes.
 * @returns {{id:string, visible:boolean, status:'bought'|'buyable'|'locked'|'surface', level:number,
 *            max:number, ordered:number, price:object|null, priceText:string, reason:string,
 *            does:string, name:string}}
 */
export function nodeStatus(state, id, ctx = {}) {
    const n = NODE_BY_ID[id];
    const level = levelOf(state, id);
    const orders = orderedOf(state, id);
    const visible = nodeVisible(state, id);
    const can = canBuy(state, id, ctx);
    const isOpen = n.kind === 'surface' && opened(state, id);
    let status;
    if (n.kind === 'surface' && !isOpen) status = 'surface';
    else if (n.kind === 'root' || level >= n.max) status = 'bought';
    else if (can.ok) status = 'buyable';
    else if (can.kind === 'bought') status = 'bought';      // the last levels are on order
    else status = 'locked';
    const top = level + orders >= n.max;
    const price = top || (n.kind === 'surface' && !isOpen) || n.kind === 'teaser' || n.kind === 'root' ? null : priceOf(state, id);
    // deep-fix: the next cryo tier lists its whole road at once, a tick on each part done
    let reason = can.reason;
    if (n.kind === 'cryo' && status === 'locked' && (can.kind === 'gate' || can.kind === 'afford')) {
        const road = ctx.road !== undefined ? ctx.road : cryoRoad(n.tier, state);
        if (road && road.items.length) reason = `${cryoName(n.tier)} ${road.text}`;
    }
    return {
        id, visible, status, level, max: n.max, ordered: orders, price, priceText: priceText(price),
        reason, kind: can.kind, does: doesOf(state, id), name: n.name.replace(/\n/g, ' '),
        // deep-voice: a gift Surface has opened, and the line that opened it
        opened: isOpen, quote: isOpen ? quoteOf(id) : '',
    };
}

/** What a node does, in one sentence. deep-copy: plain words, no rung name, no numbers (the numbers
 *  are the info box's quiet fifth line, effectLine). */
export function doesOf(state, id) {
    const n = NODE_BY_ID[id];
    if (!n) return '';
    if (n.kind === 'surface' && !opened(state, id)) return '. . .';
    if (n.does) return n.does;
    if (n.kind === 'feed') return 'The machine gets a bigger share of the spare energy, and plays more.';
    if (n.kind === 'level') {
        return n.type === 'dorm' ? 'Every dormitory sleeps twice as many and costs a little more to run.'
            : `Every ${ROOM_WORD[n.type]} makes twice as much and costs a little more to run.`;
    }
    if (n.kind === 'auto') {
        const k = levelOf(state, id) + orderedOf(state, id) + 1;       // the level this click buys
        const words = ROOM_WORDS[n.type];
        if (k <= 1) return `The ${words} run without people.`;
        return k <= 3 ? `The ${words} make three times as much.` : `The ${words} make a hundred times as much.`;
    }
    if (n.kind === 'cryo') {
        return n.tier === 0 ? 'A cryo hall, where a second of sleep is a month.' : `A second of sleep becomes ${rateWords(CRYO[n.tier].days)}.`;
    }
    const step = LADDER.find((u) => u.id === n.step);
    if (!step) return '';
    if (n.kind === 'bio') return `${step.does} You choose the sector it takes.`;
    // the first time capacity shows, the node says what it is
    const first = !((state.watcher && state.watcher.bought) || []).length;
    return first ? `${step.does} ${CAPACITY_WORDS}` : step.does;
}
/** What capacity is, said once on the Watcher's nodes until the first of them is bought. */
export const CAPACITY_WORDS = 'Capacity is what the Watcher thinks with; the machines fill it while everyone sleeps.';

/* ---- BEFORE AND AFTER (deep-fix) -------------------------------------------------------------
   The overnight playtest of v1.66.0: "Gifts are bought blind." Every node's effect line now says
   what it does in numbers worked out by a dry run on a copy of the colony: the day as it is (every
   order on the books built) against the same day with this level, automation, gift or step in place.
   deep-copy: only the numbers, as the info box's quiet last line ("Ore 576 → 1.7 k a day."); what
   the node does is said once, in words, above it. Nothing here is estimated. */

/** "576 → 1 728" */
export const arrow = (a, b) => `${short(a)} → ${short(b)}`;
const dayOf = (c, asleep) => {
    const r = tickDay(c, asleep);
    const drawn = ROOMS.reduce((a, t) => a + r.draw[t], 0);
    const net = r.food - r.eaten - r.born * BIRTH_FOOD;
    return {
        ore: r.minerals, food: r.food, energy: r.energyMade, drawn, burned: r.fuel, beds: r.capacity,
        hands: r.hands, stars: r.stars, eaten: r.eaten,
        // how long the larder lasts at this day's flow (asleep: under the ice)
        cover: net >= 0 ? Infinity : Math.max(0, c.food) / -net,
    };
};
const QTY = {
    ore: ['ore', ' a day'], food: ['food', ' a day'], energy: ['energy', ' a day'], drawn: ['power drawn', ' a day'],
    burned: ['ore burned', ' a day'], beds: ['beds', ''], hands: ['free hands', ''], stars: ['★', ' a day'],
};
/** The quantities that change, in the order asked, at most `max` of them. */
function changed(a, b, keys, max = 3) {
    const out = [];
    for (const k of keys) {
        if (out.length >= max) break;
        const x = a[k], y = b[k];
        if (!Number.isFinite(x) || !Number.isFinite(y) || short(x) === short(y)) continue;
        out.push(`${QTY[k][0]} ${arrow(x, y)}${QTY[k][1]}`);
    }
    return out.join(', ');
}
/** The colony as it will stand with every order built: a deep copy. */
const copyOf = (state) => { const c = ordersDone(state); c.probes = []; return c; };
const PRIMARY = { mine: 'ore', farm: 'food', generator: 'energy', dorm: 'beds' };

/**
 * The node's numbers before and after: "Ore 576 → 1.2 k a day, ★ 81 → 95 a day." '' when the node
 * has nothing to measure (a teaser, the root, a cryo tier, a node at its top).
 * @param {object} state
 * @param {string} id
 * @returns {string}
 */
export function effectLine(state, id) {
    const n = NODE_BY_ID[id];
    if (!n || n.kind === 'root' || n.kind === 'teaser' || n.kind === 'cryo') return '';
    if (n.kind === 'surface' && !opened(state, id)) return '';
    const level = levelOf(state, id) + orderedOf(state, id);
    if (level >= n.max) return '';
    const asleep = !!state.asleep;
    const say = (nums) => (nums ? `${sentenceCase(nums)}.` : '');
    try {
        if (n.kind === 'level' || n.kind === 'auto' || n.kind === 'feed') {
            const base = copyOf(state);
            const next = copyOf(state);
            const t = n.type;
            if (n.kind === 'level') next.level[t] = (next.level[t] || 0) + 1;
            else if (n.kind === 'auto') next.auto[t] = (next.auto[t] || 0) + 1;
            else next.feed = levelOf(state, id) + 1;
            const a = dayOf(base, asleep), b = dayOf(next, asleep);
            if (n.kind === 'feed') {
                const pct = (k) => `${Math.round(100 * feedShare(k))} %`;
                const stars = changed(a, b, ['stars']);
                return say(`its share ${pct(levelOf(state, id))} → ${pct(next.feed)}${stars ? `, ${stars}` : ''}`);
            }
            return say(changed(a, b, [PRIMARY[t], 'stars', 'hands', 'drawn']));
        }
        if (n.kind === 'surface') {
            if (id === 'question' || id === 'longcount') return '';
            const base = copyOf(state);
            const next = copyOf(state);
            next.tree = { ...(next.tree || {}), bought: [...((next.tree && next.tree.bought) || []), id] };
            if (id === 'cold') {
                // the gift is for the sleep: measured under the ice, awake or not
                const a = dayOf(base, true), b = dayOf(next, true);
                const days = (v) => (Number.isFinite(v) ? `${short(v)} days` : 'forever');
                return Number.isFinite(a.cover)
                    ? say(`food under the ice lasts ${days(a.cover)} → ${days(b.cover)}`)
                    : say(`sleepers eat ${arrow(a.eaten, b.eaten)} food a day`);
            }
            const a = dayOf(base, asleep), b = dayOf(next, asleep);
            if (id === 'quiet') return say(changed(a, b, ['drawn', 'burned', 'stars']));
            return say(changed(a, b, ['ore', 'food', 'energy', 'stars']));
        }
        if (n.kind === 'watcher') {
            const w = state.watcher || {};
            const after = { ...w, bought: [...(w.bought || []), n.step] };
            const tier = Math.max(0, state.cryo ?? 0);
            const per = (x) => (Math.round(x * 100) / 100).toFixed(2);
            switch (n.step) {
            case 'watchdog': case 'spinal':
                return say(`drift ${per(DRIFT_PER_SECOND[tier] * driftFactor(w))} → ${per(DRIFT_PER_SECOND[tier] * driftFactor(after))} a second`);
            case 'scheduler': {
                const held = (state.builds || []).filter((j) => isQueued(j)).length;
                return say(`orders waiting for the wake ${held} → 0`);
            }
            case 'deepread': return say(`stability a click ${Math.round(snapGain(w, tier))} → ${Math.round(snapGain(after, tier))}`);
            case 'nightvision': return say(`the food alarm at ${FOOD_ALARM_DAYS} → ${Math.round(FOOD_ALARM_DAYS * (1 - NIGHT_VISION_LATE))} days left`);
            case 'cooling': return say(`capacity holds ${capacityMax(w)} → ${capacityMax(after)}`);
            case 'secondcore': return say(`stability from the lamps ${puzzleGain(w)} → ${puzzleGain(after)}`);
            case 'mast': {
                const a = scoutOdds(state), b = scoutOdds({ ...state, watcher: after });
                return say(`doubt on a reading ${a.scatter} → ${b.scatter} %`);
            }
            case 'reactor': return say(`capacity a second up to ${CAPACITY_PER_SECOND * capacityGain(w)} → ${CAPACITY_PER_SECOND * capacityGain(after)}`);
            default: return '';
            }
        }
        if (n.kind === 'bio') {
            const step = LADDER.find((u) => u.id === n.step);
            const take = peopleFor(step, state);
            const humans = state.humans || 0;
            const beds = dayOf(JSON.parse(JSON.stringify(state)), asleep).beds;
            const held = Math.max(beds, humans, 1);
            const people = Math.max(0, Math.min(take, Math.floor(humans - MIN_SLEEPERS)));
            return say(`people ${arrow(humans, humans - people)}, beds ${arrow(beds, beds * (1 - people / held))}, for good`);
        }
    } catch {
        return '';
    }
    return '';
}

/* ---- THE INFO BOX IN PLAIN WORDS (deep-copy) -------------------------------------------------
   Ola on v1.67: "'Next 20 cap something something', what?" Four plain lines and a quiet fifth:
   the name and level; what it does; what it costs, in words; where it stands ("You can buy it.",
   "You need ★ 12 k more.", "Being built: 3 days left."); and the numbers before and after. */

/** The price in words: "Costs ★ 20 k and 20 capacity." */
export function costLine(price) {
    if (!price) return '';
    const parts = [];
    if (price.stars) parts.push(`★ ${short(price.stars)}`);
    if (price.cap) parts.push(`${short(price.cap)} capacity`);
    if (price.ore) parts.push(`${short(price.ore)} ore`);
    if (price.beds) parts.push(price.beds === 1 ? 'a dormitory' : `${price.beds} dormitories`);
    if (price.people) parts.push(`${short(price.people)} people`);
    return parts.length ? `Costs ${list(parts)}.` : '';
}
/** How long the orders of this node have left, and whether they wait for the wake. */
function ordersLeft(state, n) {
    const jobs = (state.builds || []).filter((j) => j.kind === n.kind && j.type === n.type);
    if (!jobs.length) return null;
    const held = !!state.asleep && !watcherHas(state.watcher, 'scheduler') && jobs.every((j) => isQueued(j));
    const eta = buildEta(state);
    const days = jobs.reduce((a, j) => Math.max(a, (eta.get(j) ?? state.day) - state.day), 0);
    return { days: Math.max(1, Math.ceil(days)), held };
}
/** The road to a cryo tier as one line: "Needs generators automated ✓, farms automated and ★ 15 k." */
const roadLine = (road) => `${sentenceCase(road.text)}.`;
/**
 * Where a node stands, in one sentence, and its tone: 'go' (can be bought), 'why' (cannot yet),
 * 'build' (being built) or ''.
 * @returns {{text:string, tone:string}}
 */
export function stateLine(state, id, ctx = {}, st = nodeStatus(state, id, ctx)) {
    const n = NODE_BY_ID[id];
    const out = (text, tone = 'why') => ({ text, tone });
    if (!n || n.kind === 'root') return out('', '');
    const can = canBuy(state, id, ctx);
    if (st.ordered > 0) {
        const left = ordersLeft(state, n);
        const t = !left ? 'Being built.' : left.held ? 'Being built when the colony wakes.' : `Being built: ${span(left.days)} left.`;
        return out(can.ok ? `${t} You can buy another.` : t, 'build');
    }
    if (st.status === 'bought') return out(n.max > 1 ? 'All levels bought.' : 'Bought.', '');
    if (can.ok) {
        if (can.kind === 'choose') return out('Paid. Choose a sector to seal.', 'go');
        return out(n.max > 1 ? 'You can buy it. Shift-click buys all you can.' : 'You can buy it.', 'go');
    }
    const w = state.watcher || {};
    const lacks = (v, what) => (what === 'stars' ? `You need ★ ${short(v)} more.` : `You need ${short(v)} more ${what}.`);
    switch (can.kind) {
    case 'surface': return out('Not ours to open.', '');
    case 'teaser': return out('Not open yet.', '');
    case 'mode':
        if (w.gone) return out('Nobody is left to build it.');
        return out(n.kind === 'watcher' || n.kind === 'bio' ? 'Only while the colony sleeps.' : 'Only while the colony is awake.');
    case 'prereq':
        if (n.kind === 'cryo') return out(`Opens after ${cryoName(n.tier - 1)}.`);
        if (GIFT_NEEDS[id] !== undefined) return out(`Opens after ${cryoName(GIFT_NEEDS[id])}.`);
        if (!nodeVisible(state, id)) return out('Something has to stay awake first.');
        return out(`Opens after ${displayName(n.parent)}.`);
    case 'room': return out(`Build a ${ROOM_WORD[n.type]} first.`);
    case 'queue': return out('The build queue is full.');
    default: break;
    }
    if (n.kind === 'cryo') {
        const road = ctx.road !== undefined && n.tier === (state.cryo ?? -1) + 1 ? ctx.road : cryoRoad(n.tier, state);
        if (road && !road.open) return out(roadLine(road));
        if (can.kind === 'gate') return out('Waits for the orders being built.');
    }
    if (n.kind === 'watcher' || n.kind === 'bio') {
        const step = nextStep(w);
        switch (step && stepNeed(w, state)?.missing) {
        case 'capacity': return out(lacks(step.cap - Math.floor(w.capacity || 0), 'capacity'));
        case 'stars': return out(lacks(step.stars - (state.stars || 0), 'stars'));
        case 'ore': return out(lacks(step.ore - (state.minerals || 0), 'ore'));
        case 'dorm': return out('You need a dormitory to spare.');
        case 'people': return out('Too few people. Some must stay under the ice.');
        case 'growing': return out('It is still growing.');
        default: return out(can.reason);
        }
    }
    const price = st.price || priceOf(state, id);
    if (can.kind === 'afford' && price && price.stars) return out(lacks(price.stars - (state.stars || 0), 'stars'));
    return out(can.reason);
}
/**
 * The info box's lines for a node: { name, lvl, does, cost, state, tone, quote }. The numbers
 * (effectLine) are the caller's, worked out only for the node under the cursor.
 */
export function infoLines(state, id, ctx = {}, st = nodeStatus(state, id, ctx)) {
    const n = NODE_BY_ID[id];
    const sl = stateLine(state, id, ctx, st);
    return {
        name: st.name,
        lvl: n.max > 1 ? `${Math.min(st.level, st.max)} / ${st.max}` : '',
        does: st.does,
        cost: st.status === 'surface' || n.kind === 'root' || n.kind === 'teaser' ? '' : costLine(st.price),
        state: sl.text,
        tone: sl.tone,
        quote: st.quote ? `“${st.quote}”` : '',
    };
}

/** How many nodes can be bought right now: the badge on the tree button. */
export function buyableCount(state, ctx = {}) {
    let k = 0;
    for (const n of NODES) {
        if (n.kind === 'root' || n.kind === 'teaser' || !nodeVisible(state, n.id)) continue;
        if (canBuy(state, n.id, ctx).ok) k++;
    }
    return k;
}

/**
 * Buy the next level of a node. The same rules the old buttons ran: a level or an automation is
 * paid now and ordered into the build queue (deep.js orderBuild); a cryo tier is paid at once (the
 * hall digs its own chamber); a Watcher step or a biological step goes through watcher.js buyStep.
 * The caller does what is the phase's: the layout (the hall's chamber, a dormitory taken), the
 * scene, the feed, clearing a room type's faults.
 *
 * @param {object} state - mutated
 * @param {string} id
 * @param {object} [ctx] - canBuy's, plus `slots` (the layout, for a Watcher step) and `choose`
 *        (a biological step waits for its sector instead of taking one at once)
 * @returns {object|null} { id, kind, type?, tier?, job?, step? } or null when it cannot be bought
 */
export function buy(state, id, ctx = {}) {
    const can = canBuy(state, id, ctx);
    if (!can.ok) return null;
    const n = NODE_BY_ID[id];
    if (n.kind === 'level' || n.kind === 'auto') {
        const price = nextPrice(state, n.kind, n.type);
        state.stars -= price;
        const job = orderBuild(state, n.kind, { type: n.type });
        return { id, kind: n.kind, type: n.type, price, job };
    }
    if (n.kind === 'feed') {
        const price = feedCost(levelOf(state, id));
        state.stars -= price;
        state.feed = levelOf(state, id) + 1;
        return { id, kind: 'feed', level: state.feed, price };
    }
    if (n.kind === 'surface') {
        const price = GIFT_PRICE[id];
        state.stars -= price;
        state.tree = normalizeTree(state.tree);
        state.tree.bought.push(id);
        // Long count IS the tier past Cryo VII: the colony sleeps at it from now on
        if (id === 'longcount') state.cryo = CRYO_TOP + 1;
        return { id, kind: 'gift', gift: id, price };
    }
    if (n.kind === 'cryo') {
        const price = CRYO[n.tier].cost;
        state.stars -= price;
        if (n.tier === 0) {
            state.cryo = 0;
            state.chambers += 1;
            state.rooms.cryo = (state.rooms.cryo || 0) + 1;
        } else {
            state.cryo = n.tier;
        }
        return { id, kind: 'cryo', tier: n.tier, price };
    }
    if (can.kind === 'choose') return { id, kind: n.kind, choose: true };
    const out = buyStep(state.watcher, state, ctx.slots || [], { choose: !!ctx.choose });
    return out ? { id, kind: n.kind, step: out } : null;
}

/** As many levels as can be paid for now (shift-click): the results, in order. */
export function buyMany(state, id, ctx = {}, limit = 50) {
    const out = [];
    const n = NODE_BY_ID[id];
    if (!n) return out;
    for (let i = 0; i < limit; i++) {
        const r = buy(state, id, ctx);
        if (!r) break;
        out.push(r);
        if (n.max === 1 || r.choose || (r.step && r.step.pending)) break;
    }
    return out;
}

/** The node the next Watcher step is bought on, or null at the top of the ladder. */
export function nextWatcherNode(state) {
    const step = nextStep(state.watcher);
    return step ? STEP_NODE[step.id] || null : null;
}

/** A plain sentence for the reason, with its first letter up. */
export const reasonText = (r) => sentenceCase(r || '');
