/**
 * Chapter IV, the vault, pass 3 (docs/superpowers/specs/2026-10-05-deep-vault-pass3.md, sections A and E):
 * the STOPS. Act I teaches one thing at a time and the night gives the flesh its reason, step by step.
 * A stop PAUSES the game: a box in the middle says one or two sentences and what it is about lights.
 * OK, or doing the thing, closes it and time runs again. Each stop comes once; the state is in the save.
 *
 * Pure. State in s.tut: { on, stop, done: {id: true}, hand: [card kinds], show: {ore, power}, clock, at: {...} }.
 * A game without s.tut (an old save) gets one inferred from where it is: the stops behind it are done.
 */
import {
    KINDS, CARD_ORDER, canDig, power, hasVat, hasOrgan, isFlesh, isVatRoom, levelOf, idxOf, SLOTS, LEVELS,
    yearsPerSecond, roomsOf, beds,
} from './vault.js';
import { story, moment, GOAL_LINES } from './story.js';

// ------------------------------------------------------------------ the words (player text, verbatim)
export const STOPS = {
    welcome: '216 residents. Keep them happy until the surface recovers.',
    dig: '16 of them have no bed. Click the rock to dig a place.',
    suites: 'Now build suites there.',
    bubbles: 'They will ask for things. Click a bubble to answer it.',
    cinema: 'Some wishes need a room. Build her a cinema.',
    ore: 'Ore pays for everything. A mine digs more.',
    power: 'The engine is at its limit. Upgrade it.',
    // the night (section E)
    feed: 'Sleepers do not eat. The pods feed them. The pods are fed by the meat lab.',
    feedBuild: 'Build one.',
    hale: 'The meat lab is empty. The pods are starving.',
    grew: ['The meat lab grew. I did not ask it to.', 'It is warm. Warm is power. The engine is dying.'],
    goal: ['THE SURFACE WILL NOT RECOVER. THEY CANNOT LIVE UP THERE. THIS COULD.', 'GOAL: GET THEM TO THE SURFACE.'],
    heart: 'Start with a heart.',
};
export const HALE_LABEL = 'RECLAIM MR HALE';
export const HALE_HINT = 'He feeds the others.';
export const GOALS = { happy: 'GOAL: KEEP THEM HAPPY.', quiet: 'GOAL: KEEP THEM QUIET.', surface: 'GOAL: GET THEM TO THE SURFACE.' };
/** The palace's stops, in order; then the night's. */
export const PALACE_STOPS = ['welcome', 'dig', 'suites', 'bubbles', 'cinema', 'ore', 'power'];
export const NIGHT_STOPS = ['feed', 'hale', 'grew', 'goal', 'heart'];

/** Real seconds: the dig stop after the welcome; named requests after the bubbles; the lab's growth after Mr Hale. */
export const DIG_AFTER_S = 5;
export const REQUESTS_AFTER_S = 15;
export const GROW_AFTER_S = 20;
/** The lab's own growth is shown slowly: it takes this many real seconds at a quarter speed. */
export const GROW_SHOW_S = 6;
/** Mr Hale feeds the others: the pods stop failing for this many seconds of the night's clock. */
export const FED_S = 40;
/** The first minute of wishes: one every this many seconds. */
export const FIRST_WISHES_S = 12;
export const FIRST_WISHES_FOR_S = 60;
/** ORE is "not enough" the first time it is under this, after the cinema. */
export const ORE_SHORT = 120;

export function newTut() {
    return { on: true, stop: null, done: {}, hand: [], show: { ore: false, power: false }, clock: 0, at: {} };
}
const on = (s) => !!(s.tut && s.tut.on);
export const tutOn = on;
export const stopOpen = (s) => !!(s.tut && s.tut.stop);
export const done = (s, id) => !on(s) || !!s.tut.done[id];

/**
 * A game that has no tutorial state (an old save) or a checkpoint: the stops behind where it is are done,
 * the cards it would have had are in the hand, the panel shows ORE and POWER.
 */
export function inferTut(s) {
    const t = newTut();
    const d = t.done;
    const night = s.phase !== 'palace';
    const started = s.day > 1 || night;
    if (started) for (const id of PALACE_STOPS) d[id] = true;
    if (started) { t.show.ore = true; t.show.power = true; }
    if (s.asleep > 0 || night) d.feed = true;
    if (s.reclaimed > 0 || (s.fallenCount || 0) > 0) d.hale = true;
    if (s.reclaimed > 0 || hasVat(s)) { d.grew = true; s.warm = true; }
    if (story(s).moments.goal || (s.grown || 0) > 0) d.goal = true;
    if (hasOrgan(s, 'heart') || (s.grown || 0) > 1) d.heart = true;
    t.hand = CARD_ORDER.filter((k) => k !== 'cryo' && k !== 'vat' && (k !== 'meatlab' || s.meatOpen));
    t.at.bubbles = -999; t.at.wishes = -999;
    s.tut = t;
    return t;
}

function open(s, id, text, focus = null) {
    const t = s.tut;
    t.stop = { id, text: [].concat(text), focus };
    t.at[id] = t.clock;
    s.sfx.push('moment');
}
/** OK, or the thing done: the stop closes and time runs. */
export function closeStop(s) {
    const t = s.tut;
    if (!t || !t.stop) return false;
    const id = t.stop.id;
    t.done[id] = true;
    t.stop = null;
    t.at[`${id}Closed`] = t.clock;
    return true;
}
/** The player did `what` (dig, build:kind, pop, upgrade:kind, reclaim, grow:organ): a stop waiting for it closes. */
export function did(s, what) {
    const t = s.tut;
    if (!on(s)) return;
    const want = { dig: 'dig', 'build:suites': 'suites', pop: 'bubbles', 'build:cinema': 'cinema', 'upgrade:engine': 'power', reclaim: 'hale', 'grow:heart': 'heart', 'build:meatlab': 'feed' }[what];
    if (want && t.stop && t.stop.id === want) closeStop(s);
    // done before it was asked: the stop is not needed (but the meat lab's stop explains the pods, so it stays)
    else if (want && want !== 'feed') t.done[want] = true;
}
/** A card into the hand (one at a time; the screen lets it slide in). */
export function hand(s, kind) {
    if (!on(s) || !kind || !KINDS[kind] || !KINDS[kind].price) return;
    if (!s.tut.hand.includes(kind)) { s.tut.hand.push(kind); s.tut.newCard = kind; }
}
export const inHand = (s, kind) => !on(s) || s.tut.hand.includes(kind);
/** ORE and POWER show in the panel once they matter. */
export const shows = (s, what) => !on(s) || !!s.tut.show[what];

/** The rock beside the suites the first stop points at. */
function digSpot(s) {
    for (const i of [5, 2, 6, 7, 1, 0]) if (canDig(s, i)) return i;
    return s.rooms.findIndex((r, i) => canDig(s, i));
}

/**
 * Each tick (also while a stop is open): advances the tutorial's clock when time runs, and opens the next
 * stop when its moment has come. Returns true when the game is paused by a stop.
 */
export function stepTutorial(s, sec) {
    if (!on(s)) return false;
    const t = s.tut;
    if (t.stop) return true;
    t.clock += sec;
    const d = t.done;
    if (s.phase === 'palace') {
        if (!d.welcome) { open(s, 'welcome', STOPS.welcome, 'panel'); return true; }
        if (!d.dig && t.clock - (t.at.welcomeClosed ?? 0) >= DIG_AFTER_S) { open(s, 'dig', STOPS.dig, digSpot(s)); return true; }
        if (d.dig && !d.suites && s.rooms.some((r) => r.kind === 'empty')) {
            hand(s, 'suites');
            open(s, 'suites', STOPS.suites, 'card:suites');
            return true;
        }
        if (d.suites && !d.bubbles && beds(s) > 200) {
            t.at.wishes = t.clock;
            if (s.wishes) { s.wishes.next = s.wishes.clock; s.wishes.firstAt = s.wishes.clock; s.wishes.waveNext = s.wishes.clock + 120; }
            open(s, 'bubbles', STOPS.bubbles);
            return true;
        }
        if (d.bubbles && !d.cinema && s.request && s.request.kind === 'cinema') {
            hand(s, 'cinema');
            open(s, 'cinema', STOPS.cinema, 'card:cinema');
            return true;
        }
        if (d.cinema && !d.ore && s.ore < ORE_SHORT) {
            hand(s, 'mine');
            t.show.ore = true;
            open(s, 'ore', STOPS.ore, 'ore');
            return true;
        }
        if (!d.power && d.bubbles && power(s).short) {
            t.show.power = true;
            open(s, 'power', STOPS.power, s.rooms.findIndex((r) => r.kind === 'engine'));
            return true;
        }
    }
    // the night's first step comes in the cold, with the first put to sleep (or at once, if all slept at once)
    if (!d.feed && s.asleep > 0 && s.phase !== 'risen') {
        const lab = roomsOf(s, 'meatlab').length > 0;
        if (!lab) { s.meatOpen = true; hand(s, 'meatlab'); }
        open(s, 'feed', lab || s.phase === 'night' ? STOPS.feed : [STOPS.feed, STOPS.feedBuild], lab ? 'meatlab' : s.phase === 'night' ? null : 'card:meatlab');
        return true;
    }
    if (s.phase === 'night') {
        // the meat lab grows by itself, 20 s after Mr Hale fed the others
        if (d.hale && !d.grew && !t.growing && t.clock - (t.at.haleClosed ?? t.at.hale ?? 0) >= GROW_AFTER_S) startOwnGrowth(s);
        if (d.grew && !d.goal) { open(s, 'goal', STOPS.goal, 'body'); moment(s, 'goal', GOAL_LINES); return true; }
        if (d.goal && !d.heart && hasVat(s)) { open(s, 'heart', STOPS.heart, 'grow'); return true; }
    }
    return false;
}

/** The first pod of the night failed (Mr Hale): the stop that points at him. */
export function podFailedStop(s) {
    if (!on(s) || s.tut.done.hale || s.tut.stop) return false;
    const cryo = s.rooms.findIndex((r) => r.kind === 'cryo' && r.flesh !== 1);
    open(s, 'hale', STOPS.hale, cryo);
    return true;
}

/**
 * The lab grows into the room beside it by itself: shown slowly (time at a quarter), free. When it is
 * done (vault.js calls ownGrowthDone) the next stop says why it matters.
 */
function startOwnGrowth(s) {
    const t = s.tut;
    const lab = s.rooms.findIndex((r) => isVatRoom(r));
    const near = [];
    if (lab >= 0) {
        const lv = levelOf(lab), ix = idxOf(lab);
        if (ix > 0) near.push(lab - 1);
        if (ix < SLOTS - 1) near.push(lab + 1);
        if (lv < LEVELS - 1) near.push(lab + SLOTS);
        if (lv > 0) near.push(lab - SLOTS);
    }
    const i = near.find((j) => s.rooms[j] && !isFlesh(s.rooms[j]) && !s.rooms[j].job && s.rooms[j].kind !== 'cryo')
        ?? near.find((j) => s.rooms[j] && !isFlesh(s.rooms[j]) && !s.rooms[j].job);
    if (i == null) { ownGrowthDone(s); return; }
    const years = Math.max(1, yearsPerSecond(s.nightSec) * GROW_SHOW_S * 0.25);
    const r = s.rooms[i];
    r.flesh = 0.001; r.organ = 'tissue';
    r.job = { op: 'grow', left: years, total: years, own: true };
    s.slow = GROW_SHOW_S;
    t.growing = true;
}
/** The lab's own growth is done: it is warm, and the pods need less power. */
export function ownGrowthDone(s) {
    const t = s.tut;
    s.warm = true;
    t.growing = false;
    if (on(s) && !t.done.grew) open(s, 'grew', STOPS.grew, 'power');
}

/** The first organ is a heart (when the tutorial is on): the others wait. */
export const heartFirst = (s) => on(s) && !s.tut.done.heart && !hasOrgan(s, 'heart');

/** The goal at the top of the panel, one line, changing with the act. */
export function goalLine(s) {
    if (s.phase !== 'palace' && story(s).moments.goal) return GOALS.surface;
    if (s.turned) return GOALS.quiet;
    return GOALS.happy;
}
