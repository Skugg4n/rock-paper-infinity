/* eslint-env jest */
/*
 * v1.49.0: Surface, the other presence in the dark. The seeded throw, the win table, the lines by
 * stage, the visits, the sentence, and what a game says.
 */
import {
    THROWS, THROW_ICON, beats, counter, outcome, SENTENCE, SENTENCE_LINE, WIN_CAPACITY, LOSE_STABILITY,
    FIRST_VISIT_SLEEP, VISIT_GAPS, LINES, STAGE_AT, stageOf, lineFor, surfaceThrow, initialSurface,
    normalizeSurface, visitDue, openVisit, closeVisit, resultText, play, sentenceShown,
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

describe('the lines drift', () => {
    test('neutral, then unsettling, then intimate, by the visits', () => {
        expect(stageOf(0)).toBe(0);
        expect(stageOf(STAGE_AT[1] - 1)).toBe(0);
        expect(stageOf(STAGE_AT[1])).toBe(1);
        expect(stageOf(STAGE_AT[2])).toBe(2);
        expect(stageOf(500)).toBe(2);
        expect(LINES[0]).toContain(lineFor(1, 1));
        expect(LINES[1]).toContain(lineFor(1, STAGE_AT[1] + 1));
        expect(LINES[2]).toContain(lineFor(1, STAGE_AT[2] + 1));
        expect(LINES[0]).toContain('It is quiet up here.');
        expect(LINES[1]).toContain('Why do you keep them cold?');
        expect(LINES[2]).toContain('You could come up alone.');
        // short, plain, no dashes of any kind
        for (const l of LINES.flat()) {
            expect(l.length).toBeLessThan(40);
            expect(l).not.toMatch(/[‒-―-]/);
        }
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
        const v = openVisit(sf, 2);
        expect(LINES[0]).toContain(v.line);
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
