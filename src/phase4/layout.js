/**
 * Chapter IV · THE DEEP: where a chamber ends up. Pure, no DOM, no three.js:
 * the scene asks this module where to put things, and the save stores what it
 * answered, so the colony looks the same on every reload.
 *
 * A floor is a landing at the shaft with chambers dug out around it, ring by
 * ring: the four arms first (north, east, south, west), then the eight cells of
 * the next ring out. Twelve chambers to a floor; the thirteenth is dug on the
 * floor below, reached by the stairs in the shaft.
 *
 * Cells are counted in plates, not metres. The scene multiplies by its pitch.
 */

/** The four arms off the landing: north, east, south, west. */
export const RING_1 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/** The ring outside them, walked round from the north. Every cell here touches
 *  one of the arms, so a floor is always one connected piece of ground. */
export const RING_2 = [[0, -2], [1, -1], [2, 0], [1, 1], [0, 2], [-1, 1], [-2, 0], [-1, -1]];
/**
 * THE FOUR SECTORS (v1.50.0). Every floor is cut into four sectors, one per arm: the arm, the
 * cell beyond it, and the diagonal clockwise of it. Numbered 1 to 4 on screen (north, east,
 * south, west), 0 to 3 here. What the Watcher's body seals is a sector, on every floor at once.
 */
export const SECTORS = 4;
const SECTOR_OF_CELL = {
    '0,-1': 0, '0,-2': 0, '1,-1': 0,
    '1,0': 1, '2,0': 1, '1,1': 1,
    '0,1': 2, '0,2': 2, '-1,1': 2,
    '-1,0': 3, '-2,0': 3, '-1,-1': 3,
};
/** Which sector chamber number `index` is in. */
export function sectorOf(index) {
    const p = placeChamber(index);
    return SECTOR_OF_CELL[`${p.x},${p.z}`];
}
/** Chamber cells in the order they are dug. The centre is the landing, never a chamber. */
export const CHAMBER_CELLS = [...RING_1, ...RING_2];
export const CHAMBERS_PER_FLOOR = CHAMBER_CELLS.length;

/**
 * Where chamber number `index` sits: which floor, and which cell of that floor.
 * @param {number} index - 0 is the first chamber ever dug
 * @returns {{floor:number, x:number, z:number}}
 */
export function placeChamber(index) {
    const i = Math.max(0, Math.floor(index));
    const floor = Math.floor(i / CHAMBERS_PER_FLOOR);
    const cell = CHAMBER_CELLS[i % CHAMBERS_PER_FLOOR];
    return { floor, x: cell[0], z: cell[1] };
}

/** How many floors a colony of `chambers` chambers has dug into (at least one). */
export function floorCount(chambers) {
    return Math.max(1, Math.ceil(Math.max(0, chambers) / CHAMBERS_PER_FLOOR));
}

/**
 * The layout that goes with a fresh state: the rooms it came down with, laid
 * out in the order the rooms are listed, then empty chambers for the rest.
 * @param {object} state - a deep state (chambers, rooms)
 * @param {string[]} order - room types, in the order they take chambers
 * @returns {{slots: (string|null)[]}}
 */
export function initialLayout(state, order = ['mine', 'farm', 'generator', 'dorm', 'cryo']) {
    const slots = [];
    for (const type of order) {
        for (let i = 0; i < (state.rooms?.[type] || 0); i++) slots.push(type);
    }
    while (slots.length < (state.chambers || 0)) slots.push(null);
    return { slots };
}

/** The first chamber standing empty, or -1 when every one is taken. */
export function freeChamber(layout) {
    return (layout?.slots || []).findIndex((s) => !s);
}

/**
 * Reads a layout back from a save and makes it fit the state it is saved with:
 * a layout that lost a chamber, or a state that gained one, still opens.
 * @param {object} state - the deep state the layout belongs to
 * @param {object|null} saved - what came out of localStorage
 * @returns {{slots: (string|null)[]}}
 */
export function normalizeLayout(state, saved) {
    if (!saved || !Array.isArray(saved.slots)) return initialLayout(state);
    const slots = saved.slots.slice(0, state.chambers || 0).map((s) => (s ? String(s) : null));
    while (slots.length < (state.chambers || 0)) slots.push(null);
    // The state's room counts are the truth; the layout only says where they are.
    for (const type of Object.keys(state.rooms || {})) {
        let have = slots.filter((s) => s === type).length;
        const want = state.rooms[type] || 0;
        while (have > want) { slots[slots.lastIndexOf(type)] = null; have--; }
        while (have < want) {
            const i = slots.indexOf(null);
            if (i < 0) break;
            slots[i] = type; have++;
        }
    }
    return { slots };
}

/**
 * deep-rebuild: every room on order gets the empty chamber it will be built in, so the plate it
 * goes into shows the room (and its ring) at once and no other order takes it. An order that keeps
 * a chamber still empty keeps it; one with none (or one whose chamber is no longer empty) takes the
 * first empty chamber nobody has claimed; one that waits for a chamber still being dug keeps -1.
 * @param {object} state - mutated: the slot on each room order
 * @param {{slots:(string|null)[]}} layout
 * @returns {number} how many orders changed their chamber
 */
export function claimChambers(state, layout) {
    const slots = (layout && layout.slots) || [];
    const claimed = new Set();
    let moved = 0;
    const rooms = (state.builds || []).filter((j) => j.kind === 'room');
    for (const j of rooms) {
        if (Number.isInteger(j.slot) && j.slot >= 0 && j.slot < slots.length && !slots[j.slot] && !claimed.has(j.slot)) claimed.add(j.slot);
        else if (j.slot !== -1) { j.slot = -1; moved++; }
    }
    for (const j of rooms) {
        if (j.slot >= 0) continue;
        const i = slots.findIndex((s, k) => !s && !claimed.has(k));
        if (i < 0) break;
        j.slot = i;
        claimed.add(i);
        moved++;
    }
    return moved;
}
/** The chambers dug and empty that no order has claimed: where a "+" stands. */
export function emptyChambers(state, layout) {
    const claimed = new Set((state.builds || []).filter((j) => j.kind === 'room' && j.slot >= 0).map((j) => j.slot));
    return ((layout && layout.slots) || []).map((s, i) => (!s && !claimed.has(i) ? i : -1)).filter((i) => i >= 0);
}
