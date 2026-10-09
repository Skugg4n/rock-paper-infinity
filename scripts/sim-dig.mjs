// Chapter IV · THE DEEP, the dig: a headless run with a plausible player (src/phase4d/autopilot.js).
//   node scripts/sim-dig.mjs [--minutes 40] [--seed 7] [--careless] [--noradio] [--reckless]
// --careless: a player who does not mend what fails at the base (and has no radio)
// --reckless: the old careless one, who ignores the way home half the time
// --unlucky: buys the wrong things first (MAPPING, GPS, LAMP...), and loses three drones just before
//            delivering a full cargo; must still pass every wall (the run fails if it is stuck for good)
// One line a minute: minute, depth record, parts, upgrades, sleepers, colony %; then the moments.
// Time is the player's: the game's clock plus the seconds spent reading stops (the game is paused then).
import { newState, step, sleepers, ROWS, stopOpen, buildDrone, nextWall, cargoCap } from '../src/phase4d/dig.js';
import { decide, readStop } from '../src/phase4d/autopilot.js';
import { depthOf } from '../src/phase4d/world.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : d; };
const MIN = arg('--minutes', 40);
const careless = process.argv.includes('--reckless');
const mem = {};
const unlucky = process.argv.includes('--unlucky');
if (unlucky) mem.wrongFirst = true;
let forced = 0;
if (process.argv.includes('--careless')) { mem.noRepair = true; process.argv.push('--noradio'); }
// --noradio: a player who never buys the SHORT WAVE RADIO (hears of failures only at home)
const noradio = process.argv.includes('--noradio');
// --nosteer: a player who keeps STEERING I (two steps a sideways press)
const nosteer = process.argv.includes('--nosteer');
const s = newState(arg('--seed', 7));
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
const uses = { boost: 0, teleport: 0, shock: 0 };
const lostWhy = {};
let wallAt = null, wallRow = null, longestWall = 0;
let lowGen = 100, under50 = 0, wasUnder = false;
console.log(' min  record   parts  bio  upgr  sleepers  colony  deaths');
for (let next = 60; wall() < MIN * 60 && !s.ended;) {
    if (stopOpen(s)) { const id = s.tut.stop.id; read += readStop(s); news.push([wall(), `stop ${id}`]); continue; }
    // a lost drone: the player reads, then builds another (two seconds)
    if (s.lost) { read += 2; buildDrone(s); continue; }
    const before = ups();
    if (noradio && s.tut) s.tut.rows = s.tut.rows.filter((r) => r !== 'radio');
    // the unlucky player: a full cargo, almost home, and the drone is lost (three times)
    if (unlucky && forced < 3 && s.cargo.length >= cargoCap(s) && s.y >= 0 && s.y <= 3 && s.dives > 2) { forced++; s.battery = 0.0001; }
    if (nosteer && s.tut) s.tut.rows = s.tut.rows.filter((r) => r !== 'steering');
    step(s, DT, { decide: (st) => {
        let { dir } = decide(st, mem);
        if (dir && firsts.dig === undefined && st.tut?.dug === false) first('dig', 'first dig decision');
        if (careless && mem.going === 'home' && st.battery > 3 && Math.random() < 0.5) dir = 'down';
        return dir;
    } });
    for (const e of s.events) {
        if (e.type === 'deliver') first('ore', 'first ore home');
        if (e.type in uses) uses[e.type]++;
        if (e.type === 'layer') mark(`layer ${e.layer} (${depthOf(s.y)} m)`);
        if (e.type === 'find') mark(`find ${e.n}`);
        if (e.type === 'dead') { mark(`drone lost (${e.why}) at ${depthOf(e.y)} m`); lostWhy[e.why] = (lostWhy[e.why] || 0) + 1; }
        if (e.type === 'graft') mark(`graft ${e.id}`);
        if (e.type === 'heart') mark('THE HEART');
        if (e.type === 'quantum') mark('quantum object picked up');
        if (e.type === 'lab-out') { mark(`lab: ${e.id}`); news.push([wall(), `lab ${e.id}`]); }
        if (e.type === 'fail') news.push([wall(), `fail ${e.id}`]);
        if (e.type === 'show') { news.push([wall(), `shows ${e.what}`]); }
        if (e.type === 'row') { news.push([wall(), `row ${e.row}`]); mark(`workshop row ${e.row}`); }
    }
    s.events.length = 0;
    if (s.drainFrom != null && s.time > s.drainFrom) { lowGen = Math.min(lowGen, s.reserve); if (s.reserve < 50 && !wasUnder) under50++; wasUnder = s.reserve < 50; }
    // in front of a wall: how long until it is passed
    const wl = nextWall(s);
    if (wl && s.record >= wl.row - 3) { if (wallRow !== wl.row) { wallRow = wl.row; wallAt = wall(); } }
    else if (wallRow !== null) { longestWall = Math.max(longestWall, wall() - wallAt); mark(`wall at ${depthOf(wallRow)} m passed after ${Math.round(wall() - wallAt)} s`); wallRow = null; }
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
console.log(`used: ${JSON.stringify(uses)}`);
console.log(`generators: lowest ${Math.round(lowGen)} %, under 50 % ${under50} times`);
console.log(`drones lost: ${s.deaths} ${JSON.stringify(lostWhy)}`);
console.log(`chambers: ${s.alarms.n} failures, ${s.alarms.lost} sleepers lost to them`);
const stuckNow = wallRow !== null ? wall() - wallAt : 0;
console.log(`walls: longest wait in front of one ${Math.round(Math.max(longestWall, stuckNow))} s${stuckNow ? ` (still stuck at ${depthOf(wallRow)} m for ${Math.round(stuckNow)} s)` : ''}`);
console.log(`end at ${(wall() / 60).toFixed(1)} min, levels ${JSON.stringify(s.levels)} grafts ${s.grafts}, finds ${s.found.length}/12, sleepers ${sleepers(s)}, longest wait for a new 25 m: ${Math.round(Math.max(...gaps))} s`);
if (stuckNow > 600 || (!s.ended && wallRow !== null && stuckNow > 300)) { console.log('STUCK FOR GOOD'); process.exitCode = 1; }
