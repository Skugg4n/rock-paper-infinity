/* eslint-env jest */
import { JSDOM } from 'jsdom';
import { setupDashes, updateDashes, updateProgressDashes, PROGRESS_DASHES } from './upgrade-dashes.js';

function makeButton() {
    const dom = new JSDOM('<button id="b"></button>');
    global.document = dom.window.document;
    return dom.window.document.getElementById('b');
}

describe('upgrade-dashes', () => {
    test('setupDashes renders one dash per level and a background ring', () => {
        const btn = makeButton();
        setupDashes(btn, 8);
        expect(btn.querySelectorAll('.upgrade-dash').length).toBe(8);
        expect(btn.querySelectorAll('.upgrade-dash-bg').length).toBe(1);
        setupDashes(btn, 8); // idempotent
        expect(btn.querySelectorAll('.upgrade-dashes').length).toBe(1);
    });

    test('updateDashes hides the first N dashes as levels are spent', () => {
        const btn = makeButton();
        setupDashes(btn, 5);
        updateDashes(btn, 2);
        const spent = [...btn.querySelectorAll('.upgrade-dash')].map(d => d.classList.contains('is-spent'));
        expect(spent).toEqual([true, true, false, false, false]);
    });

    test('updateProgressDashes shows dashes clockwise as the fraction grows', () => {
        const btn = makeButton();
        setupDashes(btn, PROGRESS_DASHES);
        updateProgressDashes(btn, 0.5);
        const visible = [...btn.querySelectorAll('.upgrade-dash')].filter(d => !d.classList.contains('is-spent')).length;
        expect(visible).toBe(PROGRESS_DASHES / 2);
        updateProgressDashes(btn, 0);
        expect(btn.querySelectorAll('.upgrade-dash:not(.is-spent)').length).toBe(0);
        updateProgressDashes(btn, 1.7);
        expect(btn.querySelectorAll('.upgrade-dash:not(.is-spent)').length).toBe(PROGRESS_DASHES);
        updateProgressDashes(btn, NaN);
        expect(btn.querySelectorAll('.upgrade-dash:not(.is-spent)').length).toBe(0);
    });
});
