# Chapter IV overnight playtest, v1.66.0 (2026-10-03)

Build: main at 03a2f13, served locally on 8124, `?debug`, Playwright in a visible 1440x900 window (rAF running, `document.hidden` false).
Sessions: (1) iv-start to Cryo I, then my own run on through two sleeps and a scout party; (2) iv-surface: wake, sleep, night 4, game, Quiet hands, Cryo V, an unattended reboot; (3) iv-watcher: drift and snap; (4) iv-body: all four biological steps, the last wake, Go up. About 25 real minutes of play.
Console: no JS errors in any session (only the Tailwind CDN warning and a favicon 404).

## A. What was fun or clear

- The night is clean now. Pressing Sleep strips the screen to the year, two counters, the Watcher and the TREE button. Night 4 typed alone ("Your humans. What use are they?") and the game appeared under it a second later. One thing at a time, as promised.
- The "next:" lines answer "is it broken?": "next: after Cryo II", "next: Surface comes when you sleep again", "next: Surface speaks in 2 sleeps (sooner if you win its game)", "next: the body". After a reboot the line came within a second. "night 4 of 6" under the meter is the best single progress readout in the chapter.
- The night log with threads to the nodes reads well, and the info box quoting the line ("Your humans. What use are they?") under Quiet hands ties voice and gift together.
- The scout odds are still the clearest sentence in IV: "Return 55 %, lost 29 %, back wrong 11 %, followed home by something 5 %."
- The last wake landed: brown colony, H bar at 0, the Watcher's label "US", "Woke: nobody came out.", then "Go up. There is nothing left to lose." and the RETURN card. The sealing lines are a nice lie: "Sector 4 sealed for maintenance.", "Sector 2 sealed. Nothing to report."
- The first sleep teaches: 15 s, "Woke: a year under the ice. Everyone is well." No penalty.

## B. Confusions, in the order met

1. **Opening with nothing to do.** Tree: "Nothing can be bought just now." (896 stars, cheapest node 3 k). Every room button: "Needs a free chamber: dig one first." (old B1, still two purchases per room). Fix: one button that digs and builds, priced as one.
2. **The machine's numbers do not add up for a human.** Hover: "The machine plays. 1 energy a day. Each win is a star." Next to it: "+81/d" stars and "17" spare energy on the E bar. One energy makes 81 stars? Fix: say games, not energy ("plays 243 games a day on 1 energy"), or show energy fed as a share of the bar.
3. **Feed is the cheapest thing and nothing points at it.** "THE MACHINE: FEED · next ★ 3 k" is the first buyable node, but the advisor says "Food grows slowest." and I bought Yield (4.4 k), whose next level then jumped to "★ 40 k · Affordable in 1 year." Fix: the dot/advisor should name the one purchase that moves stars, or the tree badge should glow on it.
4. **Stars are hidden while you shop.** The tree's dim overlay covers the star counter (top right reads as a ghost). Every price in the tree is in stars. Fix: put the star balance in the info box or the tree header.
5. **Cryo I moves the goalpost three times.** Info box: "Cryo I needs generators automated: asleep, nobody runs them." Bought (10 k). Then "Cryo I needs farms automated". Bought (10 k). Then "Cryo I needs mines automated". Then "ready in 5 d". It felt like the game lied twice. Fix: list everything at once ("needs generators, farms and mines automated: 1 of 3").
6. **Same sentence, two meanings.** After buying: "Cryo I is ready: a month a second." Later, with Cryo I only: "Cryo II is ready: a year a second." (not bought, cryo still I). Fix: "Cryo II can be bought: a year a second."
7. **Text that reads like a new room.** "Doubles every farm. Needs 3 hands and 5 energy; makes 28 food." (old B10). Fix: "Doubles every farm: each now makes 28 food and needs 3 hands."
8. **Every wake says itself twice.** "Year 2. Woke: a year under the ice. Everyone is well." on top, the same sentence in the feed right below. Same with "Woke: nobody came out." Fix: the feed skips the line the advisor is showing.
9. **The wake strip is still a riddle.** Room glyphs with no numbers, "+4.4 k +21 k +97 k", "M F E H" with a red tick under M. Gone after a few seconds.
10. **A Cryo I sleep with no end.** Second sleep: year 2.6 to 21 in over 3 real minutes, no alarm, nothing to do but snap. The pill says "runs until something wakes it"; nothing did. I woke it by hand. Fix: show what will wake it ("next alarm: food in 40 y") or cap a sleep.
11. **The snap cooldown fights a natural rhythm.** Clicking every 3 s, every other click did nothing (73.0 to 83.3, then 40.4 to 40.2). Drift is about 1 a second at Cryo I to IV.
12. **"cap" appears from nowhere.** "WATCHDOG · next 20 cap + ★ 20 k". Capacity is never named or shown anywhere else. Fix: "20 capacity (the machines fill it while they sleep: 0 now)".
13. **Surface's line sits on the colony.** 22 px warm text drawn over light grey plates and room icons ("Everyone is sleeping, but us." across three plates). Hard to read on the bright plates. Fix: dim the plates under the line or move the stage below the base.
14. **One throw per visit, and the result is flat.** "Surface: paper. You: rock. It takes 3 stability." / "You: scissors. Surface: scissors. It waits." Then nothing until the next visit. No word won in my nights.
15. **Gifts are bought blind.** Quiet hands bought asleep: the bars are stripped at night, so nothing changes on screen except the price. Awake: energy "-93 used" on "22 k spare". The cascade is about +2 %. The info box says "Automated rooms need no upkeep crew" while "People: 166 free of 166 awake. Nobody on duty" already. Fix: info box shows before and after ("power drawn 457 to 93 a day"), and the wake strip names the gift's effect.
16. **Huge numbers stand still.** "8e15" stars with "+643 k/d"; "600 T" with 230 k a day. Prices in the tree: Seam "★ 29 M" next to 8e15 in the bank, yet "The colony is asleep: wake it to buy." Mixed notation: "8.7 B" ore next to "8e15" stars.
17. **Buy rules differ by node with no sign.** Gifts and Watcher steps buy asleep; levels and cryo only awake ("The colony is asleep: wake it to buy."). Both look the same on the board.
18. **The biological choice is hard to see and dangerous.** After Brain tissue the tree closes and the pill says "BIOLOGICAL · Choose a sector to seal". At iv-body the colony is a ten-floor tower drawn small; the candidate arms are a faint warm tint. The cursor stays an arrow; my first click on a gap did nothing. While choosing, clicks do not snap: stability fell from 51 to 6 and the system rebooted right after the seal. Surface's game card was on screen at the same time (two demands). Fix: freeze drift while choosing, highlight arms strongly, hide the game.
19. **Names drift between node and reason.** Node "BRAIN TISSUE", reason "Needs Brain tissue, human grade first."; node "SPINAL FLUID", reason "Needs Spinal cooling fluid first."
20. **The madness is a number.** At stability 42 the base looks rigid; at 5 the plate edges waver. No text, voice or counter is touched by it. Holding 80 to 90 takes one click every 4 s. See D.

## C. Bugs

1. **TREE ignores clicks during the walk into the hall.** From iv-cryo: press Sleep, click TREE 1 to 2.5 s later: `treeOpen` stays false (reproduced 2 of 2 at 2.5 s, also seen once at iv-body). The button is at opacity 0.45 and accepts the click silently while `#phase-deep` has `is-busy`. At 4 s it opens. Fix: open anyway, or queue the click.
2. **Body steps cost no people.** iv-body, Nervous system: the H bar shows "−2.9 k" (hDrop 19 175 to 16 300), but `state.humans` reads 19 176 within the same half second and stays there; the same for Brain tissue (−1.9 k). The code comment says the creches refill and "the cost shows at the last wake", but at ten thousand years a second the refill is instant, so the drop on screen is the only cost. This reads as broken.
3. **Stale "next:" in the closed tree.** After a quiet visit the closed tree's log still held "next: Surface speaks in 2 sleeps" while the advisor said "next: Surface comes when you sleep again". Not visible until the tree opens (it redraws then); harmless today.
4. **Version label under the menu button.** "v1.66.0" bottom left is half covered by the round ☰ button in every screenshot.

## D. Ola's standing complaints

- **No goal / why build: partly.** The ring and "next:" give a far goal, but in the first 8 minutes the near goal (Cryo I) is revealed one requirement at a time (B5) and the ring sat at "survival 15 %" through two sessions.
- **Click, wait, buy: not.** Session 1 was about 30 dig/build/wait purchases; the second sleep was 3 minutes of snapping with no event (B10).
- **People pointless: not.** "People: 166 free of 166 awake. Nobody on duty"; the body's people refill instantly (C2). Surface's question is right, but the game answers it "none" too early.
- **Bars unclear: partly.** Tooltips are plain ("Food: 46 days left. +14 grown, -11 eaten a day."); the dot sat on a nearly full E bar with "Spare energy grows slowest", and the bars vanish at night exactly when gifts are bought.
- **AI-logic: partly.** Still there: 1 energy makes 81 stars (B2), "Cryo II is ready" before it is bought (B6), Quiet hands frees a crew that does not exist (B15), people taken but not gone (C2), TREE dead for 2 s after Sleep (C1).
- **Night fragmented: mostly answered.** Line then game, screen stripped. Left: the line drawn over the plates (B13) and the game card during the sector choice (B18).
- **Broken, hard or slow: partly.** "next:" and "night 4 of 6" answer it for Surface. Not for a sleep with no alarm (B10) or for star counters that never move (B16).
- **The Watcher's madness felt: not.** It is an orange number and a wobble you see only below about 20. Nothing in the voice, the year or the counters goes wrong.

## E. The three changes that would help most

1. **Show the whole road to Cryo I at once, and the money while shopping.** One line "Cryo I needs generators, farms and mines automated · 1 of 3", the star balance inside the tree, and the advisor pointing at Feed first. This is the first 8 minutes, where a new player decides whether to stay.
2. **Make gifts and the body cost and pay visibly.** Info box before/after on every gift, the wake strip naming what changed, and people taken by the body staying taken for a while (or mourning). Then "What use are they?" lands because the player has just seen the answer.
3. **Give the night an edge and the Watcher a mind.** A sleep that shows what will end it, drift frozen while choosing a sector, and low stability that bends text (Surface's line, the year digits, the advisor's cover-up lines) instead of only the plates.

## Fixed in deep-fix

Branch deep-fix (B230 to B237). What the report asked, and what changed:

- **B5, E1: Cryo I's road.** All at once, with ticks: "Cryo I needs: generators automated ✓, farms automated, mines automated, 15 k ★", on the node and under the sleep pill. Later tiers list what the sleep still meets, then the price.
- **B4, B15, E2: shopping blind.** The tree's top edge shows ore, stars (with their flow) and, asleep, the capacity. Every effect line has before and after: Quiet hands reads "power drawn 457 → 93 a day, ore burned 77 → 15 a day", a level "Doubles every mine: ore 12 → 24 a day, ★ 81 → 73 a day". B7 is partly answered by the same line.
- **C2: people taken but not gone.** The body takes the beds with the people (a share of the colony's beds, for good) and the colony mourns. At "IV · the body" Brain tissue takes 19 176 to 17 258, and 10 s later it is still 17 258; the beds went 19 176 to 17 258.
- **B20, D, E3: the madness is a number.** The base softens from 80 (a fifth of the way at 70, half at 50). Under 50 the Watcher's letters drift and the year stutters; under 35 the "next:" line is garbled like the wake lines.
- **B18: two demands and a reboot after the seal.** The sector is the scheduler's first demand: Surface's game is not drawn and no lamps come while it waits, and the meter holds while choosing. The arms are still faint (B235).
- **B2:** "The machine plays 243 games a day on 1 energy. Each win is a star: +81/d."
- **B6:** "Cryo II can be bought: a year a second.", once.
- **B8:** the feed no longer repeats the advisor's wake line.
- **B10:** at Cryo I and II, a sleep nothing ends wakes after 90 s: "Woke: a look at the colony." The wake pill's tooltip counts it down.
- **C1:** the TREE button opens 0.5 s after Sleep (checked in the acceptance); gifts and feed can be bought during the walk.

Not in this pass (B236): B1, B3, B9, B12, B13, B14, B16, B17, B19, C3, C4.
