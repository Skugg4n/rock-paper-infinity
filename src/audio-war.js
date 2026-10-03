/**
 * The war's sound (chapter III). Lifted from the sound board Ola approved in
 * direction (docs/mockups/sound-board-war-2.html, mockup 2: weight instead of
 * notes, everything on their drum's grid, the ending as the act's biggest
 * moment), and hung on the same Web Audio graph as chapter I (src/audio.js):
 * the same buses, the same Sound/Music switches in the ☰ menu, the same
 * first-click unlocking. Nothing is loaded. Score: docs/superpowers/specs/
 * 2026-10-02-score-sheet.md, section 4.
 *
 * Their drum is the clock: one bar is the time between two departures, and
 * the bar ends on the moment their next wave leaves (phase-locked to the
 * game's own numbers through `war.set`). Every other layer answers a question
 * the player has: our drum (who leads), the bass (are we holding), the organ
 * with one voice per plate (what have we lost), the arms factory (what is the
 * slider doing), folk life (are the people still here), the doomsday drone
 * (how finished is the surface), and from 55 % the rocket's rumble.
 *
 * Words (`war.event`) are put on their drum's grid where the board puts them,
 * but never more than a fraction of a second late: the game's rule is never
 * delayed, only the sound.
 *
 * The ending (`war.finale`): the rumble grows, the drum tightens and rises,
 * the rocket's noise ramps for nine seconds, then three seconds of true
 * silence (the whole master), then the drone alone on E♭; when the IV card
 * plays, the E♭ falls two octaves to D over ten seconds and stops.
 */

import { audio, ramp, pentaNote } from './audio.js';
import { DOOMSDAY_LEAVE, RAID_S, WAVE_WARNING_S } from './phase3/war.js';

const CHORDS = [                                   // the city's step five, where the war starts
    { name: 'Dm', root: 38, third: 3 }, { name: 'E♭', root: 39, third: 4 },
    { name: 'Gm', root: 31, third: 3 }, { name: 'A', root: 33, third: 4 },
];
const LAYERS = ['theirs', 'ours', 'bass', 'tones', 'arms', 'folk', 'shells', 'drone'];
const SLOTS = 20;                                  // one organ voice per plate (the land has 10 to 20)
const CONTOUR = [0, 2, 3, 4, 3, 2, 1, 2, 3, 5, 4, 3, 2, 3, 4, 5, 4, 3, 2, 1];
export const ROCKET_FROM = 55;
const BEAT_HZ = 0.3;                               // the drone's two voices beat this far apart
// The board ran its music at 0.7 on a master of 0.9; the shared music bus is at 0.4.
const LEVEL = 1.75;
const WET = 0.3;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

// ---------------------------------------------------------------- pure rules (tested)

/**
 * Their drum's bar: one bar is the time between landings (the wave interval,
 * never under the war's 20 s floor in play), eight strokes; sixteen on a push
 * and in the last bars of the surface (doomsday from 75 %).
 */
export function drumBar(interval, { push = false, doomsday = 0 } = {}) {
    const barLen = clamp(Number(interval) || 40, 8, 60);
    const beats = push || doomsday >= 75 ? 16 : 8;
    return { barLen, beats, beatLen: barLen / beats };
}

/** The pan of a plate's column (0 = west), so the radar and the landing point at the coast that is hit. */
export function panForColumn(col, cols = 5) {
    if (col == null || !(cols > 1)) return 0;
    const k = clamp(col / (cols - 1));
    return Math.round((k * 2 - 1) * 0.8 * 100) / 100;
}

/**
 * A moment put on their drum's grid: the coarsest division of the beat (the
 * beat itself, a half, a quarter...) whose next point is at most `maxDelay`
 * seconds after `t`. If none is, `t` itself: the sound waits, the rule never.
 *
 * @param {number} t
 * @param {{ barStart: number, beatLen: number } | null} grid
 * @param {number} maxDelay
 */
export function quantise(t, grid, maxDelay = 0.6) {
    if (!grid || !(grid.beatLen > 0) || !Number.isFinite(grid.barStart)) return t;
    for (const div of [1, 2, 4, 8, 16]) {
        const step = grid.beatLen / div;
        const k = Math.ceil((t - grid.barStart) / step - 1e-6);
        const at = grid.barStart + k * step;
        if (at >= t - 1e-9 && at - t <= maxDelay + 1e-9) return at;
    }
    return t;
}

/** The doomsday drone's pitch (MIDI): a sub D that glides to E♭ as the clock goes from 0 to 85 %. */
export function dronePitch(doomsday) {
    return 26 + clamp((Number(doomsday) || 0) / DOOMSDAY_LEAVE);
}

/** Our drum by the lead: answers every beat ahead, alternates when level, a single hit behind. */
export function ourDrum(lead) {
    if (lead >= 1) return 'answer';
    if (lead === 0) return 'alternate';
    return 'single';
}

/**
 * Which layers are heard: they arrive with the controls, one at a time. Their
 * drum and our bass from the start; the organ with the first shield or sword;
 * the arms factory with the strike; folk life with the ◆ (after the first
 * landing); the doomsday drone from the first landing; our drum with the
 * laboratory (or as soon as anyone leads); the shells from their tier V.
 */
export function presentLayers(s) {
    const shown = s.shown || {};
    const out = ['theirs', 'bass'];
    if ((s.units || 0) > 0 || (s.landings || 0) > 0 || shown.strike) out.push('tones');
    if (shown.strike) out.push('arms');
    if (shown.fort) out.push('folk');
    if ((s.landings || 0) > 0) out.push('drone');
    if (shown.tier || (s.lead || 0) !== 0) out.push('ours');
    if ((s.enemyTier || 0) >= 4) out.push('shells');
    return out;
}

/** The continuous parts from the state: what the bass holds, the drone, the rumble, the choir, the factory's hum. */
export function layerLevels(s) {
    const plates = s.plates || [];
    const down = plates.some((p) => p === false);
    const d = clamp((s.doomsday || 0) / DOOMSDAY_LEAVE);
    const r = clamp(s.rocket ?? ramp(s.doomsday || 0, ROCKET_FROM, DOOMSDAY_LEAVE));
    const arms = clamp(s.armsShare ?? 0.3);
    return {
        bassMidi: down ? 33 : 38,                                    // the low A while a plate is down
        droneMidi: dronePitch(s.doomsday || 0),
        drone: 0.025 + 0.08 * d,
        droneNoise: 0.2 * d * d,
        rumble: 0.28 * r * r, rumbleHz: 60 + 420 * r, rumbleSine: 0.09 * r,
        choir: 0.085 * ramp(s.population ?? 0.7, 0.45, 1),
        hum: 0.03 + 0.04 * arms, humHz: 140 + 900 * arms,
        machine: arms,
    };
}

/** One organ voice per plate: on while it stands, panned by its column, a note from the contour. */
export function padVoices(plates, cols = 5) {
    return Array.from({ length: SLOTS }, (_, slot) => ({
        slot,
        on: plates?.[slot] === true,
        pan: Math.round(panForColumn(slot % cols, cols) * 0.75 * 100) / 100,
        contour: CONTOUR[slot],
    }));
}

/** When the war's music takes over from the II → III set piece (seconds after the swords): as the transition's bass begins to fade. */
export function handoverAt(marks = { LIFT: 13.6 }) {
    return marks.LIFT + 13 - 2.6;
}

// ---------------------------------------------------------------- the engine

/**
 * The war on a graph: `G` = { ctx, master, sfxBus, musicBus, noiseBuf } (the
 * shared one from audio.js in the game, an offline copy for a level check).
 * It schedules ahead in `pump(until)`, like the board.
 */
export function createWarEngine(G) {
    const { ctx } = G;
    const S = {
        interval: 40, landAt: null, setAt: -Infinity, push: false, col: null, lead: 0, plates: [], armsShare: 0.3,
        population: 0.7, doomsday: 0, enemyTier: 0, radar: false, airDefence: 0, raid: false, silent: false,
        rocket: 0, leaving: false, gone: false, heavy: 0, units: 0, landings: 0, shown: {},
    };
    const present = new Set();
    const C = { barStart: 0, barLen: 40, beats: 8, beat: 0, nextBeat: Infinity, land: Infinity, first: true, tick: 0.5 };
    const T = { arms: 0, armsStep: 0, life: 0, free: 0, crackle: 0, radar: Infinity };
    let running = false, chordIdx = 0, raidFrom = Infinity, raidUntil = -1;
    let holding = null;                              // the drone after the cut, on E♭
    let lastLanding = -Infinity, lastReveal = -Infinity;
    let launched = false;
    const pending = [];                              // [time, fn]: state that must change on the grid
    const counts = {};                               // words played, by name (for tests and the debug log)

    // ------------------------------------------------------------ our part of the graph
    // The same large room as the city: the war is heard in it.
    const len = Math.floor(ctx.sampleRate * 3.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const reverb = ctx.createConvolver(); reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = WET;
    const roomOut = ctx.createGain(); roomOut.gain.value = 0;          // gated: paused or hidden
    reverb.connect(wet); wet.connect(roomOut); roomOut.connect(G.master);
    const roomMusic = ctx.createGain(); roomMusic.gain.value = 0; roomMusic.connect(reverb);   // music's sends, gated by Music
    const roomSfx = ctx.createGain(); roomSfx.gain.value = 1; roomSfx.connect(reverb);
    const farDelay = ctx.createDelay(1); farDelay.delayTime.value = 0.25; farDelay.connect(roomSfx);   // far away: the room answers late
    // music: layer -> mix (ducks) -> breath (the raid) -> layerOut (on/off) -> the shared music bus
    const layerOut = ctx.createGain(); layerOut.gain.value = 0.0001; layerOut.connect(G.musicBus);
    const breath = ctx.createGain(); breath.gain.value = 1; breath.connect(layerOut);
    const mix = ctx.createGain(); mix.gain.value = 1; mix.connect(breath);
    // words: -> sfxOut (gated) -> the shared sfx bus
    const sfxOut = ctx.createGain(); sfxOut.gain.value = 0; sfxOut.connect(G.sfxBus);
    // the ending's drone: music, but outside the war's layers (it outlives them)
    const endOut = ctx.createGain(); endOut.gain.value = 0; endOut.connect(G.master);

    const SEND = { theirs: 0.25, ours: 0.15, bass: 0.8, tones: 0.9, arms: 0.6, folk: 0.6, shells: 0.5, drone: 0.5 };
    const inp = {};
    for (const name of LAYERS) {
        const g = ctx.createGain(); g.connect(mix);
        const s = ctx.createGain(); s.gain.value = SEND[name]; g.connect(s); s.connect(roomMusic);
        const i = ctx.createGain(); i.gain.value = 0.0001; i.connect(g);
        inp[name] = i;
    }

    function env(t, peak, attack, decay, dest) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
        g.connect(dest);
        return g;
    }
    function osc(type, freq, t, stopAt, dest) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
        o.connect(dest); o.start(t); o.stop(stopAt); return o;
    }
    function noise(t, dur, dest) {
        const n = ctx.createBufferSource(); n.buffer = G.noiseBuf; n.loop = true;
        n.connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + dur); return n;
    }
    function filter(type, f, q, dest) {
        const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
        if (q != null) b.Q.value = q;
        if (dest) b.connect(dest);
        return b;
    }
    function pan(value, dest) {
        if (!ctx.createStereoPanner) return dest;
        const p = ctx.createStereoPanner(); p.pan.value = value; p.connect(dest); return p;
    }
    function send(node, amount, room = roomSfx) { const s = ctx.createGain(); s.gain.value = amount; node.connect(s); s.connect(room); }
    function far(node, amount) { const s = ctx.createGain(); s.gain.value = amount; node.connect(s); s.connect(farDelay); }
    function lfo(rate, depth, param) {
        const o = ctx.createOscillator(); o.frequency.value = rate;
        const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start();
        return o;
    }
    // A soft curve, so a boom bangs instead of ringing clean.
    const K = 2.2, CURVE = new Float32Array(2048).map((_, i) => Math.tanh(K * (i / 2047 * 2 - 1)) / Math.tanh(K));
    function saturate(dest, drive = 1.6) {
        const pre = ctx.createGain(); pre.gain.value = drive;
        const ws = ctx.createWaveShaper(); ws.curve = CURVE; ws.oversample = '2x';
        const post = ctx.createGain(); post.gain.value = 1.25 / (drive * K / Math.tanh(K));
        pre.connect(ws); ws.connect(post); post.connect(dest);
        return pre;
    }
    // Every continuous value glides; the same target twice adds nothing to the timeline.
    const last = new Map();
    function glideTo(param, value, tau, t = ctx.currentTime) {
        const prev = last.get(param);
        if (prev !== undefined && Math.abs(prev - value) < 1e-5) return;
        last.set(param, value);
        param.setTargetAtTime(value, t, tau);
    }

    const chordNow = () => CHORDS[chordIdx];
    const clockRunning = () => C.nextBeat !== Infinity;
    const beatLen = () => C.barLen / C.beats;
    const grid = () => (running && clockRunning() ? { barStart: C.barStart, beatLen: beatLen() } : null);
    const onGrid = (maxDelay, from = ctx.currentTime + 0.03) => quantise(from, grid(), maxDelay);
    /** A gap close to `target` seconds that divides the beat evenly. */
    function gridStep(target) {
        if (!running || !clockRunning()) return target;
        const b = beatLen();
        return b / Math.max(1, Math.round(b / target));
    }
    function at(t, fn) {
        pending.push([t, fn]); pending.sort((a, b) => a[0] - b[0]);
    }

    // ------------------------------------------------------------ continuous voices
    // Bass: a D pedal under every chord, down to the low A while a plate is down
    // (the bass that comes in under their drum at the end of the II -> III transition).
    const pedal = (() => {
        const g = ctx.createGain(); g.gain.value = 0.12; g.connect(inp.bass);
        const lp = filter('lowpass', 260, null, g);
        const a = ctx.createOscillator(), b = ctx.createOscillator(), c = ctx.createOscillator();
        a.type = b.type = 'sawtooth'; c.type = 'sine';
        a.detune.value = -6; b.detune.value = 6;
        a.connect(lp); b.connect(lp); c.connect(g);
        a.frequency.value = b.frequency.value = mtof(26); c.frequency.value = mtof(38);
        [a, b, c].forEach((o) => o.start());
        return { oscs: [[a, 0.5], [b, 0.5], [c, 1]] };
    })();
    // Doomsday: two voices on a sub D, 0.3 Hz apart so they beat, under a slowly sweeping filter.
    const drone = (() => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(inp.drone);
        const lp = filter('lowpass', 170, 1.4, g);
        lfo(0.023, 120, lp.frequency);
        const a = ctx.createOscillator(), b = ctx.createOscillator(); a.type = b.type = 'sawtooth';
        const ab = ctx.createGain(); ab.gain.value = 0.35; a.connect(ab); b.connect(ab); ab.connect(lp);
        const c = ctx.createOscillator(); c.type = 'sine';
        const cg = ctx.createGain(); cg.gain.value = 0.7; c.connect(cg); cg.connect(g);
        const src = ctx.createBufferSource(); src.buffer = G.noiseBuf; src.loop = true;
        const nb = filter('bandpass', 120, 0.9); const ng = ctx.createGain(); ng.gain.value = 0.0001;
        src.connect(nb); nb.connect(ng); ng.connect(inp.drone);
        [a, b, c].forEach((o) => { o.frequency.value = mtof(26); o.start(); });
        src.start();
        return { g, ng, a, b, c };
    })();
    // From 55 %: a low rumble under their drum, louder and brighter as the rocket is built.
    const rumble = (() => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(inp.drone);
        const lp = filter('lowpass', 60, 0.7, g);
        const src = ctx.createBufferSource(); src.buffer = G.noiseBuf; src.loop = true; src.connect(lp); src.start();
        const sg = ctx.createGain(); sg.gain.value = 0.0001; sg.connect(inp.drone);
        const s = ctx.createOscillator(); s.frequency.value = 40; s.connect(sg); s.start();
        return { g, lp, sg };
    })();
    function crackle(t, r) {
        const hp = filter('highpass', lerp(1800, 3400, Math.random()));
        hp.connect(env(t, (0.02 + 0.05 * r) * lerp(0.4, 1, Math.random()), 0.004, 0.006, pan(Math.random() * 1.6 - 0.8, inp.drone)));
        noise(t, 0.02, hp);
    }
    // Tones with holes: a distant organ, one voice per plate; a razed plate fades out of the chord.
    const pad = (() => {
        const out = ctx.createGain(); out.connect(inp.tones);
        const lp = filter('lowpass', 900, 0.7, out);
        lfo(0.07, 420, lp.frequency);
        const voices = padVoices([]).map((v) => {
            const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(pan(v.pan, lp));
            const a = ctx.createOscillator(), b = ctx.createOscillator();
            a.type = 'sawtooth'; b.type = 'triangle'; a.detune.value = -8; b.detune.value = 8;
            const ag = ctx.createGain(); ag.gain.value = 0.4; a.connect(ag); ag.connect(g); b.connect(g);
            a.start(); b.start();
            return { g, oscs: [a, b], contour: v.contour };
        });
        return { voices };
    })();
    const padDegree = (v, c) => [0, 7, 12, 12 + c.third, 19, 24][v.contour];
    const padMidi = (v, c) => (c.root < 36 ? c.root + 24 : c.root + 12) + padDegree(v, c);
    // The arms factory's hum, under its pulses.
    const hum = (() => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(inp.arms);
        const lp = filter('lowpass', 160, 1, g);
        const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = mtof(38); a.connect(lp); a.start();
        const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = mtof(26); b.connect(g); b.start();
        return { g, lp };
    })();
    // Folk life, from the city: short voices, small steps, a far choir in a large population.
    const FOLK = 1.4;
    const folkIn = ctx.createGain(); folkIn.gain.value = FOLK; folkIn.connect(inp.folk);
    const VOWELS = [[700, 1100], [450, 800], [400, 1600], [320, 870]];
    function formants(dest, f1, f2) {
        const a = filter('bandpass', f1, 5, dest);
        const bg = ctx.createGain(); bg.gain.value = 0.6; bg.connect(dest);
        const b = filter('bandpass', f2, 7, bg);
        return [a, b];
    }
    const choir = (() => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(folkIn);
        const [a, b] = formants(g, 450, 800);
        const oscs = [12, 19, 24].map((semi, i) => {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = [-7, 6, 0][i];
            o.frequency.value = mtof(38 + semi); o.connect(a); o.connect(b); o.start();
            return { o, semi };
        });
        return { g, oscs };
    })();

    // ------------------------------------------------------------ the drums
    /** A sub kick: a sine sweeping down an octave in 120 ms, a soft click, a faint room tail. */
    function kick(t, level, dest, f0 = 90, decay = 0.6, room = 0.5) {
        const g = env(t, 0.9 * level, 0.002, decay, dest);
        const o = osc('sine', f0, t, t + decay + 0.1, g);
        o.frequency.exponentialRampToValueAtTime(f0 / 2, t + 0.12);
        const hp = filter('highpass', 2600); hp.connect(env(t, 0.06 * level, 0.004, 0.012, dest)); noise(t, 0.03, hp);
        if (room > 0) { const lp = filter('lowpass', 240); g.connect(lp); send(lp, room, roomMusic); }
    }
    /** Their drum is the clock: it swells through the bar toward the blow. */
    function theirBeat(tb, i) {
        if (S.raid && tb >= raidUntil && raidUntil >= 0) endRaid(tb);
        if (S.silent || S.gone || (tb >= raidFrom && tb < raidUntil)) return;
        const prog = i / C.beats, down = i === 0 && !C.first;
        const late = ramp(S.doomsday, 70, DOOMSDAY_LEAVE);
        const k = (0.45 + 0.25 * prog + (down ? 0.18 : 0)) * (S.heavy ? 1.12 : 1) * (1 - 0.3 * late);
        const f0 = (S.heavy ? 80 : 90) * (1 + 0.6 * late);                // back from silence: a step lower; at the end it rises
        kick(tb, k, pan(0.2, inp.theirs), f0, Math.min(S.heavy ? 0.8 : 0.6, beatLen() * 0.9), 0.6);
    }
    /** Ours, an octave up and drier. */
    function ourBeat(tb, i) {
        if (S.gone) return;
        const b = beatLen(), L = S.lead, mode = ourDrum(L);
        const dest = pan(-0.35, inp.ours);
        const hit = (t, lvl) => kick(t, lvl, dest, 180, Math.min(0.28, b * 0.45), 0.12);
        if (mode === 'answer') {
            hit(tb + b / 2, L >= 2 ? 0.7 : 0.55);
            if (L >= 2) hit(tb + b / 2 + b / 8, 0.4);
        } else if (mode === 'alternate') {
            if (i % 2 === 1) hit(tb + b / 2, 0.55);
        } else if (i === C.beats / 2) hit(tb, L === -1 ? 0.45 : 0.25);
    }
    function setChord(i, t) {
        chordIdx = i;
        const c = chordNow();
        for (const { o, semi } of choir.oscs) o.frequency.setTargetAtTime(mtof(c.root + (c.root < 34 ? 12 : 0) + semi), t, 0.9);
        pad.voices.forEach((v) => v.oscs.forEach((o) => o.frequency.setTargetAtTime(mtof(padMidi(v, c)), t, 0.35)));
    }

    // ------------------------------------------------------------ the arms factory
    // A machine on the grid: filtered noise pulses; toward hammers they turn to metal.
    function machine(t, j) {
        const m = S.armsShare, acc = [1, 0.45, 0.7, 0.45][j % 4];
        const bp = filter('bandpass', 320 + 2400 * m, 1.4 - 0.6 * m);
        bp.connect(env(t, (0.1 + 0.06 * m) * acc, 0.004, 0.08 + 0.12 * (1 - m), inp.arms)); noise(t, 0.25, bp);
        if (m < 0.05) return;
        const rm = ctx.createGain(); rm.gain.value = 0;
        osc('sine', 1130 + 500 * m, t, t + 0.25, rm.gain);                   // ring modulation: noise times a carrier
        const hp = filter('highpass', 1400); rm.connect(hp); hp.connect(env(t, 0.15 * m * acc, 0.004, 0.07, inp.arms)); noise(t, 0.2, rm);
        [1, 2.76, 5.4].forEach((r, i) => osc('sine', 196 * r, t, t + 0.4, env(t, (0.035 * m * acc) / (i + 1), 0.004, 0.28, inp.arms)));
    }
    /** Pulses a beat: four, more on long beats so the machine keeps running. */
    const machineStep = () => { const b = beatLen(); return b / Math.max(4, Math.round(b / 0.7)); };

    // ------------------------------------------------------------ folk life (city recipe)
    const courage = () => 0.35 + 0.65 * S.population;
    function voice(t, level = 1) {
        const c = chordNow(), r = c.root + 12;
        let midi = [r + 7, r + 12, r + 12 + c.third, r + 19][Math.floor(Math.random() * 4)];
        while (midi > 74) midi -= 12;
        while (midi < 55) midi += 12;
        const dur = lerp(0.22, 0.55, Math.random()), f = mtof(midi);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.22 * level * courage(), t + 0.07);
        g.gain.setValueAtTime(0.22 * level * courage(), t + dur);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2);
        g.connect(pan(Math.random() * 1.6 - 0.8, folkIn));
        const [a, b] = formants(g, ...VOWELS[Math.floor(Math.random() * VOWELS.length)]);
        const o = osc('sawtooth', f * lerp(0.95, 1, Math.random()), t, t + dur + 0.25, a);
        o.connect(b);
        o.frequency.linearRampToValueAtTime(f * lerp(0.97, 1.04, Math.random()), t + dur);
        if (level === 1 && Math.random() < 0.4) voice(t + dur + lerp(0.1, 0.3, Math.random()), 0.7);
    }
    function steps(t) {
        const c = chordNow(), r = c.root + 36;
        const n = 1 + Math.floor(Math.random() * 3), every = lerp(0.11, 0.19, Math.random());
        const f = mtof(r + [0, 7, 12, 12 + c.third, 19][Math.floor(Math.random() * 5)]);
        const dest = pan(Math.random() * 1.6 - 0.8, folkIn);
        for (let i = 0; i < n; i++) {
            const a = t + i * every;
            osc('sine', f, a, a + 0.14, env(a, 0.13 * courage(), 0.002, 0.1, dest));
            const hp = filter('highpass', 3200); hp.connect(env(a, 0.05 * courage(), 0.001, 0.02, dest)); noise(a, 0.03, hp);
        }
    }
    const lifeGap = () => lerp(3.6, 0.32, Math.pow(S.population, 0.7)) * lerp(0.5, 1.5, Math.random());
    function duckFolk(t) {
        folkIn.gain.cancelScheduledValues(t);
        folkIn.gain.setTargetAtTime(0.15 * FOLK, t, 0.05);
        folkIn.gain.setTargetAtTime(FOLK, t + 0.8, 1.4);
    }
    /** The music steps back by `factor` at t and comes back after `hold` seconds. */
    function duck(t, factor, tc, hold, backTc) {
        mix.gain.cancelScheduledValues(t);
        mix.gain.setTargetAtTime(factor, t, tc);
        mix.gain.setTargetAtTime(1, t + hold, backTc);
    }

    // ------------------------------------------------------------ impacts and shells
    /** A distant detonation: a short transient, a low body, a long tail through the far room. */
    function detonation(t, where, level, dest = sfxOut) {
        const p = pan(where, dest);
        const bp = filter('bandpass', 1400, 0.8); bp.connect(env(t, 0.2 * level, 0.004, 0.025, p)); noise(t, 0.05, bp);
        const body = env(t, 0.6 * level, 0.004, 0.3, p);
        const o = osc('sine', 120, t, t + 0.45, body); o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
        far(body, 0.8);
        const lp = filter('lowpass', 520, 0.6); lp.frequency.setValueAtTime(520, t); lp.frequency.exponentialRampToValueAtTime(80, t + 2.6);
        const tail = env(t, 0.16 * level, 0.04, 2.6, p); lp.connect(tail); far(tail, 1.6);
        noise(t, 2.8, lp);
    }
    function crack(t, level, dest) {
        // dry, with an attack the master compressor can catch (its makeup gain lifts bare clicks)
        const hp = filter('highpass', 1600); hp.connect(env(t, 0.2 * level, 0.004, 0.045, dest)); noise(t, 0.06, hp);
        const bp = filter('bandpass', 900, 2); bp.connect(env(t, 0.12 * level, 0.004, 0.03, dest)); noise(t, 0.05, bp);
    }
    /** A thin whistle that falls ever faster toward the impact (Doppler); air defence cracks it. */
    function shell(impact, length, defended, where) {
        const t = impact - length, p = pan(where, sfxOut);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.4);
        g.gain.linearRampToValueAtTime(0.075, impact - 0.05);
        g.gain.linearRampToValueAtTime(0.0001, impact + (defended ? 0.008 : 0.05));
        g.connect(p); send(g, 0.4);
        const o = ctx.createOscillator(); o.connect(g);
        const curve = new Float32Array(64).map((_, i) => 520 + (2800 - 520) * (1 - Math.pow(i / 63, 3)));
        o.frequency.setValueCurveAtTime(curve, t, length);
        o.start(t); o.stop(impact + 0.1);
        const v = ctx.createOscillator(); v.frequency.value = 6.5;
        const vd = ctx.createGain(); vd.gain.value = 14; v.connect(vd); vd.connect(o.frequency); v.start(t); v.stop(impact + 0.1);
        if (defended) crack(impact, 1.1, p); else detonation(impact, where, 0.75);
    }
    /** The radar counts the grid down to their departure, louder as it comes. */
    function radarTick(t, where, k = 1) {
        const p = pan(where, sfxOut);
        const bp = filter('bandpass', 3200, 4); bp.connect(env(t, (0.06 + 0.06 * k), 0.004, 0.02, p)); noise(t, 0.03, bp);
        osc('sine', mtof(93), t, t + 0.05, env(t, 0.015 + 0.02 * k, 0.003, 0.03, p));
        counts.radarTick = (counts.radarTick || 0) + 1;
    }
    function startRaid(t, until) {
        raidFrom = t; raidUntil = until; S.raid = true;
        breath.gain.cancelScheduledValues(t); breath.gain.setTargetAtTime(0.5, t, 0.3);   // everything dips 6 dB
        wet.gain.cancelScheduledValues(t); wet.gain.setTargetAtTime(0.08, t, 0.4);        // and the room dries
    }
    function endRaid(t) {
        S.raid = false; raidFrom = Infinity; raidUntil = -1;
        breath.gain.setTargetAtTime(1, t, 0.25);
        wet.gain.setTargetAtTime(WET, t, 0.5);
    }

    // ------------------------------------------------------------ the clock
    /** Recomputes the bar so that it ends on `land` (the next departure); joins it mid-bar. */
    function lock(land, now = ctx.currentTime) {
        const bar = drumBar(S.interval, { push: S.push, doomsday: S.doomsday });
        while (land < now + 0.05) land += bar.barLen;                       // it has just left: lock to the one after
        C.barLen = bar.barLen; C.beats = bar.beats;
        C.land = land; C.barStart = land - bar.barLen;
        const b = beatLen();
        C.beat = Math.max(0, Math.ceil((now + 0.05 - C.barStart) / b - 1e-6));
        C.nextBeat = C.barStart + C.beat * b;
        planBar(now);
    }
    /** A bar from `t` with no departure to lock to (the drum runs free: at the end). */
    function freeBar(t, first = false) {
        const bar = drumBar(S.interval, { push: false, doomsday: S.doomsday });
        C.barLen = bar.barLen; C.beats = bar.beats;
        C.barStart = t; C.beat = 0; C.nextBeat = t; C.first = first; C.land = t + C.barLen;
        planBar(t);
    }
    function planBar(now) {
        const b = beatLen();
        C.tick = b / Math.max(1, Math.round(b / 0.5));                      // radar ticks on the grid, about two a second
        T.radar = C.land - Math.floor(WAVE_WARNING_S / C.tick + 1e-6) * C.tick;
        while (T.radar < now) T.radar += C.tick;
        const m = machineStep();
        T.arms = C.barStart + Math.ceil((now - C.barStart) / m - 1e-6) * m; T.armsStep = 0;
    }
    function nextBar(tb) {
        // the next departure: what the game said (if it is ahead), else one interval on
        const bar = drumBar(S.interval, { push: S.push, doomsday: S.doomsday });
        const land = S.landAt != null && S.landAt > tb + 0.5 * bar.barLen && S.landAt < tb + 1.6 * bar.barLen ? S.landAt : tb + bar.barLen;
        C.barLen = land - tb; C.beats = bar.beats; C.barStart = tb; C.land = land; C.beat = 0; C.nextBeat = tb; C.first = false;
        planBar(tb);
    }
    function stopClock() { C.nextBeat = Infinity; C.land = Infinity; T.radar = Infinity; }
    /** Starts or corrects the clock from the game's numbers (a correction under 0.75 s is let be). */
    function sync(now = ctx.currentTime) {
        if (!running) return;
        if (S.silent || S.gone) { if (clockRunning()) stopClock(); return; }
        if (S.leaving) { if (!clockRunning()) freeBar(now + 0.05, true); return; }
        if (S.landAt == null || now - S.setAt > 1.6) return;                // no fresh word from the game: wait for it
        if (!clockRunning()) { lock(S.landAt, now); C.first = true; return; }
        if (Math.abs(S.landAt - C.land) > 0.75) lock(S.landAt, now);
    }

    function pump(until) {
        if (!running) return;
        const now = ctx.currentTime;
        if (clockRunning() && C.nextBeat < now - 0.5) { stopClock(); sync(now); }   // a stalled timer plays no backlog
        for (const k of ['life', 'free', 'crackle']) if (T[k] < now - 0.5) T[k] = now + 0.05;
        if (T.arms < now - 0.5) T.arms = now + 0.05;
        while (pending.length && pending[0][0] <= until) { const [pt, fn] = pending.shift(); fn(pt); }
        if (S.raid && !clockRunning() && raidUntil >= 0 && now >= raidUntil) endRaid(now);
        while (T.radar < Math.min(until, C.land - 0.01)) {
            const k = 1 - (C.land - T.radar) / WAVE_WARNING_S;
            if (S.radar && !S.silent && !S.gone && !S.leaving) radarTick(T.radar, panForColumn(S.col), clamp(k));
            T.radar += C.tick;
        }
        while (C.nextBeat < until) {
            let tb = C.nextBeat;
            if (C.beat >= C.beats) {
                if (S.leaving) freeBar(tb); else nextBar(tb);
                tb = C.nextBeat;
            }
            const quarter = Math.max(1, C.beats / 4);
            if (C.beat % quarter === 0) setChord((C.beat / quarter) % 4, tb);   // four chords a wave: every departure on Dm
            theirBeat(tb, C.beat);
            if (present.has('ours')) ourBeat(tb, C.beat);
            C.beat++;
            C.nextBeat = C.barStart + (C.beat * C.barLen) / C.beats;
        }
        while (T.arms < until) {                                         // the machine runs on the grid, also while they are silent
            if (!S.gone && present.has('arms')) machine(T.arms, T.armsStep);
            T.armsStep++; T.arms += clockRunning() ? machineStep() : 0.7;
        }
        while (T.free < until) {
            if (!clockRunning()) setChord((chordIdx + 1) % 4, T.free);
            T.free += C.barLen / 4;
        }
        while (T.life < until) {
            if (S.population > 0.02 && !S.gone && present.has('folk')) { if (Math.random() < 0.5) voice(T.life); else steps(T.life); }
            T.life += lifeGap();
        }
        while (T.crackle < until) {                                      // crackle joins the rumble
            const r = S.rocket;
            if (r > 0.3 && !S.gone) crackle(T.crackle, r);
            T.crackle += lerp(0.5, 0.05, r) * lerp(0.4, 1.6, Math.random());
        }
    }

    function apply() {
        const t = ctx.currentTime;
        const want = new Set(running && !S.gone ? presentLayers(S) : []);
        for (const name of LAYERS) {
            if (want.has(name) && !present.has(name)) present.add(name);
            if (!want.has(name)) present.delete(name);
            const on = present.has(name);
            glideTo(inp[name].gain, on ? 1 : 0.0001, on ? 1.4 : 0.6, t);
        }
        const L = layerLevels(S);
        for (const [o, m] of pedal.oscs) glideTo(o.frequency, mtof(L.bassMidi) * m, 0.6, t);
        const f = mtof(L.droneMidi);
        glideTo(drone.a.frequency, f, 1.6, t); glideTo(drone.b.frequency, f + BEAT_HZ, 1.6, t); glideTo(drone.c.frequency, f, 1.6, t);
        glideTo(drone.g.gain, running ? L.drone : 0.0001, 1.5, t);
        glideTo(drone.ng.gain, running ? 0.0001 + L.droneNoise : 0.0001, 1.5, t);
        const r = running && !S.gone ? 1 : 0;
        glideTo(rumble.g.gain, 0.0001 + L.rumble * r, 2.5, t);
        glideTo(rumble.lp.frequency, L.rumbleHz, 2.5, t);
        glideTo(rumble.sg.gain, 0.0001 + L.rumbleSine * r, 2.5, t);
        glideTo(choir.g.gain, running ? 0.0001 + L.choir : 0.0001, 1.5, t);
        const voices = padVoices(S.plates);
        pad.voices.forEach((v, s) => glideTo(v.g.gain, voices[s].on ? 0.012 * (padDegree(v, chordNow()) >= 19 ? 0.7 : 1) : 0.0001, 1.5, t));
        glideTo(hum.g.gain, running && !S.gone ? L.hum : 0.0001, 1, t);
        glideTo(hum.lp.frequency, L.humHz, 1, t);
    }

    /**
     * The game's numbers, once a second (see `war.set`). `nextLandingIn` is
     * seconds to the next departure (null when none is coming).
     */
    function set(next) {
        const now = ctx.currentTime;
        for (const k of ['interval', 'push', 'col', 'lead', 'plates', 'armsShare', 'population', 'doomsday', 'enemyTier', 'radar', 'airDefence', 'units', 'landings', 'shown']) {
            if (next[k] !== undefined) S[k] = next[k];
        }
        if (next.rocket !== undefined) S.rocket = clamp(next.rocket);
        else if (next.doomsday !== undefined) S.rocket = ramp(next.doomsday, ROCKET_FROM, DOOMSDAY_LEAVE);
        if (next.nextLandingIn !== undefined) {
            S.landAt = next.nextLandingIn == null || !Number.isFinite(next.nextLandingIn) ? null : now + Math.max(0, next.nextLandingIn);
            S.setAt = now;
        }
        if (next.silentIsland !== undefined && !!next.silentIsland !== S.silent) {
            S.silent = !!next.silentIsland;
            if (!S.silent) S.heavy = 1;                                     // back: heavier and a step lower
        }
        if (next.raidLeft !== undefined) {
            const on = next.raidLeft > 0;
            if (on && !S.raid) startRaid(now, now + next.raidLeft);
            else if (!on && S.raid && raidUntil > now + 0.5) raidUntil = clockRunning() ? onGrid(beatLen()) : now;
        }
        sync(now);
        apply();
    }

    // ------------------------------------------------------------ words
    function thunk(t, level = 1) {
        const o = osc('sine', 150, t, t + 0.22, env(t, 0.5 * level, 0.003, 0.16, sfxOut));
        o.frequency.exponentialRampToValueAtTime(58, t + 0.14);
        const lp = filter('lowpass', 700); lp.connect(env(t, 0.22 * level, 0.001, 0.05, sfxOut));
        noise(t, 0.07, lp);
    }
    function pling(t, midi, level = 1) {
        const f = mtof(midi);
        const g = env(t, 0.2 * level, 0.003, 0.42, sfxOut);
        osc('sine', f, t, t + 0.5, g);
        osc('sine', f * 2.005, t, t + 0.3, env(t, 0.06 * level, 0.003, 0.2, sfxOut));
        osc('sine', f * 3.01, t, t + 0.15, env(t, 0.02 * level, 0.002, 0.09, sfxOut));
        osc('sine', f * 2.76, t, t + 0.35, env(t, 0.025 * level, 0.002, 0.28, sfxOut));
        send(g, 0.5);
    }
    /** Struck metal that rings out: partials that do not line up, each with its own decay, a strike on top. */
    function ring(t, f, ratios, amps, decay, dest = sfxOut, sendAmt = 0.6, strike = 0.1) {
        const out = ctx.createGain(); out.connect(dest); send(out, sendAmt);
        ratios.forEach((r, i) => {
            const o = osc('sine', f * r, t, t + decay + 0.1, env(t, amps[i], 0.002, decay * (1 - 0.12 * i), out));
            o.detune.value = (i % 2 ? 1 : -1) * 3;
        });
        const bp = filter('bandpass', Math.min(7000, f * 5), 1); bp.connect(env(t, strike, 0.002, 0.02, out)); noise(t, 0.03, bp);
        return out;
    }
    /** Chapter I's boom through a soft saturation, so it bangs; the music ducks under it. */
    function boom(t, power = 1) {
        const p = clamp(power, 1, 2), tail = 2.2 + 1.4 * (p - 1);
        const outLevel = ctx.createGain(); outLevel.gain.value = 0.85 * (0.9 + 0.25 * (p - 1)); outLevel.connect(sfxOut); send(outLevel, 1.1);
        const out = saturate(outLevel, 1.8);
        const body = osc('sine', 110, t, t + tail + 0.2, env(t, 0.9, 0.004, tail, out));
        body.frequency.exponentialRampToValueAtTime(p > 1.5 ? 30 : 38, t + 0.5);
        const over = osc('triangle', 220, t, t + tail * 0.6, env(t, 0.22, 0.004, tail * 0.5, out));
        over.frequency.exponentialRampToValueAtTime(p > 1.5 ? 60 : 76, t + 0.5);
        const lp = filter('lowpass', 900, 0.7); lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(70, t + tail * 0.8);
        lp.connect(env(t, 0.5, 0.003, tail * 0.9, out)); noise(t, tail + 0.1, lp);
        const hp = filter('highpass', 1800); hp.connect(env(t, 0.25, 0.004, 0.06, out)); noise(t, 0.08, hp);
        duck(t, 0.2, 0.02, 0.45 * p, 0.5 * p);
    }
    /** A plate falls: everything holds its breath (about a second, on the grid), then the fall. A district lower. */
    function plateFall(t, district) {
        const f = t + gridStep(1);
        duck(t, 0.12, 0.08, f + 0.5 - t, 1.2);
        if (!(Math.abs(t - lastLanding) < 0.3)) thunk(t, 0.35);           // on the landing's own beat the landing is the thump
        detonation(f, 0, district ? 1 : 0.75);
        [[district ? 38 : 50, 0], [district ? 37 : 49, 0.3]].forEach(([m, d]) => {     // the fall: a minor second down, low
            const g = env(f + d, 0.18, 0.004, district ? 1.3 : 0.8, sfxOut);
            osc('triangle', mtof(m), f + d, f + d + 1.5, g); osc('sine', mtof(m - 12), f + d, f + d + 1.5, g);
        });
        for (let i = 0; i < (district ? 10 : 6); i++) {                             // rubble
            const dt = f + 0.2 + Math.random() * (district ? 1.8 : 1.1);
            const bp = filter('bandpass', lerp(300, 1400, Math.random()), 2); bp.connect(env(dt, 0.07, 0.004, 0.07, sfxOut)); noise(dt, 0.1, bp);
        }
    }
    function tear(t) {
        const p = pan(0.55, sfxOut);
        const bp = filter('bandpass', 2600, 1.6); bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(260, t + 0.85);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
        bp.connect(g); g.connect(p); send(g, 0.5); noise(t, 1, bp);
    }
    function creak(t, where) {
        // their boat leaves: a faint hull creak, far off
        const p = pan(where, sfxOut);
        const bp = filter('bandpass', 420, 6); bp.frequency.setValueAtTime(380, t); bp.frequency.linearRampToValueAtTime(470, t + 0.5);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        bp.connect(g); g.connect(p); far(g, 0.6); noise(t, 0.75, bp);
    }
    function islandFalls(t) {
        // their last stroke falls in pitch, and then nothing
        const g = env(t, 0.6, 0.002, 2, pan(0.2, sfxOut));
        const o = osc('sine', 90, t, t + 2.2, g); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); o.frequency.exponentialRampToValueAtTime(24, t + 1.8);
        const lp = filter('lowpass', 240); g.connect(lp); send(lp, 0.8);
    }
    function islandSwell(t, hit) {
        const lp = filter('lowpass', 90); lp.frequency.setValueAtTime(90, t); lp.frequency.exponentialRampToValueAtTime(500, hit);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, hit - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, hit + 0.3);
        lp.connect(g); g.connect(pan(0.2, sfxOut)); noise(t, hit - t + 0.4, lp);
    }

    const WORDS = {
        shield(t) { thunk(t, 0.9); const lp = filter('lowpass', 1600, null, sfxOut); ring(t + 0.02, 147, [1, 1.47, 2.09, 2.56, 3.37], [0.16, 0.09, 0.06, 0.035, 0.02], 1.6, lp, 0.5, 0.12); },
        sword(t) { thunk(t, 0.7); ring(t + 0.02, mtof(74), [1, 2.76, 5.4, 8.93, 13.3], [0.09, 0.05, 0.03, 0.015, 0.008], 3, sfxOut, 0.8, 0.14); },
        airDefence(t) {
            thunk(t, 0.8);
            const f = mtof(57), out = ctx.createGain(); out.connect(sfxOut); send(out, 0.7);
            [[1, 0.2], [3, 0.07], [5, 0.035]].forEach(([h, a]) => {                 // odd partials only: a tube closed at one end
                const o = osc('sine', f * h * 1.06, t + 0.03, t + 1.6, env(t + 0.03, a, 0.004, 1.4, out));
                o.frequency.exponentialRampToValueAtTime(f * h, t + 0.12);
            });
            const bp = filter('bandpass', f * 2, 9); bp.connect(env(t + 0.03, 0.22, 0.01, 0.25, out)); noise(t + 0.03, 0.3, bp);
        },
        fortify(t) {
            thunk(t, 0.9);
            const lp = filter('lowpass', 1200, null, sfxOut), s = gridStep(0.25);
            ring(t + 0.04, 98, [1, 1.47, 2.09, 2.56], [0.2, 0.11, 0.06, 0.03], 1.5, lp, 0.5, 0.14);
            ring(t + 0.04 + s, 87, [1, 1.47, 2.09, 2.56], [0.22, 0.12, 0.06, 0.03], 1.8, lp, 0.5, 0.14);
        },
        buy(t) { thunk(t, 0.8); ring(t + 0.02, 220, [1, 2.32, 4.25], [0.08, 0.04, 0.02], 1.2, sfxOut, 0.5, 0.08); },
        // something new opens: chapter I's three notes, unchanged; the one melody left in the war
        rise(t) { [0, 2, 5].forEach((n, i) => pling(t + i * 0.09, pentaNote(n), 0.9)); },
        knock(t) {
            [0, 0.13].forEach((d) => {
                const o = osc('sine', 170, t + d, t + d + 0.1, env(t + d, 0.32, 0.002, 0.07, sfxOut));
                o.frequency.exponentialRampToValueAtTime(110, t + d + 0.07);
                osc('sine', 1180, t + d, t + d + 0.06, env(t + d, 0.03, 0.004, 0.04, sfxOut));
            });
        },
        // a new weapon: struck metal rising on the sounding chord
        tier(t) {
            thunk(t, 0.5);
            const c = chordNow(), s = gridStep(0.12);
            [24, 31, 36].forEach((semi, i) => ring(t + 0.05 + i * s, mtof(c.root + semi), [1, 2.76, 5.4, 8.93], [0.08, 0.04, 0.02, 0.01], 1.4 + 0.6 * i, sfxOut, 0.9, 0.1));
        },
        strike(t) { tear(t); },
        strikeLands(t) { detonation(t, 0.85, 0.5); },
        enemyRazed(t) {
            // their tile goes: a dull far impact, and a short low tone under it
            detonation(t, 0.85, 0.55);
            const g = env(t + 0.05, 0.12, 0.08, 0.9, sfxOut); send(g, 0.8);
            osc('triangle', mtof(41), t + 0.05, t + 1.1, g); osc('sine', mtof(29), t + 0.05, t + 1.1, g);
        },
        landing(t, where = 0) { lastLanding = t; detonation(t, where, 0.7); duckFolk(t); },
        fallHome(t) { plateFall(t, false); },
        fallDistrict(t) { plateFall(t, true); },
        castOff(t, where = 0) { creak(t, where); },
        raidTicks(t) {
            const s = gridStep(0.25);
            [0, s].forEach((d) => {                                            // two dry ticks, no room
                const hp = filter('highpass', 2600); hp.connect(env(t + d, 0.2, 0.004, 0.02, sfxOut)); noise(t + d, 0.03, hp);
                osc('sine', 1900, t + d, t + d + 0.04, env(t + d, 0.06, 0.004, 0.025, sfxOut));
            });
        },
        islandSilent(t) { islandFalls(t); },
        islandBack(t) { islandSwell(t, t + 1.2); },
        boom(t) { boom(t, 1.6); },
        nuke(t) {
            boom(t, 2);
            const lp = filter('lowpass', 420); lp.frequency.setValueAtTime(420, t); lp.frequency.exponentialRampToValueAtTime(45, t + 6);
            const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5);
            lp.connect(g); g.connect(sfxOut); far(g, 1); noise(t, 6.6, lp);
            osc('sine', 3520, t + 0.3, t + 5, env(t + 0.3, 0.008, 0.6, 4, sfxOut));       // the ears ring
            duck(t, 0.05, 0.02, 3, 1.8);
        },
    };
    function word(name, t, ...args) {
        if (!WORDS[name]) return false;
        counts[name] = (counts[name] || 0) + 1;
        WORDS[name](t, ...args);
        return true;
    }

    /**
     * A game event, with its word on the grid. State changes (the raid, the
     * silent island) happen even when no sound may play.
     *
     * @param {string} name
     * @param {object} [d] - col (plate column), district, air, defended, impactIn, at ('castOff' | 'impact')
     * @param {boolean} [sfx=true] - words may sound
     */
    function event(name, d = {}, sfx = true) {
        const now = ctx.currentTime;
        const where = d.col != null ? panForColumn(d.col) : 0;
        const say = (w, t, ...a) => (sfx ? word(w, t, ...a) : false);
        counts[`event:${name}`] = (counts[`event:${name}`] || 0) + 1;
        switch (name) {
            case 'castOff': return say('castOff', onGrid(0.3), where);
            case 'landing': {
                const t = onGrid(0.6);
                if (d.air) { duckFolk(t); return true; }                              // the shell has already said it
                return say('landing', t, where);
            }
            case 'razed': return say(d.district ? 'fallDistrict' : 'fallHome', onGrid(0.6));
            case 'strike': return d.at === 'impact' ? say('strikeLands', onGrid(0.6)) : say('strike', onGrid(0.35));
            case 'enemyRazed': return say('enemyRazed', onGrid(0.6, now + 0.35));
            case 'buyShield': return say('shield', onGrid(0.25));
            case 'buySword': return say('sword', onGrid(0.25));
            case 'buyAir': return say('airDefence', onGrid(0.25));
            case 'buy': return say('buy', onGrid(0.25));
            case 'fortify': return say('fortify', onGrid(0.25));
            case 'noArms': return say('knock', now + 0.01);
            case 'reveal': {                                                  // many buttons arriving together are one rise
                if (now - lastReveal < 0.6) return false;
                lastReveal = now;
                return say('rise', onGrid(0.4));
            }
            case 'tier': return say('tier', onGrid(0.3));
            case 'boom': return say('boom', onGrid(0.3));
            case 'nuke': return say('nuke', onGrid(0.3));
            case 'raidStart': {
                const t = onGrid(0.6);
                say('raidTicks', t);
                const until = quantise(t + (d.seconds ?? RAID_S), grid(), 1e9);    // the breath is let out when the drum returns
                startRaid(t, until);
                return true;
            }
            case 'raidEnd': {
                if (S.raid) { if (clockRunning()) raidUntil = Math.min(raidUntil, onGrid(beatLen())); else endRaid(now); }
                return true;
            }
            case 'islandSilent': {
                const t = onGrid(0.6);
                say('islandSilent', t);
                if (S.raid) endRaid(t);
                S.silent = true;
                at(t, () => { if (S.silent) stopClock(); });
                return true;
            }
            case 'islandBack': {
                const t = now + 0.05;
                say('islandBack', t);
                S.silent = false; S.heavy = 1;
                return true;
            }
            case 'shell': {
                const impact = onGrid(0.7, now + (d.impactIn ?? WAVE_WARNING_S + 1.4));
                const length = Math.min(lerp(1.8, 3.4, Math.random()), impact - now - 0.05);
                if (!sfx || length < 0.6) return false;
                counts.shell = (counts.shell || 0) + 1;
                shell(impact, length, !!d.defended, where);
                return true;
            }
            default: return false;
        }
    }

    // ------------------------------------------------------------ the ending
    /** Their drum, tighter and higher, into the rocket's noise. */
    function rocket(t) {
        const L = 9, cut = t + L, back = cut + 3;
        launched = true;
        counts.rocket = (counts.rocket || 0) + 1;
        boom(t, 1.1);
        const p = pan(0.2, sfxOut);
        const sub = ctx.createGain(); sub.gain.setValueAtTime(0.0001, t); sub.gain.exponentialRampToValueAtTime(0.3, cut); sub.connect(sfxOut);
        const sl = filter('lowpass', 70, 0.7, sub); sl.frequency.setValueAtTime(70, t); sl.frequency.exponentialRampToValueAtTime(400, cut); noise(t, L + 0.05, sl);
        osc('sine', 40, t, cut + 0.02, env(t, 0.2, L * 0.9, 0.1, sfxOut));
        const bp = filter('bandpass', 90, 0.8); bp.frequency.setValueAtTime(90, t); bp.frequency.exponentialRampToValueAtTime(2600, cut);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.42, cut);
        bp.connect(g); g.connect(p); send(g, 0.6); noise(t, L + 0.05, bp);
        const b0 = clockRunning() ? beatLen() / 2 : 0.6;
        let k = t + b0, gap = b0;
        while (k < cut - 0.06) {                                             // their drum, tighter and higher, into the noise
            const x = (k - t) / L;
            kick(k, 0.6 + 0.6 * x, p, 90 * Math.pow(2, 2 * x), Math.min(0.4, gap * 0.9), 0.3);
            k += gap; gap = Math.max(0.07, gap * 0.8);
        }
        S.gone = true; stopClock();
        mix.gain.cancelScheduledValues(t); mix.gain.setTargetAtTime(0.4, t + 1.2, 2.5);   // the ramp swallows the music
        // the cut: everything, the room included, every bus (the shared master)
        const mg = G.master.gain, level = mg.value || 0.9;
        mg.cancelScheduledValues(t); mg.setValueAtTime(level, t);
        mg.setValueAtTime(level, cut - 0.012); mg.linearRampToValueAtTime(0, cut);
        at(cut, () => {
            present.clear();
            for (const name of LAYERS) { inp[name].gain.cancelScheduledValues(cut); inp[name].gain.setValueAtTime(0.0001, cut); last.delete(inp[name].gain); }
            apply();
        });
        mg.setValueAtTime(0, back); mg.linearRampToValueAtTime(level, back + 0.05);
        hold(back);
        return { cut, back };
    }
    /** Out of the silence: the drone on E♭, very quiet, two voices 0.3 Hz apart; it waits for the IV card. */
    function hold(t) {
        if (holding) return;
        const out = ctx.createGain(); out.connect(endOut); send(out, 0.7);
        out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.12, t + 2.5);
        const lp = filter('lowpass', 700, 0.8, out);
        const from = mtof(51);
        const oscs = [[0, 'sawtooth', 0.12], [BEAT_HZ, 'sawtooth', 0.12], [0, 'sine', 0.3]].map(([dHz, type, a]) => {
            const vg = ctx.createGain(); vg.gain.value = a; vg.connect(type === 'sine' ? out : lp);
            const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(from + dHz, t); o.connect(vg); o.start(t);
            return { o, dHz };
        });
        holding = { out, lp, oscs, from: t, falling: false };
    }
    /** The IV card: the E♭ falls two octaves to D over ten seconds and stops. */
    function fall() {
        if (!holding || holding.falling) return false;
        const t = Math.max(ctx.currentTime, holding.from) + 0.05;
        holding.falling = true;
        const { out, lp, oscs } = holding;
        out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value || 0.12), t);
        out.gain.linearRampToValueAtTime(0.26, t + 10); out.gain.setValueAtTime(0.26, t + 11); out.gain.linearRampToValueAtTime(0.0001, t + 15);
        lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(160, t + 10);
        const to = mtof(26);
        for (const { o, dHz } of oscs) {
            o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(mtof(51) + dHz, t);
            o.frequency.exponentialRampToValueAtTime(to + dHz, t + 10);
            o.stop(t + 15.2);
        }
        counts.fall = (counts.fall || 0) + 1;
        return true;
    }
    /** The ending, phase by phase: 'leave' (they withdraw), 'launch' (the rocket), 'hold' (after it, on reload), 'fall' (the IV card). */
    function finale(phase, sfx = true) {
        counts[`finale:${phase}`] = (counts[`finale:${phase}`] || 0) + 1;
        if (phase === 'leave') {
            S.leaving = true;                                                  // no more departures: the drum runs free
            sync();
            return true;
        }
        if (phase === 'launch') {
            S.leaving = true;
            if (launched || holding) return false;
            if (!running || !sfx) { S.gone = true; stopClock(); hold(ctx.currentTime + 0.05); apply(); return false; }
            rocket(onGrid(0.6));
            return true;
        }
        if (phase === 'hold') {
            S.leaving = true; S.gone = true; stopClock();
            hold(ctx.currentTime + 0.05);
            apply();
            return true;
        }
        if (phase === 'fall') return fall();
        return false;
    }

    // ------------------------------------------------------------ on, off, gates
    function begin() {
        if (running) return;
        const t = ctx.currentTime;
        running = true; pending.length = 0;
        T.life = t + 2; T.free = t + 0.3; T.crackle = t + 1; T.arms = t + 0.3;
        stopClock();
        setChord(0, t);
        layerOut.gain.cancelScheduledValues(t); layerOut.gain.setTargetAtTime(LEVEL, t, 0.8);
        last.clear();
        present.clear();
        sync(t);
        apply();
    }
    function halt() {
        if (!running) return;
        running = false;
        const t = ctx.currentTime;
        stopClock(); pending.length = 0;
        if (S.raid) { breath.gain.setTargetAtTime(1, t, 0.25); wet.gain.setTargetAtTime(WET, t, 0.5); }
        layerOut.gain.cancelScheduledValues(t); layerOut.gain.setTargetAtTime(0.0001, t, 0.3);
        apply();
    }
    /** Music and words on or off (the saved choices, paused, hidden). */
    function gate({ music, sfx }) {
        const t = ctx.currentTime;
        glideTo(roomMusic.gain, music ? 1 : 0, 0.1, t);
        glideTo(sfxOut.gain, sfx ? 1 : 0, 0.05, t);
        glideTo(roomOut.gain, music || sfx ? 1 : 0, 0.1, t);
        glideTo(endOut.gain, music || holding?.falling ? 0.7 : 0, 0.3, t);
        if (!music && running) { layerOut.gain.cancelScheduledValues(t); layerOut.gain.setTargetAtTime(0.0001, t, 0.3); last.delete(layerOut.gain); }
        if (music && running) glideTo(layerOut.gain, LEVEL, 0.8, t);
    }

    return {
        S, set, event, word, finale, begin, halt, gate, pump, apply,
        isRunning: () => running,
        isHolding: () => !!holding,
        present: () => [...present],
        counts: () => ({ ...counts }),
        clock: () => ({ running: clockRunning(), barStart: C.barStart, barLen: C.barLen, beats: C.beats, land: C.land, now: ctx.currentTime }),
        chordName: () => chordNow().name,
    };
}

// ---------------------------------------------------------------- the game's API (one engine on the shared graph)

let E = null, G = null;
let wanted = false, timer = null;
const latest = {};                       // the last state, for an engine made later (the first click comes after)
let ending = null;                       // the last finale phase asked for, for an engine made later
/** Debug: set window.__rpiWarLog = [] and it collects what the war's sound is told. */
function note(type, detail) {
    if (typeof window === 'undefined' || !Array.isArray(window.__rpiWarLog)) return;
    const log = window.__rpiWarLog;
    log.push({ type, detail, at: typeof performance !== 'undefined' ? Math.round(performance.now()) : 0 });
    if (log.length > 2000) log.splice(0, log.length - 2000);
}

function engine() {
    if (E) return E;
    const g = audio.graph?.();
    if (!g || !g.ctx) return null;
    G = g;
    E = createWarEngine(G);
    E.set(latest);
    if (ending === 'launch' || ending === 'hold') E.finale('hold');
    else if (ending === 'leave') E.finale('leave');
    return E;
}
const paused = () => typeof window !== 'undefined' && (window.__rpiPaused || (typeof document !== 'undefined' && document.hidden));

function tick() {
    const e = engine();
    if (!e) return;
    const p = audio.getPrefs(), still = paused();
    e.gate({ music: p.music && !still, sfx: p.sfx && !still });
    if (!wanted) { if (e.isRunning()) e.halt(); return; }
    if (still || (!p.music && !p.sfx)) { if (e.isRunning()) { e.halt(); note('halt', still ? 'paused' : 'off'); } return; }
    if (!e.isRunning()) { e.begin(); note('begin'); }
    e.pump(G.ctx.currentTime + 0.35);
}

/** The war's music begins (it waits for the first click and for Sound or Music on). */
function start() {
    wanted = true;
    note('start');
    audio.wake?.();
    if (!timer) timer = setInterval(tick, 80);
    tick();
}
/** It stops: the layers fade. A falling ending drone is let finish. */
function stop() {
    wanted = false;
    note('stop');
    if (timer) { clearInterval(timer); timer = null; }
    if (E) { E.halt(); E.gate({ music: false, sfx: audio.getPrefs().sfx }); }
}
/**
 * The game's numbers, once a second, from the end of warTick. Any subset of:
 * nextLandingIn (s to their next departure, null if none), interval (s, the
 * wave interval), push, col (target plate's column), lead (our tier minus
 * theirs), plates (per land slot: true standing, false razed, null empty),
 * armsShare, population (0..1), doomsday (0..100), enemyTier, radar,
 * airDefence, raidLeft (s), silentIsland, rocket (0..1 from 55 to 85 %),
 * units, landings, shown (the war's opened controls), leaveStage (-1 until
 * they leave; 0 withdraw, 1 ignition, 2 lift-off, 3 rubble).
 */
function set(state) {
    Object.assign(latest, state);
    note('set', { nextLandingIn: state.nextLandingIn, doomsday: state.doomsday, leaveStage: state.leaveStage });
    // the leave stages carry the ending (a reload past the launch goes straight to the drone)
    const stage = state.leaveStage ?? -1;
    if (stage >= 0 && !ending) finale('leave');
    if (stage >= 1 && ending === 'leave') finale(stage >= 2 ? 'hold' : 'launch');
    const e = engine();
    if (e) e.set(state);
}
/** A word by its board name (shield, sword, airDefence, fortify, buy, rise, knock, tier, strike, landing, fallHome, ...). */
function word(name, ...args) {
    const e = engine();
    if (!e || !audio.getPrefs().sfx || paused()) return false;
    return e.word(name, G.ctx.currentTime + 0.02, ...args);
}
/** A game event: 'castOff', 'landing', 'razed', 'strike', 'enemyRazed', 'buyShield', 'buySword', 'buyAir', 'buy', 'fortify', 'noArms', 'reveal', 'raidStart', 'raidEnd', 'islandSilent', 'islandBack', 'shell', 'tier', 'boom', 'nuke'. */
function event(name, detail = {}) {
    note('event', { name, ...detail });
    const e = engine();
    if (!e) return false;
    return e.event(name, detail, audio.getPrefs().sfx && !paused() && wanted);
}
/** The ending: 'leave', 'launch' (the rocket, the cut, the drone on E♭), 'fall' (the IV card: E♭ to D). True if it sounded. */
function finale(phase = 'launch') {
    note('finale', phase);
    if (phase !== 'fall') ending = phase === 'hold' ? 'hold' : phase;
    const e = engine();
    if (!e) return false;
    const p = audio.getPrefs();
    if (phase === 'fall') {
        if (!p.music) return false;                                           // no drone to fall: the card keeps its swell
        e.gate({ music: true, sfx: p.sfx });
    }
    return e.finale(phase, (p.music || p.sfx) && !paused());
}

export const war = { start, stop, set, word, event, finale, isRunning: () => !!E?.isRunning(), debug: () => (E ? { running: E.isRunning(), present: E.present(), counts: E.counts(), clock: E.clock(), chord: E.chordName(), holding: E.isHolding() } : null) };
