# The score sheet · one thread through the game's sound (2026-10-02)

Status: **shared working document**. It replaces the 2026-09-27 proposal (which said "no
music"; chapter I proved that wrong, the music is the number). Chapter I is built
(`src/audio.js`), chapter II has a board (`docs/mockups/sound-board-city.html`; Ola approved the direction on
mockup 1, mockup 2 is with him to judge by ear).
Each session that builds an act's sound fills in its row here **before** building.
Rows marked *proposal* are mine (the WAR session) and are for Ola and the owners to change.

## Kort, för Ola

- **Tråden finns redan:** allt går i d-moll med samma fyra ackord, "något nytt" är samma
  tre toner i alla akter, och i staden förvränger konkurrenten ackorden steg för steg.
- **Tre regler** gör den hel: maskinen tystnar aldrig utan hörs längre bort, varje akt
  slutar på en ton som nästa börjar ur, och ord får byta röst men aldrig betydelse.
- **Sluttonerna blir spelets melodi:** D, ciss, ess, djupt D, fiss. Hem, strax under hem,
  strax över hem, hem igen långt ner, och till sist durtersen som aldrig hörts förut.
- **Kriget** (längre ner): pulsen är tiden till nästa landstigning, trumman säger vem
  som leder, radarn ger dig öron, räden tystar deras trumma, och domedagen drar själva
  hemtonen en halvton uppåt.

## 1. Three rules

1. **The machine never stops; it is only heard from further away.** In I the music *is*
   the machine. In II the factory is heard at a distance. In III it is the arms factory
   under the war. In IV it stands in its own room on the lid and runs slowly. How the
   machine sounds says how the world is. Chapters are layers, in sound too.
2. **Every act ends on one note, and the next begins from it.** I ends on a single D.
   The five ending notes are the game's melody, never heard whole until the end.
3. **A word may change voice but never meaning.** Pling is a win, thunk a purchase, rise
   something new, knock a stop, swell a card, boom a point of no return. The instrument
   that says the word belongs to the act.
   *(Chapter I's owner:)* in I the boom is the foam collapsing, clicked twice at the end;
   the second one, which opens the bank, is lower, longer and louder (`audio.boom(1 | 2)`).
   Ola asked for it as the build-up to the ending. Read "no return" as "a step toward the
   end that is not taken back", and it holds for I too.

## 2. What is already common (do not break)

- **Key:** D minor. **Chords:** i VI III VII (Dm, B♭, F, C), one a bar. **Scale for
  melodic events:** D minor pentatonic (`pentaNote`).
- **Words** in `audio.*`: click, pling, thunk, rise, lucky, knock, boom, swell.
- **Nothing switches on.** Every layer has a stretch of some game number over which it
  creeps in (`intensitiesFor`, `ramp`, `approach`); tempo and levels glide over seconds.
- **Events melt into the music.** In I they do it by scale, not by chord: plings, the
  rise and the shimmer take notes from the D minor pentatonic (D F G A C), which sits
  on all four chords, so nothing has to know which chord is sounding. (II's board picks
  from the sounding chord; either is fine as long as it stays in the key.)
- **Plings climb.** Wins within eight seconds of each other step up the pentatonic and
  start over after a pause. Single plings cross-fade with the shimmer as wins get dense.
- **The heart is the reserve.** In I the heartbeat weakens when less than five seconds
  of energy is left and is one faint beat a bar when it is gone.
- **Endings:** `audio.finale()` cuts everything and strikes the ending note; the machine
  then stays silent until `audio.begin()`. `playChapterCard({ silent: true })` drops the
  card's swell so only that note is heard (the CAPITAL card does this).
- **Prefs:** Sound and Music on/off in ☰, saved in `rpi-audio`. Paused or hidden = silent.
- **The gate:** a sound board per act, approved by Ola by ear, before anything ships.
- **All synthesised.** No files.

## 3. The sheet

| | I · TRIVIAL (built) | II · CAPITAL (board) | III · WAR (*proposal*) | IV · THE DEEP (*proposal*) | V (*sketch*) |
|---|---|---|---|---|---|
| **what the machine is** | the game itself | the factory, far back in a large room | the arms factory under the war | the star machine in its own room on top: gears, flywheel, chain, three tubes; it plays the game on the colony's energy | whatever comes up with us |
| **pulse comes from** | games a second (58 to 128 bpm) | the gap between bass hits (calm city = long gap) | the clock to the next landing | awake: the machine's throws (games a day, so energy fed is tempo). Asleep: no pulse at all, only the roll of the years | the owner decides |
| **layers** | heartbeat, tick, bass, shimmer, generator hum, a voice per board | bass, tones, factory, life (short voices, small steps, a far choir in a large city; no noise), traffic, computer, rival (a tone out of key and their drum) | their drum, our drum, bass, tones with holes, arms factory, murmur, drone, shells | awake: the machine, cable hum, drips, a thin murmur. Asleep: the roll, the lamps, the Watcher's tone, the Surface typing. Late: breath and a heartbeat |  |
| **what bends the harmony** | nothing: home | the rival, in five steps: a foreign note (E♭) and a faint drum halfway between our bass hits, F→Gm, B♭→E♭, C→A major and the drum strikes twice, the tones chafe (minor ninth, tritone, wider beating) and the people go quiet. A raid: the city holds its breath | the war keeps step five's chords (Dm, E♭, Gm, A) and the doomsday drone pulls home itself upward | stability: the Watcher's tone drifts flat as it falls; a snap pulls everything true at once. After The question, a heartbeat takes over the machine's pulse, room by room | the major third arrives |
| **carried over from the act before** | | the three rising notes, the key, the chords | the rival's drum and the bent chords, the murmur, the factory | the war's E♭ falling two octaves to D on the IV card; the machine, moved up top; the murmur, now thin | the deep's low D |
| **ending note** | **D** (struck once, rings 7 s) | **C♯** (*proposal:* the A major chord's cutting third, left hanging on the WAR card; the CAPITAL session agrees, Ola decides) | **E♭** (*proposal:* the drone has reached it when the surface is dead) | **D, two octaves down** (*proposal*): the people ending leaves it alone under the shaft; the Unity ending has every voice in the colony sing that one D in unison | **F♯** (*proposal:* the first major third in the game) |

**The melody of endings:** D · C♯ · E♭ · low D · F♯. Home, a semitone under home (longing),
a semitone over home (the wound), home again far below, and at last the note that turns
the key to major. It should never be played as a tune until the very end.

### II · CAPITAL: words by material (on the board, mockup 2)

Every purchase begins with the same thunk as in I; the material after it says what kind.
Build, level up, sell = **wood**. Research = **glass** (a small bell, fifths stacked upward).
Industry (tool case, car, computer) = **metal** and a motor that spins up to the home note.
Food (stall, crop, hand harvest) = **grain**. Land = **earth**, low and wide. "Something
new" is chapter I's three notes, unchanged. Metal is the factory's material, so the war's
metal thunk (below) continues it: the factory turns to arms.

## 4. III · WAR in detail (*proposal*)

The war must be legible by ear, like the war room is by eye. Every layer answers one
question the player has.

**How it starts (one thing at a time, like the buttons).** The WAR card: the boom, then
the swell, low and long. When the camera lowers there is only **their drum** and the
**bass**. Layers arrive as the controls arrive, never two at once.

| layer | answers | driven by | notes |
|---|---|---|---|
| **their drum** | when is the next landing | the wave clock: one bar = the time between landings, so the drum is slow early and tighter late (never faster than the 20 s floor) | inherited from the rival in II; doubles when they push |
| **the radar tick** | exactly when, exactly where | present only after the radar is bought: a quiet tick in the last four seconds, panned toward the coast that will be hit | buying the radar gives you ears |
| **our drum** | who leads | tier difference: when we lead, our drum answers theirs (call and response); level, they alternate; behind, ours thins to a single hit | the lead change is heard before it is read |
| **bass** | are we holding | a D pedal while plates stand; drops to the low A when a plate has fallen and is not yet rebuilt | |
| **tones with holes** | what have we lost | the chord tones are spread over the standing plates; a razed plate takes its tone away, so the chord has holes; rebuilt, the tone returns | "the city holds its breath" from II continues: a plate falls → everything ducks for a second → the fall |
| **arms factory** | what is the slider doing | the factory layer from II; toward stars it is the soft machine, toward hammers it turns metallic (hammered partials) and louder | the slider is audible |
| **murmur** | are the people still here | population; ducks at every landing; nearly gone at the end | carried from II |
| **shells** | their air waves (from their tier V) | a thin whistle falling in pitch before the impact; with air defence the whistle is cut short by a dry crack | the uphill after artillery is heard |
| **doomsday drone** | how finished is the surface | a sub D that glides toward E♭ as the clock goes from 0 to 85 %; a little noise joins it | the act's ending note is where it arrives |

**Words in the war's voice.**
- **thunk:** metal. Shield is low and dull, sword higher and ringing, air defence a hollow tube.
- **rise:** the same three notes, played on the chord that is sounding, each time a control opens.
- **knock:** hammers short on a ◆ click; food critical.
- **pling:** a razed enemy tile is our "win", but it rings in minor with a tail: winning costs.
- **strike:** a tear (noise through a falling filter) when the force sets out, a distant thud when it lands.
- **fall:** a plate razed. Lower for a district than for a home.
- **boom:** only for points of no return: choosing WAR, the first use of the nuclear tier, the rocket.

**Three silences that mean something.**
- **The raiding party:** two dry ticks, then *their drum stops* for the twenty seconds
  their defence is down. The silence is the window to strike.
- **The silent island:** when they are bombed out the drum stops altogether. It comes
  back after ninety seconds heavier and a step lower. Silence is a threat, not a rest.
- **A probe that does not come back** is silence in IV; the war teaches that grammar first.

**How it ends.** The rocket is built from 55 %: a low hum under their drum. At 85 % the
long ramp of noise, their drum rises with it and is gone. What is left is the drone, now
on E♭, and a thin murmur. The hole is dug in that. The IV card takes the E♭ and lets it
fall two octaves to D.

**Mix.** Music sits under the words as in I. Landings are at least twenty seconds apart,
so events are sparse by design; the fight flashes of fists and swords stay silent.

## 4b. IV · THE DEEP in detail (*proposal*, from the DEEP session, 2026-10-02)

Written against the locked design (`2026-10-02-chapter-iv-tree-and-bio.md`). Two
worlds, and they must sound like two worlds: awake has a pulse and people, asleep has
neither.

| layer | answers | driven by | notes |
|---|---|---|---|
| **the machine** (awake) | are we making stars | games a day = energy fed; each throw a soft mechanical clack, a win the pling | rule 1: the same machine, now alone in a room on top; starved it slows and droops in pitch, fed it runs to a whirr |
| **cable hum** (awake) | where does the energy go | spare energy; a low fifth (D and A) that thickens with the POWER branch | the blue threads in the cables, heard |
| **murmur and drips** (awake) | are the people still here | population; very thin from the start, thinner with every sealed sector | carried from II and III; in the bio road it does not stop, it changes register (see heartbeat) |
| **the roll** (asleep) | how fast is time going | years per second (cryo tier): a rising filtered noise, like a tape winding, one step up per tier | no pulse asleep: the odometer is the only motion |
| **the lamps** (asleep) | what is still running | one quiet pentatonic tone per automated room, slow, out of step with each other | the lamp sequence event plays those same tones in order; a lying lamp is a tone outside the chord |
| **the Watcher's tone** (asleep) | how stable are we | stability: a held D that drifts flat as stability falls, with slow beating against the lamps | a snap is the thunk plus the tone jumping back to true: the cause and the effect in one sound |
| **the Surface typing** (asleep) | someone is here | each letter of its line a soft tick; the tick's pitch sits a quarter tone outside the scale | the only sound in the game allowed out of tune. From The question on it moves into tune, line by line: by Unity it is in the chord |
| **breath and heartbeat** (bio) | how much of the base is body | converted rooms: each adds weight to a slow heartbeat at the machine's own tempo, and a breath on the sealed sector's rhythm | the machine's clack fades as the heartbeat grows: mechanical to organic at the same tempo, never a cut |

**Words in IV.** thunk = a purchase in the tree (a relay closing; in the tissue, a wet
knock). rise = Surface opening a node. knock = an alarm waking the colony. boom = the
shaft blown at the descent, and never again. swell = the IV card and the V card.

**The two endings.** The people go up at survival 85: the murmur climbs the shaft and
leaves the low D alone below. Unity: "Woke: everyone is here." and every voice of the
murmur lands on the same low D, in unison, the heartbeat under it. One note, all
voices. V's F♯ answers it.

**Voices (open question 3).** Proposal: neither the Watcher nor the Surface speaks.
They stay text. The Surface's voice is its typing, out of tune until it is not; the
Watcher's voice is the tone that drifts and snaps. Speech would explain what the
chapter wants the player to feel their way into.

## 5. How the sessions work together

- **One row per act, filled in before building.** Change another act's row only by
  telling its owner.
- **`src/audio.js` is shared.** One session edits it at a time; say so in a message
  first. Aim: the machine of I becomes a small engine (layers + drivers + glide) and
  each act supplies a table, instead of each act copying the engine.
- **A board per act**, in `docs/mockups/`, same layout as the two that exist: run the
  act in ninety seconds, mute layers one by one, every word as a button.
- **The ending notes are a proposal.** If an owner's act wants another note, change the
  melody here so everyone sees it.

## 6. Open questions for Ola

1. The melody of endings (D, C♯, E♭, low D, F♯): do you want it, and should anything in
   the game hint at it before the end (the Surface humming it, wrong)?
2. War: is "their drum is the clock to the next landing" the right pulse, or should the
   war have no pulse at all, only events over the drone?
3. Should the Watcher and the Surface have voices in this system (IV's owner decides
   with you), or do they stay text in the quiet?
   The DEEP session proposes text only, with the typing and the drifting tone as
   their voices (section 4b).
