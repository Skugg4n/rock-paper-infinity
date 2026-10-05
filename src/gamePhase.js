import { PHASE_KEY } from './constants.js';
import { currentDeep, deepModule } from './deepVersion.js';

export const phases = {
  INDUSTRY: 'INDUSTRY',
  CITY: 'CITY',
  WAR: 'WAR',
  DEEP: 'DEEP',
  ESCAPE: 'ESCAPE'
};

let currentModule = null;

export async function setPhase(phase) {
  if (currentModule && typeof currentModule.teardown === 'function') {
    currentModule.teardown();
  }

  // Hide all phase containers
  document.querySelectorAll('.phase-container').forEach(el => el.classList.add('hidden'));

  // Show the target container
  const containerMap = {
    [phases.INDUSTRY]: 'phase-industry',
    [phases.CITY]: 'phase-city',
    [phases.DEEP]: 'phase-deep',
  };
  // the new chapter IVs (vault, dig) build their own screens; the old act's container stays hidden
  const deep = phase === phases.DEEP ? currentDeep() : null;
  if (deep && deep !== 'colony') delete containerMap[phases.DEEP];
  const containerId = containerMap[phase];
  if (containerId) {
    document.getElementById(containerId)?.classList.remove('hidden');
  }

  // Persist phase
  localStorage.setItem(PHASE_KEY, phase);

  switch (phase) {
    case phases.INDUSTRY:
      currentModule = await import('./phase1/index.js');
      return currentModule.init();
    case phases.CITY:
      currentModule = await import('./phase2/index.js');
      return currentModule.init();
    case phases.DEEP:
      try {
        currentModule = await import(deepModule(deep));
      } catch (e) {
        // a version that is not in this build (or failed to load) falls back to the old act
        if (deep === 'colony') throw e;
        console.warn(`chapter IV "${deep}" could not load; the colony instead`, e);
        document.getElementById('phase-deep')?.classList.remove('hidden');
        currentModule = await import('./phase4/index.js');
      }
      return currentModule.init();
    case phases.WAR:
    case phases.ESCAPE:
    default:
      currentModule = null;
      return;
  }
}

// Expose for debug buttons
window.setPhase = setPhase;
window.phases = phases;
