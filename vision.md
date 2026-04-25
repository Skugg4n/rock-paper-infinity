# Rock, Paper, Infinity — Vision

This document describes what the game is, why it is the way it is, and what it will never become. It is the source of truth for design decisions. When CLAUDE.md tells you *how* to build, this tells you *why*.

## What this game is

An incremental idle game that begins as the most trivial thing imaginable — clicking rock, paper, or scissors — and escalates, chapter by chapter, into civilizations, conflicts, and eventually escape. The escalation is the whole point. The player should feel small things become big, and big things become unmanageable, and unmanageable things become inevitable.

The game wears no marketing surface. There is no tutorial, no welcome screen, no "Get Started" button. The player arrives, sees three icons, and figures out the rest.

## The chapter arc

The game is structured as four chapters. Each chapter is a complete play loop with its own visual identity, mechanics, and emotional arc. Chapters are bridged by a bombastic transition card, never by an in-game prompt or button asking the player to "continue".

| # | Title | What it is | Emotional beat |
|---|-------|------------|----------------|
| I | **TRIVIAL** | Manual rock-paper-scissors → energy/factory automation. Player wins stars. | "This is silly… wait, this is addictive." |
| II | **CAPITAL** | Stars become a city. Population, supplies, science, buildings. | "I'm building something now." |
| III | **WAR** | (Future.) The competitor escalates. Conflict mechanics. | "What I built is under threat." |
| IV | **ESCAPE** | (Future.) The world becomes uninhabitable. Off-world flight. | "I have to leave it all behind." |

**Working titles.** Names may shift as future chapters are designed, but the **single-word, all-caps, English** convention is fixed. Each title prefixed by a Roman numeral: `I · TRIVIAL`, `II · CAPITAL`, `III · WAR`, `IV · ESCAPE`. The Roman prefix echoes the in-game cost notation and reinforces the sense of permanence and weight.

## Scale

Escalation is not a side effect of the gameplay; it is the gameplay. The player begins with four hand-fought wins and ends in numbers that mean nothing in everyday language. *Rock, paper, scissors* opens the game; the closing scale is not fixed in advance — it may climb to the cosmic, invert to the subatomic, or pivot in a direction we have not committed to yet. The shock of distance is the point, whatever direction it points.

Two kinds of escalation run in parallel:

- **Numerical.** Counts grow exponentially within and across chapters. Four wins in chapter I matter. Four billion stars in chapter II is a rounding error. Roman numerals (on costs from 10 onward), k/M/B suffixes, and eventually scientific notation are tools to keep absurd numbers legible without flattening their weight.
- **Perspective.** Each chapter shifts the *frame of reference* the player operates in. Hands choosing rock, paper, or scissors. A city ledger. A theatre of conflict. A cosmos to flee to. The player should feel briefly disoriented at every chapter break, and then settle into the new scale as if it were obvious.

Both kinds of escalation must be **staggered, not smooth**. A continuous gentle climb feels like a treadmill. Discrete jumps — a new mechanic, a new digit place, a new chapter card — punctuate the climb and make each step felt.

## Chapter transitions

Every chapter change uses the same bombastic card. It is the most expensive piece of UI in the game, and it should be felt as such. It is never skipped, never abbreviated, and never replaced by a fade-to-the-next-screen.

**Sequence (≈2.2 s total):**

1. **Fade to white** (300 ms) — the current scene dissolves into pure white.
2. **Title fades in** on the white field (300 ms). Caps, bold, large. Roman numeral above (smaller, lighter weight).
3. **Hold** (~1000 ms). The title is the only thing on screen.
4. **Title fades out** (300 ms).
5. **Fade out white → next scene** (300 ms).

**Typography.** The chapter title is set in a **bold, condensed, block-letter sans-serif** (Bebas Neue, Oswald Black, Barlow Condensed Black, or equivalent). The Roman numeral above is the same family at a lighter weight and smaller size. The card is the only place in the game that uses display typography of this weight; everywhere else, the UI stays light.

**Triggers:**
- **Game start (`0 → I`)** — the very first thing the player sees. Before any UI loads, the chapter card plays through `I · TRIVIAL`. Only after the card resolves does the player land in chapter I.
- `I → II` fires when the player commits to the Bank in chapter I. The state transfer (Phase 1 teardown, Phase 2 init) happens during the hold phase of the card — the card *is* the bridge.
- `II → III` fires when the player reaches **50,000 population** in chapter II.
- Future: `III → IV` fires at the corresponding endgame trigger of chapter III.

**Replays.** A returning player who already has a save does not see the opening `0 → I` card again on subsequent loads — they go straight back to wherever they were. The opening card is a first-time experience.

## The "to come" wall

Chapter III is not implemented at the time of writing. When the player triggers it (50k pop), the standard chapter card plays through `III · WAR` exactly as if the chapter existed. Then, instead of fading the white away into a new scene, the screen **fades to black**. White text appears: *to come*. Lighter weight than the chapter title, smaller, no Roman numeral. The game stops there.

This is not an error screen. It is a deliberate cliffhanger. The player has reached the edge of the world.

The same convention applies to any unfinished future chapter: the chapter card plays in full, the screen goes black, *to come* appears.

## Mystery as a core mechanic

Discovery is the game's primary engagement loop. The player must figure out what to do, what each new icon means, when something will unlock, and what the next chapter is about. **There is no handholding.** Tutorials, "first run" popups, arrows, hints, and onboarding text are explicit non-goals. Costs are written in Roman numerals from 10 onward partly to *prevent* easy reading, not to enable it.

The competitor island that fades in late in chapter II is a perfect example: it is uninteractive, unexplained, and unsettling. The player notices it, asks "what is that?", and that question is itself the engagement. The answer (`III · WAR`) arrives only when the chapter card fires.

To support discovery, the game must be **legible without being explanatory**. Affordances must be visible (a button looks pressable, a meter looks measurable), but their meaning is left to the player.

## Design principles

These are the rules every visual and interaction decision must answer to. They are stated in CLAUDE.md as instructions to the implementer; here they are stated as values.

- **Icons over text.** Text is a last resort. The UI should feel like a puzzle to read. If a thing can be communicated by a glyph, a position, a shape, or a colour, it must be.
- **Progressive disclosure.** Complexity arrives in waves. The player never sees the full system at once. New elements appear as old ones are mastered.
- **Exponential satisfaction.** Numbers grow slowly, then quickly, then absurdly. The player feels the curve.
- **Roman numerals for costs ≥ 10.** Costs are intentionally cryptic past a certain point. Roman numerals enforce the puzzle texture.
- **Contained animations.** Animations stay inside their parent. No icons fly loose across the screen. Everything feels attached, weighted, present.
- **Discreet, not distracting.** Animations are calm. State changes get a one-shot pop, fade, or colour transition; UI elements never blink or pulse on a loop. The visual tone is quiet.
- **Directional clarity.** Anything representing a process has a direction. Input on one side, output on the other. The factory is a conveyor belt, not a swirl.
- **Tone plates, not lines.** Structure is communicated through background colour and subtle shadow. Visible borders are forbidden. Containers float; they are not framed.

## Progression rhythm

Each chapter should follow the same internal rhythm: **struggle → discovery → goal → achievement → new struggle**. The player works at a problem, notices something new, fixes attention on it, achieves it, and immediately faces a fresh problem at a higher tier.

Within a chapter, unlocks should arrive **one at a time**. Two or three things unlocking at the same population threshold is information overload and dilutes the satisfaction of any one unlock. Where the legacy code clusters unlocks at 1k / 5k / 10k pop, those clusters should be staggered.

Teasers must be **consistent**: an upgrade that will unlock at threshold X should appear, greyed out, at some lower threshold. The grey state and its tooltip are how the player learns the requirement. An upgrade that pops fully formed at its unlock threshold without prior teasing breaks the rhythm.

## What we won't build

These are explicit non-goals for the project itself — features and surfaces we will not add, no matter how often the genre tempts us. (This is about what *we, the makers,* will not implement; it is not a statement about goals inside the game. The player has plenty of goals — usually unlocking the next thing — they are just not announced.)

- **No tutorial layer.** No first-run experiences, no guided tours, no "did you know?" tips, no arrows pointing at things.
- **No narrative layer.** No characters, no dialogue, no story beats beyond the four chapter titles.
- **No multiplayer layer.** No social features, leaderboards, or accounts. Everything is local.
- **No free-to-play extraction.** No ads, no microtransactions, no premium currency, no daily logins. The game is one self-contained thing.
- **No infinite scaling.** The number of chapters is fixed at four. The end is the *to come* wall, then eventually a final ending in chapter IV.

## Tone

Minimalist, clean, unexpected.

- **Minimalist** — strip away rather than add. The fewer elements on screen, the more weight each one carries. When something new appears, the player notices.
- **Clean** — every visual is deliberate. No decorative flourishes, no celebratory confetti, no clutter. Tone plates and shadows do the work that borders and lines would do in a busier game.
- **Unexpected** — the player should not be able to predict what comes next. New mechanics, new chapters, new visual states arrive without preamble. The surprise itself is the engagement.

Visually: monochrome leaning, soft shadows. Achievements are felt through scale (numbers got bigger, the grid got wider, the chapter changed) rather than announced.

## Shipping posture

The game is built and maintained as a personal project. The current target is **test users** — friends, curious bystanders, a small ring. A public launch is possible later if the quality bar is high enough; it is not ruled out, only deferred. Stability and polish matter more than reach. Hosting is a means, not a destination.

Future chapters (III, IV) will be built when they are built. There is no schedule. The *to come* wall is honest about this; it does not promise a date.

## Cross-references

- [CLAUDE.md](CLAUDE.md) — implementer rules: file structure, tick separation, icon system, version bump checklist, established patterns.
- [PROJECTPLAN.md](PROJECTPLAN.md) — completed phases and remaining work.
- [CHANGELOG.md](CHANGELOG.md) — release history.
- [LESSONS.md](LESSONS.md) — bugs we hit and rules we wrote in response.
