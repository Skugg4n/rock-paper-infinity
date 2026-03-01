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
- [ ] Remove `firebase-debug.log` and add it to `.gitignore`
- [ ] Fix `stage-2.html` title version inconsistency
- [ ] Add `.DS_Store` to `.gitignore`

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
- [ ] **P2: Fix stage-2.html bypassing gamePhase.js**

## Phase 17: Code Quality (v1.5.0)
- [ ] Split `src/phase1/index.js` into smaller modules
- [x] Centralize localStorage key constants (done in `src/constants.js`, v1.4.0)
- [ ] Add proper error handling for save/load
- [ ] Improve test coverage beyond `roman.test.js`
- [ ] Set up ESLint config properly and fix linting issues
- [ ] Unify icon system (remove Lucide CDN dependency or use it everywhere)

## Phase 18: Future Features
- [ ] Phase 3: WAR (defined in gamePhase.js but not implemented)
- [ ] Phase 4: ESCAPE (defined in gamePhase.js but not implemented)
- [ ] Accessibility improvements (keyboard navigation, ARIA labels)
- [ ] Mobile responsiveness audit
