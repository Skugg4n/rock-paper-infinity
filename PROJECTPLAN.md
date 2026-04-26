# Rock, Paper, Infinity — Project Plan

## Completed

All items below are shipped and closed. See CHANGELOG.md and git history for details.

### Phase 1–13: Initial Development (v0.1 → v1.3.13)
Core game loop, upgrade system, Phase 2 city builder, UI polish, bug fixes. 49 merged PRs.

### Phase 14: Project Cleanup & Stability (v1.4.0)
- [x] Set up project documentation (CLAUDE.md, INDEX.md, LESSONS.md, PROJECTPLAN.md)
- [x] Centralize constants in `src/constants.js`
- [x] Extract Phase 2 inline styles to `style-stage2.css`
- [x] Standardize code language to English
- [x] Fix package.json (main, type, description)
- [x] Clean up legacy root SVGs — 37 duplicates deleted
- [x] Remove `firebase-debug.log`, `.DS_Store`, `/graphics/` legacy SVGs from git

### Phase 15–16: Bug Fixes (v1.4.1 → v1.4.2)
- [x] P2 event listener memory leak, lucide debounce, updateAllUI separation
- [x] P1 double energy generation, sell refund, consumeEnergy order
- [x] P2 supply rate, background throttling, beforeunload leak
- [x] P1 starMultiplier overwrite, quantum foam, tooltip race
- [x] P2 allocation slider sync, negative stars guard, starvation scaling

### Phase 17: Code Quality (v1.5.0 → v1.8.0)
- [x] Phase 1 module split: rates.js, cost-visual.js, countdown.js, persistence.js
- [x] Unified icon system — both phases use Lucide CDN
- [x] Jest ESM support, roman.js → ES module, 24 tests

### Phase 17b–c: Endgame Expansion & SPA Refactor (v1.6.0 → v1.7.0)
- [x] Superconductors, second land expansion, competitor teaser
- [x] Single HTML shell, phase persistence, CSS scoping, AbortController Phase 2

### Phase 18–19: UX Polish & Chapter Cards (v1.8.0 → v1.9.1)
- [x] Bank icon, mobile responsiveness, chapter card system (I/II/III to-come)
- [x] Phase 2 progression rework, Quantum Foam tease, text discipline
- [x] Save/load hardening (schema version, corruption fallback), WAR wall fixes
- [x] Color palette overhaul (slate spectrum), win-ring animation, enemy triangle (later reverted)
- [x] Smooth counter rolling, flying-star animation, bank unlock gate

### Phase 20–22: Accessibility, Mobile, Performance (v1.10.0 → v1.15.0)
- [x] prefers-reduced-motion, ARIA labels, aria-live regions, focus rings
- [x] Phase 2 mobile: building grid, action button tap targets, allocation slider +/−
- [x] Supply calculation cached in logicTick, setTooltip AbortController signal
- [x] Two-tap sell confirmation for touch, horizontal scroll for building grid at <400px
- [x] saveGame moved out of rAF into passiveTick

### Phase 23–24: Module Splits, Tests, Save Export (v1.16.0 → v1.17.0)
- [x] P1 upgrades-config.js extracted (createUpgrades factory)
- [x] P1 rendering.js extracted (11 render helpers)
- [x] P2 buildings-config.js extracted (pure buildingData)
- [x] P2 window.sellBuilding race fixed (event delegation on #land-grid)
- [x] perf.js added (timed, counter, initPerf)
- [x] Bug hunt round 2 (NaN guard, materialize signal, uiState reset, star-anim fallback)
- [x] Tests: 24 → 84 total
- [x] Save export/import (exportSave, importSave, mountSaveButtons)
- [x] ESLint rules (no-unused-vars, no-console, prefer-const, no-var, eqeqeq)

---

## Phase 25: v1.18.0 (current)

### Shipped in v1.18.0
- [x] **P1: game-logic.js extracted** — `showResult` + `iconMap` moved to `createGameLogic` factory. index.js: 802 → 769 lines.
- [x] **P2: rendering.js extracted** — `createBuildingHTML`, `renderGridSlot`, `refreshBuildingActions`, `refreshAllBuildingActions` moved to `src/phase2/rendering.js`. index.js: 899 → 756 lines.
- [x] **JSDoc on public APIs** — `chapterCard.js`, both `persistence.js` modules, `rates.js`, `buildings-config.js`.
- [x] **Bug hunt round 3** — `playChapterCard` null-guard for missing DOM, Phase 2 `initialize()` error recovery with corrupt-save reload, `bootstrap()` `.catch` for unhandled rejections.

### Deferred to Phase 26
- **P1: Upgrade tray UX on landscape phones** — Persistent. `@media (max-height: 500px)` gap reduction needs testing on actual landscape Android.
- **P2: Upgrade button tooltip on touch** — `.building-action-btn:hover .tooltip` is hover-only. Touch still shows no upgrade cost. Consider inline cost display on slot tap.

---

## Open Phase Items

### GitHub Pages deployment
- [ ] GitHub Pages deployment (from Phase 19 Task 20 — deferred repeatedly)

### Phase 18 open item
- [ ] **P2: "Code Processor" upgrade** — Unlockable upgrade that animates transition from icon-only UI to icon+text labels. In-world justification for Phase 2's text-heavy UI.

### Phase 20 future phases
- [ ] Phase 3: WAR (defined in gamePhase.js but not implemented)
  - [ ] Factory smoke → environmental impact mechanic (pollution meter, climate consequences)
- [ ] Phase 4: ESCAPE (defined in gamePhase.js but not implemented)
  - [ ] Environmental degradation forces player to escape to space
- [ ] Accessibility improvements (keyboard navigation — ARIA labels already done)

---

## Backlog

Design-heavy or high-effort items without a phase assignment. These need design dialogue before implementation.

- **Factory animations (both phases)** — Phase 1 conveyor and Phase 2 rising-icons smoke described as "hackiga, otydliga, fula". Needs new design direction. Blocked on: what does a good factory animation look like?
- **Enemy red triangle** — Shipped in v1.11.0, removed in v1.11.2 (clashed with slate ring). Intent still valid: red triangle as enemy signature, echoed in Phase 3 WAR. Needs smaller, subtler design — possibly outside the wrapper rather than under the icon.
- **Sims-style pedestrian movement (Phase 2)** — Small circles representing people moving between buildings. Canvas overlay or SVG animation. Substantial feature. Defer to v1.20+ at earliest.
- **Code Processor upgrade** — See Phase 18 open item above.
- **Color refinement** — Bulk slate overhaul done in v1.9.1. Fine-grained accent review and consistent icon tint pass still possible.
