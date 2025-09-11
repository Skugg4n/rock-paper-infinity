import { phases, setPhase } from './src/gamePhase.js';
import { preloadIcons, replaceIcons } from './src/icons.js';

// Load icons without blocking game initialization
preloadIcons()
  .then(() => replaceIcons())
  .catch(err => console.error('Failed to preload icons', err));

setPhase(phases.INDUSTRY);
