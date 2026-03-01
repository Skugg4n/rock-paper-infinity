export function serializeGameState(state, upgrades) {
    const data = {
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
        upgrades: {}
    };
    for (const key in upgrades) {
        const u = upgrades[key];
        data.upgrades[key] = {
            level: u.level,
            purchased: u.purchased
        };
    }
    return JSON.stringify(data);
}

export function deserializeGameState(raw) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
