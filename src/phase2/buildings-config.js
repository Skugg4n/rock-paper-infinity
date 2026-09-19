/**
 * Phase 2 building & upgrade cost / capacity configuration.
 *
 * Pure data — no DOM refs, no game-state closures.
 * Import this object wherever building costs, capacities, or upgrade
 * parameters need to be read.
 *
 * Each entry is keyed by building/upgrade type. Fields vary by type:
 * - `cost` — star cost to build or purchase
 * - `capacity` — max population (residential buildings)
 * - `supply` — supply units produced per second (stores)
 * - `upkeep` — star drain per second (stores)
 * - `baseCost` — base cost for multi-level upgrades (scaled per level)
 * - `scienceCost` — science cost for research upgrades
 * - `maxLevel` — max purchase level (multi-level upgrades)
 *
 * @type {Object.<string, {cost?: number, capacity?: number, supply?: number, upkeep?: number, baseCost?: number, scienceCost?: number, maxLevel?: number}>}
 */
// Cascade pass (v1.25.0, simulated in scripts/sim-phase2.mjs): the multipliers
// (tool case ×2, car ×5, computer ×11, superconductor ×2) are the hills; the
// buildings are priced so that right after a multiplier several of them become
// affordable at once. Income is per person (×10 base) so the multipliers are felt;
// the carried-over factory is only a starter engine.
export const buildingData = {
    home:                 { cost: 6000,     capacity: 10 },
    store:                { cost: 20000,    upkeep: 20,  supply: 20 },
    apartment:            { cost: 25000,    capacity: 50 },
    skyscraper:           { cost: 150000,   capacity: 500 },
    district:             { cost: 8000000,  capacity: 100000 },
    superStore:           { cost: 120000,   upkeep: 50,  supply: 60 },
    gmoUpgrade:           { baseCost: 10000,   scienceCost: 1000 },
    toolCaseUpgrade:      { cost: 100000,   scienceCost: 3000 },
    urbanismResearch:     { cost: 150000,   scienceCost: 25000 },
    carUpgrade:           { cost: 600000,   scienceCost: 30000 },
    computerUpgrade:      { cost: 4000000,  scienceCost: 100000 },
    megastructureResearch:{ cost: 800000,   scienceCost: 100000 },
    landExpansion:        { cost: 500000 },
    superconductor:       { baseCost: 20000000, maxLevel: 5 },
    landExpansion2:       { cost: 5000000 },
    // Income model (read by index.js and the simulation)
    factoryIncome:        { income: 200 },
    person:               { income: 10 },
};
