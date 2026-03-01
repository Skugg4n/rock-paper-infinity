# Rock, Paper, Infinity — Project Rules

## Overview
Incremental idle game with rock-paper-scissors core mechanic. Two game phases:
- **Phase 1 (Industry)**: RPS mini-game with upgrade progression
- **Phase 2 (City)**: Civilization-building with population and resources

## Version Management

### Version Bump Checklist
All three must be updated together on every release:
- [ ] `src/version.js` — `export const VERSION = 'vX.Y.Z'`
- [ ] `index.html` — `<div id="version-info">vX.Y.Z</div>` (line ~76)
- [ ] `package.json` — `"version": "X.Y.Z"`
- [ ] `CHANGELOG.md` — Add new version entry

**Note:** `stage-2.html` title says "v5" — this is a legacy label, not the actual version.

### Version Format
- `X.Y.Z` — production releases
- Bump Z for bugfixes, Y for features, X for breaking changes

## Tech Stack
- **Language**: Pure JavaScript (ES6 modules, no framework)
- **CSS**: Tailwind CSS v3 (via CDN)
- **Icons**: Custom SVG preloading system (Lucide-based icons in `graphics/`)
- **Testing**: Jest v30.0.5
- **Linting**: ESLint v9.33.0
- **Storage**: localStorage (`rpi-save`, `rpi-stage2`, `rpi-stars`)
- **Module system**: ES modules in browser, CommonJS in package.json (for Jest)

## File Structure
```
rock-paper-infinity/
├── index.html              # Phase 1 UI
├── stage-2.html            # Phase 2 UI
├── main.js                 # Bootstrap: loads icons, initializes game
├── style.css               # Shared styles, animations, layout
├── roman.js                # Roman numeral utility
├── src/
│   ├── version.js          # VERSION constant (single source of truth)
│   ├── gamePhase.js        # Phase state machine (INDUSTRY → CITY → WAR → ESCAPE)
│   ├── icons.js            # SVG icon preloading and caching
│   ├── phase1/index.js     # Phase 1 game logic (~1,066 lines)
│   └── phase2/index.js     # Phase 2 game logic (~561 lines)
├── graphics/               # SVG icons (19 files, used by icons.js)
└── *.svg                   # Legacy root SVGs (building icons for Phase 2)
```

## Key Source Files
- `src/phase1/index.js` — Core game loop, upgrades, energy, bulk processing, UI
- `src/phase2/index.js` — City builder: buildings, population, research, supplies
- `src/gamePhase.js` — Phase transitions (page navigation between index.html ↔ stage-2.html)
- `src/icons.js` — Icon cache system (preload → clone → inject)

## localStorage Keys
- `rpi-save` — Phase 1 game state (stars, energy, upgrades, boards)
- `rpi-stage2` — Phase 2 game state (buildings, population, research)
- `rpi-stars` — Star transfer between phases

## Commands
```bash
npm test          # Run Jest tests
npm run lint      # Run ESLint
```
**Note:** Run `npm install` first — devDependencies must be installed.

## Conventions
- Swedish comments and variable names appear in some places, English in others — prefer English for new code
- UI text is in English (switched from Swedish in v1.3.12)
- Upgrade definitions use object literals with `cost`, `level`, `maxLevel`, `unlocksAt` etc.
- UI updates via manual `uiState` dirty-tracking (no reactive framework)
- Game state saved to localStorage on every meaningful change

## Known Issues
- `src/phase1/index.js` is a monolithic 1,066-line file — candidate for splitting
- 46 legacy SVG files in root directory (duplicates of `graphics/` + building icons)
- `stage-2.html` title version ("v5") is inconsistent with actual version
- `firebase-debug.log` in root is leftover from abandoned Firebase setup

## Documents
- Check [LESSONS.md](LESSONS.md) when debugging
- Check [TODO.md](TODO.md) for pending input (when it exists)
- Update [CHANGELOG.md](CHANGELOG.md) on every release
- See [PROJECTPLAN.md](PROJECTPLAN.md) for current progress
- See [INDEX.md](INDEX.md) for document overview
