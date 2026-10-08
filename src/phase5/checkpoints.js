/**
 * Chapter V · UNITY: the states the test menu jumps to (src/checkpoints.js v-*).
 * Pure: each is built through the rules' own constructors.
 */
import { newUnity, seedBlob, normalizeGrow, ORGAN_FROM, CELLS, ZOOM_AT, mapFor, cache, totalMass, VAULT_MINDS } from './unity.js';

/** A body on a map of this scale with these experiments done, n cells big. */
function prepared(scale, { ex = [], n = 20, joined = [], thought = 0, insight = 0 } = {}) {
    const minds = 197 + joined.reduce((a, k) => a + VAULT_MINDS[k], 0);
    const s = newUnity({ minds });
    s.memory = Math.round(minds * 0.55);
    s.tut.done.start = true; s.tut.done.storm = true;
    for (let k = 0; k < scale; k++) s.tut.done[`zoom${k}`] = true;
    for (const k of joined) { s.joined[k] = true; s.seen[k] = true; s.tut.done[`join${k}`] = true; }
    for (const id of ex) s.ex[id] = true;
    for (const [o, from] of Object.entries(ORGAN_FROM)) if (s.ex[from]) s.unlocked[o] = true;
    s.grow = { skin: 25, stomach: 25, heart: 20, nerve: 15, tissue: 5 };
    for (const o of Object.keys(s.unlocked)) if (s.grow[o] == null) s.grow[o] = 5;
    normalizeGrow(s, null);
    s.scale = scale; s.scaleAt = 0; s.t = 60 + scale * 400;
    s.order = []; s.bite = 0; s.target = -1;
    seedBlob(s, mapFor(s.seed, scale).start, n);
    cache(s);
    // the body's mass: a little more than it covers, shared as GROW AS says
    const M = n * 1.3;
    for (const o of Object.keys(s.mass)) s.mass[o] = 0;
    for (const [o, g] of Object.entries(s.grow)) s.mass[o] = (M * g) / 100;
    s.thought = thought; s.insight = insight; s.capHit = insight > 0;
    s.introDone = true;
    void totalMass;
    return s;
}

const CITY = ['auto', 'gravel', 'stomach2'];
const LAND = [...CITY, 'eyes', 'edgeknows', 'lungs', 'gut', 'parallel'];
const CONT = [...LAND, 'granite', 'heart2', 'muscle', 'ears'];

export const UNITY_CHECKPOINTS = {
    'v-start': () => newUnity(),
    'v-city-done': () => {
        const s = prepared(0, { ex: CITY, n: Math.round(CELLS * ZOOM_AT) - 25, thought: 900 });
        s.multi = { acid: 2, fibre: 2, vessels: 1 };
        return s;
    },
    'v-land': () => prepared(1, { ex: [...CITY], n: 18, thought: 1500 }),
    'v-continent': () => prepared(3, { ex: CONT, n: 32, joined: [1, 2], thought: 4000, insight: 2 }),
    'v-planet': () => prepared(4, { ex: [...CONT, 'salt', 'nails', 'bone'], n: 36, joined: [1, 2, 3], thought: 8000, insight: 6 }),
};
