# Rock, Paper, Infinity — Project Plan

## Phase 1–13: Initial Development (v0.1 → v1.3.13)
See git history (49 merged PRs). Core game loop, upgrade system, Phase 2 city builder, UI polish, and bug fixes.

## Phase 14: Project Cleanup & Stability (v1.4.0)
- [x] Set up project documentation (CLAUDE.md, INDEX.md, LESSONS.md, PROJECTPLAN.md)
- [x] Audit and document known bugs
- [x] Run `npm install` and verify `npm test` and `npm run lint` pass
- [x] Clean up legacy root SVGs — 37 duplicates deleted (v1.4.0)
- [x] Centralize constants in `src/constants.js` (v1.4.0)
- [x] Extract Phase 2 inline styles to `style-stage2.css` (v1.4.0)
- [x] Standardize code language to English (v1.4.0)
- [x] Fix package.json (main, type, description) (v1.4.0)
- [x] Remove `firebase-debug.log` and add it to `.gitignore` (v1.8.0)
- [x] Fix `stage-2.html` title version inconsistency — moot, now a redirect (v1.7.0)
- [x] Add `.DS_Store` to `.gitignore` (v1.8.0)
- [x] Remove `/graphics/` legacy SVGs (v1.8.0)

## Phase 15: Critical & High-Priority Bug Fixes (v1.4.1)
- [x] **P2: Fix event listener memory leak** — WeakSet prevents duplicate listeners in setTooltip()
- [x] **P2: Stop calling lucide.createIcons() in tick loops** — debounced via scheduleIconRefresh()
- [x] **P2: Separate updateAllUI() from fastUiTick** — moved to logicTick (1/s)
- [x] **P1: Fix double energy generation** — main pool fills first, overflow to reserve
- [x] **P1: Fix sell refund calculation** — level decremented first, then cost() × 0.75
- [x] **P1: Fix consumeEnergy order** — main energy drained first, reserve as backup
- [x] **P2: Fix supply display rate** — removed ÷20 mismatch, rate matches display
- [x] **P2: Fix background tab throttling** — star/science accumulation moved to logicTick
- [x] **P2: Fix beforeunload listener leak** — removed in teardown() via saveGameStateRef
- [x] **P1: Fix teardown() event listener cleanup** — AbortController removes all listeners

## Phase 16: Medium-Priority Bug Fixes (v1.4.2)
- [x] **P1: Fix starMultiplier overwrite** — mergeToMetaBoard uses *= 10, skips on load
- [x] **P1: Fix quantum foam calculation** — uses energyToConsume instead of gamesToPlay
- [x] **P1: Fix tooltip timeout race** — clearTimeout cancels pending hide on new show
- [x] **P2: Sync allocation slider on load** — slider value set from saved populationAllocation
- [x] **P2: Floor stars at 0** — Math.max(0, ...) prevents negative stars and science
- [x] **P2: Improve starvation death rate** — scales with 5% of deficit, min 1 death/tick
- [x] **P2: Fix stage-2.html bypassing gamePhase.js** — SPA refactor (v1.7.0)

## Phase 17: Code Quality (v1.5.0 → v1.8.0)
- [x] Split `src/phase1/index.js` into smaller modules — extracted rates.js, cost-visual.js, countdown.js, persistence.js (v1.8.0)
- [x] Centralize localStorage key constants (done in `src/constants.js`, v1.4.0)
- [x] Add proper error handling for save/load (v1.9.0)
- [x] Improve test coverage — 24 tests total: roman.js, rates.js, persistence.js (v1.8.0)
- [x] Set up Jest ESM support — `--experimental-vm-modules`, `jest.config.js` (v1.8.0)
- [x] Unify icon system — both phases now use Lucide CDN (v1.5.0)
- [x] Convert `roman.js` to ES module — proper `export`, imported via module chain (v1.8.0)

## Phase 17b: Phase 2 Endgame Expansion (v1.6.0)
- [x] **Superconductors upgrade** — 5-level multi-buy, doubles stars/person per level. Unlocks at 10k pop.
- [x] **Second land expansion** — +5 grid slots at 10k pop, costs 10M stars. Requires first expansion.
- [x] **Competitor teaser** — Red factory island fades in at 50k pop. Phase 3 (WAR) foreshadowing.

## Phase 17c: SPA Refactor (v1.7.0)
- [x] **Single HTML shell** — Merged index.html + stage-2.html into one file with phase containers
- [x] **Phase persistence** — PHASE_KEY in localStorage, reload stays in correct phase
- [x] **CSS scoping** — Phase 2 conflicting selectors prefixed with #phase-city
- [x] **stage-2.html redirect** — Backwards compatibility
- [x] **Phase 2 AbortController** — All event listeners use { signal } for clean teardown

## Phase 18: UX Polish & New Features (v1.8.0)
- [x] **P1: Change Bank icon** — Replaced wallet with landmark icon (v1.8.0)
- [x] **P1: Remove Bank tooltip text** — Stripped verbose tooltip (v1.8.0)
- [x] **P2: Mobile responsiveness** — Building slots, buttons, icons, sliders all responsive 320px–1024px (v1.8.0)
- [ ] **P2: "Code Processor" upgrade** — Unlockable upgrade that animates transition from icon-only UI to icon+text labels. Gives in-world justification for Phase 2's text-heavy UI.

## Phase 19: v1.9.0 Polish Release
- [x] Chapter card transition system (0→I, I→II, II→III to-come)
- [x] Phase 2 progression rework — every unlock has a tease
- [x] Phase 1 Quantum Foam tease before factory unlock
- [x] Text discipline — drop tooltip descriptions, drop industry parenthetical
- [x] Phase 2 animation reliability — competitor pulse settled, factory pause attempted then reverted (deemed dead code)
- [x] Save/load hardening — schema version, silent corruption fallback
- [x] Critical fixes: WAR wall persistence, Bank-click reload trap, Phase 2 ticks stop on WAR
- [x] Repo cleanup — *.png in .gitignore
- [ ] GitHub Pages deployment (Task 20)

## Phase 20: Future Phases
- [ ] Phase 3: WAR (defined in gamePhase.js but not implemented)
  - [ ] Factory smoke → environmental impact mechanic (pollution meter, climate consequences)
- [ ] Phase 4: ESCAPE (defined in gamePhase.js but not implemented)
  - [ ] Environmental degradation forces player to escape to space
- [ ] Accessibility improvements (keyboard navigation, ARIA labels)

## Phase 20: v1.10.0 candidates (from v1.9.0 PDF feedback)

These were flagged by the user but deferred from v1.9.0 because they require either substantial design dialogue or clarifying input.

- [ ] **Phase 1 + Phase 2 factory animations** — current animations described as "hackiga, otydliga, fula". Needs new design direction. The Phase 1 conveyor and the Phase 2 rising-icons smoke both fall under this. (PDF 1 #1)
- [x] **Color palette overhaul** — bulk done in v1.9.1 (slate spectrum, dropped emerald/sky/red/yellow/pink primary colors). Stars remain `#b8860b` as only warm accent. Still open: fine-grained accent review and consistent icon tint pass. (PDF 1 #2)
- [x] **"Win-ring" animation** — clarified in v1.10.0; shipped in v1.11.0; gated to first-3 wins in v1.11.2. Larger redesign still possible.
- [ ] **Enemy red triangle** — shipped in v1.11.0, removed in v1.11.2 because the triangle plus the slate ring made the result wrapper "stökigt och fult". Intent stays valid (red triangle as enemy signature, callback in Phase 3 WAR) but needs proper design — smaller, subtler, possibly outside the wrapper rather than under it. Picked up when there's design bandwidth. (PDF 2 audit)
- [ ] **Sims-style pedestrian movement (Phase 2)** — Jacks SimsSpel-inspired: small circles representing people moving between houses, factories, shops. Substantial new feature; canvas overlay or SVG. Defer to v1.14+ at least. (PDF 2 #8)
- [x] **Phase 1 upgrade rings fill toward next purchase** — rings for Speed, EnergyGen, AddGameBoard now fill as starBalance grows toward next cost. Shipped v1.12.0. (PDF 1 #5, originally misinterpreted)
- [x] **Phase 2 building ring flärp** — ring reset on every purchase/upgrade fixed by targeted DOM updates. renderAllBuildings() removed from logicTick population-change path; research purchases only re-render affected building slots. Shipped v1.12.0. (PDF 2 #7)

## Phase 21: v1.13.0 follow-ups

Items identified during v1.13.0 bug hunt that are not immediately fixable:

- [x] **P2: fastUiTick duplicates supply calculation** — Fixed in v1.15.0: cached on `gameState` in `logicTick`, read by `fastUiTick`.
- [x] **P2: setTooltip listeners not using AbortController signal** — Fixed in v1.15.0: `{ signal }` passed to both `mouseenter`/`mouseleave` handlers.
- [x] **P1: saveGame called in updateUI (rAF)** — Fixed in v1.15.0: moved to `passiveTick()` (1s interval).

## Phase 22: v1.14.0 deferred mobile items

Items identified in the v1.14.0 mobile audit that require design decisions before implementation:

- [x] **P2: Building action button tooltip on touch** — Fixed in v1.15.0: two-tap confirmation on touch (first tap shows refund + highlight, second tap confirms sell within 3s).
- **P1: Upgrade tray overflow on landscape** — Overflow guard added in v1.14.0 (scrollable). UX improvement still open: reduce gap to `gap-2` at <500px height. Deferred to Phase 23.
- [x] **P2: Building grid at >10 slots on 320px** — Fixed in v1.15.0: `overflow-x: auto` + scroll snap at <400px.
- [x] **P2: Allocation slider thumb target size** — Fixed in v1.15.0: +/- step buttons (±5%) added at <640px, sm:hidden on desktop.

## Phase 23: v1.16.0

### Shipped in v1.16.0
- [x] **Bug hunt round 2** — NaN/Infinity guard in P1 save-load, materialize animationend signal fix, uiState reset, star-animation fallback cleanup.
- [x] **P1: upgrades-config.js extracted** — createUpgrades(actions) factory. index.js: 1044 → 965 lines.
- [x] **Tests: 63 → 84** — sanitizeNumber suite, edge cases (empty string, "undefined"), chapter card chained calls, save export/import round-trip.
- [x] **Save export/import** — exportSave/importSave, mountSaveButtons in both debug menus.
- [x] **Lint rules** — no-unused-vars, no-console, prefer-const, no-var, eqeqeq. Dead code removed.

### Deferred to Phase 24

- **P1: Upgrade tray UX on landscape phones** — Current scrollable overflow guard works but is not ideal UX. Option: `@media (max-height: 500px)` reduces `gap` to `gap-2`, fitting more buttons without scroll. Needs testing on actual landscape Android.
- **P2: upgrade button tooltip on touch** — `.building-action-btn:hover .tooltip` is hover-only. Touch still doesn't show the upgrade cost tooltip. Consider showing upgrade cost inline when the building slot is tapped (selection state), similar to sell confirm pattern.
- **P2: window.sellBuilding / upgradeBuilding onclick race** — Fixed in v1.17.0: event delegation on `#land-grid`. ~~inline onclick attributes~~.

## Phase 24: v1.17.0

### Shipped in v1.17.0
- [x] **P1: rendering.js extracted** — renderWinTracker, renderUpgrades, renderProgressCircles, rate/energy/counter renderers moved to `src/phase1/rendering.js`. index.js: 966 → 798 lines.
- [x] **P2: buildings-config.js extracted** — Static `buildingData` object moved to `src/phase2/buildings-config.js`. index.js: 892 → 876 lines.
- [x] **P2: window.sellBuilding race fixed** — Event delegation on `#land-grid` replaces inline `onclick` attributes. No more globals; cleaned up by AbortController on teardown.
- [x] **perf.js added** — `initPerf()`, `timed()`, `counter()` helpers in `src/perf.js`. Active only with `?debug&perf` URL. Wired into Phase 1 passiveTick/rAF and Phase 2 logicTick/fastUiTick.
- [x] **Docs pass** — CLAUDE.md, README.md file structures updated; stale line-count and known-issues entries corrected.

### Deferred to Phase 25
- **P1: Upgrade tray UX on landscape phones** — Still unresolved. `@media (max-height: 500px)` gap reduction needs testing on actual landscape Android device.
