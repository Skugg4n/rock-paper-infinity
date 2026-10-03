/* eslint-env jest */
/*
 * deep-copy: chapter IV in plain words (Ola, after playing v1.67). The tree's info box is four plain
 * lines and a quiet fifth; every price is said in words; no line uses an internal name ("cap",
 * "next:", "SYSTEM:"), a colon chain or an em-dash.
 */
import { initialDeepState } from './deep.js';
import {
    NODES, infoLines, stateLine, costLine, effectLine, doesOf, buy, CAPACITY_WORDS,
} from './tree.js';
import { initialWatcher, LADDER } from './watcher.js';
import { scoutLine, alarmLine } from './advisor.js';
import { machineSays } from './machine.js';
import { SPREAD_TIP } from './crust.js';

const start = (o = {}) => ({ ...initialDeepState({ salvage: 1500, doom0: 85 }), watcher: initialWatcher(), ...o });
/** A colony past its first sleep with a hall, asleep, with the capacity and stars to buy the first step. */
function sleeping() {
    const s = start({ stars: 1e6, cryo: 0, asleep: true });
    s.rooms = { ...s.rooms, cryo: 1 };
    s.watcher.sleeps = 2;
    s.watcher.capacity = 25;
    return s;
}
const BAD = /\bcap\b|^next\b|\bnext:|SYSTEM:|HARDWARE:|BIOLOGICAL:|[\u2012-\u2015]|\/d\b/;

describe('the price in words', () => {
    test('stars first, then capacity, ore, a dormitory, people', () => {
        expect(costLine({ currency: 'cap+stars', cap: 20, stars: 2e4 })).toBe('Costs ★ 20 k and 20 capacity.');
        expect(costLine({ currency: 'stars', stars: 4e4 })).toBe('Costs ★ 40 k.');
        expect(costLine({ cap: 60, stars: 5e8, ore: 1e6, beds: 1 })).toBe('Costs ★ 500 M, 60 capacity, ⛏ 1 M and a dormitory.');
        expect(costLine(null)).toBe('');
    });
});

describe('the info box: four plain lines', () => {
    test('Seam at the descent: name, level, what it does, the price, and that it can be bought', () => {
        const s = start({ stars: 1e4 });
        const L = infoLines(s, 'seam', { starsPerDay: 0 });
        expect(L).toMatchObject({
            name: 'SEAM', lvl: '0 / 20',
            does: 'Every mine makes twice as much and costs a little more to run.',
            cost: 'Costs ★ 4.4 k.', state: 'You can buy it. Shift-click buys all you can.', tone: 'go',
        });
    });
    test('short of stars: how many more', () => {
        const s = start({ stars: 400 });
        expect(stateLine(s, 'seam', { starsPerDay: 0 })).toEqual({ text: 'You need ★ 4 k more.', tone: 'why' });
    });
    test('an order under way: being built, and how long', () => {
        const s = start({ stars: 1e4 });
        buy(s, 'seam', {});
        const t = stateLine(s, 'seam', {}).text;
        expect(t).toMatch(/^Being built: \d+ days? left\.$/);
        expect(infoLines(s, 'seam', {}).lvl).toBe('0 / 20');
    });
    test('locked for a reason: the mode, the node before it, the hall\'s road', () => {
        const s = start({ stars: 5e3 });
        s.asleep = true;
        expect(stateLine(s, 'seam', {}).text).toBe('Only while the colony is awake.');
        s.asleep = false;
        expect(stateLine(s, 'cryo-iii', {}).text).toBe('Opens after Cryo II.');
        expect(stateLine(s, 'cryo-i', {}).text).toMatch(/^Needs generators automated, .+ and ★ 7.5 k\.$/);       // deep-pass3: Cryo I ★ 7.5 k
    });
    test('the first time capacity shows, its node says what capacity is; once a step is bought, no more', () => {
        const s = sleeping();
        expect(doesOf(s, 'watchdog')).toBe(`Stability falls more slowly while they sleep. ${CAPACITY_WORDS}`);
        expect(infoLines(s, 'watchdog', {}).cost).toBe('Costs ★ 20 k and 20 capacity.');
        expect(stateLine(s, 'watchdog', {}).text).toBe('You can buy it.');
        s.watcher.bought = ['watchdog'];
        expect(doesOf(s, 'scheduler')).toBe('The build queue keeps going while they sleep.');
        expect(stateLine(s, 'scheduler', {}).text).toBe('You need 5 more capacity.');
        s.asleep = false;
        expect(stateLine(s, 'scheduler', {}).text).toBe('Only while the colony sleeps.');
    });
    test('the numbers are a quiet line of their own, starting with a capital', () => {
        const s = sleeping();
        expect(effectLine(s, 'watchdog')).toMatch(/^Drift \d\.\d\d → \d\.\d\d a second\.$/);
        expect(effectLine(s, 'cryo-ii')).toBe('');
    });
    test('no line on any node uses an internal name, a colon chain or an em-dash', () => {
        const states = [start(), start({ stars: 1e12 }), sleeping()];
        const late = sleeping();
        late.watcher.bought = LADDER.filter((u) => u.rung < 2).map((u) => u.id);
        late.tree = { opened: ['lossless', 'cold', 'quiet', 'question'], bought: ['question'], unseen: false };
        states.push(late);
        for (const s of states) {
            for (const n of NODES) {
                const L = infoLines(s, n.id, {});
                for (const k of ['name', 'lvl', 'does', 'cost', 'state']) expect(`${n.id} ${L[k]}`).not.toMatch(BAD);
                // at most one colon, and only in "Being built: N days left."
                expect(L.does).not.toMatch(/:/);
                expect(L.cost).not.toMatch(/:/);
            }
        }
    });
});

describe('the other lines of the chapter', () => {
    test('no odds, no "A: B", no "+81/d"', () => {
        expect(SPREAD_TIP).toBe('What the scouts believe. More scouts, less doubt.');
        expect(machineSays({ fed: 1, games: 243, stars: 81 })).not.toMatch(BAD);
        expect(scoutLine({ outcome: 'reading', reading: 93 })).not.toMatch(/: /);
        expect(alarmLine({ kind: 'estimate', est: { mean: 10, spread: 3 } })).not.toMatch(/±/);
    });
});
