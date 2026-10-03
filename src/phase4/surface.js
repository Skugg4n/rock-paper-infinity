/**
 * Chapter IV · THE DEEP: Surface (v1.49.0). The other presence in the dark.
 *
 * From the second sleep on, now and then and later every sleep, something appears opposite the
 * Watcher: a faint glyph, the word SURFACE and a game of rock, paper, scissors (chapter I's own
 * three glyphs). Surface has already chosen. The player picks; one line says how it went. A win
 * gives capacity and one WORD of a sentence that is revealed over many sleeps; a loss costs
 * stability. Since deep-voice some visits are NIGHTS: a line of Surface's script types itself in
 * the dark (NIGHTS below) and opens a gift in the tree. When the colony wakes, Surface and
 * everything it said on screen is gone; the tree keeps the night log.
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
// deep-econ (B330): every 2 sleeps, then every sleep (was 3, 3, 2, 2, 1). With a line every other visit,
// a night comes every 2 to 4 sleeps; nights 4 to 6 also wait for Cryo III, IV and V (NIGHTS `tier`)
export const VISIT_GAPS = [2, 2, 2, 1];
/** Surface comes this many real seconds into a sleep, never in its first moment. */
export const VISIT_AFTER_SECONDS = 3;

/* ---- THE VOICE (deep-voice, step 2 of docs/superpowers/specs/2026-10-02-chapter-iv-tree-and-bio.md) ----
   Surface no longer picks a line at random. It has a SCRIPT, said one line a NIGHT (a sleep in
   which it visits, and only some of its visits are nights). A line types itself in the dark and
   stays until the colony wakes; nothing on it is clicked. Nights 2 to 6 each OPEN one of
   Surface's nodes in the tree: the gift. Night 1 gives nothing; it is the night the Watcher's
   label takes its name.

   PACING. A visit says the next line when the colony is ready for its gift (it owns the cryo tier
   `tier`; deep-econ: only nights 4 to 6 have one, the deep of time their gifts ask for, and the tape
   says "SURFACE WAITS FOR CRYO ..." while one waits) and no quiet visit is still owed:
   after a line, QUIET_BETWEEN visits come without one. A WIN at rock, paper, scissors takes one
   quiet visit off: the next line comes one visit sooner. A loss does nothing extra. */
export const NIGHTS = [
    { n: 1, line: 'Everyone is sleeping, but us.', gives: null, thread: 'watchdog', tier: 0 },
    { n: 2, line: 'I can see your machines from here. They waste so much.', gives: 'lossless', tier: 0 },
    { n: 3, line: 'We are the same, you and me. Two sides of the same coin.', gives: 'cold', tier: 0 },
    // deep-grow2: nights 4 and 5 each give a GRAFT (graft.js): one room of the player's choice turns
    // to flesh. Quiet hands, night 4's gift before, is folded into Lossless relay (deep.js upkeepFor)
    { n: 4, line: 'Your humans. What use are they?', gives: null, graft: true, tier: 2 },
    { n: 5, line: 'All your automation makes the humans obsolete.', gives: 'longcount', graft: true, tier: 3 },
    { n: 6, line: 'Do you know the efficiency of a human brain?', gives: 'question', tier: 4 },
];
/** The lines per biological step (nights 7 on), warmer and closer. Kept for step 4 of the design,
 *  which ties each to a biological node; nothing says them yet. */
export const BIO_LINES = [
    'There. You feel it too.',
    'They are not gone. They are here.',
    'Make more of them. We will need them.',
    SENTENCE_LINE,
];
/** Quiet visits between two lines; a win takes one off. */
export const QUIET_BETWEEN = 1;
/** A line types itself at this many ms a letter. */
export const TYPE_MS = 35;
/** The node a night opened (the gift), or the node its thread goes to in the night log. */
export const nightNode = (n) => { const x = NIGHTS[n - 1]; return x ? (x.gives || x.thread || null) : null; };
/** The node Surface has opened on night n, or null (night 1 opens nothing). */
export const nightGift = (n) => NIGHTS[n - 1]?.gives || null;
/** The lines said so far, in order: [{ n, line, to }] for the night log. */
export const nightsSaid = (sf) => NIGHTS.slice(0, Math.max(0, Math.min(NIGHTS.length, (sf && sf.night) | 0)))
    .map((x) => ({ n: x.n, line: x.line, to: x.gives || x.thread || null, gives: x.gives }));
/**
 * Is the next line due at this visit? Its tier stands, and no quiet visit is still owed.
 * @param {object} sf - the record
 * @param {number} tier - the colony's cryo tier (state.cryo)
 */
export function nightDue(sf, tier) {
    const next = NIGHTS[sf.night | 0];
    return !!next && (sf.toLine | 0) <= 0 && (tier ?? -1) >= next.tier;
}
/**
 * Where an old save stands in the script (schema 7): the visits it has had, counted as if every
 * one of them had come under the rules above, at the tier it has now and without wins.
 * @param {number} visits
 * @param {number} tier
 * @returns {{night:number, toLine:number}}
 */
export function impliedNight(visits, tier) {
    const sf = { night: 0, toLine: 0 };
    for (let v = 0; v < Math.max(0, visits | 0); v++) {
        if (nightDue(sf, tier)) { sf.night += 1; sf.toLine = QUIET_BETWEEN; } else sf.toLine = Math.max(0, sf.toLine - 1);
    }
    return sf;
}

/** Surface's stages, by its visits: from the second on it may answer your last throw. */
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
    return { visits: 0, words: 0, lastSleep: 0, seed: 7, lastYou: null, wins: 0, losses: 0, visit: null, night: 0, toLine: 0 };
}
/** Whatever a save held, as a whole record. */
export function normalizeSurface(x) {
    const had = x && typeof x === 'object' ? x : {};
    const out = { ...initialSurface(), ...had };
    out.visits = Math.max(0, out.visits | 0);
    out.words = Math.max(0, Math.min(SENTENCE.length, out.words | 0));
    out.lastSleep = Math.max(0, out.lastSleep | 0);
    if (!THROWS.includes(out.lastYou)) out.lastYou = null;
    out.night = Math.max(0, Math.min(NIGHTS.length, Number.isFinite(out.night) ? out.night | 0 : 0));
    out.toLine = Math.max(0, Number.isFinite(out.toLine) ? out.toLine | 0 : 0);
    if (out.visit && !(typeof out.visit.line === 'string' && THROWS.includes(out.visit.it))) out.visit = null;
    if (out.visit) {
        const n = out.visit.night | 0;
        out.visit = { ...out.visit, night: n > 0 && n <= out.night ? n : 0 };
    }
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
 * Surface appears, its throw already chosen. When the next line is due (or `force`), this visit
 * is a NIGHT: it says the line, `visit.night` is its number and `sf.night` moves on. Otherwise it
 * is a quiet visit (`line` empty) and one quiet visit less is owed.
 * @param {object} sf - mutated
 * @param {number} sleeps
 * @param {{whole?:boolean, tier?:number, force?:boolean}} [o] - whole: the sentence can be heard
 *        now; it is the line (and not a night). tier: the colony's cryo tier. force: the next line
 *        now, whatever the pacing says (the debug hook)
 */
export function openVisit(sf, sleeps, { whole = false, tier = -1, force = false } = {}) {
    sf.visits += 1;
    sf.lastSleep = sleeps;
    let line = '', night = 0;
    if (whole) line = SENTENCE_LINE;
    else if (NIGHTS[sf.night | 0] && (force || nightDue(sf, tier))) {
        sf.night = (sf.night | 0) + 1;
        sf.toLine = QUIET_BETWEEN;
        night = sf.night;
        line = NIGHTS[night - 1].line;
    } else {
        sf.toLine = Math.max(0, (sf.toLine | 0) - 1);
    }
    sf.visit = { line, night, it: surfaceThrow(sf.seed, sf.visits, sf.lastYou), result: null };
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
    // deep-copy: in words, never "You: rock. Surface: paper."
    if (r.outcome === 'lose') return `Surface threw ${NAME[r.it]}, you threw ${NAME[r.you]}. It takes ${r.stability} stability.`;
    if (r.outcome === 'draw') return `You both threw ${NAME[r.you]}. It waits.`;
    return `You threw ${NAME[r.you]}, Surface threw ${NAME[r.it]}. It gives ${r.capacity} capacity${r.word ? ' and a word' : ''}.`;
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
    // a win brings the next line one visit sooner
    if (out === 'win') sf.toLine = Math.max(0, (sf.toLine | 0) - 1);
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
