/* global lucide */

import { PHASE2_CONSTANTS, PHASE_KEY } from "../constants.js";
import { playChapterCard } from '../chapterCard.js';
import { phases, setPhase } from '../gamePhase.js';
import { serializePhase2, loadFromStorage, saveToStorage } from './persistence.js';
import { mountSaveButtons } from '../save-export.js';
import { buildingData } from './buildings-config.js';
import { createRenderer } from './rendering.js';
import { timed, counter } from '../perf.js';
import {
    siloFraction, stallCost, harvestAmount, spendHarvestEfficiency, recoverHarvestEfficiency, STALL_SUPPLY,
} from './economy.js';
import { createAnts } from './ants.js';
import { createIsland } from './islands.js';
import {
    TIERS, UNIT_COST, FORT_COST, ENEMY_REBUILD_S, ENEMY_DEFENCE_REGROW, enemyDefenceCap, waveStandingK, defenceStandingK,
    SALVAGE_PER_TILE, DOOMSDAY_LEAVE, ENEMY_REGROUP_S, scorchYield, SHIP_SALVAGE, UPKEEP_SHARE_PER_UNIT, FOOD_PER_UNIT,
    initialWarState, rng as warRng, doomsday, waveInterval, waveSize, nextEnemyTierAt, pickTarget,
    resolveLanding, resolveOurStrike, canRazeTile, relativePower, ENEMY_TILE_HP, MAX_ABSORB, plateMaxHp, tierScienceCost, armsPerSecond,
    TIER_COOLDOWN_S, enemyCatchUp, autoBuy, AUTO_COST, STANCES, INTEL_COST, WAVE_WARNING_S, RAID_S, raidCost,
    revealNext, isShown, quartermasterBudget, QM_KEEP_S, STANCE_RATIO, hpYield, enemyMayResearch,
} from '../phase3/war.js';

let logicInterval;
let fastUiInterval;
let savingEnabled = true;
let beforeUnloadHandler;
let abortController;
let _warCardTriggered = false;
let _deepStarting = false;

/**
 * IV · THE DEEP. The black card is the bridge: chapter IV is built during its
 * hold, so the model is already there when the card lifts. The "to come" wall
 * is kept for one case only, a browser that cannot load the chapter at all;
 * the save is never touched either way.
 */
async function goDeep() {
    if (_deepStarting) return;
    _deepStarting = true;
    try {
        await import('../phase4/index.js');
    } catch (e) {
        console.error('chapter IV could not be loaded; the wall stands instead', e);
        playChapterCard({ roman: 'IV', title: 'THE DEEP', mode: 'to-come' });
        return;
    }
    playChapterCard({
        roman: 'IV', title: 'THE DEEP', dark: true, hold: 4000,
        onMidpoint: () => {
            setPhase(phases.DEEP).catch((e) => console.error('chapter IV failed to start', e));
        },
    });
}
let _ants = null;
let _islands = null;

// Smooth counter rolling — lerp displayed values toward actual values each fastUiTick
let _displayedStars = 0;
let _displayedScience = 0;
const COUNTER_LERP = 0.18;

// Progressive disclosure — track which thresholds have already fired
let _starsPerPersonRevealed = false;
let _scienceRevealed = false;

export function init() {
          abortController = new AbortController();
          const signal = abortController.signal;
          savingEnabled = true;

          // --- GAME STATE ---
          const gameState = {
              stars: 0, // will be populated from localStorage
              science: 0,
              population: 0,
              populationAllocation: 0.5, // 0 = 100% stars, 1 = 100% science
              supplies: 150,
              buildings: [],
              gmoLevel: 0,
              gmoMaxLevel: 10,
              toolCaseUnlocked: false,
              carUnlocked: false,
              computerUnlocked: false,
              apartmentResearched: false,
              storeResearched: false,
              urbanismResearched: false,
              megastructureResearched: false,
              landExpanded: false,
              landExpansion2: false,
              superconductorLevel: 0,
              competitorSpawned: false,
              competitorStage: 0,
              warReady: false,    // the competitor has razed a house; WAR can be chosen
              warChosen: false,   // the player pressed the swords
              // Helpers beside the power line (v1.23.0)
              stalls: 0,
              harvestEfficiency: 1,
          };

          const { SAVE_KEY, STARS_TRANSFER_KEY, COMPETITOR_POP, WAR_POP, DISTRICT_GROWTH_PER_SEC } = PHASE2_CONSTANTS;
          const parsedSave = loadFromStorage(SAVE_KEY);
          if (parsedSave) {
              parsedSave.buildings = (parsedSave.buildings || []).map(b => b === null ? undefined : b);
              Object.assign(gameState, parsedSave);
          } else {
              const storedStars = localStorage.getItem(STARS_TRANSFER_KEY);
              const parsed = storedStars !== null ? Number.parseInt(storedStars, 10) : NaN;
              gameState.stars = Number.isNaN(parsed) ? 0 : parsed;
              localStorage.removeItem(STARS_TRANSFER_KEY);
          }

          function saveGameState() {
              if (!savingEnabled || window.__rpiSkipSave) return;
              saveToStorage(SAVE_KEY, serializePhase2(gameState));
          }
          beforeUnloadHandler = () => saveGameState();
  
          // --- UI ELEMENTS ---
          const ui = {
              starCount: document.getElementById('star-count'),
              starsPerPerson: document.getElementById('stars-per-person'),
              scienceCount: document.getElementById('science-count'),
              netStarChange: document.getElementById('net-star-change'),
              netScienceChange: document.getElementById('net-science-change'),
              allocationSlider: document.getElementById('allocation-slider'),
              allocationDecBtn: document.getElementById('allocation-dec-btn'),
              allocationIncBtn: document.getElementById('allocation-inc-btn'),
              landGrid: document.getElementById('land-grid'),
              populationUi: document.getElementById('population-ui'),
              suppliesUi: document.getElementById('supplies-ui'),
              siloBtn: document.getElementById('silo-btn'),
              siloFill: document.getElementById('silo-fill'),
              supplyNet: document.getElementById('supply-net'),
              supplyHint: document.getElementById('supply-hint'),
              harvestPreview: document.getElementById('harvest-preview'),
              harvestPop: document.getElementById('harvest-pop'),
              buildStallBtn: document.getElementById('build-stall-btn'),
              stallCount: document.getElementById('stall-count'),
              populationCountTotal: document.getElementById('population-count-total'),
              supplyConsumption: document.getElementById('supply-consumption'),
              supplyProduction: document.getElementById('supply-production'),
              debugMenu: document.getElementById('p2-debug-menu'),
              debugToggleBtn: document.getElementById('debug-toggle-btn'),
              resetBtn: document.getElementById('reset-btn'),
              buildHomeBtn: document.getElementById('build-home-btn'),
              buildStoreBtn: document.getElementById('build-store-btn'),
              gmoUpgradeBtn: document.getElementById('gmo-upgrade-btn'),
              gmoRing: document.getElementById('gmo-ring'),
              toolCaseUpgradeBtn: document.getElementById('tool-case-upgrade-btn'),
              apartmentResearchBtn: document.getElementById('apartment-research-btn'),
              storeResearchBtn: document.getElementById('store-research-btn'),
              urbanismResearchBtn: document.getElementById('urbanism-research-btn'),
              megastructureResearchBtn: document.getElementById('megastructure-research-btn'),
              carUpgradeBtn: document.getElementById('car-upgrade-btn'),
              computerUpgradeBtn: document.getElementById('computer-upgrade-btn'),
              expandLandBtn: document.getElementById('expand-land-btn'),
              expandLand2Btn: document.getElementById('expand-land-2-btn'),
              superconductorBtn: document.getElementById('superconductor-btn'),
              superconductorRing: document.getElementById('superconductor-ring'),
              competitorIsland: document.getElementById('competitor-island'),
              warBtn: document.getElementById('war-btn'),
              warUi: document.getElementById('war-ui'),
              warDefence: document.getElementById('war-defence'),
              warForce: document.getElementById('war-force'),
              warArms: document.getElementById('war-arms'),
              warArmsRate: document.getElementById('war-arms-rate'),
              warTier: document.getElementById('war-tier'),
              warEnemyTier: document.getElementById('war-enemy-tier'),
              armsSlider: document.getElementById('arms-slider'),
              doomsday: document.getElementById('doomsday'),
              doomsdayRing: document.getElementById('doomsday-ring'),
              salvage: document.getElementById('salvage'),
              buyDefenceBtn: document.getElementById('buy-defence-btn'),
              buyForceBtn: document.getElementById('buy-force-btn'),
              strikeBtn: document.getElementById('strike-btn'),
              tierBtn: document.getElementById('tier-btn'),
              tierBadge: document.getElementById('tier-badge'),
              shipBtn: document.getElementById('ship-btn'),
              autoBtn: document.getElementById('auto-btn'),
              intelBtn: document.getElementById('intel-btn'),
              raidBtn: document.getElementById('raid-btn'),
              radarBtn: document.getElementById('radar-btn'),
              radarBadge: document.getElementById('radar-badge'),
              warRoom: document.getElementById('war-room'),
              warEnemyDefence: document.getElementById('war-enemy-defence'),
              populationCapacity: document.getElementById('population-capacity'),
              cityArea: document.getElementById('city-area'),
              islandsSvg: document.getElementById('islands-svg'),
              phaseCity: document.getElementById('phase-city'),
              antsCanvas: document.getElementById('ants-canvas'),
              scienceRow: document.getElementById('science-row'),
              allocationSliderContainer: document.getElementById('allocation-slider-container'),
              buildSeparator: document.getElementById('build-separator'),
          };

          // Chapter III parts that are built here rather than in index.html (the
          // shell belongs to the chapter IV session): the auto-strike toggle, the
          // strike verdict badge, the quartermaster's ratio badge, the arms
          // tooltip and the rocket's construction ring. Built once; init can run
          // again after a teardown, so every part is looked up first.
          const once = (id, make) => document.getElementById(id) || make();
          ui.autoStrikeBtn = once('auto-strike-btn', () => {
              const b = document.createElement('button');
              b.className = 'btn hidden'; b.id = 'auto-strike-btn';
              b.setAttribute('aria-label', 'Auto strike: strike whenever a strike would raze');
              b.innerHTML = `<i data-lucide="target" class="w-7 h-7"></i><span class="btn-badge hidden" id="auto-strike-badge"><i data-lucide="repeat" class="w-3 h-3"></i></span><div class="tooltip"></div>`;
              ui.strikeBtn.before(b);
              return b;
          });
          ui.autoStrikeBadge = document.getElementById('auto-strike-badge');
          ui.strikeVerdict = once('strike-verdict', () => {
              const s = document.createElement('span'); s.id = 'strike-verdict'; s.className = 'btn-badge hidden';
              ui.strikeBtn.appendChild(s); return s;
          });
          ui.autoBadge = once('auto-badge', () => {
              const s = document.createElement('span'); s.id = 'auto-badge'; s.className = 'btn-badge hidden';
              ui.autoBtn.appendChild(s); return s;
          });
          ui.warArmsRow = ui.warArms.parentElement;
          if (!ui.warArmsRow.querySelector('.tooltip')) {
              ui.warArmsRow.classList.add('hud-tip');
              ui.warArmsRow.insertAdjacentHTML('beforeend', '<div class="tooltip tip-right"></div>');
          }
          const rocketTile = ui.competitorIsland.querySelector('.enemy-rocket');
          const rocketRing = rocketTile?.querySelector('.rocket-build circle.progress-ring-fg') || (() => {
              rocketTile?.insertAdjacentHTML('afterbegin', `<svg class="progress-ring rocket-build" viewBox="0 0 40 40"><circle class="progress-ring-base" cx="20" cy="20" r="18" fill="none" stroke-width="2"></circle><circle class="progress-ring-fg" cx="20" cy="20" r="18" fill="none" stroke-width="2" stroke-dasharray="113" stroke-dashoffset="113" style="stroke: #b45309;"></circle></svg>`);
              return rocketTile?.querySelector('.rocket-build circle.progress-ring-fg') || document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          })();

          /**
           * The competitor's island grows as the player's city does: factory,
           * then a warehouse, then a radar mast. Stage 3 is the last thing the
           * player sees before III·WAR.
           */
          const RAID_INTERVAL_MS = 90000;
          const RADAR_COST = 300;

          /** War room: short lines from the advisor. Kept in the save (last 8). */
          function logWar(text, grim = false) {
              const w = gameState.war; if (!w) return;
              if (text.startsWith('Intel:') && !w.intel) return;   // you have to buy the eyes
              w.log = (w.log || []).slice(-7).concat([{ text, grim, t: w.t || 0 }]);
              renderWarRoom();
          }
          function renderWarRoom() {
              const w = gameState.war;
              ui.warRoom.classList.toggle('hidden', !w?.active && !gameState.shipChosen);
              if (!w?.log) return;
              ui.warRoom.innerHTML = w.log.slice(-8).map(l => `<div class="${l.grim ? 'grim' : ''}">${l.text}</div>`).join('');
          }

          // ---------------- CHAPTER III · WAR ----------------
          // Rules live in src/phase3/war.js; this is the glue to the map.
          const warRand = warRng(Date.now() % 100000);
          const enemyTileEls = () => [...ui.competitorIsland.querySelectorAll('.enemy-factory, .enemy-tile:not(.enemy-rocket)')];
          const warPlates = () => gameState.buildings.map((b, i) => b ? { id: b.id, type: b.type, fort: b.fort || 0, row: Math.floor(i / 5), razed: !!b.razed, b, i } : null).filter(Boolean);

          function startWar() {
              if (gameState.war?.active) return;
              const w = initialWarState(0);
              w.t = 0;
              w.scienceRate0 = Math.max(500, gameState.population * 0.5); // research potential, not the slider
              w.lastTierAt = -999;
              w.auto = false;
              w.enemyRazedUntil = [0, 0, 0, 0, 0];
              w.shown = {};
              gameState.war = w;
              gameState.warChosen = true;
              applyWarPresentation({ tilt: false });        // the camera lowers after the card
              logWar('We are at war. The generals are ready for your command.');
              logWar('War room: the factory can make arms. Push the slider toward the hammer. Fists first.');
              logWar('Research runs at half. The factory is yours.');
              logWar('Intel: enemy shipyard active. Expect landings from the south.');
              saveGameState();
              updateAllUI();
          }
          function applyWarPresentation({ tilt = true } = {}) {
              const w = gameState.war;
              if (!w?.active) return;
              ui.phaseCity.classList.add('war');
              if (tilt) document.body.classList.add('tilt'); // the camera lowers (6 s transition)
              // One slider in the war: research is fixed at half, the arms slider is yours.
              gameState.populationAllocation = 0.5;
              ui.allocationSlider.value = 50;
              ui.allocationSliderContainer.style.display = 'none';
              ui.warUi.classList.remove('hidden');
              ui.doomsday.classList.remove('hidden');
              ui.armsSlider.value = Math.round((w.armsShare || 0.3) * 100);
              ui.competitorIsland.classList.toggle('enemy-left', w.leaveStage >= 2);
              ui.competitorIsland.classList.toggle('enemy-rubble', w.leaveStage >= 3);
              renderWarRoom();
              gameState.buildings.forEach((b, i) => { if (b) renderGridSlot(i); });
          }

          function warTick() {
              const w = gameState.war;
              if (!w?.active) return;
              w.t = (w.t || 0) + 1;
              w.arms += armsPerSecond(w.tier) * w.armsShare;
              // Only a completely silent island stops them: bombed out they send
              // nothing, but they dig in, research twice as fast and come back all at
              // once after ENEMY_REGROUP_S, rebuilt, with full defence and at least our
              // tier. Short of that, knocking their buildings down barely thins their
              // landings and does not thin their defence at all. Razing their island is
              // salvage and a minute and a half of quiet, never the war.
              const standing = 5 - (w.enemyRazedUntil || []).filter(x => x > 0).length;
              const silent = standing === 0 && !w.enemyLeft;
              if (silent) {
                  if (!w.regroupAt) {
                      w.regroupAt = w.t + ENEMY_REGROUP_S;
                      w.enemyRazedUntil = (w.enemyRazedUntil || [0, 0, 0, 0, 0]).map(() => w.regroupAt);
                      logWar('Interior: their island is silent. They are digging in. Expect them back, and stronger.', true);
                  }
                  w.nextTierAt -= 1; w.lastWaveAt = w.t;
              } else if (w.regroupAt && w.t >= w.regroupAt) {
                  w.regroupAt = 0; w.enemyDefence = enemyDefenceCap(w.waveCount, w.tier);
                  if (w.enemyTier < w.tier) { w.enemyTier = w.tier; w.nextTierAt = nextEnemyTierAt(w.t, warRand, w.enemyTier); }
                  logWar(`Status: they are back. Rebuilt, dug in, and they field ${TIERS[w.enemyTier].id}.`, true);
              }
              // the enemy escalates on its own jittered clock
              if (w.t >= w.nextTierAt && enemyMayResearch(w.t) && w.enemyTier < TIERS.length - 1 && !w.enemyLeft) {
                  w.enemyTier++; w.nextTierAt = nextEnemyTierAt(w.t, warRand, w.enemyTier, w.tier - w.enemyTier);
                  logWar(`Intel: enemy has developed ${TIERS[w.enemyTier].id}.`, w.enemyTier > w.tier);
              }
              const raided = (w.raidUntil || 0) > w.t;          // our raiding party holds their defence down
              if (raided) w.enemyDefence = 0;
              else if (!silent) w.enemyDefence = Math.min(w.enemyDefence + ENEMY_DEFENCE_REGROW(w.tier) * defenceStandingK(standing), enemyDefenceCap(w.waveCount, w.tier) * defenceStandingK(standing));
              if (!raided && w.raidUntil && !w.saidRaidOver) { w.saidRaidOver = true; logWar('Interior: the raiding party is back. Their defence is regrouping.'); }
              // waves, as long as the enemy is still here; every fifth is a push
              if (!silent && !w.enemyLeft && !w.pendingWave && w.t - w.lastWaveAt >= waveInterval(w.waveCount)) {
                  w.lastWaveAt = w.t; w.waveCount++;
                  const target = pickTarget(warPlates(), warRand);
                  if (target) {
                      const push = w.waveCount % 5 === 0;
                      const size = Math.round(waveSize(w.waveCount) * waveStandingK(standing) * (push ? 2 : 1));
                      w.pendingWave = { targetId: target.id, size, launchAt: w.t + WAVE_WARNING_S, push };
                      const ti = gameState.buildings.findIndex(b => b && b.id === target.id);
                      const targetEl = ui.landGrid.children[ti]?.querySelector('.building');
                      if (w.radar && targetEl) targetEl.classList.add('targeted');
                      if (w.radar) logWar(push ? `Intel: a large force is heading for ${target.type}.` : `Radar: landing party heading for ${target.type}.`, push);
                  }
              }
              if (w.pendingWave && w.t >= w.pendingWave.launchAt) {
                  const { targetId, size } = w.pendingWave; w.pendingWave = null;
                  const b = gameState.buildings.find(x => x && x.id === targetId);
                  if (b && !b.razed) {
                      const enemy = TIERS[w.enemyTier];
                      const ti = gameState.buildings.findIndex(x => x && x.id === targetId);
                      const targetEl = ui.landGrid.children[ti]?.querySelector('.building');
                      targetEl?.classList.add('targeted');   // the plate under attack is marked as soon as they set out
                      // What you see is the rule: the share of dots that fall on the way is what our defence absorbs.
                      const ratio = relativePower(w.enemyTier, w.tier);
                      const losses = Math.min(1, Math.min(size * ratio * MAX_ABSORB, w.defence) / (size * ratio));
                      const impact = () => { targetEl?.classList.remove('targeted'); resolveWave(targetId, size, enemy); };
                      if (_ants) {
                          const edge = _ants.launchWave({ targetBuildingId: targetId, count: size, mode: enemy.mode, losses, onImpact: impact });
                          if (edge && edge !== 's' && !(w.hitEdges || []).includes(edge)) w.hitEdges = (w.hitEdges || []).concat([edge]);
                      } else impact();
                  }
              }
              // food and land suffer: scorch cuts production, and the war room says so once
              const doom = doomsday(w.scorchOurs + w.scorchTheirs);
              for (const [th, text] of [[15, 'Status: artillery is scarring the fields.'], [35, 'Status: wheat fields obliterated. Food is short.'], [55, 'Status: chemical weapons have struck our larders.'], [80, 'Status: the ground is poisoned. Little grows.']]) {
                  if (doom >= th && !(w.saidDoom || []).includes(th)) { w.saidDoom = (w.saidDoom || []).concat([th]); logWar(text, true); }
              }
              if (gameState.supplies <= 0 && gameState.population > 0 && (w.t - (w.lastFoodWarn || -999)) > 60) { w.lastFoodWarn = w.t; logWar('Status: food storages critical. People are starving.', true); }
              // rebuilt enemy tiles
              (w.enemyRazedUntil || []).forEach((until, i) => { if (until && w.t >= until) w.enemyRazedUntil[i] = 0; });
              // The end comes from the clock, not from their island: when the
              // surface is nearly done (doomsday), they withdraw, launch, leave rubble.
              if (!w.enemyLeft && doom >= DOOMSDAY_LEAVE) {
                  w.enemyLeft = true; w.leaveStage = 0; w.leaveAt = w.t;
                  logWar('Intel: the enemy is withdrawing all forces to a launch site.', true);
                  const rocket = ui.competitorIsland.querySelector('.enemy-rocket');
                  ui.competitorIsland.classList.add('enemy-launch');
                  if (_ants && rocket) _ants.withdraw(rocket, () => { w.leaveStage = Math.max(w.leaveStage, 1); w.leaveAt = w.t; });
                  else { w.leaveStage = 1; }
              }
              if (w.enemyLeft) {
                  // 0 boarding (quiet) → 1 all aboard: ignition, 5 s → 2 lift-off, 11 s → 3 rubble
                  if (w.leaveStage === 0 && w.t - w.leaveAt > 25) { w.leaveStage = 1; w.leaveAt = w.t; }
                  if (w.leaveStage >= 1 && w.leaveStage < 3) ui.competitorIsland.classList.add('enemy-ignite');
                  if (w.leaveStage === 1 && w.t - w.leaveAt >= 5) { w.leaveStage = 2; w.leaveAt = w.t; ui.competitorIsland.classList.add('enemy-left'); logWar('Our scientists have declared the surface uninhabitable for life. The enemy has left for space.', true); }
                  if (w.leaveStage === 2 && w.t - w.leaveAt >= 11) { w.leaveStage = 3; ui.competitorIsland.classList.remove('enemy-launch', 'enemy-ignite'); ui.competitorIsland.classList.add('enemy-rubble'); logWar('We have not had the resources to do the same. But there is a secret plan. Go deep.'); }
                  if (w.leaveStage >= 3 && w.salvage >= SHIP_SALVAGE && !w.shipReady) { w.shipReady = true; }
              }
              // Their rocket is underway long before they leave: from doomsday
              // ROCKET_FROM the tile stands on their island, its ring filling
              // until DOOMSDAY_LEAVE.
              if (!w.enemyLeft) {
                  const building = doom >= ROCKET_FROM;
                  ui.competitorIsland.classList.toggle('enemy-rocket-building', building);
                  if (building) {
                      rocketRing.style.strokeDashoffset = String(113 - 113 * Math.min(1, (doom - ROCKET_FROM) / (DOOMSDAY_LEAVE - ROCKET_FROM)));
                      if (!w.saidRocket) { w.saidRocket = true; logWar('Intel: they have started building something tall on their island. A rocket.', true); }
                  }
              } else ui.competitorIsland.classList.remove('enemy-rocket-building');
              // The quartermaster only buys, at the stance ratio, and keeps
              // QM_KEEP_S seconds of arms in the yard for you. It never strikes.
              const stance = w.stance || 'balanced';
              if (w.autoBought && stance !== 'off') {
                  const budget = quartermasterBudget(w.arms, armsPerSecond(w.tier) * w.armsShare);
                  const buy = autoBuy(budget, w.defence, w.force, UNIT_COST, stance);
                  w.arms -= (buy.defence + buy.force) * UNIT_COST; w.defence += buy.defence; w.force += buy.force;
              }
              // Auto strike (its own toggle, off by default): only when the force
              // can take the toughest tile still standing, never into a wall.
              if (w.autoStrike && isShown(w, 'autoStrike') && !w.enemyLeft && w.force > 0) {
                  const up = (w.enemyRazedUntil || []).map((until, i) => ({ until, i })).filter(t => !(t.until > 0));
                  const hardest = up.length ? Math.max(...up.map(({ i }) => w.enemyTileHp?.[i] ?? ENEMY_TILE_HP)) : 0;
                  if (hardest > 0 && canRazeTile(w.force, w.tier, w.enemyTier, w.enemyDefence, hardest)) tryStrike();
              }
              // One control at a time, teased grey until it can be afforded.
              const opened = revealNext(w);
              if (opened) {
                  if (REVEAL_LINES[opened]) logWar(REVEAL_LINES[opened]);
                  if (opened === 'fort') gameState.buildings.forEach((b, i) => { if (b) renderGridSlot(i); });
              }
              // The first minute: if nothing is coming out of the factory, the slider says so, once.
              if (!w.sliderPulsed && w.t >= 6 && w.t <= 60 && w.arms < UNIT_COST && w.defence + w.force === 0) {
                  w.sliderPulsed = true;
                  const row = ui.armsSlider.parentElement;
                  row.classList.remove('pulse-once'); void row.offsetWidth; row.classList.add('pulse-once');
              }
          }
          /** What the war room says when a control opens. */
          const REVEAL_LINES = {
              strike: 'Interior: our force can cross now. The crosshair shows ✓ when a strike would raze.',
              fort: 'Interior: every plate can be fortified and repaired (◆, paid in hammers). A damaged plate works at half strength.',
              radar: 'Interior: a radar would tell us when and where they land.',
              intel: 'Interior: an intel office could read their weapons and their shield.',
              raid: 'Interior: a raiding party could knock out their defence for a while.',
              tier: 'Interior: the laboratory can develop better weapons. It is slow, and they are working on theirs.',
              auto: 'Interior: a quartermaster could buy units for us, at a ratio you set.',
              autoStrike: 'Interior: the generals offer to strike on their own whenever a strike would raze.',
          };
          const ROCKET_FROM = 55;

          /**
           * A landing resolves when the survivors reach the plate. `size` is the
           * wave as launched; the dots that fell on the way are the units our
           * defence absorbed (the visuals were scripted from the same rule).
           * Weapons are relative (war.js): what decides it is who is ahead.
           */
          function resolveWave(targetId, size, enemy) {
              const w = gameState.war; if (!w?.active) return;
              const i = gameState.buildings.findIndex(b => b && b.id === targetId);
              const b = gameState.buildings[i];
              w.landings = (w.landings || 0) + 1;
              if (!b || b.razed) return;
              const hp = b.hp ?? plateMaxHp(b.type, b.fort || 0);
              const ratio = relativePower(w.enemyTier, w.tier);
              const r = resolveLanding({ size, enemyTier: w.enemyTier, ourTier: w.tier, defence: w.defence, hp });
              const fallen = Math.min(size, Math.round(r.absorbed / ratio));
              const reached = size - fallen;
              w.defence = Math.max(0, w.defence - r.defenceLost);
              b.hp = r.hpLeft;
              w.scorchOurs += enemy.scorch;
              if (enemy.mode === 'area') { gameState.supplies = Math.max(0, gameState.supplies * 0.8); logWar('Status: their strike hit our stores. Food lost.', true); }
              const story = `${size} ${enemy.id} landed; ${fallen} fell to our defence, ${reached} reached ${b.type}`;
              const cost = r.defenceLost > 0 ? ` We lost ${r.defenceLost} defenders.` : '';
              if (r.razed) {
                  b.razed = true; b.population = 0; b.fort = 0; b.hp = 0;
                  w.scorchOurs += enemy.scorch * 4;
                  renderGridSlot(i);
                  logWar(`Status: ${story} and razed it.${cost}`, true);
              } else {
                  logWar(`Status: ${story}. It stands, HP ${Math.round(b.hp)}/${plateMaxHp(b.type, b.fort || 0)}.${cost}`);
              }
              updateAllUI();
          }

          const strikeTargets = () => {
              const w = gameState.war; if (!w?.active) return [];
              return enemyTileEls().map((el, i) => ({ el, i })).filter(({ el, i }) => getComputedStyle(el).opacity !== '0' && !(w.enemyRazedUntil?.[i] > 0));
          };
          function tryStrike() {
              const w = gameState.war; if (!w?.active || w.enemyLeft || w.force <= 0) return false;
              const visible = strikeTargets();
              if (!visible.length) { if (!w.saidNothingToStrike) { w.saidNothingToStrike = true; logWar('Interior: nothing left standing over there to strike. They are rebuilding.'); } return false; }
              w.saidNothingToStrike = false;
              const pickIdx = visible[Math.floor(Math.random() * visible.length)].i;
              const force = w.force, ourTier = w.tier, tier = TIERS[w.tier];
              const strikeRatio = relativePower(w.tier, w.enemyTier), enemyDefence0 = w.enemyDefence;
              const losses = Math.min(1, Math.min(force * strikeRatio, enemyDefence0) / (force * strikeRatio));
              w.force = 0; // released
              w.strikes = (w.strikes || 0) + 1;
              const impact = () => {
                  const ww = gameState.war; if (!ww?.active) return;
                  const hp = ww.enemyTileHp?.[pickIdx] ?? ENEMY_TILE_HP;
                  const enemyDefenceAtImpact = ww.enemyDefence;
                  const r = resolveOurStrike({ force, ourTier, enemyTier: ww.enemyTier, enemyDefence: ww.enemyDefence, tileHp: hp });
                  ww.force += r.forceLeft; ww.enemyDefence = r.enemyDefenceLeft;
                  ww.enemyTileHp = ww.enemyTileHp || [0, 0, 0, 0, 0].map(() => ENEMY_TILE_HP);
                  ww.enemyTileHp[pickIdx] = r.tileHpLeft;
                  ww.scorchTheirs += tier.scorch * 3;
                  const names = ['factory', 'warehouse', 'radar', 'tower', 'shipyard'];
                  const fell = Math.min(force, Math.round(Math.min(force * strikeRatio, enemyDefenceAtImpact) / strikeRatio));
                  const story = `${force} ${tier.id} struck; ${fell} fell to their defence`;
                  if (r.razed) {
                      ww.enemyRazedUntil[pickIdx] = ww.t + ENEMY_REBUILD_S;
                      ww.enemyTileHp[pickIdx] = ENEMY_TILE_HP;
                      ww.salvage += SALVAGE_PER_TILE * tier.power;
                      ww.scorchTheirs += tier.scorch * 10;
                      logWar(`Interior: ${story}, the rest razed their ${names[pickIdx]}. Salvage recovered.`);
                  } else if (r.tileHpLeft < hp) {
                      logWar(`Interior: ${story}, the rest damaged their ${names[pickIdx]} (HP ${Math.round(r.tileHpLeft)}/${ENEMY_TILE_HP}).`);
                  } else {
                      logWar(`Interior: ${story}. Nothing reached their ${names[pickIdx]}.`);
                  }
                  updateAllUI();
              };
              if (_ants) _ants.launchStrike({ tileIndex: pickIdx, count: force, mode: tier.mode, losses, onImpact: impact }); else impact();
              updateAllUI();
              return true;
          }

          function updateWarUI() {
              const w = gameState.war;
              const active = !!w?.active;
              [ui.buyDefenceBtn, ui.buyForceBtn].forEach(btn => btn.classList.toggle('hidden', !active));
              ui.strikeBtn.classList.toggle('hidden', !active || !isShown(w, 'strike'));
              ui.tierBtn.classList.toggle('hidden', !active || !isShown(w, 'tier'));
              ui.autoStrikeBtn.classList.toggle('hidden', !active || !isShown(w, 'autoStrike') || w.enemyLeft);
              if (!active) { ui.autoBtn.classList.add('hidden'); ui.radarBtn.classList.add('hidden'); ui.intelBtn.classList.add('hidden'); ui.raidBtn.classList.add('hidden'); }
              ui.shipBtn.classList.toggle('hidden', !(active && w.enemyLeft));
              if (!active) return;
              const tier = TIERS[w.tier];
              ui.warDefence.textContent = Math.round(w.defence).toLocaleString('en-US');
              ui.warForce.textContent = Math.round(w.force).toLocaleString('en-US');
              ui.warArms.textContent = Math.floor(w.arms).toLocaleString('en-US');
              ui.warArmsRate.textContent = `+${(armsPerSecond(w.tier) * w.armsShare).toFixed(0)}/s`;
              ui.warTier.textContent = `${tier.numeral} ${tier.id}`;
              ui.warEnemyTier.textContent = w.intel ? `${TIERS[w.enemyTier].numeral} ${TIERS[w.enemyTier].id}` : '?';
              ui.intelBtn.classList.toggle('hidden', !active || !!w.intel || !isShown(w, 'intel'));
              ui.intelBtn.disabled = w.arms < INTEL_COST;
              setTooltip(ui.intelBtn, { effect: `<i data-lucide='eye' class='w-4 h-4'></i> intel`, armsCost: INTEL_COST });
              ui.tierBadge.textContent = w.tier < TIERS.length - 1 ? TIERS[w.tier + 1].numeral : tier.numeral;
              const doom = doomsday(w.scorchOurs + w.scorchTheirs);
              ui.doomsdayRing.style.strokeDashoffset = 113 - (doom / 100) * 113;
              ui.phaseCity.style.setProperty('--scorch', (doom / 100).toFixed(3));
              ui.salvage.textContent = w.salvage > 0 ? `${Math.round(w.salvage).toLocaleString('en-US')} ▾` : '';
              ui.buyDefenceBtn.disabled = w.arms < UNIT_COST;
              ui.buyForceBtn.disabled = w.arms < UNIT_COST;
              const targets = strikeTargets();
              ui.strikeBtn.disabled = w.force <= 0 || w.enemyLeft || !targets.length;
              const nextCost = w.tier < TIERS.length - 1 ? tierScienceCost(w.tier + 1, w.scienceRate0, w.enemyTier - w.tier) : null;
              const cooling = (w.t || 0) - (w.lastTierAt ?? -999) < TIER_COOLDOWN_S;
              ui.tierBtn.disabled = nextCost === null || gameState.science < nextCost || cooling;
              ui.autoBtn.classList.toggle('hidden', !active || !isShown(w, 'auto'));
              ui.autoBtn.classList.toggle('toggled', !!w.autoBought && (w.stance || 'balanced') !== 'off');
              // The quartermaster's stance, a ratio defence : force (shield 3:1, scale 1:1, sword 1:3), or off
              {
                  const stance = w.stance || 'balanced';
                  const stanceIcon = { defend: 'shield-check', balanced: 'scale', attack: 'sword', off: 'pause' }[stance];
                  const wantIcon = w.autoBought ? stanceIcon : 'repeat';
                  if (ui.autoBtn.dataset.icon !== wantIcon) {
                      ui.autoBtn.dataset.icon = wantIcon;
                      const i = document.createElement('i'); i.className = 'w-7 h-7'; i.setAttribute('data-lucide', wantIcon);
                      ui.autoBtn.querySelector('svg, i')?.replaceWith(i);
                      scheduleIconRefresh();
                  }
              }
              // Raiding party: a helper you send in; while it is there their defence is nothing
              const raidLeft = Math.max(0, Math.ceil((w.raidUntil || 0) - w.t));
              ui.raidBtn.classList.toggle('hidden', !active || w.enemyLeft || !isShown(w, 'raid'));
              ui.raidBtn.disabled = raidLeft > 0 || w.arms < raidCost(w.raids || 0);
              ui.raidBtn.classList.toggle('active-raid', raidLeft > 0);
              setTooltip(ui.raidBtn, raidLeft > 0 ? { effect: `<i data-lucide='venetian-mask' class='w-4 h-4'></i> ${raidLeft} s` } : { effect: `<i data-lucide='venetian-mask' class='w-4 h-4'></i> their <i data-lucide='shield' class='w-4 h-4'></i> → 0 for ${RAID_S} s`, armsCost: raidCost(w.raids || 0) });
              // Radar: a purchase, then an instrument: the badge counts down to the next landing,
              // the tooltip says how big it is and where it is heading once it is spotted.
              ui.radarBtn.classList.toggle('hidden', !active || w.enemyLeft || !isShown(w, 'radar'));
              ui.radarBtn.classList.toggle('radar-on', !!w.radar);
              if (w.radar) {
                  const p = w.pendingWave;
                  const silentNow = (w.enemyRazedUntil || []).filter(x => x > 0).length >= 5;
                  const next = p ? Math.max(0, p.launchAt - w.t) : Math.max(0, Math.ceil(waveInterval(w.waveCount) - (w.t - w.lastWaveAt)));
                  ui.radarBtn.disabled = false;
                  ui.radarBadge.classList.toggle('hidden', silentNow);
                  ui.radarBadge.textContent = `${next}s`;
                  ui.radarBtn.classList.toggle('radar-spotted', !!p);
                  const heading = p ? gameState.buildings.find(b => b && b.id === p.targetId)?.type : null;
                  setTooltip(ui.radarBtn, silentNow ? { effect: `<i data-lucide='radar' class='w-4 h-4'></i> quiet` }
                      : p ? { effect: `${p.size} ${TIERS[w.enemyTier].id} → ${heading || '?'} in ${next} s` }
                      : { effect: `<i data-lucide='radar' class='w-4 h-4'></i> next landing in ${next} s` });
              } else {
                  ui.radarBadge.classList.add('hidden');
                  ui.radarBtn.disabled = w.arms < RADAR_COST;
                  setTooltip(ui.radarBtn, { effect: `<i data-lucide='radar' class='w-4 h-4'></i> when and where`, armsCost: RADAR_COST });
              }
              // enemy tiles show damage like ours
              enemyTileEls().forEach((el, i) => { const hp = w.enemyTileHp?.[i]; el.style.setProperty('--hp', hp === undefined ? '1' : (hp / ENEMY_TILE_HP).toFixed(2)); });
              ui.autoBtn.disabled = !w.autoBought && w.arms < AUTO_COST;
              {
                  const stance = w.stance || 'balanced';
                  const ratio = STANCE_RATIO[stance];
                  const ratioHtml = ratio ? `${ratio[0]} <i data-lucide='shield' class='w-4 h-4'></i> : ${ratio[1]} <i data-lucide='swords' class='w-4 h-4'></i>` : 'off';
                  setTooltip(ui.autoBtn, w.autoBought
                      ? { effect: `${ratioHtml}<br><span class='tip-note'>keeps ${QM_KEEP_S} s of <i data-lucide='hammer' class='w-3 h-3 inline'></i> · never strikes</span>` }
                      : { effect: `<i data-lucide='repeat' class='w-4 h-4'></i> buys at a ratio`, armsCost: AUTO_COST });
                  ui.autoBadge.textContent = ratio ? `${ratio[0]}:${ratio[1]}` : '';
                  ui.autoBadge.classList.toggle('hidden', !w.autoBought || !ratio);
              }
              // Auto strike: its own toggle, off until you turn it on
              ui.autoStrikeBtn.classList.toggle('toggled', !!w.autoStrike);
              ui.autoStrikeBadge.classList.toggle('hidden', !w.autoStrike);
              setTooltip(ui.autoStrikeBtn, { effect: w.autoStrike ? `<i data-lucide='crosshair' class='w-4 h-4'></i> on ✓ only` : `<i data-lucide='crosshair' class='w-4 h-4'></i> off` });
              // Predicted strike: ✓ if force × power beats their defence and a tile
              const canRaze = canRazeTile(w.force, w.tier, w.enemyTier, w.enemyDefence);
              ui.strikeBtn.classList.toggle('will-raze', canRaze && w.force > 0);
              // the verdict, always on the button: ✓ would raze a tile, × would not
              ui.strikeVerdict.textContent = canRaze ? '✓' : '×';
              ui.strikeVerdict.classList.toggle('hidden', !(w.force > 0) || w.enemyLeft);
              ui.strikeVerdict.classList.toggle('no', !canRaze);
              // arms: say where they come from
              setTooltip(ui.warArmsRow, { effect: `<i data-lucide='hammer' class='w-4 h-4'></i> from the <i data-lucide='factory' class='w-4 h-4'></i> · <i data-lucide='star' class='w-4 h-4'></i> ↔ <i data-lucide='hammer' class='w-4 h-4'></i> slider` });
              ui.warEnemyDefence.textContent = w.intel ? Math.round(w.enemyDefence).toLocaleString('en-US') : '?';
              ui.shipBtn.disabled = !w.shipReady;
              const batch = batchSize(w.arms);
              setTooltip(ui.buyDefenceBtn, { effect: `+${batch} <i data-lucide='shield' class='w-4 h-4'></i>`, armsCost: batch * UNIT_COST });
              setTooltip(ui.buyForceBtn, { effect: `+${batch} <i data-lucide='swords' class='w-4 h-4'></i>`, armsCost: batch * UNIT_COST });
              setTooltip(ui.strikeBtn, !targets.length && !w.enemyLeft
                  ? { unlockReq: `<i data-lucide='factory' class='w-4 h-4'></i> rebuilding…` }
                  : { effect: `${Math.round(w.force)} <i data-lucide='swords' class='w-4 h-4'></i> ${w.intel ? `→ ${Math.round(w.force * relativePower(w.tier, w.enemyTier)).toLocaleString('en-US')} <i data-lucide='flame' class='w-4 h-4'></i> ` : ''}${canRaze ? '✓' : '×'}` });
              setTooltip(ui.tierBtn, nextCost === null ? { effect: tier.numeral } : (cooling ? { unlockReq: `${TIERS[w.tier + 1].numeral} · ${Math.max(0, TIER_COOLDOWN_S - ((w.t || 0) - (w.lastTierAt ?? 0)))} s` } : { effect: `${TIERS[w.tier + 1].numeral} · ${TIERS[w.tier + 1].id}`, scienceCost: nextCost }));
              setTooltip(ui.shipBtn, w.shipReady ? { effect: `IV · THE DEEP ▾` } : { unlockReq: `${SHIP_SALVAGE.toLocaleString('en-US')} ▾` });
              // enemy tiles: razed ones dim until rebuilt
              enemyTileEls().forEach((el, i) => el.classList.toggle('enemy-razed', (w.enemyRazedUntil?.[i] || 0) > 0));
          }

          window.debug_war = (what) => {
              if (what === 'start') { if (!gameState.competitorSpawned) { gameState.competitorSpawned = true; gameState.competitorSpawnedAt = Date.now() - 300000; gameState.competitorStage = 5; } startWar(); return; }
              const w = gameState.war; if (!w?.active) return;
              if (what === 'arms') w.arms += 1000;
              if (what === 'tier') w.tier = Math.min(TIERS.length - 1, w.tier + 1);
              if (what === 'etier') w.enemyTier = Math.min(TIERS.length - 1, w.enemyTier + 1);
              if (what === 'wave') w.lastWaveAt = -999;
              if (what === 'leave') w.scorchTheirs += 2500 * 2.5;
              if (what === 'salvage') w.salvage += 2000;
              if (what === 'stage') w.leaveAt = -999;
              updateAllUI();
          };
          /** Everything chapter II sells has been bought. */
          function cityComplete() {
              return !!(gameState.apartmentResearched && gameState.storeResearched && gameState.toolCaseUnlocked &&
                  gameState.urbanismResearched && gameState.carUnlocked && gameState.computerUnlocked &&
                  gameState.megastructureResearched && gameState.landExpanded && gameState.landExpansion2 &&
                  gameState.gmoLevel >= gameState.gmoMaxLevel &&
                  gameState.superconductorLevel >= buildingData.superconductor.maxLevel);
          }

          function applyCompetitorStage(pop) {
              const el = ui.competitorIsland;
              if (!el) return;
              // The competitor builds its capital on its own clock of PLAY time
              // (a reload does not build five tiles at once), one tile a minute,
              // five tiles in all. Stages are sticky.
              void pop;
              const age = (gameState.competitorTicks || 0) * 1000;
              const byTime = Math.min(5, 1 + Math.floor(age / 60000));
              const stage = Math.max(gameState.competitorStage || 1, byTime);
              gameState.competitorStage = stage;
              let changed = false;
              for (let s = 2; s <= 5; s++) {
                  const cls = `competitor-stage-${s}`;
                  const had = el.classList.contains(cls);
                  el.classList.toggle(cls, stage >= s);
                  if (stage >= s && !had) changed = true;
              }
              if (changed) scheduleIconRefresh();
          }

          // --- DEBUG FUNCTIONS ---
          function debug_addResources(type, amount) { gameState[type] += amount; }
          function debug_addPopulation(amount) {
              for (let i = 0; i < amount; i++) {
                  const availableHouse = gameState.buildings.find(b => b && (b.type === 'home' || b.type === 'apartment' || b.type === 'skyscraper' || b.type === 'district') && b.population < b.capacity);
                  if (availableHouse) availableHouse.population++;
              }
          }
          ui.debugToggleBtn.addEventListener('click', () => {
              const isHidden = ui.debugMenu.style.display === 'none' || ui.debugMenu.style.display === '';
              ui.debugMenu.style.display = isHidden ? 'block' : 'none';
          }, { signal });

          ui.resetBtn.addEventListener('click', () => {
              if (!confirm('Reset all progress? This cannot be undone.')) return;
              savingEnabled = false;
              window.removeEventListener('beforeunload', beforeUnloadHandler);
              clearInterval(logicInterval);
              clearInterval(fastUiInterval);
              localStorage.removeItem(SAVE_KEY);
              localStorage.removeItem(STARS_TRANSFER_KEY);
              localStorage.removeItem(PHASE_KEY);
              setTimeout(() => location.reload(), 0);
          }, { signal });
  
          // --- BUILDING & RENDERING LOGIC ---
          const notifiedUpgrades = new Set();
          let initialLoadDone = false;

          // --- ICON REFRESH (debounced) ---
          let iconRefreshPending = false;
          function scheduleIconRefresh() {
              if (iconRefreshPending) return;
              iconRefreshPending = true;
              requestAnimationFrame(() => {
                  lucide.createIcons();
                  iconRefreshPending = false;
              });
          }

          const renderer = createRenderer({ landGrid: ui.landGrid, scheduleIconRefresh, notifiedUpgrades });
          const renderGridSlot = (index) => renderer.renderGridSlot(index, gameState.buildings, gameState, initialLoadDone);
          const refreshAllBuildingActions = () => renderer.refreshAllBuildingActions(gameState.buildings, gameState, initialLoadDone);

          // Ants: people and cars on the streets, the enemy on its island
          // Islands: our coast appears when the land is full, theirs with the competitor
          _islands = {
              ours: createIsland({ svg: ui.islandsSvg, area: ui.cityArea, target: ui.landGrid, id: 'island-ours', shape: { pad: 34, points: 22, wobble: 0.3, seed: 11 } }),
              enemy: createIsland({ svg: ui.islandsSvg, area: ui.cityArea, target: ui.competitorIsland, id: 'island-enemy', shape: { pad: 30, points: 16, wobble: 0.35, seed: 5 } }),
          };
          _islands.enemy.path.classList.add('enemy');
          function updateIslands() {
              const full = gameState.landExpanded || gameState.competitorSpawned;
              const oursVisible = full || gameState.islandRevealed;
              if (full) gameState.islandRevealed = true;
              const enemyVisible = !!gameState.competitorSpawned && ui.competitorIsland.classList.contains('visible');
              ui.phaseCity.classList.toggle('has-water', oursVisible || enemyVisible);
              _islands.ours.update(oursVisible);
              _islands.enemy.update(enemyVisible);
          }

          // Debug hook: rpiAnts.step(0.05) advances by 50 ms when the loop is idle
          window.rpiAnts = _ants = createAnts({
              canvas: ui.antsCanvas,
              area: ui.cityArea,
              getSlots: () => gameState.buildings.map((b, i) => ({ el: ui.landGrid.children[i], building: b })).filter(s => s.el),
              getEnemyTiles: () => ui.competitorIsland.classList.contains('visible')
                  ? [...ui.competitorIsland.querySelectorAll('.enemy-factory, .enemy-tile')].filter(el => getComputedStyle(el).opacity !== '0')
                  : [],
              getGap: () => parseFloat(getComputedStyle(ui.landGrid).columnGap) || 8,
          });

          function calculateBaseStarPerPerson() {
              let baseStarPerPerson = buildingData.person.income;
              if (gameState.toolCaseUnlocked) baseStarPerPerson *= 2;
              if (gameState.carUnlocked) baseStarPerPerson *= 5;
              if (gameState.computerUnlocked) baseStarPerPerson *= 11;
              baseStarPerPerson *= Math.pow(2, gameState.superconductorLevel);
              return baseStarPerPerson;
          }

          // Two-tap sell confirmation: keyed by building id → { timeout, slot }
          const _pendingSell = new Map();

          function cancelPendingSell(buildingId) {
              const pending = _pendingSell.get(buildingId);
              if (!pending) return;
              clearTimeout(pending.timeout);
              _pendingSell.delete(buildingId);
              // Reset visual state
              const slot = pending.slot;
              if (slot) {
                  const sellBtn = slot.querySelector('.sell-btn');
                  if (sellBtn) {
                      sellBtn.textContent = '-';
                      sellBtn.classList.remove('sell-confirm');
                  }
              }
          }

          function sellBuilding(event, buildingId) {
              // buildingId is always a number (parsed from data-building-id at the call site)
              const index = gameState.buildings.findIndex(b => b && b.id === buildingId);
              if (index === -1) return;
              const building = gameState.buildings[index];

              // On touch (no hover), use two-tap confirmation.
              // On pointer devices that can hover, sell immediately (tooltip already shows refund).
              const isTouch = event.pointerType === 'touch';
              if (isTouch && !_pendingSell.has(buildingId)) {
                  // First tap: enter confirm state
                  const refund = Math.floor((buildingData[building.type]?.cost || 0) * 0.7);
                  const slot = ui.landGrid.children[index];
                  const sellBtn = slot ? slot.querySelector('.sell-btn') : null;
                  if (sellBtn) {
                      sellBtn.textContent = `${refund >= 1000 ? Math.round(refund / 1000) + 'k' : refund}★`;
                      sellBtn.classList.add('sell-confirm');
                  }
                  const timeout = setTimeout(() => cancelPendingSell(buildingId), 3000);
                  _pendingSell.set(buildingId, { timeout, slot });
                  return;
              }

              // Second tap (touch) or any non-touch tap: execute sell
              cancelPendingSell(buildingId);
              gameState.stars += (buildingData[building.type]?.cost || 0) * 0.7;
              gameState.buildings[index] = undefined;
              gameState.population = gameState.buildings.reduce((total, b) => total + (b?.population || 0), 0);
              renderGridSlot(index);
              logicTick(true);
              updateAllUI();
          }
          
          function upgradeBuilding(event, buildingId, targetType) {
              // buildingId is always a number (parsed from data-building-id at the call site)
              const index = gameState.buildings.findIndex(b => b && b.id === buildingId);
              if (index === -1) return;
              const building = gameState.buildings[index];
              const upgradeData = buildingData[targetType];
              if (gameState.stars >= upgradeData.cost) {
                  gameState.stars -= upgradeData.cost;
                  building.type = targetType;
                  Object.keys(upgradeData).forEach(key => {
                      building[key] = upgradeData[key];
                  });
                  renderGridSlot(index);
              }
          }
          
          function addBuilding(type) {
              const index = gameState.buildings.findIndex(b => b === undefined);
              if (index !== -1 && gameState.stars >= buildingData[type].cost) {
                  gameState.stars -= buildingData[type].cost;
                  const newId = Date.now() + Math.random();
                  gameState.buildings[index] = { id: newId, type, population: 0, ...buildingData[type]};
                  renderGridSlot(index);
              }
          }
  
          // --- TOOLTIP & UI UPDATE LOGIC ---
          const tooltipListenersAttached = new WeakSet();

          /** Keeps a tooltip inside the window: measured when shown, nudged in by the overflow. */
          function clampTooltip(tip) {
              tip.style.translate = '0 0';
              const r = tip.getBoundingClientRect(), m = 8;
              const dx = r.left < m ? m - r.left : (r.right > innerWidth - m ? innerWidth - m - r.right : 0);
              const dy = r.top < m ? m - r.top : (r.bottom > innerHeight - m ? innerHeight - m - r.bottom : 0);
              if (dx || dy) tip.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
          }
          function setTooltip(el, { effect, cost, scienceCost, armsCost, unlockReq }) {
              const tooltipEl = el.querySelector('.tooltip');
              if (!tooltipEl) return;
              let html = '';
              if (unlockReq) {
                  html += `<div class="unlock-req">${unlockReq}</div>`;
              } else {
                  if (effect) html += `<div class="effect">${effect}</div>`;
                  if (cost) html += `<div class="cost"><span class="font-mono">${cost.toLocaleString('en-US')}</span><i data-lucide="star" class="w-4 h-4 text-slate-300"></i></div>`;
                  if (armsCost) html += `<div class="cost"><span class="font-mono">${armsCost.toLocaleString('en-US')}</span><i data-lucide="hammer" class="w-4 h-4 text-slate-300"></i></div>`;
                  if (scienceCost) html += `<div class="cost-science"><span class="font-mono">${scienceCost.toLocaleString('en-US')}</span><i data-lucide="atom" class="w-4 h-4 text-slate-300"></i></div>`;
              }
              tooltipEl.innerHTML = html;
              if (!tooltipListenersAttached.has(el)) {
                  el.addEventListener('mouseenter', () => { tooltipEl.style.setProperty('--tooltip-opacity', 1); clampTooltip(tooltipEl); }, { signal });
                  el.addEventListener('mouseleave', () => tooltipEl.style.setProperty('--tooltip-opacity', 0), { signal });
                  tooltipListenersAttached.add(el);
              }
          }
  
          function updateAllUI() {
              const pop = gameState.population;
              const canAfford = (item) => gameState.stars >= (item.cost || 0) && gameState.science >= (item.scienceCost || 0);
              const hasEmptySlot = gameState.buildings.some(b => b === undefined);
  
              const superconductorMaxLevel = buildingData.superconductor.maxLevel;
              // showAt = appear grayed out, popReq = actually usable
              const upgrades = [
                  { btn: ui.toolCaseUpgradeBtn, showAt: 25, popReq: 50, flag: 'toolCaseUnlocked' },
                  { btn: ui.gmoUpgradeBtn, showAt: 40, popReq: 75, flag: 'gmoLevel', isMultiLevel: true, maxLevel: gameState.gmoMaxLevel },
                  { btn: ui.apartmentResearchBtn, showAt: 15, popReq: 30, flag: 'apartmentResearched' },
                  { btn: ui.storeResearchBtn, showAt: 40, popReq: 50, flag: 'storeResearched' },
                  { btn: ui.urbanismResearchBtn, showAt: 100, popReq: 200, flag: 'urbanismResearched' },
                  { btn: ui.expandLandBtn, showAt: 750, popReq: 1000, flag: 'landExpanded' },
                  { btn: ui.carUpgradeBtn, showAt: 250, popReq: 500, flag: 'carUnlocked' },
                  { btn: ui.computerUpgradeBtn, showAt: 500, popReq: 1000, flag: 'computerUnlocked', prereq: 'carUnlocked' },
                  { btn: ui.megastructureResearchBtn, showAt: 2500, popReq: 5000, flag: 'megastructureResearched'},
                  { btn: ui.superconductorBtn, showAt: 5000, popReq: 10000, flag: 'superconductorLevel', isMultiLevel: true, maxLevel: superconductorMaxLevel },
                  { btn: ui.expandLand2Btn, showAt: 7500, popReq: 10000, flag: 'landExpansion2', prereq: 'landExpanded' },
              ];

              let anyUpgradeVisible = false;
              upgrades.forEach(({btn, showAt, flag, isMultiLevel, maxLevel, prereq}) => {
                  const isPurchased = isMultiLevel ? gameState[flag] >= maxLevel : gameState[flag];
                  const prereqMet = prereq ? gameState[prereq] : true;
                  const shouldShow = (pop >= showAt || isPurchased) && prereqMet;

                  // Done means gone, multi-level too; and chapter II research hides during the war
                  const warOn = !!gameState.war?.active;
                  btn.classList.toggle('hidden', !shouldShow || isPurchased || warOn);
                  if (shouldShow && !isPurchased && !warOn) anyUpgradeVisible = true;
              });
              ui.buildSeparator.classList.toggle('hidden', !anyUpgradeVisible);

              // III · WAR: teased when the competitor appears, open once they razed a house
              ui.warBtn.classList.toggle('hidden', !gameState.warReady || gameState.warChosen);
              updateWarUI();
              ui.warBtn.disabled = !gameState.warReady;
              setTooltip(ui.warBtn, gameState.warReady
                  ? { effect: `III · WAR` }
                  : { unlockReq: `<i data-lucide='factory' class='w-4 h-4'></i> …` });
  
  
              // Disabled state for basic buildings
              ui.buildHomeBtn.disabled = !canAfford(buildingData.home) || !hasEmptySlot;
              ui.buildStoreBtn.disabled = !canAfford(buildingData.store) || !hasEmptySlot;
  
              // Disabled state for global upgrades
              ui.toolCaseUpgradeBtn.disabled = !canAfford(buildingData.toolCaseUpgrade) || pop < 50 || gameState.toolCaseUnlocked;
              ui.apartmentResearchBtn.disabled = !canAfford(buildingData.apartmentResearch) || pop < 30 || gameState.apartmentResearched;
              ui.storeResearchBtn.disabled = !canAfford(buildingData.storeResearch) || pop < 50 || gameState.storeResearched;
              ui.urbanismResearchBtn.disabled = !canAfford(buildingData.urbanismResearch) || pop < 200 || gameState.urbanismResearched;
              ui.megastructureResearchBtn.disabled = !canAfford(buildingData.megastructureResearch) || pop < 5000 || gameState.megastructureResearched;
              ui.gmoUpgradeBtn.disabled = !canAfford({cost: buildingData.gmoUpgrade.baseCost * (gameState.gmoLevel + 1), scienceCost: buildingData.gmoUpgrade.scienceCost * (gameState.gmoLevel + 1)}) || pop < 75 || gameState.gmoLevel >= gameState.gmoMaxLevel;
              ui.carUpgradeBtn.disabled = !canAfford(buildingData.carUpgrade) || pop < 500 || gameState.carUnlocked;
              ui.computerUpgradeBtn.disabled = !canAfford(buildingData.computerUpgrade) || pop < 1000 || gameState.computerUnlocked;
              ui.expandLandBtn.disabled = !canAfford(buildingData.landExpansion) || pop < 1000 || gameState.landExpanded;

              const scCost = buildingData.superconductor.baseCost * Math.pow(5, gameState.superconductorLevel);
              ui.superconductorBtn.disabled = gameState.stars < scCost || pop < 10000 || gameState.superconductorLevel >= superconductorMaxLevel;
              ui.expandLand2Btn.disabled = !canAfford(buildingData.landExpansion2) || pop < 10000 || gameState.landExpansion2 || !gameState.landExpanded;

              // Tooltips
              setTooltip(ui.buildHomeBtn, { effect: `+${buildingData.home.capacity} <i data-lucide='users' class='w-4 h-4'></i>`, cost: buildingData.home.cost });
              setTooltip(ui.buildStoreBtn, { effect: `+${buildingData.store.supply} <i data-lucide='shopping-basket' class='w-4 h-4'></i>/s`, cost: buildingData.store.cost });
              // Market stall: visible once food matters (5 pop), no land needed
              ui.buildStallBtn.classList.toggle('hidden', pop < 5 && !(gameState.stalls > 0));
              ui.buildStallBtn.disabled = gameState.stars < stallCost(gameState.stalls || 0);
              setTooltip(ui.buildStallBtn, { effect: `+${STALL_SUPPLY * Math.pow(2, gameState.gmoLevel)} <i data-lucide='shopping-basket' class='w-4 h-4'></i>/s`, cost: stallCost(gameState.stalls || 0) });
              ui.stallCount.textContent = String(gameState.stalls || 0);
              ui.stallCount.classList.toggle('hidden', !(gameState.stalls > 0));
              
              const gmoInfo = buildingData.gmoUpgrade;
              setTooltip(ui.gmoUpgradeBtn, pop < 75 && gameState.gmoLevel === 0 ? { unlockReq: `75 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+100% <i data-lucide='shopping-basket' class='w-4 h-4'></i> Eff.`, cost: gmoInfo.baseCost * (gameState.gmoLevel + 1), scienceCost: gmoInfo.scienceCost * (gameState.gmoLevel + 1) });
              
              setTooltip(ui.toolCaseUpgradeBtn, pop < 50 && !gameState.toolCaseUnlocked ? { unlockReq: `50 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+100% <i data-lucide='star' class='w-4 h-4'></i>/<i data-lucide='user' class='w-4 h-4'></i>`, cost: buildingData.toolCaseUpgrade.cost, scienceCost: buildingData.toolCaseUpgrade.scienceCost });
              
              setTooltip(ui.apartmentResearchBtn, pop < 30 && !gameState.apartmentResearched ? { unlockReq: `30 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `<i data-lucide='home' class='w-4 h-4'></i> → <i data-lucide='building' class='w-4 h-4'></i>`, cost: buildingData.apartmentResearch.cost, scienceCost: buildingData.apartmentResearch.scienceCost });
              setTooltip(ui.storeResearchBtn, pop < 50 && !gameState.storeResearched ? { unlockReq: `50 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `<i data-lucide='store' class='w-4 h-4'></i> → <i data-lucide='shopping-cart' class='w-4 h-4'></i>`, cost: buildingData.storeResearch.cost, scienceCost: buildingData.storeResearch.scienceCost });
              setTooltip(ui.urbanismResearchBtn, pop < 200 && !gameState.urbanismResearched ? { unlockReq: `200 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `<i data-lucide='building-2' class='w-4 h-4'></i>`, cost: buildingData.urbanismResearch.cost, scienceCost: buildingData.urbanismResearch.scienceCost });

              setTooltip(ui.megastructureResearchBtn, pop < 5000 && !gameState.megastructureResearched ? { unlockReq: `5000 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `District`, cost: buildingData.megastructureResearch.cost, scienceCost: buildingData.megastructureResearch.scienceCost });
  
              setTooltip(ui.carUpgradeBtn, pop < 500 && !gameState.carUnlocked ? { unlockReq: `500 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+400% <i data-lucide='star' class='w-4 h-4'></i>/<i data-lucide='user' class='w-4 h-4'></i>`, cost: buildingData.carUpgrade.cost, scienceCost: buildingData.carUpgrade.scienceCost });
              
              setTooltip(ui.computerUpgradeBtn, pop < 1000 || !gameState.carUnlocked ? { unlockReq: `1000 <i data-lucide='users' class='w-4 h-4'></i> & <i data-lucide='car' class='w-4 h-4'></i>` } : { effect: `+1000% <i data-lucide='star' class='w-4 h-4'></i>/<i data-lucide='user' class='w-4 h-4'></i>`, cost: buildingData.computerUpgrade.cost, scienceCost: buildingData.computerUpgrade.scienceCost });
              
              setTooltip(ui.expandLandBtn, pop < 1000 && !gameState.landExpanded ? { unlockReq: `1000 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+5 <i data-lucide='layout-grid' class='w-4 h-4'></i>`, cost: buildingData.landExpansion.cost });

              setTooltip(ui.superconductorBtn, pop < 10000 && gameState.superconductorLevel === 0 ? { unlockReq: `10,000 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+100% <i data-lucide='star' class='w-4 h-4'></i>/<i data-lucide='user' class='w-4 h-4'></i>`, cost: scCost });

              setTooltip(ui.expandLand2Btn, pop < 10000 && !gameState.landExpansion2 ? { unlockReq: `10,000 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+5 <i data-lucide='layout-grid' class='w-4 h-4'></i>`, cost: buildingData.landExpansion2.cost });

              // Fade out science UI when all science-costing upgrades are purchased
              // (Only touch opacity after the disclosure threshold has fired — before
              //  that, the p2-disclose class keeps them hidden via CSS)
              const allScienceDone = gameState.toolCaseUnlocked
                  && gameState.gmoLevel >= gameState.gmoMaxLevel
                  && gameState.urbanismResearched
                  && gameState.carUnlocked
                  && gameState.computerUnlocked
                  && gameState.megastructureResearched;
              // Science never greys out: the war needs it (Ola 2026-09-19).
              void allScienceDone;
              if (_scienceRevealed) {
                  ui.scienceRow.style.opacity = '1';
                  ui.allocationSliderContainer.style.opacity = '1';
              }

              scheduleIconRefresh();
          }
  
        // --- MAIN GAME LOOP ---
        function logicTick(skipGrowth = false) {
          timed('p2:logicTick', () => _logicTickBody(skipGrowth));
        }
        function _logicTickBody(skipGrowth) {
              const baseStarPerPerson = calculateBaseStarPerPerson();

              // During the war a damaged plate's people work at its share of HP (hpYield)
              const warOn = !!gameState.war?.active;
              const hpK = (b) => (warOn && !b.razed ? hpYield(b.hp, plateMaxHp(b.type, b.fort || 0)) : 1);
              const workforce = warOn
                  ? gameState.buildings.reduce((a, b) => a + (b && !b.razed ? (b.population || 0) * hpK(b) : 0), 0)
                  : gameState.population;
              const popForStars = workforce * (1 - gameState.populationAllocation);
              const popForScience = workforce * gameState.populationAllocation;

              // Scorched land yields less: the war is felt in the numbers
              const yieldK = gameState.war?.active ? scorchYield(doomsday(gameState.war.scorchOurs + gameState.war.scorchTheirs)) : 1;
              let netStarChange = popForStars * baseStarPerPerson * yieldK;
              const netScienceChange = popForScience * 1;

              let supplyProduction = 0;
              let currentTotalPopulation = 0;
              const gmoMultiplier = Math.pow(2, gameState.gmoLevel);
              // Market stalls: the cheap repeatable helper; GMO multiplies them too.
              supplyProduction += (gameState.stalls || 0) * STALL_SUPPLY * gmoMultiplier;
              if (gameState.war?.active) supplyProduction *= scorchYield(doomsday(gameState.war.scorchOurs + gameState.war.scorchTheirs));
              if (!skipGrowth) gameState.harvestEfficiency = recoverHarvestEfficiency(gameState.harvestEfficiency ?? 1);

              gameState.buildings.forEach((b) => {
                  if (!b) return;
                  if (b.type === 'factory') netStarChange += buildingData.factoryIncome.income;
                  if (b.type === 'bank') netStarChange -= 30;
                  if (b.type === 'store' || b.type === 'superStore') {
                      supplyProduction += b.supply * gmoMultiplier * hpK(b);
                      netStarChange -= b.upkeep;
                  }
                  if ((b.type === 'home' || b.type === 'apartment' || b.type === 'skyscraper' || b.type === 'district') && !b.razed) {
                      if (!skipGrowth && gameState.supplies > 0 && b.population < b.capacity) {
                          let growthRate = 0;
                          if (b.type === 'district') growthRate = DISTRICT_GROWTH_PER_SEC;
                          else if (b.type === 'skyscraper') growthRate = 5;
                          else if (b.type === 'apartment') growthRate = 1;
                          else {
                              b.prodTimer = (b.prodTimer || 0) + 1;
                              if (b.prodTimer >= 5) { b.prodTimer = 0; growthRate = 1; }
                          }
                          if (warOn) growthRate = Math.round(growthRate * hpK(b));
                          b.population = Math.min(b.capacity, b.population + growthRate);
                      }
                      currentTotalPopulation += b.population;
                  }
              });

              gameState.population = currentTotalPopulation;
              // Refresh action button states every tick (population OR stars may
              // have changed what is affordable). Rings are kept alive by
              // fastUiTick, so a full DOM rebuild would cause the "flärp" ring
              // reset; this only toggles disabled/upgradeable.
              refreshAllBuildingActions();

              gameState.baseStarPerPerson = baseStarPerPerson;
              gameState.netStarChangePerSecond = netStarChange;
              gameState.netScienceChangePerSecond = netScienceChange;

              if (gameState.war?.active && netStarChange > 0) {
                  // The factory makes arms instead of goods, and the army costs upkeep
                  const w = gameState.war;
                  const units = (w.defence || 0) + (w.force || 0);
                  netStarChange = netStarChange * (1 - w.armsShare) - netStarChange * UPKEEP_SHARE_PER_UNIT * units;
                  gameState.netStarChangePerSecond = netStarChange;
              }
              if (!skipGrowth) {
                  gameState.stars = Math.max(0, gameState.stars + netStarChange);
                  gameState.science = Math.max(0, gameState.science + netScienceChange);
              }

              const troops = gameState.war?.active ? ((gameState.war.defence || 0) + (gameState.war.force || 0)) * FOOD_PER_UNIT : 0;
              const supplyConsumption = gameState.population + troops;
              const netSupplyChange = supplyProduction - supplyConsumption;

              // Cache supply values for fastUiTick to read — avoids recomputing every 50ms
              gameState.cachedSupplyProduction = supplyProduction;
              gameState.cachedSupplyConsumption = supplyConsumption;
              gameState.cachedNetSupplyChange = netSupplyChange;

              if (!skipGrowth) {
                  gameState.supplies = Math.max(0, gameState.supplies + netSupplyChange);

                  if (gameState.supplies <= 0 && gameState.population > 0) {
                      const deficit = Math.abs(netSupplyChange);
                      const deaths = Math.max(1, Math.ceil(deficit * 0.05));
                      const popBuildings = gameState.buildings.filter(b => b && (b.type === 'home' || b.type === 'apartment' || b.type === 'skyscraper' || b.type === 'district') && b.population > 0);
                      let remaining = deaths;
                      popBuildings.sort((a,b) => a.id - b.id);
                      for (const b of popBuildings) {
                          if (remaining <= 0) break;
                          const kill = Math.min(remaining, b.population);
                          b.population -= kill;
                          remaining -= kill;
                      }
                  }
              }

              if (gameState.population >= 5 && !ui.populationUi.classList.contains('visible')) {
                  ui.populationUi.classList.add('visible');
                  ui.suppliesUi.classList.add('visible');
              }

              // Progressive disclosure: stars-per-person at pop ≥ 5
              if (gameState.population >= 5 && !_starsPerPersonRevealed) {
                  _starsPerPersonRevealed = true;
                  ui.starsPerPerson.classList.add('p2-visible');
              }

              // Progressive disclosure: science + slider at pop ≥ 100
              if (gameState.population >= 100 && !_scienceRevealed) {
                  _scienceRevealed = true;
                  ui.scienceRow.classList.add('p2-visible');
                  ui.allocationSliderContainer.classList.add('p2-visible');
              }

              // Competitor spawn, then growth in stages before the chapter turns
              if (gameState.population >= COMPETITOR_POP && !gameState.competitorSpawned) {
                  gameState.competitorSpawned = true;
                  gameState.competitorSpawnedAt = Date.now();
                  smoothLayoutShift(() => ui.competitorIsland.classList.remove('hidden'));
                  // Trigger fade-in on next frame
                  requestAnimationFrame(() => {
                      ui.competitorIsland.classList.add('visible');
                      scheduleIconRefresh();
                  });
              }

              if (gameState.competitorSpawned && !skipGrowth) gameState.competitorTicks = (gameState.competitorTicks || 0) + 1;
              applyCompetitorStage(gameState.population);
              updateIslands();
              _ants?.setState({
                  population: gameState.population,
                  carUnlocked: !!gameState.carUnlocked,
                  enemyStage: gameState.competitorSpawned ? (gameState.competitorStage || 1) : 0,
                  enemyTicks: gameState.competitorTicks || 0,
                  ourTier: gameState.war?.tier || 0,
                  enemyTier: gameState.war?.enemyTier || 0,
                  defence: gameState.war?.defence || 0,
                  guardsOff: !!gameState.war?.enemyLeft || !!gameState.shipChosen,
                  hitEdges: gameState.war?.hitEdges || [],
              });

              // Raids. The competitor waits until our city is complete (everything
              // bought) and its own capital stands (stage 3+), then razes one outer
              // house, walks home, and comes back every RAID_INTERVAL until the
              // player chooses WAR. (WAR_POP is only a safety net.)
              const capitalReady = gameState.competitorSpawned && (gameState.competitorStage || 1) >= 3;
              const complete = cityComplete() || gameState.population >= WAR_POP * 4;
              if (complete && !skipGrowth) gameState.completeTicks = (gameState.completeTicks || 0) + 1;
              const ready = capitalReady && !gameState.warChosen && !gameState.war?.active && complete && (gameState.completeTicks || 0) >= 30;
              const sinceRaid = Date.now() - (gameState.lastRaidAt || 0);
              if (ready && _ants && !_ants.raiding() && sinceRaid >= RAID_INTERVAL_MS) {
                  const onRazed = (building) => {
                      if (building) { building.razed = true; building.population = 0; }
                      gameState.warReady = true;
                      saveGameState();
                      updateAllUI();
                  };
                  if (_ants.startAttack(onRazed)) gameState.lastRaidAt = Date.now();
              }

              if (!skipGrowth) warTick();
              updateAllUI();
              saveGameState();
          }
  
          function fastUiTick() {
              counter('p2:fastUiTick');
              timed('p2:fastUiTick', _fastUiTickBody);
          }
          function _fastUiTickBody() {
              // Smooth counter rolling: lerp toward actual values for a "spinning numbers" effect
              _displayedStars += (gameState.stars - _displayedStars) * COUNTER_LERP;
              _displayedScience += (gameState.science - _displayedScience) * COUNTER_LERP;
              if (Math.abs(gameState.stars - _displayedStars) < 0.5) _displayedStars = gameState.stars;
              if (Math.abs(gameState.science - _displayedScience) < 0.5) _displayedScience = gameState.science;
              ui.starCount.textContent = Math.round(_displayedStars).toLocaleString('en-US');
              ui.scienceCount.textContent = Math.round(_displayedScience).toLocaleString('en-US');
              ui.populationCountTotal.textContent = gameState.population.toLocaleString('en-US');
              const capacity = gameState.buildings.reduce((a, b) => a + ((b && !b.razed && b.capacity) ? b.capacity : 0), 0);
              ui.populationCapacity.textContent = capacity > 0 ? `${capacity.toLocaleString('en-US')} ◻` : '';

              ui.netStarChange.textContent = `${(gameState.netStarChangePerSecond || 0) >= 0 ? '+' : ''}${Math.round(gameState.netStarChangePerSecond || 0).toLocaleString('en-US')}/s`;
              ui.netStarChange.style.color = (gameState.netStarChangePerSecond || 0) >= 0 ? '#64748b' : '#94a3b8';
              ui.netScienceChange.textContent = `+${Math.round(gameState.netScienceChangePerSecond || 0).toLocaleString('en-US')}/s`;

              const baseStarPerPerson = calculateBaseStarPerPerson();
              const w2 = gameState.war;
              const doomK = w2?.active ? scorchYield(doomsday(w2.scorchOurs + w2.scorchTheirs)) : 1;
              ui.starsPerPerson.textContent = doomK < 0.995
                  ? `${(baseStarPerPerson * doomK).toFixed(1)} /person · scorched −${Math.round((1 - doomK) * 100)} %`
                  : `${baseStarPerPerson.toFixed(1)} /person`;

              const supplyProduction = gameState.cachedSupplyProduction || 0;
              const supplyConsumption = gameState.cachedSupplyConsumption || 0;
              const netSupplyChange = gameState.cachedNetSupplyChange || 0;

              // Silo: one vessel, one number. Fill = seconds of food in stock;
              // the number is the net flow; the hint says how long the stock lasts.
              const fraction = siloFraction(gameState.supplies, supplyConsumption);
              ui.siloFill.style.height = `${Math.round(fraction * 100)}%`;
              const starved = gameState.supplies <= 0 && supplyConsumption > 0;
              ui.siloBtn.classList.toggle('draining', netSupplyChange < 0 && !starved);
              ui.siloBtn.classList.toggle('empty', starved);
              const netRounded = Math.round(netSupplyChange);
              ui.supplyNet.textContent = `${netRounded >= 0 ? '+' : '−'}${Math.abs(netRounded).toLocaleString('en-US')}/s`;
              ui.supplyNet.style.color = netRounded >= 0 ? '#475569' : '#b45309';
              if (starved) ui.supplyHint.textContent = 'empty';
              else if (netSupplyChange < 0 && supplyConsumption > 0) {
                  const secondsLeft = gameState.supplies / -netSupplyChange;
                  ui.supplyHint.textContent = secondsLeft >= 90 ? `${Math.round(secondsLeft / 60)} min` : `${Math.round(secondsLeft)} s`;
              } else ui.supplyHint.textContent = '';
              ui.supplyConsumption.textContent = `-${supplyConsumption.toLocaleString('en-US')}`;
              ui.supplyProduction.textContent = `+${Math.round(supplyProduction).toLocaleString('en-US')}`;
              ui.harvestPreview.textContent = String(harvestAmount(supplyConsumption, gameState.harvestEfficiency ?? 1));

              gameState.buildings.forEach((b, i) => {
                  if (!b) return;
                  if (b.type === 'home' || b.type === 'apartment' || b.type === 'skyscraper' || b.type === 'district') {
                      const popRing = document.getElementById(`pop-ring-${b.id}`);
                      if (popRing) popRing.style.strokeDashoffset = 113 - ((b.population / b.capacity) * 113);
                      // Move-in stopped for lack of food: same colour as the empty silo
                      const wrapper = ui.landGrid.children[i]?.querySelector('.building');
                      if (wrapper) wrapper.classList.toggle('starved', starved && b.population < b.capacity);
                  }
                  // Damaged plates: shaded by HP, and a small amber dot (they work at that share)
                  if (gameState.war?.active && b.type !== 'factory' && b.type !== 'bank') {
                      const wrapper = ui.landGrid.children[i]?.querySelector('.building');
                      if (wrapper) {
                          const max = plateMaxHp(b.type, b.fort || 0);
                          const k = Math.max(0, b.hp ?? max) / max;
                          wrapper.style.setProperty('--hp', k.toFixed(2));
                          wrapper.classList.toggle('damaged', !b.razed && k < 0.999);
                      }
                  }
              });
              const gmoPercent = (gameState.gmoLevel / gameState.gmoMaxLevel) * 113;
              ui.gmoRing.style.strokeDashoffset = 113 - gmoPercent;

              const scPercent = (gameState.superconductorLevel / buildingData.superconductor.maxLevel) * 113;
              ui.superconductorRing.style.strokeDashoffset = 113 - scPercent;
          }
          
          // --- EVENT LISTENERS ---

          // Event delegation for sell / upgrade buttons inside building slots.
          // Replaces inline onclick="sellBuilding(event, id)" / onclick="upgradeBuilding(...)".
          // One listener on the grid, cleaned up by AbortController on teardown — no globals needed.
          ui.landGrid.addEventListener('click', (e) => {
              const sellBtn = e.target.closest('.sell-btn');
              if (sellBtn) {
                  const buildingId = Number(sellBtn.dataset.buildingId);
                  if (!Number.isNaN(buildingId)) sellBuilding(e, buildingId);
                  return;
              }
              const fortBtn = e.target.closest('.fort-btn');
              if (fortBtn) {
                  const w = gameState.war; const id = Number(fortBtn.dataset.buildingId);
                  const i = gameState.buildings.findIndex(b => b && b.id === id); const b = gameState.buildings[i];
                  if (w?.active && b && !b.razed) {
                      const cost = FORT_COST(b.fort || 0);
                      if (w.arms >= cost) { w.arms -= cost; b.fort = (b.fort || 0) + 1; b.hp = plateMaxHp(b.type, b.fort); renderGridSlot(i); logWar(`Interior: ${b.type} fortified and repaired. HP ${b.hp}.`); updateAllUI(); }
                      else flashArms();
                  }
                  return;
              }
              const clearBtn = e.target.closest('.clear-btn');
              if (clearBtn) {
                  const id = Number(clearBtn.dataset.buildingId);
                  const i = gameState.buildings.findIndex(b => b && b.id === id); const b = gameState.buildings[i];
                  if (b && b.razed) {
                      const cost = Math.round((buildingData[b.type]?.cost || 0) * 0.3);
                      if (gameState.stars >= cost) { gameState.stars -= cost; gameState.buildings[i] = undefined; renderGridSlot(i); logicTick(true); updateAllUI(); }
                  }
                  return;
              }
              const upgradeBtn = e.target.closest('.upgrade-btn');
              if (upgradeBtn) {
                  const buildingId = Number(upgradeBtn.dataset.buildingId);
                  const upgradeTarget = upgradeBtn.dataset.upgradeTarget;
                  if (!Number.isNaN(buildingId) && upgradeTarget) upgradeBuilding(e, buildingId, upgradeTarget);
              }
          }, { signal });

          ui.warBtn.addEventListener('click', () => {
              if (!gameState.warReady || gameState.warChosen) return;
              gameState.warChosen = true;
              saveGameState();
              // The chapter turns, but the game goes on: the war is played on this map.
              // Slow and dark: black, then III, then WAR; a click or 5 s ends it; a beat; the camera lowers.
              playChapterCard({ roman: 'III', title: 'WAR', dark: true, slow: true, hold: 5000, onMidpoint: () => startWar() })
                  .then(() => setTimeout(() => document.body.classList.add('tilt'), 1500));
          }, { signal });
          /** One click buys a tenth of your arms' worth of units (at least one). */
          const batchSize = (arms) => Math.max(1, Math.floor(arms * 0.1 / UNIT_COST));
          ui.buyDefenceBtn.addEventListener('click', () => { const w = gameState.war; if (!w?.active || w.arms < UNIT_COST) return; const n = batchSize(w.arms); w.arms -= n * UNIT_COST; w.defence += n; updateAllUI(); }, { signal });
          ui.buyForceBtn.addEventListener('click', () => { const w = gameState.war; if (!w?.active || w.arms < UNIT_COST) return; const n = batchSize(w.arms); w.arms -= n * UNIT_COST; w.force += n; updateAllUI(); }, { signal });
          /** Short of arms: the arms counter flashes, so the eye goes to where hammers come from. */
          function flashArms() {
              const row = ui.warArmsRow;
              row.classList.remove('flash-short'); void row.offsetWidth; row.classList.add('flash-short');
          }
          ui.intelBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active || w.intel) return;
              if (w.arms >= INTEL_COST) { w.arms -= INTEL_COST; w.intel = true; logWar(`Intel: office opened. The enemy fields ${TIERS[w.enemyTier].id}.`); updateAllUI(); }
          }, { signal });
          ui.raidBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active || w.enemyLeft || (w.raidUntil || 0) > w.t) return;
              const cost = raidCost(w.raids || 0);
              if (w.arms < cost) return;
              w.arms -= cost; w.raids = (w.raids || 0) + 1; w.raidUntil = w.t + RAID_S; w.saidRaidOver = false;
              w.enemyDefence = 0;
              logWar(`Interior: a raiding party slipped onto their island. Their defence is down for ${RAID_S} s. Strike now.`);
              updateAllUI();
          }, { signal });
          ui.strikeBtn.addEventListener('click', () => { tryStrike(); }, { signal });
          ui.tierBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active || w.tier >= TIERS.length - 1) return;
              const cost = tierScienceCost(w.tier + 1, w.scienceRate0, w.enemyTier - w.tier);
              if ((w.t || 0) - (w.lastTierAt ?? -999) < TIER_COOLDOWN_S) return;
              if (gameState.science >= cost) {
                  gameState.science -= cost; w.tier++; w.lastTierAt = w.t || 0;
                  logWar(`Interior: ${TIERS[w.tier].id} developed. Units are stronger.`);
                  const pulled = enemyCatchUp(w.tier, w.enemyTier);
                  if (pulled > w.enemyTier) { w.enemyTier = pulled; logWar(`Intel: enemy has stolen blueprints for ${TIERS[w.enemyTier].id}.`, true); }
                  // Their laboratory keeps its own clock (war-playtest-3: the old
                  // "back to the drawing board" restart made a lead permanent).
                  if (w.tier > w.enemyTier) logWar('Intel: they have nothing like this. Yet.');
                  updateAllUI();
              }
          }, { signal });
          ui.radarBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active || w.radar) return;
              if (w.arms >= RADAR_COST) { w.arms -= RADAR_COST; w.radar = true; logWar('Interior: radar online. Landings are marked before they arrive.'); updateAllUI(); }
          }, { signal });
          ui.autoBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active) return;
              if (!w.autoBought) {
                  if (w.arms >= AUTO_COST) { w.arms -= AUTO_COST; w.autoBought = true; w.auto = true; w.stance = 'balanced'; logWar('Interior: a quartermaster now buys units for us. Set the stance.'); }
              } else {
                  const i = STANCES.indexOf(w.stance || 'balanced');
                  w.stance = STANCES[(i + 1) % STANCES.length];
                  w.auto = w.stance !== 'off';
              }
              updateAllUI();
          }, { signal });
          ui.autoStrikeBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active || !isShown(w, 'autoStrike')) return;
              w.autoStrike = !w.autoStrike;
              logWar(w.autoStrike ? 'Interior: the generals will strike whenever a strike would raze.' : 'Interior: strikes are yours again.');
              updateAllUI();
          }, { signal });
          ui.armsSlider.addEventListener('input', (e) => { if (gameState.war?.active) gameState.war.armsShare = e.target.value / 100; updateAllUI(); }, { signal });
          ui.shipBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.shipReady || gameState.shipChosen) return;
              gameState.shipChosen = true;
              logWar('Go deep.');
              saveGameState();
              savingEnabled = false;
              if (logicInterval) clearInterval(logicInterval);
              // The hatch: the bottom-right plate goes dark and everyone walks in.
              const slots = ui.landGrid.children;
              const hatch = slots[slots.length - 1];
              hatch?.classList.add('deep-hatch');
              const card = () => {
                  if (fastUiInterval) clearInterval(fastUiInterval);
                  goDeep();
              };
              if (_ants && hatch) { _ants.gatherAt(hatch, () => setTimeout(card, 1200)); setTimeout(card, 20000); } else card();
          }, { signal });
          ui.buildHomeBtn.addEventListener('click', () => addBuilding('home'), { signal });
          ui.buildStoreBtn.addEventListener('click', () => addBuilding('store'), { signal });
          ui.buildStallBtn.addEventListener('click', () => {
              const cost = stallCost(gameState.stalls || 0);
              if (gameState.stars < cost) return;
              gameState.stars -= cost;
              gameState.stalls = (gameState.stalls || 0) + 1;
              updateAllUI();
          }, { signal });
          // Hand harvest: the manual action of chapter II. Pays less per click
          // when hammered, recovers with rest (economy.js).
          ui.siloBtn.addEventListener('click', () => {
              const consumption = gameState.cachedSupplyConsumption || 0;
              const gained = harvestAmount(consumption, gameState.harvestEfficiency ?? 1);
              gameState.supplies += gained;
              gameState.harvestEfficiency = spendHarvestEfficiency(gameState.harvestEfficiency ?? 1);
              ui.harvestPop.textContent = `+${gained.toLocaleString('en-US')}`;
              ui.harvestPop.classList.remove('go');
              void ui.harvestPop.offsetWidth; // restart animation
              ui.harvestPop.classList.add('go');
          }, { signal });
          
          const createUpgradeListener = (flag, upgradeData) => {
              if (gameState.stars >= (upgradeData.cost || 0) && gameState.science >= (upgradeData.scienceCost || 0) && !gameState[flag]) {
                  gameState.stars -= (upgradeData.cost || 0);
                  gameState.science -= (upgradeData.scienceCost || 0);
                  gameState[flag] = true;
                  // Re-render only the buildings that gain a new upgrade option from this
                  // research. Urbanisim enables home→apartment and apartment→skyscraper
                  // upgrade buttons; Megastructure enables skyscraper→district. Other buildings
                  // are unaffected and must not be touched — rebuilding them resets their rings.
                  gameState.buildings.forEach((b, i) => {
                      if (!b) return;
                      const affected =
                          (flag === 'apartmentResearched' && b.type === 'home') ||
                          (flag === 'storeResearched' && b.type === 'store') ||
                          (flag === 'urbanismResearched' && (b.type === 'home' || b.type === 'apartment')) ||
                          (flag === 'megastructureResearched' && b.type === 'skyscraper');
                      if (affected) renderGridSlot(i);
                  });
              }
          };
  
          ui.gmoUpgradeBtn.addEventListener('click', () => {
               const cost = buildingData.gmoUpgrade.baseCost * (gameState.gmoLevel + 1);
               const scienceCost = buildingData.gmoUpgrade.scienceCost * (gameState.gmoLevel + 1);
              if (gameState.stars >= cost && gameState.science >= scienceCost && gameState.gmoLevel < gameState.gmoMaxLevel) {
                  gameState.stars -= cost;
                  gameState.science -= scienceCost;
                  gameState.gmoLevel++;
              }
          }, { signal });

          ui.toolCaseUpgradeBtn.addEventListener('click', () => createUpgradeListener('toolCaseUnlocked', buildingData.toolCaseUpgrade), { signal });
          ui.apartmentResearchBtn.addEventListener('click', () => createUpgradeListener('apartmentResearched', buildingData.apartmentResearch), { signal });
          ui.storeResearchBtn.addEventListener('click', () => createUpgradeListener('storeResearched', buildingData.storeResearch), { signal });
          ui.urbanismResearchBtn.addEventListener('click', () => createUpgradeListener('urbanismResearched', buildingData.urbanismResearch), { signal });
          ui.megastructureResearchBtn.addEventListener('click', () => createUpgradeListener('megastructureResearched', buildingData.megastructureResearch), { signal });
          ui.carUpgradeBtn.addEventListener('click', () => createUpgradeListener('carUnlocked', buildingData.carUpgrade), { signal });
          ui.computerUpgradeBtn.addEventListener('click', () => createUpgradeListener('computerUnlocked', buildingData.computerUpgrade), { signal });

          ui.superconductorBtn.addEventListener('click', () => {
              const cost = buildingData.superconductor.baseCost * Math.pow(5, gameState.superconductorLevel);
              if (gameState.stars >= cost && gameState.superconductorLevel < buildingData.superconductor.maxLevel) {
                  gameState.stars -= cost;
                  gameState.superconductorLevel++;
              }
          }, { signal });

            ui.expandLandBtn.addEventListener('click', () => {
                if (gameState.stars >= buildingData.landExpansion.cost && !gameState.landExpanded) {
                    gameState.stars -= buildingData.landExpansion.cost;
                    gameState.landExpanded = true;
                    smoothLayoutShift(() => addLandSlots(5));
                    updateAllUI();
                }
            }, { signal });

          ui.expandLand2Btn.addEventListener('click', () => {
              if (gameState.stars >= buildingData.landExpansion2.cost && !gameState.landExpansion2 && gameState.landExpanded) {
                  gameState.stars -= buildingData.landExpansion2.cost;
                  gameState.landExpansion2 = true;
                  smoothLayoutShift(() => addLandSlots(5));
                  updateAllUI();
              }
          }, { signal });

          /**
           * Layout changes (new rows, the island appearing) move the whole city.
           * FLIP: measure, mutate, then slide grid, island and the dot canvas from
           * the old place to the new over 700 ms. Dots measure in layout space,
           * so they slide with the plates instead of jumping.
           */
          function smoothLayoutShift(mutate) {
              const before = ui.landGrid.offsetTop;
              mutate();
              const dy = before - ui.landGrid.offsetTop;
              if (!dy) return;
              const els = [ui.landGrid, ui.competitorIsland, ui.antsCanvas, ui.islandsSvg];
              els.forEach(el => { el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; });
              void ui.landGrid.offsetHeight; // reflow
              els.forEach(el => { el.style.transition = 'transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)'; el.style.transform = ''; });
              setTimeout(() => els.forEach(el => { el.style.transition = ''; }), 800);
          }

          /** New plots settle in one after another instead of popping. */
          function addLandSlots(n) {
              for (let i = 0; i < n; i++) {
                  gameState.buildings.push(undefined);
                  const slot = document.createElement('div');
                  slot.className = 'building-slot empty slot-new';
                  slot.style.animationDelay = `${i * 120}ms`;
                  slot.addEventListener('animationend', () => slot.classList.remove('slot-new'), { once: true });
                  ui.landGrid.appendChild(slot);
              }
          }

            ui.allocationSlider.addEventListener('input', (e) => {
                if (gameState.war?.active) { e.target.value = 50; return; }
                gameState.populationAllocation = e.target.value / 100;
            }, { signal });

            ui.allocationDecBtn.addEventListener('click', () => {
                const newVal = Math.max(0, Math.round(gameState.populationAllocation * 100) - 5);
                gameState.populationAllocation = newVal / 100;
                ui.allocationSlider.value = newVal;
            }, { signal });

            ui.allocationIncBtn.addEventListener('click', () => {
                const newVal = Math.min(100, Math.round(gameState.populationAllocation * 100) + 5);
                gameState.populationAllocation = newVal / 100;
                ui.allocationSlider.value = newVal;
            }, { signal });

            function initialize() {
                if (!Array.isArray(gameState.buildings) || gameState.buildings.length === 0) {
                    gameState.buildings = new Array(10).fill(undefined);
                    gameState.buildings[0] = {id: 1, type: 'factory'};
                    gameState.buildings[1] = {id: 2, type: 'bank'};
                }
                ui.allocationSlider.value = gameState.populationAllocation * 100;
                const grid = ui.landGrid;
                grid.innerHTML = '';
                gameState.buildings.forEach(() => grid.insertAdjacentHTML('beforeend', '<div class="building-slot empty"></div>'));
                gameState.buildings.forEach((_, i) => renderGridSlot(i));

                // Past-threshold load: reveal disclosed elements immediately (no fade-in)
                if (gameState.population >= 5) {
                    _starsPerPersonRevealed = true;
                    ui.starsPerPerson.classList.add('p2-instant', 'p2-visible');
                }
                if (gameState.population >= 100) {
                    _scienceRevealed = true;
                    ui.scienceRow.classList.add('p2-instant', 'p2-visible');
                    ui.allocationSliderContainer.classList.add('p2-instant', 'p2-visible');
                }

                // Restore competitor visibility if already spawned
                if (gameState.competitorSpawned) {
                    ui.competitorIsland.classList.remove('hidden');
                    ui.competitorIsland.classList.add('visible');
                    applyCompetitorStage(gameState.population);
                    scheduleIconRefresh();
                }
                if (gameState.warReady) _warCardTriggered = true;
                if (gameState.war?.active) applyWarPresentation();
                // Came back after choosing the way down: straight on down again.
                if (gameState.shipChosen) {
                    _warCardTriggered = true;
                    savingEnabled = false;
                    if (logicInterval) clearInterval(logicInterval);
                    if (fastUiInterval) clearInterval(fastUiInterval);
                    goDeep();
                }
                initialLoadDone = true;
                logicTick(true);
                updateAllUI();
                saveGameState();
            }

  window.debug_addResources = debug_addResources;
  window.debug_addPopulation = debug_addPopulation;
  try {
      initialize();
  } catch (e) {
      // Never touch the save here. A failing init is far more likely to be a
      // stale-cache module mix after a deploy than a corrupt save (2026-09-18:
      // this path wiped Ola's chapter II and reload-looped). Stop saving and
      // hand the error to main.js, which refetches modules and retries once.
      console.error('Phase 2 init: initialize() failed', e);
      savingEnabled = false;
      if (abortController) abortController.abort();
      throw e;
  }
  // Only start ticks if initialize() did not trigger the WAR end-state.
  // When returning to a ≥50k population save, initialize() sets savingEnabled=false
  // and calls playChapterCard(to-come). Starting ticks in that case would run the
  // game logic behind the WAR card and allow population to keep growing.
  if (savingEnabled) {
      logicInterval = setInterval(logicTick, 1000);
      fastUiInterval = setInterval(fastUiTick, 50);
      _ants?.start();
  }
  updateIslands();
  window.addEventListener('resize', () => { _islands?.ours.update(gameState.islandRevealed); }, { signal: abortController.signal });
  window.addEventListener('beforeunload', beforeUnloadHandler);
  mountSaveButtons(ui.debugMenu);
  }

export function teardown() {
  if (_ants) { _ants.stop(); _ants = null; delete window.rpiAnts; }
  if (abortController) abortController.abort();
  clearInterval(logicInterval);
  clearInterval(fastUiInterval);
  window.removeEventListener('beforeunload', beforeUnloadHandler);
  delete window.debug_addResources;
  delete window.debug_addPopulation;
  _warCardTriggered = false;
  _deepStarting = false;
  savingEnabled = true;
  _displayedStars = 0;
  _displayedScience = 0;
  _starsPerPersonRevealed = false;
  _scienceRevealed = false;
}
