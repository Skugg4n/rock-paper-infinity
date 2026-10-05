/**
 * Chapter IV, the vault: the states the test menu jumps to (src/checkpoints.js iv-vault-*).
 * Pure: each returns a fresh state built through the rules' own constructors.
 */
import { newVault, slotIndex, mood, START_RESIDENTS, PODS_PER_LEVEL, TURN_DAY } from './vault.js';

function put(s, i, kind, extra = {}) {
    Object.assign(s.rooms[i], { kind, lvl: 1, job: null, broken: false, flesh: 0, born: s.day, ...extra });
}
/** The palace as a decent player has it by the turn: six rooms of fun, a second mine, more beds. */
function palace(s) {
    s.introDone = true;
    s.day = TURN_DAY - 1;
    put(s, slotIndex(0, 5), 'suites', { name: 'Suites C', born: 10 });
    put(s, slotIndex(0, 6), 'cinema', { born: 60 });
    put(s, slotIndex(0, 7), 'bar', { born: 50 });
    put(s, slotIndex(1, 1), 'gym', { born: 70, lvl: 2 });
    put(s, slotIndex(1, 2), 'garden', { born: 80 });
    put(s, slotIndex(1, 3), 'game', { born: 75 });
    put(s, slotIndex(1, 4), 'cinema', { born: 90 });
    put(s, slotIndex(1, 5), 'mine', { born: 40 });
    s.rooms[1].lvl = 2;          // the engine
    s.rooms[slotIndex(1, 0)].lvl = 2;
    s.suitesBuilt = 3;
    s.residents = START_RESIDENTS + 12;
    s.reqIdx = 8;
    s.nextRequestDay = s.day + 1;
    s.ore = 260;
    s.out = [];
    s.bored = { cinema1: true, bar1: true };
    return s;
}

export const VAULT_CHECKPOINTS = {
    'iv-vault-start': () => newVault(),
    'iv-vault-turn': () => {
        const s = palace(newVault());
        // Mood 50 %: what the days under the rock have taken
        s.favour = 0;
        s.favour = 50 - mood(s);
        return s;
    },
    'iv-vault-cold': () => {
        const s = palace(newVault());
        s.day = 120; s.turned = true; s.coldOpen = true; s.despair = 0;
        put(s, slotIndex(1, 6), 'cryo', { lvl: 3 });
        s.asleep = 100;
        s.favour = 25;
        s.ore = 400;
        return s;
    },
    'iv-vault-night': () => {
        const s = palace(newVault());
        s.day = 150; s.turned = true; s.coldOpen = true; s.despair = 50;
        put(s, slotIndex(1, 6), 'cryo', { lvl: 2 });
        put(s, slotIndex(1, 7), 'cryo', { lvl: 2 });
        s.rooms[1].lvl = 3;
        s.asleep = s.residents = Math.min(s.residents, 4 * PODS_PER_LEVEL);
        s.phase = 'night'; s.year = 1; s.nightSec = 0; s.request = null; s.nextNightLineAt = 1;
        s.ore = 300;
        return s;
    },
    'iv-vault-flesh': () => {
        const s = VAULT_CHECKPOINTS['iv-vault-night']();
        s.year = 300; s.nightSec = 120; s.nightLine = 5; s.nextNightLineAt = 125; s.engineWear = 6;
        put(s, slotIndex(2, 0), 'vat'); s.rooms[slotIndex(2, 0)].flesh = 1;
        put(s, slotIndex(2, 1), 'vat'); s.rooms[slotIndex(2, 1)].flesh = 1;
        s.rooms[slotIndex(2, 2)].flesh = 1;     // rock the body has taken
        s.grown = 1;
        s.reclaimed = 3; s.dead = 3; s.residents -= 3; s.asleep -= 3; s.fallenCount = 3;
        s.bio = 90;
        s.ore = 160;
        return s;
    },
};
