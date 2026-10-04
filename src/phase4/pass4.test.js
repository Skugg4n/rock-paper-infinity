/**
 * deep-pass4 (B410 to B418): the third human pass of v1.84.0 said yes, with a warning: the end of GROW was out
 * of reach and mostly waiting. These hold the fixes: the floors gain momentum and the last one is a finale, a
 * dream grows where it is sent within seconds, a price is set once, the pump never vanishes into the dead, the
 * restart of the mind costs, every click on the colony counts, the vats grow people, and the counter, the
 * ruler and the clock agree.
 */
import {
    initialDeepState, tickDay, sleep, setIncome, impliedFeed, cryoPrice, banded, PRICE_BAND, PRICE_AHEAD, rebootLoss,
    REBOOT_LOSS, VAT_ROOM,
} from './deep.js';
import { initialWatcher, snap, snapGain, snapShare, SNAP_COOLDOWN_MS, SNAP_MIN_SHARE } from './watcher.js';
import { wakeWord, wakeWhy, WAKE_WHY } from './instruments.js';
import {
    stepGrow, pump, adviseGrow, growDoable, growTarget, takeChamber, takeOffer, dreamStart, dreamPick, dreamTip, finaleOf,
    starveWords, DEAD_WORDS, revivable, spareOrgans, pumpPath, setChamberPlace, graphOf, nextPrice, takeTip, ringHint,
    wantOrgan, DREAM_ADVISE_S, handsPrice, growNote, GROW_ADVICE,
} from './grow.js';
import {
    bodySums, gutRate, FLOOR_MOMENTUM, FINALE_MASS, FINALE_RAMP, takeMass, takeWork, finaleFloor, DREAM_TRICKLE,
} from './organs.js';
import { sectionPlace } from './strata.js';
import { growColony } from '../checkpoints.js';

beforeAll(() => setChamberPlace(sectionPlace));
afterAll(() => setChamberPlace(null));

const roomsOn = (layout, f) => graphOf(layout).nodes.filter((n) => n.floor === f && n.kind === 'room').map((n) => n.id);
/** Takes every room of the floors up to `upTo` (and the machine), paid by a full purse. */
function fill(s, layout, upTo, organs = ['gut', 'heart', 'vat', 'nerve', 'heart']) {
    let k = 0;
    for (let f = 0; f <= upTo; f++) {
        for (let pass = 0; pass < 4; pass++) {
            for (const id of roomsOn(layout, f)) {
                if (s.grow.body.includes(id)) continue;
                s.grow.mass = 1e9;
                takeChamber(s, layout, id, { organ: organs[k++ % organs.length] });
            }
        }
    }
}

describe('the rise in reach (B410)', () => {
    test('every full floor makes all the guts give FLOOR_MOMENTUM times the mass', () => {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        fill(s, layout, 0, ['gut']);
        const graph = graphOf(layout);
        const st = { body: s.grow.body, necrotic: [], organs: s.grow.organs };
        const sums = bodySums(graph, st);
        expect(sums.full.size).toBe(1);
        expect(sums.momentum).toBeCloseTo(FLOOR_MOMENTUM, 9);
        expect(gutRate(sums)).toBeGreaterThan(gutRate({ ...sums, momentum: 1 }));
    });
    test('the finale: once every floor above is full, the deepest floor is cheaper with every room taken', () => {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        const graph = graphOf(layout);
        const st = () => ({ body: s.grow.body, necrotic: s.grow.necrotic, organs: s.grow.organs });
        fill(s, layout, 0);
        expect(finaleFloor(graph, st())).toBe(-1);
        expect(finaleOf(s, layout)).toBeNull();
        fill(s, layout, 1);
        const fin = finaleOf(s, layout);
        expect(fin.floor).toBe(2);
        expect(fin.mass).toBeCloseTo(FINALE_MASS, 9);
        const id = roomsOn(layout, 2).find((x) => !s.grow.body.includes(x));
        expect(takeMass(graph, id, 'vat', s.grow.taken, fin)).toBeLessThan(takeMass(graph, id, 'vat', s.grow.taken));
        expect(takeWork(graph, id, { finale: fin })).toBeLessThan(takeWork(graph, id));
        expect(Math.min(...takeOffer(s, layout, id).organs.map((r) => r.mass))).toBeLessThanOrEqual(nextPrice(s, layout) + 1e-9);
        // the ramp: the last rooms are cheaper still
        const half = roomsOn(layout, 2).slice(0, 6);
        for (const x of half) { s.grow.mass = 1e9; takeChamber(s, layout, x, { organ: 'heart' }); }
        expect(finaleOf(s, layout).mass).toBeLessThan(fin.mass);
        expect(finaleOf(s, layout).mass).toBeGreaterThanOrEqual(FINALE_MASS * (1 - FINALE_RAMP) - 1e-9);
    });
});

describe('the hands first (B410)', () => {
    test('with the machine house in reach the tape saves for the hands, then names them', () => {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        fill(s, layout, 0, ['vat', 'gut', 'heart', 'vat', 'nerve', 'heart']);
        s.humans = 50000;
        const price = handsPrice(s, layout);
        expect(Number.isFinite(price)).toBe(true);
        s.grow.mass = Math.floor(price * 0.4);
        expect(wantOrgan(s, layout)).toBeNull();
        expect(adviseGrow(s, layout)).toBe(GROW_ADVICE.pump);
        expect(growNote(s, layout)).toMatch(/^The hands: /);
        s.grow.mass = price + 1;
        expect(adviseGrow(s, layout)).toBe(GROW_ADVICE.hands);
        expect(growTarget(s, layout)).toBe('machine');
        expect(growDoable(s, layout)).toBe(true);
    });
});

describe('the ring hints what gives most (B410)', () => {
    test('with nothing short the ring hints one organ of the four; with something short it hints nothing (the red ring does)', () => {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        s.grow.mass = 200;
        if (!wantOrgan(s, layout)) expect(['vat', 'gut', 'heart', 'nerve']).toContain(ringHint(s, layout, 's0'));
        expect(ringHint(s, layout, 'h0')).toBeNull();
    });
    test('the tape says DREAM only for a long wait: a dream makes little more mass than a pump to the guts', () => {
        expect(DREAM_ADVISE_S).toBeGreaterThanOrEqual(60);
    });
});

describe('the dream grows where it is sent (B411)', () => {
    test('a dream with no mark grows the chamber the tape would point at, a room of the first floor in seconds', () => {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        s.grow.mass = 200;
        const id = dreamPick(s, layout);
        expect(id).toBeTruthy();
        dreamStart(s, layout);
        let secs = 0;
        while (!s.grow.body.includes(id) && secs < 20) { stepGrow(s, layout, 0.25); secs += 0.25; }
        expect(s.grow.body).toContain(id);
        expect(secs).toBeLessThanOrEqual(5);
        expect(13 / DREAM_TRICKLE).toBeLessThan(5);
    });
    test('in a dream the words over a chamber say a click sends the dream there', () => {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        dreamStart(s, layout);
        const far = roomsOn(layout, 1)[0];
        expect(dreamTip(s, layout, far).text).toMatch(/dream grows here/);
        expect(dreamTip(s, layout, 'h0').text).toBe('');
    });
});

describe('the pump never vanishes into the dead (B413)', () => {
    /** Floor 0 as guts with one heart short, the outermost two rooms dead beyond the hearts' reach. */
    function deadEnds() {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        const ids = roomsOn(layout, 0);
        for (const id of ids) { s.grow.mass = 1e9; takeChamber(s, layout, id, { organ: 'gut' }); }
        s.grow.necrotic = s.grow.body.filter((x) => x !== 'h0').slice(-2);
        s.grow.mass = 0;
        return { s, layout };
    }
    test('beyond the hearts\' reach a pump sends the blood to the guts, and the dead say what to do', () => {
        const { s, layout } = deadEnds();
        if (!revivable(s, layout)) {
            const r = pump(s, layout, { beat: true });
            expect(r.reviving).toBeUndefined();
            expect(r.mass).toBeGreaterThan(0);
            expect(starveWords(s, layout, s.grow.necrotic[0])).toBe(DEAD_WORDS.heart);
            expect(takeTip(s, layout, s.grow.necrotic[0]).text).toBe(DEAD_WORDS.heart);
        }
    });
    test('a dead room the hearts reach is pumped back, and it is said', () => {
        const { s, layout } = deadEnds();
        s.grow.necrotic = s.grow.necrotic.slice(0, 1);
        // a heart in place of a gut: the reach comes back
        const living = s.grow.body.filter((x) => x !== 'h0' && !s.grow.necrotic.includes(x));
        for (const x of living) { if (revivable(s, layout)) break; s.grow.organs[x] = 'heart'; }
        const dead = s.grow.necrotic[0];
        expect(revivable(s, layout)).toBe(dead);
        expect(starveWords(s, layout, dead)).toBe(DEAD_WORDS.pump);
        const r = pump(s, layout, { beat: true });
        expect(r.reviving).toBe(dead);
    });
    test('the dead blocking both ends of the row never leave the tape without a way: any organ may become a heart', () => {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        // the strata row: s0 s1 beside the shaft, s4 s5 its ends (sectionPlace: -1, +1, -2, +2, -3, +3)
        for (const id of ['s0', 's1', 's2', 's3', 's4', 's5']) { s.grow.mass = 1e9; takeChamber(s, layout, id, { organ: 'gut' }); }
        s.grow.necrotic = ['s4', 's5'];
        s.grow.mass = 500;
        expect(takeOffer(s, layout, 's6')).toBeNull();               // nothing in reach past the dead
        const word = adviseGrow(s, layout);
        expect(word).toBe('GROW A HEART');
        expect(growDoable(s, layout, word)).toBe(true);
        const id = growTarget(s, layout, word);
        expect(['s0', 's1', 's2', 's3']).toContain(id);
        expect(spareOrgans(s, layout, 'heart').length).toBeGreaterThan(0);
    });
    test('the wave runs through the living flesh when it can', () => {
        const { deep: s, layout } = growColony({ body: ['h0'] });
        for (const id of roomsOn(layout, 0)) { s.grow.mass = 1e9; takeChamber(s, layout, id, { organ: 'gut' }); }
        const to = s.grow.body[s.grow.body.length - 1];
        const path = pumpPath(s, layout, to);
        expect(path[0]).toBe('h0');
        expect(path[path.length - 1]).toBe(to);
    });
});

describe('a price is set once (B412)', () => {
    const colony = () => {
        const s = initialDeepState({ salvage: 1500, doom0: 85 });
        Object.assign(s, {
            day: 5000 * 365, minerals: 4e9, food: 4e7, stars: 1e10, humans: 4000, chambers: 36,
            rooms: { mine: 10, farm: 8, generator: 10, dorm: 6, cryo: 1 }, level: { mine: 6, farm: 6, generator: 6, dorm: 4 },
            auto: { mine: 3, farm: 3, generator: 3, dorm: 2 }, cryo: 3, feed: impliedFeed(3), vats: 2,
        });
        return s;
    };
    test('Cryo V does not move when the income doubles, nor on a wake; the next one is priced anew', () => {
        const s = colony();
        const inc = setIncome(s).stars;
        const v = cryoPrice(s, 4);
        expect(v).toBeGreaterThan(0);
        // a good buy: the income doubles, the colony sleeps and wakes (setIncome again)
        s.level.generator += 2; s.level.mine += 2;
        setIncome(s);
        expect(cryoPrice(s, 4)).toBe(v);
        // a price is still inside PRICE_AHEAD times its band when it is set
        const fresh = banded(s, 'cryo', 1.2345e40);
        expect(fresh).toBeLessThanOrEqual(PRICE_BAND.cryo[1] * PRICE_AHEAD * s.income.stars * 1.01);
        expect(inc).toBeGreaterThan(0);
    });
    test('the price survives the save (it lives on the state)', () => {
        const s = colony();
        setIncome(s);
        const v = cryoPrice(s, 4);
        const t = JSON.parse(JSON.stringify(s));
        t.level.generator += 3;
        setIncome(t);
        expect(cryoPrice(t, 4)).toBe(v);
    });
});

describe('the restart costs (B414)', () => {
    test('a restart loses half of what the sleep brought, and the lamp and the line say so', () => {
        const s = { ...initialDeepState(), stars: 1000, minerals: 500 };
        const lost = rebootLoss(s, { stars: 400, ore: 100 });
        expect(lost.stars).toBeCloseTo(400 * REBOOT_LOSS, 9);
        expect(lost.ore).toBeCloseTo(100 * REBOOT_LOSS, 9);
        expect(s.stars).toBeCloseTo(1000 - 200, 9);
        expect(wakeWord({ kind: 'reboot', lost })).toMatch(/^FAULT: LOST ★ /);
        expect(wakeWord({ kind: 'reboot' })).toBe('FAULT: THE MIND RESTARTED');
        expect(wakeWhy({ kind: 'reboot', lost }, true)).toBe(WAKE_WHY.lost);
        // never more than is in the store
        const poor = { ...initialDeepState(), stars: 10, minerals: 0 };
        expect(rebootLoss(poor, { stars: 1e6, ore: 1e6 }).stars).toBe(10);
        expect(poor.stars).toBe(0);
    });
});

describe('every click on the colony counts (B415)', () => {
    test('a quick rhythm steadies faster than one click every four seconds, with diminishing returns', () => {
        const w = { ...initialWatcher(), stability: 30, lastSnapAt: 1e6 };
        expect(snapShare(w, 1e6 + 100)).toBe(SNAP_MIN_SHARE);
        expect(snapShare(w, 1e6 + SNAP_COOLDOWN_MS)).toBe(1);
        expect(snapShare(w, 1e6 + 1000)).toBeGreaterThan(0.25);
        const quick = { ...initialWatcher(), stability: 30, lastSnapAt: 1 };
        const slow = { ...initialWatcher(), stability: 30, lastSnapAt: 1 };
        for (let k = 1; k <= 8; k++) snap(quick, 1e6 + k * 500, 2);       // eight clicks in four seconds
        snap(slow, 1e6 + 4000, 2);                                          // one
        expect(quick.stability).toBeGreaterThan(slow.stability);
        expect(quick.stability - 30).toBeLessThan(8 * snapGain({ ...initialWatcher(), stability: 30 }, 2));
    });
});

describe('the culture vats grow people (B416)', () => {
    test('asleep with every bed full, the vats grow people into places of their own', () => {
        const s = initialDeepState({ salvage: 1500, doom0: 85 });
        Object.assign(s, {
            day: 400, minerals: 26000, food: 9000, stars: 9e4, humans: 16, chambers: 9, rooms: { mine: 3, farm: 2, generator: 2, dorm: 1, cryo: 1 },
            level: { mine: 1, farm: 1, generator: 1, dorm: 0 }, auto: { mine: 1, farm: 1, generator: 1, dorm: 0 }, cryo: 0, feed: impliedFeed(0),
        });
        const beds = tickDay(JSON.parse(JSON.stringify(s)), false).capacity;
        expect(s.humans).toBeGreaterThanOrEqual(beds - 0.5);
        const without = JSON.parse(JSON.stringify(s));
        sleep(without, 365 * 5, {});
        s.vats = 1;
        sleep(s, 365 * 5, {});
        expect(s.humans).toBeGreaterThan(without.humans + 2);
        expect(s.humans).toBeLessThanOrEqual(beds * (1 + VAT_ROOM[1]) + 0.5);
    });
});
