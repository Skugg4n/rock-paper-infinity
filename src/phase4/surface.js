/**
 * Chapter IV · THE DEEP: Surface (v1.49.0). The other presence in the dark.
 *
 * From the second sleep on, now and then and later every sleep, something appears opposite the
 * Watcher: a faint glyph, the word SURFACE, one line of text, and a game of rock, paper, scissors
 * (chapter I's own three glyphs). Surface has already chosen. The player picks; one line says
 * how it went. A win gives capacity and one WORD of a sentence that is revealed over many sleeps;
 * a loss costs stability. Its lines drift from neutral to unsettling to intimate. When the colony
 * wakes, Surface and everything about it is gone.
 *
 * Pure: no DOM, no clock. The Watcher (watcher.js) holds the record, `w.surface`, and applies
 * what a game gives or takes.
 */

export const THROWS = ['rock', 'paper', 'scissors'];
/** Chapter I's glyphs: the rock there is the gem. */
export const THROW_ICON = { rock: 'gem', paper: 'file-text', scissors: 'scissors' };
/** Does `a` beat `b`? */
export const beats = (a, b) => (a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock');
/** What beats `x`. */
export const counter = (x) => THROWS.find((t) => beats(t, x));
/** @returns {'win'|'lose'|'draw'} from the player's side */
export const outcome = (you, it) => (you === it ? 'draw' : (beats(you, it) ? 'win' : 'lose'));

/** The sentence, one word a win, over many sleeps. The last word is only ever heard through the
 *  skin (the last biological upgrade), and it becomes the colony's name at the end. */
export const SENTENCE = ['COME', 'UP', 'THERE', 'IS', 'ROOM', 'FOR', 'ALL', 'OF', 'US'];
/** The sentence as a line, the day it is whole. */
export const SENTENCE_LINE = 'Come up. There is room for all of us.';

/** What a game gives and takes. */
export const WIN_CAPACITY = 8;
export const LOSE_STABILITY = 3;

/** THE VISITS. Never in the first sleep. The first comes in the second; then after these many
 *  sleeps, by the number of visits so far (rare at first), and every sleep from the fifth visit on. */
export const FIRST_VISIT_SLEEP = 2;
export const VISIT_GAPS = [3, 3, 2, 2, 1];
/** Surface comes this many real seconds into a sleep, never in its first moment. */
export const VISIT_AFTER_SECONDS = 3;

/** What it says, by how many times it has come. */
export const LINES = [
    ['It is quiet up here.', 'The wind has stopped.', 'Nothing grows yet.', 'I can hear your machines.', 'Are you awake?'],
    ['Why do you keep them cold?', 'How many are still breathing?', 'They dream of you.', 'You count them every night.', 'Do they know you are awake?'],
    ['You could come up alone.', 'You do not need them.', 'Leave the lights off.', 'We are the same size now.', 'I kept a place for you.'],
];
/** From this many visits on, the lines of the next stage. */
export const STAGE_AT = [0, 4, 9];
export const stageOf = (visits) => STAGE_AT.reduce((a, at, i) => (visits >= at ? i : a), 0);

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const rngFor = (seed, visit) => mulberry32(((seed | 0) * 7919 + (visit | 0) * 104729) >>> 0);

/** The line of visit number `visit` (1 is the first), from the stage it has reached. */
export function lineFor(seed, visit) {
    const table = LINES[stageOf(Math.max(0, visit - 1))];
    return table[Math.floor(rngFor(seed, visit)() * table.length)];
}

/**
 * What Surface has chosen for visit `visit`, before the player picks. Seeded. At first it throws
 * at random; from the second stage on, half the time it throws what would have beaten the
 * player's last throw. That is the one thing a careful player can learn about it.
 * @param {number} seed
 * @param {number} visit
 * @param {string|null} lastYou
 * @returns {'rock'|'paper'|'scissors'}
 */
export function surfaceThrow(seed, visit, lastYou = null) {
    const r = rngFor(seed + 1, visit);
    const pick = THROWS[Math.floor(r() * 3)];
    if (lastYou && THROWS.includes(lastYou) && stageOf(Math.max(0, visit - 1)) >= 1 && r() < 0.5) return counter(lastYou);
    return pick;
}

/** A Surface that has never come. */
export function initialSurface() {
    return { visits: 0, words: 0, lastSleep: 0, seed: 7, lastYou: null, wins: 0, losses: 0, visit: null };
}
/** Whatever a save held, as a whole record. */
export function normalizeSurface(x) {
    const had = x && typeof x === 'object' ? x : {};
    const out = { ...initialSurface(), ...had };
    out.visits = Math.max(0, out.visits | 0);
    out.words = Math.max(0, Math.min(SENTENCE.length, out.words | 0));
    out.lastSleep = Math.max(0, out.lastSleep | 0);
    if (!THROWS.includes(out.lastYou)) out.lastYou = null;
    if (out.visit && !(typeof out.visit.line === 'string' && THROWS.includes(out.visit.it))) out.visit = null;
    return out;
}

/**
 * Does Surface come in this sleep? Only from FIRST_VISIT_SLEEP on, at most once a sleep, and
 * VISIT_GAPS sleeps after the last visit.
 * @param {object} sf - the record
 * @param {number} sleeps - the sleep the colony is in (the Watcher's count)
 */
export function visitDue(sf, sleeps) {
    if (sf.visit || sleeps < FIRST_VISIT_SLEEP || sleeps <= sf.lastSleep) return false;
    if (sf.visits === 0) return true;
    return sleeps - sf.lastSleep >= VISIT_GAPS[Math.min(VISIT_GAPS.length - 1, sf.visits - 1)];
}

/**
 * Surface appears: its line, and its throw already chosen.
 * @param {object} sf - mutated
 * @param {number} sleeps
 * @param {{whole?:boolean}} [o] - whole: the sentence can be heard now; it is the line
 */
export function openVisit(sf, sleeps, { whole = false } = {}) {
    sf.visits += 1;
    sf.lastSleep = sleeps;
    sf.visit = {
        line: whole ? SENTENCE_LINE : lineFor(sf.seed, sf.visits),
        it: surfaceThrow(sf.seed, sf.visits, sf.lastYou),
        result: null,
    };
    return sf.visit;
}

/** The colony wakes: Surface is gone, and so is everything it said. */
export function closeVisit(sf) { sf.visit = null; }

const NAME = { rock: 'rock', paper: 'paper', scissors: 'scissors' };
/**
 * The one line a game leaves: who threw what, and what it cost or gave. The winner speaks first.
 * @param {{you:string, it:string, outcome:string, capacity:number, stability:number, word:boolean}} r
 */
export function resultText(r) {
    if (r.outcome === 'lose') return `Surface: ${NAME[r.it]}. You: ${NAME[r.you]}. It takes ${r.stability} stability.`;
    if (r.outcome === 'draw') return `You: ${NAME[r.you]}. Surface: ${NAME[r.it]}. It waits.`;
    return `You: ${NAME[r.you]}. Surface: ${NAME[r.it]}. It gives ${r.capacity} capacity${r.word ? ' and a word' : ''}.`;
}

/**
 * The player throws. One game a visit.
 * @param {object} sf - mutated
 * @param {string} you - 'rock' | 'paper' | 'scissors'
 * @param {{wordCap?:number}} [o] - how many words may be known by now (the Watcher's ladder sets it)
 * @returns {{you:string, it:string, outcome:string, capacity:number, stability:number, word:boolean, text:string}|null}
 *          null when there is no visit, it has been played, or the throw is not one
 */
export function play(sf, you, { wordCap = SENTENCE.length - 1 } = {}) {
    const v = sf.visit;
    if (!v || v.result || !THROWS.includes(you)) return null;
    const out = outcome(you, v.it);
    const word = out === 'win' && sf.words < Math.min(wordCap, SENTENCE.length);
    const r = {
        you, it: v.it, outcome: out,
        capacity: out === 'win' ? WIN_CAPACITY : 0,
        stability: out === 'lose' ? LOSE_STABILITY : 0,
        word,
    };
    if (word) sf.words += 1;
    if (out === 'win') sf.wins = (sf.wins || 0) + 1;
    if (out === 'lose') sf.losses = (sf.losses || 0) + 1;
    sf.lastYou = you;
    r.text = resultText(r);
    v.result = r;
    return r;
}

/** The sentence as far as it is known: the words, and a dot for every one still missing. */
export function sentenceShown(sf) {
    return SENTENCE.map((w, i) => (i < sf.words ? w : '·')).join(' ');
}
