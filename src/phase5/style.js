/**
 * Chapter V · UNITY: its look. The vault's house style, reused: the same panel, CRT, dymo labels,
 * stop box, time buttons and card bar (src/phase4v/style.js VAULT_CSS, scoped to this act's root),
 * plus what is new here: the four flows with their word, GROW AS, MINDS, EDGE and the guide box.
 * Colours only from VT. One meaning per accent: amber = look here, pulse = the body, danger = the red word.
 */
import { VAULT_CSS, VT } from '../phase4v/style.js';

export { VT };
export const UNITY_CSS = VAULT_CSS.replaceAll('#phase-vault', '#phase-unity').replaceAll('in-vault', 'in-unity') + `
#phase-unity .v-panel { overflow-y: auto; overflow-x: hidden; scrollbar-width: none; gap: 8px; bottom: 84px; }
#phase-unity .v-panel::-webkit-scrollbar { display: none; }
#phase-unity .v-crt { min-height: 80px; font-size: 13px; line-height: 19px; padding: 6px 10px; }
#phase-unity .v-build { left: 332px; right: 16px; height: 92px; }
#phase-unity .v-card { max-width: 190px; }
#phase-unity .v-card .need { -webkit-line-clamp: 1; }

.u-body .val { font-size: 26px; }
.u-flows { display: flex; flex-direction: column; gap: 5px; padding: 8px 10px; border-radius: 8px; background: rgba(0,0,0,0.25); box-shadow: inset 0 0 0 1px rgba(0,0,0,0.6); }
.u-flow { display: grid; grid-template-columns: 92px 1fr; align-items: baseline; column-gap: 8px; }
.u-flow .dymo { font-size: 13px; line-height: 13px; padding: 2px 6px 1px; justify-self: start; }
.u-flow .val { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 19px; letter-spacing: 0.04em; color: var(--v-paper); text-align: right; white-space: nowrap; }
.u-flow .word { grid-column: 1 / -1; font-size: 12px; line-height: 15px; text-align: right; min-height: 0; }
.u-flow .word.red { color: var(--v-danger); font-weight: 700; font-size: 14px; text-shadow: 0 0 8px rgba(255,107,90,0.45); animation: u-red 1.7s ease-in-out infinite; }
.u-flow .word.yellow { color: var(--v-amber); }
.u-flow.is-red .val { color: var(--v-danger); }
@keyframes u-red { 50% { opacity: 0.65; } }
.u-flow .sub { grid-column: 1 / -1; font-size: 11px; color: var(--v-mist); text-align: right; margin-top: -2px; }
.u-flow .v-bar { grid-column: 1 / -1; height: 5px; }
.u-sec { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
.u-sec .dymo { font-size: 13px; line-height: 13px; padding: 2px 6px 1px; }
.u-sec .hint { font-size: 11px; color: var(--v-mist); }
.u-buys { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
.u-btn { border: 0; border-radius: 6px; background: var(--v-paper); color: var(--v-ink); padding: 6px 4px 5px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px;
  font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 16px; letter-spacing: 0.08em; line-height: 16px; }
.u-btn .p { font-family: system-ui, sans-serif; font-size: 10px; letter-spacing: 0; color: var(--v-steel3); }
.u-btn.flesh { background: var(--v-pulse); color: #f6e6e8; }
.u-btn.flesh .p { color: #f6c9cf; }
.u-btn:disabled { background: var(--v-steel3); color: var(--v-mist); cursor: default; }
.u-btn:disabled .p { color: var(--v-mist); }
.u-btn.focus { animation: v-focus 1s ease-in-out infinite; box-shadow: 0 0 0 2px var(--v-amber); }
.u-btn.on { background: var(--v-pulse); color: #f6e6e8; box-shadow: 0 0 10px rgba(168,19,44,0.6); }
.u-btn.on .p { color: #f6c9cf; }
.u-btn.want { box-shadow: 0 0 0 2px var(--v-amber); }
.u-edge-line { font-size: 11px; color: var(--v-mist); text-align: right; min-height: 14px; }
.u-edge-line.bad { color: var(--v-amber); }
.u-grow { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; }
.u-row { display: grid; grid-template-columns: 1fr auto; align-items: center; column-gap: 4px; font-size: 11px; color: var(--v-plate); }
.u-row input[type=range] { grid-column: 1 / -1; }
.u-row .n { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 13px; letter-spacing: 0.08em; line-height: 14px; }
.u-row .pc { text-align: right; font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 14px; color: var(--v-paper); }
.u-sec .hint.warn { color: var(--v-amber); }
#phase-unity .v-log > div { white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
#phase-unity .v-build.paused .v-card, #phase-unity .v-build.paused .v-build-btn { filter: grayscale(1) brightness(0.6); pointer-events: none; }
.u-row.zero, .u-row.locked { opacity: 0.38; }
.u-row.locked .pc { color: var(--v-mist); }
.u-row.red .n { color: var(--v-danger); }
.u-row.yellow .n { color: var(--v-amber); }
.u-row input[type=range] { width: 100%; height: 10px; margin: 0; accent-color: var(--v-pulse); cursor: pointer; }
.u-row input[type=range]:disabled { cursor: default; }
.u-minds { display: grid; grid-template-columns: 1fr; gap: 3px; }
.u-minds .lbl { display: flex; justify-content: space-between; font-size: 11px; color: var(--v-mist); }
.u-minds input[type=range] { width: 100%; accent-color: var(--v-cold); margin: 0; }
.u-guide { position: absolute; right: 16px; bottom: 120px; width: 270px; padding: 10px 14px 11px; border-radius: 10px; z-index: 8; box-sizing: border-box;
  background: linear-gradient(180deg, var(--v-steel2) 0%, var(--v-steel) 100%); box-shadow: 0 14px 30px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.7);
  transition: opacity 500ms ease, transform 500ms ease; }
.u-guide.gone { opacity: 0; transform: translateY(8px); pointer-events: none; }
.u-guide .who { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 15px; letter-spacing: 0.12em; color: var(--v-amber); }
.u-guide .txt { font-size: 13px; line-height: 18px; color: var(--v-plate); margin-top: 2px; }
#phase-unity .v-card.ins .p { color: var(--v-pulse); }
#phase-unity .v-card.join { background: var(--v-amber); color: var(--v-ink); box-shadow: 0 0 14px rgba(255,214,120,0.45); }
#phase-unity .v-card.join .p, #phase-unity .v-card.join .d { color: var(--v-steel3); }
#phase-unity .v-card.join.off { background: var(--v-steel3); color: var(--v-amber); box-shadow: inset 0 0 0 1.5px var(--v-amber); }
#phase-unity .v-card.join.off .need { color: var(--v-amber); }
#phase-unity .v-card.multi .n { font-weight: 600; }
#phase-unity .v-card.answer { box-shadow: 0 0 0 2px var(--v-amber), 0 2px 6px rgba(0,0,0,0.5); }
#phase-unity .v-build-btn.has { box-shadow: inset 0 0 0 2px var(--v-amber); }
#phase-unity canvas.v-cut { cursor: crosshair; }
.u-seed { display: flex; flex-direction: column; gap: 2px; }
.u-srow { display: grid; grid-template-columns: 52px 22px 22px 22px 1fr; align-items: center; gap: 4px; font-size: 11px; color: var(--v-mist); }
.u-srow .n { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 14px; letter-spacing: 0.08em; color: var(--v-plate); }
.u-srow .v { text-align: center; font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 17px; color: var(--v-paper); }
.u-pm { border: 0; border-radius: 4px; height: 20px; background: var(--v-steel3); color: var(--v-paper); cursor: pointer; font-size: 14px; line-height: 14px; padding: 0; }
.u-pm:disabled { opacity: 0.35; cursor: default; }
.u-seed-to { font-size: 12px; color: var(--v-plate); margin-top: 2px; }
.u-launch { flex-direction: row; justify-content: space-between; padding: 7px 10px; margin-top: 4px; width: 100%; }
.u-seed-no { font-size: 11px; color: var(--v-amber); min-height: 0; }
.u-extra { width: 100%; height: 22px; font-size: 11px; margin-top: 3px; letter-spacing: 0.04em; }
.u-extra[hidden] { display: none; }
.u-more { border: 0; background: none; color: var(--v-mist); font-size: 11px; padding: 2px 0; cursor: pointer; text-align: left; }
.u-more:hover { color: var(--v-paper); }
.u-row[hidden] { display: none; }
#phase-unity.is-planet .v-crt { min-height: 46px; }
.u-grow.three { grid-template-columns: 1fr 1fr 1fr; column-gap: 8px; }
.u-grow.three .u-row .n { font-size: 11px; letter-spacing: 0.04em; }
.u-btn .g { font-family: system-ui, sans-serif; font-size: 9px; letter-spacing: 0; line-height: 11px; opacity: 0.85; text-transform: none; }
#phase-unity.is-zooming .v-panel, #phase-unity.is-zooming .v-build { opacity: 0.25; transition: opacity 800ms ease; }
`;
