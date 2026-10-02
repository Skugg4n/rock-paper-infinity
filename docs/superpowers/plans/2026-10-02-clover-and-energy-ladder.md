# The little clover and the energy ladder: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chapter I gets a free clickable clover (3 s of luck per click) and an energy ladder where each helper is unlocked by use of the previous one.

**Architecture:** Pure rules go into `rates.js` and `persistence.js` (tested with Jest). `upgrades-config.js` gets use-based unlock conditions through the existing `unlocksAt: 0` + `unlockCondition` pattern. `index.js` owns three new pieces of state (`rechargeClicks`, `batteriesBought`, `cloverUntil`), `rendering.js` gets two small renderers. No new source modules, so `src/modules.js` is untouched.

**Tech Stack:** plain ES modules, Jest (`npm test`), ESLint (`npm run lint`), static server on port 8123 (launch config `rock-paper-infinity`).

Spec: `docs/superpowers/specs/2026-10-02-clover-and-energy-ladder-design.md`.

## Global Constraints

- Clover: 3 000 ms of luck per click, refill not stack, win rate 2/3 while active. Not saved.
- Big battery: unlocks after 6 recharge clicks, costs 20★, +500, cap 1 500 (cap and amount unchanged).
- Generator: unlocks after 5 big batteries bought, or when its level is above 0. Cost unchanged.
- Old saves without counters: lifetime stars ≥ 100 → both unlocks met; ≥ 40 → battery unlock met.
- The big battery's bar is hidden until `batteriesBought > 0` or `reserveEnergy > 0`.
- No change to speed, boards, factory, bank, foam. No sound.
- Balance rule (CLAUDE.md): run `scripts/sim-phase1.mjs` and update the spec's table before release.
- Version bump to v1.53.0 in `src/version.js`, `index.html`, `package.json`, `CHANGELOG.md`.

---

### Task 1: Rules (constants, win rate, counters in the save)

**Files:** modify `src/constants.js`, `src/phase1/rates.js`, `src/phase1/persistence.js`; tests in `src/phase1/rates.test.js`, `src/phase1/persistence.test.js`.

**Produces:**
- `PHASE1_CONSTANTS.CLOVER_MS = 3000`, `.BATTERY_UNLOCK_CLICKS = 6`, `.GENERATOR_UNLOCK_BATTERIES = 5`
- `currentWinRate(luckPurchased: boolean, cloverUntil: number, now: number): number` in `rates.js`
- `serializeGameState` writes `rechargeClicks`, `batteriesBought` (default 0)
- `helperCounters(data): { rechargeClicks: number, batteriesBought: number }` in `persistence.js`

- [ ] Failing tests: `currentWinRate(false, 0, 1000)` is 1/3; `(false, 4000, 1000)` is 2/3; `(false, 4000, 4000)` is 1/3 (expired at the boundary); `(true, 0, 1000)` is 2/3. Counters round-trip through serialize/deserialize. `helperCounters({ totalStarsEarned: 39 })` → 0/0; `{ totalStarsEarned: 40 }` → 6/0; `{ totalStarsEarned: 100 }` → 6/5; saved values win over derived ones; NaN falls back to derived.
- [ ] Run `npm test`, see them fail.
- [ ] Implement.
- [ ] Run `npm test`, all green. Commit.

### Task 2: Use-based unlocks in the upgrade config

**Files:** modify `src/phase1/upgrades-config.js`; create `src/phase1/upgrades-config.test.js` (JSDOM stub like `star-animation.test.js`, elements created for every upgrade id).

**Consumes:** `actions.getRechargeClicks()`, `actions.getBatteriesBought()` (new callbacks), the two unlock constants.

- [ ] Failing tests: `buyBattery.cost === 20`; `buyBattery.unlockCondition()` false at 5 clicks, true at 6; `energyGenerator.unlockCondition()` false at 4 batteries, true at 5, true at 0 batteries when its level is 1; both have `unlocksAt === 0`.
- [ ] Implement: `buyBattery` → `cost: 20, unlocksAt: 0, unlockCondition`; `energyGenerator` → `unlocksAt: 0, unlockCondition`; header comment describes the new order.
- [ ] `npm test` green. Commit.

### Task 3: Wire it into the game (state, clover, bar)

**Files:** modify `src/phase1/index.js`, `src/phase1/rendering.js`, `index.html`, `style.css`.

- [ ] `index.js` state: `rechargeClicks`, `batteriesBought`, `cloverUntil`, `cloverTimer`. `rechargeEnergy` and `addReserve` actions count. `winRate()` uses `currentWinRate(upgrades.luck.purchased, cloverUntil, performance.now())`. Save, load (`helperCounters`), reset.
- [ ] `index.html`: `<button id="clover">` as the first child of `#player-zone` (small, centred between board and controls, `invisible` from the start, an SVG ring around the icon).
- [ ] `style.css`: `.clover-btn` idle grey; `.lucky` green icon + ring draining over 3 s (`clover-drain` keyframes on `stroke-dashoffset`); `.evergreen` green, no ring, default cursor.
- [ ] `rendering.js`: `renderClover(el, { visible, evergreen })` and `renderReserveVisibility(containerEl, show)`; `index.js` calls them from `updateUI` through `uiState` (`cloverVisible`, `cloverEvergreen`, `showReserve`). Clover visible when auto-play is bought and the factory is not active.
- [ ] Click handler in `init` (pointerup, abort signal): ignore when evergreen; set `cloverUntil = now + CLOVER_MS`; restart the ring animation (remove `lucky`, force reflow, add); one timeout removes `lucky` at expiry. Reset and teardown clear the timeout.
- [ ] `npm test` and `npm run lint` green.
- [ ] Browser check on port 8123 with a fresh save (debug stars): clover appears with auto-play, turns green for 3 s and refills on click; no big bar before the first big battery; battery button appears at the sixth recharge click; generator at the fifth battery; buying luck leaves the clover lit and unclickable; reload keeps the unlocks; reset clears everything. Screenshot for Ola. Commit.

### Task 4: Simulation, docs, release

**Files:** modify `scripts/sim-phase1.mjs`, `vision.md`, the spec, `CLAUDE.md`, `CHANGELOG.md`, `BACKLOG.yaml`, `INDEX.md` (if it lists specs/plans), version files.

- [ ] Port the scratch simulation into `scripts/sim-phase1.mjs`: clover uptime, use-based unlocks, a player who saves for luck and the battery. Usage: `node scripts/sim-phase1.mjs` prints lazy and fiddler; `new` is accepted and ignored; the v1.19.2 `old` mode is dropped (it lives in git history).
- [ ] Run it; replace the spec's table with the repo sim's numbers.
- [ ] `vision.md`: the three beats (good, slog, upgrade) as the rule for helpers; energy and luck bullets updated.
- [ ] Version v1.53.0 in all four places; CHANGELOG entry; B153 and B154 `done`, `resolved_in: v1.53.0`.
- [ ] `npm test`, `npm run lint`. Commit. Push (push = deploy to GitHub Pages).
