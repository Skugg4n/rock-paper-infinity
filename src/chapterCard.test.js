import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

let dom;
let playChapterCard;
let PHASE_DURATIONS;

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
    jest.useFakeTimers();
    jest.resetModules();
    const mod = await import('./chapterCard.js');
    playChapterCard = mod.playChapterCard;
    PHASE_DURATIONS = mod.PHASE_DURATIONS;
    if (mod._resetForTesting) mod._resetForTesting();
});

afterEach(() => {
    jest.useRealTimers();
    delete global.document;
    delete global.window;
});

test('playChapterCard resolves after the full sequence', async () => {
    const TOTAL_MS =
        PHASE_DURATIONS.veilIn +
        PHASE_DURATIONS.titleIn +
        PHASE_DURATIONS.hold +
        PHASE_DURATIONS.titleOut +
        PHASE_DURATIONS.veilOut;

    const promise = playChapterCard({ roman: 'I', title: 'TRIVIAL' });
    let resolved = false;
    promise.then(() => { resolved = true; });

    await jest.advanceTimersByTimeAsync(TOTAL_MS - 100);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(true);
});

test('playChapterCard sets roman and title text', async () => {
    const promise = playChapterCard({ roman: 'II', title: 'CAPITAL' });
    // Advance past veilIn (300) + a bit into titleIn — text is set before any delays
    await jest.advanceTimersByTimeAsync(400);
    expect(document.querySelector('.chapter-card__roman').textContent).toBe('II');
    expect(document.querySelector('.chapter-card__title').textContent).toBe('CAPITAL');
    await jest.advanceTimersByTimeAsync(PHASE_DURATIONS.titleIn + PHASE_DURATIONS.hold + PHASE_DURATIONS.titleOut + PHASE_DURATIONS.veilOut);
    await promise;
});

test('playChapterCard uppercases title', async () => {
    const promise = playChapterCard({ roman: 'I', title: 'trivial' });
    // Advance past veilIn (300) + a bit into titleIn
    await jest.advanceTimersByTimeAsync(400);
    expect(document.querySelector('.chapter-card__title').textContent).toBe('TRIVIAL');
    await jest.advanceTimersByTimeAsync(PHASE_DURATIONS.titleIn + PHASE_DURATIONS.hold + PHASE_DURATIONS.titleOut + PHASE_DURATIONS.veilOut);
    await promise;
});

test('onMidpoint fires at start of hold phase', async () => {
    let firedAt = null;
    const startTime = Date.now();
    const promise = playChapterCard({
        roman: 'II',
        title: 'CAPITAL',
        onMidpoint: () => { firedAt = Date.now() - startTime; },
    });
    await jest.advanceTimersByTimeAsync(700);
    expect(firedAt).not.toBeNull();
    expect(firedAt).toBeGreaterThanOrEqual(550); // veilIn(300) + titleIn(300) -50ms slack
    expect(firedAt).toBeLessThanOrEqual(700);
    await jest.advanceTimersByTimeAsync(2000);
    await promise;
});

test('onMidpoint errors do not break the animation', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const promise = playChapterCard({
        roman: 'II',
        title: 'CAPITAL',
        onMidpoint: () => { throw new Error('intentional'); },
    });
    let resolved = false;
    promise.then(() => { resolved = true; });
    await jest.advanceTimersByTimeAsync(2300);
    expect(resolved).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
});
