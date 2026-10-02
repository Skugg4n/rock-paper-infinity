/* eslint-env jest */
import { JSDOM } from 'jsdom';

let askDeepGate;
let dom;

const GATE = `
<div id="deep-gate" class="deep-gate" aria-hidden="true">
  <button data-deep-gate="go">Go deep</button>
  <button data-deep-gate="stay">Stay</button>
</div>`;

async function load(html) {
    dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
    global.document = dom.window.document;
    ({ askDeepGate } = await import('./deepGate.js'));
}
const gate = () => document.getElementById('deep-gate');
const click = (which) => gate().querySelector(`[data-deep-gate="${which}"]`).click();

describe('the gate before IV · THE DEEP', () => {
    test('opens, and "Go deep" answers yes and closes it', async () => {
        await load(GATE);
        const answer = askDeepGate();
        expect(gate().classList.contains('is-open')).toBe(true);
        expect(gate().getAttribute('aria-hidden')).toBe('false');
        click('go');
        await expect(answer).resolves.toBe(true);
        expect(gate().classList.contains('is-open')).toBe(false);
        expect(gate().getAttribute('aria-hidden')).toBe('true');
    });

    test('"Stay" answers no', async () => {
        await load(GATE);
        const answer = askDeepGate();
        click('stay');
        await expect(answer).resolves.toBe(false);
    });

    test('Escape answers no', async () => {
        await load(GATE);
        const answer = askDeepGate();
        document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
        await expect(answer).resolves.toBe(false);
        expect(gate().classList.contains('is-open')).toBe(false);
    });

    test('asking twice while it is open is one question', async () => {
        await load(GATE);
        const first = askDeepGate();
        const second = askDeepGate();
        click('stay');
        await expect(first).resolves.toBe(false);
        await expect(second).resolves.toBe(false);
    });

    test('it can be asked again after an answer, and old listeners are gone', async () => {
        await load(GATE);
        const first = askDeepGate();
        click('stay');
        await first;
        const second = askDeepGate();
        expect(gate().classList.contains('is-open')).toBe(true);
        click('go');
        await expect(second).resolves.toBe(true);
    });

    test('without the gate in the page the way down is never blocked', async () => {
        await load('');
        await expect(askDeepGate()).resolves.toBe(true);
    });
});
