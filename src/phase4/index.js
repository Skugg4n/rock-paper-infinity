/* global lucide */

/**
 * Chapter IV · THE DEEP: the phase. Holds the colony's state, runs its
 * calendar (one real second is one day), draws the chrome over the model, and
 * saves. The rules live in deep.js, the positions in layout.js and the model in
 * scene.js; this file is the wiring between them.
 *
 * Slice 1: the descent, the model, the chrome, digging, rooms, levels and
 * automation. Cryo, wake-ups, probes and the ascent come later; the snowflake
 * is on screen, greyed, so the player knows there is one.
 */

import { PHASE2_CONSTANTS, PHASE4_CONSTANTS, DEBUG_KEY } from '../constants.js';
import {
    initialDeepState, tickDay, digCost, roomCost, levelCost, automationCost,
    ROOM_FOR_COLUMN, COLUMN, DAYS_PER_YEAR, RESURFACE_AT,
} from './deep.js';
import { initialLayout, freeChamber, normalizeLayout } from './layout.js';
import { createScene, supportsWebGL, ROOM_ICON } from './scene.js';
import { serializeDeep, saveToStorage, loadFromStorage } from './persistence.js';
import { doomsday } from '../phase3/war.js';

const { SAVE_KEY, MAX_CATCHUP_DAYS } = PHASE4_CONSTANTS;
const BAR_H = 160;                 // the track's height in CSS pixels
/** What the advisor calls the room that fixes each column. */
const ROOM_WORD = { mine: 'mine', farm: 'farm', generator: 'generator', dorm: 'dormitory' };

let abortController = null;
let dayInterval = null;
let rafId = 0;
let scene = null;
let savingEnabled = true;
let beforeUnloadHandler = null;
let iconRefreshQueued = false;

/** Debounced lucide pass: never called straight from a loop. */
function scheduleIconRefresh() {
    if (iconRefreshQueued) return;
    iconRefreshQueued = true;
    requestAnimationFrame(() => {
        iconRefreshQueued = false;
        try { lucide.createIcons(); } catch { /* the CDN is not there; the glyphs are not the game */ }
    });
}

/** Big numbers stay legible: 1 234, 45.6k, 3.1M, 2.0B. */
export function formatCount(n) {
    const v = Math.floor(Math.abs(n));
    const sign = n < 0 ? '-' : '';
    if (v < 10000) return sign + v.toLocaleString('en-US');
    if (v < 1e6) return `${sign}${(v / 1e3).toFixed(1)}k`;
    if (v < 1e9) return `${sign}${(v / 1e6).toFixed(1)}M`;
    if (v < 1e12) return `${sign}${(v / 1e9).toFixed(1)}B`;
    return `${sign}${v.toExponential(1)}`;
}

/** Day 0 is the day the exit was blown: year 0, month 1, day 1. */
export function calendar(day) {
    const d = Math.max(0, Math.floor(day));
    const year = Math.floor(d / DAYS_PER_YEAR);
    const rest = d - year * DAYS_PER_YEAR;
    return { year, month: Math.min(12, Math.floor(rest / 30) + 1), day: Math.floor(rest % 30) + 1 };
}

/**
 * What came down the hole: the salvage the war left and how scorched the
 * surface was the day the exit was blown. Read out of chapter II's save, which
 * is where the war state lives; defaults when there is nothing to read.
 * @returns {{salvage?:number, doom0?:number}}
 */
export function seedFromWar(raw) {
    try {
        const war = raw ? JSON.parse(raw)?.war : null;
        if (!war) return {};
        const seed = {};
        if (Number.isFinite(war.salvage) && war.salvage > 0) seed.salvage = Math.max(1500, Math.round(war.salvage));
        const doom = doomsday((war.scorchOurs || 0) + (war.scorchTheirs || 0));
        if (Number.isFinite(doom)) seed.doom0 = Math.max(RESURFACE_AT * 2, Math.min(100, doom));
        return seed;
    } catch {
        return {};
    }
}

export function init() {
    abortController = new AbortController();
    const signal = abortController.signal;
    savingEnabled = true;

    document.body.classList.add('in-deep');

    // --- state: what was saved, or what the war left us ---
    let state, layout;
    const saved = loadFromStorage(SAVE_KEY);
    if (saved) {
        state = saved.state;
        layout = saved.layout;
    } else {
        let stored = null;
        try { stored = localStorage.getItem(PHASE2_CONSTANTS.SAVE_KEY); } catch { /* ignore */ }
        state = initialDeepState(seedFromWar(stored));
        layout = initialLayout(state);
    }
    layout = normalizeLayout(state, layout);

    const ui = {
        sceneHost: document.getElementById('deep-scene'),
        labelHost: document.getElementById('deep-labels'),
        fallback: document.getElementById('deep-fallback'),
        year: document.getElementById('deep-year'),
        month: document.getElementById('deep-month'),
        dayOfMonth: document.getElementById('deep-day'),
        minerals: document.getElementById('deep-minerals'),
        stars: document.getElementById('deep-stars'),
        advisor: document.getElementById('deep-advisor'),
        starsDay: document.getElementById('deep-stars-day'),
        heads: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-head-${c}`)])),
        fills: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-fill-${c}`)])),
        dots: Object.fromEntries(COLUMN.map((c) => [c, document.getElementById(`deep-dot-${c}`)])),
        digBtn: document.getElementById('deep-dig-btn'),
        roomBtns: ['mine', 'farm', 'generator', 'dorm'].map((t) => ({ type: t, el: document.getElementById(`deep-room-${t}`) })),
        levelBtn: document.getElementById('deep-level-btn'),
        autoBtn: document.getElementById('deep-auto-btn'),
        cryoBtn: document.getElementById('deep-cryo-btn'),
        resetBtn: document.getElementById('deep-reset-view'),
    };

    // --- the model ---
    if (supportsWebGL()) {
        try {
            scene = createScene(ui.sceneHost, {
                labelHost: ui.labelHost,
                onInteract: () => ui.resetBtn.classList.add('is-on'),
                onLabels: scheduleIconRefresh,
            });
        } catch (e) {
            console.error('the deep: the model could not be built', e);
            scene = null;
        }
    }
    if (!scene) ui.fallback.classList.add('is-on');

    // --- the day's report, for the bars and the advisor ---
    // A dry run on a copy: the same numbers the next real day will give, without
    // spending one. That is what the four columns and the dot are showing.
    const dryRun = () => tickDay(JSON.parse(JSON.stringify(state)), state.asleep);
    let report = dryRun();

    function saveGame() {
        if (!savingEnabled || window.__rpiSkipSave) return;
        saveToStorage(SAVE_KEY, serializeDeep(state, layout));
    }
    beforeUnloadHandler = () => saveGame();

    // --- the chrome ---
    function setTooltip(el, html) {
        const t = el.querySelector('.tooltip');
        if (t && t.innerHTML !== html) t.innerHTML = html;
    }
    const cost = (n, icon) => `<span class="deep-mono">${formatCount(n)}</span><i data-lucide="${icon}" class="w-4 h-4"></i>`;
    const mineralCost = (n) => cost(n, 'gem');
    const starCost = (n) => cost(n, 'star');
    const roomMark = (type) => `<i data-lucide="${ROOM_ICON[type]}" class="w-4 h-4"></i>`;

    function updateChrome() {
        const cal = calendar(state.day);
        ui.year.textContent = cal.year.toLocaleString('en-US');
        ui.month.textContent = cal.month;
        ui.dayOfMonth.textContent = cal.day;
        ui.minerals.textContent = formatCount(state.minerals);
        ui.stars.textContent = formatCount(state.stars);
        ui.starsDay.textContent = formatCount(report.stars);

        // the bars: all four to the same scale, the weakest marked
        const parts = report.parts;
        const scale = Math.max(1, ...COLUMN.map((c) => Math.abs(parts[c])));
        for (const c of COLUMN) {
            const h = Math.round(BAR_H * Math.max(0, Math.min(1, parts[c] / scale)));
            ui.fills[c].style.height = `${h}px`;
            ui.heads[c].textContent = formatCount(parts[c]);
            const weakest = c === report.weakest;
            ui.dots[c].classList.toggle('hidden', !weakest);
            if (weakest) ui.dots[c].style.bottom = `${Math.min(BAR_H - 4, h + 10)}px`;
        }
        ui.advisor.textContent = `Year ${cal.year}: the ${ROOM_WORD[ROOM_FOR_COLUMN[report.weakest]]} is the bottleneck.`;

        // the buttons
        const digPrice = digCost(state.chambers);
        ui.digBtn.classList.toggle('is-locked', state.minerals < digPrice);
        setTooltip(ui.digBtn, mineralCost(digPrice));

        const free = freeChamber(layout) >= 0;
        for (const { type, el } of ui.roomBtns) {
            const price = roomCost(type, state.rooms[type] || 0);
            el.classList.toggle('is-locked', !free || state.minerals < price);
            setTooltip(el, mineralCost(price));
        }

        const weakType = ROOM_FOR_COLUMN[report.weakest];
        const levelPrice = levelCost(weakType, state.level[weakType] || 0);
        ui.levelBtn.classList.toggle('is-locked', state.stars < levelPrice);
        setTooltip(ui.levelBtn, roomMark(weakType) + starCost(levelPrice));

        // automation is teased only once the first level is bought
        const anyLevel = Object.values(state.level).some((l) => l > 0);
        ui.autoBtn.classList.toggle('hidden', !anyLevel);
        if (anyLevel) {
            const autoPrice = automationCost(weakType, state.auto[weakType] || 0);
            ui.autoBtn.classList.toggle('is-locked', !(state.stars >= autoPrice));
            setTooltip(ui.autoBtn, Number.isFinite(autoPrice) ? roomMark(weakType) + starCost(autoPrice) : roomMark(weakType));
        }
        setTooltip(ui.cryoBtn, 'soon');
        scheduleIconRefresh();
    }

    function afterChange() {
        report = dryRun();
        scene?.setState(state, layout);
        updateChrome();
        saveGame();
    }

    // --- buying ---
    function dig() {
        const price = digCost(state.chambers);
        if (state.minerals < price) return;
        state.minerals -= price;
        state.chambers += 1;
        layout.slots.push(null);
        afterChange();
    }
    function buildRoom(type) {
        const slot = freeChamber(layout);
        if (slot < 0) return;
        const price = roomCost(type, state.rooms[type] || 0);
        if (state.minerals < price) return;
        state.minerals -= price;
        state.rooms[type] = (state.rooms[type] || 0) + 1;
        layout.slots[slot] = type;
        afterChange();
    }
    /** Levels the room type that fixes the weakest column: the dot is the instruction. */
    function levelWeakest() {
        const type = ROOM_FOR_COLUMN[report.weakest];
        const price = levelCost(type, state.level[type] || 0);
        if (state.stars < price) return;
        state.stars -= price;
        state.level[type] += 1;
        afterChange();
    }
    function automateWeakest() {
        const type = ROOM_FOR_COLUMN[report.weakest];
        const price = automationCost(type, state.auto[type] || 0);
        if (!Number.isFinite(price) || state.stars < price) return;
        state.stars -= price;
        state.auto[type] += 1;
        afterChange();
    }

    ui.digBtn.addEventListener('click', dig, { signal });
    for (const { type, el } of ui.roomBtns) el.addEventListener('click', () => buildRoom(type), { signal });
    ui.levelBtn.addEventListener('click', levelWeakest, { signal });
    ui.autoBtn.addEventListener('click', automateWeakest, { signal });
    ui.resetBtn.addEventListener('click', () => { scene?.resetView(); ui.resetBtn.classList.remove('is-on'); }, { signal });
    window.addEventListener('resize', () => scene?.resize(), { signal });
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // --- the calendar: one real second is one colony day ---
    let lastDayAt = performance.now();
    function dayTick() {
        const now = performance.now();
        const elapsed = Math.round((now - lastDayAt) / 1000);
        // Away from the tab the timer is throttled. Catch up a little, never a
        // whole night: there is no offline progress in the deep yet.
        const days = Math.max(1, Math.min(MAX_CATCHUP_DAYS, elapsed));
        lastDayAt = now;
        for (let i = 0; i < days; i++) report = tickDay(state, state.asleep);
        scene?.setState(state, layout);
        updateChrome();
        saveGame();
    }
    dayInterval = setInterval(dayTick, 1000);

    // --- frames: the people walk, the camera drifts; no game time here ---
    let lastFrame = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        scene?.step(dt);
        rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    scene?.setState(state, layout);
    updateChrome();
    saveGame();

    // --- hooks ---
    window.rpiDeep = { get state() { return state; }, get layout() { return layout; }, get report() { return report; }, scene };
    let debugOn = false;
    try { debugOn = window.location.search.includes('debug') || localStorage.getItem(DEBUG_KEY) === '1'; } catch { /* ignore */ }
    if (debugOn) {
        window.debug_deep = (what) => {
            if (what === 'minerals') state.minerals += 1e6;
            else if (what === 'stars') state.stars += 1e8;
            else if (what === 'day100') { for (let i = 0; i < 100; i++) report = tickDay(state, state.asleep); }
            afterChange();
        };
    }
}

export function teardown() {
    saveGame_onTeardown();
    if (abortController) abortController.abort();
    abortController = null;
    clearInterval(dayInterval);
    dayInterval = null;
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
    try { scene?.dispose(); } catch (e) { console.warn('the deep: dispose', e); }
    scene = null;
    document.body.classList.remove('in-deep');
    delete window.rpiDeep;
    delete window.debug_deep;
    savingEnabled = true;
}

/** The save on the way out lives on the state the closure still holds. */
function saveGame_onTeardown() {
    const held = window.rpiDeep;
    if (!held || !savingEnabled || window.__rpiSkipSave) return;
    saveToStorage(SAVE_KEY, serializeDeep(held.state, held.layout));
}
