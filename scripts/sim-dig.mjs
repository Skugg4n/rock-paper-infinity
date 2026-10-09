// Chapter IV · THE DEEP, the dig: a headless run with a plausible player (src/phase4d/autopilot.js).
//   node scripts/sim-dig.mjs [--minutes 40] [--seed 7] [--careless]
// One line a minute: minute, depth record, parts, upgrades, sleepers, colony %; then the moments.
// Time is the player's: the game's clock plus the seconds spent reading stops (the game is paused then).
import { newState, step, sleepers, ROWS, stopOpen } from '../src/phase4d/dig.js';
import { decide, readStop } from '../src/phase4d/autopilot.js';
import { depthOf } from '../src/phase4d/world.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : d; };
const MIN = arg('--minutes', 40);
const careless = process.argv.includes('--careless');
const s = newState(arg('--seed', 7));
const mem = {};
const DT = 0.05;
let read = 0;                                   // seconds spent on stops
const wall = () => s.time + read;
const moments = [];
const news = [];                                // when something new came on the screen (player seconds)
const mark = (what) => moments.push(`${(wall() / 60).toFixed(2).padStart(6)} min  ${what}`);
const firsts = {};
const first = (k, what) => { if (firsts[k] === undefined) { firsts[k] = wall(); mark(what); } };
let firstUp = false, lastRecord = -1, lastRecordAt = 0;
const gaps = [];
const ups = () => ROWS.reduce((a, r) => a + s.levels[r], 0) + s.grafts;
console.log(' min  record   parts  bio  upgr  sleepers  colony  deaths');
for (let next = 60; wall() < MIN * 60 && !s.ended;) {
    if (stopOpen(s)) { const id = s.tut.stop.id; read += readStop(s); news.push([wall(), `stop ${id}`]); continue; }
    const before = ups();
    step(s, DT, { decide: (st) => {
        let { dir } = decide(st, mem);
        if (dir && firsts.dig === undefined && st.tut?.dug === false) first('dig', 'first dig decision');
        if (careless && mem.going === 'home' && st.battery > 3 && Math.random() < 0.5) dir = 'down';
        return dir;
    } });
    for (const e of s.events) {
        if (e.type === 'deliver') first('ore', 'first ore home');
        if (e.type === 'layer') mark(`layer ${e.layer} (${depthOf(s.y)} m)`);
        if (e.type === 'find') mark(`find ${e.n}`);
        if (e.type === 'dead') mark('battery empty, recovered');
        if (e.type === 'graft') mark(`graft ${e.id}`);
        if (e.type === 'heart') mark('THE HEART');
        if (e.type === 'show') { news.push([wall(), `shows ${e.what}`]); }
        if (e.type === 'row') { news.push([wall(), `row ${e.row}`]); mark(`workshop row ${e.row}`); }
    }
    s.events.length = 0;
    if (ups() > before) { if (!firstUp) { firstUp = true; mark('first upgrade'); } }
    if (s.record > lastRecord) { if (Math.floor(depthOf(s.record) / 25) > Math.floor(depthOf(lastRecord) / 25)) { gaps.push(s.time - lastRecordAt); lastRecordAt = s.time; } lastRecord = s.record; }
    if (wall() >= next) {
        next += 60;
        console.log(`${String(Math.round(wall() / 60)).padStart(4)}  ${String(depthOf(s.record)).padStart(5)} m  ${String(s.parts).padStart(6)}  ${String(s.bio).padStart(3)}  ${String(ups()).padStart(4)}  ${String(sleepers(s)).padStart(8)}  ${String(Math.round(s.reserve)).padStart(5)} %  ${String(s.deaths).padStart(6)}`);
    }
}
console.log('\n' + moments.join('\n'));
// one new thing at most every ~45 s in the first five minutes (stops that follow from the player's own act excepted)
const early = news.filter(([t]) => t < 300);
let closest = Infinity;
for (let i = 1; i < early.length; i++) closest = Math.min(closest, early[i][0] - early[i - 1][0]);
console.log(`\nnew on screen in the first 5 min: ${early.map(([t, w]) => `${Math.round(t)}s ${w}`).join(' · ')}`);
console.log(`first dig decision ${Math.round(firsts.dig)} s, first ore home ${Math.round(firsts.ore)} s, stops read ${Math.round(read)} s`);
console.log(`end at ${(wall() / 60).toFixed(1)} min, levels ${JSON.stringify(s.levels)} grafts ${s.grafts}, finds ${s.found.length}/12, sleepers ${sleepers(s)}, longest wait for a new 25 m: ${Math.round(Math.max(...gaps))} s`);
