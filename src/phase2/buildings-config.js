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
export const buildingData = {
    home:                 { cost: 10000,    capacity: 10 },
    store:                { cost: 30000,    upkeep: 20,  supply: 20 },
    apartment:            { cost: 50000,    capacity: 50 },
    skyscraper:           { cost: 250000,   capacity: 500 },
    district:             { cost: 10000000, capacity: 100000 },
    superStore:           { cost: 200000,   upkeep: 50,  supply: 60 },
    gmoUpgrade:           { baseCost: 10000,   scienceCost: 1000 },
    toolCaseUpgrade:      { cost: 500000,   scienceCost: 5000 },
    urbanismResearch:     { cost: 250000,   scienceCost: 25000 },
    carUpgrade:           { cost: 1000000,  scienceCost: 100000 },
    computerUpgrade:      { cost: 5000000,  scienceCost: 100000 },
    megastructureResearch:{ cost: 1000000,  scienceCost: 100000 },
    landExpansion:        { cost: 1000000 },
    superconductor:       { baseCost: 5000, maxLevel: 5 },
    landExpansion2:       { cost: 10000000 },
};
