/**
 * The city's sound (chapter II, B190). Lifted from the sound board Ola
 * approved (docs/mockups/sound-board-city.html, mockup 3), and hung on the
 * same Web Audio graph as chapter I (src/audio.js): the same buses, the same
 * on/off in the ☰ menu, the same first-click unlocking. Nothing is loaded.
 *
 * What plays, from the game's numbers (`city.set`):
 * - the bass: heavy, calm, far back, one hit every GAP seconds; the chord
 *   round of chapter I (Dm, B♭, F, C), one chord every four hits
 * - the tones: slow voices that drag themselves into a chord note; more of
 *   them with more people, glassier with taller houses and more research
 * - the factory, far away: chapter I's heartbeat and five rising notes, in
 *   time with the wave on the factory's tile
 * - life: short voices and small steps, a far choir in a large city
 * - the neighbour, in five steps from wow to dread: a bright chime answering
 *   our factory, then building sounds, then a drum between our bass hits,
 *   darker chords, a thin note that chafes, and a quiet town
 * - words, by material: wood (build), glass (research), metal (industry),
 *   grain (food), earth (land); chapter I's three notes for "something new"
 * - two set pieces: the raid (follows the boat's phases) and the change to
 *   III · WAR (everything falls away, one C♯ hangs, three strokes, the boom)
 *
 * The silo is the city's heart as the battery was the machine's.
 */

import { audio, pentaNote } from './audio.js';

const CHORDS = [
    { name: 'Dm', root: 38, third: 3 }, { name: 'B♭', root: 34, third: 4 },
    { name: 'F', root: 41, third: 4 }, { name: 'C', root: 36, third: 4 },
];
const HITS_PER_CHORD = 4;
const FACTORY_CYCLE = 2.7;          // the wave over the factory's tile (style-stage2.css, mini-win)
const GAP = 6.5;                    // seconds between bass hits
const LEVEL = 0.95;                 // the city on the music bus, relative to the machine
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

// ---------------------------------------------------------------- pure rules (tested)

/** How far the neighbour has come toward war, 0..1: steps 1 and 2 are a neighbour, not a threat. */
export function threatFor(rival) {
    return clamp((rival - 2) / 3);
}

/**
 * The chord at round position k (0..3) for a neighbour at `rival`: the round
 * darkens as they build. The brightest chord goes first (F → Gm at 3), then
 * B♭ → E♭ (their note, a semitone above home, at 4), then C → A major with
 * its C sharp (at 5).
 */
export function chordFor(k, rival) {
    if (k === 2 && rival >= 3) return { name: 'Gm', root: 31, third: 3 };
    if (k === 1 && rival >= 4) return { name: 'E♭', root: 39, third: 4 };
    if (k === 3 && rival >= 5) return { name: 'A', root: 33, third: 4 };
    return CHORDS[((k % 4) + 4) % 4];
}

/** How the game's numbers become the sound's: population 0..200 000 → 0..1 (cube root, so a village is heard). */
export function popLevel(population) {
    return clamp(Math.cbrt(Math.max(0, population) / 200000));
}

// ---------------------------------------------------------------- state

// pop 0..1, tier 0..3, food 0..1, research 0..1, rival 0..5, cars/computers flags
const S = { pop: 0, tier: 0, food: 1, research: 0, rival: 0, cars: false, computers: false, factory: 0.55 };
const T = { bass: 0, tone: 0, factory: 0, car: 0, computer: 0, life: 0, build: 0, drum: Infinity };
let G = null;                 // the shared graph, once there is one
let running = false, wanted = false, timer = null;
let hits = 0, lastMidi = 62;
let bus = null, layer = null, seqBus = null;   // our buses on top of audio.js's
let choir = null, rival = null, nerve = null;
let raidState = null;

function graph() {
    if (G) return G;
    const g = audio.graph?.();
    if (!g || !g.ctx) return null;
    G = g;
    build();
    return G;
}

// ---------------------------------------------------------------- helpers on the shared graph

function env(t, peak, attack, decay, dest) {
    const { ctx } = G;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
}
function osc(type, freq, t, stopAt, dest) {
    const o = G.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    o.connect(dest); o.start(t); o.stop(stopAt); return o;
}
function noise(t, dur, dest) {
    const n = G.ctx.createBufferSource(); n.buffer = G.noiseBuf; n.loop = true;
    n.connect(dest); n.start(t, Math.random()); n.stop(t + dur); return n;
}
function pan(value, dest) {
    const { ctx } = G;
    if (!ctx.createStereoPanner) return dest;
    const p = ctx.createStereoPanner(); p.pan.value = value; p.connect(dest); return p;
}
function send(node, amount) { const s = G.ctx.createGain(); s.gain.value = amount; node.connect(s); s.connect(G.reverb); }

const chordNow = () => chordFor(Math.floor(hits / HITS_PER_CHORD) % CHORDS.length, S.rival);
const threat = () => threatFor(S.rival);
const courage = () => 1 - 0.75 * threat();
/** The silo is the city's heart: a weak heart below 30 %, nearly none when empty. */
const heart = () => (S.food <= 0 ? 0.22 : 0.4 + 0.6 * clamp(S.food / 0.3));

/** Builds our part of the graph once: a layer bus per part, so each can be judged, and a bus for the set pieces. */
function build() {
    const { ctx, musicBus, sfxBus } = G;
    layer = ctx.createGain(); layer.gain.value = 0.0001; layer.connect(musicBus);
    seqBus = ctx.createGain(); seqBus.gain.value = 1.1; seqBus.connect(sfxBus);
    send(seqBus, 0.7);
    bus = {};
    const SEND = { bass: 0.8, tones: 0.8, factory: 0.9, life: 0.6, traffic: 0.35, computer: 0.6, rival: 0.7 };
    for (const name of Object.keys(SEND)) {
        const g = ctx.createGain(); g.connect(layer); send(g, SEND[name]); bus[name] = g;
    }
    // the old murmur is gone; life is voices and steps (below) and this far choir
    choir = (() => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(bus.life);
        const [a, b] = formants(g, 450, 800);
        const oscs = [12, 19, 24].map((semi, i) => {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = [-7, 6, 0][i];
            o.frequency.value = mtof(38 + semi); o.connect(a); o.connect(b); o.start();
            return { o, semi };
        });
        return { g, oscs };
    })();
    rival = (() => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(bus.rival);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150; lp.Q.value = 1.5; lp.connect(g);
        const a = ctx.createOscillator(), b = ctx.createOscillator(), c = ctx.createOscillator();
        a.type = b.type = 'sawtooth'; c.type = 'sine';
        a.frequency.value = mtof(39); b.frequency.value = mtof(39) * 1.007;   // E♭, a semitone above home, beating
        c.frequency.value = mtof(56);                                         // and a tritone above it, faint
        const cg = ctx.createGain(); cg.gain.value = 0.25; c.connect(cg); cg.connect(g);
        a.connect(lp); b.connect(lp); a.start(); b.start(); c.start();
        return { g, lp };
    })();
    nerve = (() => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(bus.rival);
        const trem = ctx.createOscillator(); trem.frequency.value = 5.3;
        const depth = ctx.createGain(); depth.gain.value = 0;
        trem.connect(depth); depth.connect(g.gain); trem.start();
        [85, 86].forEach((m, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m); const og = ctx.createGain(); og.gain.value = i ? 0.6 : 1; o.connect(og); og.connect(g); o.start(); });
        return { g, depth };
    })();
}
function formants(dest, f1, f2) {
    const { ctx } = G;
    const a = ctx.createBiquadFilter(); a.type = 'bandpass'; a.frequency.value = f1; a.Q.value = 5;
    const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f2; b.Q.value = 7;
    const bg = ctx.createGain(); bg.gain.value = 0.6;
    a.connect(dest); b.connect(bg); bg.connect(dest);
    return [a, b];
}

// ---------------------------------------------------------------- the layers

function bassHit(t) {
    const { ctx } = G;
    const chord = chordNow(), k = heart();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(bus.bass);
    const f = mtof(chord.root);
    const body = osc('sine', f * 1.22, t, t + 4.6, env(t, 0.36 * k, 0.03, 4.2, lp));
    body.frequency.exponentialRampToValueAtTime(f, t + 0.16);
    osc('sine', f / 2, t, t + 3.8, env(t, 0.25 * k, 0.05, 3.4, lp));
    osc('triangle', f * 2, t, t + 2.4, env(t, 0.07 * k, 0.03, 2.0, lp));
    const thud = ctx.createBiquadFilter(); thud.type = 'lowpass'; thud.frequency.value = 140;
    thud.connect(env(t, 0.2 * k, 0.004, 0.16, bus.bass));
    noise(t, 0.2, thud);
    hits++;
    tuneChoir(t + 0.4);
}
function pickNote() {
    const c = chordNow(), r = c.root + 12;
    let pool = [r + 7, r + 12, r + 12 + c.third, r + 19];
    if (S.tier >= 1) pool.push(r, r + 24);
    if (S.tier >= 2) pool.push(r + 24 + c.third, r + 31);
    if (S.tier >= 3) pool.push(r + 36, r + 36 + c.third);
    const th = threat();
    if (Math.random() < 0.22 + 0.2 * th) pool = Math.random() < th ? [r + 13, r + 18, r + 25] : [r + 14, r + 17, r + 26];
    let m = pool[Math.floor(Math.random() * pool.length)];
    if (m === lastMidi) m = pool[(pool.indexOf(m) + 1) % pool.length];
    return m;
}
function tone(t) {
    const { ctx } = G;
    const midi = pickNote();
    const glass = clamp(0.12 + S.tier * 0.2 + S.research * 0.4);
    const dur = lerp(7, 11, Math.random()) * (1 - 0.35 * threat());
    const starving = S.food <= 0;
    const level = (0.085 + 0.03 * Math.random()) * (starving ? 0.6 : 1) * (midi > 80 ? 0.6 : 1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + dur * 0.36);
    g.gain.setValueAtTime(level, t + dur * 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(pan(Math.random() * 1.3 - 0.65, bus.tones));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = 520 + 2800 * glass; lp.connect(g);
    const from = mtof(lastMidi), to = mtof(midi), glide = lerp(1.2, 2.6, Math.random()), end = t + dur + 0.1;
    const spread = 5 + 16 * threat();
    const voices = [['triangle', 1, 1 - 0.45 * glass, -spread], ['triangle', 1, 1 - 0.45 * glass, spread], ['sine', 2, 0.1 + 0.42 * glass, 0], ['sine', 3, glass > 0.55 ? 0.12 * (glass - 0.55) / 0.45 : 0, 0]];
    for (const [type, mult, amount, detune] of voices) {
        if (amount <= 0) continue;
        const vg = ctx.createGain(); vg.gain.value = amount; vg.connect(lp);
        const o = osc(type, from * mult, t, end, vg);
        o.detune.value = detune;
        o.frequency.exponentialRampToValueAtTime(to * mult, t + glide);
        if (starving) o.detune.linearRampToValueAtTime(detune - 35, end);
    }
    lastMidi = midi;
}
const toneGap = () => lerp(6.0, 1.7, Math.pow(S.pop, 0.7)) * lerp(0.7, 1.3, Math.random()) * (1 - 0.3 * threat());
function factoryWave(t) {
    const { ctx } = G;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380 + 900 * S.factory; lp.connect(bus.factory);
    const k = S.factory;
    [0, 0.45].forEach((d, i) => {
        const o = osc('sine', i ? 84 : 104, t + d, t + d + 0.3, env(t + d, (i ? 0.16 : 0.26) * k, 0.006, 0.2, lp));
        o.frequency.exponentialRampToValueAtTime(48, t + d + 0.12);
    });
    for (let i = 0; i < 5; i++) {
        const at = t + i * 0.14, f = mtof(pentaNote(i, 62));
        osc('sine', f, at, at + 0.5, env(at, 0.075 * k, 0.004, 0.4, lp));
        osc('sine', f * 2.005, at, at + 0.25, env(at, 0.02 * k, 0.004, 0.18, lp));
    }
}
function neighbourWave(t) {
    const { ctx } = G;
    const off = S.rival === 2;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(pan(0.55, bus.rival));
    for (let i = 0; i < 5; i++) {
        const at = t + i * 0.14 + (off ? 0.21 + i * 0.012 : 0);
        const f = mtof(pentaNote(i, 69) - (off && i === 4 ? 1 : 0));
        osc('sine', f, at, at + 0.6, env(at, 0.075, 0.004, 0.5, lp));
        osc('sine', f * 2.005, at, at + 0.3, env(at, 0.022, 0.004, 0.22, lp));
    }
}
function rivalBuilds(t, dest = pan(0.6, bus.rival), level = 1) {
    const { ctx } = G;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
        const at = t + i * lerp(0.2, 0.3, Math.random());
        if (S.rival >= 3) {
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 4;
            bp.connect(env(at, 0.1 * level, 0.001, 0.22, dest));
            [410, 410 * 1.483, 410 * 2.71].forEach((f) => osc('square', f, at, at + 0.26, bp));
        } else {
            const f = mtof(69 + [0, 3, 7][Math.floor(Math.random() * 3)]);
            osc('sine', f, at, at + 0.3, env(at, 0.11 * level, 0.002, 0.2, dest));
            osc('sine', f * 3.93, at, at + 0.1, env(at, 0.03 * level, 0.002, 0.06, dest));
        }
    }
}
function rivalDrum(t) {
    const { ctx } = G;
    const k = 0.1 + 0.9 * threat();
    const dest = pan(0.35, bus.rival);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.connect(dest);
    (S.rival >= 5 ? [0, 0.38] : [0]).forEach((d, i) => {
        const at = t + d, f = mtof(27);
        const o = osc('sine', f * 1.5, at, at + 1.8, env(at, (i ? 0.2 : 0.3) * k, 0.006, 1.5, lp));
        o.frequency.exponentialRampToValueAtTime(f, at + 0.09);
        osc('triangle', f * 2, at, at + 0.9, env(at, 0.08 * k, 0.006, 0.7, lp));
        const th = ctx.createBiquadFilter(); th.type = 'lowpass'; th.frequency.value = 220;
        th.connect(env(at, 0.22 * k, 0.003, 0.09, dest)); noise(at, 0.12, th);
    });
}
const VOWELS = [[700, 1100], [450, 800], [400, 1600], [320, 870]];
function voice(t, level = 1) {
    const { ctx } = G;
    const c = chordNow(), r = c.root + 12;
    let midi = [r + 7, r + 12, r + 12 + c.third, r + 19][Math.floor(Math.random() * 4)];
    while (midi > 74) midi -= 12;
    while (midi < 55) midi += 12;
    const dur = lerp(0.22, 0.55, Math.random()), f = mtof(midi), peak = 0.22 * level * courage();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.07);
    g.gain.setValueAtTime(peak, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2);
    g.connect(pan(Math.random() * 1.6 - 0.8, bus.life));
    const [a, b] = formants(g, ...VOWELS[Math.floor(Math.random() * VOWELS.length)]);
    const o = osc('sawtooth', f * lerp(0.95, 1, Math.random()), t, t + dur + 0.25, a);
    o.connect(b);
    o.frequency.linearRampToValueAtTime(f * lerp(0.97, 1.04, Math.random()), t + dur);
    if (level === 1 && Math.random() < 0.4) voice(t + dur + lerp(0.1, 0.3, Math.random()), 0.7);   // someone answers
}
function steps(t) {
    const { ctx } = G;
    const c = chordNow(), r = c.root + 36;
    const n = 1 + Math.floor(Math.random() * 3), every = lerp(0.11, 0.19, Math.random());
    const f = mtof(r + [0, 7, 12, 12 + c.third, 19][Math.floor(Math.random() * 5)]);
    const dest = pan(Math.random() * 1.6 - 0.8, bus.life);
    for (let i = 0; i < n; i++) {
        const at = t + i * every;
        osc('sine', f, at, at + 0.14, env(at, 0.13 * courage(), 0.002, 0.1, dest));
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
        hp.connect(env(at, 0.05 * courage(), 0.001, 0.02, dest)); noise(at, 0.03, hp);
    }
}
function life(t) { if (Math.random() < 0.5) voice(t); else steps(t); }
const lifeGap = () => lerp(3.6, 0.32, Math.pow(S.pop, 0.7)) * lerp(0.5, 1.5, Math.random());
function tuneChoir(t) {
    const c = chordNow();
    for (const { o, semi } of choir.oscs) o.frequency.setTargetAtTime(mtof(c.root + (c.root < 34 ? 12 : 0) + semi), t, 0.9);
}
function passBy(t) {
    const { ctx } = G;
    const dur = lerp(2.6, 4.4, Math.random()), dir = Math.random() < 0.5 ? 1 : -1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13, t + dur * 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    let dest = bus.traffic;
    if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.9 * dir, t); p.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
        p.connect(bus.traffic); dest = p;
    }
    g.connect(dest);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.linearRampToValueAtTime(lerp(620, 900, Math.random()), t + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(220, t + dur);
    bp.connect(g); noise(t, dur + 0.1, bp);
}
function dataRun(t) {
    const n = 6 + Math.floor(Math.random() * 6), start = Math.floor(Math.random() * 5);
    const dest = pan(Math.random() * 1.6 - 0.8, bus.computer);
    for (let i = 0; i < n; i++) {
        const at = t + i * 0.085, f = mtof(pentaNote(start + [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7][i], 86));
        osc('sine', f, at, at + 0.12, env(at, 0.05, 0.002, 0.08, dest));
    }
}

/** The continuous parts follow the state: the choir, their drone, the nerve. */
function apply() {
    if (!G) return;
    const t = G.ctx.currentTime;
    const r = threat();
    choir.g.gain.setTargetAtTime(running ? 0.0001 + 0.085 * clamp((S.pop - 0.45) / 0.55) * courage() : 0.0001, t, 1.5);
    rival.g.gain.setTargetAtTime(running && r > 0 ? 0.012 + 0.05 * r : 0.0001, t, 1.5);
    rival.lp.frequency.setTargetAtTime(110 + 260 * r, t, 1.5);
    nerve.g.gain.setTargetAtTime(running && r > 0 ? 0.016 * r * r : 0.0001, t, 2);
    nerve.depth.gain.setTargetAtTime(running ? 0.006 * r * r : 0, t, 2);
}

/** Schedules everything that begins before `until`. */
function pump(until) {
    const now = G.ctx.currentTime;
    for (const key of Object.keys(T)) if (T[key] < now - 0.5) T[key] = key === 'drum' ? Infinity : now + 0.05;   // a stalled timer plays no backlog
    while (T.bass < until) {
        bassHit(T.bass);
        const wait = GAP * lerp(0.94, 1.06, Math.random());
        const answer = T.bass + wait / 2;
        if (answer >= until) T.drum = answer; else if (S.rival >= 3) rivalDrum(answer);
        T.bass += wait;
    }
    if (T.drum < until) { if (S.rival >= 3) rivalDrum(T.drum); T.drum = Infinity; }
    while (T.life < until) { if (S.pop > 0.02) life(T.life); T.life += lifeGap(); }
    while (T.tone < until) { tone(T.tone); T.tone += toneGap(); }
    while (T.factory < until) {
        if (S.factory > 0.01) factoryWave(T.factory);
        if (S.rival === 1 || S.rival === 2) neighbourWave(T.factory + FACTORY_CYCLE / 2);
        T.factory += FACTORY_CYCLE;
    }
    while (T.build < until) { if (S.rival >= 2) rivalBuilds(T.build); T.build += lerp(4.5, 8, Math.random()); }
    while (T.car < until) { if (S.cars) passBy(T.car); T.car += lerp(7, 2.4, S.pop) * lerp(0.6, 1.4, Math.random()); }
    while (T.computer < until) { if (S.computers) dataRun(T.computer); T.computer += lerp(5, 10, Math.random()); }
}

function tick() {
    if (!wanted) return;
    const g = graph();
    if (!g) return;                                  // no click yet
    const paused = typeof window !== 'undefined' && (window.__rpiPaused || document.hidden);
    const music = audio.getPrefs().music && !paused;
    if (music && !running) begin();
    if (!music && running) halt();
    if (running) pump(g.ctx.currentTime + 0.35);
}
function begin() {
    const t = G.ctx.currentTime;
    running = true; hits = 0;
    T.bass = t + 0.3; T.tone = t + 1.2; T.factory = t + 0.8; T.car = t + 3; T.computer = t + 4; T.life = t + 2; T.build = t + 3.5; T.drum = Infinity;
    layer.gain.cancelScheduledValues(t);
    layer.gain.setTargetAtTime(LEVEL, t, 0.8);
    tuneChoir(t);
    apply();
}
function halt() {
    if (!running) return;
    running = false;
    layer.gain.setTargetAtTime(0.0001, G.ctx.currentTime, 0.5);
    apply();
}

// ---------------------------------------------------------------- words, by material

function wood(t, midi, level = 1) {
    const f = mtof(midi), dest = G.sfxBus;
    const g = env(t, 0.34 * level, 0.003, 0.55, dest);
    osc('sine', f, t, t + 0.7, g);
    osc('sine', f * 3.93, t, t + 0.2, env(t, 0.07 * level, 0.002, 0.11, dest));
    send(g, 0.45);
}
function thunk(t, level = 1) {
    const { ctx, sfxBus } = G;
    const o = osc('sine', 150, t, t + 0.22, env(t, 0.5 * level, 0.003, 0.16, sfxBus));
    o.frequency.exponentialRampToValueAtTime(58, t + 0.14);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    lp.connect(env(t, 0.22 * level, 0.001, 0.05, sfxBus));
    noise(t, 0.07, lp);
}
function glass(t, midi, level = 1) {
    const f = mtof(midi), dest = G.sfxBus;
    const g = env(t, 0.13 * level, 0.004, 1.5, dest);
    osc('sine', f, t, t + 1.7, g);
    osc('sine', f * 2.76, t, t + 0.9, env(t, 0.05 * level, 0.003, 0.7, dest));
    osc('sine', f * 5.4, t, t + 0.4, env(t, 0.025 * level, 0.002, 0.25, dest));
    send(g, 1.1);
}
function metal(t) {
    const { ctx, sfxBus } = G;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 3;
    const g = env(t, 0.26, 0.001, 0.2, sfxBus); bp.connect(g);
    [520, 520 * 1.483, 520 * 2.71].forEach((f) => osc('square', f, t, t + 0.25, bp));
    send(g, 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(240, t + 0.08); lp.frequency.exponentialRampToValueAtTime(900, t + 0.7);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(0.0001, t + 0.08); mg.gain.linearRampToValueAtTime(0.12, t + 0.3); mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    lp.connect(mg); mg.connect(sfxBus);
    const m = osc('sawtooth', 55, t + 0.08, t + 0.9, lp); m.frequency.exponentialRampToValueAtTime(147, t + 0.7);
}
function grain(t, n = 5) {
    const { ctx, sfxBus } = G;
    for (let i = 0; i < n; i++) {
        const at = t + i * 0.045 + Math.random() * 0.012;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = lerp(2400, 4200, Math.random()); bp.Q.value = 1.4;
        bp.connect(env(at, 0.14 * (1 - i / (n + 2)), 0.001, 0.03, sfxBus)); noise(at, 0.05, bp);
    }
}
function pling(t, midi, level = 1) {
    const f = mtof(midi), dest = G.sfxBus;
    const g = env(t, 0.2 * level, 0.003, 0.42, dest);
    osc('sine', f, t, t + 0.5, g);
    osc('sine', f * 2.005, t, t + 0.3, env(t, 0.06 * level, 0.003, 0.2, dest));
    osc('sine', f * 3.01, t, t + 0.15, env(t, 0.02 * level, 0.002, 0.09, dest));
    send(g, 0.5);
}

const WORDS = {
    home() { const t = G.ctx.currentTime, c = chordNow(); thunk(t, 0.8); wood(t + 0.03, c.root + 24, 0.9); },
    store() { const t = G.ctx.currentTime, c = chordNow(); thunk(t, 0.8); wood(t + 0.03, c.root + 31, 0.7); wood(t + 0.13, c.root + 36, 0.7); },
    upgrade(tier = 1) {
        const t = G.ctx.currentTime, c = chordNow(), low = c.root + 24 - (tier >= 2 ? 12 : 0);
        thunk(t, 0.6 + 0.15 * tier);
        [0, 7, 12].concat(tier >= 1 ? [12 + c.third] : [], tier >= 2 ? [19] : [], tier >= 3 ? [24] : [])
            .forEach((semi, i) => wood(t + 0.04 + i * 0.07, low + semi, 0.75));
    },
    sell() { const t = G.ctx.currentTime, c = chordNow(); wood(t, c.root + 31, 0.55); wood(t + 0.12, c.root + 24, 0.5); },
    research() { const t = G.ctx.currentTime, c = chordNow(); thunk(t, 0.5); [36, 43, 50, 55].forEach((s, i) => glass(t + 0.06 + i * 0.16, c.root + s, 1 - i * 0.12)); },
    tool() { const t = G.ctx.currentTime; thunk(t, 0.9); metal(t + 0.03); },
    food() { const t = G.ctx.currentTime, c = chordNow(); thunk(t, 0.6); grain(t + 0.03, 7); wood(t + 0.05, c.root + 19, 0.6); },
    harvest() { const t = G.ctx.currentTime; grain(t, 3); wood(t + 0.01, pentaNote(Math.floor(Math.random() * 3), 74), 0.4); },
    land() {
        const { ctx, sfxBus } = G;
        const t = ctx.currentTime, c = chordNow();
        thunk(t, 0.8);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.17, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        g.connect(sfxBus); send(g, 0.8);
        osc('sine', mtof(c.root), t, t + 2.3, g); osc('sine', mtof(c.root + 7), t, t + 2.3, g); osc('triangle', mtof(c.root + 12), t, t + 2.3, g).detune.value = 6;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.9);
        const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.1, t + 0.4); ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        lp.connect(ng); ng.connect(sfxBus); noise(t, 1.7, lp);
    },
    rise() { const t = G.ctx.currentTime; [0, 2, 5].forEach((n, i) => pling(t + i * 0.09, pentaNote(n), 0.9)); },
    rivalArrives() {
        const { ctx, sfxBus } = G;
        const t = ctx.currentTime;
        [0, 2, 5].forEach((n, i) => pling(t + i * 0.09, pentaNote(n), 0.9));
        const far = ctx.createBiquadFilter(); far.type = 'lowpass'; far.frequency.value = 2400;
        far.connect(pan(0.6, sfxBus)); send(far, 1.2);
        [0, 2, 5].forEach((n, i) => { const at = t + 0.75 + i * 0.09; osc('sine', mtof(pentaNote(n, 81)), at, at + 0.6, env(at, 0.1, 0.004, 0.5, far)); });
        [65, 69, 72, 77].forEach((m, i) => wood(t + 1.5 + i * 0.07, m, 0.5));
    },
    rivalBuilds() { rivalBuilds(G.ctx.currentTime, pan(0.6, G.sfxBus), 3); },
};

// ---------------------------------------------------------------- set pieces

function boom(t, power = 1) {
    const { ctx } = G;
    const pw = clamp(power, 1, 2.4), tail = 2.2 + 1.4 * (pw - 1);
    const out = ctx.createGain(); out.gain.value = 0.9 + 0.25 * (pw - 1); out.connect(seqBus);
    const body = osc('sine', 110, t, t + tail + 0.2, env(t, 0.9, 0.004, tail, out));
    body.frequency.exponentialRampToValueAtTime(pw > 1.5 ? 30 : 38, t + 0.5);
    const over = osc('triangle', 220, t, t + tail * 0.6, env(t, 0.22, 0.004, tail * 0.5, out));
    over.frequency.exponentialRampToValueAtTime(pw > 1.5 ? 60 : 76, t + 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(70, t + tail * 0.8);
    lp.connect(env(t, 0.5, 0.003, tail * 0.9, out)); noise(t, tail + 0.1, lp);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    hp.connect(env(t, 0.25, 0.001, 0.06, out)); noise(t, 0.08, hp);
}
function footfall(t, near) {
    const { ctx } = G;
    const dest = pan(0.8 * (1 - near), seqBus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lerp(240, 1700, near); lp.connect(dest);
    const o = osc('sine', 82, t, t + 0.2, env(t, lerp(0.07, 0.42, near), 0.003, 0.13, lp));
    o.frequency.exponentialRampToValueAtTime(44, t + 0.1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = lerp(500, 1500, near);
    bp.connect(env(t, lerp(0.02, 0.16, near), 0.001, 0.04, lp)); noise(t, 0.06, bp);
}
function warDrum(t, level = 1) {
    const { ctx } = G;
    const f = mtof(27);
    const o = osc('sine', f * 2.2, t, t + 1.6, env(t, 0.75 * level, 0.003, 1.3, seqBus));
    o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    osc('triangle', f * 2, t, t + 0.8, env(t, 0.2 * level, 0.003, 0.6, seqBus));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    lp.connect(env(t, 0.4 * level, 0.002, 0.08, seqBus)); noise(t, 0.1, lp);
}
/** The city steps back by `factor` from t, and comes back at `back` (seconds from now). */
function hold(factor, tc, back, backTc) {
    if (!running) return;
    const t = G.ctx.currentTime;
    layer.gain.cancelScheduledValues(t);
    layer.gain.setTargetAtTime(LEVEL * factor, t, tc);
    if (back !== undefined) layer.gain.setTargetAtTime(LEVEL, t + back, backTc);
}

/**
 * The raid, following the boat (ants.js startAttack's phases). muster: the
 * people fall quiet and a tone starts to climb. cross: the climb goes on;
 * oars. ashore: footfalls, nearer and faster. raze: the boom, the fall, the
 * city holds its breath on one thin note. home: the boat goes, the city
 * comes back. over: nothing (the swords' arrival is a word of its own).
 */
function raid(phase) {
    const g = graph(); if (!g) return;
    const { ctx } = g, t = ctx.currentTime;
    if (phase === 'muster') {
        raidState = { riser: null };
        bus.life.gain.cancelScheduledValues(t);
        bus.life.gain.setTargetAtTime(0.0001, t, 0.6);                                   // the people hide
        hold(0.55, 3);
        // a tone that climbs for as long as they are coming (stopped at the landing)
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
        lp.frequency.setValueAtTime(160, t); lp.frequency.exponentialRampToValueAtTime(900, t + 22);
        const rg = ctx.createGain(); rg.gain.setValueAtTime(0.0001, t); rg.gain.exponentialRampToValueAtTime(0.14, t + 22);
        lp.connect(rg); rg.connect(seqBus);
        const oscs = [1, 1.008].map((d) => { const o = osc('sawtooth', mtof(39) * d, t, t + 60, lp); o.frequency.exponentialRampToValueAtTime(mtof(46) * d, t + 22); return o; });
        raidState.riser = { rg, oscs };
    } else if (phase === 'cross') {
        for (let i = 0; i < 9; i++) {                                                     // oars
            const at = t + 0.3 + i * 0.5, s = ctx.createBiquadFilter(); s.type = 'bandpass'; s.frequency.value = 900; s.Q.value = 0.8;
            s.connect(env(at, 0.05 + 0.01 * i, 0.01, 0.12, pan(0.3, seqBus))); noise(at, 0.15, s);
        }
        hold(0.4, 2.5);
    } else if (phase === 'ashore') {
        let at = 0.1, gap = 0.5;
        while (at < 5.5) { footfall(t + at, Math.pow(at / 5.5, 1.3)); at += gap; gap = Math.max(0.2, gap * 0.9); }
    } else if (phase === 'raze') {
        if (raidState?.riser) { raidState.riser.rg.gain.setTargetAtTime(0.0001, t, 0.03); raidState.riser.oscs.forEach((o) => o.stop(t + 0.5)); raidState.riser = null; }
        hold(0.04, 0.02, 5, 1.6);
        boom(t, 1.4);
        [[50, 0.05], [49, 0.4]].forEach(([m, d]) => {                                    // the fall: a minor second down
            const e = env(t + d, 0.3, 0.004, 1.1, seqBus);
            osc('triangle', mtof(m), t + d, t + d + 1.3, e); osc('sine', mtof(m - 12), t + d, t + d + 1.3, e);
        });
        for (let i = 0; i < 7; i++) {                                                     // rubble
            const dt = t + 0.35 + Math.random() * 1.6;
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = lerp(300, 1400, Math.random()); bp.Q.value = 2;
            bp.connect(env(dt, 0.09, 0.001, 0.07, seqBus)); noise(dt, 0.1, bp);
        }
        osc('sine', mtof(85), t + 0.5, t + 4.6, env(t + 0.5, 0.045, 0.4, 3.6, seqBus));   // the breath held
    } else if (phase === 'back') {
        for (let i = 0; i < 9; i++) footfall(t + 0.4 + i * 0.44, 0.75 * Math.pow(1 - i / 9, 1.5));
    } else if (phase === 'home') {
        hold(0.6, 3, 6, 3);
        bus.life.gain.setTargetAtTime(0.6, t + 6, 3);                                    // the people come out, fewer
    } else if (phase === 'over') {
        if (raidState?.riser) { raidState.riser.rg.gain.setTargetAtTime(0.0001, t, 0.1); raidState.riser.oscs.forEach((o) => o.stop(t + 0.5)); }
        raidState = null;
        bus.life.gain.setTargetAtTime(1, t + 20, 8);
    }
}

/**
 * II → III. Everything in the city falls away at once and one note hangs:
 * C sharp, a semitone under home. Darkness. Three drum strokes as III stands
 * on the card. A breath drawn in, and the heaviest boom as WAR appears.
 * Silence. Then their drum alone, and our bass under it when the card lifts.
 * `marks` are seconds from now: when III and WAR appear and when the card
 * lifts, from the chapter card's own timing.
 */
function war(marks = { III: 3.6, WAR: 8.6, LIFT: 14.5 }) {
    const g = graph(); if (!g) return false;
    const { ctx } = g, t = ctx.currentTime;
    wanted = false;
    running = false;
    layer.gain.cancelScheduledValues(t);
    layer.gain.setTargetAtTime(0.0001, t, 0.06);
    apply();
    boom(t, 1.6);
    const f = mtof(61), n = t + 0.25;                                                     // the note that is left hanging
    osc('sine', f, n, n + 7.8, env(n, 0.42, 0.006, 7.2, seqBus));
    osc('sine', f / 2, n, n + 5.4, env(n, 0.2, 0.01, 5, seqBus));
    osc('sine', f * 2, n, n + 3.8, env(n, 0.13, 0.004, 3.4, seqBus));
    osc('sine', f * 3.01, n, n + 1.9, env(n, 0.04, 0.003, 1.6, seqBus));
    const { III, WAR, LIFT } = marks;
    [0, 1.25, 2.5].forEach((d, i) => warDrum(t + III + d, 0.55 + 0.15 * i));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(90, t + WAR - 2); lp.frequency.exponentialRampToValueAtTime(1500, t + WAR);
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t + WAR - 2); sg.gain.exponentialRampToValueAtTime(0.3, t + WAR); sg.gain.setTargetAtTime(0.0001, t + WAR, 0.02);
    lp.connect(sg); sg.connect(seqBus); noise(t + WAR - 2, 2.1, lp);
    boom(t + WAR, 2.4);
    const END = LIFT + 13;
    for (let at = WAR + 3.6; at < END - 1; at += 2.8) warDrum(t + at, at < LIFT ? 0.35 : 0.5);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t + LIFT + 1.5); bg.gain.linearRampToValueAtTime(0.11, t + LIFT + 5); bg.gain.setValueAtTime(0.11, t + END - 3); bg.gain.linearRampToValueAtTime(0.0001, t + END);
    const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 260; blp.connect(bg); bg.connect(seqBus);
    osc('sawtooth', mtof(26), t + LIFT + 1.5, t + END, blp).detune.value = -6; osc('sawtooth', mtof(26), t + LIFT + 1.5, t + END, blp).detune.value = 6;
    osc('sine', mtof(38), t + LIFT + 1.5, t + END, bg);
    return true;
}

// ---------------------------------------------------------------- the API

/** Starts the city's music (it waits for the first click and for Music on). */
function start() {
    wanted = true;
    if (!timer) timer = setInterval(tick, 80);
}
/** Stops it: the layers fade, the words still work. */
function stop() {
    wanted = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (G) halt();
}
/** The game's numbers. Any subset; see S for the fields. */
function set(next) {
    const before = S.rival;
    Object.assign(S, next);
    if (G) {
        apply();
        if (next.rival !== undefined && next.rival !== before && next.rival >= 2 && running && audio.getPrefs().sfx) WORDS.rivalBuilds();
    }
}
/** A word, if there is a graph and sound is on. */
function word(name, arg) {
    const g = graph();
    if (!g || !audio.getPrefs().sfx || !WORDS[name]) return;
    WORDS[name](arg);
}

export const city = { start, stop, set, word, raid, war, isRunning: () => running, state: () => ({ ...S }) };
