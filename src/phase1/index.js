import { getIcon } from "../icons.js";
import { phases, setPhase } from "../gamePhase.js";
import { playChapterCard } from "../chapterCard.js";
import { PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE_KEY } from "../constants.js";
import { getSPS, getEPS, getVisibleDots, formatCount, fillFraction } from "./rates.js";
import { generateCostVisual } from "./cost-visual.js";
import { runCountdownAnimation } from "./countdown.js";
import { serializeGameState, saveToStorage, loadFromStorage, sanitizeNumber } from "./persistence.js";
import { fireStarAnimation } from "./star-animation.js";

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
        const downgradeTray = document.getElementById('downgrade-tray');
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
        
        const upgrades = {
            autoPlay: {
                cost: 5, purchased: false, unlocksAt: 2, unlocks: ['speed'],
                element: document.getElementById('autoPlay'),
                purchase: function() { this.element.classList.remove('fade-in'); }
            },
            manualRecharge: {
                cost: 1, consumable: true, unlocksAt: 15, unlocks: [],
                element: document.getElementById('manualRecharge'),
                purchase: function() { energy = Math.min(MAX_ENERGY, energy + 10); }
            },
            speed: {
                level: 0, maxLevel: 55,
                cost: () => 10 + Math.floor(upgrades.speed.level * 2),
                unlocks: [],
                element: document.getElementById('speed'),
                purchase: function() {
                    this.level++;
                    gameSpeed += 1;
                    this.element.classList.add('pop-item');
                    setTimeout(() => this.element.classList.remove('pop-item'), 500);
                }
            },
            buyBattery: {
                cost: 100, consumable: true, 
                unlocksAt: 50, unlocks: [],
                element: document.getElementById('buyBattery'),
                purchase: function() {
                    reserveEnergy = Math.min(MAX_RESERVE_ENERGY, reserveEnergy + 700);
                    this.element.classList.add('pop-item');
                    setTimeout(() => this.element.classList.remove('pop-item'), 500);
                }
            },
            luck: {
                cost: 50, purchased: false, unlocksAtGames: 100, unlocks: [],
                element: document.getElementById('luck'),
                purchase: function() {
                    starMultiplier *= 1.5;
                    this.element.style.display = 'none';
                }
            },
            energyGenerator: {
                level: 0, maxLevel: 100,
                cost: () => 50 + Math.floor(upgrades.energyGenerator.level * 5),
                unlocksAtSPS: 50, unlocks: [],
                element: document.getElementById('energyGenerator'),
                purchase: function() { this.level++; }
            },
            addGameBoard: {
                level: 0, maxLevel: 8,
                cost: () => 100 + Math.floor(upgrades.addGameBoard.level * 25),
                unlocksAt: 100, unlocks: [],
                element: document.getElementById('addGameBoard'),
                purchase: function() {
                    if (this.level >= this.maxLevel) return;
                    this.level++;
                    createGameBoard();
                }
            },
            mergeGameBoard: {
                cost: 1000, purchased: false,
                unlocksAt: 0,
                element: document.getElementById('mergeGameBoard'),
                // Factory becomes available when ALL upgrades are maxed/purchased.
                unlockCondition: () =>
                    upgrades.autoPlay.purchased &&
                    upgrades.luck.purchased &&
                    upgrades.speed.level >= upgrades.speed.maxLevel &&
                    upgrades.energyGenerator.level >= upgrades.energyGenerator.maxLevel &&
                    upgrades.addGameBoard.level >= upgrades.addGameBoard.maxLevel,
                purchase: function() {
                    this.purchased = true;
                    mergeToMetaBoard();
                    for (const key in upgrades) {
                        if (key !== 'bank') {
                            upgrades[key].element.classList.add('hidden');
                        }
                    }
                }
            },
            bank: {
                cost: 0,
                purchased: false,
                unlocksAt: 0,
                element: document.getElementById('bank'),
                // Gate: factory must be purchased AND player must have accumulated
                // enough stars to ensure a meaningful pause between factory and bank.
                // 5x the factory cost above the minimum-to-buy-factory threshold.
                unlockCondition: () => upgrades.mergeGameBoard.purchased && totalStarsEarned >= 50000,
                purchase: function() {
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
            }
        };

const choices = ['rock', 'paper', 'scissors'];
const iconMap = { rock: 'gem', paper: 'file-text', scissors: 'scissors' };

const buildIcon = (name, className = '') => getIcon(name, className);

const crownTemplate = buildIcon('crown', 'lucide-crown-xl text-slate-800');
const gemLargeTemplate = buildIcon('gem', 'lucide-gem-large text-slate-800');
const gemMediumTemplate = buildIcon('gem', 'lucide-gem-medium text-slate-800');
const starSmallTemplate = buildIcon('star', 'lucide-star-small text-slate-800');



let uiUpdatePending = false;
function scheduleUIUpdate() {
    if (!uiUpdatePending) {
        uiUpdatePending = true;
        requestAnimationFrame(() => {
            uiUpdatePending = false;
            updateUI();
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
        }

        function passiveTick() {
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
        
        function updateRateDisplays(sps, eps, egps, autoActive, energyPaused) {
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

        function updateSellButtons() {
            // Sell buttons removed — they were confusing to users
        }

        function updateProgressCircles(balance) {
            const circumference = 100.5;
            speedProgressCircle.style.strokeDashoffset = circumference * (1 - fillFraction(balance, upgrades.speed));
            energyGenProgressCircle.style.strokeDashoffset = circumference * (1 - fillFraction(balance, upgrades.energyGenerator));
            addBoardProgressCircle.style.strokeDashoffset = circumference * (1 - fillFraction(balance, upgrades.addGameBoard));
        }

        function updateCollapseFoam(percent, ready) {
            collapseFoamFill.style.height = `${percent}%`;
            collapseFoamBtn.disabled = !ready;
            collapseFoamBtn.classList.toggle('ready', ready);
        }

        function updateUpgrades() {
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
                                 (upgrade.unlocksAtSPS > 0 && getSPS(gameSpeed, isMetaBoardActive, gameBoards.length, starMultiplier) >= upgrade.unlocksAtSPS) ||
                                 Object.keys(upgrades).some(parentKey => {
                                     const parent = upgrades[parentKey];
                                     const parentUnlocked = (parent.level !== undefined && parent.level >= parent.maxLevel) || parent.purchased;
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
                            if (firstUpgradeUpdateDone) {
                                upgrade.element.classList.add('materialize');
                                upgrade.element.addEventListener('animationend', () => {
                                    upgrade.element.classList.remove('materialize');
                                }, { once: true, signal: listenerController.signal });
                            }
                        }
                        revealedUpgrades.add(key);
                    }

                    const currentCost = typeof upgrade.cost === 'function' ? upgrade.cost() : upgrade.cost;

                    if (upgrade.level !== undefined) {
                        upgrade.element.disabled = (starBalance < currentCost) || (upgrade.level >= upgrade.maxLevel);
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
            if (!firstUpgradeUpdateDone) firstUpgradeUpdateDone = true;

            // Tease Quantum Foam before factory is purchased:
            // show locked (greyed) when factory is purchaseable, show fully when purchased.
            if (upgrades.mergeGameBoard.purchased) {
                // mergeToMetaBoard() already removes 'hidden'; just ensure no locked state
                quantumFoamContainer.classList.remove('is-locked');
            } else if (factoryReady) {
                quantumFoamContainer.classList.remove('hidden');
                quantumFoamContainer.classList.add('is-locked');
            } else {
                quantumFoamContainer.classList.add('hidden');
                quantumFoamContainer.classList.remove('is-locked');
            }
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

        function renderGamesPlayed(value) {
            debugGamesPlayedEl.textContent = value;
        }

        let counterIconsSet = false;
        function updateGameCounters(games, wins) {
            if (games > 0) {
                gameCounters.classList.remove('hidden');
                gamesValueEl.textContent = formatCount(games);
                winsValueEl.textContent = formatCount(wins);
                if (!counterIconsSet) {
                    document.getElementById('games-icon').replaceWith(getIcon('swords', 'w-3 h-3 text-slate-400'));
                    document.getElementById('wins-icon').replaceWith(getIcon('trophy', 'w-3 h-3 text-slate-400'));
                    counterIconsSet = true;
                }
            }
        }

        function toggleResourceBars(show) {
            resourceBars.classList.toggle('hidden', !show);
        }

        function renderEnergy(percent) {
            energyFillEl.style.height = `${percent}%`;
        }

        function renderReserveEnergy(percent) {
            reserveEnergyFillEl.style.height = `${percent}%`;
        }

        function setEnergyEmpty(empty) {
            energyFillEl.classList.toggle('bg-slate-700', empty);
            energyFillEl.classList.toggle('bg-slate-500', !empty);
        }

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
            if (gamesChanged) tasks.push(() => { renderGamesPlayed(games); updateGameCounters(games, wins); });
            if (resourcesChanged) tasks.push(() => toggleResourceBars(showResources));
            if (energyChanged) tasks.push(() => renderEnergy(energyPercent));
            if (reserveChanged) tasks.push(() => renderReserveEnergy(reservePercent));
            if (emptyChanged) tasks.push(() => setEnergyEmpty(energyEmpty));
            if (rateChanged) tasks.push(() => updateRateDisplays(sps, eps, egps, autoActive, energyPaused));
            if (balanceChanged) tasks.push(() => { updateProgressCircles(starBalance); updateSellButtons(); });
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

            if (gameSpeed >= HYPER_SPEED_THRESHOLD && autoPlayInterval) {
                showResult(playerChoice, board, true);
            } else {
                await runCountdownAnimation(board, gameSpeed);
                showResult(playerChoice, board, false);
            }
        }

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
                totalWins++;
                const starGain = 1 * starMultiplier;
                starBalance += starGain;
                totalStarsEarned += starGain;
                // Flying-star animation: only for the first 10 stars earned
                if (totalStarsEarned <= 10) {
                    try {
                        // Source: the player result area on this board; target: win-tracker
                        fireStarAnimation(board.playerEl, winTracker);
                    } catch (e) {
                        console.error('fireStarAnimation failed:', e);
                    }
                }
            }

            scheduleUIUpdate();

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

