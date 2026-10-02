# The neighbour · design (2026-10-02)

Status: **approved by Ola** on `docs/mockups/neighbour-2.html` ("precis så där måste vi jobba
med WAR också"). Backlog B191. Built by the CAPITAL session in chapter II; the WAR session
builds the war's landings and strikes on the same boat afterwards.

## Kort, för Ola

- Öarna rymmer sina hus: samma vobbliga kust, men bucklor bara utåt och mer marginal.
- Grannen bygger i tre akter: bor (hus, butik, fabrik), befäster (kusten hårdnar till en
  vall, vakttorn, radar, kasern, fabriken blir vapensmedja), varv (brygga och båt).
- Soldater gör soldatsaker: går vakt längs kusten i par, står på stranden och ser mot oss,
  samlas vid bryggan. Ingen exercis.
- Räden går med båt. Vårt folk springer in. Vi är försvarslösa tills kriget ger oss soldater.
- Efter räden: båten seglar hem, en paus, sedan kommer svärden.

## 1. Islands (`src/phase2/islands.js`)

- `coastPath` bumps outward only (`bump = 1 + rand() * wobble * pad / min(rx, ry)`), so a
  bump never cuts into the plates. Pads: ours 48 (was 34), theirs 46 (was 30).
- `createIsland({ rampart: true })` adds two paths after the land: a **rampart** band
  (`#islands-svg .rampart`) and an inner land path. `setRampart(level)`: 0 none, 1 a
  narrow band (inner pad − 5), 2 a wide one (inner pad − 10). Tone, no stroke.

## 2. The neighbour's island (`index.html`, `style-stage2.css`)

A 4 × 2 grid of equal tiles in `#competitor-island`, revealed by the existing
`competitor-stage-N` classes (one stage a minute of play, as before):

| stage | tiles | and |
|---|---|---|
| 1 | home (r0 c1) | the island, two civilians |
| 2 | home (r1 c1), store (r1 c2), factory (r1 c3) | six civilians |
| 3 | tower (r0 c0), radar (r0 c2) | rampart level 1; watchmen patrol the coast |
| 4 | barracks (r1 c0); the factory shows an anvil | rampart level 2; some stand on the north shore and watch us |
| 5 | shipyard (r0 c3), the pier, the boat | two watchmen wait at the pier; raids can begin |

**War contract kept.** `enemyTileEls()` still returns exactly five tiles, in DOM order
tower, radar, shipyard, barracks, factory (`.enemy-tile`/`.enemy-factory`, the rocket
excluded); the civil tiles are `.enemy-civil` and are never targets. The name array in the
strike log follows that order. `warReady`, `warChosen`, the swords button and `startWar`
keep their names and meaning.

## 3. Dots (`src/phase2/ants.js`)

- **Civilians** (the existing `enemies`) stroll between all visible tiles, civil ones
  included; counts per stage 2, 6, 5, 3, 2.
- **Watchmen** (new, `watchmen[]`, not the war's `guards`): walk the coast ring of their
  island at 16 px/s in pairs from stage 3; from stage 4 three stand still on the north
  side; from stage 5 two wait by the pier. They are the raiders. In the war they fight
  a landing of ours like the civilians do.
- **The boat** (`boat`): one hull drawn on the canvas, moored at the pier's end. The
  shared building block is `sailBoat(from, to, seconds, onArrive)`: a slightly curved
  course, eased, with the heading along the course and a wake while moving; `boat.aboard`
  dots are drawn on deck. Not tied to the raid, so the war can use it.
- **The raid** (`startAttack(onRazed, onOver)`): muster (watchmen walk the ring to the
  pier and board) → cross (the boat sails to the beach nearest the target, from
  `crossPath`'s landing point) → ashore (they disembark in pairs and walk the streets to
  the house) → raze (as before: the plate goes dark, `onRazed` after 1.5 s) → back →
  home (the boat sails to the pier) → dismiss (back to their posts) → `onOver`.
- **Our people** hurry indoors when the boat is near our coast and stay in until it has
  left; nobody of ours fights. `onIsland`, `launchWave` and `launchStrike` are untouched.

## 4. The beat before the swords (`src/phase2/index.js`)

`warReady` is set from `onOver`, not from `onRazed`: the house falls, the boat goes home,
four seconds of nothing, and then the swords arrive (the button's own `arrive`). The
chapter card for III gets the same drawn-out pacing as the card for II (`pause: 1400`).
Raids repeat every 90 s until WAR is chosen, as before.

## 5. Tests

`islands.test.js`: coast points never lie inside the unbumped outline. `ants.test.js`:
`boatCourse(from, to, k)` starts at `from`, ends at `to`, and bends to the side between.
