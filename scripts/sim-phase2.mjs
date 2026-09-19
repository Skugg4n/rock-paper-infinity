// Phase 2 economy simulation: greedy player, 1 s steps. Mirrors src/phase2/index.js
// logicTick + buildings-config.js. Usage: node scripts/sim-phase2.mjs old|new [startStars] [--table]
// Prints milestones and a timeline so cascades (several buys right after a
// multiplier) and hills (long climbs) are visible before touching numbers.
import { buildingData as B } from '../src/phase2/buildings-config.js';
import { stallCost, STALL_SUPPLY } from '../src/phase2/economy.js';
import { PHASE2_CONSTANTS } from '../src/constants.js';

const MODE = process.argv[2] || 'new';
const START_STARS = Number(process.argv[3] || 60000); // typical chapter I hand-over
// Balance under test. 'old' = v1.24.0 numbers, 'new' = the cascade pass.
const P = MODE === 'old' ? {
  factoryIncome: 1680, basePerPerson: 2,
  toolCase: { cost: 500000, sci: 5000 }, car: { cost: 1000000, sci: 100000 }, computer: { cost: 5000000, sci: 100000 },
  scCost: L => 5000 * Math.pow(5, L), scMax: 5,
  cost: { home: 10000, apartment: 50000, skyscraper: 250000, district: 10000000, store: 30000, superStore: 200000, urbanism: 250000, mega: 1000000, land1: 1000000, land2: 10000000 },
  saveForMultipliers: false,
} : {
  // 'new' = whatever buildings-config.js says, so sim and game never drift
  factoryIncome: B.factoryIncome.income, basePerPerson: B.person.income,
  toolCase: { cost: B.toolCaseUpgrade.cost, sci: B.toolCaseUpgrade.scienceCost },
  car: { cost: B.carUpgrade.cost, sci: B.carUpgrade.scienceCost },
  computer: { cost: B.computerUpgrade.cost, sci: B.computerUpgrade.scienceCost },
  scCost: L => B.superconductor.baseCost * Math.pow(5, L), scMax: B.superconductor.maxLevel,
  cost: { home: B.home.cost, apartment: B.apartment.cost, skyscraper: B.skyscraper.cost, district: B.district.cost, store: B.store.cost, superStore: B.superStore.cost, urbanism: B.urbanismResearch.cost, mega: B.megastructureResearch.cost, land1: B.landExpansion.cost, land2: B.landExpansion2.cost },
  saveForMultipliers: true,
};
const C = P.cost;
const st = {
  t: 0, stars: START_STARS, science: 0, pop: 0, supplies: 150, alloc: 0.5,
  slots: 10, buildings: [{ type: 'factory' }, { type: 'bank' }],
  gmo: 0, toolCase: false, car: false, computer: false, urbanism: false, mega: false,
  land1: false, land2: false, sc: 0, stalls: 0, buys: [],
};
const POP = { home: 10, apartment: 50, skyscraper: 500, district: 100000 };
const GROWTH = { home: 0.2, apartment: 1, skyscraper: 5, district: MODE === 'old' ? 2000 : PHASE2_CONSTANTS.DISTRICT_GROWTH_PER_SEC };
const perPerson = () => P.basePerPerson * (st.toolCase ? 2 : 1) * (st.car ? 5 : 1) * (st.computer ? 11 : 1) * Math.pow(2, st.sc);
const free = () => st.slots - st.buildings.length;
const milestones = {}; const mark = (k) => { if (!(k in milestones)) milestones[k] = st.t; };
const buy = (cost, sci = 0) => { if (st.stars >= cost && st.science >= sci) { st.stars -= cost; st.science -= sci; return true; } return false; };
const log = (what) => st.buys.push({ t: st.t, what });

function tick() {
  const gmoM = Math.pow(2, st.gmo);
  let supply = st.stalls * STALL_SUPPLY * gmoM;
  let income = st.pop * (1 - st.alloc) * perPerson();
  const science = st.pop * st.alloc;
  let pop = 0;
  for (const b of st.buildings) {
    if (b.type === 'factory') income += P.factoryIncome;
    if (b.type === 'bank') income -= 30;
    if (b.type === 'store' || b.type === 'superStore') { supply += B[b.type].supply * gmoM; income -= B[b.type].upkeep; }
    if (POP[b.type]) {
      if (st.supplies > 0 && b.pop < POP[b.type]) b.pop = Math.min(POP[b.type], b.pop + GROWTH[b.type]);
      pop += b.pop;
    }
  }
  st.pop = pop;
  st.stars = Math.max(0, st.stars + income); st.science += science;
  const net = supply - pop;
  st.supplies = Math.max(0, st.supplies + net);
  if (st.supplies <= 0 && pop > 0) { // starvation
    let deaths = Math.max(1, Math.ceil(Math.abs(net) * 0.05));
    for (const b of st.buildings) { if (!POP[b.type] || deaths <= 0) continue; const k = Math.min(deaths, b.pop); b.pop -= k; deaths -= k; }
  }
  return { income, supply, net };
}

function shop(flow) {
  // 1. Food first: never let net supply go negative for long
  const foodNeeded = () => (flow.supply - st.pop) < st.pop * 0.1;
  let guard = 0;
  while (guard++ < 50) {
    const pop = st.pop;
    if (foodNeeded()) {
      if (pop >= 75 && st.gmo < 10 && buy(B.gmoUpgrade.baseCost * (st.gmo + 1), B.gmoUpgrade.scienceCost * (st.gmo + 1))) { st.gmo++; log('gmo'); flow.supply *= 2; continue; }
      const store = st.buildings.find(b => b.type === 'store');
      if (store && pop >= 50 && buy(C.superStore)) { store.type = 'superStore'; log('superStore'); flow.supply += 40; continue; }
      if (free() > 0 && buy(C.store)) { st.buildings.push({ type: 'store' }); log('store'); flow.supply += 20; continue; }
      // stalls only while they are cheaper per unit than a store, or no land
      const stallsCheaper = stallCost(st.stalls) / STALL_SUPPLY < C.store / 20 || free() === 0;
      if (stallsCheaper && buy(stallCost(st.stalls))) { st.stalls++; log('stall'); flow.supply += STALL_SUPPLY; continue; }
      break;
    }
    // 2. Multipliers and research when reachable
    if (!st.toolCase && pop >= 50 && buy(P.toolCase.cost, P.toolCase.sci)) { st.toolCase = true; log('TOOLCASE x2'); mark('toolCase'); continue; }
    if (!st.car && pop >= 500 && buy(P.car.cost, P.car.sci)) { st.car = true; log('CAR x5'); mark('car'); continue; }
    if (!st.computer && st.car && pop >= 1000 && buy(P.computer.cost, P.computer.sci)) { st.computer = true; log('COMPUTER x11'); mark('computer'); continue; }
    // A human saves for a teased multiplier instead of buying the 9th home.
    if (P.saveForMultipliers) {
      const pending = (!st.toolCase && pop >= 50) || (!st.car && pop >= 500) || (!st.computer && st.car && pop >= 1000) || (st.sc < P.scMax && pop >= 10000 && st.computer);
      if (pending) break;
    }
    if (!st.urbanism && pop >= 200 && buy(C.urbanism, B.urbanismResearch.scienceCost)) { st.urbanism = true; log('urbanism'); mark('urbanism'); continue; }
    if (!st.mega && pop >= 5000 && buy(C.mega, B.megastructureResearch.scienceCost)) { st.mega = true; log('megastructure'); mark('mega'); continue; }
    if (st.sc < P.scMax && pop >= 10000 && buy(P.scCost(st.sc))) { st.sc++; log(`SC x2 (${st.sc})`); mark('sc1'); continue; }
    if (!st.land1 && pop >= 1000 && buy(C.land1)) { st.land1 = true; st.slots += 5; log('land+5'); continue; }
    if (!st.land2 && st.land1 && pop >= 10000 && buy(C.land2)) { st.land2 = true; st.slots += 5; log('land2+5'); continue; }
    // 3. Housing: upgrade the fullest building first, else build a home
    const homes = st.buildings.filter(b => POP[b.type]);
    const up = (from, to, req) => {
      const b = homes.find(x => x.type === from && x.pop >= POP[from] * 0.9);
      if (b && pop >= req && buy(C[to])) { b.type = to; log(`${from}→${to}`); return true; }
      return false;
    };
    if (st.mega && up('skyscraper', 'district', 5000)) { mark('district'); continue; }
    if (st.urbanism && up('apartment', 'skyscraper', 200)) { mark('skyscraper'); continue; }
    if (up('home', 'apartment', 30)) { mark('apartment'); continue; }
    // keep one slot for a store while the city is small
    const storeCount = st.buildings.filter(b => b.type === 'store' || b.type === 'superStore').length;
    if (free() > (storeCount === 0 ? 1 : 0) && buy(C.home)) { st.buildings.push({ type: 'home', pop: 0 }); log('home'); continue; }
    break;
  }
}

const T_MAX = 3 * 3600;
const rows = [];
while (st.t < T_MAX && st.pop < PHASE2_CONSTANTS.WAR_POP) {
  const flow = tick();
  shop(flow);
  st.t++;
  if (st.t % 60 === 0) rows.push({ t: st.t, pop: st.pop, stars: Math.round(st.stars), income: Math.round(flow.income), food: Math.round(flow.net), bld: st.buildings.length, stalls: st.stalls, gmo: st.gmo, sc: st.sc });
}
const fmt = s => `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
console.log(`start ${START_STARS} ★  → WAR (${PHASE2_CONSTANTS.WAR_POP} pop) at ${fmt(st.t)}`);
console.log('milestones:', Object.fromEntries(Object.entries(milestones).map(([k, v]) => [k, fmt(v)])));
// Cascade view: buys grouped per 30 s window
const windows = {};
for (const b of st.buys) { const w = Math.floor(b.t / 30) * 30; (windows[w] ??= []).push(b.what); }
console.log('buys per 30 s window (cascades = many in one window):');
for (const [w, list] of Object.entries(windows)) console.log(`  ${fmt(Number(w)).padStart(7)}  ${list.length.toString().padStart(2)}  ${list.join(', ')}`);
const wins = Object.values(windows);
const cascades = wins.filter(l => l.length >= 3).length;
let maxGap = 0; for (let i = 1; i < st.buys.length; i++) maxGap = Math.max(maxGap, st.buys[i].t - st.buys[i - 1].t);
console.log(`cascade windows (≥3 buys/30 s): ${cascades}   longest climb without a buy: ${fmt(maxGap)}`);
if (process.argv.includes('--table')) console.table(rows.filter((_, i) => i % 2 === 0).slice(0, 40));
