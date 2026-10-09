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
        // H1: the first failing pod is Mr Hale's, a stop; a click saves him
        const p41 = until(s, 20);
        expect(p41.id).toBe('pod41');
        expect(p41.text).toEqual([T.STOPS.pod41]);
        expect(V.savePod(s, p41.pod)).toBe(true);
        expect(s.tut.stop).toBe(null);
        expect(s.talk.some((b) => b.text === 'Mr Hale sleeps on.')).toBe(true);
        // later three fail at once and one is beyond reach: the first dead, and the meat lab's stop
        for (let t = 0; t < 120 && !T.stopOpen(s); t += 0.25) { for (const f of [...(s.failing || [])]) if (s.wishes.clock - f.born > 1.5) V.savePod(s, f.id); V.advance(s, 0.25, 1); }
        const st = s.tut.stop;
        expect(st.id).toBe('hale');
        expect(st.text).toEqual(['The meat lab cannot feed them all.']);
        expect(s.dead).toBe(1);
        const cryo = st.focus;
        const btn = V.actionsFor(s, cryo).find((a) => a.id === 'reclaim');
        expect(btn.hint).toBe('They feed the others.');
        V.act(s, 'reclaim', cryo);
        expect(s.tut.stop).toBe(null);
        expect(V.hasVat(s)).toBe(true);
        // nobody fails for a while; then the lab grows into the room beside it by itself
        let grew = null;
        for (let t = 0; t < 60 && !grew; t += 0.25) { for (const f of [...(s.failing || [])]) V.savePod(s, f.id); V.advance(s, 0.25, 1); grew = s.tut.stop; }
        expect(grew.id).toBe('grew');
        expect(grew.text).toEqual(T.STOPS.grew);
        expect(s.warm).toBe(true);
        expect(V.power(s).short).toBe(false);            // warm: POWER from red to blue
        T.closeStop(s);
        const goal = until(s, 2);
        expect(goal.id).toBe('goal');
        // H2: the mission, typed line by line
        expect(goal.typed).toBe(true);
        expect(goal.text[0]).toBe('THE SURFACE WILL NOT RECOVER.');
        expect(goal.text[goal.text.length - 1]).toBe('AT ANY COST.');
        expect(V.goal(s).shown).toBe(true);
        expect(T.goalLine(s)).toBe('MISSION: GET THEM TO THE SURFACE. ALIVE.');
        T.closeStop(s);
        expect(until(s, 2).id).toBe('heart');
        expect(s.tut.stop.text).toEqual([T.STOPS.heart]);
    });
});

describe('after the fourth test', () => {
    test('the turn is a stop, and the Cryo Bay card slides in with it', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-turn']();
        s.tut.done.turn = false;
        const st = until(s, 30);
        expect(st.id).toBe('turn');
        expect(st.text).toEqual(T.STOPS.turn);
        expect(V.cards(s)).toContain('cryo');
        expect(s.tut.newCard).toBe('cryo');
    });
    test('the ORE stop comes by day 20 at the latest', () => {
        const s = V.newVault();
        for (let k = 0; k < 60; k++) {
            const st = until(s, 60, 2);
            if (!st) break;
            if (st.id === 'ore') break;
            if (st.id === 'dig') V.dig(s, st.focus);
            else if (st.id === 'suites') V.build(s, 'suites', s.rooms.findIndex((r) => r.kind === 'empty'));
            else T.closeStop(s);
        }
        expect(s.tut.stop && s.tut.stop.id).toBe('ore');
        expect(s.day).toBeLessThanOrEqual(T.ORE_BY_DAY + 1);
    });
    test('rock the body cannot reach says what is missing; no ore stops the engine, said once', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        s.tut = { on: false };
        // a room on level 1 over a floor that is not body yet: make one rock
        const rock = V.slotIndex(0, 7);
        Object.assign(s.rooms[rock], { kind: 'rock', job: null, flesh: 0 });
        expect(V.describe(s, rock)).toMatch(/^Fill the floor below first\. \d+ rooms? left\.$/);
        s.ore = 1;
        s.rooms.forEach((r) => { if (r.kind === 'mine') r.broken = true; });
        run(s, 5);
        expect(s.out.filter((o) => o.text === V.NO_ORE)).toHaveLength(1);
        expect(V.enginePower(s)).toBe(0);
    });
});

describe('Ola after v1.87.1 (H)', () => {
    test('H1: a failing pod is saved by a click (2 ore); a missed one dies and is logged', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-night']();
        s.tut = { on: false }; s.haleSaved = true; s.fallenCount = 1; s.nightSec = 60;
        for (let t = 0; t < 30 && !(s.failing || []).length; t += 0.25) V.advance(s, 0.25, 1);
        const f = s.failing[0];
        const ore = s.ore;
        expect(V.savePod(s, f.id)).toBe(true);
        expect(s.ore).toBeCloseTo(ore - V.SAVE_ORE, 0);
        for (let t = 0; t < 40 && !(s.failing || []).length; t += 0.25) V.advance(s, 0.25, 1);
        const dead = s.dead;
        run(s, V.FAIL_LIFE_S + 1);
        expect(s.dead).toBeGreaterThan(dead);
        expect(s.log.some((l) => /^Pod \d+ failed\.$/.test(l))).toBe(true);
    });
    test('H1: the meat lab feeds 100 pods a level; more sleepers than that is underfed', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-night']();
        // the checkpoint has its meat lab (level 1), so the night never says it cannot feed them with no lab there
        const lab = s.rooms.findIndex((r) => r.kind === 'meatlab');
        expect(lab).toBeGreaterThanOrEqual(0);
        expect(V.podFeed(s)).toBe(100);
        expect(V.underfed(s)).toBe(true);
        s.rooms[lab].lvl = 3;
        expect(V.underfed(s)).toBe(s.asleep > 300);
    });
    test('H4/H5: a Cryo Bay joins the body in one click (a stop the first time); RISE only when the body is whole', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        s.tut.done.heart = true;
        const bays = s.rooms.map((r, i) => (r.kind === 'cryo' ? i : -1)).filter((i) => i >= 0);
        s.rooms.forEach((r, i) => { if (V.levelOf(i) === 2) r.flesh = 1; });
        s.rooms[bays[0] - 1].flesh = 1;
        s.bio = 1e4;
        expect(V.growInto(s, bays[0])).toBe(true);
        expect(s.tut.stop.id).toBe('unity');
        expect(s.out.some((o) => /^Unity: \d+ of \d+\.$/.test(o.text))).toBe(true);
        // organs but not whole: no RISE, the lever says what is left
        s.rooms.forEach((r) => { r.flesh = 1; r.job = null; r.organ = r.organ || 'tissue'; });
        s.rooms[0].flesh = 0; s.rooms[0].organ = undefined;
        s.rooms[V.slotIndex(2, 3)].organ = 'heart'; s.rooms[V.slotIndex(2, 4)].organ = 'lungs'; s.rooms[V.slotIndex(0, 3)].organ = 'skin';
        s.asleep = 0; s.residents = 0;
        expect(V.riseReady(s)).toBe(false);
        expect(V.NOT_WHOLE(V.roomsLeft(s))).toBe('THE BODY IS NOT WHOLE · 1 room left');
        // the lever names a missing organ before it counts rooms
        expect(V.notWholeText(s)).toBe('THE BODY IS NOT WHOLE · 1 room left');
        s.rooms[V.slotIndex(0, 3)].organ = 'tissue';
        expect(V.notWholeText(s)).toBe('NO SKIN YET · grow skin on the top level');
        s.rooms[V.slotIndex(0, 3)].organ = 'skin';
        s.rooms[0].flesh = 1;
        expect(V.riseReady(s)).toBe(true);
    });
});
