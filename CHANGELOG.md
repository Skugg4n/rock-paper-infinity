# Changelog

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
