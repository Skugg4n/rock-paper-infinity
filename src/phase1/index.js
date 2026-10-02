import { getIcon } from "../icons.js";
import { phases, setPhase } from "../gamePhase.js";
import { playChapterCard } from "../chapterCard.js";
import { PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE_KEY } from "../constants.js";
import {
    getSPS, getEPS, getGamesPerSecond, roundTiming, updateMeasuredRate, pickOutcome,
    currentWinRate, heroPlacement,
} from "./rates.js";
import { generateCostVisual } from "./cost-visual.js";
import { runCountdownAnimation } from "./countdown.js";
import { serializeGameState, saveToStorage, loadFromStorage, sanitizeNumber, helperCounters } from "./persistence.js";
import { createUpgrades } from "./upgrades-config.js";
import { createFactoryView, FACTORY_TILES } from "./factory-view.js";
import { setupDashes, updateDashes, updateProgressDashes, PROGRESS_DASHES } from "./upgrade-dashes.js";
import { mountSaveButtons } from "../save-export.js";
import {
    renderWinTracker,
    renderRateDisplays,
    renderCollapseFoam,
    renderResourceBarsVisibility,
    renderEnergyBar,
    renderReserveBar,
    renderReserveVisibility,
    renderClover,
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
        const reserveEnergyContainer = document.getElementById('reserve-energy-container');
        const cloverBtn = document.getElementById('clover');
        const luckIndicator = document.getElementById('luck-indicator');
        const playerControls = document.getElementById('player-controls-container');
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
const tooltip = document.getElementById('tooltip');
const menuDropdown = document.getElementById('menu-dropdown');   // main.js owns the toggle; this closes it
const resetBtn = document.getElementById('reset-btn');

        let listenerController = null;

        // Game variables
        let starBalance = 0;
        let totalStarsEarned = 0;
        let totalGamesPlayed = 0;
        let totalWins = 0;
        let energy = PHASE1_CONSTANTS.MAX_ENERGY;
        let reserveEnergy = 0;
        const { MAX_ENERGY, MAX_RESERVE_ENERGY, MAX_QUANTUM_FOAM, FOAM_BONUS_SECONDS, HYPER_SPEED_THRESHOLD, BANK_GATE_COLLAPSES, CLOVER_MS, HERO_STARS, SAVE_KEY } = PHASE1_CONSTANTS;
        // The energy ladder: big batteries bought open the generator (the big
        // battery itself opens on consumption, see upgrades-config.js).
        let batteriesBought = 0;
        // The first stars lie big under the board ('hero'). After HERO_STARS
        // the next slots plop in and the tracker glides to its corner
        // ('leaving'), where it stays ('done').
        const HERO_SCALE = 3;
        const HERO_GAP = 28;            // px between the big stars and the controls
        const PLOPP_STAGGER_MS = 130;
        const HERO_GLIDE_MS = 900;
        let heroState = 'hero';
        let heroExitAt = 0;
        let heroTimer = null;
        // The little clover: luck until this timestamp (performance.now clock).
        // Not saved; a reload starts with the clover idle.
        let cloverUntil = 0;
        let cloverTimer = null;
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
        let factoryView = null;
        let starMultiplier = 1;
        let quantumFoam = 0;
        let foamCollapses = 0;
        let revealedUpgrades = new Set();
        let firstUpgradeUpdateDone = false;
        // Measured income (EMA of stars gained per second) — what the player
        // actually gets, energy pauses and all. This is what the ★/s shows.
        let measuredSPS = 0;
        let measuredLastTotal = 0;
        
        function doSetPhaseToCity() {
            localStorage.setItem(PHASE2_CONSTANTS.STARS_TRANSFER_KEY, String(starBalance));
            // Persist phase change immediately so a reload during the chapter card
            // doesn't leave the player stranded in Phase 1 with bank already purchased.
            localStorage.setItem(PHASE_KEY, phases.CITY);
            playChapterCard({
                roman: 'II',
                title: 'CAPITAL',
                // Drawn out: white, a rest, II, a rest, CAPITAL, a long hold, then the city.
                slow: true, pause: 1400, hold: 2400,
                onMidpoint: () => setPhase(phases.CITY),
            });
        }

        const upgrades = createUpgrades({
            rechargeEnergy:    () => { energy = Math.min(MAX_ENERGY, energy + 25); },
            // One big battery is a full big battery.
            addReserve:        () => { reserveEnergy = MAX_RESERVE_ENERGY; batteriesBought++; },
            isEnergyFull:      () => energy >= MAX_ENERGY,
            isReserveFull:     () => reserveEnergy >= MAX_RESERVE_ENERGY,
            getEnergyPerSecond: () => getEPS(gameSpeed, isMetaBoardActive, gameBoards.length),
            getBatteriesBought: () => batteriesBought,
            incrementSpeed:    () => { gameSpeed += 1; },
            createGameBoard:   () => createGameBoard(),
            mergeToMetaBoard:  () => mergeToMetaBoard(),
            setPhaseToCity:    () => doSetPhaseToCity(),
            getTotalStarsEarned: () => totalStarsEarned,
            getFoamCollapses: () => foamCollapses,
            getFoamFraction: () => Math.min(1, quantumFoam / MAX_QUANTUM_FOAM),
            bankGateCollapses: BANK_GATE_COLLAPSES,
        });

        const winRate = () => currentWinRate(upgrades.luck.purchased, cloverUntil, performance.now());
        const ENERGY_PER_GENERATOR_LEVEL = 10;

const choices = ['rock', 'paper', 'scissors'];
const iconMap = { rock: 'gem', paper: 'file-text', scissors: 'scissors' };

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
            board.className = 'game-board bg-white rounded-2xl shadow-md aspect-square w-full h-auto flex flex-col justify-around items-center p-4';
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
                freeAt: 0,
                computerEl: board.querySelector('.computer-result-icon'),
                playerEl: board.querySelector('.player-result-icon')
            });
            adjustBoardLayout();
        }
        
        function adjustBoardLayout(force = false) {
            const count = gameBoards.length;
            if (isMetaBoardActive && !force) return;

            let cols = 1;
            if (count > 1) cols = 2;
            if (count > 4) cols = 3;
            gameBoardContainer.className = `flex-grow grid grid-cols-${cols} items-center justify-center gap-4`;
            // style.css sizes a board from the grid's shape, so it fits the height too
            gameBoardContainer.style.setProperty('--board-cols', cols);
            gameBoardContainer.style.setProperty('--board-rows', Math.ceil(count / cols));
            
            if (count > 4) {
                gameBoardContainer.classList.add('small-icons');
            } else {
                gameBoardContainer.classList.remove('small-icons');
            }
        }

        /**
         * The factory: the nine boards turn out to be tiles of a larger board
         * (factory-view.js). They stay where they are; only what is in them
         * changes, so the factory grows out of what the player built.
         */
        function mergeToMetaBoard(fromLoad = false) {
            isMetaBoardActive = true;
            if (!fromLoad) starMultiplier *= 10;
            while (gameBoards.length < FACTORY_TILES) createGameBoard();
            adjustBoardLayout(true);
            gameBoardContainer.classList.add('pointer-events-none', 'is-factory');
            factoryView?.destroy();
            factoryView = createFactoryView(gameBoards.map(board => board.element));
            if (!fromLoad) factoryView.arrive();

            quantumFoamContainer.classList.remove('hidden');
        }

        export function init() {
            listenerController = new AbortController();
            const signal = listenerController.signal;

            loadGame();
            if (gameBoards.length === 0) createGameBoard();
            setupDashes(upgrades.speed.element, upgrades.speed.maxLevel);
            setupDashes(upgrades.energyGenerator.element, upgrades.energyGenerator.maxLevel);
            setupDashes(upgrades.addGameBoard.element, upgrades.addGameBoard.maxLevel);
            setupDashes(upgrades.mergeGameBoard.element, PROGRESS_DASHES);
            setupDashes(upgrades.bank.element, PROGRESS_DASHES);
            setupButtons();
            setupDebugButtons();
            collapseFoamBtn.addEventListener('click', collapseFoam, { signal });
            cloverBtn.addEventListener('pointerup', (e) => { e.preventDefault(); clickClover(); }, { signal });
            window.addEventListener('resize', () => { if (heroState === 'hero') placeHero(); }, { signal });
            heroState = totalStarsEarned < HERO_STARS ? 'hero' : 'done';
            resetBtn.addEventListener('click', resetGame, { signal });

            updateAnimationSpeed();
            scheduleUIUpdate();
            debugTrigger.addEventListener('click', () => debugMenu.classList.toggle('hidden'), { signal });
            manageAutoPlay();
            passiveInterval = setInterval(passiveTick, 1000);
            document.addEventListener('visibilitychange', handleVisibilityChange, { signal });
            mountSaveButtons(debugMenu);
        }

        /**
         * The little clover: a click is CLOVER_MS of luck. A click while it
         * runs refills it; it never stacks. The ring animation is restarted
         * so what the player sees is the time that is left.
         */
        function clickClover() {
            if (!upgrades.autoPlay.purchased || upgrades.luck.purchased) return;
            cloverUntil = performance.now() + CLOVER_MS;
            cloverBtn.classList.remove('lucky');
            void cloverBtn.offsetWidth;
            cloverBtn.classList.add('lucky');
            // Beside the stars-per-second: luck is what is pushing it up.
            luckIndicator.classList.add('is-on');
            clearTimeout(cloverTimer);
            cloverTimer = setTimeout(() => {
                cloverBtn.classList.remove('lucky');
                luckIndicator.classList.remove('is-on');
            }, CLOVER_MS);
        }

        function stopClover() {
            clearTimeout(cloverTimer);
            cloverTimer = null;
            cloverUntil = 0;
            cloverBtn.classList.remove('lucky');
            luckIndicator.classList.remove('is-on');
        }

        /**
         * Puts the win tracker, enlarged, just above the player's controls.
         * The tracker stays in its corner in the DOM; a transform carries it
         * here, so leaving is just letting the transform go.
         */
        function placeHero({ animate = false } = {}) {
            const anchor = playerControls.getBoundingClientRect();
            if (!anchor.width) return;
            const current = winTracker.style.transform;
            winTracker.style.transition = 'none';
            winTracker.style.transform = 'none';
            const natural = winTracker.getBoundingClientRect();
            const { x, y } = heroPlacement(anchor, natural, HERO_SCALE, HERO_GAP);
            winTracker.style.transformOrigin = 'top left';
            if (animate) {
                winTracker.style.transform = current;
                void winTracker.offsetWidth;
                winTracker.style.transition = 'transform 500ms ease';
            }
            winTracker.style.transform = `translate(${x}px, ${y}px) scale(${HERO_SCALE})`;
        }

        /** The fifth star: the next slots plop in, then everything glides to the corner. */
        function startHeroExit() {
            heroState = 'leaving';
            heroExitAt = performance.now();
            clearTimeout(heroTimer);
            heroTimer = setTimeout(() => {
                winTracker.style.transition = `transform ${HERO_GLIDE_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
                winTracker.style.transform = 'translate(0px, 0px) scale(1)';
                heroTimer = setTimeout(endHero, HERO_GLIDE_MS + 50);
            }, HERO_STARS * PLOPP_STAGGER_MS + 500);
        }

        function endHero() {
            clearTimeout(heroTimer);
            heroTimer = null;
            heroState = 'done';
            winTracker.style.transition = '';
            winTracker.style.transform = '';
            winTracker.style.transformOrigin = '';
        }

        function passiveTick() {
            // Paused (window.__rpiPaused, main.js): time stands still, the save does not.
            if (window.__rpiPaused) { saveGame(); return; }
            timed('p1:logicTick', () => {
                const energyGen = upgrades.energyGenerator.level * ENERGY_PER_GENERATOR_LEVEL;
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
                measuredSPS = updateMeasuredRate(measuredSPS, totalStarsEarned - measuredLastTotal);
                measuredLastTotal = totalStarsEarned;
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
            const { frameMs } = roundTiming(gameSpeed);
            dynamicStyles.innerHTML = `
                .countdown-pop { animation-duration: ${frameMs}ms; }
                .reveal-item { animation-duration: ${Math.max(120, 400 / gameSpeed)}ms; }
            `;
            debugSpeedEl.textContent = `⚡︎ ${gameSpeed}x`;
            if (autoPlayInterval) restartAutoPlay();
        }

        function updateWinVisuals() {
            if (starBalance === lastStarBalance && totalStarsEarned === lastTotalStarsEarned) return;
            const gained = lastStarBalance >= 0 && starBalance > lastStarBalance;
            const leavingNow = heroState === 'hero' && totalStarsEarned >= HERO_STARS;
            if (leavingNow) startHeroExit();
            lastStarBalance = starBalance;
            lastTotalStarsEarned = totalStarsEarned;
            renderWinTracker({ winTracker }, starBalance, totalStarsEarned, {
                hero: heroState === 'hero',
                // The star just won lands in its slot (instead of flying there).
                landIndex: heroState !== 'done' && gained ? (starBalance % 100) - 1 : -1,
                plopp: heroState === 'leaving'
                    ? { from: HERO_STARS, staggerMs: PLOPP_STAGGER_MS, elapsedMs: performance.now() - heroExitAt }
                    : null,
            });
            if (heroState === 'hero') placeHero();
            else if (leavingNow) placeHero({ animate: true });   // make room for the new slots
        }
        
        function updateRateDisplays(sps, eps, egps, autoActive, energyPaused) {
            renderRateDisplays(
                { spsContainer, spsValue, epsContainer, epsValue, egpsContainer, egpsValue },
                sps, eps, egps, autoActive, energyPaused
            );
        }

        function updateProgressCircles(_balance) {
            updateDashes(upgrades.speed.element, upgrades.speed.level);
            updateDashes(upgrades.energyGenerator.element, upgrades.energyGenerator.level);
            updateDashes(upgrades.addGameBoard.element, upgrades.addGameBoard.level);
            // Goal rings: fill up as the chapter's goals approach.
            updateProgressDashes(upgrades.mergeGameBoard.element, upgrades.mergeGameBoard.purchased ? 1 : upgrades.mergeGameBoard.progress());
            updateProgressDashes(upgrades.bank.element, upgrades.bank.progress());
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
    foamReady: false,
    showReserve: null,
    cloverVisible: null,
    cloverEvergreen: null,
    handsRest: null
};

        function updateUI() {
            const games = Math.floor(totalGamesPlayed);
            // Energy only matters once machines play; hands are free. The
            // factory has its own reactor, so its bars go away (foam stays).
            const showResources = upgrades.autoPlay.purchased;
            const energyPercent = (energy / MAX_ENERGY) * 100;
            const reservePercent = (reserveEnergy / MAX_RESERVE_ENERGY) * 100;
            const energyEmpty = energy <= 0;
            const sps = measuredSPS;
            const eps = getEPS(gameSpeed, isMetaBoardActive, gameBoards.length);
            const egps = upgrades.energyGenerator.level * ENERGY_PER_GENERATOR_LEVEL;
            const autoActive = !!autoPlayInterval;
            const energyPaused = autoPlayWantsToRun && energyEmpty;
            const foamPercent = (quantumFoam / MAX_QUANTUM_FOAM) * 100;
            const foamReady = quantumFoam >= MAX_QUANTUM_FOAM;
            // The big battery's bar has nothing to say before the first big battery.
            const showReserve = batteriesBought > 0 || reserveEnergy > 0;
            const cloverVisible = upgrades.autoPlay.purchased && !isMetaBoardActive;
            const cloverEvergreen = upgrades.luck.purchased;
            // While the machine plays (the factory too), the hand buttons step back.
            const handsRest = !!autoPlayInterval;

            const wins = Math.floor(totalWins);
            const gamesChanged = games !== uiState.gamesPlayed || wins !== uiState.totalWins;
            const resourcesChanged = showResources !== uiState.showResources;
            const energyChanged = energyPercent !== uiState.energyPercent;
            const reserveChanged = reservePercent !== uiState.reservePercent;
            const emptyChanged = energyEmpty !== uiState.energyEmpty;
            const rateChanged = sps !== uiState.sps || eps !== uiState.eps || egps !== uiState.egps || autoActive !== uiState.autoPlayActive || energyPaused !== uiState.energyPaused;
            const balanceChanged = starBalance !== uiState.starBalance;
            const foamChanged = isMetaBoardActive && (foamPercent !== uiState.foamPercent || foamReady !== uiState.foamReady);
            const showReserveChanged = showReserve !== uiState.showReserve;
            const cloverChanged = cloverVisible !== uiState.cloverVisible || cloverEvergreen !== uiState.cloverEvergreen;
            const handsChanged = handsRest !== uiState.handsRest;
            const upgradesChanged = balanceChanged || totalStarsEarned !== uiState.totalStarsEarned || gamesChanged || rateChanged || isMetaBoardActive !== uiState.isMetaBoardActive || foamChanged || energyChanged || reserveChanged;

            const tasks = [];
            if (gamesChanged) tasks.push(() => {
                debugGamesPlayedEl.textContent = games;
                renderGameCounters({ gameCounters, gamesValueEl, winsValueEl }, games, wins);
            });
            if (resourcesChanged || isMetaBoardActive !== uiState.isMetaBoardActive) {
                tasks.push(() => renderResourceBarsVisibility(resourceBars, showResources, !isMetaBoardActive));
            }
            if (energyChanged) tasks.push(() => renderEnergyBar(energyFillEl, energyPercent));
            if (reserveChanged) tasks.push(() => renderReserveBar(reserveEnergyFillEl, reservePercent));
            if (showReserveChanged) {
                // Grows in when the first big battery is bought; just there on load.
                const animate = uiState.showReserve !== null;
                tasks.push(() => renderReserveVisibility(reserveEnergyContainer, showReserve, animate));
            }
            if (cloverChanged) tasks.push(() => renderClover(cloverBtn, { visible: cloverVisible, evergreen: cloverEvergreen }));
            if (handsChanged) tasks.push(() => playerControls.classList.toggle('hands-rest', handsRest));
            if (emptyChanged) tasks.push(() => renderEnergyEmpty(energyFillEl, energyEmpty));
            if (rateChanged) tasks.push(() => updateRateDisplays(sps, eps, egps, autoActive, energyPaused));
            if (balanceChanged || totalStarsEarned !== uiState.totalStarsEarned || foamChanged) tasks.push(() => updateProgressCircles(starBalance));
            if (upgradesChanged) tasks.push(updateUpgrades);
            if (foamChanged) tasks.push(() => updateCollapseFoam(foamPercent, foamReady));

            if (!tasks.length) return;

            tasks.push(updateWinVisuals);
            tasks.forEach(fn => fn());

            if (gamesChanged) { uiState.gamesPlayed = games; uiState.totalWins = wins; }
            if (resourcesChanged) uiState.showResources = showResources;
            if (energyChanged) uiState.energyPercent = energyPercent;
            if (reserveChanged) uiState.reservePercent = reservePercent;
            if (showReserveChanged) uiState.showReserve = showReserve;
            if (cloverChanged) { uiState.cloverVisible = cloverVisible; uiState.cloverEvergreen = cloverEvergreen; }
            if (handsChanged) uiState.handsRest = handsRest;
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
            if (window.__rpiSkipSave) return;
            const state = {
                starBalance, totalStarsEarned, totalGamesPlayed, totalWins,
                energy, reserveEnergy, gameSpeed, starMultiplier, quantumFoam, foamCollapses,
                isMetaBoardActive, autoPlayWantsToRun,
                gameBoardsCount: gameBoards.length,
                batteriesBought
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
                foamCollapses = sanitizeNumber(data.foamCollapses) ?? foamCollapses;
                isMetaBoardActive = data.isMetaBoardActive ?? isMetaBoardActive;
                autoPlayWantsToRun = data.autoPlayWantsToRun ?? autoPlayWantsToRun;
                ({ batteriesBought } = helperCounters(data));
                measuredLastTotal = totalStarsEarned;
                if (data.upgrades) {
                    for (const key in data.upgrades) {
                        if (upgrades[key]) {
                            const info = data.upgrades[key];
                            if (info.level !== undefined) {
                                // Clamp: balance passes may lower maxLevel on old saves.
                                const max = upgrades[key].maxLevel ?? Infinity;
                                upgrades[key].level = Math.min(sanitizeNumber(info.level) ?? 0, max);
                            }
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
            batteriesBought = 0;
            stopClover();
            cloverBtn.classList.remove('evergreen');
            endHero();
            heroState = 'hero';
            lastStarBalance = -1;
            lastTotalStarsEarned = -1;
            starMultiplier = 1;
            quantumFoam = 0;
            foamCollapses = 0;
            gameSpeed = 1;
            isMetaBoardActive = false;
            measuredSPS = 0;
            measuredLastTotal = 0;
            // Invalidate uiState cache so the next updateUI() does a full re-render.
            // Without this, dirty cached values from before the reset cause some UI
            // renders to be skipped on the first post-reset update.
            Object.assign(uiState, {
                gamesPlayed: -1, totalWins: -1, showResources: false,
                energyPercent: -1, reservePercent: -1, energyEmpty: null,
                sps: -1, eps: -1, egps: -1, autoPlayActive: false,
                energyPaused: false, starBalance: -1, totalStarsEarned: -1,
                isMetaBoardActive: false, foamPercent: -1, foamReady: false,
                showReserve: null, cloverVisible: null, cloverEvergreen: null, handsRest: null,
            });
            quantumFoamContainer.classList.add('hidden');
            quantumFoamContainer.classList.remove('is-locked');
            gameBoards = [];
            factoryView?.destroy();
            factoryView = null;
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
            gameBoards.forEach(b => { b.freeAt = 0; });
            menuDropdown.classList.add('hidden');
            updateAnimationSpeed();
            manageAutoPlay();
            scheduleUIUpdate();
        }

        /**
         * Plays one animated round on a board. Hand-played rounds (auto=false)
         * are free; only the auto-player consumes energy. That keeps the game
         * from soft-locking at 0 energy / 0 stars.
         */
        async function playGame(playerChoice, board = gameBoards[0], auto = false) {
            if (isMetaBoardActive || board.isAnimating) return;
            if (auto && !hasEnergy()) return;
            board.isAnimating = true;
            if (auto) consumeEnergy();
            totalGamesPlayed++;

            choiceButtons.forEach(btn => btn.disabled = true);

            await runCountdownAnimation(board, gameSpeed);
            showResult(playerChoice, board, false);
        }

        const losingFor = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
        const winningFor = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

        /**
         * Picks the computer's move so that the round has the given outcome.
         */
        function computerChoiceFor(playerChoice, outcome) {
            if (outcome === 'win') return losingFor[playerChoice];
            if (outcome === 'lose') return winningFor[playerChoice];
            return playerChoice;
        }

        /**
         * Renders one round on a board: the winner's icon goes bold and gets a
         * thin ring, the loser recedes, a draw leaves both quiet. Same look in
         * animated and bulk mode so the player always reads who won.
         */
        function renderRound(board, playerChoice, computerChoice, result, { instant = false, celebrate = false } = {}) {
            const base = 'result-wrapper inline-flex justify-center items-center';
            const anim = instant ? 'instant' : 'reveal-item';
            const playerState = result === 'win' ? 'winner' : result === 'lose' ? 'loser' : 'draw';
            const computerState = result === 'lose' ? 'winner enemy-winner' : result === 'win' ? 'loser' : 'draw';

            const playerWrapper = document.createElement('div');
            playerWrapper.className = `${base} ${anim} ${playerState} ${celebrate ? 'celebrate' : ''}`.trim();
            playerWrapper.appendChild(getIcon(iconMap[playerChoice], 'lucide-lg'));
            board.playerEl.replaceChildren(playerWrapper);

            const computerWrapper = document.createElement('div');
            computerWrapper.className = `${base} ${anim} ${computerState}`;
            computerWrapper.appendChild(getIcon(iconMap[computerChoice], 'lucide-lg'));
            board.computerEl.replaceChildren(computerWrapper);
        }

        function showResult(playerChoice, board, instant = false) {
            const result = pickOutcome(Math.random(), winRate());
            const computerChoice = computerChoiceFor(playerChoice, result);

            // Celebrate (one-shot pulse) only on the first 3 wins — keeps the cue special
            const celebrate = result === 'win' && totalStarsEarned < 3;
            renderRound(board, playerChoice, computerChoice, result, { instant, celebrate });

            if (result === 'win') {
                totalWins++;
                const starGain = 1 * starMultiplier;
                starBalance += starGain;
                totalStarsEarned += starGain;
            }

            scheduleUIUpdate();

            if (!hasEnergy() && autoPlayInterval) stopAutoPlayInterval();

            const { holdMs } = roundTiming(gameSpeed);
            setTimeout(() => {
                board.isAnimating = false;
                board.freeAt = performance.now();
                if (!autoPlayInterval) choiceButtons.forEach(btn => btn.disabled = false);
                scheduleUIUpdate();
            }, instant ? 50 : holdMs);
        }
        
        function handleUpgradeClick(key) {
            // Hide tooltip immediately so it doesn't clip into the click-pulse animation
            tooltip.style.opacity = '0';
            tooltip.style.display = 'none';

            const upgrade = upgrades[key];
            if (key === 'autoPlay' && upgrade.purchased) {
                toggleAutoPlayState();
                return;
            }
            
            const currentCost = (typeof upgrade.cost === 'function') ? upgrade.cost() : upgrade.cost;
            if (typeof upgrade.blocked === 'function' && upgrade.blocked()) return;
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

            if (!isMetaBoardActive && !hasEnergy()) {
                stopAutoPlayInterval();
                return;
            }

            const gamesWanted = getGamesPerSecond(gameSpeed, isMetaBoardActive, gameBoards.length) * delta;
            // The factory runs on its own reactor; boards draw energy.
            const gamesToPlay = isMetaBoardActive ? gamesWanted : Math.min(energy + reserveEnergy, gamesWanted);
            if (!isMetaBoardActive) consumeEnergy(gamesToPlay);
            totalGamesPlayed += gamesToPlay;

            const wins = gamesToPlay * winRate();
            const roundedWins = Math.floor(wins) + (Math.random() < (wins % 1) ? 1 : 0);
            totalWins += roundedWins;

            const starGain = roundedWins * starMultiplier;
            starBalance += starGain;
            totalStarsEarned += starGain;

            if (isMetaBoardActive) {
                quantumFoam = Math.min(MAX_QUANTUM_FOAM, quantumFoam + gamesToPlay);
                factoryView?.tick();
            }

            if (!isMetaBoardActive) {
                // One representative round per board per tick, drawn from the
                // real outcome distribution, so the flicker still shows who won.
                gameBoards.forEach(board => {
                    const playerChoice = choices[Math.floor(Math.random() * 3)];
                    const result = pickOutcome(Math.random(), winRate());
                    renderRound(board, playerChoice, computerChoiceFor(playerChoice, result), result, { instant: true });
                });
            }
        }

        function collapseFoam() {
            if (quantumFoam < MAX_QUANTUM_FOAM) return;
            
            const bonus = Math.floor(getSPS(gameSpeed, isMetaBoardActive, gameBoards.length, starMultiplier, winRate()) * FOAM_BONUS_SECONDS);
            addStars(bonus);
            quantumFoam = 0;
            foamCollapses++;
            
            // The collapse shows as a wave of wins from the middle of the factory.
            factoryView?.wave(4, 4);
            scheduleUIUpdate();
        }

        function restartAutoPlay() {
            stopAutoPlayInterval();
            lastTick = performance.now();
            lastUIRender = performance.now();
            const step = (now) => {
                // Paused: hold still, and keep the clock current so resuming plays no backlog
                if (window.__rpiPaused) { lastTick = now; autoPlayInterval = requestAnimationFrame(step); return; }
                if (!autoPlayWantsToRun || (!isMetaBoardActive && !hasEnergy())) {
                    stopAutoPlayInterval();
                    return;
                }
                if (gameSpeed >= HYPER_SPEED_THRESHOLD || isMetaBoardActive) {
                    // Bulk mode: settle games in 100 ms batches.
                    if (now - lastTick >= 100) processBulkGames();
                } else {
                    // Animated mode: each board starts its next round as soon as
                    // it is free and the short breathing gap has passed. No
                    // shared interval, so no skipped rounds at any speed.
                    const { gapMs } = roundTiming(gameSpeed);
                    gameBoards.forEach(board => {
                        if (board.isAnimating) return;
                        if (now - (board.freeAt || 0) < gapMs) return;
                        if (!hasEnergy()) return;
                        playGame(choices[Math.floor(Math.random() * 3)], board, true);
                    });
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
            if (autoPlayWantsToRun && !autoPlayInterval && (hasEnergy() || isMetaBoardActive)) {
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
                choiceButtons.forEach(btn => btn.disabled = false);
                gameBoards.forEach(board => {
                    if (board.isAnimating) return;
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
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 14}px`;
            tooltip.style.opacity = '1';
        }

        function hideTooltip() {
            tooltip.style.opacity = '0';
            tooltipHideTimeout = setTimeout(() => { tooltip.style.display = 'none'; }, 200);
        }

        export function teardown() {
            stopAutoPlayInterval();
            stopClover();
            clearTimeout(heroTimer);
            heroTimer = null;
            factoryView?.destroy();
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

