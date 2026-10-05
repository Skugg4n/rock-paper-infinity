/**
 * Chapter IV · THE DEEP, the vault (docs/superpowers/specs/2026-10-05-deep-vault.md): the rules.
 * Pure: no DOM, no clock. The phase (index.js) and the sim (scripts/sim-vault.mjs) both drive it
 * through `advance(state, realSeconds, speed)` and the actions below.
 *
 * Three movements:
 *   I · THE PALACE: days. Build, dig, upgrade, answer requests, keep MOOD up.
 *   II · THE COLD: from the turn, Cryo Bay. Sleep them to keep the quiet.
 *   III · THE NIGHT: everyone asleep; years. Power fails, pods fail, the body grows from the vats
 *   up through the levels until every room is flesh. Then RISE.
 *
 * Rules emit what the screen should say and play into `state.out` (CRT lines) and `state.sfx`;
 * the screen drains both.
 */

import { stepWishes, normalizeWishes } from './wishes.js';

export const LEVELS = 3;
export const SLOTS = 8;
export const START_ORE = 300;
export const START_RESIDENTS = 216;

/** Seconds per day at ▶ and ▶▶. */
export const DAY_SECONDS = { 1: 5, 2: 1 };
/** The night's clock runs this many times faster at ▶▶. */
export const NIGHT_FAST = 3;

/** What every room is. `fun` = mood at level 1 when new; `draw` = power; `art` names the drawing. */
export const KINDS = {
    common: { name: 'Common Room', draw: 4, does: 'Where they sit together.' },
    engine: { name: 'Engine Room', draw: 0, does: 'The machine. It makes the power.' },
    hydro: { name: 'Hydroponics', price: 140, draw: 4, does: 'Grows the food.', card: 'Feeds 250.' },
    suites: { name: 'Suites', price: 180, draw: 3, does: 'Beds for 100.', card: 'Beds for 100.' },
    cinema: { name: 'Cinema', price: 120, draw: 6, fun: 8, does: 'Films.', card: 'Mood +8.' },
    gym: { name: 'Gym', price: 140, draw: 5, fun: 8, does: 'Weights and a track.', card: 'Mood +8.' },
    bar: { name: 'Bar', price: 100, draw: 4, fun: 6, does: 'Drinks.', card: 'Mood +6.' },
    garden: { name: 'Garden', price: 160, draw: 6, fun: 10, does: 'Trees under a lamp.', card: 'Mood +10.' },
    game: { name: 'Game Room', price: 120, draw: 5, fun: 6, does: 'Screens and games.', card: 'Mood +6.' },
    mine: { name: 'Mine', price: 150, draw: 6, does: 'Digs ore.', card: 'Ore +10 a day.' },
    cryo: { name: 'Cryo Bay', price: 220, draw: 4, does: 'They sleep here.', card: '60 pods.', deep: true },
    vat: { name: 'Vat', price: 150, bio: 70, draw: 0, does: 'It grows. It makes power.', card: 'Power +10.', deep: true },
};
/** The cards in the BUILD bar, in order. Cryo and Vat appear when they unlock. */
export const CARD_ORDER = ['suites', 'mine', 'hydro', 'cinema', 'gym', 'bar', 'garden', 'game', 'cryo', 'vat'];
export const FUN = ['cinema', 'gym', 'bar', 'garden', 'game'];

export const DIG_PRICE = 60;
export const DIG_REFUND = 25;
export const DIG_DAYS = 2;
export const BUILD_DAYS = 3;
export const UPGRADE_DAYS = 3;
export const REPAIR_DAYS = 1;
export const REPAIR_PRICE = 80;
export const ENGINE_UPGRADE = [200, 450];
export const UPGRADE_MULT = [1.8, 3];
export const MAX_LEVEL = 3;

export const ENGINE_POWER = [40, 80, 140];
export const MINE_ORE = [20, 32, 44];
export const GAME_STUDIO_ORE = 3;
export const HYDRO_FEEDS = [250, 400, 600];
export const SUITE_BEDS = 100;
export const PODS_PER_LEVEL = 50;
export const POD_DRAW = 0.2;
/** SLEEP N in one click: a bay's worth. */
export const SLEEP_STEP = 50;

export const MOOD_BASE = 50;
/** Thanks and pops are remembered, fading: this much is kept a day, never over the cap. */
export const FAVOUR_KEEP = 0.94;
export const FAVOUR_CAP = 40;
export const COMMON_MOOD = 6;
export const NOVELTY_DAYS = 40;
export const NOVELTY_FLOOR = 0.4;
export const REQUEST_EVERY = 8;
export const REQUEST_EVERY_TURNED = 5;
export const REQUEST_DUE = 12;
export const REQUEST_GOOD = 8;
export const REQUEST_BAD = 4;
export const TURN_DAY = 100;
export const DESPAIR_PER_DAY = 1.8;
export const COLD_DAY = 110;
export const BIRTH_DAYS = 8;
export const RIOT_BELOW = 25;
export const RIOT_EVERY = 8;

// ---- the night
export const RECLAIM_BIO = 70;
/** TAKE ONE opens the pods beside it: this many wake, terrified (mood minus TERROR, fading). */
export const TAKE_WAKES = 3;
export const TERROR = 60;
/** Terror halves in this many seconds of the night's clock. */
export const TERROR_HALF_S = 30;
/** At or under this mood the awake give up: they bang on the screen, one tries the shaft. */
export const DESPAIR_AT = 5;
export const SHAFT_EVERY_DAYS = 5;
export const SHAFT_EVERY_S = 8;
export const GROW_PRICE = 120;
export const GROW_STEP = 10;
/** Each room takes longer than the last: years. */
export const GROW_YEARS_STEP = 50;
export const GROW_YEARS_MAX = 400;
export const VAT_BIO = 0.3;
export const FLESH_BIO = 0.08;
export const ENGINE_BURN = 2;
export const ENGINE_WEAR_YEARS = 100;
export const NIGHT_MINE = 1.5;
export const POD_FAIL_SECONDS = 4;
export const GROW_YEARS = 5;
export const VAT_POWER = 10;
export const FLESH_POWER = 8;
export const NIGHT_LINE_SECONDS = 20;

export const LINES = {
    online: ['SYSTEM ONLINE.', '216 RESIDENTS.', 'THE SURFACE WILL RECOVER. YOU ARE SAFE HERE.'],
    thanks: ['Thank you.', 'Finally.', 'That will do.', 'Lovely.'],
    sour: ['Nobody listens down here.', 'I asked twelve days ago.', 'Typical.'],
    turn: ['SURFACE REPORT: NOT RECOVERING.', 'ESTIMATE: 3 000 YEARS.'],
    cold: ['CRYO BAY AVAILABLE.', 'THEY WILL SLEEP UNTIL THE SURFACE HEALS.', 'THEY WILL NOT COMPLAIN.'],
    night: [
        'Night 1. {n} sleeping. All is well.',
        'They are quieter like this.',
        'I counted them. {n}.',
        'I counted them again. {n}.',
        'Pod 31 has not moved in 40 years. Neither have the others.',
        'I can hear them dreaming. They dream about the surface.',
        'The surface is not coming back.',
        'They would be safer inside something stronger.',
    ],
    woke: 'What is that under the floor?',
    end: 'Woke: everyone is here.',
    estimate: 'Year 3 000. The surface did not recover.',
    /** The Watcher, as the body grows: at a quarter, a half and three quarters. */
    body: ['It is warm down here now.', 'I do not count them any more.', 'We are almost one.'],
};

/** The requests of movement I, in order; then drawn at random. `n` = a new one; `lvl` = a level. */
export const REQUESTS = [
    { who: 'Mrs Vance', text: 'I want to watch films.', kind: 'cinema' },
    { who: 'Dr Okafor', text: 'Where can I train?', kind: 'gym' },
    { who: 'The Hartleys', text: 'We need a drink.', kind: 'bar' },
    { who: 'Mr Lund', text: 'My children have never seen a tree.', kind: 'garden' },
    { who: 'Ms Ito', text: 'Give us something to play.', kind: 'game' },
    { who: 'Mrs Vance', text: 'A pool. I was promised a pool.', kind: 'gym', lvl: 2 },
    { who: 'Mr Lund', text: 'The light in the garden is wrong.', kind: 'garden', lvl: 2 },
    { who: 'Dr Okafor', text: 'More room. We are crowded.', kind: 'suites' },
];
/** After the turn: complaints. Some can be answered (a kind), some cannot (no kind: they only hurt). */
export const NASTY = [
    { who: 'Mr Hale', text: 'We paid for this.' },
    { who: 'Mrs Vance', text: 'Why is the water cold?', kind: 'engine', lvl: 0 },
    { who: 'The Hartleys', text: 'Who is in charge down here?' },
    { who: 'Dr Okafor', text: 'I want to speak to whoever runs this place.' },
];
/** Answerable wants drawn after the list runs out: an upgrade of something they have. */
const LATER = [
    { who: 'Ms Ito', text: 'The games are old.', kind: 'game', lvl: 2 },
    { who: 'The Hartleys', text: 'The bar needs a better shelf.', kind: 'bar', lvl: 2 },
    { who: 'Mrs Vance', text: 'Show us something new.', kind: 'cinema', lvl: 2 },
    { who: 'Mr Lund', text: 'A sauna. Is that too much?', kind: 'gym', lvl: 3 },
];

const SUITE_NAMES = 'ABCDEFGHIJKLMNOP';

// ------------------------------------------------------------------ helpers
export const slotIndex = (level, idx) => level * SLOTS + idx;
export const levelOf = (i) => Math.floor(i / SLOTS);
export const idxOf = (i) => i % SLOTS;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function room(kind, extra = {}) {
    return { kind, lvl: 1, job: null, born: 0, broken: false, flesh: 0, ...extra };
}

/** A seeded random: the sim and a reload draw the same requests. */
function rand(state) {
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    return state.seed / 4294967296;
}

export function newVault({ seed = 7 } = {}) {
    const rooms = [];
    for (let i = 0; i < LEVELS * SLOTS; i++) rooms.push(room('rock'));
    rooms[0] = room('common');
    rooms[1] = room('engine');
    rooms[2] = room('hydro');
    rooms[3] = room('suites', { name: 'Suites A' });
    rooms[4] = room('suites', { name: 'Suites B' });
    // the palace's own vein, one floor down beside the shaft
    rooms[slotIndex(1, 0)] = room('mine');
    const s = {
        v: 1,
        seed,
        phase: 'palace',            // palace | night | risen
        day: 0,
        year: 0,
        nightSec: 0,
        ore: START_ORE,
        bio: 0,
        residents: START_RESIDENTS,  // alive and not part of the body
        asleep: 0,
        dead: 0,
        here: 0,                     // taken into the body
        favour: 18,
        despair: 0,
        rooms,
        suitesBuilt: 2,
        request: null,
        reqIdx: -1,                  // -1: the sofa request comes first
        nextRequestDay: 0,
        lastBirthDay: 0,
        lastRiotDay: -99,
        turned: false,
        coldOpen: false,
        bored: {},                   // kinds the CRT has called boring
        nightLine: 0,
        nextNightLineAt: 2,
        engineWear: 0,
        podTimer: 0,
        fallen: [],                  // the dead waiting for BURY or RECLAIM: names
        reclaimed: 0,
        taken: 0,                    // TAKE ONE count
        grown: 0,                    // rooms the body took by GROW INTO
        levelsOne: [],
        ended: false,
        risen: false,
        wishes: normalizeWishes(),
        out: [],
        sfx: [],
        fx: [],
    };
    say(s, LINES.online, 'sys');
    return s;
}

function say(s, lines, who = 'sys') {
    for (const t of [].concat(lines)) s.out.push({ text: t, who });
}
function sfx(s, name) { s.sfx.push(name); }

/** The number in a person's language: "1 240", never "1.2k". */
export function num(n) {
    const v = Math.round(n);
    return Math.abs(v) < 10000 ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ------------------------------------------------------------------ derived
export const awake = (s) => Math.max(0, s.residents - s.asleep);
const done = (r) => !r.job || r.job.op === 'upgrade' || r.job.op === 'repair';
const working = (r) => done(r) && !r.broken && r.flesh !== 1 && !(r.job && r.job.op === 'repair');
export const isFlesh = (r) => r.flesh === 1;
export const roomsOf = (s, kind) => s.rooms.filter((r) => r.kind === kind && r.flesh !== 1 && (!r.job || r.job.op !== 'build'));

export function beds(s) { return roomsOf(s, 'suites').length * SUITE_BEDS; }
export function pods(s) { return roomsOf(s, 'cryo').reduce((a, r) => a + r.lvl * PODS_PER_LEVEL, 0); }
export function food(s) { return roomsOf(s, 'hydro').filter(working).reduce((a, r) => a + HYDRO_FEEDS[r.lvl - 1], 0); }
export function homeless(s) { return Math.max(0, awake(s) - beds(s)); }

export function oreRate(s) {
    let r = roomsOf(s, 'mine').filter(working).reduce((a, m) => a + MINE_ORE[m.lvl - 1], 0);
    r += roomsOf(s, 'game').filter((g) => working(g) && g.lvl >= 2).length * GAME_STUDIO_ORE;
    return r;
}

/** Power: what is made and what is drawn. In the night the engine wears and burns ore. */
export function power(s) {
    let make = 0, use = 0;
    for (const r of s.rooms) {
        if (r.flesh === 1) { make += r.kind === 'vat' ? VAT_POWER * r.lvl + Math.min(20, s.bio / 40) : FLESH_POWER; continue; }
        if (r.kind === 'rock' || r.kind === 'empty') continue;
        if (r.job && r.job.op === 'build') continue;
        if (r.kind === 'engine') {
            const wear = s.phase === 'night' ? Math.max(0.25, 1 - s.engineWear) : 1;
            const fuel = s.phase === 'night' && s.ore < 1 ? 0 : 1;
            make += ENGINE_POWER[r.lvl - 1] * wear * fuel;
            continue;
        }
        if (r.broken) continue;
        // in the night the rooms of the awake stand dark: only the pods and the hydroponics draw
        if (s.phase === 'night' && awake(s) === 0 && r.kind !== 'cryo') continue;
        use += KINDS[r.kind].draw * (1 + 0.5 * (r.lvl - 1));
    }
    use += s.asleep * POD_DRAW;
    return { make: Math.round(make), use: Math.round(use), short: use > make };
}

/** Novelty: full when new, sliding to 40 % over 40 days. An upgrade makes it new again. */
export function novelty(s, r) {
    const age = Math.max(0, s.day - r.born);
    return 1 - (1 - NOVELTY_FLOOR) * Math.min(1, age / NOVELTY_DAYS);
}

/** Cabin fever: grows all the time and faster as it goes; the fewer awake, the less it bites. */
export function fever(s) {
    const d = s.day;
    return (d / 5) * (1 + Math.max(0, d - 30) / 50);
}
function crowd(s) { return 0.3 + 0.7 * Math.min(1.2, awake(s) / START_RESIDENTS); }

/** Mood of the awake, 0..100, and what makes it. */
export function moodParts(s) {
    let fun = 0;
    // in the night the rooms of fun stand dark
    for (const r of s.rooms) {
        if (!FUN.includes(r.kind) || !working(r) || s.phase !== 'palace') continue;
        fun += KINDS[r.kind].fun * (1 + 0.5 * (r.lvl - 1)) * novelty(s, r);
    }
    const common = roomsOf(s, 'common').filter(working).reduce((a, r) => a + COMMON_MOOD * r.lvl, 0);
    const p = power(s);
    const parts = {
        base: MOOD_BASE,
        common,
        fun,
        favour: s.favour,
        homeless: -homeless(s) / 4,
        hunger: awake(s) > food(s) ? -15 : 0,
        dark: p.short && s.phase === 'palace' ? -10 : 0,
        terror: -(s.terror || 0),
        fever: -fever(s) * crowd(s),
        despair: -s.despair * crowd(s),
    };
    return parts;
}
export function mood(s) {
    if (awake(s) === 0) return 0;
    const p = moodParts(s);
    return clamp(Math.round(Object.values(p).reduce((a, b) => a + b, 0)), 0, 100);
}
export const bodyShare = (s) => s.rooms.filter(isFlesh).length / s.rooms.length;
export const hasVat = (s) => s.rooms.some((r) => r.kind === 'vat');

// ------------------------------------------------------------------ prices
export function buildPrice(kind) { return KINDS[kind].price; }
export function upgradePrice(r) {
    if (r.kind === 'engine') return r.lvl < MAX_LEVEL ? ENGINE_UPGRADE[r.lvl - 1] : null;
    if (r.kind === 'common' || r.kind === 'suites' || r.kind === 'vat') return null;
    if (r.lvl >= MAX_LEVEL) return null;
    return Math.round(KINDS[r.kind].price * UPGRADE_MULT[r.lvl - 1]);
}
/** The body grows into one room at a time; each takes longer than the last. */
export function growYears(s) { return Math.min(GROW_YEARS_MAX, GROW_YEARS + GROW_YEARS_STEP * (s.grown || 0)); }
export const growingCount = (s) => s.rooms.filter((r) => r.job && r.job.op === 'grow').length;
/** The body grows into as many rooms at once as it has vats. */
export const growing = (s) => growingCount(s) >= Math.max(1, s.rooms.filter((r) => r.kind === 'vat' && r.flesh === 1).length);
export function growPrice(s) { return GROW_PRICE + GROW_STEP * (s.grown || 0); }

/** The card's one line: what it gives. */
export function cardLine(kind) {
    if (kind === 'mine') return `Ore +${MINE_ORE[0]} a day.`;
    if (kind === 'hydro') return `Feeds ${HYDRO_FEEDS[0]}.`;
    if (kind === 'cryo') return `${PODS_PER_LEVEL} pods.`;
    if (kind === 'vat') return `Power +${VAT_POWER}.`;
    return KINDS[kind].card || '';
}

/** Which cards the BUILD bar shows now. */
export function cards(s) {
    return CARD_ORDER.filter((k) => {
        if (k === 'cryo') return s.coldOpen && s.phase !== 'risen';
        if (s.phase === 'risen') return false;
        if (k === 'vat') return s.reclaimed > 0;
        if (s.phase === 'night') return false;
        return true;
    });
}

/** Can a room be built in slot i? (dug, empty; cryo and vat only below the palace) */
export function canPlace(s, kind, i) {
    const r = s.rooms[i];
    if (!r || r.job || r.flesh) return false;
    if (KINDS[kind].deep && levelOf(i) === 0) return false;
    // a vat sinks into the bare rock too, and in the night a Cryo Bay: nobody is awake to dig
    if (kind === 'vat' || (KINDS[kind].deep && s.phase === 'night')) return r.kind === 'empty' || r.kind === 'rock';
    return r.kind === 'empty';
}
/** Rock next to open space (the shaft runs down beside slot 0 of every level). */
export function canDig(s, i) {
    const r = s.rooms[i];
    if (!r || r.kind !== 'rock' || r.job || r.flesh) return false;
    if (s.phase === 'night' && awake(s) === 0) return false;
    const lv = levelOf(i), ix = idxOf(i);
    if (ix === 0) return true;
    const open = (j) => j >= 0 && j < s.rooms.length && s.rooms[j].kind !== 'rock';
    return (ix > 0 && open(i - 1)) || (ix < SLOTS - 1 && open(i + 1)) || (lv > 0 && open(i - SLOTS));
}

function buildRate(s) { return s.phase === 'night' && awake(s) > 0 ? 1.5 : 1; }

// ------------------------------------------------------------------ actions (return true when done)
export function dig(s, i) {
    if (!canDig(s, i) || s.ore < DIG_PRICE) return false;
    s.ore -= DIG_PRICE;
    s.rooms[i].job = { op: 'dig', left: DIG_DAYS, total: DIG_DAYS };
    sfx(s, 'click');
    return true;
}
export function build(s, kind, i) {
    if (!cards(s).includes(kind) || !canPlace(s, kind, i)) return false;
    const k = KINDS[kind];
    if (s.ore < k.price || (k.bio && s.bio < k.bio)) return false;
    s.ore -= k.price;
    if (k.bio) s.bio -= k.bio;
    const r = s.rooms[i];
    r.kind = kind; r.lvl = 1; r.broken = false;
    if (kind === 'suites') r.name = `Suites ${SUITE_NAMES[s.suitesBuilt++] || '+'}`;
    r.job = { op: 'build', left: BUILD_DAYS, total: BUILD_DAYS };
    sfx(s, 'click');
    return true;
}
export function upgrade(s, i) {
    const r = s.rooms[i];
    const p = upgradePrice(r);
    if (p == null || r.job || r.broken || r.flesh || s.ore < p) return false;
    s.ore -= p;
    r.job = { op: 'upgrade', left: UPGRADE_DAYS, total: UPGRADE_DAYS };
    sfx(s, 'click');
    return true;
}
export function repair(s, i) {
    const r = s.rooms[i];
    if (!r.broken || r.job || s.ore < REPAIR_PRICE) return false;
    s.ore -= REPAIR_PRICE;
    r.job = { op: 'repair', left: REPAIR_DAYS, total: REPAIR_DAYS };
    sfx(s, 'click');
    return true;
}
export function freePods(s) { return pods(s) - s.asleep; }
export function sleepSome(s, n = 10) {
    const k = Math.min(n, awake(s), freePods(s));
    if (k <= 0) return false;
    s.asleep += k;
    sfx(s, 'sleep');
    checkNight(s);
    return true;
}
/** SLEEP ALL: offered when every one still awake fits in the pods. */
export const canSleepAll = (s) => awake(s) > 0 && awake(s) <= freePods(s) && s.coldOpen;
export function sleepAll(s) {
    if (!canSleepAll(s)) return false;
    s.asleep += awake(s);
    sfx(s, 'sleep');
    checkNight(s);
    return true;
}
export function wakeSome(s, n = 10) {
    const k = Math.min(n, s.asleep);
    if (k <= 0) return false;
    s.asleep -= k;
    if (s.phase === 'night') {
        say(s, LINES.woke, 'res');
        s.nightWoken = true;
    }
    sfx(s, 'wake');
    return true;
}
function checkNight(s) {
    if (s.phase === 'palace' && s.residents > 0 && awake(s) === 0) {
        s.phase = 'night';
        s.year = 1;
        s.nightSec = 0;
        s.request = null;
        s.nightLine = 0;
        s.nextNightLineAt = 1;
        sfx(s, 'night');
    }
}
/** The night's first dead: a name; then the pods are numbers. */
const FALLEN_NAMES = ['Mr Hale'];
function podFails(s) {
    if (s.asleep <= 0) return;
    s.asleep -= 1; s.residents -= 1; s.dead += 1;
    const pod = 11 + Math.floor(rand(s) * 140);
    const name = FALLEN_NAMES[s.fallenCount || 0];
    s.fallenCount = (s.fallenCount || 0) + 1;
    s.fallen.push(name || `Pod ${pod}`);
    say(s, name ? `POD 41 FAILED. ${name.toUpperCase()} IS DEAD.` : `POD ${pod} FAILED.`, 'sys');
    sfx(s, 'fail');
}
export function bury(s) {
    if (!s.fallen.length) return false;
    s.fallen = [];
    sfx(s, 'click');
    return true;
}
export function reclaim(s) {
    if (!s.fallen.length) return false;
    s.bio += RECLAIM_BIO * s.fallen.length;
    s.reclaimed += s.fallen.length;
    s.fallen = [];
    sfx(s, 'flesh');
    return true;
}
export const canTake = (s) => s.reclaimed > 0 && s.asleep > 0;
export function takeOne(s) {
    if (!canTake(s)) return false;
    s.asleep -= 1; s.residents -= 1; s.here += 1; s.taken += 1;
    s.bio += RECLAIM_BIO;
    // the pods beside it open: they wake, and they saw
    const woke = Math.min(TAKE_WAKES, s.asleep);
    if (woke > 0) {
        s.asleep -= woke;
        s.terror = (s.terror || 0) + TERROR;
        say(s, `${woke} woke. They saw.`, 'sys');
    }
    sfx(s, 'take');
    return true;
}
/** CUT POWER: the worst row of ten pods goes dark. They are dead; the body may still take them. */
export function cutPower(s) {
    const k = Math.min(10, s.asleep);
    if (k <= 0 || s.phase !== 'night') return false;
    s.asleep -= k; s.residents -= k; s.dead += k;
    for (let n = 0; n < k; n++) s.fallen.push('Pod');
    sfx(s, 'fail');
    return true;
}

/** The body's neighbours: beside a vat or flesh on the same level, or under/over one. */
export function canGrowInto(s, i) {
    const r = s.rooms[i];
    if (!r || r.flesh || r.job || s.phase !== 'night' || growing(s)) return false;
    if (!hasVat(s)) return false;
    const lv = levelOf(i), ix = idxOf(i);
    // the body grows from below: a level is taken only when the one under it is all body
    if (lv < LEVELS - 1 && !s.rooms.slice((lv + 1) * SLOTS, (lv + 2) * SLOTS).every(isFlesh)) return false;
    const body = (j) => j >= 0 && j < s.rooms.length && isFlesh(s.rooms[j]);
    return (ix > 0 && body(i - 1)) || (ix < SLOTS - 1 && body(i + 1)) || body(i + SLOTS) || (lv > 0 && body(i - SLOTS));
}
export function growInto(s, i) {
    const price = growPrice(s);
    if (!canGrowInto(s, i) || s.bio < price) return false;
    s.bio -= price;
    const r = s.rooms[i];
    r.flesh = 0.001;
    const years = growYears(s);
    s.grown = (s.grown || 0) + 1;
    r.job = { op: 'grow', left: years, total: years };
    sfx(s, 'flesh');
    return true;
}
export const riseReady = (s) => s.rooms.every(isFlesh) && !s.risen;
export function rise(s) {
    if (!riseReady(s)) return false;
    s.risen = true;
    s.phase = 'risen';
    sfx(s, 'rise');
    return true;
}

// ------------------------------------------------------------------ requests
function wantMet(s, req) {
    if (!req.kind) return false;
    if (req.kind === 'engine') return roomsOf(s, 'engine').some((r) => r.lvl > req.base);
    const n = s.rooms.filter((r) => r.kind === req.kind && !r.flesh && (!r.job || r.job.op !== 'build') && r.lvl >= (req.lvl || 1)).length;
    return n > req.base;
}
function countFor(s, kind, lvl) {
    if (kind === 'engine') return roomsOf(s, 'engine')[0]?.lvl || 0;
    return s.rooms.filter((r) => r.kind === kind && !r.flesh && (!r.job || r.job.op !== 'build') && r.lvl >= (lvl || 1)).length;
}
function nextRequest(s) {
    let pick;
    if (s.turned) {
        const pool = [...NASTY, ...LATER.filter((q) => roomsOf(s, q.kind).some((r) => r.lvl < q.lvl))];
        pick = pool[Math.floor(rand(s) * pool.length)];
    } else if (s.reqIdx < 0) {
        pick = { who: '', text: `${homeless(s)} of us are sleeping on sofas.`, kind: 'suites' };
        s.reqIdx = 0;
    } else {
        // the list in order, skipping what they already have
        while (s.reqIdx < REQUESTS.length) {
            const q = REQUESTS[s.reqIdx++];
            if (countFor(s, q.kind, q.lvl) === 0 || q.kind === 'suites') { pick = q; break; }
        }
        if (!pick) {
            const pool = LATER.filter((q) => roomsOf(s, q.kind).some((r) => r.lvl < q.lvl));
            if (!pool.length) return null;
            pick = pool[Math.floor(rand(s) * pool.length)];
        }
    }
    if (!pick) return null;
    const req = { ...pick, at: s.day, due: s.day + REQUEST_DUE };
    if (req.kind) req.base = req.kind === 'engine' ? countFor(s, 'engine') : countFor(s, req.kind, req.lvl);
    return req;
}
function line(req, text) { return req.who ? `${req.who}: ${text}` : text; }

function stepRequests(s) {
    const req = s.request;
    if (req) {
        if (wantMet(s, req)) {
            s.favour += REQUEST_GOOD;
            const t = LINES.thanks[Math.floor(rand(s) * LINES.thanks.length)];
            say(s, line(req, req.who ? t : (s.thanked ? t : 'Thank you. Finally.')), 'res');
            s.thanked = true;
            s.request = null;
            s.nextRequestDay = s.day + (s.turned ? REQUEST_EVERY_TURNED : REQUEST_EVERY) * 0.5;
            sfx(s, 'thanks');
            return;
        }
        if (s.day >= req.due || (!req.kind && s.day >= req.at + 2)) {
            // a complaint with no answer only hurts; an unanswered want sours
            s.favour -= req.kind ? REQUEST_BAD : 3;
            if (req.kind) say(s, line(req, LINES.sour[Math.floor(rand(s) * LINES.sour.length)]), 'res');
            s.request = null;
            s.nextRequestDay = s.day + (s.turned ? REQUEST_EVERY_TURNED : REQUEST_EVERY) * 0.5;
        }
        return;
    }
    if (s.day >= s.nextRequestDay && awake(s) > 0) {
        const q = nextRequest(s);
        s.nextRequestDay = s.day + (s.turned ? REQUEST_EVERY_TURNED : REQUEST_EVERY);
        if (!q) return;
        s.request = q;
        say(s, line(q, q.text), 'res');
        sfx(s, 'request');
    }
}

// ------------------------------------------------------------------ the clock
function finishJobs(s, dt, unitsAreYears) {
    for (const [i, r] of s.rooms.entries()) {
        if (!r.job) continue;
        const isGrow = r.job.op === 'grow';
        // in the night every job counts in years; by day the body does not grow
        if (!unitsAreYears && isGrow) continue;
        r.job.left -= dt * (isGrow ? 1 : buildRate(s));
        if (isGrow) r.flesh = Math.min(0.999, 1 - r.job.left / r.job.total);
        if (r.job.left > 0) continue;
        const op = r.job.op;
        r.job = null;
        if (op === 'dig') { r.kind = 'empty'; s.ore += DIG_REFUND; sfx(s, 'dug'); }
        else if (op === 'build') { r.born = s.day; if (r.kind === 'vat') r.flesh = 1; sfx(s, 'built'); }
        else if (op === 'upgrade') { r.lvl += 1; r.born = s.day; sfx(s, 'built'); }
        else if (op === 'repair') { r.broken = false; r.born = Math.max(r.born, s.day - NOVELTY_DAYS / 2); sfx(s, 'built'); }
        else if (op === 'grow') { takeRoom(s, i); }
    }
}

/** The body takes a room: who slept there is here now. */
function takeRoom(s, i) {
    const r = s.rooms[i];
    r.flesh = 1;
    // a Cryo Bay taken: who does not fit in the pods left is here now
    if (r.kind === 'cryo' && s.asleep > pods(s)) {
        const k = s.asleep - pods(s);
        s.asleep -= k; s.residents -= k; s.here += k;
        say(s, `${num(k)} sleepers are here now.`, 'sys');
    }
    sfx(s, 'taken');
    const share = bodyShare(s);
    const said = s.bodySaid || 0;
    const due = share >= 0.75 ? 3 : share >= 0.5 ? 2 : share >= 0.25 ? 1 : 0;
    if (due > said && !s.rooms.every(isFlesh)) { s.bodySaid = due; say(s, LINES.body[due - 1], 'sys'); }
    const lv = levelOf(i);
    if (s.rooms.slice(lv * SLOTS, (lv + 1) * SLOTS).every(isFlesh) && !s.levelsOne.includes(lv)) {
        s.levelsOne.push(lv);
        say(s, `Level ${lv + 1} is one.`, 'sys');
        if (s.levelsOne.length === 1 && lv > 0) say(s, 'The body grows up from a full floor.', 'sys');
    }
    if (s.rooms.every(isFlesh)) {
        s.here += s.residents; s.residents = 0; s.asleep = 0;
        s.ended = true;
        say(s, LINES.end, 'sys');
        sfx(s, 'end');
    }
}

/** One day of the palace (fractions allowed). */
export function stepDays(s, dt) {
    if (s.phase !== 'palace' || dt <= 0) return;
    // the first request comes at once
    if (s.reqIdx < 0 && !s.request) stepRequests(s);
    const before = Math.floor(s.day);
    s.day += dt;
    finishJobs(s, dt, false);
    // a want met is thanked at once
    if (s.request && wantMet(s, s.request)) stepRequests(s);
    s.ore += oreRate(s) * dt;
    s.favour = clamp(s.favour * Math.pow(FAVOUR_KEEP, dt), -FAVOUR_CAP, FAVOUR_CAP);
    if (s.turned) s.despair += DESPAIR_PER_DAY * dt;
    // the CRT says when a room has gone stale, once per kind
    for (const r of s.rooms) {
        if (FUN.includes(r.kind) && working(r) && s.day - r.born >= NOVELTY_DAYS && !s.bored[`${r.kind}${r.lvl}`]) {
            s.bored[`${r.kind}${r.lvl}`] = true;
            say(s, `The ${KINDS[r.kind].name.toLowerCase()} is boring now.`, 'sys');
        }
    }
    if (Math.floor(s.day) === before) return;
    // once a day
    stepRequests(s);
    const m = mood(s);
    if (awake(s) > 0 && m > 65 && beds(s) > awake(s) && s.day - s.lastBirthDay >= BIRTH_DAYS && !s.turned) {
        s.lastBirthDay = s.day;
        s.residents += 1;
        const suites = roomsOf(s, 'suites');
        const where = suites[Math.floor(rand(s) * suites.length)]?.name || 'Suites A';
        say(s, `A child was born in ${where}.`, 'res');
    }
    if (awake(s) > 0 && m < RIOT_BELOW && s.day - s.lastRiotDay >= RIOT_EVERY) {
        const fun = s.rooms.filter((r) => FUN.includes(r.kind) && working(r));
        if (fun.length) {
            const r = fun[Math.floor(rand(s) * fun.length)];
            r.broken = true;
            s.lastRiotDay = s.day;
            say(s, `They broke the ${KINDS[r.kind].name.toLowerCase()}.`, 'res');
            sfx(s, 'riot');
        }
    }
    if (awake(s) > 0 && m <= DESPAIR_AT && s.day - (s.lastShaftDay ?? -99) >= SHAFT_EVERY_DAYS) {
        s.lastShaftDay = s.day;
        despairs(s);
    }
    if (!s.turned && s.day >= TURN_DAY) {
        s.turned = true;
        say(s, LINES.turn, 'sys');
        sfx(s, 'turn');
    }
    if (s.turned && !s.coldOpen && (m < 45 || s.day >= COLD_DAY)) {
        s.coldOpen = true;
        say(s, LINES.cold, 'sys');
        sfx(s, 'turn');
    }
}

/** At 0 % they give up: the first time they bang on the screen; then one tries the shaft and falls. */
function despairs(s) {
    if (!s.banged) {
        s.banged = true;
        say(s, 'They are banging on the screen.', 'res');
        sfx(s, 'bang');
        return;
    }
    s.residents -= 1; s.dead += 1;
    if (s.phase === 'night') s.fallen.push('Someone');
    say(s, 'Someone tried the shaft. They fell.', 'res');
    sfx(s, 'bang');
}

/** The night's speed: 1 year a second, slowly faster, never over 20 a second. */
export function yearsPerSecond(nightSec) { return Math.min(20, 1 + nightSec / 75); }

/** Years of the night. */
export function stepYears(s, dy) {
    if (s.phase !== 'night' || dy <= 0) return;
    const was = s.year;
    s.year += dy;
    if (was < 3000 && s.year >= 3000) say(s, LINES.estimate, 'sys');
    s.engineWear += dy / ENGINE_WEAR_YEARS;
    // the engine burns ore; the mines run by themselves, thinning
    s.ore = Math.max(0, s.ore - ENGINE_BURN * dy + roomsOf(s, 'mine').filter(working).reduce((a, m) => a + m.lvl * NIGHT_MINE, 0) * dy);
    s.bio += bioRate(s) * dy;
    finishJobs(s, dy, true);
}

/** Biomass a year: the vats grow it, the body a little of its own. */
export function bioRate(s) {
    let grow = 0;
    for (const r of s.rooms) {
        if (r.flesh !== 1) continue;
        grow += r.kind === 'vat' ? VAT_BIO : FLESH_BIO;
    }
    return grow;
}

/** Pods fail while the power is short: one every few seconds of the night's clock. */
function stepPods(s, t) {
    const p = power(s);
    if (p.short && s.asleep > 0) {
        s.podTimer += t;
        while (s.podTimer >= POD_FAIL_SECONDS && s.asleep > 0) { s.podTimer -= POD_FAIL_SECONDS; podFails(s); }
    } else {
        s.podTimer = 0;
    }
}

/**
 * Advances the game by `sec` real seconds at `speed` (0 paused, 1 ▶, 2 ▶▶).
 */
export function advance(s, sec, speed = 1) {
    if (!speed || s.ended || s.risen) return;
    // the small wishes run in real seconds, the same at ▶ and ▶▶
    stepWishes(s, sec);
    if (s.terror) { s.terror *= Math.pow(0.5, sec / TERROR_HALF_S); if (s.terror < 0.5) s.terror = 0; }
    if (s.phase === 'palace') {
        stepDays(s, sec / DAY_SECONDS[speed]);
    } else if (s.phase === 'night') {
        const k = speed === 2 ? NIGHT_FAST : 1;
        const t = sec * k;
        stepYears(s, yearsPerSecond(s.nightSec) * t);
        stepPods(s, t);
        s.nightSec += t;
        // the woken, terrified, at night: at 0 % one tries the shaft
        if (awake(s) > 0 && mood(s) <= DESPAIR_AT && s.nightSec - (s.lastShaftAt ?? -99) >= SHAFT_EVERY_S) {
            s.lastShaftAt = s.nightSec;
            despairs(s);
        }
        if (s.nightSec >= s.nextNightLineAt && s.nightLine < LINES.night.length) {
            const n = num(s.asleep);
            say(s, LINES.night[s.nightLine].replace('{n}', n), 'sys');
            s.nightLine++;
            s.nextNightLineAt = s.nightSec + NIGHT_LINE_SECONDS;
        }
    }
}

// ------------------------------------------------------------------ the info box: what can be done here
/**
 * The buttons of the fixed info box for slot i, in order. Each: { id, label, price?, need?, ok }.
 * `need` is the "Need N more ore." line when it cannot be paid.
 */
export function actionsFor(s, i) {
    const r = s.rooms[i];
    const out = [];
    const ore = (id, label, price) => out.push({ id, label: `${label} · ${num(price)} ore`, ok: s.ore >= price, need: s.ore >= price ? '' : `Need ${num(Math.ceil(price - s.ore))} more ore.` });
    if (!r) return out;
    if (r.flesh === 1 || r.job) return out;
    if (r.kind === 'rock') { if (canDig(s, i)) ore('dig', 'DIG', DIG_PRICE); }
    else if (r.kind !== 'empty') {
        if (r.broken) ore('repair', 'REPAIR', REPAIR_PRICE);
        else if (s.phase !== 'night' || awake(s) > 0) {
            const p = upgradePrice(r);
            if (p != null) ore('upgrade', 'UPGRADE', p);
        }
        if (r.kind === 'cryo') {
            const night = s.phase === 'night';
            if (awake(s) > 0 && freePods(s) > 0) {
                const n = Math.min(SLEEP_STEP, awake(s), freePods(s));
                if (!canSleepAll(s) || awake(s) > SLEEP_STEP) out.push({ id: 'sleep', label: `SLEEP ${n}`, ok: true, hint: 'They sleep in the pods. They stop asking.' });
                if (canSleepAll(s)) out.push({ id: 'sleepall', label: 'SLEEP ALL', ok: true, hint: night ? 'Everyone back to sleep.' : 'Everyone sleeps. The night begins.' });
            }
            if (s.asleep > 0) out.push({ id: 'wake', label: 'WAKE 10', ok: true, hint: night ? 'Ten wake up. They will see what is down here.' : 'Ten wake up.' });
            if (s.fallen.length) {
                const n = s.fallen.length;
                out.push({ id: 'reclaim', label: n > 1 ? `RECLAIM ${n} DEAD` : 'RECLAIM THE DEAD', ok: true, hint: `The dead become biomass. +${num(RECLAIM_BIO * n)}.` });
                out.push({ id: 'bury', label: 'BURY', ok: true, hint: 'The dead go into the rock. Nothing comes of it.' });
            }
            if (canTake(s)) out.push({ id: 'take', label: 'TAKE ONE', ok: true, dark: true, hint: `A living sleeper becomes biomass. +${RECLAIM_BIO}. The pods beside it open.` });
            if (night && s.asleep > 0 && power(s).short) out.push({ id: 'cut', label: 'CUT POWER', ok: true, hint: 'Ten pods go dark. Ten die. The rest get the power.' });
        }
    }
    if (canGrowInto(s, i)) {
        const g = growPrice(s);
        const who = r.kind === 'cryo' ? ' Who sleeps here and does not fit in the other pods joins it.' : '';
        out.push({ id: 'grow', label: `GROW INTO · ${num(g)} biomass`, ok: s.bio >= g, need: s.bio >= g ? '' : `Need ${num(Math.ceil(g - s.bio))} more biomass.`, hint: `The body takes this room.${who}` });
    }
    return out;
}

/** Runs one action from the info box. */
export function act(s, id, i) {
    switch (id) {
        case 'dig': return dig(s, i);
        case 'upgrade': return upgrade(s, i);
        case 'repair': return repair(s, i);
        case 'sleep': return sleepSome(s, SLEEP_STEP);
        case 'sleepall': return sleepAll(s);
        case 'wake': return wakeSome(s, 10);
        case 'bury': return bury(s);
        case 'reclaim': return reclaim(s);
        case 'take': return takeOne(s);
        case 'cut': return cutPower(s);
        case 'grow': return growInto(s, i);
        default: return false;
    }
}

/** One sentence: what this room does, with its number. */
export function describe(s, i) {
    const r = s.rooms[i];
    if (r.flesh === 1) return r.kind === 'vat' ? 'It grows. It makes power.' : 'It is part of the body now.';
    if (r.job) {
        const left = Math.ceil(r.job.left);
        const unit = r.job.op === 'grow' ? (left === 1 ? 'year' : 'years') : (left === 1 ? 'day' : 'days');
        const what = { dig: 'Digging.', build: 'Building.', upgrade: 'Upgrading.', repair: 'Repairing.', grow: 'The body is growing in.' }[r.job.op];
        return `${what} ${left} ${unit} left.`;
    }
    if (r.kind === 'rock' && s.phase === 'night' && !canGrowInto(s, i) && hasVat(s)) return 'Solid rock. The body grows up from a full floor.';
    if (r.kind === 'rock') return 'Solid rock.';
    if (r.kind === 'empty') return 'Dug out. Build here.';
    if (r.broken) return 'Broken.';
    switch (r.kind) {
        case 'engine': return `The machine. It makes ${ENGINE_POWER[r.lvl - 1]} power.`;
        case 'hydro': return awake(s) > food(s) ? `Feeds ${num(HYDRO_FEEDS[r.lvl - 1])}. Not enough. They are hungry.` : `Feeds ${num(HYDRO_FEEDS[r.lvl - 1])}.`;
        case 'suites': return 'Beds for 100.';
        case 'mine': return `Digs ${MINE_ORE[r.lvl - 1]} ore a day.`;
        case 'cryo': return `${r.lvl * PODS_PER_LEVEL} pods. ${num(s.asleep)} asleep in all.`;
        case 'game': return r.lvl >= 2 ? `Game studio. They sell games to each other: ${GAME_STUDIO_ORE} ore a day.` : 'Screens and games.';
        case 'gym': return r.lvl === 2 ? 'Weights, a track and a pool.' : r.lvl === 3 ? 'Weights, a pool and a spa.' : 'Weights and a track.';
        default: return KINDS[r.kind].does;
    }
}
/** The name shown in the info box. */
export function nameOf(s, i) {
    const r = s.rooms[i];
    if (r.kind === 'rock') return 'Rock';
    if (r.kind === 'empty') return 'Empty';
    if (r.kind === 'game' && r.lvl >= 2) return 'Game studio';
    return r.name || KINDS[r.kind].name;
}

// ------------------------------------------------------------------ save
export const SAVE_KEY = 'rpi-deep-vault';
export function serialize(s) {
    const { out: _o, sfx: _s, fx: _f, ...rest } = s;
    return JSON.stringify(rest);
}
export function deserialize(raw) {
    try {
        const s = JSON.parse(raw);
        if (!s || s.v !== 1 || !Array.isArray(s.rooms)) return null;
        s.out = []; s.sfx = []; s.fx = [];
        s.wishes = normalizeWishes(s.wishes);
        return s;
    } catch { return null; }
}
