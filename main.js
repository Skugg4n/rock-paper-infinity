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

bootstrap().catch(err => console.error('bootstrap failed', err));
