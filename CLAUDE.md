# Rock, Paper, Infinity — Project Rules

## Overview
Incremental idle game with rock-paper-scissors core mechanic. Two game phases:
- **Phase 1 (Industry)**: RPS mini-game with upgrade progression (`index.html`)
- **Phase 2 (City)**: Civilization-building with population and resources (`stage-2.html`)

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
- **CSS**: Tailwind CSS v3 (CDN) + `style.css` (Phase 1) + `style-stage2.css` (Phase 2)
- **Icons**: Both phases use Lucide CDN. `src/icons.js` builds SVGs from Lucide icon data and caches them for `getIcon()`. Phase 2 also uses `<i data-lucide>` tags with `lucide.createIcons()`.
- **Testing**: Jest v30, ESLint v9
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
├── index.html              # Phase 1 UI
├── stage-2.html            # Phase 2 UI
├── main.js                 # Bootstrap: loads icons, initializes game
├── style.css               # Phase 1 styles, shared animations
├── style-stage2.css        # Phase 2 styles (extracted from inline)
├── roman.js                # Roman numeral utility
├── src/
│   ├── constants.js        # Centralized magic numbers + localStorage keys
│   ├── version.js          # VERSION constant
│   ├── gamePhase.js        # Phase state machine (INDUSTRY → CITY → WAR → ESCAPE)
│   ├── icons.js            # SVG icon preloading and caching (Phase 1 only)
│   ├── phase1/index.js     # Phase 1 game logic (~1,066 lines)
│   └── phase2/index.js     # Phase 2 game logic (~600 lines)
├── graphics/               # SVG icons (used by icons.js)
├── README.md               # Project overview and architecture docs
└── CODE_REVIEW.md          # Code review notes
```

## Established Patterns

### Tick separation
- `logicTick` (1s) — ALL game mechanics: resource generation, population, supplies, save
- `fastUiTick` (50ms) — ONLY rendering: number displays, progress bars, visual state

### Event listener safety
- **Phase 1**: `AbortController` — all listeners use `{ signal }`, `teardown()` calls `abort()`
- **Phase 2**: `WeakSet` prevents duplicate tooltip listeners. `beforeUnloadHandler` ref for clean removal.
- **Phase 2**: `savingEnabled` flag — set false before reset to prevent save-on-unload race

### Icon refresh
- `scheduleIconRefresh()` — debounces `lucide.createIcons()` via `requestAnimationFrame`
- Never call `lucide.createIcons()` directly in tick loops

### Resource flow
- Energy: main pool fills first → overflow to reserve
- Consumption: main drained first → reserve as backup
- Refund: decrement level first, then `cost() * refundRate`

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

## Known Issues
- `src/phase1/index.js` is a monolith (~1,066 lines) — candidate for splitting
- `stage-2.html` title version ("v5") is inconsistent with actual version
- `stage-2.html` can be navigated to directly, bypassing `gamePhase.js`
- `firebase-debug.log` and `.DS_Store` should be in `.gitignore`
- `/graphics/` directory contains legacy custom SVGs — no longer used, can be cleaned up

## Documents
- Check [LESSONS.md](LESSONS.md) when debugging
- Update [CHANGELOG.md](CHANGELOG.md) on every release
- See [PROJECTPLAN.md](PROJECTPLAN.md) for current progress
- See [INDEX.md](INDEX.md) for document overview
