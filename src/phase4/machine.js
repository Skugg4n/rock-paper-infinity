/**
 * Chapter IV · THE DEEP: the machine, as the player sees it (deep-machine, step 3 of
 * docs/superpowers/specs/2026-10-02-chapter-iv-tree-and-bio.md, section 4). Pure: no DOM, no three.js.
 *
 * The rule is deep.js's: the machine is fed a share of the spare energy, the energy buys games, one
 * game in three is a win and each win is a star. This file only turns a day's report into what the
 * model on top of the colony does with it: how fast the arms throw, how high they stand, how thick
 * the smoke is, how bright the cables and the tubes are, and the one sentence its hover says.
 *
 * THE TEMPO IS THE STARS A DAY. The games a day climb some twelve orders of magnitude over the
 * chapter, so the throws a second follow their logarithm: a starved machine (little spare energy)
 * throws about once a second with its arms hanging; a fed one runs toward a blur. Asleep it keeps
 * running (it is automated by nature) but slower and quieter, unless it is fed: the more of the
 * spare energy it may draw, the less it slows.
 */

import { feedShare, FEED_MAX, gamesFor, starsFor } from './deep.js';
import { short } from './readout.js';

/** Throws a second at its fastest: past this every arm is a blur. */
export const MAX_THROWS = 14;
/** The decades of games a day at which the machine counts as fully fed (drive 1). */
export const FED_DECADES = 12;
/** Asleep, unfed, it runs at this share of its pace; fed to the top, at all of it. */
export const SLEEP_PACE = 0.45;
/** The lamp's rhythm asleep: the automated rooms' pulse (style-deep.css deep-pulse, 1.4 s). */
export const LAMP_PERIOD = 1.4;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * How the machine runs on this day's report.
 * @param {{games?:number, fed?:number}|null} report - tickDay's report (games and fed)
 * @param {{asleep?:boolean, feed?:number}} [o] - whether the colony sleeps, and the feed bought
 * @returns {{throws:number, drive:number, starved:boolean, quiet:number}}
 *   throws: games a second as drawn (0 when nothing is fed);
 *   drive: 0 (starved, arms hanging) to 1 (fed, standing, smoking, bright);
 *   starved: no spare energy at all, or a machine fed so little it barely turns;
 *   quiet: 1 awake, less asleep (smoke, sparks and glow are scaled by it)
 */
export function machineTempo(report, { asleep = false, feed = 0 } = {}) {
    const games = Math.max(0, (report && report.games) || 0);
    if (!(games > 0)) return { throws: 0, drive: 0, starved: true, quiet: asleep ? SLEEP_PACE : 1 };
    const decades = Math.log10(1 + games);
    const share = feedShare(Math.max(0, Math.min(FEED_MAX, feed || 0)));
    // the arms stand as the machine is fed: half for the share it may draw, half for what it plays
    const drive = clamp01(0.5 * share + 0.5 * decades / FED_DECADES);
    let throws = Math.min(MAX_THROWS, 0.3 + 0.25 * decades + 0.035 * decades * decades);
    const quiet = asleep ? SLEEP_PACE + (1 - SLEEP_PACE) * share : 1;
    throws *= quiet;
    return { throws, drive, starved: drive < 0.2, quiet };
}

/**
 * The machine's hover: what it plays on, live. deep-fix: the playtest of v1.66.0 read "1 energy a
 * day" next to "+81/d" stars and asked how one energy makes 81 stars. So it says the games too, and
 * every number in the readouts' own short form: "The machine plays 243 games a day on 1 energy.
 * Each win is a star: +81/d."
 * @param {{fed?:number, games?:number, stars?:number}|number} r - the day's report (or the energy fed)
 * @returns {string}
 */
export function machineSays(r) {
    const o = typeof r === 'number' ? { fed: r } : (r || {});
    const fed = Math.max(0, o.fed || 0);
    const games = Number.isFinite(o.games) ? Math.max(0, o.games) : gamesFor(fed);
    const stars = Number.isFinite(o.stars) ? Math.max(0, o.stars) : starsFor(fed);
    const energy = fed > 0 && Math.round(fed) < 1 ? 'less than 1' : short(fed);
    return `The machine plays ${short(games)} ${Math.round(games) === 1 ? 'game' : 'games'} a day on ${energy} energy. Each win is a star: +${short(stars)}/d.`;
}

/**
 * The lamp on the machine asleep: 0 to 1, in the automated rooms' rhythm.
 * @param {number} t - seconds
 */
export function lampLevel(t) {
    const k = (t % LAMP_PERIOD) / LAMP_PERIOD;
    return 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(k * Math.PI * 2));
}
