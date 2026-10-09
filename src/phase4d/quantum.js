/**
 * Chapter IV · THE DEEP, the dig, pass 3 (spec 2026-10-09 E): things from the other side. Pure.
 * Not artefacts: objects from a parallel reality that leak into the rock. One a layer, a flickering
 * tile. Carried home (outside the cargo) and laid in the LAB, which takes 60 s to open it; the next
 * time the drone is at the base the lab says what it was, and a big upgrade is the drone's.
 *
 * The order is shuffled by the seed, but BOOSTER or SHOCK WAVE comes first (they feel the most).
 * State in s.quantum: { carry: [tile index], labQ: n, lab: seconds | null, ready: [id], got: [id] (opened),
 * fit: [id] (fitted in the workshop: only these work), order: [id], cool: {id: time}, boostUntil }.
 */
import { rng } from './world.js';

export const QUANTUM_IDS = ['booster', 'teleport', 'shock', 'lamp2', 'deepbat', 'other'];
export const Q_NAME = { booster: 'BOOSTER', teleport: 'TELEPORT', shock: 'SHOCK WAVE', lamp2: 'SECOND LAMP', deepbat: 'DEEP BATTERY', other: 'THE OTHER DRONE' };
/** The keys and the panel's buttons: the ones you use. */
export const Q_KEY = { booster: 'B', teleport: 'T', shock: 'Q' };
export const LAB_S = 60;
export const COOL = { booster: 30, teleport: 90, shock: 8 };
export const BOOST_S = 5;
export const SHOCK_R = 2;
export const SHOCK_COST = 3;
export const DEEP_FROM = 1200;          // metres: below, the DEEP BATTERY charges from the heat
export const DEEP_RATE = 0.5;           // a second

/** Player text, verbatim where the spec gives it. */
export const Q_LINES = {
    picked: 'It flickers. Take it to the LAB.',
    opened: (id) => (id === 'other' ? 'The lab opened it. It was a drone.' : `The lab opened it. It was a ${Q_NAME[id]}.`),
    use: {
        booster: 'Double speed for 5 s, half the power. Key B.',
        teleport: 'Home to the base at once. Key T.',
        shock: 'Eats the ground two tiles round. Key Q.',
        lamp2: 'The lamp shines two ways now.',
        deepbat: 'Below 1 200 m the heat charges the battery.',
        other: 'It is us. It is not us.',
    },
    bio: 'This is not rock. It is growing in the tank.',
    warm: 'The rock is warm. Warm like skin. We should not be here.',
};

/** The order the lab finds them in: shuffled, BOOSTER or SHOCK WAVE first, THE OTHER DRONE never first. */
export function qOrder(seed) {
    const r = rng(seed * 977 + 13);
    const rest = QUANTUM_IDS.slice();
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const first = r() < 0.5 ? 'booster' : 'shock';
    return [first, ...rest.filter((id) => id !== first)];
}
export function newQuantum(seed) {
    return { carry: [], labQ: 0, lab: null, ready: [], got: [], fit: [], order: qOrder(seed), cool: {}, boostUntil: -1 };
}
/** The drone has it: opened by the lab and fitted in the workshop. */
export const has = (s, id) => !!(s.quantum && (s.quantum.fit || s.quantum.got).includes(id));
export const coolLeft = (s, id) => (has(s, id) ? Math.max(0, (s.quantum.cool[id] ?? -1e9) + COOL[id] - s.time) : Infinity);
export const boosting = (s) => !!(s.quantum && s.time < s.quantum.boostUntil);

/** Each tick: the lab works on what it has (game time, wherever the drone is). */
export function stepLab(s, dt) {
    const q = s.quantum;
    if (!q) return null;
    if (q.lab === null && q.labQ > 0) { q.labQ--; q.lab = 0; }
    if (q.lab === null) return null;
    q.lab += dt;
    if (q.lab < LAB_S) return null;
    q.lab = null;
    const id = q.order[q.got.length + q.ready.length];
    if (id) q.ready.push(id);
    return id || null;
}
