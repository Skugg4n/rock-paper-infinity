import { phases, setPhase } from './src/gamePhase.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE4_CONSTANTS, DEBUG_KEY } from './src/constants.js';
import { preloadIcons, replaceIcons } from './src/icons.js';
import { VERSION } from './src/version.js';
import { playChapterCard } from './src/chapterCard.js';
import { initPerf } from './src/perf.js';
import { CHECKPOINTS, jumpTo, snapshot, restore, slotInfo } from './src/checkpoints.js';
import { MODULE_PATHS } from './src/modules.js';

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
  document.body.classList.toggle('paused', on);
  pauseBtn.setAttribute('aria-label', on ? 'Play' : 'Pause');
  pauseBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  pauseBtn.replaceChildren(iconSvg(on ? 'Play' : 'Pause') || document.createTextNode(on ? '▶' : 'II'));
}
pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); setPaused(!window.__rpiPaused); pauseBtn.blur(); });
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
  if (on) renderTestMenu();
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

async function bootstrap() {
  try {
    await preloadIcons();
    replaceIcons();
  } catch (err) {
    console.error('Failed to preload icons', err);
  }

  const isFreshPlayer =
    !localStorage.getItem(PHASE1_CONSTANTS.SAVE_KEY) &&
    !localStorage.getItem(PHASE2_CONSTANTS.SAVE_KEY) &&
    !localStorage.getItem(PHASE4_CONSTANTS.SAVE_KEY);

  if (isFreshPlayer) {
    await playChapterCard({ roman: 'I', title: 'TRIVIAL' });
  }

  const savedPhase = localStorage.getItem(PHASE_KEY) || phases.INDUSTRY;
  await setPhase(savedPhase);
}

bootstrap()
  .then(() => { try { sessionStorage.removeItem(RECOVERY_FLAG); } catch { /* ignore */ } })
  .catch(recoverFromStaleCache);
