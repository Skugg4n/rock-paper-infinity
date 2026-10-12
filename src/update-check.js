/**
 * Updates reach the player (B460). The page asks for src/version.js (no cache) every ten minutes
 * and whenever the tab comes back into view; a newer version than the one running means: on the
 * start screen, reload at once (nothing to lose); in a game, offer a small "reload" pill, and reload
 * by itself when the tab has been away for ten minutes or more (the chapters save every second).
 * The pure parts are tested; startUpdateCheck() is the timer and the fetch.
 */
export const CHECK_EVERY_MS = 10 * 60 * 1000;
export const AWAY_MS = 10 * 60 * 1000;

/** The version named in a src/version.js text, or null. */
export function versionIn(text) {
    const m = /VERSION\s*=\s*'([^']+)'/.exec(text || '');
    return m ? m[1] : null;
}

/** What to do with a version seen: 'none' (same, or unknown), 'reload' or 'offer'. */
export function decide({ running, latest, startUp = false, awayMs = 0 }) {
    if (!latest || !running || latest === running) return 'none';
    if (startUp || awayMs >= AWAY_MS) return 'reload';
    return 'offer';
}

/** The pill's words. */
export const OFFER = (latest) => `${latest} is here · reload`;

/**
 * Starts the checks. `fetchText(url)` resolves with the text of src/version.js; `isStartUp()` says
 * whether the start screen is up; `onDecision(action, latest)` acts ('reload' | 'offer').
 * @returns {{ check: Function, stop: Function }}
 */
export function startUpdateCheck({ running, fetchText, isStartUp = () => false, onDecision, every = CHECK_EVERY_MS, doc = typeof document !== 'undefined' ? document : null, now = Date.now }) {
    let hiddenAt = null;
    let timer = null;
    let latestSeen = null;
    async function check(awayMs = 0) {
        let latest = null;
        try { latest = versionIn(await fetchText('src/version.js')); } catch { return 'none'; }
        if (latest) latestSeen = latest;
        const action = decide({ running, latest, startUp: isStartUp(), awayMs });
        if (action !== 'none') onDecision(action, latest);
        return action;
    }
    const onVisible = () => {
        if (!doc) return;
        if (doc.visibilityState === 'hidden') { hiddenAt = now(); return; }
        const away = hiddenAt == null ? 0 : now() - hiddenAt;
        hiddenAt = null;
        // a version already seen and declined: an absence long enough reloads without asking again
        if (latestSeen && latestSeen !== running && away >= AWAY_MS) { onDecision('reload', latestSeen); return; }
        check(away);
    };
    doc?.addEventListener('visibilitychange', onVisible);
    timer = setInterval(() => check(0), every);
    return {
        check,
        stop() { clearInterval(timer); doc?.removeEventListener('visibilitychange', onVisible); },
    };
}
