# Chapter IV, human pass 3 (v1.84.0, 2026-10-04)

One headless Chromium (Playwright, `--mute-audio`, `rpi-audio` off), 1440x900, one static server on 8124, `?debug`
checkpoints. Read from screenshots only; every screenshot arrived. I paused the game while I read each screenshot,
so the times are game time with human-speed reactions. In GROW I timed pumps off the beat clock (perfect timing),
so a human pumps slower than I did. The browser driver hit a time limit at GROW 1:00; I replayed GROW from the
checkpoint with the same choices. Runs: iv-start 5:00, iv-cryo 6:00, iv-grow 8:00, plus 20 s of iv-rise.

## A. Verdict

**Yes, for the first time, with one warning.** Every part now has a choice with a visible answer, the Watcher
teaches itself, and the hands come at 3:13 into GROW (pass 2: 8:50). The warning: GROW's second half turns into
pump-and-dream waiting, and the rise was out of reach at 8:00 (20 of 35 rooms taken).

## B. Pass 2's worst moments and bugs

1. Watcher punishes without teaching: **fixed.** STEADY THE MIND plus a hint, both lamp games say what to do, "RIGHT +15".
2. GROW gauges unreadable: **fixed.** The short gauge is ringed red and named on the tape ("FLESH is short.").
3. Dead end TAKE A CHAMBER: **fixed** (the tape says DREAM), but the dream itself is now the slow part (D1).
4. Drawer: **half.** It opens on the tape's row, ringed. Prices still chase income (D3).
5. Building costs income in silence: **fixed.** Hover: "★ 148 → 136 a second. It draws the machine's power."
6. Ring of four ignores the tape: **fixed.** The named organ or room is ringed gold.
- Bug, machine tooltip off the right edge: **not checked** (I never hovered the machine).
- Bug, BUILD FARM asleep: **not seen.**
- Bug, tape names an auto the drawer lacks: **not fixed.** At 0:30 the tape said SAVE FOR GENERATOR AUTO; the drawer had no such row. At 0:45 it did.
- Bug, Surface buttons drift: **not seen**; 4 of 4 throws landed.
- Bug, woke after a year with no reason: **fixed** ("The first sleep is short. The next ones go deeper.").

## C. Play log (mm:ss · what I can choose · does it show · bored)

**TEND, iv-start**
- 00:00 · DIG, the only lit thing · yes · no
- 00:30 · the ring of four, FARM ringed; took GENERATOR instead: +60 → +148 a second · yes · no
- 01:00 · OUTPUT now or save for GENERATOR AUTO; OUTPUT: +148 → +299 · yes · no
- 01:30 · FEED THE MACHINE (+409); the ★ 7.5 K lamp lit, then went dark again when an auto took me under 7.5 k · partly · no
- 02:00 · BUILD MINE (hover "409 → 389"), FARM AUTO · yes · no
- 02:30 · DRILL AUTO, three lamps, "★ 986 to go"; lever at 2:35 · yes · no
- 03:00 · awake after 10 s; every drawer row 410 k, I hold 145 k; dig, sleep · no · a little
- 03:30 · BUY CULTURE VATS in the night; Surface: "It takes 3 stability." · yes · no
- 04:00 · Cryo II or creche, same price; took Cryo II; prices jump to 4.9 M · yes · no
- 04:30 · STEADY THE MIND; about ten clicks to bring it back · partly · no
- 05:00 · Cryo III; "SAVE FOR CRYO IV ★ 115 M to go" · yes · a little

**SLEEP, iv-cryo**
- 00:30 · lamps came while the drawer was open: "One lamp goes out. Click that room", 2.8 s; RIGHT +15 · yes · no
- 01:00 · Surface, scissors beat paper; Cryo II, built a generator, slept · yes · no
- 02:00 · ignored STEADY THE MIND on purpose · no · yes
- 02:30 · "store full" at 22 M; the tape stays on STEADY THE MIND, not WAKE · no · yes
- 02:42 · FAULT: THE MIND RESTARTED. It cost me nothing I could see; I was due to wake anyway · no · no
- 03:30 · 137 M to save at +3 M a second, nothing to do · no · yes
- 04:15 · "Repeat the lamps", four rooms, RIGHT +15 · yes · no
- 04:40 · Cryo V 1.6 B, or LOSSLESS RELAY plus BEDS; took those: +47 M → +93 M, people 16 → 20 · yes · no
- 05:00 · Cryo V now 5.6 B, because I earn more · yes · no (annoyed)
- 05:30 · STEADY THE MIND; eight quick clicks did nothing, one per four seconds works · partly · a little
- 06:00 · WAKE "The store is full."; Cryo V "You need 1.6 B more" · yes · a little

**GROW, iv-grow**
- 00:30 · ring of four, plain hover lines; cheap vat, gut, heart; +5 B → +15 B · yes · no
- 01:00 · MASS ringed red, then DREAM; dreamt 22 s: one more room in reach · partly · yes
- 02:00 · nerve, guts, heart; +25 B → +33 B · yes · no
- 02:38 · FLOORS 1 / 3 · yes · no
- 03:13 · pumped for the hand (65): three hands, +77 B → +307 B, MACHINE 1 / 1 · yes · no
- 03:30 · floor 2 costs double (19 cheap, 37 full) · yes · no
- 04:30 · DREAM 8 s, pump, take, repeat · partly · a little
- 05:00 · GROW A GUT on a room, 40 s later GROW A NERVE on the same room · yes · a little
- 06:30 · three rooms STARVING, stars 317 B → 233 B: a real crisis · yes · no
- 07:00 · "A HEART: 4 to go."; ten beats gave one mass (the pumps went to the dead rooms, unsaid) · no · yes
- 07:30 · heart regrown, the dead revive, +395 B · yes · no
- 08:00 · floor 2 8 of 12, floor 3 untouched, a 10 s dream gave nothing · no · yes
- iv-rise (extra): RISE, the body climbs through the strata with the hands on top, "V UNITY TO COME". Works.

## D. Worst moments now

1. **GROW after the hands is waiting.** DREAM opens about one room per 10 to 20 s; you just watch. Fix: DREAM grows toward a room you click, in a few seconds.
2. **The rise is out of reach in 8 min** even with perfect beats. Fix: fewer rooms on floor 3, or mass income that grows with each floor, so the rise lands about 4 min after the hands.
3. **Prices chase income.** A good buy (relay) raised Cryo V from 1.6 B to 5.6 B. Fix: fix the cryo price when the tier opens, or show "Cryo V after this: 5.6 B" on the row.
4. **Pumps vanish into dead rooms.** The tape says pump for a heart; the beats go to reviving. Fix: a float "→ revive" on the dead room, or keep mass and revival separate.
5. **Ignoring the mind is free.** FAULT only wakes you early. Fix: the FAULT costs something you can see (people, or a night's stars).
6. **Steady clicks are silently swallowed** for 4 s. Fix: a cooldown ring on the cursor, or every click counts a little.
7. **Two asks at once:** FLESH ringed red while the tape says DREAM; GUT then NERVE on the same room. Fix: one ask, and never undo your own advice.

## E. Unclear texts

"It gives 8 capacity and a word." · "It takes 3 stability." · "WATCHDOG ★ 20 k · 20 capacity" · one meter, three names:
"THE WATCHER", "STEADY THE MIND", "stability" · "PUMP. ⧫ 2 to go." (2 for what) · "store full" (it means this sleep
has paid out) · "Prices follow what the colony earns. They are set when it wakes." · "Needs generators automated ✓,
farms automated ✓ and mines automated ✓." (all ticked, still listed) · "THE COLONY HAS SLEPT 0 MONTHS" · "GUT NOW. YOU
HAVE 26. FEED IS SHORT." · "SURGE ×1.36" · "×4.8" · "4e15", "1e17" · "Machines raise the children." · the "★ 7.5 K"
lamp goes dark when you spend under it, unexplained.

## F. Bugs

- Asleep, the big counter said "1 798 YEARS" while the newest stratum read "YEAR 1 103" and the wake clock 1 106.
- The YEAR labels stack down the right edge and overlap the people counter ("YEAR 10 406" under "16").
- On floor 2 the organ ring overlaps the heart's ring and "SURGE ×1.6"; one option's price was hidden.
- CULTURE VATS ("Grows people while the colony sleeps") bought early: people stayed 16 through four sleeps.
- After a buy the drawer list shifts; a second click at the same spot lands on another row.
- The lamp game can start while the drawer covers the panel that explains it.
- Console: no script errors.
