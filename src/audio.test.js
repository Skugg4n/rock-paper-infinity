/* eslint-env jest */
import { audio, pentaNote, bpmFor, layersFor, readPrefs, PLING_LIMIT } from './audio.js';

describe('sound: the rules', () => {
    test('pentaNote climbs the D minor pentatonic through the octaves', () => {
        expect([0, 1, 2, 3, 4].map((i) => pentaNote(i))).toEqual([74, 77, 79, 81, 84]);
        expect(pentaNote(5)).toBe(86);
        expect(pentaNote(10)).toBe(98);
    });

    test('the tempo follows the speed, within 58 and 128', () => {
        expect(bpmFor(0)).toBe(58);
        expect(bpmFor(0.5)).toBe(58);
        expect(bpmFor(10)).toBeGreaterThan(85);
        expect(bpmFor(10)).toBeLessThan(100);
        expect(bpmFor(370)).toBe(128);
        expect(bpmFor(1e9)).toBe(128);
        expect(bpmFor(40)).toBeGreaterThan(bpmFor(10));
    });

    test('layers arrive with the machine: pulse at 3, bass at 10, shimmer when wins are too close', () => {
        const s = (over) => ({ gps: 1, wins: 0.3, battery: 1, gen: 0, boards: 1, ...over });
        expect(layersFor(s({}))).toEqual({ pulse: false, hat: false, bass: false, arp: false, pad: false, hum: false });
        expect(layersFor(s({ gps: 3 })).pulse).toBe(true);
        expect(layersFor(s({ gps: 9.9 })).bass).toBe(false);
        expect(layersFor(s({ gps: 10 })).bass).toBe(true);
        expect(layersFor(s({ wins: PLING_LIMIT - 0.1 })).arp).toBe(false);
        expect(layersFor(s({ wins: PLING_LIMIT })).arp).toBe(true);
        expect(layersFor(s({ boards: 2 })).pad).toBe(true);
        expect(layersFor(s({ gen: 0.02 })).hum).toBe(true);
    });

    test('an empty battery leaves only the pulse', () => {
        const L = layersFor({ gps: 40, wins: 20, battery: 0, gen: 1, boards: 9 });
        expect(L).toEqual({ pulse: true, hat: false, bass: false, arp: false, pad: false, hum: false });
    });

    test('saved choices: everything is on unless switched off, and junk is ignored', () => {
        expect(readPrefs(null)).toEqual({ sfx: true, music: true });
        expect(readPrefs('{"sfx":false}')).toEqual({ sfx: false, music: true });
        expect(readPrefs('{"sfx":true,"music":false}')).toEqual({ sfx: true, music: false });
        expect(readPrefs('not json')).toEqual({ sfx: true, music: true });
        expect(readPrefs('null')).toEqual({ sfx: true, music: true });
    });

    test('without a browser every sound is a quiet no-op', () => {
        expect(() => {
            audio.click(); audio.pling(); audio.thunk(); audio.rise(); audio.lucky(); audio.knock(); audio.swell(true);
            audio.machine({ running: true, gps: 20, wins: 10, battery: 1, gen: 0.5, boards: 3 });
            audio.stopMachine();
        }).not.toThrow();
    });
});
