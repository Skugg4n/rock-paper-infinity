// Chapter IV · THE DEEP, the dig: a headless run with a plausible player (src/phase4d/autopilot.js).
//   node scripts/sim-dig.mjs [--minutes 40] [--seed 7] [--careless]
// One line a minute: minute, depth record, parts, upgrades, sleepers, colony %; then the moments.
import { newState, step, sleepers, ROWS } from '../src/phase4d/dig.js';
import { decide } from '../src/phase4d/autopilot.js';
import { depthOf } from '../src/phase4d/world.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : d; };
const MIN = arg('--minutes', 40);
const careless = process.argv.includes('--careless');
const s = newState(arg('--seed', 7));
const mem = {};
const DT = 0.05;
const moments = [];
const mark = (what) => moments.push(`${(s.time / 60).toFixed(2).padStart(6)} min  ${what}`);
let firstOre = false, firstUp = false, lastRecord = -1, lastRecordAt = 0, gaps = [];
const ups = () => ROWS.reduce((a, r) => a + s.levels[r], 0) + s.grafts;
console.log(' min  record   parts  bio  upgr  sleepers  colony  deaths');
for (let t = 0, next = 60; t < MIN * 60 && !s.ended; t += DT) {
    const before = ups();
    step(s, DT, { decide: (st) => {
        let { dir } = decide(st, mem);
        if (careless && mem.going === 'home' && st.battery > 3 && Math.random() < 0.5) dir = 'down';
        return dir;
    } });
    for (const e of s.events) {
        if (e.type === 'deliver' && !firstOre) { firstOre = true; mark('first ore home'); }
        if (e.type === 'layer') mark(`layer ${e.layer} (${depthOf(s.y)} m)`);
        if (e.type === 'find') mark(`find ${e.n}`);
        if (e.type === 'dead') mark('battery empty, recovered');
        if (e.type === 'graft') mark(`graft ${e.id}`);
        if (e.type === 'heart') mark('THE HEART');
    }
    s.events.length = 0;
    if (ups() > before) { if (!firstUp) { firstUp = true; mark('first upgrade'); } }
    if (s.record > lastRecord) { if (Math.floor(depthOf(s.record) / 25) > Math.floor(depthOf(lastRecord) / 25)) { gaps.push(s.time - lastRecordAt); lastRecordAt = s.time; } lastRecord = s.record; }
    if (s.time >= next) {
        next += 60;
        console.log(`${String(Math.round(s.time / 60)).padStart(4)}  ${String(depthOf(s.record)).padStart(5)} m  ${String(s.parts).padStart(6)}  ${String(s.bio).padStart(3)}  ${String(ups()).padStart(4)}  ${String(sleepers(s)).padStart(8)}  ${String(Math.round(s.reserve)).padStart(5)} %  ${String(s.deaths).padStart(6)}`);
    }
}
console.log('\n' + moments.join('\n'));
console.log(`\nend at ${(s.time / 60).toFixed(1)} min, levels ${JSON.stringify(s.levels)} grafts ${s.grafts}, finds ${s.found.length}/12, longest wait for a new 25 m: ${Math.round(Math.max(...gaps))} s`);
