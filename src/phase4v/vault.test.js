/* eslint-env jest */
import * as V from './vault.js';
import { VAULT_CHECKPOINTS } from './checkpoints.js';
import { wordFor } from './sound.js';

const run = (s, sec, speed = 1) => { for (let t = 0; t < sec; t += 0.25) V.advance(s, 0.25, speed); };
const firstDiggable = (s, pred = () => true) => s.rooms.findIndex((r, i) => V.canDig(s, i) && pred(i));

describe('the palace', () => {
    test('starts as the spec says: 300 ore, 216 residents, 200 beds, mood 70 %, three rock slots on level 1', () => {
        const s = V.newVault();
        expect(s.ore).toBe(300);
        expect(s.residents).toBe(216);
        expect(V.beds(s)).toBe(200);
        expect(V.mood(s)).toBe(70);
        expect(s.rooms.slice(0, 8).filter((r) => r.kind === 'rock')).toHaveLength(3);
        expect(s.out.map((o) => o.text)).toEqual(V.LINES.online);
    });
    test('the first request is the sofas, and digging plus Suites answers it within 30 s', () => {
        const s = V.newVault();
        run(s, 0.5);
        expect(s.request.text).toBe('16 of us are sleeping on sofas.');
        const i = firstDiggable(s, (j) => V.levelOf(j) === 0);
        expect(V.dig(s, i)).toBe(true);
        run(s, 11);
        expect(s.rooms[i].kind).toBe('empty');
        expect(V.build(s, 'suites', i)).toBe(true);
        run(s, 16);
        expect(s.request).toBe(null);
        expect(V.beds(s)).toBe(300);
        expect(s.favour).toBeGreaterThan(10);
    });
    test('a room cannot be bought without the ore, and the info box says how much is missing', () => {
        const s = V.newVault();
        s.ore = 40;
        const i = firstDiggable(s);
        expect(V.dig(s, i)).toBe(false);
        const a = V.actionsFor(s, i).find((x) => x.id === 'dig');
        expect(a.ok).toBe(false);
        expect(a.need).toBe('Need 20 more ore.');
    });
    test('novelty fades to 40 % over 40 days and an upgrade makes it new again', () => {
        const s = V.newVault();
        const r = s.rooms[5]; Object.assign(r, { kind: 'cinema', born: 0 });
        s.day = 40;
        expect(V.novelty(s, r)).toBeCloseTo(0.4);
        r.born = 40;
        expect(V.novelty(s, r)).toBe(1);
    });
    test('cabin fever grows all the time; at the turn it outweighs a palace of fun', () => {
        const s = V.newVault();
        expect(V.fever({ day: 10 })).toBeLessThan(V.fever({ day: 90 }));
        expect(V.fever({ day: 100 })).toBeGreaterThan(40);
        expect(s.turned).toBe(false);
    });
    test('the turn comes at day 100 and the Cryo Bay opens by day 110', () => {
        const s = V.newVault();
        s.ore = 1e5;
        run(s, 101 * 5);
        expect(s.turned).toBe(true);
        expect(s.out.some((o) => o.text === 'SURFACE REPORT: NOT RECOVERING.')).toBe(true);
        run(s, 10 * 5);
        expect(s.coldOpen).toBe(true);
        expect(V.cards(s)).toContain('cryo');
    });
    test('a riot breaks a room of fun under 25 %, and REPAIR mends it', () => {
        const s = V.newVault();
        const i = 5; Object.assign(s.rooms[i], { kind: 'bar', born: 0 });
        s.despair = 200; s.day = 1;
        V.stepDays(s, 1);
        expect(s.rooms[i].broken).toBe(true);
        expect(s.out.some((o) => o.text === 'They broke the bar.')).toBe(true);
        s.ore = 100;
        expect(V.actionsFor(s, i)[0].label).toBe('REPAIR · 80 ore');
        expect(V.repair(s, i)).toBe(true);
    });
    test('numbers stay human: no "k", no exponent', () => {
        expect(V.num(1240)).toBe('1 240');
        expect(V.num(340)).toBe('340');
        expect(V.num(123456)).toBe('123 456');
    });
});

describe('the cold', () => {
    test('SLEEP 50 needs pods; SLEEP ALL shows whenever all fit; the night begins when all sleep', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-cold']();
        expect(V.pods(s)).toBe(3 * V.PODS_PER_LEVEL);
        const cryo = s.rooms.findIndex((r) => r.kind === 'cryo');
        const ids = V.actionsFor(s, cryo).map((a) => a.id);
        expect(ids).toContain('sleep');
        expect(ids).toContain('wake');
        expect(V.actionsFor(s, cryo).find((a) => a.id === 'sleep').label).toBe('SLEEP 50');
        const before = V.awake(s);
        V.act(s, 'sleep', cryo);
        expect(V.awake(s)).toBe(before - 50);
        s.rooms[slotFor(s)] = { ...s.rooms[cryo] };
        expect(V.actionsFor(s, cryo).map((a) => a.id)).toContain('sleepall');
        V.act(s, 'sleepall', cryo);
        expect(s.phase).toBe('night');
    });
});
function slotFor(s) { return s.rooms.findIndex((r) => r.kind === 'rock' && V.levelOf(s.rooms.indexOf(r)) === 2); }

describe('the night', () => {
    test('the power fails within the first minute and the first to die has a name', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-night']();
        run(s, 15);
        expect(V.power(s).short).toBe(false);
        run(s, 45);
        expect(V.power(s).short).toBe(true);
        expect(s.out.some((o) => o.text === 'POD 41 FAILED. MR HALE IS DEAD.')).toBe(true);
        const cryo = s.rooms.findIndex((r) => r.kind === 'cryo');
        const ids = V.actionsFor(s, cryo).map((a) => a.id);
        expect(ids).toEqual(expect.arrayContaining(['bury', 'reclaim']));
        V.act(s, 'reclaim', cryo);
        expect(s.bio).toBeGreaterThanOrEqual(70);
        expect(V.cards(s)).toContain('vat');
        expect(V.actionsFor(s, cryo).map((a) => a.id)).toContain('take');
    });
    test('a vat grows biomass and power; the body grows into its neighbours, from the bottom up', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        expect(V.hasVat(s)).toBe(true);
        expect(V.bioRate(s)).toBeGreaterThan(0);
        const level1 = 3;
        expect(V.canGrowInto(s, level1)).toBe(false);
        const next = V.slotIndex(2, 3);
        expect(V.canGrowInto(s, next)).toBe(true);
        s.bio = 500;
        expect(V.growInto(s, next)).toBe(true);
        expect(V.canGrowInto(s, V.slotIndex(2, 4))).toBe(false);     // one room at a time
        run(s, 30);
        expect(V.isFlesh(s.rooms[next])).toBe(true);
    });
    test('when every room is body: "Woke: everyone is here." and RISE', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        s.rooms.forEach((r, i) => { if (i !== 0) r.flesh = 1; });
        s.bio = 1e4;
        expect(V.growInto(s, 0) || V.canGrowInto(s, 0) === false).toBe(true);
        run(s, 120, 2);
        expect(s.ended).toBe(true);
        expect(s.out.some((o) => o.text === 'Woke: everyone is here.')).toBe(true);
        expect(V.riseReady(s)).toBe(true);
        expect(V.rise(s)).toBe(true);
        expect(s.phase).toBe('risen');
    });
    test('the save round-trips', () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        const back = V.deserialize(V.serialize(s));
        expect(back.rooms).toEqual(s.rooms);
        expect(back.out).toEqual([]);
    });
});

describe('sound words', () => {
    test('a built room plings, a failed pod knocks', () => {
        expect(wordFor('built')).toBe('pling');
        expect(wordFor('fail')).toBe('knock');
        expect(wordFor('nothing')).toBe(null);
    });
});

describe('after the human test', () => {
    const night = () => {
        const s = VAULT_CHECKPOINTS['iv-vault-flesh']();
        return { s, cryo: s.rooms.findIndex((r) => r.kind === 'cryo') };
    };
    test('TAKE ONE has a price: the pods beside it open, three wake, terrified; mood shows and falls', () => {
        const { s, cryo } = night();
        expect(V.awake(s)).toBe(0);
        V.act(s, 'take', cryo);
        expect(V.awake(s)).toBe(V.TAKE_WAKES);
        expect(s.out.some((o) => o.text === '3 woke. They saw.')).toBe(true);
        expect(V.mood(s)).toBeLessThanOrEqual(V.DESPAIR_AT);
        // left awake at 0 %, one tries the shaft
        s.out.length = 0;
        for (let t = 0; t < 20; t += 0.25) V.advance(s, 0.25, 1);
        expect(s.out.map((o) => o.text)).toEqual(expect.arrayContaining(['They are banging on the screen.', 'Someone tried the shaft. They fell.']));
        // dealt with: SLEEP ALL puts them back
        expect(V.actionsFor(s, cryo).map((a) => a.id)).toContain('sleepall');
    });
    test('RECLAIM is for the dead only, TAKE ONE is the dark one; every night button says what it does', () => {
        const { s, cryo } = night();
        s.fallen = ['Pod', 'Pod'];
        s.engineWear = 99; s.ore = 0;
        const acts = V.actionsFor(s, cryo);
        const by = Object.fromEntries(acts.map((a) => [a.id, a]));
        expect(by.reclaim.label).toBe('RECLAIM 2 DEAD');
        expect(by.take.dark).toBe(true);
        for (const id of ['bury', 'reclaim', 'take', 'cut', 'wake']) expect(by[id].hint).toMatch(/\.$/);
        const g = s.rooms.findIndex((r, i) => V.canGrowInto(s, i));
        expect(V.actionsFor(s, g).find((a) => a.id === 'grow').hint).toMatch(/^The body takes this room\./);
    });
    test('in the night a Cryo Bay goes on bare rock (nobody digs); a full floor says how the body climbs', () => {
        const { s } = night();
        const rock = s.rooms.findIndex((r, i) => r.kind === 'rock' && V.levelOf(i) === 2 && !r.flesh);
        expect(V.canPlace(s, 'cryo', rock)).toBe(true);
        s.rooms.forEach((r, i) => { if (V.levelOf(i) === 2 && i !== V.slotIndex(2, 7)) r.flesh = 1; });
        s.bio = 1000;
        V.growInto(s, V.slotIndex(2, 7));
        for (let t = 0; t < 30; t += 0.25) V.advance(s, 0.25, 2);
        expect(s.out.map((o) => o.text)).toEqual(expect.arrayContaining(['Level 3 is one.', 'The body grows up from a full floor.']));
    });
    test('at 0 % in the palace they bang on the screen, then one tries the shaft', () => {
        const s = V.newVault();
        s.despair = 300; s.day = 1;
        for (let d = 0; d < 12; d++) V.stepDays(s, 1);
        expect(s.out.some((o) => o.text === 'Someone tried the shaft. They fell.')).toBe(true);
        expect(s.dead).toBeGreaterThan(0);
    });
});
