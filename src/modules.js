/**
 * Every file the game is made of. Used by main.js to refetch all modules after
 * a failed boot (GitHub Pages' cache can hand the browser a half-old mix).
 * A test compares this list with the files on disk, so a new module cannot be
 * forgotten here again (2026-09-19: war.js was missing, Ola got a dead page).
 */
export const MODULE_PATHS = [
  'index.html', 'main.js', 'style.css', 'style-stage2.css', 'style-deep.css', 'roman.js',
  'src/chapterCard.js', 'src/checkpoints.js', 'src/constants.js', 'src/gamePhase.js',
  'src/icons.js', 'src/modules.js', 'src/perf.js', 'src/save-export.js', 'src/version.js',
  'src/phase1/cost-visual.js', 'src/phase1/countdown.js', 'src/phase1/index.js',
  'src/phase1/persistence.js', 'src/phase1/rates.js', 'src/phase1/rendering.js',
  'src/phase1/star-animation.js', 'src/phase1/upgrade-dashes.js', 'src/phase1/upgrades-config.js',
  'src/phase2/ants.js', 'src/phase2/buildings-config.js', 'src/phase2/economy.js',
  'src/phase2/index.js', 'src/phase2/islands.js', 'src/phase2/layout.js',
  'src/phase2/persistence.js', 'src/phase2/rendering.js',
  'src/phase3/war.js',
  'src/phase4/deep.js', 'src/phase4/index.js', 'src/phase4/layout.js',
  'src/phase4/persistence.js', 'src/phase4/scene.js',
];
