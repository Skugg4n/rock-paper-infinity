/**
 * Chapter IV, the vault: its look, injected while the chapter is open (no new stylesheet to list).
 * Same family as the strata view: black stone, light rooms, a dark metal panel with dymo labels.
 */
export const VAULT_CSS = `
body.in-vault { background: #07080a; }
body.in-vault #pause-btn { display: none; }
#phase-vault { position: fixed; inset: 0; overflow: hidden; background: #07080a; color: #e8e6df; font-family: system-ui, -apple-system, sans-serif; z-index: 1; }
#phase-vault [hidden] { display: none !important; }
#phase-vault canvas.v-cut { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: default; }
#phase-vault .dymo { display: inline-block; padding: 3px 8px 2px; background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0.35) 100%), #0b0c0e;
  border-radius: 2px; box-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 2px 3px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.6); color: #f1efe8;
  font-family: 'Bebas Neue', 'Arial Narrow', system-ui, sans-serif; font-size: 15px; line-height: 15px; letter-spacing: 0.14em; text-transform: uppercase;
  text-shadow: 0 -1px 0 rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.28); white-space: nowrap; user-select: none; }
.v-panel { position: absolute; left: 16px; top: 16px; bottom: 84px; width: 276px; padding: 14px 16px; border-radius: 10px; box-sizing: border-box;
  background: radial-gradient(120% 80% at 30% 0%, rgba(255,255,255,0.05), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px), linear-gradient(180deg, #1a2029 0%, #12171e 100%);
  box-shadow: 0 18px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(0,0,0,0.7);
  display: flex; flex-direction: column; gap: 12px; z-index: 5; overflow: hidden; }
.v-crt { position: relative; background: #030604; border-radius: 6px; padding: 10px 10px 8px; min-height: 112px; box-shadow: inset 0 0 18px rgba(0,0,0,0.9), 0 0 0 2px #0b0f0c, 0 0 0 3px #232a24;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; line-height: 17px; color: #8dff9e; text-shadow: 0 0 6px rgba(120,255,140,0.45); overflow: hidden; }
.v-crt::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px); border-radius: 6px; }
.v-crt .l { white-space: pre-wrap; word-break: break-word; opacity: 0.55; }
.v-crt .l.new { opacity: 1; }
.v-crt .l.res { color: #e8ffd9; }
.v-crt .l.sys { color: #8dff9e; }
.v-crt .cur { display: inline-block; width: 7px; height: 12px; background: #8dff9e; vertical-align: -1px; animation: v-blink 1s steps(1) infinite; }
@keyframes v-blink { 50% { opacity: 0; } }
.v-gauge { display: flex; flex-direction: column; gap: 5px; transition: opacity 600ms ease, filter 600ms ease; }
.v-gauge .row { display: flex; align-items: baseline; justify-content: space-between; }
.v-gauge .val { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 26px; letter-spacing: 0.04em; color: #f1efe8; line-height: 22px; }
.v-gauge .sub { font-size: 11px; color: #9aa3ad; }
.v-bar { height: 8px; border-radius: 4px; background: #0a0d11; box-shadow: inset 0 1px 2px rgba(0,0,0,0.8); overflow: hidden; position: relative; }
.v-bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #8fd0ff; transition: width 300ms ease, background 300ms ease; }
.v-bar > b { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #f1efe8; opacity: 0.7; }
.v-gauge.is-red .val { color: #ff6b5a; }
.v-rows { display: flex; flex-direction: column; gap: 6px; margin-top: auto; }
.v-rows .r { display: flex; justify-content: space-between; align-items: center; }
.v-rows .r .val { font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 22px; letter-spacing: 0.05em; color: #f1efe8; }
.v-off { opacity: 0.25; filter: grayscale(1); }
.v-lamp-off { opacity: 0; transform: translateY(4px); }
.v-panel > * { transition: opacity 500ms ease, transform 500ms ease; }
.v-time { position: absolute; left: 124px; bottom: 16px; display: flex; gap: 6px; z-index: 6; }
.v-time button { width: 40px; height: 36px; border-radius: 6px; border: 0; background: #1a2029; color: #9aa3ad; font-size: 13px; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06); }
.v-time button.on { background: #f1efe8; color: #0b0c0e; }
.v-build { position: absolute; left: 308px; right: 16px; bottom: 12px; height: 96px; display: flex; gap: 10px; align-items: stretch; z-index: 6; }
.v-build-btn { width: 84px; flex: none; border: 0; border-radius: 8px; background: #1a2029; color: #f1efe8; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06); }
.v-build-btn.on { background: #2a323e; box-shadow: inset 0 0 0 2px #f1efe8; }
.v-cards { display: flex; gap: 6px; overflow: hidden; flex: 1; }
.v-cards[hidden] { display: none; }
.v-card { position: relative; flex: 1 1 0; min-width: 0; max-width: 150px; border: 0; border-radius: 8px; background: #d5dbe3; color: #12171e; text-align: left; padding: 7px 8px; cursor: pointer; display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.5); font-size: 11px; line-height: 14px; }
.v-card .top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.v-card .n { font-weight: 700; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v-card .p { font-size: 11px; color: #2b3442; white-space: nowrap; }
.v-card .d { font-size: 11px; color: #4a5462; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v-card .need { font-size: 11px; color: #8a3a2a; }
.v-card.off { background: #3a414b; color: #8d96a1; cursor: default; }
.v-card.off .p, .v-card.off .d { color: #7d8691; }
.v-card.off .need { color: #e0a090; }
.v-card.armed { box-shadow: 0 0 0 3px #f1efe8, 0 2px 6px rgba(0,0,0,0.5); }
.v-card .mark { position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; border-radius: 50%; background: #ffd678; box-shadow: 0 0 8px rgba(255,214,120,0.8); }
.v-info { position: absolute; right: 16px; top: 16px; width: 252px; padding: 14px 16px; border-radius: 10px; z-index: 7; box-sizing: border-box;
  background: linear-gradient(180deg, #1a2029 0%, #12171e 100%); box-shadow: 0 18px 40px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 10px; }
.v-info[hidden] { display: none; }
.v-info .t { display: flex; justify-content: space-between; align-items: center; }
.v-info .lv { font-size: 11px; color: #9aa3ad; }
.v-info .desc { font-size: 13px; line-height: 18px; color: #d5dbe3; }
.v-info .acts { display: flex; flex-direction: column; gap: 6px; }
.v-info button.a { border: 0; border-radius: 6px; background: #f1efe8; color: #0b0c0e; padding: 8px 10px; font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 17px; letter-spacing: 0.1em; cursor: pointer; text-align: left; }
.v-info button.a.flesh { background: #a8132c; color: #f6e6e8; }
.v-info button.a:disabled { background: #3a414b; color: #7d8691; cursor: default; }
.v-info .need { font-size: 11px; color: #e0a090; margin-top: -3px; }
.v-rise { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 8; border: 0; border-radius: 10px; padding: 14px 44px; background: #a8132c; color: #f6e6e8;
  font-family: 'Bebas Neue', 'Arial Narrow', sans-serif; font-size: 34px; letter-spacing: 0.3em; cursor: pointer; box-shadow: 0 0 40px rgba(168,19,44,0.7); animation: v-throb 1.7s ease-in-out infinite; }
.v-rise[hidden] { display: none; }
@keyframes v-throb { 50% { box-shadow: 0 0 70px rgba(168,19,44,0.95); } }
#phase-vault.is-night .v-panel { filter: brightness(0.82); }
#phase-vault.is-night .v-dim { opacity: 0.35; }
.v-mark { position: absolute; right: 16px; bottom: 116px; z-index: 4; }
`;
