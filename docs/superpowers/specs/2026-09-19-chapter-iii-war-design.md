# Chapter III · WAR — design sketch (2026-09-19)

Status: **sketch for discussion**, nothing built. Written from Ola's direction and what we
have said so far. Numbers are placeholders to be simulated (`scripts/sim-phase3.mjs`,
not yet written) before any code.

## What Ola has said (so it is not forgotten)

- War means **razing, not capturing** (2026-09-18). Both sides destroy. That is how the
  surface becomes uninhabitable, which is what sends humanity into THE DEEP (IV).
- The opening is the competitor **acting**: red dots cross over and raze one of our outer
  houses; then WAR is **chosen** with the swords button (built, v1.26–1.27).
- War is an **escalation of weapons and defence of different kinds, while keeping income
  and expenses in balance** (2026-09-19).
- The competitor's island **builds over time** (factory → warehouse → radar) before the
  chapter turns (built).
- During war, a **silo** is filled with material/tech/resources; that silo is the ship
  that launches *down* at the end (vision.md, working notes for IV).
- Every chapter is a **layer carried to the end**, not a cliffhanger (vision.md).
- Helpers beside the line come and go; other currencies are welcome (vision.md,
  "The power line and the helpers").
- Icons over text; no tutorial; teasers greyed out before they open; contained
  animations except the ants on the streets.

## The idea that ties it together: rock, paper, scissors comes back

Chapter I's trivial game becomes chapter III's strategy. Weapons and defences come in
**three kinds** that beat each other in a circle, drawn with the same three icons the
player has clicked since minute one:

| kind | icon | beats | in war |
|---|---|---|---|
| ROCK | gem | scissors | heavy: walls, siege, armour |
| PAPER | file | rock | cover: nets, smoke, intel, drones |
| SCISSORS | scissors | paper | cutting: blades, raids, sabotage |

The enemy attacks in **waves** of one kind. A defence of the *counter* kind stops the
wave clean; the *same* kind stalemates (both sides lose some); the *losing* kind lets
the wave through and a building is razed. The player raids the enemy the same way.
Nothing needs a word of explanation: the player already knows what beats what.

This is the layer from I carried into III. The layer from II is the city itself: its
population is the army, its stars and food are the budget, its buildings are what is
at stake.

## The line and the helpers of chapter III

**The line** is military power: `troops × weapon tier`. It only goes up, in the
escalation ladder below. The chapter's avalanche is the tier jumps (each ×3 strength,
×5 cost, Roman numerals on the tier like everything else).

| tier | name (working) | what changes |
|---|---|---|
| I | HANDS | dots fight one on one; fists and sticks |
| II | MACHINES | the factory makes weapons; troops ×3 |
| III | ARTILLERY | waves hit from a distance; buildings can be razed without dots arriving |
| IV | BOMBS | one wave razes several plates; the map starts to burn |
| V | SCORCHED | everything left burns; the surface is finished |

**Helpers** (arrive, matter, are outgrown):

- **Radar** (the enemy built one; we can too): shows the *kind* of the next wave a few
  seconds early. The first helper, cheap, essential at tier I–II, irrelevant once
  artillery hits everything.
- **Walls / nets / blades per plate**: a defence of one kind on one building. Bought per
  plate like the +/− on buildings today, shown as a small icon on the plate's corner.
  Outgrown when waves hit several plates (tier IV).
- **Medics / repairs**: a razed plate can be *cleared* (not rebuilt) for a cost, freeing
  the land. Outgrown when the map is mostly ash.
- **Salvage** — the new currency: every enemy building we raze drops material into the
  **silo** (the same silo idea as chapter II's food, but for the ship). Salvage is not
  spent in III; it is what we take down. Its level is the one number that keeps rising
  while everything else burns, and it is the teaser for IV.

## The balance the player keeps (Ola's "inkomst och utgifter")

- **Troops** are drafted from population: each troop is one person who no longer
  produces stars or science and still eats. Drafting is a slider like the
  industry/research one today: *work ↔ war*.
- **Weapons cost stars up front and upkeep per second**; tier research costs science.
- **Food**: an army eats; the silo of food from II is now also the army's supply. Starve
  and troops desert (dots walk home).
- **Loss**: every razed plate is lost income forever (no rebuilding: scorched earth).
  Too little army → the city burns; too much army → the economy starves the city. The
  interesting region is in between, and it moves as the enemy escalates.

## Enemy behaviour (a clock, not an AI)

- Waves every `T` seconds, `T` shrinking from 45 s toward 15 s; wave size ×1.3 per wave;
  wave kind: random, but the radar shows it.
- The enemy escalates tiers on a schedule (every ~4 minutes), slightly *ahead* of what a
  balanced player can afford: the player is always catching up, never safe.
- The enemy island mirrors our city: plates appear as it builds, burn as we raze.
- No enemy AI beyond this. The tension comes from the clock and the triangle.

## How it looks (icons only)

- The city and the island stay where they are. The strip between them is the front:
  dots meet on the street, the losing dots vanish, a small flash where they meet.
- Waves: a cluster of red dots leaves the island with a kind icon above it (gem / file /
  scissors), walks the street to a target plate whose ring turns the wave's colour.
- Defences: a small kind icon on a plate's corner (like the + today). Correct counter →
  the wave dissolves at the plate edge. Wrong → the plate is razed as in the opening.
- Tier research and troop buttons live in the right-hand column like II's upgrades,
  greyed until affordable, Roman tier numerals.
- The silo of salvage grows in the top right. Burnt plates stay black. The background
  darkens by a few percent per razed plate; at tier V it is night.

## How it ends

There is no victory. The war ends by **exhaustion**: when a set share of *both*
surfaces is burnt (say 70 %), the ship button appears greyed (teased), and opens when
the silo holds enough salvage. Pressing it plays `IV · THE DEEP` (title working). The
salvage level becomes the starting stock of IV, the way stars carried into II.

## What we simulate before building

`scripts/sim-phase3.mjs` with: wave clock, three kinds, tiers, draft slider, upkeep,
starvation, salvage. Targets: 15–20 minutes; the player loses plates steadily but never
everything before tier IV; at least three moments where a tier jump flips the balance
(the cascades of this chapter); the silo fills in the last third.

## Open questions for Ola

1. Is bringing rock–paper–scissors back as the weapon triangle the right idea, or too cute?
2. Draft slider (work ↔ war) versus buying troops one by one like buildings?
3. Do we raid the enemy actively (send our dots), or only defend and let artillery raze
   their side automatically once tier III is reached?
4. How dark should it get? Full night at the end, or keep the slate palette and let the
   black plates carry it?
5. Titles: THE DEEP for IV is a working title; III's opening card already says WAR.
