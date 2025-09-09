        // DOM-element
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
        const debugTrigger = document.getElementById('debug-trigger');
        const debugMenu = document.getElementById('debug-menu');
        const debugSpeedEl = document.getElementById('debug-speed');
        const debugGamesPlayedEl = document.getElementById('debug-games-played');
        const dynamicStyles = document.getElementById('dynamic-styles');
        const speedProgressCircle = document.getElementById('speed-progress');
        const speedEarlyProgressCircle = document.getElementById('speed-early-progress');
        const energyGenProgressCircle = document.getElementById('energy-gen-progress');
        const addBoardProgressCircle = document.getElementById('add-board-progress');
        const downgradeTray = document.getElementById('downgrade-tray');
const tooltip = document.getElementById('tooltip');
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const resetBtn = document.getElementById('reset-btn');

        // Spelvariabler
        let starBalance = 0;
        let totalStarsEarned = 0;
        let totalGamesPlayed = 0;
        let energy = 100;
        let reserveEnergy = 0;
        const MAX_ENERGY = 100;
        const MAX_RESERVE_ENERGY = 1500;
        let autoPlayInterval = null;
        let autoPlayWantsToRun = false;
        let gameSpeed = 1;
        let lastTick = performance.now();
        let gameBoards = [];
        let isMetaBoardActive = false;
        let starMultiplier = 1;
        let quantumFoam = 0;
        const MAX_QUANTUM_FOAM = 1000;
        const HYPER_SPEED_THRESHOLD = 10;
        const SAVE_KEY = 'rpi-save';
        
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
                unlocksAt: 100, unlocks: ['mergeGameBoard'],
                element: document.getElementById('addGameBoard'),
                purchase: function() {
                    if (this.level >= this.maxLevel) return;
                    this.level++;
                    createGameBoard();
                }
            },
            // FIX: Knappen låses inte längre upp vid start
            mergeGameBoard: {
                cost: 1000, purchased: false,
                element: document.getElementById('mergeGameBoard'),
                unlockCondition: () => getSPS() >= 300 && getEPS() >= 300,
                purchase: function() {
                    this.purchased = true;
                    mergeToMetaBoard();
                }
            }
        };

const choices = ['rock', 'paper', 'scissors'];
const iconMap = { rock: 'gem', paper: 'file-text', scissors: 'scissors' };

        function setupButtons() {
            document.querySelectorAll('button').forEach(btn => {
                const choice = btn.dataset.choice;
                const upgrade = btn.dataset.upgrade;
                if (!choice && !upgrade) return;
                btn.addEventListener('pointerup', (e) => {
                    e.preventDefault();
                    if (choice) playGame(choice);
                    else handleUpgradeClick(upgrade);
                });
                btn.addEventListener('mouseenter', () => {
                    const key = choice ? 'choice' : upgrade;
                    if (key) showTooltip(btn, key);
                });
                btn.addEventListener('mouseleave', hideTooltip);
            });
        }

        function setupDebugButtons() {
            document.querySelectorAll('#debug-menu [data-add-stars]').forEach(btn => {
                btn.addEventListener('click', () => addStars(parseInt(btn.dataset.addStars, 10)));
            });
            document.querySelectorAll('#debug-menu [data-change-speed]').forEach(btn => {
                btn.addEventListener('click', () => changeSpeed(parseInt(btn.dataset.changeSpeed, 10)));
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

        function mergeToMetaBoard() {
            isMetaBoardActive = true;
            starMultiplier = 10;
            gameBoards.forEach(board => board.element.style.display = 'none');
            
            let metaBoard = document.getElementById('meta-board');
            if (!metaBoard) {
                metaBoard = document.createElement('div');
                metaBoard.id = 'meta-board';
                metaBoard.className = 'rounded-2xl aspect-square w-full h-auto flex justify-center items-center';
                metaBoard.innerHTML = `<i data-lucide="factory" class="lucide-lg text-black"></i>`;
                gameBoardContainer.innerHTML = '';
                gameBoardContainer.className = 'flex-grow grid grid-cols-1 items-center justify-center gap-4 max-w-sm mx-auto';
                gameBoardContainer.appendChild(metaBoard);
            }
            metaBoard.style.display = 'flex';
            lucide.createIcons();
            quantumFoamContainer.classList.remove('hidden');
        }

        function init() {
            loadGame();
            if (gameBoards.length === 0) createGameBoard();
            setupButtons();
            setupDebugButtons();
            collapseFoamBtn.addEventListener('click', collapseFoam);
            menuBtn.addEventListener('click', () => menuDropdown.classList.toggle('hidden'));
            resetBtn.addEventListener('click', resetGame);
            lucide.createIcons();
            updateAnimationSpeed();
            updateUI();
            debugTrigger.addEventListener('click', () => debugMenu.classList.toggle('hidden'));
            manageAutoPlay();
            setInterval(passiveTick, 1000);
        }
        
        function passiveTick() {
            const energyGen = upgrades.energyGenerator.level * 5;
            if (energyGen > 0) {
                energy = Math.min(MAX_ENERGY, energy + energyGen);
                reserveEnergy = Math.min(MAX_RESERVE_ENERGY, reserveEnergy + energyGen);
            }
            manageAutoPlay();
            updateUI();
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

        function getVisibleDots() {
            if (totalStarsEarned >= 30) return 100;
            if (totalStarsEarned >= 10) return 20;
            if (totalStarsEarned >= 5) return 10;
            return 5;
        }

        function updateWinVisuals() {
            winTracker.innerHTML = '';
            const crowns = Math.floor(starBalance / 10000);
            const gems = Math.floor((starBalance % 10000) / 100);
            const smallStars = starBalance % 100;
            
            if (crowns > 0) {
                const container = document.createElement('div');
                container.className = 'grid grid-cols-5 gap-1 items-center';
                const displayedCrowns = Math.min(crowns, 10);
                for (let i = 0; i < displayedCrowns; i++) {
                    container.innerHTML += '<div><i data-lucide="crown" class="lucide-crown-xl text-slate-800"></i></div>';
                }
                winTracker.appendChild(container);
                if (crowns > 10) {
                    const extraContainer = document.createElement('div');
                    extraContainer.className = 'flex items-center gap-1 text-slate-800';
                    extraContainer.innerHTML = `<i data-lucide="crown" class="lucide-crown-xl"></i><span class="text-sm">x ${crowns - 10}</span>`;
                    winTracker.appendChild(extraContainer);
                }
            }
            const showGemPlaceholders = totalStarsEarned >= 10000;
            if (gems > 0 || showGemPlaceholders) {
                const container = document.createElement('div');
                container.className = 'grid grid-cols-10 gap-1 items-center';
                const gemSizeClass = gems > 5 ? 'lucide-gem-medium' : 'lucide-gem-large';
                const totalSlots = showGemPlaceholders ? 100 : gems;
                for (let i = 0; i < totalSlots; i++) {
                    if (i < gems) container.innerHTML += `<div><i data-lucide="gem" class="${gemSizeClass} text-slate-800"></i></div>`;
                    else container.innerHTML += '<div class="gem-dot"></div>';
                }
                winTracker.appendChild(container);
            }

            const dotsToShow = getVisibleDots();
            const gridContainer = document.createElement('div');
            gridContainer.className = 'grid grid-cols-10 gap-1';
            for (let i = 0; i < dotsToShow; i++) {
                if (i < smallStars) gridContainer.innerHTML += '<div><i data-lucide="star" class="lucide-star-small text-slate-800"></i></div>';
                else gridContainer.innerHTML += '<div class="dot"></div>';
            }
            winTracker.appendChild(gridContainer);

            lucide.createIcons();

            winTracker.querySelectorAll('.lucide-star-small').forEach(svg => {
                svg.setAttribute('fill', 'currentColor');
                svg.setAttribute('stroke', 'none');
            });
        }
        
        function getSPS() {
            const boardMultiplier = isMetaBoardActive ? 9 : gameBoards.length;
            const baseWinRate = 1 / 3;
            const baseSPS = (gameSpeed < HYPER_SPEED_THRESHOLD)
                ? (1000 / (((1.2 / gameSpeed) * 1000 + 450) / boardMultiplier)) * baseWinRate
                : (gameSpeed * boardMultiplier) * baseWinRate;
            return baseSPS * starMultiplier;
        }

        function getEPS() {
            const boardMultiplier = isMetaBoardActive ? 9 : gameBoards.length;
            return gameSpeed * boardMultiplier;
        }

        function updateRateDisplays() {
            const sps = getSPS();
            if (sps > 0.1) {
                spsContainer.classList.remove('hidden');
                spsValue.textContent = sps.toFixed(1);
            } else {
                spsContainer.classList.add('hidden');
            }

            const eps = getEPS();
            if (autoPlayInterval) {
                epsContainer.classList.remove('hidden');
                epsValue.textContent = eps.toFixed(1);
            } else {
                epsContainer.classList.add('hidden');
            }

            const egps = upgrades.energyGenerator.level * 5;
            if (egps > 0) {
                egpsContainer.classList.remove('hidden');
                egpsValue.textContent = egps.toFixed(1);
            } else {
                egpsContainer.classList.add('hidden');
            }
        }

        function updateSellButtons() {
            downgradeTray.innerHTML = '';
            if (upgrades.energyGenerator.level < upgrades.energyGenerator.maxLevel) return;

            const sellableUpgrades = ['speed', 'addGameBoard'];
            sellableUpgrades.forEach(key => {
                const upgrade = upgrades[key];
                if (upgrade.level > 0 && !isMetaBoardActive) {
                    const btn = document.createElement('button');
                    btn.className = 'btn bg-white p-3 rounded-full shadow-lg flex items-center justify-center';
                    btn.onclick = () => handleSellClick(key);
                    btn.innerHTML = `<i data-lucide="minus" class="relative w-6 h-6 text-red-500"></i>`;
                    downgradeTray.appendChild(btn);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'w-12 h-12';
                    downgradeTray.appendChild(placeholder);
                }
        });
            lucide.createIcons();
        }

        function updateUI() {
            updateWinVisuals();
            updateRateDisplays();
            updateSellButtons();
            debugGamesPlayedEl.textContent = Math.floor(totalGamesPlayed);
            resourceBars.classList.toggle('hidden', totalStarsEarned < 10);

            const energyPercent = (energy / MAX_ENERGY) * 100;
            energyFillEl.style.height = `${energyPercent}%`;
            const reservePercent = (reserveEnergy / MAX_RESERVE_ENERGY) * 100;
            reserveEnergyFillEl.style.height = `${reservePercent}%`;

            if (energy <= 0) {
                energyFillEl.classList.add('bg-red-500');
                energyFillEl.classList.remove('bg-emerald-500');
            } else {
                energyFillEl.classList.remove('bg-red-500');
                energyFillEl.classList.add('bg-emerald-500');
            }

            for (const key in upgrades) {
                const upgrade = upgrades[key];
                
                let isUnlocked = (upgrade.unlocksAt === 0 && key !== 'mergeGameBoard') || // FIX: Gäller ej mergeGameBoard
                                 (upgrade.unlocksAt > 0 && totalStarsEarned >= upgrade.unlocksAt) ||
                                 (upgrade.unlocksAtGames > 0 && totalGamesPlayed >= upgrade.unlocksAtGames) ||
                                 (upgrade.unlocksAtSPS > 0 && getSPS() >= upgrade.unlocksAtSPS) ||
                                 Object.keys(upgrades).some(parentKey => {
                                     const parent = upgrades[parentKey];
                                     const parentUnlocked = (parent.level !== undefined && parent.level >= parent.maxLevel) || parent.purchased;
                                     return parent.unlocks && parent.unlocks.includes(key) && parentUnlocked;
                                 });

                if (isUnlocked && typeof upgrade.unlockCondition === 'function') {
                    isUnlocked = upgrade.unlockCondition();
                }

                if (isUnlocked) {
                    if (isMetaBoardActive && (key === 'addGameBoard' || key === 'mergeGameBoard')) {
                        upgrade.element.classList.add('invisible');
                    } else {
                        upgrade.element.classList.remove('invisible');
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
            
            const circumference = 100.5;

            const speedUpgrade = upgrades.speed;
            speedProgressCircle.style.strokeDashoffset = circumference * (1 - (speedUpgrade.level / speedUpgrade.maxLevel));
            const earlyFraction = Math.min(speedUpgrade.level, HYPER_SPEED_THRESHOLD) / HYPER_SPEED_THRESHOLD;
            speedEarlyProgressCircle.style.strokeDashoffset = circumference * (1 - earlyFraction);
            speedEarlyProgressCircle.style.display = speedUpgrade.level < HYPER_SPEED_THRESHOLD ? 'block' : 'none';

            const energyGenUpgrade = upgrades.energyGenerator;
            energyGenProgressCircle.style.strokeDashoffset = circumference * (1 - (energyGenUpgrade.level / energyGenUpgrade.maxLevel));
            
            const addBoardUpgrade = upgrades.addGameBoard;
            addBoardProgressCircle.style.strokeDashoffset = circumference * (1 - (addBoardUpgrade.level / addBoardUpgrade.maxLevel));
            
            if(isMetaBoardActive) {
                const foamPercent = (quantumFoam / MAX_QUANTUM_FOAM) * 100;
                collapseFoamFill.style.height = `${foamPercent}%`;
                collapseFoamBtn.disabled = quantumFoam < MAX_QUANTUM_FOAM;
                collapseFoamBtn.classList.toggle('ready', quantumFoam >= MAX_QUANTUM_FOAM);
            }

            lucide.createIcons();
            saveGame();
        }

        // FIX: Återställd funktion
        async function runCountdownAnimation(board) {
            const duration = (1.2 / gameSpeed / 3) * 1000;
            let countdownIcons = [];

            if (gameSpeed <= 5) countdownIcons = ["III", "II", "I"];
            else if (gameSpeed <= 6) countdownIcons = ["III", "II"];
            else if (gameSpeed <= 7) countdownIcons = ["III"];
            else if (gameSpeed <= HYPER_SPEED_THRESHOLD) countdownIcons = ["I"];
            
            const svgMap = {
                "III": `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="lucide-lg countdown-pop text-slate-400"><line x1="16" y1="14" x2="16" y2="42"></line><line x1="28" y1="14" x2="28" y2="42"></line><line x1="40" y1="14" x2="40" y2="42"></line></svg>`,
                "II": `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="lucide-lg countdown-pop text-slate-400"><line x1="22" y1="14" x2="22" y2="42"></line><line x1="34" y1="14" x2="34" y2="42"></line></svg>`,
                "I": `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="lucide-lg countdown-pop text-slate-400"><line x1="28" y1="14" x2="28" y2="42"></line></svg>`
            };
            
            for (const icon of countdownIcons) {
                board.computerEl.innerHTML = svgMap[icon];
                board.playerEl.innerHTML = svgMap[icon];
                await new Promise(resolve => setTimeout(resolve, duration));
            }
        }

        function consumeEnergy(amount = 1) {
            if (reserveEnergy >= amount) {
                reserveEnergy -= amount;
            } else {
                const remaining = amount - reserveEnergy;
                reserveEnergy = 0;
                energy = Math.max(0, energy - remaining);
            }
        }

        function hasEnergy() {
            return energy > 0 || reserveEnergy > 0;
        }

        function saveGame() {
            const data = {
                starBalance,
                totalStarsEarned,
                totalGamesPlayed,
                energy,
                reserveEnergy,
                gameSpeed,
                starMultiplier,
                quantumFoam,
                isMetaBoardActive,
                autoPlayWantsToRun,
                gameBoards: gameBoards.length,
                upgrades: {}
            };
            for (const key in upgrades) {
                const u = upgrades[key];
                data.upgrades[key] = {
                    level: u.level,
                    purchased: u.purchased
                };
            }
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        }

        function loadGame() {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            try {
                const data = JSON.parse(raw);
                starBalance = data.starBalance ?? starBalance;
                totalStarsEarned = data.totalStarsEarned ?? totalStarsEarned;
                totalGamesPlayed = data.totalGamesPlayed ?? totalGamesPlayed;
                energy = data.energy ?? energy;
                reserveEnergy = data.reserveEnergy ?? reserveEnergy;
                starMultiplier = data.starMultiplier ?? starMultiplier;
                quantumFoam = data.quantumFoam ?? quantumFoam;
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
                    mergeToMetaBoard();
                }
                if (upgrades.luck.purchased) {
                    upgrades.luck.element.style.display = 'none';
                }
            } catch (e) {
                console.error('Failed to load save', e);
            }
        }

        function resetGame() {
            stopAutoPlayInterval();
            autoPlayWantsToRun = false;
            localStorage.removeItem(SAVE_KEY);
            starBalance = 0;
            totalStarsEarned = 0;
            totalGamesPlayed = 0;
            energy = MAX_ENERGY;
            reserveEnergy = 0;
            starMultiplier = 1;
            quantumFoam = 0;
            gameSpeed = 1;
            isMetaBoardActive = false;
            quantumFoamContainer.classList.add('hidden');
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
            createGameBoard();
            choiceButtons.forEach(btn => btn.disabled = false);
            menuDropdown.classList.add('hidden');
            updateAnimationSpeed();
            manageAutoPlay();
            updateUI();
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
                await runCountdownAnimation(board);
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
            board.playerEl.innerHTML = `<div class="result-wrapper inline-flex justify-center items-center ${revealClass} ${result === 'win' ? 'winner' : ''}"><i data-lucide="${iconMap[playerChoice]}" class="lucide-lg text-slate-800"></i></div>`;
            board.computerEl.innerHTML = `<div class="result-wrapper inline-flex justify-center items-center ${revealClass} ${result === 'lose' ? 'winner' : ''}"><i data-lucide="${iconMap[computerChoice]}" class="lucide-lg text-slate-800"></i></div>`;

            lucide.createIcons();

            if (result === 'win') {
                const starGain = 1 * starMultiplier;
                starBalance += starGain;
                totalStarsEarned += starGain;
            }

            updateUI();
            
            if (!hasEnergy() && autoPlayInterval) stopAutoPlayInterval();

            setTimeout(() => {
                board.isAnimating = false;
                if (!autoPlayInterval) choiceButtons.forEach(btn => btn.disabled = !hasEnergy());
                updateUI();
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
                updateUI();
                if (key === 'autoPlay') toggleAutoPlayState();
                if (key.startsWith('speed')) updateAnimationSpeed();
            }
        }
        
        function handleSellClick(key) {
            const upgrade = upgrades[key];
            if (upgrade.level === undefined || upgrade.level <= 0) return;

            const costOfLastLevel = upgrade.cost(); 
            upgrade.level--;
            const costOfNewLevel = upgrade.cost(); 
            const refundAmount = Math.floor((costOfLastLevel - costOfNewLevel) * 0.75); 
            
            starBalance += refundAmount;

            if (key === 'speed') gameSpeed -= 1;
            if (key === 'addGameBoard') {
                const boardToRemove = gameBoards.pop();
                if (boardToRemove) boardToRemove.element.remove();
                adjustBoardLayout();
            }
            
            updateUI();
            if (key === 'speed') updateAnimationSpeed();
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
            
            const starGain = roundedWins * starMultiplier;
            starBalance += starGain;
            totalStarsEarned += starGain;

            if (isMetaBoardActive) {
                quantumFoam = Math.min(MAX_QUANTUM_FOAM, quantumFoam + gamesToPlay);
            }
            
            if (!isMetaBoardActive) {
                gameBoards.forEach(board => {
                    const randomChoice1 = choices[Math.floor(Math.random() * 3)];
                    board.computerEl.innerHTML = `<i data-lucide="${iconMap[randomChoice1]}" class="lucide-lg text-slate-400"></i>`;
                    board.playerEl.innerHTML = `<i data-lucide="${iconMap[choices[Math.floor(Math.random() * 3)]]}" class="lucide-lg text-slate-400"></i>`;
                });
                lucide.createIcons();
            }

            updateUI();
        }

        function collapseFoam() {
            if (quantumFoam < MAX_QUANTUM_FOAM) return;
            
            const bonus = Math.floor(getSPS() * 10);
            addStars(bonus);
            quantumFoam = 0;
            
            const metaBoard = document.getElementById('meta-board');
            if(metaBoard) {
                metaBoard.classList.add('pop-item');
                setTimeout(() => metaBoard.classList.remove('pop-item'), 500);
            }
            updateUI();
        }

        function restartAutoPlay() {
            clearInterval(autoPlayInterval);
            const processInterval = (gameSpeed >= HYPER_SPEED_THRESHOLD || isMetaBoardActive) ? 100 : (1.2 / gameSpeed * 1000) + 450;
            
            autoPlayInterval = setInterval(() => {
                if (gameSpeed >= HYPER_SPEED_THRESHOLD || isMetaBoardActive) {
                    processBulkGames();
                } else {
                    gameBoards.forEach(board => {
                        if(!board.isAnimating) playGame(choices[Math.floor(Math.random() * 3)], board);
                    });
                }
            }, processInterval / (isMetaBoardActive ? 1 : gameBoards.length));
        }

        function manageAutoPlay() {
            if (autoPlayWantsToRun && !autoPlayInterval && hasEnergy()) {
                choiceButtons.forEach(btn => btn.disabled = true);
                upgrades.autoPlay.element.classList.add('toggled', 'pulse');
                lastTick = performance.now();
                restartAutoPlay();
            } else if (!autoPlayWantsToRun && autoPlayInterval) {
                stopAutoPlayInterval();
                upgrades.autoPlay.element.classList.remove('toggled', 'pulse');
            }
        }
        
        function stopAutoPlayInterval() {
            if (!autoPlayInterval) return;
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
            upgrades.autoPlay.element.classList.remove('pulse');
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
        
        const tallySVGs = {
            1: `<svg width="8" height="16" viewBox="0 0 8 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
            2: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
            3: `<svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M20 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
            4: `<svg width="32" height="16" viewBox="0 0 32 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M20 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M28 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
            5: `<svg width="34" height="16" viewBox="0 0 34 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M20 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M28 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M2 13L32 3" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`
        };

        function generateCostVisual(cost) {
            let html = `<div class="flex items-center gap-2"><i data-lucide="star" class="w-4 h-4 text-white fill-current"></i><span class="font-bold text-lg">×</span>`;
            if (cost === 0) return 'Gratis';
            if (cost >= 10) {
                html += `<span class="font-mono text-lg">${toRoman(cost)}</span>`;
            } else {
                html += `<div class="flex items-center gap-1">`;
                let remaining = cost;
                while(remaining > 0) {
                    if (remaining >= 5) {
                        html += tallySVGs[5];
                        remaining -= 5;
                    } else {
                        if(tallySVGs[remaining]) html += tallySVGs[remaining];
                        remaining = 0;
                    }
                }
                html += `</div>`;
            }
            html += `</div>`;
            return html;
        }

        function showTooltip(element, key) {
            if (key === 'choice') return;
            const upgrade = upgrades[key];
            if (!upgrade || (upgrade.purchased && !upgrade.consumable && !upgrade.level) || (upgrade.level >= upgrade.maxLevel)) return;
            
            const cost = typeof upgrade.cost === 'function' ? upgrade.cost() : upgrade.cost;
            tooltip.innerHTML = generateCostVisual(cost);
            
            lucide.createIcons();
            
            const rect = element.getBoundingClientRect();
            tooltip.style.display = 'block';
            tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
            tooltip.style.opacity = '1';
        }

        function hideTooltip() {
            tooltip.style.opacity = '0';
            setTimeout(() => { tooltip.style.display = 'none'; }, 200);
        }

        // --- DEBUG FUNCTIONS ---
        function addStars(amount) {
            starBalance += amount;
            totalStarsEarned += amount;
            updateUI();
        }
        function changeSpeed(amount) {
            const currentLevel = upgrades.speed.level;
            const newLevel = currentLevel + amount;
            if (newLevel >= 0 && newLevel <= upgrades.speed.maxLevel) {
                upgrades.speed.level = newLevel;
                gameSpeed = 1 + newLevel;
                updateAnimationSpeed();
                updateUI();
            }
        }

        init();
