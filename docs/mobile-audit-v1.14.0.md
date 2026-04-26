# Mobile Audit — v1.14.0

Audited: 2026-04-23  
Auditor: Claude Code (systematic pass)

---

## Existing breakpoints

### style.css
| Media query | Lines | What it covers |
|---|---|---|
| `max-width: 479px` | 5–8 | Narrows energy bars to prevent left/right collision |
| `min-width: 640px` | 64 | `.lucide-lg` grows from 40px → 56px |
| `min-width: 640px` | 71–75 | gem/crown icons grow |
| `min-width: 640px` | 191–193 | `.factory-center-icon` grows 48px → 64px |
| `min-width: 640px` | 214–216 | `.factory-rps-icon` grows 16px → 20px |
| `min-width: 640px` | 224–232 | `@keyframes convey-in` wider travel at 640px+ |
| `min-width: 640px` | 245–247 | `.factory-star-icon` grows 14px → 18px |
| `min-width: 640px` | 256–264 | `@keyframes convey-out` wider travel at 640px+ |
| `prefers-reduced-motion: reduce` | 406–420 | All animations/transitions collapse |

### style-stage2.css
| Media query | Lines | What it covers |
|---|---|---|
| `min-width: 640px` | 25–31 | Phase 2 `.btn` grows 40px → 56px |
| `min-width: 640px` | 117–123 | `.building-slot` grows 56px → 96px |
| `min-width: 640px` | 159–164 | Building icons grow 24px → 40px |
| `min-width: 640px` | 184–190 | `.building-action-btn` grows 18px → 24px |
| `min-width: 640px` | 274–278 | `#allocation-slider-container` grows 150px → 200px |
| `min-width: 640px` | 326–329 | `.factory-smoke .smoke-icon` grows 12px → 16px |
| `min-width: 640px` | 345–352 | `@keyframes p2-convey` wider travel at 640px+ |
| `min-width: 640px` | 363–367 | `.supplies-track` grows 100px → 140px |
| `prefers-reduced-motion: reduce` | 436–443 | All animations/transitions collapse |

### index.html — Tailwind responsive classes
Both phase containers use `sm:` (640px) and `md:` (768px) for:
- Top/side positioning (`top-4` → `sm:top-8`, `left-3` → `sm:left-4` → `md:left-8`)
- Icon sizes (`w-5 h-5` → `sm:w-7 sm:h-7`)
- Font sizes (`text-xl` → `sm:text-3xl`, `text-sm` → `sm:text-lg`)
- Gaps (`gap-1.5` → `sm:gap-2`, `gap-3` → `sm:gap-6`)
- Button sizes (`w-12 h-12` → `sm:w-16 sm:h-16`)
- Energy bar sizes (`w-3 h-24` → `sm:w-4 sm:h-32`)

---

## Phase 1 mobile state

### Upgrade tray (bottom-right)
- **Tray position**: `absolute bottom-4 right-3` (all widths). On 320px, tray is 12px from the right edge.
- **Button size**: `p-3 rounded-full` on a `.btn` which is `w: 100%`. There is NO explicit `w-N h-N` on upgrade tray buttons in HTML. The `.btn` class in `style.css` sets `width: 100%; height: 100%` and the button is sized by whatever wraps it. The progress-ring SVG is `absolute inset-0 w-full h-full` and the SVG `viewBox` is `0 0 36 36`. The icon inside is `w-6 h-6` (24px). The `p-3` padding = 12px each side + 24px icon = **48px total**. This is fine for tap targets.
- **Up to 7 buttons stacked** (`gap-3` = 12px between): 7 × 48px + 6 × 12px = 408px. At 320px with 667px browser height (Samsung A series) or even 600px height, this is borderline. At 568px height (iPhone SE landscape), the tray **definitely overflows**. In portrait (568px height on iPhone SE — actually 667px portrait), 408px tray + 16px bottom offset = 424px from bottom, leaving 243px. **Tight but technically fits on 667px. On 568px portrait it overflows.**
- **More critical**: the footer is `h-40` (160px) from bottom. The upgrade tray is positioned at `bottom-4`, overlapping the footer. No collision guard.

### Win/games tracker (top-right) vs left panel (top-left)
- Left panel: `absolute top-4 left-3 max-w-[60vw]`. At 320px, max-width = 192px.
- Right panel: `absolute top-4 right-3`. Contains game counters (games value + wins value with icons, `text-xs sm:text-sm`). These are non-interactive (no touch target concern).
- Collision analysis at 320px: 192px left + 12px left-gap = 204px used on the left. Right panel starts at `320 - 12 - (est. 30px for two text columns)` = ~278px from left. There's ~74px of gap — **no collision**, confirmed safe.

### Choice buttons
- `w-12 h-12 sm:w-16 sm:h-16` = 48px at 320px. **Passes 44px minimum.** The 3 buttons plus 2 optional buttons (manualRecharge, autoPlay) in `gap-1.5` (6px). All 3 core + 2 optional visible: 5 × 48px + 4 × 6px = 264px row width. Within `max-w-sm` (384px) and `w-full`. At 320px with 8px (p-4) padding on each side, usable = 304px. 264px row fits fine. **OK.**

### Energy bars (top-right)
- At <480px CSS forces: `energy-container` 8px wide × 80px tall; `reserve-energy-container` 10px wide × 88px tall. Non-interactive, no tap target concern.

### Footer (player-zone)
- `h-40` = 160px fixed. On 320px portrait this is ~24% of a 667px screen. On 568px this is 28%. Usable main area = `100svh - h-12 header - h-40 footer` = roughly `100svh - 208px`. On 568px: 360px for the game boards. **Fine.**

### Phase 1 factory animation
- Factory button: `p-3` padding + `w-6 h-6` icon = 48px. Animation elements use `position: absolute; overflow: hidden` — **contained**. The `convey-in` keyframe translates to `-100px` on mobile, which stays inside the `position: relative` ancestor. **OK.**

---

## Phase 2 mobile state

### Stats area (top-left)
- Stars icon: `w-5 h-5` (20px) — non-interactive, decorative.
- Star count: `text-xl sm:text-3xl` — text only, non-interactive.
- Science row, allocation slider all use `p2-disclose` — hidden until population thresholds.
- Slider container: `width: 150px` at <640px. Slider thumb: 20×20px **below 44px minimum.** **BUG.**
- At 320px: left panel takes ~160px wide max (star icon 20px + gap 8px + text up to 130px). Population/supplies top-right at `right: 12px`. Supplies track is `100px` wide at <640px. No overlap issue found.

### Building grid (Phase 2 land grid)
- **10 slots** in `grid-cols-5 gap-1.5 sm:gap-4` (`gap-1.5` = 6px on mobile).
- Each slot: `width: 56px; height: 56px` at <640px (from `.building-slot` CSS).
- Layout: container has `p-4` (16px each side). Usable width = 320 - 32 = 288px.
- 5 columns + 4 gaps of 6px = 5 × 56px + 4 × 6px = 280px + 24px = 304px. **OVERFLOW! 304px > 288px.** **BUG.**
- The grid overflows by 16px at 320px. At 375px (usable = 343px), still: 304px. **Fits at 375px.** At 320px it overflows by ~16px.

### Build menu (bottom-right, Phase 2)
- Buttons: `.btn` = `width: 40px; height: 40px` at <640px. **BELOW 44px minimum.** **BUG.**
- 8+ buttons stacked in `flex-col gap-3`. On 320px, 8 × 40px + 7 × 12px = 404px stacked height. Similar vertical overflow risk to Phase 1 tray.
- Bottom position `bottom-4` (16px). If 8 buttons visible simultaneously: 404px + 16px = 420px from bottom. At 667px height: 247px available above — tray starts at y=247 from top. Potentially clipping with the Phase 2 top stats area.

### Building action buttons (sell-btn "−", upgrade-btn "+")
- `.building-action-btn`: `width: 18px; height: 18px` at <640px. **WELL BELOW 44px minimum.** **BUG.**
- These are the most critically undersized touch targets in the whole app.
- At ≥640px they grow to 24px, still below 44px. **BUG at all sizes.**

### Supplies track
- `width: 100px; height: 10px` at <640px. Non-interactive display. **OK.**

### Competitor island
- `w-24 h-24 rounded-xl` with `w-12 h-12` icon inside. Non-interactive. **OK.**

---

## Chapter card mobile state

- `.chapter-card__title`: `clamp(64px, 14vw, 160px)`. At 320px: `14vw = 44.8px` → clamps to minimum 64px.
- "TRIVIAL" = 7 chars × ~37px average char width (Bebas Neue at 64px) ≈ 260px. **Fits in 320px**.
- "CAPITAL" = 7 chars ≈ 260px. **Fits.**
- "WAR" = 3 chars ≈ 112px. **Fits.**
- `.chapter-card__roman`: `clamp(28px, 6vw, 56px)`. At 320px: `6vw = 19.2px` → clamps to 28px. **OK.**
- `.chapter-card__suffix`: `clamp(20px, 3vw, 28px)`. At 320px: `3vw = 9.6px` → clamps to 20px. **OK.**
- No overflow issues identified.

---

## Touch targets

All interactive elements, minimum size at smallest applicable viewport:

| Element | Location | Size at <640px | Passes 44px? |
|---|---|---|---|
| Rock/Paper/Scissors buttons | Phase 1, bottom | 48×48px | YES |
| Manual Recharge button | Phase 1, bottom | 48×48px | YES |
| AutoPlay button | Phase 1, bottom | 48×48px | YES |
| Phase 1 upgrade tray buttons (p-3 + w-6 h-6) | Phase 1, bottom-right | ~48×48px | YES |
| Collapse Foam button | Phase 1, top-right | 48×48px (`w-12 h-12`) | YES |
| Menu button | Global, fixed bottom-left | 48×48px (`w-12 h-12`) | YES |
| Reset button (dropdown) | Global, menu | ~36px height | BORDERLINE (no explicit height) |
| Phase 2 build/upgrade buttons `.btn` | Phase 2, bottom-right | 40×40px | **NO** (-4px) |
| Allocation slider thumb | Phase 2, top-left | 20×20px | **NO** (-24px) |
| Building sell-btn (`−`) | Phase 2, building corners | 18×18px | **NO** (-26px) |
| Building upgrade-btn (`+`) | Phase 2, building corners | 18×18px | **NO** (-26px) |
| Debug trigger (Phase 1) | Phase 1, top-left | 64×64px | YES (debug only) |
| Debug toggle btn (Phase 2) | Phase 2, top-left | 64×64px | YES (debug only) |
| Debug menu buttons | Both phases | varies | LOW PRIORITY (debug only) |

---

## Tap-friendly spacing

### Phase 1
- Choice buttons: `gap-1.5` (6px) between 48px buttons. Total row = 3 × 48 + 2 × 6 = 156px. Gap is small but buttons are large enough. **Acceptable.**
- Upgrade tray: `gap-3` (12px) between ~48px buttons. **OK.**

### Phase 2
- Build menu: `gap-3` (12px) between 40px buttons. With 40px targets the total gap between hit zones = 12px. **Tight but acceptable if buttons reach 44px.**
- Building grid slots at 320px: grid slots themselves are 56px but the action buttons in corners are 18px. The sell-btn is at `top: -8px; left: -8px` — it extends outside the slot, but its hit area is just 18×18px. Buttons that small are effectively untappable on a phone.

---

## Identified issues

1. **[style-stage2.css:167-190] Building action buttons (sell/upgrade) are 18px × 18px** — barely 40% of the 44px minimum. The `+` and `−` corner buttons on building slots are the most egregious touch-target failures in the codebase. At ≥640px they grow to 24px, still far below minimum.

2. **[style-stage2.css:14-31] Phase 2 build/upgrade panel buttons are 40px × 40px** — 4px below the 44px minimum on mobile. All 8–10 `.btn` buttons in the bottom-right panel (build-home, build-store, tool-case, etc.) share this size.

3. **[style-stage2.css:280-305] Allocation slider thumb is 20px × 20px** — the `height: 20px; width: 20px` thumb rule means the user has a 20×20px touch target for the slider. The track itself is `height: 8px`. Combined, the effective tap zone at the thumb position is ~20px, well below 44px.

4. **[style-stage2.css:107-123] Building grid 5-column layout overflows at 320px** — at 320px with `p-4` container, usable width is 288px. 5 columns × 56px + 4 × 6px gap = 304px. Overflows by 16px, causing horizontal scroll or clipping.

5. **[style-stage2.css:193] Building action button tooltip is hover-only** — `.building-action-btn:hover .tooltip` triggers only on pointer hover. On touch devices there's no hover state, making the tooltip completely inaccessible on Android/iOS Chrome.

6. **[index.html:104, style-stage2.css] Phase 1 upgrade tray has no overflow guard** — with 7 buttons at 48px + `gap-3` the tray is ~408px tall. On very short screens (landscape 320px at ~568px height) or with very small screen height, the tray can extend above the visible area with no scroll or overflow handling.

7. **[index.html:207] Supplies text row uses `text-[11px]`** — The three supply labels (`-0/s`, `Balanced`, `+0/s`) are 11px text at all sizes. While not interactive, 11px is below comfortable reading size (minimum 12px) at 320px.

8. **[index.html:40-48] Phase 1 `resource-bars` has `hidden flex`** — Tailwind class combination `hidden flex` with `display: none !important` override from `style.css` means `.hidden` always wins. This is correct as documented (`.hidden { display: none !important; }`). The `flex` is only active when JS removes `.hidden`. Not a mobile bug, confirmed working.

---

## Summary of fixable issues (priority order)

| # | Issue | File | Priority |
|---|---|---|---|
| 1 | Building action buttons 18px → ≥44px | style-stage2.css | HIGH |
| 2 | Phase 2 build panel buttons 40px → 44px | style-stage2.css | HIGH |
| 3 | Building grid overflow at 320px | style-stage2.css / index.html | HIGH |
| 4 | Allocation slider thumb 20px → 44px touch area | style-stage2.css | MEDIUM |
| 5 | Supplies text too small (11px) | index.html | LOW |
| 6 | Phase 1 upgrade tray no vertical overflow guard | style.css / index.html | LOW |

## Deferred items (design decision needed)

- **Building action button tooltip on touch** — hover tooltips don't work on touch. Options: show tooltip on tap-and-hold, or show price inline on slot when selected. Needs design input. Added to PROJECTPLAN.
- **Phase 1 upgrade tray overflow on landscape/small screens** — would need a scroll container or reduced gap on short screens. Low priority; most Android Chrome users are in portrait.
- **Building grid >10 slots at 320px** — after Land Expansion 1 (15 slots) or Land Expansion 2 (20 slots), a 5-col grid at 56px/slot is increasingly cramped. At 20 slots: 4 rows × 56px + 3 × 6px = 242px tall at current gap. Width stays the same. Documented in PROJECTPLAN.
