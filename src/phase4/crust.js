/**
 * Chapter IV · THE DEEP: the crust. A thin black band across the top of the
 * screen, which is the burnt ground over the colony's head.
 *
 * Fog of war. Nothing is drawn on it until the first probe comes back: no ring,
 * no number, nothing to read. Then chapter III's ring appears, and it is not the
 * truth. It is what the colony BELIEVES about the surface: a mean and a spread,
 * drawn as an arc whose STROKE is the doubt. Wide and grey at "40 ± 40 %",
 * narrowing to a sharp line as the readings come in. The rules are in deep.js;
 * this file only draws them.
 */

import { ESTIMATE_START } from './deep.js';

const RING_LEN = 113;               // the circumference of the r=18 ring, as in chapters II and III
const RING_MIN_W = 2.5;             // a certain colony's arc is this thin
const RING_MAX_W = 11;              // a shrug is this thick
const PENDING_MAX = 4;              // more probes than this in flight and the glyphs would be a queue

/**
 * Builds the crust inside `host` and hands back the two things the phase needs.
 *
 * @param {HTMLElement} host - the band itself; it is filled, not wrapped
 * @param {object} [opts]
 * @param {Function} [opts.onIcons] - called after the glyphs change, so lucide can draw them
 * @returns {{update:Function, lighten:Function, destroy:Function}}
 */
export function createCrust(host, opts = {}) {
    host.innerHTML = `
        <div class="deep-crust-in" hidden>
            <div class="deep-crust-ring">
                <svg viewBox="0 0 40 40">
                    <circle class="ring-base" cx="20" cy="20" r="18" fill="none" stroke-width="2"></circle>
                    <circle class="ring-fg" cx="20" cy="20" r="18" fill="none"
                            stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"></circle>
                </svg>
            </div>
            <span class="deep-crust-read deep-mono"></span>
            <span class="deep-crust-pending"></span>
        </div>`;
    const inner = host.querySelector('.deep-crust-in');
    const ring = host.querySelector('.ring-fg');
    const read = host.querySelector('.deep-crust-read');
    const pendingEl = host.querySelector('.deep-crust-pending');
    let pendingShown = -1;

    return {
        /**
         * @param {object} view
         * @param {{mean:number, spread:number}} [view.est] - what the colony believes
         * @param {boolean} [view.revealed] - has anything ever come back?
         * @param {number} [view.pending] - probes in flight
         */
        update({ est, revealed, pending = 0 } = {}) {
            if (!revealed) {
                if (!inner.hidden) inner.hidden = true;
                return;
            }
            if (inner.hidden) inner.hidden = false;
            const e = est || ESTIMATE_START;
            const mean = Math.max(0, Math.min(100, e.mean));
            const spread = Math.max(0, e.spread);
            ring.setAttribute('stroke-dashoffset', (RING_LEN * (1 - mean / 100)).toFixed(1));
            // the doubt IS the stroke: a colony that has read the sky twenty times draws a hairline
            const w = RING_MIN_W + (RING_MAX_W - RING_MIN_W) * Math.min(1, spread / ESTIMATE_START.spread);
            ring.setAttribute('stroke-width', w.toFixed(2));
            const label = `${Math.round(mean)} ± ${Math.round(spread)} %`;
            if (read.textContent !== label) read.textContent = label;
            const n = Math.min(PENDING_MAX, Math.max(0, Math.round(pending)));
            if (n !== pendingShown) {
                pendingShown = n;
                pendingEl.innerHTML = new Array(n).fill('<i data-lucide="radar" class="w-3 h-3"></i>').join('');
                opts.onIcons?.();
            }
        },
        /** The one time the band is not black: the party came back up and the sky is there. */
        lighten() { host.classList.add('is-lit'); },
        destroy() { host.innerHTML = ''; host.classList.remove('is-lit'); },
    };
}
