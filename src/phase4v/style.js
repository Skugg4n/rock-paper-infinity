/**
 * Chapter IV, the vault: its look, injected while the chapter is open (no new stylesheet to list).
 * Same family as the strata view: black stone, light rooms, a dark metal panel with dymo labels.
 *
 * THE PALETTE (the graphics pass, spec "Graphics pass"): every colour of the vault is one of these
 * tokens, used by this CSS (as --v-* variables) and by the canvas (view.js imports VT). One meaning
 * per accent: amber = look here, cold = sleep and power, pulse = the body, crt = the CRT only.
 */
export const VT = {
    ink: '#07080a',         // the void behind everything
    stone: '#0b0d10',       // the rock
    steel: '#12171e',       // panels, boxes (dark end)
    steel2: '#1a2029',      // panels, boxes (light end), buttons
    steel3: '#2a313b',      // raised steel, pressed buttons
    slate: '#3a4350',       // frames, lines, quiet shapes
    mist: '#8fa1b6',        // secondary text, steel highlights
    plate: '#d5dbe3',       // light: room drawings, cards (the concrete of the old act)
    paper: '#f1efe8',       // brightest: numbers, selection, people
    lamp: '#f2e2b8',        // warm light: lit windows, lamps
    cold: '#8fd0ff',        // sleep, cryo, power
    amber: '#ffd678',       // attention: wishes, wanted, complaints
    life: '#8fb27f',        // plants
    crt: '#8dff9e',         // the CRT only
    danger: '#ff6b5a',      // short, low, breaking
    pulse: '#a8132c',       // THE red: the only red that glows (src/phase4/flesh.js PULSE_RED)
    // the flesh (src/phase4/flesh.js FLESH_COLOURS)
    fDark: '#12070a', fBruise: '#2a1426', fMuscle: '#4a2a36', fDeep: '#170b10',
    fArtery: '#2c1219', fCore: '#5c1422', fHyphae: '#b9c4ca', fBone: '#b8bab4',
};
const vars = Object.entries(VT).map(([k, v]) => `--v-${k}: ${v};`).join(' ');

export const VAULT_CSS = `
#phase-vault { ${vars} }
body.in-vault { background: var(--v-ink); }
body.in-vault #pause-btn { display: none; }
#phase-vault { position: fixed; inset: 0; overflow: hidden; background: var(--v-ink); color: var(--v-paper); font-family: system-ui, -apple-system, sans-serif; z-index: 1; }
#phase-vault [hidden] { display: none !important; }
#phase-vault canvas.v-cut { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: default; }
#phase-vault .dymo { display: inline-block; padding: 3px 8px 2px; background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0.35) 100%), var(--v-ink);
  border-radius: 2px; box-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 2px 3px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.6); color: var(--v-paper);
  font-family: 'Bebas Neue', 'Arial Narrow', system-ui, sans-serif; font-size: 15px; line-height: 15px; letter-spacing: 0.14em; text-transform: uppercase;
  text-shadow: 0 -1px 0 rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.28); white-space: nowrap; user-select: none; }
.v-panel { position: absolute; left: 16px; top: 16px; bottom: 84px; width: 300px; padding: 14px 16px; border-radius: 10px; box-sizing: border-box;
  background: radial-gradient(120% 80% at 30% 0%, rgba(255,255,255,0.05), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px), linear-gradient(180deg, var(--v-steel2) 0%, var(--v-steel) 100%);
  box-shadow: 0 18px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(0,0,0,0.7);
  display: flex; flex-direction: column; gap: 12px; z-index: 5; overflow: hidden; }
.v-crt { position: relative; flex: none; background: #030604; border-radius: 6px; padding: 12px 12px 10px; min-height: 170px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-end; box-shadow: inset 0 0 18px rgba(0,0,0,0.9), 0 0 0 2px var(--v-ink), 0 0 0 3px var(--v-slate);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 14px; line-height: 21px; color: var(--v-crt); text-shadow: 0 0 6px rgba(120,255,140,0.45); overflow: hidden; }
.v-crt::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px); border-radius: 6px; }
.v-crt .l { white-space: pre-wrap; word-break: break-word; opacity: 0.55; }
.v-crt .l.new { opacity: 1; }
.v-crt .l.res { color: #e8ffd9; }
.v-crt .l.sys { color: var(--v-crt); }
.v-crt .l.mark { color: var(--v-amber); text-shadow: 0 0 6px rgba(255,214,120,0.45); opacity: 0.95; }
.v-crt .l.mark.new { opacity: 1; }
.v-crt .l.mark::after { content: ''; display: block; height: 1px; margin-top: -2px; background: var(--v-amber); opacity: 0.8; animation: v-underline 520ms steps(1) 2, v-underline-fade 3s ease-out 1040ms forwards; }
@keyframes v-underline { 50% { opacity: 0; } }
@keyframes v-underline-fade { to { opacity: 0.25; } }
.v-crt .l.comp { color: var(--v-paper); font-weight: 700; letter-spacing: 0.02em; }
.v-crt .l.comp::before { content: '>> '; color: var(--v-danger); font-weight: 700; }
.v-crt .l.comp.new { animation: v-shout 260ms ease-out; }
@keyframes v-shout { 0% { transform: translateX(-3px); } 40% { transform: translateX(3px); } 100% { transform: none; } }
.v-crt .cur { display: inline-block; width: 8px; height: 14px; background: var(--v-crt); vertical-align: -1px; animation: v-blink 1s steps(1) infinite; }
@keyframes v-blink { 50% { opacity: 0; } }
.v-gauge { display: flex; flex-direction: column; gap: 5px; transition: opacity 600ms ease, filter 600ms ease; }
.v-gauge .row { display: flex; align-items: baseline; justify-content: space-between; }
.v-gauge .val { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 26px; letter-spacing: 0.04em; color: var(--v-paper); line-height: 22px; }
.v-gauge .sub { font-size: 11px; color: var(--v-mist); }
.v-bar { height: 8px; border-radius: 4px; background: var(--v-ink); box-shadow: inset 0 1px 2px rgba(0,0,0,0.8); overflow: hidden; position: relative; }
.v-bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--v-cold); transition: width 300ms ease, background 300ms ease; }
.v-bar > b { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--v-paper); opacity: 0.7; }
.v-gauge.is-red .val { color: var(--v-danger); }
.v-gauge.flash-up .val { animation: v-up 700ms ease-out; }
.v-gauge.flash-down .val { animation: v-down 700ms ease-out; }
@keyframes v-up { 0% { color: #bdf5c4; transform: translateY(-3px) scale(1.12); } 100% { transform: none; } }
@keyframes v-down { 0% { color: var(--v-danger); transform: translateY(2px) scale(0.94); } 100% { transform: none; } }
.v-log { margin-top: -6px; font-size: 11px; line-height: 14px; color: var(--v-mist); opacity: 0.75; min-height: 42px; }
.v-log > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v-req { height: 4px; margin-top: -8px; border-radius: 2px; background: var(--v-ink); overflow: hidden; position: relative; }
.v-req > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; transition: width 300ms linear; }
.v-check { display: flex; flex-direction: column; gap: 6px; }
.v-check .c { display: flex; align-items: center; gap: 8px; }
.v-check .box { width: 12px; height: 12px; border-radius: 2px; box-shadow: inset 0 0 0 1.5px var(--v-mist); }
.v-check .c.done .box { background: var(--v-pulse); box-shadow: inset 0 0 0 1.5px var(--v-pulse), 0 0 8px rgba(168,19,44,0.7); }
.v-check .c.done .box::after { content: ''; display: block; width: 4px; height: 7px; margin: 1px 0 0 4px; border: solid var(--v-paper); border-width: 0 2px 2px 0; transform: rotate(45deg); }
.v-check .c.in { justify-content: space-between; margin-top: 2px; }
.v-check .c .val { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 22px; letter-spacing: 0.05em; color: var(--v-paper); }
#phase-vault.is-slow canvas.v-cut { filter: saturate(0.7) brightness(0.9); }
#phase-vault canvas.v-cut { transition: filter 400ms ease; }
.v-rows { display: flex; flex-direction: column; gap: 6px; margin-top: auto; }
.v-rows .r { display: flex; justify-content: space-between; align-items: center; }
.v-rows .r .val { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 22px; letter-spacing: 0.05em; color: var(--v-paper); }
.v-off { opacity: 0.25; filter: grayscale(1); }
.v-lamp-off { opacity: 0; transform: translateY(4px); }
.v-panel > * { transition: opacity 500ms ease, transform 500ms ease; }
.v-time { position: absolute; left: 124px; bottom: 16px; display: flex; gap: 6px; z-index: 6; }
.v-time button { width: 40px; height: 36px; border-radius: 6px; border: 0; background: var(--v-steel2); color: var(--v-mist); font-size: 13px; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06); }
.v-time button.on { background: var(--v-paper); color: var(--v-ink); }
.v-build { position: absolute; left: 332px; right: 16px; bottom: 12px; height: 96px; display: flex; gap: 10px; align-items: stretch; z-index: 6; }
.v-build-btn { width: 84px; flex: none; border: 0; border-radius: 8px; background: var(--v-steel2); color: var(--v-paper); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06); }
.v-build-btn.on { background: var(--v-steel3); box-shadow: inset 0 0 0 2px var(--v-paper); }
.v-cards { display: flex; gap: 6px; overflow: hidden; flex: 1; }
.v-cards[hidden] { display: none; }
.v-card { position: relative; flex: 1 1 0; min-width: 0; max-width: 150px; border: 0; border-radius: 8px; background: var(--v-plate); color: var(--v-steel); text-align: left; padding: 7px 8px; cursor: pointer; display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.5); font-size: 11px; line-height: 14px; }
.v-card .top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.v-card .n { font-weight: 700; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v-card .p { font-size: 11px; color: var(--v-steel3); white-space: nowrap; }
.v-card .d { font-size: 11px; line-height: 13px; color: var(--v-slate); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.v-card .need { font-size: 11px; line-height: 13px; color: #8a3a2a; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.v-card.off { background: var(--v-steel3); color: var(--v-mist); cursor: default; }
.v-card.off .p, .v-card.off .d { color: var(--v-mist); }
.v-card.off .need { color: var(--v-danger); }
.v-card.armed { box-shadow: 0 0 0 3px var(--v-paper), 0 2px 6px rgba(0,0,0,0.5); }
.v-card .mark { position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; border-radius: 50%; background: var(--v-amber); box-shadow: 0 0 8px rgba(255,214,120,0.8); }
.v-info { position: fixed; left: 0; top: 0; width: 252px; padding: 14px 16px; border-radius: 10px; z-index: 7; box-sizing: border-box;
  background: linear-gradient(180deg, var(--v-steel2) 0%, var(--v-steel) 100%); box-shadow: 0 18px 40px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 10px; }
.v-info[hidden] { display: none; }
.v-info.tile { width: auto; padding: 6px; gap: 4px; background: rgba(18,23,30,0.92); }
.v-info.tile .need { margin: 0 4px 2px; }
.v-info .t { display: flex; justify-content: space-between; align-items: center; }
.v-info .lv { font-size: 11px; color: var(--v-mist); }
.v-info .desc { font-size: 13px; line-height: 18px; color: var(--v-plate); }
.v-info .acts { display: flex; flex-direction: column; gap: 6px; }
.v-info button.a { border: 0; border-radius: 6px; background: var(--v-paper); color: var(--v-ink); padding: 8px 10px; font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 17px; letter-spacing: 0.1em; cursor: pointer; text-align: left; }
.v-info button.a.flesh { background: var(--v-pulse); color: #f6e6e8; }
.v-info .grp { margin-top: 2px; }
.v-info button.a.organ:disabled { background: #1a0306; color: var(--v-mist); box-shadow: inset 0 0 0 1px #4a2a30; }
.v-info button.a:disabled { background: var(--v-steel3); color: var(--v-mist); cursor: default; }
.v-info .need { font-size: 11px; color: var(--v-danger); margin-top: -3px; }
.v-info .hint { font-size: 11px; line-height: 15px; color: var(--v-mist); margin-top: -3px; margin-bottom: 2px; }
.v-info button.a.quiet { background: var(--v-steel3); color: var(--v-plate); box-shadow: inset 0 0 0 1px #4a2a30; }
.v-info button.a.dark { background: #1a0306; color: #ff4d5e; box-shadow: inset 0 0 0 2px var(--v-pulse), 0 0 14px rgba(168,19,44,0.45); animation: v-throb 1.7s ease-in-out infinite; }
.v-crt.bang { animation: v-bang 420ms linear; }
@keyframes v-bang { 10%, 50%, 90% { transform: translate(-4px, 1px); } 30%, 70% { transform: translate(4px, -1px); } }
#phase-vault.is-rising canvas.v-cut { animation: v-quake 260ms linear infinite; }
@keyframes v-quake { 25% { transform: translate(2px, -1px); } 75% { transform: translate(-2px, 1px); } }
#phase-vault.is-rising .v-panel, #phase-vault.is-rising .v-build, #phase-vault.is-rising .v-time { opacity: 0.15; transition: opacity 1.5s ease; }
.v-rise { white-space: nowrap; position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 8; border: 0; border-radius: 10px; padding: 14px 44px; background: var(--v-pulse); color: #f6e6e8;
  font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 34px; letter-spacing: 0.3em; cursor: pointer; box-shadow: 0 0 40px rgba(168,19,44,0.7); animation: v-throb 1.7s ease-in-out infinite; }
.v-rise[hidden] { display: none; }
@keyframes v-throb { 50% { box-shadow: 0 0 70px rgba(168,19,44,0.95); } }
#phase-vault.is-night .v-panel { filter: brightness(0.82); }
#phase-vault.is-night .v-dim { opacity: 0.35; }
.v-mark { position: absolute; right: 16px; bottom: 116px; z-index: 4; }
`;
