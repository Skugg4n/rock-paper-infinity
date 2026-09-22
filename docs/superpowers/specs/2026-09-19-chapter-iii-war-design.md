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
