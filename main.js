import { phases, setPhase } from './src/gamePhase.js';
import { PHASE_KEY, DEBUG_KEY, START_SKIP_FLAG, START_CARD_FLAG } from './src/constants.js';
import { preloadIcons, replaceIcons } from './src/icons.js';
import { VERSION } from './src/version.js';
import { playChapterCard } from './src/chapterCard.js';
import { initPerf } from './src/perf.js';
import { CHECKPOINTS, jumpTo, clearGame, snapshot, restore, slotInfo } from './src/checkpoints.js';
import { MODULE_PATHS } from './src/modules.js';
import { audio } from './src/audio.js';
import { DEEP_VERSION_KEY, currentDeep, nextDeep } from './src/deepVersion.js';
import { showStart, CARD_OF, ACTS } from './src/start.js';
import { migrateReached, markReached } from './src/reached.js';

document.getElementById('version-info').textContent = VERSION;
initPerf();

// The menu, the version line and the test menu live OUTSIDE the phase containers, so
// they belong to the shell. Chapters I and II each wired the toggle themselves, which
// meant the button was simply dead in any chapter that did not (Ola, playing IV in
// v1.40.0: "the menu cannot be clicked"). Wire it once, here, for every chapter there
// will ever be. Each phase still owns what "Reset everything" means for its own save.
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
menuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown?.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if (menuDropdown && !menuDropdown.classList.contains('hidden')
      && !menuDropdown.contains(e.target) && e.target !== menuBtn && !menuBtn?.contains(e.target)) {
    menuDropdown.classList.add('hidden');
  }
});

// Pause: one flag for every chapter. The phases' loops keep running but return
// early while it is set, so resuming is instant and game time stands still.
// Chapters I-III honour it; a chapter that wants pausing reads the same flag.
window.__rpiPaused = false;
function iconSvg(name) {
  const data = typeof lucide !== 'undefined' ? lucide.icons?.[name] : null;
  if (!data || typeof lucide.createElement !== 'function') return null;
  const svg = lucide.createElement(data);
  svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
  return svg;
}
const pauseBtn = document.createElement('button');
pauseBtn.id = 'pause-btn';
pauseBtn.className = 'btn';
pauseBtn.setAttribute('aria-label', 'Pause');
function setPaused(on) {
  window.__rpiPaused = on;
  if (on) audio.stopMachine();
  document.body.classList.toggle('paused', on);
  pauseBtn.setAttribute('aria-label', on ? 'Play' : 'Pause');
  pauseBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  pauseBtn.replaceChildren(iconSvg(on ? 'Play' : 'Pause') || document.createTextNode(on ? '▶' : 'II'));
}
pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); setPaused(!window.__rpiPaused); pauseBtn.blur(); });

// Sound and music on/off in the ☰ menu (src/audio.js keeps and saves the choice).
// The start screen has the same two toggles; it says 'rpi-audio-change' and the menu follows.
const AUDIO_ITEMS = [['sound-toggle', 'sfx', 'Sound'], ['music-toggle', 'music', 'Music']];
function paintAudioMenu() {
  for (const [id, pref, label] of AUDIO_ITEMS) {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = `${label} · ${audio.getPrefs()[pref] ? 'on' : 'off'}`;
  }
}
for (const [id, pref] of AUDIO_ITEMS) {
  document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); audio.setPref(pref, !audio.getPrefs()[pref]); paintAudioMenu(); });
}
paintAudioMenu();
window.addEventListener('rpi-audio-change', paintAudioMenu);
// ☰ → Main menu: the page again, with the start screen in front (New game lives there now)
document.getElementById('main-menu-btn')?.addEventListener('click', () => window.location.reload());
document.getElementById('menu-wrapper')?.appendChild(pauseBtn);
setPaused(false);
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
  e.preventDefault();
  setPaused(!window.__rpiPaused);
});

// Debug menus: on with ?debug in the URL, or five quick clicks on the version
// label bottom-left (persisted in localStorage). Deliberately not in the ☰ menu.
function readDebugFlag() {
  try { return localStorage.getItem(DEBUG_KEY) === '1'; } catch { return false; }
}
function setDebugVisible(on) {
  const debugMenu = document.getElementById('debug-menu');
  const debugTrigger = document.getElementById('debug-trigger');
  const p2DebugMenu = document.getElementById('p2-debug-menu');
  const p2DebugToggle = document.getElementById('debug-toggle-btn');
  // Phase menus are toggled open/closed by their own triggers; here we only
  // decide whether the triggers exist. `''` hands control back to the CSS.
  if (debugTrigger) debugTrigger.style.display = on ? '' : 'none';
  if (p2DebugToggle) p2DebugToggle.style.display = on ? '' : 'none';
  if (!on) {
    if (debugMenu) debugMenu.style.display = 'none';
    if (p2DebugMenu) p2DebugMenu.style.display = 'none';
  } else {
    if (debugMenu) debugMenu.style.display = '';
    if (p2DebugMenu) p2DebugMenu.style.display = '';
  }
  document.getElementById('test-menu')?.classList.toggle('hidden', !on);
  mountDeepItem(on);
  if (on) renderTestMenu();
}

// Debug: which chapter IV is played, colony (the old act), vault or dig (src/deepVersion.js).
// Built like chapter IV's "View" item; a click keeps the next one and, in chapter IV, reloads.
function mountDeepItem(on) {
  document.getElementById('deep-version-toggle')?.remove();
  if (!on) return;
  const menu = document.getElementById('menu-dropdown');
  if (!menu) return;
  const kind = currentDeep();
  const b = document.createElement('button');
  b.id = 'deep-version-toggle';
  b.type = 'button';
  b.className = 'block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 whitespace-nowrap border-b border-slate-100';
  b.textContent = `Deep: ${kind}`;
  b.title = `Play chapter IV as ${nextDeep(kind)}`;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = nextDeep(kind);
    try { localStorage.setItem(DEEP_VERSION_KEY, next); } catch { /* ignore */ }
    const url = new URL(window.location.href);
    url.searchParams.delete('deep');
    if ((localStorage.getItem(PHASE_KEY) || '') === 'DEEP') window.location.assign(url.toString());
    else mountDeepItem(true);
  });
  menu.insertBefore(b, document.getElementById('reset-btn'));
}

// Test menu: checkpoints and snapshot slots (src/checkpoints.js)
function renderTestMenu() {
  const list = document.getElementById('checkpoint-list');
  const slots = document.getElementById('slot-list');
  if (!list || !slots) return;
  list.innerHTML = '';
  for (const cp of CHECKPOINTS) {
    const b = document.createElement('button');
    b.textContent = cp.label;
    b.addEventListener('click', () => jumpTo(cp.id));
    list.appendChild(b);
  }
  slots.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const row = document.createElement('div');
    row.className = 'slot-row';
    const info = slotInfo(i);
    const label = document.createElement('span');
    label.textContent = info ? `${i + 1}: ${info.phase} · ${new Date(info.at).toLocaleTimeString().slice(0, 5)}` : `${i + 1}: empty`;
    const save = document.createElement('button'); save.textContent = 'Save';
    save.addEventListener('click', () => { snapshot(i); renderTestMenu(); });
    const load = document.createElement('button'); load.textContent = 'Load'; load.disabled = !info;
    load.addEventListener('click', () => restore(i));
    row.append(label, save, load);
    slots.appendChild(row);
  }
}
let debugOn = window.location.search.includes('debug') || readDebugFlag();
// 2.5D experiment: ?tilt leans the city like a model (Ola, 2026-09-19)
if (window.location.search.includes('tilt')) document.body.classList.add('tilt');
setDebugVisible(debugOn);
document.getElementById('debug-menu-toggle')?.remove();
// The secret way in: five clicks on the version label within two seconds.
const versionLabel = document.getElementById('version-info');
let versionClicks = [];
let flashTimer = null;
versionLabel?.addEventListener('click', () => {
  const now = Date.now();
  versionClicks = [...versionClicks.filter(t => now - t < 2000), now];
  if (versionClicks.length < 5) return;
  versionClicks = [];
  debugOn = !debugOn;
  try { localStorage.setItem(DEBUG_KEY, debugOn ? '1' : '0'); } catch { /* ignore */ }
  setDebugVisible(debugOn);
  versionLabel.textContent = debugOn ? 'debug on' : 'debug off';
  versionLabel.classList.add('debug-flash');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { versionLabel.textContent = VERSION; versionLabel.classList.remove('debug-flash'); }, 1200);
});

// Files that make up the game. After a deploy, GitHub Pages' 10-minute cache
// can hand the browser a mix of old and new modules; if boot then fails we
// refetch everything once (cache: 'reload') and retry, never touching saves.
const RECOVERY_FLAG = 'rpi-recovered';

async function recoverFromStaleCache(err) {
  let already = false;
  try { already = sessionStorage.getItem(RECOVERY_FLAG) === '1'; } catch { /* ignore */ }
  if (already) {
    console.error('bootstrap failed twice; saves untouched', err);
    const v = document.getElementById('version-info');
    if (v) v.textContent = `${VERSION} — could not start. Close this tab and open the game again (saves are safe).`;
    // One more full refetch in the background so the next open is clean
    await Promise.allSettled(MODULE_PATHS.map(p => fetch(p, { cache: 'reload' })));
    return;
  }
  try { sessionStorage.setItem(RECOVERY_FLAG, '1'); } catch { /* ignore */ }
  console.warn('bootstrap failed; refetching modules and retrying once', err);
  await Promise.allSettled(MODULE_PATHS.map(p => fetch(p, { cache: 'reload' })));
  location.reload();
}

function takeFlag(key) {
  try { const v = sessionStorage.getItem(key); if (v !== null) sessionStorage.removeItem(key); return v; } catch { return null; }
}

async function bootstrap() {
  try {
    await preloadIcons();
    replaceIcons();
  } catch (err) {
    console.error('Failed to preload icons', err);
  }

  migrateReached();   // an older game's saves → the acts reached (once)
  const savedPhase = localStorage.getItem(PHASE_KEY) || phases.INDUSTRY;

  // An act started again from the start screen: its checkpoint reloaded the page with this flag;
  // the act's chapter card, then the act.
  // Both flags are taken at once: a checkpoint reload sets both, and a flag left behind would
  // skip the start screen on the NEXT reload too (☰ → Main menu right after starting an act).
  const skipFlag = takeFlag(START_SKIP_FLAG);
  const cardFor = takeFlag(START_CARD_FLAG);
  if (cardFor && CARD_OF[cardFor]) {
    await playChapterCard({ ...CARD_OF[cardFor], onMidpoint: () => setPhase(savedPhase).catch((e) => console.error('the act failed to start', e)) });
    return;
  }
  // The test menu, the snapshot slots and the headless scripts reload straight into the game.
  const skip = skipFlag !== null || /[?&]go(?=&|$)/.test(window.location.search);
  if (skip) { await setPhase(savedPhase); return; }

  const screen = showStart({ version: VERSION });
  const choice = await screen.choice;
  if (choice.kind === 'continue') {
    screen.lift();
    await setPhase(savedPhase);
  } else if (choice.kind === 'new') {
    clearGame();
    markReached('trivial');
    await playChapterCard({ roman: 'I', title: 'TRIVIAL', onMidpoint: () => screen.lift() });
    await setPhase(phases.INDUSTRY);
  } else if (choice.kind === 'act') {
    const act = ACTS.find((a) => a.id === choice.id);
    if (!act?.checkpoint) { screen.lift(); await setPhase(savedPhase); return; }
    try { sessionStorage.setItem(START_CARD_FLAG, act.id); } catch { /* the act starts without its card */ }
    jumpTo(act.checkpoint);   // writes the act's start, sets the skip flag, reloads
  }
}

bootstrap()
  .then(() => { try { sessionStorage.removeItem(RECOVERY_FLAG); } catch { /* ignore */ } })
  .catch(recoverFromStaleCache);
