/* eslint-env jest */
import { jest } from '@jest/globals';
import {
    energyFor, bpmFor, rollTier, rollMidi, rollCenter, rollPeriod, watcherCents, answeredFor, tuneCents,
    bloodLevel, clackShare, popLevel, lampCount, layersMayPlay, typeSchedule, fromSnapshot, createDeepSound,
    mtof, LETTER_S, BREAK_S,
} from './sound.js';
import { pentaNote } from '../audio.js';

describe('deep sound: the pure rules (no Web Audio here)', () => {
    test('the machine is the tempo: energy from the drive, or from the decades of games a day', () => {
        expect(energyFor({ drive: 0.4, games: 1e9 })).toBe(0.4);
        expect(energyFor({ games: 0 })).toBe(0);
        expect(energyFor({ games: 1e12 })).toBeCloseTo(Math.log10(1 + 1e12) / 12);
        expect(energyFor({ games: 1e30 })).toBe(1);
        expect(energyFor()).toBe(0);
    });

    test('starved it limps slowly, fed it runs; always rising with the energy', () => {
        expect(bpmFor(0)).toBe(46);
        expect(bpmFor(1)).toBeCloseTo(132);
        let prev = -1;
        for (let e = 0; e <= 1.0001; e += 0.1) { const b = bpmFor(e); expect(b).toBeGreaterThan(prev); prev = b; }
        expect(bpmFor(-3)).toBe(46);
        expect(bpmFor(9)).toBeCloseTo(132);
    });

    test('the roll goes one pentatonic step up per cryo tier and sweeps faster', () => {
        expect(rollTier(-1)).toBe(1);
        expect(rollTier(0)).toBe(1);
        expect(rollTier(6)).toBe(7);
        expect(rollTier(7)).toBe(8);
        expect(rollTier(40)).toBe(8);
        for (let t = 1; t <= 8; t++) expect(rollMidi(t)).toBe(pentaNote(t - 1, 74));
        for (let t = 1; t < 8; t++) {
            expect(rollMidi(t + 1)).toBeGreaterThan(rollMidi(t));
            expect(rollPeriod(t + 1)).toBeLessThan(rollPeriod(t));
        }
        expect(rollCenter(1)).toBeCloseTo(mtof(74));
    });

    test('the Watcher is true at full stability and 85 cents flat at nothing', () => {
        expect(watcherCents(1)).toBeCloseTo(0);
        expect(watcherCents(0)).toBeCloseTo(-85);
        expect(watcherCents(0.5)).toBeLessThan(0);
        expect(watcherCents(0.5)).toBeGreaterThan(-85);
        expect(watcherCents(2)).toBeCloseTo(0);          // clamped
        expect(watcherCents(-1)).toBeCloseTo(-85);
    });

    test('The question answered: 0 to 100 % from the biological steps, tuning the metal and bringing the blood', () => {
        expect(answeredFor([])).toBe(0);
        expect(answeredFor(undefined)).toBe(0);
        expect(answeredFor(['watchdog', 'scheduler', 'cooling'])).toBe(0);          // the system and the hardware do not answer it
        expect(answeredFor(['brain'])).toBeCloseTo(0.25);
        expect(answeredFor(['brain', 'nervous'])).toBeCloseTo(0.5);
        expect(answeredFor(['watchdog', 'brain', 'nervous', 'spinal', 'skin'])).toBe(1);
        expect(tuneCents(0)).toBe(50);                   // a quarter tone out
        expect(tuneCents(1)).toBe(0);                    // in tune
        expect(tuneCents(0.5)).toBe(25);
        expect(bloodLevel(0)).toBe(0);
        expect(bloodLevel(0.5)).toBeGreaterThan(0);
        expect(bloodLevel(1)).toBeGreaterThan(bloodLevel(0.5));
        expect(clackShare(0)).toBe(1);
        expect(clackShare(1)).toBe(0);                   // the heart is the pulse and the clack has gone
    });

    test('the murmur is thin from the start and grows with the people; lamps are one per automated room, at most five', () => {
        expect(popLevel(0)).toBe(0);
        expect(popLevel(10)).toBeLessThan(0.3);
        expect(popLevel(1e7)).toBe(1);
        expect(popLevel(1000)).toBeGreaterThan(popLevel(10));
        expect(lampCount(0)).toBe(0);
        expect(lampCount(3)).toBe(3);
        expect(lampCount(12)).toBe(5);
        expect(lampCount(undefined)).toBe(0);
    });

    test('silent when music is off, paused or hidden', () => {
        expect(layersMayPlay({ music: true, paused: false, hidden: false })).toBe(true);
        expect(layersMayPlay({ music: false, paused: false, hidden: false })).toBe(false);
        expect(layersMayPlay({ music: true, paused: true, hidden: false })).toBe(false);
        expect(layersMayPlay({ music: true, paused: false, hidden: true })).toBe(false);
    });

    test("Surface's line: a tick a letter at the game's own pace, a break at each space, the board's pause in the ticks only", () => {
        const s = typeSchedule('ab cdefg', 10);
        // c, d and e fall inside the 110 ms after the space: no tick; f and g are heard
        expect(s.map((e) => e.kind + e.ch)).toEqual(['ticka', 'tickb', 'break ', 'tickf', 'tickg']);
        expect(s[0].t).toBeCloseTo(10);
        expect(s[1].t).toBeCloseTo(10 + LETTER_S);
        const space = 10 + 2 * LETTER_S;
        expect(s[2].t).toBeCloseTo(space);
        const after = typeSchedule('a b cdefg', 0);
        const ticks = after.filter((e) => e.kind === 'tick');
        const spaceT = 1 * LETTER_S;
        for (const e of ticks) if (e.t > spaceT) expect(e.t - spaceT).toBeGreaterThanOrEqual(BREAK_S - 1e-9);
        // the whole line ends when the game's text does: no drift from the pauses
        const text = 'Everyone is sleeping, but us.';
        const all = typeSchedule(text, 0);
        expect(all[all.length - 1].t).toBeLessThanOrEqual((text.length - 1) * LETTER_S + 1e-9);
        // punctuation takes its time but makes no tick
        expect(typeSchedule('a, b', 0).some((e) => e.ch === ',')).toBe(false);
    });

    test('a snapshot from the game becomes the sound\'s numbers, and a part of one changes only its part', () => {
        const p = fromSnapshot({ asleep: true, tempo: { drive: 0.8 }, humans: 1000, cryo: 2, stability: 40, gone: false, lamps: 4, bought: ['brain'] });
        expect(p).toMatchObject({ asleep: true, energy: 0.8, tier: 3, stability: 0.4, gone: false, lamps: 4, answered: 0.25 });
        expect(p.pop).toBeGreaterThan(0);
        expect(Object.keys(fromSnapshot({ asleep: false }))).toEqual(['asleep']);
        expect(fromSnapshot({}).asleep).toBeUndefined();
        expect(fromSnapshot({ stability: NaN }).stability).toBe(1);
    });
});

describe('deep sound: the module with no Web Audio at all', () => {
    test('with no graph (no click yet, or no Web Audio) nothing throws and nothing starts', () => {
        const audio = { graph: () => null, getPrefs: () => ({ sfx: true, music: true }) };
        const s = createDeepSound(audio);
        expect(() => { s.start(); s.setState({ asleep: true }); s.event('buy'); s.event('type', { text: 'hi' }); s.event('goUp'); s.stop(); }).not.toThrow();
        expect(s.state().asleep).toBe(true);
        expect(s.isRunning()).toBe(false);
    });

    test('an audio object that has no graph function at all is no problem either', () => {
        const s = createDeepSound({});
        expect(() => { s.start(); s.event('snap'); s.stop(); }).not.toThrow();
    });
});

// ---- a stubbed AudioContext: the whole graph is built, the loop is run, everything is taken down ----
function stubContext() {
    const made = { nodes: 0, started: 0, stopped: 0 };
    const param = () => ({
        value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
        setTargetAtTime() {}, cancelScheduledValues() {},
    });
    const node = (extra = {}) => {
        made.nodes++;
        const n = {
            connect(d) { return d; }, disconnect() {},
            start() { made.started++; }, stop() { made.stopped++; },
            frequency: param(), gain: param(), detune: param(), Q: param(), pan: param(), delayTime: param(),
            threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
            ...extra,
        };
        return n;
    };
    const ctx = {
        currentTime: 0, sampleRate: 8000, state: 'running',
        createGain: () => node(), createOscillator: () => node(), createBiquadFilter: () => node(),
        createBufferSource: () => node(), createConvolver: () => node(), createDynamicsCompressor: () => node(),
        createDelay: () => node(), createStereoPanner: () => node(),
        createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    };
    return { ctx, made };
}

describe('deep sound: the module on a stubbed AudioContext', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); delete globalThis.window; });

    function rig(prefs = { sfx: true, music: true }) {
        const { ctx, made } = stubContext();
        const buses = { musicBus: node2(), sfxBus: node2() };
        function node2() { return { connect() {}, disconnect() {}, gain: { value: 0, setTargetAtTime() {} } }; }
        const audio = {
            graph: () => ({ ctx, master: node2(), ...buses, reverb: node2(), noiseBuf: { duration: 1 } }),
            getPrefs: () => prefs,
            lucky: jest.fn(),
        };
        return { ctx, made, audio, prefs };
    }
    const run = (ctx, seconds) => { for (let i = 0; i < seconds * 10; i++) { ctx.currentTime += 0.1; jest.advanceTimersByTime(100); } };

    test('it holds the rest of the world back while the chapter card stands, opens it after, and tears down on stop', () => {
        const { ctx, made, audio } = rig();
        let held = true;
        const s = createDeepSound(audio, { isHeld: () => held });
        s.start();
        s.setState({ asleep: false, tempo: { drive: 0.5 }, humans: 100, cryo: 0, stability: 100, lamps: 3, bought: [] });
        run(ctx, 2);
        expect(s.isRunning()).toBe(true);
        expect(s.isOpen()).toBe(false);
        held = false;
        run(ctx, 2);
        expect(s.isOpen()).toBe(true);
        s.event('sleep'); s.event('type', { text: 'Everyone is sleeping, but us.', letterS: 0.035 });
        run(ctx, 3);
        s.event('snap'); s.event('buy'); s.event('rise'); s.event('knock'); s.event('win'); s.event('lose');
        s.event('wake');
        run(ctx, 2);
        expect(made.nodes).toBeGreaterThan(50);
        s.event('unity'); run(ctx, 15);
        s.event('goUp'); run(ctx, 16);
        s.stop();
        run(ctx, 2);
        expect(s.isRunning()).toBe(false);
    });

    test('Music off leaves the layers silent; Sound off leaves the words silent', () => {
        const a = rig({ sfx: true, music: false });
        const s = createDeepSound(a.audio, { isHeld: () => false });
        s.start();
        run(a.ctx, 2);
        expect(s.isRunning()).toBe(false);
        const before = a.made.nodes;
        s.event('buy');
        expect(a.made.nodes).toBeGreaterThan(before);       // the word plays with Sound on and Music off
        s.stop();

        const b = rig({ sfx: false, music: true });
        const q = createDeepSound(b.audio, { isHeld: () => false });
        q.start();
        run(b.ctx, 2);
        expect(q.isRunning()).toBe(true);
        const n = b.made.nodes;
        q.event('buy'); q.event('knock'); q.event('boom'); q.event('win');
        expect(b.made.nodes).toBe(n);                       // Sound off: not a node for a word
        expect(b.audio.lucky).not.toHaveBeenCalled();
        q.stop();
    });

    test('paused or hidden, the layers stop; unpaused, they come back', () => {
        const { ctx, audio } = rig();
        globalThis.window = { __rpiPaused: false };
        const s = createDeepSound(audio, { isHeld: () => false });
        s.start();
        run(ctx, 1);
        expect(s.isRunning()).toBe(true);
        globalThis.window.__rpiPaused = true;
        run(ctx, 1);
        expect(s.isRunning()).toBe(false);
        globalThis.window.__rpiPaused = false;
        run(ctx, 1);
        expect(s.isRunning()).toBe(true);
        s.stop();
    });

    test('the shaft is blown once, when the card has gone, and only on a new descent', () => {
        const { ctx, made, audio } = rig();
        let held = true;
        const s = createDeepSound(audio, { isHeld: () => held });
        s.start(); s.event('descent');
        run(ctx, 2);
        const before = made.nodes;
        held = false;
        run(ctx, 0.3);
        expect(made.nodes - before).toBeGreaterThan(40);    // the boom and its stones
        s.stop();
    });
});
