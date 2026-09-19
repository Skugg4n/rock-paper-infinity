# Phase 1 "avalanche" pass — v1.20.0 (2026-09-18)

Ola playtested v1.19.2 and found it "otroligt dåligt fungerande": the ★/s said 0.2 but he
got one win per 20 s, an upgrade button was cropped, wins were hard to read, and nothing
felt like an avalanche. This spec records the diagnosis, the changes, and the numbers,
so the next balance pass starts from data. Simulation: `node scripts/sim-phase1.mjs new`.

## Diagnosis

1. **Displayed rate was a formula, not a measurement.** It ignored energy pauses and
   the real round cadence. Worse, the game loop had dead zones: at speed 4–5 the round
   animation (760 ms) outlasted the shared interval (690–750 ms), so every other tick
   was skipped and buying speed halved the rate.
2. **Energy was a click tax.** Generator unlocked at a theoretical 50 ★/s (~20 min in),
   so the player fed 1 ★ → 10 energy by hand. Sim of the old balance: 683 recharge clicks,
   22 minutes at 0.2–3 ★/s before anything happened.
3. **Soft-lock.** Hand play cost energy. At 0 energy and 0 stars nothing could happen.
4. **Luck did nothing after speed 10.** Bulk mode hard-coded a 1/3 win rate.
5. **Winner/loser looked the same** (two grey rings). At speed ≥ 10 the board showed random
   icons with no result at all (B001).
6. **Factory gated on maxing everything** (55 speed + 100 generator + 8 boards): a long flat
   plateau of identical purchases right before the payoff.
7. **Dash ring cropped**: `#upgrade-tray { overflow-y: auto }` also clips horizontally.

## Changes

| Area | v1.19.2 | v1.20.0 |
|---|---|---|
| ★/s display | formula | measured EMA (α 0.2/s) of real income |
| Round timing | shared interval, skips | per-board: 3/2/1 frames × max(120, 400/s) ms + hold max(160, 500/s) + 100 ms gap; monotonic |
| Hand play | costs energy | free (only machines pay) |
| Recharge | +10 for 1★ | +25 for 1★ |
| Speed | max 55, cost 10+2L | max 40, cost 10·1.08^L (sum ≈ 2 590) |
| Generator | unlock at 50 ★/s, cost 50+5L | unlock at 30★ earned, cost 20·1.03^L (sum ≈ 12k), +5/s per level |
| Battery | unlock 50★ | unlock 60★ |
| Luck | 2/3 win rate only in animated mode | 2/3 in both modes, via `pickOutcome` |
| Boards | unlock 100★, cost 100+25L | unlock 150★, cost 150·1.6^L (sum ≈ 10.5k) |
| Factory | 1 000★, needs everything maxed | 5 000★, needs speed + boards maxed + luck; runs on its own reactor (no energy) |
| Foam | 1 000 games, bonus 10 s of SPS | 20 000 games, bonus 30 s of SPS |
| Bank | 50k lifetime ★ | 250k lifetime ★ |
| Result visuals | grey ring on both | winner bold + thin dark ring, loser 28 % opacity, draw 60 %; same in bulk mode |
| Tray | clipped | 12 px padding / −12 px margin |

Unlock order (by lifetime ★ unless noted): auto 2 → speed (after auto) → recharge 15 →
generator 30 → battery 60 → luck (100 games) → boards 150 → factory (grids full) → bank 250k.

## Simulated greedy player (new balance)

| t | ★/s | speed | boards | gen |
|---|---|---|---|---|
| 0:30 | 0.2 | 1 | 1 | 0 |
| 2:30 | 0.5 | 3 | 1 | 1 |
| 4:30 | 0.9 | 8 | 1 | 1 |
| 5:30 | 6.7 | 10 | 1 | 2 |
| 6:30 | 46 | 23 | 3 | 14 |
| 7:30 | 164 | 41 | 6 | 50 |
| 8:30 | 2 460 | 41 | 9 (factory) | 66 |

Milestones: bulk 4:56, luck 5:18, factory 8:18, bank 9:23. Two recharge clicks total.
A human is roughly 1.5–2× slower, so chapter I should take 15–20 minutes.

## Open for Ola

- Is 15–20 min the right length for chapter I? Knobs: cost ratios (1.08 / 1.03 / 1.6),
  bank gate, factory price.
- The speed-10 jump (×7 in one purchase) is deliberate; should it be celebrated visually?
- Old saves: speed levels above 40 are clamped on load; nothing else migrates.
