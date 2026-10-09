/* eslint-env jest */
import {
    openingScript, scriptLines, pointAt, pointFlicks, POINT_MS, matchResult, destinyHand, actAfter,
    writeChoice, VERSION_OF, OTHER, HANDS, letterDelay, SAY, roundSteps, COUNT, COUNT_MS, RESULT_MS, REST_MS,
    CHOOSE_LINE, DEPART, DEEP_CARD, moveFocus, ACTS, DEPART_MS, blackVeil,
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

    test('a win lets the player choose, a loss holds the path, a draw plays again', () => {
        expect(actAfter('drone', 'win')).toBe('choose');
        expect(actAfter('vault', 'win')).toBe('choose');
        expect(actAfter('drone', 'lose')).toBe('drone');
        expect(actAfter('vault', 'lose')).toBe('vault');
        expect(actAfter('vault', 'draw')).toBe(null);
        expect(SAY).toEqual({ draw: 'Again.', win: 'You win.', lose: 'Destiny holds.', accept: 'So be it.' });
        expect(CHOOSE_LINE).toBe('You have beaten Destiny and may choose your path.');
    });

    test('the match counts to three, then both hands, the result, and a long rest', () => {
        expect(COUNT).toEqual(['1', '2', '3']);
        expect(COUNT_MS).toBe(600);
        for (const result of ['win', 'lose', 'draw']) {
            const s = roundSteps(result);
            expect(s).toEqual([
                { count: '1' }, { pause: 600 }, { count: '2' }, { pause: 600 }, { count: '3' }, { pause: 600 },
                { reveal: true }, { pause: RESULT_MS }, { say: SAY[result] }, { pause: REST_MS },
            ]);
        }
        expect(RESULT_MS).toBe(500);
        expect(REST_MS).toBeGreaterThanOrEqual(2500);
        // nothing is shown before the count is done: 1.8 s from the pick to the reveal
        const s = roundSteps('win');
        const before = s.slice(0, s.findIndex(x => x.reveal)).reduce((t, x) => t + (x.pause || 0), 0);
        expect(before).toBe(1800);
    });

    test('the winner picks with the arrows: left the drone, right the vault, no wrap', () => {
        expect(ACTS).toEqual(['drone', 'vault']);
        expect(moveFocus('drone', 'ArrowRight')).toBe('vault');
        expect(moveFocus('vault', 'ArrowRight')).toBe('vault');
        expect(moveFocus('vault', 'ArrowLeft')).toBe('drone');
        expect(moveFocus('drone', 'ArrowLeft')).toBe('drone');
        expect(moveFocus('vault', 'Enter')).toBe('vault');
    });

    test('both choices resolve to their chapter IV, with their departure line', () => {
        const store = {};
        const storage = { setItem: (k, v) => { store[k] = v; } };
        expect(writeChoice('vault', storage)).toBe('vault');
        expect(store[DEEP_VERSION_KEY]).toBe('vault');
        expect(DEPART.vault).toBe('You go deep into the vault.');
        expect(writeChoice('drone', storage)).toBe('dig');
        expect(store[DEEP_VERSION_KEY]).toBe('dig');
        expect(DEPART.drone).toBe('You go deep, as the drone.');
        expect(DEPART_MS).toBe(2000);
        expect(DEEP_CARD).toEqual({ roman: 'IV', title: 'DEEP', dark: true, slow: true, silent: true, hold: 5000 });
        expect(Object.values(DEPART).join(' ') + CHOOSE_LINE).not.toMatch(/\u2014/);
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
    test('the IV card\'s veil is black before it fades in, and its transition comes back (v1.91.1)', () => {
        const seen = [];
        const veil = { style: {}, get offsetWidth() { seen.push({ ...this.style }); return 0; } };
        expect(blackVeil(veil)).toBe(true);
        // the colour was set while the transition was held, then the transition was given back
        expect(seen[0]).toEqual({ transition: 'none', background: '#000' });
        expect(veil.style).toEqual({ transition: '', background: '#000' });
        expect(blackVeil(null)).toBe(false);
        expect(DEEP_CARD.dark && DEEP_CARD.slow).toBe(true);
    });
});
