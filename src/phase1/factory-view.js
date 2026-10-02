/**
 * The factory at the end of chapter I: boards all the way down.
 *
 * The nine boards turn out to be tiles of a larger board: each becomes a board
 * of nine games. Cells flicker as games are played, a win lights a cell dark
 * with a star, and now and then a wave of wins crosses the whole thing. The
 * factory is not a new thing; it is the same game at industrial scale.
 *
 * Pure DOM, driven from outside: index.js calls tick() from the bulk loop, so
 * the factory stands still when the game does (pause, auto off).
 */

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

export const FACTORY_TILES = 9;
const CELLS_PER_TILE = 9;
const WAVE_EVERY_TICKS = 26;       // about 2.6 s at the bulk loop's 100 ms
const WAVE_MS_PER_CELL = 75;

/**
 * Where a cell sits in the 9 x 9 whole.
 *
 * @param {number} tile - 0..8, row by row
 * @param {number} cell - 0..8 inside the tile, row by row
 * @returns {{ x: number, y: number }} 0..8 each
 */
export function cellPosition(tile, cell) {
    return {
        x: (tile % 3) * 3 + (cell % 3),
        y: Math.floor(tile / 3) * 3 + Math.floor(cell / 3),
    };
}

/**
 * Turns the given board elements into factory tiles and returns the view.
 *
 * @param {HTMLElement[]} tileEls - the nine boards
 * @param {{ random?: () => number }} [opts]
 */
export function createFactoryView(tileEls, { random = Math.random } = {}) {
    const cells = [];
    tileEls.forEach((tile, t) => {
        tile.classList.add('factory-tile');
        tile.replaceChildren();
        for (let c = 0; c < CELLS_PER_TILE; c++) {
            const el = document.createElement('div');
            el.className = 'factory-cell';
            el.innerHTML = STAR;
            tile.appendChild(el);
            cells.push({ el, ...cellPosition(t, c) });
        }
    });

    const timers = new Set();
    const later = (fn, ms) => {
        const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
        timers.add(id);
    };
    const flash = (cell, cls, ms) => {
        cell.el.classList.add(cls);
        later(() => cell.el.classList.remove(cls), ms);
    };
    const pick = () => cells[Math.floor(random() * cells.length)];
    let ticks = 0;

    return {
        cells,

        /** One beat of the machine: a few games are played, now and then one is won. */
        tick() {
            if (!cells.length) return;
            for (let i = 0; i < 6; i++) flash(pick(), 'play', 90);
            if (random() < 0.55) flash(pick(), 'won', 260);
            if (++ticks % WAVE_EVERY_TICKS === 0) this.wave();
        },

        /** A wave of wins from a point (cell coordinates 0..8), across everything. */
        wave(ox = random() * 8, oy = random() * 8) {
            for (const cell of cells) {
                later(() => flash(cell, 'won', 240), Math.hypot(cell.x - ox, cell.y - oy) * WAVE_MS_PER_CELL);
            }
        },

        /** The cells arrive, from the middle outward (when the factory is built). */
        arrive() {
            for (const cell of cells) {
                cell.el.classList.add('cell-arrive');
                cell.el.style.animationDelay = `${Math.round(Math.hypot(cell.x - 4, cell.y - 4) * 60)}ms`;
            }
        },

        destroy() {
            timers.forEach(clearTimeout);
            timers.clear();
        },
    };
}
