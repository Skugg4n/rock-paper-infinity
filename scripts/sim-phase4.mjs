// Chapter IV simulation: greedy player, one real second = one day awake. Since v1.43.0
// SLEEP IS A STATE: the player falls asleep (SLEEP_SECONDS of walking in, the spin and
// walking out, plus reading the wake line) and the colony then runs at the tier's rate,
// CRYO[tier].days colony days per real second, until an ALARM wakes it (deep.js decides:
// food, energy, a stalled room, a party home, an order done with the next one paid for,
// the ring at the line) or until the player sees the next purchase light up and wakes it
// by hand. Scout parties are sent when they are cheap, and come home as alarms. Same rules
// as the game (src/phase4/deep.js).
//   node scripts/sim-phase4.mjs [--quiet] [--all] [--table] [--why] [--seed N] [--watcher]
//   --quiet  only the summary line   --all  every purchase, not the first 30
//   --gifts  (deep-voice) what a minute of play earns at each of Surface's nights, for the gifts' prices
//   --table  a row a minute          --why  where the colony stood when the run ended (for tuning)
//   (deep-grow) both runs end at the rise; GROW_DEBUG=1 prints the body every ten seconds
//   --view 3d  (deep-swap) the body's neighbours as the 3D view has them (a ring of twelve round the
//              landing); without it as the strata view, the default, has them (a row outward from the shaft)
//   --watcher  (v1.49.0) the same player, who also buys the Watcher's ladder as the capacity comes
//              in (asleep, the next step the moment it can be paid), and does not wake by hand
//              while the next step waits only on capacity or on the body growing (up to
//              WATCHER_HOLD real seconds a sleep). Without the flag the run is the plain one.
// deep-voice (step 2 of the tree): in BOTH runs Surface visits on the game's own schedule
// (surface.js) and the player plays it, winning one game in three. In a sleep Surface is due in,
// the player stays under until it has come (VISIT_AFTER_SECONDS in), the game is played and, on a
// night, the line has typed itself. Every gift Surface opens is bought the moment it can be paid,
// awake or asleep.
// deep-machine (step 3 of the tree): the stars are the machine's wins on the spare energy it is fed.
// In both runs the player feeds it on the tree ("The machine: feed") the moment the next level can be
// paid and pays for itself within FEED_PAYBACK real seconds (90; env FEED_PAYBACK to try another).
// The output adds `stars/day curve` (when the rate first reaches each power of ten) and the feed times.
// deep-fix2: asleep only the culture vats grow people; both runs buy each level the moment it can be
// paid awake, after the hall. New beds fill a share at a time (deep.js BED_FILL).
import {
  ROOMS, COLUMN, ROOM_FOR_COLUMN, ROOM, initialDeepState, tickDay, sleep, surface, canResurface, canAscend,
  roomMultiplier, digCost, roomCost, levelCost, automationCost, CRYO, DAYS_PER_YEAR, survival,
  startBuild, completeBuilds, buildPending, BUILD_DAYS, sleepTrouble, launchProbe, resolveDueProbes,
  probeCost, scoutParty, MIN_SLEEPERS, PROBE_ENERGY, repairTick, mourn, mourning, nextCryo,
  feedCost, FEED_MAX, nextPrice, cryoPrice, feedPrice, setIncome, beginSleepYield, endSleepYield, sleepFull,
} from '../src/phase4/deep.js';
import {
  initialWatcher, watchSleep, alarmHit, beginSleep, firstSleep, FIRST_SLEEP_DAYS, recoverAwake,
  LADDER, stepNeed, buyStep, surfaceDue, openSurface, closeSurface, playSurface, bodyWhole, lastWake, snap,
  lookDue, sleepDaysAt,
} from '../src/phase4/watcher.js';
import { THROWS, beats, counter, visitDue, TYPE_MS, NIGHTS } from '../src/phase4/surface.js';
// deep-tree (step 1): every level, automation, cryo tier and Watcher step is bought ON THE TREE,
// the way the game's panel buys it. The greedy player still decides what to buy, as before; the
// tree only does the buying. The sim never kept the queue's cap of eight (it orders one per lane).
import { buy as treeBuy, canBuy as treeCanBuy, priceOf as treePriceOf, LEVEL_NODE, AUTO_NODE, cryoNode, nextWatcherNode, initialTree, GIFT_PRICE, LEVEL_MAX } from '../src/phase4/tree.js';
// deep-grow: MOVEMENT III. The question answered, the body grows awake: the policy (src/phase4/policy.js
// decideGrow) buys the drawer's body items, takes reachable chambers it can afford without starving,
// and pulls RISE when the deepest floor is full and the machine is body. The act ends at the rise.
import { normalizeGrow, growOn, risen, organsOf, stepGrow, fleshShare, graphOf, riseReady, hungerNow, setChamberPlace, dreamDaysAt, dreamWake, dreamEnd, pump, bodyRatios } from '../src/phase4/grow.js';
import { decideGrow, pressGrow, TAKES_PER_SECOND, PUMP_EVERY_S, PUMP_ON_SHARE } from '../src/phase4/policy.js';
// deep-econ: after the hall the player follows the instruments' named goal (SAVE FOR ..., BUY ...)
import { goalOf } from '../src/phase4/instruments.js';
import { cryoRoad } from '../src/phase4/readout.js';
// deep-grow2: Surface's nights 4 and 5 give a graft; the player places it at the next wake, in a room of
// the weakest column. GROW is awake at a day a second; when nothing can be taken the player marks the
// next chambers and dreams (the body grows toward the marks) until HUNGER, REACHED or DREAM_MAX seconds.
// "longest stuck": the longest stretch of real seconds in GROW with no chamber taken (by hand, by
// SPREAD or in a dream), no item bought and no dead room revived. The heart is never pumped here.
import { placeGraft, graftOwed } from '../src/phase4/graft.js';
// deep-swap: the body's graph follows the view the player sees (src/phase4/views.js)
import { chosenView, placeFor } from '../src/phase4/views.js';
const viewArg = process.argv.indexOf('--view');
const VIEW = chosenView(viewArg > 0 ? `?view=${process.argv[viewArg + 1]}` : '');
setChamberPlace(placeFor(VIEW));
const SIM = { queueMax: Infinity };
/** Buy a node; the sim has already checked the price, so a refusal is a bug in the sim. */
function onTree(id, ctx = SIM) {
  const r = treeBuy(s, id, ctx);
  if (!r) throw new Error(`sim: the tree refused ${id}: ${JSON.stringify(treeCanBuy(s, id, ctx))} asleep ${s.asleep}`);
  return r;
}

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
s.tree = initialTree();
// v1.46.0: the Watcher, REPORTED only (v1.48.0: its first sleep does not drift and ends after a year). The greedy player never clicks the base and never
// solves a riddle, and a reboot does not wake this colony: the loop is the one the balance was
// measured on. What it says is how an unattended Watcher would fare over the whole chapter.
const w = initialWatcher();
let lowest = 100, capFullAt = null;
// v1.52.0: the same Watcher kept by an ATTENTIVE player, who clicks the base every SNAP_EVERY real
// seconds of sleep (the clock runs on across sleeps). Reported only, like the unattended one.
const SNAP_EVERY = 12;
const w2 = initialWatcher();
let lowest2 = 100, snapClock = 0;
// v1.49.0: the Watcher's ladder, bought by the --watcher player only
const WATCHER = process.argv.includes('--watcher');
const WATCHER_HOLD = 20;           // real seconds a sleep the player stays under for the next step's capacity
if (WATCHER) s.watcher = w;        // the rules read the Scheduler, Night vision and the Sensor mast off the state
const ladderAt = [];               // { id, real, year }
let surfaceGames = 0;
// deep-voice: Surface's nights and gifts, in both runs
const nightAt = [];                // { n, real, year }
const giftAt = {};                 // id -> { real, year }
let earned = 0;
const earnedAt = [];               // [real, stars earned so far]: what a minute of play is worth, for the gifts' prices
const earnedBy = (t) => { let e = 0; for (const [r, v] of earnedAt) { if (r > t) break; e = v; } return e; };
const LINE_READ = 1.5;             // real seconds the player gives a typed line before waking
const GAME_SECONDS = 1.5;          // a game with Surface: the throw, the shake, the reveal, the line
/** A game with Surface: the player wins one in three (a win, a draw, a loss, in turn). */
function playOne() {
  const it = w.surface.visit?.it;
  if (!it) return;
  const k = surfaceGames % 3;
  const you = k === 0 ? counter(it) : k === 1 ? it : THROWS.find((t) => beats(it, t));
  playSurface(w, you);
  surfaceGames++;
}
/** Surface comes: a night says its line (and opens its gift), and the player plays. */
function surfaceComes(force = false) {
  const v = openSurface(w, s, { force });
  if (v.night) decided();
  if (v.night) nightAt.push({ n: v.night, real, year: s.day / DAYS_PER_YEAR, perDay: tickDay(JSON.parse(JSON.stringify(s)), false).stars, stars: s.stars });
  playOne();
  return v;
}
/** Every gift Surface has opened, bought the moment it can be paid. */
function buyGifts(asleep) {
  for (const id of Object.keys(GIFT_PRICE)) {
    if (!(s.tree.opened || []).includes(id) || (s.tree.bought || []).includes(id)) continue;
    if (!treeCanBuy(s, id, { ...SIM, asleep }).ok) continue;
    treeBuy(s, id, { ...SIM, asleep });
    giftAt[id] = { real, year: s.day / DAYS_PER_YEAR };
    events.push({ real, day: s.day, e: `gift ${id}` });
  }
}
/* deep-machine (step 3): the stars are the machine's wins on the spare energy it is fed. The player
   feeds it on the tree ("The machine: feed") as it buys anything else: the next level the moment it
   can be paid AND pays for itself within FEED_PAYBACK real seconds, awake or asleep. */
const FEED_PAYBACK = Number(process.env.FEED_PAYBACK || 90);
const feedAt = [];                 // { level, real, year }
// the stars/day curve: the real second at which the rate (awake, or a sleep's average) first reaches 10^k
const curve = [];
const onCurve = (perDay) => { for (let k = 0; k <= 16 && perDay >= 10 ** k; k++) if (curve[k] === undefined) curve[k] = real; };
function buyFeed(asleep) {
  let k = 0;
  while ((s.feed || 0) < FEED_MAX && k < FEED_MAX) {
    const price = feedPrice(s);
    if (s.stars - reserve < price) return;
    const now = tickDay(JSON.parse(JSON.stringify(s)), asleep).stars;
    const then = tickDay(JSON.parse(JSON.stringify({ ...s, feed: (s.feed || 0) + 1 })), asleep).stars;
    const perSecond = (then - now) * (asleep ? CRYO[Math.max(0, s.cryo)].days : 1);
    if (!(perSecond > 0) || price > perSecond * FEED_PAYBACK) return;
    onTree('feed', { ...SIM, asleep });
    feedAt.push({ level: s.feed, real, year: s.day / DAYS_PER_YEAR });
    events.push({ real, day: s.day, e: `feed ${s.feed}` });
    k++;
  }
}
/* deep-econ: THE GOAL. After the hall the player does what the tape says: the named goal is bought
   the moment it can be paid, and its price is kept back from everything else until then (`reserve`). */
const priceOfNode = (id) => treePriceOf(s, id)?.stars ?? Infinity;
let goalRoad = null, goalRoadKey = '', simAsleep = false;
function simGoal() {
  if (s.cryo < 0 || answered()) return null;
  // the road to the next tier, worked out once a purchase changes the colony (dry runs are dear)
  const key = `${s.cryo}|${JSON.stringify(s.level)}|${JSON.stringify(s.auto)}|${JSON.stringify(s.rooms)}|${(s.builds || []).length}|${Math.floor(s.day / 30)}`;
  if (!simAsleep && key !== goalRoadKey && nextCryo(s)) { goalRoadKey = key; goalRoad = cryoRoad(s.cryo + 1, s); }
  // the tape reads Surface's schedule off the Watcher; the plain run keeps it off the state otherwise
  const had = s.watcher;
  s.watcher = had || w;
  try { return goalOf(s, { road: nextCryo(s) ? goalRoad : null }); } finally { s.watcher = had; }
}
let reserve = 0;
function buyGoal() {
  // GOAL_DEBUG=1: the goal, the road to the next tier and the income every twenty seconds
  if (process.env.GOAL_DEBUG && real % 20 < 1) { const g = simGoal(); console.log(fmt(real), goalRoad && goalRoad.text, JSON.stringify(g), "stars", s.stars.toPrecision(3), "income", JSON.stringify(s.income), "sleepGot", JSON.stringify(s.sleepGot)); }
  reserve = 0;
  for (let k = 0; k < 12; k++) {
    const g = simGoal();
    if (!g) return;
    if (g.gap > 0 || !treeCanBuy(s, g.id, { ...SIM, asleep: false, need: null }).ok) { reserve = g.gap > 0 ? g.price : 0; return; }
    onTree(g.id, { ...SIM, need: null });
    if (GIFT_PRICE[g.id]) giftAt[g.id] = { real, year: s.day / DAYS_PER_YEAR };
    events.push({ real, day: s.day, e: `goal ${g.id}` });
    if (answered()) return;
  }
}
/* deep-fix2: CULTURE VATS. Asleep only the vats grow people; the player buys each level awake the
   moment it can be paid, once the hall stands (the panel says BUILD CULTURE VATS for the first). */
const vatsAt = [];                 // { level, real, year }
function buyVats() {
  while (treeCanBuy(s, 'vats', { ...SIM, asleep: false }).ok && s.stars - reserve >= priceOfNode('vats')) {
    onTree('vats');
    vatsAt.push({ level: s.vats, real, year: s.day / DAYS_PER_YEAR });
    events.push({ real, day: s.day, e: `culture vats ${s.vats}` });
  }
}
/* deep-grow2: THE GRAFTS. The sim keeps counts, not places: the grafts live in a small layout of their
   own (one slot a graft, its room type) until the body begins, and are then laid in growLayout. */
const graftTypes = [];
const graftAt = [];
function placeGrafts(r) {
  while (graftOwed(s)) {
    let t = ROOM_FOR_COLUMN[r.weakest] || 'mine';
    if (!(s.rooms[t] > 0)) t = 'mine';
    const stub = { slots: [...graftTypes, t] };
    if (!placeGraft(s, stub, `s${graftTypes.length}`)) break;
    graftTypes.push(t);
    s.organs = organsOf(s, { slots: graftTypes });
    graftAt.push({ type: t, real });
    events.push({ real, day: s.day, e: `graft: a ${t} turns to flesh` });
  }
}
let bodyEnd = null;                // v1.50.0: the last wake-up, { real, year, were }
let real = 0, wakeUps = 0, buysThisWake = 0;
const alarmsSeen = {};
let scoutsSent = 0, scoutsLost = 0, monsters = 0, diedInIce = 0, handWakes = 0, sleepReal = 0;
/** The chambers as the layout would hold them, for a monster to take one. */
const slots = () => ROOMS.flatMap((t) => new Array(s.rooms[t] || 0).fill(t));
const weakAwake = { M: 0, F: 0, E: 0, H: 0 }, weakAsleep = { M: 0, F: 0, E: 0, H: 0 };
const events = [], log = [], buysPerWake = [], pressesPerTier = CRYO.map(() => 0);
/* deep-econ: THE PACING RULE. A DECISION is anything new the player gets to do: a purchase (every
   event the log keeps is one), a graft placed, a chamber taken by hand, a mark or a dream, a night's
   line, pulling the lever to sleep, or waking by hand because something can be bought. The sim
   reports the longest stretch of real time between two of them, per movement (TEND before the hall,
   SLEEP until the question, GROW after it); the target is 60 s at most. */
const idle = { last: 0, move: 'TEND', TEND: [0, 0], SLEEP: [0, 0], GROW: [0, 0] };
const movement = () => (answered() ? 'GROW' : s.cryo < 0 ? 'TEND' : 'SLEEP');
// deep-organs: a stretch belongs to the movement it began in (the wait for the question is SLEEP's)
function decided() {
  const k = real - idle.last, m = idle.move;
  if (k > idle[m][0]) idle[m] = [k, real];
  idle.last = real;
  idle.move = movement();
}
{ const push = events.push.bind(events); events.push = (...a) => { decided(); return push(...a); }; }
let starved = 0, minHumans = s.humans, starsDay0 = 0, starsDayEnd = 0, stall = 0, worstStall = 0;
const fmt = (sec) => `${Math.floor(sec / 60)}m${String(Math.round(sec) % 60).padStart(2, '0')}s`;
const yr = (d) => (d / DAYS_PER_YEAR).toFixed(1);
// a chamber an order has already claimed is not an empty one; the cryo hall has one of its own
// (deep-tree: the hall is bought on the tree as the game buys it, with its chamber)
const usedChambers = () => ROOMS.reduce((a, t) => a + s.rooms[t], 0) + (s.rooms.cryo || 0) + (s.builds || []).filter((j) => j.kind === 'room').length;
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
  // v1.49.0: the Watcher took a dormitory (or the ice took people), the colony mourns, the beds
  // stand empty and no farm will fill them. It waits (and sleeps) instead of buying farms forever.
  if (mournWait(report)) return null;
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
    if (hungriest && s.stars - reserve >= nextPrice(s, 'auto', hungriest)) {
      onTree(AUTO_NODE[hungriest]);
      return `auto ${hungriest} ${s.auto[hungriest] + 1} ordered (${BUILD_DAYS.auto} d)`;
    }
    t = 'dorm';
  }
  // deep-econ: before the hall the player does what the tape says, AUTOMATE ... on Cryo I's road
  if (s.cryo < 0) {
    for (const r of ['generator', 'farm', 'mine']) {
      if ((s.rooms[r] || 0) > 0 && !(s.auto[r] > 0) && !buildPending(s, 'auto', r) && s.stars >= nextPrice(s, 'auto', r)) {
        onTree(AUTO_NODE[r]);
        return `auto ${r} ${s.auto[r] + 1} ordered (${BUILD_DAYS.auto} d)`;
      }
    }
  }
  // 3. level or automate the weakest, cheaper first (stars)
  // deep-econ: the prices the drawer shows, held inside their band of the income (deep.js banded)
  const lv = nextPrice(s, 'level', t), au = nextPrice(s, 'auto', t);
  // the tree draws LEVEL_MAX levels and sells no more (B175)
  const canLv = !buildPending(s, 'level', t) && (s.level[t] || 0) < LEVEL_MAX, canAu = !buildPending(s, 'auto', t);
  const purse = s.stars - reserve;
  if (canLv && lv <= au && purse >= lv) { onTree(LEVEL_NODE[t]); return `level ${t} ${s.level[t] + 1} ordered (${BUILD_DAYS.level} d)`; }
  if (canAu && purse >= au) { onTree(AUTO_NODE[t]); return `auto ${t} ${s.auto[t] + 1} ordered (${BUILD_DAYS.auto} d)`; }
  if (canLv && purse >= lv) { onTree(LEVEL_NODE[t]); return `level ${t} ${s.level[t] + 1} ordered (${BUILD_DAYS.level} d)`; }
  // 4. a faster sleep (stars), once a dry run says the colony could sleep a second of it safely
  const next = nextCryo(s);
  if (next && purse >= cryoPrice(s, s.cryo + 1) && (s.cryo < 0 ? true : !sleepTrouble(s, next.days))) {
    if (s.cryo < 0 && sleepTrouble(s, next.days)) return null;
    onTree(cryoNode(s.cryo + 1), { ...SIM, need: null });     // the gate is the dry run just above
    return `${next.id} (${next.days} d a second)`;
  }
  return null;
}

/** The player sees that only time refills empty beds while the colony mourns. (--watcher only
 *  until deep-voice; Surface's longer sleeps bring the plain player there too. Applied to the old
 *  plain run it moves it by two seconds: 25m03s to 25m01s.) */
function mournWait(report) {
  return report.weakest === 'H' && mourning(s) && s.humans < report.capacity * 0.9;
}

/** Days of waiting before the cheapest thing on the list becomes affordable. */
function waitDays(report) {
  if (mournWait(report)) return Infinity;
  const t = ROOM_FOR_COLUMN[report.weakest];
  const mineralTarget = usedChambers() < s.chambers ? roomCost(t, s.rooms[t]) : digCost(s.chambers);
  // deep-econ: after the hall the stars wait for the goal (wantsToWake), not for the weakest column
  const starTarget = s.cryo >= 0 ? Infinity : Math.min(nextPrice(s, 'level', t), nextPrice(s, 'auto', t),
    nextCryo(s) ? cryoPrice(s, s.cryo + 1) : Infinity);
  const reserve = Math.max(80, report.fuel * FUEL_DAYS);
  const mineralWait = report.parts.M > 0 ? (mineralTarget + reserve - s.minerals) / report.parts.M : Infinity;
  const starWait = report.stars > 0 ? (starTarget - s.stars) / report.stars : Infinity;
  return Math.max(0, Math.min(mineralWait, starWait));
}

/** Would the player wake now? When the next thing it wants is paid for. */
function wantsToWake() {
  // deep-econ: after the hall the player wakes when the tape says WAKE: the goal can be paid
  // (the store full is checked by the caller). Ore waits for the wake.
  const g = simGoal();
  if (g) return g.gap <= 0;
  const r = tickDay(JSON.parse(JSON.stringify(s)), false);
  if (waitDays(r) <= 0) return true;
  const next = nextCryo(s);
  return !!next && s.stars >= cryoPrice(s, s.cryo + 1) && !sleepTrouble(s, next.days);
}

/** A party when it is cheap: the ring is the goal, and every reading narrows it. */
function maybeScout(r) {
  if ((s.probes || []).length || s.cryo < 0 || (s.est?.spread ?? 40) <= SCOUT_UNTIL_SPREAD) return;
  if (r.parts.E < PROBE_ENERGY || s.humans - scoutParty(s.humans) < MIN_SLEEPERS) return;
  if (probeCost(s.probesSent) > s.minerals * SCOUT_SHARE_OF_ORE) return;
  if (launchProbe(s)) { scoutsSent++; events.push({ real, day: s.day, e: `scout party sent (${s.probes[s.probes.length - 1].people})` }); }
}

let summaryWeakest = null;   // what the wake-up summary said stalled while the colony slept
// the --watcher player does not go up at the ring: it grows the body, and its run ends at the
// last wake-up (v1.50.0; the sensor wakes the colony once at the ring, and it sleeps on after)
let ringAt = null;
// deep-grow: the body's run. The layout is frozen the day it begins (the sim builds no rooms after it)
const answered = () => (s.tree.bought || []).includes('question');
let growLayout = null, growAt = null, handsAt = null, floorsAt = [];
const grown = { hand: 0, spread: 0, died: 0, revived: 0, items: [], lowFeed: Infinity };
/** The sim keeps counts, not places: a layout where the types are spread over the floors the way a
 *  colony built as it went would have them (every type on every floor), the hall where it was dug. */
function mixedLayout() {
  const left = { ...Object.fromEntries(ROOMS.map((t) => [t, s.rooms[t] || 0])) };
  const total = ROOMS.reduce((a, t) => a + left[t], 0);
  const slots = [];
  const done = Object.fromEntries(ROOMS.map((t) => [t, 0]));
  for (let i = 0; i < total; i++) {
    // the type furthest behind its share
    const t = ROOMS.filter((x) => left[x] > done[x]).sort((a, b) => (done[a] / left[a]) - (done[b] / left[b]))[0];
    slots.push(t); done[t]++;
  }
  slots.splice(Math.min(slots.length, 7), 0, ...new Array(s.rooms.cryo || 0).fill('cryo'));
  while (slots.length < s.chambers) slots.push(null);
  return { slots: slots.slice(0, Math.max(s.chambers, slots.length)) };
}
function beginGrow() {
  if (growLayout) return;
  growLayout = mixedLayout();
  // the grafts go where rooms of their kind stand in the layout
  const used = new Set();
  s.graft = s.graft || { owed: 0, slots: [] };
  s.graft.slots = graftTypes.map((t) => { const i = growLayout.slots.findIndex((x, k) => x === t && !used.has(k)); used.add(i); return `s${i}`; }).filter((id) => id !== 's-1');
  normalizeGrow(s, growLayout, tickDay(JSON.parse(JSON.stringify(s)), false));
  growAt = real;
  lastProgress = real;
  if (process.env.GROW_DEBUG) console.log('grow start', JSON.stringify({ humans: s.humans, stars: s.stars, minerals: s.minerals, unit: s.grow.unit, starsDay: s.grow.starsDay, oreDay: s.grow.oreDay, vats: s.vats, rooms: s.rooms }));
  events.push({ real, day: s.day, e: `THE QUESTION: the body begins (${growLayout.slots.length} chambers, ${graphOf(growLayout).nodes.length} nodes)` });
}
const DREAM_WAKE_SECONDS = 1.5;    // the wake: the lamp, the panel back
const DREAM_DOWN_SECONDS = 1.2;    // the pull: the panel dims (index.js DREAM_DOWN_MS)
let lastProgress = 0, longestStuck = 0, stuckAt = 0, dreamInto = 0, dreamReal = 0, dreams = 0;
const dreamWoke = {};
const seenAt = {};
// deep-organs: the organs chosen, the pumps, the cascades, the starving edge, the time each floor took
const organsChosen = { vat: 0, gut: 0, heart: 0, nerve: 0, hands: 0 };
const pumpLog = { n: 0, on: 0, fill: 0 };
const cascadeAt = [];
let pumpClock = 0, pumpTurn = 0, takeStartAt = null;
const takeSecs = [];               // real seconds from a take's start to its end, by hand
const weakSecs = { M: 0, F: 0, E: 0, H: 0 };
let paceSum = 0, paceN = 0, starveSecs = 0;
function progressed() { lastProgress = real; }
function noteStuck() {
  const k = real - lastProgress;
  if (k > longestStuck) { longestStuck = k; stuckAt = real; }
  if (process.env.STUCK_DEBUG && k > 8) { const R = bodyRatios(s, growLayout); console.log(`stuck ${k.toFixed(1)} s at ${fmt(real)} ${s.grow.dreaming ? 'DREAM' : 'awake'} mass ${s.grow.mass.toFixed(1)} price ${R.price} rate ${R.massRate.toFixed(2)} ratios ${JSON.stringify(R.ratios)} take ${JSON.stringify(s.grow.take)}`); }
}
/** One real second of colony life in GROW: a colony day (or a dream's dive of them), and a body second. */
function growDay(days = 1) {
  let r = null;
  for (let d = 0; d < days; d++) {
    completeBuilds(s);
    s.organs = organsOf(s, growLayout);
    r = tickDay(s, false);
    earned += r.stars;
  }
  const y = stepGrow(s, growLayout, 1);
  grown.died += y.died.length; grown.revived += y.revived.length;
  for (const t of y.done) afterTake(t);
  if (y.revived.length) progressed();
  for (const id of y.seen) seenAt[id] = real;
  return { r, y };
}
function afterTake(t) {
  if (!t) return;
  progressed();
  if (t.by === 'hand') grown.hand++; else grown.spread++;
  organsChosen[t.organ] = (organsChosen[t.organ] || 0) + 1;
  if (takeStartAt !== null && !t.regrow) { takeSecs.push(real - takeStartAt); takeStartAt = null; }
  for (const f of t.cascade || []) { cascadeAt.push({ f, real }); events.push({ real, day: s.day, e: `floor ${f + 1} full: its organs give twice, the spine goes down` }); }
}
function afterGrowSecond(r) {
  if (handsAt === null && s.grow.body.includes('machine')) handsAt = real;
  const deepest = riseReady(s, growLayout).deepest;
  for (let f = 0; f <= deepest; f++) {
    if (floorsAt[f] === undefined && graphOf(growLayout).nodes.filter((n) => n.floor === f).every((n) => s.grow.body.includes(n.id))) floorsAt[f] = real;
  }
  grown.lowFeed = Math.min(grown.lowFeed, s.humans);
  earnedAt.push([real, earned]);
  const R = bodyRatios(s, growLayout);
  weakSecs[R.weakest]++;
  paceSum += R.pace; paceN++;
  if (s.grow.necrotic.length) starveSecs++;
  if (process.env.GROW_DEBUG && real % 10 < 1) { const h = hungerNow(s, growLayout); console.log(`${fmt(real)} ${s.grow.dreaming ? 'DREAM' : 'awake'} humans ${Math.round(s.humans)} eat ${h.eat.toFixed(0)} grow ${h.grow.toFixed(0)} body ${s.grow.body.length} nec ${s.grow.necrotic.length} mass ${s.grow.mass.toFixed(0)} price ${R.price} ratios ${Object.entries(R.ratios).map(([k, v]) => `${k}${v.toFixed(2)}`).join(' ')} pace ${R.pace.toFixed(2)} take ${s.grow.take ? `${s.grow.take.id}:${s.grow.take.organ} ${s.grow.take.done.toFixed(1)}/${s.grow.take.work.toFixed(1)}` : '-'} lv ${JSON.stringify(s.grow.lv)}`); }
  if (real % 60 < 1) log.push({ min: Math.round(real / 60), year: +yr(s.day), humans: Math.round(s.humans), starsDay: +r.stars.toPrecision(3), flesh: +fleshShare(s, growLayout).toFixed(2), necrotic: s.grow.necrotic.length, stars: +s.stars.toPrecision(3) });
  noteStuck();
}
function growSecond() {
  if (s.grow.dreaming) { dreamSecond(); return; }
  // awake: a day a real second, and the player acts on it
  const { r } = growDay(1);
  real += 1;
  // the heart, at a human rate: a pump every PUMP_EVERY_S, on the beat half the time
  pumpClock += 1;
  while (pumpClock >= PUMP_EVERY_S && !risen(s)) {
    pumpClock -= PUMP_EVERY_S;
    const beat = (pumpTurn++ % Math.round(1 / PUMP_ON_SHARE)) === 0;
    const p = pump(s, growLayout, { beat });
    if (!p) break;
    pumpLog.n++; if (beat) pumpLog.on++; pumpLog.fill += p.fill;
    if (p.done) afterTake(p.done);
    if (p.revived) progressed();
  }
  let takes = 0, boughtNow = false;
  for (let round = 0; round < TAKES_PER_SECOND + 4 && !s.grow.dreaming && !risen(s); round++) {
    let did = false;
    for (const a of decideGrow(s, growLayout)) {
      if (a.kind === 'take' && takes >= TAKES_PER_SECOND) break;
      if (a.kind === 'body' && boughtNow) continue;
      if (!pressGrow(s, growLayout, a, r.stars, r.minerals)) continue;
      did = true;
      if (a.kind === 'take') { takes++; takeStartAt = real; progressed(); decided(); }
      if (a.kind === 'body') { boughtNow = true; progressed(); grown.items.push(`${a.id} ${s.grow.lv[a.id]} ${fmt(real)}`); events.push({ real, day: s.day, e: `body ${a.id} ${s.grow.lv[a.id]}` }); }
      if (a.kind === 'rise') { progressed(); events.push({ real, day: s.day, e: 'RISE' }); }
      if (a.kind === 'dream') { dreams++; dreamInto = 0; real += DREAM_DOWN_SECONDS; events.push({ real, day: s.day, e: `dream toward ${s.grow.marks.join(', ')}` }); }
    }
    if (!did) break;
  }
  afterGrowSecond(r);
}
function dreamSecond() {
  const days = Math.max(1, Math.round(dreamDaysAt(dreamInto, 1)));
  const { r, y } = growDay(days);
  real += 1; dreamInto += 1; dreamReal += 1;
  const woke = dreamWake(s, growLayout, y);
  if (woke) {
    dreamEnd(s);
    dreamWoke[woke] = (dreamWoke[woke] || 0) + 1;
    real += DREAM_WAKE_SECONDS;
    decided();
  }
  afterGrowSecond(r);
}
while (real < REAL_CAP && !risen(s) && (WATCHER ? !bodyEnd : true)) {
  if (ringAt === null && canAscend(s)) ringAt = real;
  if (answered()) { beginGrow(); growSecond(); continue; }
  completeBuilds(s);                    // nothing is instant: orders land on their day
  const r = tickDay(s, false);
  for (const l of resolveDueProbes(s, slots(), rng)) { if (l.outcome === 'lost') scoutsLost++; if (l.outcome === 'monster') monsters++; }
  repairTick(s, slots(), r.hands);
  if (summaryWeakest) { r.weakest = summaryWeakest; summaryWeakest = null; }
  real += 1;
  earned += r.stars; earnedAt.push([real, earned]);
  recoverAwake(w, 1);                   // v1.49.0: awake, the Watcher rests
  recoverAwake(w2, 1);
  onCurve(r.stars);
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
  buyGifts(false);
  buyGoal();
  buyFeed(false);
  buyVats();
  placeGrafts(r);
  while ((bought = buy(r)) && n < 25) { events.push({ real, day: s.day, e: bought }); n++; buysThisWake++; }
  maybeScout(r);
  // Nothing affordable and the wait is long: go to sleep, if a dry run says the colony would
  // not be woken to trouble at once. That is the lesson the chapter teaches: a manual room
  // stops the moment everyone lies down, and the alarm says so.
  if (n === 0 && s.cryo >= 0 && waitDays(r) > WAIT_DAYS && s.humans >= MIN_SLEEPERS && !sleepTrouble(s, CRYO[s.cryo].days)) {
    decided();                         // the lever, pulled
    simAsleep = true;
    beginSleepYield(s);                // deep-econ: a sleep brings at most SLEEP_CAP_SECONDS of income
    real += SLEEP_SECONDS;
    const hist = { M: 0, F: 0, E: 0, H: 0 };
    let alarm = null, slept = 0, died = 0, held = 0, lookClock = 0;
    beginSleep(w, s.cryo);
    beginSleep(w2, s.cryo);
    // deep-voice: is Surface due in this sleep? Then the player stays under for it
    const visitThisSleep = !firstSleep(w) && visitDue(w.surface, w.sleeps);
    let voiceLeft = 0;                 // real seconds still to give the visit once it has come
    // one real second of sleep at a time, until something wakes the colony. deep-rebuild: THE DIVE,
    // each second sleeps sleepDaysAt() of the tier (slow at first, then up to three times the rate)
    let into = 0;
    while (real < REAL_CAP) {
      const rate = CRYO[s.cryo].days;
      const want = sleepDaysAt(into, 1, rate);
      const sum = sleep(s, want, { alarms: true, slots: slots(), rng });
      const spent = want > 0 ? sum.days / want : 1;
      into += spent;
      real += spent; sleepReal += spent; lookClock += spent;
      earned += sum.stars; earnedAt.push([real, earned]);
      if (sum.days > 0) onCurve(sum.stars / sum.days);
      watchSleep(w, { days: sum.days, tier: s.cryo, spare: sum.spare });
      if (sum.alarm) alarmHit(w, sum.alarm.kind);
      w2.bought = w.bought.slice();                       // the --watcher player's ladder counts for both
      watchSleep(w2, { days: sum.days, tier: s.cryo, spare: sum.spare });
      snapClock += spent;
      while (snapClock >= SNAP_EVERY) { snapClock -= SNAP_EVERY; snap(w2, sleepReal * 1000, s.cryo); }
      if (sum.alarm) alarmHit(w2, sum.alarm.kind);
      lowest2 = Math.min(lowest2, w2.stability);
      // Surface, when it comes, in both runs (deep-voice); a night holds the player under
      if (surfaceDue(w, slept + sum.days, rate)) {
        const v = surfaceComes();
        voiceLeft = GAME_SECONDS + (v.night ? (v.line.length * TYPE_MS) / 1000 + LINE_READ : 0);
      } else if (voiceLeft > 0) voiceLeft -= spent;
      buyGifts(true);
      if (answered()) { alarm = 'question'; break; }     // deep-grow: the body begins awake
      buyFeed(true);
      if (WATCHER) {
        // the ladder: the next step the moment it can be paid
        let id, got;
        while ((id = nextWatcherNode(s)) && (got = treeBuy(s, id, { ...SIM, asleep: true, slots: slots() }))) {
          ladderAt.push({ id: got.step.step.id, real, year: s.day / DAYS_PER_YEAR });
        }
      }
      lowest = Math.min(lowest, w.stability);
      if (capFullAt === null && w.capacity >= 100) capFullAt = real;
      diedInIce += sum.died; died += sum.died; slept += sum.days;
      for (const k of COLUMN) { hist[k] += sum.weakest[k] || 0; weakAsleep[k] += sum.weakest[k] || 0; }
      for (const l of sum.landed) { if (l.outcome === 'lost') scoutsLost++; if (l.outcome === 'monster') monsters++; }
      if (sum.alarm) { alarm = sum.alarm.kind; break; }
      // v1.48.0: the first sleep ends on a plain alarm after a year, whatever else happens
      if (firstSleep(w) && slept >= FIRST_SLEEP_DAYS) { alarm = 'first'; break; }
      // deep-fix: at Cryo I and II a sleep nothing else ends wakes for a look, once Surface has gone
      if (lookDue(w, s.cryo, lookClock)) { alarm = 'look'; break; }
      // the --watcher player stays under a while longer when the next step waits only on capacity
      const waitsOnCapacity = WATCHER && ['capacity', 'growing'].includes(stepNeed(w, s)?.missing) && held < WATCHER_HOLD;
      if (waitsOnCapacity && wantsToWake()) { held += spent; continue; }
      // deep-voice: a line is due in this sleep and has not come or not finished typing yet
      const waitsOnVoice = visitThisSleep && (w.surface.visit ? voiceLeft > 0 : true);
      if (waitsOnVoice && wantsToWake()) continue;
      if (wantsToWake()) { alarm = 'hand'; handWakes++; decided(); break; }
      // deep-econ: the store is full and nothing more comes in this sleep: the instruments say WAKE
      if (sleepFull(s) && !waitsOnVoice && !waitsOnCapacity) { alarm = 'full'; decided(); break; }
    }
    closeSurface(w);
    simAsleep = false;
    endSleepYield(s);
    setIncome(s);                      // deep-econ: the prices follow the income from this wake on
    // v1.50.0: the body is whole, and this was its last sleep: nobody comes out. The run ends here.
    if (WATCHER && bodyWhole(w)) { bodyEnd = { real, year: s.day / DAYS_PER_YEAR, were: lastWake(w, s) }; break; }
    // v1.48.0: a sleep that cost lives in the ice is mourned for a year after the wake
    if (died >= 0.5) mourn(s);
    alarmsSeen[alarm] = (alarmsSeen[alarm] || 0) + 1;
    summaryWeakest = COLUMN.reduce((a, k) => (hist[k] > hist[a] ? k : a), 'M');
    wakeUps++; pressesPerTier[s.cryo]++;
    buysPerWake.push(buysThisWake); buysThisWake = 0;
  }
  if (real % 60 < 1 && (!log.length || log[log.length - 1].min !== Math.round(real / 60))) {
    log.push({ min: Math.round(real / 60), year: +yr(s.day), surface: +surface(s.doom0, s.day).toFixed(1), humans: Math.round(s.humans),
      starsDay: +r.stars.toPrecision(3), feed: s.feed || 0, stars: +s.stars.toPrecision(3), chambers: s.chambers, weakest: r.weakest, cryo: s.cryo, wakeUps });
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
if (WATCHER) {
  const at = (id) => { const e = ladderAt.find((x) => x.id === id); return e ? fmt(e.real) : 'never'; };
  console.log(`ladder (--watcher)  ${LADDER.map((u) => `${u.id} ${at(u.id)}`).join('  ')}  dormitories taken ${s.taken?.dorm || 0}  sectors sealed ${(w.sealed || []).length}  surface games ${surfaceGames} (words ${w.surface.words}/${9})`);
  console.log(bodyEnd
    ? `biological ending (--watcher)  the last wake-up at ${fmt(bodyEnd.real)}, year ${Math.round(bodyEnd.year)}: nobody came out (${Math.round(bodyEnd.were)} under the ice)`
    : 'biological ending (--watcher)  retired in deep-grow: the ladder stops after HARDWARE and the body rises instead (GROW below)');
  console.log(`the ring (--watcher)  ${ringAt === null ? 'not reached' : `reached at ${fmt(ringAt)}, the player stayed down`}`);
}
/*
 * v1.52.0: THE SNAP IS ENOUGH, checked where it matters. The greedy player above sleeps about a
 * second a sleep, so its sleeps say little about the Watcher. A human sleeps longer: here, each
 * tier on its own, from a full meter, sleeps of REF_SLEEP real seconds with REF_AWAKE seconds
 * awake between them, each ended by a plain alarm (an order landing, -2). Unattended: the sleep
 * in which the system first reboots. Attentive: the lowest and highest stability from the third
 * sleep on (the meter has settled by then), snapping every SNAP_EVERY seconds.
 */
const REF_SLEEP = 25, REF_AWAKE = 20, REF_SLEEPS = 10;
function refTier(tier, every) {
  const r = { ...initialWatcher(), sleeps: 5 };
  let clock = 0, since = 0, low = 100, high = 0, rebootAt = null;
  for (let n = 1; n <= REF_SLEEPS; n++) {
    beginSleep(r, tier);
    for (let k = 0; k < REF_SLEEP * 10; k++) {
      clock += 0.1; since += 0.1;
      watchSleep(r, { days: sleepDaysAt(k * 0.1, 0.1, CRYO[tier].days), tier });     // deep-rebuild: the dive
      if (every && since >= every - 1e-9) { since = 0; snap(r, clock * 1000, tier); }
      if (n >= 3) { low = Math.min(low, r.stability); high = Math.max(high, r.stability); }
    }
    alarmHit(r, 'act');
    if (r.reboots && rebootAt === null) rebootAt = n;
    recoverAwake(r, REF_AWAKE);
    clock += REF_AWAKE;
  }
  return { low, high, rebootAt };
}
const TIERS = CRYO.map((_, i) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i] || String(i + 1));
const absent = CRYO.map((_, t) => `${TIERS[t]} ${refTier(t, 0).rebootAt ?? 'never'}`).join(' ');
const held = CRYO.map((_, t) => { const h = refTier(t, SNAP_EVERY); return `${TIERS[t]} ${Math.round(h.low)}-${Math.round(h.high)}`; }).join(' ');
const named = nightAt.find((x) => x.n === 1);
if (process.argv.includes('--gifts')) {
  // what a minute of play is worth when each night comes (and, for Long count, when Cryo VII is bought)
  for (const x of nightAt) console.log(`night ${x.n} at ${fmt(x.real)}: a minute of play earns ${(earnedBy(x.real + 60) - earnedBy(x.real)).toPrecision(3)} stars (in hand ${x.stars.toPrecision(3)})`);
  const vii = events.find((e) => /^cryo-vii /.test(e.e));
  if (vii) console.log(`Cryo VII at ${fmt(vii.real)}: a minute of play earns ${(earnedBy(vii.real + 60) - earnedBy(vii.real)).toPrecision(3)} stars`);
}
const gat = (id) => (giftAt[id] ? fmt(giftAt[id].real) : 'never');
console.log(`stars/day curve (first reaches 10^k)  ${curve.map((t, k) => (t === undefined ? null : `${k}:${fmt(t)}`)).filter(Boolean).join(' ')}`);
console.log(`the machine (deep-machine)  fed ${feedAt.map((x) => `${x.level} ${fmt(x.real)}`).join('  ') || 'never'}`);
console.log(`culture vats (deep-fix2)  ${vatsAt.map((x) => `${x.level} ${fmt(x.real)}`).join('  ') || 'never'}`);
console.log(`grafts (deep-grow2)  ${graftAt.map((g) => `${g.type} ${fmt(g.real)}`).join('  ') || 'none'}`);
console.log(`surface (both runs: wins 1 in 3)  games ${surfaceGames}  nights ${nightAt.map((x) => `${x.n} ${fmt(x.real)}`).join('  ') || 'none'}  |  gifts bought: ${Object.keys(GIFT_PRICE).map((id) => `${id} ${gat(id)}`).join('  ')}  (of ${NIGHTS.length} nights)`);
console.log(`watcher (unattended: no snaps, no riddles, reboots do not wake)  stability ${Math.round(w.stability)} at the end, lowest ${Math.round(lowest)}, ${w.reboots} reboots  slept ${Math.round(w.sleptYears)} y  named at ${named ? `${fmt(named.real)} (year ${Math.round(named.year)})` : 'never'} (night 1)  capacity first full at ${capFullAt === null ? 'never' : fmt(capFullAt)}  |  ${REF_SLEEP} s sleeps from full, first reboot in sleep: ${absent}`);
console.log(`watcher (attentive: snap every ${SNAP_EVERY} s)  stability ${Math.round(w2.stability)} at the end, lowest ${Math.round(lowest2)}, ${w2.reboots} reboots  |  ${REF_SLEEP} s sleeps, held (low-high from the third sleep): ${held}`);
if (growAt !== null) {
  const total = real;
  console.log(`GROW (deep-organs, the ${VIEW} view's neighbours)  the question at ${fmt(growAt)}, ${risen(s) ? `the rise at ${fmt(real)}` : 'no rise'}: ${fmt(total - growAt)} of ${fmt(total)} (${Math.round(100 * (total - growAt) / total)} %)  floors full ${floorsAt.map((t, f) => `${f + 1}:${fmt(t)}`).join(' ')}  the hands ${handsAt === null ? 'never' : fmt(handsAt)}  taken by hand ${grown.hand}, by the trickle or a dream ${grown.spread}  necrosis ${grown.died} (revived ${grown.revived}, ${starveSecs} s with dead flesh)  people low ${Math.round(grown.lowFeed)}`);
  const ts = takeSecs.slice().sort((x, y) => x - y);
  const q = (k) => (ts.length ? Math.round(ts[Math.min(ts.length - 1, Math.floor(k * ts.length))]) : 0);
  console.log(`  organs ${Object.entries(organsChosen).map(([k, v]) => `${k} ${v}`).join(', ')}  pumps ${pumpLog.n} (on the beat ${pumpLog.on})  a take by hand ${q(0.5)} s (median; ${q(0.1)} to ${q(0.9)})  pace ${(paceSum / Math.max(1, paceN)).toFixed(2)} on average  weakest ${Object.entries(weakSecs).map(([k, v]) => `${k} ${Math.round(100 * v / Math.max(1, paceN))} %`).join(' ')}`);
  console.log(`  dreams ${dreams} (${fmt(dreamReal)} dreaming; woke ${Object.entries(dreamWoke).map(([k, v]) => `${k} ${v}`).join(', ') || 'never'})  longest stuck ${Math.round(longestStuck)} s (ending at ${fmt(stuckAt)})  cascades ${cascadeAt.map((c) => `${c.f + 1}:${fmt(c.real)}`).join(' ') || 'none'}  the drawer: ${['vats', 'appetite', 'spread', 'muscle'].map((id) => `${id} ${seenAt[id] === undefined ? 'never' : fmt(seenAt[id])}`).join('  ')}`);
  console.log(`  body items  ${grown.items.join('  ') || 'none'}`);
} else console.log('GROW (deep-grow)  the question never answered');
console.log(`longest without a decision (deep-econ, target 60 s)  TEND ${Math.round(idle.TEND[0])} s (ending ${fmt(idle.TEND[1])})  SLEEP ${Math.round(idle.SLEEP[0])} s (ending ${fmt(idle.SLEEP[1])})  GROW ${Math.round(idle.GROW[0])} s (ending ${fmt(idle.GROW[1])})`);
const shown = process.argv.includes('--all') ? events : events.slice(0, 30);
if (!process.argv.includes('--quiet')) for (const e of shown) console.log(`  ${fmt(e.real).padStart(7)}  y${yr(e.day).padStart(7)}  ${e.e}`);
if (process.argv.includes('--table')) console.table(log);
