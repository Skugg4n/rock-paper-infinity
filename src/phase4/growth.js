/**
 * Chapter IV · THE DEEP, movement III · GROW: the body, as rules. Pure: no DOM, no three.js, no
 * picture of any kind. The colony is a GRAPH of chambers (nodes on floors, joined by edges) and the
 * body is a set of node ids in it. Any view can draw it: the 3D slabs, a flat plan from above, a
 * cross-section. See docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "III · GROW".
 *
 * THE GRAPH
 *   { heart, nodes: [{ id, floor, kind, type }], edges: [{ a, b, kind }] }
 *   kind of node: 'hub' (a landing at the shaft; the one on floor 0 is the lid), 'room', 'machine'.
 *   type: the room's type ('mine', 'farm', 'generator', 'dorm', 'cryo') or null (dug, empty).
 *   kind of edge: 'bridge' (two chambers side by side on one floor) or 'spine' (up or down the
 *   shaft: hub to hub, and the lid up the neck to the machine house).
 *   `graphFromSlots(slots)` builds it from the game's layout; a new view may build its own.
 *
 * THE RULES
 *   - The heart (the lid plate) is the first organ.
 *   - A node is REACHABLE when it is not body and a LIVING body node next to it lets it in: over a
 *     bridge always (so the front is one connected thing on one floor), over a spine edge only when
 *     the body's floor is full (every node on it is body). So: fill a floor, the shaft becomes the
 *     spine, the landing under the lid on the next floor opens; fill floor 0 and the neck opens up
 *     to the machine house.
 *   - take() moves a reachable node into the body, and refuses anything else.
 *   - Every year the body eats people. If there are not enough, the OUTERMOST living organ (farthest
 *     from the heart through the body) goes NECROTIC: it stops producing, eats nothing, greys. One a
 *     year, while the hunger lasts. When people are back, the innermost necrotic organ revives, one a
 *     year. Necrotic flesh is still body (the front stays connected) but does not spread.
 *   - A dormitory the body takes becomes a VAT: it grows people instead of housing them. Vats, the
 *     heart and the machine never die back (they are what the body cannot lose).
 *   - Ready to rise: the deepest floor is full and the machine house is body.
 *
 * Every number is a named constant below. They are first guesses; the integration tunes them with
 * the sim (scripts/sim-phase4.mjs), not by feel.
 */

import { placeChamber } from './layout.js';

/** People a year one organ eats on floor 0 at level 0. */
export const EAT_PER_ORGAN = 3;
/** Each level of the room an organ grew over adds this share to what it eats (level 10: x2). */
export const EAT_PER_LEVEL = 0.1;
/** Each floor down is hungrier by this factor (floor 2 eats 1.6 x 1.6 = 2.56 times floor 0). */
export const HUNGER_FLOOR_GROWTH = 1.6;
/** People a year the machine house eats once it is body. */
export const EAT_MACHINE = 12;
/** People a year one vat (a dormitory the body took) grows at dormitory level 0. */
export const VAT_GROWTH = 10;
/** Each dormitory level adds this share to a vat's growth. */
export const VAT_PER_LEVEL = 0.15;
/** A living organ makes this many times what the room made as machinery... */
export const BODY_OUTPUT = 20;
/** ...times this per floor down (floor 1: x30, floor 2: x45). */
export const OUTPUT_FLOOR_GROWTH = 1.5;
/** Organs that die back per hungry year. */
export const NECROSIS_PER_YEAR = 1;
/** Organs that revive per fed year. */
export const REVIVE_PER_YEAR = 1;
/** A necrotic organ revives only when the people left after the year's meal cover this many years
 *  of what it will eat: so the body does not flicker in and out at the edge of hunger. */
export const REVIVE_COVER = 2;
/** The mass of one living organ on floor 0; deeper organs weigh more by MASS_FLOOR_GROWTH a floor. */
export const MASS_PER_ORGAN = 1;
export const MASS_FLOOR_GROWTH = 1.5;
/** The machine house's mass when it is body (it is the hands). */
export const MASS_MACHINE = 4;
/** advance() never steps more single years than this; past it the rest is extrapolated. */
export const MAX_STEPPED_YEARS = 20000;

/** The landing of floor `f` (the heart is the landing of floor 0, under the lid). */
export const hubId = (f) => `h${f}`;
/** Chamber number `slot` in the layout. */
export const slotId = (slot) => `s${slot}`;
export const HEART = hubId(0);
export const MACHINE = 'machine';
/** The layout slot of a chamber id, or -1 for a hub or the machine. */
export function slotOf(id) {
    return typeof id === 'string' && id[0] === 's' ? Number(id.slice(1)) : -1;
}

/**
 * The graph of a colony from the game's layout (layout.js decides where a chamber sits; that is a
 * rule about cells, not a picture). Every floor has its landing at cell (0, 0); chambers are joined
 * to their four neighbours on the same floor; landings are joined down the shaft; the lid is joined
 * up the neck to the machine house.
 * @param {(string|null)[]} slots - the layout's slots: a room type per chamber, null when empty
 * @param {Function} [place] - (index) => {floor, x, z}; layout.js placeChamber by default
 * @returns {{heart:string, nodes:object[], edges:object[]}}
 */
export function graphFromSlots(slots, place = placeChamber) {
    const list = Array.isArray(slots) ? slots : [];
    const cells = new Map();
    const nodes = [];
    let deepest = 0;
    list.forEach((type, i) => { deepest = Math.max(deepest, place(i).floor); });
    for (let f = 0; f <= deepest; f++) {
        const n = { id: hubId(f), floor: f, kind: 'hub', type: null, x: 0, z: 0 };
        nodes.push(n);
        cells.set(`${f}:0,0`, n);
    }
    list.forEach((type, i) => {
        const p = place(i);
        const n = { id: slotId(i), floor: p.floor, kind: 'room', type: type || null, x: p.x, z: p.z };
        nodes.push(n);
        cells.set(`${p.floor}:${p.x},${p.z}`, n);
    });
    const edges = [];
    for (const n of nodes) {
        for (const [dx, dz] of [[1, 0], [0, 1]]) {
            const m = cells.get(`${n.floor}:${n.x + dx},${n.z + dz}`);
            if (m) edges.push({ a: n.id, b: m.id, kind: 'bridge' });
        }
    }
    for (let f = 0; f < deepest; f++) edges.push({ a: hubId(f), b: hubId(f + 1), kind: 'spine' });
    nodes.push({ id: MACHINE, floor: -1, kind: 'machine', type: null, x: 0, z: 0 });
    edges.push({ a: HEART, b: MACHINE, kind: 'spine' });
    return { heart: HEART, nodes, edges };
}

/* ------------------------------------------------------------------ lookups, cached per graph */

const cache = new WeakMap();
function look(graph) {
    let c = cache.get(graph);
    if (c) return c;
    const byId = new Map();
    const adj = new Map();
    const floors = new Map();
    let deepest = 0;
    for (const n of graph.nodes) {
        byId.set(n.id, n);
        adj.set(n.id, []);
        if (n.floor >= 0) {
            if (!floors.has(n.floor)) floors.set(n.floor, []);
            floors.get(n.floor).push(n.id);
            deepest = Math.max(deepest, n.floor);
        }
    }
    for (const e of graph.edges) {
        if (!byId.has(e.a) || !byId.has(e.b)) continue;
        adj.get(e.a).push({ to: e.b, kind: e.kind });
        adj.get(e.b).push({ to: e.a, kind: e.kind });
    }
    c = { byId, adj, floors, deepest };
    cache.set(graph, c);
    return c;
}

/** A fresh body: the heart and nothing else. */
export function createGrowth(graph) {
    return { body: [graph.heart || HEART], necrotic: [], years: 0 };
}

const isVat = (n) => !!n && n.kind === 'room' && n.type === 'dorm';
/** True for an organ that never dies back: the heart, the machine, a vat. */
export function isProtected(graph, id) {
    const n = look(graph).byId.get(id);
    return id === graph.heart || (n && n.kind === 'machine') || isVat(n);
}
export function isBody(state, id) { return state.body.includes(id); }
export function isNecrotic(state, id) { return state.necrotic.includes(id); }
export function isVatOrgan(graph, state, id) { return isBody(state, id) && isVat(look(graph).byId.get(id)); }

/** Is every node on floor `f` body? */
export function floorFull(graph, state, f) {
    const ids = look(graph).floors.get(f);
    if (!ids || !ids.length) return false;
    const body = new Set(state.body);
    return ids.every((id) => body.has(id));
}

/** The nodes the body can take now, each with the living organ it would grow from. */
export function reachableFrom(graph, state) {
    const { adj, byId } = look(graph);
    const body = new Set(state.body);
    const dead = new Set(state.necrotic);
    const out = new Map();
    for (const id of state.body) {
        if (dead.has(id)) continue;
        const floor = byId.get(id)?.floor;
        for (const { to, kind } of adj.get(id) || []) {
            if (body.has(to) || out.has(to)) continue;
            if (kind === 'spine' && !floorFull(graph, state, floor)) continue;
            out.set(to, id);
        }
    }
    return out;
}
/** The ids the body can take now. */
export function reachable(graph, state) { return [...reachableFrom(graph, state).keys()]; }

/** Why the body cannot take `id`, or '' when it can. */
export function whyNot(graph, state, id) {
    if (!look(graph).byId.has(id)) return 'There is no such chamber.';
    if (isBody(state, id)) return 'It is already body.';
    if (!reachableFrom(graph, state).has(id)) return 'The body does not touch it.';
    return '';
}

/**
 * The body takes `id`. Returns a new state, or the SAME state object when it is refused (so a
 * caller can test `next === state`).
 */
export function take(graph, state, id) {
    if (whyNot(graph, state, id)) return state;
    return { ...state, body: [...state.body, id] };
}

/** Graph distance from the heart to every body node, walking through the body only. */
export function distances(graph, state) {
    const { adj } = look(graph);
    const body = new Set(state.body);
    const d = new Map([[graph.heart, 0]]);
    const queue = [graph.heart];
    while (queue.length) {
        const id = queue.shift();
        for (const { to } of adj.get(id) || []) {
            if (!body.has(to) || d.has(to)) continue;
            d.set(to, d.get(id) + 1);
            queue.push(to);
        }
    }
    return d;
}

/** What one organ eats a year (0 when necrotic, or a vat). */
export function eatOf(graph, state, id, levels = {}) {
    const n = look(graph).byId.get(id);
    if (!n || !isBody(state, id) || isNecrotic(state, id) || isVat(n)) return 0;
    if (n.kind === 'machine') return EAT_MACHINE;
    const lvl = n.type ? (levels[n.type] || 0) : 0;
    return EAT_PER_ORGAN * (1 + EAT_PER_LEVEL * lvl) * Math.pow(HUNGER_FLOOR_GROWTH, Math.max(0, n.floor));
}
/** What the whole body eats a year, and what its vats grow. */
export function hunger(graph, state, levels = {}) {
    let eat = 0, grow = 0;
    const { byId } = look(graph);
    for (const id of state.body) {
        eat += eatOf(graph, state, id, levels);
        const n = byId.get(id);
        if (isVat(n) && !isNecrotic(state, id)) grow += VAT_GROWTH * (1 + VAT_PER_LEVEL * (levels.dorm || 0));
    }
    return { eat, grow, net: grow - eat };
}

/**
 * One year of the body. Vats grow, then the body eats; short, the outermost organ dies back; with
 * people to spare, the innermost necrotic one revives.
 * @param {object} graph
 * @param {object} state
 * @param {number} people - the colony's people (awake or not, they are food)
 * @param {object} [opts] - { levels: {type: level} } the rooms' levels
 * @returns {{state:object, people:number, eaten:number, grown:number, died:string[], revived:string[]}}
 */
export function tick(graph, state, people, opts = {}) {
    const levels = opts.levels || {};
    const { eat, grow } = hunger(graph, state, levels);
    let p = Math.max(0, people || 0) + grow;
    const died = [], revived = [];
    let necrotic = state.necrotic.slice();
    const eaten = Math.min(p, eat);
    if (p >= eat) {
        p -= eat;
        // fed: the innermost necrotic organ comes back, if what is left will feed it for a while
        if (necrotic.length) {
            const d = distances(graph, state);
            const order = necrotic.slice().sort((a, b) => (d.get(a) ?? 1e9) - (d.get(b) ?? 1e9));
            for (const id of order) {
                if (revived.length >= REVIVE_PER_YEAR) break;
                const cost = eatOf(graph, { ...state, necrotic: [] }, id, levels);
                if (p < cost * REVIVE_COVER) break;
                revived.push(id);
            }
            necrotic = necrotic.filter((id) => !revived.includes(id));
        }
    } else {
        p = 0;
        // hungry: the edge dies back, the farthest from the heart first, the last taken on a tie
        const d = distances(graph, state);
        const living = state.body
            .map((id, i) => ({ id, i }))
            .filter(({ id }) => !necrotic.includes(id) && !isProtected(graph, id));
        living.sort((a, b) => ((d.get(b.id) ?? 0) - (d.get(a.id) ?? 0)) || (b.i - a.i));
        for (const { id } of living.slice(0, NECROSIS_PER_YEAR)) { necrotic.push(id); died.push(id); }
    }
    return {
        state: { ...state, necrotic, years: (state.years || 0) + 1 },
        people: p, eaten, grown: grow, died, revived,
    };
}

/**
 * Many years at once (a sleep, a fast-forward). Steps year by year while something can change and
 * jumps over the stretches where nothing can: a fed body with nothing necrotic just adds its net.
 * @returns {{state:object, people:number, died:string[], revived:string[]}}
 */
export function advance(graph, state, people, years, opts = {}) {
    let s = state, p = Math.max(0, people || 0);
    let left = Math.max(0, Math.floor(years || 0));
    const died = [], revived = [];
    let stepped = 0;
    while (left > 0) {
        const { net } = hunger(graph, s, opts.levels || {});
        if (!s.necrotic.length && net >= 0) {
            // nothing can die and nothing is dead: the rest is a straight line
            p += net * left;
            s = { ...s, years: (s.years || 0) + left };
            break;
        }
        if (!s.necrotic.length && net < 0 && p + net >= 0) {
            // eating into the reserve: skip to the year before it runs out
            const safe = Math.min(left, Math.floor(p / -net));
            if (safe > 1) {
                p += net * (safe - 1);
                s = { ...s, years: (s.years || 0) + safe - 1 };
                left -= safe - 1;
                continue;
            }
        }
        if (stepped >= MAX_STEPPED_YEARS) {
            p = Math.max(0, p + net * left);
            s = { ...s, years: (s.years || 0) + left };
            break;
        }
        const r = tick(graph, s, p, opts);
        s = r.state; p = r.people;
        died.push(...r.died); revived.push(...r.revived);
        left--; stepped++;
    }
    return { state: s, people: p, died, revived };
}

/**
 * How many times its old output an organ makes: 1 for a chamber that is still machinery, 0 for a
 * necrotic organ, BODY_OUTPUT x OUTPUT_FLOOR_GROWTH^floor for a living one (the machine house: its
 * games).
 */
export function outputMultiplier(graph, state, id) {
    const n = look(graph).byId.get(id);
    if (!n) return 0;
    if (!isBody(state, id)) return 1;
    if (isNecrotic(state, id)) return 0;
    if (n.kind === 'machine') return BODY_OUTPUT;
    return BODY_OUTPUT * Math.pow(OUTPUT_FLOOR_GROWTH, Math.max(0, n.floor));
}

/**
 * What every room type makes, counted in rooms of its old output: a mine that is still machinery
 * counts 1, a living organ that was a mine counts 20 or more, a necrotic one 0. The rules in deep.js
 * can use this in place of the room count.
 * @returns {Object<string, {rooms:number, body:number, necrotic:number, effective:number}>}
 */
export function roomOutput(graph, state) {
    const out = {};
    for (const n of graph.nodes) {
        if (n.kind !== 'room' || !n.type) continue;
        const o = out[n.type] || (out[n.type] = { rooms: 0, body: 0, necrotic: 0, effective: 0 });
        o.rooms++;
        if (isBody(state, n.id)) o.body++;
        if (isNecrotic(state, n.id)) o.necrotic++;
        o.effective += isVat(n) && isBody(state, n.id) ? 0 : outputMultiplier(graph, state, n.id);
    }
    return out;
}

/** The body's mass: what the screen shows as MASS. Living organs only, deeper ones weigh more. */
export function mass(graph, state) {
    const { byId } = look(graph);
    let m = 0;
    for (const id of state.body) {
        if (isNecrotic(state, id)) continue;
        const n = byId.get(id);
        if (!n) continue;
        m += n.kind === 'machine' ? MASS_MACHINE : MASS_PER_ORGAN * Math.pow(MASS_FLOOR_GROWTH, Math.max(0, n.floor));
    }
    return m;
}

/** Can the body rise? The deepest floor full and the machine house body. */
export function riseReady(graph, state) {
    const { deepest } = look(graph);
    const deepestFull = floorFull(graph, state, deepest);
    const machine = isBody(state, MACHINE) && look(graph).byId.has(MACHINE);
    return { ready: deepestFull && machine, deepestFull, machine, deepest };
}

/** The deepest floor the body has reached, and how much of it is body (0 to 1), for a view. */
export function front(graph, state) {
    const { byId, floors } = look(graph);
    let floor = 0;
    for (const id of state.body) floor = Math.max(floor, byId.get(id)?.floor ?? 0);
    const ids = floors.get(floor) || [];
    const body = new Set(state.body);
    return { floor, share: ids.length ? ids.filter((id) => body.has(id)).length / ids.length : 0 };
}
