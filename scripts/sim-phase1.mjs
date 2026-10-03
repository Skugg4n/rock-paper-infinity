// Phase 1 economy simulation, 1 s steps. Mirrors src/phase1/rates.js + upgrades-config.js.
// Usage: node scripts/sim-phase1.mjs [lazy|fiddler]   (no argument: both players)
//
// Two players. "lazy" never touches the little clover; "fiddler" keeps it lit
// 80 % of the time until the big clover is bought. Both save up for luck, for
// the big battery and for the generator when those are open, and otherwise buy
// whichever of speed and boards gives most games per star. A hand clicks the
// recharge button at most once a second; when that is not enough the machines
// stand still part of the time, which is the slog the big battery ends.
//
// The v1.19.2 "old" mode lived here until v1.52.0; see git history.
const sig2 = (raw) => { const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 1)); return Math.round(raw / mag) * mag; };

const P = {
  speedMax: 40, speedCost: L => sig2(10 * Math.pow(1.10, L)),
  genMax: 50, genCost: L => sig2(25 * Math.pow(1.07, L)), genRate: 10, genUnlockBatteries: 5,
  boardMax: 8, boardCost: L => sig2(250 * Math.pow(1.9, L)), boardUnlock: 150,
  luckCost: 50, luckUnlockGames: 100,
  battCost: 20, battAmount: 1500, battUnlockEps: 22, reserveMax: 1500,
  rechargeAmount: 25, rechargeUnlock: 15, clicksPerSecond: 1,
  factoryCost: 10000, bankGate: 250000, foamMax: 5000, foamBonusSec: 30,
  cloverUptime: 0.8,
};
const roundTime = s => {
  const frames = s <= 5 ? 3 : s <= 6 ? 2 : 1;
  return (frames * Math.max(120, 400 / s) + Math.max(160, 500 / s) + 100) / 1000;
};
const fmt = s => (s === undefined ? '-' : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`);

function run(clover) {
  const st = {
    t: 0, bal: 0, earned: 0, games: 0, energy: 100, reserve: 0,
    auto: false, speed: 0, gen: 0, boards: 1, luck: false, factory: false, bank: false,
    foam: 0, clicks: 0, batteries: 0,
  };
  const milestones = {}; const mark = (k) => { if (!(k in milestones)) milestones[k] = st.t; };
  const battTimes = []; const log = []; let stalled = 0; let stalledBeforeBattery = 0;
  const gameSpeed = () => 1 + st.speed;
  const winRate = () => (st.luck ? 2 / 3 : st.auto ? 1 / 3 + clover / 3 : 1 / 3);
  const mult = () => (st.factory ? 10 : 1);
  // What the machines want to play per second, and what is actually played
  // (hands are free: with no energy the player clicks at about 1.5 games/s).
  const wanted = () => { const s = gameSpeed(), b = st.factory ? 9 : st.boards; return s >= 10 ? s * b : b / roundTime(s); };
  const gamesPerSec = () => (!st.auto || (st.energy + st.reserve <= 0 && !st.factory) ? 1.5 : wanted());
  const buy = (cost) => { if (st.bal >= cost) { st.bal -= cost; return true; } return false; };

  function shop() {
    let clicksLeft = P.clicksPerSecond;
    for (let guard = 0; guard < 200; guard++) {
      if (!st.auto) { if (st.earned >= 2 && buy(5)) { st.auto = true; mark('autoPlay'); continue; } return; }
      const luckOpen = !st.luck && st.games >= P.luckUnlockGames;
      if (luckOpen && buy(P.luckCost)) { st.luck = true; mark('bigClover'); continue; }
      const cons = st.factory ? 0 : wanted();
      const starving = cons > 0 && st.energy + st.reserve < cons * 3;
      const genOpen = (st.gen > 0 || st.batteries >= P.genUnlockBatteries) && st.gen < P.genMax;
      const restMaxed = st.speed >= P.speedMax && st.boards >= P.boardMax && st.luck;
      const genNeeded = genOpen && (st.gen * P.genRate < cons || restMaxed);
      if (genNeeded && buy(P.genCost(st.gen))) { st.gen++; mark('generator'); continue; }
      let saving = genNeeded || luckOpen;
      const battOpen = (st.batteries > 0 || cons >= P.battUnlockEps) && st.gen * P.genRate < cons;
      if (battOpen && st.reserve < cons * 3) {
        if (buy(P.battCost)) { st.reserve = Math.min(P.reserveMax, st.reserve + P.battAmount); st.batteries++; battTimes.push(st.t); mark('bigBattery'); continue; }
        saving = true;
      }
      if (starving && clicksLeft > 0 && st.earned >= P.rechargeUnlock && st.bal >= 1 && st.energy < 100) {
        clicksLeft--; st.bal -= 1; st.energy = Math.min(100, st.energy + P.rechargeAmount); st.clicks++; mark('firstRecharge'); continue;
      }
      if (saving) return;
      if (st.factory) { if (!st.bank && st.earned >= P.bankGate) { st.bank = true; mark('bank'); } return; }
      if (st.luck && st.speed >= P.speedMax && st.boards >= P.boardMax && st.gen >= P.genMax) {
        if (buy(P.factoryCost)) { st.factory = true; mark('factory'); continue; }
        return;
      }
      // speed vs board: pick better games/s per star
      const canSpeed = st.speed < P.speedMax;
      const canBoard = st.earned >= P.boardUnlock && st.boards < P.boardMax;
      const s = gameSpeed();
      let gainSpeed = -1;
      if (canSpeed) {
        if (s + 1 >= 10) gainSpeed = ((s + 1) * st.boards - wanted()) / P.speedCost(st.speed);
        else { // look ahead to the bulk jump at 10 and amortize over the remaining levels
          let cost = 0; for (let L = st.speed; L < 9; L++) cost += P.speedCost(L);
          gainSpeed = (10 * st.boards - wanted()) / cost;
        }
      }
      const gainBoard = canBoard ? (wanted() / st.boards) / P.boardCost(st.boards - 1) : -1;
      if (gainSpeed >= gainBoard && canSpeed) { if (buy(P.speedCost(st.speed))) { st.speed++; if (gameSpeed() === 10) mark('bulk'); continue; } return; }
      if (canBoard && gainBoard > 0) { if (buy(P.boardCost(st.boards - 1))) { st.boards++; if (st.boards === 2) mark('board2'); continue; } return; }
      return;
    }
  }

  while (st.t < 3 * 3600 && !st.bank) {
    const g = gamesPerSec();
    const manual = st.auto && st.energy + st.reserve <= 0 && !st.factory;
    if (manual) { stalled++; if (!st.batteries) stalledBeforeBattery++; }
    const cons = st.factory || manual || !st.auto ? 0 : g;
    const played = cons === 0 ? g : Math.min(g, st.energy + st.reserve);
    if (cons > 0) { if (st.energy >= played) st.energy -= played; else { st.reserve = Math.max(0, st.reserve - (played - st.energy)); st.energy = 0; } }
    const gain = played * winRate() * mult();
    st.bal += gain; st.earned += gain; st.games += played;
    if (st.factory) { st.foam += played; if (st.foam >= P.foamMax) { st.foam = 0; const b = wanted() * winRate() * mult() * P.foamBonusSec; st.bal += b; st.earned += b; } }
    st.energy += st.gen * P.genRate;
    if (st.energy > 100) { st.reserve = Math.min(P.reserveMax, st.reserve + st.energy - 100); st.energy = 100; }
    shop();
    st.t++;
    if (st.t % 60 === 0) log.push({ t: st.t, realSps: +gain.toFixed(1), speed: gameSpeed(), boards: st.boards, gen: st.gen, energy: Math.round(st.energy + st.reserve), bal: Math.round(st.bal), earned: Math.round(st.earned), clicks: st.clicks, batteries: st.batteries });
  }
  return { st, milestones, log, stalled, stalledBeforeBattery, battGaps: battTimes.slice(1).map((t, i) => t - battTimes[i]) };
}

const arg = process.argv.slice(2).find(a => a === 'lazy' || a === 'fiddler');
for (const player of arg ? [arg] : ['lazy', 'fiddler']) {
  const { st, milestones, log, battGaps, stalled, stalledBeforeBattery } = run(player === 'fiddler' ? P.cloverUptime : 0);
  console.log(`\nPLAYER=${player}  finished at ${fmt(st.t)}  recharge clicks=${st.clicks}  big batteries=${st.batteries}  seconds between big batteries=${battGaps.join(', ')}  machines stood still ${stalled} s (${stalledBeforeBattery} s before the big battery)`);
  console.log('milestones:', Object.fromEntries(Object.entries(milestones).map(([k, v]) => [k, fmt(v)])));
  console.table(log.slice(0, 20));
}
