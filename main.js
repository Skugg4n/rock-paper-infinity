import { phases, setPhase } from './src/gamePhase.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS } from './src/constants.js';
import { preloadIcons, replaceIcons } from './src/icons.js';
import { VERSION } from './src/version.js';
import { playChapterCard } from './src/chapterCard.js';

document.getElementById('version-info').textContent = VERSION;

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
