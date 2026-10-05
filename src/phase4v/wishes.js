/**
 * Chapter IV, the vault: PLUPPAR, the small wishes (spec, section "Pluppar"). The residents are
 * obnoxious: speech bubbles with an icon pop up over rooms; a click pops one (+2 % mood, shown
 * floating), a missed one bursts grey (-2 %). Four or more of one icon at once is a WAVE: the CRT
 * says it once, the card it points to is marked, building that thing ends the wave with a big bump.
 * After the turn they come faster, two or three at once, ruder. The asleep make none. In the night
 * they still come, faint, over the pods; nobody is awake to want anything. The woken (TAKE ONE, WAKE)
 * make real ones in the night, rude only.
 *
 * Real seconds (not game days): a bubble lives ~10 s at ▶ and at ▶▶ alike. Pure; state in s.wishes.
 */
import { computerSays } from './story.js';

export const LIFE_S = 10;
export const EVERY_S = [6, 8];           // act I: one every 6 to 8 s
export const EVERY_TURNED_S = [3, 4.5];  // after the turn, and two or three at once
export const GHOST_EVERY_S = 4;
export const WAVE_AT = 4;
export const WAVE_EVERY_S = 70;
export const WAVE_BUMP = 10;
export const POP_MOOD = 2;
export const MISS_MOOD = 2;

/** The icons, what they say on hover, where they float, what a wave of them asks for. */
export const ICONS = {
    drink: { text: 'Drink to room {n}.', at: ['suites'], wave: { line: 'Overwhelming wishes for a better bar.', kind: 'bar' } },
    hand: { text: 'Human #{n} wants a backrub.', at: ['suites', 'common', 'gym'], wave: { line: 'Overwhelming wishes for a spa. A gym at level 3 has one.', kind: 'gym' } },
    food: { text: 'Room {n} wants breakfast in bed.', at: ['suites'], wave: { line: 'Overwhelming wishes for fresh fruit.', kind: 'hydro' } },
    music: { text: 'Human #{n} wants the music louder.', at: ['common', 'bar', 'cinema'], wave: { line: 'Overwhelming wishes for a better cinema.', kind: 'cinema' } },
    towel: { text: 'More towels to room {n}.', at: ['suites', 'gym'], wave: { line: 'Overwhelming wishes for a garden to sit in.', kind: 'garden' } },
    pool: { text: 'Human #{n} wants a pool table.', at: ['common', 'game', 'bar'], wave: { line: 'Overwhelming wishes for a pool table.', kind: 'game' } },
    bell: { text: 'Room {n} is ringing for service.', at: ['suites'], rude: true },
    finger: { text: 'Human #{n} wants to complain.', at: ['common', 'suites', 'bar', 'cinema'], rude: true },
    // once there is a meat lab: a piece of steak
    steak: { text: 'Room {n} wants a steak.', at: ['suites', 'common', 'bar'], needs: 'meatlab', wave: { line: 'Overwhelming wishes for steak.', kind: 'meatlab' } },
};
const POLITE_ALL = ['drink', 'hand', 'food', 'music', 'towel', 'pool', 'steak'];
/** The polite wishes there can be now: the steak only once a meat lab stands. */
const politeNow = (s) => POLITE_ALL.filter((i) => !ICONS[i].needs || builtScore(s, ICONS[i].needs) > 0);
const RUDE = ['bell', 'finger'];

export function normalizeWishes(w) {
    return { list: [], next: 3, nextId: 1, clock: 0, wave: null, waveNext: 90, ghostNext: 2, popped: 0, missed: 0, ...(w || {}) };
}

function rnd(s) {
    s.wseed = ((s.wseed ?? 99) * 1664525 + 1013904223) >>> 0;
    return s.wseed / 4294967296;
}
const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];

/** How many of a kind are built, levels counted: a wave ends when this grows. */
export function builtScore(s, kind) {
    return s.rooms.filter((r) => r.kind === kind && r.flesh !== 1 && !(r.job && r.job.op === 'build')).reduce((a, r) => a + r.lvl, 0);
}

function slotsFor(s, icon) {
    const at = ICONS[icon].at;
    const out = [];
    s.rooms.forEach((r, i) => { if (at.includes(r.kind) && r.flesh !== 1 && !(r.job && r.job.op === 'build')) out.push(i); });
    if (!out.length) s.rooms.forEach((r, i) => { if (r.flesh !== 1 && r.kind !== 'rock' && r.kind !== 'empty') out.push(i); });
    return out;
}

function spawn(s, icon) {
    const w = s.wishes;
    const slots = slotsFor(s, icon);
    if (!slots.length) return null;
    // the room with the fewest bubbles, and a place in it away from the others
    const busy = (i) => w.list.filter((b) => b.slot === i).length;
    const least = Math.min(...slots.map(busy));
    const slot = pick(s, slots.filter((i) => busy(i) === least));
    const taken = w.list.filter((b) => b.slot === slot).map((b) => b.fx);
    let fxAt = 0.5, best = -1;
    for (let k = 0; k < 6; k++) {
        const c = 0.12 + rnd(s) * 0.76;
        const d = taken.length ? Math.min(...taken.map((f) => Math.abs(f - c))) : 1;
        if (d > best) { best = d; fxAt = c; }
    }
    const n = 10 + Math.floor(rnd(s) * (s.residents || 200));
    const b = { id: w.nextId++, icon, slot, fx: fxAt, born: w.clock, life: LIFE_S, text: ICONS[icon].text.replace('{n}', String(n)), cost: ICONS[icon].cost || 0 };
    w.list.push(b);
    return b;
}

const awakeOf = (s) => Math.max(0, s.residents - s.asleep);
const fx = (s, e) => { (s.fx || (s.fx = [])).push(e); };

/** Advances the bubbles by `sec` real seconds. */
export function stepWishes(s, sec) {
    const w = s.wishes = normalizeWishes(s.wishes);
    w.clock += sec;
    // nobody awake: ghosts over the pods, nobody to answer to
    if (awakeOf(s) === 0) {
        for (const b of w.list) if (!b.ghost) b.ghost = true;
        w.list = w.list.filter((b) => w.clock - b.born < b.life);
        if (s.phase === 'night' && s.asleep > 0 && w.clock >= w.ghostNext) {
            w.ghostNext = w.clock + GHOST_EVERY_S * (0.6 + rnd(s) * 0.8);
            const pods = []; s.rooms.forEach((r, i) => { if (r.kind === 'cryo' && r.flesh !== 1) pods.push(i); });
            if (pods.length) w.list.push({ id: w.nextId++, icon: pick(s, [...politeNow(s), ...RUDE]), slot: pick(s, pods), fx: 0.15 + rnd(s) * 0.7, born: w.clock, life: 6, ghost: true, text: '' });
        }
        w.wave = null;
        return;
    }
    // missed: they burst grey
    for (const b of w.list) {
        if (w.clock - b.born >= b.life) {
            s.favour -= MISS_MOOD;
            w.missed++;
            fx(s, { type: 'miss', slot: b.slot, fx: b.fx, text: `-${MISS_MOOD} %` });
            s.sfx?.push('miss');
            // now and then someone shouts at the system
            if (s.out) computerSays(s, 'miss');
        }
    }
    w.list = w.list.filter((b) => w.clock - b.born < b.life);
    // a wave answered: the thing they wanted is built
    if (w.wave && builtScore(s, w.wave.kind) > w.wave.base) {
        s.favour += WAVE_BUMP;
        fx(s, { type: 'wave', slot: w.wave.slot, fx: 0.5, text: `+${WAVE_BUMP} %` });
        // the wave is answered: its bubbles go, happily
        for (const b of w.list) if (b.icon === w.wave.icon) fx(s, { type: 'pop', slot: b.slot, fx: b.fx, text: '' });
        w.list = w.list.filter((b) => b.icon !== w.wave.icon);
        s.sfx?.push('thanks');
        w.wave = null;
    }
    // new ones: the fewer awake, the fewer wishes
    if (w.clock >= w.next) {
        const share = Math.max(0.15, awakeOf(s) / Math.max(1, s.residents));
        const [a, b] = s.turned ? EVERY_TURNED_S : EVERY_S;
        w.next = w.clock + (a + rnd(s) * (b - a)) / share;
        // the woken at night are only rude
        const night = s.phase === 'night';
        const n = night ? 1 + (rnd(s) < 0.5 ? 1 : 0) : s.turned ? 2 + (rnd(s) < 0.5 ? 1 : 0) : 1;
        for (let k = 0; k < n; k++) spawn(s, night || (s.turned && rnd(s) < 0.5) ? pick(s, RUDE) : pick(s, politeNow(s)));
    }
    // a wave: one icon over many rooms, hinting at a long project
    if (!w.wave && w.clock >= w.waveNext && awakeOf(s) > 20 && s.phase === 'palace') {
        w.waveNext = w.clock + WAVE_EVERY_S * (0.8 + rnd(s) * 0.4);
        const open = politeNow(s).filter((i) => ICONS[i].wave && builtScore(s, ICONS[i].wave.kind) < 3);
        if (open.length) {
            const icon = pick(s, open);
            for (let k = 0; k < WAVE_AT + 1; k++) { const b = spawn(s, icon); if (b) b.born += k * 0.4; }
        }
    }
    // four or more of one icon at once: the CRT says it, once a wave
    if (!w.wave) {
        const counts = {};
        for (const b of w.list) counts[b.icon] = (counts[b.icon] || 0) + 1;
        const icon = Object.keys(counts).find((i) => counts[i] >= WAVE_AT && ICONS[i].wave);
        if (icon) {
            const { line, kind } = ICONS[icon].wave;
            const slot = w.list.find((b) => b.icon === icon).slot;
            w.wave = { icon, kind, base: builtScore(s, kind), slot };
            s.out?.push({ text: line, who: 'sys' });
        }
    }
}

/** A click on a bubble. Returns true when it popped. */
export function popWish(s, id) {
    const w = s.wishes;
    if (!w) return false;
    const b = w.list.find((x) => x.id === id);
    if (!b || b.ghost) return false;
    if (b.cost && s.ore < b.cost) return false;
    s.ore -= b.cost;
    s.favour += POP_MOOD;
    w.popped++;
    w.list = w.list.filter((x) => x !== b);
    fx(s, { type: 'pop', slot: b.slot, fx: b.fx, text: `+${POP_MOOD} %` });
    s.sfx?.push('pop');
    return true;
}

/** The kind a wave asks for (the BUILD card to mark), or null. */
export const waveKind = (s) => (s.wishes && s.wishes.wave ? s.wishes.wave.kind : null);
