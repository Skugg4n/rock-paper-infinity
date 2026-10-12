/* eslint-env jest */
import { JSDOM } from 'jsdom';

let mod;
beforeAll(async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window; global.document = dom.window.document;
    global.localStorage = dom.window.localStorage; global.sessionStorage = dom.window.sessionStorage;
    global.location = dom.window.location;
    mod = await import('./checkpoints.js');
});
afterAll(() => { delete global.window; delete global.document; delete global.localStorage; delete global.sessionStorage; delete global.location; });

test('clearGame drops the game keys and keeps the settings, the reached acts and the slots', () => {
    localStorage.setItem('rpi-save', '{}'); localStorage.setItem('rpi-phase', 'CITY');
    localStorage.setItem('rpi-reached', '["trivial"]'); localStorage.setItem('rpi-audio', '{}'); localStorage.setItem('rpi-slot-1', '{}');
    mod.clearGame();
    expect(localStorage.getItem('rpi-save')).toBeNull();
    expect(localStorage.getItem('rpi-phase')).toBeNull();
    expect(localStorage.getItem('rpi-reached')).toBe('["trivial"]');
    expect(localStorage.getItem('rpi-audio')).toBe('{}');
    expect(localStorage.getItem('rpi-slot-1')).toBe('{}');
});

test('the checkpoints the start screen starts acts from exist', () => {
    for (const id of ['i-start', 'ii-start', 'iii-start', 'iv-dig-start', 'iv-vault-start', 'v-start']) {
        expect(mod.CHECKPOINTS.find((c) => c.id === id)).toBeTruthy();
    }
});

test('a snapshot slot leaves the reached set out, so restoring it never shrinks the list', () => {
    localStorage.setItem('rpi-phase', 'CITY'); localStorage.setItem('rpi-reached', '["trivial","capital"]');
    mod.snapshot(0);
    const slot = JSON.parse(localStorage.getItem('rpi-slot-1'));
    expect(slot.data['rpi-phase']).toBe('CITY');
    expect(slot.data['rpi-reached']).toBeUndefined();
});
