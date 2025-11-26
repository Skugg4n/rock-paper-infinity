/* global lucide */

let logicInterval;
let fastUiInterval;

export function init() {
          lucide.createIcons();

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
              verktygUnlocked: false,
              carUnlocked: false,
              computerUnlocked: false,
              urbanismResearched: false,
              megastructureResearched: false,
              landExpanded: false,
          };

          const SAVE_KEY = 'rpi-stage2';
          const storedState = localStorage.getItem(SAVE_KEY);
          if (storedState) {
              try {
                  const parsedState = JSON.parse(storedState);
                  parsedState.buildings = (parsedState.buildings || []).map(b => b === null ? undefined : b);
                  Object.assign(gameState, parsedState);
              } catch (e) {
                  console.error('Failed to parse save', e);
              }
          } else {
              const storedStars = localStorage.getItem('rpi-stars');
              const parsed = storedStars !== null ? Number.parseInt(storedStars, 10) : NaN;
              gameState.stars = Number.isNaN(parsed) ? 0 : parsed;
              localStorage.removeItem('rpi-stars');
          }

          function saveGameState() {
              localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
          }
          const buildingData = {
              home: { cost: 10000, capacity: 10 },
              store: { cost: 30000, upkeep: 20, supply: 20 },
              apartment: { cost: 50000, capacity: 50 },
              skyscraper: { cost: 250000, capacity: 500 },
              district: { cost: 10000000, capacity: 100000 },
              superStore: { cost: 200000, upkeep: 50, supply: 60 },
              gmoUpgrade: { baseCost: 10000, scienceCost: 1000 },
              verktygUpgrade: { cost: 500000, scienceCost: 5000 },
              urbanismResearch: { cost: 250000, scienceCost: 25000 },
              carUpgrade: { cost: 1000000, scienceCost: 100000 },
              computerUpgrade: { cost: 5000000, scienceCost: 100000 },
              megastructureResearch: { cost: 1000000, scienceCost: 100000 },
              landExpansion: { cost: 1000000 },
          };
  
          // --- UI ELEMENTS ---
          const ui = {
              starCount: document.getElementById('star-count'),
              starsPerPerson: document.getElementById('stars-per-person'),
              scienceCount: document.getElementById('science-count'),
              netStarChange: document.getElementById('net-star-change'),
              netScienceChange: document.getElementById('net-science-change'),
              allocationSlider: document.getElementById('allocation-slider'),
              landGrid: document.getElementById('land-grid'),
              populationUi: document.getElementById('population-ui'),
              suppliesUi: document.getElementById('supplies-ui'),
              populationCountTotal: document.getElementById('population-count-total'),
              suppliesBar: document.getElementById('supplies-bar'),
              supplyDelta: document.getElementById('supply-delta'),
              supplyConsumption: document.getElementById('supply-consumption'),
              supplyProduction: document.getElementById('supply-production'),
              debugMenu: document.getElementById('debug-menu'),
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
          });

          ui.menuBtn.addEventListener('click', () => ui.menuDropdown.classList.toggle('hidden'));
          ui.resetBtn.addEventListener('click', () => {
              localStorage.removeItem(SAVE_KEY);
              localStorage.removeItem('rpi-stars');
              location.reload();
          });
  
          // --- BUILDING & RENDERING LOGIC ---
          function createBuildingHTML(building) {
              let icon = '';
              let content = '';
              let classes = 'building';
              let actionButtons = '';
              
              if (building.type !== 'factory' && building.type !== 'bank') {
                  const refund = (buildingData[building.type]?.cost || 0) * 0.7;
                  actionButtons += `<button class="building-action-btn sell-btn" onclick="sellBuilding(event, ${building.id})">-
                      <div class="tooltip"><div class="effect">+${Math.floor(refund).toLocaleString('en-US')} <i data-lucide='star' class='w-4 h-4 text-amber-400'></i></div></div>
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

                  let effectHTML = '';
                   if (upgradeInfo.capacity && building.capacity) {
                      effectHTML = `+${(upgradeInfo.capacity - building.capacity).toLocaleString('en-US')} <i data-lucide='users' class='w-4 h-4'></i>`;
                  } else if (upgradeInfo.supply && building.supply) {
                      effectHTML = `+${upgradeInfo.supply - building.supply} <i data-lucide='shopping-basket' class='w-4 h-4'></i>/s`;
                  }
  
  
                  if (unlocked) {
                      actionButtons += `<button class="building-action-btn upgrade-btn" onclick="upgradeBuilding(event, ${building.id}, '${upgradeTarget}')" ${canAfford ? '' : 'disabled'}>+
                          <div class="tooltip">
                              <div class="effect">${effectHTML}</div>
                              <div class="cost">${upgradeInfo.cost.toLocaleString('en-US')} <i data-lucide='star' class='w-4 h-4 text-amber-400'></i></div>
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
                  content = `<svg class="progress-ring" viewBox="0 0 40 40"><circle class="progress-ring-base" cx="20" cy="20" r="18" fill="none" stroke-width="2"></circle><circle id="pop-ring-${building.id}" class="progress-ring-fg" cx="20" cy="20" r="18" fill="none" stroke-width="4" stroke-dasharray="113" stroke-dashoffset="113" style="stroke: #38bdf8;"></circle></svg>${iconHTML}`;
              } else if (building.type === 'factory') {
                  content = `<div class="relative flex items-center justify-center w-full h-full">
                      <i data-lucide="${icon}" class="w-10 h-10 text-slate-600"></i>
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
              
              const upkeepCost = building.upkeep || (building.type === 'bank' ? 30 : 0);
              const upkeepHTML = upkeepCost ? `<div class="building-upkeep"><span>-${upkeepCost}</span><i data-lucide="star" class="w-3 h-3 text-amber-400"></i></div>` : '';
  
              return `<div class="${classes}">${content}${upkeepHTML}${actionButtons}</div>`;
          }
          
          function renderGridSlot(index) {
              const building = gameState.buildings[index];
              const slot = ui.landGrid.children[index];
              if (!slot) return;
              
              if(building) {
                  slot.innerHTML = createBuildingHTML(building);
                  slot.classList.remove('empty');
              } else {
                  slot.innerHTML = '';
                  slot.classList.add('empty');
              }
              lucide.createIcons();
          }
  
          function renderAllBuildings() {
              gameState.buildings.forEach((b, i) => renderGridSlot(i));
          }

          function calculateBaseStarPerPerson() {
              let baseStarPerPerson = 2;
              if (gameState.verktygUnlocked) baseStarPerPerson *= 2;
              if (gameState.carUnlocked) baseStarPerPerson *= 5;
              if (gameState.computerUnlocked) baseStarPerPerson *= 11;
              return baseStarPerPerson;
          }

          function sellBuilding(event, buildingId) {
              event.stopPropagation();
              const index = gameState.buildings.findIndex(b => b && b.id === buildingId);
              if (index === -1) return;
              const building = gameState.buildings[index];
              gameState.stars += (buildingData[building.type]?.cost || 0) * 0.7;
              gameState.buildings[index] = undefined;
              gameState.population = gameState.buildings.reduce((total, b) => total + (b?.population || 0), 0);
              renderGridSlot(index);
              logicTick(true);
              updateAllUI();
          }
          
          function upgradeBuilding(event, buildingId, targetType) {
              event.stopPropagation();
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
          function setTooltip(el, { effect, cost, scienceCost, unlockReq }) {
              const tooltipEl = el.querySelector('.tooltip');
              if (!tooltipEl) return;
              let html = '';
              if (unlockReq) {
                  html += `<div class="unlock-req">${unlockReq}</div>`;
              } else {
                  if (effect) html += `<div class="effect">${effect}</div>`;
                  if (cost) html += `<div class="cost"><span class="font-mono">${cost.toLocaleString('en-US')}</span><i data-lucide="star" class="w-4 h-4 text-amber-400"></i></div>`;
                  if (scienceCost) html += `<div class="cost-science"><span class="font-mono">${scienceCost.toLocaleString('en-US')}</span><i data-lucide="atom" class="w-4 h-4 text-sky-500"></i></div>`;
              }
              tooltipEl.innerHTML = html;
              el.addEventListener('mouseenter', () => tooltipEl.style.setProperty('--tooltip-opacity', 1));
              el.addEventListener('mouseleave', () => tooltipEl.style.setProperty('--tooltip-opacity', 0));
          }
  
          function updateAllUI() {
              const pop = gameState.population;
              const canAfford = (item) => gameState.stars >= (item.cost || 0) && gameState.science >= (item.scienceCost || 0);
              const hasEmptySlot = gameState.buildings.some(b => b === undefined);
  
              const upgrades = [
                  { btn: ui.toolCaseUpgradeBtn, popReq: 25, flag: 'verktygUnlocked' },
                  { btn: ui.gmoUpgradeBtn, popReq: 50, flag: 'gmoLevel', isMultiLevel: true },
                  { btn: ui.urbanismResearchBtn, popReq: 100, flag: 'urbanismResearched' },
                  { btn: ui.expandLandBtn, popReq: 750, flag: 'landExpanded' },
                  { btn: ui.carUpgradeBtn, popReq: 500, flag: 'carUnlocked' },
                  { btn: ui.computerUpgradeBtn, popReq: 1000, flag: 'computerUnlocked', prereq: 'carUnlocked' },
                  { btn: ui.megastructureResearchBtn, popReq: 5000, flag: 'megastructureResearched'},
              ];
  
              let anyUpgradeVisible = false;
              upgrades.forEach(({btn, popReq, flag, isMultiLevel, prereq}) => {
                  const isPurchased = isMultiLevel ? gameState[flag] >= gameState.gmoMaxLevel : gameState[flag];
                  const prereqMet = prereq ? gameState[prereq] : true;
                  const shouldShow = (pop >= popReq || isPurchased) && prereqMet;
                  
                  btn.classList.toggle('hidden', !shouldShow || (isPurchased && !isMultiLevel));
                  if(shouldShow && !(isPurchased && !isMultiLevel)) anyUpgradeVisible = true;
              });
              ui.buildSeparator.classList.toggle('hidden', !anyUpgradeVisible);
  
  
              // Disabled state for basic buildings
              ui.buildHomeBtn.disabled = !canAfford(buildingData.home) || !hasEmptySlot;
              ui.buildStoreBtn.disabled = !canAfford(buildingData.store) || !hasEmptySlot;
  
              // Disabled state for global upgrades
              ui.toolCaseUpgradeBtn.disabled = !canAfford(buildingData.verktygUpgrade) || pop < 50 || gameState.verktygUnlocked;
              ui.urbanismResearchBtn.disabled = !canAfford(buildingData.urbanismResearch) || pop < 200 || gameState.urbanismResearched;
              ui.megastructureResearchBtn.disabled = !canAfford(buildingData.megastructureResearch) || pop < 5000 || gameState.megastructureResearched;
              ui.gmoUpgradeBtn.disabled = !canAfford({cost: buildingData.gmoUpgrade.baseCost * (gameState.gmoLevel + 1), scienceCost: buildingData.gmoUpgrade.scienceCost * (gameState.gmoLevel + 1)}) || pop < 75 || gameState.gmoLevel >= gameState.gmoMaxLevel;
              ui.carUpgradeBtn.disabled = !canAfford(buildingData.carUpgrade) || pop < 500 || gameState.carUnlocked;
              ui.computerUpgradeBtn.disabled = !canAfford(buildingData.computerUpgrade) || pop < 1000 || gameState.computerUnlocked;
              ui.expandLandBtn.disabled = !canAfford(buildingData.landExpansion) || pop < 1000 || gameState.landExpanded;
  
              // Tooltips
              setTooltip(ui.buildHomeBtn, { effect: `+${buildingData.home.capacity} <i data-lucide='users' class='w-4 h-4'></i>`, cost: buildingData.home.cost });
              setTooltip(ui.buildStoreBtn, { effect: `+${buildingData.store.supply} <i data-lucide='shopping-basket' class='w-4 h-4'></i>/s`, cost: buildingData.store.cost });
              
              const gmoInfo = buildingData.gmoUpgrade;
              setTooltip(ui.gmoUpgradeBtn, pop < 75 && gameState.gmoLevel === 0 ? { unlockReq: `75 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+100% <i data-lucide='shopping-basket' class='w-4 h-4'></i> Eff.`, cost: gmoInfo.baseCost * (gameState.gmoLevel + 1), scienceCost: gmoInfo.scienceCost * (gameState.gmoLevel + 1) });
              
              setTooltip(ui.toolCaseUpgradeBtn, pop < 50 && !gameState.verktygUnlocked ? { unlockReq: `50 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+100% <i data-lucide='star' class='w-4 h-4'></i>/<i data-lucide='user' class='w-4 h-4'></i>`, cost: buildingData.verktygUpgrade.cost, scienceCost: buildingData.verktygUpgrade.scienceCost });
              
              setTooltip(ui.urbanismResearchBtn, pop < 200 && !gameState.urbanismResearched ? { unlockReq: `200 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `Unlock <i data-lucide='building-2' class='w-4 h-4'></i>`, cost: buildingData.urbanismResearch.cost, scienceCost: buildingData.urbanismResearch.scienceCost });

              setTooltip(ui.megastructureResearchBtn, pop < 5000 && !gameState.megastructureResearched ? { unlockReq: `5000 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `Unlock District`, cost: buildingData.megastructureResearch.cost, scienceCost: buildingData.megastructureResearch.scienceCost });
  
              setTooltip(ui.carUpgradeBtn, pop < 500 && !gameState.carUnlocked ? { unlockReq: `500 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+400% <i data-lucide='star' class='w-4 h-4'></i>/<i data-lucide='user' class='w-4 h-4'></i>`, cost: buildingData.carUpgrade.cost, scienceCost: buildingData.carUpgrade.scienceCost });
              
              setTooltip(ui.computerUpgradeBtn, pop < 1000 || !gameState.carUnlocked ? { unlockReq: `1000 <i data-lucide='users' class='w-4 h-4'></i> & <i data-lucide='car' class='w-4 h-4'></i>` } : { effect: `+1000% <i data-lucide='star' class='w-4 h-4'></i>/<i data-lucide='user' class='w-4 h-4'></i>`, cost: buildingData.computerUpgrade.cost, scienceCost: buildingData.computerUpgrade.scienceCost });
              
              setTooltip(ui.expandLandBtn, pop < 1000 && !gameState.landExpanded ? { unlockReq: `1000 <i data-lucide='users' class='w-4 h-4'></i>` } : { effect: `+5 <i data-lucide='layout-grid' class='w-4 h-4'></i>`, cost: buildingData.landExpansion.cost });
              
              lucide.createIcons();
          }
  
        // --- MAIN GAME LOOP ---
        function logicTick(skipGrowth = false) {
              const baseStarPerPerson = calculateBaseStarPerPerson();

              const popForStars = gameState.population * (1 - gameState.populationAllocation);
              const popForScience = gameState.population * gameState.populationAllocation;

              let netStarChange = popForStars * baseStarPerPerson;
              let netScienceChange = popForScience * 1;

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
                  renderAllBuildings();
              }

              gameState.baseStarPerPerson = baseStarPerPerson;
              gameState.netStarChangePerSecond = netStarChange;
              gameState.netScienceChangePerSecond = netScienceChange;

              const supplyConsumption = gameState.population;
              const netSupplyChange = supplyProduction - supplyConsumption;

              if (!skipGrowth) {
                  gameState.supplies = Math.max(0, gameState.supplies + netSupplyChange / 20); // Slower supply change

                  if (gameState.supplies <= 0 && gameState.population > 0) {
                      const popBuildings = gameState.buildings.filter(b => b && (b.type === 'home' || b.type === 'apartment' || b.type === 'skyscraper' || b.type === 'district') && b.population > 0);
                      if (popBuildings.length > 0) {
                          popBuildings.sort((a,b) => a.id - b.id)[0].population--;
                      }
                  }
              }

              if (gameState.population >= 5 && !ui.populationUi.classList.contains('visible')) {
                  ui.populationUi.classList.add('visible');
                  ui.suppliesUi.classList.add('visible');
              }

              saveGameState();
          }
  
          function fastUiTick() {
              gameState.stars += (gameState.netStarChangePerSecond || 0) / 20;
              gameState.science += (gameState.netScienceChangePerSecond || 0) / 20;
              ui.starCount.textContent = Math.floor(gameState.stars).toLocaleString('en-US');
              ui.scienceCount.textContent = Math.floor(gameState.science).toLocaleString('en-US');
              ui.populationCountTotal.textContent = gameState.population.toLocaleString('en-US');

              ui.netStarChange.textContent = `${(gameState.netStarChangePerSecond || 0) >= 0 ? '+' : ''}${Math.round(gameState.netStarChangePerSecond || 0).toLocaleString('en-US')}/s`;
              ui.netStarChange.style.color = (gameState.netStarChangePerSecond || 0) >= 0 ? '#16a34a' : '#ef4444';
              ui.netScienceChange.textContent = `+${Math.round(gameState.netScienceChangePerSecond || 0).toLocaleString('en-US')}/s`;

              const baseStarPerPerson = calculateBaseStarPerPerson();
              const effectivePerPerson = baseStarPerPerson * (1 - gameState.populationAllocation);
              ui.starsPerPerson.textContent = `${baseStarPerPerson.toFixed(1)} ★/person (industri: ${effectivePerPerson.toFixed(1)} ★)`;

              const supplyProduction = gameState.buildings.reduce((acc, b) => {
                  if(!b || !(b.type === 'store' || b.type === 'superStore')) return acc;
                  return acc + (b.supply * Math.pow(2, gameState.gmoLevel));
              }, 0);
              const supplyConsumption = gameState.population;
              const netSupplyChange = supplyProduction - supplyConsumption;
              const maxFlow = Math.max(supplyProduction, supplyConsumption, 1);
              const magnitudeRatio = Math.min(1, Math.abs(netSupplyChange) / maxFlow);

              ui.suppliesBar.style.transform = `scaleX(${magnitudeRatio})`;
              if (netSupplyChange >= 0) {
                  ui.suppliesBar.classList.remove('deficit');
                  ui.suppliesBar.style.left = '50%';
                  ui.suppliesBar.style.right = 'auto';
                  ui.suppliesBar.style.backgroundColor = '#22c55e';
              } else {
                  ui.suppliesBar.classList.add('deficit');
                  ui.suppliesBar.style.left = 'auto';
                  ui.suppliesBar.style.right = '50%';
                  ui.suppliesBar.style.backgroundColor = '#ef4444';
              }

              if (netSupplyChange === 0) {
                  ui.supplyDelta.textContent = 'Balanced';
                  ui.supplyDelta.style.color = '#334155';
              } else if (netSupplyChange > 0) {
                  ui.supplyDelta.textContent = `Surplus +${Math.round(netSupplyChange).toLocaleString('en-US')}/s`;
                  ui.supplyDelta.style.color = '#16a34a';
              } else {
                  ui.supplyDelta.textContent = `Deficit ${Math.round(netSupplyChange).toLocaleString('en-US')}/s`;
                  ui.supplyDelta.style.color = '#ef4444';
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
              updateAllUI(); // Check affordability continuously
          }
          
          // --- EVENT LISTENERS ---
          ui.buildHomeBtn.addEventListener('click', () => addBuilding('home'));
          ui.buildStoreBtn.addEventListener('click', () => addBuilding('store'));
          
          const createUpgradeListener = (flag, upgradeData) => {
              if (gameState.stars >= (upgradeData.cost || 0) && gameState.science >= (upgradeData.scienceCost || 0) && !gameState[flag]) {
                  gameState.stars -= (upgradeData.cost || 0);
                  gameState.science -= (upgradeData.scienceCost || 0);
                  gameState[flag] = true;
                  // Force a full re-render of all buildings when a research that enables upgrades is bought
                  renderAllBuildings();
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
          });
  
          ui.toolCaseUpgradeBtn.addEventListener('click', () => createUpgradeListener('verktygUnlocked', buildingData.verktygUpgrade));
          ui.urbanismResearchBtn.addEventListener('click', () => createUpgradeListener('urbanismResearched', buildingData.urbanismResearch));
          ui.megastructureResearchBtn.addEventListener('click', () => createUpgradeListener('megastructureResearched', buildingData.megastructureResearch));
          ui.carUpgradeBtn.addEventListener('click', () => createUpgradeListener('carUnlocked', buildingData.carUpgrade));
          ui.computerUpgradeBtn.addEventListener('click', () => createUpgradeListener('computerUnlocked', buildingData.computerUpgrade));
          
            ui.expandLandBtn.addEventListener('click', () => {
                if (gameState.stars >= buildingData.landExpansion.cost && !gameState.landExpanded) {
                    gameState.stars -= buildingData.landExpansion.cost;
                    gameState.landExpanded = true;
                    for (let i = 0; i < 5; i++) gameState.buildings.push(undefined);
                  const grid = ui.landGrid;
                  grid.innerHTML = '';
                  gameState.buildings.forEach((b, i) => {
                      const slot = document.createElement('div');
                      slot.className = 'building-slot';
                      grid.appendChild(slot);
                      renderGridSlot(i);
                  });
              }
          });
          
            ui.allocationSlider.addEventListener('input', (e) => {
                gameState.populationAllocation = e.target.value / 100;
            });
  
            function initialize() {
                if (!Array.isArray(gameState.buildings) || gameState.buildings.length === 0) {
                    gameState.buildings = new Array(10).fill(undefined);
                    gameState.buildings[0] = {id: 1, type: 'factory'};
                    gameState.buildings[1] = {id: 2, type: 'bank'};
                }
                const grid = ui.landGrid;
                grid.innerHTML = '';
                gameState.buildings.forEach(() => grid.insertAdjacentHTML('beforeend', '<div class="building-slot empty"></div>'));
                gameState.buildings.forEach((_, i) => renderGridSlot(i));
                logicTick(true);
                updateAllUI();
                saveGameState();
            }

  window.debug_addResources = debug_addResources;
  window.debug_addPopulation = debug_addPopulation;
  window.sellBuilding = sellBuilding;
  window.upgradeBuilding = upgradeBuilding;
  initialize();
    logicInterval = setInterval(logicTick, 1000);
    fastUiInterval = setInterval(fastUiTick, 50);
    window.addEventListener('beforeunload', saveGameState);
  }

export function teardown() {
  clearInterval(logicInterval);
  clearInterval(fastUiInterval);
  delete window.debug_addResources;
  delete window.debug_addPopulation;
  delete window.sellBuilding;
  delete window.upgradeBuilding;
}
