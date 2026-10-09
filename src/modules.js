/**
 * Every file the game is made of. Used by main.js to refetch all modules after
 * a failed boot (GitHub Pages' cache can hand the browser a half-old mix).
 * A test compares this list with the files on disk, so a new module cannot be
 * forgotten here again (2026-09-19: war.js was missing, Ola got a dead page).
 */
export const MODULE_PATHS = [
  'index.html', 'main.js', 'style.css', 'style-stage2.css', 'style-deep.css', 'style-interim.css', 'roman.js', 'src/interim.js',
  'src/audio.js', 'src/audio-city.js', 'src/audio-war.js', 'src/chapterCard.js', 'src/checkpoints.js', 'src/constants.js', 'src/gamePhase.js',
  'src/deepVersion.js', 'src/icons.js', 'src/modules.js', 'src/perf.js', 'src/save-export.js', 'src/version.js',
  'src/phase1/cost-visual.js', 'src/phase1/countdown.js', 'src/phase1/factory-view.js', 'src/phase1/index.js',
  'src/phase1/persistence.js', 'src/phase1/rates.js', 'src/phase1/rendering.js',
  'src/phase1/upgrade-dashes.js', 'src/phase1/upgrades-config.js',
  'src/phase2/ants.js', 'src/phase2/buildings-config.js', 'src/phase2/economy.js',
  'src/phase2/index.js', 'src/phase2/islands.js', 'src/phase2/layout.js',
  'src/phase2/persistence.js', 'src/phase2/rendering.js',
  'src/phase3/war.js',
  'src/phase4/advisor.js', 'src/phase4/crust.js', 'src/phase4/deep.js', 'src/phase4/drawer.js',
  'src/phase4/flesh.js', 'src/phase4/graft.js', 'src/phase4/grow.js', 'src/phase4/growth.js', 'src/phase4/hands.js', 'src/phase4/index.js',
  'src/phase4/instruments.js', 'src/phase4/layout.js', 'src/phase4/machine-model.js',
  'src/phase4/machine.js', 'src/phase4/organ-art.js', 'src/phase4/organs.js', 'src/phase4/panel.js', 'src/phase4/persistence.js', 'src/phase4/policy.js',
  'src/phase4/readout.js', 'src/phase4/replay.js', 'src/phase4/scene.js', 'src/phase4/sound.js', 'src/phase4/strata.js',
  'src/phase4/strata-view.js', 'src/phase4/surface.js',
  'src/phase4d/alarms.js', 'src/phase4d/autopilot.js', 'src/phase4d/base.js', 'src/phase4d/dig.js', 'src/phase4d/hazards.js', 'src/phase4d/index.js', 'src/phase4d/quantum.js', 'src/phase4d/render.js', 'src/phase4d/sound.js', 'src/phase4d/world.js',
  'src/phase4/tree-view.js', 'src/phase4/tree.js', 'src/phase4/view-hooks.js', 'src/phase4/views.js', 'src/phase4/watcher.js',
  'src/phase4v/checkpoints.js', 'src/phase4v/index.js', 'src/phase4v/sound.js', 'src/phase4v/story.js', 'src/phase4v/style.js', 'src/phase4v/tutorial.js', 'src/phase4v/vault.js', 'src/phase4v/view.js', 'src/phase4v/wishes.js',
  'src/phase5/checkpoints.js', 'src/phase5/globe.js', 'src/phase5/index.js', 'src/phase5/sound.js', 'src/phase5/style.js', 'src/phase5/terrain.js', 'src/phase5/unity.js', 'src/phase5/view.js',
];
