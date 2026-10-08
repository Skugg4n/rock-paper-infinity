/**
 * Chapter V · UNITY: its sound, through src/audio.js only (the same buses, the same Sound and Music
 * choices). The heart beats on the music bus (IV's pulse: the rounds of the edge's game); a bite is
 * wet and short; the storm tears; an experiment is a soft bell; a zoom is a deep fall.
 * Silent when paused or hidden; stop() takes everything down.
 */
export const BEAT_S = 1.7;
export const BELL_HZ = 880;

/** Which shared word plays for a rules event (pure, tested). */
export function wordFor(name) {
    return ({ buy: 'click', mode: 'click', grow: 'click', nobite: 'knock', tear: 'knock', seed: 'thunk', arrive: 'thunk', click: 'click' })[name] || null;
}

export function createUnitySound(audio) {
    let beatTimer = null;
    let lastTear = 0;
    let deep = 0;       // the scale: the pulse is deeper further out
    const quiet = () => (typeof document !== 'undefined' && document.hidden) || !!window.__rpiPaused;

    function beat() {
        const g = audio.graph();
        if (!g || quiet()) return;
        const { ctx, musicBus } = g;
        const t = ctx.currentTime;
        const f0 = 60 - deep * 4;
        for (const [dt, lvl] of [[0, 0.3], [0.22, 0.18]]) {
            const o = ctx.createOscillator(); o.type = 'sine';
            o.frequency.setValueAtTime(f0, t + dt); o.frequency.exponentialRampToValueAtTime(f0 * 0.58, t + dt + 0.25);
            const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t + dt); e.gain.linearRampToValueAtTime(lvl, t + dt + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.35);
            o.connect(e); e.connect(musicBus); o.start(t + dt); o.stop(t + dt + 0.4);
        }
    }
    /** A bite: a wet tear of noise through a closing filter, a low knock under it. */
    function bite() {
        const g = audio.graph();
        if (!g || !g.noiseBuf) return;
        const { ctx, sfxBus, noiseBuf } = g;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 8;
        lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.16);
        const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.22, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        src.connect(lp); lp.connect(e); e.connect(sfxBus); src.start(t); src.stop(t + 0.22);
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.15);
        const oe = ctx.createGain(); oe.gain.setValueAtTime(0.0001, t); oe.gain.linearRampToValueAtTime(0.3, t + 0.006); oe.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(oe); oe.connect(sfxBus); o.start(t); o.stop(t + 0.2);
    }
    /** A moment: two soft bells a fifth apart (an experiment done, minds joining). */
    function bell(low = false) {
        const g = audio.graph();
        if (!g) return;
        const { ctx, sfxBus } = g;
        const t = ctx.currentTime;
        const base = low ? BELL_HZ / 2 : BELL_HZ;
        for (const [dt, hz] of [[0, base], [0.14, base * 1.5]]) {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
            const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t + dt); e.gain.linearRampToValueAtTime(0.14, t + dt + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.3);
            o.connect(e); e.connect(sfxBus); o.start(t + dt); o.stop(t + dt + 1.4);
        }
    }
    /** The zoom: a long fall, deep. */
    function fall() {
        const g = audio.graph();
        if (!g) return;
        const { ctx, sfxBus } = g;
        const t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(32, t + 3.4);
        const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.28, t + 0.6); e.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
        o.connect(e); e.connect(sfxBus); o.start(t); o.stop(t + 3.7);
    }

    return {
        event(name) {
            if (quiet()) return;
            if (name === 'bite') { bite(); return; }
            if (name === 'experiment') { bell(); return; }
            if (name === 'join') { bell(true); return; }
            if (name === 'zoom') { fall(); return; }
            if (name === 'tear') { const now = performance.now(); if (now - lastTear < 700) return; lastTear = now; }
            const w = wordFor(name);
            if (w && typeof audio[w] === 'function') audio[w]();
        },
        set(on, scale = 0) {
            deep = scale;
            if (on && !beatTimer) beatTimer = setInterval(beat, BEAT_S * 1000);
            if (!on && beatTimer) { clearInterval(beatTimer); beatTimer = null; }
        },
        stop() {
            if (beatTimer) clearInterval(beatTimer);
            beatTimer = null;
        },
    };
}
