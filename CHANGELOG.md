# Changelog

## Unreleased (deep-dig) v1.92.0 (chapter IV, the dig, pass 3: one thing at a time, a base underground)

From Ola's notes (docs/superpowers/specs/2026-10-09-deep-dig-pass3.md). Built in three steps.

**Step 1 (A + B): the start and the base.**
- **Nothing, then one thing at a time.** The act is dark from the start. The vault's CRT fades in and types (40 ms a letter) "As the humans wait, frozen in cryogenic sleep, and the earth crumbles above, you must keep the humans alive, the generators humming, the time flowing." then "216 SLEEPERS." Only SLEEPERS is in the panel. A key finishes the typing.
- **Stops** (the vault's amber box; the game stands still): "The generators burn ore. Dig." with an amber arrow under the drone; only down goes. The first tile dug brings POWER with "Power. It takes you down and brings you home." OK, Enter, Space or a fresh press of a direction closes a stop.
- **The panel grows as things matter:** CARGO at the first ore, DEPTH at 20 m, PARTS at the first delivery, GENERATORS (the old COLONY reserve, renamed: the generators burn the ore) when it starts to fall, 60 s after the first purchase; FINDS from the third find.
- **The workshop is a place.** It opens after the first delivery ("The workshop is open.") with one row, BATTERY. Each new row comes with a need, at most one a dive and 45 s apart, the next time the drone is home ("New in the workshop: DRILL."): STEERING after the first delivery, DRILL when hard rock stops the drone, HULL when the pressure does, LAMP after a recovery, CARGO after a full cargo three times, RADAR after two dives without ore. Its card is up only while the drone stands in it, with the wallet (PARTS) on it; a new row has an amber edge and the room an amber arrow until the drone has been there.
- **Steering I is coarse:** a sideways press underground goes two steps. STEERING (15 parts): "Less twitchy. One step per press."
- **The base under the ground.** The ruined city faint in the storm on top, a shaft down through the rock, six cryo chambers (36 windows each, 216 in all), life support pipes, a generator that hums, lamps. The rooms are on the drone's own row: GENERATOR, WAREHOUSE (the cargo is unloaded here only: "Drive into the WAREHOUSE to unload." the first time, an amber arrow while carrying), WORKSHOP (dark and unnamed until it opens), LAB (dark until later). The drone goes down and comes up only through the hatch; pressing down in a room drives it to the hatch.
- **The slow machine:** the base, the city and the ground (16-row chunks) are drawn once into offscreen canvases and redrawn only when they change; the picture is drawn at 30 fps at most, 10 while a stop holds the world.

**Step 2 (C + D): gauges and tools as upgrades, a base that breaks.**
- **The depth ruler** right of the shaft once DEPTH shows: a tick every 25 m, a number every 100 m, each layer's top and name (amber) once reached, the drone (a cold arrow) and its best (a white bar).
- **GPS** (ground penetrating sonar) replaces RADAR: PING (key G, or the button in the panel, with its charge) shows the ore and the finds below in a cone for 4 s; ready again in 20 s. GPS II (the old radar folded in): a wider, longer cone, ready in 12 s. Ore that is not there never shows. Its row comes after two dives without ore, 20 tiles dug without ore, or the first "It was not there."
- **HOMING LINE** (35): the dotted way home is an upgrade now; its row comes with the first "Turn back."
- **SHORT WAVE RADIO** (45): without it the base's alarms are heard only at the base; with it the panel shows them anywhere with time left ("CHAMBER 3 · 40 s"). Its row comes with the first failure.
- **The base breaks.** About 3 min in, then every 2 to 5 min (closer together the deeper the drone has been), a chamber or (from the second failure on, now and then) the generator starts to fail: a red lamp blinks on it. Stand under it at home for 2 s to mend it (10 parts, more the deeper the record; "Repair needs 25 PARTS." when short), an amber arrow shows where and a bar how far. Missed (75 s, longer the deeper): "Chamber 3 went dark. 10 sleepers died." (ten in that chamber), or "The generator stopped. POWER does not charge." (it trickles to 15 % so the drone is never stuck). Without the radio that news waits for the drone's return. The first failure is a stop at home: "A chamber is failing. Return to base and repair it."
- **Rows that a wall asks for (DRILL, HULL) go first** in the queue of new workshop rows; LAMP also comes at 400 m (a careful player who never dies would otherwise never see it). Heat drain 0.3 a second (was 0.4), BATTERY III holds 420 (was 340).
- Checkpoint `iv-dig-alarm`: at the base, 155 m best, a chamber failing (the first failure's stop).

## v1.91.0 - 2026-10-09 (the interim counts to three, the winner chooses the path, IV · DEEP)

After Ola's first look at the interim. No rule changed (`sim-phase3.mjs 1` prints the same line).
- **The wording.** The war room's second line on the walk to the hatch: "Status: they go down to wait until the earth heals its surface and is habitable once more."
- **The match takes time.** Ola: "now you barely have time to choose before it was a win, loss or draw." After the pick nothing shows at once: "1", "2", "3" on the line under the match, 0.6 s apart, each digit pulsing once; then both hands together, the result 0.5 s later, then a rest of 2.5 s before anything else happens. A draw ("Again.") rests too, then the hands come back.
- **The winner chooses.** A win no longer turns the path by itself: "You win.", then "You have beaten Destiny and may choose your path." with the drone and the vault below it, twice their old size, both lit, a ring on the drone. Mouse, or the arrow keys and Enter. Nothing is picked for the player and nothing goes on until they pick. The backspace-retype of the pointed line (B453) is gone with it.
- **The departure line.** After the choice (a win and a pick, "Destiny holds." or Continue and "So be it."): "You go deep into the vault." or "You go deep, as the drone.", held 2 s.
- **IV · DEEP.** Instead of 1.5 s of black, the chapter card: IV over DEEP, black, slow, silent, 5 s (a click ends it). The interim screen drops under the card and fades as its veil comes in; at the card's midpoint the version is written under `rpi-deep-version`, the screen is removed and chapter IV starts underneath. The ☰, pause and version label come back when the card has lifted. A reload after the choice still goes straight to chapter IV (`interimChosen`).
- **Short windows** (B455). The screen is taller now; on a short window it scrolls with the typing instead of cutting off the top.
- **Measured headless** (1280 x 800, muted), seconds after the screen came up: hand picked 22.95, "1" 22.95, "2" 23.55, "3" 24.15, both hands 24.75, the result 25.26, the choose line typed 29.57, the vault picked with the arrows and Enter 31.20, the departure line 32.07, the IV card 34.07, chapter IV 38.47 (the vault). Also checked: a win picking the drone with the mouse (the dig), a loss (the pointed act), a draw then a win, Continue, and a reload right after Continue (straight into the vault, no screen, no card). Each time the card showed IV and DEEP and the screen was gone when the act appeared.

## v1.90.1 - 2026-10-09 (interim polish, the enemy's island is empty after they leave)

Before Ola's playtest of the interim. No rule changed (`sim-phase3.mjs 1` prints the same line).
- **The buttons step aside** (B452). While the interim's screen is up (`body.interim-up`) the ☰ button, the pause button and the version label fade out (0.4 s) and take no clicks; they come back with chapter IV. Space still pauses the typing, and while paused the cursor stops blinking. A reload during the interim keeps them hidden.
- **The pointed line tells the truth** (B453). After "You win. The path turns." the other icon lights, then the act word on "Destiny points to the drone." is backspaced (22 ms a letter) and the other typed in its place: "Destiny points to the vault." The cursor goes back to the last line.
- **Nobody on the rubble** (B219). After the enemy has left (from the launch on), a reload or the iii-end checkpoint no longer brings their red walkers and watchmen back on the island: the saved war tells the ants they are gone (`enemiesRemain()` in src/phase2/ants.js, unit-tested). A live withdraw still walks them to the rocket; our people walk as before. Measured headless from iii-end: v1.90.0 shows 4 walkers and 10 watchmen, v1.90.1 none.
- **Reduced motion.** Checked: the needle settles at once (one light, no flicker) and the cursor does not blink; the icons, the choice, the match and the buttons' fade have no transition.

## v1.90.0 - 2026-10-09 (INTERIM: one match against Destiny decides the vault or the dig)

Between the war and the deep, Ola's interim. No rule changed (`sim-phase3.mjs 1` prints the same line).
- **The card.** GO DEEP's hand-over (the chosen few down, the hatch closed, the stillness) now plays a black, slow, silent card with no numeral: INTERIM (4 s, a click ends it). The war's E♭ still falls to D under it.
- **The screen** (src/interim.js, style-interim.css): built under the card and there when it lifts. A CRT in the vault's palette: black, phosphor green with a soft glow, faint scanlines, a typewriter (28 ms a letter, 45 ms a space) with a blinking block cursor. "As the Earth fails" · "there is a divergence in the path of destiny" · "and a choice has to be made." Then "In one reality there was a drone." with the drone icon, "In the other, a vault." with the vault icon. "Destiny points to" and the two icons light in turn, back and forth, slowing for 2.4 s, until one stays lit (50/50); "the drone." or "the vault." "But you may choose to oppose." Two controls: a round button with chapter I's three glyphs (Space) and "Continue" (Enter).
- **The match.** YOU against DESTINY (dymo labels), chapter I's rock, paper and scissors; Destiny's hand shows at the same moment; the winner bold with a ring, the loser faded, a draw quiet. A draw: "Again." and the hands reset. A win: "You win. The path turns." and the other icon lights. A loss: "Destiny holds." One decisive round. Continue: "So be it." Then black (1.5 s) and chapter IV: the drone is the dig, the vault the vault, written under `rpi-deep-version`. A win plings, a loss knocks (when sound is on); the typing is silent. Pause freezes the typing; reduced motion settles the needle at once.
- **Reload.** The phase 2 save keeps `interimPending` while the screen is up (a reload comes back to the screen, no card) and `interimChosen` once the act is chosen (a reload goes straight on down).
- **Testing.** `window.debug_interim()` starts the interim from any point of the war; `window.rpiInterim` has the steps with their times and `setRng` (Destiny's needle and hand). The script, the needle, the rules and the version written are unit-tested (src/interim.test.js). Measured headless from iii-end: the card 21.3 s after the click, the screen up 11 s later, the choice 15.3 s after that.

## v1.89.1 - 2026-10-08 (chapter V · UNITY: the planet, the seeds, the mind as the red word)

After the second human test (docs/playtests/2026-10-08-unity-human-test-2.md, NÄSTAN) and a run through the whole act in the browser (docs/playtests/2026-10-08-unity-fas1.md).
- **The mind as the red word.** When the next card is more than 40 s of thought away, `Slow mind.` goes red (NERVE up, or more minds on processing); a block waiting for a far card says `Slow mind.` too. Never a silent five minutes.
- **Red words that need a slider.** The guides name the slider ("The ground is poison. LUNGS up.", "SKIN up.", "INTESTINES up."); a red word an experiment ends names the card ("We cannot get past this yet. FILTER LUNGS."). After FILTER LUNGS the poison is food only as fast as the LUNGS share allows.
- **The planet is no dead end.** "MISSION: SEND SEEDS." until the first seed; buying SEEDS stops the game once: "The sea is too wide to grow across. A seed can cross it."; the shore creeps into the ocean (never +0 a day); insight buys more points for the seeds (+1 POINT · 5, 10 ... insight, up to five); the brain's part of the thought cap never falls, and the minds a seed carries come from processing.
- **The hand:** SKIN + · more room to eat, STOMACH + · digest faster, HEART + · power. AUTONOMIC EDGE keeps what was saved ("What is saved becomes body.", Dr Okafor: "The gut empties into the body.").
- **The panel:** a GROW AS row says on hover what its organ does (and that at 0 it gets nothing new); three columns when there are more than eight organs, so the log does not clip on the continent.
- **Looks:** the city as blocks seen from above with roofs, a south face with lit and dark windows, shadows, parks with crowns and avenues; the land with ridged mountains and snow, a sick yellow-green haze over the poison, forest crowns, ruins with a lamp here and there; the globe samples a softened texture (no blocks), the body on it as fibre and vessels.
- **Seeds cost** 4 % of the body and the minds they carry ("4 % of the body · 30 minds").

- **The globe** (src/phase5/globe.js): a 2D orthographic globe, no 3D library (the owner's machine is slow). A 190-pixel buffer knows once per pixel which latitude it shows and how much light it gets; each frame only adds the turn and looks up the colour, scaled up smooth. Continents in the house palette, the sea dark with a shimmer, ice at the poles, storms as dark drifting bands, the body as red flesh with fine vessels and the heartbeat, a thin atmosphere, the night side, stars behind. It turns slowly and settles on our continent; a seed in flight turns it to the sea it crosses.
- **The zoom from the continent:** the map pulls back and the globe fades in as its face; "The continent is ours." stands over it.
- **SEEDS on screen:** the SEED panel (DRIFT, ACID, SKIN, ROOTS, MIND with - and +, "N points left", "To THE WEST · 2 100 km of sea", LAUNCH with its cost "N t · 30 minds"); a click on the globe picks the land (an amber ring with its name). A seed flies 10 s as a red mote on an arc over the sea, then lands: a red ring where it grows, a grey one where it died; Mr Lund says its fate (the five lines of the rules). Minds go with a seed (15 a MIND point): back when it grows into us, lost when it does not. "THE SEED GROWS INTO US." on the CRT; all lands joined: "We are one.".
- **WE LOOK UP** lights when we are one, WARM ALL THE WAY THROUGH is done and the body covers 41 % of the surface; then the globe turns red and pulses, the camera leaves it for the stars (3.6 s) and the card VI comes, no title yet.
- **Rules:** seeds fly before they land (a person reads the fate and changes one thing; the sim does too), cost a 25th of the body; a landing seed brings flesh for the ground it takes; the ice is eaten at half speed after WARM; the planet is eaten more slowly; "Nowhere to grow." names the experiment for what walls the body in (the cold of the poles last); checkpoint v-planet starts with SEEDS done and the home continent half eaten.
- **Sim:** 35:33 to 37:55 for the four styles (heart now over 35 min).

## v1.89.0 - 2026-10-08 (chapter V · UNITY, first build: the city and the county)

Chapter V · UNITY begins (docs/superpowers/specs/2026-10-06-chapter-v-unity.md), v1.89.0 on the unity branch.
- **The rules** (src/phase5/unity.js, terrain.js): the body eats the earth. Four flows (NUTRIENT, MASS, POWER, THOUGHT), GROW AS, the edge (perimeter against area, skin thickness, storms that tear), rock paper scissors at the edge (WRAP, CUT, CRUSH), MINDS (memory and processing), THOUGHT and INSIGHT, the experiments and the small I–V ones, thirteen organs, three vaults, five scales with their units, SEEDS. One red word: the single thing that slows the body most.
- **The sim** (scripts/sim-unity.mjs): four styles end in 38 to 43 minutes, the city in 8 to 9; the table is in the spec under "Built (unity), fas A".
- **Fas 1 · THE CITY on the screen** (src/phase5/index.js, view.js, style.js, sound.js): a top-down map in the vault's palette, the ruined city as blocks, streets and the river, the storm as dark bands with rain and a standing wall at the city's edge; the body as the vault's flesh with vessels and the pulse running out to the edge, the edge glowing where it eats; the organs drawn on it (eyes that open and turn, brain folds with light, winding intestines, nails as plates at the edge). Click the edge to bite a block (pulse and a wet bite); after AUTONOMIC EDGE a click on the map is a direction (a faint arrow). The panel in the vault's style: CRT, MISSION, BODY with its unit, the four flows with the one red word (and a yellow one, what breaks next), SKIN + / STOMACH + / HEART + before the first experiment, then GROW AS (sliders that sum to 100, the next organs dimmed), EDGE (WRAP / CUT / CRUSH, what each beats, "Eating at a third."), MINDS from the county, the EXPERIMENTS bar with the wallet, the guide box (name and line, 8 s), three grey log lines. Stops as the vault's (typed, OK): the start, the first storm, and the zoom at the end of the city (the camera pulls out 3.6 s, the body becomes a dot, "The city is ours.", the county loads). The county and further maps play with the same rules.
- **Pacing (fas C).** An I–V experiment for every grown organ; prices set by the thought rate when an experiment lights (a big one about 80 s of thought away, never above the spec's price); storm waves every 60 s for 15 s, the first over the city at 3:20; poison close to the county's start and a deep river halfway out (WE CAN PULL); a mountain chain across the country; insight trickles from the people below the cap too. Sim: 34:45 to 37:05, bottleneck at most 92 to 113 s, gaps at most 24 to 36 s.
- **The body's look (fas C).** A soft outline (marching squares over a smoothed field), the flesh clipped to it, a glowing edge that bulges and nibbles where it eats, vessels that branch and curve, eyes in the rim that turn, organs deep inside, nails and ear funnels at the edge. The land as soft fields with rivers, roads and ruins; the sea with a shimmer; the unseen as soft darkness past the eyes' reach. The zoom fades the next map in around the shrinking body.
- **After the human test (fas D).** A refused bite says why ("Full. Grow first.", "Still digesting. A moment.", "We cannot eat that yet."), the hint follows it and the organ buttons that would help light; the stomach digests three times faster by hand, so the hand phase is about 85 s. The wallet stays: by hand the nutrient to spend, after AUTONOMIC EDGE what waits in the gut. MASS a day in m² while it is small, never "+0.00 km²"; the body in hundredths of a km² below 1. "Starving." only when nothing comes in: a gut full of what the stomach cannot take is "Full.", an edge that can eat nothing is "Nowhere to grow.". The ground comes in districts (one kind over a patch) and EDGE says the next one ("At the edge: PAPER. Next: ROCK."); THE EDGE KNOWS lights in the city after GRAVEL. A price is set the moment its row lights and never moves. The zoom: the next map is there under "The city is ours." (the map changes before the box). The panel: GROW AS in two columns with only the organs grown, a four-line CRT, MINDS and the log fit at 900 px; the bar greys while a stop holds the game; JOIN is amber (a reward); the card that answers the red word wears the amber mark and stands first. Storm waves grow a little each time on a map, so the skin is asked again. Fog lighter. A body redraw is throttled to eight times what it costs (60 fps in the headless run, 5 to 14 ms a redraw).
- **The vault's lever** names what is missing before it counts rooms: "NO SKIN YET · grow skin on the top level".
- **Hand-off.** A fresh rise always starts chapter V with the people in the body as its minds; a reload after the rise keeps the chapter V already there; v-start is 197.
- **Wiring.** The vault's V · UNITY card now leads into chapter V with the people in the body as its minds (gamePhase UNITY, save key rpi-unity). Test menu: V · unity: the city / the city almost eaten / the county / the continent / the planet. Playtest driver scripts/play-unity.mjs; shots in docs/playtests/unity-shots/.

## v1.88.1 - 2026-10-06 (the deep gate removed)

- The gate before IV ("Unfinished. Continue at your own peril.") is gone: the war's GO DEEP (v1.88.0) leads straight down. #deep-gate in index.html, its CSS and src/deepGate.js (+ test) removed (B217).

## v1.88.0 - 2026-10-06 (chapter III, WAR: GO DEEP, the chosen few go down)

After Ola played the whole war ("everyone walks down into the deep, but only 216 arrive"), the ending says why: only a chosen few go down. No rule changed (`sim-phase3.mjs 1` prints the same line).
- **GO DEEP.** The shovel's tooltip is "GO DEEP", like the buttons before it: no act numeral, nothing that says the chapter changes. The "Unfinished. Continue at your own peril." gate is gone; the click is the choice.
- **The controls leave.** Every button, the plates' buttons and the war counters fade and slide away one after another (0.8 s, 60 ms apart), the shovel last. The war room stays. Nothing answers a click while it plays.
- **The hatch opens.** The bar slides off the facility's round hatch and the hole widens a little (1.2 s).
- **The chosen few.** Twelve of the people walk to it (about one in five, never more than fifteen): the ones who live highest, districts and skyscrapers first, from their homes along the streets, the nearest first, and go down one by one, each fading into the hole. Everyone else stops where they stand and stays behind.
- **The war room says it**, with a beat between: "Status: the shelter takes only a few. The richest. The most successful." / "Status: they go down to wait until the earth can be lived on again." The line before the shovel is now "But a few have a secret plan."
- **The hatch closes** when the last one is down, 1.5 s of stillness, and the IV card comes as before; the people left behind dim as it fades in. About 14 s from the click to the card; it always comes by 25 s.

## v1.87.3 - 2026-10-06 (chapter IV, the vault: the burst)

- **The burst is a mass.** A dome of the rooms' own muscle fibre and vessels (tiled at their scale, not stretched) pushes out of the crust and swells until it fills the top of the screen, with folds where one sheet of muscle lies over the next, wet highlights, thick branching vessels that whip with red light running along them, a ring of the heartbeat moving out through the whole of it, torn crust and tower pieces riding on its back and sliding off, and dust. The kit (tissue, vessel trees, riders) is made once when the rise starts; per frame only transforms and the pulse.
- **Checkpoints with a meat lab.** iv-vault-night has a Meat Lab (level 1) on level 3, so "The meat lab cannot feed them all." never shows with no lab on the map; iv-vault-flesh keeps it.

## v1.87.2 - 2026-10-06 (chapter IV, the vault: tending the cold, the mission, a whole body)

After Ola played v1.87.1 ("KUL! SNYGGT! Love it!"), section H of docs/superpowers/specs/2026-10-05-deep-vault-pass3.md:
- **The cold is tended.** After the calm 45 s, failing pods come as ice-crystal bubbles over the Cryo Bays ("Failing pod" on hover), their ring the time left in real seconds; a click saves the pod for 2 ore of engine work, a missed one dies ("Pod N failed." in the log, PODS FAILED on the SYSTEM box). The meat lab feeds 100 pods a level (a vat of the body as much); more sleepers than that and they fail twice as often, the lab is marked and can be upgraded in the night; red POWER faster still. The first is a stop, "POD 41 IS FAILING. Click it to save him.", saved: "Mr Hale sleeps on."; about 50 s later three fail at once and one is beyond reach: the first dead, "The meat lab cannot feed them all." and RECLAIM. The engine burns 1 ore a year, the mines give 1.5 a year a level. Sim: a tending player keeps about 100 %, one who ignores the pods loses about 50 %.
- **The mission** is typed in the box line by line (40 ms a letter), OK at the end; the panel says "MISSION: GET THEM TO THE SURFACE. ALIVE."; the checklist: HEART · power, LUNGS · area, SKIN · silica, STOMACH · acid.
- **The stomach** is acid: +3 biomass a year each (no more sharing), its words as Ola wrote them.
- **Unity.** GROW INTO a Cryo Bay: "GROW INTO · 50 sleepers join the body" / "As one body they survive what 50 cannot."; the first time is a stop, "They cannot live up there as 50 small bodies. As one, they can."; the panel row is UNITY n / m and the SYSTEM box says "Unity: N of M.".
- **A whole body.** RISE needs every room to be body as well as a heart, lungs and skin (skin on any top-level room, several allowed); until then the lever reads "THE BODY IS NOT WHOLE · N rooms left", dim. The last room says "We are whole.". Sim night: 8:48 heart first, 6:44 lungs first, 5:41 stomach first.
- **The rise** takes 7 s: fibre and vessels up the shaft, the crust bulging and cracking with light between, rock and towers tumbling, a wet red surge with whipping vessels and the heartbeat, the city's remains riding on its back, the sky filled; it holds, then V · UNITY. Sound: the boom plus a wet rising swell on the sound bus.

## v1.87.1 - 2026-10-06 (chapter IV, the vault after the fourth test)

After the fourth independent test (docs/playtests/2026-10-06-vault-human-test-4.md, almost):
- **No dead end in the night.** A Cryo Bay shows GROW INTO beside RECLAIM (RECLAIM becomes the small third button), never one hiding the other. Rock the body cannot reach yet says what is missing: "Fill the floor below first. 2 rooms left." or "The body has to reach it first.".
- **The turn is a stop**: "SURFACE REPORT: NOT RECOVERING. ESTIMATE: 3 000 YEARS." / "They will get angry. The Cryo Bay can keep them quiet.", and the Cryo Bay card slides in with it. Mood falls over about three minutes (despair 0.6 a day, was 1.8). The ORE stop comes the first time a card in the hand cannot be paid, by day 20 at the latest.
- **The SYSTEM box is for the system.** "X is boring now", the weighing, the waves and "Someone tried the shaft" (once in 30 s at most, the first still a moment) go to the grey log, now 12 px and three lines.
- **The night is short of biomass and the first organ matters.** RECLAIM gives 5 a dead, TAKE 30; a stomach gives +3 a year (the biggest source; they share the rock); LUNGS make the years left tick twice as fast and the box says "The lungs make it twice as fast."; the panel says "The engine burns 2 ore a year." and at 0: "No ore. The engine stopped." (marked). Sim: heart first a safe slow night (7:42, 9 pods failed), stomach first rich and fast with deaths (5:12, 20 failed, the most biomass), lungs first quick (5:34, 16 failed).
- **Stops lock the same way.** Only what a stop points at answers (its room; for a card the card, its places and rock to dig them); anything else shakes the box. "Build Mrs Vance a cinema." Requests that need an upgrade say so in their bubble ("Upgrade the gym."); the wants nobody can answer are gone. Wishes come at most one in 8 s in act I.
- **Small.** The Mine has its rock face, ore, rails and a loaded cart; the Engine Room its big machine in a cold glow. Room names are drawn over the flesh and the organs and shrink to fit. The info box opens outward, on the free side, below the room. The panel fits 900 px high at night.

## v1.87.0 - 2026-10-05 (chapter IV, the vault: soft start, two voices, flesh with a reason)

Pass 3 after Ola played v1.86.6 himself (docs/superpowers/specs/2026-10-05-deep-vault-pass3.md, sections A to G).

- **A. A soft start, one thing at a time.** STOPS pause the game: a box says one or two sentences, what it is about lights, OK (or doing the thing) goes on. Welcome, dig a place, build suites, answer a bubble, Mrs Vance's cinema, ORE (the Mine card), POWER. Cards are handed out one at a time and slide in; no BUILD bar before the first. The goal is always on top of the panel (KEEP THEM HAPPY, KEEP THEM QUIET, GET THEM TO THE SURFACE). ORE and POWER appear when they matter. Bubbles start when taught, one every 12 s the first minute. Stops are in the save; old saves and every iv-vault-* checkpoint skip the stops behind them.
- **B. Two voices.** The SYSTEM box is for the system only. Residents speak in bubbles over the room they are in: a named request stays with its ring as the countdown, thanks and sour words pass, "Computer!" lines are shouted from where they are, a broken room says "Good.". A small grey log of the last three lines sits under the SYSTEM box. The yellow line is gone.
- **C. Click where the thing is.** The info box sits by the room clicked; bare rock shows DIG on the tile, a double click digs. Every level shows its eight places. The night's Cryo Bay is simple: GROW INTO takes the sleepers inside in one click; TAKE TEN; the "last sleepers" rule is gone; the dark choice is at RISE: who is still awake stays ("RISE · 3 are still awake", "They can stay.").
- **D. The city** is a real skyline in three depths with towers, a crane, a bridge and antennas. It goes dark window by window over the first hundred days, an antenna snaps, and in the night a building leans and falls in its dust every 20 to 30 seconds until stumps are left.
- **E. The flesh has a reason**, in paused steps: the pods are fed by the meat lab (a hose runs to the Cryo Bays; no lab, its card now); night one is calm until Mr Hale dies ("The meat lab is empty. The pods are starving."), RECLAIM MR HALE feeds the others and the pods stop failing a while; the lab grows into the next room by itself, slowly ("The meat lab grew. I did not ask it to." / "It is warm. Warm is power. The engine is dying.") and POWER goes blue; then the goal (THIS COULD.) and the checklist; then "Start with a heart.".
- **G. From Ola's play.** G1: the night Cryo Bay has two buttons at most, the one that makes sense (RECLAIM "They feed the others.", SLEEP ALL, GROW INTO) and the dark one small below (TAKE TEN / TAKE ONE); BURY and CUT POWER are gone. G2: every room is drawn in the people's scale with small figures sitting, walking, digging, lifting, and its name on the frame. G3: the first 45 s of the night nobody dies; Mr Hale is the first; after that pods fail only while POWER is red, and the Cryo Bay says why. G4: every organ does what its button says, before and after: HEART "Power 20 → 60. The pods stop failing.", STOMACH "Biomass +0.5 → +1.5 a year.", LUNGS "The body grows twice as fast.", SKIN "Rooms cost half. Needed to rise."; the checklist says each one's effect. A stomach draws power, tissue makes none.
- **Balance.** Days a little longer (6 s at ▶), the night's years ramp slower, TAKE gives 30 a sleeper. Sim (heart first / stomach first / lungs first): RISE at 18:14 / 18:02 / 17:58, the night about 6 min, pods failed 5 / 11 / 5.

## v1.86.6 - 2026-10-05 (chapter IV, the vault after the third test)

After the third independent test (docs/playtests/2026-10-05-vault-human-test-3.md, worth playing):
- **The night stays short of biomass to RISE.** Stomachs share the rock (n stomachs give 1 x sqrt(n) a year) and each one more costs 120 more; organs grow dearer with the body (half of what tissue has gone up). The last Cryo Bay: "The body will not take the last sleepers. You must." Before RISE the system has to empty it (CUT POWER, TAKE ONE). The cold dead of CUT POWER give 5 each when reclaimed. Sim: the most biomass after the heart is about 550 to 630 (the test saw 8 400); a stomach-everywhere player is no faster.
- **Night 1 points the way.** At the first dead pod, once and marked: "The dead can feed the meat lab. Open the Cryo Bay." (the bay pulses red). The pods after Mr Hale are one counting line, "PODS FAILED: 5.", updated in place on the CRT; no pod numbers, so no pod reported twice.
- **The Cryo Bay opens with the turn**: when mood first falls under 60 after the report (at most four days on), so the riots push toward it instead of being a wait.
- **Small.** A Cryo Bay in the night shows four buttons at most, the likeliest first (RECLAIM, SLEEP ALL, TISSUE, the organ still missing, TAKE ONE, CUT POWER, BURY; WAKE only when nothing else). In the night the panel says AWAKE n, not RESIDENTS 0. Build card lines wrap to two lines, and the Meat Lab card says "Real steak. Mood +6." (the spec's longer line did not fit). RISE holds the risen body 1.8 s with no cut to black, then V · UNITY.

## v1.86.5 - 2026-10-05 (chapter IV, the vault: the steak, the goal, the organs)

The vault's story pass (docs/superpowers/specs/2026-10-05-deep-vault-story.md): rules, words and balance (phase A), then the screen (phase B).

### The screen
- **Meat Lab art.** In the palace a clean lab: steel vats with a red slab in each, a steak on a steel table under a lamp, a cut on a hook. In the night the same lab grown: two of the body's tanks under the lamp. A T-bone bubble.
- **The organs, in the flesh.** HEART beats (spiralled muscle, an arch of great vessels, coronaries with the pulse, light on the beat), LUNGS breathe (two spongy lobes swelling, a bone-pale windpipe and bronchi), SKIN is stretched taut across the room (creases, pores, a strained sheen, tendons at the corners), STOMACH churns (a J of muscle twisting, folds, a squeeze running along it). A growing or changing room shows its organ forming.
- **GROW INTO in the info box** as one choice: a heading, five organ buttons with their lines; the ones that cannot be had are dim with "Need N more biomass." or "Needs a heart first.".
- **The checklist** in the panel (HEART, LUNGS, SKIN, STOMACH with tick boxes, INSIDE n / m) from the goal moment.
- **Moments that matter**: the CRT line in amber with a thin underline that blinks twice, held a little longer; the picture dims while time runs at a quarter; a soft bell (Sound on/off respected).
- **Computer lines** are shouted: bold, a red ">>" in front, a small shake.
- **Fixes.** The CRT grows to keep the newest six lines whole; the ruined city stands on rubble and dark building cores (no floating tiles); tendons curve and are bone-pale; neighbouring body rooms share one tissue (no dark seams) and vessels run from one into the other.

### The rules (phase A)

- **The steak.** After the first five requests: "Mr Hale: I want real steak." opens the MEAT LAB card (160 ore, level 2 or 3, "Grows real meat in vats. Mood +6."). It feeds (120 / 200 / 300, with the hydroponics) and gives mood like a room of fun. "More steak. Everyone wants steak." asks for level 2. A steak bubble and a steak wave once the lab stands.
- **The turn bites.** Three days after the report "The hydroponics are failing. The lamps are old.": they feed half, the meat lab the rest. The first to die in the palace, with a lab: the next day "The steak tastes different tonight." In the cold the system weighs a sleeper every 20 s ("Sleeper 41. 72 kg.").
- **The night has a goal.** When all sleep: "THE SURFACE WILL NOT RECOVER. ... GOAL: GET THEM TO THE SURFACE." A checklist (HEART, LUNGS, SKIN, STOMACH, INSIDE n / total) in the rules for the panel. RISE when the body has a heart, lungs and skin and everyone who lives is inside.
- **The organs.** GROW INTO is a choice: TISSUE (as before), STOMACH 150 (+1 biomass a year), HEART 250 (+40 power, the engine rests and burns no ore), LUNGS 350 and SKIN 350 (both need a heart; skin only on level 1). Plain tissue can still be made an organ. RECLAIM and TAKE ONE go to the meat lab: the first wakes it as the body's first vat, or builds one for nothing. The Vat card: "The meat lab, grown up."
- **Moments that matter** (the first request, the steak, the turn, the Cryo Bay, the first dead, the goal, the first organ of each kind, the first full floor, RISE ready): the CRT lines carry `mark`, time runs at a quarter for 3 s (even from ▶▶), and a `moment` sound event.
- **"Computer".** Missed bubbles now and then get "Computer! My drink!" and the like, a slow build "Computer, how long does a cinema take?" (once a kind), ruder lines after the turn, and in the night "Computer? Computer, what is that?" when TAKE ONE wakes three.
- **Balance.** Sleepers taken with a Cryo Bay give 1 biomass each (was 10: it flooded the organs). Sim: the steak at 3:30, the night from the first vat to RISE 5:28 (two stomachs) to 6:05 (one), at most 31 to 32 s between night decisions.
## v1.86.4 - 2026-10-05 (chapter IV, the vault: graphics pass)
- **One palette** for the vault (`VT` in src/phase4v/style.js, also as CSS variables): cutaway, panel, CRT, cards and info box share it; each accent has one meaning.
- **The cutaway as a sibling of the strata view**: veined stone, speckled sediment, every room the same frame with a lamp and a cone of light and one pale motif; the surface city is act II's tiles gone to ruin; the Engine Room is the locked RPS machine (caged tube, cog, smoke, cables with a pulse).
- **The shaft in the middle**, four rooms on each side; the body climbs it as it takes the vault.
- **Meatier meat**: layered fibre with direction, wet sheen and glints, tendons, mycelium, branching vessels with the pulse running through them on the heartbeat, slow breathing, the creep running ahead over a room before the tissue fills it, sinews between body rooms, vats with a turning red knot and tubes into the rock, taken rooms sunk under the tissue.
- **Bigger CRT** (six lines, 14 px), wider panel, a hidden checklist slot (Heart / Lungs / Skin / Stomach) for the story pass.
- **Lighter on slow machines**: static layers cached in offscreen canvases, the picture at 30 fps (10 when paused).
- Before/after shots: docs/playtests/vault-gfx/.

## v1.86.3 - 2026-10-05 (chapter IV, the dig after its second independent test)

### The dig after its second independent test (docs/playtests/2026-10-05-dig-human-test-2.md)
- **No pendulum in corners.** Up with a side climbs while the way up is open and turns only at a ceiling; a buffered side press turns once. Hanging under a ledge costs almost nothing (0.03 a second). The POWER bar blinks when it drains fast.
- **Ore right above can be dug from below** (slower, costlier); other rock still only from below, and the hint names the way up and goes when the drone moves.
- **A gentler start.** The first three recoveries cost only the cargo; the colony starts drinking at the first purchase and its drain grows slowly.
- **A true status line.** Hints go when you move, "It was not there." after 3 s, the death line on the next dive.
- **Workshop says what you have and what is next** ("Carries 14. Next: 22."); prices differ per row (20 to 40 at first, 50 to 90 next) so the second buy is two dives away.
- **Turn back on the real cost home** (the climb is cheaper, 0.4 a row, plus the drain on the way and a small margin).
- **The heart in the middle** of the screen, and RISE centred on the world.

## v1.86.2 - 2026-10-05 (chapter IV, the vault after its second independent test)

### The vault after its second independent test (docs/playtests/2026-10-05-vault-human-test-2.md)

- **The night shows where to act.** Rock that can take a Vat or a Cryo Bay is framed, rock the body can grow into has the gold dashed frame (rock had none); the Vat card lights its places; a card with no place is not shown in the night.
- **The night is short of biomass and ore.** Vats grow 0.15 a year, the body 0.05 a room; GROW INTO 120 + 15 per room; TAKE ONE +100; CUT POWER always there in the night; sleepers taken with a Cryo Bay give 10 each. The engine burns 2 ore a year, the mines give 0.6 a year a level.
- **Shorter growing.** 10 + 12 years per room (at most 150); a room at once per vat and one per full floor; a full floor pushes into the floor above by itself. Sim: first vat to RISE about 8 min, never more than about 30 s without a possible decision.
- **Small.** The sofas wait 25 days and every request has a bar that runs down under the CRT; the spa wave says a gym at level 3 has one; a popped bubble floats a larger "+2 %" and the MOOD number flashes; one truth for power (Engine Room, Vat card); GROW INTO first in every info box; "What is that under the floor?" once.

## v1.86.1 - 2026-10-05 (chapter IV, the dig after its independent test)

- After the independent test: the drone hovers under a ledge instead of bouncing, up + side turns into the first opening (250 ms buffer); dug tunnels stay faintly visible and a dotted way home shows when power is short; POWER reads as capacity ("62 / 90") and the bar grows with upgrades; the status line is only shown while true; ore glints, rubble looks like rock; surface ore worth more (300 m in about 2.5 min); a find pops its value; the heart takes four beats, is centred, the panel fades, RISE shows the red mass climbing through the city; bigger drone, larger workshop text, a pod strip in the panel.

## v1.86.0 - 2026-10-05 (chapter IV: two new versions beside the old one, the vault and the dig)

Both are chosen with `?deep=vault` / `?deep=dig` or ☰ → Debug → "Deep: colony / vault / dig". The old act stays the default.

### The vault (docs/superpowers/specs/2026-10-05-deep-vault.md)

A new chapter IV beside the old one, chosen with `?deep=vault` or ☰ → Debug → "Deep · vault / colony" (kept under `rpi-deep-version`; the old act stays the default and is untouched). Fallout Shelter for billionaires that slides into the body.

- **The palace** (src/phase4v/vault.js). A cutaway on a 2D canvas: the surface city in the storm, the shaft, the palace's eight places on level 1, levels 2 and 3 of rock to dig. 216 residents, 300 ore. BUILD cards (grey with "Need N more ore." when out of reach), a fixed info box on a room (UPGRADE, DIG, REPAIR and the Cryo Bay's buttons), II ▶ ▶▶. Requests by name on the CRT with a mark on the card or room; answered: a thank you and mood; ignored: a sour line. Mood with novelty that fades to 40 % in 40 days, cabin fever that grows faster and faster, homeless, hunger, dark. Births. Riots under 25 % break a room (REPAIR · 80 ore).
- **The turn and the cold.** Day 100: SURFACE REPORT: NOT RECOVERING. Complaints come faster; mood falls faster than it can be built. The Cryo Bay opens (mood under 45 % or day 110): SLEEP 10, WAKE 10, SLEEP ALL; the windows of the suites turn blue.
- **The night.** Years instead of days, 1 a second and slowly faster (never over 20). The engine wears, the power goes red, a pod fails: POD 41 FAILED. MR HALE IS DEAD. BURY or RECLAIM; then TAKE ONE and CUT POWER, the Vat, GROW INTO from the bottom up (one room at a time per vat, each taking longer than the last). BIOMASS in the panel; MOOD becomes BODY. Sediment over the city every thousand years, the city erodes by the year. The Watcher's lines on the CRT. When every room is body: "Woke: everyone is here." and RISE, into the same V · UNITY card as the old act.
- **The small wishes** (src/phase4v/wishes.js, Ola's addition). Speech bubbles with an icon over the rooms (a drink, a hand, a plate, a note, a towel, a pool ball; after the turn a bell and a pointing finger, two or three at once). A click pops one: +1 mood, a soft pling, a drink costs an ore. Missed after 10 s: a grey burst, a scowl, mood -1. Four of one icon is a wave: the CRT says it once ("Overwhelming wishes for a pool table."), the card is marked, building it is +10. The asleep make none; in the night they come faint over the pods and cannot be clicked. The text shows on hover only.
- **Wiring.** src/deepVersion.js (colony / vault / dig, tested; the ☰ → Debug item cycles "Deep: colony / vault / dig", a version not in the build falls back to the colony), src/gamePhase.js loads src/phase4/ or src/phase4v/, the descent from III lands in the chosen one. Checkpoints iv-vault-start, -turn, -cold, -night, -flesh (a jump sets the version; the old iv-* set colony). `rpi-deep-version` kept across jumps. Own save `rpi-deep-vault`. Sound through src/audio.js only: the shared words, a quiet CRT tick, a low drone in the night and a slow pulse once the body grows; silent when paused or hidden; teardown stops everything.
- **After the independent human test** (docs/playtests/2026-10-05-vault-human-test.md, ALMOST): TAKE ONE wakes three beside it ("3 woke. They saw."), terrified; at 0 % they bang on the screen and try the shaft; RECLAIM only for the dead (quiet), TAKE ONE the dark button. SLEEP 50 and SLEEP ALL. A plain line under every night button. A Cryo Bay on bare rock in the night; "The body grows up from a full floor." Bubbles +2 % / -2 %, shown floating, free. A 5 s rise before the card. One meaning per marker (gold dashed = grow here, red pulse = pods in trouble, a yellow tab = a room complaining). RISE has the build bar's place; "In the body". src/phase4v/index.test.js checks the screen in jsdom.
- **Sim and play.** scripts/sim-vault.mjs (a plausible player, a line a minute); scripts/play-vault.mjs drives headless Chrome with real clicks for the play pass (docs/playtests/2026-10-05-vault-build.md, shots in docs/playtests/vault-shots/).

### The dig (docs/superpowers/specs/2026-10-05-deep-dig.md)
- New src/phase4d: a Motherload-style digging game. The drone digs down from the base under the ruins, mines ROCK, PAPER and SCISSORS ore, flies home through its own shaft, delivers piece by piece into PARTS and the colony's reserve; 216 pods go dark one by one when the reserve is empty.
- Workshop with six rows (DRILL, BATTERY, CARGO, LAMP, HULL, RADAR), three levels each, and GRAFT (bone drill, healing cell, skin) once biomass comes home. Gates: hard rock at 300 m (DRILL 2), basalt at 700 m (DRILL 3), pressure at 500 and 900 m (HULL 1 and 2), heat at 1 200 m (HULL 3), sinew over the heart (bone).
- Six layers that tell the game's history, twelve finds with a line each, ghost ore and a voice below 700 m, flesh that pulses, the heart at 2 000 m: "Woke: everyone is here.", the pods empty, a red band down the shaft, RISE, then V · UNITY.
- The POWER bar carries a "home" mark: the battery it takes to fly back. Keyboard (arrows, WASD) and mouse (hold beside the drone).
- src/deepVersion.js picks the version (colony, vault, dig); gamePhase.js loads it; checkpoints iv-dig-start, -war, -machine, -flesh, -heart; rpi-deep-version kept across jumps.
- scripts/sim-dig.mjs (a plausible player) and scripts/play-dig.mjs (headless Chrome, muted, screenshots).

## v1.85.0 - 2026-10-04 (chapter IV, the rise in reach)

### Chapter IV: the rise in reach, quicker dreams, fixed prices, honest pumps, a mind that matters, bugs (B410 to B419)

The third human pass of v1.84.0 (docs/playtests/2026-10-03-chapter-iv-human-pass-3.md) said yes, with a warning: the end of GROW was out of reach and mostly waiting. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "Built: pass 4 (deep-pass4)"; the play log docs/playtests/2026-10-04-pass4-play.md.

- **The rise in reach** (B410). Every full floor makes all the guts give 1.1 times the mass (momentum). The last floor is a finale: once every floor above it is full, a take there costs 0.7 of its mass and work, down to a third at the last room, fills by itself three times as fast, and asks of the hearts and nerves what the floor above does; "BREAKING THROUGH" over the heart and the strata crack from the crust, further with every room. The tape saves for the hands once the machine house is in reach ("The hands: ⧫ 39 to go.", then GROW THE HANDS; the play pass that took every cheaper room had no hands at 6:30). With nothing short the ring rings in gold the organ that gives most for its mass. A room grown again is never offered again (the tape grew one room into a heart, then into a nerve). The tape says DREAM only for a wait over 90 s.
- **Quicker dreams** (B411). A dream grows a room in a few seconds once its mass is there (a room of the first floor in under four), toward a chamber clicked in the dream ("Click. The dream grows here next."), or where the tape would point when nothing is marked (a dream with no mark only made mass). It makes 1.25 times the mass (it was 3): a dreamer is the slowest player, a drummer the quickest.
- **A price is set once** (B412). Every star price after the hall is fixed the first time it is shown and stays until it is bought: a good buy, a sleep and a wake never move it (buying LOSSLESS RELAY raised Cryo V from 1.6 B to 5.6 B). Set where the income is headed, twice the band, so the act keeps its pace.
- **Honest pumps** (B413). The blood goes to a dead room only when the hearts reach it ("REVIVING" over it, the note "The blood brings the dead back."); else to the guts. A dead room's hover says what to do: "Dead. Grow a heart to reach it." or "Dead. Pump to bring it back."; the note "Dead rooms. A HEART reaches them: ⧫ 3 to go.". The wave runs through living flesh. When the dead block both ends of a row with nothing in reach, any living organ may be grown into the heart (a player who never grew a heart sat an hour on PUMP).
- **A mind that matters** (B414, B415). A restart loses half of what the sleep had brought, stars and ore; the lamp says "FAULT: LOST ★ 11 M" and the line "Nobody steadied the mind. It restarted and lost half of this sleep." Every click on the colony counts: inside four seconds a click gives the share the time has charged, at least a fifth (eight quick clicks did nothing).
- **Bugs** (B416 to B418). The culture vats grow people into places of their own while the colony sleeps (a quarter, half, all the beds again; with the beds full they grew nobody). Past the first months of a sleep the counter reads the year the clock and the ruler read (YEAR · 7 363 · THE COLONY SLEEPS; it read "7 141 YEARS" slept). The ruler shows at most three years and YEAR 0, 30 px apart, never just under the counters. The organ ring slides clear of the heart and its SURGE word. The action column's empty box no longer swallows clicks (the outermost chamber of a floor lay under it and the tape's TAKE A CHAMBER could not be done).
- **Sim** (B419). scripts/sim-phase4.mjs `--from iv-grow` (the checkpoint the passes play), `--human` (a pump every 1.5 s, three in five on the beat, 1.5 s to choose after a take or a wake), `--dreamer`; reports the hands and the rise into GROW and the longest stretch after the hands between payoffs and between choices. From iv-grow, human: hands 4m14s -> 3m17s, rise 12m38s -> 9m36s; drummer 8m17s -> 6m27s; dreamer 12m33s; naive never -> 16m56s. Strata act 30m38s -> 27m36s (TEND 4m22s, SLEEP 13m13s -> 12m51s, GROW 13m03s -> 10m23s); longest without a decision TEND 34 -> 34 s, SLEEP 48 -> 38 s, GROW 34 -> 12 s.
- **The human-eyed play pass** (B419). docs/playtests/2026-10-04-pass4-play.md: GROW from iv-grow to the rise, SLEEP 3 min from iv-cryo, muted, one browser; shots docs/playtests/rebuild-shots/pass4-*.png. New test file src/phase4/pass4.test.js.

## v1.84.0 - 2026-10-03 (chapter IV, third pass after the human tests)

### Chapter IV: the Watcher explains itself, readable gauges, no dead ends, TEND and SLEEP without waits, the drawer finds what the panel names, bugs (B400 to B409)

The second human pass of v1.83.0 (docs/playtests/2026-10-03-chapter-iv-human-pass-2.md): GROW alone is worth ten good minutes; the chapter as a whole not yet. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "Built: pass 3 (deep-pass3)"; the play log docs/playtests/2026-10-03-pass3-play.md.

- **The Watcher explains itself** (B400). Under 30 the mind warns: the Watcher's label flickers red, its meter burns red and the tape says STEADY THE MIND, the first time with "Click the colony to steady it." under it, until a few clicks have brought it over 70. The mind drifts with real time (at the top of the dive it fell three points a second; now about one). A lost lamp sequence costs, but never below the warning, and never restarts the mind; no lamp event comes while the mind warns, and one waiting goes quiet. The first time each kind comes, one plain line: "Repeat the lamps. Click the rooms in the order they lit." The card reads WATCH THE LAMPS, YOUR TURN ●●○○○, RIGHT +15, WRONG -5; a lamp lights a whole chamber and burns 0.75 s. A restart comes back at 60 (it was 40) and the wake says "Nobody steadied the mind, so everyone woke."; the first sleep's end says "The first sleep is short. The next ones go deeper."
- **GROW's gauges read at a glance** (B401). The veins lie under the scale, inside the ticks, at half their width and dark; the fluid's surface is bright. The short gauge has a red ring round the whole dial and its name in red (the 6 px dot is gone), and only when the tape names its organ.
- **No dead end in GROW** (B402). The tape's word always has a place: TAKE A CHAMBER and GROW A HEART ring the chamber they mean, and the camera goes to its floor (it stayed on the machine house while the chambers in reach lay a floor below). When the organ the body is short of is far off in mass, the tape says DREAM, not a minute of PUMP. The vats eat the guts' mass, never the lid's: a body never sits at nothing. A colony bigger than 48 chambers spreads the price step of a take, the work of a take and its guts' mass over its size, and a floor below the fourth costs what the fourth does (a colony of 60 rose after half an hour). A unit test and the sim hold the tape doable every second (sim: 628 seconds read, 0 not doable).
- **TEND says what a room costs the stars** (B403). The machine plays on the power to spare, so every room draws on the stars and a generator gives them: the ring's hover says "★ 186 → 164 a second." with "It draws the machine's power." under it. Kept, not rebalanced: it is TEND's one trade-off and every later tier is tuned on it. Cryo I costs ★ 7.5 k (15 k), and the tape says SAVE FOR CRYO I while the last automation is built (it said WAIT).
- **SLEEP orders in the night** (B404, B405). After the hall a level, an automation and the culture vats are bought in the night from the drawer (BUY CULTURE VATS, BUY 3 LEVELS) and built while they sleep; only a deeper sleep wakes the colony to be bought, and once only its price stands in the way it is saved for first ("SAVE FOR CRYO III · ★ 7.2 M to go"). Asleep that price is the one the wake will set, in the tape, its note and the drawer ("Bought awake."); WAKE names it ("Cryo III can be bought."). The drawer's foot: "Prices follow what the colony earns. They are set when it wakes."
- **The drawer finds what the panel names** (B406). The row the tape names is always listed (the branch's next or not, a tier asleep too), ringed in gold and scrolled to when the drawer opens. The tape uses the drawer's names (SAVE FOR GENERATOR AUTO). The room ring rings the room the tape says to BUILD. The tape's hold never keeps a word across sleep and wake (asleep it held BUILD FARM), nor in front of STEADY THE MIND or WAKE.
- **Bugs** (B407). A click on a drawer row was lost in the night (the rows were rebuilt every frame as the stars streamed in; now prices and gaps are written in place); the machine's tip wraps and stays on screen; Surface's stage holds still through a sleep (its buttons drifted with the camera); the ruler's top label is the clock's year and every boundary reads as a year ("YEAR 212", not "212"); "Marked. Pull DREAM and the body grows toward it."; a save opened asleep knows the road to the next tier.
- **Sim** (B408). scripts/sim-phase4.mjs follows the asleep tape (night orders, WAKE only when it says so), reports the wakes only for buying, the reboots per act of a Watcher who answers the warning, and checks GROW's tape every second. Strata 30m18s → 30m38s (TEND 4m45s → 4m22s, SLEEP 12m37s → 13m13s, GROW 12m56s → 13m03s); --watcher 35m57s → 30m36s; longest without a decision TEND 34 → 34 s, SLEEP 41 → 48 s (55 → 51 s --watcher), GROW 40 → 34 s; wakes only for buying in SLEEP 10 → 5 (one a tier); reboots per act: unattended 15 → 5, attentive (a click every 12 s) 0 → 0, answering the warning 0.
- **The human-eyed play pass** (B409). docs/playtests/2026-10-03-pass3-play.md: TEND 5 min, SLEEP 6 min, GROW 4 min, muted, one browser, two rounds; shots docs/playtests/rebuild-shots/pass3-*.png. New test file src/phase4/pass3.test.js.

## v1.83.0 - 2026-10-03 (chapter IV, the tension pass)

### Chapter IV: GROW pulls against itself, pumping is a drum, TEND has a crisis, sleep wakes for what matters, the drawer never hides, bugs (B350 to B359)

The human pass of v1.80.0 (docs/playtests/2026-10-03-chapter-iv-human-pass.md) judged IV not yet worth Ola's time: GROW had no real choice, pumping was one click spot, TEND never got into trouble, the long sleep was a shopping loop, the drawer hid the colony. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "Built: the tension pass (deep-tension)"; the play log docs/playtests/2026-10-03-tension-play.md.

- **GROW pulls against itself** (B350). The guts are the only mass (the lid barely digests), the vats eat mass, a heart reaches two and a half organs (deeper ones ask more), the prices grow with the body. The weakest gauge goes red and the tape names its organ; the ring marks that organ in red and says "FLESH is short." in the middle; the cheap green organ is a temptation (half price, not a quarter). When the mass cannot pay, the tape says PUMP with "A NERVE: ⧫ 12 to go." under it. A spare organ (its gauge high and still green without it) can be grown again into the one that is short. Sim: the balanced player meets 17 shortages of FEED, PULSE or FLESH and recovers 12 by choosing that organ (the rest by the edge dying back), plus 39 mass dips pumped out; a naive player who always takes the cheapest organ never rises (42 min, pace 0.28, 33 min with dead flesh).
- **Pumping is a drum** (B351). Three to five pumps take a chamber. On the beat a pump counts three times, off it nothing ("MISS"); a ring closes in on the heart and burns while the beat's window is open; pumps on the beat in a row build a surge (up to ×1.6, "SURGE ×1.48" under the heart) that carries into the next take and fades after three seconds alone. With no take the blood goes to the guts. Dreaming, the guts make three times the mass: the idle player wakes to a pile to spend.
- **TEND has a crisis** (B352). Sixteen came down with a farm for fourteen and a larder of 200: the FOOD needle falls from the first second and is red in about a minute and a quarter for a player who only digs; a farm brings it back. A generator makes 21: the second and third rooms bring POWER down and a generator is the next need. A mine without power digs by hand (a colony that burnt its last ore is in trouble, never dead). The tape never says WAIT before the hall: SAVE FOR GENERATOR AUTOMATION ("★ 5.5 k to go"), SAVE FOR CRYO I, and the price lamp reads "★ 3.3 k to go" once the three are lit.
- **The sleep wakes for what matters** (B353). Asleep the tape says WAKE only for something new (a tier, a gift, a first level); the next level of the same waits, and awake the drawer's first row buys all the levels the stars pay for in one click ("2 LEVELS · SEAM, YIELD"). After the hall an order done wakes nobody. Awake the machine plays at least 8 % of a second of sleep a day (it was 400 000 times less). A FAULT says its cause on the lamp ("FAULT: GENERATOR", "FAULT: THE MIND RESTARTED"). Awake, something new that can be paid comes before DIG on the tape.
- **The drawer never hides** (B354). Open, the strata view frames the colony left of it; a press on a chamber no longer closes it; when the tape says BUILD MINE the empty chamber has a slow gold ring, drawer open or not.
- **Bugs** (B355 to B357). One floating word per spot (they piled up); the drawer's price line wraps ("★ 500 M · 60 capacity · ⛏ 1 M · a dormitory"); an automation says the same before and after it is bought; the tape never names what cannot be done (no DIG without the ore, SAVE FOR ... AUTOMATION when the stars fall short, the hold released by any purchase or take); "FLOORS 1 / 3" counts the floors full; "1 MONTH", "1 YEAR"; THE WATCHER from the first sleep (not SYSTEM AWAKE); the queue in plain words ("SEAM ×6", not "lv mine"); in GROW the ruler's year labels give way to the one year on the clock; MUSCLE says what it does ("Guts and vats make half again."); jumping to a checkpoint keeps rpi-audio, rpi-debug and rpi-deep-view (a muted player got the music back).
- **Sim** (B358). scripts/sim-phase4.mjs reports the movements (TEND, SLEEP, GROW), the shortages in GROW and how each was recovered, and takes `--naive`. The drummer pumps once a second, four in five on the beat. Strata 31m11s → 30m18s (TEND 5m11s → 4m45s, SLEEP 12m56s → 12m37s, GROW 13m04s → 12m56s), 3D 31m06s → 32m05s, --watcher 32m52s → 35m57s; longest without a decision TEND 43 → 34 s, SLEEP 45 → 41 s (58 → 55 s --watcher), GROW 25 → 40 s.
- **The human-eyed play pass** (B359). docs/playtests/2026-10-03-tension-play.md: TEND 4 min, SLEEP 4 min, GROW 8 min, muted, a line every 30 s, three rounds; shots docs/playtests/rebuild-shots/tension-*.png. New test file src/phase4/tension.test.js.

## v1.82.1 - 2026-10-04 (the war knows the greenhouse)

- **Greenhouses in the war.** A greenhouse plate takes 35 before it falls (between a super store's 30 and a skyscraper's 40), and landings aim for it a little more often than a super store (value 2.5 against 2), since it feeds the most people. Until now the war treated it as the weakest, least interesting plate.

## v1.82.0 - 2026-10-03 (chapter II, the greenhouse)

### A third level of food

Ola: "we need to be able to develop better food production, one more level of the buildings that produce food" (B221).

- **Greenhouses.** A new research (the sprout, from 2 500 people, usable at 5 000, 1.50 M ★ and 150 k ⚛) lets a super store become a greenhouse: five times the food (300 a second, ×1 024 with GMO maxed, about 300 000 people fed per greenhouse). The upgrade is the "+" on the plate, as with the houses.
- **Sound**: the research and the upgrade play the food word (grain), not glass or wood.
- **A complete city now includes the greenhouse research**, so the neighbour's raid waits until it is bought.
- **Simulation**: `scripts/sim-phase2.mjs` knows the greenhouse; WAR is still reached at 19:13, and the 38 market stalls the greedy player bought at the end are replaced by one greenhouse.
- In the war a greenhouse feeds at its share of HP like the stores; the armory never takes one.
## v1.81.1 - 2026-10-03 (chapter I, the foam fills faster)

### Chapter I · TRIVIAL: the foam bar before the lightning fills four times faster (B360)

Ola: the green end boost takes too long to fill, too much waiting. The foam now fills at 5 000 games instead of 20 000: about 14 s per lightning at full factory speed instead of about a minute, so the two collapses that open the bank take about half a minute. Each collapse is still worth 30 s of production.

## v1.81.0 - 2026-10-03 (chapter III, an armory for our soldiers)

### Chapter III · WAR: our soldiers come out of an armory, not a store (B220)

Ola: "Our soldiers come out of a store. We should add a separate building that is an armory for our side." docs/superpowers/specs/2026-09-19-chapter-iii-war-design.md, "The armory".

- **Where.** At the start of the war the empty plot nearest our pier becomes the armory; with no plot free, the nearest home or store (else the nearest apartment, super store or skyscraper), its people moving into the town's free room. Never the factory, the bank, a district, a ruin or the last plot (the hatch at the end). Saved in the war (`w.armory`), so a reload finds it; a war saved without one gets it on load. The pure choice is `chooseArmoryPlot` in ants.js, tested.
- **How it looks.** A plate in our light blue with a castle in our blue (the same glyph as their tower: military is a castle on both islands, the colour says whose), no ring, the soldiers stationed (guards and the force at home) in a small badge, the ◆ like every plate they can target, no sell. It arrives with the war's pop and its 'reveal' word as the card lifts, and the war room says "Interior: the old warehouse by the pier is an armory now." (the plot, the old house, the old warehouse...).
- **What it does.** Guards walk out of it onto the coast road when shields are bought and back in when they are no longer needed or stand down (into it and on to the hatch at the end); a strike's party files out of it to the pier, and the survivors walk from the pier back into it. The people of the town are no longer where soldiers come from.
- **Targeting.** A landing can hit it like any plate (to them it is worth what an apartment is). Razed: "Status: the armory is lost. Our soldiers have nowhere to gather.", soldiers come out of the plate nearest the pier, and the clear button raises the armory again (30 % of what stood there). It changes no number: defence and force are the same with or without it. `sim-phase3.mjs 1` prints the same line.

## v1.80.0 - 2026-10-03 (chapter IV, GROW built from organs; pumping takes chambers)

### Chapter IV, movement III · GROW, third pass: the body is built from organs you choose; pumping takes chambers; challenge and payoff per floor (B340 to B349)

Ola on v1.78.0: "From when you start becoming flesh you have zero things to do. You click a piece of flesh that does something unclear. Still it makes no noticeable difference to anything. The player's job is to watch while the Body sleeps?" docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "Built: GROW third pass (deep-organs)"; the play log docs/playtests/2026-10-03-grow-organs-play.md.

- **Every take is a choice of organ** (B340). A click on a chamber in reach opens a ring of four organs, each with its price in MASS: VAT (grows people), GUT (turns rock into mass), HEART (feeds the edge, pumps harder), NERVE (takes fill faster, dreams last longer). The room's old function makes one cheap (dormitory a vat, mine a gut, generator a heart, farm a vat or a gut, the cryo hall a nerve), marked green. A living organ clicked offers the other three, to grow it again for a price. The middle of the ring says what you have; on hover what the organ does or what is missing. Pure rules in the new src/phase4/organs.js.
- **The four gauges are the four organs** (B341). MASS (guts), FEED (vats), PULSE (hearts), FLESH (nerves), each the ratio of what its organs give to what the body's size asks; the weakest has the dot and limits the pace of every take; the tape names the organ to grow ("INSTRUMENTS: GROW A HEART"), or PUMP while a take fills, TAKE A CHAMBER, DREAM, RISE.
- **Pumping takes chambers** (B342). A take is paid at once and filled with work: each pump of the heart sends a red drop along the body to the chamber (both views, an overlay over the view), and when it arrives the take's fill ring steps and its organ grows in. On the beat a pump fills four times an off-beat one; each heart beyond the lid makes pumps stronger. Left alone a take fills slowly by itself; dreaming, faster (the idle player still grows, the active one is about twice as fast, a player who keeps the beat four times). With no take a pump sends the blood to the guts (mass) or to a dead room.
- **Each organ looks different** (B343), in the locked flesh style (new src/phase4/organ-art.js, used by both views): a vat holds two curled pale figures in dark hollows, a gut is one coiled tube, a heart a lopsided red muscle with vessels that beats on the heartbeat, a nerve pale branching fibres that flicker. A take in progress grows its organ in; a dead one is grey and still.
- **Challenge and payoff** (B344). Uphill: a deeper chamber costs more mass and more work and asks more of the hearts and nerves than its organ gives back. Downhill: a full floor cascades, its organs give half again ("×1.5" over each) and the landing below becomes spine by itself. The machine house as hands plays three times the games times PULSE, its hands throw faster with it, and "★ ×N" floats over it. The edge starves two ways, both slopes with a way back: beyond the hearts' reach (one organ every 3 s; the dead say "Starving. The hearts do not reach it.") and with no people to eat. Dead flesh blocks the front, so the tape says GROW A HEART (or GROW A VAT) and the living organs to grow again glow when no chamber in reach can be that organ.
- **MASS, the body's currency** (B345). A fourth counter in GROW beside ore, stars and people, with its rate a second and a lump-of-tissue glyph (readout.js MASS_SIGN); the MASS gauge carries the amount. The body starts with mass for a few takes.
- **The body's clock is real seconds** (B346). A body year every 3 s awake (the people a second on the counter), the colony's calendar a day a second as before, the dream dives the calendar and advances the body a second a second. VATS stops at level 8; SPREAD now makes a take fill by itself twice as fast a level; each level of MUSCLE adds half again to what guts and vats make.
- **A save in the middle of GROW** (B346) is given organs (each chamber the organ its room made cheap) and mass; nothing it had is lost. The old SPREAD clock and the growing organs are let go.
- **Sim and pacing** (B347). policy.js reads the gauges (the weakest gauge's organ, cheap where it can be, the machine as soon as it can be paid) and the sim pumps at a human rate (a pump every 1.5 s, on the beat half the time). Strata 33m03s to 31m11s (GROW 14m56s, 45 %, to 13m04s, 42 %), 3D 33m03s to 31m06s (42 %), --watcher 34m54s to 32m52s (39 %); longest without a decision in GROW 35 s to 25 s; a take by hand 15 s (median).
- **The human-eyed play pass** (B348). Five rounds of eight minutes from "IV · the question answered", a line every 30 s. Fixed on the way: the space bar pumped and paused the game at once (the space is the pause: the pump is the heart's button and the chamber being taken); dead flesh at both ends of the front left nothing to click while the tape asked for a nerve; a dream completed nothing; the drop of blood was too small to see; VATS could be bought to absurd levels; the price tip went off the screen; organs showed where the colony fades.
- **Checkpoints and acceptance** (B349). "IV · the body" is now the starving edge beyond the hearts' reach (GROW A HEART); "IV · ready to rise" has the four organs in turn. accept-iv-cut.mjs, both views: O (the ring of four, priced, one cheap; picking begins the take), P (a pump's wave, the take moves a step, pumped to the end the chamber is that organ), A, W (the weakest gauge has the dot alone, the tape names its organ), N (the starving edge, its reason, a gut grown into a heart brings the dead back), D (the dream grows toward a mark by itself). Shots docs/playtests/rebuild-shots/organs-ring, -wave, -four, -starving, -hands.

## v1.79.0 - 2026-10-03 (chapter IV, economy and clarity)

### Chapter IV: prices follow income, nights follow sleeps, rates per second, the gap is shown, the lever pivots in the middle, the snap only asleep, missed nights told on waking (B330 to B339)

Ola's playtest of v1.78.0: "Why can't I buy Cryo?", "They have slept for 1 000 000 years. The last 600 000 years nothing has happened. What is the user expected to do?", "The numbers are so big that everything stands still like still images." docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "Built: economy and clarity (deep-econ)".

- **Prices follow income** (B330). From the hall on, every star price of an upgrade (level, automation, feed, culture vats, cryo tier, Surface's gifts) is its old price held inside a band of 35 to 90 seconds of the colony's income (what a real second of sleep brings at its tier, set on each wake and when a tier is bought); one sleep brings at most 200 seconds of income, stars and ore, then the counter reads "store full" and the tape WAKE. Before the hall nothing changes. A save sitting on an absurd stock lands where it can buy again (the income is worked out when it is opened).
- **Nights follow sleeps** (B330). Surface's visits every 2 sleeps, then every sleep (VISIT_GAPS 2, 2, 2, 1), a line every other visit; nights 1 to 3 wait for no tier, 4 for Cryo III, 5 for Cryo IV, 6 (the question) for Cryo V. A night that waits says so on the tape: "SURFACE WAITS FOR CRYO IV" with "★ 3 T to go".
- **Rates per real second** (B331). Every counter's rate is what happens in a second: "+3.5 T a second" awake (a day is a second), asleep the dive's pace, in a dream the dream's; the people too, and the rates stay on screen asleep.
- **The tape always names the next goal** (B332). After the hall, when nothing is bought: "INSTRUMENTS: SAVE FOR CRYO VI" with "★ 2e17 to go" under it, and the lever glows; when it can be paid, "BUY SEAM" (or LONGER SLEEP); asleep the tape stays lit: SAVE FOR, WAKE ("Cryo VI can be bought." or "The store is full."), BUY for a gift. The goal: the question, then an opened gift, then the tier a night waits for, then the cheapest (the next tier when it is within half again of the cheapest level); the first culture vats before all.
- **The lever pivots in the middle** (B333). The arm turns on a pivot in the middle of its slot: up, the ball at the top end and the stick down to the pivot; pulled, the ball at the bottom end and the stick up to it. SLEEP/WAKE, DREAM/WAKE and RISE alike.
- **The gap is shown** (B334). A locked drawer row with a price says "You need ★ 2e17 more." on a line of its own, under the ticks of what else it needs.
- **Missed nights are told on waking** (B335). A night that came in the sleep is said again, low, for six seconds when the colony wakes; its graft makes the tape say GRAFT A ROOM and the rooms glow with "Five times the output. Takes ⚇ N of your ⚇ N.".
- **A graft shows what it did** (B336). Over a grafted room: "Ore 1.7 k → 8.6 k a second." (a dormitory: "Beds 40 → 200."), shown the moment it is grafted, with the "×5".
- **The snap only asleep** (B337). Awake, a click on a room makes no sound, no cooldown ring and no snap cursor.
- **Sim and acceptance** (B338, B339). sim-phase4.mjs reports "longest without a decision" per movement; its player follows the tape after the hall (buys the goal, wakes when it can be paid or the store is full). Strata 26m15s to 33m03s (GROW 20 % to 45 %), 3D 25m57s to 33m03s, --watcher 29m16s to 34m54s; longest without a decision TEND 78 to 43 s, SLEEP 35 to 45 s (58 s --watcher), GROW 28 to 35 s. accept-iv-cut.mjs checks X Z S G L M in both views; new checkpoint "IV · a long sleep" (Ola's save); shots docs/playtests/rebuild-shots/econ-*.png.

## v1.78.0 - 2026-10-03 (chapter IV, GROW second pass: graft, the question as a choice, feeding, the dream, the heart)

### Chapter IV, movement III · GROW, second pass: a taste of flesh, the question as a choice, a feeding loop, one choice at a time, the people counter, the body dreams, the heart is pumped (B320 to B329)

Ola on v1.76.0: "You don't understand what the flesh does... Almost at once you're out of people, the body starves and there are no choices left. A dead end on Body." and "Now you have to sit and wait and watch and can't do anything." docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "Built: GROW second pass (deep-grow2)".

- **The people counter** (B320). A third counter top right beside ore and stars (lucide "users", the count, "+N a day" or "-N a day"), from TEND on. In GROW the FEED gauge carries the count. Every price in people is written beside it in the same glyph: "Takes ⚇ 192 of your ⚇ 2.4 k and ⛏ 863 M." (readout.js PEOPLE_SIGN).
- **The graft, a taste before the question** (B321). Night 4 gives a GRAFT (src/phase4/graft.js), night 5 a second. The panel says GRAFT A ROOM, every built room glows; a click turns one to flesh (both views, lone organ, no sinew): it makes five times what it made, "×5" floats over it, its people walk in (4 %) and it eats 1 % of the colony a year. Quiet hands' effect is folded into Lossless relay.
- **The question as a choice** (B322). Its drawer row reads three lines; it never has to be bought.
- **The feeding loop** (B323). The question gives the body at least two vats. The first takes cost a fifth (TAKE_FIRST, ramping over twelve), priced off the people the colony has; a small body eats a quarter (hunger grows with its size); a take that would starve the body is refused, its price red, the word GROW VATS (VATS are paid in ore now); a dead room revives by itself over ten days while there are people to spare. Each take floats its multiplier ("×20", VAT, HANDS) and the MASS needle is the body's weight. The lamps are counts: "DEEPEST FLOOR 3 / 12", "MACHINE 0 / 1".
- **One choice at a time** (B324). The drawer opens empty (its button hidden): VATS when FEED first falls, APPETITE after the first necrosis, SPREAD after ten chosen by hand, MUSCLE once the first floor is full.
- **The body dreams** (B325). Awake GROW runs a day a second as TEND does. The lever reads DREAM; a click on a chamber out of reach marks it (a faint red thread from the body, view-hooks markChamber / clearMarks); pulled, the dream dives time (grow.js dreamDaysAt) and the body grows along the marks; it wakes on HUNGER, REACHED or the lever (WAKE). The counter reads THE BODY DREAMS.
- **The heart** (B326). Awake, the lid is a button that swells on the heartbeat (sound.js beat()); a click pumps: an organ still growing grows, a dead room revives a fifth, ore comes in; on the beat ×2, off it ×½, a 380 ms rhythm.
- **Sim** (B327). The scripted player places the grafts, takes, marks and dreams to the rise and reports "longest stuck". Strata: 31m56s to 26m15s, GROW 12m45s (40 %) to 5m10s (20 %), stuck 8 s; 3D 30m16s to 25m57s, GROW 4m53s (19 %), stuck 10 s; --watcher 27m43s to 29m16s (18 %), stuck 10 s. GROW is a fifth, not a third: every longer setting tried pushed "longest stuck" past 10 s.
- **Checkpoints and acceptance** (B328). New "IV · the graft"; "IV · the question answered" has the two grafts. accept-iv-cut.mjs checks P, F, Q, E, D, H, N in both views; shots docs/playtests/rebuild-shots/grow2-*.png. The 3D walkers no longer break when a dream closes a whole floor.
- **Save** (B329). Schema 11: a save past night 4 is given its grafts; a body in the middle of GROW loads with its drawer items seen as their moments have come, never mid-dream.

## v1.77.0 - 2026-10-03 (chapter IV in the strata view; 3D stays selectable)

### Chapter IV: the strata view is the default; 3D stays selectable (B310 to B319)

Ola chose the strata (B). It now draws the whole act, TEND, SLEEP and GROW to the RISE; the 3D view stays in the code and is one click away. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "Built: the swap".

- **The strata view by default** (B310). src/phase4/index.js makes the strata view unless the URL says `?view=3d` or the ☰ menu's new "View · strata / 3D" item (chapter IV only, kept in localStorage `rpi-deep-view`) chose 3D; the URL wins. src/phase4/views.js holds the choice.
- **The body's neighbours are the ones on the screen** (B311). Each view exports `chamberPlace` (a row outward from the shaft in the strata, the ring of twelve in 3D); grow.js `setChamberPlace` builds the body's graph with it. A glowing chamber always lies beside the body. growth.js untouched.
- **Everything the orchestrator asks, in both views** (B312, B294). The strata view gained the "+" where the next chamber is dug (hover price, click digs), grow mode, `chamberAt`, `screenOfNode`, `focusFloor`, `focusMachine`, `onChamberHover`, the hands' rhythm, `setHands(false)` and an instant `setHands` for a reload, an older save's sector choice. People walk into organs and vats and step back out of the vats. The first throw by hand sounds whether the player or the flesh took the machine house.
- **The layers are saved** (B313). `state.strata` (years per sleep) is kept with the deep save and laid again after a reload; an older save is given one layer per sleep from the years slept.
- **Framing** (B314). The colony fits between the instrument panel and the year ruler; the ruler's labels keep out from under the counters, the buttons and the lever, and name a year once. Asleep the camera rests with the years in the middle and the counter stands in them over the shaft; Surface and the last lines stand over the shaft too. When the hands come, the camera looks closer for seven seconds and pans, the colony fading at the sides.
- **The rise** (B315) runs on a wall clock (at most ten seconds of pushing), and the body stays risen while the lines type.
- **Sims** (B316). `scripts/sim-phase4.mjs --view 3d` for the 3D graph, the strata row by default; the policy saves its people for the machine house once it is in reach. Strata: plain 31m56s (GROW 12m45s, 40 %), --watcher 27m43s (GROW 7m23s, 27 %); 3D: 30m16s (37 %) and 26m51s (24 %). Before (3D only): 30m02s (36 %), 26m29s (23 %).
- **Acceptance in both views** (B317). `node scripts/accept-iv-cut.mjs` runs itself for the strata and the 3D view; new checks V (the strata view is the default), A (a glowing chamber lies beside the body on the screen), K (the layers are rebuilt for an old save and survive a reload). Shots: docs/playtests/rebuild-shots/swap-*.png.
- **Tests** (B318). src/phase4/swap.test.js: the view choice, the body's graph per view, the pan, the sleep camera, the ruler's labels.

## v1.76.0 - 2026-10-03 (chapter IV, movement III: the body)

### Chapter IV, movement III · GROW: the body (B300 to B309)

Ola reached year 202 million asking "When does Body begin?": after Surface's sixth night nothing happened. Now the act plays to its end. docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "III · GROW" and its new "Built" section.

- **The question opens the body** (B300). The question is the drawer's first row once Surface has opened it (it was only in the whole tree) and the panel says INSTRUMENTS: THE QUESTION when it can be paid. Buying it begins movement III: the colony does not sleep any more, the lid is the first organ. The old biological steps (brain tissue to skin receptors, the sector choice) are retired; a save that owns some is given a body of three chambers a step, nothing lost (save schema 10).
- **The panel overgrows** (B301) over ten seconds: a vein crosses each gauge's glass, the dymo tapes peel, MASS, FEED, PULSE and FLESH come in a warmer hand, the needles sink into fluid levels. The advice keeps its dymo: INSTRUMENTS: SPREAD, FEED IT, GROW VATS, RISE. The lamps are the rise's two conditions: DEEPEST FLOOR FULL, MACHINE REACHED.
- **The drawer becomes tissue** (B302) with the body's items: VATS (the culture vats go on), SPREAD (the flesh takes a chamber by itself), APPETITE (each chamber eats less), MUSCLE (the flesh makes twice as much).
- **The front** (B303): the chambers the body touches glow; hovered, "Costs 1.6 k people and ⛏ 597 M."; a click takes one: its people walk in and do not come out, the slab turns to flesh from the touching edge over two seconds, sinew across the bridge. A full floor turns the shaft into a spine and opens the floor below. The camera follows the front down.
- **Hunger and vats** (B304): the body eats people every year of its own (three real seconds; the calendar runs a third of a year a second); short, its edge goes necrotic one a year until fed. A dormitory taken is a vat; from the question on only vats grow people. Living organs make twenty times what the rooms did, more a floor down.
- **The hands** (B305): the machine house taken, the tubes become a fist, a flat hand and two fingers that throw on the machine's rhythm; the camera goes to look.
- **The rise** (B306): the lever comes back overgrown, RISE. The body climbs out of the lid and breaks the crust; "Humans are so small." "So fragile." on the Watcher's tape; V · UNITY. A reload shows the wall.
- **Sound** (B307): the blood and the heartbeat follow FLESH; a wet knock for a take, a dull drop for necrosis, the first throw by hand, a surge into the low D in unison for the rise.
- **Sims** (B308): both runs play GROW to the rise. Plain 26m58s to year 802 701 → 30m02s to the rise (the question at 19m11s, GROW 10m51s, 36 %); --watcher 23m02s to the old biological ending → 26m29s to the rise (GROW 6m09s, 23 %).
- **For the strata view** (B309): src/phase4/view-hooks.js adds setBody, onChamberClick, setHands and rise (plus onChamberHover and step). Checkpoints iv-grow, iv-body (the new body) and iv-rise; `node scripts/accept-iv-cut.mjs` checks G (the panel overgrows, a click takes a chamber), N (starved, an edge dies; fed, it revives) and R (RISE, the lines, UNITY, the wall after a reload). Shots: docs/playtests/rebuild-shots/grow-*.png.

## v1.75.0 - 2026-10-03 (chapter IV, the strata view as a module and a prototype)

### The strata view, direction B (B290 to B294)

Ola chose direction B of docs/mockups/deep-views-13.html to replace the 3D colony for all of chapter IV, with A's screen ghosts and C's light. Built as a standalone module and a prototype; not wired into the game yet.

- **src/phase4/strata-view.js** (B290): a vertical cross-section in three.js (orthographic): the sky and rain over the dead surface, one sediment layer per sleep (thickness by the log of its years, the top one thickening during the sleep, the year of every boundary on a ruler at the right, YEAR 0 the crust with the lid), the old ground, the machine house with the real machine seen from the side, the floors as rows of flat chambers with their room glyphs on a corridor, the shaft, people walking corridors and shaft. Empty chambers carry a faint "+", orders and digs fill a bar. THE LIGHT: the floor the camera is on is lit, deeper floors fall to black; asleep everything dims but the lamps and the cryo glow. Scroll or drag to look up through the years and down the floors; reset goes home. One instanced draw for every chamber, one shader for all the rock; no allocations per frame of its own.
- **Hallucinations as screen ghosts** (B290): an afterimage of an earlier frame drifting, a frame that is wrong for a moment (mirrored, a floor out of place, a frame from before), the tall thin figure on the surface line (or the highest year line in view), a lamp and a person in an empty chamber (or in a room never dug, up in the young rock), a chamber's walls breathing. The snap clears them with a flicker.
- **GROW in the section** (B290): setBody(bodyIds, necroticIds, reachableIds) with growth.js ids fills chambers with flesh.js in its cross-section projection (the front spreading from the side that touches the body, the room showing through until it is reached), corridors become muscle, the shaft a spine, dormitories vats, necrotic organs grey, reachable ones glow; roots and vessels with mycelium grow up through every layer, more as the body grows. setHands(on) raises three sinew arms with hands.js hands out of the machine house; rise(onDone) pushes the body up through all the years to the surface, bowing and cracking the layers, striking out the years it passes, and breaks the crust.
- **src/phase4/strata.js** (B291): the section's numbers, pure and tested: a floor is a row growing outward from the shaft (-1, +1, -2, +2, ...), sectionPlace for growth.js graphFromSlots so the body's graph is the row the player sees, layer thickness and the per-sleep history (rebuilt from the totals for an old save), the ruler's labels, the camera's home and limits.
- **docs/mockups/deep-strata-proto.html** (B292): drives the view through the whole act with a fake state (TEND, sleep with the counter, deep sleeps, each hallucination, the snap, take plates, starve, feed, reach the machine, rise); ?shot= and ?big=100. Screenshots in docs/playtests/rebuild-shots/strata-*.png.

## v1.74.0 - 2026-10-03 (chapter IV, Ola's notes on the rebuild)

### Chapter IV: Ola's notes on v1.73.0 (B280 to B288)

Ola on the rebuilt TEND and SLEEP: "SO much clearer and easier to understand, GOOD!" These are his notes from that playtest.

- **One ring per order** (B280): a room ordered shows its ring on the one chamber it is built into, never on every plate of its kind. Levels and automation are not per chamber: their ring is in the drawer's row and the queue, not on the plates.
- **Dig from the map** (B281): the circle where the next chamber goes has a "+"; a click there digs, the same as DIG and at the same price, and the hover shows the price.
- **The drawer never eats a click** (B282): only a press on the empty scene behind it closes the drawer. DIG, the lever, the drawer button, the "+" and the menu do their job and leave it open. (The press closed the drawer, the buttons slid back, and the click landed on nothing.)
- **The drawer never moves a button** (B283): it lies over the screen and nothing moves. DIG, the drawer button, the lever and the view reset stay where they are, above it; the drawer's list ends above them; the counters top right fade under it (its own wallet says the same).
- **One sign for ore** (B284): every amount of ore carries the pickaxe, the same glyph as the counter (DIG's price, the ring of rooms, the "+", the drawer and its wallet, the whole tree's wallet and info box, the numbers before and after). The word ORE is only on the gauge's tape, beside the same pickaxe. Stars are ★ everywhere, the counter too.
- **People grow in slowly** (B285): new beds fill a share of what is still empty each day, so the people grow into them over weeks. The HANDS gauge has one continuous scale (it no longer jumps from the red to the green when the last post is filled) and its needle eases on a slow spring.
- **The price is a lamp** (B286): Cryo I's price is the fourth lamp on the panel, "★ 15 k" on dymo tape, dim until the stars are there, lit when it can be paid. The lever appears only when all four are lit, and no longer repeats the price.
- **Surface speaks once** (B287): a throw marked the game played before its result was shown, so for the second the fists shook the card counted as gone, its line was cleared and then typed itself again. Now the card is never gone while a game is under way, and a line already typed in a visit is never typed again.
- **Culture vats** (B288): a new HABITAT node in the drawer, "Grows people while the colony sleeps.", bought awake once the hall stands, three levels (★ 20 k, 1 M, 100 M). Asleep only the vats grow people (0.3, 0.6 and 1 times the awake rate); without them nobody is born in the sleep, the ice thins the sleepers, and the colony is woken when a whole sleeper under ten is missing. The panel says "INSTRUMENTS: BUILD CULTURE VATS" after the hall. A save that already has its hall is given the first level (save schema 9). In movement III these are the vats the body takes over.
- Sims: plain run 26m01s → 26m58s to year 802 701 (vats 6m58s, 9m08s, 12m22s); --watcher 21m08s → 23m02s to the biological ending. A sleep that thins without vats is fast-forwarded like a steady one.
- Acceptance (`node scripts/accept-iv-cut.mjs`) checks the ring on one plate, the "+" digging with its price, DIG with the drawer open, the buttons not moving, the pickaxe on DIG, the gauge and the wallet, the fourth lamp dim without the stars and no lever then, and the night's line typed once through a game.

## v1.73.0 - 2026-10-03 (chapter IV rebuilt: TEND and SLEEP)

### Chapter IV rebuilt, movements I · TEND and II · SLEEP (B260 to B269)

Ola played IV through on v1.71 and called it a failed level: too much text, flapping, no feeling. This builds the first two movements of docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md. The economy underneath is untouched; the screen is new.

- **The instrument panel** (B260) replaces the four bars, the advisor's feed, the rates and the bar tooltips: four round gauges with needles and a red arc, on dymo tape (ORE, FOOD, POWER, HANDS). A falling store points at its days of cover (red under 30 days); one that does not fall rests in the green. The needles ride a damped spring. Under them one stamped label is the only advice ("INSTRUMENTS: BUILD FARM", "DIG", "AUTOMATE MINES", "FEED THE MACHINE", "LONGER SLEEP", "SLEEP"); it holds a word at least four seconds. "EMPTY 2" counts the chambers dug and empty. Ore and stars stay top right, large, with "+N a day" under them.
- **Rooms are built where they go** (B261): a dug, empty chamber is a plate with a faint "+"; a click on it opens a ring of four rooms with their prices (bright when they can be paid, the missing ore in the middle on hover); the room is ordered into that very chamber and shows its glyph and ring there. The room buttons are gone; DIG stays as one button with its price.
- **The drawer** (B262) replaces the full-screen tree as the way to buy: from the right over a quarter of the screen, the colony live behind it. Only what can be bought now is bright (name, about five words, price); per branch the next thing is dim with what it needs. Awake the day's things, asleep the night's. An order under way shows its ring in its row. "the whole tree" opens the old board. A press outside or Escape closes it.
- **Cryo I is three lamps and a lever** (B263): FOOD RUNS ITSELF, POWER RUNS ITSELF, ORE RUNS ITSELF, read item for item off Cryo I's own road (an automation on order blinks). When they are lit and Cryo I can be paid, the lever appears with the price; pulling it buys Cryo I and the colony goes under. After that the lever is the sleep, and pushed up, the wake.
- **Cut** (B264): scout parties, the survival estimate and its band, the early ascent and the people's ending, the wake-up strip, the advisor's sentences. Their save fields stay and do nothing harmful; a party out in an old save still comes home.
- **The dive** (B265): pulling the lever puts the panel's lights out one by one; the middle of the screen says "THE COLONY HAS SLEPT" over a large count of the years (months in the first two years) with the surface's true healing as a thin ring round it. **Time accelerates within a sleep**: it starts at 15 % of the tier's rate, reaches the full rate in six seconds and keeps gaining toward three times it (watcher.js sleepDaysAt; the sim sleeps the same way).
- **Waking lights one lamp** (B266) with one word: FOOD, POWER, FAULT, VOICE or AWAKE. The panel's lights come back. The sentences are kept in the save (`wakeLog`), never on screen.
- **The mind goes** (B267): as the Watcher's stability falls in the sleep, a lamp burns in an empty chamber (under 70), a tall thin figure stands on the crust (under 55), a needle and a year digit read wrong for a moment (under 40), a plate's walls breathe (under 25). A click on the base snaps them all away with a flicker; they come back one by one after seven seconds. Nothing explains it. The Watcher's label is dymo tape too.
- **Surface is the hallucination** (B268): it comes only in a sleep and only to a mind under 80 (watcher.js SURFACE_BELOW). Its card fades 6 s after a game's result. From night 4 its label and words are drawn on the Watcher's own tape, more each night; at night 6 its label flickers to WATCHER before the question types. The night log stays in the whole tree.
- **For another colony view** (B269): what lives in the view (the empty chambers, the room ring, the hallucinations, the snap) goes through src/phase4/view-hooks.js, so a new view can implement the same calls.
- Sims: plain run 24m47s → 26m01s to year 802 701 (nights 8m09s to 18m54s → 8m27s to 20m50s); --watcher 27m26s → 21m08s to the biological ending. Attentive Watcher (snap every 12 s) holds 54 to 80 in 25 s dives (was 71 to 86).
- Acceptance rewritten for the new UI: `node scripts/accept-iv-cut.mjs [--shots DIR]`. Checkpoint "IV · cryo I" is the lever moment now (every room automated, the hall not yet bought).

## v1.72.0 - 2026-10-03 (chapter IV, the flesh: modules and prototype)

### Chapter IV, movement III · GROW: the flesh, as modules and a prototype (B270 to B274)

Built beside the game, not in it: nothing existing changed except this file, the backlog and the module list. Integration comes later (B274).

- **The body's rules** (`src/phase4/growth.js`, pure, `growth.test.js`, B270). The colony is a graph of chambers on floors (`graphFromSlots` builds it from the layout; any view can bring its own). The lid is the first organ; a plate is reachable only from a living organ next to it on the same floor, so the body is always one connected front; a full floor opens the spine to the landing below, and floor 1 full opens the neck to the machine house. Every year the body eats people (per organ, by its room's level, hungrier a floor down); short, the outermost organ goes necrotic, one a year, and fed again the innermost revives first; dormitories become vats that grow people; living organs make x20 (x1.5 more a floor down), necrotic ones nothing; `mass`, `roomOutput`, `riseReady` (deepest floor full and the machine taken). Every number a named constant at the top, to be tuned with the sim.
- **The flesh** (`src/phase4/flesh.js`, B271): a procedural material (MeshPhysical with the shader patched, one program for every mesh) drawing in world space, so the same tissue lies on a 3D slab, a flat plan quad and a section, and runs on across plates and bridges: branching vessels that taper out, sinew bellies, fine pale mycelium, bone-pale ribbing on the sides, a wet clearcoat, and one arterial red (#a8132c) in a double heartbeat running out from the heart along the vessel cores. `fleshify` spreads it from the touching edge over about 2 s (vessels creep ahead over the concrete, lanes and houses sink in as the front passes), `setNecrotic` greys, dries and stills it, `setReachable` lets the body lean over a plate's edge with a faint glow, a slight breath on the vertical axis, `growTendrils` lays sinew and a vessel across a bridge. Front, origin, necrosis, hint and pulse are uniforms, independent of geometry.
- **The machine's hands** (`src/phase4/hands.js`, B272): a fist, a flat hand and two fingers of capsules in the flesh with bone knuckles and tendons, hung on the machine's arm heads (found in its group; machine-model.js untouched), the tubes shrinking away and the arms turning to sinew; they wind up as fists and shoot their shape on the machine's own game clock.
- **The prototype** (`docs/mockups/deep-flesh-proto.html`, B273) runs the real modules and the real machine over a two-floor colony in scene.js's look: click a glowing plate, take a reachable plate, fill the floor (the shaft turns into a spine with vertebrae), reach the machine (the hands), starve and feed, and PLAN VIEW: the same body on flat slabs from above, beside the 3D view. `?stage=1..4` and `?plan=1`. Shots: `docs/playtests/rebuild-shots/flesh-*.png`.

## v1.71.0 - 2026-10-03 (chapter IV in plain words)

### Chapter IV in plain words (B250 to B255)

Ola after playing v1.67: "I can't tell how many stars I have to buy with", "'85 %: 15'? Who writes like that?", "'Next 20 cap something something', what?". A copy and clarity pass over every line in IV. No rule and no balance constant moved; both sims unchanged.

- **The wallet is in the tree** (B250). The board has a header band inside its frame with "★ 1.1 M   ore 181 k" (asleep "capacity 84") in the board's own mono, larger than any label. The strip above the board is gone. A price on a node is white when it can be paid and dim when not.
- **The info box in four plain lines** (B251): the name and level ("2 / 20"); what it does in one sentence ("Stability falls more slowly while they sleep."); the price in words ("Costs ★ 20 k and 20 capacity."); where it stands ("You can buy it.", "You need ★ 12 k more.", "Only while the colony sleeps.", "Being built: 3 days left.", "Opens after Cryo II."). The before and after numbers are a quiet fifth line ("Drift 0.90 → 0.68 a second."). Until the first Watcher step is bought, its nodes say what capacity is.
- **The queue shows in the tree** (B252): a node with an order under way has a thin ring filling round it and "+1" by its pips; a purchase flashes the node once. **A click on the backdrop closes the tree**, as Escape and the button do; a click inside the board does not.
- **Sleep is not there until Cryo I is bought** (B253); it arrives with a short fade, and its caption is gone. What Cryo I needs is listed on its node only, with ticks. The pill reads "Sleep" ("1 m/s" read as metres a second); its hover says the rate in words.
- **One text per thing** (B254). Go up has no hover, one caption: "Opens at 85 % survival. Now about 15 %." The scout party has no caption, a hover of three lines ("Send 4 people up for 2 years." / "Costs 3 k ore." / "Some may not come back.") and no odds; an open tooltip hides the other captions in the column. The ring's ± is the one place the doubt is explained ("What the scouts believe. More scouts, less doubt.").
- **The audit** (B255): no "A: B", no "next:", no "cap", no "+81/d" in IV's tooltips, the advisor, the feed, the night log, the bars' hovers (which now say what the numbers over and under each bar are, not the numbers again), the machine's hover, Surface's game result and the scouts' lines. Surface's own lines are untouched; the alarm lines keep their meaning.
- Tests: `src/phase4/copy.test.js` (the info box, the price in words, no internal names on any node); acceptance (`scripts/accept-iv-cut.mjs`) adds the wallet inside the board, white and dim prices, the ring and "+1", the backdrop click, Sleep absent before Cryo I and present after, Go up's one text, and a scout hover with no "%" lying on no caption.

## v1.70.0 - 2026-10-03 (the end of the war, with feeling)

### Chapter III, batch 5: Ola's playtest of v1.65 to v1.68 (B206 to B209)

- **Nothing to strike, said plainly (B206).** With every military structure of theirs down, the crosshair shows the factory icon and "military structures destroyed" (it said "rebuilding…", and Ola kept hitting it while their people walked about). The war room says it once per silence: "Interior: their military structures are destroyed. We do not bomb their homes. They are rebuilding." Their houses and their store are still never targets.
- **Nobody stands in the water (B207).** Since the islands grew, the coast road ran out over the water where the coast curves in (the corners), and so did the outermost streets. The coast road, the streets, the guards, the air defence posts and their watchmen are now kept 8 px inside the island's own coast (the vertices islands.js draws; read, not changed). A boat comes in to just off the shoreline and the party wades ashore there and walks in to the road. Checked headless at 1440 and 1024 px: no guard, walker or watchman outside the grey island in 30 samples each, with guards on all four coasts.
- **The end of the war, with feeling (B208).** From doomsday 55 % (when their rocket starts) the war room speaks of the climate, one line at a time: "the enemy is being destroyed. So is the climate.", "frigid winds sweep the surface of the earth.", "the lands are becoming less fertile.", then "Intel: the enemy is building a vast spaceship." (without intel: "something vast is being built on their island"). At least 24 s and 6 points of doomsday apart; while a line is fresh (20 s) the background lines wait (a control opening, radar calls, doom statuses, a plate that stood), then come out one a second; a radar call that waited is dropped. The leaving is spaced out on the war's own clock, so a reload resumes it: the withdrawal, the rocket, a pause, "Our scientists have declared the surface uninhabitable...", 10 s, "We have not had the resources to do the same.", 8 s, "But there is a secret plan.", 6 s, "Go deep.", 6 s, and only then the shovel arrives. The IV card after the gather is slower: a rest, IV, a rest, THE DEEP, a 7 s hold (a click ends it); the descent is unchanged. A save from before this version that was already at the end goes straight to the shovel.
- **The facility that goes down (B209).** The plate they walk into is now the building that stands above ground in chapter IV, seen from above: a light plate, the rock-dark hatch with a plate-coloured bar across it, a little mast with a glowing tube (the only light), an exhaust with three small puffs. It arrives with "Go deep." over two seconds.
- No rule changed: `node scripts/sim-phase3.mjs 1 --quiet` prints the same line before and after (war.js untouched).
## v1.69.0 - 2026-10-03 (chapter IV, sound)

### Chapter IV has its sound (B238)

Lifted from the sound board Ola approved (docs/mockups/sound-board-deep.html) into `src/phase4/sound.js`, hung on the shared graph of src/audio.js (its buses, the Sound and Music choices in the menu, the first-click unlocking). No game rule changed: index.js only tells the sound what it already knew.

- **Awake:** the machine is the tempo (a clack a throw from the drive that stands the arms, a pling on a win, pitch drooping and limping when starved, a whirr when fed), the cable hum on low D and A, drips, a thin murmur that grows with the people.
- **Asleep:** the same world under water (one low-pass, one slow compressor), the pulse gone. The roll of the years rises a pentatonic step per cryo tier, the lamps are sparse tones (one per automated room), the Watcher is a held D that sinks up to 85 cents flat with the meter and beats against a true pilot; a snap is the thunk and the tone jumping true. Waking fades it back over about a second and a half.
- **Surface:** every typed letter a struck-metal tick a quarter tone outside the scale, metallic breaks at the spaces. As the biological steps are bought the metal comes into tune and the blood comes in, a low rush with a heartbeat on the machine's two pounds a bar, until it is the pulse and the clack has gone.
- **Words:** thunk on a purchase (wet when the tissue is whole), rise when Surface opens a node, knock on an alarm and on a reboot, lucky on a win against Surface, boom once at a new descent, the two endings (go up: the murmur climbs and leaves the low D alone; the body whole: every voice on the same low D, the heart under it).
- **Hand-over from III:** the chapter starts with only the low D of the hum; the rest opens when the chapter card has gone.
- Silent when paused or hidden; Sound and Music behave as in the other chapters. Measured with the board's own act offline: peak -2.9 dBFS, RMS -22.9 (the board: -3.7 and -22.8), within a dB in every five seconds.
- Open for the coordinator: the IV card still plays chapter I's swell from `goDeep` in src/phase2/index.js; it needs `silent: true` there (B239).

## v1.68.0 - 2026-10-03 (the war has sound)

### Chapter III's sound, from sound board 2 (B204)

The war from `docs/mockups/sound-board-war-2.html` (approved in direction), now in the game. New `src/audio-war.js` on the same graph, switches and first-click unlocking as chapters I and II (`audio.graph()`); score in `docs/superpowers/specs/2026-10-02-score-sheet.md`, section 4.

- **Their drum is the clock.** One bar is the time to their next departure, phase-locked to the game's own numbers once a second (`war.set` from the end of warTick): slow early, tighter late, sixteen strokes on a push and in the last bars. It takes over from the II → III set piece as its bass fades (24 s after the swords): their drum and our bass alone.
- **Layers arrive with the controls, one at a time.** The organ with the first shield or sword (one voice per plate: a razed plate is a hole), the arms factory with the strike (soft machine toward stars, hammered metal toward hammers), folk life with the ◆, the doomsday drone from the first landing (D gliding to E♭), our drum with the laboratory (answers when we lead, alternates when level, one hit behind), shells from their tier V. The bass drops to the low A while a plate lies razed.
- **Words on the grid, never late for the rule.** A creak as their boat leaves, the far detonation on the landing, the held breath and the fall when a plate goes (lower for a district), the tear when our boat casts off and the far thud when it lands, a dull impact and a low tone for their tile, struck metal for shield, sword and air defence, the ◆, the three rising notes (one rise for a burst of buttons), a knock when hammers are short, a metallic rise for a new weapon. The radar ticks the last four seconds toward the coast that will be hit; a salvo whistles down and air defence cracks it.
- **Three silences.** The raiding party: two dry ticks, their drum stops for twenty seconds and everything holds its breath (-6 dB, a dry room) until the beat it returns. The silent island: their last stroke falls and the drum is gone; it comes back heavier and a step lower. The first nuclear blow and the rocket are booms.
- **The ending.** From 55 % the rocket rumbles and crackles; as they withdraw the drum tightens and rises; at ignition a nine-second ramp swallows everything, then three seconds of true silence on every bus, then the drone alone on E♭, very quiet. At the hatch the IV card (now silent) takes the E♭ and lets it fall two octaves to D over ten seconds, into IV's own low D.
- Paused or hidden: silent. Our strike tells its phases (`launchStrike` got `onPhase`, as the raid has).
- **Levels** (offline, the shared master and compressor): the first 60 s of the war peak -4.0 dBFS, RMS -16.5; a dense late minute -3.6, RMS -17.4; the ending -3.3 at the ramp's end, the cut measured at digital silence. Sim unchanged (war.js untouched).
## v1.67.1 - 2026-10-03 (chapter II, the raid when played through)

Ola played chapter II through (not from a checkpoint): the raid came with no boat and no pier, the watchmen stood on the shore and then crossed the water on foot, the pier reached our island, and their defence looked like a line.

- **No raid before the shipyard.** The city was complete before the neighbour had built its shipyard, so the raid started with an invisible pier and an invisible boat (they only exist from stage 5). The raid now waits for the shipyard.
- **The first pair of raiders was invisible** ashore (a counting slip: the ones without a boarding delay never stepped off the boat). Fixed; the boat's crew count is right again.
- **The pier is shorter** (64 px, was 86) and there is more water between the islands (176 px between the grids), so the pier ends in the water and the boat lies off it, not on our beach.
- **Their fortification is a tone, not a band.** The island itself hardens (a shade darker at stage 3, darker again at 4) instead of a band inside the shore that read as an outline.

## v1.67.0 - 2026-10-03 (chapter IV, the overnight fixes)

### Chapter IV: the overnight playtest of v1.66.0, fixed (B230 to B237)

docs/playtests/2026-10-03-chapter-iv-overnight.md, in the order it asked.

- **Cryo I shows its whole road.** The tree's node and the sleep pill's caption list everything at once, a tick on each part done: "Cryo I needs: generators automated ✓, farms automated, mines automated, 15 k ★". Later tiers add what the sleep still meets (more ore, spare power, food) before the price. The goalpost no longer moves.
- **Balances in the tree.** The tree's top edge shows ore and stars with their flow, asleep the capacity, live. Every node's effect line carries before and after numbers from a dry run on a copy: "Automation output ×3: ore 576 → 1 728 a day", "Sleepers eat nothing: food 563 d → ∞ while asleep", "Doubles every mine: ore 12 → 24 a day, ★ 81 → 73 a day".
- **People taken stay gone.** A biological step takes its people and their share of the beds, for good: the sector's dormitories belong to the body. The colony mourns them. The red delta on the H bar now matches a count that stays lower; the ledger says how many beds went to the body.
- **The madness is felt.** The base softens from the first points under 80, more as it falls. Under 50 the Watcher's letters drift and the year's digits stutter; under 35 the "next:" line loses or repeats a word, as the wake lines do. The sector choice is the one demand: no Surface game and no lamps while it waits, and the meter holds while the player chooses.
- **Small fixes.** The machine's hover says the games: "The machine plays 243 games a day on 1 energy. Each win is a star: +81/d." "Cryo II can be bought" (not "is ready"), said once. A wake line is not repeated in the feed under the advisor. At Cryo I and II a sleep nothing else ends wakes after 90 s: "Woke: a look at the colony." The TREE button answers through the walk into the hall.
- **Acceptance** (scripts/accept-iv-cut.mjs): the road at once, the balances, a gift's arrow with two numbers, people and beds still lower 10 s after a seal, the TREE button 0.5 s after Sleep, no second demand while a sector is chosen, the meter holding, the letters drifting at 20.
- Sims: plain 24m47s (unchanged), --watcher 27m40s to 27m26s.

## v1.66.0 - 2026-10-03 (chapter IV, focus in the night)

### Chapter IV: focus in the night (step 3b, from Ola's playtest of v1.61.0)

"I like the contact with the Surface, but it is a bit fragmented now." (B196 to B199)

- **The night strips the screen.** Pressing Sleep fades the awake chrome out over 1.5 s: the four bars and their flows, the BUILD buttons, the group words, the scout and way-up pills, the counters' rates, the build queue and the advisor's feed. What stays is the year (larger), the Watcher, Surface when it visits, the wake pill, the TREE button (gifts can still be bought) and the reset view, over the dark colony and its lamps. Nothing that stays moves. Waking fades it all back. While the body takes its people, the H bar alone comes up for the drop.
- **Surface's visit is a sequence.** Its line types itself alone; a second after the last letter the rock, paper, scissors game appears under it, as the reply. The won words of the sentence show only after a win, as its reward; between visits the sentence is in the tree's night log.
- **Is it broken or slow?** The night log ends with what the next night waits for: "next: after Cryo III", "next: Surface comes when you sleep again", "next: Surface speaks in 3 sleeps (sooner if you win its game)", "next: nothing more from the Surface", later "next: the body". A wake that brought no night, with one still to come, says the same line once for 5 s after the alarm line. Under the Watcher one quiet line: "night 3 of 6", then "the question is open", then "the body 1 of 4".
- **Acceptance** (scripts/accept-iv-cut.mjs, section N): from "IV · cryo I", 2 s into a sleep the bars, BUILD and the queue are hidden and back within 2 s of the wake; a forced night's game is absent while the line types and there after it, under it; the tree's log ends with "next: after Cryo II"; a wake with no night says it after the alarm line.

## v1.65.0 - 2026-10-03 (chapter II has sound)

### The city's sound, as Ola approved it on the board

The sounds from `docs/mockups/sound-board-city.html` (mockup 3), now in the game (B190). Same graph, same Sound/Music switches and same first-click unlocking as chapter I (`audio.graph()`, `audio.wake()` from the TRIVIAL session). New `src/audio-city.js`.

- **The city.** A heavy, calm bass far back every 6.5 seconds, the chord round of chapter I. Slow tones that drag themselves into the chord, more of them with more people, glassier with taller houses and more research. The factory from chapter I heard over the roofs, in time with the wave on its tile. Life: short voices and small steps, a far choir in a large city. Traffic once there are cars, a quick light pattern once there are computers. The silo is the heart: it weakens below 30 %, and an empty silo knocks (once per hunger) and makes the tones sag.
- **The neighbour, from wow to dread.** Their factory answers ours with a bright chime; they build (wood); then the chime stops, the building sounds turn to metal, a drum answers halfway between our bass hits, the chords darken one at a time (F → Gm, B♭ → E♭, C → A major), a thin note chafes at the top and the people go quiet.
- **The raid follows the boat**: the people hush and a tone climbs while they muster and cross (oars), footfalls as they come ashore, the boom and the fall as the house goes, the city holds its breath on one thin note, and comes back when the boat has left.
- **The change to III · WAR**: everything in the city falls away at once and one C♯ hangs; three drum strokes as III stands on the card; the heaviest boom on WAR; silence; their drum alone, and our bass under it when the card lifts. The card itself is silent (the set piece carries it).
- **Words by material.** Every purchase begins with chapter I's thunk; then wood for building, levelling up and selling, glass for research, metal for industry (tool case, car, computer, superconductor), grain for food (stall, crop, hand harvest), earth for land. "Something new" (a button arriving) is chapter I's three notes.
- Paused or hidden: silent. The war has no city music (the WAR session's own sound follows).
- **More water between the islands** (B203): the strait is 62 px wide instead of 14, so the piers end in the water and the boats lie off the beaches, not on them.
## v1.64.0 - 2026-10-03 (chapter III, war by boat)

### Landings and strikes sail, guards meet them on the beach, controls arrive with effect

Ola: "mer verkligt, mer känsla". The war now moves like the neighbour's raid in II (B200 to B203).

- **Their landings come by boat.** When a landing is sighted the party walks from the tiles nearest their pier to the coast road beside it; at the end of the four-second warning the boat casts off ("Radar: their boat has left the pier ..."), sails the water lanes round our island to the beach nearest the plate (5 to 9 s, longer with distance), they go ashore in pairs and walk the streets to the plate. The impact resolves as before. Push waves fill a bigger hull. One boat: a second landing waits on the pier until the boat is home. A landing whose plate falls before it sails walks back into town.
- **Our strikes come by boat.** The war builds our own pier on the south coast near the south-west corner. A strike gathers at it from the nearest plates, sails to the shore of their island nearest the tile, goes ashore, and their watchmen and people meet it on their beach. The survivors walk back, sail home and go indoors; the force counter shows them only when they are back (the rule gave them back at the impact, as before).
- **The guards meet the landing on the beach.** As the boat casts off, the nearest guards walk the coast to the beach it is heading for and stand there; the fight starts at the first step ashore, and the losses the rule scripts fall on the beach and the first street. The guards walk back to their posts afterwards.
- **Drawn out.** The first landing of the war sails at the slow end (9 s) and its blow waits one second after the party reaches the plate. After it, three seconds of nothing new before the ◆ arrives. Every war control that opens arrives with the same pop as the swords (the ◆ on the plates too), with its war-room line; the reveal order and its six-second gap are unchanged.
- **Unchanged:** the rules (`src/phase3/war.js` untouched, `sim-phase3.mjs 1` prints the same line), air waves and ranged strikes as arcs, air defence, the raid in II, regroup, rocket, doomsday, pause, the descent.
- Tests: rounded courses keep their ends and cut their corners, a course is eased with a heading along it, a crossing takes 5 to 9 s.

## v1.63.0 - 2026-10-03 (chapter IV, the machine)

### Chapter IV: the machine (step 3 of the tree and bio design)

Built from docs/superpowers/specs/2026-10-02-chapter-iv-tree-and-bio.md, section 4, look per docs/mockups/deep-machine-12.html (B187, B188, B189, B192 to B195).

- **The machine on top.** The rock, paper, scissors machine stands in 3D on its own plate on top of the colony, in a room of its own over the lid (a short neck from the hatch, no walls): a hub on a bolted deck, three arms ending in bare picture tubes in steel cages (gem, file, scissors on their faces), a fixed tube on a mast showing what it plays against, meshing gears, a flywheel with spokes and a chain, pistons that throw the arms, a heat sink and an exhaust that puffs smoke. Steel is the one metal accent. Armoured cables with the energy pulse inside climb from the lid into its base. The floating glyph on the lid is gone. The straight shaft to the crust is gone too: a hand-hewn, uneven passage climbs from the machine's plate out through the crust to the side, and scouts and the ascent take it; the survival ring stands over its mouth.
- **Stars are its wins.** The machine is fed a share of the spare energy (the E column); the energy fed buys games on a concave curve, one game in three is a win, each win a star. The smallest column no longer sets the stars (the dot keeps its days-of-cover meaning). The POWER branch's "The machine: feed" has its rule: eight levels, each raising the share it may draw (6 % unfed, 99 % at the top), bought with stars, awake or asleep.
- **What it shows.** Its tempo is the stars a day: starved, the arms hang, it throws slowly, the smoke thins and the tubes dim; fed, it runs toward a blur, the cable pulses race, sparks fly on a win and a small star rises. Hover: "The machine plays. N energy a day. Each win is a star." Asleep it keeps running, slower and quieter unless fed, its lamp in the automated rooms' rhythm.
- **Balance** (scripts/sim-phase4.mjs): the scripted player feeds the machine on the tree when a level pays for itself within 90 s. Plain run 24m44s before, 24m47s after (seeds 2 to 5: 24m44s to 24m56s); --watcher biological ending 28m19s before, 27m40s after. The longest stall at zero stars a day is gone (76 s before). `stars/day curve` prints when the rate first reaches each power of ten.
- **Save**: schema 8. An old save is given the feed its cryo tier implies, so its stars a day do not fall away.
- **Acceptance** (scripts/accept-iv-cut.mjs, section M): from "IV · the deep" the machine stands on top in the home view, the old glyph is gone, its hover reads the live energy, and the stars a day and its tempo follow `debug_deep('feed', n)`.

## v1.62.0 - 2026-10-03 (chapter II, the neighbour)

### The neighbour settles, fortifies, builds a shipyard, and comes by boat

Ola on mockup 2 (`docs/mockups/neighbour-2.html`): "precis så där". Design: `docs/superpowers/specs/2026-10-02-neighbour-design.md` (B191).

- **The islands hold their houses.** The coast's bumps only go outward and the islands have more margin, so no plate hangs over the water any more.
- **Their island is a town**, a 4 × 2 grid revealed one stage a minute as before: a house; then houses, a store and a factory; then a watchtower and a radar, and the coast hardens to a rampart; then a barracks, the factory shows an anvil and the rampart widens; then the shipyard, a pier and a boat.
- **Watchmen do what watchmen do.** From the fortification they walk their coast in pairs; from the barracks some stand on the shore that faces us; from the shipyard two wait by the pier. Nobody drills on a field. Their civilians stroll between the houses, fewer as the town turns to war.
- **The raid comes by boat.** The watchmen walk to the pier and board, the boat crosses to the beach nearest the house, they go ashore in pairs and up the street, stand on the house until it is razed, go back, and the boat sails home. Nobody walks on the water. Our people near the house hurry indoors and stay in until the boat has gone; we have no soldiers in this chapter.
- **A beat before the swords.** The house falls, the boat goes home, four seconds of nothing, and then the swords arrive with a pop. The card for III is drawn out like the card for II.
- **For the war** (unchanged for now): the five targets keep their classes and order (tower, radar, shipyard, barracks, factory), `onIsland`, `launchWave` and `launchStrike` are untouched, and the boat is a building block (`sailBoat`) the war can use for its landings.
- Tests: coast bumps never cut inward; the boat's course starts and ends where it should.

## v1.61.0 - 2026-10-02 (chapter IV, the voice in the night)

### Chapter IV: Surface's voice and gifts (step 2 of the tree and bio design)

Built from docs/superpowers/specs/2026-10-02-chapter-iv-tree-and-bio.md, section 2, look per mockup 12 tab "the voice" (B177, B178, B179, B182 to B186).

- **The voice in the night.** Surface's random lines are gone. It speaks a script, one line a night (a sleep in which it visits): "Everyone is sleeping, but us." and five more. The line types itself letter by letter (35 ms a letter) low in the dark, over the Watcher, in a larger, warmer mono than anything else, and stays until the colony wakes. Nothing on it can be clicked. Rock, paper, scissors with Surface is as it was and shares the screen with the line (one visit); the lamps never do.
- **Pacing.** A night comes when its gift can be used (it waits for the cryo tier: night 2 on Cryo II, 3 on III, 4 on IV, 5 and 6 on V) and one quiet visit (a game, no line) has passed since the last line. A win takes the quiet visit off: the next line comes one visit sooner. A loss does nothing extra. Night 1 gives nothing; it is the night the Watcher's label takes its name (it used to be a century of slept years).
- **The gifts.** Each of nights 2 to 6 opens one of Surface's nodes in the tree: its ring fills, it gets a price in stars, and buying it (awake or asleep) is a rule. Lossless relay: an automated room makes three times as much. Cold storage: sleepers eat nothing. Quiet hands: an automated room's upkeep stops growing with its levels (it draws and burns as at level 0). Long count: the tier past Cryo VII, a million years a second ("1 000 000 y/s", Cryo VIII), bought once Cryo VII stands. The question: opens BIOLOGICAL, which stays hidden until it is bought (a save that already owns a biological step keeps the branch). A node Surface has not opened says "Not ours to open." in the info box; an opened one quotes the line that opened it.
- **The night log** down the left edge of the tree: every line Surface has said, in order, in its warm mono, each tied by a thin dotted thread to the node it opened. After a night that opened a node the TREE button carries a small warm ring until the tree is looked at.
- **Balance** (scripts/sim-phase4.mjs): the scripted player now gets Surface's visits on the game's schedule, stays under for them, wins one game in three and buys every gift the moment it can be paid. Plain run 25m03s before, 24m44s after; --watcher biological ending 23m45s before, 28m19s after. Cryo IV to VII cost more (2e12, 2e14, 2e16, 2e18 to 1e13, 1e15, 3e17, 3e19); the gifts are as the design says. The player waits out the mourning in the plain run too (it was --watcher only; the old plain run moves 2 s with it). `--gifts` prints what a minute of play earns at each night.
- **Save**: schema 7. An old save starts at the night its Surface visits imply at its tier, with those nights' gifts opened (none bought) and its words kept.
- **Checkpoints**: "IV · Surface" has three lines said and Lossless relay and Cold storage bought; `debug_deep('night')` brings the next line now (night 4, Quiet hands). "IV · the body" has all six lines said and The question answered.
- **Acceptance** (scripts/accept-iv-cut.mjs): a forced night types and stays, wakes away, sits in the night log with its thread, and its gift is bought and changes the rule's output.

## v1.60.0 - 2026-10-02 (chapter IV, the skill tree)

### Chapter IV: the skill tree, mechanical state (step 1 of the tree and bio design)

Ola, 2026-10-02: a skill tree, a mechanic the game has not had; mechanical and square; some nodes many levels, some single; branches unlock branches; some greyed for a long time that only Surface can open. Built from docs/superpowers/specs/2026-10-02-chapter-iv-tree-and-bio.md, look per mockup 10 (B170 to B173).

- **One button, TREE, in the column** where the GROW group was. It opens a full-screen dark panel over the dimmed colony: a circuit board with square nodes, traces at right angles, mono labels and level pips; bought nodes are filled plates, what can be bought is outlined bright, locked is dim, and Surface's nodes are dashed with a hollow ring and no price ("not ours to open"). Escape or the same button closes it; the game keeps ticking underneath, awake or asleep. A badge on the button counts what can be bought right now.
- **One fixed info box under the board**, no floating tooltips: the node's name in capitals, its level, the next price, what it does, and either how long until it is affordable or why it is locked, in plain words.
- **Hover life**: the trace from the root to the node lights in order, the node lifts a pixel, its pips tick once. A click buys one level; shift-click as many as can be paid.
- **Everything the old buttons sold is in the tree, at the same prices and with the same effects**: Seam, Yield, Output and Beds are the room types' levels; Drill, Farm and Generator automation and Creche are their automation; Cryo I to VII a chain with the same gates and reasons; the Watcher's eight SYSTEM and HARDWARE steps a branch that appears after the first sleep; the four biological steps a plain branch after them, still asking for a sector. A level or an automation is still an order in the build queue with its ring.
- **Gone**: the level and automate buttons, the longer-sleep button, the Watcher's pill and its three-tick line. A biological step waiting for its sector says so in one line under the stability meter. Before the hall, the sleep pill reads "Sleep", "needs Cryo I", and a click opens the tree.
- **The way up**: the early attempt is gone. The button is a greyed teaser, "survival 85 % needed", until the colony's own estimate reaches 85; then it opens, as before.
- **Not built yet, shown locked**: Deep seam, Hydroponics, Hands and The machine: feed (no rule behind them yet), and Surface's five nodes (step 2).
- **Save**: schema 6. Old saves keep every level, automation, cryo tier and Watcher step; the tree reads them where they always were.
- **Balance**: the simulation and the scripted player buy through the tree. Bought that way the runs are byte-identical, except that the simulated player now digs the cryo hall's own chamber, as the game always did: 25m03s to the ring (was 26m26s), the biological ending at 23m45s (was 26m04s).

## v1.59.5 - 2026-10-02 (chapter I, narrow windows)

### The star tracker counts instead of drawing when there is no room

Ola, with a screenshot of a 700 px window where the crowns, the gem slots and the star dots lay on top of the factory: on smaller screens show a symbol and a number, like ★ ×56 (B181).

- **Compact tracker.** When there is less than 240 px beside the boards the tracker becomes one row: crown ×36, gem ×6, star ×2 (only the kinds you have, the star always). It sits in the band above the boards, so it never covers them. With room beside the boards the drawn tracker is back; it switches as the window is resized or a board is added.
- The first five stars under the board are unchanged.
- `trackerParts()` in rates.js (tested), `compact` option in `renderWinTracker`.
- This is chapter I only. The wider question of small screens in the other chapters is still open.

## v1.59.4 - 2026-10-02 (sound, the end of chapter I)

### The lightning is a boom

Ola: the lightning button at the end, the one that is clicked twice, should not go bling bling bling but boooom, building up toward the end (B180).

- **Collapsing the foam is a boom**: a low note that falls to a sub note, a rumble under it, a crack at the very start and a long tail in the room. The music steps back under it and comes back. (It was the three rising notes used for "something new".)
- **The second boom is heavier**: lower, longer and a little louder. It is the one that opens the bank, so the chapter builds toward its last note.
- The sound board has both: "Bom (blixten, första)" and "Bom (blixten, andra)".

## v1.59.3 - 2026-10-02 (sound, the end of chapter I)

### The music ends on one note

Ola: when the chapter ends the music should stop, all but one note that is struck and fades to silence under the CAPITAL text or just before (B169).

- **At the bank** everything in the music falls away at once and a single note is struck: D, the key's own note. It rings out over about seven seconds, so it is gone as CAPITAL stands on the card.
- **Nothing else sounds there**: no purchase thunk on the bank and no swell on this card. With music switched off the card keeps its usual swell.
- The machine stays silent for the rest of the chapter's last seconds and may play again when a chapter I begins (`audio.finale()`, `audio.begin()`; `playChapterCard` has a `silent` option).
- The sound board has a button for it: "Aktens slut (sista tonen)".
- The code went out one commit earlier (d198d19) still marked v1.59.2; this entry and the version number follow it.

## v1.59.2 - 2026-10-02 (sound, chapter I)

### The music creeps in instead of taking steps

Ola, after playing v1.59.0: the music has a couple of big, clear steps at certain speeds; could they come sneaking instead (B168).

- **No layer switches on any more.** Every layer has a stretch of speed over which it comes in: the heartbeat between 1 and 3 games a second, the tick between 2 and 6, the bass between 6 and 14 (and darker while it is quiet), the shimmer between 3 and 8 wins a second, its sixteenths between 12 and 30, its reach up the scale between 15 and 80, its octave lifts between 60 and 200.
- **What is heard glides in time too.** The game itself jumps, from 2.6 to 10 games a second at speed ten, and doubles with a new board. The tempo now follows over a few seconds, and a layer takes about three seconds to come in (and under one to leave, so an empty battery is still felt). Measured at the jump to speed ten: the notes per second rise over about eight seconds instead of at once.
- **Single plings and the shimmer cross-fade**: the plings grow quieter as the shimmer comes in, instead of stopping at a limit.
- **A start is quiet**: after a pause or an empty battery the layers come back from nothing.
- Rules in `src/audio.js`: `intensitiesFor` (replaces `layersFor`), `ramp`, `approach`; tested for having no steps.

## v1.59.1 - 2026-10-02 (chapter II, polish)

### Things arrive, they do not clunk in

- **The rings stand still when an upgrade opens** (B165). Buying the research that lets houses be levelled up used to rebuild every plate, and every ring ran a lap from empty. Now the "+" is added to the plate as it stands and the buttons arrive one after another. A ring is also drawn where it stands whenever a plate is rendered again (built, upgraded, fortified).
- **The minus is small and cannot be hit by mistake** (B166). It is 16 px (was 24), tucked into the corner, and with a mouse it is exactly as big as it looks. Before, its enlarged click target reached in under the neighbouring house's "+", invisible, so a click on the left part of a plus sold the house beside it. The plus always lies on top. Touch keeps the large target and its two taps.
- **The counters count at an even pace** (B167). Stars and science move once a second in the rules; the display now glides from the last second's value to this one's instead of rushing and resting. It never shows more than you have. The rings of the houses fill over the whole second in the same way.
- **New things arrive softly**: a plate that is built or upgraded settles in, and a button that appears in the right-hand column (research, the market stall) pops in like the house and store buttons do. A button that arrives greyed out stays grey.

## v1.59.0 - 2026-10-02 (sound, chapter I)

### The game has sound

The sounds Ola approved on the sound board (`docs/mockups/sound-board.html`), now in chapter I, to be judged over a whole playthrough (B162). Everything is synthesised in the browser; there are no sound files.

- **Words.** A click on the hand buttons, auto and recharge; a pling on a win (wins within a few seconds of each other climb the scale); a thunk on a purchase; three rising notes when something new appears, when the factory is built and when the foam collapses; two quick notes on the clover; two knocks when the energy runs out; a swell on every chapter card (lower and longer on the dark ones).
- **The machine.** While auto runs the music follows the game: a heartbeat from 3 games a second, a bass from 10, and a shimmer instead of single plings when wins come closer than five a second. The tempo goes from 58 to 128 beats a minute with the speed. The heart weakens when less than five seconds of energy is left and is nearly silent when it is gone. The generator hums, every board adds a voice.
- **It stops** when the game is paused, when the tab is hidden and when the chapter ends.
- **☰ menu**: Sound on/off and Music on/off, saved (`rpi-audio`). Both are on from the start; the browser allows no sound before the first click.
- New `src/audio.js` (`audio.*`, and the tested rules `bpmFor`, `layersFor`, `pentaNote`, `readPrefs`). Chapters II to IV have no sounds of their own yet, only the chapter cards.

## v1.58.0 - 2026-10-02 (chapter I's end, and the factory in the city)

### The factory: boards all the way down

Direction C of `docs/mockups/factory-1.html`, chosen by Ola (B163).

- **The nine boards turn out to be tiles of a larger board.** When the factory is built the boards stay where they are and each becomes a board of nine games: 81 cells. A cell flickers when a game is played, goes dark with a star when it is won, and every few seconds a wave of wins crosses the whole thing. The conveyor belt, the yellow stars, the smoke and the small box are gone.
- **Building it**: the cells arrive from the middle outward.
- **Collapsing the foam** shows as a wave of wins from the middle (was: the box popped).
- **It runs on the game's own loop**, so it stands still when the game is paused.
- **The hand buttons step back in the factory too.**
- **The factory in the city** (chapter II) is one tile of the same thing: a small board of nine cells that a win crosses as a diagonal wave. The little conveyor there is gone as well.
- **Fix**: the star tracker's hundred gem placeholders no longer widen into the boards when there are five gems or fewer.
- New `src/phase1/factory-view.js` (`createFactoryView`, `cellPosition`), tested in `factory-view.test.js`.

## v1.57.0 - 2026-10-02 (chapter I → II)

### The change to CAPITAL takes its time, and the city opens

- **The card is drawn out.** Fade to white, a rest, II, a rest, CAPITAL, a long hold, then the fade to the city: about eleven seconds instead of two. A click during the hold moves on. (`playChapterCard` has a new `pause` option for slow cards.)
- **A new city begins with only the factory and the bank.** When the card has lifted the eight empty plots open one after another, and then the choice to build a house arrives with a soft pop. Nothing can be built before that.
- **The store comes when the food starts to run low**: its button arrives when the supplies fall below 100 (they start at 150), which is a few seconds after the first people have moved in. A city that is already lived in, and every older save, has plots, house and store as before.
- **Simulation**: `scripts/sim-phase2.mjs` knows about the store's condition; the timeline is unchanged (WAR at 19:13).
- The factory's own graphics, here and at the end of chapter I, are B163: three directions in `docs/mockups/factory-1.html`.

## v1.56.0 - 2026-10-02 (chapter I)

### One big battery is a full big battery

- **A purchase fills the big battery completely** (1 500 energy, was a pack of 500 that could be topped up three times). At 22 energy a second the first one now lasts 38 seconds instead of 15.
- **The big battery's bar has the small one's colour**, only thicker and taller as before.
- **A full battery cannot be charged.** The big battery's button is greyed while the bar is full, and the recharge button while the small tank is full, so no star is spent on nothing.
- **Simulation**: big battery 5:39, then 38, 18, 14 and 9 seconds between purchases, generator 6:58, bank 12:16 (lazy); 4:05, 5:24, 10:42 (fiddler).

## v1.55.1 - 2026-10-02 (chapter I)

### The board fits the window

- **The controls never leave the window.** In a desktop window lower than about 900 px the board stayed as tall as the column was wide (640 px) and pushed rock, paper, scissors, recharge and auto-play below the edge, where the page cannot scroll. The board now takes the smaller of the width and the height that is left: 544 px at 1280x800 and 444 px at 1280x700, 640 px as before at 1280x960. Still square and centred.
- **The grids too.** Two, four and up to nine boards size from the grid's shape (`--board-cols` and `--board-rows`, set in `adjustBoardLayout()`), so nine boards are 171 px each at 1280x800 and 137 px at 1280x700, a tight grid in the middle. The factory's box shrinks the same way in a very low window.
- **Phones are unchanged** where the width is the limit (375x812 with 1, 2 and 5 boards and the factory measured the same to the pixel). One case moves: nine boards on a 375x812 phone used to push the controls 4 px past the bottom edge; the boards are now 180 px tall instead of 192 and everything fits.
- How: `#game-board-container` is a size container (`container-type: size`, `min-height: 0`) and a board's width is `min()` of its share of `100cqw` and `100cqh`, in style.css. Browsers without container units keep the old layout. The board lost `transition-all`, which animated nothing before but would now animate every resize.
- **The five first stars** (v1.55.0) sit in the strip between the board and the buttons and keep 28 px to both, also when the board fills the height.
- Backlog B156.

## v1.55.0 - 2026-10-02 (chapter I, after Ola's playtest of v1.54.0)

### The first five stars, the clover in the row, the battery when it is needed

- **The first five stars lie big under the board.** Five large empty slots sit between the board and the player's buttons from the start. A star that is won lands in its slot. After the fifth the next five slots plop in, one after another, and the whole row glides up to its corner and shrinks to the size it has always had. The yellow star that flew across the screen is gone (`star-animation.js` removed): nothing else in the game is yellow or flies.
- **The little clover sits in the player's row, right of auto**, and looks like the other buttons there (it looked greyed out although it should be clicked). No green: while its luck runs the button sits pressed in, like auto when it is on, and a dark ring around it drains. Beside the stars-per-second a small clover with an arrow up shows for as long as the luck lasts, so it is plain what the click does.
- **The hand buttons step back while the machine plays.** Rock, paper and scissors shrink (animated) and go grey and cannot be clicked while auto runs; they come back when it stops (no energy, or auto switched off).
- **The big battery arrives when it is needed**: when the machines eat 22 energy a second (was: after six recharge clicks, which a player filling the tank reaches at once). Once bought it stays. The generator still arrives after five big batteries.
- **The big battery's bar grows in** beside the small one when the first big battery is bought, instead of just being there.
- **Simulation** (`node scripts/sim-phase1.mjs`, a hand now clicks recharge at most once a second). Lazy: big battery 5:39, generator 6:25, bank 12:20, 34 recharge clicks. Fiddler: 4:05, 4:51, 10:46. The big batteries last 15, 13, 11 and 7 seconds.

## v1.54.0 - 2026-10-02 (chapter III → IV)

### The gate before THE DEEP

- **The player chooses.** At the end of the war a click on the shovel no longer starts the descent at once. A black gate asks first: "IV · THE DEEP · Unfinished. Continue at your own peril." with two answers, **Go deep** and **Stay**. Stay (or Escape) closes the gate and leaves the end of the war as it is; the shovel can be clicked again. Go deep runs the descent as before. Asked before anything irreversible (the hatch, the people leaving). A save that already chose the way down still goes straight down.
- Rules in the new `src/deepGate.js` (`askDeepGate()`), tested in `deepGate.test.js`; markup `#deep-gate` in index.html, look `.deep-gate` in style.css.
- **New checkpoint** "III · war over, the shovel" (`iii-end`) in the debug menu's Jump to.

## v1.53.0 - 2026-10-02 (chapter I)

### The little clover and the energy ladder

Spec: docs/superpowers/specs/2026-10-02-clover-and-energy-ladder-design.md. Rule in vision.md: every helper is good, becomes a slog, and is made good again by an upgrade.

- **The little clover.** A small clover by the board, there as soon as auto-play is bought, free. A click is three seconds of luck (win rate 2/3); a click while it runs refills it, it never stacks. Green with a draining ring while it lasts. The big clover (the luck upgrade, unchanged) leaves it lit for good.
- **The energy ladder unlocks by use.** The big battery arrives after six recharge clicks (was 40★ earned) and costs 20★ (was 30★). The generator arrives after five big batteries (was 100★ earned). Before this the generator came about 90 seconds after the battery and the simulated player bought no batteries at all.
- **The big battery's bar** is hidden until the first big battery is bought.
- **Old saves** keep what they had: 40★ earned counts as the battery unlocked, 100★ as the generator.
- **Simulation**: `node scripts/sim-phase1.mjs` now plays a lazy player and one who fiddles with the clover. Lazy: big battery 3:20, generator 6:50, bank 12:54. Fiddler: 2:59, 4:52, 10:55. The first big battery lasts minutes, the ones after the speed-10 jump 27, 13 and 14 seconds, then the generator. The v1.19.2 "old" mode is gone from the script.

## v1.52.0 - 2026-09-28 (chapter IV, slice 9)

### The cut: sanity is the snap, biological is a choice you can see, one voice at a time

The rest of docs/superpowers/specs/2026-09-28-chapter-iv-reduction.md (items 1's tuning, 4 and 5, and the acceptance).

- **The snap is enough.** The drift is flatter, `DRIFT_PER_SECOND` 0.9, 1.0, 1.05, 1.1, 1.15, 1.2, 1.3 a real second at Cryo I to VII (was 0.5 to 2.2). A snap now gives back 4.5 seconds of the tier's drift (`SNAP_COVERS`), times 1 + 6 x the share of the meter that is gone (`SNAP_SOFT_BONUS`): the softer the base, the harder it snaps back. So it scales with the tier and the meter finds its own level. Deep read: half as much again (`SNAP_DEEP` 1.5; was +10 for +5). The cooldown stays 4 s. Numbers (25 s sleeps, 20 s awake between, from a full meter, each tier on its own): a click every 12 s holds 71 to 89 at every tier (every 10 s: 78 to 93; every 15 s: 60 to 83); no clicks reboots in sleep 5 at Cryo I, 4 at II to VI, 3 at VII.
- **The sim shows both**: "watcher (unattended ...)" gains the per-tier reboot sleep, and a new line "watcher (attentive: snap every 12 s)" keeps a second Watcher through the same run (stability 85 at the end, lowest 82, no reboots) and prints the per-tier band. The plain run and `--watcher` are unchanged, byte for byte in their first lines (26m26s to year 802 701; 26m04s to the last wake-up).
- **Biological is a choice.** Buying a biological step pays its capacity and stars and then asks: the pill reads "Choose a sector to seal", the arms that can still be taken glow softly warm (the colour they will turn), the one under the cursor more, and the cursor is a crosshair. A click on any plate of an arm seals THAT sector: it turns warm and breathes, its walkers leave (dots walk in to the shaft and fade over 2 s), and the people it takes fall off the H bar with a red delta ("-1.4 k") that fades while the number rolls down. Escape puts the choice away and refunds nothing: the step waits and the pill keeps asking (a click on it asks again, also after a wake). A sealed plate says "part of the body" under the cursor. Rules in watcher.js (`sealCandidates`, `sealSector`, `w.sealing`, `buyStep(..., { choose })`); the simulation still lets the body pick (`nextSector`).
- **The Watcher grows.** Its glyph changes with each biological step: a dot, a dot with a ring, a soft blob, a blob with a rim (CSS shapes, warm, `bodyGlyph()`).
- **One voice at a time.** Asleep the advisor line is quiet and the feed shows only its last line (the first sleep's "Something stayed awake while they slept." is that line now); awake the feed shows three. The line of what woke the colony stays six seconds, then the advisor says where we stand again (the feed keeps it). The wake-up strip shows for five seconds (was eight). Surface's results stay inside its card.
- `scripts/accept-iv-cut.mjs`: the acceptance, in headless Chrome over the DevTools protocol, no dependencies. From "IV · Surface": 60 s asleep, a real click on a plate every 12 s, never two demand cards, stability never under 60 (lowest 68), one voice asleep, the alarm line and the strip gone on time. From "IV · the body": buy, choose, Escape, choose again, click an arm: its 15 plates sealed, 1 379 people gone (a tenth), the red delta, the walkers, the glyph class `is-dot`, the tooltip, no console errors. `--shots DIR` saves screenshots.
- Saves: no new schema; `normalizeWatcher` keeps a step waiting for its sector only when it is the next biological step.
- No em-dashes left in index.html (four aria-labels).

## v1.51.0 - 2026-09-28 (chapter IV, slice 8)

### Chapter IV UX: queue strip, button groups, the ladder you can see, lamp events, animated rock paper scissors

After Ola's playtest of v1.50.0, and aligned with the cut in docs/superpowers/specs/2026-09-28-chapter-iv-reduction.md (one demand on screen at a time).

- **The queue is a strip.** Orders sit in one mono line along the bottom of the window, under the chapter label: "dig ◔ · dig ○ · mine ○", each with its ring. It has its own place, so an order never moves a button (measured: the sleep button stands still through three orders and a take-back). It stays while the colony sleeps (an order waiting for the wake is dim). A click on an order takes it back and returns its price, which is the price the next order of that kind would cost without it (deep.js `cancelOrder`); a dig a waiting room counts on for its chamber cannot be taken back. Empty, the strip is not there.
- **Three groups in the right column**, each under a tiny mono word: BUILD (dig and the four rooms) and GROW (level, automate, the longer sleep) are round, products; ACT is wide pills with a word ("Sleep · 1 000 y/s", "Scout party", "Go up", "Wake"), so an action never looks like a room. Asleep, the longer-sleep button stays greyed where it is and the sun takes the sleep pill's place, so nothing jumps. Reset view stays alone at the bottom. The column fits a 900 px window (815 px at its fullest).
- **The ladder you can see.** Under the Watcher: one thin line with a tick for each rung (SYSTEM, HARDWARE, BIOLOGICAL) and a filled trail, the next rung named as a teaser, and ONE pill with the next step only: "HARDWARE · Sensor mast · 120 cap + 300 B ★" and under it what it does and takes, or what is missing ("needs 120 · 84 now"). When BIOLOGICAL opens the pill turns warm and leads with the people it takes ("BIOLOGICAL · Brain tissue, human grade · 1.4 k people"). The tooltip starts with the step's name in capitals. The advisor says one line when a rung opens: "The system is in. There is room for hardware now.", "The hardware is in. Something else is possible now." The capacity bar is gone from the Watcher; capacity is only ever shown inside the pill.
- **The riddles are gone; the lamps are an event.** At most once in two sleeps, never in the first, never while Surface is there: THE LAMPS (the indicator lamps on the automated rooms go still and blink a sequence, 3 to 7 long, longer as stability falls; the Watcher repeats it by clicking the rooms in the model, a wrong click ends it at -5, the whole sequence gives +15) or WHICH LAMP WENT OUT (all lit, one goes dark, find it within 3 s). Below stability 35 a lamp may blink once without being part of the answer; nothing says so. The lamps are chosen among those in view. Escape lets an event go; it also goes at the wake. Rules in watcher.js (`makeLampPuzzle`, `makeDarkPuzzle`, `pressLamp`, `expireLamps`, `demand`), tested in the new lamps.test.js; the lamps drawn in scene.js (`setLamps`, `slotAt`, `visibleSlots`).
- **One demand at a time.** Surface does not come while the lamps ask, and the lamps do not come while Surface is there (`demand()`).
- **Two steps do something new:** Deep read makes a snap +10 (was: a riddle +25); Second core makes the lamps give double, stability and stars (was: a second riddle card). Brain tissue now plays the lamps itself now and then.
- **Rock, paper, scissors, played out.** On a throw both fists shake for 0.6 s, Surface's hidden throw turns face up, the losing glyph cracks and fades, the winning one pulses once, and only then the line. A won word slides into the sentence letter by letter. CSS one-shots, no library.
- Saves: no new schema. A number riddle or a second card from an older save is let go; a lamp event comes back to be shown from the start.
- Sim: both lines unchanged, byte for byte (the plain run 26m26s to year 802 701; `--watcher` 26m04s to the last wake-up).

## v1.50.0 - 2026-09-28 (chapter IV, slice 7)

### Biological: the body takes the base, the colonists are the cost, the last wake-up

- **BIOLOGICAL**, four steps after HARDWARE on the Watcher's ladder, teased the same way: Brain tissue, human grade (an open riddle sometimes answers itself), Nervous system (the snap comes by itself when the base gives), Spinal cooling fluid (the drift halves again), Skin receptors (the sentence can be heard: Surface says it whole, "Come up. There is room for all of us."). Each costs capacity and stars and PEOPLE outright, a tenth to a quarter of the colony drawn from the dormitories ("Takes 1.4 k people."), and the body only grows in the dark: a step waits for 30 real seconds of sleep after the one before ("It is still growing.").
- **Confinement.** Each step seals a SECTOR of the base on every floor (the arm, the cell beyond it and its diagonal; the body takes the sector where most of them sleep). Its plates shift warm and a little darker and breathe slowly; nobody walks there; its rooms keep producing, part of the body now. The feed stays calm: "Sector 1 sealed for maintenance.", "Sector 2 sealed. Air handling." The wake-up strip shows the sectors with their own glyph.
- **The last wake-up.** When all four are bought, the next sleep ends and nobody wakes: "Woke: nobody came out." The count reads 0, the lanes are empty, the whole base breathes, the Watcher stays on screen and its label becomes the colony's name, the sentence's last word: US. The way-up button is the Watcher's alone ("Go up. There is nothing left to lose.", no odds): one amber dot climbs the shaft, the crust lightens, and the V · RETURN card plays as before. `ascended` is saved (with `ending: 'watcher'`). The old ending is untouched: a colony that never goes biological still goes up at survival 85 %.
- **The ring wakes once.** The sensor on the shaft wakes the colony the day the ring is reached, once; a colony that stays down after it (to grow the body) can sleep on. Without alarms the old sleep stops at the ring as before.
- Save schema 5 with a migration (no sector sealed, nobody gone). Checkpoint "IV · the body" (asleep at a thousand years a second, HARDWARE bought, pool full, enough of everything for the whole rung); `debug_deep('ladder')` also lets the body grow.
- Sim: the plain run unchanged, 26m26s to year 802 701 (seeds 1 to 5: 25m57s to 26m34s). `--watcher` now buys the whole ladder, plays Surface, stays down at the ring and ends at the last wake-up: 26m04s (seed 1; the ring at 22m09s, the player stayed down), seeds 1 to 5 between 23m32s and 26m51s, no hungry days. It prints both summary lines, the ladder's times, the biological ending and the ring.

## v1.49.0 - 2026-09-27 (chapter IV, slice 6)

### Surface in the dark, rock paper scissors, Watcher upgrades, build queue

Ola: "Queuing digging of rooms would be a nice QoL update. Automate building, to build while people are sleeping, so it does not stop when I click Cryo. But how much more is there? It feels like the whole development of madness is missing after the sleep starts."

- **The build queue.** Every buy button can be pressed again while its order is being built. The next order is paid at once, at the next price (a second dig costs the chamber after the first), and waits in its lane; a room also waits for a chamber, so "dig, mine, farm" can be ordered with no chamber free. A small mono list under the room buttons shows the orders, each with its own ring, at most eight. Asleep, the order under way finishes and the rest wait for the wake (drawn dim), until the Watcher has the **Scheduler**: then the queue runs while everyone sleeps, and no "the next one is paid for" alarm wakes them while orders remain. Rules in deep.js (`orderBuild`, `nextPrice`, `chambersAhead`, `buildEta`); the simulation's own orders land exactly as before.
- **Surface.** From the second sleep on, a few seconds in, rarely at first and from its fifth visit every sleep, something appears opposite the Watcher: a faint ring, SURFACE, one line, and three small buttons with chapter I's glyphs. It has already chosen. "Surface: paper. You: rock. It takes 3 stability." / "You: scissors. Surface: paper. It gives 8 capacity and a word." A win gives one word of a sentence revealed over many sleeps (never more words than the ladder's steps plus one, never the last). Its lines drift from "It is quiet up here." to "Why do you keep them cold?" to "You could come up alone.", and from its fifth visit it half the time throws what beat your last throw. It is gone the moment the colony wakes. Pure rules and tests in the new `src/phase4/surface.js`.
- **The Watcher's ladder.** Beside the Watcher, asleep only (and not in the first sleep), a column of glyphs: the steps bought, and the next one teased, greyed until it can be paid. SYSTEM: Watchdog (drift 25 % slower), Scheduler (the queue runs asleep), Deep read (a riddle gives +25), Night vision (alarms 10 % later). HARDWARE: Cooling (capacity pool twice as deep), Second core (two riddles open), Sensor mast (better scout odds, half the scatter), Reactor tap (three times the capacity). Each costs capacity and stars, climbing; from HARDWARE on also ore and a dormitory: the Watcher takes the last one dug, its plate shows a cpu glyph, the beds fall, and the feed says once "We needed the space."
- **Stability recovers awake** (Claude's decision for Ola): +2 per awake colony month, up to 100, so waking has a reason besides the alarms.
- Save schema 4 with a migration (an empty ladder, no Surface yet, no dormitory taken; orders already placed keep their days). Checkpoint "IV · Surface" (asleep at a century a second, SYSTEM and half of HARDWARE bought, the sentence half known, Surface due in seconds); `debug_deep('surface')` forces a visit, `debug_deep('ladder')` pays the next step.
- Sim: the plain run is unchanged, 26m26s to year 802 701, 88 wake-ups, no hungry days. Its unattended Watcher now rests awake: stability 10 at the end, lowest 10, no reboots (was 38, 1, 2). New `--watcher` player (buys the ladder as capacity comes, plays Surface, stays under up to 20 s for capacity, waits out mourning instead of buying farms): 24m08s to the ring, SYSTEM done at 10m25s, HARDWARE at 17m24s, four dormitories taken.

## v1.48.0 - 2026-09-23 (chapter IV, the overnight playtest)

### Cryo reachable, the first sleep teaches, the dot marks what runs low, weight to people, bugs

Fixes from the overnight playtest of v1.47.0 (docs/playtests/2026-09-23-chapter-iv-overnight.md).

- **Cryo I can be reached by following the game.** A locked cryo tier gives one reason, from one function (`cryoNeed()` in readout.js): the caption beside the snowflake is its short form ("needs generators automated"), the tooltip the same words and why ("Cryo I needs generators automated: asleep, nobody runs them."). An automation already ordered is never asked for again: the reason moves on to the next room type, then "ready in 12 d" while the orders are built, then the price. The automate and level buttons now sell what the next goal needs first (`offerFor()`): "Automate generators (so the colony can sleep).", then what runs low, then the weakest column ("Level farms (food limits the stars)."). The automate button shows as soon as cryo needs it, not only after a first level. The hall is dug with its own chamber, so "needs a free chamber" is gone. Automation I costs 10 k instead of 60 k and the hall 15 k instead of 40 k. The colony comes down with a mine in a fourth chamber: without one it burned its salvage from day one, and a player who built what the dot asked could end with no ore, no power and no way back. A scripted player who follows the dot and the captions (`src/phase4/policy.js`, tested) buys Cryo I at 286 s; in the browser, clicking the real buttons from iv-start, at 278 s.
- **The first sleep teaches, it does not punish.** No drift, no jolts from alarms and no riddle in the first sleep; the advisor says one line, "Something stayed awake while they slept.", and the sleep ends after a year on a plain alarm: "Woke: a year under the ice. Everyone is well." The drift starts with the second sleep, at half a point a second at Cryo I. No sleep opens on a riddle any more (half a gap first). The reboot line is said once, in the feed, never again in the advisor line above it.
- **Snap only on the model.** A click must land on a plate, a lane or a shaft (a raycast); a click on the black around it does nothing. The crosshair shows only over the model, and while the snap cools down a thin ring round the cursor counts the 4 seconds down; a click inside the cooldown does not move the base, it only nudges the ring.
- **The dot marks what runs low.** When a store is falling (and its bar is not full), the dot sits on the one with the fewest days of cover and the advisor says it: "Food runs out in 21 days.", "Energy is short, rooms run at 80 %."; when nothing falls, on the slowest-growing bar that is not full: "Nothing is falling. Ore grows slowest." A full bar never carries the dot. The stars still follow the weakest column, as before. The feed no longer writes "The bottleneck moved from X to Y." (five in a row pushed everything else out), and ore is "ore" everywhere.
- **People have weight.** After deaths (a party lost or half-lost, a failed try at the surface, lives lost in the ice over a sleep) nobody is born for a colony year: the colony mourns. A failed try costs a third of the colony and teaches only a poor reading, ± 15, which replaces the belief; a scout party (a twentieth of the colony, a few points of scatter) stays the better instrument.
- **Rewards only where they show.** The wake-up strip leaves off a "+46 B" that would not move a counter reading "600 T", and a solved riddle names its stars only when the counter moves.
- **Bugs.** The scout badge read "1 y 12 m" for the last five days of a year: now "2 y". A button's tooltip goes away on click (the snowflake's stayed over the scene). The chapter label sits right of the pause button, no longer under it. The v1.47.0 entry below says chapter IV does not read the pause flag yet; it does (since v1.46.0: no colony days, no drift, the scene holds).
- Sim: 26m26s to year 802 701 (was 28m40s), 88 wake-ups, no hungry days, longest stall 76 s; seeds 1 to 5 land between 25m57s and 26m34s. Its greedy player buys Cryo I at 6m36s (was 11m32s).

## v1.47.0 - 2026-09-23 (war-playtest-4 merged)

### Chapter III, playtest 4 (Ola, v1.44.0: "very pleased with War, very well levelled"): no fire over water, pause, secret debug menu

- **Nobody fires at a boat.** Our guards shot at landing parties still out on the water, and the landing parties shot back, from the first tier on (the guards were given gunpowder reach even with fists). Now a party counts as ashore only once it is past the water leg of its crossing (`onIsland`, from the path's own markers, tested in both directions): our guards meet a landing only on our island, their dots meet our strike only on theirs, and the scripted losses fall only there too.
- **Fists and swords never draw a line.** With reach 0 (tiers I and II) the only visual is the clinch, a small burst where the dots touch. Shots (tracers) start at gunpowder, and come from a defender on that island, never from a random point at sea.
- **Pause.** A small round button beside the ☰ button (and the space bar, when no text field is focused). Chapters I to III stand still: game time, the war clock and the dots stop, saving goes on, resuming is instant. The city dims to 70 % while paused. The chapter cards are not paused. Chapter IV does not read the flag yet.
- **The debug menu is a secret again.** Gone from the ☰ menu. On with `?debug` in the URL, or five quick clicks (within two seconds) on the version label, which flashes "debug on" / "debug off". Everything it enables is unchanged.

## v1.46.0 - 2026-09-22 (chapter IV, slice 5)

### The Watcher: stability, the base softens and snaps, riddles, capacity

- **Something stays awake.** From the first sleep, while the colony is under the ice, a slow pulse and a mono label sit at the bottom of the window: SYSTEM AWAKE. After a century of slept years the label reads THE WATCHER, once, quietly. Under it a STABILITY meter (100 at the start, a mono number, no explanation) and a thin sliver of capacity. It is the brightest thing in the sleep world besides the lamps, and it is gone when the colony wakes. Nothing says what it is.
- **Stability drifts** with slept years, scaled by the tier so a real second of sleep costs about the same at every rate: 1.0 a second at Cryo I, up to 2.2 at Cryo VII. Alarms are steps down (6 for food, energy, a stall or too few; 2 for good news; nothing for the hand). At zero the system reboots: "Woke: the system rebooted." and the meter comes back at 40.
- **The base softens.** Below 80 the plates, the lanes cut into them and the shaft lose their rigidity: a slow swell, a sag and a fine jitter in the vertex shader, growing as the meter falls, still two colours. Below 35 the wake lines go slightly wrong (a word left out or said twice, at most one line in five; the reboot line never).
- **Snap.** Asleep, the cursor over the model is a crosshair. A click on the base snaps it rigid with a short ease and a soft flash, and gives +5 stability, at most once every 4 real seconds.
- **Riddles.** Now and then a small card under the Watcher: the next term of a seeded sequence ("2, 5, 11, 23, 47, ?"). Enter answers, Escape lets it go. Right: +15 stability, a month of the machine's wins, and 50 of the 100 capacity. Wrong: -5, and it stays. At most one per 20 real seconds of sleep, never over an alarm, and only when the capacity is there.
- **Capacity from the machines.** Per slept day, the spare energy times 0.001, at most 4 a real second, into a pool of 100. No spare energy, no riddles: the Watcher is fed by the M F E H game.
- **Pause.** The chapter honours the shell's pause (`window.__rpiPaused`): no colony days awake or asleep, no drift, and the scene renders without moving anyone or the jitter.
- The save goes to schema 3 with a migration (a colony that slept before gets a fresh Watcher at its next sleep). Checkpoint "IV · the Watcher" (asleep at a century a second, stability 55, capacity full, a riddle seconds away); `debug_deep('stability', n)`, `debug_deep('capacity', n)`, `debug_deep('puzzle')`.
- Sim unchanged: 28m40s to year 802 701, 85 wake-ups. It now reports the Watcher, unattended (no snaps, no riddles, reboots do not wake): stability 25 at the end, 2 reboots, named at 17m50s (year 104), capacity first full at 15m01s.

## v1.45.0 - 2026-09-22 (chapter IV, after Ola's playtest of v1.44.0)

### Survival in one word, scouts with odds, the shaft up, you can always try to go up

- **Survival, one word everywhere.** The rules still count doomsday; the screen only ever shows the chance of survival if the colony went up now (100 minus doomsday). The ring on the crust FILLS as the surface heals, with an amber tick at the line: "survival 15 % · need 85 %". The estimate reads "15 ± 40 %" with the caption "survival if we go up now", drawn as a lighter band round the reading; hovering it says "What the scouts believe. More parties, smaller doubt." Under it: "survival 85 % ~ year 802 701". Scout lines: "Scout party returned: survival 7 %. Not yet." / "62 %. Getting there." / "86 %. We could go up."
- **Scouts tell their odds before they go.** The button: "Scout party: 47 people, out 2 years. Return 69 %, lost 18 %, back wrong 8 %, followed home by something 5 %. Reading ± 7 %." (`scoutOdds()` in deep.js, whole per cents that always add up to 100). One party at a time; while it is out the button carries a badge with the time left, its ring fills with the trip, and the tooltip says "Party out, back in 1 y 7 m."
- **The shaft up, drawn.** A pipe in plate colour from the hatch on the lid up to the crust, now a flat slab of burnt ground in the model with the ring standing over the hatch. The top of the pipe is rubble until the first party goes out, then a dark opening. Parties are amber dots that walk the lanes to the hatch, climb a stair round the pipe and vanish into the crust; they come down the same way, or not. The flat band at the top of the window is only the fallback without WebGL.
- **You can always try to go up.** The button never waits on the estimate: "Try to resurface: everyone goes up. Survival 17 % (± 6). Below 85 % the first 225 die and the rest wait." Below the line the first quarter of the colony dies up there (their dots climb and do not come back), the rest wait, and the estimate becomes the truth ± 3. At the line it is the ascent and the V wall as before. The climb's old price (2 M ore, 2 B stars, 200 people) is gone: at the ring the colony held it a hundred billion times over, so it only made the button look like it was waiting for money.
- **Every number in one short form**: "313 k", "2.3 B", "9 M", one decimal only below ten, counters and rates included; the numbers over the bars are a size smaller and the columns wider, so they no longer run into each other.
- **Locked cryo tiers say why without hovering**: a mono caption beside the button ("needs food for 100 y", "needs farms automated", "needs 500 k stars"), the full sentence in the tooltip, and the advisor writes "Cryo IV is ready: a century a second." the day it opens.
- **Things that looked like they worked but did not (audit):** locked buttons took no hover at all (style.css's global `.is-locked` has `pointer-events: none`), so no "affordable in" or "needs" note on a locked button in the deep had ever been visible, and at 30 % opacity the tooltip was dimmed with the glyph; the salvage and the scorch from chapter III never reached the deep (`seedFromWar` used a constant it did not import and the error was swallowed); the scout tooltip listed 40 energy as a price that was never spent (now a requirement); the crust's party glyphs said nothing (removed); the level and automation buttons sold upgrades for a room type the colony had none of (now "Build a mine first"); "Affordable in 1 695 937 617 years" (now "more than a thousand years away"); unused build rings on the cryo and ascent buttons.
- Sim unchanged: 28m40s to year 802 701, 85 wake-ups, 6 scout parties (it already sent one at a time and never tried the ascent early).

## v1.44.0 - 2026-09-22 (war-playtest-3 merged)

### Chapter III, playtest 3 (Ola and a tester, v1.42.0): a slower start, one thing at a time, guards that fight

- **One thing at a time.** The war opens with the arms slider, the shield, the sword and the war room, nothing else. Every other control arrives on its own, greyed until it can be afforded, at most one every six seconds, with one line in the war room: the strike (once there is force), the ◆ on the plates (after the first landing), the radar (after the second), intel (after the radar), the raiding party (after the first strike), the laboratory (after three minutes AND four landings), the quartermaster (after tier II), auto strike (after tier III). The enemy's opening (appears, builds, gathers, attacks) is untouched.
- **The ladder can no longer be bought in one breath.** 90 s between tiers (was 45), the first tier costs half as much again, and their laboratory opens at 200 s, just after ours can. Their clock no longer restarts when we take the lead (that made a lead permanent with the longer cooldown); it runs a little faster instead (88 s base, was 95).
- **Guards that fight.** One guard per five defence units stands on the coast road. Most face their island; once a landing has come ashore on another coast, half of them spread to hold that coast too. When a landing party comes, the nearest guards walk along the coast to where it lands and fire; the landers that fall, fall there, on our island, with the shot coming from a guard. The guards stand down when the enemy leaves and go down the hatch with everyone else.
- **Crossings you can follow.** Every route between the islands is straight legs only: along their coast, straight across the water, along our coast to the landing point nearest the target, up the streets. Our strikes lose their men on their island, never out at sea.
- **Defending a plate is a visible button.** Every plate the enemy can target carries a ◆ pill with its price, districts included (on a district the button was frozen in its first state; fixed). Short of hammers, a click flashes the arms counter instead of doing nothing. A damaged plate works at its share of HP (stars, research, food, move-ins), is shaded and carries a small amber dot, so repair is worth it. Targeted plates hold a steady red ring instead of blinking.
- **The quartermaster only buys.** At a ratio you choose (shield 3:1, scale 1:1, sword 1:3, or off), keeping 15 s of arms in the yard for ◆, radar and raids. It never strikes. The strike button always shows ✓ or ×, and a separate auto-strike toggle (target icon) arrives after tier III, off until you turn it on.
- **One slider.** During the war the industry/research slider is hidden and research runs at half ("Research runs at half. The factory is yours."). The hammer counter says where hammers come from; the arms slider pulses once early on if the factory is idle.
- **Readable instruments.** The bought radar is flat, no ring, only its countdown and a pulse on the dish. Tooltips in the right-hand column open to the left and are nudged inside the window.
- **Their rocket is built in sight.** From doomsday 55 % the rocket stands on their island with an amber ring that is full at the launch.
- **Fixed:** a landing whose last survivor arrived alone was cleared before it landed (the plate stayed marked and nothing happened).
- Sim, seeds 1 to 6: 20 to 22 minutes, behind 40 to 44 %, ahead 14 to 19 %, 17 to 21 plates lost, their island silent 0 %, doomsday 85 to 88 %.
- Handed over to the chapter IV session: the slower fade into THE DEEP at the ship button (B079).

### Chapter III: the uphill after artillery, and numbers you can read

- **Air defence, the second climb.** From their tier V their shells and missiles fly over the guards: two waves in three come through the air and only air defence (shield-half, twice the price of a guard) stops them, by the same 70 % rule; every third wave is still a landing party that the guards meet. An air wave also kills some guards where it lands. The counter and the button appear, grey, the first time a salvo lands ("their shells go over our guards. We need something that reaches the sky."). Air defence stands on the coast as small posts and shoots its share of the shells down over our own island. The quartermaster buys it too, two per guard, once it has opened; the radar says whether the next wave walks or flies.
- **While we lead they push harder**: every third wave is a push (double size) while we hold the higher tier, on top of every fifth.
- **Astronomical but readable.** Stars, science, income and every cost in chapters II and III read as 1.90 T, 81.0 M, +294 M/s; the full number is on hover. Chapter I and its Roman numerals are untouched.
- In the war, the home and store buttons stay out of the column until there is land to rebuild on.
- Sim, seeds 1 to 6: 20 to 22 minutes, behind 40 to 43 %, ahead 14 to 19 %, 18 to 25 plates lost, doomsday 85 to 88 %. After we reach tier V (7m31s) we are behind 63 to 68 % of the time until they leave. A player who never buys air defence loses 24 to 28 plates instead.

## v1.43.1 - 2026-09-22

- The descent card into THE DEEP is now slow and dark like the WAR card: long fade, IV, then the title, a click or five seconds ends it (Ola's playtest note via the WAR session).

## v1.43.0 - 2026-09-22

### Chapter IV: sleep is a state. Alarms, scout parties, stores and flows, the goal on screen

The first outside playtest of IV asked "why build things? what is the goal?", and gave up at year 178. This release reverses the three decisions behind that (spec: "First outside playtest" and "Built: slice 3").

- **The goal is on screen from the first second.** No fog of war: the ring on the crust is the colony's estimate of the surface, centred on the true healing curve with a wide band of doubt (85 ± 40 % at the descent), and under it, once, in mono: "habitable ~ year 802 701". Scout parties narrow the band and can bend the curve. The advisor's first line at the descent: "The surface will heal. Not in our lifetimes. We dig, we build, we sleep."
- **Cryo is a state, not a click.** The snowflake starts a sleep: everyone walks into the hall, the counter spins like the odometer for the first moment, and then the years ROLL, ore and stars ticking up with them, at the tier's rate: a month a second for Cryo I, up to a hundred thousand years a second for Cryo VII. The scene dims a little, the lanes are empty, automated rooms pulse. A sun button wakes the colony at will, and a colony saved asleep reloads asleep.
- **Alarms wake you, in plain words.** "Woke: food will run out in 21 days.", "Woke: the mine stalled, no hands.", "Woke: the generators stalled, no ore to burn.", "Woke: energy is short, rooms run at 60 %.", "Woke: scout party returned. Surface 41 %.", "Woke: the new farm is running, and the next one is paid for." (at most once a decade), "Woke: the surface may be habitable. Estimate 14 ± 6 %." Each sentence goes to the feed and its glyph opens the wake-up strip.
- **Cryo tiers are offered when they are useful.** A dry run of one second of sleep at the tier's rate must meet no bad alarm first, and the tooltip says what is missing: "Cryo II needs food for 365 days: 210 today.", "Cryo II needs the farms to run without hands." Sleepers now eat a tenth of a ration, so a larder with no farm behind it runs out under the ice too.
- **People matter.** The ice takes 0.3 % of the sleepers a year (less with every dormitory level; a fed colony refills its pods), probes are now **scout parties** of 4 to 60 people ("Scout party sent (6 people).", "Scout party lost.", "Scout party returned raving: reading unreliable.", "Something came back with the scouts: chamber 7 dark."), they come home on their own day awake or asleep, awake free hands clear a dark chamber in ten days, and a colony under ten people cannot sleep.
- **The bars are stores with flows.** Each on its own scale: ore against the next thing ore buys, food in days of eating, energy spare, free hands. Under each, "+in -out" a day in mono; the red dot stays on the weakest flow; hovering says it in one line: "Food: 45 days left. +84 grown, -39 eaten a day."
- **Every purchase says what it does for the goal**, from a dry run: "Lets the colony sleep 3 more years without an alarm", "Food for 12 more days of sleep", "+120 stars a day toward Cryo II". Cost is always on hover, with "Affordable in N days" at today's flow, or "Needs a free chamber", or "Already being built".
- **Counters show their rate a day**, and ore is a pickaxe everywhere, never the gem. Big counters got a trillion step so they still visibly tick at the top tiers.
- **You can see the people.** Lanes are a mid grey, the people are white and a size larger.
- **Rock, paper, scissors in the deep.** Chapter I's star machine sits on the lid and throws its three glyphs at a speed set by the stars a day; a win flashes a star. The stars counter: "Wins. The machine plays with the colony's surplus."
- **Fixed**: the calendar ran backwards for five days at the end of every year (month 12 holds 35 days and its day number wrapped).
- **Save**: schema 2, with a migration; old colonies keep what they believed about the surface.
- **Simulation**, now on the state model (sleep until an alarm or until the next purchase is paid for, scout parties while the ring is wide): **28m40s to year 802 701**, 85 wake-ups, 3.4 buys each, no hungry days, longest stall 58 s, bottleneck spread over all four columns awake and asleep. Seeds 1 to 5: 28m40s to 29m51s. No cost, rate or build time changed.

## v1.42.0 - 2026-09-22

### The enemy stays dangerous (war-tuning branch, merged)

### Chapter III: the enemy stays dangerous, and the sim finally plays the game

- **The simulation is the game now.** `scripts/sim-phase3.mjs` used to run a greedy ideal player on a loop the game does not have. It now follows `warTick` step for step (the standing factor on landings and on their defence, the push every fifth wave, the warning delay, the silent island, the regroup) with the **auto quartermaster on the balanced stance** as the player, which is what most people actually run. `--raid` gives it the raiding party. It also draws from three separate random streams, so a balance change no longer reshuffles the enemy's dice along with the rules. On the old rules it agreed with Ola at once: only 12 to 15 plates lost and their island silent for up to a fifth of the war.
- **Bombing their island no longer switches the war off.** Their defence does not thin at all when their buildings fall, they rebuild a razed tile in 40 s instead of 90, and a dug-in enemy is back after 90 s instead of 120. Razing buys salvage and a little quiet, nothing more.
- **Their shield is worth what our force is worth.** Their defence regrowth and its cap now climb with our own tier, so a landing on their island takes a real build-up of force or the raiding party, not a strike every few seconds from the quartermaster.
- **Research under fire is slow.** Every tier they hold over us multiplies the price of the next one (1.9 per tier, counted over at most two) and a tier we hold over them divides it. Falling behind is a hole to climb out of; a lead is worth keeping. To keep the top of the ladder reachable inside one war, our cost growth per tier went from 1.3 to 1.26.
- **A weapon they have never seen sends their laboratory back to the drawing board**, and while they are behind they push twice as hard. Their own clock is steadier too (jitter from 40 % to 15 %), so the swings come from the rules and not from the dice.
- **Landings come no faster than one every 20 s** (was 15), so there is always room to repair a plate between them.
- Sim, seeds 1 to 6: 20 to 22 minutes, behind 40 to 43 % of the time, ahead 22 to 24 %, 20 to 24 plates lost, their island silent 7 to 8 % of the war, doomsday 85 to 87 %. Every one of those is inside the window we set, and the spread between seeds is now a couple of points instead of a coin flip. Full before and after, and the three things this pass did not solve, in `docs/superpowers/specs/2026-09-19-chapter-iii-war-design.md`.
## v1.41.1 - 2026-09-22

### Chapter IV, Ola's notes on slice 1: the menu works, the colony explains itself, and the light is where the people are

- **TEXT IS NOW THE EXPLANATION MODEL IN THIS CHAPTER.** Ola's call after playing v1.40.0: icons alone failed here. Four numbers moved at once and nothing said why. "Icons over text" still holds for chapters I to III; the deep gets sentences.
- **The menu was dead in the deep, and it was not a z-index.** `#menu-btn` was wired by chapter I and chapter II each for themselves, so in any chapter that did not wire it the button simply did nothing. The toggle now lives in `main.js`, where the button itself lives, for every chapter there will ever be; the two duplicates are gone, an outside click closes the dropdown, and the deep says what "Reset everything" means for its own save. The menu, the version line and the test menu all work in IV.
- **The advisor is a feed**, top right, like chapter III's war room: the last five lines, mono, wrapping. Driven by the rules rather than by the clock, and the rule that keeps it quiet is that a line is written when a CONDITION CHANGES and never on a timer: "We are running low on food: 18 days left.", "The generator needs 2 more hands; the mine is idle.", "Energy is short: rooms run at 60 %.", "People are hungry; the colony is shrinking.", "The bottleneck moved from minerals to food." New pure module `src/phase4/advisor.js`, tested.
- **Every bar says where its number came from.** Hovering one gives its ledger in plain English: "Energy 21: generators make 24; mine 4, farm 3, dorm 1 use 8; spare 21." and "People 179 awake: 12 on duty in mine, farm and generator; 167 free; eat 50 food a day; capacity 200."
- **And every purchase says what it will do, before the click.** Ola: "I buy electricity and BOOM all humans drop; I cannot understand what will happen." Hovering any purchase button now draws a ghost on each of the four bars at the value it would stand at once that purchase is finished, with the change written above it in mono, red when it goes down: hovering a generator in a manual colony reads **-50 hands** before a single star is spent. The button's tooltip adds the sentence: "One more generator. Needs 2 hands and 2 ore a day; makes 26 energy." The ghosts are not an estimate; `preview()` in the new `src/phase4/readout.js` runs the real rules forward one day on a clone, and a test asserts the promise equals what buying it actually gives.
- **Nothing is instant.** A purchase is an ORDER: the ore and the stars go at once, the thing itself arrives days later, with a filling ring on the button and on the plate where it will be. A chamber takes 8 days, a room 5, a level 6, an automation 12, and a sleep finishes whatever was still being built. Ola's sketch said 20 / 10 / 15 / 30; at one real second to the colony's day those cost the run 21 real minutes of standing about (42m39s against the chapter's 20 to 30 minute target), so the ladder is the same shape at the pace the game actually runs.
- **Reset view really fits now.** The home view is computed by projecting the eight corners of the colony's bounding box onto the camera's own axes and taking the distance at which the last of them is still inside the frustum, using both field-of-view angles. It fills a wide window and a narrow one alike, is recomputed when a chamber is added and when the window is resized, and the zoom limits no longer clamp the fit away.
- **Light city, dark rock.** The palette is flipped (Ola: "we build in life and light, buried in black stone"). The slabs are one flat light colour with the lamp leaving their tops brighter than their sides, the rock and the background are near black, the lanes and the houses are cut in that rock colour, and the people are dark dots on the light ground. Still two colours. Labels, badges and rings went dark to suit.
- **Simulation**: 27m58s to resurface in year 802701, 80 wake-ups with 3.6 buys each, 33,436 people, no hungry days, and the longest the star counter ever reads zero is 58 s, which is shorter than it was before orders existed (68 s).

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
