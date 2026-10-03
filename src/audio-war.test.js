/* eslint-env jest */
import { drumBar, panForColumn, quantise, dronePitch, ourDrum, presentLayers, layerLevels, padVoices, handoverAt } from './audio-war.js';

describe('audio-war rules', () => {
    test('their drum: one bar is the landing interval, eight strokes; sixteen on a push and at the end', () => {
        expect(drumBar(40)).toEqual({ barLen: 40, beats: 8, beatLen: 5 });
        expect(drumBar(20).beatLen).toBe(2.5);
        expect(drumBar(20, { push: true }).beats).toBe(16);
        expect(drumBar(30, { doomsday: 74 }).beats).toBe(8);
        expect(drumBar(30, { doomsday: 75 }).beats).toBe(16);
        expect(drumBar(500).barLen).toBe(60);                       // a stray number never stops the drum
        expect(drumBar(undefined).barLen).toBe(40);
    });

    test('the pan follows the plate column: west left, east right, unknown in the middle', () => {
        expect(panForColumn(0)).toBe(-0.8);
        expect(panForColumn(2)).toBe(0);
        expect(panForColumn(4)).toBe(0.8);
        expect(panForColumn(1)).toBe(-0.4);
        expect(panForColumn(null)).toBe(0);
        expect(panForColumn(9)).toBe(0.8);
    });

    test('the quantiser takes the coarsest point of the beat within the allowed delay, never earlier', () => {
        const grid = { barStart: 10, beatLen: 4 };
        expect(quantise(13.8, grid, 0.6)).toBe(14);                // the beat itself
        expect(quantise(11.7, grid, 0.6)).toBe(12);                // the half beat
        expect(quantise(10.8, grid, 0.6)).toBe(11);                // a quarter
        expect(quantise(10.3, grid, 0.25)).toBe(10.5);             // an eighth
        expect(quantise(14, grid, 0.6)).toBe(14);                  // on the beat already
        const t = 10.01;
        expect(quantise(t, grid, 0.001)).toBe(t);                  // nothing close enough: the sound is not delayed
        expect(quantise(5, null, 1)).toBe(5);                      // no clock: at once
        for (const x of [10.1, 11.3, 12.9, 17.2]) {
            const q = quantise(x, grid, 0.6);
            expect(q).toBeGreaterThanOrEqual(x);
            expect(q - x).toBeLessThanOrEqual(0.6 + 1e-9);
        }
    });

    test('the doomsday drone glides from D to E flat as the clock goes to 85 %', () => {
        expect(dronePitch(0)).toBe(26);
        expect(dronePitch(42.5)).toBeCloseTo(26.5);
        expect(dronePitch(85)).toBe(27);
        expect(dronePitch(100)).toBe(27);
    });

    test('our drum answers when we lead, alternates when level, thins when behind', () => {
        expect(ourDrum(2)).toBe('answer');
        expect(ourDrum(1)).toBe('answer');
        expect(ourDrum(0)).toBe('alternate');
        expect(ourDrum(-1)).toBe('single');
    });

    test('layers arrive with the controls, one at a time', () => {
        expect(presentLayers({})).toEqual(['theirs', 'bass']);
        expect(presentLayers({ units: 3 })).toEqual(['theirs', 'bass', 'tones']);
        expect(presentLayers({ units: 3, shown: { strike: true } })).toEqual(['theirs', 'bass', 'tones', 'arms']);
        expect(presentLayers({ units: 3, landings: 1, shown: { strike: true, fort: true } })).toEqual(['theirs', 'bass', 'tones', 'arms', 'folk', 'drone']);
        expect(presentLayers({ landings: 2, shown: { tier: true } })).toContain('ours');
        expect(presentLayers({ lead: -1 })).toContain('ours');
        expect(presentLayers({ enemyTier: 3 })).not.toContain('shells');
        expect(presentLayers({ enemyTier: 4 })).toContain('shells');
    });

    test('the layer intensities follow the state', () => {
        const calm = layerLevels({ plates: [true, true, null], armsShare: 0, population: 1, doomsday: 0 });
        expect(calm.bassMidi).toBe(38);                            // D while every plate stands
        expect(calm.rumble).toBe(0);
        expect(calm.choir).toBeCloseTo(0.085);
        expect(calm.hum).toBeCloseTo(0.03);
        const hurt = layerLevels({ plates: [true, false], armsShare: 1, population: 0.3, doomsday: 70 });
        expect(hurt.bassMidi).toBe(33);                            // the low A while a plate is down
        expect(hurt.choir).toBe(0);                                // the far choir is gone with the people
        expect(hurt.hum).toBeCloseTo(0.07);
        expect(hurt.humHz).toBeGreaterThan(calm.humHz);           // toward hammers the factory brightens
        expect(hurt.rumble).toBeGreaterThan(0);                    // from 55 % the rocket rumbles
        expect(hurt.drone).toBeGreaterThan(calm.drone);
        expect(layerLevels({ doomsday: 54 }).rumble).toBe(0);
        expect(layerLevels({ doomsday: 85 }).rumble).toBeCloseTo(0.28);
    });

    test('one organ voice per plate: a razed or empty plate is a hole', () => {
        const v = padVoices([true, false, null, true, true, true]);
        expect(v).toHaveLength(20);
        expect(v.slice(0, 6).map((x) => x.on)).toEqual([true, false, false, true, true, true]);
        expect(v[0].pan).toBeLessThan(0);
        expect(v[4].pan).toBeGreaterThan(0);
        expect(v[5].pan).toBe(v[0].pan);                           // the next row starts on the west coast again
        expect(v[10].on).toBe(false);
    });

    test('the war takes over as the transition\'s bass fades', () => {
        expect(handoverAt({ LIFT: 13.6 })).toBeCloseTo(24);
    });
});
