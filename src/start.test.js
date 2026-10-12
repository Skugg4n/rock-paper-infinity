/* eslint-env jest */
import { ACTS, CARD_OF, WORDS, whereIs, startModel } from './start.js';
import { REACHED_KEY, PHASE_KEY, PHASE2_CONSTANTS } from './constants.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

const fake = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };
const reached = (...ids) => JSON.stringify(ids);
const rows = (model) => model.acts.map((a) => `${a.roman} ${a.name} ${a.state}`);

describe('where the game is', () => {
    test('nothing without a phase', () => { expect(whereIs(fake())).toBeNull(); });
    test('one line per phase and save', () => {
        expect(whereIs(fake({ [PHASE_KEY]: 'INDUSTRY' }))).toEqual({ id: 'trivial', label: 'I · Trivial' });
        expect(whereIs(fake({ [PHASE_KEY]: 'CITY', [PHASE2_CONSTANTS.SAVE_KEY]: '{"war":false}' }))).toEqual({ id: 'capital', label: 'II · Capital' });
        expect(whereIs(fake({ [PHASE_KEY]: 'CITY', [PHASE2_CONSTANTS.SAVE_KEY]: '{"war":true}' }))).toEqual({ id: 'war', label: 'III · War' });
        expect(whereIs(fake({ [PHASE_KEY]: 'CITY', [PHASE2_CONSTANTS.SAVE_KEY]: '{"war":true,"interimPending":true}' }))).toEqual({ id: 'war', label: 'The fork' });
        expect(whereIs(fake({ [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'dig' }))).toEqual({ id: 'drone', label: 'IV · Deep, the drone' });
        expect(whereIs(fake({ [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'vault' }))).toEqual({ id: 'vault', label: 'IV · Deep, the vault' });
        expect(whereIs(fake({ [PHASE_KEY]: 'DEEP' }))).toEqual({ id: null, label: 'IV · Deep' });
        expect(whereIs(fake({ [PHASE_KEY]: 'UNITY' }))).toEqual({ id: 'unity', label: 'V · Unity' });
    });
});

describe('the start model', () => {
    test('a new player: fresh, nothing to continue, no rows', () => {
        expect(startModel(fake())).toEqual({ fresh: true, continueTo: null, acts: [] });
    });
    test('only the acts reached are listed, the current one marked', () => {
        const m = startModel(fake({ [PHASE_KEY]: 'CITY', [PHASE2_CONSTANTS.SAVE_KEY]: '{"war":false}', [REACHED_KEY]: reached('trivial', 'capital') }));
        expect(m.fresh).toBe(false);
        expect(m.continueTo).toEqual({ phase: 'CITY', label: 'II · Capital' });
        expect(rows(m)).toEqual(['I Trivial reached', 'II Capital now']);
    });
    test('one chapter IV reached shows both, the other grey; both reached, both black', () => {
        const drone = startModel(fake({ [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'dig', [REACHED_KEY]: reached('trivial', 'capital', 'war', 'drone') }));
        expect(rows(drone)).toEqual(['I Trivial reached', 'II Capital reached', 'III War reached', 'IV Deep · Drone now', 'IV Deep · Vault grey']);
        const both = startModel(fake({ [PHASE_KEY]: 'INDUSTRY', [REACHED_KEY]: reached('trivial', 'capital', 'war', 'drone', 'vault') }));
        expect(rows(both)).toEqual(['I Trivial now', 'II Capital reached', 'III War reached', 'IV Deep · Drone reached', 'IV Deep · Vault reached']);
    });
    test('V plays again; VI is the tease, grey, only once reached', () => {
        const m = startModel(fake({ [PHASE_KEY]: 'UNITY', [REACHED_KEY]: reached('trivial', 'capital', 'war', 'vault', 'unity', 'infinity') }));
        expect(rows(m).slice(-2)).toEqual(['V Unity now', 'VI Infinity grey']);
        const noVi = startModel(fake({ [PHASE_KEY]: 'UNITY', [REACHED_KEY]: reached('trivial', 'capital', 'war', 'vault', 'unity') }));
        expect(rows(noVi).at(-1)).toBe('V Unity now');
    });
    test('the table, the cards and the words', () => {
        expect(ACTS.map((a) => a.id)).toEqual(['trivial', 'capital', 'war', 'drone', 'vault', 'unity', 'infinity']);
        expect(ACTS.find((a) => a.id === 'drone').checkpoint).toBe('iv-dig-start');
        expect(ACTS.find((a) => a.id === 'vault').checkpoint).toBe('iv-vault-start');
        expect(ACTS.find((a) => a.id === 'unity').checkpoint).toBe('v-start');
        expect(ACTS.find((a) => a.id === 'infinity').checkpoint).toBeNull();
        expect(CARD_OF.war).toEqual({ roman: 'III', title: 'WAR', dark: true, slow: true, pause: 1400, hold: 5000 });
        expect(CARD_OF.vault).toEqual({ roman: 'IV', title: 'DEEP', dark: true, slow: true, hold: 5000 });
        expect(CARD_OF.infinity).toBeUndefined();
        expect(WORDS.title).toBe('ROCK PAPER INFINITY');
        expect(WORDS.replaces('III · War')).toBe('Starting III · War again replaces your game.');
        expect(JSON.stringify(WORDS)).not.toMatch(/—/);
    });
});
