# Code Review - Rock Paper Infinity

## Critical Issues

### 1. **Population Requirement Inconsistencies in Stage 2** ⚠️ HIGH PRIORITY
**File:** `src/phase2/index.js`

There are mismatches between the `popReq` values defined in the upgrades array and the actual population checks used in disabled states and tooltips:

| Upgrade | popReq (Line 299-305) | Actual Check (Lines 325-331, 338-350) | Impact |
|---------|----------------------|----------------------------------------|--------|
| Tool Case | 25 | 50 | Button appears at 25 pop but disabled until 50 |
| GMO | 50 | 75 | Button appears at 50 pop but disabled until 75 |
| Expand Land | 750 | 1000 | Button appears at 750 pop but disabled until 1000 |

**Recommendation:** Make `popReq` values match the actual requirements, OR use the `popReq` variable consistently throughout.

---

### 2. **Package.json Configuration Errors**
**File:** `package.json`

- **Line 5:** `"main": "index.js"` - File doesn't exist (should be `main.js` or removed)
- **Line 13:** `"type": "commonjs"` - Project uses ES modules, should be `"module"`
- Missing metadata: `author`, `description`, `keywords`

---

### 3. **Duplicate SVG Assets** 💾 CLEANUP NEEDED
- **37 SVG files** in project root
- **19 SVG files** in `/graphics` directory
- Many are duplicates (e.g., battery-*.svg, building*.svg)
- **Impact:** Confusion about canonical source, unnecessary repo bloat

**Recommendation:** Delete all root SVG files, keep only `/graphics` versions.

---

## Code Quality Issues

### 4. **Language Mixing (Swedish/English)**
**Files:** `src/phase1/index.js`, `src/phase2/index.js`

Inconsistent language usage throughout:
- Swedish comments: `// Spelvariabler`, `// DOM-element` (phase1/index.js:35, 4)
- Swedish UI text: `"Öppna Plånboken (Bank)"` (phase1/index.js:150)
- Swedish variable name: `verktygUnlocked` (phase2/index.js:22)
- Mixed in tooltips: `"industri"` (phase2/index.js:438)

**Recommendation:** Choose one language (preferably English) for all code, comments, and internal strings.

---

### 5. **Architectural Inconsistencies**

#### Icon Systems
- **Stage 1:** Custom SVG preloading system (`src/icons.js`)
- **Stage 2:** Lucide CDN (`https://unpkg.com/lucide@latest`)
- **Impact:** Two different approaches doing the same thing

#### Styling Approaches
- **Stage 1:** External CSS file (`style.css`)
- **Stage 2:** Inline `<style>` tag in HTML
- **Recommendation:** Extract stage-2 styles to `style-stage2.css`

---

### 6. **Global Namespace Pollution**
**File:** `src/phase2/index.js:555-556`

```javascript
window.sellBuilding = sellBuilding;
window.upgradeBuilding = upgradeBuilding;
```

Functions exposed to global scope for inline `onclick` handlers.

**Recommendation:** Use event delegation instead of inline handlers.

---

### 7. **Monolithic Files**
- `src/phase1/index.js`: **1,066 lines** - Contains game logic, UI rendering, state management, animations
- `src/phase2/index.js`: **571 lines** - Similar mix of concerns

**Recommendation:** Split into modules:
- `state.js` - Game state management
- `ui.js` - UI rendering
- `upgrades.js` - Upgrade logic
- `buildings.js` - Building system (for phase 2)

---

## Minor Issues

### 8. **Magic Numbers**
Constants hardcoded throughout the code:
- `MAX_ENERGY = 100`
- `MAX_RESERVE_ENERGY = 1500`
- `MAX_QUANTUM_FOAM = 1000`
- `HYPER_SPEED_THRESHOLD = 10`

**Recommendation:** Create a `constants.js` file for centralized configuration.

---

### 9. **Inconsistent Variable Naming**
- Phase 1: English (`starBalance`, `gameSpeed`)
- Phase 2: Mixed (`verktygUnlocked`, `gmoLevel`)

---

### 10. **ESLint Configuration**
**File:** `.eslintrc.*` (if exists)

- Main.js is ignored from linting (bootstrap file should be linted)
- Minimal rules defined

**Recommendation:** Enable recommended ESLint rules for better code quality.

---

### 11. **Missing Documentation**
- ❌ No `README.md`
- ❌ No JSDoc comments on functions
- ✅ `CHANGELOG.md` exists but incomplete

**Recommendation:** Add README with:
- Project overview
- Setup instructions
- Development guidelines
- Architecture explanation

---

### 12. **Limited Test Coverage**
- Only `roman.test.js` with 5 test cases
- No tests for game logic, state management, or UI
- Jest configured but underutilized

**Recommendation:** Add tests for:
- Game state mutations
- Upgrade unlock conditions
- Save/load functionality
- Population requirements logic

---

## Positive Aspects ✅

Despite the issues, the codebase demonstrates:
- ✅ Clear phase separation with proper init/teardown lifecycle
- ✅ Performance awareness (RAF loops, icon caching, batched updates)
- ✅ Robust localStorage persistence
- ✅ Well-designed progressive disclosure system
- ✅ Active maintenance (v1.3.14 from 2025-11-26)

---

## Priority Fixes

### Immediate (This Sprint)
1. ⚠️ Fix population requirement inconsistencies in Stage 2
2. ⚠️ Fix `package.json` main entry point
3. 🧹 Delete duplicate SVG files from root
4. 📝 Add basic README.md

### Short-term (Next Sprint)
1. Extract Stage 2 inline styles to separate CSS file
2. Standardize language to English throughout
3. Create constants.js for magic numbers
4. Remove global function exposure

### Long-term (Future Consideration)
1. Refactor monolithic phase files into modules
2. Introduce build system (Vite)
3. Migrate to TypeScript
4. Expand test coverage
5. Implement SPA routing (eliminate page reloads)

---

## Summary

**Total Issues Found:** 12 (1 critical, 4 high priority, 7 minor)

The game is functional and well-maintained, but has several consistency issues that could confuse players and make future maintenance harder. The population requirement mismatches are the most critical bug that should be fixed immediately.
