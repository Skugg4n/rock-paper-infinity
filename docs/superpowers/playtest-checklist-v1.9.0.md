# Manual Playtest Checklist — v1.9.0

Run this checklist in a real browser before sharing the build with external testers.
Estimated time: ~30 minutes if you use the debug menu, ~3+ hours for an honest fresh run.

## Setup

- [ ] Open the game in a Chromium-based browser (Chrome / Edge / Brave) **incognito window** so saves are clean.
- [ ] Open DevTools: Console + Network + Elements panels.
- [ ] Set the network throttling to "Fast 3G" once at the start to verify the Bebas Neue font loads in time, then set it back to "No throttling" for the rest.
- [ ] In DevTools console, confirm: `localStorage.length === 0`. If not, run `localStorage.clear()` and reload.
- [ ] Confirm the version shown in the bottom-left corner matches the release you intend to test (should read **v1.9.0**, not v1.8.0 — see Findings).

## Fresh Phase 1 (I · TRIVIAL opening)

- [ ] On first load, screen fades to white, "I" appears, then "TRIVIAL" in Bebas Neue, holds ~1s, fades back.
- [ ] Total opening duration feels ~2.2 s — not too long, not jarring.
- [ ] Bebas Neue actually rendered (tall narrow caps, not generic system font).
- [ ] After the card, Phase 1 UI is visible: 5 buttons in a row at bottom, no resource bars yet, no upgrade buttons in the right tray.
- [ ] Star tracker on the left is empty (no dots, no gems, no crowns).
- [ ] No console errors.

## Phase 1 — early game (0–10 stars)

- [ ] Click "rock" — countdown plays, computer reveals a choice, win/loss/draw resolves.
- [ ] On a win, a small gold star icon appears in the left tracker.
- [ ] After ~3 wins, the small dot grid expands (was 5 dots, now 10).
- [ ] After 1 game played, a games/wins counter appears in the right column above the (still-hidden) resource bars.
- [ ] Reach 10 total stars → resource bars (energy + reserve) materialize on the right.
- [ ] Reach 2 total stars → AutoPlay button appears and "materializes" with a dark-circle → white-icon transition.

## Phase 1 — mid (10–100 stars)

- [ ] Buy AutoPlay — button toggles "on" state (darker bg). Speed upgrade button appears next.
- [ ] Hover AutoPlay (after purchase): no tooltip should show (purchased state, no level remaining).
- [ ] Hover Speed: tooltip shows **icon-only cost** (star + Roman numeral X = 10). No text labels like "Cost:" or descriptions.
- [ ] Buy Speed once — button "pops", animation plays. Speed level becomes 1, gameSpeed = 2.
- [ ] At 100 games played → Luck button appears.
- [ ] At 50 SPS → Energy Generator button appears.
- [ ] At 50 stars → Buy Battery button appears.
- [ ] At 100 total stars → Add Game Board button appears.
- [ ] Verify each newly-revealed upgrade plays the materialize animation (1.2 s, dark→white) **only the first time** (not every UI tick).

## Phase 1 — endgame (max all upgrades → factory)

- [ ] Use the debug menu (top-left invisible 16x16 zone) to add stars and skip to factory unlock if needed.
- [ ] Max Speed (level 55), Energy Generator (level 100), Add Game Board (level 8), Luck (purchased), AutoPlay (purchased).
- [ ] When all five conditions met → Factory button (`mergeGameBoard`) appears AND every other upgrade button becomes invisible (only Factory is shown).
- [ ] Quantum Foam button **also appears** at this point in a locked/grayed state (opacity 0.4, grayscale, no clicks). This is new in v1.9.0 — verify it does NOT respond to clicks.
- [ ] Click Factory → boards merge to a single meta board with conveyor animation.
- [ ] Quantum Foam transitions from locked to active (no longer grayed).
- [ ] Bank button appears in the upgrade tray.

## Phase 1 → Phase 2 transition (II · CAPITAL)

- [ ] Click Bank — chapter card plays: white veil, "II" then "CAPITAL", holds, fades.
- [ ] At the midpoint of the card, the page swaps from Phase 1 to Phase 2 silently (no flash).
- [ ] After the card resolves, you're in Phase 2 with star count = whatever you had in Phase 1.
- [ ] **Edge case**: reload the tab during the chapter card animation (before midpoint). Expected: you reload back into Phase 1, but bank is "purchased" and you cannot replay the transition. This is a known issue (see Findings) — verify it reproduces.

## Phase 2 — first 200 population

- [ ] Land grid shows 10 slots, with factory in slot 0 and bank in slot 1, 8 empty slots.
- [ ] Star count ticks up at +1650/s base rate (factory +1680, bank −30).
- [ ] Hover home/store buttons: tooltip shows icon + cost only, no text descriptions.
- [ ] Buy a Home (10,000 stars). Slot 2 fills with the home icon and a population progress ring.
- [ ] Buy a Store (30,000 stars). Slot 3 fills.
- [ ] After ~30 s, population begins growing in the home (+1 every 5 s).
- [ ] At population 5 → population UI + supplies UI fade in (0.5 s transition).
- [ ] Supplies bar shows balanced/surplus/deficit state with green/red color and direction.

## Phase 2 — tease thresholds (new in v1.9.0)

For each threshold below, confirm the upgrade button **appears in disabled/grayed state** at `showAt` and becomes clickable at `popReq`.

- [ ] **pop 25 → tease Tool Case** (becomes usable at 50)
- [ ] **pop 40 → tease GMO** (usable at 75)
- [ ] **pop 100 → tease Urbanism** (usable at 200)
- [ ] **pop 250 → tease Car** (usable at 500)
- [ ] **pop 500 → tease Computer** (usable at 1000, requires Car)
- [ ] **pop 750 → tease Land Expansion** (usable at 1000) — NEW in v1.9.0
- [ ] **pop 2500 → tease Megastructure** (usable at 5000) — NEW in v1.9.0
- [ ] **pop 5000 → tease Superconductor** (usable at 10,000)
- [ ] **pop 7500 → tease Land Expansion 2** (usable at 10,000, requires expansion 1) — NEW in v1.9.0

For each: hover the teased button. The tooltip should show the population requirement (e.g. "75 👥") not a cost.

## Phase 2 — research and upgrade chain

- [ ] Buy Tool Case at pop 50 → button disappears (single-use upgrade). Stars/person doubles.
- [ ] Buy GMO once → +100% supplies effect, GMO ring shows 1/10 progress.
- [ ] Buy Urbanism (pop 200) → "+" upgrade buttons start appearing on apartments after this point.
- [ ] When you upgrade an apartment → district-style animations work, building icon swaps.
- [ ] Buy Car (pop 500). Then Computer (requires Car AND pop 1000).
- [ ] Buy Megastructure at pop 5000. Now apartments can chain: home → apartment → skyscraper → district.

## Phase 2 — factory pause behavior (new in v1.9.0)

- [ ] At any pop level, look at the factory icon. The conveyor smoke-icons should be moving.
- [ ] Sell or starve down population so net stars/sec ≤ 0 (if achievable). Factory smoke icons should pause and dim. **Note**: the factory base contribution is +1680/s and only bank (−30) plus stores (−20 each) and superStores (−50 each) can reduce it. With normal play, this state may be unreachable. If you can't reproduce the pause, that's likely intentional — the gating is real but rarely fires. Document if you see it visibly trigger.

## Phase 2 — competitor island (40k pop, was 50k)

- [ ] Use debug `+1000 pop` repeatedly until pop reaches 40,000.
- [ ] At pop ≥ 40,000 → competitor island fades in below the land grid (1.5 s ease-in).
- [ ] After fade-in completes, the island is **static** (no infinite pulsing or animation). Verify by waiting 10+ seconds.
- [ ] Reload the tab. The island should still be visible immediately on reload (no fade-in replay).

## Phase 2 — III · WAR wall (50k pop)

- [ ] Continue past 50,000 population (use debug menu for speed).
- [ ] At pop ≥ 50,000 → veil fades to BLACK, "III" + "WAR" appears in white, holds, then "to come" suffix appears (smaller, lower).
- [ ] The wall does not dismiss; the game is permanently paused behind the black veil.
- [ ] No buttons clickable below the wall.
- [ ] Reload the tab now. **CRITICAL EDGE CASE — known bug**: expected behaviour is wall fires immediately on reload. Actual: wall does NOT fire because the save was disabled before population ≥ 50,000 was persisted. Verify this bug reproduces. (See Findings — fix in Task 17.)

## Phase 2 — reset

- [ ] Hit the menu button (bottom-left), then "Reset everything".
- [ ] Page reloads. You should land on Phase 1 fresh, with the I·TRIVIAL card playing again.
- [ ] No console errors during reset.
- [ ] localStorage should be empty after reset (verify in DevTools application tab).

## Save/load edge cases

- [ ] **Quota exceeded**: in DevTools console, run `localStorage.setItem('filler', 'a'.repeat(5_000_000))` to fill storage near the cap. Play one round of RPS. Console should show a `persistence: setItem failed QuotaExceededError` warning (silent fallback). Game should keep running without crashing.
- [ ] **Disabled localStorage** (Firefox private mode, or via DevTools setting): load the page. Expected: bootstrap doesn't crash, fresh-player check works, game starts in Phase 1.
- [ ] **Future schema**: in DevTools, set `localStorage.setItem('rpi-save', JSON.stringify({schemaVersion: 99, starBalance: 12345}))` and reload. Expected: save is rejected (schemaVersion > 1), game starts as fresh player.
- [ ] **Legacy v1.8.0 save** (no schemaVersion): set `localStorage.setItem('rpi-save', JSON.stringify({starBalance: 500, totalStarsEarned: 500}))` and reload. Expected: save loads (treated as schemaVersion 1), 500 stars present.
- [ ] **Corrupt save**: set `localStorage.setItem('rpi-save', 'not-valid-json')` and reload. Expected: silent fallback to fresh game, no console error stops bootstrap.

## Mobile responsive (DevTools device toolbar)

- [ ] **320 × 568 (iPhone SE)**:
  - [ ] I · TRIVIAL card title fits horizontally without overflow.
  - [ ] Phase 1 buttons (rock/paper/scissors row) fit in viewport.
  - [ ] Star tracker on the left does not overlap with right-side resource bars.
  - [ ] Phase 2 building grid (5 cols) fits without horizontal scroll.
  - [ ] Factory main icon is 24 px on mobile and remains visible behind the smoke conveyor.
  - [ ] Locked Quantum Foam button (Phase 1) is dim/grayed but doesn't break the layout.
- [ ] **375 × 667 (iPhone 8)**: re-run all of the above.
- [ ] **1024 × 768 (iPad)**: layout should scale to large icons (40 px factory, 56 px lucide-lg) without overlap.

## Visual / UX polish checks

- [ ] No animation on UI elements loops indefinitely (no constant pulse/blink). Pulse is allowed only on AutoPlay while running.
- [ ] All "+" upgrade buttons in Phase 2 appear **once** per building with the upgrade-flash animation. Re-rendering the building (via population change) should NOT re-trigger the flash.
- [ ] The factory conveyor in Phase 1 (meta board) flows right→center→left consistently.
- [ ] The factory conveyor in Phase 2 flows from the right side of the icon outward.
- [ ] No emojis appear in the UI (icons-only design rule).

## Console hygiene

- [ ] Open DevTools console. After a full ~10 minute play session, the only expected logs are warnings from intentional `console.warn` calls (e.g. quota exceeded test). No `console.error` from runtime.
