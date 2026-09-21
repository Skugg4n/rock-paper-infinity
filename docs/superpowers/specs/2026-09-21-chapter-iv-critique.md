# Chapter IV · THE DEEP · critique (game-design consultant, 2026-09-21)

Moved out of the design sketch so the sketch stays readable for Ola. Read the sketch first.

Read against vision.md; numbers from running `scripts/sim-phase4.mjs` as it stands.

### 1. Is the idea new, or does it collapse?

As written it collapses. Cryo I–IV at 5k / 60k / 800k / 12M stars is a time-warp bought
with the main currency: Cookie Clicker's time machine, AdVenture Capitalist's time warp.
"Time cannot be bought" is not true in the build: you cannot buy the ring, but you buy
the rate at which you spend the clock, which is the same purchase one step removed. Each
sleep is a run, the wake-up panel is the reward screen, upgrades carry over: a prestige
loop wearing a parka. Rooms plus crew plus flooded chambers plus mutiny is Fallout
Shelter's vocabulary; the only thing keeping it out is that crew is pooled and never
assigned. Keep it pooled, and never let the player click a person. Two twists, either
one enough, both better:

**A. Sleep is a program you write, not a button you press.** Before freezing, fill a
short icon queue: when minerals > pip, build mine; when food < pip, wake. The hatch
closes and you cannot intervene for a century. The skill is writing an autopilot that
survives 100 years alone, which the doc claims and does not implement (precedent:
Paperclips' investment engine, Kittens' automation).

**B. Sleeping costs people; only waking grows them.** Sleep is free money today. Make
each slept year cost ~0.5 % of the colony permanently while growth (2 %/year) runs only
awake. Every press becomes a dilemma with no dominant answer: arrive early as a machine
with a skeleton crew, or late with a crowd. Two endings off one number, no text.

### 2. The loop, minute by minute

**First five minutes.** 0:00 the boom seals the shaft, ants walk down, salvage is a
mineral count, one dig glyph blinks once on the rock face. 0:00–0:20 the toy: press
rock, a chamber opens, rubble falls, a number moves, and it must feel like the RPS click
of chapter I or the chapter has no toy. 0:20–1:30 the staircase: dig, place room, the
weakest of four columns takes the marker, dig what it points at; six to eight purchases
in seventy seconds. 1:30–3:00 the first stall, twenty to thirty seconds with nothing
affordable: the stop cue, with the greyed snowflake already on screen so the stall
points somewhere. 3:00–4:00 the first sleep, one month, the counter spins, the ring
twitches. The sim buys cryo I at 1:20, before any stall, so the relief lands before the
need; push it to ~3:30.

**Mid-chapter wake-up (minute 9, year 40, one year slept).** The counter decelerates to
a stop, four columns show what accumulated, a chamber or two sits dark with a fault
glyph, the ring's new arc stands against a ghost of last press. Decisions: repair or let
it compound, spend on the weakest column or the next cryo tier, re-arm the queue.

**Dead stretches, measured.** Minutes 5–14 of the sim are one move repeated: dig, dorm,
dig, dorm. Minutes 14–19 are pure waiting on the ring. Stars per day goes 200 to 213
across the whole chapter, so the power line is flat and the 10³–10⁴× target is missed by
three orders of magnitude. 1058 wake-ups against a target of 40–60. Humans fall from 50
to 21, because the starting dorm caps at 20 and cryo freezes the 2 %/year growth: the
colony is awake for three of its 347 years. The cause is structural.
`stars = 10 · min(M, F, E, H)` mixes three geometric terms with one that can only climb
while awake, so the marker locks on H on day one and never leaves (H is weakest 1143
days out of 1148). A min() of four only walks if all four climb at the same order. Fix
before any UI: make H a multiplier on min(M, F, E), or carry growth geometrically
through dorm capacity. Cryo IV is mis-shaped too: 36 500 days per press covers the whole
350-year chapter in 3.5 presses; the top tier should still need ~15 presses.

### 3. Steps 4 and 5: the fault budget

One mechanic, three faces, all scaled to sleep length and traceable to a number the
player set. **Faults per wake-up** = ceil(daysSlept / 90), capped at 6, minus one per
automation level on the affected room: sleep longer, wake to more damage.
- **Flood** (early): the chamber is dark and offline until repaired with minerals.
- **Mutiny** (mid): not a die roll. Pressure = 1 − awakeDays / (3 · years). Sleep
  greedily and the bar fills; when it tops, a chamber turns red, keeps its output, and
  takes a neighbour every following wake-up until paid in stars or walled off and lost.
- **Animals** (late, under 35 % surface): they come *down* the shaft, only possible
  because the surface is healing. They eat food, then (after a trap room) they are food,
  then they are **samples**. Chance per wake-up = (35 − surface) / 35.

Step 5 falls out: the ascent costs minerals + energy + people + samples, and the mutiny
chambers decide how many climb. The ending is the sum of every sleep taken.

### 4. The five open questions

1. **Side view.** Down is the subject, and a crust band at the top keeps the goal above
   the play area at all times. A plate grid just repeats II.
2. **Two currencies, as proposed.** Minerals buy rock, stars buy time and tech: min()
   stays about production, stars stay the line carried down from I–III.
3. **Mutiny as a visible faction**, a red chamber that spreads, never a wake-up event.
   Chapter III's complaint was precisely that unseen things happened.
4. **Green choice, inverted.** Not a hidden penalty on the heal rate (invisible equals
   random) but a **solar shaft**: drill one hole up for cheap energy, and that hole is
   how the animals get in. Reopening the surface becomes a decision with a picture.
5. **Animals both, in order:** nuisance, hunt, sample gate.

### 5. What would make Ola say "för random"

- **Hidden probability tables at wake-ups.** Every fault must derive from sleep length,
  automation level or awake time, with its driving bar on screen as the sleep is chosen.
- **Four numbers moving at once.** Colour exactly one thing, the shortest bar. Two
  coloured things and causality is gone.
- **A ring that moves invisibly.** Drain it live during the sleep zoom in step with the
  day counter, leaving the old position as a ghost arc so presses compare by eye.
- **Automation with no tell.** When a room automates, the ants stop walking to it: that
  explains "runs without people" and needs no words.

The strongest move available: play the wake-up as a three-second replay of the century
at 4x instead of a summary panel. The chamber goes dark and its column drops in the same
frame, so cause and effect touch on screen. Spaceplan's register, and the cheapest way
to show a hundred years without a line of text.
