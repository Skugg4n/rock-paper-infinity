import { newState, step, stopOpen, buildDrone } from '../src/phase4d/dig.js';
import { decide, readStop } from '../src/phase4d/autopilot.js';
const s = newState(Number(process.argv[3] || 7)); const mem = {}; let ld;
const until = Number(process.argv[2]);
while (s.time < until) { if (stopOpen(s)) { readStop(s); continue; } if (s.lost) { buildDrone(s); continue; } step(s, 0.05, { decide: (st) => { ld = decide(st, mem).dir; return ld; } }); s.events.length = 0; }
console.log(s.x, s.y, s.cargo.length, s.battery|0, s.parts, s.bio, s.grafts, ld, JSON.stringify(mem), s.line.text, JSON.stringify(s.levels));
for (let i=0;i<8;i++){ step(s,0.05,{decide:(st)=>{ld=decide(st,mem).dir; return ld;}}); console.log(s.x,s.y,ld,s.act&&s.act.kind, s.events.map(e=>e.type).join()); s.events.length=0;}
