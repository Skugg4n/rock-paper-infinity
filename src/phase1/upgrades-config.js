import { PHASE1_CONSTANTS } from '../constants.js';

const { BATTERY_UNLOCK_EPS, GENERATOR_UNLOCK_BATTERIES } = PHASE1_CONSTANTS;

/**
 * Factory that builds the `upgrades` configuration object for Phase 1.
 *
 * Static data (cost formulas, level caps, unlock thresholds) lives here.
 * Purchase side-effects that mutate orchestrator-owned state are passed in
 * via the `actions` parameter so this module stays free of direct closures
 * over index.js variables.
 *
 * Balance (v1.21.0, simulated in docs/superpowers/specs/2026-09-18-phase1-avalanche.md):
 * costs grow geometrically so every purchase feels heavier than the last,
 * and unlocks arrive in a fixed order: hands → auto → speed → recharge (15★)
 * → luck (100 games) → boards (150★) → factory (everything maxed) → bank.
 *
 * The energy ladder (v1.53.0, docs/superpowers/specs/2026-10-02-clover-and-energy-ladder-design.md)
 * unlocks by NEED, not by stars, so each helper is felt before the next one
 * arrives: recharge clicks → big battery (when the machines eat 22 energy a
 * second and clicking cannot keep up) → generator (after 5 big batteries).
 * Good, then a slog, then the upgrade that makes it good again.
 *
 * @param {object} actions - Callbacks for purchase side-effects
 * @param {function} actions.rechargeEnergy  - Adds energy (manualRecharge)
 * @param {function} actions.addReserve      - Adds reserve energy (buyBattery)
 * @param {function} actions.isEnergyFull    - The small battery is full (recharge is blocked)
 * @param {function} actions.isReserveFull   - The big battery is full (buying another is blocked)
 * @param {function} actions.getEnergyPerSecond - Energy the machines eat per second (battery gate)
 * @param {function} actions.getBatteriesBought - Big batteries bought so far (generator gate)
 * @param {function} actions.incrementSpeed  - Bumps gameSpeed by 1 (speed)
 * @param {function} actions.createGameBoard - Adds a new game board (addGameBoard)
 * @param {function} actions.mergeToMetaBoard - Activates the meta board (mergeGameBoard)
 * @param {function} actions.setPhaseToCity  - Transitions to Phase 2 (bank)
 * @param {function} actions.getTotalStarsEarned - Lifetime stars (bank gate)
 * @param {function} actions.getFoamCollapses - Times the quantum foam has been collapsed
 * @param {function} actions.getFoamFraction  - Current foam fill 0–1 (for the bank ring)
 * @param {number}   actions.bankGateCollapses - Collapses needed for the bank
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
        bankGateCollapses = 2,
    } = actions;

    // Two significant figures: 22 346 → 22 000, so Roman costs stay readable.
    const geometric = (base, ratio, level) => {
        const raw = base * Math.pow(ratio, level);
        const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 1));
        return Math.round(raw / mag) * mag;
    };

    const upgrades = {
        autoPlay: {
            cost: 5, purchased: false, unlocksAt: 2, unlocks: ['speed'],
            element: document.getElementById('autoPlay'),
            purchase: function() { this.element.classList.remove('fade-in'); }
        },
        manualRecharge: {
            cost: 1, consumable: true, unlocksAt: 15, unlocks: [],
            blocked: () => actions.isEnergyFull(),
            element: document.getElementById('manualRecharge'),
            purchase: function() { rechargeEnergy(); }
        },
        speed: {
            level: 0, maxLevel: 40,
            cost: () => geometric(10, 1.10, upgrades.speed.level),
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
            level: 0, maxLevel: 50,
            cost: () => geometric(25, 1.07, upgrades.energyGenerator.level),
            // Arrives when big batteries stop keeping up: after the speed-10
            // jump a pack is eaten in seconds, and the fifth one opens this.
            unlocksAt: 0, unlocks: [],
            unlockCondition: () =>
                upgrades.energyGenerator.level > 0 ||
                actions.getBatteriesBought() >= GENERATOR_UNLOCK_BATTERIES,
            element: document.getElementById('energyGenerator'),
            purchase: function() { this.level++; }
        },
        buyBattery: {
            // The big battery, the step between clicking recharge and the
            // generator: one purchase fills it completely (1 500 energy, fifteen
            // small tanks). Arrives when clicking has become a slog: the machines
            // eat 22 energy a second, the tank is empty in under five. Once
            // bought it stays, and a new one can be bought when it runs down.
            cost: 20, consumable: true,
            blocked: () => actions.isReserveFull(),
            unlocksAt: 0, unlocks: [],
            unlockCondition: () =>
                actions.getBatteriesBought() > 0 ||
                actions.getEnergyPerSecond() >= BATTERY_UNLOCK_EPS,
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
            // The big uphill of chapter I: each board is a long climb, then a
            // burst of speed/generator buys downhill.
            cost: () => geometric(250, 1.9, upgrades.addGameBoard.level),
            unlocksAt: 150, unlocks: [],
            element: document.getElementById('addGameBoard'),
            purchase: function() {
                if (this.level >= this.maxLevel) return;
                this.level++;
                createGameBoard();
            }
        },
        mergeGameBoard: {
            cost: 10000, purchased: false,
            unlocksAt: 0,
            element: document.getElementById('mergeGameBoard'),
            // Factory: every upgrade of chapter I must be complete. Shown greyed
            // out (with a progress ring) from the moment boards unlock, so the
            // player knows where the chapter is heading.
            unlockCondition: () =>
                upgrades.autoPlay.purchased &&
                upgrades.luck.purchased &&
                upgrades.speed.level >= upgrades.speed.maxLevel &&
                upgrades.energyGenerator.level >= upgrades.energyGenerator.maxLevel &&
                upgrades.addGameBoard.level >= upgrades.addGameBoard.maxLevel,
            teaseCondition: () => actions.getTotalStarsEarned() >= upgrades.addGameBoard.unlocksAt,
            progress: () => {
                const done = upgrades.speed.level + upgrades.energyGenerator.level +
                    upgrades.addGameBoard.level + (upgrades.luck.purchased ? 1 : 0);
                const total = upgrades.speed.maxLevel + upgrades.energyGenerator.maxLevel +
                    upgrades.addGameBoard.maxLevel + 1;
                return done / total;
            },
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
            // Gate: factory must be purchased AND the foam collapsed a couple of
            // times, so the factory (and its boost) is felt before chapter II.
            // Greyed out with a progress ring as soon as the factory is bought;
            // the ring fills with the foam.
            unlockCondition: () =>
                upgrades.mergeGameBoard.purchased && actions.getFoamCollapses() >= bankGateCollapses,
            teaseCondition: () => upgrades.mergeGameBoard.purchased,
            progress: () => Math.min(1, (actions.getFoamCollapses() + actions.getFoamFraction()) / bankGateCollapses),
            purchase: function() {
                setPhaseToCity();
            }
        }
    };

    return upgrades;
}
