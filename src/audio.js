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
/** Above this many wins a second single plings fuse into the shimmer. */
export const PLING_LIMIT = 5;

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

/**
 * Which layers of the machine play, from the state alone.
 *
 * @param {{ gps: number, wins: number, battery: number, gen: number, boards: number }} s
 *        gps = games a second, wins = wins a second, battery and gen 0..1
 */
export function layersFor(s) {
    const alive = s.battery > 0;
    return {
        pulse: s.gps >= 3,
        hat: alive && s.gps >= 3,
        bass: alive && s.gps >= 10,
        arp: alive && s.wins >= PLING_LIMIT,
        pad: alive && s.boards >= 2,
        hum: alive && s.gen > 0,
    };
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
const M = { running: false, gps: 0, wins: 0, battery: 1, gen: 0, boards: 1, plings: false, step: 0, next: 0, timer: null };
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
    playPling(now, pentaNote(streak), 1, sfxBus);
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
function bass(t, midi, dur) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(220, t + Math.max(0.08, dur * 0.8));
    lp.connect(env(t, 0.26, 0.006, Math.max(0.1, dur), musicBus));
    osc('sawtooth', mtof(midi), t, t + dur + 0.2, lp);
    osc('sine', mtof(midi - 12), t, t + dur + 0.2, env(t, 0.16, 0.006, Math.max(0.1, dur), musicBus));
}
function pad(t, chord, dur, voices) {
    [0, 7, 12, 12 + chord.third, 19, 24, 24 + chord.third, 31, 36].slice(0, voices).forEach((semi, i) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.028, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
        g.connect(musicBus); send(g, 0.7);
        osc('triangle', mtof(chord.root + 12 + semi), t, t + dur * 1.1, g).detune.value = (i % 2 ? 6 : -6);
    });
}
function arp(t, step, wins) {
    const span = wins > 60 ? 10 : wins > 20 ? 8 : 5;                  // brighter and wider with the rate
    const pattern = [0, 2, 4, 1, 3, 5, 2, 4, 6, 3, 5, 7, 4, 6, 8, 5];
    playPling(t, pentaNote(pattern[step % 16] % span + (wins > 120 ? 5 : 0)), wins > 60 ? 0.3 : 0.38, musicBus);
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
function updateHum(L, chord) {
    if (!hum) return;
    const t = ctx.currentTime;
    hum.g.gain.setTargetAtTime(L.hum && M.running ? 0.03 + 0.07 * M.gen : 0.0001, t, 0.25);
    hum.lp.frequency.setTargetAtTime(90 + 520 * M.gen, t, 0.3);
    const f = mtof(chord.root - 12);
    hum.a.frequency.setTargetAtTime(f, t, 0.2); hum.b.frequency.setTargetAtTime(f, t, 0.2);
}

function scheduleStep(step, t) {
    const dur = 60 / bpmFor(M.gps) / 4;
    const s16 = step % 16;
    const chord = CHORDS[Math.floor(step / 16) % 4];
    const L = layersFor(M);
    const alive = M.battery > 0;
    if (L.pulse) {
        if (alive) {
            const heart = 0.45 + 0.55 * Math.min(1, M.battery / 0.25);   // a weak battery is a weak heart
            if (s16 === 0 || s16 === 8) kick(t, heart, false);
            if ((s16 === 3 || s16 === 11) && M.battery > 0.12) kick(t, 0.5 * heart, true);
        } else if (s16 === 0) kick(t, 0.35, true);                       // empty: one faint beat a bar
    }
    if (alive) {
        if (L.hat && (M.gps >= 10 || s16 % 2 === 0)) hat(t, s16 % 4 === 2 ? 1 : 0.55);
        if (L.bass && (s16 % 4 === 0 || s16 === 6 || s16 === 14)) bass(t, chord.root + (s16 === 6 || s16 === 14 ? 7 : 0), dur * 1.7);
        if (L.pad && s16 === 0) pad(t, chord, dur * 16, M.boards);
        if (L.arp && (M.wins >= 20 || s16 % 2 === 0)) arp(t, step, M.wins);
        // Bulk play has no single wins to ring; below the shimmer the machine rings them itself.
        if (M.plings && !L.arp && Math.random() < M.wins * dur) playPling(t + Math.random() * dur, pentaNote(Math.floor(Math.random() * 5)), 0.8, musicBus);
    }
    if (s16 === 0 || s16 === 8) updateHum(L, chord);
}
function pump() {
    if (!M.running || !ctx) return;
    // A stalled timer (hidden tab) must not play a backlog when it wakes.
    if (M.next < ctx.currentTime - 0.2) M.next = ctx.currentTime + 0.05;
    while (M.next < ctx.currentTime + 0.14) {
        scheduleStep(M.step, M.next);
        M.next += 60 / bpmFor(M.gps) / 4;
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
    if (!s.running || !prefs.music || !ensureIfUnlocked()) { stopMachine(); return; }
    M.gps = s.gps ?? 0; M.wins = s.wins ?? 0;
    M.battery = Math.max(0, Math.min(1, s.battery ?? 1));
    M.gen = Math.max(0, Math.min(1, s.gen ?? 0));
    M.boards = Math.max(1, Math.min(9, Math.round(s.boards ?? 1)));
    M.plings = !!s.plings;
    if (M.running) return;
    M.running = true; M.step = 0; M.next = ctx.currentTime + 0.06;
    if (!hum) startHum();
    M.timer = setInterval(pump, 25);
}

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

export const audio = { click, pling, thunk, rise, lucky, knock, swell, machine, stopMachine, getPrefs, setPref };
