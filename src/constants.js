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
    // Bank (→ chapter II) opens after the foam has been collapsed this many times.
    BANK_GATE_COLLAPSES: 2,
    SAVE_KEY: 'rpi-save',
};

// Game Constants for Phase 2
export const PHASE2_CONSTANTS = {
    SAVE_KEY: 'rpi-stage2',
    STARS_TRANSFER_KEY: 'rpi-stars',
    // The competitor appears far off, grows in stages, and only then the
    // chapter turns. Population thresholds (see vision.md, chapter III).
    COMPETITOR_POP: 40000,
    COMPETITOR_STAGE2_POP: 100000,
    COMPETITOR_STAGE3_POP: 175000,
    WAR_POP: 250000,
    // A district fills over ~200 s, so the endgame is a climb, not a dump.
    DISTRICT_GROWTH_PER_SEC: 500,
};

// Game Constants for Phase 4 (chapter IV · THE DEEP)
export const PHASE4_CONSTANTS = {
    SAVE_KEY: 'rpi-deep',
    // One real second is one colony day. Away from the tab, at most this many
    // days are caught up on return: no offline progress, just no lost second.
    MAX_CATCHUP_DAYS: 3,
    // The crowd on the plates is the colony, not a census: past this many
    // people the dots stop multiplying (see scene.js MAX_DOTS).
    DOT_CAP: 160,
};

// Debug menus: ?debug in the URL, or the toggle in the ☰ menu (persisted).
export const DEBUG_KEY = 'rpi-debug';
