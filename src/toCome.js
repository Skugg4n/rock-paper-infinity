/**
 * Chapter V · UNITY is closed for now (constants.js UNITY_OPEN). The way into it (the vault's rise, the dig's rise,
 * a save or a checkpoint already in chapter V) shows the card "V · UNITY · to come" and a quiet way back to the
 * main menu instead of starting the act.
 */
import { playChapterCard } from './chapterCard.js';

export const BACK_LABEL = 'Back to main menu';

/** The "to come" card and the button under it. */
export function showUnityToCome() {
    playChapterCard({ roman: 'V', title: 'UNITY', mode: 'to-come', dark: true });
    if (typeof document === 'undefined' || document.getElementById('back-to-menu')) return;
    const b = document.createElement('button');
    b.id = 'back-to-menu';
    b.type = 'button';
    b.textContent = BACK_LABEL;
    // the main menu is the page again, with the start screen in front (main.js, ☰ → Main menu)
    b.addEventListener('click', () => window.location.reload());
    document.body.appendChild(b);
}
