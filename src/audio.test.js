/* eslint-env jest */
import { audio, pentaNote, bpmFor, intensitiesFor, ramp, approach, readPrefs } from './audio.js';

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

    test('ramp: 0 below, 1 above, a straight line between', () => {
        expect(ramp(0, 1, 3)).toBe(0);
        expect(ramp(1, 1, 3)).toBe(0);
        expect(ramp(2, 1, 3)).toBe(0.5);
        expect(ramp(3, 1, 3)).toBe(1);
        expect(ramp(99, 1, 3)).toBe(1);
    });

    test('every layer creeps in: nothing at a crawl, everything at factory speed', () => {
        const s = (over) => ({ gps: 0.6, wins: 0.2, battery: 1, gen: 0, boards: 1, ...over });
        const crawl = intensitiesFor(s({}));
        for (const k of Object.keys(crawl)) expect(crawl[k]).toBe(0);
        const factory = intensitiesFor(s({ gps: 370, wins: 247, gen: 1, boards: 9 }));
        for (const k of Object.keys(factory)) expect(factory[k]).toBe(1);
        expect(intensitiesFor(s({ gps: 2 })).pulse).toBeCloseTo(0.5);
        expect(intensitiesFor(s({ gps: 10 })).bass).toBeCloseTo(0.5);
        expect(intensitiesFor(s({ wins: 5.5 })).arp).toBeCloseTo(0.5);
    });

    test('no layer takes a step: a small change in speed is a small change in sound', () => {
        let prev = intensitiesFor({ gps: 0.5, wins: 0.5 / 3, battery: 1, gen: 0.5, boards: 3 });
        for (let gps = 0.5; gps < 400; gps *= 1.02) {
            const now = intensitiesFor({ gps, wins: gps / 3, battery: 1, gen: 0.5, boards: 3 });
            for (const k of Object.keys(now)) {
                expect(now[k]).toBeGreaterThanOrEqual(prev[k]);            // only ever more
                expect(now[k] - prev[k]).toBeLessThan(0.08);               // and never much at once
            }
            prev = now;
        }
    });

    test('an empty battery leaves only the pulse', () => {
        const L = intensitiesFor({ gps: 40, wins: 20, battery: 0, gen: 1, boards: 9 });
        expect(L.pulse).toBe(1);
        for (const k of Object.keys(L)) if (k !== 'pulse') expect(L[k]).toBe(0);
    });

    test('approach glides: 63 % of the way in one time constant, never past the target', () => {
        expect(approach(0, 1, 3, 3)).toBeCloseTo(0.632, 2);
        expect(approach(1, 0, 0.8, 0.8)).toBeCloseTo(0.368, 2);
        expect(approach(0.5, 0.5, 1, 3)).toBe(0.5);
        let x = 76;                                   // the tempo before the jump at speed ten
        for (let i = 0; i < 40; i++) { const next = approach(x, 92, 0.025, 3.5); expect(next - x).toBeLessThan(0.2); x = next; }
        expect(x).toBeLessThan(92);
        expect(approach(0, 1, 1, 0)).toBe(1);
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
            expect(audio.finale()).toBe(false);
            audio.begin();
        }).not.toThrow();
    });
});
