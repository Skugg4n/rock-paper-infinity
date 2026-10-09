/**
 * Chapter IV · THE DEEP, the dig: the sound, on src/audio.js's graph (its buses, its Sound and Music
 * choices, its first-click unlocking). A short low crackle per tile dug, a pling per piece home,
 * a drone that sinks with the depth, a pulse in the flesh that grows near the heart. `stop()` takes
 * everything down.
 */

import { audio } from '../audio.js';

/** The drone's pitch at a depth: lower the deeper (Hz). */
export const droneHz = (m) => 55 * Math.pow(2, -Math.min(2000, Math.max(0, m)) / 1200);
/** How loud the heart is, 0 to 1, by depth: heard from 1 600 m. */
export const heartLevel = (m) => Math.max(0, Math.min(1, (m - 1600) / 400));

export function createDigSound() {
    let g = null, drone = null, droneGain = null, beatT = 0, stopped = false;
    const node = () => {
        if (stopped) return null;
        if (g) return g;
        g = audio.graph ? audio.graph() : null;
        if (!g) return null;
        drone = g.ctx.createOscillator();
        drone.type = 'sawtooth';
        const lp = g.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
        droneGain = g.ctx.createGain(); droneGain.gain.value = 0;
        drone.connect(lp); lp.connect(droneGain); droneGain.connect(g.musicBus);
        drone.start();
        return g;
    };
    function thump(level, f = 52) {
        const gr = node(); if (!gr || level <= 0) return;
        const { ctx, sfxBus } = gr, t = ctx.currentTime;
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
        const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.5 * level, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(e); e.connect(sfxBus); o.start(t); o.stop(t + 0.4);
    }
    function crackle(soft) {
        const gr = node(); if (!gr || !audio.getPrefs().sfx) return;
        const { ctx, sfxBus, noiseBuf } = gr, t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = soft ? 0.4 : 0.7;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = soft ? 400 : 900;
        const e = ctx.createGain(); e.gain.setValueAtTime(soft ? 0.12 : 0.09, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        src.connect(lp); lp.connect(e); e.connect(sfxBus);
        src.start(t, Math.random() * 0.5, 0.1);
    }
    return {
        event(e) {
            if (e.type === 'dug' || e.type === 'ore') crackle(e.t === 5);
            else if (e.type === 'deliver') audio.pling();
            else if (e.type === 'buy' || e.type === 'graft') audio.thunk();
            else if (e.type === 'find' || e.type === 'record' || e.type === 'layer') audio.rise();
            else if (e.type === 'dead' || e.type === 'pod' || e.type === 'gate' || e.type === 'warn' || e.type === 'fail' || e.type === 'chamber-dark' || e.type === 'gen-stop') audio.knock();
            else if (e.type === 'repaired' || e.type === 'row') audio.thunk();
            else if (e.type === 'ping') audio.pling();
            else if (e.type === 'heart') thump(1, 40);
        },
        /** Each frame: the depth in metres and the seconds since the last. */
        update(m, dt, ended) {
            const gr = node(); if (!gr) return;
            const t = gr.ctx.currentTime;
            drone.frequency.setTargetAtTime(droneHz(m), t, 0.5);
            droneGain.gain.setTargetAtTime(ended ? 0 : 0.05 + 0.08 * Math.min(1, m / 1000), t, 0.8);
            // the flesh: a pulse; near the heart, louder
            if (m > 1500 || ended) {
                beatT += dt;
                if (beatT > 0.95) { beatT = 0; thump(ended ? 0.8 : 0.15 + 0.6 * heartLevel(m)); setTimeout(() => thump(ended ? 0.5 : 0.1 + 0.4 * heartLevel(m), 46), 180); }
            }
        },
        stop() {
            stopped = true;
            try { droneGain?.gain.setTargetAtTime(0, g.ctx.currentTime, 0.05); drone?.stop(g.ctx.currentTime + 0.3); } catch { /* gone */ }
            drone = null; droneGain = null; g = null;
        },
    };
}
