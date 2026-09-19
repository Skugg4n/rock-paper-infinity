/**
 * Islands: a wobbly coastline drawn behind a group of plates, on water.
 * Pure geometry (coastPath) plus a small DOM helper that keeps an SVG blob
 * sized to a container. No strokes anywhere: the island is a tone on the water
 * (vision.md: tone plates, not lines).
 */

import { layoutRect } from './layout.js';

/**
 * Deterministic pseudo-random in [0,1) from an integer seed (mulberry32).
 * @param {number} seed
 */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * A closed, smooth, wobbly path around a rectangle (with padding), as an SVG
 * `d` string. Points sit on an ellipse-ish outline with seeded bumps, joined by
 * Catmull-Rom → cubic Bézier so the coast has no corners.
 *
 * @param {{x:number,y:number,w:number,h:number}} rect - area to enclose
 * @param {object} [opts]
 * @param {number} [opts.pad=28] - how far the coast lies outside the rect
 * @param {number} [opts.points=18] - vertices around the coast
 * @param {number} [opts.wobble=0.28] - bump amplitude as a share of pad
 * @param {number} [opts.seed=7]
 * @returns {string} SVG path data
 */
export function coastPath(rect, { pad = 28, points = 18, wobble = 0.28, seed = 7 } = {}) {
    const rand = rng(seed);
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const rx = rect.w / 2 + pad, ry = rect.h / 2 + pad;
    const pts = [];
    for (let i = 0; i < points; i++) {
        const a = (i / points) * Math.PI * 2;
        // superellipse-ish so the blob follows a rectangle, not a circle
        const c = Math.cos(a), s = Math.sin(a);
        const k = 0.72; // 1 = ellipse, lower = boxier
        const ex = Math.sign(c) * Math.pow(Math.abs(c), k);
        const ey = Math.sign(s) * Math.pow(Math.abs(s), k);
        const bump = 1 + (rand() * 2 - 1) * wobble * (pad / Math.min(rx, ry));
        pts.push({ x: cx + ex * rx * bump, y: cy + ey * ry * bump });
    }
    const n = pts.length;
    const P = (i) => pts[(i + n) % n];
    let d = `M ${P(0).x.toFixed(1)} ${P(0).y.toFixed(1)}`;
    for (let i = 0; i < n; i++) {
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d + ' Z';
}

/**
 * Keeps an SVG island blob fitted around `target` inside `area`.
 *
 * @param {object} opts
 * @param {SVGSVGElement} opts.svg - full-area SVG layer (position absolute, inset 0)
 * @param {HTMLElement} opts.area - the city area
 * @param {HTMLElement} opts.target - element the island encloses (grid / island tiles)
 * @param {string} opts.id - path id
 * @param {object} [opts.shape] - coastPath options
 */
export function createIsland({ svg, area, target, id, shape = {} }) {
    let path = svg.querySelector(`#${id}`);
    if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('id', id);
        path.setAttribute('class', 'island');
        svg.appendChild(path);
    }
    let lastKey = '';
    function update(visible) {
        path.classList.toggle('is-visible', !!visible);
        if (!visible) return;
        const rect = layoutRect(target, area);
        const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.w)},${Math.round(rect.h)}`;
        if (key === lastKey) return;
        lastKey = key;
        svg.setAttribute('viewBox', `0 0 ${area.offsetWidth} ${area.offsetHeight}`);
        path.setAttribute('d', coastPath(rect, shape));
    }
    return { update, path };
}
