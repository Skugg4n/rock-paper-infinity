# Chapter I: the little clover and the energy ladder

*2026-10-02. Backlog: B153 (clover), B154 (battery). Decided with Ola in chat the same day.*

## Why

Two things in chapter I:

1. During auto-play the player has nothing to fiddle with. Ola wants a small
   four-leaf clover to click: a click gives a few seconds of luck.
2. The big battery is never needed. The simulated player buys zero of them. The
   v1.20.0 pass moved the generator from "50 ★/s" to "30★ earned"; v1.21.0 moved it
   to 100★ but that is still about 90 seconds after the battery unlocks, the battery
   is worse value than the recharge button (17 vs 25 energy per star), and the
   generator is cheaper than one battery. The big battery's bar is also on screen
   from 10★, long before the battery exists.

## The rule (goes into vision.md)

Every helper has three beats: **it is good** (the new thing solves the problem),
**it becomes a slog** (the power line outgrows it, the player works to keep up),
**an upgrade makes it good again**. Uphill and downhill. The next helper must not
arrive before the slog of the previous one has been felt.

## The little clover

- Appears when auto-play is bought. Free. It sits by the game board, not in the
  upgrade tray: it is a toy, not a purchase.
- A click gives 3 seconds of luck: win rate 2/3 instead of 1/3, in animated and
  bulk mode alike (same `pickOutcome` path as today's luck).
- A click while luck is running refills to 3 seconds. It does not stack.
- While active the clover is green and a ring around it drains over the 3 seconds.
  Idle it is grey like the other icons.
- Not saved. A reload starts with the clover idle.
- **The big clover** is today's luck purchase, unchanged (50★ after 100 games).
  When it is bought the little clover stays lit for good and stops being
  clickable; it is now the sign that luck is always on. It leaves with the
  boards when the factory is built.

## The energy ladder

| Step | What | Arrives | Price |
|---|---|---|---|
| 1 | Ordinary battery: the 100 tank + recharge button | 15★ earned (as today) | 1★ → +25 (as today) |
| 2 | Big battery: a pack of 500, buy a new one when it is empty, can be topped up to 1 500 (as today) | after **6 recharge clicks** | **20★** (was 30★) |
| 3 | Generator | after **5 big batteries bought** | 25 · 1.07^L (as today) |

Unlocks are tied to *use of the previous helper* instead of to lifetime stars. That
makes the order hold whatever the pace: a player who fiddles with the clover earns
twice as fast, and star thresholds would hand them the next helper before the slog.

The big battery's bar is hidden until the first big battery is bought.

New counters, both saved: `rechargeClicks`, `batteriesBought`.

Old saves have no counters. On load: lifetime stars ≥ 100 counts as both unlocks
met, ≥ 40 as the battery unlock met. A generator level above 0 always counts as
unlocked.

## What the simulation says

`node scripts/sim-phase1.mjs` (v1.53.0: clover uptime, use-based unlocks and a
player who saves up for the battery and for luck). "Lazy" never clicks the clover,
"fiddler" keeps it lit 80 % of the time.

| | Lazy | Fiddler |
|---|---|---|
| First recharge click | 1:57 | 1:35 |
| Big battery | 3:20 (after 6 clicks) | 2:59 (after 7 clicks) |
| Big clover | 4:07 | 2:19 |
| Bulk (speed 10) | 5:31 | 3:32 |
| Seconds between big batteries | 155, 27, 13, 14 | 71, 17, 14, 11 |
| Generator | 6:50 | 4:52 |
| Factory | 11:59 | 10:00 |
| Bank | 12:54 | 10:55 |

The shape is the one asked for: the first big battery lasts minutes (good), the
speed-10 jump eats the next ones in seconds (slog), then the generator arrives.
With the same player model on today's balance the bank comes at 13:57 (lazy) and
11:36 (fiddler), so the chapter gets about a minute shorter; the fiddler is two
minutes ahead of the lazy player, which is the reward for fiddling.

These are the times from the shipped simulation. One more big battery is bought
after the generator arrives (the first generator levels do not cover speed 20+ on
two boards), then the generator has outgrown it.

## Out of scope

- No change to speed, boards, factory, bank or foam.
- No sound for the clover in this pass.
- Luck as a track with several levels (B020) stays an idea.

## Tests

- `rates.test.js`: win rate with the clover active, expired, and with the big
  clover bought.
- `persistence.test.js`: the two counters round-trip; an old save without them
  gets the derived values above.
- Unlock tests: battery hidden at 5 clicks and shown at 6; generator hidden at 4
  batteries and shown at 5; generator shown when its level is above 0.
- Browser check: the big battery's bar is absent before the first purchase.

## Amended the same day (v1.55.0, after Ola's playtest of v1.54.0)

- **The clover** moved into the player's row, right of auto, and is no longer green:
  pressed in with a dark draining ring while the luck runs, and a small clover with
  an arrow up beside the stars-per-second. Idle it looks like the other buttons in
  the row (the grey version read as disabled).
- **The big battery** arrives when the machines eat 22 energy a second, not after
  six recharge clicks (a player who fills the tank makes six clicks at once, so it
  came before it was needed). Once bought it stays. Its bar grows in.
- **The first five stars** lie big under the board; after the fifth the next slots
  plop in and the row glides to its corner. The flying yellow star is removed.
- **The hand buttons** shrink and go grey while the machine plays.

| | Lazy | Fiddler |
|---|---|---|
| First recharge click | 1:57 | 1:35 |
| Big clover | 3:27 | 2:19 |
| Bulk (speed 10) | 4:56 | 3:22 |
| Big battery (22 energy/s) | 5:39 | 4:05 |
| Seconds between big batteries | 15, 13, 11, 7 | 16, 13, 10, 7 |
| Generator | 6:25 | 4:51 |
| Bank | 12:20 | 10:46 |
| Recharge clicks | 34 | 31 |

Decided by Ola the same day (v1.56.0): one purchase fills the whole big bar
(1 500). The big batteries then last 38, 18, 14 and 9 seconds, the generator comes
at 6:58 (lazy) and 5:24 (fiddler), the bank at 12:16 and 10:42. The bar has the small
one's colour, and a full battery cannot be charged (its button is greyed).
