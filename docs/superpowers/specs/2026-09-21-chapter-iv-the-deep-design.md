# Chapter IV · THE DEEP — design sketch v1 (2026-09-21)

Status: **sketch for discussion**, numbers in `src/phase4/deep.js` + `scripts/sim-phase4.mjs`,
no UI. Ola's direction from 2026-09-21 first, then the proposal, then open questions.

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
Cryo is a room and a purchase ladder: cryo I sleeps 1 month per press, cryo II a year,
III 10 years, IV 100 years. A press zooms (the day counter spins, the ring drains a
little), slows, and the people come out. The player's real time per century falls from
hours to seconds across the chapter: the same escalation as stars in I.

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
