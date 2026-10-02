/* eslint-env jest */
import { chordFor, threatFor, popLevel } from './audio-city.js';

describe('audio-city rules', () => {
    test('steps 1 and 2 are a neighbour, not a threat; 5 is the full threat', () => {
        expect(threatFor(0)).toBe(0);
        expect(threatFor(2)).toBe(0);
        expect(threatFor(3)).toBeCloseTo(1 / 3);
        expect(threatFor(5)).toBe(1);
    });

    test('the round darkens one chord at a time: F, then B♭, then C', () => {
        const names = (rival) => [0, 1, 2, 3].map((k) => chordFor(k, rival).name);
        expect(names(0)).toEqual(['Dm', 'B♭', 'F', 'C']);
        expect(names(2)).toEqual(['Dm', 'B♭', 'F', 'C']);
        expect(names(3)).toEqual(['Dm', 'B♭', 'Gm', 'C']);
        expect(names(4)).toEqual(['Dm', 'E♭', 'Gm', 'C']);
        expect(names(5)).toEqual(['Dm', 'E♭', 'Gm', 'A']);
    });

    test('the home chord never changes', () => {
        for (let r = 0; r <= 5; r++) expect(chordFor(0, r).name).toBe('Dm');
    });

    test('population maps to 0..1 with a village already audible', () => {
        expect(popLevel(0)).toBe(0);
        expect(popLevel(200)).toBeGreaterThan(0.09);
        expect(popLevel(200000)).toBe(1);
        expect(popLevel(1e9)).toBe(1);
    });
});
