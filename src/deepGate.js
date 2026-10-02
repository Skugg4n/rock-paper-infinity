/**
 * The gate before IV · THE DEEP. Chapter IV is playable but not finished, so
 * at the end of the war the player chooses: go down, or stay. Asked at the
 * shovel, before anything irreversible (the hatch, the people leaving).
 *
 * Markup lives in index.html (#deep-gate), the look in style.css (.deep-gate).
 */

let pending = null;

/**
 * Opens the gate and resolves with the player's answer.
 * "Stay" and Escape are both a no. Asking while it is open returns the same
 * question. Without the gate in the page the answer is yes, so a missing
 * element can never strand the player at the end of the war.
 *
 * @returns {Promise<boolean>} true = go deep, false = stay
 */
export function askDeepGate() {
    if (pending) return pending;
    const gate = document.getElementById('deep-gate');
    const go = gate?.querySelector('[data-deep-gate="go"]');
    const stay = gate?.querySelector('[data-deep-gate="stay"]');
    if (!gate || !go || !stay) return Promise.resolve(true);

    pending = new Promise((resolve) => {
        const onGo = () => done(true);
        const onStay = () => done(false);
        const onKey = (e) => { if (e.key === 'Escape') done(false); };
        function done(answer) {
            go.removeEventListener('click', onGo);
            stay.removeEventListener('click', onStay);
            document.removeEventListener('keydown', onKey);
            gate.classList.remove('is-open');
            gate.setAttribute('aria-hidden', 'true');
            pending = null;
            resolve(answer);
        }
        go.addEventListener('click', onGo);
        stay.addEventListener('click', onStay);
        document.addEventListener('keydown', onKey);
        gate.classList.add('is-open');
        gate.setAttribute('aria-hidden', 'false');
    });
    return pending;
}
