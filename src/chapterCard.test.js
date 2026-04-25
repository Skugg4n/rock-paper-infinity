import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

let dom;
let playChapterCard;

beforeEach(async () => {
    dom = new JSDOM(`
        <!DOCTYPE html>
        <html><body>
            <div id="chapter-card" class="chapter-card" aria-hidden="true">
                <div class="chapter-card__veil"></div>
                <div class="chapter-card__content">
                    <div class="chapter-card__roman"></div>
                    <div class="chapter-card__title"></div>
                    <div class="chapter-card__suffix" hidden>to come</div>
                </div>
            </div>
        </body></html>
    `, { pretendToBeVisual: true });
    global.document = dom.window.document;
    global.window = dom.window;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    jest.useFakeTimers();
    const mod = await import('./chapterCard.js?test=' + Date.now());
    playChapterCard = mod.playChapterCard;
});

afterEach(() => {
    jest.useRealTimers();
    delete global.document;
    delete global.window;
    delete global.requestAnimationFrame;
});

test('playChapterCard resolves after the full sequence', async () => {
    const promise = playChapterCard({ roman: 'I', title: 'TRIVIAL' });
    let resolved = false;
    promise.then(() => { resolved = true; });

    await jest.advanceTimersByTimeAsync(2100);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(true);
});

test('playChapterCard sets roman and title text', async () => {
    const promise = playChapterCard({ roman: 'II', title: 'CAPITAL' });
    await jest.advanceTimersByTimeAsync(400);
    expect(document.querySelector('.chapter-card__roman').textContent).toBe('II');
    expect(document.querySelector('.chapter-card__title').textContent).toBe('CAPITAL');
    await jest.advanceTimersByTimeAsync(2000);
    await promise;
});

test('playChapterCard uppercases title', async () => {
    const promise = playChapterCard({ roman: 'I', title: 'trivial' });
    await jest.advanceTimersByTimeAsync(400);
    expect(document.querySelector('.chapter-card__title').textContent).toBe('TRIVIAL');
    await jest.advanceTimersByTimeAsync(2000);
    await promise;
});
