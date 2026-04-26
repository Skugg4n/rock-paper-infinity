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
    expect(firedAt).toBe(PHASE_DURATIONS.veilIn + PHASE_DURATIONS.titleIn);
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
    expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('chapterCard onMidpoint'),
        expect.any(Error),
    );
    errorSpy.mockRestore();
});

test('second call while first is active is ignored', async () => {
    const first = playChapterCard({ roman: 'I', title: 'TRIVIAL' });
    let secondMidpointFired = false;
    const second = playChapterCard({
        roman: 'II',
        title: 'CAPITAL',
        onMidpoint: () => { secondMidpointFired = true; },
    });
    await jest.advanceTimersByTimeAsync(2300);
    await first;
    await second;
    expect(secondMidpointFired).toBe(false);
    expect(document.querySelector('.chapter-card__title').textContent).toBe('TRIVIAL');
});

test('to-come mode shows suffix and stays on wall', async () => {
    const promise = playChapterCard({ roman: 'III', title: 'WAR', mode: 'to-come' });
    let resolved = false;
    promise.then(() => { resolved = true; });
    // Advance past the full normal-mode duration
    await jest.advanceTimersByTimeAsync(3000);
    expect(resolved).toBe(false);
    expect(document.querySelector('.chapter-card__suffix').hidden).toBe(false);
    expect(document.querySelector('.chapter-card').classList.contains('is-to-come')).toBe(true);
});

test('to-come mode: title stays visible — display not none, suffix revealed', async () => {
    // Regression guard for v1.14.1 fix: in to-come mode the title must remain on
    // screen alongside the "to come" suffix. Both elements must be visible together.
    const promise = playChapterCard({ roman: 'III', title: 'WAR', mode: 'to-come' });
    // Advance past veilIn + titleIn + hold + the 300ms to-come settle delay
    await jest.advanceTimersByTimeAsync(PHASE_DURATIONS.veilIn + PHASE_DURATIONS.titleIn + PHASE_DURATIONS.hold + 400);

    const titleEl = document.querySelector('.chapter-card__title');
    const suffixEl = document.querySelector('.chapter-card__suffix');

    // Title must not be hidden
    expect(titleEl.style.display).not.toBe('none');
    expect(titleEl.textContent).toBe('WAR');

    // Suffix must be revealed
    expect(suffixEl.hidden).toBe(false);

    // Card still active (promise unresolved)
    let resolved = false;
    promise.then(() => { resolved = true; });
    await jest.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);
});

test('to-come followed by normal call: normal is no-op while to-come holds wall', async () => {
    // The first call enters to-come mode (never resolves). The second call should
    // be ignored because _cardActive is still true. The normal call's midpoint must
    // never fire and the DOM must show the original to-come title.
    const toComeProm = playChapterCard({ roman: 'III', title: 'WAR', mode: 'to-come' });

    // Advance enough for to-come to have fully settled (veilIn + titleIn + hold + 300ms settle)
    await jest.advanceTimersByTimeAsync(PHASE_DURATIONS.veilIn + PHASE_DURATIONS.titleIn + PHASE_DURATIONS.hold + 400);

    // Now try a follow-up normal call — should be a no-op
    let normalMidpointFired = false;
    let normalResolved = false;
    const normalProm = playChapterCard({
        roman: 'II',
        title: 'CAPITAL',
        onMidpoint: () => { normalMidpointFired = true; },
    });
    normalProm.then(() => { normalResolved = true; });

    // Advance past the full normal sequence
    await jest.advanceTimersByTimeAsync(3000);
    await normalProm;

    // Normal call resolves immediately (returns Promise.resolve())
    expect(normalResolved).toBe(true);
    // But its midpoint never fired
    expect(normalMidpointFired).toBe(false);
    // DOM still shows WAR, not CAPITAL
    expect(document.querySelector('.chapter-card__title').textContent).toBe('WAR');

    // to-come promise still unresolved
    let toComeDone = false;
    toComeProm.then(() => { toComeDone = true; });
    await jest.advanceTimersByTimeAsync(0);
    expect(toComeDone).toBe(false);
});
