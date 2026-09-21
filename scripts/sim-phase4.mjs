// Chapter IV simulation: greedy player, one real second = one tick; a tick is a
// day awake, or a cryo sleep when nothing is affordable. Same rules as the game
// (src/phase4/deep.js). Usage: node scripts/sim-phase4.mjs [--table]
import {
  ROOMS, initialDeepState, tickDay, sleep, surface, canResurface, digCost, roomCost, levelCost, automationCost, CRYO, DAYS_PER_YEAR,
} from '../src/phase4/deep.js';

const s = initialDeepState();
let real = 0, wakeUps = 0, lastWeakest = null, weakStretch = { M: 0, F: 0, E: 0, H: 0 };
const events = [], log = [];
const fmt = (sec) => `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, '0')}s`;
const yr = (d) => (d / DAYS_PER_YEAR).toFixed(1);
const usedChambers = () => ROOMS.reduce((a, t) => a + s.rooms[t], 0);
const roomFor = { M: 'mine', F: 'farm', E: 'generator', H: 'dorm' };

/** One purchase a day at most: the cheapest useful thing for the weakest resource. */
function buy(report) {
  const t = roomFor[report.weakest];
  // 1. a room of that type (minerals) if there is a chamber
  if (usedChambers() < s.chambers && s.minerals >= roomCost(t, s.rooms[t]) + 30) { s.minerals -= roomCost(t, s.rooms[t]); s.rooms[t]++; return `room ${t}`; }
  // 2. dig (minerals)
  if (usedChambers() >= s.chambers && s.minerals >= digCost(s.chambers) + 30) { s.minerals -= digCost(s.chambers); s.chambers++; return 'dig'; }
  // 3. automate the weakest (stars), then level it
  if (s.stars >= automationCost(t, s.auto[t])) { s.stars -= automationCost(t, s.auto[t]); s.auto[t]++; return `auto ${t} ${s.auto[t]}`; }
  if (s.stars >= levelCost(t, s.level[t])) { s.stars -= levelCost(t, s.level[t]); s.level[t]++; return `level ${t} ${s.level[t]}`; }
  // 4. a better cryo (stars)
  const next = CRYO[s.cryo + 1];
  if (next && s.stars >= next.cost) { s.stars -= next.cost; s.cryo++; return next.id; }
  return null;
}

while (real < 3600 && !canResurface(s)) {
  const r = tickDay(s, false);
  const bought = buy(r);
  if (bought) events.push({ real, day: s.day, e: bought });
  if (r.weakest !== lastWeakest) { lastWeakest = r.weakest; }
  weakStretch[r.weakest]++;
  // nothing to buy and cryo owned: sleep, unless food is short and the farms are manual
  const safe = s.auto.farm > 0 || s.food > s.humans * 30;
  if (!bought && s.cryo >= 0 && safe) { sleep(s, CRYO[s.cryo].days); wakeUps++; }
  real++;
  if (real % 60 === 0) log.push({ min: real / 60, year: +yr(s.day), surface: Math.round(surface(s.doom0, s.day)), humans: Math.round(s.humans), stars: Math.round(s.stars), starsDay: Math.round(r.stars), chambers: s.chambers, weakest: r.weakest, cryo: s.cryo, wakeUps });
}
console.log(`ended at ${fmt(real)}  year ${yr(s.day)}  surface ${Math.round(surface(s.doom0, s.day))} %  wake-ups ${wakeUps}  humans ${Math.round(s.humans)}  chambers ${s.chambers}  weakest days M ${weakStretch.M} F ${weakStretch.F} E ${weakStretch.E} H ${weakStretch.H}  resurface ${canResurface(s)}`);
if (!process.argv.includes('--quiet')) for (const e of events.slice(0, 40)) console.log(`  ${fmt(e.real).padStart(7)}  y${yr(e.day).padStart(6)}  ${e.e}`);
if (process.argv.includes('--table')) console.table(log);
