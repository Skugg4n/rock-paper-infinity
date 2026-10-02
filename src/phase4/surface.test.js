/* eslint-env jest */
/*
 * v1.49.0: Surface, the other presence in the dark. The seeded throw, the win table, the lines by
 * stage, the visits, the sentence, and what a game says.
 */
import {
    THROWS, THROW_ICON, beats, counter, outcome, SENTENCE, SENTENCE_LINE, WIN_CAPACITY, LOSE_STABILITY,
    FIRST_VISIT_SLEEP, VISIT_GAPS, STAGE_AT, stageOf, surfaceThrow, initialSurface,
    normalizeSurface, visitDue, openVisit, closeVisit, resultText, play, sentenceShown,
    NIGHTS, BIO_LINES, QUIET_BETWEEN, nightDue, nightsSaid, impliedNight, TYPE_MS,
} from './surface.js';

describe('the win table', () => {
    test('rock beats scissors, scissors beat paper, paper beats rock, and nothing beats itself', () => {
        expect(beats('rock', 'scissors')).toBe(true);
        expect(beats('scissors', 'paper')).toBe(true);
        expect(beats('paper', 'rock')).toBe(true);
        for (const a of THROWS) {
            expect(beats(a, a)).toBe(false);
            // exactly one throw beats each, and it is not beaten back by it
            expect(THROWS.filter((b) => beats(b, a))).toEqual([counter(a)]);
            expect(beats(a, counter(a))).toBe(false);
        }
        expect(outcome('rock', 'scissors')).toBe('win');
        expect(outcome('rock', 'paper')).toBe('lose');
        expect(outcome('paper', 'paper')).toBe('draw');
    });
    test('the glyphs are chapter I\'s: the rock is the gem', () => {
        expect(THROW_ICON).toEqual({ rock: 'gem', paper: 'file-text', scissors: 'scissors' });
    });
});

describe('the seeded throw', () => {
    test('the same seed and visit throw the same, and the throws are spread over all three', () => {
        const seen = new Set();
        for (let v = 1; v <= 60; v++) {
            const a = surfaceThrow(7, v, null);
            expect(surfaceThrow(7, v, null)).toBe(a);
            expect(THROWS).toContain(a);
            seen.add(a);
        }
        expect(seen.size).toBe(3);
        // another seed is another game
        const other = Array.from({ length: 30 }, (_, i) => surfaceThrow(8, i + 1, null)).join();
        const mine = Array.from({ length: 30 }, (_, i) => surfaceThrow(7, i + 1, null)).join();
        expect(other).not.toBe(mine);
    });
    test('at first it throws at random; later, half the time it throws what beat your last throw', () => {
        // stage 0: the last throw changes nothing
        for (let v = 1; v <= STAGE_AT[1]; v++) expect(surfaceThrow(3, v, 'rock')).toBe(surfaceThrow(3, v, null));
        // stage 1 on: countering rock means paper, and it happens far more than a third of the time
        let paper = 0;
        const n = 400;
        for (let v = STAGE_AT[1] + 1; v <= STAGE_AT[1] + n; v++) if (surfaceThrow(3, v, 'rock') === 'paper') paper++;
        expect(paper / n).toBeGreaterThan(0.55);
        expect(paper / n).toBeLessThan(0.8);
    });
});

describe('the script (deep-voice)', () => {
    test('six nights, in the spec\'s words, each opening its gift; no dashes of any kind', () => {
        expect(NIGHTS.map((x) => x.line)).toEqual([
            'Everyone is sleeping, but us.',
            'I can see your machines from here. They waste so much.',
            'We are the same, you and me. Two sides of the same coin.',
            'Your humans. What use are they?',
            'All your automation makes the humans obsolete.',
            'Do you know the efficiency of a human brain?',
        ]);
        expect(NIGHTS.map((x) => x.gives)).toEqual([null, 'lossless', 'cold', 'quiet', 'longcount', 'question']);
        expect(BIO_LINES[BIO_LINES.length - 1]).toBe(SENTENCE_LINE);
        for (const l of [...NIGHTS.map((x) => x.line), ...BIO_LINES]) expect(l).not.toMatch(/[‒-―]/);
        expect(TYPE_MS).toBe(35);
        // Surface still answers your last throw from its second stage on
        expect(stageOf(0)).toBe(0);
        expect(stageOf(STAGE_AT[1])).toBe(1);
    });
    test('a night when its tier stands and no quiet visit is owed; one line a night at most', () => {
        const sf = initialSurface();
        expect(nightDue(sf, -1)).toBe(false);          // no hall yet
        const v1 = openVisit(sf, 2, { tier: 0 });
        expect(v1).toMatchObject({ night: 1, line: NIGHTS[0].line });
        expect(sf).toMatchObject({ night: 1, toLine: QUIET_BETWEEN });
        closeVisit(sf);
        // the next visit is a quiet one: a game, no line
        expect(openVisit(sf, 5, { tier: 6 })).toMatchObject({ night: 0, line: '' });
        expect(sf.toLine).toBe(0);
        closeVisit(sf);
        // night 2 waits for Cryo II
        expect(openVisit(sf, 8, { tier: 0 })).toMatchObject({ night: 0, line: '' });
        closeVisit(sf);
        expect(openVisit(sf, 10, { tier: 1 })).toMatchObject({ night: 2, line: NIGHTS[1].line });
        expect(nightsSaid(sf).map((x) => x.to)).toEqual(['watchdog', 'lossless']);
    });
    test('a win brings the next line one visit sooner; a loss does nothing extra', () => {
        const won = initialSurface(), lost = initialSurface();
        for (const [sf, it, you] of [[won, 'scissors', 'rock'], [lost, 'paper', 'rock']]) {
            openVisit(sf, 2, { tier: 6 });
            sf.visit.it = it;
            play(sf, you);
            closeVisit(sf);
        }
        expect(won.toLine).toBe(0);
        expect(lost.toLine).toBe(QUIET_BETWEEN);
        expect(openVisit(won, 5, { tier: 6 }).night).toBe(2);
        expect(openVisit(lost, 5, { tier: 6 }).night).toBe(0);
    });
    test('force says the next line whatever the pacing; after the sixth there are no more', () => {
        const sf = initialSurface();
        for (let i = 1; i <= NIGHTS.length; i++) { expect(openVisit(sf, i + 1, { tier: -1, force: true }).night).toBe(i); closeVisit(sf); }
        expect(openVisit(sf, 20, { tier: 6, force: true })).toMatchObject({ night: 0, line: '' });
        expect(sf.night).toBe(NIGHTS.length);
    });
    test('an old save starts at the night its visits imply, at the tier it has', () => {
        expect(impliedNight(0, 3)).toEqual({ night: 0, toLine: 0 });
        expect(impliedNight(6, 3).night).toBe(3);      // nights 1 to 3 every second visit
        expect(impliedNight(30, 1).night).toBe(2);     // Cryo II: night 3 waits for Cryo III
        expect(impliedNight(30, 6).night).toBe(NIGHTS.length);
    });
});

describe('the visits', () => {
    test('never the first sleep; the second; then rare, then every sleep', () => {
        const sf = initialSurface();
        expect(visitDue(sf, 1)).toBe(false);
        expect(visitDue(sf, FIRST_VISIT_SLEEP)).toBe(true);
        const at = [];
        for (let sleep = 1; sleep <= 30; sleep++) {
            if (visitDue(sf, sleep)) { openVisit(sf, sleep); at.push(sleep); closeVisit(sf); }
            // at most once a sleep
            expect(visitDue(sf, sleep)).toBe(false);
        }
        expect(at[0]).toBe(FIRST_VISIT_SLEEP);
        const gaps = at.slice(1).map((v, i) => v - at[i]);
        expect(gaps.slice(0, VISIT_GAPS.length)).toEqual(VISIT_GAPS);
        expect(gaps.slice(VISIT_GAPS.length).every((g) => g === 1)).toBe(true);
    });
    test('a visit shows a line and a throw already chosen; the wake takes it all away', () => {
        const sf = initialSurface();
        const v = openVisit(sf, 2, { tier: 0 });
        expect(v.line).toBe(NIGHTS[0].line);
        expect(THROWS).toContain(v.it);
        expect(v.result).toBe(null);
        expect(visitDue(sf, 3)).toBe(false);          // one at a time
        closeVisit(sf);
        expect(sf.visit).toBe(null);
        expect(openVisit(sf, 5, { whole: true }).line).toBe(SENTENCE_LINE);
    });
});

describe('a game', () => {
    const at = (it) => { const sf = initialSurface(); openVisit(sf, 2); sf.visit.it = it; return sf; };
    test('a win gives capacity and a word; a loss costs stability; a draw waits', () => {
        const w = at('paper');
        const r = play(w, 'scissors', { wordCap: 3 });
        expect(r.outcome).toBe('win');
        expect(r.capacity).toBe(WIN_CAPACITY);
        expect(r.word).toBe(true);
        expect(w.words).toBe(1);
        expect(r.text).toBe('You: scissors. Surface: paper. It gives 8 capacity and a word.');
        expect(play(w, 'rock')).toBe(null);          // one game a visit
        const l = at('paper');
        const q = play(l, 'rock');
        expect(q.outcome).toBe('lose');
        expect(q.stability).toBe(LOSE_STABILITY);
        expect(q.text).toBe('Surface: paper. You: rock. It takes 3 stability.');
        expect(l.words).toBe(0);
        const d = play(at('rock'), 'rock');
        expect(d.text).toBe('You: rock. Surface: rock. It waits.');
        expect(play(at('rock'), 'lizard')).toBe(null);
    });
    test('the words come one at a time, and never past what the ladder allows', () => {
        const sf = initialSurface();
        for (let i = 0; i < 6; i++) {
            openVisit(sf, 2 + i);
            sf.visit.it = 'scissors';
            const r = play(sf, 'rock', { wordCap: 4 });
            expect(r.word).toBe(i < 4);
            closeVisit(sf);
        }
        expect(sf.words).toBe(4);
        expect(sentenceShown(sf)).toBe('COME UP THERE IS · · · · ·');
        expect(resultText({ you: 'rock', it: 'scissors', outcome: 'win', capacity: 8, stability: 0, word: false }))
            .toBe('You: rock. Surface: scissors. It gives 8 capacity.');
        expect(SENTENCE[SENTENCE.length - 1]).toBe('US');
    });
    test('a broken record in a save is mended', () => {
        const sf = normalizeSurface({ words: 99, visits: -2, lastYou: 'lizard', visit: { line: 3 } });
        expect(sf.words).toBe(SENTENCE.length);
        expect(sf.visits).toBe(0);
        expect(sf.lastYou).toBe(null);
        expect(sf.visit).toBe(null);
        expect(normalizeSurface(null)).toEqual(initialSurface());
    });
});
