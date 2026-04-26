/**
 * Phase 1 rendering helpers.
 *
 * All functions are pure renderers: they read data passed in and write to the DOM.
 * They must not mutate game state, only query it.
 *
 * Kept separate from index.js so the orchestrator owns state and the rendering
 * layer stays concerned only with "given this data, update these elements".
 */

import { getIcon } from "../icons.js";
import { getSPS, getVisibleDots, formatCount, fillFraction } from "./rates.js";

// --- Icon templates (built once, cloned per use) ---
const crownTemplate = getIcon('crown', 'lucide-crown-xl text-slate-800');
const gemLargeTemplate = getIcon('gem', 'lucide-gem-large text-slate-800');
const gemMediumTemplate = getIcon('gem', 'lucide-gem-medium text-slate-800');
const starSmallTemplate = getIcon('star', 'lucide-star-small text-slate-800');

// ---- Win tracker -------------------------------------------------------

/**
 * Re-renders the win-tracker element given current balance and totals.
 * Skips the render if nothing changed since last call.
 *
 * @param {object} refs   - { winTracker, lastStarBalance, lastTotalStarsEarned }
 * @param {number} starBalance
 * @param {number} totalStarsEarned
 * @returns {{ lastStarBalance: number, lastTotalStarsEarned: number }} updated cache
 */
export function renderWinTracker(refs, starBalance, totalStarsEarned) {
    const { winTracker } = refs;
    winTracker.innerHTML = '';
    const crowns = Math.floor(starBalance / 10000);
    const gems = Math.floor((starBalance % 10000) / 100);
    const smallStars = starBalance % 100;

    if (crowns > 0) {
        const container = document.createElement('div');
        container.className = 'grid grid-cols-5 gap-1 items-center';
        const displayedCrowns = Math.min(crowns, 10);
        for (let i = 0; i < displayedCrowns; i++) {
            const wrap = document.createElement('div');
            wrap.appendChild(crownTemplate.cloneNode(true));
            container.appendChild(wrap);
        }
        winTracker.appendChild(container);
        if (crowns > 10) {
            const extra = document.createElement('div');
            extra.className = 'flex items-center gap-1 text-slate-800';
            extra.appendChild(crownTemplate.cloneNode(true));
            const span = document.createElement('span');
            span.className = 'text-sm';
            span.textContent = `x ${crowns - 10}`;
            extra.appendChild(span);
            winTracker.appendChild(extra);
        }
    }

    const showGemPlaceholders = totalStarsEarned >= 10000;
    if (gems > 0 || showGemPlaceholders) {
        const container = document.createElement('div');
        container.className = 'grid grid-cols-10 gap-1 items-center';
        const gemTemplate = gems > 5 ? gemMediumTemplate : gemLargeTemplate;
        const totalSlots = showGemPlaceholders ? 100 : gems;
        for (let i = 0; i < totalSlots; i++) {
            const slot = document.createElement('div');
            if (i < gems) {
                slot.appendChild(gemTemplate.cloneNode(true));
            } else {
                slot.className = 'gem-dot';
            }
            container.appendChild(slot);
        }
        winTracker.appendChild(container);
    }

    const dotsToShow = getVisibleDots(totalStarsEarned);
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-10 gap-1';
    for (let i = 0; i < dotsToShow; i++) {
        const slot = document.createElement('div');
        if (i < smallStars) {
            const star = starSmallTemplate.cloneNode(true);
            star.setAttribute('fill', 'currentColor');
            star.setAttribute('stroke', 'none');
            slot.appendChild(star);
        } else {
            slot.className = 'dot';
        }
        gridContainer.appendChild(slot);
    }
    winTracker.appendChild(gridContainer);
}

// ---- Rate display -------------------------------------------------------

/**
 * Updates the SPS / EPS / EGPS rate indicators.
 *
 * @param {object} els - { spsContainer, spsValue, epsContainer, epsValue, egpsContainer, egpsValue }
 * @param {number} sps
 * @param {number} eps
 * @param {number} egps
 * @param {boolean} autoActive
 * @param {boolean} energyPaused
 */
export function renderRateDisplays(els, sps, eps, egps, autoActive, energyPaused) {
    const { spsContainer, spsValue, epsContainer, epsValue, egpsContainer, egpsValue } = els;

    if (sps > 0.1) {
        spsContainer.classList.remove('hidden');
        spsValue.textContent = sps.toFixed(1);
        spsContainer.classList.toggle('rate-paused', energyPaused);
    } else {
        spsContainer.classList.add('hidden');
    }

    if (autoActive) {
        epsContainer.classList.remove('hidden');
        epsValue.textContent = eps.toFixed(1);
    } else {
        epsContainer.classList.add('hidden');
    }

    if (egps > 0) {
        egpsContainer.classList.remove('hidden');
        egpsValue.textContent = egps.toFixed(1);
    } else {
        egpsContainer.classList.add('hidden');
    }
}

// ---- Progress circles ---------------------------------------------------

/**
 * Updates the three SVG progress ring strokes in the upgrade panel.
 *
 * @param {object} els - { speedProgressCircle, energyGenProgressCircle, addBoardProgressCircle }
 * @param {number} balance - current star balance
 * @param {object} upgrades - { speed, energyGenerator, addGameBoard }
 */
export function renderProgressCircles(els, balance, upgrades) {
    const circumference = 100.5;
    els.speedProgressCircle.style.strokeDashoffset =
        circumference * (1 - fillFraction(balance, upgrades.speed));
    els.energyGenProgressCircle.style.strokeDashoffset =
        circumference * (1 - fillFraction(balance, upgrades.energyGenerator));
    els.addBoardProgressCircle.style.strokeDashoffset =
        circumference * (1 - fillFraction(balance, upgrades.addGameBoard));
}

// ---- Quantum foam fill --------------------------------------------------

/**
 * Updates the collapse-foam button and fill bar.
 *
 * @param {object} els - { collapseFoamFill, collapseFoamBtn }
 * @param {number} percent - 0–100
 * @param {boolean} ready
 */
export function renderCollapseFoam(els, percent, ready) {
    els.collapseFoamFill.style.height = `${percent}%`;
    els.collapseFoamBtn.disabled = !ready;
    els.collapseFoamBtn.classList.toggle('ready', ready);
}

// ---- Resource bars ------------------------------------------------------

/**
 * Toggles the resource bars container.
 *
 * @param {HTMLElement} resourceBars
 * @param {boolean} show
 */
export function renderResourceBarsVisibility(resourceBars, show) {
    resourceBars.classList.toggle('hidden', !show);
}

/**
 * Updates the main energy fill bar height.
 *
 * @param {HTMLElement} energyFillEl
 * @param {number} percent - 0–100
 */
export function renderEnergyBar(energyFillEl, percent) {
    energyFillEl.style.height = `${percent}%`;
}

/**
 * Updates the reserve energy fill bar height.
 *
 * @param {HTMLElement} reserveEnergyFillEl
 * @param {number} percent - 0–100
 */
export function renderReserveBar(reserveEnergyFillEl, percent) {
    reserveEnergyFillEl.style.height = `${percent}%`;
}

/**
 * Flips the energy bar colour to indicate "empty" state.
 *
 * @param {HTMLElement} energyFillEl
 * @param {boolean} empty
 */
export function renderEnergyEmpty(energyFillEl, empty) {
    energyFillEl.classList.toggle('bg-slate-700', empty);
    energyFillEl.classList.toggle('bg-slate-500', !empty);
}

// ---- Game counters -------------------------------------------------------

let _counterIconsSet = false;

/**
 * Shows the games/wins counter and updates its values.
 * Inserts icons on the first call (one-time DOM mutation).
 *
 * @param {object} els - { gameCounters, gamesValueEl, winsValueEl }
 * @param {number} games
 * @param {number} wins
 */
export function renderGameCounters(els, games, wins) {
    const { gameCounters, gamesValueEl, winsValueEl } = els;
    if (games > 0) {
        gameCounters.classList.remove('hidden');
        gamesValueEl.textContent = formatCount(games);
        winsValueEl.textContent = formatCount(wins);
        if (!_counterIconsSet) {
            document.getElementById('games-icon').replaceWith(
                getIcon('swords', 'w-3 h-3 text-slate-400')
            );
            document.getElementById('wins-icon').replaceWith(
                getIcon('trophy', 'w-3 h-3 text-slate-400')
            );
            _counterIconsSet = true;
        }
    }
}

/**
 * Resets the one-time icon-insertion guard. Call this from phase teardown /
 * reset so that a fresh init re-inserts the icons.
 */
export function resetCounterIconState() {
    _counterIconsSet = false;
}

// ---- Upgrade visibility & state -----------------------------------------

/**
 * Updates upgrade button visibility, disabled state, and materialize animation.
 *
 * @param {object} opts
 * @param {object} opts.upgrades           - The upgrades map
 * @param {number} opts.starBalance
 * @param {number} opts.totalStarsEarned
 * @param {number} opts.totalGamesPlayed
 * @param {number} opts.gameSpeed
 * @param {boolean} opts.isMetaBoardActive
 * @param {number} opts.boardCount
 * @param {number} opts.starMultiplier
 * @param {Set}    opts.revealedUpgrades   - mutable; this function adds keys to it
 * @param {boolean} opts.firstDone         - whether first upgrade update has already run
 * @param {AbortSignal} opts.signal        - for animationend listener cleanup
 * @param {HTMLElement} opts.quantumFoamContainer
 * @returns {boolean} true on the very first call (caller should set firstDone = true)
 */
export function renderUpgrades({
    upgrades,
    starBalance,
    totalStarsEarned,
    totalGamesPlayed,
    gameSpeed,
    isMetaBoardActive,
    boardCount,
    starMultiplier,
    revealedUpgrades,
    firstDone,
    signal,
    quantumFoamContainer,
}) {
    const factoryReady = upgrades.mergeGameBoard.unlockCondition &&
        upgrades.mergeGameBoard.unlockCondition() &&
        !upgrades.mergeGameBoard.purchased;

    for (const key in upgrades) {
        const upgrade = upgrades[key];

        if (factoryReady && key !== 'mergeGameBoard') {
            upgrade.element.classList.add('invisible');
            continue;
        }

        let isUnlocked = (upgrade.unlocksAt === 0) ||
            (upgrade.unlocksAt > 0 && totalStarsEarned >= upgrade.unlocksAt) ||
            (upgrade.unlocksAtGames > 0 && totalGamesPlayed >= upgrade.unlocksAtGames) ||
            (upgrade.unlocksAtSPS > 0 &&
                getSPS(gameSpeed, isMetaBoardActive, boardCount, starMultiplier) >= upgrade.unlocksAtSPS) ||
            Object.keys(upgrades).some(parentKey => {
                const parent = upgrades[parentKey];
                const parentUnlocked =
                    (parent.level !== undefined && parent.level >= parent.maxLevel) ||
                    parent.purchased;
                return parent.unlocks && parent.unlocks.includes(key) && parentUnlocked;
            });

        if (typeof upgrade.unlockCondition === 'function') {
            isUnlocked = isUnlocked && upgrade.unlockCondition();
        }

        if (isUnlocked) {
            if (isMetaBoardActive && (key === 'addGameBoard' || key === 'mergeGameBoard')) {
                upgrade.element.classList.add('invisible');
            } else {
                const wasHidden = upgrade.element.classList.contains('invisible');
                upgrade.element.classList.remove('invisible');
                if (wasHidden && !revealedUpgrades.has(key)) {
                    revealedUpgrades.add(key);
                    if (firstDone) {
                        upgrade.element.classList.add('materialize');
                        upgrade.element.addEventListener('animationend', () => {
                            upgrade.element.classList.remove('materialize');
                        }, { once: true, signal });
                    }
                }
                revealedUpgrades.add(key);
            }

            const currentCost = typeof upgrade.cost === 'function' ? upgrade.cost() : upgrade.cost;

            if (upgrade.level !== undefined) {
                upgrade.element.disabled =
                    (starBalance < currentCost) || (upgrade.level >= upgrade.maxLevel);
                if (upgrade.level >= upgrade.maxLevel) upgrade.element.classList.add('purchased');
            } else if (upgrade.consumable) {
                upgrade.element.disabled = starBalance < currentCost;
            } else {
                upgrade.element.disabled = (starBalance < currentCost) || upgrade.purchased;
                if (upgrade.purchased) upgrade.element.classList.add('purchased');
            }
        } else {
            upgrade.element.classList.add('invisible');
        }
    }

    // Quantum foam tease / lock / show logic
    if (upgrades.mergeGameBoard.purchased) {
        quantumFoamContainer.classList.remove('is-locked');
    } else if (factoryReady) {
        quantumFoamContainer.classList.remove('hidden');
        quantumFoamContainer.classList.add('is-locked');
    } else {
        quantumFoamContainer.classList.add('hidden');
        quantumFoamContainer.classList.remove('is-locked');
    }

    // Return whether this was the first run (caller uses it to set firstDone flag)
    return !firstDone;
}
