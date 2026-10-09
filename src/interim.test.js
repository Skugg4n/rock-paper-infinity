/* eslint-env jest */
import {
    openingScript, scriptLines, pointAt, pointFlicks, POINT_MS, matchResult, destinyHand, actAfter,
    writeChoice, VERSION_OF, OTHER, HANDS, letterDelay, SAY,
} from './interim.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('the interim', () => {
    test('the lines are Ola\'s, with their pauses', () => {
        const s = openingScript('drone');
        expect(scriptLines(s)).toEqual([
            'As the Earth fails there is a divergence in the path of destiny and a choice has to be made.',
            'In one reality there was a drone.',
            'In the other, a vault.',
            'Destiny points to the drone.',
            'But you may choose to oppose.',
        ]);
        expect(s.filter(x => x.pause).map(x => x.pause)).toEqual([900, 900, 1400, 900, 1400, 1000]);
        expect(scriptLines(openingScript('vault'))[3]).toBe('Destiny points to the vault.');
        // the icons follow their lines, the needle comes before the pointed act is named
        const i = s.findIndex(x => x.point);
        expect(s[i - 1].type).toBe('Destiny points to ');
        expect(s.filter(x => x.icon).map(x => x.icon)).toEqual(['drone', 'vault']);
        expect(s[s.length - 1].choice).toBe(true);
        expect(scriptLines(s).join(' ')).not.toMatch(/\u2014/);
    });

    test('letters 28 ms, spaces 45 ms', () => {
        expect(letterDelay('a')).toBe(28);
        expect(letterDelay(' ')).toBe(45);
    });

    test('Destiny points 50/50 from the rng', () => {
        expect(pointAt(() => 0.1)).toBe('drone');
        expect(pointAt(() => 0.49)).toBe('drone');
        expect(pointAt(() => 0.5)).toBe('vault');
        expect(pointAt(() => 0.99)).toBe('vault');
    });

    test('the needle slows and settles on the target', () => {
        for (const target of ['drone', 'vault']) {
            const f = pointFlicks(target);
            expect(f[f.length - 1].lit).toBe(target);
            expect(f[f.length - 1].at).toBeLessThan(POINT_MS);
            expect(f[f.length - 1].at).toBeGreaterThan(POINT_MS * 0.6);
            // back and forth
            for (let i = 1; i < f.length; i++) expect(f[i].lit).toBe(OTHER[f[i - 1].lit]);
            // slowing (the last gap is the remainder)
            const gaps = f.slice(1).map((x, i) => x.at - f[i].at);
            for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]);
            expect(f.length).toBeGreaterThan(8);
        }
        expect(pointFlicks('vault', POINT_MS, true)).toEqual([{ at: 0, lit: 'vault' }]);
        expect(pointFlicks('drone', 700).slice(-1)[0].lit).toBe('drone');
    });

    test('rock paper scissors', () => {
        expect(matchResult('rock', 'scissors')).toBe('win');
        expect(matchResult('paper', 'rock')).toBe('win');
        expect(matchResult('scissors', 'paper')).toBe('win');
        expect(matchResult('rock', 'paper')).toBe('lose');
        expect(matchResult('paper', 'scissors')).toBe('lose');
        expect(matchResult('scissors', 'rock')).toBe('lose');
        for (const h of HANDS) expect(matchResult(h, h)).toBe('draw');
    });

    test('Destiny\'s hand is uniform over the three', () => {
        expect(destinyHand(() => 0)).toBe('rock');
        expect(destinyHand(() => 0.34)).toBe('paper');
        expect(destinyHand(() => 0.67)).toBe('scissors');
        expect(destinyHand(() => 0.9999999)).toBe('scissors');
        const r = seq(0.1, 0.5, 0.9);
        expect([destinyHand(r), destinyHand(r), destinyHand(r)]).toEqual(HANDS);
    });

    test('a win turns the path, a loss holds it, a draw plays again', () => {
        expect(actAfter('drone', 'win')).toBe('vault');
        expect(actAfter('vault', 'win')).toBe('drone');
        expect(actAfter('drone', 'lose')).toBe('drone');
        expect(actAfter('vault', 'lose')).toBe('vault');
        expect(actAfter('vault', 'draw')).toBe(null);
        expect(SAY).toEqual({ draw: 'Again.', win: 'You win. The path turns.', lose: 'Destiny holds.', accept: 'So be it.' });
    });

    test('the version written is the vault or the dig, never the colony', () => {
        const store = {};
        const storage = { setItem: (k, v) => { store[k] = v; } };
        expect(writeChoice('drone', storage)).toBe('dig');
        expect(store[DEEP_VERSION_KEY]).toBe('dig');
        expect(writeChoice('vault', storage)).toBe('vault');
        expect(store[DEEP_VERSION_KEY]).toBe('vault');
        expect(Object.values(VERSION_OF)).not.toContain('colony');
        expect(() => writeChoice('colony', storage)).toThrow();
        // a storage that throws still gives the version
        expect(writeChoice('drone', { setItem: () => { throw new Error('full'); } })).toBe('dig');
    });
});
