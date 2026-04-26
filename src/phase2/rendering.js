/**
 * Phase 2 rendering helpers.
 *
 * Pure render functions — no game logic, no timers, no event listeners.
 * All functions accept data as parameters; none close over game state.
 *
 * The factory `createRenderer` wires persistent render state (notifiedUpgrades,
 * landGrid, scheduleIconRefresh) so callers in index.js don't have to pass
 * them on every call.
 *
 * @module phase2/rendering
 */

import { buildingData } from './buildings-config.js';

/**
 * Generates the inner HTML string for a building slot.
 *
 * @param {object} building - The building object from gameState.buildings
 * @param {object} context
 * @param {boolean} context.urbanismResearched - Whether urbanism research is done
 * @param {boolean} context.megastructureResearched - Whether megastructure research is done
 * @param {number} context.stars - Current star balance (for affordability check)
 * @param {number} context.population - Current population (for unlock check)
 * @param {Set<string>} context.notifiedUpgrades - Set of already-notified upgrade keys
 * @param {boolean} context.initialLoadDone - Whether the first load cycle has completed
 * @returns {string} HTML string to insert into the slot element
 */
export function createBuildingHTML(building, { urbanismResearched, megastructureResearched, stars, population, notifiedUpgrades, initialLoadDone }) {
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
    else if (building.type === 'apartment' && urbanismResearched) { upgradeTarget = 'skyscraper'; }
    else if (building.type === 'skyscraper' && megastructureResearched) { upgradeTarget = 'district'; }

    if (upgradeTarget) {
        const upgradeInfo = buildingData[upgradeTarget];
        const popReq = { apartment: 30, superStore: 50, skyscraper: 200, district: 5000 }[upgradeTarget];
        const canAfford = stars >= upgradeInfo.cost;
        const unlocked = population >= popReq;
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

    switch (building.type) {
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

/**
 * Factory that creates the renderer bound to a specific land grid and icon
 * refresh function.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.landGrid - The `#land-grid` DOM element
 * @param {function(): void} opts.scheduleIconRefresh - Debounced `lucide.createIcons()` wrapper
 * @param {Set<string>} opts.notifiedUpgrades - Set tracking which upgrade-new keys have fired
 * @returns {{ renderGridSlot: function, refreshBuildingActions: function, refreshAllBuildingActions: function }}
 */
export function createRenderer({ landGrid, scheduleIconRefresh, notifiedUpgrades }) {
    /**
     * Renders a single building slot by index into the land grid.
     * Triggers icon refresh after DOM change.
     *
     * @param {number} index - Slot index (0-based)
     * @param {Array} buildings - The gameState.buildings array
     * @param {object} gameState - Full game state (for affordability + unlock checks)
     * @param {boolean} initialLoadDone - Whether initial load is complete
     */
    function renderGridSlot(index, buildings, gameState, initialLoadDone) {
        const building = buildings[index];
        const slot = landGrid.children[index];
        if (!slot) return;

        if (building) {
            slot.innerHTML = createBuildingHTML(building, {
                urbanismResearched: gameState.urbanismResearched,
                megastructureResearched: gameState.megastructureResearched,
                stars: gameState.stars,
                population: gameState.population,
                notifiedUpgrades,
                initialLoadDone,
            });
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

    /**
     * Refreshes only the action buttons (sell/upgrade disabled state + upgradeable class)
     * on a single existing building slot. Does NOT touch the progress ring or icon,
     * avoiding the "flärp" ring reset.
     *
     * @param {object} building - Building object from gameState.buildings
     * @param {Element} slot - The slot DOM element
     * @param {object} gameState - Full game state
     * @param {Array} buildings - The gameState.buildings array (used for indexOf fallback)
     * @param {boolean} initialLoadDone - Whether initial load is complete
     */
    function refreshBuildingActions(building, slot, gameState, buildings, initialLoadDone) {
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
                renderGridSlot(buildings.indexOf(building), buildings, gameState, initialLoadDone);
            }
        } else {
            innerDiv.classList.remove('upgradeable');
        }
    }

    /**
     * Refreshes action buttons on all existing buildings without rebuilding their HTML.
     * Called on population change so affordability states stay current without ring resets.
     *
     * @param {Array} buildings - The gameState.buildings array
     * @param {object} gameState - Full game state
     * @param {boolean} initialLoadDone - Whether initial load is complete
     */
    function refreshAllBuildingActions(buildings, gameState, initialLoadDone) {
        buildings.forEach((b, i) => {
            if (!b) return;
            const slot = landGrid.children[i];
            refreshBuildingActions(b, slot, gameState, buildings, initialLoadDone);
        });
    }

    return { renderGridSlot, refreshBuildingActions, refreshAllBuildingActions };
}
