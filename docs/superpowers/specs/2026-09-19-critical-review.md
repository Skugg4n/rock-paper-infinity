# Critical review — Rock, Paper, Infinity v1.33.0 (2026-09-19)

Ola asked for a critical pass: what needs tweaking, what is missing, what is wrong. This
is my honest read after building v1.20–1.33 in two days and playing every checkpoint.
Severity: **A** breaks the feel or blocks; **B** noticeable; **C** polish. Each item has
a proposal. Nothing here is built yet unless marked.

## Across the game

1. **A · Numbers explode past legibility in II.** Stars reach 10¹² and income
   10¹⁰/s. The Roman-numeral texture of I is gone; the counter is a wall of digits.
   Proposal: `formatCount` everywhere in II with k/M/B/T and a *small* full number on
   hover; and revisit per-person income (10 × multipliers ×11 ×2⁵ = 35 200 per person is
   what makes it explode). Cutting computer ×11 → ×4 and superconductor ×2 → ×1.5 keeps
   the cascades and lands II around 10⁹ instead of 10¹².
2. **A · No sense of time passing.** Nothing tells the player how long they have played
   or how fast things move. Idle games live on "when I come back". Proposal: an idle
   return summary (you were away 12 min: +N stars) and offline progress at a reduced
   rate. This also sets up chapter IV, where time is the resource.
3. **B · Save/load is invisible.** Fixed for testing (checkpoints + snapshots, v1.33.0),
   but the player never knows the game saves. Proposal: a tiny "saved" tick on the
   version label once a minute; export/import stays in debug.
4. **B · Reduced-motion users get nothing from the ants and war.** Acceptable for a
   prototype; note it.
5. **C · Icons carry too much on their own in III.** The one no-tutorial rule is right,
   but the swords/shield/hammer/flame/crosshair set needs the greyed-teaser rhythm of II
   (each appears when it matters, not all at once).

## Chapter I

6. **B · Speed 1–9 is a long hand-fed stretch** (4–5 min in the sim). It is meant to be
   the "silly" phase, but the player has one button to press (recharge). Proposal: let
   the hand rounds count more (a hand win = 2 stars while below speed 5), or shorten the
   ladder to speed 10 by making the first six speed levels cheaper.
7. **B · The factory ×10 is a black box.** The player sees a factory icon and a ×10
   jump. Proposal: the factory tooltip shows "×X" (Roman) and the foam ring gets a hint
   of what a collapse gives (the same "+N" pop as the harvest).
8. **C · Bank ring reads as a level ring.** Same visual as speed/board dashes but means
   progress. Proposal: goal rings (factory, bank) should fill clockwise with a lighter
   colour so they are distinguishable from spend rings.
9. **C · The chapter card `I · TRIVIAL` plays only once.** Fine, but returning players
   may not remember the chapter names. Proposal: show the current chapter numeral faintly
   next to the version label.

## Chapter II

10. **A · The city has no end state feedback.** "Everything bought" triggers the raid
    after 30 s, but the player does not know the city is complete. Proposal: when the
    last research is bought, the research column collapses to the swords (greyed) and
    the island coastline appears with a short settle animation. The island already
    exists; tie the reveal to completeness, not to the 20th plot.
11. **A · Food is a hidden tax in war.** Troops eat; the silo drains; houses get the
    stop dot; the player thinks it is a bug. Proposal: the silo tooltip shows "people /
    troops" consumption split, and the war HUD shows a small basket next to defence.
12. **B · Stalls become a click farm** (Ola bought 400). Proposal: stalls cap at 20 per
    island and GMO multiplies them; beyond that the button is gone (helper outgrown).
13. **B · Districts fill at 500/s regardless of food and have 100k capacity**: one
    district doubles the city. Proposal: district growth needs food per second in
    proportion (it already stops at zero supplies) and the first district costs more
    than the megastructure research so the order is felt.
14. **B · The competitor's capital is five tiles on a 60 s clock, always the same.**
    Proposal: stage timing follows *our* progress a little (each of our researches
    nudges their clock), so a fast player meets a fast enemy.
15. **C · Selling (−) still exists but is pointless late.** Keep; it is quiet now.
16. **C · The allocation slider disappears (fades) when science is done** before the
    competitor exists. Fixed to stay when the competitor exists (v1.32.0); consider
    keeping it always once revealed.

## Chapter III (prototype)

17. **A · Waves never really threaten a decent defender.** Sim: min standing 19/20.
    Proposal: waves target the *weakest* plate half the time (weight ×3 on fort 0), and
    every fifth wave is a "push" of double size announced by the radar. Radar is the
    missing helper: without it the player cannot plan, with it they can.
18. **A · Nothing explains what a tier does.** Fists → nuclear is only a numeral.
    Proposal: the flame tooltip shows the tier id (already) and, more importantly, its
    *mode* icon (walking dots / arc / triple arc) so the jump to artillery is expected.
19. **A · Strike is all or nothing.** Force is released entirely. Proposal: strike sends
    half by default; a long-press or a second button sends all. Or: the auto option
    already strikes when it can win; make manual strike show a predicted outcome (a
    small ✓ or × on the crosshair when force×power beats their defence + tile HP).
20. **B · Our tracers are decorative.** They fire but do nothing. Proposal: make them
    real: each tracer hit removes one wave dot with probability proportional to our
    defence per plate. Visual and numbers meet.
21. **B · Fortify per plate (◆) is fiddly with 18 plates.** Ola asked about a
    fortification band at the coast. Proposal: fortify the *row* (a band along the
    bottom rows, since waves come from the south) as one button with levels; per-plate
    ◆ stays for the fussy.
22. **B · The enemy's island never changes except razed tiles.** Proposal: a small
    red HUD (their tier, their defence, a bar of their island's scorch) so "we are
    winning" is visible; and their tiles show HP shading like ours.
23. **B · Clearing a ruin is instant.** Proposal: a clearing ring (20 s) so the ruin is
    a wound, then the plot returns.
24. **C · The rocket leaves in four seconds and the anchor appears at once.** Give it a
    beat: the island goes dark over 10 s, then the anchor teases.
25. **C · Doomsday is a skull.** It works, but a skull is the only "text" glyph in the
    game. Consider the ring alone with a darkening centre.

## Balance numbers I would touch first (sim-backed)

| knob | now | try | why |
|---|---|---|---|
| computer multiplier | ×11 | ×4 | II income 10¹⁰ → 10⁹, cascades intact |
| superconductor | ×2 ×5 levels | ×1.5 | same |
| district growth | 500/s | 300/s | endgame of II a real climb |
| wave weight on fort 0 | ×1 | ×3 | defenders lose plates sometimes |
| tier cooldown | 45 s | 60 s | tiers as events, not clicks |
| enemy leaves | 2 500 scorch | 3 500 | war 22 → ~30 min greedy |
| stalls cap | none | 20 | helper outgrown, no click farm |

## What I would build next, in order

1. Radar + tier mode icons + predicted strike outcome (17, 18, 19): the war becomes
   readable.
2. Formatting and the multiplier haircut (1): the game becomes legible again.
3. City-complete feedback + food split (10, 11): the bridge into war is understood.
4. Row fortification + real tracers (20, 21): the war becomes tactile.
5. Idle return summary (2): the game becomes an idle game.
