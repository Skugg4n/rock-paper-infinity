import { newState, step, stopOpen, buildDrone } from '../src/phase4d/dig.js';
import { decide, readStop } from '../src/phase4d/autopilot.js';
import { depthOf } from '../src/phase4d/world.js';
const s = newState(Number(process.argv[2])); const mem = {};
let wasHome = true, maxY = 0, start = 0, why = '';
const from = Number(process.argv[3]), to = Number(process.argv[4]);
while (s.time < to) {
  if (stopOpen(s)) { readStop(s); continue; } if (s.lost) { buildDrone(s); continue; }
  step(s, 0.05, { decide: (st) => { const d = decide(st, mem).dir; if (mem.going === 'home' && !why) why = `bat ${st.battery|0} cargo ${st.cargo.length}`; return d; } });
  s.events.length = 0;
  if (s.y >= 0 && wasHome) { start = s.time; maxY = 0; why = ''; }
  if (s.y > maxY) maxY = s.y;
  if (s.y === -1 && !wasHome && s.time > from) console.log(`${(s.time/60).toFixed(1)}m dive ${Math.round(s.time-start)}s to ${depthOf(maxY)}m home because ${why} parts ${s.parts} bio ${s.bio}`);
  wasHome = s.y === -1;
}
