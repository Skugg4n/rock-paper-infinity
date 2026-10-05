/* eslint-env jest */
// Pass 3 (docs/superpowers/specs/2026-10-05-deep-vault-pass3.md): the soft start (A) and the flesh's
// reason in the night (E), as STOPS that pause the game.
import * as V from './vault.js';
import * as T from './tutorial.js';
import { VAULT_CHECKPOINTS } from './checkpoints.js';

const run = (s, sec, speed = 1) => { for (let t = 0; t < sec; t += 0.25) V.advance(s, 0.25, speed); };
/** Runs until a stop is open (or the time is up). */
const until = (s, sec, speed = 1) => { for (let t = 0; t < sec && !T.stopOpen(s); t += 0.25) V.advance(s, 0.25, speed); return s.tut.stop; };

describe('the soft start (A)', () => {
    test('one thing at a time: welcome, dig, suites, bubbles, each a stop that pauses the game', () => {
        const s = V.newVault();
        expect(V.cards(s)).toEqual([]);
        run(s, 0.25);
        expect(s.tut.stop.id).toBe('welcome');
        expect(s.tut.stop.text).toEqual([T.STOPS.welcome]);
        const day = s.day;
        run(s, 5);
        expect(s.day).toBe(day);                       // paused
        T.closeStop(s);
        expect(until(s, 10).id).toBe('dig');
        const spot = s.tut.stop.focus;
        expect(V.canDig(s, spot)).toBe(true);
        expect(s.request && s.request.text).toBe('16 of us are sleeping on sofas.');
        expect(V.dig(s, spot)).toBe(true);              // doing the thing closes the stop
        expect(s.tut.stop).toBe(null);
        expect(until(s, 20).id).toBe('suites');
        expect(V.cards(s)).toEqual(['suites']);
        expect(V.build(s, 'suites', spot)).toBe(true);
        expect(s.tut.stop).toBe(null);
        expect(s.wishes.list).toHaveLength(0);          // no bubbles before they are taught
        expect(until(s, 30).id).toBe('bubbles');
        T.closeStop(s);
        run(s, 0.5);
        expect(s.wishes.list.length).toBeGreaterThan(0);
        expect(T.shows(s, 'ore')).toBe(false);
        expect(T.goalLine(s)).toBe('GOAL: KEEP THEM HAPPY.');
    });
    test('the cinema stop comes with Mrs Vance, then ORE when it runs short (the Mine card), then POWER', () => {
        const s = V.newVault();
        for (let k = 0; k < 400; k++) {
            const st = until(s, 60, 2);
            if (!st) break;
            if (st.id === 'power') break;
            if (st.id === 'cinema') { expect(V.cards(s)).toContain('cinema'); expect(s.request.who).toBe('Mrs Vance'); }
            if (st.id === 'ore') { expect(V.cards(s)).toContain('mine'); expect(T.shows(s, 'ore')).toBe(true); }
            if (st.id === 'dig') V.dig(s, st.focus);
            else if (st.id === 'suites') V.build(s, 'suites', s.rooms.findIndex((r) => r.kind === 'empty'));
            else if (st.id === 'cinema') {
                // she gets her cinema: a place dug, the room built (and the ore runs short)
                T.closeStop(s);
                const i = s.rooms.findIndex((r, j) => V.canDig(s, j) && V.levelOf(j) === 0);
                V.dig(s, i);
                run(s, 3, 2);
                s.ore = Math.min(s.ore, 200);
                V.build(s, 'cinema', i);
            } else T.closeStop(s);
        }
        for (const id of ['welcome', 'dig', 'suites', 'bubbles', 'cinema', 'ore']) expect(s.tut.done[id]).toBe(true);
    });
    test('an old save without the tutorial loads with the stops behind it done and every card', () => {
        const old = VAULT_CHECKPOINTS['iv-vault-turn']();
        delete old.tut;
        const back = V.deserialize(V.serialize(old));
        expect(back.tut.on).toBe(true);
        for (const id of T.PALACE_STOPS) expect(back.tut.done[id]).toBe(true);
        expect(V.cards(back)).toEqual(expect.arrayContaining(['suites', 'mine', 'cinema', 'gym', 'bar', 'garden', 'game']));
        run(back, 5);
        expect(T.stopOpen(back)).toBe(false);
    });
    test('every checkpoint loads, with the stops behind it skipped', () => {
        for (const [name, make] of Object.entries(VAULT_CHECKPOINTS)) {
            const s = make();
            expect(s.tut.on).toBe(true);
            if (name !== 'iv-vault-start') expect(s.tut.done.welcome).toBe(true);
        }
    });
});

describe('the flesh has a reason (E)', () => {
    test('the cold: the first put to sleep, the pods are fed by the meat lab (with no lab: its card)', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-turn']();
        s.day = 105; s.turned = true; s.coldOpen = true;
        s.rooms[V.slotIndex(1, 6)].kind = 'cryo';
        V.sleepSome(s, 50);
        const st = until(s, 2);
        expect(st.id).toBe('feed');
        expect(st.text).toEqual([T.STOPS.feed, T.STOPS.feedBuild]);
        expect(V.cards(s)).toContain('meatlab');
    });
    test('the night: calm, then Mr Hale; reclaimed he feeds the others; the lab grows by itself; it is warm; the goal; the heart', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-night']();
        expect(s.tut.done.feed).toBe(true);
        expect(T.goalLine(s)).toBe('GOAL: KEEP THEM QUIET.');
        run(s, 40);
        expect(s.dead).toBe(0);                          // G3: a calm opening
        const st = until(s, 20);
        expect(st.id).toBe('hale');
        expect(s.fallen).toEqual(['Mr Hale']);
        const cryo = st.focus;
        const btn = V.actionsFor(s, cryo)[0];
        expect(btn.label).toBe('RECLAIM MR HALE');
        expect(btn.hint).toBe('He feeds the others.');
        V.act(s, 'reclaim', cryo);
        expect(s.tut.stop).toBe(null);
        expect(V.hasVat(s)).toBe(true);
        // nobody fails for a while; then the lab grows into the room beside it by itself
        const grew = until(s, 60);
        expect(grew.id).toBe('grew');
        expect(grew.text).toEqual(T.STOPS.grew);
        expect(s.dead).toBe(1);
        expect(s.warm).toBe(true);
        expect(V.power(s).short).toBe(false);            // warm: POWER from red to blue
        T.closeStop(s);
        const goal = until(s, 2);
        expect(goal.id).toBe('goal');
        expect(V.goal(s).shown).toBe(true);
        expect(T.goalLine(s)).toBe('GOAL: GET THEM TO THE SURFACE.');
        T.closeStop(s);
        expect(until(s, 2).id).toBe('heart');
        expect(s.tut.stop.text).toEqual([T.STOPS.heart]);
    });
});
