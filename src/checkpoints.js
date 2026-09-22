/**
 * Checkpoints and snapshots for testing. Reachable from the ☰ menu when the
 * debug menu is on. A checkpoint writes a prepared save into localStorage and
 * reloads; a snapshot copies every rpi-* key into a slot so you can come back.
 *
 * Saves here mirror src/phase1/persistence.js and src/phase2/index.js; if a
 * field is added there, add it here too (missing fields fall back to defaults).
 */

import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS } from './constants.js';
import { initialDeepState, CRYO, DAYS_PER_YEAR, probeDays } from './phase4/deep.js';
import { initialLayout } from './phase4/layout.js';
import { serializeDeep } from './phase4/persistence.js';
import { initialWatcher, puzzleGapYears } from './phase4/watcher.js';

const P1 = PHASE1_CONSTANTS.SAVE_KEY, P2 = PHASE2_CONSTANTS.SAVE_KEY, XFER = PHASE2_CONSTANTS.STARS_TRANSFER_KEY;
const P4 = PHASE4_CONSTANTS.SAVE_KEY;

function p1Save(over = {}) {
    const upgrades = {
        autoPlay: { purchased: false }, manualRecharge: {}, speed: { level: 0 }, energyGenerator: { level: 0 },
        buyBattery: {}, luck: { purchased: false }, addGameBoard: { level: 0 }, mergeGameBoard: { purchased: false }, bank: { purchased: false },
        ...(over.upgrades || {}),
    };
    return JSON.stringify({
        schemaVersion: 1, starBalance: 0, totalStarsEarned: 0, totalGamesPlayed: 0, totalWins: 0,
        energy: 100, reserveEnergy: 0, gameSpeed: 1, starMultiplier: 1, quantumFoam: 0, foamCollapses: 0,
        isMetaBoardActive: false, autoPlayWantsToRun: false, gameBoards: 1,
        ...over, upgrades,
    });
}

const mk = (id, type, population, capacity) => ({ id, type, population, capacity });
const store = (id, type = 'store') => (type === 'store' ? { id, type, upkeep: 20, supply: 20 } : { id, type, upkeep: 50, supply: 60 });

function p2Save(over = {}) {
    return JSON.stringify({
        schemaVersion: 1, stars: 0, science: 0, population: 0, populationAllocation: 0.5, supplies: 150,
        buildings: [{ id: 1, type: 'factory' }, { id: 2, type: 'bank' }, null, null, null, null, null, null, null, null],
        gmoLevel: 0, gmoMaxLevel: 10, stalls: 0, harvestEfficiency: 1,
        ...over,
    });
}

const completeCity = () => {
    const b = [{ id: 1, type: 'factory' }, { id: 2, type: 'bank' }];
    for (let i = 3; i <= 12; i++) b.push(mk(i, 'skyscraper', 500, 500));
    for (let i = 13; i <= 16; i++) b.push(store(i, 'superStore'));
    b.push(mk(17, 'district', 100000, 100000), mk(18, 'district', 100000, 100000), mk(19, 'apartment', 50, 50), mk(20, 'home', 10, 10));
    return b;
};
const completeFlags = {
    gmoLevel: 10, apartmentResearched: true, storeResearched: true, toolCaseUnlocked: true, carUnlocked: true,
    computerUnlocked: true, urbanismResearched: true, megastructureResearched: true, landExpanded: true, landExpansion2: true,
    superconductorLevel: 5, stalls: 200, islandRevealed: true,
};
const competitor = (stage, ticks) => ({ competitorSpawned: true, competitorSpawnedAt: Date.now() - ticks * 1000, competitorTicks: ticks, competitorStage: stage });

/** Ordered list of checkpoints: id, label (icon-ish, short), apply(). */
export const CHECKPOINTS = [
    { id: 'i-start', label: 'I · start', apply: () => { clearAll(); } },
    { id: 'i-bulk', label: 'I · speed 10', apply: () => { clearAll(); set(P1, p1Save({ starBalance: 300, totalStarsEarned: 400, totalGamesPlayed: 1200, totalWins: 400, reserveEnergy: 500, gameSpeed: 10, autoPlayWantsToRun: true, upgrades: { autoPlay: { purchased: true }, speed: { level: 9 }, energyGenerator: { level: 3 } } })); set(PHASE_KEY, 'INDUSTRY'); } },
    { id: 'i-factory', label: 'I · factory ready', apply: () => { clearAll(); set(P1, p1Save({ starBalance: 12000, totalStarsEarned: 60000, totalGamesPlayed: 90000, totalWins: 45000, reserveEnergy: 1500, gameSpeed: 41, autoPlayWantsToRun: true, gameBoards: 9, upgrades: { autoPlay: { purchased: true }, speed: { level: 40 }, energyGenerator: { level: 50 }, addGameBoard: { level: 8 }, luck: { purchased: true } } })); set(PHASE_KEY, 'INDUSTRY'); } },
    { id: 'i-running', label: 'I · factory running', apply: () => { clearAll(); set(P1, p1Save({ starBalance: 80000, totalStarsEarned: 200000, totalGamesPlayed: 200000, totalWins: 120000, gameSpeed: 41, starMultiplier: 10, quantumFoam: 15000, foamCollapses: 1, isMetaBoardActive: true, autoPlayWantsToRun: true, gameBoards: 9, upgrades: { autoPlay: { purchased: true }, speed: { level: 40 }, energyGenerator: { level: 50 }, addGameBoard: { level: 8 }, luck: { purchased: true }, mergeGameBoard: { purchased: true } } })); set(PHASE_KEY, 'INDUSTRY'); } },
    { id: 'ii-start', label: 'II · start', apply: () => { clearAll(); set(P1, p1Save({ isMetaBoardActive: true, starMultiplier: 10, upgrades: { mergeGameBoard: { purchased: true }, bank: { purchased: true } } })); set(XFER, '250000'); set(PHASE_KEY, 'CITY'); } },
    { id: 'ii-mid', label: 'II · mid city', apply: () => {
        clearAll(); set(P1, p1Save({ isMetaBoardActive: true, starMultiplier: 10, upgrades: { mergeGameBoard: { purchased: true }, bank: { purchased: true } } }));
        const b = [{ id: 1, type: 'factory' }, { id: 2, type: 'bank' }, mk(3, 'skyscraper', 500, 500), mk(4, 'apartment', 50, 50), mk(5, 'apartment', 50, 50), mk(6, 'apartment', 40, 50), store(7), store(8), mk(9, 'home', 10, 10), null];
        set(P2, p2Save({ stars: 3000000, science: 150000, population: 650, supplies: 20000, buildings: b, gmoLevel: 3, stalls: 6, apartmentResearched: true, storeResearched: true, toolCaseUnlocked: true, urbanismResearched: true, carUnlocked: true }));
        set(PHASE_KEY, 'CITY');
    } },
    { id: 'ii-complete', label: 'II · complete, enemy built', apply: () => {
        clearAll(); set(P1, p1Save({ isMetaBoardActive: true, starMultiplier: 10, upgrades: { mergeGameBoard: { purchased: true }, bank: { purchased: true } } }));
        set(P2, p2Save({ stars: 5e11, science: 5e7, population: 205060, supplies: 5e8, buildings: completeCity(), ...completeFlags, ...competitor(5, 400) }));
        set(PHASE_KEY, 'CITY');
    } },
    { id: 'ii-raided', label: 'II · raided, swords open', apply: () => {
        clearAll(); set(P1, p1Save({ isMetaBoardActive: true, starMultiplier: 10, upgrades: { mergeGameBoard: { purchased: true }, bank: { purchased: true } } }));
        const b = completeCity(); b[19] = { ...b[19], razed: true, population: 0 };
        set(P2, p2Save({ stars: 5e11, science: 5e7, population: 205050, supplies: 5e8, buildings: b, ...completeFlags, ...competitor(5, 500), warReady: true, lastRaidAt: Date.now() }));
        set(PHASE_KEY, 'CITY');
    } },
    { id: 'iii-start', label: 'III · war begins', apply: () => {
        clearAll(); set(P1, p1Save({ isMetaBoardActive: true, starMultiplier: 10, upgrades: { mergeGameBoard: { purchased: true }, bank: { purchased: true } } }));
        const pop = 205050;
        set(P2, p2Save({ stars: 5e11, science: 3e7, population: pop, supplies: 5e8, buildings: completeCity(), ...completeFlags, ...competitor(5, 500), warReady: true, warChosen: true,
            war: { active: true, startedAt: 0, t: 0, arms: 0, armsShare: 0.3, defence: 0, force: 0, tier: 0, enemyTier: 0, enemyDefence: 30, waveCount: 0, lastWaveAt: 0, nextTierAt: 120, scorchOurs: 0, scorchTheirs: 0, salvage: 0, enemyLeft: false, shipReady: false, auto: false, scienceRate0: pop * 0.5, lastTierAt: -999, enemyRazedUntil: [0, 0, 0, 0, 0] } }));
        set(PHASE_KEY, 'CITY');
    } },
    { id: 'iii-late', label: 'III · late war (tier V)', apply: () => {
        clearAll(); set(P1, p1Save({ isMetaBoardActive: true, starMultiplier: 10, upgrades: { mergeGameBoard: { purchased: true }, bank: { purchased: true } } }));
        const pop = 150000; const b = completeCity();
        b[5] = { ...b[5], razed: true, population: 0 }; b[10] = { ...b[10], razed: true, population: 0 }; b[17] = { ...b[17], population: 50000 };
        for (const x of b) if (x && !x.razed && x.type !== 'factory' && x.type !== 'bank') { x.fort = 2; x.hp = 40; }
        set(P2, p2Save({ stars: 2e11, science: 8e7, population: pop, supplies: 3e8, buildings: b, ...completeFlags, ...competitor(5, 900), warReady: true, warChosen: true,
            war: { active: true, startedAt: 0, t: 600, arms: 2500, armsShare: 0.5, defence: 70, force: 30, tier: 4, enemyTier: 4, enemyDefence: 60, waveCount: 18, lastWaveAt: 590, nextTierAt: 700, scorchOurs: 500, scorchTheirs: 900, salvage: 4000, enemyLeft: false, shipReady: false, auto: false, scienceRate0: pop * 0.5, lastTierAt: 500, enemyRazedUntil: [0, 0, 0, 0, 0] } }));
        set(PHASE_KEY, 'CITY');
    } },
    { id: 'iv-start', label: 'IV · the deep', apply: () => {
        clearAll();
        // The day the exit was blown: the salvage the war left, and a surface
        // scorched to the point where the enemy walked away.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-cryo', label: 'IV · cryo I', apply: () => {
        clearAll();
        // A colony that runs itself: the rooms are automated, the hall is dug, and the
        // snowflake starts a sleep of a month a second that runs until an alarm. Day ~400,
        // which is year 1. Enough people and ore for a scout party, and none out yet.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        Object.assign(deep, {
            day: 400, minerals: 26000, food: 9000, stars: 9.0e4, humans: 16,
            chambers: 9, rooms: { mine: 3, farm: 2, generator: 2, dorm: 1, cryo: 1 },
            level: { mine: 1, farm: 1, generator: 1, dorm: 0 },
            auto: { mine: 1, farm: 1, generator: 1, dorm: 0 },
            cryo: 0,
        });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-late', label: 'IV · cryo V, y5 000', apply: () => {
        clearAll();
        // Deep into the calendar: a millennium a second, one party already home (the ring is
        // a little narrower and a little hopeful), and another still out there with 45 people.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        const day = 5000 * DAYS_PER_YEAR;
        Object.assign(deep, {
            day, minerals: 4.0e6, food: 2.0e6, stars: 6.0e14, humans: 900,
            chambers: 26, rooms: { mine: 8, farm: 6, generator: 6, dorm: 4, cryo: 1 },
            level: { mine: 4, farm: 4, generator: 4, dorm: 3 },
            auto: { mine: 2, farm: 2, generator: 2, dorm: 1 },
            cryo: 4,
            est: { bias: -4, spread: 20 }, estRevealed: true, probesSent: 1,
            probes: [{ sentDay: day, dueDay: day + probeDays(1), people: 45 }],
        });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-watcher', label: 'IV · the Watcher', apply: () => {
        clearAll();
        // Deep into the sleeps (v1.46.0): asleep at a century a second, the Watcher named, its
        // stability at 55 (the base has begun to soften), the machines' capacity full, and a
        // riddle a few seconds away. Left alone, the meter reaches zero in about half a minute
        // and the system reboots.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        const day = 5000 * DAYS_PER_YEAR;
        const slept = 4800;
        Object.assign(deep, {
            day, minerals: 4.0e6, food: 2.0e6, stars: 6.0e14, humans: 900,
            chambers: 26, rooms: { mine: 8, farm: 6, generator: 6, dorm: 4, cryo: 1 },
            level: { mine: 4, farm: 4, generator: 4, dorm: 3 },
            auto: { mine: 2, farm: 2, generator: 2, dorm: 1 },
            cryo: 3, asleep: true,
            est: { bias: -4, spread: 20 }, estRevealed: true, probesSent: 1, shaftOpen: true,
            watcher: {
                ...initialWatcher(), stage: 1, stability: 55, capacity: 100, sleptYears: slept, seed: 3,
                nextPuzzleYears: slept + puzzleGapYears(3) / 4,
            },
        });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
];
/** The cryo tier each late checkpoint sits on, so the labels cannot drift from the ladder. */
export const CHECKPOINT_CRYO = { 'iv-cryo': CRYO[0], 'iv-late': CRYO[4], 'iv-watcher': CRYO[3] };

const SLOTS = ['rpi-slot-1', 'rpi-slot-2', 'rpi-slot-3'];

function set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
function clearAll() {
    try { Object.keys(localStorage).filter(k => k.startsWith('rpi-') && !k.startsWith('rpi-slot-') && k !== 'rpi-debug').forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
}

/** Copies every game key (not slots, not the debug flag) into slot i. */
export function snapshot(i) {
    const data = {};
    try { Object.keys(localStorage).filter(k => k.startsWith('rpi-') && !k.startsWith('rpi-slot-') && k !== 'rpi-debug').forEach(k => { data[k] = localStorage.getItem(k); }); } catch { /* ignore */ }
    set(SLOTS[i], JSON.stringify({ at: Date.now(), phase: data[PHASE_KEY] || 'INDUSTRY', data }));
}

/** Restores slot i and reloads. */
export function restore(i) {
    let raw = null;
    try { raw = localStorage.getItem(SLOTS[i]); } catch { /* ignore */ }
    if (!raw) return false;
    const { data } = JSON.parse(raw);
    window.__rpiSkipSave = true;   // the phases save on unload; not this time
    clearAll();
    for (const [k, v] of Object.entries(data)) set(k, v);
    location.reload();
    return true;
}

export function slotInfo(i) {
    try { const raw = localStorage.getItem(SLOTS[i]); if (!raw) return null; const { at, phase } = JSON.parse(raw); return { at, phase }; } catch { return null; }
}

/** Applies a checkpoint by id and reloads. */
export function jumpTo(id) {
    const cp = CHECKPOINTS.find(c => c.id === id);
    if (!cp) return;
    window.__rpiSkipSave = true;   // the phases save on unload; not this time
    cp.apply();
    try { sessionStorage.removeItem('rpi-recovered'); } catch { /* ignore */ }
    location.reload();
}
