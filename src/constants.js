// Shared constants
export const PHASE_KEY = 'rpi-phase';

// Game Constants for Phase 1
export const PHASE1_CONSTANTS = {
    MAX_ENERGY: 100,
    MAX_RESERVE_ENERGY: 1500,
    // Foam fills by games played once the factory runs (~360 games/s at max):
    // a collapse roughly every minute, worth FOAM_BONUS_SECONDS of production.
    MAX_QUANTUM_FOAM: 20000,
    FOAM_BONUS_SECONDS: 30,
    HYPER_SPEED_THRESHOLD: 10,
    // Bank (→ chapter II) opens after the factory has run for a while.
    BANK_GATE_STARS: 250000,
    SAVE_KEY: 'rpi-save',
};

// Game Constants for Phase 2
export const PHASE2_CONSTANTS = {
    SAVE_KEY: 'rpi-stage2',
    STARS_TRANSFER_KEY: 'rpi-stars',
};
