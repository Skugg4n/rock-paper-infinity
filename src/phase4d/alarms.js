/**
 * Chapter IV · THE DEEP, the dig, pass 3 (spec 2026-10-09 D): the base breaks while the drone is away.
 * Pure. A chamber or the generator starts to fail (a red lamp at the base); the drone must come home
 * and stand under it for two seconds, which costs parts. Missed: the chamber goes dark and ten sleepers
 * in it die, or the generator stops and POWER does not charge at home until it is mended.
 *
 * The first failure comes after about three minutes, then every two to five, closer together the
 * deeper the drone has been. The time to answer grows with the depth, so a careful player keeps up.
 * Without the SHORT WAVE RADIO the player hears of it only at home; with it, anywhere, with time left.
 *
 * State in s.alarms: { next, list: [{ id, at, until }], n, genDown, repair: { id, t } | null, unseen: [] }.
 */
import { ROOMS, CHAMBERS, PER_CHAMBER, chamberOver, roomAt } from './base.js';

export const FIRST_FAIL = 180;
export const FAIL_MIN = 120, FAIL_MAX = 300;
export const REPAIR_S = 2;
export const KILL = 10;
/** Seconds to answer a failure, by the deepest the drone has been (metres). */
export const failWindow = (m) => Math.round(75 + 0.03 * m);
/** Parts a repair costs, by the deepest the drone has been. */
export const repairCost = (m) => 10 + Math.round(m / 20);
/** The next failure after this one, seconds: two to five minutes, closer together deep down. */
export const failGap = (u, m) => (FAIL_MIN + (FAIL_MAX - FAIL_MIN) * u) * (1 - 0.35 * Math.min(1, m / 1500));

export const ALARM_LINES = {
    first: 'A chamber is failing. Return to base and repair it.',
    firstHere: 'A chamber is failing. Drive to it and repair it.',
    away: (k) => `While you were gone: chamber ${k + 1} went dark. ${KILL} died.`,
    genAway: 'While you were gone: the generator stopped.',
    mended: (id) => (id === 'gen' ? 'The generator is mended.' : `Chamber ${Number(id.slice(1)) + 1} is mended.`),
    tag: (id, secs, cost) => `${nameOf(id)} · ${Math.max(0, Math.ceil(secs))} s${cost ? ` · ${cost} PARTS` : ''}`,
    dark: (k) => `Chamber ${k + 1} went dark. ${KILL} sleepers died.`,
    genStop: 'The generator stopped. POWER does not charge.',
    short: (n) => `Repair needs ${n} PARTS.`,
};
export const nameOf = (id) => (id === 'gen' ? 'GENERATOR' : `CHAMBER ${Number(id.slice(1)) + 1}`);

export function newAlarms(time = 0) {
    return { next: time + FIRST_FAIL, list: [], n: 0, genDown: false, repair: null, unseen: [], lost: 0 };
}

/** The corridor tiles a failure is mended from: under its chamber, or in the generator room. */
export function spanOf(id) {
    if (id === 'gen') return ROOMS.generator;
    const [a, b] = CHAMBERS[Number(id.slice(1))];
    return [Math.ceil(a - 0.5), Math.floor(b - 0.5)];
}
/** The failure (or the stopped generator) the drone at corridor tile x stands under, or null. */
export function failureAt(al, x) {
    const k = chamberOver(x);
    if (k >= 0) { const f = al.list.find((q) => q.id === `c${k}`); if (f) return f.id; }
    if (roomAt(x) === 'generator' && (al.genDown || al.list.some((q) => q.id === 'gen'))) return 'gen';
    return null;
}
/** The spot to drive to for a failure: the middle of its span. */
export const spotOf = (id) => { const [a, b] = spanOf(id); return Math.round((a + b) / 2); };

/** A pseudo-random number from the game's own seed and the failure count, so a run is the same each time. */
function rnd(s, k) {
    let h = (s.seed * 2654435761 + (s.alarms.n + 1) * 40503 + k * 97) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
}

/**
 * Each tick. `io`: { home, recordM, radio, say(text, kind), event(e), alive(pod) }.
 * Returns nothing; changes s.alarms, s.dark, s.parts.
 */
export function stepAlarms(s, dt, io) {
    const al = s.alarms;
    // a new failure
    if (s.time >= al.next) {
        const free = [0, 1, 2, 3, 4, 5].filter((k) => !al.list.some((q) => q.id === `c${k}`) && chamberAlive(s, k, io) > 0);
        let id = null;
        const genFree = !al.genDown && !al.list.some((q) => q.id === 'gen');
        if (al.n > 0 && genFree && rnd(s, 1) < 0.22) id = 'gen';
        else if (free.length) id = `c${free[Math.floor(rnd(s, 2) * free.length)]}`;
        if (id) {
            // the price is set when the alarm starts: it does not creep up while the drone is away
            al.list.push({ id, at: s.time, until: s.time + failWindow(io.recordM) * (al.n === 0 ? 1.5 : 1), cost: repairCost(io.recordM) });
            io.event({ type: 'fail', id });
        }
        al.n++;
        al.next = s.time + failGap(rnd(s, 3), io.recordM);
    }
    // missed
    for (let i = al.list.length - 1; i >= 0; i--) {
        const f = al.list[i];
        if (s.time < f.until) continue;
        al.list.splice(i, 1);
        if (al.repair && al.repair.id === f.id) al.repair = null;
        const heard = io.home || io.radio;
        if (f.id === 'gen') {
            al.genDown = true;
            al.genCost = f.cost;
            io.event({ type: 'gen-stop' });
            if (heard) io.say(ALARM_LINES.genStop, 'alarm');
            else al.unseen.push({ text: ALARM_LINES.genAway, died: false });
        } else {
            const k = Number(f.id.slice(1));
            let n = 0;
            for (let p = k * PER_CHAMBER + 1; p <= (k + 1) * PER_CHAMBER && n < KILL; p++) if (io.alive(p)) { s.dark.push(p); n++; }
            al.lost += n;
            io.event({ type: 'chamber-dark', k, n });
            // people died: said at once when it is heard (a stop the first time), else when the drone is home
            if (heard) io.died(ALARM_LINES.dark(k));
            else al.unseen.push({ text: ALARM_LINES.away(k), died: true });
        }
    }
    // mending: the drone stands under it, at home, still
    const here = io.home && !s.act ? failureAt(al, s.x) : null;
    if (!here) { al.repair = null; return; }
    const f = al.list.find((q) => q.id === here);
    const cost = f ? (f.cost ?? repairCost(io.recordM)) : (al.genCost ?? repairCost(io.recordM));
    if (s.parts < cost) { al.repair = null; io.say(ALARM_LINES.short(cost), 'gate'); return; }
    if (!al.repair || al.repair.id !== here) al.repair = { id: here, t: 0 };
    al.repair.t += dt;
    if (al.repair.t >= REPAIR_S) {
        s.parts -= cost;
        al.list = al.list.filter((q) => q.id !== here);
        if (here === 'gen') { al.genDown = false; al.genCost = null; }
        al.repair = null;
        io.event({ type: 'repaired', id: here });
        io.say(ALARM_LINES.mended(here), 'line');
    }
}
function chamberAlive(s, k, io) {
    let n = 0;
    for (let p = k * PER_CHAMBER + 1; p <= (k + 1) * PER_CHAMBER; p++) if (io.alive(p)) n++;
    return n;
}
/** What mending this failure costs: the price set when its alarm started. */
export const costOf = (al, id, recordM) => {
    const f = al.list.find((q) => q.id === id);
    return f ? (f.cost ?? repairCost(recordM)) : (al.genCost ?? repairCost(recordM));
};
/** The failure closest to its end, or null: what the panel's alarm row shows. */
export function worstAlarm(s) {
    const al = s.alarms;
    if (!al || !al.list.length) return null;
    return al.list.reduce((a, b) => (b.until < a.until ? b : a));
}
