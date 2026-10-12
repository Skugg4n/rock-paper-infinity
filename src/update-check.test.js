/* eslint-env jest */
import { jest } from '@jest/globals';
import { versionIn, decide, OFFER, startUpdateCheck, AWAY_MS, CHECK_EVERY_MS } from './update-check.js';

describe('updates reach the player (B460)', () => {
    test('the version is read out of src/version.js', () => {
        expect(versionIn("export const VERSION = 'v1.94.0';\n")).toBe('v1.94.0');
        expect(versionIn('')).toBeNull();
        expect(versionIn(null)).toBeNull();
        expect(versionIn('<html>404</html>')).toBeNull();
    });
    test('same or unknown: nothing; new on the start screen or after a long absence: reload; else offer', () => {
        expect(decide({ running: 'v1', latest: 'v1' })).toBe('none');
        expect(decide({ running: 'v1', latest: null })).toBe('none');
        expect(decide({ running: 'v1', latest: 'v2' })).toBe('offer');
        expect(decide({ running: 'v1', latest: 'v2', startUp: true })).toBe('reload');
        expect(decide({ running: 'v1', latest: 'v2', awayMs: AWAY_MS })).toBe('reload');
        expect(decide({ running: 'v1', latest: 'v2', awayMs: AWAY_MS - 1 })).toBe('offer');
        expect(OFFER('v2')).toBe('v2 is here · reload');
        expect(OFFER('v2')).not.toMatch(/\u2014/);
        expect(CHECK_EVERY_MS).toBe(600000);
    });
    test('the timer checks, the tab coming back checks with its absence, a failed fetch is nothing', async () => {
        jest.useFakeTimers();
        let t = 1000;
        const listeners = {};
        const doc = { visibilityState: 'visible', addEventListener: (n, f) => { listeners[n] = f; }, removeEventListener: () => { delete listeners.visibilitychange; } };
        const decisions = [];
        let text = "export const VERSION = 'v1';";
        const h = startUpdateCheck({ running: 'v1', fetchText: async () => text, onDecision: (a, v) => decisions.push([a, v]), doc, now: () => t });
        expect(await h.check()).toBe('none');
        text = "export const VERSION = 'v2';";
        expect(await h.check()).toBe('offer');
        doc.visibilityState = 'hidden'; listeners.visibilitychange();
        t += AWAY_MS; doc.visibilityState = 'visible'; listeners.visibilitychange();
        await Promise.resolve();
        expect(decisions.at(-1)).toEqual(['reload', 'v2']);
        const failing = startUpdateCheck({ running: 'v1', fetchText: async () => { throw new Error('offline'); }, onDecision: () => { throw new Error('must not decide'); }, doc, now: () => t });
        expect(await failing.check()).toBe('none');
        h.stop(); failing.stop();
        expect(listeners.visibilitychange).toBeUndefined();
        jest.useRealTimers();
    });
});
