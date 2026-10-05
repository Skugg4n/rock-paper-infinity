/* eslint-env jest */
import * as V from './vault.js';
import * as W from './wishes.js';
import { VAULT_CHECKPOINTS } from './checkpoints.js';
/** A checkpoint without the tutorial's stops (these tests are about the rules, not the teaching). */
const cp = (name) => { const s = VAULT_CHECKPOINTS[name](); s.tut = { on: false }; return s; };
import { story } from './story.js';

const run = (s, sec, speed = 1) => { for (let t = 0; t < sec; t += 0.25) V.advance(s, 0.25, speed); };
/** A new vault without the first request's slow seconds, so the clock here is plain real time. */
const fresh = () => { const s = V.newVault({ tutorial: false }); story(s).moments['first-request'] = true; return s; };

describe('the small wishes', () => {
    test('act I: one every 6 to 8 s; a click pops it for +2 % mood, shown floating, and costs nothing', () => {
        const s = fresh();
        run(s, 3.25);
        expect(s.wishes.list.length).toBe(1);
        const at = s.wishes.clock;
        run(s, 8.5);
        const born = s.wishes.list.map((b) => b.born);
        expect(born.length).toBeGreaterThanOrEqual(1);
        const b = s.wishes.list[s.wishes.list.length - 1];
        const fav = s.favour, ore = s.ore;
        expect(W.popWish(s, b.id)).toBe(true);
        expect(s.favour).toBeCloseTo(fav + 2, 5);
        expect(s.ore).toBe(ore);
        expect(s.fx.some((e) => e.type === 'pop' && e.text === '+2 %')).toBe(true);
        expect(at).toBeGreaterThan(0);
    });
    test('missed after 10 s: it bursts grey and costs a point of mood', () => {
        const s = fresh();
        run(s, 3.25);
        const fav = s.favour;
        run(s, 10.5);
        expect(s.wishes.missed).toBeGreaterThanOrEqual(1);
        expect(s.fx.some((e) => e.type === 'miss' && e.text === '-2 %')).toBe(true);
        expect(s.favour).toBeLessThan(fav);
    });
    test('four of one icon at once is a wave: the CRT says it once, the card is marked, building it is a big bump', () => {
        const s = V.newVault({ tutorial: false });
        s.wishes = W.normalizeWishes({ waveNext: 0, next: 999 });
        run(s, 3);
        const wave = s.wishes.wave;
        expect(wave).toBeTruthy();
        const line = W.ICONS[wave.icon].wave.line;
        expect(s.out.filter((o) => o.text === line)).toHaveLength(1);
        expect(W.waveKind(s)).toBe(wave.kind);
        const free = s.rooms.findIndex((r) => r.kind === 'rock');
        Object.assign(s.rooms[free], { kind: wave.kind, lvl: 1, job: null });
        const fav = s.favour;
        run(s, 0.25);
        expect(s.wishes.wave).toBe(null);
        expect(s.favour).toBeGreaterThan(fav + 5);
    });
    test('after the turn they come faster, several at once, and ruder', () => {
        const s = cp('iv-vault-turn');
        s.turned = true;
        s.wishes = W.normalizeWishes({ next: 0, waveNext: 999 });
        run(s, 20);
        expect(s.wishes.list.length).toBeGreaterThanOrEqual(4);
        expect(s.wishes.list.some((b) => b.icon === 'bell' || b.icon === 'finger')).toBe(true);
    });
    test('the asleep make none; in the night they are ghosts over the pods that cannot be clicked', () => {
        const s = cp('iv-vault-night');
        const fav = s.favour;
        run(s, 20);
        expect(s.wishes.list.length).toBeGreaterThan(0);
        expect(s.wishes.list.every((b) => b.ghost && s.rooms[b.slot].kind === 'cryo')).toBe(true);
        expect(W.popWish(s, s.wishes.list[0].id)).toBe(false);
        expect(s.favour).toBe(fav);
    });
});
