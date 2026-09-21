// Chapter IV simulation: greedy player, one real second = one day awake. A cryo
// sleep costs SLEEP_SECONDS of real time (the zoom, the wake-up summary, the
// clicking) and passes the whole tier's days. Same rules as the game
// (src/phase4/deep.js).
//   node scripts/sim-phase4.mjs [--quiet] [--all] [--table] [--why]
//   --quiet  only the summary line   --all  every purchase, not the first 30
//   --table  a row a minute          --why  where the colony stood when the run ended (for tuning)
import {
  ROOMS, COLUMN, ROOM_FOR_COLUMN, ROOM, initialDeepState, tickDay, sleep, surface, canResurface, canAscend,
  roomMultiplier, digCost, roomCost, levelCost, automationCost, CRYO, DAYS_PER_YEAR, ASCENT,
} from '../src/phase4/deep.js';

const WAIT_DAYS = 30;        // a human waits this long awake for a purchase; longer than that, they sleep
const SLEEP_SECONDS = 3;     // real seconds a cryo press costs: zoom, wake-up summary, the buying after it
const REAL_CAP = 3600;
const FUEL_DAYS = 30;        // minerals kept back so the generators do not go dark while we shop

const s = initialDeepState();
let real = 0, wakeUps = 0, buysThisWake = 0;
const weakAwake = { M: 0, F: 0, E: 0, H: 0 }, weakAsleep = { M: 0, F: 0, E: 0, H: 0 };
const events = [], log = [], buysPerWake = [], pressesPerTier = CRYO.map(() => 0);
let starved = 0, minHumans = s.humans, starsDay0 = 0, starsDayEnd = 0, stall = 0, worstStall = 0;
const fmt = (sec) => `${Math.floor(sec / 60)}m${String(Math.round(sec) % 60).padStart(2, '0')}s`;
const yr = (d) => (d / DAYS_PER_YEAR).toFixed(1);
const usedChambers = () => ROOMS.reduce((a, t) => a + s.rooms[t], 0);
const crewOf = (t) => (s.auto[t] > 0 ? 0 : s.rooms[t] * ROOM[t].crew * roomMultiplier(s.level[t], s.auto[t]));

/**
 * The plausible human: fix the weakest column with the cheapest thing that helps.
 * Minerals dig chambers and build rooms; stars buy levels, automation and cryo.
 * Beds already empty? Then more beds are not the fix: take people off a job instead.
 * Returns the label of one purchase, or null when nothing is affordable.
 */
function buy(report) {
  const FUEL_RESERVE = Math.max(80, report.fuel * FUEL_DAYS);
  let t = ROOM_FOR_COLUMN[report.weakest];
  const bedsFull = s.humans >= report.capacity * 0.9;
  const crewBound = ROOMS.reduce((a, r) => a + crewOf(r), 0) > s.humans * 0.2;
  // Short of hands with beds to spare: the beds are waiting for food, or for people to come
  // off a job. More beds would not help.
  if (report.weakest === 'H' && !bedsFull) t = crewBound ? 'auto' : 'farm';
  const wantRoom = t !== 'dorm' && t !== 'auto';
  // 1. a room of the weakest kind, or a chamber to put it in (minerals)
  if (wantRoom || bedsFull) {
    if (usedChambers() < s.chambers && s.minerals >= roomCost(t, s.rooms[t]) + FUEL_RESERVE) {
      s.minerals -= roomCost(t, s.rooms[t]); s.rooms[t]++; return `room ${t} ×${s.rooms[t]}`;
    }
    if (usedChambers() >= s.chambers && s.minerals >= digCost(s.chambers) + FUEL_RESERVE) {
      s.minerals -= digCost(s.chambers); s.chambers++; return `dig chamber ${s.chambers}`;
    }
  }
  // 2. take people off a job: automate the room type that eats the most crew (stars)
  if (t === 'auto') {
    const hungriest = ROOMS.filter((r) => crewOf(r) > 0).sort((a, b) => crewOf(b) - crewOf(a))[0];
    if (hungriest && s.stars >= automationCost(hungriest, s.auto[hungriest])) {
      s.stars -= automationCost(hungriest, s.auto[hungriest]); s.auto[hungriest]++;
      return `auto ${hungriest} ${s.auto[hungriest]}`;
    }
    t = 'dorm';
  }
  // 3. level or automate the weakest, cheaper first (stars)
  const lv = levelCost(t, s.level[t]), au = automationCost(t, s.auto[t]);
  if (lv <= au && s.stars >= lv) { s.stars -= lv; s.level[t]++; return `level ${t} ${s.level[t]}`; }
  if (s.stars >= au) { s.stars -= au; s.auto[t]++; return `auto ${t} ${s.auto[t]}`; }
  if (s.stars >= lv) { s.stars -= lv; s.level[t]++; return `level ${t} ${s.level[t]}`; }
  // 4. a longer sleep (stars)
  const next = CRYO[s.cryo + 1];
  if (next && s.stars >= next.cost) { s.stars -= next.cost; s.cryo++; return `${next.id} (${next.days} d)`; }
  return null;
}

/** Days of waiting before the cheapest thing on the list becomes affordable. */
function waitDays(report) {
  const t = ROOM_FOR_COLUMN[report.weakest];
  const mineralTarget = usedChambers() < s.chambers ? roomCost(t, s.rooms[t]) : digCost(s.chambers);
  const starTarget = Math.min(levelCost(t, s.level[t]), automationCost(t, s.auto[t]),
    CRYO[s.cryo + 1] ? CRYO[s.cryo + 1].cost : Infinity);
  const reserve = Math.max(80, report.fuel * FUEL_DAYS);
  const mineralWait = report.parts.M > 0 ? (mineralTarget + reserve - s.minerals) / report.parts.M : Infinity;
  const starWait = report.stars > 0 ? (starTarget - s.stars) / report.stars : Infinity;
  return Math.max(0, Math.min(mineralWait, starWait));
}

let summaryWeakest = null;   // what the wake-up summary said stalled while the colony slept
while (real < REAL_CAP && !canAscend(s)) {
  const r = tickDay(s, false);
  if (summaryWeakest) { r.weakest = summaryWeakest; summaryWeakest = null; }
  real += 1;
  if (!starsDay0 && r.stars > 0) starsDay0 = r.stars;   // the first day the colony makes stars at all
  starsDayEnd = r.stars;
  weakAwake[r.weakest]++;
  if (r.starving) starved++;
  // how long the star counter can sit at zero while the player is awake: a stalled counter early
  // on is the one thing that reads as "broken" rather than as "slow"
  stall = r.stars > 0 ? 0 : stall + 1; worstStall = Math.max(worstStall, stall);
  minHumans = Math.min(minHumans, s.humans);
  // a human at a wake-up clicks several buttons, not one
  let bought, n = 0;
  while ((bought = buy(r)) && n < 25) { events.push({ real, day: s.day, e: bought }); n++; buysThisWake++; }
  // Nothing affordable and the wait is long: press cryo. Only when the colony runs itself,
  // which is the lesson the chapter teaches: a manual room stops the moment everyone lies down.
  if (n === 0 && s.cryo >= 0 && waitDays(r) > WAIT_DAYS) {
    const safe = s.auto.mine > 0 && s.auto.farm > 0 && s.auto.generator > 0;
    if (safe) {
      const sum = sleep(s, CRYO[s.cryo].days);
      for (const k of COLUMN) weakAsleep[k] += sum.weakest[k] || 0;
      summaryWeakest = COLUMN.reduce((a, k) => ((sum.weakest[k] || 0) > (sum.weakest[a] || 0) ? k : a), 'M');
      wakeUps++; pressesPerTier[s.cryo]++; real += SLEEP_SECONDS;
      buysPerWake.push(buysThisWake); buysThisWake = 0;
    }
  }
  if (real % 60 < 1 && (!log.length || log[log.length - 1].min !== Math.round(real / 60))) {
    log.push({ min: Math.round(real / 60), year: +yr(s.day), surface: +surface(s.doom0, s.day).toFixed(1), humans: Math.round(s.humans),
      starsDay: +r.stars.toPrecision(3), stars: +s.stars.toPrecision(3), chambers: s.chambers, weakest: r.weakest, cryo: s.cryo, wakeUps });
  }
}

// Where the colony stood when the run ended: the numbers to look at when a run stalls.
if (process.argv.includes('--why')) {
  const mult = (t) => roomMultiplier(s.level[t], s.auto[t]);
  console.log('state', JSON.stringify({ rooms: s.rooms, level: s.level, auto: s.auto, chambers: s.chambers, minerals: +s.minerals.toPrecision(4), food: +s.food.toPrecision(4), stars: +s.stars.toPrecision(4), humans: Math.round(s.humans) }));
  console.log('units', ROOMS.map((t) => `${t} ${(s.rooms[t] * mult(t)).toPrecision(4)}`).join('  '));
  const r = tickDay({ ...s, rooms: { ...s.rooms }, level: { ...s.level }, auto: { ...s.auto } }, false);
  console.log('parts', JSON.stringify(Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, +v.toPrecision(4)]))), 'made', +r.energyMade.toPrecision(4), 'need', +r.energyNeed.toPrecision(4), 'fuel', +r.fuel.toPrecision(4), 'staff', JSON.stringify(r.staff));
  console.log('prices', ROOMS.map((t) => `${t} room ${roomCost(t, s.rooms[t]).toPrecision(4)} lvl ${levelCost(t, s.level[t]).toPrecision(4)} auto ${automationCost(t, s.auto[t]).toPrecision(4)}`).join(' | '), 'dig', digCost(s.chambers).toPrecision(4));
}
const share = (o) => COLUMN.map((k) => { const tot = COLUMN.reduce((a, c) => a + o[c], 0) || 1; return `${k} ${Math.round(100 * o[k] / tot)} %`; }).join(' ');
const avgBuys = buysPerWake.length ? (buysPerWake.reduce((a, b) => a + b, 0) / buysPerWake.length).toFixed(1) : '0';
console.log(`ended at ${fmt(real)}  year ${yr(s.day)}  surface ${surface(s.doom0, s.day).toFixed(1)} %  wake-ups ${wakeUps} (${avgBuys} buys each, presses ${pressesPerTier.join('/')})  humans ${Math.round(s.humans)} (low ${Math.round(minHumans)}, hungry ${starved} d)  longest stall ${worstStall} s  chambers ${s.chambers}  cryo ${s.cryo + 1}/${CRYO.length}  stars/day ${starsDay0.toPrecision(3)} → ${starsDayEnd.toPrecision(3)} (×${(starsDayEnd / (starsDay0 || 1)).toPrecision(2)})  weakest awake ${share(weakAwake)} | asleep ${share(weakAsleep)}  ascent ${canAscend(s)} (ring ${canResurface(s)}, ${Math.round(s.minerals / ASCENT.minerals * 100)} % ore, ${Math.round(s.stars / ASCENT.stars * 100)} % stars)`);
const shown = process.argv.includes('--all') ? events : events.slice(0, 30);
if (!process.argv.includes('--quiet')) for (const e of shown) console.log(`  ${fmt(e.real).padStart(7)}  y${yr(e.day).padStart(7)}  ${e.e}`);
if (process.argv.includes('--table')) console.table(log);
