/**
 * Fires a flying-star animation: spawns an SVG star that travels from
 * sourceEl to targetEl (win-tracker), then removes itself on animationend.
 *
 * Designed to be called for the first few wins so the player sees their
 * stars "fly" to the tracker. Should not be called in tight loops.
 *
 * @param {Element} sourceEl - Source element (player result area)
 * @param {Element} targetEl - Target element (win-tracker)
 */
export function fireStarAnimation(sourceEl, targetEl) {
    if (!sourceEl || !targetEl) return;
    const fromRect = sourceEl.getBoundingClientRect();
    const toRect = targetEl.getBoundingClientRect();

    // Source: center of the source element, offset by half the star size (12px)
    const fromX = fromRect.left + fromRect.width / 2 - 12;
    const fromY = fromRect.top + fromRect.height / 2 - 12;

    // Target: center of win-tracker
    const toX = toRect.left + toRect.width / 2 - 12;
    const toY = toRect.top + toRect.height / 2 - 12;

    const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    star.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    star.setAttribute('width', '24');
    star.setAttribute('height', '24');
    star.setAttribute('viewBox', '0 0 24 24');
    star.setAttribute('fill', 'currentColor');
    star.setAttribute('stroke', 'none');
    star.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>';
    star.setAttribute('class', 'star-fly');
    star.style.setProperty('--from-x', `${fromX}px`);
    star.style.setProperty('--from-y', `${fromY}px`);
    star.style.setProperty('--to-x', `${toX}px`);
    star.style.setProperty('--to-y', `${toY}px`);

    document.body.appendChild(star);
    star.addEventListener('animationend', () => star.remove(), { once: true });
}
