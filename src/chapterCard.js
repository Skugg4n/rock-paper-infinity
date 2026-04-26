const REDUCED_MOTION = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PHASE_DURATIONS = REDUCED_MOTION
    ? { veilIn: 100, titleIn: 100, hold: 200, titleOut: 100, veilOut: 100 }
    : { veilIn: 300, titleIn: 300, hold: 1000, titleOut: 300, veilOut: 300 };

let _cardActive = false;

function el(selector) {
    return document.querySelector(selector);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Plays a full chapter-card transition sequence.
 *
 * @param {object} [opts={}]
 * @param {string} opts.roman - Roman numeral displayed above the title, e.g. "I" or "II"
 * @param {string} opts.title - Chapter title (uppercased automatically)
 * @param {'normal' | 'to-come'} [opts.mode='normal'] - Transition mode; 'to-come' ends on a permanent black wall
 * @param {Function} [opts.onMidpoint] - Callback fired during the hold phase (e.g. to trigger phase switch)
 * @returns {Promise<void>} Resolves after the card exits (normal mode only; never resolves for to-come)
 */
export function playChapterCard({ roman, title, mode = 'normal', onMidpoint } = {}) {
    if (_cardActive) return Promise.resolve();
    _cardActive = true;

    const card = el('#chapter-card');
    const veil = el('.chapter-card__veil');
    const content = el('.chapter-card__content');
    const romanEl = el('.chapter-card__roman');
    const titleEl = el('.chapter-card__title');
    const suffixEl = el('.chapter-card__suffix');

    romanEl.textContent = roman;
    titleEl.textContent = String(title).toUpperCase();
    if (mode === 'to-come') card.classList.add('is-to-come');
    card.classList.add('is-active');
    card.setAttribute('aria-hidden', 'false');

    return (async () => {
        try {
            // Phase 1: fade to white
            veil.style.opacity = '1';
            await delay(PHASE_DURATIONS.veilIn);

            // Phase 2: title in
            content.style.opacity = '1';
            await delay(PHASE_DURATIONS.titleIn);

            // Phase 3: hold (midpoint callback fires here)
            if (typeof onMidpoint === 'function') {
                try { onMidpoint(); } catch (e) { console.error('chapterCard onMidpoint:', e); }
            }
            await delay(PHASE_DURATIONS.hold);

            if (mode === 'to-come') {
                // Replace phase 4+5: keep title visible, fade veil to black,
                // reveal "to come" subtitle below the title. Both stay on
                // the wall together. Promise never resolves.
                veil.style.background = '#000000';
                content.style.color = '#ffffff';
                suffixEl.hidden = false;
                await delay(300);
                return new Promise(() => {});
            }

            // Phase 4: title out
            content.style.opacity = '0';
            await delay(PHASE_DURATIONS.titleOut);

            // Phase 5 (normal): veil out
            veil.style.opacity = '0';
            await delay(PHASE_DURATIONS.veilOut);

            // Cleanup
            card.classList.remove('is-active');
            card.setAttribute('aria-hidden', 'true');
            content.style.opacity = '0';
            _cardActive = false;
        } catch (e) {
            _cardActive = false;
            throw e;
        }
    })();
}

/**
 * Resets internal `_cardActive` flag. Test use only.
 * @returns {void}
 */
export function _resetForTesting() {
    _cardActive = false;
}
