# Start screen (title screen) — design

**Date:** 2026-10-12 · **Backlog:** B456 · **Look locked:** `docs/mockups/start-screen-3.html` ("the hole"; 1 and 2 were the alternatives not chosen)

## What

A start screen in front of the game, every time the page opens. Ola: "the feeling of rock paper scissors, with a hint that it goes deeper." Clean. Top to bottom:

1. **The cycle:** rock, scissors, paper as chapter I's round buttons, turning slowly in a ring (one turn in 48 s, no turning under reduced motion). In the middle, behind the hands, a small black hole with two faint halos. When the pointer rests on the ring the hole grows, rests a moment, then eats the dark halo, the light halo, the dashed ring and at last the hands, which turn to ghosts (pale outlines) in the black. The pointer leaving brings it all back. That is the whole hint: the abyss, in small.
2. **ROCK PAPER INFINITY** (Bebas Neue, no commas), written out a letter at a time (70 ms a letter, starting 300 ms in; at once under reduced motion). Clear air under it before Continue.
3. **CONTINUE** (big word, a short underline that widens on hover) with a small line under it saying where the game is, e.g. `IV · Deep, the drone`. Only when there is a game to continue.
4. **NEW GAME** (small caps, grey), with more air above it than the line under Continue has, so the two never read as one pattern.

**A new player** sees less: the cycle, the title, and the big word **START** where Continue would be. No New game line, no list. Start does what New game does (no question to ask: there is nothing to erase). `start-screen-3.html?new` shows it.
5. **The acts** you have reached, one row each, roman numeral + name. Nothing you have not reached is listed, with one exception (the other chapter IV, below).
6. Bottom left **Sound · on / Music · on** (click toggles, same as the ☰ menu). Bottom right **A game by Ola Belin** and the version.

Enter = Continue (New game when there is nothing to continue). The first click anywhere unlocks the browser's audio (audio.js already listens for it), so the chapter cards can sound from the start.

## The acts list

| Row | Shown when | Click |
|---|---|---|
| I Trivial | always once a game has been started | play I again from its start |
| II Capital | reached | II from its start (`ii-start`) |
| III War | reached | III from its start (`iii-start`): the war, then the interim, where the fork is chosen |
| IV Deep · Drone | drone OR vault reached | the dig from its start |
| IV Deep · Vault | drone OR vault reached | the vault from its start |
| V Unity | reached | V from its start |
| VI Infinity | reached (the VI card has played at the end of V) | nothing; grey. The tease |

The two IV rows appear together as soon as either is reached. The one not chosen in the interim is **grey** and not clickable, with no explanation (Ola: the war's replay leads to the fork, and the player will find that). Once both have been reached (across replays) both are black. The row the game is in now has its numeral at full strength; the others' numerals are dimmed.

Clicking an act while a game exists asks first (the game's own confirm style, not `window.confirm`): `Starting III · War again replaces your game.` with **Play again** / **Keep**. Then the act's chapter card plays and the act starts, exactly as if you had arrived there. Clicking the row you are already in equals Continue.

## Where the game is (the Continue line)

From `rpi-phase` and the saves: INDUSTRY → `I · Trivial`; CITY → `II · Capital`, or `III · War` when the city's save says the war is on, or `The fork` while `interimPending`; DEEP → `IV · Deep, the drone` / `IV · Deep, the vault` from `rpi-deep-version` (`colony` → `IV · Deep`); UNITY → `V · Unity`. Continue calls `setPhase(savedPhase)` with no card, as the bootstrap does today.

## Reached: one new key

`rpi-reached` = JSON array of act ids: `trivial, capital, war, drone, vault, unity, infinity`. A set, never a maximum: replaying II does not forget IV. In `KEEP_KEYS` (survives New game and checkpoints), along with the audio, debug and deep-version keys.

**Marking.** `markReached(id)` in `src/start.js`.
- `playChapterCard` marks by roman: I → trivial, II → capital, III → war, V → unity, VI → infinity. (IV is not marked by the card.)
- The interim's `writeChoice(act)` marks `drone` or `vault`.
- New game marks `trivial`.

**Migration, first load with no `rpi-reached`:** derive it from what exists: `rpi-save` → trivial; `rpi-stage2` → capital, and war if that save says the war is on or `interimChosen` is set; `rpi-deep-dig` → drone; `rpi-deep-vault` → vault; `rpi-deep` (the colony) → nothing new; `rpi-unity` → unity; `rpi-phase` DEEP/UNITY → the act it names. Write the key. Ola's own games show the right list without doing anything.

## New game

If a game exists: `Your game will be erased.` with **Start over** / **Keep**. Then clear every `rpi-` key except `KEEP_KEYS`, `rpi-reached` and the `rpi-slot-` snapshots (the same rule as the checkpoints' `clearAll`), mark trivial, play the `I · TRIVIAL` card, `setPhase(INDUSTRY)`. The old "fresh player" test in `main.js` goes away; the card is the start screen's job now.

## Starts for the acts

Existing checkpoints: `i-start`, `ii-start`, `iii-start`, `iv-dig-start`. New, in `src/checkpoints.js` next to them: `iv-vault-start` (clearAll, `rpi-deep-version` = vault, `rpi-phase` = DEEP, no vault save: the vault starts fresh) and `v-start` (clearAll, `rpi-phase` = UNITY, a fresh unity save from `fromVault` with the vault's default sleepers). `iv-dig-start` also writes `rpi-deep-version` = dig when the start screen uses it. The start screen plays the act's chapter card (`II · CAPITAL`, `III · WAR` dark, `IV · DEEP` dark slow, `V · UNITY` dark) and then `setPhase`. The ☰ test menu keeps using the same checkpoints.

## Code

- `src/start.js` — pure, tested: `startModel(storage)` → `{ continueTo: { phase, label } | null, acts: [{ id, roman, name, state: 'now' | 'reached' | 'grey' }] }`, `markReached`, `reachedSet`, `migrateReached`, `continueLabel`. DOM: `showStart({ onContinue, onNewGame, onAct })` builds the screen on `document.body` (like the interim), returns `{ lift() }`. Rows and labels are the strings above, written once in this file.
- `style-start.css` — the look, scoped under `.start-screen`. Chapter I's palette (slate 100 / slate 900), Bebas Neue for the title, the word CONTINUE and the numerals.
- `main.js` — `bootstrap()`: icons, then `showStart`, then what the player chose. The screen is skipped with `?go` in the URL, which the headless play scripts and the ☰ "Jump to" reload with, so nothing that drives the game by URL breaks.
- `src/chapterCard.js` — one line: mark by roman. `src/interim.js` `writeChoice` — one line.
- `index.html` — ☰ menu gets **Start screen** above Reset everything (reloads the page). `style-start.css` linked. Version bumped.
- `src/modules.js` — the new module in the list the cache-mix check reads.

## Not in this

Several save slots (Ola chose one save + the reached set). Chapter select deeper than an act's start (the test menu has that). Any change to the acts themselves.

## Testing

- `src/start.test.js`: the rows for every combination of reached ids (none, trivial only, through war, drone only → both IV rows with vault grey, both → both black, unity, infinity); the Continue label per phase and save; migration from each old key set; `markReached` is a set.
- `chapterCard.test.js` and `interim.test.js`: the marking lines.
- Before saying it is playable: open the game as a fresh player (New game → card → chapter I), as Ola (his save → the list with both IV rows), replay II from the list, confirm text, Sound/Music toggles, Enter, mobile width, and `?go` still goes straight in. Click through as a human first (feedback rule).

## Version

1.93.0 (feature). CHANGELOG, `src/version.js`, `index.html`, `package.json`.
