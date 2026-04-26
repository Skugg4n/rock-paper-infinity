/**
 * Lightweight performance instrumentation.
 *
 * Enabled only when the URL contains both ?debug and ?perf query flags,
 * e.g. http://localhost:8000/?debug&perf
 *
 * In production (neither flag present) _enabled stays false and every
 * exported helper is a near-zero-cost no-op.
 */

let _enabled = false;

/**
 * Returns true when perf instrumentation is active.
 */
export function isPerfEnabled() {
    return _enabled;
}

/**
 * Call once near the top of bootstrap (before phases load).
 * Reads the URL and sets the enabled flag.
 */
export function initPerf() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    _enabled = params.has('debug') && params.has('perf');
    if (_enabled) {
        console.warn('[perf] instrumentation enabled');
    }
}

/**
 * Wraps a synchronous function, logs its duration if it exceeds 4 ms.
 *
 * @param {string} label - Display label for console output
 * @param {Function} fn  - Synchronous function to measure
 * @returns {*} The return value of fn
 */
export function timed(label, fn) {
    if (!_enabled) return fn();
    const t = performance.now();
    const result = fn();
    const dur = performance.now() - t;
    if (dur > 4) console.warn(`[perf] ${label}: ${dur.toFixed(2)}ms`);
    return result;
}

/**
 * Increments a named counter stored on window, logs every 100 increments.
 * Useful for tracking "how often does this path run".
 *
 * @param {string} label - Counter name (also used as window key prefix)
 */
export function counter(label) {
    if (!_enabled) return;
    const key = `_perf_${label}`;
    window[key] = (window[key] || 0) + 1;
    if (window[key] % 100 === 0) console.warn(`[perf] ${label}: ${window[key]}x`);
}
