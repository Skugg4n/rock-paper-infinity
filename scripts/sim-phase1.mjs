 
// Phase 1 economy simulation: greedy player, 1 s steps. Mirrors src/phase1/rates.js + upgrades-config.js.
// Usage: node scripts/sim-phase1.mjs old|new   (old = v1.19.2 balance, for comparison)
const MODE = process.argv[2] || 'new';

const P = MODE === 'old' ? {
  speedMax: 55, speedCost: L => 10 + Math.floor(L * 2),
  genMax: 100, genCost: L => 50 + Math.floor(L * 5), genRate: 5, genUnlock: { sps: 50 },
  boardMax: 8, boardCost: L => 100 + Math.floor(L * 25), boardUnlock: 100,
  luckCost: 50, luckUnlockGames: 100, luckWinRate: 1 / 3, // BUG: luck ignored in bulk
  battCost: 100, battAmount: 700, battUnlock: 50,
  rechargeAmount: 10, rechargeUnlock: 15,
  factoryCost: 1000, factoryNeedsGenMax: true, factoryEnergyFree: false,
  bankGate: 50000, foamMax: 1000, foamBonusSec: 10,
  roundTime: s => (1.2 / s * 1000 + 450) / 1000, // formula the old display assumed
  realRoundTime: s => { // what the old loop actually did (skip-ticks)
    const interval = 1.2 / s * 1000 + 450;
    const frames = s <= 5 ? 3 : s <= 6 ? 2 : 1;
    const anim = frames * Math.max(120, 1.2 / s / 3 * 1000) + 400;
    return (anim > interval ? 2 * interval : interval) / 1000;
  },
} : {
  speedMax: 40, speedCost: L => Math.round(10 * Math.pow(1.10, L)),
  genMax: 50, genCost: L => Math.round(25 * Math.pow(1.07, L)), genRate: 10, genUnlock: { stars: 100 },
  boardMax: 8, boardCost: L => Math.round(250 * Math.pow(1.9, L)), boardUnlock: 150,
  luckCost: 50, luckUnlockGames: 100, luckWinRate: 2 / 3,
  battCost: 30, battAmount: 500, battUnlock: 40,
  rechargeAmount: 25, rechargeUnlock: 15,
  factoryCost: 10000, factoryNeedsGenMax: true, factoryEnergyFree: true,
  bankGate: 250000, foamMax: 20000, foamBonusSec: 30,
  roundTime: s => {
    const frames = s <= 5 ? 3 : s <= 6 ? 2 : 1;
    const frame = Math.max(120, 400 / s);
    const hold = Math.max(160, 500 / s);
    return (frames * frame + hold + 100) / 1000;
  },
  realRoundTime: null,
};
P.realRoundTime ??= P.roundTime;

const st = {
  t: 0, bal: 0, earned: 0, games: 0, energy: 100, reserve: 0,
  auto: false, speed: 0, gen: 0, boards: 1, luck: false, factory: false, bank: false,
  foam: 0, clicks: 0, batteries: 0,
};
const gameSpeed = () => 1 + st.speed;
const winRate = () => (st.luck ? P.luckWinRate : 1 / 3);
const mult = () => (st.factory ? 10 : 1);
const gamesPerSec = () => {
  const s = gameSpeed();
  const b = st.factory ? 9 : st.boards;
  if (!st.auto) return 1.5; // manual clicking ~1.5 clicks/s
  if (MODE !== 'old' && st.energy + st.reserve <= 0 && !st.factory) return 1.5; // hands are free
  return s >= 10 ? s * b : b / P.realRoundTime(s);
};
const sps = () => gamesPerSec() * winRate() * mult();
const milestones = {};
const mark = (k) => { if (!(k in milestones)) milestones[k] = st.t; };
const log = [];

function buy(cost) { if (st.bal >= cost) { st.bal -= cost; return true; } return false; }

function shop() {
  let bought = true;
  while (bought) {
    bought = false;
    if (!st.auto && st.earned >= 2 && buy(5)) { st.auto = true; mark('autoPlay'); bought = true; continue; }
    if (!st.luck && st.games >= P.luckUnlockGames && buy(P.luckCost)) { st.luck = true; mark('luck'); bought = true; continue; }
    // energy balance: generation vs consumption (factory free in new)
    const cons = (st.factory && P.factoryEnergyFree) ? 0 : gamesPerSec();
    const genUnlocked = P.genUnlock.sps ? sps() >= P.genUnlock.sps : st.earned >= P.genUnlock.stars;
    const restMaxed = st.speed >= P.speedMax && st.boards >= P.boardMax && st.luck;
    const genNeeded = genUnlocked && st.gen < P.genMax && (st.gen * P.genRate < cons || (P.factoryNeedsGenMax && restMaxed));
    if (genNeeded && buy(P.genCost(st.gen))) { st.gen++; mark('generator'); bought = true; continue; }
    if (genNeeded && MODE !== 'old') { /* save up for generator */
      if (st.energy + st.reserve < cons * 2 && st.earned >= P.rechargeUnlock && st.bal >= 1 && st.energy < 100) { st.bal -= 1; st.energy = Math.min(100, st.energy + P.rechargeAmount); st.clicks++; bought = true; continue; }
      return;
    }
    if (st.factory && !st.bank && st.earned >= P.bankGate) { st.bank = true; mark('bank'); return; }
    if (!st.factory && st.auto && st.luck && st.speed >= P.speedMax && st.boards >= P.boardMax
        && (!P.factoryNeedsGenMax || st.gen >= P.genMax) && buy(P.factoryCost)) { st.factory = true; mark('factory'); bought = true; continue; }
    if (st.factory) continue;
    // speed vs board: pick better games/s per star
    const canSpeed = st.auto && st.speed < P.speedMax;
    const canBoard = st.earned >= P.boardUnlock && st.boards < P.boardMax;
    const s = gameSpeed();
    let gainSpeed = -1;
    if (canSpeed) {
      if (s + 1 >= 10) gainSpeed = ((s + 1) * st.boards - gamesPerSec()) / P.speedCost(st.speed);
      else { // look ahead to the bulk jump at 10 and amortize over the remaining levels
        let cost = 0; for (let L = st.speed; L < 9; L++) cost += P.speedCost(L);
        gainSpeed = (10 * st.boards - gamesPerSec()) / cost;
      }
    }
    const gainBoard = canBoard ? (gamesPerSec() / st.boards) / P.boardCost(st.boards - 1) : -1;
    if (gainSpeed >= gainBoard && canSpeed && buy(P.speedCost(st.speed))) { st.speed++; if (gameSpeed() === 10) mark('bulk'); bought = true; continue; }
    if (canBoard && gainBoard > 0 && buy(P.boardCost(st.boards - 1))) { st.boards++; if (st.boards === 2) mark('board2'); bought = true; continue; }
    // energy stopgaps: if starving
    if (st.energy + st.reserve < cons * 2) {
      if (st.earned >= P.battUnlock && buy(P.battCost)) { st.reserve = Math.min(1500, st.reserve + P.battAmount); st.batteries++; bought = true; continue; }
      if (st.earned >= P.rechargeUnlock && st.clicks < 1e9 && st.bal >= 1 && st.energy < 100) { st.bal -= 1; st.energy = Math.min(100, st.energy + P.rechargeAmount); st.clicks++; bought = true; continue; }
    }
  }
}

const T_MAX = 3 * 3600;
while (st.t < T_MAX && !st.bank) {
  const g = gamesPerSec();
  const manual = MODE !== 'old' && st.auto && st.energy + st.reserve <= 0 && !st.factory;
  const cons = (st.factory && P.factoryEnergyFree) || manual ? 0 : g;
  const avail = st.energy + st.reserve;
  const played = Math.min(g, cons === 0 ? g : avail);
  if (cons > 0) { const use = played; if (st.energy >= use) st.energy -= use; else { st.reserve = Math.max(0, st.reserve - (use - st.energy)); st.energy = 0; } }
  const gain = played * winRate() * mult();
  st.bal += gain; st.earned += gain; st.games += played;
  if (st.factory) { st.foam += played; if (st.foam >= P.foamMax) { st.foam = 0; const b = sps() * P.foamBonusSec; st.bal += b; st.earned += b; } }
  const genE = st.gen * P.genRate;
  st.energy += genE; if (st.energy > 100) { st.reserve = Math.min(1500, st.reserve + st.energy - 100); st.energy = 100; }
  shop();
  st.t++;
  if (st.t % 30 === 0) log.push({ t: st.t, sps: +sps().toFixed(1), realSps: +gain.toFixed(1), speed: gameSpeed(), boards: st.boards, gen: st.gen, energy: Math.round(st.energy + st.reserve), bal: Math.round(st.bal), earned: Math.round(st.earned), clicks: st.clicks });
}
const fmt = s => `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
console.log(`MODE=${MODE}  finished at ${fmt(st.t)}  recharge clicks=${st.clicks} batteries=${st.batteries}`);
console.log('milestones:', Object.fromEntries(Object.entries(milestones).map(([k, v]) => [k, fmt(v)])));
console.table(log.filter((_, i) => i % 2 === 0).slice(0, 40));
