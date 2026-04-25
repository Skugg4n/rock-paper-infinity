# Rock, Paper, Infinity — Project Rules

## Overview
Incremental idle game with rock-paper-scissors core mechanic. Single-page app (`index.html`) with dynamic phase loading:
- **Phase 1 (Industry)**: RPS mini-game with upgrade progression (`#phase-industry`)
- **Phase 2 (City)**: Civilization-building with population and resources (`#phase-city`)

## Version Management

### Version Bump Checklist
All must be updated together on every release:
- [ ] `src/version.js` — `export const VERSION = 'vX.Y.Z'`
- [ ] `index.html` — `<div id="version-info">vX.Y.Z</div>`
- [ ] `package.json` — `"version": "X.Y.Z"`
- [ ] `CHANGELOG.md` — Add new version entry

### Version Format
- `X.Y.Z` — production releases
- Bump Z for bugfixes, Y for features, X for breaking changes

## Tech Stack
- **Language**: Pure JavaScript (ES6 modules)
- **CSS**: Tailwind CSS v3 (CDN) + `style.css` (shared + Phase 1) + `style-stage2.css` (Phase 2, scoped with `#phase-city`)
- **Icons**: Both phases use Lucide CDN. `src/icons.js` builds SVGs from Lucide icon data and caches them for `getIcon()`. Phase 2 also uses `<i data-lucide>` tags with `lucide.createIcons()`.
- **Testing**: Jest v30 (ESM via `--experimental-vm-modules`), ESLint v9
- **Storage**: localStorage (keys centralized in `src/constants.js`)
- **Module system**: ES modules (`"type": "module"` in package.json)

## Commands
```bash
npm test          # Run Jest tests
npm run lint      # Run ESLint
```

## File Structure
```
rock-paper-infinity/
├── index.html              # Single-page shell: both phase containers + shared elements
├── stage-2.html            # Redirect → index.html (backwards compat)
├── main.js                 # Bootstrap: loads icons, detects phase, calls setPhase()
├── style.css               # Shared styles + Phase 1 styles
├── style-stage2.css        # Phase 2 styles (scoped with #phase-city for conflicts)
├── roman.js                # Roman numeral utility (ES module)
├── jest.config.js          # Jest config: native ESM, no transform
├── src/
│   ├── constants.js        # Centralized magic numbers + localStorage keys (incl. PHASE_KEY)
│   ├── version.js          # VERSION constant
│   ├── gamePhase.js        # Phase state machine: show/hide containers, persist to localStorage
│   ├── icons.js            # SVG icon preloading and caching (Phase 1 only)
│   ├── phase1/
│   │   ├── index.js        # Phase 1 orchestrator: init, teardown, upgrades, UI (~1,036 lines)
│   │   ├── rates.js        # Pure calculations: getSPS, getEPS, getVisibleDots, formatCount
│   │   ├── cost-visual.js  # Tally SVGs + Roman numeral cost display
│   │   ├── countdown.js    # RPS countdown animation
│   │   └── persistence.js  # Game state serialization/deserialization
│   └── phase2/index.js     # Phase 2 game logic (~700 lines)
├── README.md               # Project overview and architecture docs
└── CODE_REVIEW.md          # Code review notes
```

## Established Patterns

### Tick separation
- `logicTick` (1s) — ALL game mechanics: resource generation, population, supplies, save
- `fastUiTick` (50ms) — ONLY rendering: number displays, progress bars, visual state

### Event listener safety
- **Phase 1**: `AbortController` — all listeners use `{ signal }`, `teardown()` calls `abort()`
- **Phase 2**: `AbortController` — all listeners use `{ signal }`, `teardown()` calls `abort()`. `WeakSet` prevents duplicate tooltip listeners. `beforeUnloadHandler` ref for clean removal.
- **Phase 2**: `savingEnabled` flag — set false before reset to prevent save-on-unload race

### Icon refresh
- `scheduleIconRefresh()` — debounces `lucide.createIcons()` via `requestAnimationFrame`
- Never call `lucide.createIcons()` directly in tick loops

### Resource flow
- Energy: main pool fills first → overflow to reserve
- Consumption: main drained first → reserve as backup
- Refund: decrement level first, then `cost() * refundRate`

### Chapter cards
- Single module: `src/chapterCard.js`. Always invoke via `playChapterCard({ roman, title, mode, onMidpoint })`.
- Use `mode: 'to-come'` for unimplemented chapters — the promise never resolves.
- State transitions across phases happen inside the `onMidpoint` callback during the card's hold phase.
- Exception: cross-phase localStorage writes (e.g. `rpi-stars`, `PHASE_KEY`) should happen BEFORE the card starts so a reload during the card lands the player in the correct state.

## Design Principles
- **Icons over text** — Use icons instead of labels. The UI should feel like a puzzle to discover.
- **Clean and minimal** — Less is more. No unnecessary decoration or clutter.
- **Progressive disclosure** — Introduce complexity over time. New elements appear as the player progresses, not all at once.
- **Exponential satisfaction** — Numbers should grow. Slow at first, then faster, then overwhelmingly fast. The player should feel the acceleration.
- **Roman numerals for costs** — Costs ≥10 display in Roman numerals. Intentionally cryptic, part of the puzzle feel.
- **Contained animations** — Animations must stay within their parent element boundaries. No icons or effects flying loose across the screen. Everything should feel attached to its container.
- **Discreet, not distracting** — Animations should be subtle and calm. No looping attention-grabbers on UI elements. One-shot animations are OK for state changes; constant blinking/pulsing is not. The game's visual tone is clean and quiet.
- **Directional clarity** — Animations that represent a process (like a factory) must have clear direction. Input → process → output. Think conveyor belt, not chaos. The player should read the flow at a glance.
- **Tone plates, not lines** — Use background color areas with subtle shadows for structure. Never use visible border lines for layout. Lines are only acceptable as super-discreet dividers (1px, very low contrast). Containers should feel like floating cards, not boxed-in frames.
- **Tooltips render icon and Roman cost only.** No descriptive text. If a feature requires explanation, the feature is wrong, not the tooltip.
- **Animations that represent ongoing process loop only while the process is live.** Animations for state changes are one-shot. Decorative pulse loops on UI elements are forbidden.

## Game Design Taxonomy

### Upgrade Types
1. **Progression upgrades** — Multi-level purchases (buy repeatedly until maxed). Examples: GMO (10 levels), game speed, energy generator. Provide long-term goals with visible progress.
2. **One-off upgrades** — Single purchase that permanently unlocks a capability. Examples: Tool Case, Urbanism Research, Car. Create milestone moments.
3. **Manual levers** — Player-controlled actions with resource cost. Examples: manual battery recharge, collapse quantum foam. Keep the player engaged between idle phases.
4. **Base expansion** — Structural changes to the play area. Examples: add game board, merge to meta board, land expansion. Visually transform the game state.

### Currency & Resource Layers
- **Primary**: Stars (⭐) — earned from RPS wins. The core resource everything costs.
- **Multiplier**: Upgrades that increase star generation rate (speed, energy, boards, population).
- **Support**: Energy (⚡) — enables automated RPS play. A bottleneck that forces pacing.
- **Knowledge**: Science (⚛) — secondary currency in Phase 2, unlocks research. Tied to population allocation.
- **Structural**: Population (👥) — gates unlock thresholds. Not spent, but must be grown to reach milestones.
- **Consumable**: Supplies (🛒) — keeps population alive. Balancing supply/demand is a survival mechanic.

### Progression Philosophy
- **Struggle → Discovery → Goal → Achievement → New struggle**
- Player should NOT know what's coming next. Then something appears (grayed out / locked), giving a new target to work toward.
- Each unlock cycle should feel different: sometimes a button appears, sometimes the grid expands, sometimes a visual change hints at something new.
- Endgame of each phase should tease the next phase with something mysterious the player can't yet control.

### SPA architecture
- **Single HTML shell** — `index.html` contains `<div class="phase-container">` for each phase. `gamePhase.js` hides all containers, shows the target, persists phase to `PHASE_KEY` in localStorage.
- **CSS scoping** — Phase 2 conflicting selectors (`.btn`, `.upgrade-btn`, `.tooltip`) are prefixed with `#phase-city` in `style-stage2.css`.
- **Shared elements** — Menu, version display, and `#tooltip` live outside phase containers.
- **Phase 2 debug menu** — Uses `#p2-debug-menu` (not `#debug-menu`) to avoid ID collision with Phase 1.

## Known Issues
- `src/phase1/index.js` still large (~1,036 lines) — further splitting requires shared state pattern refactor

## Documents
- Check [LESSONS.md](LESSONS.md) when debugging
- Update [CHANGELOG.md](CHANGELOG.md) on every release
- See [PROJECTPLAN.md](PROJECTPLAN.md) for current progress
- See [INDEX.md](INDEX.md) for document overview
