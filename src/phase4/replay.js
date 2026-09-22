/**
 * Chapter IV · THE DEEP: the wake-up replay. A strip over the scene that says
 * what the hundred years did, in glyphs and numbers only, never in a sentence.
 *
 * Since v1.43.0 it opens with the glyph of what woke the colony (the sentence is
 * in the feed), and counts the people the ice took.
 *
 * Three groups, left to right:
 *   1. one glyph per room type the colony owns: lit if it RAN, dimmed with a
 *      small amber dot if it STALLED while everyone was under the ice;
 *   2. what came of it: ore, food, stars, as +numbers in mono;
 *   3. which column was the weakest, and for how much of the sleep, as four
 *      small bars from the sleep report's histogram.
 *
 * It is on screen for a few seconds, or until the player clicks anything.
 */

import { ROOMS, COLUMN } from './deep.js';
import { ROOM_ICON } from './scene.js';

export const REPLAY_MS = 8000;
const BAR_H = 18;              // the histogram's tallest bar, in CSS pixels

/**
 * @param {HTMLElement} host - the strip; it is filled, not wrapped
 * @param {object} [opts]
 * @param {Function} [opts.onIcons] - called after the glyphs change, so lucide can draw them
 * @param {Function} [opts.format] - number formatter; defaults to Math.round
 * @returns {{show:Function, hide:Function, visible:Function, destroy:Function}}
 */
export function createReplay(host, opts = {}) {
    const fmt = opts.format || ((n) => String(Math.round(n)));
    let timer = 0;

    function madeRow(icon, value) {
        return `<span class="deep-replay-made"><span class="deep-mono">+${fmt(value)}</span>`
            + `<i data-lucide="${icon}" class="w-4 h-4"></i></span>`;
    }

    return {
        /**
         * @param {object} data
         * @param {object} data.rooms - room type → true when it owns one
         * @param {object} data.stalled - room type → true when it stopped
         * @param {number} data.minerals - ore mined over the sleep
         * @param {number} data.food - food grown over the sleep
         * @param {number} data.stars - stars earned over the sleep
         * @param {object} data.weakest - column letter → days it was the weakest
         * @param {string} [data.alarm] - the glyph of what woke the colony (v1.43.0)
         * @param {number} [data.died] - lost in the ice over the sleep
         * @param {object} [data.shows] - which of ore, food and stars move their counter visibly
         *        (v1.48.0): a number that changes nothing on screen is left off the strip
         */
        show({ rooms = {}, stalled = {}, minerals = 0, food = 0, stars = 0, weakest = {}, alarm = '', died = 0, shows = {} } = {}) {
            const glyphs = ROOMS.filter((t) => (rooms[t] || 0) > 0).map((t) => {
                const bad = !!stalled[t];
                return `<span class="deep-replay-room${bad ? ' is-stalled' : ''}">`
                    + `<i data-lucide="${ROOM_ICON[t]}" class="w-5 h-5"></i>`
                    + (bad ? '<span class="deep-replay-dot"></span>' : '')
                    + '</span>';
            }).join('');
            const top = COLUMN.reduce((a, c) => ((weakest[c] || 0) > (weakest[a] || 0) ? c : a), COLUMN[0]);
            const scale = Math.max(1, ...COLUMN.map((c) => weakest[c] || 0));
            const bars = COLUMN.map((c) => {
                const h = Math.round(BAR_H * Math.min(1, (weakest[c] || 0) / scale));
                return `<span class="deep-replay-col${c === top ? ' is-top' : ''}">`
                    + `<span class="deep-replay-bar" style="height:${h}px"></span>`
                    + `<span class="deep-mono">${c}</span></span>`;
            }).join('');
            const woke = alarm ? `<span class="deep-replay-group deep-replay-alarm"><i data-lucide="${alarm}" class="w-5 h-5"></i></span>` : '';
            const lost = died >= 0.5
                ? `<span class="deep-replay-made is-lost"><span class="deep-mono">-${fmt(died)}</span><i data-lucide="user-minus" class="w-4 h-4"></i></span>`
                : '';
            host.innerHTML = woke + `<span class="deep-replay-group">${glyphs}</span>`
                + `<span class="deep-replay-group">${shows.minerals === false ? '' : madeRow('pickaxe', minerals)}`
                + `${shows.food === false ? '' : madeRow('wheat', food)}${shows.stars === false ? '' : madeRow('star', stars)}${lost}</span>`
                + `<span class="deep-replay-group deep-replay-hist">${bars}</span>`;
            host.hidden = false;
            opts.onIcons?.();
            clearTimeout(timer);
            timer = setTimeout(() => { host.hidden = true; }, REPLAY_MS);
        },
        hide() { clearTimeout(timer); timer = 0; host.hidden = true; },
        visible() { return !host.hidden; },
        destroy() { clearTimeout(timer); timer = 0; host.innerHTML = ''; host.hidden = true; },
    };
}
