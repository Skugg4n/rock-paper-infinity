/**
 * Factory that builds the `upgrades` configuration object for Phase 1.
 *
 * Static data (cost formulas, level caps, unlock thresholds) lives here.
 * Purchase side-effects that mutate orchestrator-owned state are passed in
 * via the `actions` parameter so this module stays free of direct closures
 * over index.js variables.
 *
 * Balance (v1.20.0, simulated in docs/superpowers/specs/2026-09-18-phase1-avalanche.md):
 * costs grow geometrically so every purchase feels heavier than the last,
 * and unlocks arrive in a fixed order: hands → auto → speed → recharge →
 * generator → battery → luck → boards → factory → bank.
 *
 * @param {object} actions - Callbacks for purchase side-effects
 * @param {function} actions.rechargeEnergy  - Adds energy (manualRecharge)
 * @param {function} actions.addReserve      - Adds reserve energy (buyBattery)
 * @param {function} actions.incrementSpeed  - Bumps gameSpeed by 1 (speed)
 * @param {function} actions.createGameBoard - Adds a new game board (addGameBoard)
 * @param {function} actions.mergeToMetaBoard - Activates the meta board (mergeGameBoard)
 * @param {function} actions.setPhaseToCity  - Transitions to Phase 2 (bank)
 * @param {function} actions.getTotalStarsEarned - Lifetime stars (bank gate)
 * @param {number}   actions.bankGateStars   - Lifetime stars needed for the bank
 * @returns {object} upgrades
 */
export function createUpgrades(actions) {
    const {
        rechargeEnergy,
        addReserve,
        incrementSpeed,
        createGameBoard,
        mergeToMetaBoard,
        setPhaseToCity,
        bankGateStars = 250000,
    } = actions;

    const geometric = (base, ratio, level) => Math.round(base * Math.pow(ratio, level));

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
            level: 0, maxLevel: 40,
            cost: () => geometric(10, 1.08, upgrades.speed.level),
            unlocks: [],
            element: document.getElementById('speed'),
            purchase: function() {
                this.level++;
                incrementSpeed();
                this.element.classList.add('click-pulse');
                setTimeout(() => this.element.classList.remove('click-pulse'), 320);
            }
        },
        energyGenerator: {
            level: 0, maxLevel: 100,
            cost: () => geometric(20, 1.03, upgrades.energyGenerator.level),
            unlocksAt: 30, unlocks: [],
            element: document.getElementById('energyGenerator'),
            purchase: function() { this.level++; }
        },
        buyBattery: {
            cost: 100, consumable: true,
            unlocksAt: 60, unlocks: [],
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
                // Real luck: bias RNG toward player wins (win rate 1/3 → 2/3),
                // applied in both animated and bulk mode.
                this.element.style.display = 'none';
            }
        },
        addGameBoard: {
            level: 0, maxLevel: 8,
            cost: () => geometric(150, 1.6, upgrades.addGameBoard.level),
            unlocksAt: 150, unlocks: [],
            element: document.getElementById('addGameBoard'),
            purchase: function() {
                if (this.level >= this.maxLevel) return;
                this.level++;
                createGameBoard();
            }
        },
        mergeGameBoard: {
            cost: 5000, purchased: false,
            unlocksAt: 0,
            element: document.getElementById('mergeGameBoard'),
            // Factory: the two visible "grids" (speed + boards) must be full and
            // luck bought. The generator is support, not a gate, and the factory
            // has its own reactor so it never starves.
            unlockCondition: () =>
                upgrades.autoPlay.purchased &&
                upgrades.luck.purchased &&
                upgrades.speed.level >= upgrades.speed.maxLevel &&
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
            // Gate: factory must be purchased AND the player must have run it for
            // a while (lifetime stars) so the factory is felt before chapter II.
            unlockCondition: () =>
                upgrades.mergeGameBoard.purchased && actions.getTotalStarsEarned() >= bankGateStars,
            purchase: function() {
                setPhaseToCity();
            }
        }
    };

    return upgrades;
}
