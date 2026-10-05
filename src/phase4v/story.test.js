/* eslint-env jest */
// The vault's story pass (docs/superpowers/specs/2026-10-05-deep-vault-story.md): the steak, the
// goal, the organs, the moments that matter, and the residents shouting at "Computer".
import * as V from './vault.js';
import * as W from './wishes.js';
import * as S from './story.js';
import { VAULT_CHECKPOINTS } from './checkpoints.js';

const run = (s, sec, speed = 1) => { for (let t = 0; t < sec; t += 0.25) V.advance(s, 0.25, speed); };
const texts = (s) => s.out.map((o) => o.text);
const put = (s, i, kind, extra = {}) => Object.assign(s.rooms[i], { kind, lvl: 1, job: null, broken: false, flesh: 0, born: s.day, ...extra });
/** The palace after its first five wishes: the next request is the steak. */
function beforeSteak() {
    const s = V.newVault();
    run(s, 0.5);
    s.request = null; s.reqIdx = 5; s.nextRequestDay = s.day; s.out = [];
    return s;
}

describe('the steak (act I)', () => {
    test('after the first five requests: "Mr Hale: I want real steak." opens the MEAT LAB card, a marked moment', () => {
        const s = beforeSteak();
        expect(V.cards(s)).not.toContain('meatlab');
        V.stepDays(s, 1);
        expect(s.request.text).toBe('I want real steak.');
        const o = s.out.find((x) => x.text === 'Mr Hale: I want real steak.');
        expect(o.mark).toBe(true);
        expect(V.cards(s)).toContain('meatlab');
        expect(V.cardLine('meatlab')).toBe('Real steak. Mood +6.');
        expect(V.KINDS.meatlab.price).toBe(160);
    });
    test('the lab goes on level 2 or 3; built: "Mr Hale: Finally. Real steak."; its info box line', () => {
        const s = beforeSteak();
        V.stepDays(s, 1);
        const top = s.rooms.findIndex((r, i) => r.kind === 'rock' && V.levelOf(i) === 0);
        put(s, top, 'empty');
        expect(V.canPlace(s, 'meatlab', top)).toBe(false);
        const deep = s.rooms.findIndex((r, i) => r.kind === 'rock' && V.levelOf(i) === 1);
        put(s, deep, 'empty');
        s.ore = 500;
        expect(V.build(s, 'meatlab', deep)).toBe(true);
        s.out = [];
        for (let d = 0; d < 4; d++) V.stepDays(s, 1);
        expect(texts(s)).toContain('Mr Hale: Finally. Real steak.');
        expect(V.describe(s, deep)).toBe('Real meat, grown in vats. Nobody asks from what.');
        expect(V.nameOf(s, deep)).toBe('Meat Lab');
    });
    test('the meat lab feeds (with the hydroponics) and gives mood like a room of fun', () => {
        const s = V.newVault();
        const before = V.food(s), mood = V.moodParts(s).fun;
        put(s, V.slotIndex(1, 2), 'meatlab');
        expect(V.food(s)).toBe(before + V.MEAT_FEEDS[0]);
        expect(V.moodParts(s).fun).toBeCloseTo(mood + 6);
    });
    test('"More steak. Everyone wants steak." asks for the lab at level 2, only when there is a lab', () => {
        const s = V.newVault();
        run(s, 0.5);
        s.request = null; s.reqIdx = V.REQUESTS.indexOf(S.STEAK.more); s.nextRequestDay = s.day;
        V.stepDays(s, 1);
        expect(s.request).toBe(null);           // no lab: skipped, and the list has run out
        const t = V.newVault();
        run(t, 0.5);
        put(t, V.slotIndex(1, 2), 'meatlab');
        t.request = null; t.reqIdx = V.REQUESTS.indexOf(S.STEAK.more); t.nextRequestDay = t.day;
        V.stepDays(t, 1);
        expect(t.request.text).toBe('More steak. Everyone wants steak.');
        expect(t.request.lvl).toBe(2);
    });
    test('a steak bubble once the lab stands, and a steak wave asks for the meat lab', () => {
        expect(W.ICONS.steak.wave.kind).toBe('meatlab');
        const s = V.newVault();
        put(s, V.slotIndex(1, 2), 'meatlab');
        s.wishes = W.normalizeWishes({ next: 0, waveNext: 999 });
        let seen = false;
        for (let k = 0; k < 200 && !seen; k++) { run(s, 1); seen = s.wishes.list.some((b) => b.icon === 'steak'); }
        expect(seen).toBe(true);
        const t = V.newVault();
        t.wishes = W.normalizeWishes({ next: 0, waveNext: 999 });
        for (let k = 0; k < 200; k++) { run(t, 1); expect(t.wishes.list.some((b) => b.icon === 'steak')).toBe(false); }
    });
});

describe('the turn and the cold', () => {
    test('a few days after the report the hydroponics fail: they feed half, the meat lab the rest', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-turn']();
        const hydro = s.rooms.findIndex((r) => r.kind === 'hydro');
        const full = V.food(s);
        run(s, 6 * 5);
        expect(s.turned).toBe(true);
        expect(s.out.find((o) => o.text === 'SURFACE REPORT: NOT RECOVERING.').mark).toBe(true);
        expect(texts(s)).toContain('The hydroponics are failing. The lamps are old.');
        expect(V.food(s)).toBe(Math.round(full / 2));
        expect(V.describe(s, hydro)).toMatch(/The lamps are old\./);
        put(s, V.slotIndex(1, 6), 'meatlab');
        expect(V.food(s)).toBe(Math.round(full / 2) + V.MEAT_FEEDS[0]);
    });
    test('the first to die in the palace, with a lab: the next day "The steak tastes different tonight."', () => {
        const s = V.newVault();
        put(s, V.slotIndex(1, 2), 'meatlab');
        s.despair = 400; s.day = 1;
        for (let d = 0; d < 12 && !texts(s).includes('The steak tastes different tonight.'); d++) V.stepDays(s, 1);
        const fell = s.out.find((o) => o.text === 'Someone tried the shaft. They fell.');
        expect(fell.mark).toBe(true);
        expect(texts(s)).toContain('The steak tastes different tonight.');
    });
    test('the Cryo Bay opening is a moment; in the cold the system weighs the sleepers, one line every 20 s', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-turn']();
        s.day = 109; s.turned = true;
        run(s, 6);
        expect(s.out.find((o) => o.text === 'CRYO BAY AVAILABLE.').mark).toBe(true);
        put(s, V.slotIndex(1, 6), 'cryo', { lvl: 3 });
        V.sleepSome(s, 50);
        s.out = []; s.slow = 0;
        run(s, 41);
        const weighed = texts(s).filter((t) => /^Sleeper \d+\. \d+ kg\.$/.test(t));
        expect(weighed.length).toBe(3);
        expect(weighed[0]).toMatch(/^Sleeper 41\./);
        for (const w of weighed) { const kg = Number(w.match(/(\d+) kg/)[1]); expect(kg).toBeGreaterThanOrEqual(50); expect(kg).toBeLessThanOrEqual(95); }
    });
});

describe('the night: the goal and the organs', () => {
    const nightFrom = () => {
        const s = VAULT_CHECKPOINTS['iv-vault-cold']();
        const cryo = s.rooms.findIndex((r) => r.kind === 'cryo');
        s.residents = 150; s.asleep = 100;
        V.act(s, 'sleepall', cryo);
        return s;
    };
    test('the night begins with the goal: four amber lines, time slows, a pling; the checklist shows', () => {
        const s = nightFrom();
        expect(s.phase).toBe('night');
        const goal = s.out.filter((o) => o.mark).map((o) => o.text);
        expect(goal).toEqual(S.GOAL_LINES);
        expect(s.slow).toBe(S.SLOW_S);
        expect(s.sfx).toContain('moment');
        const g = V.goal(s);
        expect(g).toMatchObject({ shown: true, heart: false, lungs: false, skin: false, stomach: false, inside: 0, total: 150, ready: false });
    });
    test('slow time: a quarter of ▶ for 3 real seconds, even from ▶▶, then the player\'s speed', () => {
        const s = nightFrom();
        const y0 = s.year;
        V.advance(s, 1, 2);
        expect(s.year - y0).toBeCloseTo(0.25 * V.yearsPerSecond(0), 5);
        run(s, 2, 2);
        expect(s.slow).toBe(0);
        const y1 = s.year, n = s.nightSec;
        V.advance(s, 1, 2);
        expect(s.year - y1).toBeCloseTo(V.yearsPerSecond(n) * V.NIGHT_FAST, 1);
    });
    test('the first RECLAIM with no meat lab builds one for nothing: the body\'s first vat', () => {
        const s = nightFrom();
        s.fallen = ['Mr Hale'];
        expect(V.hasVat(s)).toBe(false);
        V.reclaim(s);
        const lab = s.rooms.findIndex((r) => r.kind === 'meatlab');
        expect(lab).toBeGreaterThanOrEqual(V.slotIndex(1, 0));
        expect(V.isVatRoom(s.rooms[lab])).toBe(true);
        expect(V.hasVat(s)).toBe(true);
        expect(V.cardLine('vat', s)).toMatch(/^The meat lab, grown up\./);
    });
    test('a meat lab built in the palace is the one the night wakes', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-night']();
        const i = V.slotIndex(2, 3);
        put(s, i, 'meatlab');
        s.fallen = ['Mr Hale'];
        V.reclaim(s);
        expect(V.isVatRoom(s.rooms[i])).toBe(true);
        expect(s.rooms.filter((r) => r.kind === 'meatlab')).toHaveLength(1);
    });
    test('GROW INTO is a choice of organ; only what can be paid and is allowed lights', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        const i = V.slotIndex(2, 3);
        s.bio = V.organPrice(s, 'stomach') + 1;
        const acts = V.actionsFor(s, i).filter((a) => a.group === 'grow');
        expect(acts.map((a) => a.organ)).toEqual(['tissue', 'stomach', 'heart', 'lungs', 'skin']);
        const by = Object.fromEntries(acts.map((a) => [a.organ, a]));
        expect(by.tissue.id).toBe('grow');
        expect(by.stomach.ok).toBe(true);
        expect(by.heart.ok).toBe(false);
        expect(by.heart.need).toBe(`Need ${V.organPrice(s, 'heart') - s.bio} more biomass.`);
        expect(by.lungs.ok).toBe(false);
        expect(by.lungs.need).toBe('Needs a heart first.');
        expect(by.skin.ok).toBe(false);
        expect(by.stomach.label).toBe(`STOMACH · ${V.organPrice(s, 'stomach')} biomass`);
        expect(by.stomach.hint).toBe('Eats the rock. More biomass every year.');
        expect(by.heart.hint).toBe('Power for everything. The engine can rest.');
        expect(by.lungs.hint).toBe('To breathe up there.');
        expect(by.skin.hint).toBe('To take the storms. Only on the top level.');
        expect(by.tissue.hint).toBe('Just more of the body.');
    });
    test('a stomach eats the rock: +1 biomass a year; its first one is a moment with its line', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        const i = V.slotIndex(2, 3);
        s.bio = 400;
        const rate = V.bioRate(s);
        expect(V.act(s, 'grow-stomach', i)).toBe(true);
        s.out = [];
        run(s, 30, 2);
        expect(V.organOf(s.rooms[i])).toBe('stomach');
        expect(V.bioRate(s)).toBeCloseTo(rate + V.STOMACH_BIO - 0 + 0, 5);
        const line = s.out.find((o) => o.text === 'A stomach. It eats the rock.');
        expect(line.mark).toBe(true);
        expect(V.goal(s).stomach).toBe(true);
        expect(V.nameOf(s, i)).toBe('Stomach');
    });
    test('a heart: power +40, and the engine rests (no ore burnt); lungs need it, skin needs level 1', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        const i = V.slotIndex(2, 3);
        s.bio = 1000;
        expect(V.growInto(s, i, 'lungs')).toBe(false);
        expect(V.growInto(s, i, 'heart')).toBe(true);
        run(s, 30, 2);
        expect(V.hasOrgan(s, 'heart')).toBe(true);
        expect(V.enginePower(s)).toBe(0);
        expect(V.describe(s, 1)).toBe('The machine. It rests. The heart does its work.');
        const ore = s.ore;
        run(s, 5);
        expect(s.ore).toBeGreaterThanOrEqual(ore);
        expect(texts(s)).toContain('A heart. It beats for all of them.');
        const next = V.slotIndex(2, 4);
        expect(V.organAllowed(s, 'lungs', next)).toBe(true);
        expect(V.organAllowed(s, 'skin', next)).toBe(false);
        expect(V.organAllowed(s, 'skin', V.slotIndex(0, 3))).toBe(true);
    });
    test('plain tissue can still become an organ, so the body never runs out of places for one', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        const tissue = V.slotIndex(2, 2);
        expect(V.organOf(s.rooms[tissue])).toBe('tissue');
        s.bio = 400;
        const acts = V.actionsFor(s, tissue);
        expect(acts.map((a) => a.organ)).toEqual(['stomach', 'heart', 'lungs', 'skin']);
        expect(V.act(s, 'grow-heart', tissue)).toBe(true);
        expect(V.isFlesh(s.rooms[tissue])).toBe(true);
        run(s, 30, 2);
        expect(V.organOf(s.rooms[tissue])).toBe('heart');
    });
    test('RISE: a heart, lungs and skin, and everyone who lives inside; the last Cryo Bay takes everyone', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        // the body has all but the Cryo Bays and one room on the top level
        const bays = s.rooms.map((r, i) => (r.kind === 'cryo' ? i : -1)).filter((i) => i >= 0);
        s.rooms.forEach((r, i) => { if (!bays.includes(i) && i !== V.slotIndex(0, 3) && !r.flesh) Object.assign(r, { flesh: 1, organ: 'tissue' }); });
        s.rooms[V.slotIndex(2, 3)].organ = 'heart';
        s.rooms[V.slotIndex(2, 4)].organ = 'lungs';
        // skin waits for a full floor under it: the Cryo Bays first; the last one's sleepers the body will not take
        expect(V.growInto(s, V.slotIndex(0, 3), 'skin')).toBe(false);
        expect(V.goal(s).inside).toBeLessThan(V.goal(s).total);
        s.bio = 1e4; expect(V.growInto(s, bays[0])).toBe(true); run(s, 40, 2);
        const last = bays[1];
        expect(V.canGrowInto(s, last)).toBe(false);
        expect(V.describe(s, last)).toMatch(/The body will not take the last sleepers\. You must\.$/);
        // the dark choice: CUT POWER until nobody sleeps, the dead to the meat lab
        while (s.asleep > 0) { V.cutPower(s); V.reclaim(s); if (V.awake(s)) V.sleepAll(s); }
        s.bio = 1e4; expect(V.growInto(s, last)).toBe(true); run(s, 40, 2);
        expect(s.residents).toBe(0);
        expect(V.riseReady(s)).toBe(false);
        s.bio = 1e4;
        expect(V.growInto(s, V.slotIndex(0, 3), 'skin')).toBe(true);
        run(s, 40, 2);
        expect(V.goal(s)).toMatchObject({ heart: true, lungs: true, skin: true, ready: true });
        expect(V.goal(s).inside).toBe(V.goal(s).total);
        const end = s.out.find((o) => o.text === 'Woke: everyone is here.');
        expect(end.mark).toBe(true);
        expect(V.rise(s)).toBe(true);
    });
    test('the first full floor is a moment; the second is a plain line', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        s.rooms.forEach((r, i) => { if (V.levelOf(i) === 2 && i !== V.slotIndex(2, 7)) r.flesh = 1; });
        s.bio = 1000;
        V.growInto(s, V.slotIndex(2, 7));
        run(s, 30, 2);
        expect(s.out.find((o) => o.text === 'Level 3 is one.').mark).toBe(true);
    });
});

describe('Computer', () => {
    test('missed bubbles: now and then a resident shouts at the Computer, never two at once', () => {
        const s = V.newVault();
        S.story(s).moments['first-request'] = true;
        run(s, 240);
        const said = s.out.filter((o) => o.computer).map((o) => o.text);
        expect(said.length).toBeGreaterThan(0);
        for (const t of said) expect(S.COMPUTER.missed).toContain(t);
        expect(said.length).toBeLessThan(240 / S.COMPUTER_EVERY_S + 1);
    });
    test('a build that takes its time: "Computer, how long does a cinema take?"', () => {
        let said = false;
        for (let seed = 1; seed < 40 && !said; seed++) {
            const s = V.newVault();
            S.story(s).seed = seed; S.story(s).compNext = 0;
            const i = s.rooms.findIndex((r, j) => r.kind === 'rock' && V.levelOf(j) === 0);
            put(s, i, 'empty');
            V.build(s, 'cinema', i);
            for (let d = 0; d < 3; d++) V.stepDays(s, 1);
            said = texts(s).includes('Computer, how long does a cinema take?');
        }
        expect(said).toBe(true);
    });
    test('after the turn the ruder lines join in', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-turn']();
        s.turned = true;
        const pool = new Set();
        for (let k = 0; k < 200; k++) { S.story(s).compNext = 0; if (S.computerSays(s, 'miss')) pool.add(s.out[s.out.length - 1].text); }
        expect([...pool].some((t) => S.COMPUTER.turned.includes(t))).toBe(true);
    });
    test('TAKE ONE in the night: "Computer? Computer, what is that?" the first time', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        V.takeOne(s);
        expect(texts(s)).toEqual(expect.arrayContaining(['3 woke. They saw.', 'Computer? Computer, what is that?']));
    });
});

describe('the words', () => {
    test('no em-dash in anything the player reads', () => {
        const all = JSON.stringify([S.STEAK, S.GOAL_LINES, S.COMPUTER, S.ORGANS, S.HYDRO_FAILING, V.LINES, V.KINDS, V.REQUESTS, W.ICONS]);
        expect(all).not.toMatch(new RegExp(String.fromCharCode(0x2014)));
    });
    test('only the moments of the spec are marked', () => {
        expect(S.MOMENTS).toEqual(['first-request', 'meatlab', 'turn', 'cold', 'first-dead', 'reclaim-hint', 'goal', 'organ-stomach', 'organ-heart', 'organ-lungs', 'organ-skin', 'first-floor', 'rise']);
    });
});

describe('after the third test', () => {
    test('the night stays short: stomachs share the rock and each costs more; organs grow dearer with the body', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        const first = V.organPrice(s, 'stomach');
        s.rooms[V.slotIndex(2, 2)].organ = 'stomach';
        expect(V.stomachBio(s)).toBeCloseTo(V.STOMACH_BIO);
        expect(V.organPrice(s, 'stomach')).toBe(first + V.STOMACH_STEP);
        s.rooms[V.slotIndex(2, 0)].kind = 'rock'; s.rooms[V.slotIndex(2, 0)].organ = 'stomach';
        expect(V.stomachBio(s)).toBeCloseTo(V.STOMACH_BIO * Math.sqrt(2));
        const heart = V.organPrice(s, 'heart');
        s.grown += 4;
        expect(V.organPrice(s, 'heart')).toBeGreaterThan(heart);
    });
    test('the last Cryo Bay: the body will not take its sleepers, the system must (a dark choice before RISE)', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        const bays = s.rooms.map((r, i) => (r.kind === 'cryo' ? i : -1)).filter((i) => i >= 0);
        s.rooms[bays[0]].flesh = 1;
        expect(V.lastSleepers(s, bays[1])).toBe(true);
        s.rooms.forEach((r, i) => { if (V.levelOf(i) === 2) r.flesh = 1; });
        expect(V.canGrowInto(s, bays[1])).toBe(false);
        V.cutPower(s);
        expect(V.fallenBio(s)).toBe(10 * V.CUT_BIO);
    });
    test('the first pod of the night: the way is pointed out once, marked; later failures are one counting line', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-night']();
        run(s, 120);
        const hint = s.out.filter((o) => o.text === V.RECLAIM_HINT);
        expect(hint).toHaveLength(1);
        expect(hint[0].mark).toBe(true);
        const tallies = s.out.filter((o) => o.tally === 'pods').map((o) => o.text);
        expect(tallies.length).toBeGreaterThan(0);
        expect(tallies[tallies.length - 1]).toBe(`PODS FAILED: ${s.podsFailed}.`);
        expect(s.out.some((o) => /^POD \d+ FAILED\.$/.test(o.text))).toBe(false);
    });
    test('the Cryo Bay opens with the turn (when mood first falls under 60), not a week of riots later', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-turn']();
        s.favour = 40;
        run(s, 2 * 5);
        expect(s.turned).toBe(true);
        run(s, (V.COLD_AFTER_TURN + 1) * 5);
        expect(s.coldOpen).toBe(true);
        expect(s.day).toBeLessThan(V.TURN_DAY + V.COLD_AFTER_TURN + 2);
    });
    test('a Cryo Bay in the night shows four buttons at most, the likeliest first', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        const cryo = s.rooms.findIndex((r) => r.kind === 'cryo');
        s.rooms.forEach((r, i) => { if (V.levelOf(i) === 2) r.flesh = 1; });
        s.rooms[cryo - 1].flesh = 1;
        s.fallen = ['Pod'];
        s.bio = 1000;
        const acts = V.actionsFor(s, cryo);
        expect(acts.length).toBeLessThanOrEqual(4);
        expect(acts.map((a) => a.id)).toEqual(['reclaim', 'grow', 'grow-heart', 'take']);
    });
});
