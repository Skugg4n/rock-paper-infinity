/**
 * Position of an element inside `area` in LAYOUT coordinates (offsetLeft /
 * offsetTop chain), untouched by CSS transforms. The city area may be tilted
 * (?tilt experiment); the ants canvas and the islands SVG are its children and
 * tilt with it, so they must draw in untransformed space, not in what
 * getBoundingClientRect() reports.
 *
 * @param {HTMLElement} el
 * @param {HTMLElement} area
 * @returns {{x:number, y:number, w:number, h:number}}
 */
export function layoutRect(el, area) {
    let x = 0, y = 0, node = el;
    while (node && node !== area) {
        x += node.offsetLeft; y += node.offsetTop;
        node = node.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}
