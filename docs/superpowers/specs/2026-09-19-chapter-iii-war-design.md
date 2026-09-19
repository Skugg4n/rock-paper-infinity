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
