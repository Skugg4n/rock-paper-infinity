import { phases, setPhase } from './src/gamePhase.js';
import { preloadIcons, replaceIcons } from './src/icons.js';
import { VERSION } from './src/version.js';

// Load icons without blocking game initialization
preloadIcons()
  .then(() => replaceIcons())
  .catch(err => console.error('Failed to preload icons', err));

document.getElementById('version-info').textContent = VERSION;

setPhase(phases.INDUSTRY);
