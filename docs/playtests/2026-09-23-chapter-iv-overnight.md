# Chapter IV overnight playtest, v1.47.0 (2026-09-23)

Build: main at 1dfb7aa, served locally, `?debug`, Playwright in a visible 1440x900 window (rAF running).
Three sessions, about 17 real minutes in total: iv-start (10 min), iv-cryo (5 min), iv-watcher (3 min).
No JS errors in the console (only the Tailwind CDN warning and a favicon 404).

## A. What was fun or clear

- The survival ring is readable at once: "survival 15 % · need 85 %", "survival 85 % ~ year 802 701". The goal exists from second one.
- Bar tooltips are good plain sentences: "Food: 69 days left. +14 grown, -11 eaten a day."
- The scout button tells its odds before you go: "Return 57 %, lost 27 %, back wrong 11 %, followed home by something 5 %."
- The melting base at low stability looks great, and the riddle card works: a wrong answer shows "-5", a right one "+15".

## B. Confusions, in the order I met them

1. **The dot says "mine", the mine button is locked.** Start: "The mine is the bottleneck." The mine button says "Needs a free chamber: dig one first." Every room costs two purchases, dig then build, and the dig is the real price (dig 305 rising to 8.6 k in 10 min, rooms 77 to 295). Fix: one button builds the room and digs its chamber, priced as one.
2. **A full bar carries the red dot.** At the start the M bar is full (1.5 k ore) with the dot on top. Later the F bar is full at "583 d", "13 k d", even "96 M d", and the advisor still says "the farm is the bottleneck." It marks the weakest flow, not scarcity; a human reads it as "we are short of food". Fix: dot only when a store is actually short, or call it the slowest column.
3. **Cryo caption and tooltip disagree.** The caption beside the snowflake flips between "needs a free chamber" and "needs generators automated"; the tooltip always says "Cryo I needs the generators to run without hands." Fix: one reason, the same text in both.
4. **"Automate the weakest" cannot automate what cryo asks for.** Cryo I needs the generators automated; the button only offers the weakest column's room ("Runs the mines without people"), and "Level the weakest" spends the same stars. In 10 minutes of following the dot I never reached cryo (year 1, month 9). See D and E1.
5. **Stars stood still for a minute.** With the dormitory as the weakest column, stars stayed at exactly 2 528 from 60 s to 121 s ("ten for every unit of the weakest column"), while the dormitory needed a dig first. Nothing on screen said the machine had stopped.
6. **Terms drift.** Feed: "The bottleneck moved from minerals to food." Everywhere else it is ore, a pickaxe and "M". "people", "hands" and "H" are also the same thing. Fix: one word per column.
7. **Feed spam.** Five lines in a row of "The bottleneck moved from X to Y." push out anything that matters.
8. **Unexplained marks.** The small numbers on the rooms (0, 1, 2 are levels, not people), thin rings around room buttons, a hollow circle floating at the edge of the crust that never changes, "+822 hands" above the H bar, a hatched H fill, "28 ☆/☼" under the bars (the same number as "+28/d" under the star counter).
9. **Tooltips cover what they talk about.** The dig tooltip covers the star counter and the feed; the cryo tooltip covers its own orange caption.
10. **Button text says one thing, tooltip another.** "Level the weakest": "Doubles every farm. Needs 3 hands and 5 energy; makes 28 food" (reads like a new room). The second "Automate the weakest": "Triples what the farms make". Automate's price shows both a pickaxe and a star: "⛏ 60 k ☆". "makes 12 ore" has no "a day".
11. **The scene outgrows the window.** At year 1 the bottom room is cut off at 1440x900; the camera does not reframe.
12. **The first sleep ends in a failure nobody explained.** From iv-cryo: snowflake, a riddle card appears at once with an empty box and no hint ("4, 5, 7, 10, 14, ?"), SYSTEM AWAKE and a STABILITY meter I have never seen. I did nothing for 65 s, then: "Woke: the system rebooted." The first wake a new player gets is a penalty from a meter they were never shown.
13. **"A longer sleep" does not sleep.** The chevron button marked "1 y/s" buys Cryo II. I clicked it to sleep longer; nothing happened on screen except the snowflake's badge changing from "1 m/s" to "1 y/s". No feed line for the purchase. Fix: name it "Faster sleep" or put the upgrade inside the snowflake.
14. **Deaths weigh nothing.** "Woke: scout party lost." then people back to 16 within seconds. After a sleep the strip says "-473" people while H shows 119.
15. **The early ascent is the best scout.** "Try to resurface" at 15 %: 4 of 16 died ("4 went up and did not come back"), and the estimate collapsed from "15 ± 40 %" to "15 ± 3 %" at once. A scout party costs 3 k ore plus 4 people, and lost the party. After one failed ascent, scouts have no purpose.
16. **Progress you cannot see.** Wake strip "+46 B ☆" while the counter stays at "600 T"; a right riddle gives "a month of the machine's wins", about 734 B on 600 T. The strip's room glyphs (pickaxe, sprout, bolt, bed) have no numbers and no meaning I could find, and it is gone after about 7 s.
17. **Snap is any click.** The cursor is a crosshair over the whole screen; a click on empty black void gave +5 like a click on the base. Two of four clicks inside the 4 s cooldown did nothing, with no sign of a cooldown. At Cryo IV the meter drains 1.6/s and snap can give at most 1.25/s.
18. **Garbled lines never showed.** Below 35 only the reboot woke me, and the reboot line is never garbled, so a player who ignores the Watcher never sees the drift.

## C. Bugs

1. **Scout badge "1 y 12 m".** Send a party from iv-cryo, the badge reads "1 y 12 m" (should be "2 y"). `backIn()` in src/phase4/readout.js does months as floor(rest / 30), so days 360 to 364 of a year give "12 m" (5 days a year, twice per trip).
2. **Stuck tooltip.** Click the snowflake, move the mouse away: its tooltip ("1 m/s Sleep: a month a second...") stays visible over the scene (seen twice, after sleep start and after a wake). Probably focus-driven.
3. **Pause button covers the chapter label.** The round pause button sits on "IV · THE DEEP" bottom left, hiding "IV ·". Every screenshot.
4. **Duplicate wake line.** After a reboot the top advisor line "Year 12 821. Woke: the system rebooted." repeats the newest feed line right below it.
5. **Changelog contradiction (docs only).** v1.47.0 says "Chapter IV does not read the flag yet", but pause freezes IV (day 4 679 909 stayed put for 3 s), as v1.46.0 says.

## D. Ola's standing complaints

- **No goal: partly.** The ring and "year 802 701" are always on screen, but the ring did not move once in 10 minutes (15 % throughout), and the near goal, Cryo I, was blocked by a requirement the buttons cannot meet (B3, B4).
- **Click, wait, buy: not.** The first 10 minutes are dig, wait, build, wait, level; about 27 purchases, and the dot picks every one. Sleep is a state now, but left alone it is 65 s of watching numbers until a reboot.
- **People pointless: not.** They refill in seconds, "-473" of 119 means nothing, and throwing 4 at the surface buys a perfect reading (B14, B15).
- **Bars unclear: partly.** The tooltips answer it; the bars do not: a full bar with the red dot and "96 M d" labelled bottleneck (B2).
- **Probes unexplained: mostly answered.** The scout tooltip is the clearest text in IV. Undercut by the ascent exploit and by a lost party yielding nothing.
- **AI-logic: partly.** Still there: "A longer sleep" is a purchase, "Automate" sells a tripling, snap works on empty void, cooldown invisible, riddle reward invisible, cryo caption and tooltip disagree, garble unreachable in practice.
- **Why lots of resources: not.** Late game holds 13 B ore, 96 M days of food, 600 T stars; asleep nothing can be bought, the star counter no longer visibly moves, rewards round to zero.

## E. The three changes that would help most

1. **Make Cryo I reachable by reading the screen.** When cryo needs automated generators, the automate button must offer generators (or the requirement should be something the dot leads to). One reason, same text in caption and tooltip. Today a player who follows the game's own instruction does not get to sleep in 10 minutes.
2. **Teach the Watcher on the first sleep instead of punishing it.** First sleep: no riddle in the first seconds, a slower drain, and the first wake a normal alarm, not "the system rebooted". Make the snap target the base only and show the cooldown (the base refusing to snap is enough).
3. **Give people and stores weight.** No instant refill after deaths; the failed ascent reveals only a little (or costs far more than a scout); stop marking full stores as the bottleneck; give stars a sink during sleep (the planned Watcher upgrades, B113) so big numbers mean something.

## Fixed in v1.48.0

1. **Cryo I reachable by following the game** (B3, B4, E1, D "no goal"). One reason from one function, `cryoNeed()` in readout.js: the caption is its short form, the tooltip the same words plus why ("Cryo I needs generators automated: asleep, nobody runs them."). It reads the dry run of the colony with every order already built, so an ordered automation is not asked for twice; then "ready in N d" while orders are built; then the price. `offerFor()` makes the automate and level buttons sell the next goal first ("Automate generators (so the colony can sleep)."), then what runs low, then the weakest column, and each says why. The automate button shows as soon as cryo needs it. The hall digs its own chamber. Automation I 60 k to 10 k, the hall 40 k to 15 k. The colony comes down with a mine (4 chambers): without it the salvage burned from day one and a dot-follower could end with no ore and no power. Verified: `src/phase4/policy.js` (a player who follows the dot with ore and the caption with stars, saving when the goal is under a minute away) buys Cryo I at 286 s in `overnight.test.js`; the same policy clicking the real buttons in headless Chromium from iv-start bought it at 278 s, with caption and tooltip agreeing in all 278 samples and no console errors.
2. **The first sleep teaches** (B12, E2). First sleep: no drift, alarms do not jolt the meter, no riddle, the advisor line "Something stayed awake while they slept.", and it ends after a colony year on "Woke: a year under the ice. Everyone is well." Drift starts with the second sleep, 0.5 a second at Cryo I. A sleep never opens on a riddle (half a gap first). The reboot line goes to the feed once, not to the advisor line (C4). Verified from iv-cryo: stability 100 throughout, woke on the year alarm, 0 reboots.
3. **Snap only on the model** (B17). A raycast on plates, lanes, bridges and the shafts; a click on the black does nothing. The crosshair only over the model; during the 4 s cooldown a thin ring round the cursor counts down and a click only nudges the ring (the base does not move). Verified on iv-watcher: void click 0, model click +5, click in the cooldown 0 with no flash.
4. **The dot marks what runs low** (B2, B7). `lowPoint()`: the fewest days of cover when a store is falling ("Food runs out in 21 days."), else the slowest-growing bar that is not full ("Nothing is falling. Ore grows slowest."); never a full bar, no dot when all are full. A falling store whose bar is full does not count either. The star rule keeps deep.js's weakest. The feed's "the bottleneck moved" lines are gone; "minerals" is "ore" (B6, the column words only). Verified: the dot sat on a full bar in 0 of 278 samples of the browser run (16 of 302 before the full-bar rule covered falling stores).
5. **Weight** (B14, B15, B16, D "people pointless"). Mourning in deep.js (`mourn()`, `MOURN_DAYS` 365, tested): no births for a colony year after a party lost or half-lost, a failed ascent, or lives lost in the ice over a sleep. A failed ascent costs a third of the colony and replaces the belief with a poor reading ± 15 (was the truth ± 3). `rewardShows()`: the wake strip leaves off numbers that would not move their counter, and a riddle names its stars only when they show.
6. **Bugs.** C1 `backIn()`: days 360 to 364 of a year roll to the next year ("2 y", tested; the badge read "2 y" in the browser). C2 a click puts a button's tooltip away until the cursor leaves (opacity 0 after the click and after the wake). C3 the chapter label moved right of the pause button in style-deep.css (no overlap measured). C5 corrected in the v1.48.0 changelog entry.

Not fixed here, in BACKLOG: B1/B5 (a room and its chamber as one purchase; the star counter standing still), B8/B9/B10 (unexplained marks, tooltips over what they explain, button text against tooltip), B11 (the camera does not reframe), B13 ("A longer sleep" is a purchase), B16's strip glyphs, B18 and the Cryo IV drain against the snap (B118).
