/**
 * Chapter IV · THE DEEP: THE GRAFT, a taste of flesh before The question (deep-grow2). Pure: no DOM,
 * no clock. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "GROW, second pass".
 *
 * Ola on v1.76.0: "Maybe taste a little bio before going full blown crazy. You don't understand what
 * the flesh does." Surface's fourth night gives a GRAFT (it was Quiet hands; that effect is folded
 * into Lossless relay, deep.js upkeepFor), the fifth a second one. The player picks one built room
 * and it turns to flesh: a single organ that never spreads. It makes GRAFT_MULT times what the room
 * made (a dormitory: that many beds), its people walk into it once (GRAFT_TAKE of the colony), and it
 * eats a few people a year (GRAFT_EAT_YEAR of the colony). Nothing else changes.
 *
 * In the save: `state.graft = { owed, slots: ['s12', ...] }` (growth.js ids). In movement III a graft
 * is a chamber like any other: the body takes it at its price when the front reaches it, and from then
 * on it is the body's organ (grow.js organsOf counts it there).
 */

import { ROOMS, MIN_SLEEPERS } from './deep.js';
import { short, PEOPLE_SIGN } from './readout.js';

export { PEOPLE_SIGN };

/** A graft makes this many times what its room made. */
export const GRAFT_MULT = 5;
/** On grafting, this share of the colony walks into it and does not come out. */
export const GRAFT_TAKE = 0.04;
/** A graft eats this share of the colony a year. */
export const GRAFT_EAT_YEAR = 0.01;
/** The nights that give a graft (surface.js NIGHTS has `graft: true` on them). */
export const GRAFT_NIGHTS = [4, 5];

const slotOf = (id) => (typeof id === 'string' && id[0] === 's' ? Number(id.slice(1)) : -1);

/** The graft record, whatever a save held. */
export function normalizeGraft(g) {
    const had = g && typeof g === 'object' ? g : {};
    const slots = Array.isArray(had.slots) ? [...new Set(had.slots.filter((id) => slotOf(id) >= 0))] : [];
    return { owed: Math.max(0, Math.floor(Number(had.owed) || 0)), slots };
}
export const graftOf = (s) => normalizeGraft(s && s.graft);
/** Surface gives a graft to place. */
export function giveGraft(s) {
    s.graft = graftOf(s);
    s.graft.owed += 1;
    return s.graft.owed;
}
/** Is a graft waiting to be placed? */
export const graftOwed = (s) => graftOf(s).owed > 0;

/** The grafted chambers that are not (yet) the body's: the lone organs. */
export function loneGrafts(s) {
    const body = new Set((s && s.grow && Array.isArray(s.grow.body)) ? s.grow.body : []);
    return graftOf(s).slots.filter((id) => !body.has(id));
}

/** The chambers a graft may go into: a built room (not the hall), not dark, not taken, not flesh. */
export function graftCandidates(s, layout) {
    const slots = (layout && layout.slots) || [];
    const skip = new Set([...(s.darkSlots || []), ...(s.takenSlots || [])]);
    const have = new Set(graftOf(s).slots);
    const body = new Set((s.grow && s.grow.body) || []);
    const out = [];
    slots.forEach((t, i) => {
        const id = `s${i}`;
        if (ROOMS.includes(t) && !skip.has(i) && !have.has(id) && !body.has(id)) out.push(id);
    });
    return out;
}
/** The people a graft takes now: GRAFT_TAKE of the colony, at least one, never the last MIN_SLEEPERS. */
export function graftPeople(s) {
    const h = s.humans || 0;
    return Math.max(0, Math.min(Math.max(1, Math.ceil(h * GRAFT_TAKE)), h - MIN_SLEEPERS));
}
/** What the hover says over a candidate, or ''. */
export function graftWords(s, layout, id) {
    if (!graftOwed(s) || !graftCandidates(s, layout).includes(id)) return '';
    return `Five times the output. Takes ${PEOPLE_SIGN} ${short(graftPeople(s))} of your ${PEOPLE_SIGN} ${short(s.humans || 0)}.`;
}
/**
 * The player grafts chamber `id`: it turns to flesh; its people walk in.
 * @returns {{id:string, type:string, people:number}|null}
 */
export function placeGraft(s, layout, id) {
    if (!graftOwed(s) || !graftCandidates(s, layout).includes(id)) return null;
    const g = graftOf(s);
    const people = graftPeople(s);
    s.humans = (s.humans || 0) - people;
    g.owed -= 1;
    g.slots.push(id);
    s.graft = g;
    return { id, type: layout.slots[slotOf(id)], people };
}

/**
 * What the lone grafts add, counted in rooms of their old output (deep.js tickDay reads it through
 * `state.organs`), and the share of the colony they eat a day (`eat`).
 * @returns {{mine:number, farm:number, generator:number, dorm:number, eat:number}}
 */
export function graftOrgans(s, layout) {
    const out = { mine: 0, farm: 0, generator: 0, dorm: 0, eat: 0 };
    const slots = (layout && layout.slots) || [];
    const skip = new Set([...(s.darkSlots || []), ...(s.takenSlots || [])]);
    for (const id of loneGrafts(s)) {
        const i = slotOf(id);
        const t = slots[i];
        if (!ROOMS.includes(t) || skip.has(i)) continue;
        out[t] += GRAFT_MULT - 1;
        out.eat += GRAFT_EAT_YEAR / 365;
    }
    return out;
}
