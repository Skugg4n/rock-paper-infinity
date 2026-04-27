/**
 * Render N outward dashes around an upgrade button. Each dash represents
 * one remaining purchase. As level increments, dashes fade out one by one.
 */

/**
 * @param {HTMLElement} buttonEl - The upgrade button.
 * @param {number} maxLevel - Total levels (= total dashes to render).
 */
export function setupDashes(buttonEl, maxLevel) {
    // Avoid double-setup
    if (buttonEl.querySelector('.upgrade-dashes')) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'upgrade-dashes');
    svg.setAttribute('viewBox', '-30 -30 60 60');

    // Subtle background ring (the "andra linjen" — kept as a quiet button-edge cue)
    const bgRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgRing.setAttribute('class', 'upgrade-dash-bg');
    bgRing.setAttribute('cx', '0');
    bgRing.setAttribute('cy', '0');
    bgRing.setAttribute('r', '23.5');
    bgRing.setAttribute('fill', 'none');
    svg.appendChild(bgRing);

    // Dashes — short outward radial ticks, almost dot-sized.
    // Each dash extends from r0 (just outside button) to r1 (a sliver further).
    const r0 = 25;   // 1px outside button edge
    const r1 = 26.5; // ~1.5 units = ~1.6px long, "almost like dots" per spec

    for (let i = 0; i < maxLevel; i++) {
        const angle = (i / maxLevel) * Math.PI * 2 - Math.PI / 2; // start from 12 o'clock
        const x0 = Math.cos(angle) * r0;
        const y0 = Math.sin(angle) * r0;
        const x1 = Math.cos(angle) * r1;
        const y1 = Math.sin(angle) * r1;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x0);
        line.setAttribute('y1', y0);
        line.setAttribute('x2', x1);
        line.setAttribute('y2', y1);
        line.setAttribute('class', 'upgrade-dash');
        svg.appendChild(line);
    }

    buttonEl.appendChild(svg);
}

/**
 * Update which dashes are visible based on current level.
 * Dashes for already-bought levels become `.is-spent` (faded out).
 *
 * @param {HTMLElement} buttonEl - The upgrade button.
 * @param {number} currentLevel - Current upgrade level.
 */
export function updateDashes(buttonEl, currentLevel) {
    const dashes = buttonEl.querySelectorAll('.upgrade-dash');
    dashes.forEach((dash, i) => {
        dash.classList.toggle('is-spent', i < currentLevel);
    });
}
