/* eslint-env jest */
import { JSDOM } from 'jsdom';
import { PHASE1_CONSTANTS } from '../constants.js';

const IDS = ['autoPlay', 'manualRecharge', 'speed', 'energyGenerator', 'buyBattery', 'luck',
    'addGameBoard', 'mergeGameBoard', 'bank'];

let createUpgrades;
let eps;
let batteries;
let upgrades;

beforeEach(async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${IDS.map(id => `<button id="${id}"></button>`).join('')}</body></html>`);
    global.document = dom.window.document;
    ({ createUpgrades } = await import('./upgrades-config.js'));
    eps = 0;
    batteries = 0;
    upgrades = createUpgrades({
        rechargeEnergy: () => {}, addReserve: () => {}, incrementSpeed: () => {},
        createGameBoard: () => {}, mergeToMetaBoard: () => {}, setPhaseToCity: () => {},
        getTotalStarsEarned: () => 0, getFoamCollapses: () => 0, getFoamFraction: () => 0,
        getEnergyPerSecond: () => eps, getBatteriesBought: () => batteries,
    });
});

describe('the energy ladder unlocks by need', () => {
    test('the big battery costs 20 and waits until the machines eat 22 energy a second', () => {
        expect(PHASE1_CONSTANTS.BATTERY_UNLOCK_EPS).toBe(22);
        expect(upgrades.buyBattery.cost).toBe(20);
        expect(upgrades.buyBattery.unlocksAt).toBe(0);
        eps = 21.9;
        expect(upgrades.buyBattery.unlockCondition()).toBe(false);
        eps = 22;
        expect(upgrades.buyBattery.unlockCondition()).toBe(true);
    });

    test('a big battery that has been bought stays, whatever the consumption', () => {
        eps = 0;
        batteries = 1;
        expect(upgrades.buyBattery.unlockCondition()).toBe(true);
    });

    test('the generator waits for five big batteries', () => {
        expect(upgrades.energyGenerator.unlocksAt).toBe(0);
        batteries = PHASE1_CONSTANTS.GENERATOR_UNLOCK_BATTERIES - 1;
        expect(upgrades.energyGenerator.unlockCondition()).toBe(false);
        batteries = PHASE1_CONSTANTS.GENERATOR_UNLOCK_BATTERIES;
        expect(upgrades.energyGenerator.unlockCondition()).toBe(true);
    });

    test('a generator that already has a level stays unlocked', () => {
        batteries = 0;
        upgrades.energyGenerator.level = 1;
        expect(upgrades.energyGenerator.unlockCondition()).toBe(true);
    });

    test('the recharge button is unchanged', () => {
        expect(upgrades.manualRecharge.cost).toBe(1);
        expect(upgrades.manualRecharge.unlocksAt).toBe(15);
    });
});
