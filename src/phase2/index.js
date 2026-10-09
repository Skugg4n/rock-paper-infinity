/* global lucide */

import { PHASE2_CONSTANTS, PHASE_KEY } from "../constants.js";
import { playChapterCard } from '../chapterCard.js';
import { phases, setPhase } from '../gamePhase.js';
import { serializePhase2, loadFromStorage, saveToStorage } from './persistence.js';
import { mountSaveButtons } from '../save-export.js';
import { startInterim, writeChoice } from '../interim.js';
import { buildingData } from './buildings-config.js';
import { createRenderer, armoryClearCost } from './rendering.js';
import { timed, counter } from '../perf.js';
import {
    siloFraction, stallCost, harvestAmount, spendHarvestEfficiency, recoverHarvestEfficiency, STALL_SUPPLY, formatCount,
} from './economy.js';
import { createAnts, chooseArmoryPlot, enemiesRemain } from './ants.js';
import { layoutRect } from './layout.js';
import { createIsland, coastPoints } from './islands.js';
import { audio } from '../audio.js';
import { city, popLevel } from '../audio-city.js';
import { war, handoverAt, ROCKET_FROM as SOUND_ROCKET_FROM } from '../audio-war.js';
import {
    TIERS, UNIT_COST, FORT_COST, ENEMY_REBUILD_S, ENEMY_DEFENCE_REGROW, enemyDefenceCap, waveStandingK, defenceStandingK,
    SALVAGE_PER_TILE, DOOMSDAY_LEAVE, ENEMY_REGROUP_S, scorchYield, SHIP_SALVAGE, UPKEEP_SHARE_PER_UNIT, FOOD_PER_UNIT,
    initialWarState, rng as warRng, doomsday, waveInterval, waveSize, nextEnemyTierAt, pickTarget,
    resolveLanding, resolveOurStrike, canRazeTile, relativePower, ENEMY_TILE_HP, plateMaxHp, tierScienceCost, armsPerSecond,
    TIER_COOLDOWN_S, enemyCatchUp, autoBuy, AUTO_COST, STANCES, INTEL_COST, WAVE_WARNING_S, RAID_S, raidCost,
    revealNext, isShown, quartermasterBudget, QM_KEEP_S, STANCE_RATIO, hpYield, enemyMayResearch,
    waveMode, isAirMode, AIR_UNIT_COST, landingLosses, isPush,
} from '../phase3/war.js';

let logicInterval;
let fastUiInterval;
let savingEnabled = true;
let beforeUnloadHandler;
let abortController;
let _warCardTriggered = false;
let _deepStarting = false;
// The city's opening (a new city only): while it plays, nothing can be built.
let _cityOpening = false;
// The store is offered when the food starts to run low (supplies start at 150).
const STORE_REVEAL_SUPPLIES = 100;

/**
 * IV · THE DEEP, by way of the INTERIM (v1.90.0, src/interim.js). The black INTERIM card is the
 * bridge: the interim screen is built under it during its hold, so it is there when the card
 * lifts. There one match against Destiny decides which chapter IV comes (the vault or the dig,
 * written under DEEP_VERSION_KEY); then black, and chapter IV starts. The phase 2 save keeps
 * `interimPending` while the screen is up (a reload comes back to the screen, no card) and
 * `interimChosen` once the act is chosen (a reload goes straight on down). The "to come" wall is
 * kept for one case only, a browser that cannot load the chapter at all.
 */
function markSave(patch) {
    const { SAVE_KEY } = PHASE2_CONSTANTS;
    const save = loadFromStorage(SAVE_KEY);
    if (save) saveToStorage(SAVE_KEY, serializePhase2(Object.assign(save, patch)));
}
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
    const startDeep = () => setPhase(phases.DEEP).catch((e) => console.error('chapter IV failed to start', e));
    const save = loadFromStorage(PHASE2_CONSTANTS.SAVE_KEY) || {};
    if (save.interimChosen) {
        // chosen before a reload: on down
        writeChoice(save.interimChosen === 'dig' ? 'drone' : 'vault', localStorage);
        startDeep();
        return;
    }
    const opts = {
        onDecided: (version) => markSave({ interimPending: false, interimChosen: version }),
        onGone: startDeep,
    };
    if (save.interimPending) { startInterim(opts); return; }   // a reload during the interim: the screen, no card
    markSave({ interimPending: true });
    let screen = null;
    playChapterCard({
        // Slow and dark like the WAR card, no numeral; a click or 4 s ends the hold. Silent: the war's E♭ falls to D under it.
        roman: '', title: 'INTERIM', dark: true, slow: true, hold: 4000, silent: true,
        onMidpoint: () => { screen = startInterim({ ...opts, under: true }); },
    }).then(() => { if (screen) screen.lift(); else startInterim(opts); });   // no card (one already up): the screen at once
}
let _ants = null;
let _islands = null;
let _starvedSaid = false;

// Smooth counter rolling. The real values move once a second (logicTick); the
// display glides from the previous second's value to this one's, so it counts
// at an even pace instead of rushing and resting. It is never ahead of the
// real value. The lerp on top softens sudden changes (a purchase, a sale).
let _displayedStars = 0;
let _displayedScience = 0;
let _starsStep = 0;      // what the last logic tick added
let _scienceStep = 0;
let _stepAt = 0;         // when it did (performance.now())
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
              greenhouseResearched: false,   // a super store can become a greenhouse (B221)
              urbanismResearched: false,
              megastructureResearched: false,
              landExpanded: false,
              landExpansion2: false,
              superconductorLevel: 0,
              competitorSpawned: false,
              competitorStage: 0,
              cityOpened: false,  // the opening has played: plots and the house are there
              storeShown: false,  // the store has been offered (food ran low)
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
              greenhouseResearchBtn: document.getElementById('greenhouse-research-btn'),
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
          ui.buyAirBtn = once('buy-air-btn', () => {
              const b = document.createElement('button');
              b.className = 'btn hidden'; b.id = 'buy-air-btn';
              b.setAttribute('aria-label', 'Buy air defence');
              b.innerHTML = `<i data-lucide="shield-half" class="w-7 h-7"></i><div class="tooltip"></div>`;
              ui.buyDefenceBtn.before(b);
              return b;
          });
          ui.warAirRow = once('war-air-row', () => {
              const row = document.createElement('div');
              row.id = 'war-air-row'; row.className = 'flex items-center gap-2 hidden';
              row.innerHTML = `<i data-lucide="shield-half" class="w-5 h-5 sm:w-6 sm:h-6 text-slate-400"></i><span id="war-air" class="font-mono font-bold text-lg sm:text-2xl text-slate-600 tabular-nums">0</span>`;
              ui.warDefence.parentElement.after(row);
              return row;
          });
          ui.warAir = document.getElementById('war-air');
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

          /**
           * War room: short lines from the advisor. Kept in the save (last 8).
           * `hold`: a background line (a control opening, a radar call, a doom
           * status, a plate that stood) waits while a climate line is fresh, so
           * the end of the world is read one line at a time (v1.70.0).
           */
          function logWar(text, grim = false, { hold = false } = {}) {
              const w = gameState.war; if (!w) return;
              if (text.startsWith('Intel:') && !w.intel) return;   // you have to buy the eyes
              if (hold && climateFresh(w)) { w.heldLines = (w.heldLines || []).slice(-3).concat([{ text, grim }]); return; }
              w.log = (w.log || []).slice(-7).concat([{ text, grim, t: w.t || 0 }]);
              renderWarRoom();
          }
          /** A climate line was said less than CLIMATE_FRESH_S ago. */
          const climateFresh = (w) => w.climateAt !== undefined && (w.t || 0) - w.climateAt < CLIMATE_FRESH_S;
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
          // The armory (B220) is worth to them what an apartment is (pickTarget value 2); war.js does not know it.
          const warPlates = () => gameState.buildings.map((b, i) => b ? { id: b.id, type: b.type === 'armory' ? 'apartment' : b.type, fort: b.fort || 0, row: Math.floor(i / 5), razed: !!b.razed, b, i } : null).filter(Boolean);

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
              ensureArmory();
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
              if (w.enemyLeft && w.leaveStage >= 6) placeFacility();
              placeOurPier();
          }
          /**
           * Our pier (v1.63.0): built when the war starts, on our south coast near
           * the south-west corner, facing their island. Our boat lies at its end.
           * Built from here (the shell is not this chapter's); placed in layout
           * coordinates under the plates, so the tilt carries it like the coast.
           */
          function ourPier() {
              return once('our-pier', () => {
                  const el = document.createElement('div');
                  el.id = 'our-pier'; el.setAttribute('aria-hidden', 'true');
                  ui.landGrid.after(el);
                  return el;
              });
          }
          let ourPierAt = '';
          function placeOurPier() {
              if (!gameState.war?.active) return;
              const el = ourPier();
              const g = layoutRect(ui.landGrid, ui.cityArea);
              const at = `${Math.round(g.x + 18)},${Math.round(g.y + g.h + 4)}`;
              if (at === ourPierAt) return;
              ourPierAt = at;
              const [x, y] = at.split(',');
              el.style.left = `${x}px`; el.style.top = `${y}px`;
          }
          /**
           * The armory (B220): our soldiers' building. At the start of the war the
           * empty plot nearest our pier becomes it, or (with no plot free) the
           * nearest home or store, its people moving into the town's free room.
           * Kept in the war state (w.armory = { id, was }) so a reload finds it; a
           * war saved before it had one gets it on load. Returns its index if it
           * was made now, else -1. It changes no number: defence and force are
           * the same with or without it; it is where they come out and go in.
           */
          const ARMORY_NOUN = { plot: 'the empty plot', home: 'the old house', store: 'the old warehouse', superStore: 'the old warehouse', apartment: 'the old apartment block', skyscraper: 'the old tower' };
          function ensureArmory() {
              const w = gameState.war;
              if (!w?.active || w.enemyLeft || (w.armory && gameState.buildings.some(b => b && b.id === w.armory.id))) return -1;
              placeOurPier();
              const pier = ourPier();
              const slots = [...ui.landGrid.children].map(el => layoutRect(el, ui.cityArea));
              const pick = chooseArmoryPlot(gameState.buildings, layoutRect(pier, ui.cityArea), slots);
              if (!pick) return -1;
              const old = gameState.buildings[pick.index];
              const moving = old?.population || 0;
              if (moving > 0) {
                  // the people move out into the town's free room (whatever does not fit is not rehoused: there is no rule for it)
                  let left = moving;
                  for (const b of gameState.buildings) {
                      if (!left) break;
                      if (!b || b === old || b.razed || !b.capacity || !['home', 'apartment', 'skyscraper', 'district'].includes(b.type)) continue;
                      const take = Math.min(left, b.capacity - (b.population || 0));
                      if (take > 0) { b.population = (b.population || 0) + take; left -= take; }
                  }
              }
              const id = Date.now() + Math.random();
              gameState.buildings[pick.index] = { id, type: 'armory', was: pick.was, population: 0, fort: 0, hp: plateMaxHp('armory', 0) };
              w.armory = { id, was: pick.was };
              renderGridSlot(pick.index);
              logWar(`Interior: ${ARMORY_NOUN[pick.was] || 'the plot'} by the pier is an armory now.`);
              return pick.index;
          }
          /** The armory's plate pops in like the war's controls (arrive(): the war's 'reveal' word). */
          function popArmory() {
              const i = gameState.buildings.findIndex(b => b && b.type === 'armory');
              const el = ui.landGrid.children[i]?.querySelector('.building');
              if (el) arrive(el);
          }
          /** The armory standing now, or null (none yet, or razed). */
          const armoryStanding = () => {
              const id = gameState.war?.armory?.id;
              return id == null ? null : gameState.buildings.find(b => b && b.id === id && !b.razed) || null;
          };

          // Survivors of a strike by boat who are still on their way home: the
          // rule has already given them back to the force; the counter waits for them.
          let forceAway = 0;

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
                      war.event('islandSilent');
                      w.regroupAt = w.t + ENEMY_REGROUP_S;
                      w.enemyRazedUntil = (w.enemyRazedUntil || [0, 0, 0, 0, 0]).map(() => w.regroupAt);
                      logWar('Interior: their island is silent. They are digging in. Expect them back, and stronger.', true);
                  }
                  w.nextTierAt -= 1; w.lastWaveAt = w.t;
              } else if (w.regroupAt && w.t >= w.regroupAt) {
                  w.regroupAt = 0; w.enemyDefence = enemyDefenceCap(w.waveCount, w.tier);
                  war.event('islandBack');
                  if (w.enemyTier < w.tier) { w.enemyTier = w.tier; w.nextTierAt = nextEnemyTierAt(w.t, warRand, w.enemyTier); }
                  if (!w.enemyLeft) logWar(`Status: they are back. Rebuilt, dug in, and they field ${TIERS[w.enemyTier].id}.`, true);
              }
              // Their houses and their store are never targets: we do not bomb
              // civilians. When every military structure is down, the war room
              // says so, once per silence (B206).
              if (!w.enemyLeft) {
                  const nothing = strikeTargets().length === 0;
                  if (nothing && !w.saidNothingToStrike) { w.saidNothingToStrike = true; logWar('Interior: their military structures are destroyed. We do not bomb their homes. They are rebuilding.'); }
                  else if (!nothing) w.saidNothingToStrike = false;
              }
              // the enemy escalates on its own jittered clock
              if (w.t >= w.nextTierAt && enemyMayResearch(w.t) && w.enemyTier < TIERS.length - 1 && !w.enemyLeft) {
                  w.enemyTier++; w.nextTierAt = nextEnemyTierAt(w.t, warRand, w.enemyTier, w.tier - w.enemyTier);
                  logWar(`Intel: enemy has developed ${TIERS[w.enemyTier].id}.`, w.enemyTier > w.tier, { hold: w.enemyTier <= w.tier });
              }
              const raided = (w.raidUntil || 0) > w.t;          // our raiding party holds their defence down
              if (raided) w.enemyDefence = 0;
              else if (!silent) w.enemyDefence = Math.min(w.enemyDefence + ENEMY_DEFENCE_REGROW(w.tier) * defenceStandingK(standing), enemyDefenceCap(w.waveCount, w.tier) * defenceStandingK(standing));
              if (!raided && w.raidUntil && !w.saidRaidOver) { w.saidRaidOver = true; war.event('raidEnd'); logWar('Interior: the raiding party is back. Their defence is regrouping.', false, { hold: true }); }
              // waves, as long as the enemy is still here; every fifth is a push
              if (!silent && !w.enemyLeft && !w.pendingWave && w.t - w.lastWaveAt >= waveInterval(w.waveCount)) {
                  w.lastWaveAt = w.t; w.waveCount++;
                  const target = pickTarget(warPlates(), warRand);
                  if (target) {
                      // a push every fifth wave, and every third while we hold the lead
                      const push = isPush(w.waveCount, w.tier, w.enemyTier);
                      const size = Math.round(waveSize(w.waveCount) * waveStandingK(standing) * (push ? 2 : 1));
                      w.pendingWave = { targetId: target.id, size, launchAt: w.t + WAVE_WARNING_S, push, mode: waveMode(w.enemyTier, w.waveCount) };
                      const ti = gameState.buildings.findIndex(b => b && b.id === target.id);
                      const targetEl = ui.landGrid.children[ti]?.querySelector('.building');
                      if (w.radar && targetEl) targetEl.classList.add('targeted');
                      const skyward = isAirMode(w.pendingWave.mode);
                      // a salvo: the whistle falls toward the impact (the launch, then the arc)
                      if (skyward) war.event('shell', { impactIn: WAVE_WARNING_S + 1.4, col: ti % 5, defended: (w.air || 0) > 0 });
                      // A landing gathers on their pier while the radar watches; the boat casts off at launchAt.
                      if (!skyward) _ants?.musterLanding({ targetBuildingId: target.id, count: size, push });
                      if (w.radar && skyward) logWar(push ? `Intel: a large salvo is heading for ${target.b.type}.` : `Radar: a salvo is on its way to ${target.b.type}.`, push, { hold: !push });
                      else if (w.radar) logWar(push ? `Intel: a large force is gathering on their pier for ${target.b.type}.` : `Radar: a landing party is gathering on their pier.`, push, { hold: !push });
                  }
              }
              if (w.pendingWave && w.t >= w.pendingWave.launchAt) {
                  const { targetId, size } = w.pendingWave;
                  const mode = w.pendingWave.mode || TIERS[w.enemyTier].mode;
                  const launched = w.pendingWave;
                  w.pendingWave = null;
                  const b = gameState.buildings.find(x => x && x.id === targetId);
                  if (b && !b.razed) {
                      const enemy = TIERS[w.enemyTier];
                      const ti = gameState.buildings.findIndex(x => x && x.id === targetId);
                      const targetEl = ui.landGrid.children[ti]?.querySelector('.building');
                      targetEl?.classList.add('targeted');   // the plate under attack is marked as soon as they set out
                      // What you see is the rule: the share that falls on the way is what the
                      // defence that can reach it absorbs (guards on the ground, air defence in the sky).
                      const losses = landingLosses({ size, enemyTier: w.enemyTier, ourTier: w.tier, defence: w.defence, airDefence: w.air || 0, mode });
                      const impact = () => { targetEl?.classList.remove('targeted'); resolveWave(targetId, size, enemy, mode); };
                      // The first landing of the war is drawn out: the boat sails slowly and the blow waits a second.
                      const { push } = launched;
                      const first = !isAirMode(mode) && !w.firstLanding;
                      if (first) w.firstLanding = true;
                      const castOff = () => {
                          const ww = gameState.war; if (!ww?.active) return;
                          war.event('castOff', { col: ti % 5 });
                          if (ww.radar) logWar(`Radar: their boat has left the pier. ${size} ${enemy.id} heading for ${b.type}.`, push, { hold: !push });
                          else if (first) logWar('Status: their boat has left the pier. It is heading for us.', true);
                      };
                      if (_ants) {
                          const edge = _ants.launchWave({ targetBuildingId: targetId, count: size, mode, losses, onImpact: impact, push, first, onCastOff: castOff });
                          if (edge && edge !== 's' && !(w.hitEdges || []).includes(edge)) w.hitEdges = (w.hitEdges || []).concat([edge]);
                      } else impact();
                  } else _ants?.cancelLanding(targetId);   // the plate fell before they sailed: the party goes home
              }
              // food and land suffer: scorch cuts production, and the war room says so once
              const doom = doomsday(w.scorchOurs + w.scorchTheirs);
              climateTick(w, doom);      // first: on the tick doomsday passes 55 %, the climate speaks before the larders
              for (const [th, text] of [[15, 'Status: artillery is scarring the fields.'], [35, 'Status: wheat fields obliterated. Food is short.'], [55, 'Status: chemical weapons have struck our larders.'], [80, 'Status: the ground is poisoned. Little grows.']]) {
                  if (doom >= th && !(w.saidDoom || []).includes(th)) { w.saidDoom = (w.saidDoom || []).concat([th]); logWar(text, true, { hold: true }); }
              }
              if (gameState.supplies <= 0 && gameState.population > 0 && !(w.enemyLeft && w.leaveStage >= 2) && (w.t - (w.lastFoodWarn || -999)) > 60) { w.lastFoodWarn = w.t; logWar('Status: food storages critical. People are starving.', true); }
              // rebuilt enemy tiles
              (w.enemyRazedUntil || []).forEach((until, i) => { if (until && w.t >= until) w.enemyRazedUntil[i] = 0; });
              // The end comes from the clock, not from their island: when the
              // surface is nearly done (doomsday), they withdraw, launch, leave rubble.
              if (!w.enemyLeft && doom >= DOOMSDAY_LEAVE) {
                  w.enemyLeft = true; w.leaveStage = 0; w.leaveAt = w.t; w.endV = 2;
                  w.heldLines = [];                                  // the war is over: what waited is not said
                  logWar(w.intel ? 'Intel: the enemy is withdrawing all forces to a launch site.' : 'Status: the enemy is withdrawing all forces to a launch site.', true);
                  const rocket = ui.competitorIsland.querySelector('.enemy-rocket');
                  ui.competitorIsland.classList.add('enemy-launch');
                  if (_ants && rocket) _ants.withdraw(rocket, () => { w.leaveStage = Math.max(w.leaveStage, 1); w.leaveAt = w.t; });
                  else { w.leaveStage = 1; }
              }
              if (w.enemyLeft) leaveTick(w);
              // Their rocket is underway long before they leave: from doomsday
              // ROCKET_FROM the tile stands on their island, its ring filling
              // until DOOMSDAY_LEAVE.
              if (!w.enemyLeft) {
                  const building = doom >= ROCKET_FROM;
                  ui.competitorIsland.classList.toggle('enemy-rocket-building', building);
                  if (building) {
                      rocketRing.style.strokeDashoffset = String(113 - 113 * Math.min(1, (doom - ROCKET_FROM) / (DOOMSDAY_LEAVE - ROCKET_FROM)));
                      w.saidRocket = true;          // the climate lines tell it now (climateTick), the vast ship last
                  }
              } else ui.competitorIsland.classList.remove('enemy-rocket-building');
              // The quartermaster only buys, at the stance ratio, and keeps
              // QM_KEEP_S seconds of arms in the yard for you. It never strikes.
              const stance = w.stance || 'balanced';
              if (w.autoBought && stance !== 'off') {
                  const budget = quartermasterBudget(w.arms, armsPerSecond(w.tier) * w.armsShare);
                  const buy = autoBuy(budget, w.defence, w.force, UNIT_COST, stance, { on: isShown(w, 'air'), units: w.air || 0 });
                  w.arms -= (buy.defence + buy.force) * UNIT_COST + buy.air * AIR_UNIT_COST;
                  w.defence += buy.defence; w.force += buy.force; w.air = (w.air || 0) + buy.air;
              }
              // Auto strike (its own toggle, off by default): only when the force
              // can take the toughest tile still standing, never into a wall.
              if (w.autoStrike && isShown(w, 'autoStrike') && !w.enemyLeft && w.force > 0) {
                  const up = (w.enemyRazedUntil || []).map((until, i) => ({ until, i })).filter(t => !(t.until > 0));
                  const hardest = up.length ? Math.max(...up.map(({ i }) => w.enemyTileHp?.[i] ?? ENEMY_TILE_HP)) : 0;
                  if (hardest > 0 && canRazeTile(w.force, w.tier, w.enemyTier, w.enemyDefence, hardest)) tryStrike();
              }
              // One control at a time, teased grey until it can be afforded.
              // After the first landing has struck, three seconds of nothing new (revealHoldUntil).
              const opened = w.t >= (w.revealHoldUntil || 0) && !climateFresh(w) ? revealNext(w) : null;
              if (opened) {
                  if (REVEAL_LINES[opened]) logWar(REVEAL_LINES[opened]);
                  if (opened === 'fort') {
                      gameState.buildings.forEach((b, i) => { if (b) renderGridSlot(i); });
                      ui.landGrid.querySelectorAll('.fort-btn').forEach(btn => arrive(btn));
                  }
              }
              // The first minute: if nothing is coming out of the factory, the slider says so, once.
              if (!w.sliderPulsed && w.t >= 6 && w.t <= 60 && w.arms < UNIT_COST && w.defence + w.force === 0) {
                  w.sliderPulsed = true;
                  const row = ui.armsSlider.parentElement;
                  row.classList.remove('pulse-once'); void row.offsetWidth; row.classList.add('pulse-once');
              }
              war.set(warSoundState(w, doom));
          }
          /** What the war's sound needs from the war, once a second (src/audio-war.js). */
          function warSoundState(w, doom) {
              const silentNow = (5 - (w.enemyRazedUntil || []).filter(x => x > 0).length) === 0 && !w.enemyLeft;
              const p = w.pendingWave;
              const nextLandingIn = w.enemyLeft || silentNow ? null
                  : p ? Math.max(0, p.launchAt - w.t)
                  : Math.max(0, waveInterval(w.waveCount) - (w.t - w.lastWaveAt)) + WAVE_WARNING_S;
              const ti = p ? gameState.buildings.findIndex(b => b && b.id === p.targetId) : -1;
              return {
                  nextLandingIn, interval: waveInterval(w.waveCount),
                  push: p ? !!p.push : isPush(w.waveCount + 1, w.tier, w.enemyTier),
                  col: ti >= 0 ? ti % 5 : null,
                  lead: w.tier - w.enemyTier,
                  plates: gameState.buildings.map(b => (b ? !b.razed : null)),
                  armsShare: w.armsShare, population: popLevel(gameState.population), doomsday: doom,
                  enemyTier: w.enemyTier, radar: !!w.radar, airDefence: w.air || 0,
                  raidLeft: Math.max(0, (w.raidUntil || 0) - w.t), silentIsland: silentNow,
                  rocket: Math.max(0, Math.min(1, (doom - SOUND_ROCKET_FROM) / (DOOMSDAY_LEAVE - SOUND_ROCKET_FROM))),
                  units: (w.defence || 0) + (w.force || 0) + (w.air || 0), landings: w.landings || 0, shown: { ...(w.shown || {}) },
                  leaveStage: w.enemyLeft ? (w.leaveStage || 0) : -1,
              };
          }
          /**
           * The end of the war, said slowly (v1.70.0, B208). From doomsday 55 %
           * (the rocket's first ring) the war room speaks of the climate, one line
           * at a time, CLIMATE_GAP_S apart at least and each a few points of
           * doomsday later than the one before; while a line is fresh the
           * background lines wait (logWar `hold`), then come out one a second.
           */
          function climateTick(w, doom) {
              if (!climateFresh(w) && w.heldLines?.length) {
                  const next = w.heldLines.shift();
                  if (!next.text.startsWith('Radar:')) { logWar(next.text, next.grim); w.releasedAt = w.t; }   // a radar call that waited is stale: the instrument has it
              }
              if (w.enemyLeft || doom < CLIMATE_FROM) return;
              const i = w.climateSaid || 0;
              if (i >= 4 || doom < CLIMATE_FROM + i * CLIMATE_STEP) return;
              if (w.climateAt !== undefined && w.t - w.climateAt < CLIMATE_GAP_S) return;
              if (w.heldLines?.length || w.t - (w.releasedAt ?? -999) < CLIMATE_CLEAR_S) return;   // what waited comes out first, then a breath
              const lines = ['Status: the enemy is being destroyed. So is the climate.', 'Status: frigid winds sweep the surface of the earth.', 'Status: the lands are becoming less fertile.',
                  w.intel ? 'Intel: the enemy is building a vast spaceship.' : 'Status: something vast is being built on their island.'];
              w.climateSaid = i + 1;
              logWar(lines[i], true);
              w.climateAt = w.t;
          }
          /**
           * The leaving, stage by stage, on the war's own clock (w.t, w.leaveAt),
           * so a reload resumes where it was. 0 withdraw → 1 ignition (5 s) →
           * 2 lift-off → 3 rubble, the scientists → 4 the resources → 5 the plan →
           * 6 "Go deep." and the facility → 7 the shovel. The sound reads
           * leaveStage (audio-war.js: 0 leave, 1 launch, 2 and up the drone).
           */
          function leaveTick(w) {
              // A save from before v1.70.0 said everything at stage 3: it is at the shovel.
              if (!w.endV) { w.endV = 2; if (w.leaveStage >= 3) { w.leaveStage = LEAVE_SHOVEL; w.leaveAt = w.t; } }
              const since = w.t - w.leaveAt;
              const next = (stage) => { w.leaveStage = stage; w.leaveAt = w.t; };
              if (w.leaveStage === 0 && since > 25) next(1);
              else if (w.leaveStage === 1 && since >= 5) { next(2); ui.competitorIsland.classList.add('enemy-left'); }
              else if (w.leaveStage === 2 && since >= 13) {
                  next(3);
                  ui.competitorIsland.classList.remove('enemy-launch', 'enemy-ignite'); ui.competitorIsland.classList.add('enemy-rubble');
                  logWar('Our scientists have declared the surface uninhabitable for life. The enemy has left for space.', true);
              } else if (w.leaveStage === 3 && since >= 10) { next(4); logWar('We have not had the resources to do the same.'); }
              else if (w.leaveStage === 4 && since >= 8) { next(5); logWar('But a few have a secret plan.'); }
              else if (w.leaveStage === 5 && since >= 6) { next(6); logWar('Go deep.'); placeFacility(true); }
              else if (w.leaveStage === 6 && since >= 6) next(LEAVE_SHOVEL);
              if (w.leaveStage >= 1 && w.leaveStage < 3) ui.competitorIsland.classList.add('enemy-ignite');
              if (w.leaveStage >= LEAVE_SHOVEL && w.salvage >= SHIP_SALVAGE && !w.shipReady) w.shipReady = true;
          }
          /**
           * The facility (B209): the plate everyone walks into at the end is the
           * building that stands above ground in chapter IV, seen from above: a
           * light plate, the round hatch with its bar, a little mast with a glowing
           * tube, an exhaust with smoke. It arrives with "Go deep." (the plate
           * changes over two seconds) and stays through a reload; the plate's own
           * render (renderGridSlot) wipes the slot, so it is put back when missing.
           */
          function hatchSlot() { const slots = ui.landGrid.children; return slots[slots.length - 1] || null; }
          function placeFacility(arriving = false) {
              const slot = hatchSlot(); if (!slot) return;
              slot.classList.add('deep-hatch');
              if (slot.querySelector('.deep-facility')) return;
              const f = document.createElement('div');
              f.className = `deep-facility${arriving ? ' arriving' : ''}`;
              f.setAttribute('aria-hidden', 'true');
              f.innerHTML = '<span class="df-hatch"><span class="df-bar"></span></span><span class="df-mast"></span><span class="df-tube"></span>'
                  + '<span class="df-exhaust"><span class="df-puff"></span><span class="df-puff"></span><span class="df-puff"></span></span>';
              slot.appendChild(f);
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
              air: 'Interior: air defence can be built (twice the price of a guard). Guards still stop what walks ashore.',
          };
          const ROCKET_FROM = 55;
          const CLIMATE_FROM = ROCKET_FROM;      // the climate lines start with the rocket
          const CLIMATE_STEP = 6;                // doomsday points between two of them, at least
          const CLIMATE_GAP_S = 24;              // seconds between two of them, at least
          const CLIMATE_FRESH_S = 20;            // seconds a climate line stands alone
          const CLIMATE_CLEAR_S = 6;             // seconds after the last line that waited, before the next climate line
          const LEAVE_SHOVEL = 7;                // the leave stage at which the shovel arrives

          /**
           * A landing resolves when the survivors reach the plate. `size` is the
           * wave as launched; the dots that fell on the way are the units our
           * defence absorbed (the visuals were scripted from the same rule).
           * Weapons are relative (war.js): what decides it is who is ahead.
           */
          function resolveWave(targetId, size, enemy, mode = enemy.mode) {
              const w = gameState.war; if (!w?.active) return;
              const i = gameState.buildings.findIndex(b => b && b.id === targetId);
              const b = gameState.buildings[i];
              w.landings = (w.landings || 0) + 1;
              if (w.landings === 1) w.revealHoldUntil = w.t + 3;
              war.event('landing', { col: i % 5, air: isAirMode(mode) });
              if (w.enemyTier === TIERS.length - 1 && !w.nukeHeard) { w.nukeHeard = true; war.event('nuke'); }
              if (!b || b.razed) return;
              const hp = b.hp ?? plateMaxHp(b.type, b.fort || 0);
              const ratio = relativePower(w.enemyTier, w.tier);
              const air = isAirMode(mode);
              const r = resolveLanding({ size, enemyTier: w.enemyTier, ourTier: w.tier, defence: w.defence, airDefence: w.air || 0, hp, mode });
              const fallen = Math.min(size, Math.round(r.absorbed / ratio));
              const reached = size - fallen;
              w.defence = Math.max(0, w.defence - r.defenceLost);
              w.air = Math.max(0, (w.air || 0) - r.airLost);
              b.hp = r.hpLeft;
              w.scorchOurs += enemy.scorch;
              if (air && !w.airSeen) {
                  w.airSeen = true;
                  logWar('Status: their shells go over our guards. We need something that reaches the sky.', true);
              }
              if (mode === 'area') { gameState.supplies = Math.max(0, gameState.supplies * 0.8); logWar('Status: their strike hit our stores. Food lost.', true); }
              const story = air
                  ? `${size} ${enemy.id} came through the air; ${fallen} shot down, ${reached} hit ${b.type}`
                  : `${size} ${enemy.id} landed; ${fallen} fell to our defence, ${reached} reached ${b.type}`;
              const lost = [r.defenceLost > 0 ? `${r.defenceLost} guards` : '', r.airLost > 0 ? `${r.airLost} air defence` : ''].filter(Boolean).join(' and ');
              const cost = lost ? ` We lost ${lost}.` : '';
              if (r.razed) {
                  b.razed = true; b.population = 0; b.fort = 0; b.hp = 0;
                  war.event('razed', { district: b.type === 'district' });
                  w.scorchOurs += enemy.scorch * 4;
                  renderGridSlot(i);
                  logWar(`Status: ${story} and razed it.${cost}`, true);
                  if (b.type === 'armory') logWar('Status: the armory is lost. Our soldiers have nowhere to gather.', true);
              } else {
                  logWar(`Status: ${story}. It stands, HP ${Math.round(b.hp)}/${plateMaxHp(b.type, b.fort || 0)}.${cost}`, false, { hold: true });
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
              if (!visible.length) return false;      // nothing military standing: the war room says so (warTick)
              const pickIdx = visible[Math.floor(Math.random() * visible.length)].i;
              const force = w.force, ourTier = w.tier, tier = TIERS[w.tier];
              const strikeRatio = relativePower(w.tier, w.enemyTier), enemyDefence0 = w.enemyDefence;
              const losses = Math.min(1, Math.min(force * strikeRatio, enemyDefence0) / (force * strikeRatio));
              w.force = 0; // released
              w.strikes = (w.strikes || 0) + 1;
              let byBoat = false, coming = 0;
              const impact = () => {
                  const ww = gameState.war; if (!ww?.active) return 0;
                  const hp = ww.enemyTileHp?.[pickIdx] ?? ENEMY_TILE_HP;
                  const enemyDefenceAtImpact = ww.enemyDefence;
                  const r = resolveOurStrike({ force, ourTier, enemyTier: ww.enemyTier, enemyDefence: ww.enemyDefence, tileHp: hp });
                  war.event('strike', { at: 'impact' });
                  if (r.razed) war.event('enemyRazed');
                  if (ourTier === TIERS.length - 1 && !ww.nukeHeard) { ww.nukeHeard = true; war.event('nuke'); }
                  ww.force += r.forceLeft; ww.enemyDefence = r.enemyDefenceLeft;
                  // by boat the survivors are still over there: the rule has them back, the counter waits
                  if (byBoat) { coming = r.forceLeft; forceAway += coming; }
                  ww.enemyTileHp = ww.enemyTileHp || [0, 0, 0, 0, 0].map(() => ENEMY_TILE_HP);
                  ww.enemyTileHp[pickIdx] = r.tileHpLeft;
                  ww.scorchTheirs += tier.scorch * 3;
                  const names = ['tower', 'radar', 'shipyard', 'barracks', 'factory'];   // enemyTileEls() in DOM order (index.html)
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
                  return force > 0 ? r.forceLeft / force : 0;     // the share that sails home
              };
              const home = () => {
                  forceAway = Math.max(0, forceAway - coming); coming = 0;
                  updateAllUI();
              };
              // the tear when our force sets out (by boat: when it casts off)
              const onPhase = (phase) => { if (phase === 'castOff') war.event('strike', { at: 'castOff' }); };
              if (_ants) byBoat = _ants.launchStrike({ tileIndex: pickIdx, count: force, mode: tier.mode, losses, onImpact: impact, onHome: home, onPhase }) === 'boat';
              else { onPhase('castOff'); impact(); }
              updateAllUI();
              return true;
          }

          function updateWarUI() {
              const w = gameState.war;
              const active = !!w?.active;
              [ui.buyDefenceBtn, ui.buyForceBtn].forEach(btn => btn.classList.toggle('hidden', !active));
              // Controls that open during the war arrive with the same pop as the swords (showBtn → arrive)
              showBtn(ui.strikeBtn, active && isShown(w, 'strike'));
              showBtn(ui.tierBtn, active && isShown(w, 'tier'));
              showBtn(ui.autoStrikeBtn, active && isShown(w, 'autoStrike') && !w.enemyLeft);
              if (!active) { ui.autoBtn.classList.add('hidden'); ui.radarBtn.classList.add('hidden'); ui.intelBtn.classList.add('hidden'); ui.raidBtn.classList.add('hidden'); }
              // the shovel arrives only after "Go deep." has stood six seconds (leave stage 7)
              showBtn(ui.shipBtn, active && w.enemyLeft && (w.leaveStage || 0) >= LEAVE_SHOVEL);
              if (!active) return;
              if (w.enemyLeft && w.leaveStage >= 6) placeFacility();
              const tier = TIERS[w.tier];
              {
                  // the armory's badge: the soldiers stationed (guards and the force at home)
                  const i = gameState.buildings.findIndex(b => b && b.type === 'armory' && !b.razed);
                  const badge = i >= 0 ? ui.landGrid.children[i]?.querySelector('.armory-count') : null;
                  if (badge) {
                      const n = Math.round((w.defence || 0) + Math.max(0, (w.force || 0) - forceAway));
                      badge.textContent = formatCount(n);
                      badge.classList.toggle('hidden', n <= 0);
                  }
              }
              ui.warDefence.textContent = Math.round(w.defence).toLocaleString('en-US');
              const airOpen = isShown(w, 'air');
              ui.warAirRow.classList.toggle('hidden', !airOpen);
              ui.warAir.textContent = Math.round(w.air || 0).toLocaleString('en-US');
              showBtn(ui.buyAirBtn, airOpen);
              ui.buyAirBtn.disabled = w.arms < AIR_UNIT_COST;
              {
                  const n = Math.max(1, Math.floor(w.arms * 0.1 / AIR_UNIT_COST));
                  setTooltip(ui.buyAirBtn, { effect: `+${n} <i data-lucide='shield-half' class='w-4 h-4'></i> <span class='tip-note'>stops shells</span>`, armsCost: n * AIR_UNIT_COST });
              }
              ui.warForce.textContent = Math.round(Math.max(0, w.force - forceAway)).toLocaleString('en-US');
              ui.warArms.textContent = Math.floor(w.arms).toLocaleString('en-US');
              ui.warArmsRate.textContent = `+${(armsPerSecond(w.tier) * w.armsShare).toFixed(0)}/s`;
              ui.warTier.textContent = `${tier.numeral} ${tier.id}`;
              ui.warEnemyTier.textContent = w.intel ? `${TIERS[w.enemyTier].numeral} ${TIERS[w.enemyTier].id}` : '?';
              showBtn(ui.intelBtn, active && !w.intel && isShown(w, 'intel'));
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
              showBtn(ui.autoBtn, active && isShown(w, 'auto'));
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
              showBtn(ui.raidBtn, active && !w.enemyLeft && isShown(w, 'raid'));
              ui.raidBtn.disabled = raidLeft > 0 || w.arms < raidCost(w.raids || 0);
              ui.raidBtn.classList.toggle('active-raid', raidLeft > 0);
              setTooltip(ui.raidBtn, raidLeft > 0 ? { effect: `<i data-lucide='venetian-mask' class='w-4 h-4'></i> ${raidLeft} s` } : { effect: `<i data-lucide='venetian-mask' class='w-4 h-4'></i> their <i data-lucide='shield' class='w-4 h-4'></i> → 0 for ${RAID_S} s`, armsCost: raidCost(w.raids || 0) });
              // Radar: a purchase, then an instrument: the badge counts down to the next landing,
              // the tooltip says how big it is and where it is heading once it is spotted.
              showBtn(ui.radarBtn, active && !w.enemyLeft && isShown(w, 'radar'));
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
                      : p ? { effect: `${p.size} ${TIERS[w.enemyTier].id} ${isAirMode(p.mode) ? `<i data-lucide='shield-half' class='w-4 h-4'></i>` : `<i data-lucide='shield' class='w-4 h-4'></i>`} → ${heading || '?'} in ${next} s` }
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
                  ? { unlockReq: `<i data-lucide='factory' class='w-4 h-4'></i> military structures destroyed` }
                  : { effect: `${Math.round(w.force)} <i data-lucide='swords' class='w-4 h-4'></i> ${w.intel ? `→ ${Math.round(w.force * relativePower(w.tier, w.enemyTier)).toLocaleString('en-US')} <i data-lucide='flame' class='w-4 h-4'></i> ` : ''}${canRaze ? '✓' : '×'}` });
              setTooltip(ui.tierBtn, nextCost === null ? { effect: tier.numeral } : (cooling ? { unlockReq: `${TIERS[w.tier + 1].numeral} · ${Math.max(0, TIER_COOLDOWN_S - ((w.t || 0) - (w.lastTierAt ?? 0)))} s` } : { effect: `${TIERS[w.tier + 1].numeral} · ${TIERS[w.tier + 1].id}`, scienceCost: nextCost }));
              // like the buttons before it, the shovel never says the act changes (v1.88.0)
              setTooltip(ui.shipBtn, w.shipReady ? { effect: 'GO DEEP' } : { unlockReq: `${SHIP_SALVAGE.toLocaleString('en-US')} ▾` });
              // enemy tiles: razed ones dim until rebuilt
              enemyTileEls().forEach((el, i) => el.classList.toggle('enemy-razed', (w.enemyRazedUntil?.[i] || 0) > 0));
          }

          window.debug_war = (what, arg) => {
              if (what === 'start') { if (!gameState.competitorSpawned) { gameState.competitorSpawned = true; gameState.competitorSpawnedAt = Date.now() - 300000; gameState.competitorStage = 5; } startWar(); return; }
              const w = gameState.war; if (!w?.active) return;
              if (what === 'arms') w.arms += 1000;
              if (what === 'tier') w.tier = Math.min(TIERS.length - 1, w.tier + 1);
              if (what === 'etier') w.enemyTier = Math.min(TIERS.length - 1, w.enemyTier + 1);
              if (what === 'wave') w.lastWaveAt = -999;
              if (what === 'leave') w.scorchTheirs += 2500 * 2.5;
              if (what === 'salvage') w.salvage += 2000;
              if (what === 'stage') w.leaveAt = -999;
              // doomsday to `arg` % (the climate lines), raze all five of their military tiles, read the state
              if (what === 'doom') { while (doomsday(w.scorchOurs + w.scorchTheirs) < (arg ?? 55)) w.scorchTheirs += 5; }
              if (what === 'raze') w.enemyRazedUntil = w.enemyRazedUntil.map(() => w.t + ENEMY_REBUILD_S);
              if (what === 'state') return w;
              updateAllUI();
          };
          /** Testing: the INTERIM from any point of the war (the way down chosen, no walk). */
          window.debug_interim = () => {
              if (_deepStarting) return;
              gameState.shipChosen = true;
              if (gameState.war) gameState.war.goingDown = true;
              saveGameState();
              savingEnabled = false;
              clearInterval(logicInterval); clearInterval(fastUiInterval);
              city.stop(); war.stop();
              goDeep();
          };
          /** Everything chapter II sells has been bought. */
          function cityComplete() {
              return !!(gameState.apartmentResearched && gameState.storeResearched && gameState.greenhouseResearched && gameState.toolCaseUnlocked &&
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
          let uiSettled = false;   // the first full UI pass is done: from here on, new buttons arrive

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
          /** A plate that was just built or upgraded settles in softly. */
          const settlePlate = (index) => ui.landGrid.children[index]?.querySelector('.building')?.classList.add('building-arrive');
          const refreshAllBuildingActions = () => renderer.refreshAllBuildingActions(gameState.buildings, gameState, initialLoadDone);

          // Ants: people and cars on the streets, the enemy on its island
          // Islands: our coast appears when the land is full, theirs with the competitor
          // Pads large enough that no plate hangs over the water (B191)
          const OUR_COAST = { pad: 48, points: 22, wobble: 0.3, seed: 11 };
          const THEIR_COAST = { pad: 50, points: 16, wobble: 0.3, seed: 5 };
          const enemyGridEl = () => ui.competitorIsland.querySelector('.enemy-grid') || ui.competitorIsland;
          _islands = {
              ours: createIsland({ svg: ui.islandsSvg, area: ui.cityArea, target: ui.landGrid, id: 'island-ours', shape: OUR_COAST }),
              enemy: createIsland({ svg: ui.islandsSvg, area: ui.cityArea, target: enemyGridEl(), id: 'island-enemy', shape: THEIR_COAST, rampart: true }),
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
              // They fortify: the coast hardens to a rampart at stage 3, wider at 4
              const stage = gameState.competitorSpawned ? (gameState.competitorStage || 1) : 0;
              _islands.enemy.setRampart(stage >= 4 ? 2 : stage >= 3 ? 1 : 0);
          }

          // Debug hook: rpiAnts.step(0.05) advances by 50 ms when the loop is idle
          window.rpiAnts = _ants = createAnts({
              canvas: ui.antsCanvas,
              area: ui.cityArea,
              getSlots: () => gameState.buildings.map((b, i) => ({ el: ui.landGrid.children[i], building: b })).filter(s => s.el),
              getEnemyTiles: () => ui.competitorIsland.classList.contains('visible')
                  ? [...ui.competitorIsland.querySelectorAll('.enemy-factory, .enemy-tile')].filter(el => getComputedStyle(el).opacity !== '0')
                  : [],
              getCivilTiles: () => ui.competitorIsland.classList.contains('visible')
                  ? [...ui.competitorIsland.querySelectorAll('.enemy-civil')].filter(el => getComputedStyle(el).opacity !== '0')
                  : [],
              getTown: () => ui.competitorIsland.querySelector('.enemy-grid'),
              getPier: () => ui.competitorIsland.querySelector('.enemy-pier'),
              getOurPier: () => (gameState.war?.active ? document.getElementById('our-pier') : null),
              getGap: () => parseFloat(getComputedStyle(ui.landGrid).columnGap) || 8,
              // the same coasts the islands draw: people stay on land (v1.70.0)
              getCoasts: () => ({
                  ours: coastPoints(layoutRect(ui.landGrid, ui.cityArea), OUR_COAST),
                  theirs: ui.competitorIsland.classList.contains('visible') ? coastPoints(layoutRect(enemyGridEl(), ui.cityArea), THEIR_COAST) : null,
              }),
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
                      sellBtn.textContent = `${formatCount(refund)}★`;
                      sellBtn.classList.add('sell-confirm');
                  }
                  const timeout = setTimeout(() => cancelPendingSell(buildingId), 3000);
                  _pendingSell.set(buildingId, { timeout, slot });
                  return;
              }

              // Second tap (touch) or any non-touch tap: execute sell
              cancelPendingSell(buildingId);
              city.word('sell');
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
                  settlePlate(index);
                  if (targetType === 'greenhouse') city.word('food');
                  else city.word('upgrade', { apartment: 1, superStore: 1, skyscraper: 2, district: 3 }[targetType] || 1);
              }
          }
          
          function addBuilding(type) {
              const index = gameState.buildings.findIndex(b => b === undefined);
              if (index !== -1 && gameState.stars >= buildingData[type].cost) {
                  gameState.stars -= buildingData[type].cost;
                  const newId = Date.now() + Math.random();
                  gameState.buildings[index] = { id: newId, type, population: 0, ...buildingData[type]};
                  renderGridSlot(index);
                  settlePlate(index);
                  city.word(type === 'home' ? 'home' : 'store');
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
                  if (cost) html += `<div class="cost"><span class="font-mono">${formatCount(cost)}</span><i data-lucide="star" class="w-4 h-4 text-slate-300"></i></div>`;
                  if (armsCost) html += `<div class="cost"><span class="font-mono">${formatCount(armsCost)}</span><i data-lucide="hammer" class="w-4 h-4 text-slate-300"></i></div>`;
                  if (scienceCost) html += `<div class="cost-science"><span class="font-mono">${formatCount(scienceCost)}</span><i data-lucide="atom" class="w-4 h-4 text-slate-300"></i></div>`;
              }
              tooltipEl.innerHTML = html;
              if (!tooltipListenersAttached.has(el)) {
                  el.addEventListener('mouseenter', () => { tooltipEl.style.setProperty('--tooltip-opacity', 1); clampTooltip(tooltipEl); }, { signal });
                  el.addEventListener('mouseleave', () => tooltipEl.style.setProperty('--tooltip-opacity', 0), { signal });
                  tooltipListenersAttached.add(el);
              }
          }
  
          /** Shows or hides a button; one that becomes visible during play arrives softly. */
          function showBtn(btn, show) {
              const wasHidden = btn.classList.contains('hidden');
              btn.classList.toggle('hidden', !show);
              if (show && wasHidden && uiSettled) arrive(btn);
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
                  { btn: ui.greenhouseResearchBtn, showAt: 2500, popReq: 5000, flag: 'greenhouseResearched', prereq: 'storeResearched' },
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
                  showBtn(btn, shouldShow && !isPurchased && !warOn);
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
              // In the war the column is full of war; home and store come back when there is land to rebuild on
              if (!gameState.storeShown && !_cityOpening && gameState.supplies < STORE_REVEAL_SUPPLIES) {
                  gameState.storeShown = true;
                  arrive(ui.buildStoreBtn);
              }
              ui.buildHomeBtn.classList.toggle('hidden', _cityOpening || (!!gameState.war?.active && !hasEmptySlot));
              ui.buildStoreBtn.classList.toggle('hidden', _cityOpening || !gameState.storeShown || (!!gameState.war?.active && !hasEmptySlot));
              ui.buildHomeBtn.disabled = !canAfford(buildingData.home) || !hasEmptySlot;
              ui.buildStoreBtn.disabled = !canAfford(buildingData.store) || !hasEmptySlot;
  
              // Disabled state for global upgrades
              ui.toolCaseUpgradeBtn.disabled = !canAfford(buildingData.toolCaseUpgrade) || pop < 50 || gameState.toolCaseUnlocked;
              ui.apartmentResearchBtn.disabled = !canAfford(buildingData.apartmentResearch) || pop < 30 || gameState.apartmentResearched;
              ui.storeResearchBtn.disabled = !canAfford(buildingData.storeResearch) || pop < 50 || gameState.storeResearched;
              ui.urbanismResearchBtn.disabled = !canAfford(buildingData.urbanismResearch) || pop < 200 || gameState.urbanismResearched;
              ui.megastructureResearchBtn.disabled = !canAfford(buildingData.megastructureResearch) || pop < 5000 || gameState.megastructureResearched;
              ui.greenhouseResearchBtn.disabled = !canAfford(buildingData.greenhouseResearch) || pop < 5000 || gameState.greenhouseResearched;
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
              showBtn(ui.buildStallBtn, pop >= 5 || gameState.stalls > 0);
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

              setTooltip(ui.greenhouseResearchBtn, pop < 5000 && !gameState.greenhouseResearched ? { unlockReq: `5000 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `<i data-lucide='shopping-cart' class='w-4 h-4'></i> → <i data-lucide='sprout' class='w-4 h-4'></i> ×5 <i data-lucide='shopping-basket' class='w-4 h-4'></i>`, cost: buildingData.greenhouseResearch.cost, scienceCost: buildingData.greenhouseResearch.scienceCost });
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
                  if (b.type === 'store' || b.type === 'superStore' || b.type === 'greenhouse') {
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
                  const units = (w.defence || 0) + (w.force || 0) + (w.air || 0);
                  netStarChange = netStarChange * (1 - w.armsShare) - netStarChange * UPKEEP_SHARE_PER_UNIT * units;
                  gameState.netStarChangePerSecond = netStarChange;
              }
              if (!skipGrowth) {
                  const stars0 = gameState.stars, science0 = gameState.science;
                  gameState.stars = Math.max(0, gameState.stars + netStarChange);
                  gameState.science = Math.max(0, gameState.science + netScienceChange);
                  _starsStep = gameState.stars - stars0;
                  _scienceStep = gameState.science - science0;
                  _stepAt = performance.now();
              }

              const troops = gameState.war?.active ? ((gameState.war.defence || 0) + (gameState.war.force || 0) + (gameState.war.air || 0)) * FOOD_PER_UNIT : 0;
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
                  city.word('rivalArrives');                         // wow, a neighbour
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
              placeOurPier();
              _ants?.setState({
                  population: gameState.population,
                  carUnlocked: !!gameState.carUnlocked,
                  enemyStage: gameState.competitorSpawned ? (gameState.competitorStage || 1) : 0,
                  enemyTicks: gameState.competitorTicks || 0,
                  ourTier: gameState.war?.tier || 0,
                  enemyTier: gameState.war?.enemyTier || 0,
                  defence: gameState.war?.defence || 0,
                  airDefence: gameState.war?.air || 0,
                  guardsOff: !!gameState.war?.enemyLeft || !!gameState.shipChosen,
                  enemiesGone: !enemiesRemain(gameState.war),   // B219: after they left, a reload brings no walkers back
                  hitEdges: gameState.war?.hitEdges || [],
                  war: !!gameState.war?.active,
                  armoryId: armoryStanding()?.id ?? null,
              });

              // Raids. The competitor waits until our city is complete (everything
              // bought) and its shipyard stands (stage 5: pier and boat), then comes by boat,
              // razes one outer house, sails home, and comes back every
              // RAID_INTERVAL until the player chooses WAR. (WAR_POP is only a
              // safety net.) We are defenceless; the swords arrive only after the
              // boat has gone and a beat of nothing (Ola 2026-10-02).
              const capitalReady = gameState.competitorSpawned && (gameState.competitorStage || 1) >= 5;   // no boat before the shipyard
              const complete = cityComplete() || gameState.population >= WAR_POP * 4;
              if (complete && !skipGrowth) gameState.completeTicks = (gameState.completeTicks || 0) + 1;
              const ready = capitalReady && !gameState.warChosen && !gameState.war?.active && complete && (gameState.completeTicks || 0) >= 30;
              const sinceRaid = Date.now() - (gameState.lastRaidAt || 0);
              if (ready && _ants && !_ants.raiding() && sinceRaid >= RAID_INTERVAL_MS) {
                  const onRazed = (building) => {
                      if (building) { building.razed = true; building.population = 0; }
                      saveGameState();
                      updateAllUI();
                  };
                  const onOver = () => {
                      if (gameState.warReady || gameState.warChosen || signal.aborted) return;
                      setTimeout(() => {
                          if (signal.aborted || gameState.warChosen) return;
                          gameState.warReady = true;
                          saveGameState();
                          updateAllUI();
                          arrive(ui.warBtn);
                      }, 4000);
                  };
                  if (_ants.startAttack(onRazed, onOver, (phase) => city.raid(phase))) gameState.lastRaidAt = Date.now();
              }

              if (!skipGrowth) warTick();
              updateAllUI();
              // The city's sound follows the numbers (src/audio-city.js)
              const tallest = gameState.buildings.reduce((m, b) => Math.max(m, b ? ({ apartment: 1, superStore: 1, skyscraper: 2, district: 3 }[b.type] || 0) : 0), 0);
              const starvedNow = gameState.supplies <= 0 && gameState.population > 0;
              city.set({
                  pop: popLevel(gameState.population), tier: tallest,
                  food: starvedNow ? 0 : Math.max(0.05, siloFraction(gameState.supplies, gameState.cachedSupplyConsumption || 0)),
                  research: gameState.populationAllocation, rival: gameState.competitorSpawned ? (gameState.competitorStage || 1) : 0,
                  cars: !!gameState.carUnlocked, computers: !!gameState.computerUnlocked,
              });
              if (starvedNow && !_starvedSaid) { _starvedSaid = true; audio.knock(); }   // the stop cue, once per hunger
              if (!starvedNow) _starvedSaid = false;
              saveGameState();
          }
  
          /** A counter: short form in the text, the whole number in the title (hover). */
          function showCount(el, value) {
              const n = Math.round(value);
              if (el.dataset.n === String(n)) return;
              el.dataset.n = String(n);
              el.textContent = formatCount(n);
              el.title = n.toLocaleString('en-US');
          }
          const perPerson = (v) => (v >= 1000 ? formatCount(v) : v.toFixed(1));
          function fastUiTick() {
              counter('p2:fastUiTick');
              timed('p2:fastUiTick', _fastUiTickBody);
          }
          function _fastUiTickBody() {
              // Smooth counter rolling: lerp toward actual values for a "spinning numbers" effect
              const left = 1 - Math.min(1, (performance.now() - _stepAt) / 1000);   // of the current second
              const starsNow = Math.max(0, gameState.stars - _starsStep * left);
              const scienceNow = Math.max(0, gameState.science - _scienceStep * left);
              _displayedStars += (starsNow - _displayedStars) * COUNTER_LERP;
              _displayedScience += (scienceNow - _displayedScience) * COUNTER_LERP;
              if (Math.abs(starsNow - _displayedStars) < 0.5) _displayedStars = starsNow;
              if (Math.abs(scienceNow - _displayedScience) < 0.5) _displayedScience = scienceNow;
              // Astronomical, but readable: 1.90 T, the full number on hover
              showCount(ui.starCount, _displayedStars);
              showCount(ui.scienceCount, _displayedScience);
              ui.populationCountTotal.textContent = gameState.population.toLocaleString('en-US');
              const capacity = gameState.buildings.reduce((a, b) => a + ((b && !b.razed && b.capacity) ? b.capacity : 0), 0);
              ui.populationCapacity.textContent = capacity > 0 ? `${capacity.toLocaleString('en-US')} ◻` : '';

              ui.netStarChange.textContent = `${(gameState.netStarChangePerSecond || 0) >= 0 ? '+' : ''}${formatCount(gameState.netStarChangePerSecond || 0)}/s`;
              ui.netStarChange.style.color = (gameState.netStarChangePerSecond || 0) >= 0 ? '#64748b' : '#94a3b8';
              ui.netScienceChange.textContent = `+${formatCount(gameState.netScienceChangePerSecond || 0)}/s`;

              const baseStarPerPerson = calculateBaseStarPerPerson();
              const w2 = gameState.war;
              const doomK = w2?.active ? scorchYield(doomsday(w2.scorchOurs + w2.scorchTheirs)) : 1;
              ui.starsPerPerson.textContent = doomK < 0.995
                  ? `${perPerson(baseStarPerPerson * doomK)} /person · scorched −${Math.round((1 - doomK) * 100)} %`
                  : `${perPerson(baseStarPerPerson)} /person`;

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
                      if (w.arms >= cost) { w.arms -= cost; b.fort = (b.fort || 0) + 1; b.hp = plateMaxHp(b.type, b.fort); war.event('fortify'); renderGridSlot(i); logWar(`Interior: ${b.type} fortified and repaired. HP ${b.hp}.`); updateAllUI(); }
                      else flashArms();
                  }
                  return;
              }
              const clearBtn = e.target.closest('.clear-btn');
              if (clearBtn) {
                  const id = Number(clearBtn.dataset.buildingId);
                  const i = gameState.buildings.findIndex(b => b && b.id === id); const b = gameState.buildings[i];
                  if (b && b.razed && b.type === 'armory') {
                      // cleared, the armory stands again (not what stood there before it)
                      const cost = armoryClearCost(b);
                      if (gameState.stars >= cost) {
                          gameState.stars -= cost; Object.assign(b, { razed: false, fort: 0, hp: plateMaxHp('armory', 0) });
                          renderGridSlot(i); popArmory(); logWar('Interior: the armory stands again. Our soldiers gather there.'); logicTick(true); updateAllUI();
                      }
                  } else if (b && b.razed) {
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
              city.stop();
              // The chapter turns, but the game goes on: the war is played on this map.
              // Slow and dark: black, then III, then WAR; a click or 5 s ends it; a beat; the camera lowers.
              // Drawn out like the card for II: black, a rest, III, a rest, WAR, the hold.
              // The sound is the set piece in audio-city.js (everything falls away, one
              // C sharp hangs, three strokes for III, the boom on WAR), timed to the card.
              const marks = { III: 3.4, WAR: 5.9, LIFT: 13.6 };
              const sounded = city.war(marks);
              // their drum alone and our bass: the war's own music takes over as the set piece's bass fades
              setTimeout(() => { if (!signal.aborted && gameState.war?.active && !gameState.shipChosen) war.start(); }, handoverAt(marks) * 1000);
              playChapterCard({ roman: 'III', title: 'WAR', dark: true, slow: true, pause: 1400, hold: 5000, silent: sounded, onMidpoint: () => startWar() })
                  .then(() => { popArmory(); setTimeout(() => document.body.classList.add('tilt'), 1500); });
          }, { signal });
          /** One click buys a tenth of your arms' worth of units (at least one). */
          const batchSize = (arms) => Math.max(1, Math.floor(arms * 0.1 / UNIT_COST));
          ui.buyDefenceBtn.addEventListener('click', () => { const w = gameState.war; if (!w?.active) return; if (w.arms < UNIT_COST) { war.event('noArms'); return; } const n = batchSize(w.arms); w.arms -= n * UNIT_COST; w.defence += n; war.event('buyShield'); updateAllUI(); }, { signal });
          ui.buyForceBtn.addEventListener('click', () => { const w = gameState.war; if (!w?.active) return; if (w.arms < UNIT_COST) { war.event('noArms'); return; } const n = batchSize(w.arms); w.arms -= n * UNIT_COST; w.force += n; war.event('buySword'); updateAllUI(); }, { signal });
          ui.buyAirBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active || !isShown(w, 'air')) return;
              if (w.arms < AIR_UNIT_COST) { flashArms(); return; }
              const n = Math.max(1, Math.floor(w.arms * 0.1 / AIR_UNIT_COST));
              w.arms -= n * AIR_UNIT_COST; w.air = (w.air || 0) + n; war.event('buyAir'); updateAllUI();
          }, { signal });
          /** Short of arms: the arms counter flashes, so the eye goes to where hammers come from. */
          function flashArms() {
              war.event('noArms');
              const row = ui.warArmsRow;
              row.classList.remove('flash-short'); void row.offsetWidth; row.classList.add('flash-short');
          }
          ui.intelBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active || w.intel) return;
              if (w.arms >= INTEL_COST) { w.arms -= INTEL_COST; w.intel = true; war.event('buy'); logWar(`Intel: office opened. The enemy fields ${TIERS[w.enemyTier].id}.`); updateAllUI(); }
          }, { signal });
          ui.raidBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active || w.enemyLeft || (w.raidUntil || 0) > w.t) return;
              const cost = raidCost(w.raids || 0);
              if (w.arms < cost) return;
              w.arms -= cost; w.raids = (w.raids || 0) + 1; w.raidUntil = w.t + RAID_S; w.saidRaidOver = false;
              w.enemyDefence = 0;
              war.event('raidStart', { seconds: RAID_S });
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
                  war.event('tier');
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
              if (w.arms >= RADAR_COST) { w.arms -= RADAR_COST; w.radar = true; war.event('buy'); logWar('Interior: radar online. Landings are marked before they arrive.'); updateAllUI(); }
          }, { signal });
          ui.autoBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.active) return;
              if (!w.autoBought) {
                  if (w.arms >= AUTO_COST) { w.arms -= AUTO_COST; war.event('buy'); w.autoBought = true; w.auto = true; w.stance = 'balanced'; logWar('Interior: a quartermaster now buys units for us. Set the stance.'); }
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
          ui.shipBtn.setAttribute('aria-label', 'Go deep');
          ui.shipBtn.addEventListener('click', () => {
              const w = gameState.war; if (!w?.shipReady || gameState.shipChosen || w.goingDown) return;
              // No gate (v1.88.0): the click is the choice. A reload from here goes straight down (load: shipChosen).
              w.goingDown = true;
              gameState.shipChosen = true;
              saveGameState();
              savingEnabled = false;
              if (logicInterval) clearInterval(logicInterval);
              goDownTogether();
          }, { signal });
          /**
           * GO DEEP (v1.88.0, Ola's playtest of the whole war: "everyone walks
           * down, but only 216 arrive"). The story says why: the shelter takes
           * only a few. The controls leave, the hatch opens, a chosen few (the
           * people who live highest) walk to it and go down one by one while
           * the war room says who they are; everyone else stands still and is
           * left behind; the hatch closes, a stillness, then the INTERIM card
           * (goDeep, v1.90.0). Runs once (w.goingDown); a click elsewhere does nothing
           * (#phase-city.going-deep); the card always comes (DOWN.fallbackS).
           * The steps are kept in window.rpiGoDeep (seconds after the click).
           */
          const DOWN = { hatchAt: 1.3, line1At: 1.7, walkAt: 2.3, line2At: 6.6, closeAfterLine2: 2.5, closeS: 1.2, stillS: 1.5, fallbackS: 25 };
          const DOWN_LINES = [
              'Status: the shelter takes only a few. The richest. The most successful.',
              'Status: they go down to wait until the earth can be lived on again.',
          ];
          function goDownTogether() {
              const t0 = performance.now();
              const since = () => (performance.now() - t0) / 1000;
              const steps = window.rpiGoDeep = [];
              const note = (what) => steps.push(`${since().toFixed(1)} s ${what}`);
              const later = (s, fn) => setTimeout(() => { if (!signal.aborted) fn(); }, Math.max(0, s) * 1000);
              ui.phaseCity.classList.add('going-deep');
              leaveControls(); note('the controls leave');
              placeFacility();
              const hatch = hatchSlot();
              const facility = hatch?.querySelector('.deep-facility');
              let carded = false;
              const card = (why) => {
                  if (carded) return;
                  carded = true;
                  note(`the card (${why})`);
                  ui.antsCanvas.classList.add('left-behind');      // the ones left behind dim as the card fades in
                  if (fastUiInterval) clearInterval(fastUiInterval);
                  city.stop();
                  // the INTERIM card takes the war's E flat and lets it fall to D
                  war.finale('fall');
                  war.stop();
                  goDeep();
              };
              let closing = false;
              const close = () => {
                  if (closing) return;
                  closing = true;
                  later(DOWN.line2At + DOWN.closeAfterLine2 - since(), () => {
                      facility?.classList.remove('open'); note('the hatch closes');
                      later(DOWN.closeS + DOWN.stillS, () => card('after the stillness'));
                  });
              };
              later(DOWN.hatchAt, () => { facility?.classList.add('open'); note('the hatch opens'); });
              later(DOWN.line1At, () => { logWar(DOWN_LINES[0]); note('line 1'); });
              later(DOWN.line2At, () => { logWar(DOWN_LINES[1]); note('line 2'); });
              later(DOWN.walkAt, () => {
                  if (!_ants || !hatch) { note('nobody to walk'); close(); return; }
                  _ants.gatherChosen(hatch, undefined, () => { note('the last one is down'); close(); });
                  const d = _ants._debug().chosen;
                  if (d) note(`the chosen walk: ${d.few} of ${d.few + d.left}, ${d.left} stay`);
              });
              later(DOWN.fallbackS, () => card('fallback'));
          }
          /** Every control, the plates' buttons and the war counters fade and slide away, one after another; the shovel last. The war room stays. */
          function leaveControls() {
              const shown = (el) => el && !el.classList.contains('hidden');
              const left = [...ui.warUi.children].filter(shown);
              const plates = [...ui.landGrid.querySelectorAll('.building-action-btn')].filter(shown);   // + ◆ × - on the plates
              const right = [...document.querySelectorAll('#buildings-container > .btn, #build-separator, #upgrades-container > .btn')]
                  .filter(el => shown(el) && el !== ui.shipBtn).reverse();
              const all = [...(shown(ui.warUi) ? left : []), ...(shown(ui.doomsday) ? [ui.doomsday] : []), ...plates, ...right, ui.shipBtn];
              // the plates' buttons go together, in one step of the line
              let step = 0;
              all.forEach((el, i) => {
                  if (i > 0 && !(plates.includes(el) && plates.includes(all[i - 1]))) step++;
                  el.classList.remove('btn-arrive');
                  el.style.setProperty('--leave-delay', `${step * 60}ms`);
                  el.style.setProperty('--leave-x', left.includes(el) ? '-24px' : (right.includes(el) || el === ui.shipBtn ? '24px' : '0px'));
                  el.classList.add('deep-leave');
              });
          }
          ui.buildHomeBtn.addEventListener('click', () => addBuilding('home'), { signal });
          ui.buildStoreBtn.addEventListener('click', () => addBuilding('store'), { signal });
          ui.buildStallBtn.addEventListener('click', () => {
              const cost = stallCost(gameState.stalls || 0);
              if (gameState.stars < cost) return;
              gameState.stars -= cost;
              gameState.stalls = (gameState.stalls || 0) + 1;
              city.word('food');
              updateAllUI();
          }, { signal });
          // Hand harvest: the manual action of chapter II. Pays less per click
          // when hammered, recovers with rest (economy.js).
          ui.siloBtn.addEventListener('click', () => {
              const consumption = gameState.cachedSupplyConsumption || 0;
              const gained = harvestAmount(consumption, gameState.harvestEfficiency ?? 1);
              gameState.supplies += gained;
              gameState.harvestEfficiency = spendHarvestEfficiency(gameState.harvestEfficiency ?? 1);
              city.word('harvest');
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
                  // Research is glass, industry (tool case, car, computer) is metal
                  city.word(['toolCaseUnlocked', 'carUnlocked', 'computerUnlocked'].includes(flag) ? 'tool' : flag === 'greenhouseResearched' ? 'food' : 'research');
                  // Research that opens an upgrade puts a "+" on the plates it concerns.
                  // The plates are not rebuilt (that made every ring run a lap): the
                  // buttons are added where they stand, one after another.
                  refreshAllBuildingActions();
              }
          };
  
          ui.gmoUpgradeBtn.addEventListener('click', () => {
               const cost = buildingData.gmoUpgrade.baseCost * (gameState.gmoLevel + 1);
               const scienceCost = buildingData.gmoUpgrade.scienceCost * (gameState.gmoLevel + 1);
              if (gameState.stars >= cost && gameState.science >= scienceCost && gameState.gmoLevel < gameState.gmoMaxLevel) {
                  gameState.stars -= cost;
                  gameState.science -= scienceCost;
                  gameState.gmoLevel++;
                  city.word('food');
              }
          }, { signal });

          ui.toolCaseUpgradeBtn.addEventListener('click', () => createUpgradeListener('toolCaseUnlocked', buildingData.toolCaseUpgrade), { signal });
          ui.apartmentResearchBtn.addEventListener('click', () => createUpgradeListener('apartmentResearched', buildingData.apartmentResearch), { signal });
          ui.storeResearchBtn.addEventListener('click', () => createUpgradeListener('storeResearched', buildingData.storeResearch), { signal });
          ui.greenhouseResearchBtn.addEventListener('click', () => createUpgradeListener('greenhouseResearched', buildingData.greenhouseResearch), { signal });
          ui.urbanismResearchBtn.addEventListener('click', () => createUpgradeListener('urbanismResearched', buildingData.urbanismResearch), { signal });
          ui.megastructureResearchBtn.addEventListener('click', () => createUpgradeListener('megastructureResearched', buildingData.megastructureResearch), { signal });
          ui.carUpgradeBtn.addEventListener('click', () => createUpgradeListener('carUnlocked', buildingData.carUpgrade), { signal });
          ui.computerUpgradeBtn.addEventListener('click', () => createUpgradeListener('computerUnlocked', buildingData.computerUpgrade), { signal });

          ui.superconductorBtn.addEventListener('click', () => {
              const cost = buildingData.superconductor.baseCost * Math.pow(5, gameState.superconductorLevel);
              if (gameState.stars >= cost && gameState.superconductorLevel < buildingData.superconductor.maxLevel) {
                  gameState.stars -= cost;
                  gameState.superconductorLevel++;
                  city.word('tool');
              }
          }, { signal });

            ui.expandLandBtn.addEventListener('click', () => {
                if (gameState.stars >= buildingData.landExpansion.cost && !gameState.landExpanded) {
                    gameState.stars -= buildingData.landExpansion.cost;
                    gameState.landExpanded = true;
                    city.word('land');
                    smoothLayoutShift(() => addLandSlots(5));
                    updateAllUI();
                }
            }, { signal });

          ui.expandLand2Btn.addEventListener('click', () => {
              if (gameState.stars >= buildingData.landExpansion2.cost && !gameState.landExpansion2 && gameState.landExpanded) {
                  gameState.stars -= buildingData.landExpansion2.cost;
                  gameState.landExpansion2 = true;
                  city.word('land');
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

            /** A button that arrives: one soft pop, so a new choice is seen. */
            function arrive(btn) {
                if (gameState.war?.active) war.event('reveal');      // something new: chapter I's three notes, on their grid
                else city.word('rise');                              // something new: chapter I's three notes
                btn.classList.remove('btn-arrive');
                void btn.offsetWidth;
                btn.classList.add('btn-arrive');
                // Let go when it has landed, so hover and the greyed state are the button's own again.
                btn.addEventListener('animationend', () => btn.classList.remove('btn-arrive'), { once: true, signal });
            }

            /**
             * The opening of a new city. It begins as the chapter card lifts,
             * with only the factory and the bank. Then the empty plots open,
             * one after another, and then the choice to build a house arrives.
             */
            function playCityOpening() {
                _cityOpening = true;
                const empties = [...ui.landGrid.children].filter((_, i) => !gameState.buildings[i]);
                empties.forEach((slot) => slot.classList.add('slot-closed'));
                const card = document.getElementById('chapter-card');
                const STAGGER = 150;
                const later = (fn, ms) => setTimeout(() => { if (!signal.aborted) fn(); }, ms);
                const begin = () => {
                    if (card?.classList.contains('is-active')) { later(begin, 200); return; }
                    later(() => {
                        empties.forEach((slot, i) => later(() => {
                            slot.classList.remove('slot-closed');
                            slot.classList.add('slot-open');
                        }, i * STAGGER));
                        later(() => {
                            _cityOpening = false;
                            gameState.cityOpened = true;
                            updateAllUI();
                            arrive(ui.buildHomeBtn);
                            saveGameState();
                        }, empties.length * STAGGER + 800);
                    }, 1200);
                };
                begin();
            }

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

                // A city that is already lived in (or a save from before v1.57.0) is
                // open and has its store; only a new city gets the opening.
                const lived = gameState.population > 0 ||
                    gameState.buildings.some((b) => b && b.type !== 'factory' && b.type !== 'bank');
                if (lived) { gameState.cityOpened = true; gameState.storeShown = true; }
                if (!gameState.cityOpened) playCityOpening();

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
                if (gameState.war?.active) { applyWarPresentation(); if (ensureArmory() >= 0) requestAnimationFrame(popArmory); }
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
                uiSettled = true;
                // The city's music, unless the war is on (it has its own) or the way down is chosen
                audio.wake();
                if (!gameState.war?.active && !gameState.shipChosen) city.start();
                else if (gameState.war?.active && !gameState.shipChosen) war.start();
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
      // Paused (window.__rpiPaused, main.js): the loops keep running but do
      // nothing, so resuming is instant; game time (and the war's w.t) stands
      // still. Saving still happens.
      logicInterval = setInterval(() => { if (window.__rpiPaused) { saveGameState(); return; } logicTick(); }, 1000);
      fastUiInterval = setInterval(() => { if (!window.__rpiPaused) fastUiTick(); }, 50);
      _ants?.start();
  }
  updateIslands();
  window.addEventListener('resize', () => { _islands?.ours.update(gameState.islandRevealed); }, { signal: abortController.signal });
  window.addEventListener('beforeunload', beforeUnloadHandler);
  mountSaveButtons(ui.debugMenu);
  }

export function teardown() {
  city.stop();
  war.stop();
  if (_ants) { _ants.stop(); _ants = null; delete window.rpiAnts; }
  if (abortController) abortController.abort();
  clearInterval(logicInterval);
  clearInterval(fastUiInterval);
  window.removeEventListener('beforeunload', beforeUnloadHandler);
  delete window.debug_addResources;
  delete window.debug_addPopulation;
  _warCardTriggered = false;
  _deepStarting = false;
  _cityOpening = false;
  savingEnabled = true;
  _displayedStars = 0;
  _displayedScience = 0;
  _starsStep = 0;
  _scienceStep = 0;
  _stepAt = 0;
  _starsPerPersonRevealed = false;
  _scienceRevealed = false;
  _starvedSaid = false;
  // GO DEEP (v1.88.0) left its marks on the shared shell: the city comes back whole
  document.getElementById('phase-city')?.classList.remove('going-deep');
  document.getElementById('ants-canvas')?.classList.remove('left-behind');
  document.querySelectorAll('#phase-city .deep-leave').forEach(el => el.classList.remove('deep-leave'));
}
