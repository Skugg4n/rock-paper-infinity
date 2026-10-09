/**
 * Chapter IV · THE DEEP, the dig: the ground. Seeded and deterministic: the same seed lays the same
 * mountain, tile for tile. 24 tiles wide, 400 deep, one tile is 5 m, the bottom is 2 000 m.
 *
 * The layers are the game's own history told by the ground: the city's rubble, the war, old rock,
 * the machine, the warm rock and the flesh, with the heart at the bottom. Two full-width bands are
 * gates (hard rock at 300 m, basalt at 700 m), the sinew over the heart wants a drill of bone.
 */

export const W = 24;
export const H = 400;
export const METERS_PER_TILE = 5;

export const T = {
    AIR: 0, SOIL: 1, STONE: 2, HARD: 3, BASALT: 4, FLESH: 5, SINEW: 6, HEART: 7,
    ROCK: 8, PAPER: 9, SCISSORS: 10, BIO: 11, GHOST: 12, FIND: 13, QUANTUM: 14,
    MAGMA: 15, GAS: 16,
};
/** The hazards (spec H1): magma below 600 m, gas in the war. */
export const MAGMA_FROM = 600, MAGMA_TO = 1580;
export const GAS_FROM = 70, GAS_TO = 290;

/** Ore: what it is worth and in what. */
export const ORE = {
    [T.ROCK]: { kind: 'rock', parts: 2, bio: 0 },
    [T.PAPER]: { kind: 'paper', parts: 5, bio: 0 },
    [T.SCISSORS]: { kind: 'scissors', parts: 10, bio: 0 },
    [T.BIO]: { kind: 'bio', parts: 0, bio: 1 },
};

/** The depth of a row's floor in metres: row 0 is 5 m, row 399 is 2 000 m. */
export const depthOf = (row) => (row < 0 ? 0 : (row + 1) * METERS_PER_TILE);
/** The row a depth lies in. */
export const rowOf = (m) => Math.max(0, Math.ceil(m / METERS_PER_TILE) - 1);

export const LAYERS = [
    { id: 'city', name: 'THE CITY', from: 0, to: 60, line: null },
    { id: 'war', name: 'THE WAR', from: 60, to: 300, line: 'Rust. The war is down here too.' },
    { id: 'old', name: 'OLD ROCK', from: 300, to: 700, line: 'Old rock. Nobody lived here.' },
    { id: 'machine', name: 'THE MACHINE', from: 700, to: 1100, line: 'Machines. Older than the war.' },
    { id: 'warm', name: 'WARM ROCK', from: 1100, to: 1600, line: null },
    { id: 'flesh', name: 'THE FLESH', from: 1600, to: 2000, line: 'Soft. It gives under the drill.' },
];
export function layerIndexOf(row) {
    const m = depthOf(row);
    for (let i = LAYERS.length - 1; i >= 0; i--) if (m > LAYERS[i].from) return i;
    return 0;
}

/** Twelve finds, two a layer; each one a line. */
export const FINDS = [
    { layer: 0, line: 'A street sign. MARKET ST.' },
    { layer: 0, line: 'A child\'s shoe. Size small.' },
    { layer: 1, line: 'A shell casing, still warm.' },
    { layer: 1, line: 'A helmet. A name written inside.' },
    { layer: 2, line: 'A fossil. Something with three fingers.' },
    { layer: 2, line: 'A shell, older than the sea.' },
    { layer: 3, line: 'A board. Rock beat scissors. Again and again.' },
    { layer: 3, line: 'A gear the size of a door. It still turns.' },
    { layer: 4, line: 'The rock is warm. It is warm like skin.' },
    { layer: 4, line: 'A vein. It runs down, toward something.' },
    { layer: 5, line: 'It moved when I touched it.' },
    { layer: 5, line: 'A tooth. Human.' },
    // v1.92.4: rare, from the other reality: a free armour plate
    { layer: 2, line: 'A plate from the other drone.', plate: true },
];
/** What a find is worth, by layer: parts, and biomass in the flesh. */
export const FIND_PARTS = [12, 30, 60, 100, 160, 0];
export const FIND_BIO = [0, 0, 0, 0, 0, 4];

// the gates, rows
export const HARD_BAND = [59, 60];          // 300 m: DRILL 2
export const BASALT_BAND = [139, 140];      // 700 m: DRILL 3
export const SINEW_BAND = [386, 391];       // 1 935 to 1 960 m: BONE DRILL
export const HEART = { cx: 11.5, cy: 400.2, rx: 4.6, ry: 2.6 };

/** mulberry32: small, fast, seeded. */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const inHeart = (x, y) => (((x + 0.5 - HEART.cx) / HEART.rx) ** 2 + ((y + 0.5 - HEART.cy) / HEART.ry) ** 2) <= 1;

/**
 * The world: `tiles` (Uint8Array, W*H, row by row), `finds` (index -> find number).
 * @param {number} seed
 */
export function makeWorld(seed = 1) {
    const r = rng(seed);
    const tiles = new Uint8Array(W * H);
    const at = (x, y) => tiles[y * W + x];
    for (let y = 0; y < H; y++) {
        const li = layerIndexOf(y);
        const m = depthOf(y);
        for (let x = 0; x < W; x++) {
            let t;
            const u = r();
            // the filler
            if (li === 0) t = u < 0.72 ? T.SOIL : T.STONE;
            else if (li === 1) t = u < (0.62 - 0.3 * (m - 60) / 240) ? T.SOIL : T.STONE;
            else if (li === 2) t = u < 0.8 ? T.STONE : T.HARD;
            else if (li === 3) t = u < 0.55 ? T.STONE : u < 0.88 ? T.HARD : T.BASALT;
            else if (li === 4) t = u < 0.3 ? T.STONE : u < 0.72 ? T.HARD : T.BASALT;
            else t = T.FLESH;
            // the ore, in veins: richer beside ore of the same kind
            const v = r();
            const left = x > 0 ? at(x - 1, y) : 0, up = y > 0 ? at(x, y - 1) : 0;
            const pick = (kind, p) => {
                const vein = (left === kind ? 2.6 : 1) * (up === kind ? 2.2 : 1);
                return v < p * vein;
            };
            if (li === 0) { if (pick(T.ROCK, y < 4 ? 0.09 : 0.11)) t = T.ROCK; }
            else if (li === 1) {
                if (m > 100 && pick(T.PAPER, 0.05)) t = T.PAPER;
                else if (r() < 0.07 * ((left === T.ROCK ? 2.5 : 1) * (up === T.ROCK ? 2 : 1))) t = T.ROCK;
            } else if (li === 2) {
                if (m > 400 && pick(T.SCISSORS, 0.04)) t = T.SCISSORS;
                else if (r() < 0.08 * ((left === T.PAPER ? 2.5 : 1) * (up === T.PAPER ? 2 : 1))) t = T.PAPER;
            } else if (li === 3 || li === 4) {
                if (pick(T.SCISSORS, li === 3 ? 0.07 : 0.08)) t = T.SCISSORS;
                else if (r() < 0.035) t = T.GHOST;
            } else {
                if (pick(T.BIO, 0.06)) t = T.BIO;
                else if (r() < 0.02) t = T.SCISSORS;
                else if (r() < 0.03) t = T.GHOST;
            }
            tiles[y * W + x] = t;
        }
    }
    const band = (rows, t) => { for (let y = rows[0]; y <= rows[1]; y++) for (let x = 0; x < W; x++) tiles[y * W + x] = t; };
    band(HARD_BAND, T.HARD);
    band(BASALT_BAND, T.BASALT);
    band(SINEW_BAND, T.SINEW);
    for (let y = SINEW_BAND[1] + 1; y < H; y++) for (let x = 0; x < W; x++) if (inHeart(x, y)) tiles[y * W + x] = T.HEART;
    // the finds, two a layer, never in a band
    const finds = {};
    FINDS.forEach((f, i) => {
        const L = LAYERS[f.layer];
        const lo = rowOf(L.from) + 3, hi = Math.min(rowOf(L.to) - 3, SINEW_BAND[0] - 2);
        const half = (i % 2 === 0);
        const span = hi - lo;
        let y = lo + Math.floor((half ? 0.15 + 0.3 * r() : 0.55 + 0.35 * r()) * span);
        if (i === 0) y = 4;                  // the first find comes early: the street sign
        const x = 2 + Math.floor(r() * (W - 4));
        tiles[y * W + x] = T.FIND;
        finds[y * W + x] = i;
    });
    // pass 3 (E): about a quantum object a layer, from another reality; laid with their own numbers so
    // the rest of the mountain stays as it was. None in the city (the first minute has enough in it):
    // two in the war, the first near 120 m, so the lab opens after a few dives; then one a layer.
    const q = rng(seed * 131 + 7);
    const quantum = [];
    // (v1.92.6: a seventh, low in the old rock, for the DUPLICATOR's place in the lab's pool)
    const spans = [[105, 140], [200, 280], ...LAYERS.slice(2).map((L) => [L.from + 30, L.to - 30]), [560, 680]];
    spans.forEach(([from, to]) => {
        const lo = rowOf(from), hi = Math.min(rowOf(to), SINEW_BAND[0] - 2);
        for (let tries = 0; tries < 40; tries++) {
            const y = lo + Math.floor(q() * (hi - lo));
            const x = 2 + Math.floor(q() * (W - 4));
            const i = y * W + x;
            if (finds[i] !== undefined || tiles[i] === T.HARD && (y === HARD_BAND[0] || y === HARD_BAND[1]) || y >= BASALT_BAND[0] && y <= BASALT_BAND[1]) continue;
            if (x === 11) continue;                 // never in the way down the middle
            tiles[i] = T.QUANTUM;
            quantum.push(i);
            break;
        }
    });
    // pass 3, H1: the hazards, with their own numbers (the rest of the mountain stays as it was).
    // Magma in pockets below 600 m, gas pockets in the war (old bunkers); never within two columns of the middle (a way down stays clear),
    // never over a find, a quantum object or a gate band.
    const hz = rng(seed * 733 + 3);
    const free = (x, y) => {
        const i = y * W + x, t = tiles[i];
        return Math.abs(x - 11) >= 3 && x >= 0 && x < W && finds[i] === undefined && t !== T.QUANTUM && t !== T.FIND && t !== T.HEART && t !== T.SINEW
            && !(y >= HARD_BAND[0] && y <= HARD_BAND[1]) && !(y >= BASALT_BAND[0] && y <= BASALT_BAND[1]);
    };
    const pocket = (t, y0, size) => {
        let x = 1 + Math.floor(hz() * (W - 2)), y = y0;
        for (let k = 0; k < size; k++) {
            if (free(x, y)) tiles[y * W + x] = t;
            const d = Math.floor(hz() * 4);
            x = Math.max(0, Math.min(W - 1, x + (d === 0 ? -1 : d === 1 ? 1 : 0)));
            y += d === 2 ? 1 : 0;
        }
    };
    for (let y = rowOf(GAS_FROM); y < rowOf(GAS_TO); y += 9 + Math.floor(hz() * 8)) pocket(T.GAS, y, 1 + Math.floor(hz() * 3));
    for (let y = rowOf(MAGMA_FROM); y < rowOf(MAGMA_TO); y += 6 + Math.floor(hz() * 7)) pocket(T.MAGMA, y, 2 + Math.floor(hz() * 4));
    return { seed, tiles, finds, quantum };
}
