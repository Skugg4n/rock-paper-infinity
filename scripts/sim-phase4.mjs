// Chapter IV simulation: greedy player, one real second = one day awake. Since v1.43.0
// SLEEP IS A STATE: the player falls asleep (SLEEP_SECONDS of walking in, the spin and
// walking out, plus reading the wake line) and the colony then runs at the tier's rate,
// CRYO[tier].days colony days per real second, until an ALARM wakes it (deep.js decides:
// food, energy, a stalled room, a party home, an order done with the next one paid for,
// the ring at the line) or until the player sees the next purchase light up and wakes it
// by hand. Scout parties are sent when they are cheap, and come home as alarms. Same rules
// as the game (src/phase4/deep.js).
//   node scripts/sim-phase4.mjs [--quiet] [--all] [--table] [--why] [--seed N]
//   --quiet  only the summary line   --all  every purchase, not the first 30
//   --table  a row a minute          --why  where the colony stood when the run ended (for tuning)
import {
  ROOMS, COLUMN, ROOM_FOR_COLUMN, ROOM, initialDeepState, tickDay, sleep, surface, canResurface, canAscend,
  roomMultiplier, digCost, roomCost, levelCost, automationCost, CRYO, DAYS_PER_YEAR, survival,
  startBuild, completeBuilds, buildPending, BUILD_DAYS, sleepTrouble, launchProbe, resolveDueProbes,
  probeCost, scoutParty, MIN_SLEEPERS, PROBE_ENERGY, repairTick,
} from '../src/phase4/deep.js';

const WAIT_DAYS = 30;        // a human waits this long awake for a purchase; longer than that, they sleep
const SLEEP_SECONDS = 3;     // real seconds a sleep costs around it: the walk in, the walk out, reading the wake line
const REAL_CAP = 3600;
const FUEL_DAYS = 30;        // minerals kept back so the generators do not go dark while we shop
const SCOUT_SHARE_OF_ORE = 0.05;   // a party is sent when it costs less than this share of the ore in store
const SCOUT_UNTIL_SPREAD = 6;      // ... and only while the ring is wider than this: a narrow ring needs no more

// the dice for the scouts: seeded, so a run is a run
const seedArg = process.argv.indexOf('--seed');
let seed = seedArg > 0 ? Number(process.argv[seedArg + 1]) || 1 : 1;
const rng = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const s = initialDeepState();
let real = 0, wakeUps = 0, buysThisWake = 0;
const alarmsSeen = {};
let scoutsSent = 0, scoutsLost = 0, monsters = 0, diedInIce = 0, handWakes = 0, sleepReal = 0;
/** The chambers as the layout would hold them, for a monster to take one. */
const slots = () => ROOMS.flatMap((t) => new Array(s.rooms[t] || 0).fill(t));
const weakAwake = { M: 0, F: 0, E: 0, H: 0 }, weakAsleep = { M: 0, F: 0, E: 0, H: 0 };
const events = [], log = [], buysPerWake = [], pressesPerTier = CRYO.map(() => 0);
let starved = 0, minHumans = s.humans, starsDay0 = 0, starsDayEnd = 0, stall = 0, worstStall = 0;
const fmt = (sec) => `${Math.floor(sec / 60)}m${String(Math.round(sec) % 60).padStart(2, '0')}s`;
const yr = (d) => (d / DAYS_PER_YEAR).toFixed(1);
// a chamber an order has already claimed is not an empty one
const usedChambers = () => ROOMS.reduce((a, t) => a + s.rooms[t], 0) + (s.builds || []).filter((j) => j.kind === 'room').length;
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
    if (usedChambers() < s.chambers && !buildPending(s, 'room', t) && s.minerals >= roomCost(t, s.rooms[t]) + FUEL_RESERVE) {
      s.minerals -= roomCost(t, s.rooms[t]); startBuild(s, 'room', { type: t }); return `room ${t} ordered (${BUILD_DAYS.room} d)`;
    }
    if (usedChambers() >= s.chambers && !buildPending(s, 'dig') && s.minerals >= digCost(s.chambers) + FUEL_RESERVE) {
      s.minerals -= digCost(s.chambers); startBuild(s, 'dig'); return `dig chamber ${s.chambers + 1} ordered (${BUILD_DAYS.dig} d)`;
    }
  }
  // 2. take people off a job: automate the room type that eats the most crew (stars)
  if (t === 'auto') {
    const hungriest = ROOMS.filter((r) => crewOf(r) > 0 && !buildPending(s, 'auto', r)).sort((a, b) => crewOf(b) - crewOf(a))[0];
    if (hungriest && s.stars >= automationCost(hungriest, s.auto[hungriest])) {
      s.stars -= automationCost(hungriest, s.auto[hungriest]); startBuild(s, 'auto', { type: hungriest });
      return `auto ${hungriest} ${s.auto[hungriest] + 1} ordered (${BUILD_DAYS.auto} d)`;
    }
    t = 'dorm';
  }
  // 3. level or automate the weakest, cheaper first (stars)
  const lv = levelCost(t, s.level[t]), au = automationCost(t, s.auto[t]);
  const canLv = !buildPending(s, 'level', t), canAu = !buildPending(s, 'auto', t);
  if (canLv && lv <= au && s.stars >= lv) { s.stars -= lv; startBuild(s, 'level', { type: t }); return `level ${t} ${s.level[t] + 1} ordered (${BUILD_DAYS.level} d)`; }
  if (canAu && s.stars >= au) { s.stars -= au; startBuild(s, 'auto', { type: t }); return `auto ${t} ${s.auto[t] + 1} ordered (${BUILD_DAYS.auto} d)`; }
  if (canLv && s.stars >= lv) { s.stars -= lv; startBuild(s, 'level', { type: t }); return `level ${t} ${s.level[t] + 1} ordered (${BUILD_DAYS.level} d)`; }
  // 4. a faster sleep (stars), once a dry run says the colony could sleep a second of it safely
  const next = CRYO[s.cryo + 1];
  if (next && s.stars >= next.cost && (s.cryo < 0 ? true : !sleepTrouble(s, next.days))) {
    if (s.cryo < 0 && sleepTrouble(s, next.days)) return null;
    s.stars -= next.cost; s.cryo++; if (s.cryo === 0) s.rooms.cryo = 1;
    return `${next.id} (${next.days} d a second)`;
  }
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

/** Would the player wake now? When the next thing it wants is paid for. */
function wantsToWake() {
  const r = tickDay(JSON.parse(JSON.stringify(s)), false);
  if (waitDays(r) <= 0) return true;
  const next = CRYO[s.cryo + 1];
  return !!next && s.stars >= next.cost && !sleepTrouble(s, next.days);
}

/** A party when it is cheap: the ring is the goal, and every reading narrows it. */
function maybeScout(r) {
  if ((s.probes || []).length || s.cryo < 0 || (s.est?.spread ?? 40) <= SCOUT_UNTIL_SPREAD) return;
  if (r.parts.E < PROBE_ENERGY || s.humans - scoutParty(s.humans) < MIN_SLEEPERS) return;
  if (probeCost(s.probesSent) > s.minerals * SCOUT_SHARE_OF_ORE) return;
  if (launchProbe(s)) { scoutsSent++; events.push({ real, day: s.day, e: `scout party sent (${s.probes[s.probes.length - 1].people})` }); }
}

let summaryWeakest = null;   // what the wake-up summary said stalled while the colony slept
while (real < REAL_CAP && !canAscend(s)) {
  completeBuilds(s);                    // nothing is instant: orders land on their day
  const r = tickDay(s, false);
  for (const l of resolveDueProbes(s, slots(), rng)) { if (l.outcome === 'lost') scoutsLost++; if (l.outcome === 'monster') monsters++; }
  repairTick(s, slots(), r.hands);
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
  maybeScout(r);
  // Nothing affordable and the wait is long: go to sleep, if a dry run says the colony would
  // not be woken to trouble at once. That is the lesson the chapter teaches: a manual room
  // stops the moment everyone lies down, and the alarm says so.
  if (n === 0 && s.cryo >= 0 && waitDays(r) > WAIT_DAYS && s.humans >= MIN_SLEEPERS && !sleepTrouble(s, CRYO[s.cryo].days)) {
    real += SLEEP_SECONDS;
    const hist = { M: 0, F: 0, E: 0, H: 0 };
    let alarm = null;
    // one real second of sleep at a time, until something wakes the colony
    while (real < REAL_CAP) {
      const rate = CRYO[s.cryo].days;
      const sum = sleep(s, rate, { alarms: true, slots: slots(), rng });
      const spent = sum.days / rate;
      real += spent; sleepReal += spent;
      diedInIce += sum.died;
      for (const k of COLUMN) { hist[k] += sum.weakest[k] || 0; weakAsleep[k] += sum.weakest[k] || 0; }
      for (const l of sum.landed) { if (l.outcome === 'lost') scoutsLost++; if (l.outcome === 'monster') monsters++; }
      if (sum.alarm) { alarm = sum.alarm.kind; break; }
      if (wantsToWake()) { alarm = 'hand'; handWakes++; break; }
    }
    alarmsSeen[alarm] = (alarmsSeen[alarm] || 0) + 1;
    summaryWeakest = COLUMN.reduce((a, k) => (hist[k] > hist[a] ? k : a), 'M');
    wakeUps++; pressesPerTier[s.cryo]++;
    buysPerWake.push(buysThisWake); buysThisWake = 0;
  }
  if (real % 60 < 1 && (!log.length || log[log.length - 1].min !== Math.round(real / 60))) {
    log.push({ min: Math.round(real / 60), year: +yr(s.day), surface: +surface(s.doom0, s.day).toFixed(1), humans: Math.round(s.humans),
      starsDay: +r.stars.toPrecision(3), stars: +s.stars.toPrecision(3), chambers: s.chambers, weakest: r.weakest, cryo: s.cryo, wakeUps });
  }
}

// Where the colony stood when the run ended: the numbers to look at when a run stalls.
if (process.argv.includes('--why')) {
  const mult = (t) => roomMultiplier(s.level[t], s.auto[t]);
  console.log('builds', JSON.stringify(s.builds || []));
  console.log('state', JSON.stringify({ rooms: s.rooms, level: s.level, auto: s.auto, chambers: s.chambers, minerals: +s.minerals.toPrecision(4), food: +s.food.toPrecision(4), stars: +s.stars.toPrecision(4), humans: Math.round(s.humans) }));
  console.log('units', ROOMS.map((t) => `${t} ${(s.rooms[t] * mult(t)).toPrecision(4)}`).join('  '));
  const r = tickDay({ ...s, rooms: { ...s.rooms }, level: { ...s.level }, auto: { ...s.auto } }, false);
  console.log('parts', JSON.stringify(Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, +v.toPrecision(4)]))), 'made', +r.energyMade.toPrecision(4), 'need', +r.energyNeed.toPrecision(4), 'fuel', +r.fuel.toPrecision(4), 'staff', JSON.stringify(r.staff));
  console.log('prices', ROOMS.map((t) => `${t} room ${roomCost(t, s.rooms[t]).toPrecision(4)} lvl ${levelCost(t, s.level[t]).toPrecision(4)} auto ${automationCost(t, s.auto[t]).toPrecision(4)}`).join(' | '), 'dig', digCost(s.chambers).toPrecision(4));
}
const share = (o) => COLUMN.map((k) => { const tot = COLUMN.reduce((a, c) => a + o[c], 0) || 1; return `${k} ${Math.round(100 * o[k] / tot)} %`; }).join(' ');
const avgBuys = buysPerWake.length ? (buysPerWake.reduce((a, b) => a + b, 0) / buysPerWake.length).toFixed(1) : '0';
const alarmText = Object.entries(alarmsSeen).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`ended at ${fmt(real)}  year ${yr(s.day)}  survival ${survival(surface(s.doom0, s.day)).toFixed(1)} %  wake-ups ${wakeUps} (${alarmText}; ${avgBuys} buys each, sleeps per tier ${pressesPerTier.join('/')}, ${fmt(sleepReal)} asleep)  scouts ${scoutsSent} (lost ${scoutsLost}, monsters ${monsters})  died in the ice ${Math.round(diedInIce)}  humans ${Math.round(s.humans)} (low ${Math.round(minHumans)}, hungry ${starved} d)  longest stall ${worstStall} s  chambers ${s.chambers}  cryo ${s.cryo + 1}/${CRYO.length}  stars/day ${starsDay0.toPrecision(3)} → ${starsDayEnd.toPrecision(3)} (×${(starsDayEnd / (starsDay0 || 1)).toPrecision(2)})  weakest awake ${share(weakAwake)} | asleep ${share(weakAsleep)}  ascent ${canAscend(s)} (ring ${canResurface(s)})`);
const shown = process.argv.includes('--all') ? events : events.slice(0, 30);
if (!process.argv.includes('--quiet')) for (const e of shown) console.log(`  ${fmt(e.real).padStart(7)}  y${yr(e.day).padStart(7)}  ${e.e}`);
if (process.argv.includes('--table')) console.table(log);
