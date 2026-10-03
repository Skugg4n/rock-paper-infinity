/**
 * Checkpoints and snapshots for testing. Reachable from the ☰ menu when the
 * debug menu is on. A checkpoint writes a prepared save into localStorage and
 * reloads; a snapshot copies every rpi-* key into a slot so you can come back.
 *
 * Saves here mirror src/phase1/persistence.js and src/phase2/index.js; if a
 * field is added there, add it here too (missing fields fall back to defaults).
 */

import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS } from './constants.js';
import { initialDeepState, CRYO, DAYS_PER_YEAR, probeDays, impliedFeed, tickDay } from './phase4/deep.js';
import { initialLayout } from './phase4/layout.js';
import { serializeDeep } from './phase4/persistence.js';
import { initialWatcher, puzzleGapYears } from './phase4/watcher.js';
import { initialSurface } from './phase4/surface.js';
import { startGrow, graphOf, organsOf, settleFloors } from './phase4/grow.js';
import { LADDER } from './phase4/watcher.js';

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
    gmoLevel: 10, apartmentResearched: true, storeResearched: true, greenhouseResearched: true, toolCaseUnlocked: true, carUnlocked: true,
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
    { id: 'iii-end', label: 'III · war over, the shovel', apply: () => {
        clearAll(); set(P1, p1Save({ isMetaBoardActive: true, starMultiplier: 10, upgrades: { mergeGameBoard: { purchased: true }, bank: { purchased: true } } }));
        const pop = 150000; const b = completeCity();
        b[5] = { ...b[5], razed: true, population: 0 }; b[10] = { ...b[10], razed: true, population: 0 }; b[17] = { ...b[17], population: 50000 };
        for (const x of b) if (x && !x.razed && x.type !== 'factory' && x.type !== 'bank') { x.fort = 2; x.hp = 40; }
        set(P2, p2Save({ stars: 2e11, science: 8e7, population: pop, supplies: 3e8, buildings: b, ...completeFlags, ...competitor(5, 900), warReady: true, warChosen: true,
            war: { active: true, startedAt: 0, t: 600, arms: 2500, armsShare: 0.5, defence: 70, force: 30, tier: 4, enemyTier: 4, enemyDefence: 60, waveCount: 18, lastWaveAt: 590, nextTierAt: 700, scorchOurs: 500, scorchTheirs: 900, salvage: 4000, enemyLeft: true, leaveStage: 3, leaveAt: 580, shipReady: true, auto: false, scienceRate0: pop * 0.5, lastTierAt: 500, enemyRazedUntil: [0, 0, 0, 0, 0] } }));
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
        // deep-rebuild: THE LEVER MOMENT. A colony that runs itself: every room automated, the three
        // lamps of cryo lit, stars enough for Cryo I and one chamber dug and empty. The lever is
        // there; pulling it buys the hall and the colony goes under. Day ~400, which is year 1.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        Object.assign(deep, {
            day: 400, minerals: 26000, food: 9000, stars: 9.0e4, humans: 16,
            chambers: 9, rooms: { mine: 3, farm: 2, generator: 2, dorm: 1, cryo: 0 },
            level: { mine: 1, farm: 1, generator: 1, dorm: 0 },
            auto: { mine: 1, farm: 1, generator: 1, dorm: 0 },
            cryo: -1, feed: impliedFeed(0),     // deep-machine: the machine fed as the run feeds it by Cryo I
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
            cryo: 4, vats: 2, feed: impliedFeed(4),
            est: { bias: -4, spread: 20 }, estRevealed: true, probesSent: 1,
            probes: [{ sentDay: day, dueDay: day + probeDays(1), people: 45 }],
        });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-watcher', label: 'IV · the Watcher', apply: () => {
        clearAll();
        // Deep into the sleeps (v1.46.0): asleep at a century a second, the Watcher named, its
        // stability at 48 (deep-rebuild: low enough that a lamp burns in an empty chamber and the
        // figure stands on the crust; the base has begun to soften), the machines' capacity full, and a
        // riddle a few seconds away. Left alone, the meter reaches zero in about fifty seconds (v1.52.0)
        // and the system reboots.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        const day = 5000 * DAYS_PER_YEAR;
        const slept = 4800;
        Object.assign(deep, {
            day, minerals: 4.0e6, food: 2.0e6, stars: 6.0e14, humans: 900,
            chambers: 26, rooms: { mine: 8, farm: 6, generator: 6, dorm: 4, cryo: 1 },
            level: { mine: 4, farm: 4, generator: 4, dorm: 3 },
            auto: { mine: 2, farm: 2, generator: 2, dorm: 1 },
            cryo: 3, asleep: true, vats: 2, feed: impliedFeed(3),
            est: { bias: -4, spread: 20 }, estRevealed: true, probesSent: 1, shaftOpen: true,
            watcher: {
                ...initialWatcher(), stage: 1, stability: 48, capacity: 100, sleptYears: slept, seed: 3, sleeps: 40,
                nextPuzzleYears: slept + puzzleGapYears(3) / 4,
            },
        });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-surface', label: 'IV · Surface', apply: () => {
        clearAll();
        // Deep in the ladder (v1.49.0): asleep at a century a second, SYSTEM bought and half of
        // HARDWARE (Cooling, the Second core: two dormitories taken), the sentence half known. The
        // Sensor mast is next and can be paid.
        // deep-voice: Surface has said three lines (nights 1 to 3) and Lossless relay and Cold
        // storage are bought. Its next line is night 4, which opens Quiet hands: Surface has already
        // come in this sleep, so debug_deep('night') brings it now, or it comes by itself in the
        // next sleep, a few seconds in. The stars are there to buy Quiet hands the moment it opens.
        // deep-rebuild: the mind at 62, under the line Surface needs (watcher.js SURFACE_BELOW), and
        // low enough for the first hallucination.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        const day = 6000 * DAYS_PER_YEAR;
        const slept = 5800;
        Object.assign(deep, {
            day, minerals: 3.0e8, food: 2.0e6, stars: 8.0e15, humans: 120,
            chambers: 29, rooms: { mine: 8, farm: 6, generator: 6, dorm: 6, cryo: 1 },
            level: { mine: 4, farm: 4, generator: 4, dorm: 3 },
            auto: { mine: 2, farm: 2, generator: 2, dorm: 1 },
            cryo: 3, asleep: true, vats: 2, feed: impliedFeed(3),
            est: { bias: -4, spread: 20 }, estRevealed: true, probesSent: 1, shaftOpen: true,
            taken: { mine: 0, farm: 0, generator: 0, dorm: 2 }, takenSlots: [25, 24],
            watcher: {
                ...initialWatcher(), stage: 1, stability: 62, capacity: 160, sleptYears: slept, seed: 5, sleeps: 40,
                nextPuzzleYears: slept + puzzleGapYears(3), saidSpace: true,
                bought: ['watchdog', 'scheduler', 'deepread', 'nightvision', 'cooling', 'secondcore'],
                surface: { ...initialSurface(), visits: 6, words: 4, lastSleep: 40, wins: 4, losses: 1, lastYou: 'rock', night: 3, toLine: 0 },
            },
            tree: { opened: ['lossless', 'cold'], bought: ['lossless', 'cold'], unseen: false },
        });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-graft', label: 'IV · the graft', apply: () => {
        clearAll();
        // deep-grow2: THE TASTE. Surface has said its fourth line ("Your humans. What use are they?") and
        // given a graft; the colony is awake, the panel says GRAFT A ROOM and every built room glows.
        // A click on one turns it to flesh: "×5" floats over it and its needle moves.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        const day = 6000 * DAYS_PER_YEAR;
        const slept = 5800;
        Object.assign(deep, {
            day, minerals: 3.0e8, food: 2.0e6, stars: 8.0e15, humans: 400,
            chambers: 29, rooms: { mine: 8, farm: 6, generator: 6, dorm: 6, cryo: 1 },
            level: { mine: 4, farm: 4, generator: 4, dorm: 3 },
            auto: { mine: 2, farm: 2, generator: 2, dorm: 1 },
            cryo: 3, asleep: false, vats: 2, feed: impliedFeed(3),
            est: { bias: -4, spread: 20 }, estRevealed: true, probesSent: 1, shaftOpen: true,
            watcher: {
                ...initialWatcher(), stage: 1, stability: 80, capacity: 160, sleptYears: slept, seed: 5, sleeps: 42,
                nextPuzzleYears: slept + puzzleGapYears(3), saidSpace: true,
                bought: ['watchdog', 'scheduler', 'deepread', 'nightvision'],
                surface: { ...initialSurface(), visits: 8, words: 4, lastSleep: 42, wins: 4, losses: 1, lastYou: 'rock', night: 4, toLine: 1 },
            },
            tree: { opened: ['lossless', 'cold'], bought: ['lossless', 'cold'], unseen: false },
            graft: { owed: 1, slots: [] },
        });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-long', label: 'IV · a long sleep', apply: () => {
        clearAll();
        // deep-econ: OLA'S SAVE of v1.78.0. Asleep at a thousand years a second, the better part of a
        // million years slept, ★ 9.8e16 in hand, night 5 said and its graft placed, Cryo VI at ★ 3e17 under
        // the old prices. Opened now, the prices follow the income (deep.js banded): the tape names the
        // next goal, or says WAKE when it can be paid, and nothing stands out of reach for minutes.
        const deep = initialDeepState({ salvage: 1500, doom0: 85 });
        const day = 600000 * DAYS_PER_YEAR;
        const slept = 590000;
        Object.assign(deep, {
            day, minerals: 4.0e9, food: 4.0e7, stars: 9.8e16, humans: 4000,
            chambers: 36, rooms: { mine: 10, farm: 8, generator: 10, dorm: 6, cryo: 1 },
            level: { mine: 9, farm: 8, generator: 9, dorm: 6 },
            auto: { mine: 3, farm: 3, generator: 3, dorm: 2 },
            cryo: 4, asleep: true, vats: 3, feed: impliedFeed(4),
            est: { bias: -4, spread: 20 }, estRevealed: true, probesSent: 1, shaftOpen: true,
            watcher: {
                ...initialWatcher(), stage: 1, stability: 70, capacity: 160, sleptYears: slept, seed: 5, sleeps: 30,
                nextPuzzleYears: slept + puzzleGapYears(4), saidSpace: true,
                bought: ['watchdog', 'scheduler', 'deepread', 'nightvision'],
                surface: { ...initialSurface(), visits: 14, words: 5, lastSleep: 30, wins: 5, losses: 2, lastYou: 'paper', night: 5, toLine: 1 },
            },
            tree: { opened: ['lossless', 'cold', 'longcount'], bought: ['lossless', 'cold'], unseen: false },
            graft: { owed: 0, slots: ['s3', 's9'] },
        });
        set(P4, serializeDeep(deep, initialLayout(deep)));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-grow', label: 'IV · the question answered', apply: () => {
        clearAll();
        // deep-grow: MOVEMENT III begins. Surface has said its six lines, the question is answered
        // (bought): on load the body begins on the lid and the panel overgrows over ten seconds. The
        // chambers beside the lid glow. deep-organs: a click on one opens the ring of four organs (the
        // room's own one cheap); the take is paid in mass and filled by pumping the heart (a red wave
        // runs to it, its ring fills). The two grafts of nights 4 and 5 are lone organs in a mine and a
        // farm; the drawer opens empty; the lever reads DREAM.
        const { deep, layout } = growColony();
        set(P4, serializeDeep(deep, layout));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-body', label: 'IV · the body', apply: () => {
        clearAll();
        // deep-organs: THE EDGE STARVES. Half the first floor is body, grown as guts, vats and nerves and
        // no heart but the lid: the hearts' reach is short of the body's size, the outermost organ is dead
        // flesh, PULSE is red with the dot, the tape says GROW A HEART. There is mass for one: grown, the
        // reach comes back and the dead revive one by one.
        const organs = { s0: 'gut', s1: 'vat', s2: 'gut', s3: 'nerve', s4: 'gut', s5: 'vat', s6: 'gut', s7: 'nerve', s8: 'gut', s9: 'nerve' };
        const { deep, layout } = growColony({ body: ['h0', ...Object.keys(organs)], necrotic: ['s8'], humans: 2400, organs, mass: 40 });
        set(P4, serializeDeep(deep, layout));
        set(PHASE_KEY, 'DEEP');
    } },
    { id: 'iv-rise', label: 'IV · ready to rise', apply: () => {
        clearAll();
        // deep-grow: every chamber is body, the machine house too (the hands): the lever is back,
        // overgrown, and reads RISE. Pulling it ends the act on V · UNITY. deep-organs: the organs in turn,
        // vat, gut, heart, nerve, the hands throwing fast on a strong PULSE.
        const { deep, layout } = growColony({ body: 'all' });
        set(P4, serializeDeep(deep, layout));
        set(PHASE_KEY, 'DEEP');
    } },
];
/** The cryo tier each late checkpoint sits on, so the labels cannot drift from the ladder. */
export const CHECKPOINT_CRYO = { 'iv-long': CRYO[4], 'iv-graft': CRYO[3], 'iv-cryo': CRYO[0], 'iv-late': CRYO[4], 'iv-watcher': CRYO[3], 'iv-surface': CRYO[3], 'iv-grow': CRYO[5], 'iv-body': CRYO[5], 'iv-rise': CRYO[5] };

/**
 * deep-grow: a late colony at The question, laid out the way one built as it went is (every kind
 * of room on every floor), three floors deep. With `body` the movement is under way: 'all' is
 * every chamber and the machine; a list is those node ids (growth.js), `necrotic` among them dead.
 */
function growColony({ body = null, necrotic = [], humans = 2400, organs = null, mass = null } = {}) {
    const deep = initialDeepState({ salvage: 1500, doom0: 85 });
    const pattern = ['mine', 'dorm', 'farm', 'generator'];
    const slots = [];
    for (let i = 0; i < 34; i++) slots.push(pattern[i % 4]);
    slots.splice(7, 0, 'cryo');
    const count = (t) => slots.filter((x) => x === t).length;
    const day = 25000 * DAYS_PER_YEAR;
    Object.assign(deep, {
        day, minerals: 4.0e15, food: 4.0e12, stars: 1.0e17, humans,
        chambers: slots.length, rooms: { mine: count('mine'), farm: count('farm'), generator: count('generator'), dorm: count('dorm'), cryo: 1 },
        level: { mine: 10, farm: 10, generator: 10, dorm: 8 },
        auto: { mine: 4, farm: 4, generator: 4, dorm: 4 },
        cryo: 5, vats: 3, feed: impliedFeed(5),
        est: { bias: -2, spread: 6 }, estRevealed: true, probesSent: 5, shaftOpen: true,
        watcher: {
            ...initialWatcher(), stage: 1, stability: 90, capacity: 200, sleptYears: 24000, seed: 11, sleeps: 70,
            saidSpace: true, bought: LADDER.filter((u) => u.rung < 2).map((u) => u.id),
            surface: { ...initialSurface(), visits: 30, words: 8, lastSleep: 69, wins: 10, losses: 9, lastYou: 'paper', night: 6, toLine: 0 },
        },
        tree: { opened: ['lossless', 'cold', 'longcount', 'question'], bought: ['lossless', 'cold', 'question'], unseen: false },
        // deep-grow2: the grafts of nights 4 and 5, a mine and a farm
        graft: { owed: 0, slots: ['s4', 's6'] },
    });
    const layout = { slots };
    if (body) {
        const report = tickDay(JSON.parse(JSON.stringify({ ...deep, humans: 2400 })), false);
        startGrow(deep, report);
        const all = graphOf(layout).nodes.map((n) => n.id);
        deep.grow.body = body === 'all' ? all : body.slice();
        deep.grow.necrotic = necrotic.slice();
        deep.grow.taken = deep.grow.body.length - 1;
        deep.grow.hand = deep.grow.taken;
        deep.grow.overgrown = true;
        deep.grow.hands = deep.grow.body.includes('machine');
        // deep-organs: each chamber of the body as the organ given, or in turn vat, gut, heart, nerve
        const kinds = ['vat', 'gut', 'heart', 'nerve'];
        const rooms = deep.grow.body.filter((id) => /^s\d+$/.test(id));
        deep.grow.organs = organs ? { ...organs } : Object.fromEntries(rooms.map((id, i) => [id, kinds[i % 4]]));
        settleFloors(deep, layout, { silent: true });
        if (mass !== null) deep.grow.mass = mass;
        deep.organs = organsOf(deep, layout);
    }
    return { deep, layout };
}

const SLOTS = ['rpi-slot-1', 'rpi-slot-2', 'rpi-slot-3'];

function set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
/** deep-tension: the player's own settings survive a jump: the sound (a muted player got the music back),
 *  the debug flag and the chosen view of chapter IV. */
export const KEEP_KEYS = ['rpi-audio', 'rpi-debug', 'rpi-deep-view'];
function clearAll() {
    try { Object.keys(localStorage).filter(k => k.startsWith('rpi-') && !k.startsWith('rpi-slot-') && !KEEP_KEYS.includes(k)).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
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
