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

    const r0 = 26; // inner end (just outside button edge — button is ~24px radius)
    const r1 = 30; // outer end (4px outward)

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
