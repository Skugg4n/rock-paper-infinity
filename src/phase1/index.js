import { getIcon } from "../icons.js";
import { phases, setPhase } from "../gamePhase.js";
import { playChapterCard } from "../chapterCard.js";
import { PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE_KEY } from "../constants.js";
import { getSPS, getEPS } from "./rates.js";
import { generateCostVisual } from "./cost-visual.js";
import { runCountdownAnimation } from "./countdown.js";
import { serializeGameState, saveToStorage, loadFromStorage, sanitizeNumber } from "./persistence.js";
import { fireStarAnimation } from "./star-animation.js";
import { createUpgrades } from "./upgrades-config.js";
import { createGameLogic, iconMap } from "./game-logic.js";
import { mountSaveButtons } from "../save-export.js";
import {
    renderWinTracker,
    renderRateDisplays,
    renderProgressCircles,
    renderCollapseFoam,
    renderResourceBarsVisibility,
    renderEnergyBar,
    renderReserveBar,
    renderEnergyEmpty,
    renderGameCounters,
    resetCounterIconState,
    renderUpgrades,
} from "./rendering.js";
import { timed, counter } from "../perf.js";

        // DOM elements
        const gameBoardContainer = document.getElementById('game-board-container');
        const choiceButtons = document.querySelectorAll('#player-controls-container .choice-btn');
        const winTracker = document.getElementById('win-tracker');
        const energyFillEl = document.getElementById('energy-fill');
        const reserveEnergyFillEl = document.getElementById('reserve-energy-fill');
        const quantumFoamContainer = document.getElementById('quantum-foam-container');
        const collapseFoamBtn = document.getElementById('collapse-foam-btn');
        const collapseFoamFill = document.getElementById('collapse-foam-fill');
        const spsContainer = document.getElementById('sps-container');
        const spsValue = document.getElementById('sps-value');
        const epsContainer = document.getElementById('eps-container');
        const epsValue = document.getElementById('eps-value');
        const egpsContainer = document.getElementById('egps-container');
        const egpsValue = document.getElementById('egps-value');
        const resourceBars = document.getElementById('resource-bars');
        const gameCounters = document.getElementById('game-counters');
        const gamesValueEl = document.getElementById('games-value');
        const winsValueEl = document.getElementById('wins-value');
        const debugTrigger = document.getElementById('debug-trigger');
        const debugMenu = document.getElementById('debug-menu');
        const debugSpeedEl = document.getElementById('debug-speed');
        const debugGamesPlayedEl = document.getElementById('debug-games-played');
        const dynamicStyles = document.getElementById('dynamic-styles');
        const speedProgressCircle = document.getElementById('speed-progress');
        const energyGenProgressCircle = document.getElementById('energy-gen-progress');
        const addBoardProgressCircle = document.getElementById('add-board-progress');
const tooltip = document.getElementById('tooltip');
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const resetBtn = document.getElementById('reset-btn');

        let listenerController = null;

        // Game variables
        let starBalance = 0;
        let totalStarsEarned = 0;
        let totalGamesPlayed = 0;
        let totalWins = 0;
        let energy = PHASE1_CONSTANTS.MAX_ENERGY;
        let reserveEnergy = 0;
        const { MAX_ENERGY, MAX_RESERVE_ENERGY, MAX_QUANTUM_FOAM, HYPER_SPEED_THRESHOLD, SAVE_KEY } = PHASE1_CONSTANTS;
        let autoPlayInterval = null;
        let autoPlayWantsToRun = false;
        let gameSpeed = 1;
        let lastTick = performance.now();
        let lastUIRender = performance.now();
        let passiveInterval = null;
        let lastStarBalance = -1;
        let lastTotalStarsEarned = -1;
        let gameBoards = [];
        let isMetaBoardActive = false;
        let starMultiplier = 1;
        let quantumFoam = 0;
        let revealedUpgrades = new Set();
        let firstUpgradeUpdateDone = false;
        
        function doSetPhaseToCity() {
            localStorage.setItem(PHASE2_CONSTANTS.STARS_TRANSFER_KEY, String(starBalance));
            // Persist phase change immediately so a reload during the chapter card
            // doesn't leave the player stranded in Phase 1 with bank already purchased.
            localStorage.setItem(PHASE_KEY, phases.CITY);
            playChapterCard({
                roman: 'II',
                title: 'CAPITAL',
                onMidpoint: () => setPhase(phases.CITY),
            });
        }

        const upgrades = createUpgrades({
            rechargeEnergy:    () => { energy = Math.min(MAX_ENERGY, energy + 10); },
            addReserve:        () => { reserveEnergy = Math.min(MAX_RESERVE_ENERGY, reserveEnergy + 700); },
            incrementSpeed:    () => { gameSpeed += 1; },
            multiplyStars:     () => { starMultiplier *= 1.5; },
            createGameBoard:   () => createGameBoard(),
            mergeToMetaBoard:  () => mergeToMetaBoard(),
            setPhaseToCity:    () => doSetPhaseToCity(),
            getTotalStarsEarned: () => totalStarsEarned,
        });

const choices = ['rock', 'paper', 'scissors'];

const { showResult } = createGameLogic({
    getStarMultiplier: () => starMultiplier,
    getTotalStarsEarned: () => totalStarsEarned,
    onWin: (starGain) => {
        totalWins++;
        starBalance += starGain;
        totalStarsEarned += starGain;
    },
    onResultShown: () => scheduleUIUpdate(),
    getIcon,
    fireStarAnimation,
    winTracker,
});

let uiUpdatePending = false;
function scheduleUIUpdate() {
    if (!uiUpdatePending) {
        uiUpdatePending = true;
        requestAnimationFrame(() => {
            uiUpdatePending = false;
            counter('p1:rAF');
            timed('p1:fastUiTick', updateUI);
        });
    }
}

        function setupButtons() {
            const signal = listenerController.signal;
            document.querySelectorAll('button').forEach(btn => {
                const choice = btn.dataset.choice;
                const upgrade = btn.dataset.upgrade;
                if (!choice && !upgrade) return;
                btn.addEventListener('pointerup', (e) => {
                    e.preventDefault();
                    if (choice) playGame(choice);
                    else handleUpgradeClick(upgrade);
                }, { signal });
                btn.addEventListener('mouseenter', () => {
                    const key = choice ? 'choice' : upgrade;
                    if (key) showTooltip(btn, key);
                }, { signal });
                btn.addEventListener('mouseleave', hideTooltip, { signal });
            });
        }

        function setupDebugButtons() {
            const signal = listenerController.signal;
            document.querySelectorAll('#debug-menu [data-add-stars]').forEach(btn => {
                btn.addEventListener('click', () => addStars(parseInt(btn.dataset.addStars, 10)), { signal });
            });
            document.querySelectorAll('#debug-menu [data-change-speed]').forEach(btn => {
                btn.addEventListener('click', () => changeSpeed(parseInt(btn.dataset.changeSpeed, 10)), { signal });
            });
        }

        function createGameBoard() {
            const boardId = `game-board-${gameBoards.length + 1}`;
            const board = document.createElement('div');
            board.id = boardId;
            board.className = 'bg-white rounded-2xl shadow-md aspect-square w-full h-auto flex flex-col justify-around items-center p-4 transition-all';
            board.innerHTML = `
                <div class="relative h-20 w-20 flex justify-center items-center">
                    <div class="computer-result-icon text-slate-400"></div>
                </div>
                <div class="relative h-20 w-20 flex justify-center items-center">
                    <div class="player-result-icon text-slate-400"></div>
                </div>
            `;
            gameBoardContainer.appendChild(board);
            gameBoards.push({
                id: boardId,
                element: board,
                isAnimating: false,
                computerEl: board.querySelector('.computer-result-icon'),
                playerEl: board.querySelector('.player-result-icon')
            });
            adjustBoardLayout();
        }
        
        function adjustBoardLayout() {
            const count = gameBoards.length;
            if (isMetaBoardActive) return;

            let cols = 1;
            if (count > 1) cols = 2;
            if (count > 4) cols = 3;
            gameBoardContainer.className = `flex-grow grid grid-cols-${cols} items-center justify-center gap-4`;
            
            if (count > 4) {
                gameBoardContainer.classList.add('small-icons');
            } else {
                gameBoardContainer.classList.remove('small-icons');
            }
        }

        function mergeToMetaBoard(fromLoad = false) {
            isMetaBoardActive = true;
            if (!fromLoad) starMultiplier *= 10;
            gameBoards.forEach(board => board.element.style.display = 'none');

            let metaBoard = document.getElementById('meta-board');
            if (!metaBoard) {
                metaBoard = document.createElement('div');
                metaBoard.id = 'meta-board';
                metaBoard.className = 'rounded-2xl w-48 h-48 sm:w-72 sm:h-72 flex justify-center items-center relative';

                // Conveyor belt animation (inside the box, behind factory icon)
                const anim = document.createElement('div');
                anim.className = 'factory-animation';

                // RPS icons: enter from right, move toward center
                ['gem', 'file-text', 'scissors', 'gem'].forEach((name, i) => {
                    const icon = getIcon(name, 'factory-rps-icon');
                    icon.style.animationDelay = `${i * 0.9}s`;
                    anim.appendChild(icon);
                });

                // Star icons: emerge from center, exit to left
                for (let i = 0; i < 4; i++) {
                    const icon = getIcon('star', 'factory-star-icon');
                    icon.style.animationDelay = `${i * 0.9}s`;
                    anim.appendChild(icon);
                }

                // Subtle smoke puffs
                for (let i = 0; i < 2; i++) {
                    const puff = document.createElement('div');
                    puff.className = 'factory-smoke-puff';
                    puff.style.animationDelay = `${i * 1.8}s`;
                    anim.appendChild(puff);
                }

                metaBoard.appendChild(anim);
                metaBoard.appendChild(getIcon('factory', 'factory-center-icon'));

                gameBoardContainer.innerHTML = '';
                gameBoardContainer.className = 'pointer-events-none flex-grow grid grid-cols-1 items-center justify-center max-w-sm mx-auto';
                gameBoardContainer.appendChild(metaBoard);
            }
            metaBoard.style.display = 'flex';

            quantumFoamContainer.classList.remove('hidden');
        }

        export function init() {
            listenerController = new AbortController();
            const signal = listenerController.signal;

            loadGame();
            if (gameBoards.length === 0) createGameBoard();
            setupButtons();
            setupDebugButtons();
            collapseFoamBtn.addEventListener('click', collapseFoam, { signal });
            menuBtn.addEventListener('click', () => menuDropdown.classList.toggle('hidden'), { signal });
            resetBtn.addEventListener('click', resetGame, { signal });

            updateAnimationSpeed();
            scheduleUIUpdate();
            debugTrigger.addEventListener('click', () => debugMenu.classList.toggle('hidden'), { signal });
            manageAutoPlay();
            passiveInterval = setInterval(passiveTick, 1000);
            document.addEventListener('visibilitychange', handleVisibilityChange, { signal });
            mountSaveButtons(debugMenu);
        }

        function passiveTick() {
            timed('p1:logicTick', () => {
                const energyGen = upgrades.energyGenerator.level * 5;
                if (energyGen > 0) {
                    const newEnergy = energy + energyGen;
                    if (newEnergy <= MAX_ENERGY) {
                        energy = newEnergy;
                    } else {
                        const overflow = newEnergy - MAX_ENERGY;
                        energy = MAX_ENERGY;
                        reserveEnergy = Math.min(MAX_RESERVE_ENERGY, reserveEnergy + overflow);
                    }
                }
                manageAutoPlay();
                saveGame();
            });
            scheduleUIUpdate();
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                if (passiveInterval) {
                    clearInterval(passiveInterval);
                    passiveInterval = null;
                }
                stopAutoPlayInterval();
            } else {
                if (!passiveInterval) passiveInterval = setInterval(passiveTick, 1000);
                if (autoPlayWantsToRun && !autoPlayInterval) restartAutoPlay();
            }
        }

        function updateAnimationSpeed() {
            const animationDuration = 1.2 / gameSpeed;
            dynamicStyles.innerHTML = `
                .countdown-pop { animation-duration: ${animationDuration / 3}s; }
                .reveal-item { animation-duration: ${0.4 / gameSpeed}s; }
            `;
            debugSpeedEl.textContent = `⚡︎ ${gameSpeed}x`;
            if (autoPlayInterval) restartAutoPlay();
        }

        function updateWinVisuals() {
            if (starBalance === lastStarBalance && totalStarsEarned === lastTotalStarsEarned) return;
            lastStarBalance = starBalance;
            lastTotalStarsEarned = totalStarsEarned;
            renderWinTracker({ winTracker }, starBalance, totalStarsEarned);
        }
        
        function updateRateDisplays(sps, eps, egps, autoActive, energyPaused) {
            renderRateDisplays(
                { spsContainer, spsValue, epsContainer, epsValue, egpsContainer, egpsValue },
                sps, eps, egps, autoActive, energyPaused
            );
        }

        function updateProgressCircles(balance) {
            renderProgressCircles(
                { speedProgressCircle, energyGenProgressCircle, addBoardProgressCircle },
                balance, upgrades
            );
        }

        function updateCollapseFoam(percent, ready) {
            renderCollapseFoam({ collapseFoamFill, collapseFoamBtn }, percent, ready);
        }

        function updateUpgrades() {
            renderUpgrades({
                upgrades,
                starBalance,
                totalStarsEarned,
                totalGamesPlayed,
                gameSpeed,
                isMetaBoardActive,
                boardCount: gameBoards.length,
                starMultiplier,
                revealedUpgrades,
                firstDone: firstUpgradeUpdateDone,
                signal: listenerController.signal,
                quantumFoamContainer,
            });
            if (!firstUpgradeUpdateDone) firstUpgradeUpdateDone = true;
        }

const uiState = {
    gamesPlayed: 0,
    totalWins: 0,
    showResources: false,
    energyPercent: -1,
    reservePercent: -1,
    energyEmpty: null,
    sps: -1,
    eps: -1,
    egps: -1,
    autoPlayActive: false,
    energyPaused: false,
    starBalance: -1,
    totalStarsEarned: -1,
    isMetaBoardActive: false,
    foamPercent: -1,
    foamReady: false
};

        function updateUI() {
            const games = Math.floor(totalGamesPlayed);
            const showResources = totalStarsEarned >= 10;
            const energyPercent = (energy / MAX_ENERGY) * 100;
            const reservePercent = (reserveEnergy / MAX_RESERVE_ENERGY) * 100;
            const energyEmpty = energy <= 0;
            const sps = getSPS(gameSpeed, isMetaBoardActive, gameBoards.length, starMultiplier);
            const eps = getEPS(gameSpeed, isMetaBoardActive, gameBoards.length);
            const egps = upgrades.energyGenerator.level * 5;
            const autoActive = !!autoPlayInterval;
            const energyPaused = autoPlayWantsToRun && energyEmpty;
            const foamPercent = (quantumFoam / MAX_QUANTUM_FOAM) * 100;
            const foamReady = quantumFoam >= MAX_QUANTUM_FOAM;

            const wins = Math.floor(totalWins);
            const gamesChanged = games !== uiState.gamesPlayed || wins !== uiState.totalWins;
            const resourcesChanged = showResources !== uiState.showResources;
            const energyChanged = energyPercent !== uiState.energyPercent;
            const reserveChanged = reservePercent !== uiState.reservePercent;
            const emptyChanged = energyEmpty !== uiState.energyEmpty;
            const rateChanged = sps !== uiState.sps || eps !== uiState.eps || egps !== uiState.egps || autoActive !== uiState.autoPlayActive || energyPaused !== uiState.energyPaused;
            const balanceChanged = starBalance !== uiState.starBalance;
            const foamChanged = isMetaBoardActive && (foamPercent !== uiState.foamPercent || foamReady !== uiState.foamReady);
            const upgradesChanged = balanceChanged || totalStarsEarned !== uiState.totalStarsEarned || gamesChanged || rateChanged || isMetaBoardActive !== uiState.isMetaBoardActive;

            const tasks = [];
            if (gamesChanged) tasks.push(() => {
                debugGamesPlayedEl.textContent = games;
                renderGameCounters({ gameCounters, gamesValueEl, winsValueEl }, games, wins);
            });
            if (resourcesChanged) tasks.push(() => renderResourceBarsVisibility(resourceBars, showResources));
            if (energyChanged) tasks.push(() => renderEnergyBar(energyFillEl, energyPercent));
            if (reserveChanged) tasks.push(() => renderReserveBar(reserveEnergyFillEl, reservePercent));
            if (emptyChanged) tasks.push(() => renderEnergyEmpty(energyFillEl, energyEmpty));
            if (rateChanged) tasks.push(() => updateRateDisplays(sps, eps, egps, autoActive, energyPaused));
            if (balanceChanged) tasks.push(() => updateProgressCircles(starBalance));
            if (upgradesChanged) tasks.push(updateUpgrades);
            if (foamChanged) tasks.push(() => updateCollapseFoam(foamPercent, foamReady));

            if (!tasks.length) return;

            tasks.push(updateWinVisuals);
            tasks.forEach(fn => fn());

            if (gamesChanged) { uiState.gamesPlayed = games; uiState.totalWins = wins; }
            if (resourcesChanged) uiState.showResources = showResources;
            if (energyChanged) uiState.energyPercent = energyPercent;
            if (reserveChanged) uiState.reservePercent = reservePercent;
            if (emptyChanged) uiState.energyEmpty = energyEmpty;
            if (rateChanged) { uiState.sps = sps; uiState.eps = eps; uiState.egps = egps; uiState.autoPlayActive = autoActive; uiState.energyPaused = energyPaused; }
            if (balanceChanged) uiState.starBalance = starBalance;
            if (upgradesChanged) { uiState.totalStarsEarned = totalStarsEarned; uiState.isMetaBoardActive = isMetaBoardActive; }
            if (foamChanged) { uiState.foamPercent = foamPercent; uiState.foamReady = foamReady; }
        }

        function consumeEnergy(amount = 1) {
            if (energy >= amount) {
                energy -= amount;
            } else {
                const remaining = amount - energy;
                energy = 0;
                reserveEnergy = Math.max(0, reserveEnergy - remaining);
            }
        }

        function hasEnergy() {
            return energy > 0 || reserveEnergy > 0;
        }

        function saveGame() {
            const state = {
                starBalance, totalStarsEarned, totalGamesPlayed, totalWins,
                energy, reserveEnergy, gameSpeed, starMultiplier, quantumFoam,
                isMetaBoardActive, autoPlayWantsToRun,
                gameBoardsCount: gameBoards.length
            };
            saveToStorage(SAVE_KEY, serializeGameState(state, upgrades));
        }

        function loadGame() {
            const data = loadFromStorage(SAVE_KEY);
            if (!data) return;
            try {
                starBalance = sanitizeNumber(data.starBalance) ?? starBalance;
                totalStarsEarned = sanitizeNumber(data.totalStarsEarned) ?? totalStarsEarned;
                totalGamesPlayed = sanitizeNumber(data.totalGamesPlayed) ?? totalGamesPlayed;
                totalWins = sanitizeNumber(data.totalWins) ?? totalWins;
                energy = sanitizeNumber(data.energy) ?? energy;
                reserveEnergy = sanitizeNumber(data.reserveEnergy) ?? reserveEnergy;
                starMultiplier = sanitizeNumber(data.starMultiplier) ?? starMultiplier;
                quantumFoam = sanitizeNumber(data.quantumFoam) ?? quantumFoam;
                isMetaBoardActive = data.isMetaBoardActive ?? isMetaBoardActive;
                autoPlayWantsToRun = data.autoPlayWantsToRun ?? autoPlayWantsToRun;
                if (data.upgrades) {
                    for (const key in data.upgrades) {
                        if (upgrades[key]) {
                            const info = data.upgrades[key];
                            if (info.level !== undefined) upgrades[key].level = info.level;
                            if (info.purchased !== undefined) upgrades[key].purchased = info.purchased;
                        }
                    }
                }
                if (upgrades.speed && upgrades.speed.level !== undefined) {
                    gameSpeed = 1 + upgrades.speed.level;
                } else {
                    gameSpeed = data.gameSpeed ?? gameSpeed;
                }
                const boards = data.gameBoards || 0;
                for (let i = 0; i < boards; i++) createGameBoard();
                if (isMetaBoardActive) {
                    mergeToMetaBoard(true);
                }
                if (upgrades.luck.purchased) {
                    upgrades.luck.element.style.display = 'none';
                }
            } catch (e) {
                console.error('Failed to load save', e);
            }
        }

        function resetGame() {
            if (!confirm('Reset all progress? This cannot be undone.')) return;
            stopAutoPlayInterval();
            autoPlayWantsToRun = false;
            localStorage.removeItem(SAVE_KEY);
            localStorage.removeItem(PHASE2_CONSTANTS.SAVE_KEY);
            localStorage.removeItem(PHASE2_CONSTANTS.STARS_TRANSFER_KEY);
            localStorage.removeItem(PHASE_KEY);
            starBalance = 0;
            totalStarsEarned = 0;
            totalGamesPlayed = 0;
            totalWins = 0;
            energy = MAX_ENERGY;
            reserveEnergy = 0;
            starMultiplier = 1;
            quantumFoam = 0;
            gameSpeed = 1;
            isMetaBoardActive = false;
            // Invalidate uiState cache so the next updateUI() does a full re-render.
            // Without this, dirty cached values from before the reset cause some UI
            // renders to be skipped on the first post-reset update.
            Object.assign(uiState, {
                gamesPlayed: -1, totalWins: -1, showResources: false,
                energyPercent: -1, reservePercent: -1, energyEmpty: null,
                sps: -1, eps: -1, egps: -1, autoPlayActive: false,
                energyPaused: false, starBalance: -1, totalStarsEarned: -1,
                isMetaBoardActive: false, foamPercent: -1, foamReady: false,
            });
            quantumFoamContainer.classList.add('hidden');
            quantumFoamContainer.classList.remove('is-locked');
            gameBoards = [];
            gameBoardContainer.className = 'pointer-events-none flex-grow grid grid-cols-1 items-center justify-center gap-4';
            gameBoardContainer.innerHTML = '';
            for (const key in upgrades) {
                const up = upgrades[key];
                if (up.level !== undefined) up.level = 0;
                if (up.purchased !== undefined) up.purchased = false;
                up.element.classList.remove('purchased', 'invisible', 'toggled', 'pulse');
                up.element.disabled = false;
                up.element.style.display = '';
            }
            revealedUpgrades = new Set();
            firstUpgradeUpdateDone = false;
            resetCounterIconState();
            createGameBoard();
            choiceButtons.forEach(btn => btn.disabled = false);
            menuDropdown.classList.add('hidden');
            updateAnimationSpeed();
            manageAutoPlay();
            scheduleUIUpdate();
        }

        async function playGame(playerChoice, board = gameBoards[0]) {
            if (isMetaBoardActive || board.isAnimating || !hasEnergy()) return;
            board.isAnimating = true;
            consumeEnergy();
            totalGamesPlayed++;

            choiceButtons.forEach(btn => btn.disabled = true);

            const instant = gameSpeed >= HYPER_SPEED_THRESHOLD && !!autoPlayInterval;
            if (!instant) await runCountdownAnimation(board, gameSpeed);
            showResult(playerChoice, board, instant);

            if (!hasEnergy() && autoPlayInterval) stopAutoPlayInterval();

            setTimeout(() => {
                board.isAnimating = false;
                if (!autoPlayInterval) choiceButtons.forEach(btn => btn.disabled = !hasEnergy());
                scheduleUIUpdate();
            }, instant ? 50 : 400);
        }
        
        function handleUpgradeClick(key) {
            const upgrade = upgrades[key];
            if (key === 'autoPlay' && upgrade.purchased) {
                toggleAutoPlayState();
                return;
            }
            
            const currentCost = (typeof upgrade.cost === 'function') ? upgrade.cost() : upgrade.cost;
            if (starBalance >= currentCost) {
                if(upgrade.level !== undefined && upgrade.level >= upgrade.maxLevel) return;

                starBalance -= currentCost;
                if (upgrade.level === undefined && !upgrade.consumable) {
                    upgrade.purchased = true;
                }
                upgrade.purchase();
                scheduleUIUpdate();
                if (key === 'autoPlay') toggleAutoPlayState();
                if (key.startsWith('speed')) updateAnimationSpeed();
            }
        }
        

        function processBulkGames() {
            const now = performance.now();
            const delta = (now - lastTick) / 1000;
            lastTick = now;

            if (!hasEnergy()) {
                stopAutoPlayInterval();
                return;
            }
            
            const boardMultiplier = isMetaBoardActive ? 9 : gameBoards.length;
            const gamesToPlay = gameSpeed * boardMultiplier * delta;
            const energyToConsume = Math.min(energy + reserveEnergy, gamesToPlay);
            consumeEnergy(energyToConsume);
            totalGamesPlayed += energyToConsume;

            const wins = energyToConsume / 3;
            const roundedWins = Math.floor(wins) + (Math.random() < (wins % 1) ? 1 : 0);
            totalWins += roundedWins;

            const starGain = roundedWins * starMultiplier;
            starBalance += starGain;
            totalStarsEarned += starGain;

            if (isMetaBoardActive) {
                quantumFoam = Math.min(MAX_QUANTUM_FOAM, quantumFoam + energyToConsume);
            }
            
            if (!isMetaBoardActive) {
                gameBoards.forEach(board => {
                    const randomChoice1 = choices[Math.floor(Math.random() * 3)];
                    board.computerEl.replaceChildren(getIcon(iconMap[randomChoice1], 'lucide-lg text-slate-400'));
                    board.playerEl.replaceChildren(getIcon(iconMap[choices[Math.floor(Math.random() * 3)]], 'lucide-lg text-slate-400'));
                });
            }
        }

        function collapseFoam() {
            if (quantumFoam < MAX_QUANTUM_FOAM) return;
            
            const bonus = Math.floor(getSPS(gameSpeed, isMetaBoardActive, gameBoards.length, starMultiplier) * 10);
            addStars(bonus);
            quantumFoam = 0;
            
            const metaBoard = document.getElementById('meta-board');
            if(metaBoard) {
                metaBoard.classList.add('pop-item');
                setTimeout(() => metaBoard.classList.remove('pop-item'), 500);
            }
            scheduleUIUpdate();
        }

        function restartAutoPlay() {
            stopAutoPlayInterval();
            lastTick = performance.now();
            lastUIRender = performance.now();
            const step = (now) => {
                if (!autoPlayWantsToRun || !hasEnergy()) {
                    stopAutoPlayInterval();
                    return;
                }
                const processInterval = (gameSpeed >= HYPER_SPEED_THRESHOLD || isMetaBoardActive) ? 100 : (1.2 / gameSpeed * 1000) + 450;
                const interval = processInterval / (isMetaBoardActive ? 1 : gameBoards.length);
                if (now - lastTick >= interval) {
                    if (gameSpeed >= HYPER_SPEED_THRESHOLD || isMetaBoardActive) {
                        processBulkGames();
                    } else {
                        gameBoards.forEach(board => {
                            if(!board.isAnimating) playGame(choices[Math.floor(Math.random() * 3)], board);
                        });
                    }
                    lastTick = now;
                }
                if (now - lastUIRender >= 100) {
                    scheduleUIUpdate();
                    lastUIRender = now;
                }
                autoPlayInterval = requestAnimationFrame(step);
            };
            autoPlayInterval = requestAnimationFrame(step);
        }

        function manageAutoPlay() {
            if (autoPlayWantsToRun && !autoPlayInterval && hasEnergy()) {
                choiceButtons.forEach(btn => btn.disabled = true);
                upgrades.autoPlay.element.classList.add('toggled');
                lastTick = performance.now();
                restartAutoPlay();
            } else if (!autoPlayWantsToRun && autoPlayInterval) {
                stopAutoPlayInterval();
                upgrades.autoPlay.element.classList.remove('toggled');
            }
        }

        function stopAutoPlayInterval() {
            if (!autoPlayInterval) return;
            cancelAnimationFrame(autoPlayInterval);
            autoPlayInterval = null;
            if (!isMetaBoardActive) {
                choiceButtons.forEach(btn => btn.disabled = !hasEnergy());
                gameBoards.forEach(board => {
                    board.computerEl.innerHTML = '';
                    board.playerEl.innerHTML = '';
                });
            }
        }

        function toggleAutoPlayState() {
            autoPlayWantsToRun = !autoPlayWantsToRun;
            if(autoPlayWantsToRun) {
                 upgrades.autoPlay.element.classList.add('toggled');
            } else {
                 upgrades.autoPlay.element.classList.remove('toggled');
            }
            manageAutoPlay();
        }
        
        let tooltipHideTimeout = null;

        function showTooltip(element, key) {
            if (key === 'choice') return;
            const upgrade = upgrades[key];
            if (!upgrade || (upgrade.purchased && !upgrade.consumable && !upgrade.level) || (upgrade.level >= upgrade.maxLevel)) return;

            if (tooltipHideTimeout) {
                clearTimeout(tooltipHideTimeout);
                tooltipHideTimeout = null;
            }

            const cost = typeof upgrade.cost === 'function' ? upgrade.cost() : upgrade.cost;
            const tooltipHtml = generateCostVisual(cost);
            if (!tooltipHtml.trim()) return;
            tooltip.innerHTML = tooltipHtml;

            const rect = element.getBoundingClientRect();
            tooltip.style.display = 'block';
            tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
            tooltip.style.opacity = '1';
        }

        function hideTooltip() {
            tooltip.style.opacity = '0';
            tooltipHideTimeout = setTimeout(() => { tooltip.style.display = 'none'; }, 200);
        }

        export function teardown() {
            stopAutoPlayInterval();
            if (passiveInterval) {
                clearInterval(passiveInterval);
                passiveInterval = null;
            }
            if (listenerController) {
                listenerController.abort();
                listenerController = null;
            }
        }

        // --- DEBUG FUNCTIONS ---
        function addStars(amount) {
            starBalance += amount;
            totalStarsEarned += amount;
            scheduleUIUpdate();
        }
        function changeSpeed(amount) {
            const currentLevel = upgrades.speed.level;
            const newLevel = currentLevel + amount;
            if (newLevel >= 0 && newLevel <= upgrades.speed.maxLevel) {
                upgrades.speed.level = newLevel;
                gameSpeed = 1 + newLevel;
                updateAnimationSpeed();
                scheduleUIUpdate();
            }
        }

