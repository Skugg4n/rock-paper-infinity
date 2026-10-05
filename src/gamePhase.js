import { PHASE_KEY } from './constants.js';
import { chosenDeep, deepModule, mountDeepItem, DEEP_VERSION_KEY } from './deepVersion.js';

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
  document.getElementById('deep-version-toggle')?.remove();

  // Hide all phase containers
  document.querySelectorAll('.phase-container').forEach(el => el.classList.add('hidden'));

  // Show the target container
  const containerMap = {
    [phases.INDUSTRY]: 'phase-industry',
    [phases.CITY]: 'phase-city',
    [phases.DEEP]: 'phase-deep',
  };
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
    case phases.DEEP: {
      // three versions of chapter IV: colony (phase4), dig (phase4d), vault (phase4v)
      let stored = null;
      try { stored = localStorage.getItem(DEEP_VERSION_KEY); } catch { /* ignore */ }
      const version = chosenDeep(window.location.search, stored);
      try { currentModule = await import(deepModule(version)); } catch { currentModule = await import('./phase4/index.js'); }
      const out = await currentModule.init();
      mountDeepItem(version);
      return out;
    }
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
