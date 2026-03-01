import { phases, setPhase } from './src/gamePhase.js';
import { PHASE_KEY } from './src/constants.js';
import { preloadIcons, replaceIcons } from './src/icons.js';
import { VERSION } from './src/version.js';

document.getElementById('version-info').textContent = VERSION;

async function bootstrap() {
  try {
    await preloadIcons();
    replaceIcons();
  } catch (err) {
    console.error('Failed to preload icons', err);
  }

  const savedPhase = localStorage.getItem(PHASE_KEY) || phases.INDUSTRY;
  await setPhase(savedPhase);
}

bootstrap();
