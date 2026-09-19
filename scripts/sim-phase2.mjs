/* eslint-disable no-console */
// Phase 2 economy simulation: greedy player, 1 s steps. Mirrors src/phase2/index.js
// logicTick + buildings-config.js. Usage: node scripts/sim-phase2.mjs [startStars]
// Prints milestones and a timeline so cascades (several buys right after a
// multiplier) and hills (long climbs) are visible before touching numbers.
import { buildingData as B } from '../src/phase2/buildings-config.js';
import { stallCost, STALL_SUPPLY } from '../src/phase2/economy.js';
import { PHASE2_CONSTANTS } from '../src/constants.js';

const START_STARS = Number(process.argv[2] || 60000); // typical chapter I hand-over
const st = {
  t: 0, stars: START_STARS, science: 0, pop: 0, supplies: 150, alloc: 0.5,
  slots: 10, buildings: [{ type: 'factory' }, { type: 'bank' }],
  gmo: 0, toolCase: false, car: false, computer: false, urbanism: false, mega: false,
  land1: false, land2: false, sc: 0, stalls: 0, buys: [],
};
const POP = { home: 10, apartment: 50, skyscraper: 500, district: 100000 };
const GROWTH = { home: 0.2, apartment: 1, skyscraper: 5, district: PHASE2_CONSTANTS.DISTRICT_GROWTH_PER_SEC };
const perPerson = () => 2 * (st.toolCase ? 2 : 1) * (st.car ? 5 : 1) * (st.computer ? 11 : 1) * Math.pow(2, st.sc);
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
    if (b.type === 'factory') income += 1680;
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
      if (store && pop >= 50 && buy(B.superStore.cost)) { store.type = 'superStore'; log('superStore'); flow.supply += 40; continue; }
      if (free() > 0 && buy(B.store.cost)) { st.buildings.push({ type: 'store' }); log('store'); flow.supply += 20; continue; }
      if (buy(stallCost(st.stalls))) { st.stalls++; log('stall'); flow.supply += STALL_SUPPLY; continue; }
      break;
    }
    // 2. Multipliers and research when reachable
    if (!st.toolCase && pop >= 50 && buy(B.toolCaseUpgrade.cost, B.toolCaseUpgrade.scienceCost)) { st.toolCase = true; log('TOOLCASE x2'); mark('toolCase'); continue; }
    if (!st.car && pop >= 500 && buy(B.carUpgrade.cost, B.carUpgrade.scienceCost)) { st.car = true; log('CAR x5'); mark('car'); continue; }
    if (!st.computer && st.car && pop >= 1000 && buy(B.computerUpgrade.cost, B.computerUpgrade.scienceCost)) { st.computer = true; log('COMPUTER x11'); mark('computer'); continue; }
    if (!st.urbanism && pop >= 200 && buy(B.urbanismResearch.cost, B.urbanismResearch.scienceCost)) { st.urbanism = true; log('urbanism'); mark('urbanism'); continue; }
    if (!st.mega && pop >= 5000 && buy(B.megastructureResearch.cost, B.megastructureResearch.scienceCost)) { st.mega = true; log('megastructure'); mark('mega'); continue; }
    if (st.sc < 5 && pop >= 10000 && buy(B.superconductor.baseCost * Math.pow(5, st.sc))) { st.sc++; log(`SC x2 (${st.sc})`); mark('sc1'); continue; }
    if (!st.land1 && pop >= 1000 && buy(B.landExpansion.cost)) { st.land1 = true; st.slots += 5; log('land+5'); continue; }
    if (!st.land2 && st.land1 && pop >= 10000 && buy(B.landExpansion2.cost)) { st.land2 = true; st.slots += 5; log('land2+5'); continue; }
    // 3. Housing: upgrade the fullest building first, else build a home
    const homes = st.buildings.filter(b => POP[b.type]);
    const up = (from, to, req) => {
      const b = homes.find(x => x.type === from && x.pop >= POP[from] * 0.9);
      if (b && pop >= req && buy(B[to].cost)) { b.type = to; log(`${from}→${to}`); return true; }
      return false;
    };
    if (st.mega && up('skyscraper', 'district', 5000)) { mark('district'); continue; }
    if (st.urbanism && up('apartment', 'skyscraper', 200)) { mark('skyscraper'); continue; }
    if (up('home', 'apartment', 30)) { mark('apartment'); continue; }
    if (free() > 0 && buy(B.home.cost)) { st.buildings.push({ type: 'home', pop: 0 }); log('home'); continue; }
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
console.table(rows.filter((_, i) => i % 2 === 0).slice(0, 40));
