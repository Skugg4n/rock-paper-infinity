/**
 * Chapter V · UNITY: the ground the body eats (docs/superpowers/specs/2026-10-06-chapter-v-unity.md).
 * One map per scale, seeded, the same every time: a grid of cells, each ROCK, PAPER or SCISSORS
 * (the three things the edge plays against) and maybe an obstacle (poison, granite, sea, cold; the
 * river is only water). Storms are weather, not ground: bands that move over the map (stormAt).
 * Pure. The map is rebuilt from (seed, scale), never saved.
 */

export const MAP_W = 64;
export const MAP_H = 40;
export const CELLS = MAP_W * MAP_H;
/** The three kinds of ground. */
export const ROCK = 0, PAPER = 1, SCISSORS = 2;
export const CLASS_NAMES = ['ROCK', 'PAPER', 'SCISSORS'];
/** Obstacles in the ground. */
export const NONE = 0, POISON = 1, GRANITE = 2, SEA = 3, COLD = 4, RIVER = 5, DEEP = 6;
export const OBST_NAMES = ['', 'poison', 'granite', 'sea', 'cold', 'river', 'deep river'];
/** What a cell gives when eaten, by class, and the obstacles that replace it. */
export const RICH = [1.0, 1.6, 1.3];
export const OBST_RICH = { [POISON]: 1.9, [GRANITE]: 1.3, [SEA]: 0.6, [COLD]: 1.1, [RIVER]: 0.8, [DEEP]: 0.9 };
/** The city's storm wall: this many cells in from the map's rim. */
export const RIM = 4;
/** The planet: continents' centres and sizes, in cells. */
export const CONTINENTS = [[32, 20, 8], [9, 13, 5.5], [55, 12, 6], [11, 29, 5.5], [53, 29, 6], [32, 7, 4]];
/** Storm waves: one every WAVE_S seconds, on for WAVE_ON, this strong by scale (more than 1 = more than a plain storm). */
export const WAVE_S = 60;
export const WAVE_ON = 15;
export const WAVE = [1.6, 1.6, 1.8, 2, 0];
/** Each wave on a map is this much stronger than the one before (up to WAVE_MAX); on the land the first comes after WAVE_FIRST s. */
export const WAVE_GROW = 0.3;
export const WAVE_MAX = 3.2;
export const WAVE_FIRST = 40;
/** Seconds of play before the moving storms reach the city. */
export const CITY_WEATHER_AT = 200;

/** A small seeded generator. */
export function rng(seed) {
    let a = (Math.floor(seed) >>> 0) || 1;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Value noise on the grid, smooth, 0..1. */
function noiseField(R, scale) {
    const gw = Math.ceil(MAP_W / scale) + 2, gh = Math.ceil(MAP_H / scale) + 2;
    const g = Array.from({ length: gw * gh }, () => R());
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
        const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
        const u = sm(fx - ix), v = sm(fy - iy);
        const at = (a, b) => g[b * gw + a];
        return at(ix, iy) * (1 - u) * (1 - v) + at(ix + 1, iy) * u * (1 - v) + at(ix, iy + 1) * (1 - u) * v + at(ix + 1, iy + 1) * u * v;
    };
}
export const idx = (x, y) => y * MAP_W + x;
export const cx = (i) => i % MAP_W;
export const cy = (i) => Math.floor(i / MAP_W);
export function neighbours(i) {
    const x = cx(i), y = cy(i), out = [];
    if (x > 0) out.push(i - 1);
    if (x < MAP_W - 1) out.push(i + 1);
    if (y > 0) out.push(i - MAP_W);
    if (y < MAP_H - 1) out.push(i + MAP_W);
    return out;
}

const cache = new Map();
/**
 * The map of one scale: { cls: Uint8Array, obst: Uint8Array, rim: Uint8Array, noise: Float32Array,
 * start: cell index, vault: cell index or -1, land: Uint8Array (planet: which continent, 0 = sea) }.
 */
export function mapFor(seed, scale) {
    const key = `${seed}|${scale}`;
    if (cache.has(key)) return cache.get(key);
    const R = rng(seed * 977 + scale * 131 + 7);
    const n1 = noiseField(R, 9), n2 = noiseField(R, 5), n3 = noiseField(R, 14), n4 = noiseField(R, 3);
    // the ground comes in districts: one kind over a patch, so a change of EDGE is a choice, not a chore
    const nd = noiseField(R, 11);
    const district = (x, y) => { const v = nd(x, y); return v < 0.4 ? PAPER : v < 0.6 ? ROCK : SCISSORS; };
    const cls = new Uint8Array(CELLS), obst = new Uint8Array(CELLS), rim = new Uint8Array(CELLS), noise = new Float32Array(CELLS);
    const land = new Uint8Array(CELLS);
    const mx = MAP_W / 2, my = MAP_H / 2;
    for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
            const i = idx(x, y);
            const a = n1(x, y), b = n2(x, y), c = n3(x, y);
            noise[i] = n4(x, y);
            const d = Math.hypot((x - mx) / mx, (y - my) / my);
            let k;
            if (scale === 0) {
                // the city: towers (steel) in the core, concrete around, parks between
                // a city district: towers, concrete or parks; a park block here and there anywhere
                const dx = Math.floor(x / 8), dy = Math.floor(y / 6);
                const h = Math.abs(Math.sin(dx * 12.9898 + dy * 78.233 + seed) * 43758.5453) % 1;
                k = b > 0.8 ? PAPER : h < 0.36 ? SCISSORS : h < 0.7 ? ROCK : PAPER;
                void a;
                if (Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y) < RIM) rim[i] = 1;
            } else if (scale === 1) {
                // the county: fields and forest, rock hills, small towns
                k = district(x, y);
                if (c > 0.56 && d > 0.25) obst[i] = POISON;
                // poison close to where the body arrives (it bites within a minute), on one side
                const rs = Math.hypot(x - mx, (y - my) * 1.3);
                if (rs > 5.5 && rs < 8 && x > mx - 2 && a > 0.3) obst[i] = POISON;
                // the deep river: halfway out, across the county; only muscle pulls the edge over it
                const rx = mx + 15 + 3 * Math.sin(y * 0.35 + seed);
                if (Math.abs(x - rx) < 1.1) obst[i] = DEEP;
            } else if (scale === 2) {
                k = district(x, y);
                // a mountain chain across the country, halfway out, with a few passes
                const ry = my - 9 + (x - mx) * 0.35 + 2.5 * Math.sin(x * 0.3 + seed);
                if (Math.abs(y - ry) < 1.6 && c > 0.22) obst[i] = GRANITE;
                else if (a > 0.66 && d > 0.3) obst[i] = GRANITE;
                else if (c > 0.68 && d > 0.3) obst[i] = POISON;
            } else if (scale === 3) {
                k = district(x, y);
                const coast = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y) < 2 + c * 3;
                if (coast || (c < 0.22 && d > 0.3)) obst[i] = SEA;
                else if (a > 0.66 && d > 0.25) obst[i] = GRANITE;
            } else {
                // the planet: land in continents, sea between, cold at the poles
                k = district(x, y);
                const pole = y < 4 || y >= MAP_H - 4;
                // six continents, seas between (the home one in the middle)
                let landHere = false;
                for (const [px, py, pr] of CONTINENTS) {
                    if (Math.hypot((x - px) / 1.25, y - py) < pr * (0.75 + c * 0.5)) landHere = true;
                }
                if (pole) obst[i] = COLD;
                else if (!landHere) obst[i] = SEA;
            }
            cls[i] = k;
        }
    }
    let start = idx(Math.floor(mx), Math.floor(my));
    if (scale === 0) {
        // the river: a band that winds across the city, through the middle
        for (let x = 0; x < MAP_W; x++) {
            const ry = Math.round(my + 7 * Math.sin(x * 0.11 + seed) + 3 * Math.sin(x * 0.31));
            for (const y of [ry, ry + 1]) if (y >= 0 && y < MAP_H) { obst[idx(x, y)] = RIVER; cls[idx(x, y)] = PAPER; }
        }
        if (obst[start] === RIVER) start = idx(Math.floor(mx), Math.floor(my) - 3);
    }
    // the start and its neighbourhood are plain ground (the body lands somewhere it can eat)
    for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) {
        const j = idx(cx(start) + x, cy(start) + y);
        if (obst[j] !== RIVER) obst[j] = NONE;
    }
    // the planet's continents: flood-fill the land, number them
    if (scale === 4) {
        let k = 0;
        for (let i = 0; i < CELLS; i++) {
            if (obst[i] === SEA || land[i]) continue;
            k++;
            const stack = [i]; land[i] = k;
            while (stack.length) {
                const j = stack.pop();
                for (const n of neighbours(j)) if (!land[n] && obst[n] !== SEA) { land[n] = k; stack.push(n); }
            }
        }
    }
    // the vault of this scale: far enough out that the body has to choose to go there
    let vault = -1;
    if (scale >= 1 && scale <= 3) {
        const ang = R() * Math.PI * 2;
        for (let r = 0.62; r > 0.2 && vault < 0; r -= 0.04) {
            const vx = Math.round(mx + Math.cos(ang) * mx * r), vy = Math.round(my + Math.sin(ang) * my * r);
            const j = idx(Math.max(1, Math.min(MAP_W - 2, vx)), Math.max(1, Math.min(MAP_H - 2, vy)));
            if (obst[j] === NONE) vault = j;
        }
        if (vault >= 0) cls[vault] = SCISSORS;
    }
    // the planet's coasts: sea within two cells of land (the shore creeps only there)
    const coast = new Uint8Array(CELLS);
    if (scale === 4) {
        for (let i = 0; i < CELLS; i++) {
            if (obst[i] !== SEA) continue;
            for (let dy = -2; dy <= 2 && !coast[i]; dy++) for (let dx = -2; dx <= 2; dx++) {
                const x = cx(i) + dx, y = cy(i) + dy;
                if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && land[idx(x, y)]) { coast[i] = 1; break; }
            }
        }
    }
    const m = { seed, scale, cls, obst, rim, noise, start, vault, land, coast };
    cache.set(key, m);
    return m;
}

/**
 * Storm over a cell at a time (seconds of play): 0..1. Dark bands that drift across the map; in the
 * city the rim is a standing wall of it (the city's edges).
 */
export function stormAt(m, i, t, scale) {
    if (scale === 0 && m.rim[i]) return 1;
    if (scale >= 4) return 0;
    // the city's own weather starts when the body is out in it (after the hand)
    if (scale === 0 && t < CITY_WEATHER_AT) return 0;
    const x = cx(i), y = cy(i);
    // the waves: every WAVE_S a front sweeps the map from the west for WAVE_ON seconds
    // t is the time on this map; each wave a little stronger than the last, so the skin is asked again
    const tw = t - (scale === 0 ? CITY_WEATHER_AT : WAVE_FIRST);
    let wave = 0;
    if (tw >= 0 && tw % WAVE_S < WAVE_ON) {
        const front = (tw % WAVE_S) / WAVE_ON * (MAP_W + 30) - 15;
        const dz = ((x + y * 0.3) - front) / 9;
        const n = Math.floor(tw / WAVE_S);
        wave = Math.min(WAVE_MAX, WAVE[scale] * (1 + WAVE_GROW * n)) * Math.exp(-dz * dz);
    }
    const s = Math.sin((x * 0.7 + y * 0.45) * 0.21 - t * 0.09 + m.seed) + Math.sin((x * 0.3 - y * 0.8) * 0.17 + t * 0.05);
    const v = (s - 1.2) / 0.8;
    return Math.max(wave, v > 0 ? Math.min(1, v) : 0);
}
