/**
 * Chapter IV · THE DEEP: the crust's ring. The burnt ground over the colony's head
 * carries the one number the chapter is about: the chance of survival up there.
 *
 * SURVIVAL, ONE WORD (v1.45.0). Ola: "surface 93 %... what? Whole? Broken?" and
 * "that ring that gets smaller... you understand nothing." So the ring FILLS as the
 * surface heals: empty is certain death up there, full is certain survival, and a
 * tick on it marks the line the colony has to reach (85 %). The label says it in
 * words: "survival 15 % · need 85 %". What the colony believes is a reading with a
 * band of doubt: a lighter sector round the reading, labelled "15 ± 40 %" with the
 * caption "survival if we go up now", and hovering it says what the band is. Under
 * it the year the colony believes it gets there: "survival 85 % ~ year 802 701".
 *
 * Since v1.45.0 the ring sits on the crust slab IN the scene (scene.crustHost); the
 * flat band at the top of the window is only the fallback for a browser without
 * WebGL. The rules are in deep.js; this file only draws them.
 */

import { ESTIMATE_START, SURVIVAL_AT, survival } from './deep.js';

const RING_LEN = 113;               // the circumference of the r=18 ring, as in chapters II and III
const TICK_LEN = 2.2;               // the mark at the line, along the ring
export const SPREAD_TIP = 'What the scouts believe. More parties, smaller doubt.';

/** "survival 15 % · need 85 %": the words beside the ring. */
export const crustLabel = (pct) => `survival ${Math.round(pct)} % · need ${SURVIVAL_AT} %`;
/** The estimate, "15 ± 40 %", and what it is. */
export const ESTIMATE_CAPTION = 'survival if we go up now';

/**
 * Where the band of doubt runs on the ring, as dash parameters: [length, offset].
 * @param {number} mean - survival per cent
 * @param {number} spread - ± per cent
 */
export function bandArc(mean, spread) {
    const a = Math.max(0, mean - spread), b = Math.min(100, mean + spread);
    return [RING_LEN * (b - a) / 100, -RING_LEN * a / 100];
}

/**
 * Builds the ring inside `host` and hands back the three things the phase needs.
 *
 * @param {HTMLElement} host - the element it is drawn into; it is filled, not wrapped
 * @param {object} [_opts] - unused since the ring lost its glyphs; kept so the phase's call reads the same
 * @returns {{update:Function, lighten:Function, destroy:Function}}
 */
export function createCrust(host, _opts = {}) {
    const tickAt = RING_LEN * SURVIVAL_AT / 100;
    host.innerHTML = `
        <div class="deep-crust-in" hidden>
            <div class="deep-crust-ring">
                <svg viewBox="0 0 40 40">
                    <circle class="ring-base" cx="20" cy="20" r="18" fill="none" stroke-width="3"></circle>
                    <circle class="ring-band" cx="20" cy="20" r="18" fill="none" stroke-width="7"
                            stroke-dasharray="0 ${RING_LEN}" stroke-dashoffset="0"></circle>
                    <circle class="ring-fg" cx="20" cy="20" r="18" fill="none" stroke-width="3"
                            stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"></circle>
                    <circle class="ring-need" cx="20" cy="20" r="18" fill="none" stroke-width="7"
                            stroke-dasharray="${TICK_LEN} ${RING_LEN}" stroke-dashoffset="${(-(tickAt - TICK_LEN / 2)).toFixed(1)}"></circle>
                </svg>
            </div>
            <span class="deep-crust-text">
                <span class="deep-crust-read deep-mono"></span>
                <span class="deep-crust-sub deep-mono">
                    <span class="deep-crust-spread"></span>
                    <span class="deep-crust-cap">${ESTIMATE_CAPTION}</span>
                </span>
                <span class="deep-crust-year deep-mono"></span>
            </span>
            <span class="deep-crust-tip">${SPREAD_TIP}</span>
        </div>`;
    const inner = host.querySelector('.deep-crust-in');
    const ring = host.querySelector('.ring-fg');
    const band = host.querySelector('.ring-band');
    const read = host.querySelector('.deep-crust-read');
    const spreadEl = host.querySelector('.deep-crust-spread');
    const yearEl = host.querySelector('.deep-crust-year');

    return {
        /**
         * @param {object} view
         * @param {{mean:number, spread:number}} [view.est] - what the colony believes TODAY, in the
         *        rules' doomsday per cent; it is turned into habitability here and nowhere else
         * @param {string} [view.year] - the year it believes the ring reaches the line, grouped
         */
        update({ est, year = '' } = {}) {
            if (inner.hidden) inner.hidden = false;
            const e = est || ESTIMATE_START;
            const pct = survival(e.mean);
            const spread = Math.max(0, e.spread);
            ring.setAttribute('stroke-dashoffset', (RING_LEN * (1 - pct / 100)).toFixed(1));
            const [len, off] = bandArc(pct, spread);
            band.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${RING_LEN}`);
            band.setAttribute('stroke-dashoffset', off.toFixed(1));
            const label = crustLabel(pct);
            if (read.textContent !== label) read.textContent = label;
            const sp = `${Math.round(pct)} ± ${Math.round(spread)} %`;
            if (spreadEl.textContent !== sp) spreadEl.textContent = sp;
            const yl = year ? `survival ${SURVIVAL_AT} % ~ year ${year}` : '';
            if (yearEl.textContent !== yl) yearEl.textContent = yl;
        },
        /** The one time the crust is not dark: the colony came back up and the sky is there. */
        lighten() { host.classList.add('is-lit'); },
        destroy() { host.innerHTML = ''; host.classList.remove('is-lit'); },
    };
}
