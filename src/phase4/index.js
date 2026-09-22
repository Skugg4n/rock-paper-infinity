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
    initialDeepState, tickDay, sleep, digCost, roomCost, levelCost, automationCost,
    ROOM_FOR_COLUMN, COLUMN, ROOMS, DAYS_PER_YEAR, RESURFACE_AT, CRYO, CHAPTER_V,
    cryoLabel, group, probeCost, PROBE_ENERGY, launchProbe, resolveDueProbes,
    clearChamber, clearDarkType, stalledRooms, ascentOffered, attemptAscent, ASCENT,
} from './deep.js';
import { initialLayout, freeChamber, normalizeLayout } from './layout.js';
import { createScene, supportsWebGL, ROOM_ICON } from './scene.js';
import { createCrust } from './crust.js';
import { createReplay } from './replay.js';
import { serializeDeep, saveToStorage, loadFromStorage } from './persistence.js';
import { playChapterCard } from '../chapterCard.js';
import { doomsday } from '../phase3/war.js';

const { SAVE_KEY, MAX_CATCHUP_DAYS } = PHASE4_CONSTANTS;
const BAR_H = 160;                 // the track's height in CSS pixels
/** What the advisor calls the room that fixes each column. */
const ROOM_WORD = { mine: 'mine', farm: 'farm', generator: 'generator', dorm: 'dormitory' };
const ROOM_WORDS = { mine: 'mines', farm: 'farms', generator: 'generators', dorm: 'dormitories' };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** How long a cryo press takes in real time: the walk in, the counter, the walk out. */
export const SLEEP_TIMING = { gather: 1.5, spin: 2.5, release: 1.2 };

let abortController = null;
let dayInterval = null;
let rafId = 0;
let scene = null;
let crust = null;
let replay = null;
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
        cryoBadge: document.getElementById('deep-cryo-badge'),
        cryoUpBtn: document.getElementById('deep-cryo-up'),
        cryoUpBadge: document.getElementById('deep-cryo-up-badge'),
        probeBtn: document.getElementById('deep-probe-btn'),
        ascendBtn: document.getElementById('deep-ascend-btn'),
        resetBtn: document.getElementById('deep-reset-view'),
        crust: document.getElementById('deep-crust'),
        replay: document.getElementById('deep-replay'),
        root: document.getElementById('phase-deep'),
    };
    crust = createCrust(ui.crust, { onIcons: scheduleIconRefresh });
    replay = createReplay(ui.replay, { onIcons: scheduleIconRefresh, format: formatCount });

    // --- the model ---
    if (supportsWebGL()) {
        try {
            scene = createScene(ui.sceneHost, {
                labelHost: ui.labelHost,
                onInteract: () => ui.resetBtn.classList.add('is-on'),
                onLabels: scheduleIconRefresh,
                onClearDark: (slot) => clearDark(slot),
            });
        } catch (e) {
            console.error('the deep: the model could not be built', e);
            scene = null;
        }
    }
    if (!scene) ui.fallback.classList.add('is-on');

    // A sleep or the climb is playing: the clock is stopped and nothing is clickable.
    let busy = false;
    let advisorLine = '';           // what the wake-up said, until the strip goes away
    let spin = null;                // the counter running up: { from, to, k, dur, resolve }

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

    /** The three numbers of the calendar. Split out because the sleep spins them on
     *  their own, sixty times a second, and must touch nothing else. */
    function drawClock(day) {
        const cal = calendar(day);
        ui.year.textContent = group(cal.year);
        ui.month.textContent = cal.month;
        ui.dayOfMonth.textContent = cal.day;
    }

    function updateChrome() {
        const cal = calendar(state.day);
        drawClock(state.day);
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
        ui.advisor.textContent = advisorLine
            || `Year ${cal.year}: the ${ROOM_WORD[ROOM_FOR_COLUMN[report.weakest]]} is the bottleneck.`;

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
        // ---- cryo: the first press digs the hall, every press after it is a sleep ----
        const tier = state.cryo;
        const owns = tier >= 0;
        ui.cryoBadge.classList.toggle('hidden', !owns);
        if (owns) {
            ui.cryoBadge.textContent = cryoLabel(CRYO[tier].days);
            ui.cryoBtn.classList.toggle('is-locked', busy);
            setTooltip(ui.cryoBtn, `${roomMark('cryo')}<span class="deep-mono">${cryoLabel(CRYO[tier].days)}</span>`);
        } else {
            ui.cryoBtn.classList.toggle('is-locked', busy || !free || state.stars < CRYO[0].cost);
            setTooltip(ui.cryoBtn, roomMark('cryo') + starCost(CRYO[0].cost));
        }
        // the next tier is not on screen until the colony could pay for it
        const nextTier = owns ? CRYO[tier + 1] : null;
        const teased = !!nextTier && state.stars >= nextTier.cost;
        ui.cryoUpBtn.classList.toggle('hidden', !teased);
        if (teased) {
            ui.cryoUpBadge.textContent = cryoLabel(nextTier.days);
            ui.cryoUpBtn.classList.toggle('is-locked', busy);
            setTooltip(ui.cryoUpBtn, roomMark('cryo') + starCost(nextTier.cost));
        }

        // ---- probes: they belong to the wake-up rhythm, so they arrive with cryo ----
        const probesOn = owns || state.probesSent > 0 || state.probes.length > 0;
        ui.probeBtn.classList.toggle('hidden', !probesOn);
        if (probesOn) {
            const price = probeCost(state.probesSent);
            ui.probeBtn.classList.toggle('is-locked', busy || state.minerals < price || parts.E < PROBE_ENERGY);
            setTooltip(ui.probeBtn, mineralCost(price) + cost(PROBE_ENERGY, 'zap'));
        }

        // ---- the way up: greyed from the first second, open on what the colony believes ----
        ui.ascendBtn.classList.toggle('is-locked', busy || !ascentOffered(state));
        setTooltip(ui.ascendBtn, mineralCost(ASCENT.minerals) + starCost(ASCENT.stars) + cost(ASCENT.humans, 'users'));

        crust.update({ est: state.est, revealed: state.estRevealed, pending: (state.probes || []).length });
        scheduleIconRefresh();
    }

    function afterChange() {
        report = dryRun();
        scene?.setState(state, layout);
        updateChrome();
        saveGame();
    }

    /** Buying anything for a room type is how a fault is cleared: the stall mark goes, and
     *  whatever took a chamber of that kind is driven out of it. The books are kept in deep.js. */
    function mendType(type) {
        if (state.stalled && state.stalled[type]) delete state.stalled[type];
        clearDarkType(state, layout.slots, type);
    }
    /** Or by clicking the dark plate itself, which is what the marker is for. */
    function clearDark(slot) {
        if (busy || !clearChamber(state, layout.slots, slot)) return;
        afterChange();
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
        mendType(type);
        afterChange();
    }
    /** Levels the room type that fixes the weakest column: the dot is the instruction. */
    function levelWeakest() {
        const type = ROOM_FOR_COLUMN[report.weakest];
        const price = levelCost(type, state.level[type] || 0);
        if (state.stars < price) return;
        state.stars -= price;
        state.level[type] += 1;
        mendType(type);
        afterChange();
    }
    function automateWeakest() {
        const type = ROOM_FOR_COLUMN[report.weakest];
        const price = automationCost(type, state.auto[type] || 0);
        if (!Number.isFinite(price) || state.stars < price) return;
        state.stars -= price;
        state.auto[type] += 1;
        mendType(type);
        afterChange();
    }

    // --- cryo: the hall, the ladder, and the press that spends a century -------
    function buyCryoHall() {
        const slot = freeChamber(layout);
        if (slot < 0 || state.stars < CRYO[0].cost) return;
        state.stars -= CRYO[0].cost;
        state.cryo = 0;
        state.rooms.cryo = (state.rooms.cryo || 0) + 1;
        layout.slots[slot] = 'cryo';
        afterChange();
    }
    function buyCryoTier() {
        const next = CRYO[state.cryo + 1];
        if (!next || state.stars < next.cost) return;
        state.stars -= next.cost;
        state.cryo += 1;
        afterChange();
    }
    function pressCryo() {
        if (state.cryo < 0) { buyCryoHall(); return; }
        doSleep(CRYO[state.cryo].days).catch((e) => console.error('the deep: the sleep broke', e));
    }

    /** The counter runs up like an odometer: slow off the mark, then flying, then a long
     *  stop. The days themselves were already spent by `sleep()`; this is only the dial. */
    const odometer = (k) => k * k * k * (k * (k * 6 - 15) + 10);
    function spinTo(from, to, seconds) {
        if (!(to > from)) { drawClock(to); return Promise.resolve(); }
        // Same wall clock behind the frames as the march has: a tab nobody is watching gets no
        // frames, and the counter must still arrive at the year it slept to.
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                clearTimeout(guard);
                spin = null;
                drawClock(to);
                resolve();
            };
            const guard = setTimeout(finish, Math.ceil(Math.max(0.1, seconds) * 1000) + 400);
            spin = { from, to, k: 0, dur: Math.max(0.1, seconds), resolve: finish };
        });
    }

    /** The one sentence the advisor is allowed after a sleep. The strip says the rest. */
    function wakeLine(sum, landed) {
        const news = landed.map((l) => l.outcome);
        const year = group(calendar(state.day).year);
        const ran = ROOMS.filter((t) => (state.rooms[t] || 0) > 0 && !state.stalled[t]);
        const stopped = Object.keys(state.stalled || {});
        const said = [];
        if (ran.length) said.push(`the ${ROOM_WORDS[ran[0]]} ran`);
        if (stopped.length) said.push(`the ${ROOM_WORD[stopped[0]]} stalled`);
        if (news.indexOf('monster') >= 0) said.push('something came back with the probe');
        else if (news.indexOf('wrong') >= 0) said.push('the probe read badly');
        else if (news.indexOf('reading') >= 0) said.push('a probe came back');
        else if (news.indexOf('lost') >= 0) said.push('a probe did not');
        if (sum.wokenEarly) said.push('the sensor woke us');
        // the first clause runs on from the year, the rest are sentences of their own
        const line = said.map((t, i) => (i ? t.charAt(0).toUpperCase() + t.slice(1) : t)).join('. ');
        return `Year ${year}: ${line}.`;
    }

    /**
     * One press of the snowflake. Everyone walks into the hall, the rules run the years
     * exactly once, the counter catches up, and they pour out to whatever is left.
     * The day timer is stopped for the whole of it, so no day is ever lived twice.
     */
    async function doSleep(days) {
        if (busy) return;
        setBusy(true);
        stopClock();
        replay.hide();
        advisorLine = '';
        ui.root.classList.add('is-sleeping');
        const day0 = state.day;
        await (scene ? scene.gather(SLEEP_TIMING.gather) : Promise.resolve());
        const sum = sleep(state, days);
        state.stalled = stalledRooms(state, sum);
        const landed = resolveDueProbes(state, layout.slots, Math.random);
        saveGame();
        await spinTo(day0, state.day, SLEEP_TIMING.spin);
        ui.root.classList.remove('is-sleeping');
        scene?.setState(state, layout);
        await (scene ? scene.release(SLEEP_TIMING.release) : Promise.resolve());
        report = dryRun();
        advisorLine = wakeLine(sum, landed);
        replay.show({
            rooms: state.rooms, stalled: state.stalled,
            minerals: sum.minerals, food: sum.food, stars: sum.stars, weakest: sum.weakest,
        });
        setBusy(false);
        startClock();
        updateChrome();
        saveGame();
    }

    // --- probes ---------------------------------------------------------------
    function sendProbe() {
        // the ore is deep.js's business; the spare power is the chrome's, because the E column
        // is a flow and not a stock: a colony with no headroom cannot get one off the ground
        if (report.parts.E < PROBE_ENERGY) return;
        if (launchProbe(state)) afterChange();
    }

    // --- the way up -----------------------------------------------------------
    /** The door opens on the estimate; what is behind it is the truth. A colony that
     *  guessed wrong loses a quarter of itself and gets its doubt back. */
    async function pressAscent() {
        if (busy || !ascentOffered(state)) return;
        setBusy(true);
        stopClock();
        const out = attemptAscent(state);
        saveGame();
        if (!out.success) {
            advisorLine = `Year ${group(calendar(state.day).year)}: `
                + `${formatCount(out.lost)} went up. Nobody came back.`;
            report = dryRun();
            scene?.setState(state, layout);
            setBusy(false);
            startClock();
            updateChrome();
            return;
        }
        replay.hide();
        await (scene ? scene.ascend(2.0) : Promise.resolve());
        crust.lighten();
        await delay(700);
        playChapterCard({ roman: CHAPTER_V.roman, title: CHAPTER_V.title, mode: 'to-come', dark: true });
    }

    function setBusy(on) {
        busy = on;
        ui.root.classList.toggle('is-busy', on);
        updateChrome();
    }

    /** Nothing is clickable while the years are running. */
    const guarded = (fn) => () => { if (!busy) fn(); };

    ui.digBtn.addEventListener('click', guarded(dig), { signal });
    for (const { type, el } of ui.roomBtns) el.addEventListener('click', guarded(() => buildRoom(type)), { signal });
    ui.levelBtn.addEventListener('click', guarded(levelWeakest), { signal });
    ui.autoBtn.addEventListener('click', guarded(automateWeakest), { signal });
    ui.cryoBtn.addEventListener('click', guarded(pressCryo), { signal });
    ui.cryoUpBtn.addEventListener('click', guarded(buyCryoTier), { signal });
    ui.probeBtn.addEventListener('click', guarded(sendProbe), { signal });
    ui.ascendBtn.addEventListener('click', () => pressAscent(), { signal });
    // the replay strip stays until the next thing the player does
    ui.root.addEventListener('click', () => { if (replay.visible()) replay.hide(); }, { signal, capture: true });
    ui.resetBtn.addEventListener('click', () => { scene?.resetView(); ui.resetBtn.classList.remove('is-on'); }, { signal });
    window.addEventListener('resize', () => scene?.resize(), { signal });
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // --- the calendar: one real second is one colony day ---
    let lastDayAt = performance.now();
    function dayTick() {
        if (busy) return;
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
    /** Stopping and starting the calendar is how a sleep avoids living a day twice:
     *  the interval is gone for the whole press, and the clock starts from now when it
     *  comes back, so nothing is caught up either. */
    function stopClock() {
        if (dayInterval) clearInterval(dayInterval);
        dayInterval = null;
    }
    function startClock() {
        stopClock();
        lastDayAt = performance.now();
        dayInterval = setInterval(dayTick, 1000);
    }
    startClock();

    // --- frames: the people walk, the camera drifts; no game time here ---
    let lastFrame = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        if (spin) {
            spin.k = Math.min(1, spin.k + dt / spin.dur);
            drawClock(spin.from + (spin.to - spin.from) * odometer(spin.k));
            if (spin.k >= 1) spin.resolve();
        }
        scene?.step(dt);
        rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    scene?.setState(state, layout);
    updateChrome();
    saveGame();

    // A colony that already climbed is finished: the wall stands again on every reload.
    if (state.ascended) {
        crust.lighten();
        playChapterCard({ roman: CHAPTER_V.roman, title: CHAPTER_V.title, mode: 'to-come', dark: true });
    }

    // --- hooks ---
    window.rpiDeep = { get state() { return state; }, get layout() { return layout; }, get report() { return report; }, scene };
    let debugOn = false;
    try { debugOn = window.location.search.includes('debug') || localStorage.getItem(DEBUG_KEY) === '1'; } catch { /* ignore */ }
    if (debugOn) {
        window.debug_deep = (what) => {
            if (what === 'minerals') state.minerals += 1e6;
            else if (what === 'stars') state.stars += 1e8;
            else if (what === 'day100') { for (let i = 0; i < 100; i++) report = tickDay(state, state.asleep); }
            else if (what === 'sleep') { pressCryo(); return; }
            else if (what === 'probe') {
                state.minerals += probeCost(state.probesSent || 0);   // the hook is the flight, not the bill
                launchProbe(state);
            } else if (what === 'ascend') {
                state.minerals = Math.max(state.minerals, ASCENT.minerals);
                state.stars = Math.max(state.stars, ASCENT.stars);
                state.humans = Math.max(state.humans, ASCENT.humans);
                state.est = { mean: RESURFACE_AT - 1, spread: 3 };
                state.estRevealed = true;
                pressAscent();
                return;
            }
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
    try { replay?.destroy(); crust?.destroy(); } catch (e) { console.warn('the deep: chrome dispose', e); }
    replay = null;
    crust = null;
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
