/* eslint-env jest */
import { jest } from '@jest/globals';
import { exportSave, importSave } from './save-export.js';

// Minimal localStorage mock
function makeStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem: (k) => data[k] ?? null,
        setItem: (k, v) => { data[k] = v; },
        removeItem: (k) => { delete data[k]; },
        _data: data,
    };
}

beforeEach(() => {
    global.localStorage = makeStorage();
    // btoa/atob are available in Node 16+ but set them explicitly for safety
    global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
    global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
});

afterEach(() => {
    delete global.localStorage;
    delete global.btoa;
    delete global.atob;
});

describe('exportSave', () => {
    test('returns a non-empty base64 string', () => {
        const result = exportSave();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    test('encoded blob includes expected keys', () => {
        global.localStorage = makeStorage({
            'rpi-save': '{"starBalance":42}',
            'rpi-stage2': '{"stars":100}',
            'rpi-stars': '999',
            'rpi-phase': 'INDUSTRY',
        });
        const encoded = exportSave();
        const blob = JSON.parse(atob(encoded));
        expect(blob.phase1).toBe('{"starBalance":42}');
        expect(blob.phase2).toBe('{"stars":100}');
        expect(blob.stars).toBe('999');
        expect(blob.phase).toBe('INDUSTRY');
        expect(typeof blob.timestamp).toBe('number');
        expect(blob.schemaVersion).toBe(1);
    });

    test('uses empty strings for missing keys', () => {
        const encoded = exportSave();
        const blob = JSON.parse(atob(encoded));
        expect(blob.phase1).toBe('');
        expect(blob.phase2).toBe('');
    });
});

describe('importSave', () => {
    test('returns ok:false for null input', () => {
        expect(importSave(null)).toEqual({ ok: false, error: expect.any(String) });
    });

    test('returns ok:false for empty string', () => {
        expect(importSave('')).toEqual({ ok: false, error: expect.any(String) });
    });

    test('returns ok:false for garbage base64', () => {
        expect(importSave('not-valid-base64!!')).toEqual({ ok: false, error: expect.any(String) });
    });

    test('returns ok:false for valid base64 but non-JSON content', () => {
        const encoded = btoa('hello world');
        expect(importSave(encoded)).toEqual({ ok: false, error: expect.any(String) });
    });

    test('returns ok:false for future schemaVersion', () => {
        const blob = JSON.stringify({ schemaVersion: 999, phase1: '', phase2: '', stars: '', phase: '' });
        const encoded = btoa(blob);
        expect(importSave(encoded)).toEqual({ ok: false, error: expect.stringContaining('999') });
    });

    test('round-trips: exportSave then importSave restores all keys', () => {
        global.localStorage = makeStorage({
            'rpi-save': '{"starBalance":99}',
            'rpi-stage2': '{"stars":500}',
            'rpi-stars': '123',
            'rpi-phase': 'CITY',
        });

        const encoded = exportSave();

        // Clear storage to simulate a fresh browser
        global.localStorage = makeStorage();
        const result = importSave(encoded);
        expect(result).toEqual({ ok: true });

        expect(global.localStorage.getItem('rpi-save')).toBe('{"starBalance":99}');
        expect(global.localStorage.getItem('rpi-stage2')).toBe('{"stars":500}');
        expect(global.localStorage.getItem('rpi-stars')).toBe('123');
        expect(global.localStorage.getItem('rpi-phase')).toBe('CITY');
    });

    test('importSave removes keys that were empty in the export', () => {
        // Pre-populate storage with a key that was NOT in the export blob
        global.localStorage = makeStorage({
            'rpi-save': '{"starBalance":10}',
        });

        // Export has empty phase1 (no save exists for it in the source)
        const blob = JSON.stringify({
            schemaVersion: 1,
            phase1: '',
            phase2: '',
            stars: '',
            phase: '',
            timestamp: Date.now(),
        });
        const encoded = btoa(blob);
        const result = importSave(encoded);
        expect(result).toEqual({ ok: true });
        // The empty phase1 should have caused removeItem to be called
        expect(global.localStorage.getItem('rpi-save')).toBeNull();
    });
});
