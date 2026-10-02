/**
 * Sound (B162). Everything is synthesised in the browser with Web Audio: no
 * sound files, nothing to load or cache. Judged by ear on the sound board
 * (docs/mockups/sound-board.html), which this module is lifted from.
 *
 * Two kinds of sound:
 * - words: short events (click, pling, thunk, rise, lucky, knock, swell)
 * - the machine: the music of chapter I. A pulse that follows the speed, then
 *   a bass, then a shimmer when wins come too close to ring one by one. The
 *   battery is the heart, the generator hums, every board is a voice more.
 *
 * Sound and music can each be switched off (☰ menu); the choice is saved.
 * The browser allows no sound before the first click, so the context is made
 * on the first gesture; until then every call does nothing.
 */

const PREFS_KEY = 'rpi-audio';
const PENTA = [0, 3, 5, 7, 10];                       // D minor pentatonic
// i, VI, III, VII in D minor, one chord a bar: root as MIDI note, third in semitones
const CHORDS = [{ root: 38, third: 3 }, { root: 34, third: 4 }, { root: 41, third: 4 }, { root: 36, third: 4 }];
const SFX_LEVEL = 0.62;
const MUSIC_LEVEL = 0.4;

// ---------------------------------------------------------------- pure rules (tested)

/** A note of the pentatonic scale, climbing through the octaves. */
export function pentaNote(i, base = 74) {
    return base + 12 * Math.floor(i / 5) + PENTA[((i % 5) + 5) % 5];
}

/** The machine's tempo from games a second: 58 at a crawl, 128 at factory speed. */
export function bpmFor(gps) {
    if (!(gps > 0)) return 58;
    return Math.max(58, Math.min(128, 58 + 26 * Math.log10(gps / 0.5)));
}

/** 0 below `from`, 1 above `to`, a straight line between. */
export function ramp(x, from, to) {
    return Math.max(0, Math.min(1, (x - from) / (to - from)));
}

/**
 * How much of each layer of the machine should be heard, 0..1, from the state
 * alone. Nothing switches on: every layer creeps in over a stretch of speed,
 * so the music grows with the machine instead of taking steps. (The game
 * itself jumps, from 2.6 to 10 games a second at speed ten; `approach` below
 * turns that jump into a glide in time.)
 *
 * @param {{ gps: number, wins: number, battery: number, gen: number, boards: number }} s
 *        gps = games a second, wins = wins a second, battery and gen 0..1
 */
export function intensitiesFor(s) {
    const alive = s.battery > 0 ? 1 : 0;
    return {
        pulse: ramp(s.gps, 1, 3),                      // the heartbeat
        hat: alive * ramp(s.gps, 2, 6),                // the tick on the eighths
        hat16: alive * ramp(s.gps, 8, 20),             // ...and on the sixteenths between
        bass: alive * ramp(s.gps, 6, 14),
        arp: alive * ramp(s.wins, 3, 8),               // the shimmer that replaces single plings
        arp16: alive * ramp(s.wins, 12, 30),           // ...its sixteenths
        wide: alive * ramp(s.wins, 15, 80),            // ...how far up the scale it reaches
        high: alive * ramp(s.wins, 60, 200),           // ...how often a note is lifted an octave
        pad: alive * (s.boards >= 2 ? 1 : 0),
        hum: alive * (s.gen > 0 ? 0.3 + 0.7 * s.gen : 0),
    };
}

/**
 * One step of a glide: `current` moves toward `target`, closing 63 % of the
 * gap every `tau` seconds.
 */
export function approach(current, target, dt, tau) {
    if (!(tau > 0)) return target;
    return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Saved choices, with everything on as the default. */
export function readPrefs(raw) {
    try {
        const p = JSON.parse(raw || '{}') || {};
        return { sfx: p.sfx !== false, music: p.music !== false };
    } catch {
        return { sfx: true, music: true };
    }
}

// ---------------------------------------------------------------- the graph

let ctx = null, master, sfxBus, musicBus, reverb, noiseBuf, hum = null;
let prefs = { sfx: true, music: true };
const M = { running: false, ended: false, gps: 0, wins: 0, battery: 1, gen: 0, boards: 1, plings: false, step: 0, next: 0, timer: null };
// What is actually heard: the tempo and every layer glide toward what the state
// asks for, so a jump in the game (speed ten, a new board) arrives over seconds.
const LAYERS = ['pulse', 'hat', 'hat16', 'bass', 'arp', 'arp16', 'wide', 'high', 'pad', 'hum'];
const H = { bpm: 58, at: 0 };
LAYERS.forEach((k) => { H[k] = 0; });
const TEMPO_TAU = 3.5;      // seconds
const RISE_TAU = 3;         // a layer creeps in
const FALL_TAU = 0.8;       // and leaves a little quicker (an empty battery should be felt)
let streak = 0, streakAt = 0;

const hasAudio = () => typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    if (!hasAudio()) return false;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); musicBus = ctx.createGain();
    sfxBus.connect(master); musicBus.connect(master);
    // a small synthesised room: decaying noise as the impulse response
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    reverb = ctx.createConvolver(); reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    reverb.connect(wet); wet.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    applyPrefs();
    return true;
}

function applyPrefs() {
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(prefs.sfx ? SFX_LEVEL : 0, ctx.currentTime, 0.03);
    musicBus.gain.setTargetAtTime(prefs.music ? MUSIC_LEVEL : 0, ctx.currentTime, 0.05);
}

/** A gain with a short attack and an exponential decay. */
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
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    n.connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + dur); return n;
}
function send(node, amount) { const s = ctx.createGain(); s.gain.value = amount; node.connect(s); s.connect(reverb); }

// ---------------------------------------------------------------- the words

function playPling(t, midi, level, dest) {
    const f = mtof(midi);
    const g = env(t, 0.2 * level, 0.003, 0.42, dest);
    osc('sine', f, t, t + 0.5, g);
    osc('sine', f * 2.005, t, t + 0.3, env(t, 0.06 * level, 0.003, 0.2, dest));
    osc('sine', f * 3.01, t, t + 0.15, env(t, 0.02 * level, 0.002, 0.09, dest));
    send(g, 0.5);
}

/** A sound may play: there is a context (a click has happened) and sound is on. */
const can = () => prefs.sfx && ensureIfUnlocked();
let unlocked = false;
function ensureIfUnlocked() { return unlocked && ensure(); }

function click() {
    if (!can()) return;
    const t = ctx.currentTime;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    hp.connect(env(t, 0.18, 0.001, 0.035, sfxBus));
    noise(t, 0.05, hp);
    osc('sine', 1900, t, t + 0.04, env(t, 0.05, 0.001, 0.03, sfxBus));
}

/** A win. Wins in a row (within a few seconds of each other) climb the scale. */
function pling() {
    if (!can()) return;
    const now = ctx.currentTime;
    streak = now - streakAt > 8 ? 0 : (streak + 1) % 10;
    streakAt = now;
    // Single plings give way to the machine's shimmer as it creeps in.
    const level = M.running ? 1 - H.arp : 1;
    if (level < 0.08) return;
    playPling(now, pentaNote(streak), level, sfxBus);
}

/** A purchase. */
function thunk() {
    if (!can()) return;
    const t = ctx.currentTime;
    const o = osc('sine', 150, t, t + 0.22, env(t, 0.5, 0.003, 0.16, sfxBus));
    o.frequency.exponentialRampToValueAtTime(58, t + 0.14);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    lp.connect(env(t, 0.22, 0.001, 0.05, sfxBus));
    noise(t, 0.07, lp);
}

/** Something new appears. */
function rise() {
    if (!can()) return;
    const t = ctx.currentTime;
    [0, 2, 5].forEach((n, i) => playPling(t + i * 0.09, pentaNote(n), 0.9, sfxBus));
}

/** The little clover. */
function lucky() {
    if (!can()) return;
    const t = ctx.currentTime;
    playPling(t, pentaNote(3), 0.7, sfxBus);
    playPling(t + 0.07, pentaNote(6), 0.8, sfxBus);
}

/** The battery is empty. */
function knock() {
    if (!can()) return;
    const t = ctx.currentTime;
    [0, 0.13].forEach((d) => {
        const o = osc('sine', 170, t + d, t + d + 0.1, env(t + d, 0.32, 0.002, 0.07, sfxBus));
        o.frequency.exponentialRampToValueAtTime(110, t + d + 0.07);
    });
}

/** A chapter card. Dark cards swell lower and longer. */
function swell(dark = false) {
    if (!can()) return;
    const t = ctx.currentTime;
    const len = dark ? 4.6 : 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + len * 0.53);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    g.connect(sfxBus); send(g, 0.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(dark ? 110 : 160, t);
    lp.frequency.exponentialRampToValueAtTime(dark ? 1200 : 2600, t + len * 0.56);
    lp.connect(g); noise(t, len + 0.1, lp);
    const sub = ctx.createGain(); sub.gain.setValueAtTime(0.0001, t);
    sub.gain.exponentialRampToValueAtTime(0.3, t + len * 0.5); sub.gain.exponentialRampToValueAtTime(0.0001, t + len);
    sub.connect(sfxBus); osc('sine', mtof(dark ? 31 : 38), t, t + len + 0.1, sub);
}

// ---------------------------------------------------------------- the machine

function kick(t, level, soft) {
    const o = osc('sine', soft ? 92 : 118, t, t + 0.3, env(t, 0.55 * level, 0.004, soft ? 0.13 : 0.2, musicBus));
    o.frequency.exponentialRampToValueAtTime(soft ? 52 : 44, t + 0.11);
}
function hat(t, level) {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    hp.connect(env(t, 0.05 * level, 0.001, 0.03, musicBus));
    noise(t, 0.04, hp);
}
function bass(t, midi, dur, level) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    // quiet bass is also darker, so it comes up out of the floor
    lp.frequency.setValueAtTime(350 + 550 * level, t); lp.frequency.exponentialRampToValueAtTime(220, t + Math.max(0.08, dur * 0.8));
    lp.connect(env(t, 0.26 * level, 0.006, Math.max(0.1, dur), musicBus));
    osc('sawtooth', mtof(midi), t, t + dur + 0.2, lp);
    osc('sine', mtof(midi - 12), t, t + dur + 0.2, env(t, 0.16 * level, 0.006, Math.max(0.1, dur), musicBus));
}
function pad(t, chord, dur, voices, level) {
    [0, 7, 12, 12 + chord.third, 19, 24, 24 + chord.third, 31, 36].slice(0, voices).forEach((semi, i) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.028 * level, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
        g.connect(musicBus); send(g, 0.7);
        osc('triangle', mtof(chord.root + 12 + semi), t, t + dur * 1.1, g).detune.value = (i % 2 ? 6 : -6);
    });
}
function arp(t, step, level) {
    const span = 5 + Math.round(5 * H.wide);                          // reaches further up the scale with the rate
    const pattern = [0, 2, 4, 1, 3, 5, 2, 4, 6, 3, 5, 7, 4, 6, 8, 5];
    const lift = Math.random() < H.high ? 5 : 0;                      // more and more notes an octave up
    playPling(t, pentaNote(pattern[step % 16] % span + lift), (0.38 - 0.08 * H.wide) * level, musicBus);
}
function startHum() {
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(musicBus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120; lp.Q.value = 1.2; lp.connect(g);
    const a = ctx.createOscillator(), b = ctx.createOscillator();
    a.type = b.type = 'sawtooth'; a.detune.value = -8; b.detune.value = 8;
    a.frequency.value = b.frequency.value = mtof(26);
    a.connect(lp); b.connect(lp); a.start(); b.start();
    hum = { g, lp, a, b };
}
function updateHum(chord) {
    if (!hum) return;
    const t = ctx.currentTime;
    hum.g.gain.setTargetAtTime(M.running ? Math.max(0.0001, 0.1 * H.hum) : 0.0001, t, 0.25);
    hum.lp.frequency.setTargetAtTime(90 + 520 * M.gen, t, 1.2);
    const f = mtof(chord.root - 12);
    hum.a.frequency.setTargetAtTime(f, t, 0.2); hum.b.frequency.setTargetAtTime(f, t, 0.2);
}

function scheduleStep(step, t) {
    const dur = 60 / H.bpm / 4;
    const s16 = step % 16;
    const even = s16 % 2 === 0;
    const chord = CHORDS[Math.floor(step / 16) % 4];
    const alive = M.battery > 0;
    if (H.pulse > 0.03) {
        if (alive) {
            const heart = (0.45 + 0.55 * Math.min(1, M.battery / 0.25)) * H.pulse;   // a weak battery is a weak heart
            if (s16 === 0 || s16 === 8) kick(t, heart, false);
            if ((s16 === 3 || s16 === 11) && M.battery > 0.12) kick(t, 0.5 * heart, true);
        } else if (s16 === 0) kick(t, 0.35 * H.pulse, true);                         // empty: one faint beat a bar
    }
    if (alive) {
        const hatLevel = H.hat * (even ? 1 : H.hat16);
        if (hatLevel > 0.04) hat(t, (s16 % 4 === 2 ? 1 : 0.55) * hatLevel);
        if (H.bass > 0.03 && (s16 % 4 === 0 || s16 === 6 || s16 === 14)) bass(t, chord.root + (s16 === 6 || s16 === 14 ? 7 : 0), dur * 1.7, H.bass);
        if (H.pad > 0.03 && s16 === 0) pad(t, chord, dur * 16, M.boards, H.pad);
        const arpLevel = H.arp * (even ? 1 : H.arp16);
        if (arpLevel > 0.05) arp(t, step, arpLevel);
        // Bulk play has no single wins to ring; the machine rings them itself, less and less as the shimmer comes in.
        if (M.plings && Math.random() < M.wins * dur * (1 - H.arp)) playPling(t + Math.random() * dur, pentaNote(Math.floor(Math.random() * 5)), 0.8 * (1 - H.arp), musicBus);
    }
    if (s16 % 4 === 0) updateHum(chord);
}
/** Lets what is heard glide toward what the state asks for. */
function glide() {
    const now = ctx.currentTime;
    const dt = Math.min(0.5, Math.max(0, now - H.at));
    H.at = now;
    H.bpm = approach(H.bpm, bpmFor(M.gps), dt, TEMPO_TAU);
    const want = intensitiesFor(M);
    for (const k of LAYERS) H[k] = approach(H[k], want[k], dt, want[k] > H[k] ? RISE_TAU : FALL_TAU);
}
function pump() {
    if (!M.running || !ctx) return;
    glide();
    // A stalled timer (hidden tab) must not play a backlog when it wakes.
    if (M.next < ctx.currentTime - 0.2) M.next = ctx.currentTime + 0.05;
    while (M.next < ctx.currentTime + 0.14) {
        scheduleStep(M.step, M.next);
        M.next += 60 / H.bpm / 4;
        M.step++;
    }
}
function stopMachine() {
    if (!M.running) return;
    M.running = false;
    clearInterval(M.timer); M.timer = null;
    if (hum && ctx) hum.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
}

/**
 * The machine's state, given by the game as often as it likes.
 * `running: false` (or music switched off) stops it.
 *
 * @param {{ running: boolean, gps?: number, wins?: number, battery?: number, gen?: number, boards?: number, plings?: boolean }} s
 *        plings: the machine rings single wins itself (bulk play)
 */
function machine(s) {
    if (!s.running || M.ended || !prefs.music || !ensureIfUnlocked()) { stopMachine(); return; }
    M.gps = s.gps ?? 0; M.wins = s.wins ?? 0;
    M.battery = Math.max(0, Math.min(1, s.battery ?? 1));
    M.gen = Math.max(0, Math.min(1, s.gen ?? 0));
    M.boards = Math.max(1, Math.min(9, Math.round(s.boards ?? 1)));
    M.plings = !!s.plings;
    if (M.running) return;
    applyPrefs();           // the music bus may have been faded out by a finale
    M.running = true; M.step = 0; M.next = ctx.currentTime + 0.06;
    // A start is quiet: the tempo is right at once, the layers come in from nothing.
    H.bpm = bpmFor(M.gps); H.at = ctx.currentTime;
    LAYERS.forEach((k) => { H[k] = 0; });
    if (!hum) startHum();
    M.timer = setInterval(pump, 25);
}

/**
 * The end of a chapter's music: everything falls away at once and a single
 * note is struck, the key's own, and rings out into silence (about seven
 * seconds, so it is gone as the next chapter's name stands on the card).
 * After it the machine stays silent until `begin()`.
 *
 * @returns {boolean} true if the note was played (music is on and sound is allowed)
 */
function finale() {
    M.ended = true;
    if (!prefs.music || !ensureIfUnlocked()) { stopMachine(); return false; }
    const t = ctx.currentTime;
    stopMachine();
    // what is already sounding (voices, hum, tails) goes with the machine
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(0, t, 0.06);
    const out = ctx.createGain(); out.gain.value = MUSIC_LEVEL * 1.6; out.connect(master); send(out, 0.9);
    const f = mtof(62);                                               // D, where the music has been heading all along
    osc('sine', f, t, t + 7.8, env(t, 0.5, 0.006, 7.4, out));
    osc('sine', f / 2, t, t + 5.4, env(t, 0.25, 0.01, 5, out));
    osc('sine', f * 2, t, t + 3.8, env(t, 0.16, 0.004, 3.4, out));
    osc('sine', f * 3.01, t, t + 1.9, env(t, 0.05, 0.003, 1.6, out));
    return true;
}

/** A chapter begins (again): the machine may play. */
function begin() { M.ended = false; }

// ---------------------------------------------------------------- choices and unlocking

function getPrefs() { return { ...prefs }; }
function setPref(name, on) {
    if (name !== 'sfx' && name !== 'music') return;
    prefs[name] = !!on;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    if (name === 'music' && !on) stopMachine();
    applyPrefs();
}

if (typeof window !== 'undefined') {
    try { prefs = readPrefs(localStorage.getItem(PREFS_KEY)); } catch { /* ignore */ }
    const unlock = () => { unlocked = true; ensure(); };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
}

export const audio = { click, pling, thunk, rise, lucky, knock, swell, machine, stopMachine, finale, begin, getPrefs, setPref };
