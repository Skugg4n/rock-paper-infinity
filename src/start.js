/**
 * The start screen (B456, docs/superpowers/specs/2026-10-12-start-screen-design.md): the cycle
 * with the hole, the title typed out, CONTINUE or START, NEW GAME, the acts reached as a list,
 * sound and music, the credit. The pure half (the table, the model, the words) is tested; the
 * screen is built from JS on document.body (style-start.css), like the interim, and removed
 * with lift(). main.js shows it first and acts on the choice.
 */
import { PHASE_KEY, PHASE2_CONSTANTS } from './constants.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';
import { reachedSet } from './reached.js';
import { audio } from './audio.js';

// ---------------------------------------------------------------- the table and the words (tested)

/** The acts in order: the checkpoint an act starts again from, the phase it runs in. */
export const ACTS = [
    { id: 'trivial', roman: 'I', name: 'Trivial', checkpoint: 'i-start' },
    { id: 'capital', roman: 'II', name: 'Capital', checkpoint: 'ii-start' },
    { id: 'war', roman: 'III', name: 'War', checkpoint: 'iii-start' },
    { id: 'drone', roman: 'IV', name: 'Deep · Drone', checkpoint: 'iv-dig-start' },
    { id: 'vault', roman: 'IV', name: 'Deep · Vault', checkpoint: 'iv-vault-start' },
    { id: 'unity', roman: 'V', name: 'Unity', checkpoint: 'v-start' },
    { id: 'infinity', roman: 'VI', name: 'Infinity', checkpoint: null },
];

/** The chapter card an act opens with, as the game plays it on the way (phase1, phase2, interim, phase4). */
export const CARD_OF = {
    trivial: { roman: 'I', title: 'TRIVIAL' },
    capital: { roman: 'II', title: 'CAPITAL', slow: true, pause: 1400, hold: 2400 },
    war: { roman: 'III', title: 'WAR', dark: true, slow: true, pause: 1400, hold: 5000 },
    drone: { roman: 'IV', title: 'DEEP', dark: true, slow: true, hold: 5000 },
    vault: { roman: 'IV', title: 'DEEP', dark: true, slow: true, hold: 5000 },
    unity: { roman: 'V', title: 'UNITY', dark: true, hold: 2200 },
};

export const WORDS = {
    title: 'ROCK PAPER INFINITY',
    continue: 'CONTINUE',
    start: 'START',
    newGame: 'New game',
    erase: 'Your game will be erased.',
    startOver: 'Start over',
    keep: 'Keep',
    replaces: (label) => `Starting ${label} again replaces your game.`,
    playAgain: 'Play again',
    by: 'A game by Ola Belin',
    sound: 'Sound',
    music: 'Music',
};

function get(storage, k) { try { return storage?.getItem(k) ?? null; } catch { return null; } }
function defaultStorage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }

/** Where the game is, from the phase and the saves: the act's id and the line under CONTINUE. */
export function whereIs(storage = defaultStorage()) {
    const phase = get(storage, PHASE_KEY);
    if (!phase) return null;
    if (phase === 'INDUSTRY') return { id: 'trivial', label: 'I · Trivial' };
    if (phase === 'CITY' || phase === 'WAR') {
        let c = null;
        try { c = JSON.parse(get(storage, PHASE2_CONSTANTS.SAVE_KEY) || 'null'); } catch { /* ignore */ }
        if (c?.interimPending) return { id: 'war', label: 'The fork' };
        if (c?.war || phase === 'WAR') return { id: 'war', label: 'III · War' };
        return { id: 'capital', label: 'II · Capital' };
    }
    if (phase === 'DEEP') {
        const v = get(storage, DEEP_VERSION_KEY);
        if (v === 'dig') return { id: 'drone', label: 'IV · Deep, the drone' };
        if (v === 'vault') return { id: 'vault', label: 'IV · Deep, the vault' };
        return { id: null, label: 'IV · Deep' };
    }
    if (phase === 'UNITY') return { id: 'unity', label: 'V · Unity' };
    return { id: null, label: '' };
}

/** What the screen shows: fresh (START only), what CONTINUE goes to, and the rows. */
export function startModel(storage = defaultStorage()) {
    const reached = reachedSet(storage);
    const here = whereIs(storage);
    const ivSeen = reached.has('drone') || reached.has('vault');
    const acts = [];
    for (const a of ACTS) {
        const seen = reached.has(a.id);
        const isIv = a.id === 'drone' || a.id === 'vault';
        if (!seen && !(isIv && ivSeen)) continue;
        const state = here && here.id === a.id ? 'now' : seen && a.checkpoint ? 'reached' : 'grey';
        acts.push({ id: a.id, roman: a.roman, name: a.name, state });
    }
    return { fresh: !here, continueTo: here ? { phase: get(storage, PHASE_KEY), label: here.label } : null, acts };
}
