/* eslint-env jest */
import { REACHED_KEY, ACT_IDS, ACT_OF_ROMAN, reachedSet, markReached, migrateReached } from './reached.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS } from './constants.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

const fake = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };

describe('the reached set', () => {
    test('empty without the key, broken JSON or unknown ids', () => {
        expect([...reachedSet(fake())]).toEqual([]);
        expect([...reachedSet(fake({ [REACHED_KEY]: '{nope' }))]).toEqual([]);
        expect([...reachedSet(fake({ [REACHED_KEY]: '["capital","moon"]' }))]).toEqual(['capital']);
        expect([...reachedSet(null)]).toEqual([]);
    });
    test('marking is a set, kept in the order of the acts', () => {
        const s = fake();
        markReached('war', s); markReached('trivial', s); markReached('war', s); markReached('nothing', s);
        expect(JSON.parse(s.m[REACHED_KEY])).toEqual(['trivial', 'war']);
        expect(ACT_IDS).toEqual(['trivial', 'capital', 'war', 'drone', 'vault', 'unity', 'infinity']);
        expect(ACT_OF_ROMAN).toEqual({ I: 'trivial', II: 'capital', III: 'war', V: 'unity', VI: 'infinity' });
    });
    test('migration reads the old saves once, and fills in the acts below', () => {
        const s = fake({ [PHASE1_CONSTANTS.SAVE_KEY]: '{}', [PHASE_KEY]: 'INDUSTRY' });
        expect([...migrateReached(s)]).toEqual(['trivial']);
        const city = fake({ [PHASE2_CONSTANTS.SAVE_KEY]: JSON.stringify({ war: false }), [PHASE_KEY]: 'CITY' });
        expect([...migrateReached(city)]).toEqual(['trivial', 'capital']);
        const war = fake({ [PHASE2_CONSTANTS.SAVE_KEY]: JSON.stringify({ war: true }), [PHASE_KEY]: 'CITY' });
        expect([...migrateReached(war)]).toEqual(['trivial', 'capital', 'war']);
        const fork = fake({ [PHASE2_CONSTANTS.SAVE_KEY]: JSON.stringify({ interimPending: true }) });
        expect([...migrateReached(fork)]).toEqual(['trivial', 'capital', 'war']);
        const dig = fake({ 'rpi-deep-dig': '{}', [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'dig' });
        expect([...migrateReached(dig)]).toEqual(['trivial', 'capital', 'war', 'drone']);
        const vault = fake({ [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'vault' });
        expect([...migrateReached(vault)]).toEqual(['trivial', 'capital', 'war', 'vault']);
        const colony = fake({ 'rpi-deep': '{}', [PHASE_KEY]: 'DEEP' });
        expect([...migrateReached(colony)]).toEqual(['trivial', 'capital', 'war']);
        const unity = fake({ 'rpi-unity': '{}', [PHASE_KEY]: 'UNITY' });
        expect([...migrateReached(unity)]).toEqual(['trivial', 'capital', 'war', 'unity']);
    });
    test('migration writes the key, and never runs twice', () => {
        const s = fake({ [PHASE1_CONSTANTS.SAVE_KEY]: '{}' });
        migrateReached(s);
        expect(s.m[REACHED_KEY]).toBe('["trivial"]');
        s.m[PHASE2_CONSTANTS.SAVE_KEY] = '{}';
        expect([...migrateReached(s)]).toEqual(['trivial']);
        const fresh = fake();
        migrateReached(fresh);
        expect(fresh.m[REACHED_KEY]).toBe('[]');
    });
});
