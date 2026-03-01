import { PHASE_KEY } from './constants.js';

export const phases = {
  INDUSTRY: 'INDUSTRY',
  CITY: 'CITY',
  WAR: 'WAR',
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
