/**
 * Chapter IV · THE DEEP, the dig, pass 3 (docs/superpowers/specs/2026-10-09-deep-dig-pass3.md, B):
 * the base under the ground. Pure: the layout only, in tiles, shared by the rules, the autopilot and
 * the picture.
 *
 * The base is the top of the same map. Row -1 is its corridor, the drone drives along it; the rooms
 * are spans of that row. Above the corridor sit the six cryo chambers (36 sleepers each, 216 windows),
 * above them rock, a shaft up to the city, and the ruined city in the storm. Row 0 is the first row
 * of ground; the drone goes down and comes up only through the hatch at HOME_X.
 */

export const HOME_X = 11;
/** The rooms of the corridor, inclusive tile spans. */
export const ROOMS = {
    generator: [0, 3],
    warehouse: [6, 10],
    workshop: [12, 16],
    lab: [19, 23],
};
export const ROOM_NAME = { generator: 'GENERATOR', warehouse: 'WAREHOUSE', workshop: 'WORKSHOP', lab: 'LAB' };
/** The room the drone stands in at the base, or null (the hatch, the corridor between). */
export function roomAt(x) {
    for (const [id, [a, b]] of Object.entries(ROOMS)) if (x >= a && x <= b) return id;
    return null;
}
/** Where the drone stops in a room: the tile nearest the hatch. */
export const roomSpot = (id) => (ROOMS[id][0] > HOME_X ? ROOMS[id][0] : ROOMS[id][1]);

/** The drawing, in rows above row 0 (negative): rooms, chambers, rock, the city. */
export const ROOM_TOP = -3;           // the rooms are three rows tall, the drone on the floor (row -1)
export const CHAMBER_TOP = -7;        // the chambers: rows -7 to -3
export const CITY_ROW = -11;          // the street of the ruined city: the top of row -11
export const TOP_ROW = -16;           // the sky above the city, the top of the world
/** The six chambers: [from, to) in tiles, three each side of the shaft. */
export const CHAMBERS = [[0.6, 3.9], [3.9, 7.2], [7.2, 10.5], [12.5, 15.8], [15.8, 19.1], [19.1, 22.4]];
export const PER_CHAMBER = 36;
/** The chamber a pod sleeps in (pods 1 to 216). */
export const chamberOf = (pod) => Math.floor((pod - 1) / PER_CHAMBER);
/** The chamber over a corridor tile, or -1. */
export function chamberOver(x) {
    const c = x + 0.5;
    return CHAMBERS.findIndex(([a, b]) => c >= a && c < b);
}
