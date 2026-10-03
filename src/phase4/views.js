/**
 * Chapter IV · THE DEEP: which view draws the colony (deep-swap). Pure: no DOM, no three.js.
 *
 * Ola chose the strata (2026-10-03): the cross-section is the default. The 3D view stays in the code
 * and stays selectable, so we can go back, or use it for a parallel world later: `?view=3d` in the
 * URL, or "View" in the ☰ menu (kept in localStorage under VIEW_KEY). The URL wins over the menu.
 *
 * Each view says where chamber number i sits in it (strata-view.js and scene.js export
 * `chamberPlace`); the body's graph is built with that placement (grow.js setChamberPlace), so a
 * chamber that glows as reachable always lies beside the body on the screen. The pure twins of those
 * placements are here for the sims, which cannot load three.js.
 */

import { placeChamber } from './layout.js';
import { sectionPlace } from './strata.js';

/** The menu's choice, in localStorage. */
export const VIEW_KEY = 'rpi-deep-view';
/** The views, the default first. */
export const VIEWS = ['strata', '3d'];
/** What the menu calls them. */
export const VIEW_NAME = { strata: 'strata', '3d': '3D' };

/**
 * The view to make: `?view=3d` or `?view=strata` in the URL, else the menu's stored choice, else the strata.
 * @param {string} [search] - location.search
 * @param {string|null} [stored] - localStorage[VIEW_KEY]
 * @returns {'strata'|'3d'}
 */
export function chosenView(search = '', stored = null) {
    const m = /[?&]view=([^&#]*)/i.exec(String(search || ''));
    const want = m ? decodeURIComponent(m[1]).toLowerCase() : String(stored || '').toLowerCase();
    return want === '3d' ? '3d' : 'strata';
}

/** The other view (the menu toggles between the two). */
export const otherView = (v) => (v === '3d' ? 'strata' : '3d');

/**
 * The URL to load after the menu chose a view: a `view` parameter already in it is set to the choice
 * (else it would overrule the menu); a URL without one is left as it is (the stored choice decides).
 * @param {string} href
 * @param {'strata'|'3d'} view
 */
export function urlForView(href, view) {
    // by hand, not URLSearchParams: that would write "?debug" back as "?debug="
    return String(href).replace(/([?&]view=)[^&#]*/i, `$1${encodeURIComponent(view)}`);
}

/** Where chamber i sits in a view, for the body's graph (the sims; the game uses the view module's own). */
export function placeFor(view) {
    return view === '3d' ? placeChamber : sectionPlace;
}
