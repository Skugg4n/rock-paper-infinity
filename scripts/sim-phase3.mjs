// Chapter III war simulation: greedy player, 1 s steps, same rules as the game
// (src/phase3/war.js). Usage: node scripts/sim-phase3.mjs [seed] [--table]
import {
  TIERS, UNIT_COST, ENEMY_DEFENCE_REGROW, enemyDefenceCap, armsPerSecond, UPKEEP_SHARE_PER_UNIT, FORT_HP, FORT_COST, ENEMY_TILE_HP, ENEMY_REBUILD_S,
  SALVAGE_PER_TILE, ENEMY_LEAVES_AT_SCORCH, SHIP_SALVAGE, initialWarState, rng, doomsday, waveInterval, waveSize,
  nextEnemyTierAt, pickTarget, resolveLanding, resolveOurStrike, canRazeTile, relativePower, plateMaxHp, tierScienceCost, enemyCatchUp, TIER_COOLDOWN_S,
} from '../src/phase3/war.js';

const seed = Number(process.argv[2] || 1);
const rand = rng(seed);
// A finished chapter II city: 20 plates
const types = ['factory', 'bank', 'district', 'district', 'skyscraper', 'skyscraper', 'skyscraper', 'skyscraper', 'skyscraper', 'skyscraper',
  'skyscraper', 'skyscraper', 'superStore', 'superStore', 'superStore', 'superStore', 'store', 'store', 'apartment', 'home'];
const plates = types.map((type, i) => ({ id: i + 1, type, row: Math.floor(i / 5), fort: 0, razed: false, hp: plateMaxHp(type), max: plateMaxHp(type), clearAt: 0 }));
const popOf = { district: 100000, skyscraper: 500, apartment: 50, home: 10 };
const income = () => plates.filter(p => !p.razed).reduce((a, p) => a + (popOf[p.type] || 0), 0) * 1100 * 0.5;
const scienceRate = () => plates.filter(p => !p.razed).reduce((a, p) => a + (popOf[p.type] || 0), 0) * 0.5;
const w = initialWarState(0);
w.scienceRate0 = plates.filter(p => !p.razed).reduce((a, p) => a + (popOf[p.type] || 0), 0) * 0.5; // potential
w.armsShare = 0.5;
w.lastTierAt = -999;
let stars = 0, science = 0, t = 0;
const enemyTiles = Array.from({ length: 5 }, (_, i) => ({ i, hp: ENEMY_TILE_HP, razedUntil: 0 }));
const log = []; const events = [];
let leadChanges = 0, lastLead = 0, razedOurs = 0, razedTheirs = 0, behindS = 0, aheadS = 0;

function playerPolicy() {
  const tier = TIERS[w.tier], enemy = TIERS[w.enemyTier];
  // research the next tier when science allows
  if (w.tier < TIERS.length - 1 && t - w.lastTierAt >= TIER_COOLDOWN_S) {
    const cost = tierScienceCost(w.tier + 1, w.scienceRate0);
    if (science >= cost) {
      science -= cost; w.tier++; w.lastTierAt = t; events.push({ t, e: `OUR tier ${TIERS[w.tier].numeral} ${TIERS[w.tier].id}` });
      const pulled = enemyCatchUp(w.tier, w.enemyTier);
      if (pulled > w.enemyTier) { w.enemyTier = pulled; w.nextTierAt = nextEnemyTierAt(t, rand, w.enemyTier); events.push({ t, e: `ENEMY catches up to ${TIERS[w.enemyTier].numeral}` }); }
    }
  }
  // keep defence around the expected wave, in relative units
  const wantDef = Math.ceil(waveSize(w.waveCount) * relativePower(w.enemyTier, w.tier));
  while (w.defence < wantDef && w.arms >= UNIT_COST) { w.arms -= UNIT_COST; w.defence++; }
  // repair what is damaged (the ◆ button: repairs to full and adds a level), then fortify the weakest coastal plates a little
  const damaged = plates.filter(p => !p.razed && p.type !== 'factory' && p.type !== 'bank' && p.hp < p.max && p.fort < 6).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
  if (damaged && w.arms >= FORT_COST(damaged.fort)) { w.arms -= FORT_COST(damaged.fort); damaged.fort++; damaged.max = plateMaxHp(damaged.type, damaged.fort); damaged.hp = damaged.max; }
  const weakest = plates.filter(p => !p.razed && p.type !== 'factory' && p.type !== 'bank').sort((a, b) => a.fort - b.fort || b.row - a.row)[0];
  if (weakest && weakest.fort < 3 && w.arms >= FORT_COST(weakest.fort) + UNIT_COST * 5) { w.arms -= FORT_COST(weakest.fort); weakest.fort++; weakest.max = plateMaxHp(weakest.type, weakest.fort); weakest.hp += FORT_HP; }
  // then force; strike when it can raze a tile
  while (w.arms >= UNIT_COST) { w.arms -= UNIT_COST; w.force++; }
  const target = enemyTiles.find(e => e.razedUntil <= t);
  if (target && canRazeTile(w.force, w.tier, w.enemyTier, w.enemyDefence, target.hp)) {
    const r = resolveOurStrike({ force: w.force, ourTier: w.tier, enemyTier: w.enemyTier, enemyDefence: w.enemyDefence, tileHp: target.hp });
    w.force = r.forceLeft; w.enemyDefence = r.enemyDefenceLeft; target.hp = r.tileHpLeft;
    w.scorchTheirs += tier.scorch * 3;
    if (r.razed) { target.razedUntil = t + ENEMY_REBUILD_S; target.hp = ENEMY_TILE_HP; w.salvage += SALVAGE_PER_TILE * tier.power; w.scorchTheirs += tier.scorch * 10; razedTheirs++; events.push({ t, e: `we razed tile ${target.i}` }); }
  }
  void enemy;
  // clear + rebuild ruins (30 % of a price we approximate with 2M stars)
  for (const p of plates) if (p.razed && stars >= 2e6 && t >= p.clearAt) { stars -= 2e6; p.razed = false; p.hp = p.max; }
}

function enemyTurn() {
  if (t >= w.nextTierAt && w.enemyTier < TIERS.length - 1) { w.enemyTier++; w.nextTierAt = nextEnemyTierAt(t, rand, w.enemyTier); events.push({ t, e: `ENEMY tier ${TIERS[w.enemyTier].numeral}` }); }
  w.enemyDefence = Math.min(w.enemyDefence + ENEMY_DEFENCE_REGROW, enemyDefenceCap(w.waveCount));
  if (t - w.lastWaveAt >= waveInterval(w.waveCount)) {
    w.lastWaveAt = t; w.waveCount++;
    const enemy = TIERS[w.enemyTier];
    const target = pickTarget(plates, rand);
    if (!target) return;
    const r = resolveLanding({ size: waveSize(w.waveCount), enemyTier: w.enemyTier, ourTier: w.tier, defence: w.defence, hp: target.hp });
    w.defence -= r.defenceLost; target.hp = r.hpLeft;
    w.scorchOurs += enemy.scorch;
    if (r.razed) { target.razed = true; target.clearAt = t + 20; target.fort = 0; target.max = plateMaxHp(target.type); w.scorchOurs += enemy.scorch * 4; razedOurs++; events.push({ t, e: `THEY razed ${target.type}#${target.id}` }); }
  }
}

while (t < 3600 && !w.shipReady) {
  const inc = income();
  const upkeep = inc * UPKEEP_SHARE_PER_UNIT * (w.defence + w.force);
  stars += Math.max(0, inc * (1 - w.armsShare) - upkeep);
  science += scienceRate();
  w.arms += armsPerSecond(w.tier) * w.armsShare;
  playerPolicy();
  enemyTurn();
  const lead = Math.sign(w.tier - w.enemyTier);
  if (lead !== 0 && lead !== lastLead) { leadChanges++; lastLead = lead; }
  if (lead < 0) behindS++; else if (lead > 0) aheadS++;
  if (!w.enemyLeft && w.scorchTheirs >= ENEMY_LEAVES_AT_SCORCH) { w.enemyLeft = true; events.push({ t, e: 'ENEMY LEAVES (spaceship)' }); }
  if (w.enemyLeft && w.salvage >= SHIP_SALVAGE) { w.shipReady = true; events.push({ t, e: 'SHIP READY → IV' }); }
  t++;
  if (t % 60 === 0) log.push({ t, tier: w.tier, etier: w.enemyTier, def: w.defence, force: w.force, standing: plates.filter(p => !p.razed).length, doom: Math.round(doomsday(w.scorchOurs + w.scorchTheirs)), ours: Math.round(w.scorchOurs), theirs: Math.round(w.scorchTheirs), salvage: Math.round(w.salvage), income: Math.round(income()) });
}
const fmt = s => `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
console.log(`seed ${seed}: ended at ${fmt(t)}  lead changes ${leadChanges}  behind ${Math.round(100 * behindS / t)} % of the time, ahead ${Math.round(100 * aheadS / t)} %  plates lost ${razedOurs} (min standing ${Math.min(...log.map(r => r.standing))}/20)  their tiles razed ${razedTheirs}  doomsday ${Math.round(doomsday(w.scorchOurs + w.scorchTheirs))} %`);
if (!process.argv.includes('--quiet')) for (const e of events) console.log(`  ${fmt(e.t).padStart(7)}  ${e.e}`);
if (process.argv.includes('--table')) console.table(log);
