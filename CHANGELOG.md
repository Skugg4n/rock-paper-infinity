# Changelog

## v1.4.6 - 2026-03-01

### Improvements
- **Factory conveyor belt animation** — RPS icons enter from the right, stars exit to the left. Horizontal conveyor belt feel. Subtle, contained within the box.
- **Factory box: shadow instead of border** — Replaced heavy 4px black border with a soft shadow, following the "tone plates, not lines" design principle.
- **Removed Phase 2 "+" blink** — Upgrade button animation caused constant blinking on re-render. Removed to keep the UI clean and discreet.
- **Design principle: tone plates** — Added "no lines" rule to CLAUDE.md. Use background colors with subtle shadows for structure, not visible borders.

## v1.4.5 - 2026-03-01

### Improvements
- **Factory animation reworked** — RPS icons now rise from the bottom inside the factory box (contained, not flying loose). Smoke puffs drift near the top. Inspired by Phase 2's contained animation style.
- **Phase 2 upgrade "+" animation** — Upgrade buttons now pop in with inverted colors (dark→gray) when they first appear, making it clearer something new is available.

## v1.4.4 - 2026-03-01

### New Features
- **Factory conveyor animation** — Phase 1 factory shows animated RPS icons and chimney smoke, symbolizing conversion of games into stars.

### Bug Fixes
- **Counter/resource-bar overlap** — Games/wins counter was hidden behind energy bars after 10 stars. Fixed by nesting both in a shared parent wrapper div.

## v1.4.3 - 2026-03-01

### New Features
- **Games/Wins counter** — Tracks total games played (⚔) and wins (🏆) with icons, shown top-right. Uses progressive disclosure: appears after first game. Supports large number formatting (k, M, B suffixes).
- **SPS energy indicator** — SPS display dims (opacity 0.35) when autoplay wants to run but energy is empty, giving visual feedback that star generation is paused.
- **Design Principles** documented in CLAUDE.md — icons over text, progressive disclosure, exponential satisfaction, Roman numeral costs.

### Bug Fixes
- **Factory unlock too early** — Factory appeared when only speed was maxed, hiding other upgrades. Now requires all three upgrades (speed, energy generator, game boards) at max level.

### UI/Responsiveness
- Choice buttons scale down on mobile (48px → 64px at ≥640px)
- Energy bars, rate displays (SPS/EPS/EGPS), and upgrade tray adapted for small screens
- Win tracker limited to 60vw on mobile to prevent collision with right-side elements
- Crown/gem icons smaller on mobile with full size restored at ≥640px

### New Assets
- `graphics/swords.svg` — Crossed swords icon for games counter
- `graphics/trophy.svg` — Trophy icon for wins counter

## v1.4.2 - 2026-03-01

### Medium-Priority Fixes (Phase 1)
- Fixed starMultiplier being overwritten (= 10) instead of multiplied (*= 10) when merging to meta board — luck bonus now preserved across merge and save/load
- Fixed quantum foam accumulating based on theoretical games instead of actual energy-limited games played
- Fixed tooltip timeout race condition — hovering between buttons no longer causes tooltips to disappear

### Medium-Priority Fixes (Phase 2)
- Fixed allocation slider not syncing with saved game state on load — slider now shows correct position
- Added floor guard: stars and science can no longer go negative from building upkeep
- Improved starvation mechanics: death rate now scales with 5% of supply deficit instead of fixed 1 person/tick

## v1.4.1 - 2026-03-01

### Critical Fixes (Phase 2)
- Fixed severe memory leak: `setTooltip()` added duplicate event listeners every 50ms — now uses WeakSet to track and prevent duplicates
- Fixed performance: `lucide.createIcons()` scanned entire DOM 20+ times/second — now debounced via `requestAnimationFrame`, called only after actual DOM changes
- Moved `updateAllUI()` from `fastUiTick` (50ms) to `logicTick` (1s) — fast tick now only updates numbers and progress bars

### High-Priority Fixes (Phase 1)
- Fixed double energy generation: `passiveTick` was filling both energy AND reserve simultaneously — now fills main first, overflow goes to reserve
- Fixed sell refund calculation: refund was near-zero because `cost()` was called before level decrement — now decrements first, giving correct 75% refund
- Fixed energy consumption order: reserve was drained before main energy — now drains main first, reserve as backup

### High-Priority Fixes (Phase 2)
- Fixed supply rate display showing 20x the actual rate (÷20 divisor removed to match display)
- Fixed background tab throttling: star/science accumulation moved from `fastUiTick` (throttled to 1/s in background) to `logicTick` (consistent 1/s)
- Fixed `beforeunload` listener leak in Phase 2 teardown

### Cleanup (Both Phases)
- Phase 1: All event listeners now use AbortController — `teardown()` cleanly removes everything via `abort()`
- Phase 2: `teardown()` now properly removes `beforeunload` listener via stored reference

## v1.4.0 - 2026-01-02 12:06 UTC
### Major Code Quality Improvements
- **CRITICAL FIX:** Fixed population requirement inconsistencies in Stage 2 where upgrade buttons appeared before actual unlock thresholds
  - Tool Case: Now correctly appears at 50 population (was showing at 25)
  - GMO Upgrade: Now correctly appears at 75 population (was showing at 50)
  - Land Expansion: Now correctly appears at 1000 population (was showing at 750)
  - Urbanism Research: Now correctly appears at 200 population (was correct)
- **package.json fixes:** Corrected main entry point from non-existent "index.js" to "main.js", changed type from "commonjs" to "module" to match ES module usage, added proper description and keywords
- **Cleanup:** Deleted 37 duplicate SVG files from project root (kept only /graphics directory versions)
- **Internationalization:** Standardized all code to English
  - Changed Swedish comments ("Spelvariabler", "DOM-element") to English
  - Translated UI text ("Öppna Plånboken" → "Open the Bank")
  - Renamed Swedish variables (`verktygUnlocked` → `toolCaseUnlocked`, `verktygUpgrade` → `toolCaseUpgrade`)
  - Fixed Swedish UI text in Stage 2 ("industri" → "industry")
- **Architecture improvements:**
  - Extracted Stage 2 inline styles (200+ lines) to separate `style-stage2.css` file for better maintainability
  - Created `src/constants.js` to centralize magic numbers (MAX_ENERGY, MAX_RESERVE_ENERGY, MAX_QUANTUM_FOAM, HYPER_SPEED_THRESHOLD, save keys)
  - Both Phase 1 and Phase 2 now import constants from centralized file
- **Documentation:** Added comprehensive README.md with project overview, setup instructions, architecture documentation, and development guidelines

### Why These Changes
- Population requirement bug was confusing for players - buttons showed up but were disabled with no clear explanation
- package.json errors prevented proper module recognition and could cause issues with tooling
- Duplicate SVG files wasted 800KB+ of repository space and created confusion about canonical sources
- Language mixing (Swedish/English) made code harder to maintain and collaborate on
- Inline styles in HTML made Stage 2 harder to maintain and debug
- Magic numbers scattered throughout code made game balance difficult to adjust
- Missing README made it hard for new developers to understand and contribute to the project

## v1.3.14 - 2025-11-26 09:14 UTC
- Restored the Stage 2 factory smoke animation with darker, larger plumes and staggered timing so the icon stream is visible again.
- Made Stage 2 reset fully clear saves by disabling auto-save before reload, stopping timers, and removing stored progress keys.
- Bumped version metadata to v1.3.14 to reflect the fixes.

## v1.3.13 - 2025-11-26 07:51 UTC
- Added a dedicated Plånboken (Bank) hover tooltip so the Stage 1 exit upgrade explains the transition before clicking.
- Replaced the Stage 2 factory orbit animation with a steady stream of rising rock/paper/scissors icons to read as industrial "rök".
- Reworked the Stage 2 supply meter to fill from the center with green surplus and red deficit cues for faster balance checks.
- Made housing demolition immediately recalculate population and downstream rates, keeping counts in sync even for massive districts.
- Clarified stars generated per person in Stage 2 to track base and industry-effective output and bumped release version metadata.

## v1.3.12 - 2025-11-24 07:37 UTC
- Switched all visible interface text to English and refreshed version labels to avoid language confusion between stages.
- Added a missing bank icon asset for the Stage 1 transition so the final upgrade renders correctly instead of an empty box.
- Exposed stars-per-person output in Stage 2 and added a rock-paper-scissors-inspired factory animation to reinforce the core theme and clarify efficiency upgrades.
- Redesigned the Stage 2 supply "thermometer" into a centered deficit/surplus meter with clearer surplus/deficit messaging for quicker balance checks.
- Made population drop instantly when demolishing housing to keep resident counts aligned with available buildings even for large districts.
- Bumped version metadata and documented these fixes to keep releases traceable.
