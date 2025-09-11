import { phases, setPhase } from './src/gamePhase.js';
import { preloadIcons, replaceIcons } from './src/icons.js';

await preloadIcons();
replaceIcons();

setPhase(phases.INDUSTRY);
