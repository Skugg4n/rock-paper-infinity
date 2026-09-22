// Chapter III war simulation. The player is the AUTO QUARTERMASTER on the
// balanced stance (what most players run): it keeps defence and force level,
// strikes the moment a tile can be razed, researches the next tier as soon as
// science and the cooldown allow, repairs the worst plate and fortifies the
// weakest. The loop below is the game's own `warTick` (src/phase2/index.js)
// step for step, so the numbers here are the numbers Ola plays: standingK,
// the push every fifth wave, the warning delay, the silent island and the
// regroup. Rules come from src/phase3/war.js and are never duplicated here.
//
// Usage: node scripts/sim-phase3.mjs [seed] [--table] [--quiet] [--raid]
import {
  TIERS, UNIT_COST, ENEMY_DEFENCE_REGROW, enemyDefenceCap, armsPerSecond, UPKEEP_SHARE_PER_UNIT, FORT_HP, FORT_COST,
  ENEMY_TILE_HP, ENEMY_REBUILD_S, SALVAGE_PER_TILE, DOOMSDAY_LEAVE, ENEMY_REGROUP_S,
  scorchYield, SHIP_SALVAGE, initialWarState, rng, doomsday, waveInterval, waveSize, waveStandingK, defenceStandingK,
  nextEnemyTierAt, pickTarget, resolveLanding, resolveOurStrike, canRazeTile, plateMaxHp, autoBuy,
  tierScienceCost, enemyCatchUp, TIER_COOLDOWN_S, WAVE_WARNING_S, RAID_S, raidCost,
} from '../src/phase3/war.js';

const seed = Number(process.argv[2] || 1);
const useRaid = process.argv.includes('--raid');
// Three independent streams. The game draws from one, but in the sim a shared
// stream means every balance change shifts the enemy's dice as well as the
// rules, and then the seeds measure luck instead of the change. Keeping their
// research clock, their choice of target and our choice of tile apart makes a
// seed a fixed opponent that different rules can be compared against.
const randTier = rng(seed);
const randTarget = rng(seed ^ 0x9e3779b9);
const randPick = rng(seed ^ 0x85ebca6b);
// A finished chapter II city: 20 plates
const types = ['factory', 'bank', 'district', 'district', 'skyscraper', 'skyscraper', 'skyscraper', 'skyscraper', 'skyscraper', 'skyscraper',
  'skyscraper', 'skyscraper', 'superStore', 'superStore', 'superStore', 'superStore', 'store', 'store', 'apartment', 'home'];
const plates = types.map((type, i) => ({ id: i + 1, type, row: Math.floor(i / 5), fort: 0, razed: false, hp: plateMaxHp(type), max: plateMaxHp(type), clearAt: 0 }));
const popOf = { district: 100000, skyscraper: 500, apartment: 50, home: 10 };
const pop = () => plates.filter(p => !p.razed).reduce((a, p) => a + (popOf[p.type] || 0), 0);
const income = () => pop() * 1100 * 0.5 * scorchYield(doomsday(w.scorchOurs + w.scorchTheirs));
const scienceRate = () => pop() * 0.5;
const w = initialWarState(0);
w.t = 0;
w.scienceRate0 = pop() * 0.5;                       // research potential at war start
w.armsShare = 0.5;
w.lastTierAt = -999;
w.enemyRazedUntil = [0, 0, 0, 0, 0];
w.enemyTileHp = [0, 0, 0, 0, 0].map(() => ENEMY_TILE_HP);
w.regroupAt = 0;
let stars = 0, science = 0;
const log = []; const events = [];
let leadChanges = 0, lastLead = 0, razedOurs = 0, razedTheirs = 0, behindS = 0, aheadS = 0, silentS = 0;
const say = e => events.push({ t: w.t, e });

/** The human half of the auto player: research, repair, fortify, clear, raid. */
function playerActions() {
  if (w.tier < TIERS.length - 1 && w.t - w.lastTierAt >= TIER_COOLDOWN_S) {
    const cost = tierScienceCost(w.tier + 1, w.scienceRate0, w.enemyTier - w.tier);
    if (science >= cost) {
      science -= cost; w.tier++; w.lastTierAt = w.t;
      say(`OUR tier ${TIERS[w.tier].numeral} ${TIERS[w.tier].id}`);
      const pulled = enemyCatchUp(w.tier, w.enemyTier);
      if (pulled > w.enemyTier) { w.enemyTier = pulled; say(`ENEMY catches up to ${TIERS[w.enemyTier].numeral}`); }
      // A weapon they have never seen sends their laboratory back to the drawing board.
      if (w.tier > w.enemyTier) w.nextTierAt = nextEnemyTierAt(w.t, randTier, w.enemyTier, w.tier - w.enemyTier);
    }
  }
  // the ◆ button: repairs to full and adds a fortification level
  const target = p => !p.razed && p.type !== 'factory' && p.type !== 'bank';
  const damaged = plates.filter(p => target(p) && p.hp < p.max && p.fort < 6).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
  if (damaged && w.arms >= FORT_COST(damaged.fort)) { w.arms -= FORT_COST(damaged.fort); damaged.fort++; damaged.max = plateMaxHp(damaged.type, damaged.fort); damaged.hp = damaged.max; }
  const weakest = plates.filter(target).sort((a, b) => a.fort - b.fort || b.row - a.row)[0];
  if (weakest && weakest.fort < 3 && w.arms >= FORT_COST(weakest.fort) + UNIT_COST * 5) { w.arms -= FORT_COST(weakest.fort); weakest.fort++; weakest.max = plateMaxHp(weakest.type, weakest.fort); weakest.hp += FORT_HP; }
  // The raiding party: worth it when their shield, not their wall, is what
  // stops us. The quartermaster has to be told to hold arms back for it
  // (see `reserve`), because on its own it spends every arm the second it has one.
  w.wantRaid = useRaid && !w.enemyLeft && (w.raidUntil || 0) <= w.t
    && !canRazeTile(w.force, w.tier, w.enemyTier, w.enemyDefence) && canRazeTile(w.force, w.tier, w.enemyTier, 0);
  if (w.wantRaid && w.arms >= raidCost(w.raids || 0)) {
    w.arms -= raidCost(w.raids || 0); w.raids = (w.raids || 0) + 1; w.raidUntil = w.t + RAID_S; w.wantRaid = false; say('raiding party sent');
  }
  // clear + rebuild ruins (30 % of a price we approximate with 2M stars)
  for (const p of plates) if (p.razed && stars >= 2e6 && w.t >= p.clearAt) { stars -= 2e6; p.razed = false; p.fort = 0; p.max = plateMaxHp(p.type); p.hp = p.max; }
}

/** The auto quartermaster, balanced stance: buy, then strike when a tile can fall. */
function quartermaster() {
  // Saving for a raid means buying fewer units, never none: the quartermaster
  // sets aside at most a third of what is in the yard this second.
  const reserve = w.wantRaid ? Math.min(raidCost(w.raids || 0), w.arms / 3) : 0;
  const buy = autoBuy(Math.max(0, w.arms - reserve), w.defence, w.force, UNIT_COST, 'balanced');
  w.arms -= (buy.defence + buy.force) * UNIT_COST; w.defence += buy.defence; w.force += buy.force;
  if (w.enemyLeft || w.force <= 0) return;
  const visible = w.enemyRazedUntil.map((until, i) => ({ i, until })).filter(x => !(x.until > 0));
  if (!visible.length) return;
  const hardest = Math.max(...visible.map(x => w.enemyTileHp[x.i]));
  if (!canRazeTile(w.force, w.tier, w.enemyTier, w.enemyDefence, hardest)) return;
  const pick = visible[Math.floor(randPick() * visible.length)].i;
  const tier = TIERS[w.tier];
  const r = resolveOurStrike({ force: w.force, ourTier: w.tier, enemyTier: w.enemyTier, enemyDefence: w.enemyDefence, tileHp: w.enemyTileHp[pick] });
  w.force = r.forceLeft; w.enemyDefence = r.enemyDefenceLeft; w.enemyTileHp[pick] = r.tileHpLeft;
  w.scorchTheirs += tier.scorch * 3;
  if (r.razed) {
    w.enemyRazedUntil[pick] = w.t + ENEMY_REBUILD_S;
    w.enemyTileHp[pick] = ENEMY_TILE_HP;
    w.salvage += SALVAGE_PER_TILE * tier.power;
    w.scorchTheirs += tier.scorch * 10;
    razedTheirs++; say(`we razed tile ${pick}`);
  }
}

/** The game's warTick, step for step. */
function warTick() {
  w.t++;
  w.arms += armsPerSecond(w.tier) * w.armsShare;
  const standing = 5 - w.enemyRazedUntil.filter(x => x > 0).length;
  const silent = standing === 0 && !w.enemyLeft;
  if (silent) {
    silentS++;
    if (!w.regroupAt) {
      w.regroupAt = w.t + ENEMY_REGROUP_S;
      w.enemyRazedUntil = w.enemyRazedUntil.map(() => w.regroupAt);
      say('their island is silent (digging in)');
    }
    w.nextTierAt -= 1; w.lastWaveAt = w.t;
  } else if (w.regroupAt && w.t >= w.regroupAt) {
    w.regroupAt = 0; w.enemyDefence = enemyDefenceCap(w.waveCount, w.tier);
    if (w.enemyTier < w.tier) { w.enemyTier = w.tier; w.nextTierAt = nextEnemyTierAt(w.t, randTier, w.enemyTier); }
    say(`THEY ARE BACK, rebuilt, with ${TIERS[w.enemyTier].id}`);
  }
  if (w.t >= w.nextTierAt && w.enemyTier < TIERS.length - 1 && !w.enemyLeft) {
    w.enemyTier++; w.nextTierAt = nextEnemyTierAt(w.t, randTier, w.enemyTier, w.tier - w.enemyTier);
    say(`ENEMY tier ${TIERS[w.enemyTier].numeral}`);
  }
  const raided = (w.raidUntil || 0) > w.t;
  if (raided) w.enemyDefence = 0;
  else if (!silent) w.enemyDefence = Math.min(w.enemyDefence + ENEMY_DEFENCE_REGROW(w.tier) * defenceStandingK(standing), enemyDefenceCap(w.waveCount, w.tier) * defenceStandingK(standing));
  // waves, as long as the enemy is still here; every fifth is a push
  if (!silent && !w.enemyLeft && !w.pendingWave && w.t - w.lastWaveAt >= waveInterval(w.waveCount)) {
    w.lastWaveAt = w.t; w.waveCount++;
    const target = pickTarget(plates, randTarget);
    if (target) {
      const push = w.waveCount % 5 === 0;
      const size = Math.round(waveSize(w.waveCount) * waveStandingK(standing) * (push ? 2 : 1));
      w.pendingWave = { targetId: target.id, size, launchAt: w.t + WAVE_WARNING_S, push };
    }
  }
  if (w.pendingWave && w.t >= w.pendingWave.launchAt) {
    const { targetId, size } = w.pendingWave; w.pendingWave = null;
    const b = plates.find(p => p.id === targetId);
    if (b && !b.razed) {
      const enemy = TIERS[w.enemyTier];
      const r = resolveLanding({ size, enemyTier: w.enemyTier, ourTier: w.tier, defence: w.defence, hp: b.hp });
      w.defence = Math.max(0, w.defence - r.defenceLost);
      b.hp = r.hpLeft;
      w.scorchOurs += enemy.scorch;
      if (r.razed) {
        b.razed = true; b.clearAt = w.t + 20; b.fort = 0; b.hp = 0; b.max = plateMaxHp(b.type);
        w.scorchOurs += enemy.scorch * 4; razedOurs++;
        say(`THEY razed ${b.type}#${b.id}`);
      }
    }
  }
  w.enemyRazedUntil.forEach((until, i) => { if (until && w.t >= until) w.enemyRazedUntil[i] = 0; });
  const doom = doomsday(w.scorchOurs + w.scorchTheirs);
  if (!w.enemyLeft && doom >= DOOMSDAY_LEAVE) { w.enemyLeft = true; say(`ENEMY LEAVES (spaceship) at doomsday ${Math.round(doom)} %`); }
  quartermaster();
}

while (w.t < 3600 && !w.shipReady) {
  const inc = income();
  const upkeep = inc * UPKEEP_SHARE_PER_UNIT * (w.defence + w.force);
  stars += Math.max(0, inc * (1 - w.armsShare) - upkeep);
  science += scienceRate();
  playerActions();
  warTick();
  if (w.enemyLeft && w.salvage >= SHIP_SALVAGE) { w.shipReady = true; say('SHIP READY → IV'); }
  const lead = Math.sign(w.tier - w.enemyTier);
  if (lead !== 0 && lead !== lastLead) { leadChanges++; lastLead = lead; }
  if (lead < 0) behindS++; else if (lead > 0) aheadS++;
  if (w.t % 60 === 0) log.push({ t: w.t, tier: w.tier, etier: w.enemyTier, def: Math.round(w.defence), force: Math.round(w.force), edef: Math.round(w.enemyDefence), standing: plates.filter(p => !p.razed).length, doom: Math.round(doomsday(w.scorchOurs + w.scorchTheirs)), theirStanding: 5 - w.enemyRazedUntil.filter(x => x > 0).length, salvage: Math.round(w.salvage) });
}
const t = w.t;
const fmt = s => `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
console.log(`seed ${seed}: ended at ${fmt(t)}  lead changes ${leadChanges}  behind ${Math.round(100 * behindS / t)} % of the time, ahead ${Math.round(100 * aheadS / t)} %  plates lost ${razedOurs} (min standing ${Math.min(...log.map(r => r.standing))}/20)  their tiles razed ${razedTheirs}  island silent ${Math.round(100 * silentS / t)} %  doomsday ${Math.round(doomsday(w.scorchOurs + w.scorchTheirs))} %`);
if (!process.argv.includes('--quiet')) for (const e of events) console.log(`  ${fmt(e.t).padStart(7)}  ${e.e}`);
if (process.argv.includes('--table')) console.table(log);
