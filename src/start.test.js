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

import { JSDOM } from 'jsdom';
import { jest } from '@jest/globals';

describe('the screen', () => {
    let dom, showStart, prefs, setPref;
    beforeEach(async () => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
        global.window = dom.window; global.document = dom.window.document; global.localStorage = dom.window.localStorage;
        global.CustomEvent = dom.window.CustomEvent; global.KeyboardEvent = dom.window.KeyboardEvent;
        prefs = { sfx: true, music: false };
        setPref = jest.fn((n, on) => { prefs[n] = on; });
        jest.resetModules();
        jest.unstable_mockModule('./audio.js', () => ({ audio: { getPrefs: () => ({ ...prefs }), setPref } }));
        ({ showStart } = await import('./start.js'));
    });
    afterEach(() => { delete global.window; delete global.document; delete global.localStorage; delete global.CustomEvent; delete global.KeyboardEvent; });
    const text = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim());

    test('a new player: the title, START, no New game, no rows; START is the choice', async () => {
        const s = showStart({ version: 'v9.9.9' });
        expect(document.body.classList.contains('start-up')).toBe(true);
        expect(document.querySelector('.start-title').textContent).toBe('ROCK PAPER INFINITY');
        expect(document.querySelector('.start-title .start-letter').style.animationDelay).toBe('300ms');
        expect(document.querySelector('[data-start="primary"]').textContent).toBe('START');
        expect(document.querySelector('[data-start="new"]')).toBeNull();
        expect(document.querySelectorAll('.start-acts li').length).toBe(0);
        expect(document.querySelector('.start-version').textContent).toBe('v9.9.9');
        expect(text('[data-pref]')).toEqual(['Sound · on', 'Music · off']);
        document.querySelector('[data-start="primary"]').click();
        expect(await s.choice).toEqual({ kind: 'new' });
        s.lift();
        expect(document.getElementById('start-screen')).toBeNull();
        expect(document.body.classList.contains('start-up')).toBe(false);
    });

    test('a returning player: CONTINUE with the line, New game asks first, the rows', async () => {
        localStorage.setItem('rpi-phase', 'DEEP'); localStorage.setItem('rpi-deep-version', 'dig');
        localStorage.setItem('rpi-reached', JSON.stringify(['trivial', 'capital', 'war', 'drone']));
        const s = showStart({ version: 'v1' });
        expect(document.querySelector('[data-start="primary"]').textContent).toBe('CONTINUE');
        expect(document.querySelector('.start-where').textContent).toBe('IV · Deep, the drone');
        expect(text('.start-acts li')).toEqual(['I Trivial', 'II Capital', 'III War', 'IV Deep · Drone', 'IV Deep · Vault']);
        expect([...document.querySelectorAll('.start-acts li')].map((li) => li.dataset.state)).toEqual(['reached', 'reached', 'reached', 'now', 'grey']);
        document.querySelector('[data-start="new"]').click();
        const confirm = document.querySelector('.start-confirm');
        expect(confirm.hidden).toBe(false);
        expect(confirm.querySelector('.start-confirm-text').textContent).toBe('Your game will be erased.');
        expect(text('.start-confirm button')).toEqual(['Start over', 'Keep']);
        confirm.querySelector('[data-confirm="no"]').click();
        expect(confirm.hidden).toBe(true);
        document.querySelector('[data-start="new"]').click();
        confirm.querySelector('[data-confirm="yes"]').click();
        expect(await s.choice).toEqual({ kind: 'new' });
    });

    test('an act: the current one continues, a reached one asks then starts again, a grey one does nothing', async () => {
        localStorage.setItem('rpi-phase', 'DEEP'); localStorage.setItem('rpi-deep-version', 'dig');
        localStorage.setItem('rpi-reached', JSON.stringify(['trivial', 'capital', 'war', 'drone']));
        let s = showStart({ version: 'v1' });
        document.querySelector('.start-acts li[data-id="vault"]').click();
        expect(document.querySelector('.start-confirm').hidden).toBe(true);
        document.querySelector('.start-acts li[data-id="war"]').click();
        const confirm = document.querySelector('.start-confirm');
        expect(confirm.hidden).toBe(false);
        expect(confirm.querySelector('.start-confirm-text').textContent).toBe('Starting III · War again replaces your game.');
        expect(confirm.querySelector('[data-confirm="yes"]').textContent).toBe('Play again');
        confirm.querySelector('[data-confirm="yes"]').click();
        expect(await s.choice).toEqual({ kind: 'act', id: 'war' });
        s.lift();
        s = showStart({ version: 'v1' });
        document.querySelector('.start-acts li[data-id="drone"]').click();
        expect(await s.choice).toEqual({ kind: 'continue' });
        s.lift();
    });

    test('Enter is the primary word; the toggles set the preference and tell the menu', async () => {
        localStorage.setItem('rpi-phase', 'INDUSTRY'); localStorage.setItem('rpi-reached', '["trivial"]');
        const s = showStart({ version: 'v1' });
        const told = jest.fn(); window.addEventListener('rpi-audio-change', told);
        document.querySelector('[data-pref="music"]').click();
        expect(setPref).toHaveBeenCalledWith('music', true);
        expect(document.querySelector('[data-pref="music"]').textContent).toBe('Music · on');
        expect(told).toHaveBeenCalled();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(await s.choice).toEqual({ kind: 'continue' });
        s.lift();
    });
    test('the title: three nowrap words, 17 letters, PAPER starts at 650ms', () => {
        const s = showStart();
        expect(document.querySelectorAll('.start-title .start-word-wrap').length).toBe(3);
        expect(document.querySelectorAll('.start-title .start-letter').length).toBe(17);
        expect(document.querySelectorAll('.start-title .start-word-wrap')[1].querySelector('.start-letter').style.animationDelay).toBe('650ms');
        s.lift();
    });

    test('Escape closes the question and focus returns to New game', () => {
        localStorage.setItem('rpi-phase', 'INDUSTRY'); localStorage.setItem('rpi-reached', '["trivial"]');
        const s = showStart();
        const newBtn = document.querySelector('[data-start="new"]');
        newBtn.focus();
        newBtn.click();
        expect(document.activeElement.dataset.confirm).toBe('no');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('.start-confirm').hidden).toBe(true);
        expect(document.activeElement).toBe(newBtn);
        s.lift();
    });

    test('after lift() Enter resolves nothing', async () => {
        const s = showStart();
        s.lift();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const sentinel = Symbol('pending');
        expect(await Promise.race([s.choice, Promise.resolve(sentinel)])).toBe(sentinel);
    });

    test('a reached act with no game starts at once, no question', async () => {
        localStorage.setItem('rpi-reached', '["trivial","capital"]');
        const s = showStart();
        document.querySelector('.start-acts li[data-id="capital"]').click();
        expect(await s.choice).toEqual({ kind: 'act', id: 'capital' });
        expect(document.querySelector('.start-confirm').hidden).toBe(true);
        s.lift();
    });

    test('the act question sits in an li inside the list, gone after Keep; Space opens a row', () => {
        localStorage.setItem('rpi-phase', 'INDUSTRY'); localStorage.setItem('rpi-reached', '["trivial","capital"]');
        const s = showStart();
        const row = document.querySelector('.start-acts li[data-id="capital"]');
        row.focus();
        const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        document.dispatchEvent(space);
        expect(space.defaultPrevented).toBe(true);
        const wrapper = document.querySelector('.start-acts > li.start-confirm-row');
        expect(wrapper).not.toBeNull();
        expect(wrapper.previousElementSibling).toBe(row);
        expect(wrapper.querySelector('.start-confirm').hidden).toBe(false);
        wrapper.querySelector('[data-confirm="no"]').click();
        expect(document.querySelector('.start-confirm-row')).toBeNull();
        expect(document.querySelector('.start-confirm').hidden).toBe(true);
        s.lift();
    });
});
