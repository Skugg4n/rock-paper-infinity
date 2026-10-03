/**
 * Chapter IV · THE DEEP: the sound (deep-sound). Lifted from the sound board Ola approved
 * (docs/mockups/sound-board-deep.html) and hung on the same Web Audio graph as chapters I and II
 * (src/audio.js: the buses, the Sound and Music choices in the ☰ menu, the first-click unlocking).
 * Everything is synthesised; nothing is loaded. The game's rules are not touched: this file is told
 * what index.js already knows (`setState`) and what just happened (`event`).
 *
 * Two worlds, and they must sound like two:
 * - AWAKE has a pulse and people. The machine on the lid is the tempo (a clack per throw, a pling
 *   on a win, pitch drooping when starved, a whirr when fed), under it the cable hum (low D and A),
 *   drips in the shaft and a thin murmur that grows with the people.
 * - ASLEEP is the same world heard under water (one shared low-pass, one slow compressor), the
 *   pulse gone. In come the roll of the years (rising noise, a pentatonic step up per cryo tier),
 *   the lamps (sparse tones, one per automated room, out of step) and the Watcher: a held D that
 *   sinks flat with stability, beating against a true pilot tone; a snap is a thunk and the tone
 *   jumping back true.
 * - SURFACE types in struck metal a quarter tone outside the scale, with short metallic breaks at
 *   the spaces. As The question is answered (the biological steps bought) the ticks come into
 *   tune and the blood comes in: a low rush with a slow heartbeat on the machine's two pounds per
 *   bar, growing until it is the pulse and the clack has faded.
 * - The words: thunk (a purchase), rise (Surface opens a node), knock (an alarm), boom (the shaft
 *   blown, once), swell, and the two endings.
 *
 * HAND-OVER FROM III: the war's drone falls from E♭ two octaves to D over the IV card and stops.
 * This module starts at phase init with ONLY the low D of the cable hum, quiet, and opens the rest
 * after the chapter card has gone (`opts.isHeld`). The IV card plays no swell: the war owns it.
 *
 * Rules: Sound and Music follow the ☰ choices exactly as in the other chapters; silent when paused
 * (`window.__rpiPaused`) or hidden; nothing starts before the first click; few oscillators, shared
 * filters, no per-frame allocation; `stop()` takes everything down.
 */

import { pentaNote, ramp, approach } from '../audio.js';
import { LADDER } from './watcher.js';
import { FED_DECADES } from './machine.js';

// ---------------------------------------------------------------- the board's numbers
const MURMUR_NOTES = [50, 53, 55, 57, 60];               // D3 F3 G3 A3 C4
const LAMP_NOTES = [62, 65, 69, 72, 74];                 // D F A C D: the lamps sit in the chord
const LAMP_EVERY = [3.3, 4.7, 5.9, 4.1, 7.1];            // seconds, so they never line up
const LAMP_PAN = [-0.6, -0.25, 0.15, 0.5, 0.75];
const VOWELS = [[700, 1100], [450, 800], [400, 1600], [320, 870], [550, 1700]];
/** The game types a letter every 35 ms (surface.js TYPE_MS). */
export const LETTER_S = 0.035;
/** The board adds this at each space, for the metallic break; here it is silence in the ticks only. */
export const BREAK_S = 0.11;
// levels, set by the board's offline level check
const CLACK = 4.5, POUND = 1.05, MUR = 0.18, ROLL = 0.55, LAMP = 0.055, WATCH = 0.03, SURF = 1.6, WHOOSH = 0.45, HEART = 0.32, HUM = 0.042;
/** The board's music bus stood at 0.75; the game's stands at 0.4 (src/audio.js MUSIC_LEVEL). */
const LEVEL = 0.75 / 0.4;
const LAYERS = ['machine', 'hum', 'drips', 'murmur', 'roll', 'lamps', 'watcher', 'surface', 'blood'];
const ROUTE = { machine: 'world', hum: 'world', drips: 'world', murmur: 'world', roll: 'night', lamps: 'night', watcher: 'night', surface: 'front', blood: 'front' };
const SEND = { machine: 0.55, hum: 0.2, drips: 1.3, murmur: 0.6, roll: 0.35, lamps: 0.9, watcher: 0.5, surface: 0.35, blood: 0.2 };
/** The biological rung of the Watcher's ladder: the steps that answer The question. */
const BIO_IDS = LADDER.filter((u) => u.rung === 2).map((u) => u.id);
/** Ending lengths, seconds. */
const END_LEN = { up: 14, unity: 11.5 };

// ---------------------------------------------------------------- pure rules (tested)
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

/**
 * The energy the machine is fed, 0..1: the drive of machine.js (the decades of games a day and
 * the share it may draw, the very number that stands the arms up), or, with games a day alone,
 * their decades out of FED_DECADES.
 * @param {{drive?:number, games?:number}} [o]
 */
export function energyFor({ drive, games } = {}) {
    if (Number.isFinite(drive)) return clamp(drive);
    return clamp(Math.log10(1 + Math.max(0, games || 0)) / FED_DECADES);
}
/** The machine's tempo (throws a minute) from the energy it is fed: slow and limping starved, a whirr fed. */
export const bpmFor = (e) => 46 + 86 * Math.pow(clamp(e), 0.9);
/** The tier of the roll, 1..8, from the colony's cryo tier (-1 no hall, 0 Cryo I ... 7 Long count). */
export const rollTier = (cryo) => clamp(Math.floor(Number.isFinite(cryo) ? cryo : 0) + 1, 1, 8);
/** The roll's note (MIDI): one step up the pentatonic scale per cryo tier. */
export const rollMidi = (tier) => pentaNote(clamp(Math.round(tier), 1, 8) - 1, 74);
export const rollCenter = (tier) => mtof(rollMidi(tier));
/** Seconds a sweep of the roll takes: faster with every tier. */
export const rollPeriod = (tier) => 2.4 / Math.pow(1.36, clamp(tier, 1, 8) - 1);
/** The Watcher's tone drifts flat as stability falls: 0 cents at full, -85 at nothing. `stab` is 0..1. */
export const watcherCents = (stab) => -85 * Math.pow(1 - clamp(stab), 1.15);
/** How much of The question is answered, 0..1: the biological steps bought out of all of them. */
export function answeredFor(bought) {
    const have = new Set(Array.isArray(bought) ? bought : []);
    return BIO_IDS.length ? BIO_IDS.filter((id) => have.has(id)).length / BIO_IDS.length : 0;
}
/** How far the Surface's metal is out of tune, in cents: a quarter tone (50), none when answered. */
export const tuneCents = (answered) => 50 * (1 - clamp(answered));
/** The blood's rush on its layer, 0..: grows with the answer. */
export const bloodLevel = (answered) => 0.6 * WHOOSH * Math.pow(clamp(answered), 1.3);
/** What is left of the machine's clack and pound once the heart takes the pulse, 1..0. */
export const clackShare = (answered) => 1 - clamp(answered);
/** The people as a 0..1 level for the murmur (a log scale: ten people already murmur, a million is full). */
export const popLevel = (humans) => ramp(Math.log10(1 + Math.max(0, humans || 0)), 0.8, 6);
/** One lamp tone per automated room, at most as many as the board has voices. */
export const lampCount = (n) => clamp(Math.floor(n || 0), 0, LAMP_NOTES.length);
/** Whether the layers may sound at all. */
export const layersMayPlay = ({ music, paused, hidden }) => !!music && !paused && !hidden;

/**
 * Surface's line as the sound plays it: a tick at every letter's own time (the game's pace, so the
 * sound never falls behind the text), a metallic break at each space, and the board's 110 ms pause
 * after it as silence in the ticks (the text itself is not slowed).
 * @param {string} text
 * @param {number} t0 - seconds
 * @param {number} [letterS]
 * @returns {{t:number, ch:string, kind:'tick'|'break'}[]}
 */
export function typeSchedule(text, t0 = 0, letterS = LETTER_S) {
    const out = [];
    let pauseUntil = -Infinity;
    let i = 0;
    for (const ch of String(text)) {
        const t = t0 + i * letterS;
        i++;
        if (ch === ' ') { out.push({ t, ch, kind: 'break' }); pauseUntil = t + BREAK_S; continue; }
        if (t < pauseUntil - 1e-9) continue;
        if (/[a-z0-9]/i.test(ch)) out.push({ t, ch, kind: 'tick' });
    }
    return out;
}

/**
 * What index.js knows, as the sound's own numbers. Only the keys present are returned, so a caller
 * may hand a part of a snapshot.
 * @param {{asleep?:boolean, tempo?:object, games?:number, humans?:number, cryo?:number, stability?:number,
 *          gone?:boolean, lamps?:number, bought?:string[]}} snap - stability is the meter, 0..100
 */
export function fromSnapshot(snap = {}) {
    const p = {};
    if ('asleep' in snap) p.asleep = !!snap.asleep;
    if ('tempo' in snap || 'games' in snap) p.energy = energyFor({ drive: snap.tempo ? snap.tempo.drive : undefined, games: snap.games });
    if ('humans' in snap) p.pop = popLevel(snap.humans);
    if ('cryo' in snap) p.tier = rollTier(snap.cryo);
    if ('stability' in snap) p.stability = clamp((Number.isFinite(snap.stability) ? snap.stability : 100) / 100);
    if ('gone' in snap) p.gone = !!snap.gone;
    if ('lamps' in snap) p.lamps = lampCount(snap.lamps);
    if ('bought' in snap) p.answered = answeredFor(snap.bought);
    return p;
}

// ---------------------------------------------------------------- the engine
/**
 * @param {{ graph?: Function, getPrefs?: Function, lucky?: Function }} audio - src/audio.js's `audio`
 * @param {{ isHeld?: () => boolean }} [opts] - true while the chapter card stands over the deep
 * @returns {{ start: Function, stop: Function, setState: Function, event: Function, state: Function }}
 */
export function createDeepSound(audio, opts = {}) {
    const isHeld = opts.isHeld || (() => false);
    const S = { energy: 0.3, asleep: false, tier: 1, stability: 1, answered: 0, pop: 0.15, lamps: 3, gone: false, ending: null };
    const H = { e: S.energy, a: 0, bpm: bpmFor(S.energy), at: 0 };                  // what is heard, gliding toward S
    const T = { next: Infinity, step: 0, drip: Infinity, roll: Infinity, lamps: [], talk: [] };
    let G = null, ctx = null, built = false;
    let wanted = false, running = false, open = false, timer = null, disposeTimer = null;
    let endAt = Infinity, streak = 0, streakAt = -10, arm = 0, snapHold = 0;
    let pendingDescent = false, typing = null;
    let layerOut, duck, wordsOut, shaft, wordRev, noiseBuf;
    let worldIn, dry, wetSend, waterLP, wobG, nightIn, makeup, echoIn;
    let hum, whirr, talkers, watch, roll, blood;
    const bus = {}, inp = {}, sources = [], last = new Map();

    const prefs = () => (audio.getPrefs ? audio.getPrefs() : { sfx: true, music: true });
    const isPaused = () => typeof window !== 'undefined' && !!window.__rpiPaused;
    const isHidden = () => typeof document !== 'undefined' && !!document.hidden;

    // ---------------------------------------------------------------- the graph
    function build() {
        const { musicBus, sfxBus } = G;
        ctx = G.ctx; noiseBuf = G.noiseBuf;
        layerOut = ctx.createGain(); layerOut.gain.value = 0.0001; layerOut.connect(musicBus);
        duck = ctx.createGain(); duck.connect(layerOut);
        wordsOut = ctx.createGain(); wordsOut.connect(sfxBus);

        // The shaft: a long dark room with a few early echoes off the walls. One impulse, two rooms
        // (one for the music layers, one for the words, so each follows its own on/off).
        const sr = ctx.sampleRate, len = Math.floor(sr * 4.2);
        const ir = ctx.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
            const d = ir.getChannelData(ch);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) * Math.min(1, i / (sr * 0.03));
            [0.11, 0.23, 0.37, 0.52].forEach((s, k) => { const at = Math.floor(sr * (s + ch * 0.013)); for (let i = 0; i < 300; i++) d[at + i] += (Math.random() * 2 - 1) * 0.7 * Math.pow(0.7, k) * (1 - i / 300); });
        }
        shaft = ctx.createConvolver(); shaft.buffer = ir;
        wordRev = ctx.createConvolver(); wordRev.buffer = ir;
        const wordRevOut = ctx.createGain(); wordRevOut.gain.value = 0.3; wordRev.connect(wordRevOut); wordRevOut.connect(wordsOut);

        // Under water: the world is heard dry, or through one low-pass and a slow compressor.
        worldIn = ctx.createGain();
        dry = ctx.createGain(); dry.gain.value = 1; worldIn.connect(dry); dry.connect(duck);
        wetSend = ctx.createGain(); wetSend.gain.value = 0.0001; worldIn.connect(wetSend);
        waterLP = filter('lowpass', 3200, 0.9); wetSend.connect(waterLP);
        const slow = ctx.createDynamicsCompressor();
        slow.threshold.value = -36; slow.knee.value = 18; slow.ratio.value = 10; slow.attack.value = 0.3; slow.release.value = 1;
        waterLP.connect(slow);
        nightIn = ctx.createGain();
        const nightLP = filter('lowpass', 2600, 0.5); nightIn.connect(nightLP); nightLP.connect(slow);
        // The compressor adds its own makeup gain; this takes it back so the night is quieter than the day.
        makeup = ctx.createGain(); makeup.gain.value = 0.4; slow.connect(makeup); makeup.connect(duck);
        const wob = track(ctx.createOscillator()); wob.frequency.value = 0.21;                // the water moves the filter a little
        wobG = ctx.createGain(); wobG.gain.value = 0.0001; wob.connect(wobG); wobG.connect(waterLP.frequency); wob.start();
        const revOut = ctx.createGain(); revOut.gain.value = 0.3; shaft.connect(revOut); revOut.connect(worldIn);   // the shaft is under water at night too

        // The shaft's echo, for the boom and the alarm: a delay that feeds back through a dark filter.
        echoIn = ctx.createGain(); echoIn.gain.value = 0.7;
        const dly = ctx.createDelay(1); dly.delayTime.value = 0.29;
        const elp = filter('lowpass', 1100);
        const fb = ctx.createGain(); fb.gain.value = 0.42;
        const echoOut = ctx.createGain(); echoOut.gain.value = 0.55;
        echoIn.connect(dly); dly.connect(elp); elp.connect(fb); fb.connect(dly); elp.connect(echoOut); echoOut.connect(wordsOut);

        // Per layer: sources -> inp (arrives, leaves, sleeps) -> bus -> world / night / front.
        for (const name of LAYERS) {
            const g = ctx.createGain();
            g.connect(ROUTE[name] === 'world' ? worldIn : ROUTE[name] === 'night' ? nightIn : duck);
            const s = ctx.createGain(); s.gain.value = SEND[name]; g.connect(s); s.connect(shaft);
            const i = ctx.createGain(); i.gain.value = 0.0001; i.connect(g);
            bus[name] = g; inp[name] = i;
        }
        buildVoices();
        built = true;
    }

    function track(src) { sources.push(src); return src; }
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
    /** A send into the shaft for the layers, or into the words' shaft. */
    function send(node, amount) { const s = ctx.createGain(); s.gain.value = amount; node.connect(s); s.connect(shaft); }
    function sendW(node, amount) { const s = ctx.createGain(); s.gain.value = amount; node.connect(s); s.connect(wordRev); }
    function loopNoise(dest) { const n = track(ctx.createBufferSource()); n.buffer = noiseBuf; n.loop = true; n.connect(dest); n.start(); return n; }
    function formants(dest, f1, f2) {
        const a = filter('bandpass', f1, 5, dest);
        const bg = ctx.createGain(); bg.gain.value = 0.6; bg.connect(dest);
        const b = filter('bandpass', f2, 7, bg);
        return [a, b];
    }
    /** Every continuous value glides; the same target twice adds nothing to the timeline. */
    function glideTo(param, value, tau, t = ctx.currentTime) {
        const prev = last.get(param);
        if (prev !== undefined && Math.abs(prev - value) <= Math.abs(value) * 0.002 + 1e-5) return;
        last.set(param, value);
        param.setTargetAtTime(value, t, tau);
    }

    // ---------------------------------------------------------------- continuous voices
    function buildVoices() {
        // Cable hum: a low D and the A over it, thicker with the energy; a slow breath in it.
        // Before the card has gone only the low D stands (the A waits in its own gain).
        {
            const g = ctx.createGain(); g.gain.value = HUM; g.connect(inp.hum);
            const lp = filter('lowpass', 300, 1.1, g);
            const d = track(ctx.createOscillator()), a = track(ctx.createOscillator());
            d.type = a.type = 'sawtooth'; d.frequency.value = mtof(38); a.frequency.value = mtof(45); d.detune.value = -4; a.detune.value = 5;
            const aG = ctx.createGain(); aG.gain.value = 0.0001; a.connect(aG); aG.connect(lp);
            d.connect(lp);
            const sub = track(ctx.createOscillator()); sub.frequency.value = mtof(26);
            const sg = ctx.createGain(); sg.gain.value = 0.6; sub.connect(sg); sg.connect(g);
            const lfo = track(ctx.createOscillator()); lfo.frequency.value = 0.13;
            const lg = ctx.createGain(); lg.gain.value = HUM * 0.25; lfo.connect(lg); lg.connect(g.gain);
            [d, a, sub, lfo].forEach((o) => o.start());
            hum = { lp, aG };
        }
        // The machine's whirr: fed, it spins up and lands on D; starved, it droops flat and fades.
        {
            const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(inp.machine);
            const lp = filter('lowpass', 600, 2, g);
            const a = track(ctx.createOscillator()), b = track(ctx.createOscillator());
            a.type = b.type = 'sawtooth'; a.frequency.value = b.frequency.value = mtof(50); b.detune.value = 7;
            a.connect(lp); b.connect(lp); a.start(); b.start();
            whirr = { g, lp, a, b };
        }
        // The murmur: three thin talkers, syllables on formant filters.
        talkers = [0, 1, 2].map((i) => {
            const vg = ctx.createGain(); vg.gain.value = 0.0001; vg.connect(pan(-0.6 + 0.6 * i, inp.murmur));
            const [a, b] = formants(vg, ...VOWELS[i]);
            const o = track(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = mtof(MURMUR_NOTES[i]); o.detune.value = [-8, 5, 0][i];
            o.connect(a); o.connect(b); o.start();
            return { o, a, b, vg, note: MURMUR_NOTES[i], left: 0 };
        });
        // The Watcher: a held D. The octave partial beats against the pilot lamp (a true D) as it drifts.
        {
            const acc = ctx.createGain(); acc.gain.value = 1; acc.connect(inp.watcher);
            const g = ctx.createGain(); g.gain.value = WATCH; g.connect(acc);
            const lp = filter('lowpass', 1500, 0.6, g);
            const a = track(ctx.createOscillator()); a.type = 'triangle'; a.frequency.value = mtof(62); a.connect(lp);
            const b = track(ctx.createOscillator()); b.frequency.value = mtof(74);
            const bg = ctx.createGain(); bg.gain.value = 0.45; b.connect(bg); bg.connect(lp);
            const lfo = track(ctx.createOscillator()); lfo.frequency.value = 0.09;           // unstable: it wanders as well as sinks
            const wg = ctx.createGain(); wg.gain.value = 0.0001; lfo.connect(wg); wg.connect(a.detune); wg.connect(b.detune);
            [a, b, lfo].forEach((o) => o.start());
            watch = { acc, a, b, wg };
            const pg = ctx.createGain(); pg.gain.value = LAMP * 0.22; pg.connect(inp.lamps);
            const pilot = track(ctx.createOscillator()); pilot.frequency.value = mtof(74); pilot.connect(pg); pilot.start();
        }
        // The roll of the years: noise in a band that sweeps upward, again and again, faster each tier.
        {
            const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(inp.roll);
            const bp = filter('bandpass', rollCenter(1), 5, g);
            loopNoise(bp);
            const whine = track(ctx.createOscillator()); whine.frequency.value = rollCenter(1);
            const wg = ctx.createGain(); wg.gain.value = 0.012; whine.connect(wg); wg.connect(g); whine.start();
            roll = { g, bp, whine };
        }
        // The blood: a low rush that swells after each heartbeat.
        {
            const base = ctx.createGain(); base.gain.value = 0.0001; base.connect(inp.blood);
            const pulse = ctx.createGain(); pulse.gain.value = 1; pulse.connect(base);
            const lp = filter('lowpass', 220, 0.7, pulse);
            const hiss = ctx.createGain(); hiss.gain.value = 0.12; hiss.connect(pulse);
            const bp = filter('bandpass', 900, 1.2, hiss);
            const src = loopNoise(lp); src.connect(bp);
            blood = { base, pulse, lp };
        }
    }

    // ---------------------------------------------------------------- the machine
    function clack(t, level, pf) {
        const p = pan([-0.45, 0, 0.45][arm++ % 3], inp.machine);                          // three arms on a hub
        const b1 = filter('bandpass', 1800 * pf, 3); b1.connect(env(t, 0.24 * level * CLACK, 0.004, 0.03, p)); noise(t, 0.05, b1);
        const b2 = filter('bandpass', 2900 * pf, 4); b2.connect(env(t + 0.011, 0.12 * level * CLACK, 0.004, 0.025, p)); noise(t + 0.011, 0.045, b2);
        osc('sine', 420 * pf, t, t + 0.08, env(t, 0.07 * level, 0.004, 0.045, p));
    }
    /** The hub's pound: low, heavy, a little clank of iron in it. */
    function pound(t, level, pf) {
        const dest = inp.machine, k = level * POUND;
        const o = osc('sine', 130 * pf, t, t + 0.5, env(t, 0.6 * k, 0.004, 0.3, dest)); o.frequency.exponentialRampToValueAtTime(46 * pf, t + 0.1);
        const tr = osc('triangle', 260 * pf, t, t + 0.25, env(t, 0.12 * k, 0.004, 0.15, dest)); tr.frequency.exponentialRampToValueAtTime(92 * pf, t + 0.1);
        [[1, 0.05], [1.58, 0.03], [2.33, 0.015]].forEach(([r, a]) => osc('sine', 180 * pf * r, t, t + 0.2, env(t, a * k, 0.003, 0.14, dest)));
        const lp = filter('lowpass', 280); lp.connect(env(t, 0.25 * k, 0.004, 0.06, dest)); noise(t, 0.1, lp);
    }
    /** Chapter I's pling (src/audio.js). */
    function pling(t, midi, level, dest) {
        const f = mtof(midi);
        const g = env(t, 0.2 * level, 0.003, 0.42, dest);
        osc('sine', f, t, t + 0.5, g);
        osc('sine', f * 2.005, t, t + 0.3, env(t, 0.06 * level, 0.003, 0.2, dest));
        osc('sine', f * 3.01, t, t + 0.15, env(t, 0.02 * level, 0.002, 0.09, dest));
        send(g, 0.5);
    }
    /** A win: the star. Wins close together climb the pentatonic as in I; starved, they are dull. */
    function win(t, e) {
        streak = t - streakAt > 3 ? 0 : (streak + 1) % 8;
        streakAt = t;
        const lp = filter('lowpass', 1400 + 5000 * e, 0.5, inp.machine);
        pling(t, pentaNote(streak), 0.55 * (0.5 + 0.5 * (1 - H.a)), lp);
    }
    /** A heartbeat, lub and dub; the rush swells behind it. */
    function heart(t, a, beatLen, dest = inp.blood, pulse = true) {
        const lvl = HEART * Math.pow(a, 0.8), gap = Math.min(0.32, 0.5 * beatLen);
        [[0, 1, 64, 40], [gap, 0.62, 72, 44]].forEach(([d, k, f0, f1]) => {
            const o = osc('sine', f0, t + d, t + d + 0.45, env(t + d, lvl * k, 0.006, 0.26, dest)); o.frequency.exponentialRampToValueAtTime(f1, t + d + 0.12);
            const tr = osc('triangle', f0 * 2, t + d, t + d + 0.2, env(t + d, 0.12 * lvl * k, 0.006, 0.12, dest)); tr.frequency.exponentialRampToValueAtTime(f1 * 2, t + d + 0.1);
            const lp = filter('lowpass', 160); lp.connect(env(t + d, 0.3 * lvl * k, 0.006, 0.08, dest)); noise(t + d, 0.12, lp);
        });
        if (pulse) { blood.pulse.gain.setTargetAtTime(2.6, t + 0.04, 0.06); blood.pulse.gain.setTargetAtTime(1, t + gap + 0.15, 0.35); }
    }
    function step(n, t) {
        const s16 = n % 16, beatLen = 60 / H.bpm, e = H.e, mech = clackShare(H.a);
        if (!S.asleep && !S.ending && open) {
            const pf = 0.55 + 0.45 * e;                                                    // starved, everything sinks
            const lurch = e < 0.3 ? (0.3 - e) / 0.3 : 0;                                   // ...and limps
            if (s16 % 8 === 0 && mech > 0.03) pound(t, (s16 === 0 ? 1 : 0.8) * mech * (0.6 + 0.4 * e), pf);
            if (s16 % 4 === 0) {
                const at = t + lurch * Math.random() * 0.25 * beatLen;
                if (mech > 0.03) clack(at, mech, pf);
                if (Math.random() < 1 / 3) win(at + 0.03, e);                              // a third of the throws are wins
            } else if (s16 % 2 === 0) { const k = ramp(e, 0.35, 0.6) * mech; if (k > 0.05) clack(t, 0.55 * k, pf); }
            else { const k = ramp(e, 0.7, 0.95) * mech; if (k > 0.05) clack(t, 0.3 * k, pf); }
        }
        // the heart beats on the machine's pounds, awake or asleep: it becomes the pulse
        if (open && s16 % 8 === 0 && H.a > 0.03 && (!S.ending || S.ending === 'unity')) heart(t, H.a, beatLen);
    }

    // ---------------------------------------------------------------- drips, murmur, the night
    function drip(t) {
        const f = mtof(pentaNote(5 + Math.floor(Math.random() * 6), 74));
        const p = pan(Math.random() * 1.6 - 0.8, inp.drips);
        const o = osc('sine', f * 0.8, t, t + 0.2, env(t, 0.05, 0.004, 0.12, p)); o.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.035);
        const lo = osc('sine', f / 4, t, t + 0.15, env(t, 0.06, 0.004, 0.08, p)); lo.frequency.exponentialRampToValueAtTime((f / 4) * 1.4, t + 0.03);   // the plop survives the water
    }
    /** One syllable of one talker (or the pause between phrases); returns the time to the next. */
    function syllable(t, i) {
        const v = talkers[i];
        if (S.asleep || S.ending || !open) return 0.5;
        if (v.left <= 0) {
            v.left = 3 + Math.floor(Math.random() * 6);
            v.note = MURMUR_NOTES[Math.floor(Math.random() * MURMUR_NOTES.length)];
            v.o.frequency.setTargetAtTime(mtof(v.note), t, 0.05);
            v.vg.gain.setTargetAtTime(0.0001, t, 0.1);
            return lerp(0.5, 1.8, Math.random());
        }
        v.left--;
        // thin from the start, fuller with the people
        const dur = lerp(0.09, 0.24, Math.random()), peak = lerp(0.35, 1, Math.random()) * MUR * (0.3 + 0.7 * H.p);
        const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
        v.a.frequency.setTargetAtTime(f1, t, 0.03); v.b.frequency.setTargetAtTime(f2, t, 0.03);
        v.o.frequency.setTargetAtTime(mtof(v.note) * lerp(0.97, 1.04, Math.random()), t, 0.06);
        v.vg.gain.setTargetAtTime(peak, t, 0.025);
        v.vg.gain.setTargetAtTime(0.06 * MUR, t + dur, 0.05);
        return dur + lerp(0.04, 0.16, Math.random());
    }
    function lamp(t, i) {
        const f = mtof(LAMP_NOTES[i]), p = pan(LAMP_PAN[i], inp.lamps);
        osc('sine', f, t, t + 2.6, env(t, LAMP, 0.06, 2.4, p));
        osc('sine', f * 2.005, t, t + 1.2, env(t, LAMP * 0.18, 0.05, 1.0, p));
        osc('sine', f * 3.01, t, t + 0.6, env(t, LAMP * 0.06, 0.04, 0.5, p));
    }
    function rollSweep(t, P) {
        const C = rollCenter(S.tier), L = ROLL * (0.8 + 0.06 * S.tier);
        for (const prm of [roll.bp.frequency, roll.whine.frequency]) { prm.setValueAtTime(C * 0.6, t); prm.exponentialRampToValueAtTime(C, t + P * 0.94); }
        roll.g.gain.setValueAtTime(0.3 * L, t); roll.g.gain.linearRampToValueAtTime(L, t + P * 0.85); roll.g.gain.linearRampToValueAtTime(0.3 * L, t + P * 0.99);
    }
    /** The breath drawn when the colony goes under and when it comes up. A word: it follows Sound. */
    function breath(t, under) {
        const bp = filter('bandpass', under ? 1400 : 300, 1.4);
        bp.frequency.setValueAtTime(under ? 1400 : 300, t);
        bp.frequency.exponentialRampToValueAtTime(under ? 220 : 1600, t + (under ? 1.6 : 0.9));
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(under ? 0.12 : 0.1, t + (under ? 0.3 : 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + (under ? 1.7 : 1.0));
        bp.connect(g); g.connect(wordsOut); sendW(g, 0.5); noise(t, 1.8, bp);
    }

    // ---------------------------------------------------------------- the Surface
    /** A struck-metal letter, a quarter tone outside the scale; answered, it moves into tune and softens. */
    function letterTick(t, ch, a) {
        const dest = inp.surface;
        const code = ch.toLowerCase().charCodeAt(0);
        const midi = pentaNote((code * 7) % 10, 62) + tuneCents(a) / 100;
        const f = mtof(midi), decay = lerp(0.08, 0.3, a);
        [[2.76, 2], [5.4, 3], [8.93, 4]].map(([m, h]) => lerp(m, h, a)).concat([1]).forEach((r, i) => {
            const amp = [0.035, 0.018, 0.008, 0.07][i];
            osc('sine', f * r, t, t + decay + 0.05, env(t, amp * SURF, 0.002, decay * (r === 1 ? 1 : 0.8), dest));
        });
        if (a < 0.95) { const bp = filter('bandpass', Math.min(7000, f * 4), 1.5); bp.connect(env(t, 0.08 * (1 - a) * SURF, 0.002, 0.012, dest)); noise(t, 0.02, bp); }
    }
    /** Between the words: a short cluster of detuned metal partials. Answered, it is lower and softer. */
    function metalBreak(t, a) {
        const dest = inp.surface, n = 3 + Math.floor(Math.random() * 3), k = 1 - 0.85 * a;
        let at = t;
        for (let i = 0; i < n; i++) {
            const f = lerp(1300, 3800, Math.random()) * lerp(1, 0.5, a), dec = lerp(0.05, 0.09, Math.random());
            [[1, 0.05], [1.031, 0.04], [2.41, 0.02], [3.93, 0.01]].forEach(([r, amp]) => osc('sine', f * r, at, at + dec + 0.04, env(at, amp * k * SURF, 0.001, dec, dest)));
            at += lerp(0.018, 0.032, Math.random());
        }
    }
    /** Plays what of Surface's line is due before `until`; letters whose time went by unheard are dropped. */
    function playTyping(now, until) {
        if (!typing) return;
        const q = typing;
        while (q.i < q.sched.length && q.sched[q.i].t < until) {
            const e = q.sched[q.i++];
            if (e.t < now - 0.03) continue;
            if (e.kind === 'break') metalBreak(e.t + 0.01, H.a); else letterTick(e.t, e.ch, H.a);
        }
        if (q.i >= q.sched.length) typing = null;
    }

    // ---------------------------------------------------------------- the words in IV
    /** thunk: a relay closing; at full tissue, a wet knock. In between, both. */
    function thunk(t, tissue = S.answered) {
        const relay = 1 - tissue, wet = tissue;
        if (relay > 0.02) {
            [[0, 1], [0.009, 0.45], [0.02, 0.2]].forEach(([d, k]) => { const hp = filter('highpass', 2600); hp.connect(env(t + d, 0.2 * k * relay, 0.004, 0.018, wordsOut)); noise(t + d, 0.03, hp); });
            const o = osc('sine', 150, t, t + 0.22, env(t, 0.42 * relay, 0.003, 0.14, wordsOut)); o.frequency.exponentialRampToValueAtTime(58, t + 0.12);   // chapter I's thunk
            [[1, 0.025], [2.76, 0.012]].forEach(([r, a]) => osc('sine', 1900 * r, t, t + 0.1, env(t, a * relay, 0.002, 0.06, wordsOut)));
        }
        if (wet > 0.02) {
            const g = ctx.createGain(); g.connect(wordsOut); sendW(g, 0.25);
            const o = osc('sine', 120, t, t + 0.4, env(t, 0.5 * wet, 0.008, 0.22, g)); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
            const bp = filter('bandpass', 1100, 4); bp.frequency.setValueAtTime(1100, t); bp.frequency.exponentialRampToValueAtTime(170, t + 0.13);
            bp.connect(env(t, 0.9 * wet, 0.006, 0.13, g)); noise(t, 0.16, bp);
            const q = osc('sine', 300, t + 0.02, t + 0.15, env(t + 0.02, 0.06 * wet, 0.006, 0.08, g)); q.frequency.exponentialRampToValueAtTime(140, t + 0.12);
        }
    }
    /** The Watcher's tone jumps back true; it holds a moment, then sinks to where stability stands. */
    function snapTone(t) {
        snapHold = t + 0.45;
        for (const prm of [watch.a.detune, watch.b.detune]) { prm.cancelScheduledValues(t); last.delete(prm); }
        watch.wg.gain.cancelScheduledValues(t); last.delete(watch.wg.gain);
        watch.acc.gain.cancelScheduledValues(t); watch.acc.gain.setTargetAtTime(2.4, t + 0.015, 0.01); watch.acc.gain.setTargetAtTime(1, t + 0.1, 0.5);
        apply();
    }
    /** rise: Surface opens a node. Chapter I's three notes, in its metal, bending from a quarter tone off into tune. */
    function rise(t) {
        [0, 2, 5].forEach((n, i) => {
            const at = t + i * 0.11, f = mtof(pentaNote(n, 74));
            const out = ctx.createGain(); out.connect(wordsOut); sendW(out, 0.8);
            [[1, 0.13], [2.76, 0.04], [5.4, 0.015]].forEach(([r, a]) => {
                const o = osc('sine', f * r * Math.pow(2, 0.5 / 12), at, at + 1.1, env(at, a, 0.003, 0.95 * (r === 1 ? 1 : 0.6), out));
                o.frequency.setValueAtTime(f * r * Math.pow(2, 0.5 / 12), at + 0.05);
                o.frequency.exponentialRampToValueAtTime(f * r, at + 0.3);
            });
        });
    }
    /** knock: the alarm. Chapter I's two muted knocks, twice, on a pipe, up the shaft. */
    function knock(t) {
        const out = ctx.createGain(); out.connect(wordsOut); out.connect(echoIn); sendW(out, 0.9);
        [0, 0.16, 0.75, 0.91].forEach((d) => {
            const o = osc('sine', 170, t + d, t + d + 0.12, env(t + d, 0.34, 0.003, 0.08, out)); o.frequency.exponentialRampToValueAtTime(110, t + d + 0.07);
            osc('sine', 340, t + d, t + d + 0.5, env(t + d, 0.04, 0.003, 0.42, out));
            osc('sine', 340 * 2.76, t + d, t + d + 0.2, env(t + d, 0.012, 0.003, 0.15, out));
        });
    }
    /** boom: the shaft blown, once. Chapter I's heavy boom, its echo up the shaft, stones after it. */
    function boom(t) {
        const tail = 3.6;
        const out = ctx.createGain(); out.gain.value = 0.6; out.connect(wordsOut); out.connect(echoIn); sendW(out, 1.1);
        const body = osc('sine', 110, t, t + tail + 0.2, env(t, 0.9, 0.004, tail, out)); body.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        const over = osc('triangle', 220, t, t + tail * 0.6, env(t, 0.22, 0.004, tail * 0.5, out)); over.frequency.exponentialRampToValueAtTime(60, t + 0.5);
        const lp = filter('lowpass', 900, 0.7); lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(70, t + tail * 0.8);
        lp.connect(env(t, 0.5, 0.003, tail * 0.9, out)); noise(t, tail + 0.1, lp);
        const hp = filter('highpass', 1800); hp.connect(env(t, 0.25, 0.004, 0.06, out)); noise(t, 0.08, hp);
        const stones = Array.from({ length: 12 }, () => 0.35 + Math.random() * 2.8).sort((a, b) => a - b);
        stones.forEach((d, i) => {
            const k = 1 - i / 14, at = t + d;
            const bp = filter('bandpass', lerp(600, 2500, Math.random()), 2); bp.connect(env(at, 0.14 * k, 0.004, 0.03, out)); noise(at, 0.05, bp);
            const s = osc('sine', 90, at, at + 0.15, env(at, 0.1 * k, 0.004, 0.1, out)); s.frequency.exponentialRampToValueAtTime(50, at + 0.08);
        });
        duck.gain.cancelScheduledValues(t);
        duck.gain.setTargetAtTime(0.15, t, 0.02);
        duck.gain.setTargetAtTime(1, t + 0.9, 1.0);
    }
    /** swell: a chapter card. The dark swell of src/audio.js, and the war's E♭ falling two octaves to D.
     *  Not wired to the IV card (the war owns that moment); kept for the board's word. */
    function swell(t) {
        const len = 4.6;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + len * 0.53); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        g.connect(wordsOut); sendW(g, 0.6);
        const lp = filter('lowpass', 110, 0.8, g); lp.frequency.setValueAtTime(110, t); lp.frequency.exponentialRampToValueAtTime(1200, t + len * 0.56);
        noise(t, len + 0.1, lp);
        const sub = ctx.createGain(); sub.gain.setValueAtTime(0.0001, t); sub.gain.exponentialRampToValueAtTime(0.3, t + len * 0.5); sub.gain.exponentialRampToValueAtTime(0.0001, t + len);
        sub.connect(wordsOut); osc('sine', mtof(31), t, t + len + 0.1, sub);
        const f0 = t + 0.4;
        const fg = ctx.createGain(); fg.gain.setValueAtTime(0.0001, f0); fg.gain.linearRampToValueAtTime(0.26, f0 + 0.8); fg.gain.setValueAtTime(0.26, f0 + 4.6); fg.gain.exponentialRampToValueAtTime(0.0001, f0 + 11);
        fg.connect(wordsOut); sendW(fg, 0.9);
        const flp = filter('lowpass', 900, 0.6, fg);
        [[1, 'triangle', 0.8], [1, 'sine', 1], [2, 'sine', 0.2]].forEach(([m, type, a]) => {
            const vg = ctx.createGain(); vg.gain.value = a; vg.connect(flp);
            const o = osc(type, mtof(51) * m, f0, f0 + 11.2, vg);
            o.frequency.setValueAtTime(mtof(51) * m, f0 + 1.2);
            o.frequency.exponentialRampToValueAtTime(mtof(26) * m, f0 + 5.8);
        });
        osc('sine', mtof(38), f0 + 5.8, f0 + 11.5, env(f0 + 5.8, 0.12, 0.6, 5, wordsOut));
    }

    // ---------------------------------------------------------------- the two endings
    function endingOut() { const g = ctx.createGain(); g.connect(duck); send(g, 0.7); return g; }
    function formantVoice(t, midi, vowel, panFrom, panTo, until, dest) {
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        let p = dest;
        if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.setValueAtTime(panFrom, t); p.pan.linearRampToValueAtTime(panTo, until); p.connect(dest); }
        g.connect(p);
        const [a, b] = formants(g, ...vowel);
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(midi), t); o.connect(a); o.connect(b);
        o.start(t); o.stop(until + 0.1);
        return { g, o, a, b };
    }
    function setEnding(kind, t) {
        S.ending = kind; S.asleep = false; typing = null;
        endAt = t + END_LEN[kind];
        apply();
    }
    /** The people go up: the murmur climbs the shaft and leaves the low D alone below. */
    function goUp(t, voices = true) {
        setEnding('up', t);
        const out = endingOut();
        if (voices) {
            MURMUR_NOTES.forEach((m, i) => {
                const s = t + i * 0.3, climb = 5 + i * 0.7, end = s + climb;
                const v = formantVoice(t, m, VOWELS[i], (i - 2) * 0.15, (i - 2) * 0.42, end, out);
                v.g.gain.linearRampToValueAtTime(MUR * 0.4, s + 0.6); v.g.gain.setValueAtTime(MUR * 0.4, s + climb * 0.45); v.g.gain.linearRampToValueAtTime(0.0001, end);
                v.o.frequency.setValueAtTime(mtof(m), s + 0.3); v.o.frequency.exponentialRampToValueAtTime(mtof(m + 24 + (i % 2) * 5), end);
                for (const f of [v.a.frequency, v.b.frequency]) { f.setValueAtTime(f.value, s + 0.3); f.exponentialRampToValueAtTime(f.value * 1.6, end); }
            });
            const wbp = filter('bandpass', 250, 2); wbp.frequency.setValueAtTime(250, t); wbp.frequency.exponentialRampToValueAtTime(2600, t + 8);   // a draught up the shaft
            const wg = ctx.createGain(); wg.gain.setValueAtTime(0.0001, t); wg.gain.linearRampToValueAtTime(0.05, t + 3); wg.gain.linearRampToValueAtTime(0.0001, t + 8.5);
            wbp.connect(wg); wg.connect(out); noise(t, 8.6, wbp);
        }
        const D = t + 1.2;
        [[38, 'sine', 0.17], [38, 'triangle', 0.03], [26, 'sine', 0.08], [50, 'sine', 0.02]].forEach(([m, type, amp]) => {
            const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, D); g.gain.linearRampToValueAtTime(amp, D + 2.5); g.gain.setValueAtTime(amp, D + 6.5); g.gain.exponentialRampToValueAtTime(0.0001, D + 13);
            g.connect(out); osc(type, mtof(m), D, D + 13.1, g);
        });
    }
    /** Unity: every voice lands on the same low D, in unison, the heartbeat under it. */
    function unity(t) {
        const wasPulsing = open && running && H.a > 0.03;
        setEnding('unity', t);
        const out = endingOut(), D = mtof(38);
        const notes = [50, 53, 55, 57, 60, 62, 45];
        notes.forEach((m, i) => {
            const s = t + 0.15 * i, land = t + 2.6 + 0.35 * i;
            const v = formantVoice(t, m, VOWELS[i % 4], (i / (notes.length - 1)) * 1.4 - 0.7, 0, t + 12, out);
            v.g.gain.linearRampToValueAtTime(MUR * 0.55, s + 1); v.g.gain.setValueAtTime(MUR * 0.55, t + 8.5); v.g.gain.linearRampToValueAtTime(0.0001, t + 12);
            v.o.detune.setValueAtTime((i % 2 ? 1 : -1) * (6 + 2 * i), t); v.o.detune.linearRampToValueAtTime(0, land + 2.5);   // the beating slows to nothing
            v.o.frequency.setValueAtTime(mtof(m), s + 0.5); v.o.frequency.exponentialRampToValueAtTime(D, land);
            v.a.frequency.setTargetAtTime(450, land, 0.8); v.b.frequency.setTargetAtTime(800, land, 0.8);                   // one vowel
        });
        // the Watcher comes down to it, and the Surface's metal, in tune now, joins
        const wg = ctx.createGain(); wg.gain.setValueAtTime(0.0001, t); wg.gain.linearRampToValueAtTime(WATCH, t + 1); wg.gain.setValueAtTime(WATCH, t + 8.5); wg.gain.linearRampToValueAtTime(0.0001, t + 12);
        wg.connect(out);
        const w = osc('triangle', mtof(62), t, t + 12.1, wg); w.frequency.setValueAtTime(mtof(62), t + 1); w.frequency.exponentialRampToValueAtTime(D, t + 5.5);
        [1, 2, 3, 4].forEach((h, i) => {
            const amp = [0.05, 0.025, 0.012, 0.006][i];
            const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + 3.5); g.gain.linearRampToValueAtTime(amp, t + 5); g.gain.setValueAtTime(amp, t + 8.5); g.gain.linearRampToValueAtTime(0.0001, t + 12);
            g.connect(out); osc('sine', D * h, t + 3.5, t + 12.1, g);
        });
        const sub = ctx.createGain(); sub.gain.setValueAtTime(0.0001, t + 3); sub.gain.linearRampToValueAtTime(0.12, t + 5); sub.gain.setValueAtTime(0.12, t + 8.5); sub.gain.linearRampToValueAtTime(0.0001, t + 12);
        sub.connect(out); osc('sine', mtof(26), t + 3, t + 12.1, sub);
        // the heart is the machine's own while the pulse runs; without one, the ending brings its own
        if (!wasPulsing) for (let k = 0; k < 10; k++) heart(t + 0.4 + k * 1.05, 1 - k * 0.06, 1, out, false);
    }

    // ---------------------------------------------------------------- the clock
    function pump(until) {
        const now = ctx.currentTime;
        if (now > endAt) {
            endAt = Infinity;
            if (S.ending === 'unity') S.ending = null;       // the colony goes on with its heart; the other ending is the last sound
            apply();
        }
        if (snapHold && now >= snapHold) { snapHold = 0; apply(); }
        const dt = clamp(now - H.at, 0, 0.5); H.at = now;
        H.e = approach(H.e, S.energy, dt, 2.0);
        H.a = approach(H.a, S.answered, dt, 1.5);
        H.p = approach(H.p, S.pop, dt, 3.0);
        H.bpm = approach(H.bpm, bpmFor(S.energy), dt, 2.5);
        // a stalled timer plays no backlog
        if (T.next < now - 0.3) T.next = now + 0.05;
        for (const k of ['drip', 'roll']) if (T[k] < now - 0.3) T[k] = now + 0.05;
        for (const arr of [T.lamps, T.talk]) arr.forEach((v, i) => { if (v < now - 0.3) arr[i] = now + 0.05 + Math.random() * 0.5; });
        if (open) {
            while (T.next < until) { step(T.step, T.next); T.next += 60 / H.bpm / 4; T.step++; }
            while (T.drip < until) { if (!S.ending) drip(T.drip); T.drip += lerp(1.2, 4.5, Math.random()); }
            while (T.roll < until) { const P = rollPeriod(S.tier); if (S.asleep && !S.ending) rollSweep(T.roll, P); T.roll += P; }
            T.lamps.forEach((v, i) => { while (T.lamps[i] < until) { if (S.asleep && !S.ending && i < S.lamps) lamp(T.lamps[i], i); T.lamps[i] += LAMP_EVERY[i] * lerp(0.85, 1.15, Math.random()); } });
            T.talk.forEach((v, i) => { while (T.talk[i] < until) T.talk[i] += syllable(T.talk[i], i); });
        }
        playTyping(now, until);
    }

    function apply() {
        if (!built) return;
        const t = ctx.currentTime;
        const live = running, end = !!S.ending, sl = S.asleep, e = S.energy, a = S.answered;
        const gate = {
            machine: live && open && !sl && !end,
            hum: live && !end,
            drips: live && open && !end,
            murmur: live && open && !sl && !end,
            roll: live && open && sl && !end,
            lamps: live && open && sl && !end,
            watcher: live && open && sl && !end && !S.gone,
            surface: true,
            blood: live && open && (!end || S.ending === 'unity'),
        };
        for (const name of LAYERS) glideTo(inp[name].gain, gate[name] ? (name === 'hum' && !open ? 0.45 : 1) : 0.0001, gate[name] ? 1.1 : 0.7, t);
        glideTo(hum.aG.gain, open ? 1 : 0.0001, 1.8, t);
        // under water: the world crossfades into the filtered, compressed path (about 1.5 s either way)
        const under = sl && live && open;
        glideTo(dry.gain, under ? 0.0001 : 1, 0.7, t);
        glideTo(wetSend.gain, under ? 1 : 0.0001, 0.7, t);
        glideTo(waterLP.frequency, under ? 420 : 3200, 0.9, t);
        glideTo(wobG.gain, under ? 80 : 0.0001, 1.5, t);
        // the machine's whirr lands on D when fed, droops flat when starved; it gives way to the heart
        const wf = mtof(50) * (0.62 + 0.38 * e);
        glideTo(whirr.a.frequency, wf, 2.0, t); glideTo(whirr.b.frequency, wf, 2.0, t);
        glideTo(whirr.lp.frequency, 250 + 1400 * e, 1.5, t);
        glideTo(whirr.g.gain, 0.0001 + 0.05 * ramp(e, 0.45, 1) * clackShare(a), 1.5, t);
        glideTo(hum.lp.frequency, 160 + 520 * e, 1.5, t);
        // the Watcher sinks and wanders as stability falls; a snap holds it true for a moment
        const held = t < snapHold;
        const cents = held ? 0 : watcherCents(S.stability);
        glideTo(watch.a.detune, cents, held ? 0.012 : 2.2, t); glideTo(watch.b.detune, cents, held ? 0.012 : 2.2, t);
        glideTo(watch.wg.gain, held ? 0.0001 : 0.0001 + 14 * (1 - S.stability), held ? 0.02 : 2.0, t);
        // the blood grows with the answer
        glideTo(blood.base.gain, 0.0001 + bloodLevel(a), 1.5, t);
        glideTo(blood.lp.frequency, 200 + 260 * a, 1.5, t);
    }

    // ---------------------------------------------------------------- start, stop, the loop
    function graphNow() {
        if (G) return G;
        const g = audio.graph ? audio.graph() : null;          // null until the first click
        if (!g || !g.ctx) return null;
        G = g;
        build();
        return G;
    }
    function begin() {
        const t = ctx.currentTime;
        running = true;
        for (const name of LAYERS) if (name !== 'surface') { inp[name].gain.cancelScheduledValues(t); inp[name].gain.setValueAtTime(0.0001, t); }
        last.clear();
        T.next = t + 0.08; T.step = 0; T.drip = t + 1; T.roll = t + 0.1;
        T.lamps = LAMP_EVERY.map((p, i) => t + 0.6 + i * 0.9);
        T.talk = [0, 1, 2].map((i) => t + 1 + i * 0.4);
        H.e = S.energy; H.a = S.answered; H.p = S.pop; H.bpm = bpmFor(S.energy); H.at = t;
        layerOut.gain.cancelScheduledValues(t);
        layerOut.gain.setTargetAtTime(LEVEL, t, 0.6);
        apply();
    }
    function halt() {
        if (!running) return;
        running = false;
        typing = null;
        layerOut.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.35);
        apply();
    }
    function tick() {
        if (!wanted) return;
        if (!graphNow()) return;                              // no click yet
        const play = layersMayPlay({ music: prefs().music, paused: isPaused(), hidden: isHidden() });
        if (play && !running) begin();
        if (!play && running) halt();
        // the card has gone: the rest of the awake world opens, and the shaft that was blown is heard
        if (!open && !isHeld()) {
            open = true;
            T.next = ctx.currentTime + 0.1;
            apply();
            if (pendingDescent) { pendingDescent = false; word('boom'); }
        }
        if (running) pump(ctx.currentTime + 0.4);
    }
    /** A word, if there is a graph and Sound is on and the game is running. */
    function word(name, data) {
        if (!graphNow() || !prefs().sfx || isPaused() || isHidden()) return;
        const t = ctx.currentTime;
        switch (name) {
        case 'buy': thunk(t, S.answered); break;
        case 'seal': thunk(t, 1); break;
        case 'rise': rise(t); break;
        case 'knock': knock(t); break;
        case 'boom': boom(t); break;
        case 'swell': swell(t); break;
        case 'snap': thunk(t, S.answered); break;
        case 'win': if (audio.lucky) audio.lucky(); break;
        case 'lose': if (running) metalBreak(t, H.a); break;
        case 'breath': breath(t, !!(data && data.under)); break;
        default: break;
        }
    }

    function start() {
        wanted = true;
        if (disposeTimer) { clearTimeout(disposeTimer); disposeTimer = null; }
        if (!timer) timer = setInterval(tick, 60);
    }
    /** Takes everything down: the loop, the voices, our part of the graph. */
    function stop() {
        wanted = false;
        if (timer) { clearInterval(timer); timer = null; }
        if (!built) return;
        halt();
        const dispose = () => {
            disposeTimer = null;
            if (wanted) return;
            for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } }
            sources.length = 0;
            try { layerOut.disconnect(); wordsOut.disconnect(); } catch { /* ignore */ }
            built = false; running = false; open = false; typing = null; G = null; last.clear();
            for (const k of Object.keys(bus)) delete bus[k];
            for (const k of Object.keys(inp)) delete inp[k];
        };
        // a word still ringing (the V card's hand-over) is let go by the bus; the layers fade first
        disposeTimer = setTimeout(dispose, 600);
    }

    /** What index.js knows, a whole snapshot or a part of one (see fromSnapshot). */
    function setState(snap) {
        const p = fromSnapshot(snap);
        const was = S.asleep;
        Object.assign(S, p);
        if (built && 'asleep' in p && p.asleep !== was && running && open && !S.ending) {
            if (!S.asleep) typing = null;
            word('breath', { under: S.asleep });
        }
        apply();
    }
    /** Something happened in the game. See `word` for the names; plus 'sleep', 'wake', 'type', 'descent', 'goUp', 'unity', 'fade'. */
    function event(name, data) {
        switch (name) {
        case 'sleep': setState({ asleep: true }); break;
        case 'wake': setState({ asleep: false }); break;
        case 'type':
            if (data && data.text && graphNow()) {
                typing = { sched: typeSchedule(data.text, ctx.currentTime + 0.05, data.letterS || LETTER_S), i: 0 };
            }
            break;
        case 'snap':
            if (graphNow()) snapTone(ctx.currentTime);
            word('snap');
            break;
        case 'descent': pendingDescent = true; break;
        case 'goUp': if (graphNow()) goUp(ctx.currentTime); break;
        case 'fade': if (graphNow()) goUp(ctx.currentTime, false); break;
        case 'unity': if (graphNow()) unity(ctx.currentTime); break;
        default: word(name, data);
        }
    }

    return {
        start, stop, setState, event,
        state: () => ({ ...S }),
        heard: () => ({ ...H }),
        isOpen: () => open,
        isRunning: () => running,
    };
}
