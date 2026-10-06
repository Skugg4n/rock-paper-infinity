/**
 * Chapter IV, the vault: its sound, through src/audio.js only (the same buses, the same Sound and
 * Music choices, the same first-click unlocking). The words are the shared ones (click, pling,
 * knock, thunk); the night adds a low drone and, once the body grows, a slow pulse on the music bus.
 * Silent when paused or hidden; stop() takes everything down.
 */

export const DRONE_HZ = 36.7;        // a low D
export const PULSE_S = 1.7;
/** The moment's bell: an A. */
export const MOMENT_HZ = 880;

/** Which shared word plays for a rules event (pure, tested). */
export function wordFor(name) {
    return ({
        click: 'click', built: 'pling', dug: 'thunk', thanks: 'pling', request: 'click', turn: 'knock',
        riot: 'knock', fail: 'knock', pop: 'pling', miss: null, bang: 'knock', take: 'boom', flesh: 'thunk', taken: 'thunk', end: 'knock', rise: 'boom', sleep: 'click', wake: 'click', tick: 'click',
    })[name] || null;
}

export function createVaultSound(audio) {
    let drone = null;       // { osc, gain, lfo }
    let pulseTimer = null;
    let tickAt = 0;
    let want = { night: false, body: false };
    const quiet = () => (typeof document !== 'undefined' && document.hidden) || !!window.__rpiPaused;

    function ensureDrone() {
        const g = audio.graph();
        if (!g || drone) return;
        const { ctx, musicBus } = g;
        const gain = ctx.createGain(); gain.gain.value = 0;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = DRONE_HZ;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = DRONE_HZ * 1.5 * 1.003;
        osc.connect(lp); osc2.connect(lp); lp.connect(gain); gain.connect(musicBus);
        osc.start(); osc2.start();
        drone = { ctx, gain, osc, osc2 };
    }
    function setDrone(level) {
        if (!drone) return;
        drone.gain.gain.setTargetAtTime(level, drone.ctx.currentTime, 0.8);
    }
    function beat() {
        const g = audio.graph();
        if (!g || quiet() || !want.body) return;
        const { ctx, musicBus } = g;
        const t = ctx.currentTime;
        for (const [dt, lvl] of [[0, 0.32], [0.22, 0.2]]) {
            const o = ctx.createOscillator(); o.type = 'sine';
            o.frequency.setValueAtTime(58, t + dt); o.frequency.exponentialRampToValueAtTime(34, t + dt + 0.25);
            const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t + dt); e.gain.linearRampToValueAtTime(lvl, t + dt + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.35);
            o.connect(e); e.connect(musicBus); o.start(t + dt); o.stop(t + dt + 0.4);
        }
    }

    /** H6: the rise: under the boom, a wet swell that climbs for six seconds (filtered noise, rising). */
    function wetSwell() {
        const g = audio.graph();
        if (!g || !g.noiseBuf) return;
        const { ctx, sfxBus, noiseBuf } = g;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
        lp.frequency.setValueAtTime(120, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 5.5);
        const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.35, t + 4.8); e.gain.exponentialRampToValueAtTime(0.0001, t + 6.8);
        src.connect(lp); lp.connect(e); e.connect(sfxBus);
        src.start(t); src.stop(t + 7);
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(40, t); o.frequency.exponentialRampToValueAtTime(90, t + 6);
        const oe = ctx.createGain(); oe.gain.setValueAtTime(0.0001, t); oe.gain.exponentialRampToValueAtTime(0.25, t + 5); oe.gain.exponentialRampToValueAtTime(0.0001, t + 6.8);
        o.connect(oe); oe.connect(sfxBus); o.start(t); o.stop(t + 7);
    }
    /** A moment that matters: a soft bell, two notes a fifth apart, on the sfx bus (the Sound choice). */
    function moment() {
        const g = audio.graph();
        if (!g) return;
        const { ctx, sfxBus } = g;
        const t = ctx.currentTime;
        for (const [dt, hz] of [[0, MOMENT_HZ], [0.14, MOMENT_HZ * 1.5]]) {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
            const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 2.76;
            const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t + dt); e.gain.linearRampToValueAtTime(0.16, t + dt + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.4);
            const e2 = ctx.createGain(); e2.gain.value = 0.18;
            o.connect(e); o2.connect(e2); e2.connect(e); e.connect(sfxBus);
            o.start(t + dt); o2.start(t + dt); o.stop(t + dt + 1.5); o2.stop(t + dt + 1.5);
        }
    }

    return {
        event(name) {
            if (quiet()) return;
            if (name === 'moment') { moment(); return; }
            if (name === 'rise') { wetSwell(); }
            const w = wordFor(name);
            if (w && typeof audio[w] === 'function') audio[w]();
        },
        /** A short tick per typed letter, rare and quiet. */
        tick() {
            const now = performance.now();
            if (now - tickAt < 90 || quiet()) return;
            tickAt = now;
            const g = audio.graph();
            if (!g) return;
            const { ctx, sfxBus } = g;
            const t = ctx.currentTime;
            const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 2400;
            const e = ctx.createGain(); e.gain.setValueAtTime(0.012, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
            o.connect(e); e.connect(sfxBus); o.start(t); o.stop(t + 0.03);
        },
        set(night, body) {
            want = { night, body };
            if (night) ensureDrone();
            setDrone(night && !quiet() ? 0.05 : 0);
            if (body && !pulseTimer) pulseTimer = setInterval(beat, PULSE_S * 1000);
            if (!body && pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
        },
        stop() {
            if (pulseTimer) clearInterval(pulseTimer);
            pulseTimer = null;
            if (drone) {
                try { drone.gain.gain.cancelScheduledValues(0); drone.gain.gain.value = 0; drone.osc.stop(); drone.osc2.stop(); drone.gain.disconnect(); } catch { /* gone */ }
            }
            drone = null;
        },
    };
}
