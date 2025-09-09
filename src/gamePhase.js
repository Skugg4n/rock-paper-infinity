export const phases = {
  INDUSTRY: 'INDUSTRY',
  CITY: 'CITY',
  WAR: 'WAR',
  ESCAPE: 'ESCAPE'
};

const handlers = {
  [phases.INDUSTRY]: async () => {
    const module = await import('./phase1/index.js');
    return module.init();
  },
  [phases.CITY]: () => {},
  [phases.WAR]: () => {},
  [phases.ESCAPE]: () => {}
};

export async function setPhase(phase) {
  const handler = handlers[phase];
  if (handler) {
    return handler();
  }
}
