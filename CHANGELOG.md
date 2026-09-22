# Changelog

## v1.41.0 - 2026-09-22

### Chapter IV · THE DEEP, slice 2: cryo, the wake-up replay, probes and the crust, the ascent

- **The snowflake is real, and a press feels like time.** The first press digs a cryo hall (a room type of its own, snowflake on the plate) and buys cryo I; every press after it sleeps that tier's length, with the badge on the button saying how long: 1 m, 1 y, 10 y, 100 y, 1 000 y, 10 000 y, 100 000 y. The next tier is not on screen at all until the colony could pay for it, and then it appears under the snowflake as a teased purchase. Thousands are grouped with a space, so the badge and the year counter read the same.
- **What a press looks like.** Everyone walks off the lanes, into the shaft and down to the cryo hall on the walking graph they already use, and is gone (1.5 s). The scene dims. The counter then runs up like an odometer over 2.5 s: slow off the mark, flying through the middle, a long slowing stop, which is the one thing that had to feel like H. G. Wells and not like a number being replaced. Then they pour back out. Nothing else is clickable while the years run, and **the day timer is stopped for the whole press**, so no day is ever lived twice. A wall clock sits behind the frame loop: a player who switches tabs mid-press used to freeze the colony halfway into the ice for good, and now the sequence always finishes.
- **The wake-up replay.** A strip over the scene, icons and numbers only: one glyph per room type, lit if it RAN and dimmed with an amber dot if it STALLED while nobody was awake; what was made as +ore, +food, +stars in mono; and four small bars from the sleep report's histogram showing which column was the weakest and for how much of the sleep. It stays about eight seconds or until the next click. A room that stalled keeps the amber dot on its own plate until something is bought for it. The advisor gets one sentence, and only one: "Year 6 000: the mines ran. A probe came back."
- **The crust, and fog of war.** A thin black band across the top of the screen, and for a long while there is nothing on it: no ring, no number. The radar button arrives with cryo, because a probe is away for years of colony time and its answer can only land at a wake-up. Ore and spare power launch one; the first one that comes back at all puts chapter III's ring on the crust.
- **The ring is a belief, not a fact.** It draws the colony's ESTIMATE of the surface: mean and spread, "40 ± 40 %", and the doubt IS the stroke, wide and grey at first and a hairline once the sky has been read twenty times. New pure rules in `deep.js`, all tested: `resolveProbe` (reads the design's outcome table, whose odds walk from the early row to the late one as the instruments improve), `updateEstimate` (two beliefs weighted into one), `launchProbe`, `resolveDueProbes`, `darkenChamber`. A good probe narrows the ring toward the truth; a **wrong** one is not noise but a number in the wrong place, and it narrows the ring just the same, which is why a lying probe is worse than a lost one; a **lost** one leaves the ring alone; a **monster** takes a chamber, which then stands dark and makes nothing until the player clicks it or buys something for its kind.
- **The ascent is a decision, not a countdown.** The arrow is greyed from the first second. It opens on what the colony BELIEVES: the estimate under 15 % and the climb paid for. Going up on a wrong estimate costs the ore, a quarter of the colony, and gives the doubt back, with the advisor saying so; the next attempt is a decision again and not a retry. On a true success everyone walks up the shaft, the crust lightens, and the black `V · RETURN` card plays as the wall. `ascended` is saved, so a reload lands on the wall again.
- **No balance was touched.** `node scripts/sim-phase4.mjs` gives the recorded run byte for byte: 21m44s to resurface in year 802701, 76 wake-ups with 3.8 buys each, 50,679 people, no hungry days. Dark chambers are threaded through `tickDay`, and with none taken every number is the one the simulation balanced. The simulation itself ignores probes, which is noted in the spec.
- **Testing**: checkpoints "IV · cryo I" (a colony that runs itself, day 400) and "IV · cryo V, y5000" (a millennium a press, one probe home and one still out) in the ☰ test menu, and `window.debug_deep('sleep'|'probe'|'ascend')` alongside the existing hooks.

## v1.40.0 - 2026-09-22

### Chapter IV · THE DEEP, slice 1: the descent, the model, the chrome

- **The hole is no longer a wall.** Choosing the way down at the end of III now ends in the colony instead of "to come": the black IV card plays, the deep is built during its hold, and the model is already there when the card lifts. The wall is kept for one case only, a browser that cannot load the chapter at all. The save is never touched either way.
- **What came down with us.** The colony starts from `initialDeepState()` with the war's salvage as its ore and the doomsday clock at the end of III as the state of the surface, read out of chapter II's save. Defaults when there is nothing to read.
- **The model is the board** (`src/phase4/scene.js`, built from the locked reference `docs/mockups/deep-3d-8.html`): two colours, sharp slabs, floors round a shaft, a seeded map of lanes and houses on every plate, people walking a graph and taking the stairs on foot through openings in the shaft wall, one lamp so the light falls off with depth. Left drag turns it, the wheel zooms, right drag pans, and a scan button to come back appears only once the view has been moved. The camera is never clicked: everything is bought in the chrome.
- **Ring by ring, floor by floor.** `src/phase4/layout.js` (pure, tested) says where chamber number N is dug: the four arms off the landing, then the ring outside them, then the floor below by the stairs. The save stores it, so the colony is laid out the same way it was left.
- **The chrome floats on the model.** Time top left (year large, month and day small, y m d markers), ore and stars top right with a one-line advisor, the four columns M F E H at the left with the single red dot on the weakest and stars per day under them, and the button column at the right: dig, the four rooms, level, automate, cryo. Rooms are greyed until there is both a chamber standing empty and the ore to fill it; automation is not shown at all until the first level is bought; the snowflake is there from the first second, greyed, tooltip "soon".
- **Level and automate follow the dot.** Both buy for the room type that fixes the weakest column, so the red dot is a straight instruction and the ladder is read without a word of text. Costs are the ones in `deep.js`; no balance was touched.
- **One real second is one colony day.** Away from the tab at most three days are caught up on return: no offline progress yet. Saving every day and on unload, under key `rpi-deep` with a schema version and the layout, skipped when a checkpoint is being loaded.
- **Testing**: a new checkpoint "IV · the deep" in the ☰ test menu, `window.debug_deep('minerals'|'stars'|'day100')` with the debug menu on, and `window.rpiDeep` for poking at the state and the scene.
- Still to come in this chapter: cryo and the sleep fast-forward, the wake-up replay, probes and the estimate of the surface, and the ascent.

## v1.39.2 - 2026-09-21

### Chapter IV retuned to 802,701: one constant sets the calendar, and cryo goes up to a hundred millennia

- **END_YEAR is the chapter.** `src/phase4/deep.js` derives the surface decay from `END_YEAR` (802701, the year the traveller stops at) and `DOOM_AT_BOOM`, so 15 % is reached in exactly that year. Move the one number and the whole calendar moves with it; `resurfaceDay()` says which day the ring opens. The Wells odometer, not 350 years.
- **Seven cryo tiers**: a month, a year, a decade, a century, a millennium, ten millennia, a hundred millennia. The top tier carries the last 700,000 years in seven presses, and the prices are set so each tier is bought after a real run of the one below (presses 11/19/16/5/7/11/7 in the simulated run).
- **The first nine minutes are machines, not time travel.** Cryo I is not bought until 8m45s; up to then the colony digs, builds, levels and reaches its first automations while stars per day climb from 38 to a few thousand. Bigger dormitories (16 beds) and faster growth (people fill empty beds in weeks, not years) cut the worst dead stretch where every hand is on shift and the star counter reads zero from 106 s down to 68 s.
- **A sleep no longer loops a day at a time.** When a sleeping day leaves nothing that could make the next one different, `sleep()` runs the rest in one step, exactly, not as an estimate. Without it a press of cryo VII would be 36 million iterations in the browser. A test sleeps 20,000 days both ways and compares.
- **Asleep the generators burn half the ore** (the lifts are still, nothing moves but the machines), which keeps minerals from being the only thing the wake-up summary ever complains about.
- **Simulation**: 21m44s to resurface in year 802701, 76 wake-ups with 3.8 buys each, 50,679 people and no hungry days, weakest awake M 23 % F 30 % E 29 % H 18 %. New summary field: longest stall (how long the star counter can read zero while awake).

## v1.39.1 - 2026-09-21

### Chapter IV: the four columns tuned, the sleep earned (rules and simulation, still no UI)

- **The four columns now mean the same thing.** M, F, E and H are each a SURPLUS PER DAY: ore mined minus the ore the generators burn, food grown minus food eaten, energy made minus energy drawn, and hands not on duty (counted in what a day of those hands is worth). Stars per day = 10 × the smallest of the four, so the dot on the weakest column is a straight instruction: raise that one. Before, people were a stock measured against four flows, which pinned the bottleneck on humans 1143 days out of 1158.
- **Every upgrade still pays for itself.** What a room costs to run grows with its level too (`upkeepMultiplier`), but far slower than what it makes, so the columns stay tied together without a purchase ever making the colony poorer. Hands and power are both shared out in a fixed order, a fraction at a time: the lights first, and ore before food, because a colony that stops mining never lights up again.
- **The colony cannot grow itself into a famine.** Creches only run while the farms bring in a quarter more than the colony will eat when it wakes, and only while there are beds. A dormitory does two jobs: rooms are beds, levels are better quarters, so the colony ends the chapter a few thousand strong instead of a few billion. Nobody goes hungry in the simulated run.
- **Cryo is a staircase, not a button.** The sleep tiers cost far more, a press only makes sense when the colony runs itself (mine, farm and generator automated), and the sensor on the shaft wakes everyone the day the ring opens instead of a century past it. Advanced automation is the top of its ladder (×100, once).
- **Simulation** (`node scripts/sim-phase4.mjs`, new flags `--all` and `--why`): 23m51s to resurface at year 347, 58 wake-ups with 3.2 buys each (cryo presses I-IV 8/26/23/1), 5687 people and no hungry days, weakest awake M 33 % F 25 % E 21 % H 22 %. Purchase log reads rooms, levels, automation I, cryo I, automation II, cryo II, automation III, cryo III, advanced automation, cryo IV.

## v1.39.0 - 2026-09-21

### Chapter IV · THE DEEP: design sketch, rules and simulation (no UI yet)

- `docs/superpowers/specs/2026-09-21-chapter-iv-the-deep-design.md`: Ola's direction (side view, shaft, boom, chambers, M F E H, Paperclips ladders, staggered cryo, five steps) and the proposal: **time heals and cannot be bought**; the doomsday ring runs backwards over ~350 years; cryo freezes mouths and hands, automation makes long sleeps safe; stars per day = 10 × the weakest of minerals, food, energy, people, so the bottleneck walks around four columns.
- `src/phase4/deep.js` (pure rules) + tests, `scripts/sim-phase4.mjs` (greedy player). First run: 19 min to year 347, but people are the bottleneck nearly always and the colony starves: tuning next.

## v1.38.0 - 2026-09-19

### The war ends when the earth is done, and a bombed-out enemy comes back stronger

- **No more free suppression.** Bombed out (nothing standing), the enemy no longer waits to be bombed again: they dig in, research twice as fast, and come back all at once after two minutes, rebuilt, with full defence and at least our weapon tier. War room: "their island is silent. They are digging in. Expect them back, and stronger." then "they are back. Rebuilt, dug in, and they field missiles." Razing their island buys two minutes, not the war (Ola: zero engagement, they could do nothing, no reason for worse weapons).
- **The end comes from the clock.** The enemy leaves when the doomsday ring passes 85 %, both islands' scorch counted, never because their island is empty. Only chemical, biological and nuclear scorch fast enough to get there, so the ladder matters to the end. Sim: 19–20 min, behind 27–43 % of the time, 2–4 lead changes.
- **Scorch is felt in the numbers.** Stars and food per second fall with the doomsday clock (−60 % at 100 %), and the /person line says "scorched −23 %".
- **Radar is an instrument.** After the purchase the button stays, with a badge counting down to the next landing; once a wave is spotted it pulses red and the tooltip says "34 artillery → skyscraper in 3 s". Before the purchase the tooltip says what it gives: "when and where".

## v1.37.0 - 2026-09-19

### The war room stays readable, the way down is dug, a raiding party

- **War room top right**, under people and food: the last eight lines stay until pushed out, older lines are dimmer but readable, nothing fades before it is read (Ola: the text sat loose and faded before you had read it).
- **Chapter IV is dug, not sailed.** The plate everyone walks into is a hole (dark centre, lit rim), and the button is a shovel instead of an anchor. Tooltip "IV · THE DEEP ▾".
- **Raiding party** (helper, mask button): 250 arms, ×1.5 per raid. Their defence drops to nothing for 20 s and does not regrow while the party is there; the war room says "Strike now." and, when it is over, "Their defence is regrouping." A strike during a raid goes straight to the tile.
- **Shields stand at the coast** (Ola): one guard dot per five defence units lines the south shore facing the water. They are the ones who fight a landing (tracers, clinches); the townspeople are civilians and stay out of it. Buy shields, see the line grow; lose defenders, see it thin.
- Old duplicate rocket animation rule removed.

## v1.36.0 - 2026-09-19

### Weapons are relative (the sim said the war was broken)

- **The war was not in order.** The simulation showed that from minute 8 every landing razed a plate whatever the defence (tier power grows 1 → 800, plate HP stayed at 10–90), the doomsday clock stood at 100 % by minute 15, and then 30 minutes of stalemate until a huge force ended it at 40 minutes.
- **Weapons are now relative** (`relativePower`): a unit measured against an equal enemy is 1, one tier ahead about 2, one behind about 0.5. Plate HP, fortification, defence units and enemy tiles are all counted in those units, so the ladder never outruns the plates. What decides a landing is who is ahead, and by how much. Same tier with a decent defence: a skyscraper stands. Two tiers behind: it falls.
- **Waves grow slower** (10 + 2 per wave, max 50), scorch per landing no longer scales with wave size, doomsday scale 700 → 2500, tier research 90 s × 1.35^k → 70 s × 1.3^k. Sim (perfect player, six seeds): 16–19 min, 1–4 lead changes, behind 0–27 % of the time, 7–25 plates lost, doomsday 58–86 % at the end. A human researches slower and lands further behind.
- **Bombing out their island matters**: with nothing standing there are no landings, their research clock pauses and their defence does not regrow until they rebuild. The war room says "their island is silent".
- **Bug: damage without arrivals.** Fallen wave dots counted as arrived, so a landing could resolve with nobody at the door. Now only survivors arrive, and the war room says how many landed ("12 swords landed at skyscraper. It stands, HP 28/40. Our defence lost 2.").
- **Bug: people kept walking to razed stores.** Razed work plates are no longer destinations.
- **The plate under attack is marked** (red ring) as soon as the wave sets out, radar or not; the radar still gives the four-second warning and the war-room line.
- **WAR card slow and dark**: fade to black, III, then WAR, click or five seconds, a beat, then the camera lowers. The war room opens with "We are at war. The generals are ready for your command."
- Ship tooltip reads "IV · THE DEEP ▾". Strike tooltip shows the relative strength only with intel.
- **What you see is the rule.** The share of wave dots that fall on the way is exactly what our defence absorbs (and the same for our strikes against theirs); the fights are visual only. Before this, sixty civilians with fists cut down every landing before the door, whatever the shields said.
- **Rocket sequence** (Ola): they board in silence, then ignition (the glow builds, a tremble), then a long climb; it fades only near the top. Their island dims less.

## v1.35.0 - 2026-09-19

### Understand it, or control it (Ola's third war playtest)

- **The camera lowers after the WAR card**, not behind it.
- **Intel is a purchase** (eye, 150 arms): without it the enemy's tier and defence read "?" and the Intel lines stay silent. Status and Interior are free.
- **Radar warns for real** — a wave is spotted four seconds before it departs; the target plate gets a pulsing red ring and the war room names it.
- **Buy in batches** — one click buys a tenth of your arms' worth of units (at least one); the tooltip says +N. Build a balanced defence, then send a big force.
- **Defence caps at 70 %** of a wave; the rest always reaches the plate, so fortification and repairs matter. Fortifying repairs the plate to full and raises its ceiling; the ◆ tooltip shows HP now/max → next; the war room reports "fortification at district held. HP 34/58".
- **The HUD names the weapons** ("VII chemical · I fists").
- **Nothing to strike** — when every enemy tile is razed the crosshair is disabled with "rebuilding…", and once the island is dead (all tiles down, scorch high enough) the enemy gives up and launches. No more silent clicks.
- **War room wraps** long lines. Waves are bigger (10 + 3 per wave).

## v1.34.1 - 2026-09-19

### Hotfix: dead page after deploy (again)

- The stale-cache recovery only refetched the modules on its list, and the list had not been updated with the newer modules (war.js, ants.js, islands.js, layout.js, checkpoints.js). New `src/modules.js` holds the list and a test fails if any file on disk is missing from it. A second failure now also refetches everything so the next open is clean.

## v1.34.0 - 2026-09-19

### The war becomes readable and dangerous (Ola's second war playtest)

- **War room** — an advisor's feed bottom-left, the one place in the game with words: what both sides develop ("Intel: enemy has developed gunpowder"), what lands and what holds, when the ground and the food suffer, and the end ("Our scientists have declared the surface uninhabitable… The enemy has left for space." / "There is a secret plan. Go deep.").
- **The enemy leads by default** — faster tier clock, more defence from the start, bigger waves; you fight to catch up. Every fifth wave is a push. The enemy's strength follows what still stands on its island.
- **Radar** (300 arms): the plate the next wave is heading for pulses red before it lands; pushes are announced.
- **Fighting by tier** — fists and swords clinch (bursts where they meet), gunpowder and up shoot from further away. Our fire kills wave dots for real: fewer land, the impact is weaker, and the war room says so. The enemy fights back when we land, and their tiles show damage like ours.
- **Quartermaster with a stance** — one button after purchase (400 arms, shown with the hammer, not a star): shield buys only defence, scale both, sword only force and strikes when it can win. The strike button shows ✓ when a strike would raze a tile.
- **Scorch hurts** — food production drops with the doomsday clock; chemical and heavier strikes hit our stores.
- **The launch** — the enemy withdraws every dot to the rocket, goes quiet, a glow, the rocket climbs for eight seconds, and the island is rubble. No respawns after.
- **The descent** — the anchor turns the bottom-right plate into a hatch; everyone walks in; then `IV · THE DEEP`.
- **WAR card** is black, holds four seconds, a click continues.
- **Smooth layout** — new rows and the island appearing slide into place over 700 ms; dots slide with the plates.
- Also: science never greys out; GMO and superconductor vanish when maxed; chapter II research hides during the war; you can sell buildings during the war; the swords appear only after the first raid; our coastline shows from the first land expansion; the endless "going home" loop of the raiders is fixed.

## v1.33.0 - 2026-09-19

### Test menu, and a critical review

- **☰ → Debug menu on → "Jump to"**: ten checkpoints across the chapters (I start, speed 10, factory ready, factory running; II start, mid city, complete with enemy built, raided with swords open; III war begins, late war). Each writes a prepared save and reloads.
- **Snapshots**: three slots, Save/Load, so you can leave a moment and come back to it. `src/checkpoints.js`.
- The phases' save-on-unload is skipped during a jump so the checkpoint is not overwritten.
- `docs/superpowers/specs/2026-09-19-critical-review.md`: 25 findings across the game with proposals and a suggested build order.

## v1.32.0 - 2026-09-19

### War, second pass (Ola's first war playtest)

- **No more buying the whole ladder at once** — tier cost is based on the city's research potential (population × 0.5) at war start, not the slider at that moment; 45 s of development between tiers. The enemy never falls more than one tier behind (checkpoint) and their tiles get sturdier with their tier; they leave only when their island is thoroughly burnt (2 500 scorch). Sim: ~22 min for a perfect player.
- **The enemy fights back visibly** when our dots land, and their defence shows in the HUD (red shield number).
- **Auto quartermaster** (repeat icon, 400 arms, one-time): buys units keeping defence ≥ force and strikes when it can raze a tile.
- **Clearer buttons** — strike is a crosshair, tier research a flame, and the strike tooltip reads "12 swords → 144 power".
- **Routes across the water** — raids, waves and strikes go down into the water, up the street beside the target's column and in, never through plates.
- **Play-time clocks** — the competitor's building and its first raid run on seconds played, so a reload does not deliver five buildings at once; the first raid waits 30 s after the city is complete.
- **Chapter II** — population shows its housing capacity underneath; the science block no longer greys out once the competitor exists (the war needs it); enemy tiles are light like ours; the tilt has stronger perspective so both islands read as one leaning plane.

## v1.31.0 - 2026-09-19

### Chapter III · WAR — first playable prototype

- **The war is played on the chapter II map.** Pressing the swords plays the card and the camera lowers (the ?tilt look, now a 6 s transition). The game keeps running.
- **Arms** — the factory gets a slider goods ↔ arms; arms buy defence and force at 10 each, and a better weapons tier means a better arms factory (+25 %/tier). Arms production and upkeep come off star income; troops eat.
- **The ladder** — fists, swords, gunpowder, repeaters, artillery, missiles, chemical, biological, nuclear (Roman I–IX). Research costs science scaled to what the city made when the war began; the enemy climbs on its own jittered clock so the lead changes.
- **Waves** — the enemy targets a plate weighted toward weak, valuable and coastal; melee tiers march as red dots (our dots shoot tracer lines at them), ranged tiers fly as shells in arcs through the air, area tiers as three. One rule: defence absorbs, the rest hits the plate's HP; plates grey as they lose HP; at zero they are razed.
- **Fortify** (◆ on each plate, arms) raises a plate's HP; **clear** (× on a ruin, 30 % of the building price) gives the plot back to build on.
- **Strike** — release your force at a random standing enemy tile; razed tiles dim for 90 s and drop salvage (▾ under the clock).
- **Doomsday clock** (skull, top centre) fills with total scorch: slow with small arms, fast with chemical and up. Land and water darken with it.
- **The end** — when their island's scorch passes the threshold the enemy launches a rocket and leaves; the anchor opens when salvage is enough and plays `IV · THE DEEP`. No dead ends.
- Debug: Start WAR, +1000 arms, tiers, Wave now, Enemy leaves. `scripts/sim-phase3.mjs` simulates it (greedy: ~14 min; humans longer). `src/phase3/war.js` pure rules, 121 tests.
- Islands sit further apart.

## v1.30.0 - 2026-09-19

### Islands (the bridge to chapter III)

- **Water and coastlines** — the sea is a light grey-blue tone; our island is a wobbly coast around the plates that appears when all twenty plots are used (the island is full), the enemy's island appears with the competitor. No strokes, only tones (`src/phase2/islands.js`, seeded coast, tested).
- **Shipyard** — the competitor's fifth and last building is a shipyard (was a castle): with it they can cross the water, and the raids follow.
- **2.5D experiment** — add `?tilt` to the URL to lean the whole city like a model on a table (dots and islands lean with it). An experiment for Ola's isometric/tilt-shift idea.
- Tests 110 → 113.

## v1.29.0 - 2026-09-19

### The competitor lives its own life (Ola's playtest)

- **Dots no longer vanish and respawn** when a house is bought, land is added or the island appears: every route is rebuilt between the same two buildings at the same progress, so people just keep walking on the new street.
- **The capital grows on its own clock** — one tile a minute, five in all (factory, warehouse, radar, tower, castle), regardless of our population.
- **Raids instead of one attack** — the competitor waits until our city is complete (everything bought) and its capital stands, then razes one outer house, walks home, and comes back every 90 s until you choose WAR. The swords button opens after the first razing and the game keeps running.
- **Ruins are just burnt plates** — dark grey, no red line, ring gone, icon gone; the red dots leave.

## v1.28.0 - 2026-09-19

- **People move faster when they are few** — 32 px/s with a handful of dots, easing to 18 in a full city, so an early village feels alive (Ola changed his mind on the slower pace).
- **Store research** — levelling a store to a super store needs a research too (60 000 ★ + 1 500 science, from 40 population, buyable at 50).
- **Housing research** — levelling houses (home → apartment) now needs a research first (30 000 ★ + 500 science, shown from 15 population, buyable from 30), like urbanism for skyscrapers and megastructure for districts. Ola: "roligare om man köper/utvecklar den möjligheten innan man kan levla husen".
- Chapter III design sketch: `docs/superpowers/specs/2026-09-19-chapter-iii-war-design.md`.

## v1.27.0 - 2026-09-18

### Ants, second pass (Ola's playtest)

- **Slower** — people 15 px/s, cars 42, enemies 20.
- **They go inside** — dots fade out as they enter a plate and fade in as they leave; nothing stands in the middle of a house.
- **New plots settle in** one after another (500 ms, staggered) instead of popping.
- **The enemy builds in time** — the island stands alone for 30 s before its dots come out, and its stages (warehouse, radar) can only advance after a minute. Stages are sticky: the warehouse no longer flickers away when population dips across the threshold (that was a bug).
- **The attack is visible and razes** — the red dots march over and when five have arrived the house is razed: burnt plate, red ring, icon gone, population gone. Scorched earth is now written into vision.md as the core of chapter III.
- **WAR is chosen, like the bank** — a swords button sits greyed in the build menu from the moment the competitor appears; after the razing it opens, the game keeps running with the ruin in place, and the chapter card comes when you press it. Reloading after the choice goes straight to the wall.

## v1.26.0 - 2026-09-18

### Ants (Ola's dream)

- **People as dots** — small dark-blue dots walk the streets between the plates: home → store or factory → home, on Manhattan routes through the gaps. Count grows with √population, capped at 60.
- **Cars** — once the car is researched, some dots become slightly bigger, faster rectangles.
- **The enemy** — red dots on the competitor's island from the moment it appears, more with each stage.
- **The opening of III·WAR** — at the threshold the red dots march across to our outermost house; when enough have arrived the house is captured (red ring, dimmed icon), and only then the chapter card. Saves are written before the attack starts.
- Canvas overlay, no clicks intercepted, off under prefers-reduced-motion. `src/phase2/ants.js`, pure `streetPath`/`antCount` with tests (106 → 110).
- vision.md: the one exception to "contained animations" written down.

## v1.25.1 - 2026-09-18

### Hotfix: reload loop after deploy

- **A failed chapter II init no longer deletes the save or reloads in a loop.** Cause: GitHub Pages' 10-minute cache handed the browser the new `phase2/index.js` with the old `buildings-config.js`; init threw, the old handler wiped the chapter II save and reloaded, several times per second. The handler now keeps saves and rethrows.
- **Stale-cache recovery in main.js** — if boot fails, every module is refetched with `cache: 'reload'` and the page retries once; a second failure shows a note next to the version number and leaves saves alone.

## v1.25.0 - 2026-09-18

### Chapter II cascades (Ola chose cascades over windfalls: "rimmar bäst med projektet")

- **Income is per person, not per factory** — base 2 → 10 stars per person per second; the carried-over factory gives 200/s (was 1 680) as a starter engine. Now the multipliers (tool case ×2, car ×5, computer ×11, superconductor ×2) are felt.
- **Prices set for cascades** — right after each multiplier several things become affordable at once: homes 6 000, apartments 25 000, skyscrapers 150 000, stores 20 000, super stores 120 000, districts 8M; tool case 100k, urbanism 150k, car 600k, computer 4M, megastructure 800k, land 500k / 5M, superconductor 20M ×5 per level.
- **Districts fill at 500/s** (was 2 000) so the end of the chapter is a climb of a few minutes, not a dump.
- Simulated (greedy, 60k stars from chapter I): tool case 7:40, car 13:30, computer 15:20, districts 17:35, war 18:46; eight cascade windows, longest climb 3:20. `scripts/sim-phase2.mjs` reads `buildings-config.js`, so sim and game cannot drift.

## v1.24.0 - 2026-09-18

### Small things from Ola's second playtest

- **Maxed upgrades disappear** — speed, generator and boards vanish when full (like luck), instead of sitting greyed out.
- **Roman costs above 3 999 use a vinculum** — X̄ = 10 000, so the factory reads "×X̄" instead of ten M's. Geometric costs are rounded to two significant figures (22 346 → 22 000) so the numerals stay short.
- **Bank opens after two foam collapses**, not a star count — the ring on the bank fills with the foam, so the boost is always used before chapter II.
- **Market stall icon** is wheat, not a tent.
- `scripts/sim-phase2.mjs` — first simulation of chapter II (for the cascade pass).

## v1.23.0 - 2026-09-18

### Chapter II: silo, hover minus, stop cue, something to do (Ola chose 1–4)

- **Food silo** — the "−60/s Surplus +20/s +80/s" row is gone. One vessel fills with seconds of food in stock (full = 2 min at current consumption), one net number beside it, and a hint of how long the stock lasts when draining. Hover shows production and consumption.
- **Minus only on hover** — sell buttons appear when the building is hovered (always faint on touch). Plus buttons have two clear states: solid dark when affordable, hollow dashed when not. New plus buttons settle in gently instead of a city-wide flash.
- **Move-in stop cue** — when food is out, houses that still have room get a faint rust ring and a small red dot at the top; the silo goes the same colour.
- **Hand harvest** — click the silo for two seconds' worth of food; pays less per click when hammered, recovers over ~10 s. A floating "+N" shows the gain.
- **Plus buttons now update when stars change** — affordability was only refreshed on population change, so a plus could stay hollow long after you could afford it.
- **Market stalls** — cheap repeatable buy (2 000 × 1.25ⁿ) for +5 food/s each, no land needed, badge shows the count; GMO multiplies them like stores. The helper that matters less and less until research multiplies it.
- **vision.md** — the four-chapter rule replaced: chapters are layers carried to the end, not cliffhangers.
- Tests: 101 → 105 (`phase2/economy.test.js`).

## v1.22.0 - 2026-09-18

### Chapter II: the competitor gets time to build; Reset reachable from the wall

- **III·WAR no longer fires seconds after a District** — competitor island at 40k population, adds a warehouse at 100k and a radar mast at 175k, chapter turns at 250k. District growth 10 000 → 2 000 per second so the endgame is felt. Saves stuck between 50k and 250k resume.
- **☰ menu above the chapter card** — Reset (and Debug) reachable from the WAR wall.
- **Debug menu** — `?debug` or "Debug menu" in the ☰ menu (persisted). New +100k ★ and +50k population buttons.
- **vision.md** — working notes on chapters III (slow opening, attack on an outer house), IV (THE DEEP: ocean floor, time as the resource, cryo, Year 0), V and VI.

## v1.21.0 - 2026-09-18

### Helpers, hills and teasers (Ola's playtest of v1.20.0)

- **Battery is a step again** — recharge (15★, click) → battery (40★ earned, 30★ for 500 energy) → generator (100★ earned, +10/s per level, max 50). Each energy helper is the right answer for a while, then outgrown.
- **Slower, hillier mid-game** — boards 250·1.9^L, speed 10·1.10^L, generator 25·1.07^L, factory 10 000★. Simulated factory at ~12 min instead of ~8 for a perfect player.
- **Factory needs everything** — gated on speed, boards, generator and luck all complete (as Ola expected), not just speed + boards.
- **Goal teasers** — the factory shows greyed out from 150★ with a ring that fills as upgrades complete; the bank shows greyed out from the factory purchase with a ring that fills toward 250k. The chapter never looks finished before it is.
- **vision.md** — new section "The power line and the helpers" capturing Ola's design philosophy.
- Tests: 98 → 101 (`upgrade-dashes.test.js`).

## v1.20.0 - 2026-09-18

### Phase 1 avalanche pass (Ola's playtest 2026-09-18; spec: docs/superpowers/specs/2026-09-18-phase1-avalanche.md)

- **★/s is now measured, not a formula** — exponential moving average of real stars gained per second, so energy pauses and the true round cadence show. Rates format with one decimal below 100, compact above.
- **Game loop fixed** — per-board scheduling with a fixed breathing gap; round length (`roundTiming`) is monotonic in speed. The old shared interval skipped every other round at speed 4–5, halving the rate right after a purchase.
- **Hands are free** — hand-played rounds cost no energy; only the auto-player does. Removes the 0-energy/0-stars soft-lock. Energy bars appear when auto-play is bought.
- **Result visuals** — winner's icon bold with a thin dark ring, loser recedes to 28 %, draw both at 60 %. Same rules in bulk mode, which now renders one representative round per 100 ms tick from the real outcome distribution (closes B001: you can see wins at speed ≥ 10).
- **Luck works in bulk mode** — `pickOutcome` gives a 2/3 win rate everywhere; previously bulk hard-coded 1/3.
- **Balance rework** — geometric costs (speed 10·1.08^L max 40, generator 20·1.03^L unlocking at 30★, boards 150·1.6^L unlocking at 150★), factory 5 000★ gated on speed + boards + luck (not generator) and running on its own reactor, foam 20 000 games / 30 s bonus, bank at 250k lifetime stars. Simulated: bulk ~5 min, factory ~8 min, bank ~9.5 min for a perfect player; 2 recharge clicks instead of 683.
- **Upgrade tray no longer crops the dash ring** — 12 px padding with a matching negative margin inside the scroll box.
- **Old saves** — speed levels above the new max are clamped on load.
- Tests: 84 → 98. New `scripts/sim-phase1.mjs` for balance passes (`old|new`).

## v1.19.2 - 2026-04-27

### Polish

- **Upgrade dashes now actually sit OUTSIDE the button** — v1.19.1's math was wrong: with `inset: -3px` and `r0 = 25` viewbox units, dashes were drawn 1.5 px INSIDE the button edge, not outside. SVG container expanded back to `inset: -8px` (16 px wider canvas) and dash radii adjusted to `r0 = 23, r1 = 25` viewbox units (1 px / 1.067 ratio) so dashes start 0.5 px outside the button and extend 2 px outward. The bg-ring also recentred to `r = 22` so it reads as a clean outline at the button perimeter.
- **Tooltip-to-button gap increased 8 → 14 px** — Hover lift (-2 px) + dash extent at top (~2 px outside button) was eating into the 8 px tooltip gap, causing visible cropping where the tooltip and dashes met. 14 px gives a comfortable buffer that survives both effects.

## v1.19.1 - 2026-04-27

### Polish

- **Upgrade dashes shorter and the background ring restored** — v1.19.0 dashes were too long (~4px) and visibly extended past the viewport on the right-side upgrade tray. Worse, the bg ring (the subtle slate-200 track inside the button perimeter) was removed, so the button lost its quiet edge definition. Now: each dash is ~1.6px (almost dot-sized, per the original "nästan som prickar" spec) and starts 1px outside the button edge. The bg ring is drawn back in as a faint slate-200 circle at the button's edge so the button keeps its halo even when no dashes have been spent.

## v1.19.0 - 2026-04-23

### Phase 1: three UX improvements

- **Outward dashes replace progress ring** — Speed (55 levels), EnergyGen (100 levels), AddGameBoard (8 levels) now show N small radial "sun-ray" dashes around their buttons instead of a circular fill ring. Each dash = one remaining purchase. As the player buys, dashes fade out one by one. New `src/phase1/upgrade-dashes.js` module with `setupDashes` / `updateDashes`. Per user: *"som en sol, fast korta korta — ett streck för varje köp man kan göra."*

- **Tooltip hides on upgrade button click** — The tooltip was clipping into the `.click-pulse` scale animation when an upgrade was purchased. Now the tooltip is hidden immediately at the start of `handleUpgradeClick()` and reappears on the next mouseenter.

- **Luck upgrade now actually biases RNG toward player wins** — Previously called `starMultiplier *= 1.5` — an anonymous star-payout multiplier that didn't match the clover icon or the mechanic name. Now: after Luck is purchased, each round has a 50% chance to force the computer into the move that loses to the player's choice. Win rate jumps from ~33% to ~67%. The clover icon now matches the mechanic. The `multiplyStars` callback is removed from the Luck upgrade.

## v1.18.3 - 2026-04-26

### Polish

- **Upgrade-button click pulse no longer clips into tooltip** — Speed and Battery purchases were applying `.pop-item` for click feedback. That keyframe scales `0 → 1.2 → 1`, meaning the button briefly vanished, then grew 20% larger than its boundary (clipping into the tooltip text above), then settled. Replaced with a new `.click-pulse` keyframe that stays at scale 1+ throughout (`1 → 1.06 → 1`) — subtle confirmation pulse without overlap. `.pop-item` is preserved for its other use (meta-board reveal on foam collapse, where the dramatic "appear from nothing" feel is the point).

## v1.18.2 - 2026-04-26

### Hotfix — countdown animation now visible

Two issues conspired to make the RPS round transition look like "white → result" with no animation between rounds:

- **`prefers-reduced-motion` rule was too aggressive.** The universal `*, *::before, *::after { animation-duration: 0.01ms !important }` killed countdown frames, reveal-item, and other gameplay-critical animations to invisibility. Result: countdown SVGs in the DOM but transparent. Now reduced-motion users still get a 200ms perceptible flash for countdown, reveal, celebrate, materialize, star-fly, and pop-item — only decorative loops are killed.
- **Countdown skipped entirely past `HYPER_SPEED_THRESHOLD`** (gameSpeed > 10). Plus per-frame duration scaled with speed, so even at speed 8-10 frames lasted 40ms — perceptually invisible. Fixed: per-frame duration has a 120ms floor, and at least one "I" frame always plays regardless of speed. Players always see a clear round divider.

## v1.18.1 - 2026-04-26

### Hotfix

- **Revert v1.18.0 game-logic split** — Phase 1 RPS animation/result-reveal stopped showing visible icons after v1.18.0's `game-logic.js` extraction. Symptoms: empty white card after each round, no countdown visible, no clash icons. Reverting the split restores the working flow. The split will be retried later with proper test coverage and a real browser session.

## v1.18.0 - 2026-04-23

### Phase 1: game-logic.js extracted

- **`src/phase1/game-logic.js` added** — `showResult` and `iconMap` extracted from `index.js` into a `createGameLogic({ getStarMultiplier, getTotalStarsEarned, onWin, onResultShown, getIcon, fireStarAnimation, winTracker })` factory. Win callbacks and UI scheduling stay as orchestrator-owned. `index.js`: 802 → 769 lines (−33, net after wiring).

### Phase 2: rendering.js extracted

- **`src/phase2/rendering.js` added** — `createBuildingHTML`, `renderGridSlot`, `refreshBuildingActions`, `refreshAllBuildingActions` moved out of the `init()` closure. Wrapped in a `createRenderer({ landGrid, scheduleIconRefresh, notifiedUpgrades })` factory. `scheduleIconRefresh` also moved to its natural position (before `createRenderer` wiring). `index.js`: 899 → 756 lines (−143).

### JSDoc on public APIs

- **`src/chapterCard.js`** — `playChapterCard` and `_resetForTesting` documented with `@param` / `@returns`.
- **`src/phase1/persistence.js`** — `migrate`, `serializeGameState`, `deserializeGameState`, `saveToStorage`, `loadFromStorage` all documented.
- **`src/phase2/persistence.js`** — Same set: `migrate`, `serializePhase2`, `deserializePhase2`, `saveToStorage`, `loadFromStorage`.
- **`src/phase1/rates.js`** — `getSPS`, `getEPS`, `getVisibleDots`, `formatCount` documented (previously only `fillFraction` had JSDoc).
- **`src/phase2/buildings-config.js`** — `buildingData` export expanded with `@type` and field descriptions.

### Bug hunt round 3

- **`playChapterCard` null-guard** — If `#chapter-card` is not in the DOM (called before bootstrap), the function now logs a warning and returns `Promise.resolve()` instead of throwing on `card.classList`.
- **Phase 2 `initialize()` error recovery** — Wrapped in `try/catch`; on failure, clears corrupt save keys and reloads to a clean Phase 2 state. Previously an unhandled throw would leave ticks unstarted and `beforeunload` unwired.
- **`bootstrap()` `.catch`** — `main.js` now attaches `.catch(err => console.error(...))` to the top-level bootstrap call, converting any unhandled bootstrap rejection into a logged error.

### PROJECTPLAN cleanup

- Collapsed all completed phases (14–24) into a `## Completed` section.
- Phase 25 (current) filled in with shipped items and deferred items.
- New `## Backlog` section lists design-heavy deferred items (factory animations, enemy triangle, Sims movement, Code Processor, color refinement) without phase numbers.
- Duplicate "Phase 20" sections merged.

## v1.17.0 - 2026-04-23

### Phase 1: rendering.js extracted

- **`src/phase1/rendering.js` added** — `renderWinTracker`, `renderRateDisplays`, `renderProgressCircles`, `renderCollapseFoam`, `renderResourceBarsVisibility`, `renderEnergyBar`, `renderReserveBar`, `renderEnergyEmpty`, `renderGameCounters`, `resetCounterIconState`, `renderUpgrades` moved from `index.js`. Each accepts data as parameters; no direct closures over orchestrator state. `index.js`: 966 → 798 lines (−168).

### Phase 2: buildings-config.js extracted

- **`src/phase2/buildings-config.js` added** — Static `buildingData` object (costs, capacities, upkeep, science costs for all buildings and upgrades) moved out of `init()` closure. Pure data module — no callbacks, no DOM. `index.js`: 892 → 876 lines.

### Phase 2: window.sellBuilding race fixed

- **Event delegation on `#land-grid`** — Inline `onclick="sellBuilding(event, id)"` and `onclick="upgradeBuilding(..."` attributes replaced with one delegated click listener using `{ signal }`. Listener is cleaned up by AbortController on `teardown()`. `window.sellBuilding` and `window.upgradeBuilding` globals removed. `data-building-id` and `data-upgrade-target` data attributes carry the parameters. Fixes the teardown race described in Phase 24 deferred items.

### Performance instrumentation

- **`src/perf.js` added** — `initPerf()`, `timed(label, fn)`, `counter(label)`. Enabled only with `?debug&perf` URL flags; all helpers are no-ops otherwise. `initPerf()` called at top of `main.js` bootstrap. `timed('p1:logicTick')` wraps Phase 1 `passiveTick` body; `timed('p1:fastUiTick')` wraps the rAF `updateUI` call. `timed('p2:logicTick')` and `timed('p2:fastUiTick')` wrap Phase 2 tick bodies; `counter('p2:fastUiTick')` tracks call frequency.

### Docs

- CLAUDE.md, README.md file structures updated with all new modules.
- Stale `src/phase1/index.js` line count and known-issue entries corrected.
- PROJECTPLAN.md Phase 24 filled in; Phase 25 deferred items seeded.

## v1.16.0 - 2026-04-23

### Bug hunt round 2 (Phase 23 fixes)

- **P1: NaN/Infinity guard in save-load** — `sanitizeNumber()` added to `src/phase1/persistence.js`. All numeric fields loaded from storage now pass through it; non-finite values (NaN, Infinity) fall back to their in-memory default instead of poisoning game state. Also guards empty-string raw input in `deserializeGameState`.
- **P1: materialize animationend listener uses AbortController signal** — The one-shot `animationend` listener added when an upgrade element first reveals was missing `{signal}`. On phase teardown it would remain attached to a hidden element. Now cleaned up with all other Phase 1 listeners.
- **P1: reset invalidates uiState cache** — After `resetGame()` the `uiState` object held stale values from the pre-reset session. Some render tasks were skipped on the first post-reset `updateUI()` because cached values still matched. `Object.assign` now resets all cached fields to sentinel values.
- **P1: star-animation fallback cleanup** — `fireStarAnimation` adds a 2s `setTimeout` fallback to remove the star SVG from `document.body` in case `animationend` never fires (tab hidden, motion-reduced, etc.). `star-animation.test.js` now uses `jest.useFakeTimers` so the fallback doesn't leak into the test runner.

### Phase 1 module split

- **`src/phase1/upgrades-config.js` extracted** — The `upgrades` object definition (cost formulas, level caps, unlock conditions, purchase functions) moved out of `index.js` and into a `createUpgrades(actions)` factory. Purchase side-effects that mutate orchestrator state are passed in via callbacks, keeping the config module free of closures over `index.js` variables. `index.js`: 1044 → 965 lines.

### Tests (84 total, was 63)

- **Chapter card: to-come followed by normal call** — New test verifies that a normal `playChapterCard` call made while a `to-come` card holds the wall is a no-op: midpoint never fires, DOM stays on WAR title.
- **Persistence: `sanitizeNumber` suite** — 4 tests covering finite pass-through and NaN/Infinity/non-number null returns.
- **Persistence: edge cases** — Empty string, whitespace, `"undefined"`, `"null"` string literals all return null. NaN/Infinity in saves (JSON serialises to null) tested against `sanitizeNumber`.
- **Save export/import: 10 new tests** — Round-trip encode/decode, error cases (null, garbage base64, future schema version), key restoration, empty-key removal.

### Save export/import

- **`src/save-export.js`** — `exportSave()` serialises all four save keys into a base64 blob. `importSave(encoded)` validates and restores. `mountSaveButtons(menuEl)` wires Export/Import buttons into a debug menu. Clipboard API with textarea fallback. Wired into both Phase 1 (`#debug-menu`) and Phase 2 (`#p2-debug-menu`) debug menus (visible only with `?debug` in URL).

### Lint

- **ESLint rules added**: `no-unused-vars` (warn), `no-console` (warn, allow warn/error), `prefer-const` (warn), `no-var` (warn), `eqeqeq` (warn, null:ignore).
- **Dead code removed**: `downgradeTray` stale DOM ref (Phase 1), `renderAllBuildings` function (Phase 2, superseded by `refreshAllBuildingActions` in v1.12.0). Unused `jest` imports in two test files.
- **Phase 2 fix**: `netScienceChange` in `logicTick` changed from `let` to `const`.

## v1.15.0 - 2026-04-23

### Phase 21 bug-hunt fixes

- **P2: setTooltip listeners now use AbortController signal** — `mouseenter`/`mouseleave` handlers inside `setTooltip()` previously bypassed the phase's AbortController. On teardown these listeners survived on hidden DOM nodes. They now receive `{ signal }` and are cleaned up with all other Phase 2 listeners.
- **P1: saveGame moved out of rAF/fastUiTick into logicTick** — `saveGame()` was called inside `updateUI()` which runs inside `requestAnimationFrame`. Per hot-path discipline: saves belong in the slow tick. Moved to `passiveTick()` (1s interval), removed from the rAF path.
- **P2: supply calculation cached in logicTick** — `fastUiTick` (50ms) duplicated the `supplyProduction/supplyConsumption/netSupplyChange` calculation already done in `logicTick`. Now `logicTick` stores the results on `gameState.cached*`, and `fastUiTick` reads from cache only.

### Phase 22 mobile follow-ups

- **P2: sell-button two-tap confirmation for touch** — Touch taps on the sell `−` button now require a second tap within 3 seconds to confirm. First tap: button highlights and shows refund amount. Second tap: sell executes. Tap elsewhere or wait 3s: cancel. Non-touch (hover-capable) devices sell immediately as before (tooltip shows refund on hover). CSS `.sell-confirm` state added.
- **P2: +/- buttons on allocation slider for mobile precision** — Two small `−`/`+` buttons flank the allocation slider, visible only at `<640px` (`sm:hidden`). Each tap adjusts allocation by 5%. Slider remains for coarse drag adjustment on all sizes.
- **P2: horizontal scroll for building grid at <400px** — At viewport widths below 400px, `#land-grid` gains `overflow-x: auto` with touch scroll and snap-to-start. Prevents slot cramping after Land Expansion 1 and 2 (15/20 slots).

### Tests (63 total, was 58)

- **Chapter card to-come regression guard** — New test asserts that in `to-come` mode the title element is not hidden and the suffix is revealed simultaneously. Guards the v1.14.1 fix.
- **Persistence migration scaffold tests** — Both Phase 1 and Phase 2 migration tests verify `migrate()` stamps `schemaVersion` correctly and handles legacy saves (no schemaVersion field).

### Code quality

- **Persistence: migration scaffold** — Both `src/phase1/persistence.js` and `src/phase2/persistence.js` now export a `migrate(parsed)` function and a `MIGRATIONS` map (empty for now). `deserializeGameState`/`deserializePhase2` run `migrate()` after the version check. Structure is ready for future v1→v2 migrations without touching calling code.

## v1.14.1 - 2026-04-26

### WAR wall fixes

- **Title stays visible on the WAR wall** — Previously the chapter card faded the title out before showing the "to come" suffix, leaving only "TO COME" on a black field with no context. Now in `to-come` mode the title (e.g. "WAR" with its Roman numeral) stays on screen and "to come" appears below it as the subtitle. Both stay together until reload.
- **Debug menus reachable from chapter card overlays** — Bumped `#debug-menu`, `#debug-trigger`, `#debug-toggle-btn`, `#p2-debug-menu`, `#p2-debug-trigger` to `z-index: 1500` (above the chapter card's 1000). Players who reach the WAR wall with `?debug` in the URL can now click Reset to wipe progress and start over without manually clearing localStorage.

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
