/**
 * Phase 1 game-logic module.
 *
 * Encapsulates the RPS result computation and board rendering for a single
 * round. Pure game logic — no timers, no auto-play scheduling. The
 * orchestrator (index.js) owns game state and passes side-effect callbacks
 * via the factory function.
 */

/** Maps RPS choice name → Lucide icon name. */
export const iconMap = { rock: 'gem', paper: 'file-text', scissors: 'scissors' };

const choices = ['rock', 'paper', 'scissors'];

/**
 * Factory that creates the game-logic object for Phase 1.
 *
 * @param {object} opts
 * @param {function(): number} opts.getStarMultiplier - Returns the current star multiplier
 * @param {function(): number} opts.getTotalStarsEarned - Returns total stars earned so far
 * @param {function(number): void} opts.onWin - Called with starGain on each player win
 * @param {function(): void} opts.onResultShown - Called after result DOM is updated (schedules UI update)
 * @param {function(string, string): Element} opts.getIcon - Returns a Lucide SVG element (name, className)
 * @param {function(Element, Element): void} opts.fireStarAnimation - Fires the flying-star effect
 * @param {Element} opts.winTracker - The win-tracker DOM element (star animation target)
 * @returns {{ showResult: function(string, object, boolean): void }}
 */
export function createGameLogic({ getStarMultiplier, getTotalStarsEarned, onWin, onResultShown, getIcon, fireStarAnimation, winTracker }) {
    /**
     * Computes the RPS result for a single round, updates the board DOM,
     * and fires win callbacks.
     *
     * @param {string} playerChoice - 'rock', 'paper', or 'scissors'
     * @param {{ playerEl: Element, computerEl: Element }} board - The board whose icons to update
     * @param {boolean} [instant=false] - Skip reveal animation (hyper-speed mode)
     */
    function showResult(playerChoice, board, instant = false) {
        const computerChoice = choices[Math.floor(Math.random() * choices.length)];
        let result;

        if (playerChoice === computerChoice) result = 'draw';
        else if (
            (playerChoice === 'rock' && computerChoice === 'scissors') ||
            (playerChoice === 'scissors' && computerChoice === 'paper') ||
            (playerChoice === 'paper' && computerChoice === 'rock')
        ) result = 'win';
        else result = 'lose';

        const revealClass = instant ? '' : 'reveal-item';
        // Celebrate (one-shot pulse) only on the first 3 wins — keeps the cue special
        const totalStarsEarned = getTotalStarsEarned();
        const celebrateClass = result === 'win' && totalStarsEarned < 3 ? 'celebrate' : '';

        const playerWrapper = document.createElement('div');
        playerWrapper.className = `result-wrapper inline-flex justify-center items-center ${revealClass} ${result === 'win' ? 'winner' : ''} ${celebrateClass}`.trim();
        playerWrapper.appendChild(getIcon(iconMap[playerChoice], 'lucide-lg text-slate-800'));
        board.playerEl.replaceChildren(playerWrapper);

        const computerWrapper = document.createElement('div');
        computerWrapper.className = `result-wrapper inline-flex justify-center items-center ${revealClass} ${result === 'lose' ? 'enemy-winner' : ''}`;
        computerWrapper.appendChild(getIcon(iconMap[computerChoice], 'lucide-lg text-slate-800'));
        board.computerEl.replaceChildren(computerWrapper);

        if (result === 'win') {
            const starGain = 1 * getStarMultiplier();
            onWin(starGain);
            // Flying-star animation: only for the first 10 stars earned
            if (getTotalStarsEarned() <= 10) {
                try {
                    fireStarAnimation(board.playerEl, winTracker);
                } catch (e) {
                    console.error('fireStarAnimation failed:', e);
                }
            }
        }

        onResultShown();
    }

    return { showResult };
}
