# Rock Paper Infinity

An incremental rock-paper-scissors game with multiple stages of progression, from simple clicking mechanics to managing a full civilization.

## 🎮 Game Overview

Rock Paper Infinity is a browser-based incremental game that starts with the classic rock-paper-scissors gameplay and evolves into a complex resource management and city-building experience.

### Stage 1: Industry
- Play rock-paper-scissors to earn stars
- Unlock automation and speed upgrades
- Manage energy resources
- Build multiple simultaneous game boards
- Unlock the Factory for massive production

### Stage 2: Civilization
- Transfer your stars to build a city
- Manage population, supplies, and production
- Research technologies to improve efficiency
- Balance workers between star production and scientific research
- Expand your city with housing, commerce, and districts

## Chapters

The game is structured around four chapters that unfold as you progress:

- **I · TRIVIAL** — Industry phase. RPS mini-game, upgrades, factory.
- **II · CAPITAL** — City phase. Civilization building, population, resources.
- **III · WAR** — Coming soon. (Foreshadowed by the competitor island at 40k+ population.)
- **IV · ESCAPE** — Coming soon.

A bombastic chapter card plays at each transition. See [vision.md](vision.md) for the full arc and design philosophy.

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, or Edge)
- No build step required - pure vanilla JavaScript!

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rock-paper-infinity.git
   cd rock-paper-infinity
   ```

2. Open `index.html` in your browser to start Stage 1
   - Or use a local server (recommended):
   ```bash
   python -m http.server 8000
   # Or use any other local server
   ```

3. Navigate to `http://localhost:8000` in your browser

## 📁 Project Structure

```
rock-paper-infinity/
├── index.html                # Single-page shell: both phase containers + shared elements
├── stage-2.html              # Redirect → index.html (backwards compat)
├── main.js                   # Bootstrap: loads icons, detects phase, calls setPhase()
├── style.css                 # Shared styles + Phase 1 styles
├── style-stage2.css          # Phase 2 styles (scoped with #phase-city for conflicts)
├── roman.js                  # Roman numeral utility (ES module)
├── jest.config.js            # Jest config: native ESM, no transform
├── src/
│   ├── constants.js          # Centralized magic numbers + localStorage keys
│   ├── version.js            # VERSION constant
│   ├── gamePhase.js          # Phase state machine: show/hide containers, persist to localStorage
│   ├── icons.js              # SVG icon preloading and caching (Phase 1 only)
│   ├── chapterCard.js        # Chapter card transition animations
│   ├── phase1/
│   │   ├── index.js          # Phase 1 orchestrator: init, teardown, upgrades, UI
│   │   ├── rates.js          # Pure calculations: getSPS, getEPS, getVisibleDots, formatCount
│   │   ├── cost-visual.js    # Tally SVGs + Roman numeral cost display
│   │   ├── countdown.js      # RPS countdown animation
│   │   └── persistence.js    # Game state serialization/deserialization
│   └── phase2/
│       ├── index.js          # Phase 2 game logic
│       └── persistence.js    # Phase 2 state serialization/deserialization
├── package.json              # Dependencies & scripts
├── CHANGELOG.md              # Version history
└── README.md                 # This file
```

## 🛠️ Development

### Technology Stack
- **Vanilla JavaScript (ES6+ Modules)** - No framework dependencies
- **Tailwind CSS** (CDN) - Utility-first CSS
- **Lucide Icons** (CDN) - Icon library for Stage 2
- **localStorage** - Client-side save system

### Code Architecture
- **Modular Design:** Each stage has its own isolated module with `init()` and `teardown()` lifecycle hooks
- **Phase System:** Dynamic phase loading and routing managed by `gamePhase.js`
- **State Management:** Game state persisted to localStorage with automatic saving
- **Performance Optimized:** RAF loops, icon caching, and batched UI updates

### Available Scripts

```bash
# Run tests
npm test

# Run linter
npm run lint
```

## 🎯 Game Mechanics

### Energy System
- **Primary Energy:** 100 capacity, used for manual and early auto-play
- **Reserve Energy:** 1,500 capacity, buffer for extended gameplay
- **Passive Generation:** Unlockable energy regeneration over time

### Progression Path
1. Manual rock-paper-scissors gameplay
2. Unlock AutoPlay automation
3. Increase game speed (up to 56x)
4. Add multiple game boards
5. Merge into the Factory for 10x multiplier
6. Unlock the Bank to transfer to Stage 2
7. Build and grow your civilization

### Resource Management
- **Stars:** Primary currency earned from winning games
- **Science:** Research currency in Stage 2
- **Population:** Workforce that generates stars and science
- **Supplies:** Food production needed for population growth

## 💾 Save System

The game automatically saves progress to browser localStorage:
- **Stage 1:** Saved to `rpi-save`
- **Stage 2:** Saved to `rpi-stage2`
- **Stars Transfer:** Uses `rpi-stars` for phase transition

## 🐛 Known Issues

- Global function exposure in Stage 2 (uses inline onclick handlers)
- No module bundler - raw ES modules loaded directly

## 📝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC License

## 🎨 Credits

- Game Design & Development: [Your Name]
- Icons: Lucide Icons
- CSS Framework: Tailwind CSS

## 📊 Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

Current Version: **v1.9.0**

---

**Enjoy the journey from simple clicks to infinite growth! 🚀**
