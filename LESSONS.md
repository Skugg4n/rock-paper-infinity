# Rock, Paper, Infinity — Lessons Learned

*Add entries here when bugs are found, debugging takes >15 min, or non-obvious patterns are discovered.*

### #1 — Version string scattered across multiple files
**Problem:** Version is hardcoded in `src/version.js`, `index.html`, `package.json`, and `stage-2.html` title.
**Cause:** No single source of truth — each file was updated independently.
**Lesson:** Always check the Version Bump Checklist in CLAUDE.md before releasing.
**Rule:** Never bump version without updating all files in the checklist.

### #2 — Monolithic phase files hide bugs
**Problem:** `src/phase1/index.js` is 1,066 lines with game state, UI, upgrades, and animations mixed together.
**Cause:** Incremental feature additions without refactoring.
**Lesson:** Large files make bugs harder to find and fix. Split when a file exceeds ~300 lines.
**Rule:** Keep modules focused — one concern per file.

### #3 — Event listeners added in fast loops without cleanup
**Problem:** `setTooltip()` in Phase 2 adds `mouseenter`/`mouseleave`-lyssnare varje gång den anropas (var 50 ms). Tusentals duplicerade lyssnare ackumuleras, spelet blir segt.
**Cause:** `updateAllUI()` körs i `fastUiTick` (50 ms interval) och anropar `setTooltip()` som alltid lägger till nya lyssnare utan att ta bort gamla.
**Lesson:** Separera lätta UI-uppdateringar (siffror, bars) från tunga (tooltip-setup, ikon-rendering). Använd dirty-flaggor.
**Rule:** Lägg aldrig till event listeners i en loop/interval utan att först ta bort de gamla.

### #4 — lucide.createIcons() som DOM-scanner i tick-loop
**Problem:** `lucide.createIcons()` skannar hela DOM:en efter `data-lucide`-attribut. Anropades 20+ gånger/sekund från `fastUiTick` + per byggnad i `renderGridSlot`.
**Cause:** Ingen separation mellan "behöver ikon-refresh" och "behöver UI-update".
**Lesson:** Tunga DOM-operationer ska bara köras när DOM:en faktiskt ändrats, inte varje tick.
**Rule:** Anropa `lucide.createIcons()` max 1 gång efter batch av DOM-ändringar, aldrig i tick-loopar.

### #5 — Dubbel energigenerering (fyller båda poolerna)
**Problem:** `passiveTick` adderar `energyGen` till BÅDE `energy` och `reserveEnergy`. Spelaren får 2x den visade raten.
**Cause:** Copy-paste eller missförstånd av energiflödet. Borde fylla main först, overflow till reserve.
**Lesson:** Testa ekonomi-system med kända inputs och verifiera outputs.
**Rule:** Resurs-generering ska ha en tydlig flödesriktning: primär pool → overflow till sekundär.

### #6 — Refund-beräkning använder fel cost()
**Problem:** `handleSellClick` anropar `upgrade.cost()` som returnerar kostnaden för *nästa* nivå, inte den som betalades. Refund blir ~1 stjärna istället för ~13.
**Cause:** `cost()` är en funktion som beräknar utifrån current level, inte historisk kostnad.
**Lesson:** Cost-funktioner i incremental games returnerar alltid kostnaden att köpa NÄSTA nivå.
**Rule:** Beräkna refund som: sänk level först, sedan `cost() * refundRate`.

### #7 — Reserve energy dräneras före main
**Problem:** `consumeEnergy` kollar `reserveEnergy >= amount` först. "Reserve" agerar som primär källa.
**Cause:** if-satsens ordning är omvänd mot spelarens förväntning.
**Lesson:** Namngivning måste matcha beteende. "Reserve" = backup = sist ut.
**Rule:** Energikonsumtion: main först → reserve som backup.

### #8 — Supply-display visar 20x faktisk rate
**Problem:** `netSupplyChange` beräknas per sekund men appliceras som `/20` per logicTick (1/s). UI visar den icke-dividerade raten.
**Cause:** Divisionen med 20 verkar vara en rest från när supply ändrades i `fastUiTick` (50ms × 20 = 1s).
**Lesson:** Håll beräkningsfrekvens och displayenhet synkade.
**Rule:** Om en rate visas som "per sekund", se till att den faktiskt appliceras per sekund.

### #9 — Background tab throttling bryter ekonomin
**Problem:** `fastUiTick` (50ms) adderar stjärnor/vetenskap. Browsern throttlar till 1/s i bakgrund → 20x lägre inkomst. Men `logicTick` (1/s) kör population/supply normalt → svält.
**Cause:** Resursgenerering sker i snabb tick istället för logik-tick.
**Lesson:** All spellogik som påverkar balans ska köras i samma tick.
**Rule:** Separera: logicTick = all spelmekanik, fastUiTick = bara rendering.

### #10 — teardown() städar inte event listeners
**Problem:** `setupButtons()` i Phase 1 lägger till listeners. `teardown()` tar bara bort intervals. Vid re-init stackas duplicerade lyssnare → dubbelklick.
**Cause:** teardown designades för interval-cleanup men missade DOM-listeners.
**Lesson:** Allt som `init()` sätter upp måste `teardown()` riva ner.
**Rule:** Varje addEventListener i init() kräver en matchande removeEventListener i teardown().

### #11 — Disabling saves before the save-with-new-state runs
**Problem:** Phase 2's WAR-wall trigger set `savingEnabled = false` before the next `saveGameState()` call in the same tick. The 50k+ population state never persisted; reloads bypassed the wall.
**Cause:** The trigger sequence assumed saves would happen "later" but the same tick re-runs through the save path immediately.
**Lesson:** When disabling persistence, persist the trigger-causing state first, then disable.
**Rule:** "Save once with the trigger state, then disable saves."

### #12 — Cross-phase state writes must precede chapter cards
**Problem:** Bank-click started the II·CAPITAL chapter card; `setPhase(phases.CITY)` ran at midpoint (~600ms in). A reload during that window left `PHASE_KEY = INDUSTRY` while bank.purchased was already saved — player stranded in Phase 1.
**Cause:** Chapter cards are visual transitions; cross-phase state transitions need to commit before the visual.
**Lesson:** localStorage writes that affect which phase the player loads into must happen at the click moment, not during the card animation.
**Rule:** "PHASE_KEY and cross-phase transfer keys are written synchronously at the trigger, never deferred to chapter card midpoints."

### #13 — Animation features need a falsifiable trigger condition
**Problem:** Factory pause-on-idle in Phase 2 used `netStarChangePerSecond <= 0` as the idle signal. The factory's base +1680/s made the condition essentially unreachable; the feature shipped but never visibly fired.
**Cause:** The trigger condition wasn't validated against actual gameplay numbers.
**Lesson:** Before shipping an animation that depends on a game-state condition, verify the condition can actually be reached in normal play.
**Rule:** "If a feature triggers on a numeric threshold, sanity-check the threshold against the relevant base values before shipping."

### #14 — setInterval keeps running behind a "permanent" overlay
**Problem:** Phase 2's WAR card was a never-resolving Promise (the wall), but `logicInterval` and `fastUiInterval` continued ticking behind it — population, stars, science kept incrementing invisibly.
**Cause:** The overlay was visual-only; the underlying loops were not stopped.
**Lesson:** A "permanent" UI state must also stop the underlying simulation, not just hide it.
**Rule:** "When triggering a wall/end state, clear all intervals and timers explicitly."

### #15 — A shared tick interval plus per-item animations creates dead zones
**Problem:** The auto-play loop fired every `1.2/speed + 0.45` s and skipped boards still animating. At speed 4–5 the animation (760 ms) outlasted the interval (690–750 ms), so every other tick was skipped and buying speed *halved* the rate.
**Cause:** Two independent clocks (tick interval, animation length) with no relation to each other.
**Lesson:** Derive loop cadence from the animation length, not the other way round. One source of truth (`roundTiming`) for both.
**Rule:** "If a loop skips busy items, the loop's interval must be derived from the busy time, and a test must assert monotonicity."

### #16 — Displayed rates must be measured, not derived
**Problem:** ★/s showed a formula that ignored energy pauses and loop bugs. Ola saw 0.2 on screen and 0.05 in reality.
**Cause:** The display trusted the model; the model was wrong (#15) and incomplete (energy).
**Lesson:** Show what the player actually gets. An EMA of real gains is cheap and self-correcting.
**Rule:** "Any 'per second' number shown to the player is measured from actual state changes."

### #17 — A resource that gates the only income source can soft-lock
**Problem:** Hand play cost energy. 0 energy + 0 stars = nothing can ever happen.
**Cause:** No free fallback action.
**Lesson:** The base action of an incremental game must always be available (Paperclips: you can always click "Make Paperclip").
**Rule:** "There is always one free action that produces the primary currency."

### #18 — Never delete a save in a catch block
**Problem:** Phase 2's `initialize()` catch removed the save and reloaded. A stale-cache module mix after a deploy (new `index.js`, old `buildings-config.js`) made init throw deterministically: save gone, reload loop.
**Cause:** "Corrupt save" was assumed to be the only reason init could fail.
**Lesson:** A save is the player's property. Code can be wrong far more often than data. Recover by refetching code, never by deleting data.
**Rule:** "No code path deletes a save except the player's own Reset."

### #19 — No-build ES modules + CDN cache = mixed versions
**Problem:** Files are cached independently for 10 minutes on GitHub Pages, so a deploy can be loaded half old, half new.
**Lesson:** Data shared across modules must be tolerant of the other side being one version behind, or boot must detect failure and refetch.
**Rule:** "After a failed boot, refetch all modules once with cache: 'reload' and retry; and prefer a hard reload right after a deploy when testing."

## Rules Checklist
- [ ] Never bump version without updating all files in the checklist
- [ ] Keep modules focused — one concern per file
- [ ] Never add event listeners in a loop/interval without removing old ones first
- [ ] Call lucide.createIcons() at most once after a batch of DOM changes
- [ ] Resource generation must flow: primary pool → overflow to secondary
- [ ] Calculate refund as: decrease level first, then cost() × refundRate
- [ ] Energy consumption: main first → reserve as backup
- [ ] If a rate is displayed as "per second", ensure it's actually applied per second
- [ ] All balance-affecting game logic in the same tick
- [ ] Every addEventListener in init() requires a matching removeEventListener in teardown()
- [ ] Save once with the trigger state, then disable saves
- [ ] Cross-phase localStorage writes happen synchronously at the trigger, not at chapter card midpoints
- [ ] Sanity-check numeric trigger conditions against actual game values before shipping
- [ ] Clear all intervals/timers when triggering wall/end states
- [ ] Loop cadence is derived from animation length; assert monotonicity in a test
- [ ] Displayed per-second rates are measured from real state changes
- [ ] One free action always produces the primary currency
