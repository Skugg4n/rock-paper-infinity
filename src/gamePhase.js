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
      if (!document.getElementById('game-board-container')) {
        window.location.href = './index.html';
        currentModule = null;
        return;
      }
      currentModule = await import('./phase1/index.js');
      return currentModule.init();
    case phases.CITY:
      if (!document.getElementById('land-grid')) {
        window.location.href = './stage-2.html';
        currentModule = null;
        return;
      }
      currentModule = await import('./phase2/index.js');
      return currentModule.init();
    case phases.WAR:
    case phases.ESCAPE:
    default:
      currentModule = null;
      return;
  }
}
