/**
 * Factory that builds the `upgrades` configuration object for Phase 1.
 *
 * Static data (cost formulas, level caps, unlock thresholds) lives here.
 * Purchase side-effects that mutate orchestrator-owned state are passed in
 * via the `actions` parameter so this module stays free of direct closures
 * over index.js variables.
 *
 * @param {object} actions - Callbacks for purchase side-effects
 * @param {function} actions.rechargeEnergy  - Adds energy (manualRecharge)
 * @param {function} actions.addReserve      - Adds reserve energy (buyBattery)
 * @param {function} actions.incrementSpeed  - Bumps gameSpeed by 1 (speed)
 * @param {function} actions.multiplyStars   - Multiplies starMultiplier (luck)
 * @param {function} actions.createGameBoard - Adds a new game board (addGameBoard)
 * @param {function} actions.mergeToMetaBoard - Activates the meta board (mergeGameBoard)
 * @param {function} actions.setPhaseToCity  - Transitions to Phase 2 (bank)
 * @returns {object} upgrades
 */
export function createUpgrades(actions) {
    const {
        rechargeEnergy,
        addReserve,
        incrementSpeed,
        multiplyStars,
        createGameBoard,
        mergeToMetaBoard,
        setPhaseToCity,
    } = actions;

    const upgrades = {
        autoPlay: {
            cost: 5, purchased: false, unlocksAt: 2, unlocks: ['speed'],
            element: document.getElementById('autoPlay'),
            purchase: function() { this.element.classList.remove('fade-in'); }
        },
        manualRecharge: {
            cost: 1, consumable: true, unlocksAt: 15, unlocks: [],
            element: document.getElementById('manualRecharge'),
            purchase: function() { rechargeEnergy(); }
        },
        speed: {
            level: 0, maxLevel: 55,
            cost: () => 10 + Math.floor(upgrades.speed.level * 2),
            unlocks: [],
            element: document.getElementById('speed'),
            purchase: function() {
                this.level++;
                incrementSpeed();
                this.element.classList.add('click-pulse');
                setTimeout(() => this.element.classList.remove('click-pulse'), 320);
            }
        },
        buyBattery: {
            cost: 100, consumable: true,
            unlocksAt: 50, unlocks: [],
            element: document.getElementById('buyBattery'),
            purchase: function() {
                addReserve();
                this.element.classList.add('click-pulse');
                setTimeout(() => this.element.classList.remove('click-pulse'), 320);
            }
        },
        luck: {
            cost: 50, purchased: false, unlocksAtGames: 100, unlocks: [],
            element: document.getElementById('luck'),
            purchase: function() {
                multiplyStars();
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
            unlockCondition: () =>
                upgrades.mergeGameBoard.purchased && actions.getTotalStarsEarned() >= 50000,
            purchase: function() {
                setPhaseToCity();
            }
        }
    };

    return upgrades;
}
