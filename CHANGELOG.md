# Changelog

## v1.14.0 - 2026-04-23

### Mobile responsiveness (systematic pass for Android Chrome priority)

Audit document: `docs/mobile-audit-v1.14.0.md`

- **Phase 2 building grid overflow at 320px** — 5-column grid with 56px slots + 6px gaps totalled 304px, overflowing the 288px usable width. Fixed: slots shrink to 52px at <400px (restores to 56px at 400px+), gap reduced to 4px on mobile (`gap-1 sm:gap-4`). New layout fits with 12px margin.
- **Phase 2 build panel buttons: 40px → 44px** — All `.btn` elements in the Phase 2 build/upgrade panel were 40×40px, 4px below the Apple HIG minimum. Bumped to 44×44px on mobile; 56px on desktop unchanged.
- **Phase 2 building action buttons: expanded tap target to 44px** — Sell (−) and upgrade (+) corner buttons on building slots are visually 18px (24px at ≥640px). Visual size unchanged to preserve minimal aesthetic. Added `::after` pseudo-element (44×44px, transparent, centered) that expands the hit area without visually changing the button.
- **Allocation slider thumb: 20px → 28px on mobile** — Slider thumb was 20×20px at all sizes, well below minimum. Increased to 28×28px at <640px with corrected `margin-top: -10px` to stay centered on the 8px track. Desktop retains 20px. (Note: 28px is an improvement but still below the 44px ideal; full fix deferred to PROJECTPLAN.)
- **Supplies bar text: 11px → 12px** — The supply balance labels (-0/s, Balanced, +0/s) were 11px — below comfortable Android reading size. Bumped to 12px.
- **Phase 1 upgrade tray overflow guard** — With 7 upgrade buttons, the tray can reach 408px tall, overflowing on landscape phones. Added `max-height: calc(100dvh - 6rem)` and `overflow-y: auto` with hidden scrollbar so the tray quietly scrolls rather than clipping off-screen.

### Deferred items (see PROJECTPLAN.md Phase 22)
- Building action button tooltip on touch (hover-only, no touch equivalent)
- Upgrade tray UX on landscape (overflow guard added but scroll UX not ideal)
- Building grid at >10 slots on 320px
- Allocation slider thumb below 44px ideal

## v1.13.0 - 2026-04-23

### Accessibility
- **prefers-reduced-motion** — Added `@media (prefers-reduced-motion: reduce)` blocks to `style.css` and `style-stage2.css`. All keyframe animations and transitions collapse to 0.01ms for users with motion sensitivity. The chapter-card transition is kept at 100ms so the phase change remains perceptible. JS-driven chapter-card sequence also respects the media query: total duration shrinks from ~2200ms to ~600ms.
- **ARIA labels** — Phase 1 choice buttons (`aria-label="Rock/Paper/Scissors"`), upgrade buttons (Speed, EnergyGen, BuyBattery, etc.), energy/reserve bars (`role="progressbar"`), win-tracker, games/wins counters all have accessible names. Phase 2 star/science counters and allocation slider labelled. Building slots in Phase 2 announce their type or "Empty land" via `aria-label` set in `renderGridSlot`. Decorative icons marked `aria-hidden="true"`.
- **aria-live regions** — Win-tracker and games/wins counters use `aria-live="polite"`. Phase 2 star and science counters use `aria-live="polite"` so screen readers announce value changes.
- **Keyboard focus ring** — Added `:focus-visible` rules to `style.css` for `button` and `.btn`. 2px slate-600 outline with 2px offset. Uses `:focus-visible` (not `:focus`) so mouse users don't see the ring. Range inputs also get a focus-visible ring.

### Tests
- **fillFraction** — Extracted `fillFraction(balance, upgrade)` from Phase 1's private scope into `rates.js` as a named export. Added `fill-fraction.test.js` with 8 tests: balance at 0/half/equal/exceeding cost, upgrade at maxLevel, cost as function, upgrade without maxLevel.
- **flying-star animation** — Extracted `fireStarAnimation(sourceEl, targetEl)` from Phase 1's closure into `src/phase1/star-animation.js`. Added `star-animation.test.js` with 6 tests: SVG appended to body, `setAttribute('class')` used (not `.className` — that was the v1.11.1 bug), CSS custom properties set correctly, `animationend` removes element, null guard.
- **Total tests: 58** (was 44 in v1.12.0).

### Bug fixes
- **Phase 2: game ticks start behind WAR card on reload** — When returning to a ≥50k population save, `initialize()` triggered the WAR chapter card (to-come mode) but `logicInterval` and `fastUiInterval` were started unconditionally after `initialize()` returned. Game logic kept running behind the permanent overlay. Fixed: ticks only start when `savingEnabled` is still true after `initialize()` returns.
- **Phase 2: reset button listener leaked across phase switches** — `ui.resetBtn.addEventListener('click', ...)` was missing `{ signal }`, so the listener accumulated with each Phase 2 init. Added `{ signal }` to match all other Phase 2 event listeners.

### Performance / code health
- **Hot path discipline documented** — Added "Hot path discipline" section to CLAUDE.md's Established Patterns. Rules: fast tick reads state and writes to display only; slow tick writes to localStorage; cache DOM refs at init; don't create elements in tick; always use `scheduleIconRefresh()`.
- **Audit findings**: both phases comply. One known violation noted for follow-up: Phase 1 `saveGame()` is called inside `updateUI()` (rAF path); should move to `passiveTick`.

## v1.12.0 - 2026-04-23

### Fixes (from PDF feedback audit)

- **Phase 1 upgrade rings: fill toward next purchase cost** — Rings around Speed, EnergyGen, and AddGameBoard now fill smoothly as the player's star balance grows toward the cost of the next level. Each RPS win visibly advances the ring; full ring means you can buy. After buying, the ring drops back to wherever the remaining balance sits relative to the new (higher) cost. Previously rings filled based on `level / maxLevel` — 1/55th of a jump per purchase — so most wins didn't visibly advance anything. Also dropped the speed pre-ring (`speed-early-progress`) — the new semantics make it redundant and the dual-ring stack was visually noisy. Per PDF 1 feedback: "Låt ringen runt..." (clarified: rings fill on purchase progress).

- **Phase 2: stop the "flärp" on every purchase** — Building progress rings were resetting to empty and refilling on every purchase or upgrade, because `renderAllBuildings()` (full DOM rebuild) was called too aggressively. Two sources fixed:
  1. `logicTick` called `renderAllBuildings()` on every population change (every second). Replaced with `refreshAllBuildingActions()` which only updates action-button disabled states and the `.upgradeable` CSS class — rings are left intact because `fastUiTick` already updates them via `pop-ring-${id}` directly.
  2. Research purchases (`urbanismResearched`, `megastructureResearched`) called `renderAllBuildings()`. Now only re-renders the specific building slots that gain a new upgrade button from that research. Other buildings are never touched. Per PDF 2 feedback: "Animera bara när det ska animeras."

## v1.11.2 - 2026-04-25

### Polish

- **Enemy red triangle removed (for now)** — The triangle backdrop on enemy wins clashed with the existing slate ring around the wrapper, producing a noisy "stökigt och fult" visual. Reverted both the `::before` triangle and its keyframe. The enemy still gets the slate-shadow ring as a visual cue, just no triangle. Documented as a v1.12+ candidate in PROJECTPLAN.md — needs proper design (smaller, subtler, possibly outside the wrapper).
- **Win-ring pulse limited to first 3 wins** — The pulse animation on `.result-wrapper.winner` now only fires while `totalStarsEarned < 3`. Static ring still appears on every win as the visual cue; pulse is reserved for the early "first wins" celebration moment. Avoids the cue going stale in late game.

## v1.11.1 - 2026-04-25

### Hotfix

- **Game freeze on win** — Phase 1 game stopped responding after every win (autoplay too). Cause: `star.className = 'star-fly'` on an SVG element silently throws because `className` on SVGElement is a read-only `SVGAnimatedString`. The thrown error stopped `showResult()` before resetting `board.isAnimating = false`, leaving the board permanently in "animating" state until reload. Fixed by using `setAttribute('class', ...)`. Also wrapped `fireStarAnimation()` in try/catch as defense-in-depth so future bugs there can't break the game flow.

## v1.11.0 - 2026-04-23

### Enemy Signature & Phase 2 Progressive Disclosure

- **Enemy red triangle** — When the enemy wins a Phase 1 RPS round, a red triangle appears behind their winning move icon. One-shot fade-in animation; no loop. `#b91c1c` red is the only intentional red in the palette — reserved for "enemy/threat". The same triangle will reappear in Phase 3 (WAR) so players with memory recognize the connection.
- **Phase 2 progressive disclosure** — Stripped back the Phase 2 entry view to reduce information overload. Stars counter and building grid are always visible. Stars-per-person text appears at pop ≥ 5 (same moment as population/supplies indicators). Science counter, Industry/Research allocation labels, and the slider all wait until pop ≥ 100, when Urbanism first teases research and science becomes meaningful. Each element fades in once on first threshold crossing. Returning saves past threshold skip the fade — go straight to revealed state.

## v1.10.0 - 2026-04-23

### Polish & Animation Pass (PDF feedback "edit 2")

- **Disabled buttons** — Override browser's `cursor: not-allowed` to `cursor: default`. Disabled buttons are already visually grayed out; the pointer changes nothing.
- **AutoPlay pulse removed** — AutoPlay button no longer pulses infinitely while active. The pressed/toggled state (`background + inset shadow`) remains. One-shot animations on toggle-on are unaffected.
- **Phase 2 building upkeep labels** — Removed the per-building `-X ⭐/s` text from building cells. Net upkeep is already visible in the global supply/economy bar. Tooltip on sell/upgrade buttons still shows cost detail. Removed unused `.building-upkeep` CSS.
- **WAR card race condition** — WAR card at 50k pop now requires competitor island to have been visible for ≥5 seconds before firing. Prevents the island appearing and immediately disappearing during a debug-menu skip. Spawn timestamp (`competitorSpawnedAt`) is auto-persisted with saves.
- **Land Expansion ring bug** — Existing building progress rings no longer flash empty when land is expanded. Fixed by appending new empty slots directly to the grid instead of wiping and rebuilding all DOM — existing building elements keep their ring state intact.
- **Flying-star animation** — On the first 10 stars earned in Phase 1, a star icon animates from the player result area to the win-tracker (top-left). Creates "brand the win" moment at game start. No spam: disabled once totalStarsEarned > 10.
- **Smooth counter rolling** — Phase 2 star and science counters now lerp at 18% per frame (50ms tick) instead of snapping once per second. At high SPS (millions+), digits visibly roll and blur — growth feels exponential and physical.
- **Bank unlock gated** — Bank upgrade now requires `totalStarsEarned >= 50000` in addition to factory purchase. Prevents Bank appearing immediately after Factory; gives the player a meaningful pause on the meta board before the phase transition.

## v1.9.1 - 2026-04-26

### Polish & Cleanup
- **Reset confirmation** — Both Phase 1 and Phase 2 now require `confirm()` before wiping progress.
- **Phase 1 full reset** — Reset now clears all save keys (Phase 1 + Phase 2 + PHASE_KEY), mirroring Phase 2 behavior.
- **Bank constant** — Phase 1 bank purchase uses `STARS_TRANSFER_KEY` constant instead of a hardcoded string.
- **icons.js** — Dropped unused `root` parameter from `replaceIcons()`.
- **Tailwind `hidden` precedence** — Added `.hidden { display: none !important; }` to settle ambiguous `hidden flex` combinations.
- **Debug menus** — Hidden by default; appear only when `?debug` is in the URL.
- **Building upkeep** — Shows `-30/s ★` instead of `-30 ★` to clarify it's per-second.
- **Sell-button tooltip** — 250ms hover-out delay so tooltip doesn't vanish on a hesitant hover.
- **Mobile energy bars** — Narrowed at <480px to prevent collision with the win-tracker.
- **Win-ring animation** — One-shot `win-ring-pulse` keyframe plays when `.result-wrapper.winner` is applied. Subtle pop-out → settle. No infinite loop.
- **Color cleanup** — Dropped Claude-primary chromatic palette (emerald/sky/red/yellow/pink) in favor of slate spectrum. Stars remain the single warm accent (`#b8860b` desaturated gold). Enemy factory loses red glow; sell button loses red hover; upkeep text and unlock-req labels go slate.

## v1.9.0 - 2026-04-25

### New Features
- **Chapter card transitions** — Bombastic fade-to-white card with bold condensed block-letter typography (Bebas Neue). Plays at game start (`I · TRIVIAL`), on Bank commit (`I → II · CAPITAL`), and at 50k population in Phase 2 (`II → III · WAR · to come`). The III · WAR card ends on a black wall — game pauses there until Phase 3 is built.
- **Past-threshold WAR wall** — Saves loaded already past 50k pop land directly on the WAR wall on init. The state is persisted before saves are disabled, so the wall is replay-safe across reloads.

### Improvements
- **Phase 2 progression** — Every unlock now has a preceding tease. Land Expansion teased earlier (750), Megastructure (2500), Land Expansion 2 (7500). Competitor island moved from 50k to 40k pop spawn — gives the player a mystery beat before the WAR card reveals at 50k.
- **Phase 1 Quantum Foam tease** — Foam appears in a locked/dim state when the factory becomes purchaseable, instead of popping fully formed only after factory purchase.
- **Text discipline** — Tooltip descriptions removed entirely from Phase 1. Phase 2 "Unlock" prefixes stripped. Stars-per-person no longer shows the (industry: X.X) parenthetical.
- **Animation reliability** — Competitor island no longer pulses indefinitely; fades in once at 40k pop and sits still until WAR card.
- **Save/load hardening** — All saves now carry a `schemaVersion` field. Corrupt or future-versioned saves fall back silently to fresh state. `QuotaExceededError` no longer crashes init. Phase 2 persistence extracted to `src/phase2/persistence.js` mirroring Phase 1.

### Critical fixes (during release)
- **WAR wall persistence** — The 50k+ population state now saves once before saves are disabled, so reload re-fires the wall correctly.
- **Bank-click reload trap** — `PHASE_KEY` is now persisted at bank-click time, not at chapter-card midpoint, so reloading during the transition card no longer strands the player in Phase 1 with the bank already purchased.
- **Phase 2 ticks stop on WAR** — Logic and UI intervals are cleared when the WAR card fires, so the simulation actually halts behind the wall.

### Reverted
- **Factory pause-on-idle** (initially shipped as Task 12) was removed: the trigger condition (`netStarChangePerSecond ≤ 0`) almost never fires given the factory's +1680/s base output, making the feature dead code. Better to acknowledge the factory always runs.

### Cleanup
- `.gitignore` ignores `*.png` artifacts from Playwright sessions.
- Bebas Neue font added (Google Fonts).
- `vision.md` added — codifies the chapter arc, design beliefs, and non-goals as the project's source of truth.

### Tests
- Test count rises from 24 to 44. New suites: `chapterCard.test.js`, `phase2/persistence.test.js`. Phase 1 persistence extended.

### Deployment
- Prepared for GitHub Pages deployment (Task 20-21 of the v1.9.0 plan).

## v1.8.0 - 2026-03-01

### Code Quality
- **Phase 1 module split** — Extracted 4 modules from the `phase1/index.js` monolith (1146 → 1036 lines):
  - `rates.js` — Pure calculation functions (getSPS, getEPS, getVisibleDots, formatCount)
  - `cost-visual.js` — Tally SVGs and Roman numeral cost display
  - `countdown.js` — RPS countdown animation
  - `persistence.js` — Game state serialization/deserialization
- **Test coverage** — Added 23 new tests for `rates.js` and `persistence.js`. Total: 24 tests (was 1).
- **Jest ESM support** — Configured `--experimental-vm-modules` and `transform: {}` for native ES module testing.
- **roman.js → ES module** — Converted from CJS-compatible global to proper ES module with `export`.

### UX Polish
- **Bank icon** — Changed from wallet (💳) to landmark (🏛) for clearer thematic fit.
- **Bank tooltip removed** — Stripped verbose text description, aligning with "icons not text" principle.
- **Phase 2 mobile responsive** — Building slots, buttons, icons, text, sliders, and build menu all scale for 320px–1024px viewports.

### Cleanup
- **`.gitignore`** — Added `.DS_Store`, `firebase-debug.log`, `.playwright-mcp/`.
- **Removed `/graphics/`** — 21 legacy SVG files deleted (replaced by Lucide CDN in v1.5.0).
- **Removed `<script src="roman.js">`** — Now imported via ES module chain.

## v1.7.0 - 2026-03-01

### Breaking Changes
- **SPA refactor** — Consolidated from two HTML files (`index.html` + `stage-2.html`) into a single HTML shell. Phase transitions now use show/hide on `<div class="phase-container">` instead of `window.location.href` navigation. Prepares architecture for Phase 3 (WAR).

### Improvements
- **Phase persistence** — New `rpi-phase` localStorage key remembers which phase the player is in. Reloading stays in the correct phase.
- **CSS scoping** — Phase 2 conflicting selectors (`.btn`, `.upgrade-btn`, `.tooltip`) prefixed with `#phase-city` to prevent style bleeding into Phase 1.
- **Shared elements** — Menu, version display, and tooltip live outside phase containers. Single source of truth.
- **stage-2.html redirect** — Old URL now redirects to `index.html` for backwards compatibility.

## v1.6.0 - 2026-03-01

### New Features
- **Superconductors upgrade** — Multi-level upgrade (5 levels) available at 10,000 population. Each level doubles stars/person output. Cost scales exponentially: 5,000 × 5^level stars. Progress ring shows completion.
- **Second land expansion** — Available at 10,000 population (requires first expansion). Costs 10,000,000 stars. Adds 5 more grid slots for a total of 20.
- **Competitor teaser (Phase 3 hook)** — At 50,000 population, a mysterious red factory island fades in below the player's grid. No interaction yet — pure atmosphere and foreshadowing.

## v1.5.0 - 2026-03-01

### Breaking Changes
- **Unified icon system** — Phase 1 now uses Lucide CDN instead of custom SVGs from `/graphics/`. Both phases share the same icon set. `icons.js` rewritten to build SVGs from Lucide icon data.

### Improvements
- **Factory animation: binary opacity** — Icons snap on/off instead of fading. No gradual opacity transitions.
- **Phase 2 upgrade flash** — One-shot blue flash when an upgrade button first appears on a building. Uses Set tracking to avoid repeating. Skipped during initial load.

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
