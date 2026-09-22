# Chapter IV · THE DEEP · design sketch v1 (2026-09-21)

Status: **sketch for discussion**, numbers in `src/phase4/deep.js` + `scripts/sim-phase4.mjs`,
no UI. Ola's direction from 2026-09-21 first, then the proposal, then open questions.

## Kort, för Ola

- **Idén i en mening:** ytan läker bara med tid, tid kan inte köpas, och cryo är hur man spenderar den. Automation gör det säkert att sova länge.
- **Fyra kolumner** (malm, mat, energi, människor) som dagliga överskott. Stjärnor per dag = 10 × den svagaste. En prick på den kortaste stapeln säger vad du ska köpa härnäst.
- **Klockan** går år 0 → 50 000 år. Först puttrar maskinerna, sedan tidsförkortning i sex steg (månad, år, 10, 100, 1 000, 10 000 år).
- **Vad man vet om ytan** kommer bara från prober och spejare (din idé): ett osäkert procenttal som skärps med varje sond som kommer tillbaka, och några kommer tillbaka fel.
- **Sidovy:** schakt från den brända skorpan, kammare i rader neråt. Mockup på väg i `docs/mockups/deep-side-view.html`.
- Detaljerna nedan är arbetsanteckningar; kritiken från designagenten ligger i en egen fil, `2026-09-21-chapter-iv-critique.md`.

## Ola's direction, round 2 (2026-09-21)

- **Time ends at 50 000 years, or 500 000.** Orders of magnitude more than the first sketch's 350. Machines that chug along, faster and faster but still slow, until time compression begins. (Rules retuned: healing constant ~29 000 years, cryo ladder I–VI up to 10 000 years per press.)
- **Probes and scouts.** A percent that says the odds the world is habitable again. The player sends probes or scouts; some come back, some do not, some come back as monsters or mad, or with bad or unreliable news. Steps 3–4.
- **Side view: go.**

## Probes and scouts (proposal, replaces "animals as samples")

After the boom nobody can see the surface. The ring on the crust is not the truth, it
is the colony's **estimate**: wide and grey at first ("40 ± 40 %"), sharpened by every
probe that returns. Sending a probe costs minerals and energy (later a scout costs a
person) and takes years of colony time, so the answer arrives at a wake-up:

| outcome | odds (early → late) | what the player sees |
|---|---|---|
| returns with a reading | 40 → 80 % | the estimate narrows toward the true surface value |
| does not return | 40 → 10 % | the ring stays wide; one probe icon crossed out |
| returns wrong (mad, lying instrument) | 15 → 5 % | the estimate jumps the wrong way; the next good probe corrects it |
| returns as a monster | 5 → 5 % | a chamber goes dark until cleared (the wake-up fault) |

The estimate is the chapter's version of III's intel: without probes you are guessing
when to build the ascent; with them the percent becomes a number you can trust. The
ascent can be attempted at any time; attempting it at a bad true value loses the party
(people) and the ring widens again. That is how the ending stays a decision and not a
countdown, and why the "%" Ola asked for is the right display: it is a belief, not a
fact.

## Ola's direction (so nothing is forgotten)

- New mechanics, as every chapter. **Time** is the big counter: day, month, year.
- We see the underground, perhaps **from the side**. A way down from the crust (scorched
  earth on top): a pipe, a spiral stair or a ramp. Our people walk down and then
  **boom**, we blow the exit. The link to the surface is gone; we cannot see up there.
- Then the game begins. A few **chambers**. Must not be XCOM or Fallout Shelter: an
  idle clicker needs something to work with, so **mining minerals**.
- Resources that must be **balanced and levelled** together: **Mining, Food, Energy,
  Humans**, and Time. M F E H in the right balance produce stars (the RPS wins).
- Each of M F E H has staggered upgrades like chapter I. Like Universal Paperclips:
  buy MANY, then automation, then several automations, then advanced automation that
  levels ×100 per buy.
- **Cryo** = shortening time. Staggered: the first cryo zooms time forward, then slows,
  a year has passed, the people come out to check on things; when upgrades are made
  they freeze again. Over time both things and cryo get upgraded.
- Steps: 1 open and extend the underground so real mining can begin; 2 develop, level,
  mine, more people; 3 CRYO, time as a factor; 4 something exciting: mutiny (a faction),
  or animals that disturb, maybe toward the end as a sign that the surface is livable;
  5 prepare for resurfacing, ascent (chapter V).

## The one new idea: time heals, and time is the only thing you cannot buy

Chapters I–III are about making a number go up faster. IV keeps that (stars, minerals)
but puts the real goal out of reach of money: **the surface heals only with time**. The
doomsday ring from III runs backwards, slowly, over centuries. No upgrade touches it.
The only way to reach the ending is to let years pass, and the only way to let years
pass without the colony dying is to build a colony that runs while everyone sleeps.
That is what the M F E H ladder and the automation ladder are *for*: cryo is the
accelerator, automation is what makes it safe to use. This is the mechanic that is not
XCOM or Fallout: the player is not managing a shelter, the player is engineering a
machine that can be left alone for a thousand years.

- **Doomsday in reverse.** `surface(years) = doom0 · e^(−years/200)`. From 85 % it takes
  ~350 years to reach the 15 % where resurfacing is possible. The ring on top of the
  screen is the same ring as in III, now emptying. At wake-ups the people look up the
  shaft (later: through a sensor) and the ring updates. That is step 5's gate.
- **Cryo freezes mouths and hands.** Asleep, humans neither eat nor work. A room that
  is not automated stops. So early cryo is a gamble (you wake to an empty larder if the
  farms were manual); late cryo is the whole game. First automation of a room type =
  "runs without people". Further automations multiply its output.
- **The bottleneck moves.** Stars per day = 10 · min(M, F, E, H) in each resource's
  own units per day (minerals mined, food grown, energy spare, people awake). The
  weakest of the four is marked (the stop dot from II); upgrading it is always the best
  move; then another becomes weakest. That is the staircase of chapter I again, in four
  columns, with no text.

## The board (side view, proposal)

A shaft from the scorched crust at the top of the screen. Chambers branch off it in
rows going down (dug one at a time: "excavate"). Each chamber holds one room:

| room | makes | needs | icon idea |
|---|---|---|---|
| mine | minerals | energy, people (until automated) | pickaxe |
| farm | food | energy, people | sprout |
| generator | energy | minerals (fuel) | zap |
| dormitory | people capacity | food | bed |
| cryo hall | time (the sleep button) | energy | snowflake |

Deeper rows mine more (richer seams) but cost more energy to run (lifts). The ants walk
the shaft and chambers; at a wake-up they pour out of the cryo hall, walk the rooms,
and go back in. After the boom the top of the shaft is rubble; the crust stays visible
as a thin scorched band, and that band lightens over the centuries: the ring, drawn as
land.

## The ladder (Paperclips, as Ola asked)

Per room type: buy rooms (×1, ×10, ×100 buttons appear as you get richer, like the
batch buys in III) → level (×2 output each, geometric cost) → **automation I** (runs
without people) → automation II, III… (×3 output each) → **advanced automation** (×100
per buy, only after the third). The steps are teased greyed, the way II does it.

## Time (the counter)

Day · Month · Year from Year 0 at the boom. One real second = one day at the start.
The chapter ends around year 50 000 (Ola, round 2), so the counter is the star
counter of chapter I again: slow digits first, then years, then millennia flying.
Cryo is a room and a purchase ladder: cryo I sleeps a month per press, II a year,
III 10 years, IV 100, V 1 000, VI 10 000. A press zooms (the counter spins, the
ring drains a little), slows, and the people come out. Before the first cryo (about
eight real minutes) it is pure machine-building: rooms, levels, the first automation,
stars per day climbing steadily. The surface heals with a constant of ~29 000 years,
so 15 % comes at ~50 000 years.

## Steps, with the numbers game behind each

1. **Open the deep.** Salvage from III is the starting stock (minerals). Dig chambers,
   put in a generator, a farm, a dorm. Everyone works. Stars trickle.
2. **Develop.** Rooms, levels, more people (dorm capacity, growth 2 %/year with food).
   Buy many, then automate. The bottleneck dot walks around the four columns.
3. **Cryo.** First sleep: a month. Wake-up summary: what ran, what stopped, what was
   eaten. Then years. Automation makes long sleeps safe.
4. **What wakes you** (Ola's open point). Proposal: a wake-up is never quiet. Events
   scale with sleep length: a chamber flooded (repair), a generator failed, people
   left (mutiny: a faction wants up early; they take a chamber and stars), and toward
   the end **animals in the shaft** (life is back up there; they eat food but they are
   the sign). Mutiny is the mid-chapter pressure, animals the late-chapter promise.
5. **Resurfacing.** When the surface ring is under 15 %: build the ascent (a big
   minerals + energy + people cost), everyone climbs, boom in reverse. Chapter V.

## Simulation (`scripts/sim-phase4.mjs`)

Greedy player, one real second = one tick. Buys the cheapest upgrade of the weakest
resource, digs when full, automates when it can, sleeps when nothing is affordable (the
longest cryo it owns). Targets: 20–30 real minutes; years reached ~350; wake-ups
~40–60; at least two stretches where the bottleneck sits on each resource; stars per
day rising 10³–10⁴× over the chapter.

## Open questions for Ola

1. Side view with a shaft, or the same plate grid seen from above? (I propose side.)
2. Stars: do they still buy everything, or do minerals buy rooms and stars buy tech?
   (Proposal in the sim: minerals for digging and rooms, stars for levels, automation
   and cryo. Two currencies, both from the deep.)
3. Mutiny as an event at wake-ups (my proposal) or as a visible faction with its own
   bar, like the competitor in II?
4. Should the surface heal faster if we stop burning fuel (generators)? A green
   choice: solar shafts vs. fuel. It would give energy a second axis.
5. Animals: a nuisance (eat food) or a resource (hunt = food)? Or both, in order.

## Ola on the first mockup (2026-09-21)

- Hard to tell what is active now and what unlocks later. Keep the design simple.
- Too much information at once, but pretty. Sync it with the earlier chapters: no
  gradient backgrounds. Consider **dark mode for this chapter** to show the deep and
  the claustrophobia, with a faint light from our chambers.
- Time labels y m d: keep. Advisor line: keep (text in one place is fine).
- The crust: **fog of war**. Dark until we break through and look. Alternative: the
  silhouette of a bombed city above.
- General rule for IV: **never show all the cards at once.** Things appear as the
  colony develops.

### Proposal for mockup 2 (next session)

- Dark chapter: the palette flips when we go down (chapters as layers: I–III light,
  IV dark, V the light returns). Rock is near-black, dug chambers glow faintly, the
  ants are the light. Flat fills only, no gradients, like the plates in II.
- Three states drawn, not one: minute 0 (shaft, rubble, one chamber, one bar, one
  button), minute 5 (three chambers, four bars, the bottleneck dot, cryo teased grey),
  first wake-up (replay strip appears, the ring is revealed for the first time).
- Teasers exactly as in II: a greyed icon appears when the previous step is bought,
  never before. No bottom row of far-future rooms.
- Crust stays black until the first probe returns; then the ring appears as an estimate.

## Ola on mockup 2, and a change of view (2026-09-21)

Ola: too dark, the tone ladder reads as several lights (should be one light); seen from
the side the corridor should meet the room at its floor; the people would float; the
rubble plug at the top will not look good; skip the ants if they cannot be good;
sceptical of the day's design in general.

Proposal (Claude): **drop the side view.** It forces physics the game never had
(floors, gravity, ladders, a plug). Instead the deep is the same top-down plate board
as II and III, inverted: the hole dug at the end of III becomes a sealed centre plate;
chambers are dug outward from it, corridors are streets, the ants walk as they already
do, depth is rows further from the shaft (like the coast rows in III). One light: a
dark rock background and chambers as slightly lighter plates, nothing else. The ring
stays at the top. The side view can return as the ascent itself in chapter V.
Mockup 3 = the chapter II board in this dark, sealed-centre form, three states as before.

## The view is decided: a real 3D model (2026-09-21, mockups 5 and 6)

Ola's own sketch: floors of flat plates stacked around a vertical shaft, seen in true
3D (three.js, no build), slowly rotating, zoomable, never clicked. All buying and info
lives around it (Spaceplan's planet view). Mockup 5 proved it holds with two colours.
Ola's notes for mockup 6 and the real build:
- People tiny, like the dots of II; more of them on older floors: a bustling colony
  (the feel of the classic city and park sims, simple but alive).
- The shaft is the **stairs**: people walk into it and pop out on another floor after a
  moment. A visible spiral stair only if it is cheap and reads.
- Left drag rotates, wheel zooms, right drag pans. Auto-rotate until the first touch.
- More than three floors when the model allows (the sim gives ~100 chambers).
- Knife-sharp plates, bridges at the same height as floors. Two colours. No hint text.
- A "micro-sim" of the colony is tempting; parked as an idea, the bustle should come
  from the people's movement, not from new mechanics.
Build order once mockup 6 is approved: scene module (src/phase4/scene.js) fed by the
rules (deep.js), then the chrome (bars, buttons, time, ring), then the descent from
III into this scene, then cryo and wake-ups.

## Locked: mockup 8 is the reference (2026-09-21, Ola: "Yes! Gå på ditt förslag.")

`docs/mockups/deep-3d-8.html` is the visual reference for the real build: true 3D
(three.js from CDN, no build), two colours, sharp slabs, five floors round a shaft,
seeded per-plate maps with houses along lanes, people on a walking graph, stairs
entered on foot through lanes, reset-view button, full bleed, chrome floating on top.
Build order: `src/phase4/scene.js` (the scene, fed by `deep.js` state) → chrome (time,
bars with the bottleneck dot, counters, buttons, ring) → the descent from III into the
scene → cryo, sleep fast-forward and wake-up replay → probes and the ascent.

## Built: slice 1 (v1.40.0, 2026-09-22)

What exists now, in code, not in a mockup:

- **Phase DEEP.** `src/phase4/index.js` with init/teardown like the other phases,
  registered in `gamePhase.js` and `main.js`, container `#phase-deep`, styles in
  `style-deep.css`, body class `in-deep` while the chapter is on screen.
- **The descent.** Chapter II's ship button gathers everyone at the hatch, then
  the black IV card plays and the phase switches at its midpoint, so the model is
  there when the card lifts. The "to come" wall is the fallback for a browser
  that cannot load the chapter, nothing else.
- **The model.** `src/phase4/scene.js`, ported from `docs/mockups/deep-3d-8.html`
  and fed by the state: plates, bridges, the shaft and its stairs, seeded maps
  with houses and lanes, people on the walking graph, no people on automated
  plates, level badges and the automation glyph as CSS2D labels, a filling ring
  where the next chamber will be dug, reset view. three.js 0.160.1 comes from the
  importmap in `index.html`, the one place the CDN is named.
- **Where things go.** `src/phase4/layout.js` (pure, with tests):
  `placeChamber(index)` gives floor and cell, twelve chambers to a floor, the
  arms first and then the ring outside them.
- **The chrome.** Time, ore and stars, the advisor line, the four columns with the
  bottleneck dot, stars per day, and the buttons: dig, the four rooms, level,
  automate, cryo (greyed, "soon").
- **The clock and the save.** One real second is one day, at most three days
  caught up on return, `rpi-deep` holds the schema version, the state and the
  layout. Checkpoint `iv-start`, `window.debug_deep(...)`, `window.rpiDeep`.

Next, in order: **cryo** (the sleep tiers, the fast-forward and what the counter
does while the years run), the **wake-up replay** (what ran, what stopped, what
was eaten), **probes** and the estimate of the surface, and the **ascent** into
chapter V. The rules for all four are already in `deep.js`; none of them has a
surface yet.

## Built: slice 2 (v1.41.0, 2026-09-22)

What exists now, on top of slice 1:

- **Cryo.** The snowflake's first press digs a cryo hall (a room type with its own
  plate and glyph) and buys cryo I; every press after it sleeps that tier. The badge
  says the length (1 m up to 100 000 y). The next tier appears under it as a teased
  purchase only once it is affordable. Thousands are grouped with a space
  (`group()` in `deep.js`), so the badge and the year counter read alike.
- **What a press looks like.** The crowd walks the existing graph into the shaft and
  down to the hall (1.5 s) and is gone; the scene dims; the counter runs up like an
  odometer over 2.5 s, slow then flying then a long stop; they pour back out (1.2 s).
  The day timer is stopped for the whole press, so no day is lived twice, and a wall
  clock sits behind the frame loop so a hidden tab cannot freeze the colony mid-press.
- **The wake-up replay.** A strip over the scene, icons and numbers only: which room
  types ran and which stalled (dimmed, amber dot), what was made, and the weakest
  column as four bars from the sleep report's histogram. `sleep()` now returns `ran`
  per room type, and `stalledRooms()` reads it. A stalled room keeps the amber dot on
  its own plate until something is bought for it.
- **The crust.** `src/phase4/crust.js`: a thin black band at the top with nothing on
  it until the first probe comes back. Then the ring, drawn as the colony's ESTIMATE,
  with the spread as the stroke width: wide and grey at "40 ± 40 %", a hairline once
  the sky has been read often. Probes in flight show as small radar glyphs.
- **Probes.** Pure and tested in `deep.js`: `PROBE_COST_MINERALS`, `PROBE_ENERGY`,
  `PROBE_DAYS` and `probeDays(sent)` (two years for the first, shorter as the colony
  learns), `probeOdds(day)` walking the design's outcome table from the early row to
  the late one, `resolveProbe(rng, day, surfaceTrue)`, `updateEstimate`,
  `launchProbe`, `resolveDueProbes`, `darkenChamber`, `clearChamber`,
  `clearDarkType`. Results land at a wake-up and never while the player watches.
- **The ascent.** `ascentOffered()` opens the door on the ESTIMATE, `canAscend()`
  stays the truth, and `attemptAscent()` decides. A wrong guess costs the ore, a
  quarter of the colony, and widens the ring while correcting its mean. A true
  success walks everyone up the shaft, lightens the crust and plays the
  `CHAPTER_V` card (`{ roman: 'V', title: 'RETURN' }`, one constant) as the wall;
  `ascended` is saved so a reload lands on the wall again.
- **Hooks.** Checkpoints `iv-cryo` and `iv-late`, and
  `window.debug_deep('sleep'|'probe'|'ascend')`.

**The simulation ignores probes.** `scripts/sim-phase4.mjs` neither builds nor sends
them, so the balance targets are the ones slice 1 was tuned against and the run is
byte for byte the recorded one (21m44s, year 802701, 76 wake-ups, 50,679 people).
Probes cost ore a greedy player would otherwise spend on rooms; folding them into the
sim means retuning the whole ladder, and that is a balance pass of its own, not part
of this slice. Dark chambers are threaded through `tickDay` in a way that is exactly
the old arithmetic when nothing is dark.

Still open: the fault budget of step 4 beyond the monster (flood, mutiny, animals),
the sleep-as-a-program idea from the critique, and everything Ola asked for after
playing v1.40.0 (see the v1.41.1 entry in CHANGELOG.md).
