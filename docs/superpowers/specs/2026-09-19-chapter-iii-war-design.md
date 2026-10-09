# Chapter III · WAR — design sketch v2 (2026-09-19)

Status: **sketch for discussion**, nothing built. v1 proposed rock–paper–scissors as a
weapon triangle; Ola found it hard to fit and prefers a **numbers game** where you
produce a currency, buy attack and defence, and balance against what the enemy does.
v1 is dropped. This version follows Ola's direction of 2026-09-19.

## Ola's direction (so nothing is forgotten)

- War is **dyrt**. We will have a working nation when it starts; war eats it.
- The player **produces a currency** and buys **attack or defence** with it; builds up
  troops and **releases** them; later buys **long-range weapons per unit** that damage
  the enemy from a distance; eventually **chemical, biological, nuclear**. The point is
  that the Earth becomes uninhabitable.
- **First helpless**, then we build the enemy's counterparts; sometimes we invent a
  technology first and hold the upper hand, then they do. Ups and downs (cascades).
- **Razed is not forever**: a ruin must be **cleared and rebuilt**, at a price. The cost
  of war is money and time, not permanent black plates (that would end too fast).
- **The land degrades** over time and darkens, faster with chem/bio/nuclear. That is the
  endgame. A **destruction bar / doomsday clock** toward the end.
- **No dead ends.** You cannot lose outright.
- **We win**: the enemy may even build a spaceship and leave when the Earth is too
  damaged, abandoning us to our fate (which is THE DEEP, chapter IV).
- **Islands**: our plates should get an actual island with a wobbly coastline, appearing
  when we have used all our land; the enemy's island appears to the south with a fixed
  area it colonises; water as a light grey-blue tone (used fully in IV). Their last
  building is a **shipyard**, so they can ship troops to us: that is the starting shot.
- Everything else from before still holds: icons over text, teasers greyed out, helpers
  beside the line, chapters as layers, silo/salvage carried down.

## The setting: two islands and water

Built in chapter II already (it is the bridge):

- **Water**: the page background under the city area shifts to a light grey-blue. The
  land is a plate with a **wobbly coastline** (an SVG blob behind the grid, sized to the
  slots). It appears when all 20 plots are in use: the island is full.
- **Enemy island** to the south: a fixed blob, colonised tile by tile on its own clock
  (built): factory → warehouse → radar → tower → **shipyard** (replaces the castle).
  With the shipyard they can cross the water; the first raid follows, then the swords.
- During war the water between the islands is the front: their boats (bigger red dots)
  land on our coast, our strikes fly over the water.

## Currencies and production

| currency | from | spent on |
|---|---|---|
| stars | the city (people × per-person) | rebuilding, clearing ruins, upkeep |
| science | research allocation | weapon tiers |
| supplies | stores, stalls | people and troops eat |
| **arms** (new) | the factory, via a slider *goods ↔ arms* | every unit of attack and defence |
| **salvage** (new) | razed enemy tiles | nothing in III; it is what we take down to IV |

The factory from chapter I is the layer carried forward: it stops making stars and
makes arms when you push the slider. That is the "dyrt" in one control: every percent
of arms is a percent of income gone.

## Units: attack and defence as numbers

Two numbers on our side, shown top right like population and supplies today:

- **Defence** `D`: the sum of what we have bought to protect the island. Militia (cheap,
  weak, eats), walls (per plate, no upkeep), turrets, later shields.
- **Force** `F`: what we have built up to strike with. Infantry (walks over by boat),
  later artillery (range; no walking), missiles, then chemical, biological, nuclear.

The enemy has the same two numbers. **Radar** (their first helper, ours too) shows the
size and kind of the next wave a few seconds before it lands.

**Resolution (the one rule):** a strike of power `P` hits a plate that has
`HP = base(tier) + local defence`. If `P ≥ HP` the plate is razed. Otherwise the plate is
damaged by `P` (ring shrinks) and must be repaired. Our strikes on their tiles work the
same way. Everything else (tiers, upkeep, scorch) is numbers on top of this rule, and
the player can read it from the rings without a word.

## Escalation ladder

Tiers are research (science) for us and a clock for them. The enemy's clock has
jitter (±40 % per tier) so that sometimes we get a tier first and hold the upper hand
for a while, sometimes they do. Each tier is a cascade moment: the new weapon is
suddenly cheap relative to income, and the old units are outgrown (helpers).

| tier | ours / theirs | effect | scorch per hit |
|---|---|---|---|
| I | militia, walls | dots walk (by boat); one plate at a time | 1 |
| II | artillery | range: damage without dots; plates need repair | 2 |
| III | missiles | any plate, bigger P | 4 |
| IV | chemical | area: neighbours damaged; plates poisoned (yield −50 %) | 10 |
| V | biological | population loss over time on the hit island | 15 |
| VI | nuclear | razes a block; the map goes dark | 40 |

## Damage, ruins, rebuilding

- A razed plate becomes a **ruin** (dark plate). **Clearing** costs stars and takes time
  (a ring fills); then it is an empty plot again and must be **rebuilt at full price**.
- Damaged plates (not razed) show a shrunken ring and produce less until **repaired**.
- The cost of war is therefore: arms production (lost income) + upkeep + clearing +
  rebuilding + lost production while damaged. It is dyrt.

## Scorch and the doomsday clock

- Every hit adds **scorch** to the island it lands on (table above). Scorch never goes
  down. It lowers yield (stars per person, food per store) and darkens the plate colour
  and the water around the island. Chemical and above add a lot.
- The **doomsday clock**: one ring at the top (or the silo of chapter II, repurposed)
  that shows the planet's total scorch. It only fills. It is the chapter's line in
  reverse: the number that goes up is how finished the surface is.
- **Salvage**: each razed enemy tile drops material into our silo. The silo is the
  chapter's other rising number, and the teaser for IV.

## How it ends (no dead ends)

- We cannot lose. If our island is badly scorched we simply earn less; the enemy's clock
  keeps running regardless of us, and eventually they are done too.
- When the enemy island's scorch passes ~80 %, they build a **spaceship** (a tile) and
  leave: a small launch animation, their island goes silent. We have "won", and the
  Earth is finished.
- Then the **ship button** (down, not up) is teased and opens when the silo holds enough
  salvage. Pressing it plays `IV · THE DEEP` (working title). Salvage is the starting
  stock of IV.

## What to simulate before building (`scripts/sim-phase3.mjs`)

Wave clock with jitter, arms slider, unit costs and upkeep, HP per tier, clearing and
rebuilding, scorch, enemy tier clock. Targets: 20–30 minutes; income roughly halves by
the end; at least three lead changes (we get a tier first, they get one first); the
player never has fewer than ~40 % of plates standing; the enemy leaves between minute
20 and 30; salvage fills the silo in the last third.

## Build order proposal

1. **Islands and water in chapter II** (visual, no balance): coastline blob when the
   island is full, water tone, enemy island blob, shipyard as the enemy's last tile
   and the trigger for the first raid. This is the bridge and can be felt now.
2. `sim-phase3.mjs` with the numbers above; tune until the targets hold.
3. War core: arms slider, D and F, the one rule, waves, clearing/rebuilding, radar.
4. Tiers I–VI with the jittered enemy clock, scorch, doomsday clock, salvage.
5. The enemy's spaceship, the ship button, hand-over to IV.

## Prototype v1.31.0 (2026-09-19)

Built as sketched, minus radar and auto-strike. Rules in `src/phase3/war.js`
(TIERS, one rule `resolveHit`, `resolveStrike`, `pickTarget` weighted random,
doomsday = 100·(1−e^(−scorch/700)), enemy tier clock 120 s ×1.15^k ±40 %, science cost
per tier = 90 s × science rate at war start × 1.3^(k−1), units 10 arms each, arms
20/s × (1 + 0.25·tier) × slider). Sim: ~14 min for a perfect player, lead changes 1–3,
plates rarely fall against a perfect defender; humans will lose more. Tune after the
playtest (B038).

## Open questions for Ola

1. Islands and water now, as the next build? (Yes from me.)
2. Waves: do they hit the weakest plate (smart) or a random outer plate (readable)?
3. Releasing troops: a "strike" button you press when Force is built up, or automatic
   strikes whenever Force passes a threshold (idle-friendly)?
4. Should the enemy's units still be drawn with the old three icons (gem, file,
   scissors) as pure flavour, or drop that layer completely?
5. Doomsday clock as a ring at the top, or the chapter II silo turned into it?

## Prototype v1.36.0 (2026-09-19): weapons are relative

The sim exposed the flaw in "the one rule" as first built: tier power is
exponential (1 → 800) while plate HP is flat (10–90), so from tier V every
landing razed its plate regardless of defence, and doomsday saturated by
minute 15. Fix: `relativePower(tier, against)` = power ratio. Landings and
strikes are resolved in units of an equal enemy (`resolveLanding`,
`resolveOurStrike`, `canRazeTile`); plate HP, FORT_HP, defence units and
ENEMY_TILE_HP (flat 120) all live in those units. Consequences the player can
read: same tier + defence = plates stand; one tier behind = plates fall on the
second landing unless repaired (◆); two behind = every landing razes. Waves
10 + 2n (max 50); scorch per landing = tier scorch (×4 on a raze); doomsday
scale 2500; tier cost 70 s × 1.3^(k−1) of full research. A bombed-out enemy
island (nothing standing) sends nothing and researches nothing until rebuilt.

Sim (perfect player, seeds 1–6): 16–19 min, lead changes 1–4, behind 0–27 %
of the time, plates lost 7–25 (with repairs), doomsday 58–86 % at the end.
Humans research slower and will sit behind longer, which is the feel Ola asked
for ("steget efter"). Open: legibility of cause and effect (Ola: "som att
någon stampat i ett myrbo"), an info panel top right (Spaceplan), repair as a
separate cheap action, the hatch visual.

## Tuning pass, war-tuning branch (2026-09-22): the enemy stays dangerous

Ola, after playing v1.38: "the player always wins too easily; when we develop a
weapon the opponent gets it before or around the same time, but that always
leaves him a bit worse, and he is usually bombed out so he cannot do anything
at all." The old sim reported the opposite (behind 27 to 43 % of the time, 21
to 25 plates lost), so the first job was to make the sim tell the truth.

### The sim now plays the game, not a greedy ideal

`scripts/sim-phase3.mjs` ran a greedy player on a loop the game does not have.
It is now `warTick` step for step: the standing factor on landings and on their
defence, the push every fifth wave, the four-second warning, the silent island
and the regroup, with the **auto quartermaster on the balanced stance** as the
player, which is what most people run. Defence and force kept level, a strike
the moment the toughest tile still standing can be razed, research as soon as
science and the cooldown allow, repair the worst plate, fortify the weakest,
rebuild ruins. `--raid` gives that player the raiding party as well.

It also draws from **three separate random streams** (their research clock,
their choice of target, our choice of tile). With one shared stream, any rule
change shifts the enemy's dice too, and then six seeds measure luck instead of
the change: that is what made the first attempts at this pass swing between a
walkover and a rout on a one-character edit. With the streams apart, a seed is
a fixed opponent and two rule sets can actually be compared.

On the old rules the faithful sim agreed with Ola at once: the auto player lost
only 12 to 15 plates and left their island silent for up to a fifth of the war.

### The rules that changed, one sentence each

1. **Their defence never thins when their buildings fall**
   (`DEFENCE_STANDING_FLOOR` 1): a half-razed island still defends itself with
   everything it has, so razing is salvage and quiet, not disarmament.
2. **Their shield grows with our weapons** (`enemyDefenceCap` × (1 + 0.8 ×
   our tier), `ENEMY_DEFENCE_REGROW` × (1 + 0.6 × our tier)): a landing on
   their island takes a real build-up of force or the raiding party, never a
   strike every few seconds.
3. **They rebuild fast** (`ENEMY_REBUILD_S` 90 to 40): a razed tile is back
   before we have the force for the next one.
4. **A dug-in enemy is back sooner** (`ENEMY_REGROUP_S` 120 to 90): bombing
   them flat buys a minute and a half, not a third of the war.
5. **Landings come no faster than one every 20 s** (`waveInterval` floor 15 to
   20): there is always room to repair a plate between them.
6. **Research under fire is slow** (`RESEARCH_CATCHUP` 1.9 per tier they hold
   over us, counted over two, and its inverse while we lead): every tier they
   are ahead is a hole to climb out of, and a lead is worth keeping.
7. **The ladder can be climbed inside one war** (our cost growth 1.3 to 1.26):
   at 1.3 the top rungs were out of reach and the last third was a one-way
   slide with nothing left to try.
8. **Their laboratory is steady** (tier jitter from ±40 % to ±15 %): the swings
   should come from the rules, not from the dice.
9. **A weapon they have never seen sends them back to the drawing board**
   (taking the lead restarts their tier clock), **but while they are behind
   they push twice as hard** (`ENEMY_PUSH_PER_TIER` 1): our lead is real, and
   it is temporary.

Everything else was tested and left alone. Growing tile HP per raze, a strike
cooldown, a regroup that returns one tier above us, a softer landing floor and
a heavier upkeep all moved the six seeds by nothing worth a rule.

### Sim after the pass (auto quartermaster, seeds 1 to 6)

| seed | length | behind | ahead | lead changes | plates lost | their tiles razed | island silent | doomsday |
|---|---|---|---|---|---|---|---|---|
| 1 | 21m15s | 42 % | 23 % | 2 | 21 | 16 | 7 % | 86 % |
| 2 | 20m37s | 40 % | 24 % | 2 | 23 | 17 | 7 % | 86 % |
| 3 | 20m13s | 42 % | 23 % | 2 | 24 | 15 | 8 % | 87 % |
| 4 | 21m53s | 42 % | 22 % | 2 | 24 | 15 | 7 % | 87 % |
| 5 | 20m02s | 43 % | 24 % | 2 | 20 | 14 | 8 % | 85 % |
| 6 | 21m13s | 40 % | 22 % | 2 | 24 | 15 | 7 % | 86 % |

Before, on the same faithful sim and the old rules: 18 to 20 minutes, behind 25
to 51 %, ahead 0 to 10 %, 12 to 23 plates lost, 16 to 23 of their tiles razed,
island silent 0 to 21 %. Every seed is now inside the window asked for: silent
under 10 %, behind 40 to 60 %, ahead 10 to 25 %, at least two lead changes, 15
to 30 plates lost, 18 to 26 minutes, doomsday at 85 %.

### What this pass did not solve

- **Lead changes stay at exactly two.** Every run has the same shape: we lead
  the first third, they take the lead and hold it. More flip-flopping needs a
  longer war or a weaker research rule, and a weaker research rule takes
  "behind 40 to 60 %" with it (reverting `RESEARCH_CATCHUP` alone drops behind
  to 8 to 16 %). Ola's "ups and downs" are one up and one down, not four.
- **The raiding party is still the strongest button in the chapter.** With
  `--raid` five of six seeds move by a point or two, but one (seed 6) falls to
  behind 20 % and 14 plates lost. Its price curve deserves its own pass.
- **The war is bistable around the first plate we lose.** A plate razed means
  fewer people, less science, a slower answer, and more plates razed. It reads
  well, the war turns and stays turned, but it means a helper that prevents the
  first loss would flatten the whole chapter.

## Playtest 3 (2026-09-22), war-playtest-3 branch: one thing at a time

Ola and a tester played v1.42.0. What worked: the enemy appearing, building,
gathering and attacking ("SKITBRA"), kept exactly as it is. What did not:
everything else arriving at once, guards that stood still, troops dying at sea,
a ◆ button that often did nothing, a quartermaster that spent your arms and
struck when you did not want it to, two sliders, and a tier button so early
that the tester bought four or five tiers before knowing what one did.

### Disclosure (war.js `REVEAL_ORDER`, `revealNext`)

At war start only the arms slider, shield, sword and the war room. Then, at
most one per `REVEAL_GAP_S` (6 s), each greyed until affordable and never
closed again: strike (force > 0), ◆ (first landing), radar (second landing),
intel (radar bought), raiding party (first strike), tier (`TIER_REVEAL_S` 180 s
AND `TIER_REVEAL_LANDINGS` 4), quartermaster (tier II), auto strike (tier III),
air defence (their first air wave; commit 2). The sim opens controls with the
same function, so the sim player cannot research before the button exists.

### Rules that changed

1. `TIER_COOLDOWN_S` 45 to 90 and `FIRST_TIER_PREMIUM` 1.5 on tier II: a
   banked chapter II science pile can no longer buy the ladder in a minute.
2. `ENEMY_FIRST_TIER_S` 200: their laboratory opens just after ours can. With
   the old 75 s they were two tiers up before our button existed, and every
   seed was a rout (behind 93 to 98 %).
3. **Their clock no longer restarts when we take the lead** (rule 9 of the
   previous pass is gone). With a 90 s cooldown the restart made any lead of
   ours permanent: they caught up in about a minute, stood level until our
   cooldown ended, and fell behind again (behind 0 %, ahead 40 %, one plate
   lost). Instead their laboratory is a little faster: `ENEMY_TIER_BASE_S` 95
   to 88.
4. The quartermaster buys at a stance ratio (`STANCE_RATIO`: shield 3:1, scale
   1:1, sword 1:3, or off), keeps `QM_KEEP_S` 15 s of arms production in the
   yard (`quartermasterBudget`), and never strikes. The sim player now keeps
   that reserve for repairs, strikes by hand when the button shows ✓, and
   fortifies unhit plates only from surplus above the reserve.
5. `hpYield`: a damaged plate's people earn, research and move in at its share
   of HP; stores sell at that share. The sim weights income and science the
   same way.
6. Research is fixed at half during the war (the industry/research slider is
   hidden), which is what the sim always assumed.

### Sim after commit 1 (auto quartermaster on the scale, seeds 1 to 6)

| seed | length | behind | ahead | lead changes | plates lost | their tiles razed | island silent | doomsday | we reach V | behind after V |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 21m51s | 42 % | 14 % | 2 | 18 | 10 | 0 % | 87 % | 7m31s | 64 % |
| 2 | 21m31s | 44 % | 16 % | 2 | 19 | 11 | 0 % | 87 % | 7m31s | 67 % |
| 3 | 20m31s | 43 % | 16 % | 2 | 19 | 9 | 0 % | 87 % | 7m31s | 68 % |
| 4 | 20m31s | 43 % | 18 % | 2 | 17 | 11 | 0 % | 88 % | 7m31s | 68 % |
| 5 | 20m31s | 40 % | 19 % | 2 | 18 | 11 | 0 % | 85 % | 7m31s | 63 % |
| 6 | 20m11s | 42 % | 15 % | 2 | 21 | 10 | 0 % | 87 % | 7m31s | 67 % |

With `--raid` all six stay inside the time and behind windows (behind 42 to
45 %), plates lost 12 to 17. The shape is the same as before: we lead after the
first tier, they take the lead in the middle and hold it. The window is narrow:
`ENEMY_TIER_BASE_S` 92 drops two seeds to behind 25 %, 85 lifts them; the war is
still bistable around who holds the tier when the ladder gets expensive.

### Commit 2: air defence, the uphill after artillery

Ola: "after artillery the game is over, only mop-up". From their tier V
(`waveMode`): two waves in three come through the air (their tier's mode,
ranged or area) and every `GROUND_EVERY` (3rd) wave is still a landing party.
Air waves ignore the guards; only air defence absorbs them, by the same rule
(`MAX_ABSORB`), at `AIR_UNIT_COST` 20 arms a unit. What gets through kills
`AIR_GROUND_KILL` (0.1) guards per unit of power. `resolveLanding` takes
`airDefence` and `mode`; `landingLosses` gives the share the visuals script as
shot down. The quartermaster (and the sim player) buy `AIR_PER_GROUND` 2 air
units per guard once the air control has opened (first air wave). Air units
eat and cost upkeep like any unit.

Item 14 of the playtest ("the enemy is still easy") asked for more pushes if
the sim was still under behind 40 %. It is not (40 to 43 %), but the extra push
while we lead (`isPush`: every 3rd wave while our tier is higher, on top of
every 5th) went in anyway because it only bites in the situation the tester
called easy; in the sim it moves nothing by more than a plate.

| seed | length | behind | ahead | lead changes | plates lost | their tiles razed | island silent | doomsday | behind after our V |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 21m51s | 42 % | 14 % | 2 | 19 | 10 | 0 % | 87 % | 64 % |
| 2 | 20m51s | 42 % | 17 % | 2 | 25 | 11 | 0 % | 85 % | 66 % |
| 3 | 20m31s | 43 % | 16 % | 2 | 21 | 9 | 0 % | 88 % | 68 % |
| 4 | 20m11s | 42 % | 19 % | 2 | 18 | 11 | 0 % | 86 % | 67 % |
| 5 | 20m31s | 40 % | 19 % | 2 | 22 | 12 | 0 % | 87 % | 63 % |
| 6 | 19m51s | 41 % | 15 % | 2 | 21 | 10 | 0 % | 85 % | 66 % |

We reach tier V at 7m31s in every seed. A player who never buys air defence
(`AIR_PER_GROUND` 0) loses 24 to 28 plates instead of 18 to 25: air defence is
a real second purchase, not decoration. With `--raid`: behind 41 to 44 %,
plates lost 15 to 27.

### What this pass did not solve

- **The late war is a siege, not a race.** Once they lead (around minute 9)
  the research pressure (×1.9 per tier they hold) keeps us behind until they
  leave; we never raze another of their tiles after that in the sim (their
  shield outgrows our force). The climb after V is defending (◆, guards, air
  defence), not catching up. A way back up the ladder (a catch-up discount, or
  salvage buying research) would be the next lever if Ola wants the ups and
  downs back.
- **The sim player has no banked science**; a real player arrives with tens of
  millions from chapter II. With the 90 s cooldown that no longer lets anyone
  buy ahead, but the first tier at 3:00 is always affordable for a human.
- **The right-hand column is long** once every control is open (tier, intel,
  radar, raid, quartermaster, auto strike, strike, sword, air, shield, stall):
  on a 900 px high window it reaches the people counter.

## Playtest 4 (2026-09-22), war-playtest-4 branch: nobody fires at a boat

Ola, v1.44.0: very pleased with the war and its levelling; one bug and two wishes.

- **Fighting happens on land only.** A crossing has one water leg, between the point it leaves their coast (`crossFrom`) and the point it reaches ours (`ourCoast`). `onIsland(path, seg, t)` says whether a dot is past the later of the two, in either direction. Our guards meet a landing only when it is ashore on our island; their dots meet our strike only on theirs; the scripted losses (what the rules say falls) fall only there. Enemies that are themselves crossing or standing on our plates do not shoot.
- **Reach decides the picture.** Fists and swords (reach 0): the clinch, a small burst where the dots touch, never a line. Gunpowder and up: tracers, from a defender on that island (the nearest guard, or the nearest of their dots), else from a point inland.
- **Pause** is a shell feature (`window.__rpiPaused`, main.js): the loops keep ticking but return early, so game time and the war clock stand still and resuming is instant; saving continues. Chapter cards are not paused.
- **Debug** is reachable only by `?debug` or five quick clicks on the version label.

## War by boat (2026-10-03, v1.64.0)

Ola: "mer verkligt, mer känsla". The war should move like the neighbour's raid
in chapter II: nobody walks on the water.

- **Their landings** (`launchWave`, melee): sighted → the party musters from the
  tiles nearest their pier to the coast road beside it (`musterLanding`); the
  boat casts off when the four-second warning is up (`onCastOff`, the radar line
  "their boat has left the pier"); it sails the **water lanes** (a rectangle
  round each island, off the coast by the island's pad plus 14 px, the channel
  between the islands on the facing side) to the beach nearest the plate; the
  party steps ashore in pairs and walks the streets. Crossings take
  `sailSeconds` (5 to 9 s by distance). Push waves fill a bigger hull. One boat:
  landings queue on the pier.
- **Our strikes** sail from **our pier** (built from JS at war start, south coast
  near the south-west corner) to the shore of their island nearest the tile. The
  survivors (`onImpact` returns the share) walk back, sail home and go indoors;
  `onHome` fires at our pier. The force counter waits for them; the rule does not.
- **Guards** respond as the boat casts off and stand on the beach; the shore walk
  marks its first leg as water (`crossFrom` 0, `ourCoast` 1), so `onIsland` and
  every fight and scripted loss start at the first step ashore. Losses fall on the
  beach and the first street.
- **Beats**: the first landing sails 9 s and holds its impact one second; three
  seconds of nothing after the first landing before the next control; every
  control arrives with `arrive()` and its war-room line (the six-second
  `REVEAL_GAP_S` already gives more than the 1.2 s beat asked for).
- Air waves and ranged strikes stay arcs. No rule changed: `sim-phase3.mjs 1`
  prints the same line before and after.

Open: the two islands nearly touch at 1440 px (our pad 48 + their pad 50 against
the 96 px margin between the grids), so the channel is a strait a hull's width
wide and their pier ends on our beach. Widening the margin is the islands' job
(CAPITAL), not the war's (B203).

## The end of the war (2026-10-03, v1.70.0, batch 5)

Ola's playtest of v1.65 to v1.68. No rule changed (`sim-phase3.mjs 1` prints the same line).

- **Nothing to strike.** Their civil tiles (houses, store) are never targets: we do not bomb
  civilians. With every military tile razed the crosshair says so (factory icon, "military
  structures destroyed") and the war room says it once per silence.
- **On land.** The coast road is a rectangle round the plates, and since the islands grew its
  corners (and the outermost streets) lay over the water where the coast curves in. `ants.js`
  now gets both islands' coast vertices (`getCoasts`, from `islands.js coastPoints` with the same
  shapes the islands draw) and a `landKeeper` moves any road, street or guard point that is not at
  least 8 px inside the coast toward the island's middle. A ring carries it as `R.land`, so
  `ringPoint`, `landingRoute` and `crossPath` stay on land without their callers changing. A
  boat comes in from its lane to 12 px off the `shoreline` and the party wades ashore there
  (`ashorePath` with a beach: the water leg is boat to shoreline, `onIsland` from the beach on).
- **The ending, spaced.** From doomsday 55 % four climate lines, at least 24 s and 6 points of
  doomsday apart (`climateTick`). While a climate line is fresh (20 s) background lines wait
  (`logWar(..., { hold: true })`: reveals, radar calls, doom statuses, a plate that stood; reveals
  themselves wait too) and then come out one a second, six seconds before the next climate line;
  a radar call that waited is dropped. The leave stages (`leaveTick`, all on `w.t`/`w.leaveAt`,
  so a reload resumes): 0 withdraw → 1 ignition (5 s) → 2 lift-off → 13 s → 3 rubble and "Our
  scientists..." → 10 s → 4 "We have not had the resources to do the same." → 8 s → 5 "But there
  is a secret plan." → 6 s → 6 "Go deep." and the facility → 6 s → 7 the shovel (`arrive()`, still
  gated on salvage). The sound reads the same stages (2 and up is the drone). A save from before
  (`w.endV` unset) at the old stage 3 goes to 7. The IV card: dark, slow, silent, `pause` 1400,
  `hold` 7000.
- **The facility.** The bottom-right plate becomes chapter IV's building seen from above (colours
  from `deep-machine-12.html` / `machine-model.js`: plate, rock-dark hatch #0a0d12, bar #d5dbe3,
  joint #5b6676, steel tube with a soft glow, exhaust #3a434f, smoke #c6cfd9), pure CSS on
  `.deep-facility`; re-added when the plate re-renders.
- Open: the gather into the hatch still often ends on its 20 s fallback (about 50 of 60 people in).

## The armory (2026-10-03, v1.81.0, B220)

Ola: "Our soldiers come out of a store. We should add a separate building that is an armory for
our side." Until now a guard appeared on the south coast from nowhere and a strike mustered from
the three bottom-row plates nearest the pier, so our soldiers walked out of shops and houses.

- **Where.** `startWar` (and, for a war saved before, the load) turns the empty plot nearest our
  pier into the armory; with none free, the nearest standing home or store; with none of those,
  the nearest apartment, super store or skyscraper. Never the factory, the bank, a district, a ruin
  or the last plot (the hatch). `chooseArmoryPlot(buildings, pierRect, slots)` in ants.js is the
  pure choice. A home's people move into the town's free room; whatever does not fit is not
  rehoused (there is no rule for it, B210). The building is `{ type: 'armory', was }`; the war
  keeps `w.armory = { id, was }`.
- **Look.** Our light blue plate, a Lucide castle in our blue (their tower is a castle too: the
  military glyph is the same on both islands, the colour says whose), no ring, a badge with the
  soldiers stationed (defence plus the force at home, `formatCount`), the ◆, no sell. It pops in with
  `arrive()` (the war's 'reveal' word) as the card lifts; the war room names what was there.
- **The picture.** `ants.js`: `barracks()` is the armory, or while it is down the standing plate
  nearest our pier; `gate()` is the way out of it (`plateExit`: down to the street under its row,
  an inner plate by the street on its left, onto the coast road). New guards walk out through the
  gate one after another and on to their posts; guards no longer counted walk back in; at the end
  of the war they go in and on to the hatch. A sortie musters from the gate along the road to the
  pier; the survivors walk from the pier back in.
- **Targeting.** `pickTarget` sees the armory as an apartment (value 2) through `warPlates` in
  index.js; war.js does not know it. Its HP is war.js's default (10 plus fortification). Razed, the
  war room says "Status: the armory is lost. Our soldiers have nowhere to gather."; the clear
  button (30 % of what stood there, a home's price for a plot) raises the armory again, not the
  old building.
- **No rule changed.** Defence and force are the same with or without the armory; it is where they
  come out and go in. `sim-phase3.mjs 1` prints the same line before and after.
- Open (B210): the default HP, people who do not fit when a home is taken, the first steps of a
  soldier cross the plate from its middle like every walker's.


## GO DEEP: the chosen few (2026-10-06, v1.88.0, B211 to B216)

Ola played the whole war and was happy with it; the ending bounced: "Everyone walks down into the
deep, but only 216 arrive." The story now says why: the shelter takes only a few, the richest and
most successful. No rule changed (`sim-phase3.mjs 1` prints the same line).

- **The shovel** says "GO DEEP" (aria-label "Go deep"), greyed with the salvage cost until ready as
  before. Like the buttons before it, it never says the chapter changes. The "Unfinished" gate is no
  longer asked (the markup and `deepGate.js` stay for the DEEP session, B217).
- **The line before it** is "But a few have a secret plan." (then "Go deep." as before). No new lines
  before the shovel.
- **The click** (`goDownTogether`, once: `w.goingDown`, `shipChosen` saved first so a reload goes
  straight down) runs on its own clock, the steps kept in `window.rpiGoDeep`:
  0 s every control leaves (`leaveControls`: the war HUD, the doomsday clock, the plates' buttons
  together, the button column, the shovel last; 0.8 s each, 60 ms apart, `translate` so their own
  transforms stay; `#phase-city.going-deep` takes the clicks) → 1.3 s the hatch opens
  (`.deep-facility.open`: the bar slides off, the hole widens 46 → 54 %, 1.2 s) → 1.7 s "Status: the
  shelter takes only a few. The richest. The most successful." → 2.3 s the chosen few set out →
  6.6 s "Status: they go down to wait until the earth can be lived on again." → the last one down
  (and at least 2.5 s after the second line) the hatch closes → 1.2 s + 1.5 s of stillness → the card
  path exactly as before (city.stop, war.finale('fall'), war.stop, goDeep), the people left behind
  dimmed to 55 % as it fades in. Measured in headless Chrome from iii-end: last one down 11.3 s,
  the card 14.0 s. A fallback brings the card at 25 s whatever happens.
- **Who goes** (`ants.js`): `chosenCount(n)` is about one in five of the people on the map, at least
  three, at most twelve; `pickChosen(people, n, rng)` (pure, tested) ranks by how high they live
  (district, skyscraper, apartment, home) and then whether they are at home, never a car, never more
  than 15, ties by `rng`. `gatherChosen(slot, n, onDone)` first leaves out anyone farther than 620 px
  of street from the hatch (unless that leaves too few), so the walk stays calm. Someone inside a
  building leaves from their home; someone on a street finishes the walk, steps in for 0.3 s and
  turns for the hatch. Each walks at a pace (18 to 80 px/s) that brings the nearest in 4 s after
  setting out and the next ones about 0.45 s apart, so they go down one by one; on the facility a
  chosen dot fades only in the hole. Everyone else stops where they stand. `gatherAt` (everyone,
  guards too) is unchanged for other callers.
- Open: no sound for the hatch (B218); after a reload past the launch their red walkers come back on
  the rubble island (B219, seen in iii-end).

## The interim (2026-10-09, v1.90.0, B450 to B454)

Ola's design: between the war and the deep, one short scene decides which chapter IV the player
gets, the vault (src/phase4v) or the dig (src/phase4d). Ola's words, kept: "As the Earth fails
there is a divergence in the path of destiny and a choice has to be made. In one reality there
was a drone. In the other a Vault." Destiny points to one, "but you may choose to oppose".

- **The hand-over.** GO DEEP's walk is unchanged up to the card. `goDeep()` keeps its import guard,
  then plays a black, slow, silent card with no numeral, INTERIM (hold 4 s, a click ends it). At
  its midpoint the interim screen is built under the card (z-index 999); when the card lifts it is
  raised above it (1100, under the ☰ menu at 1500) and the typing starts. The war's E♭ still falls
  to D under the card; the interim itself is silent but for the match.
- **The screen** (src/interim.js, style-interim.css): the vault's CRT (VT.crt phosphor, its glow,
  its scanlines, a block cursor), full-bleed black. The script and its rests: "As the Earth fails"
  900 ms "there is a divergence in the path of destiny" 900 ms "and a choice has to be made."
  1400 ms / "In one reality there was a drone." + the drone icon (Lucide Drone, else Bot) 900 ms /
  "In the other, a vault." + the vault icon (Lucide Vault) 1400 ms / "Destiny points to " and the
  needle: the two icons light in turn, slowing (55 ms, ×1.17 a flick) for about 2.4 s, and settle
  on one (Math.random, 50/50) / "the drone." or "the vault." 1000 ms / "But you may choose to
  oppose." Letters 28 ms, spaces 45 ms. Then two controls: a round button with chapter I's three
  glyphs (gem, file, scissors; tooltip "Oppose", Space) and "Continue" (Enter). Space is taken
  before main.js's pause while the choice is up.
- **The match.** YOU and DESTINY (dymo labels) face each other with a slot each; three hand buttons
  below. The player picks, Destiny's hand (uniform) shows at once, and the slots take chapter I's
  look: the winner bold with a ring, the loser faded and smaller, a draw quiet. Draw: "Again." and
  the hands reset. Win: "You win. The path turns." and the other icon lights with a short flicker
  (0.7 s); audio.pling. Loss: "Destiny holds."; audio.knock. Exactly one decisive round.
  Continue: "So be it." Then 1.2 s, the fade to black (1.5 s), the screen removed and
  `setPhase(DEEP)` as before.
- **The choice** is written under `DEEP_VERSION_KEY` (drone → 'dig', vault → 'vault', never
  'colony'). The phase 2 save holds `interimPending: true` from the card on (a reload shows the
  screen again, from the top, no card) and `interimPending: false, interimChosen` once decided (a
  reload goes straight to chapter IV). `?deep=` in the URL still wins (B454).
- **Pause** (window.__rpiPaused) freezes the typing and the needle; reduced motion settles the
  needle at once and stops the cursor's blink.
- **Testing.** `window.debug_interim()` from any point of the war (the way down chosen, no walk);
  `window.rpiInterim` = { steps (seconds since the screen was built), setRng, pointed }. The rng
  is drawn once for the needle and once per round for Destiny's hand.
- **Measured** in headless Chrome from iii-end: the card 21.3 s after the click (the walk as in
  v1.88.0), the screen built 4.4 s into the card, the card lifted 6.8 s later; from the lift:
  the drone line 6.2 s, the vault 8.9 s, the needle 10.9 s, settled 13.1 s, the choice 15.3 s.
  A decisive round to black: 0.4 s (loss) or 1.4 s (win) plus 1.2 s, then 1.5 s of fade.
- Open: no typewriter sound (B451, audio.click has no level), the ☰ and pause buttons stay white
  over the CRT (B452), "Destiny points to the drone." stays as typed after the path turns (B453).
