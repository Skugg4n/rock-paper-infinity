import { phases, setPhase } from './src/gamePhase.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS, DEBUG_KEY } from './src/constants.js';
import { preloadIcons, replaceIcons } from './src/icons.js';
import { VERSION } from './src/version.js';
import { playChapterCard } from './src/chapterCard.js';
import { initPerf } from './src/perf.js';

document.getElementById('version-info').textContent = VERSION;
initPerf();

// Debug menus: on with ?debug in the URL or the "Debug menu" item in the ☰
// menu (persisted in localStorage). The invisible trigger sits top-left.
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
  const item = document.getElementById('debug-menu-toggle');
  if (item) item.textContent = on ? 'Debug menu: on' : 'Debug menu';
}
let debugOn = window.location.search.includes('debug') || readDebugFlag();
setDebugVisible(debugOn);
document.getElementById('debug-menu-toggle')?.addEventListener('click', () => {
  debugOn = !debugOn;
  try { localStorage.setItem(DEBUG_KEY, debugOn ? '1' : '0'); } catch { /* ignore */ }
  setDebugVisible(debugOn);
  document.getElementById('menu-dropdown')?.classList.add('hidden');
});

// Files that make up the game. After a deploy, GitHub Pages' 10-minute cache
// can hand the browser a mix of old and new modules; if boot then fails we
// refetch everything once (cache: 'reload') and retry, never touching saves.
const MODULE_PATHS = [
  'index.html', 'main.js', 'style.css', 'style-stage2.css', 'roman.js',
  'src/constants.js', 'src/version.js', 'src/gamePhase.js', 'src/icons.js',
  'src/chapterCard.js', 'src/save-export.js', 'src/perf.js',
  'src/phase1/index.js', 'src/phase1/rendering.js', 'src/phase1/upgrades-config.js',
  'src/phase1/rates.js', 'src/phase1/star-animation.js', 'src/phase1/cost-visual.js',
  'src/phase1/countdown.js', 'src/phase1/persistence.js', 'src/phase1/upgrade-dashes.js',
  'src/phase2/index.js', 'src/phase2/rendering.js', 'src/phase2/buildings-config.js',
  'src/phase2/persistence.js', 'src/phase2/economy.js',
];
const RECOVERY_FLAG = 'rpi-recovered';

async function recoverFromStaleCache(err) {
  let already = false;
  try { already = sessionStorage.getItem(RECOVERY_FLAG) === '1'; } catch { /* ignore */ }
  if (already) {
    console.error('bootstrap failed twice; saves untouched', err);
    const v = document.getElementById('version-info');
    if (v) v.textContent = `${VERSION} — could not start, try a hard reload (saves are safe)`;
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
    !localStorage.getItem(PHASE2_CONSTANTS.SAVE_KEY);

  if (isFreshPlayer) {
    await playChapterCard({ roman: 'I', title: 'TRIVIAL' });
  }

  const savedPhase = localStorage.getItem(PHASE_KEY) || phases.INDUSTRY;
  await setPhase(savedPhase);
}

bootstrap()
  .then(() => { try { sessionStorage.removeItem(RECOVERY_FLAG); } catch { /* ignore */ } })
  .catch(recoverFromStaleCache);
