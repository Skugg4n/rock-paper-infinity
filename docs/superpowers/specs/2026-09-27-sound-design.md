# Sound · a proposal for the whole game (2026-09-27)

Status: **proposal for discussion**, nothing built. The game has no audio today. This is
how I would give all five chapters one voice, why, and in what order. Written for Ola.

## Kort, för Ola

- **Tystnad är grundläget.** Ljud är återkoppling på orsak och verkan, aldrig tapet. Ingen
  musik, med ett undantag: en knappt hörbar ton i djupet.
- **Allt syntetiseras i webbläsaren** (Web Audio). Inga ljudfiler, inga nedladdningar,
  inget som kan bli fel i cachen, inga licenser. Hela ljudet är några hundra rader kod.
- **Ett litet ordförråd** av åtta ljud som återkommer i alla kapitel, men varje kapitel
  har sin egen klang: I torrt och nära, II varmt och folkrikt, III lågt och tungt, IV
  djupt med eko, V ljust.
- **Ljudet följer siffrorna.** Tonhöjd stiger med takten, som stjärnorna i kapitel I,
  men tätheten har ett tak: över tolv händelser per sekund blir pingen ett skimmer i
  stället för ett maskingevär.
- **Av-knapp bredvid paus,** tangenten M, val som sparas. Första ljudet kommer först
  efter första klicket, det är webbläsarens regel och passar spelet.
- Först bygger jag en **ljudtavla**, en sida där varje ljud spelas med en knapp, så att
  du dömer klangen innan något går in i spelet.

## 1. Principles

1. **Silence is the resting state.** The game is quiet on screen (two colours, no lines,
   no text). The sound must be equally quiet: short events, no beds, no loops, nothing
   that plays while nothing happens. A player who leaves the tab open must hear nothing.
2. **Sound is cause and effect.** Every sound belongs to one thing the player did or one
   thing that happened to them. The ear should learn the eight words below without a
   tutorial, the way the eye learns the icons.
3. **The avalanche is audible.** In every chapter the sound tracks the number that goes
   up: pitch climbs with rate, and when the rate outgrows single events the events fuse
   into a texture. Fast is a shimmer, not a rattle.
4. **One instrument per chapter, same words.** The words (ping, thunk, knock…) never
   change meaning. The instrument that says them changes with the chapter, so the
   chapters are layers, not new games (vision.md).
5. **Nothing is loud, nothing is long.** Peak −12 dBFS on the master, a limiter behind
   it, events under 400 ms except the two textures (murmur, deep drone) which sit at
   −30 dB or lower. Long sessions must not tire.
6. **No assets.** Everything from oscillators, noise and filters in Web Audio. No sample
   files: nothing to load, nothing to cache-mix on GitHub Pages, no licensing, tiny
   diff. If a sound needs a "room", the impulse response is synthesised too.

## 2. The vocabulary: eight words

| word | when | shape | how it scales |
|---|---|---|---|
| **tick** | a game round in I, a day in IV | a 5 ms click | pitch from rate; above 12/s becomes a soft continuous ratchet |
| **ping** | a win, a star, a unit made | sine + tiny bell partial, 120 ms decay | pitch +1 semitone per doubling of rate, capped two octaves up; density-limited into a shimmer |
| **thunk** | a purchase | filtered noise burst + short low sine | costlier = lower and softer; a cheap buy is a light tap |
| **rise** | something new opens (a teaser turns real, a helper appears) | three rising notes, 250 ms | the same motif in every chapter, played by the chapter's instrument |
| **swell** | a chapter card | filtered noise crescendo + sub sine, 2 s, ducks everything else | dark cards (WAR, THE DEEP) swell lower and longer |
| **knock** | the stop cue: food short, housing full, a stalled room, a warning | two muted knocks, dry | never more than once per 10 s per cause |
| **fall** | a loss: plate razed, chamber dark, people lost | a minor second downward, dry, no reverb | bigger loss = lower |
| **breath** | return: a wake-up, the camera lowering, the people pouring out | filtered noise inhale, 800 ms | only on real transitions, never on UI |

Eight words are enough. If a ninth is needed the design is probably wrong.

## 3. One instrument per chapter

- **I · TRIVIAL.** Dry and close: the table. Ticks are the game rounds, pings the wins,
  pitch climbing with ★/s. At speed 30+ the pings fuse into a bright shimmer whose
  brightness is the rate. The factory ×10 is a low thunk followed by the shimmer
  jumping an octave. The bank: the rise. The chapter card: the swell, light.
- **II · the city.** Warm, wooden (marimba-like: sine with a short second partial and a
  soft attack). One new texture: **murmur**, filtered noise whose level follows
  population (from silence at zero to −30 dB at a full city), the sound of people
  living. Buying a house is a thunk with a soft chord under it. The silo stop cue is the
  knock. Cascades (a research that opens a whole row) play the rise once, not per item.
  The competitor's first tile: a single distant thunk from the south, pitched low.
- **III · WAR.** Low and heavy. A landing is a soft thud on impact, louder for bigger
  waves; a strike is a short tearing noise (noise burst through a sweeping filter) with
  the thud on arrival; the raiding party a dry double tick; the radar a single quiet
  blip at the four-second warning; a razed plate is the fall. The doomsday clock gets
  the one continuous sound of the chapter: a **drone**, a sub sine at −40 dB that rises
  half an octave and gains a little noise as the clock fills. At 85 % the rocket: a long
  filtered noise ramp, the only loud thing in the game, then silence, then the swell.
- **IV · THE DEEP.** The same words with a room around them: a synthesised convolution
  (a short decaying noise impulse) gives every ping and thunk the shaft's echo. Textures:
  water drips (random sparse pings, very low level) and the deep drone (a lower cousin
  of III's, steady, breathing slowly). The day tick is the odometer: on a cryo press the
  ticks accelerate into a whir, then slow and stop; the wake-up is the breath. A probe
  returning: the rise; a probe lost: nothing at all, which is the point; a monster:
  the fall with a long tail. The Watcher, when it speaks, gets no sound of its own: the
  room goes quiet around its lines (duck the textures) and comes back after.
- **V · RETURN.** Light comes back: the same words played dry and bright again, the
  drone gone, the murmur back. The contrast with IV is the reward.

## 4. Mixing rules (so it never gets tiring)

- **Master:** gain −12 dB, a limiter (DynamicsCompressor with a hard knee) behind it.
- **Density limiter:** per word, at most 12 events per second; beyond that the word
  switches to its texture form (shimmer, ratchet) whose brightness encodes the rate.
- **Ducking:** chapter cards and the Watcher's lines duck all textures by 12 dB for their
  duration; UI hover never makes a sound.
- **Repetition guard:** the knock and the fall repeat at most once per 10 s per cause.
- **Pitch ceiling:** two octaves above the base; past that, brightness (filter cutoff)
  rises instead of pitch. Astronomical numbers get bright, never shrill.
- **Pause:** pausing fades the textures out in 300 ms; nothing plays while paused.

## 5. Controls

- A round **speaker button** next to pause and ☰ (Lucide `volume-2` / `volume-x`), the
  key **M**. Three levels behind a long press or in ☰: full, quiet (−12 dB), off.
- Saved in `rpi-audio` (`{ level: 0..2 }`). Default: **on, quiet**. The browser blocks
  sound before the first gesture, so the first click of the game (recharge in chapter I)
  is also the first sound: a single tick. That is a good first sound.
- `prefers-reduced-motion` does not touch audio; a separate OS-level "reduce sound" does
  not exist, so the button is the only control. If the OS has the tab muted, we cannot
  know, and that is fine.

## 6. Tech

- One module, `src/audio.js`: `audio.word('ping', { rate, gain })`, `audio.texture('murmur',
  level)`, `audio.room('deep')`, `audio.duck(ms)`, `audio.setLevel(n)`. The AudioContext is
  created lazily on the first gesture. All shapes are built from OscillatorNode,
  AudioBufferSource with generated noise, BiquadFilter, GainNode, ConvolverNode with a
  generated impulse, DynamicsCompressorNode. No files.
- A tiny scheduler with 50 ms look-ahead for ticks and shimmer, so timing is stable even
  when the main loop stutters; the density limiter lives there.
- Chapters call `audio.chapter('I' | 'II' | …)` once; that selects the instrument (a small
  table of oscillator type, partials, attack, filter, room send). The words are the same
  calls everywhere.
- Rates come from what the game already measures (measuredSPS in I, income in II,
  arms in III, stars per day in IV), so the sound tracks what the screen shows.
- Tests: pure functions for pitch mapping, density limiting and the instrument tables
  are unit-tested; the DOM/Audio glue is not.

## 7. Build order

1. **The sound board** (`docs/mockups/sound-board.html`): a page with one button per word
   per chapter and a rate slider, so Ola judges every sound before it enters the game.
   Nothing ships until the board is approved.
2. **Slice 1, chapter I + controls:** tick, ping with shimmer, thunk, rise, swell, the
   speaker button and the saved level.
3. **Slice 2, chapter II:** the wooden instrument, murmur, knock, cascades.
4. **Slice 3, chapter III:** thud, tear, blip, fall, drone, the rocket.
5. **Slice 4, chapter IV:** the room, drips, odometer, breath, the Watcher's quiet.
6. **V** when V exists.

Each slice is a branch like the war batches, merged by the session that owns main.

## 8. Open questions for Ola

1. Synthesised only (my recommendation) or a few real samples for the heavy moments
   (the rocket, the boom)? Samples sound richer but bring files and caching.
2. No music at all, only the two textures (my recommendation), or a very sparse
   generative music layer in II and V?
3. Default on and quiet (my recommendation), or default off with the button teased?
4. Should the Watcher have a voice of its own (a tone under its text) or is the quiet
   around it enough?
5. Is there a sound you already hear in your head for any moment? That one goes first.
