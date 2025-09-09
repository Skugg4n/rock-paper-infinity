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
  switch (phase) {
    case phases.INDUSTRY:
      currentModule = await import('./phase1/index.js');
      return currentModule.init();
    case phases.CITY:
    case phases.WAR:
    case phases.ESCAPE:
    default:
      currentModule = null;
      return;
  }
}
