/* global lucide */

import { PHASE2_CONSTANTS, PHASE_KEY } from "../constants.js";
import { playChapterCard } from '../chapterCard.js';
import { serializePhase2, loadFromStorage, saveToStorage } from './persistence.js';
import { mountSaveButtons } from '../save-export.js';
import { buildingData } from './buildings-config.js';

let logicInterval;
let fastUiInterval;
let savingEnabled = true;
let beforeUnloadHandler;
let abortController;
let _warCardTriggered = false;

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
              urbanismResearched: false,
              megastructureResearched: false,
              landExpanded: false,
              landExpansion2: false,
              superconductorLevel: 0,
              competitorSpawned: false,
          };

          const { SAVE_KEY, STARS_TRANSFER_KEY } = PHASE2_CONSTANTS;
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
              if (!savingEnabled) return;
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
              populationCountTotal: document.getElementById('population-count-total'),
              suppliesBar: document.getElementById('supplies-bar'),
              supplyDelta: document.getElementById('supply-delta'),
              supplyConsumption: document.getElementById('supply-consumption'),
              supplyProduction: document.getElementById('supply-production'),
              debugMenu: document.getElementById('p2-debug-menu'),
              debugToggleBtn: document.getElementById('debug-toggle-btn'),
              menuBtn: document.getElementById('menu-btn'),
              menuDropdown: document.getElementById('menu-dropdown'),
              resetBtn: document.getElementById('reset-btn'),
              buildHomeBtn: document.getElementById('build-home-btn'),
              buildStoreBtn: document.getElementById('build-store-btn'),
              gmoUpgradeBtn: document.getElementById('gmo-upgrade-btn'),
              gmoRing: document.getElementById('gmo-ring'),
              toolCaseUpgradeBtn: document.getElementById('tool-case-upgrade-btn'),
              urbanismResearchBtn: document.getElementById('urbanism-research-btn'),
              megastructureResearchBtn: document.getElementById('megastructure-research-btn'),
              carUpgradeBtn: document.getElementById('car-upgrade-btn'),
              computerUpgradeBtn: document.getElementById('computer-upgrade-btn'),
              expandLandBtn: document.getElementById('expand-land-btn'),
              expandLand2Btn: document.getElementById('expand-land-2-btn'),
              superconductorBtn: document.getElementById('superconductor-btn'),
              superconductorRing: document.getElementById('superconductor-ring'),
              competitorIsland: document.getElementById('competitor-island'),
              scienceRow: document.getElementById('science-row'),
              allocationSliderContainer: document.getElementById('allocation-slider-container'),
              buildSeparator: document.getElementById('build-separator'),
          };
  
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

          ui.menuBtn.addEventListener('click', () => ui.menuDropdown.classList.toggle('hidden'), { signal });
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

          function createBuildingHTML(building) {
              let icon = '';
              let content = '';
              let classes = 'building';
              let actionButtons = '';
              
              if (building.type !== 'factory' && building.type !== 'bank') {
                  const refund = (buildingData[building.type]?.cost || 0) * 0.7;
                  actionButtons += `<button class="building-action-btn sell-btn" data-building-id="${building.id}">-
                      <div class="tooltip"><div class="effect">+${Math.floor(refund).toLocaleString('en-US')} <i data-lucide='star' class='w-4 h-4 text-slate-300'></i></div></div>
                  </button>`;
              }
  
              let upgradeTarget = null;
              if (building.type === 'home') { upgradeTarget = 'apartment'; }
              else if (building.type === 'store') { upgradeTarget = 'superStore'; }
              else if (building.type === 'apartment' && gameState.urbanismResearched) { upgradeTarget = 'skyscraper'; }
              else if (building.type === 'skyscraper' && gameState.megastructureResearched) { upgradeTarget = 'district'; }
  
              
               if(upgradeTarget) {
                  const upgradeInfo = buildingData[upgradeTarget];
                  const popReq = { apartment: 30, superStore: 50, skyscraper: 200, district: 5000 }[upgradeTarget];
                  const canAfford = gameState.stars >= upgradeInfo.cost;
                  const unlocked = gameState.population >= popReq;
                  if (unlocked && canAfford) classes += ' upgradeable';

                  let effectHTML = '';
                   if (upgradeInfo.capacity && building.capacity) {
                      effectHTML = `+${(upgradeInfo.capacity - building.capacity).toLocaleString('en-US')} <i data-lucide='users' class='w-4 h-4'></i>`;
                  } else if (upgradeInfo.supply && building.supply) {
                      effectHTML = `+${upgradeInfo.supply - building.supply} <i data-lucide='shopping-basket' class='w-4 h-4'></i>/s`;
                  }
  
  
                  if (unlocked) {
                      const upgradeKey = `${building.id}-${upgradeTarget}`;
                      const isNew = initialLoadDone && !notifiedUpgrades.has(upgradeKey);
                      notifiedUpgrades.add(upgradeKey);
                      actionButtons += `<button class="building-action-btn upgrade-btn${isNew ? ' upgrade-new' : ''}" data-building-id="${building.id}" data-upgrade-target="${upgradeTarget}" ${canAfford ? '' : 'disabled'}>+
                          <div class="tooltip">
                              <div class="effect">${effectHTML}</div>
                              <div class="cost">${upgradeInfo.cost.toLocaleString('en-US')} <i data-lucide='star' class='w-4 h-4 text-slate-300'></i></div>
                          </div>
                      </button>`;
                  }
              }
              
              switch(building.type) {
                  case 'home': icon = 'home'; break;
                  case 'apartment': icon = 'building'; break;
                  case 'skyscraper': icon = 'building-2'; break;
                  case 'district': icon = 'custom-district'; break;
                  case 'store': icon = 'store'; break;
                  case 'superStore': icon = 'shopping-cart'; break;
                  case 'factory': icon = 'factory'; classes += ' factory'; break;
                  case 'bank': icon = 'landmark'; break;
              }
  
              if (building.type === 'home' || building.type === 'apartment' || building.type === 'skyscraper' || building.type === 'district') {
                  let iconHTML = '';
                  if (icon === 'custom-district') {
                      iconHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="relative text-slate-600"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
                  } else {
                      iconHTML = `<i data-lucide="${icon}" class="w-10 h-10 text-slate-600 relative"></i>`;
                  }
                  content = `<svg class="progress-ring" viewBox="0 0 40 40"><circle class="progress-ring-base" cx="20" cy="20" r="18" fill="none" stroke-width="2"></circle><circle id="pop-ring-${building.id}" class="progress-ring-fg" cx="20" cy="20" r="18" fill="none" stroke-width="2" stroke-dasharray="113" stroke-dashoffset="113" style="stroke: #94a3b8;"></circle></svg>${iconHTML}`;
              } else if (building.type === 'factory') {
                  content = `<div class="relative flex items-center justify-center w-full h-full">
                      <i data-lucide="${icon}" class="w-6 h-6 sm:w-10 sm:h-10 text-slate-600"></i>
                      <div class="factory-smoke">
                          <i data-lucide="scissors" class="smoke-icon"></i>
                          <i data-lucide="gem" class="smoke-icon delay-1"></i>
                          <i data-lucide="file-text" class="smoke-icon delay-2"></i>
                          <i data-lucide="scissors" class="smoke-icon delay-3"></i>
                      </div>
                  </div>`;
              } else if (icon) {
                   content = `<i data-lucide="${icon}" class="w-10 h-10 text-slate-600"></i>`;
              }
              
              return `<div class="${classes}">${content}${actionButtons}</div>`;
          }
          
          function renderGridSlot(index) {
              const building = gameState.buildings[index];
              const slot = ui.landGrid.children[index];
              if (!slot) return;

              if(building) {
                  slot.innerHTML = createBuildingHTML(building);
                  slot.classList.remove('empty');
                  const typeLabel = building.type.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, c => c.toUpperCase());
                  slot.setAttribute('aria-label', `Building: ${typeLabel}`);
              } else {
                  slot.innerHTML = '';
                  slot.classList.add('empty');
                  slot.setAttribute('aria-label', 'Empty land');
              }
              scheduleIconRefresh();
          }

          // Refresh only the action buttons (sell/upgrade disabled state + upgradeable class)
          // on an existing building cell — does NOT touch the ring or icon, so no flärp.
          function refreshBuildingActions(building, slot) {
              if (!building || !slot) return;
              const innerDiv = slot.querySelector('.building');
              if (!innerDiv) return;

              let upgradeTarget = null;
              if (building.type === 'home') upgradeTarget = 'apartment';
              else if (building.type === 'store') upgradeTarget = 'superStore';
              else if (building.type === 'apartment' && gameState.urbanismResearched) upgradeTarget = 'skyscraper';
              else if (building.type === 'skyscraper' && gameState.megastructureResearched) upgradeTarget = 'district';

              if (upgradeTarget) {
                  const upgradeInfo = buildingData[upgradeTarget];
                  const popReq = { apartment: 30, superStore: 50, skyscraper: 200, district: 5000 }[upgradeTarget];
                  const canAfford = gameState.stars >= upgradeInfo.cost;
                  const unlocked = gameState.population >= popReq;

                  // Upgradeable highlight class on wrapper
                  if (unlocked && canAfford) innerDiv.classList.add('upgradeable');
                  else innerDiv.classList.remove('upgradeable');

                  // Keep upgrade button disabled state current
                  const upgradeBtn = innerDiv.querySelector('.upgrade-btn');
                  if (upgradeBtn) {
                      upgradeBtn.disabled = !canAfford;
                  } else if (unlocked) {
                      // Upgrade button doesn't exist yet (newly unlocked by research purchase).
                      // Fall back to full re-render for this slot only.
                      renderGridSlot(gameState.buildings.indexOf(building));
                  }
              } else {
                  innerDiv.classList.remove('upgradeable');
              }
          }

          // Refresh action buttons on all existing buildings without rebuilding their HTML.
          function refreshAllBuildingActions() {
              gameState.buildings.forEach((b, i) => {
                  if (!b) return;
                  const slot = ui.landGrid.children[i];
                  refreshBuildingActions(b, slot);
              });
          }

          function calculateBaseStarPerPerson() {
              let baseStarPerPerson = 2;
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

          // --- TOOLTIP & UI UPDATE LOGIC ---
          const tooltipListenersAttached = new WeakSet();

          function setTooltip(el, { effect, cost, scienceCost, unlockReq }) {
              const tooltipEl = el.querySelector('.tooltip');
              if (!tooltipEl) return;
              let html = '';
              if (unlockReq) {
                  html += `<div class="unlock-req">${unlockReq}</div>`;
              } else {
                  if (effect) html += `<div class="effect">${effect}</div>`;
                  if (cost) html += `<div class="cost"><span class="font-mono">${cost.toLocaleString('en-US')}</span><i data-lucide="star" class="w-4 h-4 text-slate-300"></i></div>`;
                  if (scienceCost) html += `<div class="cost-science"><span class="font-mono">${scienceCost.toLocaleString('en-US')}</span><i data-lucide="atom" class="w-4 h-4 text-slate-300"></i></div>`;
              }
              tooltipEl.innerHTML = html;
              if (!tooltipListenersAttached.has(el)) {
                  el.addEventListener('mouseenter', () => tooltipEl.style.setProperty('--tooltip-opacity', 1), { signal });
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

                  btn.classList.toggle('hidden', !shouldShow || (isPurchased && !isMultiLevel));
                  if(shouldShow && !(isPurchased && !isMultiLevel)) anyUpgradeVisible = true;
              });
              ui.buildSeparator.classList.toggle('hidden', !anyUpgradeVisible);
  
  
              // Disabled state for basic buildings
              ui.buildHomeBtn.disabled = !canAfford(buildingData.home) || !hasEmptySlot;
              ui.buildStoreBtn.disabled = !canAfford(buildingData.store) || !hasEmptySlot;
  
              // Disabled state for global upgrades
              ui.toolCaseUpgradeBtn.disabled = !canAfford(buildingData.toolCaseUpgrade) || pop < 50 || gameState.toolCaseUnlocked;
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
              
              const gmoInfo = buildingData.gmoUpgrade;
              setTooltip(ui.gmoUpgradeBtn, pop < 75 && gameState.gmoLevel === 0 ? { unlockReq: `75 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+100% <i data-lucide='shopping-basket' class='w-4 h-4'></i> Eff.`, cost: gmoInfo.baseCost * (gameState.gmoLevel + 1), scienceCost: gmoInfo.scienceCost * (gameState.gmoLevel + 1) });
              
              setTooltip(ui.toolCaseUpgradeBtn, pop < 50 && !gameState.toolCaseUnlocked ? { unlockReq: `50 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+100% <i data-lucide='star' class='w-4 h-4'></i>/<i data-lucide='user' class='w-4 h-4'></i>`, cost: buildingData.toolCaseUpgrade.cost, scienceCost: buildingData.toolCaseUpgrade.scienceCost });
              
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
              if (_scienceRevealed) {
                  if (allScienceDone) {
                      ui.scienceRow.style.opacity = '0.15';
                      ui.allocationSliderContainer.style.opacity = '0.15';
                      if (gameState.populationAllocation > 0) {
                          gameState.populationAllocation = 0;
                          ui.allocationSlider.value = 0;
                      }
                  } else {
                      ui.scienceRow.style.opacity = '1';
                      ui.allocationSliderContainer.style.opacity = '1';
                  }
              }

              scheduleIconRefresh();
          }
  
        // --- MAIN GAME LOOP ---
        function logicTick(skipGrowth = false) {
              const baseStarPerPerson = calculateBaseStarPerPerson();

              const popForStars = gameState.population * (1 - gameState.populationAllocation);
              const popForScience = gameState.population * gameState.populationAllocation;

              let netStarChange = popForStars * baseStarPerPerson;
              const netScienceChange = popForScience * 1;

              let supplyProduction = 0;
              let currentTotalPopulation = 0;
              const gmoMultiplier = Math.pow(2, gameState.gmoLevel);

              gameState.buildings.forEach((b) => {
                  if (!b) return;
                  if (b.type === 'factory') netStarChange += 1680;
                  if (b.type === 'bank') netStarChange -= 30;
                  if (b.type === 'store' || b.type === 'superStore') {
                      supplyProduction += b.supply * gmoMultiplier;
                      netStarChange -= b.upkeep;
                  }
                  if (b.type === 'home' || b.type === 'apartment' || b.type === 'skyscraper' || b.type === 'district') {
                      if (!skipGrowth && gameState.supplies > 0 && b.population < b.capacity) {
                          let growthRate = 0;
                          if (b.type === 'district') growthRate = 10000;
                          else if (b.type === 'skyscraper') growthRate = 5;
                          else if (b.type === 'apartment') growthRate = 1;
                          else {
                              b.prodTimer = (b.prodTimer || 0) + 1;
                              if (b.prodTimer >= 5) { b.prodTimer = 0; growthRate = 1; }
                          }
                          b.population = Math.min(b.capacity, b.population + growthRate);
                      }
                      currentTotalPopulation += b.population;
                  }
              });

              const oldPop = gameState.population;
              gameState.population = currentTotalPopulation;
              if (oldPop !== gameState.population) {
                  // Only refresh action button states — rings are kept alive by fastUiTick,
                  // so a full DOM rebuild would cause the "flärp" ring reset.
                  refreshAllBuildingActions();
              }

              gameState.baseStarPerPerson = baseStarPerPerson;
              gameState.netStarChangePerSecond = netStarChange;
              gameState.netScienceChangePerSecond = netScienceChange;

              if (!skipGrowth) {
                  gameState.stars = Math.max(0, gameState.stars + netStarChange);
                  gameState.science = Math.max(0, gameState.science + netScienceChange);
              }

              const supplyConsumption = gameState.population;
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

              // Competitor spawn
              if (gameState.population >= 40000 && !gameState.competitorSpawned) {
                  gameState.competitorSpawned = true;
                  gameState.competitorSpawnedAt = Date.now();
                  ui.competitorIsland.classList.remove('hidden');
                  // Trigger fade-in on next frame
                  requestAnimationFrame(() => {
                      ui.competitorIsland.classList.add('visible');
                      scheduleIconRefresh();
                  });
              }

              // III·WAR chapter card at 50k population
              // Requires competitor island to have been visible for at least 5 seconds
              const competitorVisibleLongEnough = gameState.competitorSpawned &&
                  (Date.now() - (gameState.competitorSpawnedAt || 0)) >= 5000;
              if (gameState.population >= 50000 && !_warCardTriggered && competitorVisibleLongEnough) {
                  _warCardTriggered = true;
                  saveGameState(); // persist 50k+ state before disabling saves
                  savingEnabled = false;
                  if (logicInterval) clearInterval(logicInterval);
                  if (fastUiInterval) clearInterval(fastUiInterval);
                  playChapterCard({
                      roman: 'III',
                      title: 'WAR',
                      mode: 'to-come',
                      onMidpoint: () => { /* saving already disabled above */ },
                  });
              }

              updateAllUI();
              saveGameState();
          }
  
          function fastUiTick() {
              // Smooth counter rolling: lerp toward actual values for a "spinning numbers" effect
              _displayedStars += (gameState.stars - _displayedStars) * COUNTER_LERP;
              _displayedScience += (gameState.science - _displayedScience) * COUNTER_LERP;
              if (Math.abs(gameState.stars - _displayedStars) < 0.5) _displayedStars = gameState.stars;
              if (Math.abs(gameState.science - _displayedScience) < 0.5) _displayedScience = gameState.science;
              ui.starCount.textContent = Math.round(_displayedStars).toLocaleString('en-US');
              ui.scienceCount.textContent = Math.round(_displayedScience).toLocaleString('en-US');
              ui.populationCountTotal.textContent = gameState.population.toLocaleString('en-US');

              ui.netStarChange.textContent = `${(gameState.netStarChangePerSecond || 0) >= 0 ? '+' : ''}${Math.round(gameState.netStarChangePerSecond || 0).toLocaleString('en-US')}/s`;
              ui.netStarChange.style.color = (gameState.netStarChangePerSecond || 0) >= 0 ? '#64748b' : '#94a3b8';
              ui.netScienceChange.textContent = `+${Math.round(gameState.netScienceChangePerSecond || 0).toLocaleString('en-US')}/s`;

              const baseStarPerPerson = calculateBaseStarPerPerson();
              ui.starsPerPerson.textContent = `${baseStarPerPerson.toFixed(1)} /person`;

              const supplyProduction = gameState.cachedSupplyProduction || 0;
              const supplyConsumption = gameState.cachedSupplyConsumption || 0;
              const netSupplyChange = gameState.cachedNetSupplyChange || 0;
              const maxFlow = Math.max(supplyProduction, supplyConsumption, 1);
              const magnitudeRatio = Math.min(1, Math.abs(netSupplyChange) / maxFlow);

              ui.suppliesBar.style.transform = `scaleX(${magnitudeRatio})`;
              if (netSupplyChange >= 0) {
                  ui.suppliesBar.classList.remove('deficit');
                  ui.suppliesBar.style.left = '50%';
                  ui.suppliesBar.style.right = 'auto';
                  ui.suppliesBar.style.backgroundColor = '#64748b';
              } else {
                  ui.suppliesBar.classList.add('deficit');
                  ui.suppliesBar.style.left = 'auto';
                  ui.suppliesBar.style.right = '50%';
                  ui.suppliesBar.style.backgroundColor = '#94a3b8';
              }

              if (netSupplyChange === 0) {
                  ui.supplyDelta.textContent = 'Balanced';
                  ui.supplyDelta.style.color = '#64748b';
              } else if (netSupplyChange > 0) {
                  ui.supplyDelta.textContent = `Surplus +${Math.round(netSupplyChange).toLocaleString('en-US')}/s`;
                  ui.supplyDelta.style.color = '#475569';
              } else {
                  ui.supplyDelta.textContent = `Deficit ${Math.round(netSupplyChange).toLocaleString('en-US')}/s`;
                  ui.supplyDelta.style.color = '#94a3b8';
              }

              ui.supplyConsumption.textContent = `-${supplyConsumption.toLocaleString('en-US')}/s`;
              ui.supplyProduction.textContent = `+${Math.round(supplyProduction).toLocaleString('en-US')}/s`;
  
              gameState.buildings.forEach((b) => {
                  if (!b) return;
                  if (b.type === 'home' || b.type === 'apartment' || b.type === 'skyscraper' || b.type === 'district') {
                      const popRing = document.getElementById(`pop-ring-${b.id}`);
                      if (popRing) popRing.style.strokeDashoffset = 113 - ((b.population / b.capacity) * 113);
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
              const upgradeBtn = e.target.closest('.upgrade-btn');
              if (upgradeBtn) {
                  const buildingId = Number(upgradeBtn.dataset.buildingId);
                  const upgradeTarget = upgradeBtn.dataset.upgradeTarget;
                  if (!Number.isNaN(buildingId) && upgradeTarget) upgradeBuilding(e, buildingId, upgradeTarget);
              }
          }, { signal });

          ui.buildHomeBtn.addEventListener('click', () => addBuilding('home'), { signal });
          ui.buildStoreBtn.addEventListener('click', () => addBuilding('store'), { signal });
          
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
                    const grid = ui.landGrid;
                    for (let i = 0; i < 5; i++) {
                        gameState.buildings.push(undefined);
                        const slot = document.createElement('div');
                        slot.className = 'building-slot empty';
                        grid.appendChild(slot);
                    }
                    updateAllUI();
                }
            }, { signal });

          ui.expandLand2Btn.addEventListener('click', () => {
              if (gameState.stars >= buildingData.landExpansion2.cost && !gameState.landExpansion2 && gameState.landExpanded) {
                  gameState.stars -= buildingData.landExpansion2.cost;
                  gameState.landExpansion2 = true;
                  const grid = ui.landGrid;
                  for (let i = 0; i < 5; i++) {
                      gameState.buildings.push(undefined);
                      const slot = document.createElement('div');
                      slot.className = 'building-slot empty';
                      grid.appendChild(slot);
                  }
                  updateAllUI();
              }
          }, { signal });

            ui.allocationSlider.addEventListener('input', (e) => {
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
                    scheduleIconRefresh();
                }
                // Past-threshold load: player closed the tab on the WAR wall and came back.
                if (gameState.population >= 50000) {
                    _warCardTriggered = true;
                    savingEnabled = false;
                    if (logicInterval) clearInterval(logicInterval);
                    if (fastUiInterval) clearInterval(fastUiInterval);
                    playChapterCard({
                        roman: 'III',
                        title: 'WAR',
                        mode: 'to-come',
                        onMidpoint: () => { /* saving already disabled */ },
                    });
                }
                initialLoadDone = true;
                logicTick(true);
                updateAllUI();
                saveGameState();
            }

  window.debug_addResources = debug_addResources;
  window.debug_addPopulation = debug_addPopulation;
  initialize();
  // Only start ticks if initialize() did not trigger the WAR end-state.
  // When returning to a ≥50k population save, initialize() sets savingEnabled=false
  // and calls playChapterCard(to-come). Starting ticks in that case would run the
  // game logic behind the WAR card and allow population to keep growing.
  if (savingEnabled) {
      logicInterval = setInterval(logicTick, 1000);
      fastUiInterval = setInterval(fastUiTick, 50);
  }
  window.addEventListener('beforeunload', beforeUnloadHandler);
  mountSaveButtons(ui.debugMenu);
  }

export function teardown() {
  if (abortController) abortController.abort();
  clearInterval(logicInterval);
  clearInterval(fastUiInterval);
  window.removeEventListener('beforeunload', beforeUnloadHandler);
  delete window.debug_addResources;
  delete window.debug_addPopulation;
  _warCardTriggered = false;
  savingEnabled = true;
  _displayedStars = 0;
  _displayedScience = 0;
  _starsPerPersonRevealed = false;
  _scienceRevealed = false;
}
