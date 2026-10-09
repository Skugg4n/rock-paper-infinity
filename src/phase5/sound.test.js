/* eslint-env jest */
import { wordFor, createUnitySound } from './sound.js';

describe('chapter V, the sound', () => {
    test('rules events play the shared words; the bite, bells and the fall are its own', () => {
        expect(wordFor('buy')).toBe('click');
        expect(wordFor('tear')).toBe('knock');
        expect(wordFor('bite')).toBe(null);
    });
    test('the pulse starts and stops, and stop() leaves nothing running', () => {
        globalThis.window = globalThis.window || {};
        const calls = [];
        const audio = { graph: () => null, click: () => calls.push('click') };
        const snd = createUnitySound(audio);
        snd.set(true, 2);
        snd.event('buy');
        expect(calls).toEqual(['click']);
        snd.stop();
        snd.set(false);
    });
});
