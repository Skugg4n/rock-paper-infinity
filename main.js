import { phases, setPhase } from './src/gamePhase.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS } from './src/constants.js';
import { preloadIcons, replaceIcons } from './src/icons.js';
import { VERSION } from './src/version.js';
import { playChapterCard } from './src/chapterCard.js';

document.getElementById('version-info').textContent = VERSION;

// Hide debug menus unless ?debug is in the URL
if (!window.location.search.includes('debug')) {
  const debugMenu = document.getElementById('debug-menu');
  const debugTrigger = document.getElementById('debug-trigger');
  const p2DebugMenu = document.getElementById('p2-debug-menu');
  const p2DebugToggle = document.getElementById('debug-toggle-btn');
  if (debugMenu) debugMenu.style.display = 'none';
  if (debugTrigger) debugTrigger.style.display = 'none';
  if (p2DebugMenu) p2DebugMenu.style.display = 'none';
  if (p2DebugToggle) p2DebugToggle.style.display = 'none';
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

bootstrap();
