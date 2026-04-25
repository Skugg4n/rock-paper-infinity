export const SCHEMA_VERSION = 1;

export function serializeGameState(state, upgrades) {
    const data = {
        schemaVersion: SCHEMA_VERSION,
        starBalance: state.starBalance,
        totalStarsEarned: state.totalStarsEarned,
        totalGamesPlayed: state.totalGamesPlayed,
        totalWins: state.totalWins,
        energy: state.energy,
        reserveEnergy: state.reserveEnergy,
        gameSpeed: state.gameSpeed,
        starMultiplier: state.starMultiplier,
        quantumFoam: state.quantumFoam,
        isMetaBoardActive: state.isMetaBoardActive,
        autoPlayWantsToRun: state.autoPlayWantsToRun,
        gameBoards: state.gameBoardsCount,
        upgrades: {},
    };
    for (const key in upgrades) {
        const u = upgrades[key];
        data.upgrades[key] = { level: u.level, purchased: u.purchased };
    }
    return JSON.stringify(data);
}

export function deserializeGameState(raw) {
    if (!raw) return null;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (parsed == null || typeof parsed !== 'object') return null;
    const version = parsed.schemaVersion ?? 1; // missing = legacy v1
    if (version > SCHEMA_VERSION) return null;
    return parsed;
}

export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn('persistence: setItem failed', e?.name ?? e);
        return false;
    }
}

export function loadFromStorage(key) {
    let raw;
    try {
        raw = localStorage.getItem(key);
    } catch {
        return null;
    }
    return deserializeGameState(raw);
}
