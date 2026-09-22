/* eslint-env jest */
import {
    TIERS, doomsday, waveInterval, waveSize, nextEnemyTierAt, pickTarget, resolveHit, resolveStrike, plateMaxHp, rng,
    enemyCatchUp, autoBuy, tierScienceCost, DOOMSDAY_SCALE, relativePower, resolveLanding, resolveOurStrike, canRazeTile, ENEMY_TILE_HP,
    waveStandingK, defenceStandingK, ENEMY_DEFENCE_REGROW, enemyDefenceCap, RESEARCH_CATCHUP,
    FIRST_TIER_PREMIUM, quartermasterBudget, QM_KEEP_S, STANCES, revealNext, isShown, REVEAL_GAP_S, TIER_REVEAL_S, hpYield,
} from './war.js';

describe('war rules', () => {
    test('the ladder climbs: every tier stronger and dearer than the last', () => {
        for (let i = 1; i < TIERS.length; i++) {
            expect(TIERS[i].power).toBeGreaterThan(TIERS[i - 1].power);
            expect(TIERS[i].scorch).toBeGreaterThanOrEqual(TIERS[i - 1].scorch);
        }
        expect(TIERS[0].id).toBe('fists');
        expect(TIERS[TIERS.length - 1].id).toBe('nuclear');
    });

    test('doomsday is slow at first and saturates at 100', () => {
        expect(doomsday(0)).toBe(0);
        expect(doomsday(10)).toBeLessThan(5);
        expect(doomsday(DOOMSDAY_SCALE)).toBeCloseTo(63.2, 0);
        expect(doomsday(1e6)).toBeCloseTo(100, 5);
    });

    test('waves come faster and bigger', () => {
        expect(waveInterval(0)).toBe(40);
        expect(waveInterval(100)).toBe(20);       // never faster than one landing per 20 s
        expect(waveSize(0)).toBe(10);
        expect(waveSize(10)).toBeGreaterThan(waveSize(0));
    });

    test('enemy tier timing has jitter but stays in range', () => {
        const rand = rng(1);
        for (let i = 0; i < 20; i++) {
            const t = nextEnemyTierAt(1000, rand, 0);
            expect(t).toBeGreaterThanOrEqual(1000 + 74);
            expect(t).toBeLessThanOrEqual(1000 + 102);
            expect(nextEnemyTierAt(0, () => 0.5, 4)).toBeGreaterThan(nextEnemyTierAt(0, () => 0.5, 0));
        }
    });

    test('while they are behind they push their laboratory harder', () => {
        const even = nextEnemyTierAt(0, () => 0.5, 2, 0);
        const chasing = nextEnemyTierAt(0, () => 0.5, 2, 1);
        expect(chasing).toBeCloseTo(even / 2, 5);
        expect(nextEnemyTierAt(0, () => 0.5, 2, -1)).toBeCloseTo(even, 5);   // a lead of ours does not slow them further
    });

    test('razing their island thins their landings but never their defence', () => {
        expect(waveStandingK(5)).toBe(1);
        expect(waveStandingK(2)).toBe(0.4);
        expect(waveStandingK(0)).toBe(0);          // silent: nothing sails
        expect(defenceStandingK(1)).toBe(1);       // one building left, full shield
        expect(defenceStandingK(5)).toBe(1);
        expect(defenceStandingK(0)).toBe(0);
    });

    test('their shield grows with our weapons, so a raze needs a build-up', () => {
        expect(ENEMY_DEFENCE_REGROW(4)).toBeGreaterThan(ENEMY_DEFENCE_REGROW(0));
        expect(enemyDefenceCap(20, 4)).toBeGreaterThan(enemyDefenceCap(20, 0));
        expect(enemyDefenceCap(0, 0)).toBe(40);
        // at an equal tier their shield is worth roughly a serious build-up of force
        expect(canRazeTile(120, 4, 4, enemyDefenceCap(30, 4))).toBe(false);
    });

    test('pickTarget prefers weak, valuable, coastal plates but stays random', () => {
        const plates = [
            { id: 1, type: 'district', fort: 0, row: 3, razed: false },
            { id: 2, type: 'home', fort: 5, row: 0, razed: false },
            { id: 3, type: 'factory', fort: 0, row: 0, razed: false },
            { id: 4, type: 'home', fort: 0, row: 3, razed: true },
        ];
        const rand = rng(7);
        const counts = { 1: 0, 2: 0 };
        for (let i = 0; i < 500; i++) counts[pickTarget(plates, rand).id]++;
        expect(counts[1]).toBeGreaterThan(counts[2] * 3);
        expect(counts[2]).toBeGreaterThan(0);          // never fully predictable
        expect(pickTarget([], rand)).toBeNull();
    });

    test('resolveHit: defence absorbs, the rest hits the plate', () => {
        const stopped = resolveHit({ power: 10, defence: 20, defencePower: 1, hp: 10 });
        expect(stopped.razed).toBe(false);
        expect(stopped.hpLeft).toBe(7);          // 30 % always reaches the plate
        expect(stopped.defenceLost).toBeGreaterThan(0);
        const through = resolveHit({ power: 30, defence: 5, defencePower: 1, hp: 10 });
        expect(through.razed).toBe(true);
        expect(through.hpLeft).toBe(0);
        const scratch = resolveHit({ power: 12, defence: 5, defencePower: 1, hp: 10 });
        expect(scratch.razed).toBe(false);
        expect(scratch.hpLeft).toBe(3);
        const capped = resolveHit({ power: 100, defence: 1000, defencePower: 10, hp: 50 });
        expect(capped.hpLeft).toBe(20);
    });

    test('resolveStrike razes a tile when force beats their defence and HP', () => {
        const r = resolveStrike({ force: 40, power: 4, enemyDefence: 10, enemyPower: 2, tileHp: 60 });
        expect(r.razed).toBe(true);
        expect(r.forceLeft).toBe(20);
        expect(r.enemyDefenceLeft).toBeLessThan(10);
        const weak = resolveStrike({ force: 5, power: 1, enemyDefence: 10, enemyPower: 2, tileHp: 60 });
        expect(weak.razed).toBe(false);
        expect(weak.tileHpLeft).toBe(60);
    });

    test('enemyCatchUp keeps the enemy within one tier', () => {
        expect(enemyCatchUp(5, 2)).toBe(4);
        expect(enemyCatchUp(2, 5)).toBe(5);
        expect(enemyCatchUp(0, 0)).toBe(0);
    });

    test('autoBuy alternates and never overspends', () => {
        expect(autoBuy(55, 0, 0, 10)).toEqual({ defence: 3, force: 2 });
        expect(autoBuy(9, 0, 0, 10)).toEqual({ defence: 0, force: 0 });
        expect(autoBuy(30, 0, 10, 10)).toEqual({ defence: 3, force: 0 });
        // the stances are ratios, not either-or: shield 3 : 1, sword 1 : 3
        expect(autoBuy(40, 0, 0, 10, 'defend')).toEqual({ defence: 3, force: 1 });
        expect(autoBuy(40, 0, 0, 10, 'attack')).toEqual({ defence: 1, force: 3 });
        expect(autoBuy(80, 30, 0, 10, 'defend')).toEqual({ defence: 0, force: 8 });
    });

    test('the quartermaster leaves a reserve in the yard and never strikes', () => {
        expect(quartermasterBudget(100, 2)).toBe(100 - QM_KEEP_S * 2);
        expect(quartermasterBudget(10, 2)).toBe(0);
        expect(STANCES).toContain('off');
    });

    test('controls open one at a time, in order, and never close', () => {
        const w = { t: 0, force: 0, landings: 0, tier: 0 };
        expect(revealNext(w)).toBeNull();                 // only the basics at the start
        w.force = 3; w.landings = 2;
        expect(revealNext(w)).toBe('strike');
        expect(revealNext(w)).toBeNull();                 // the next waits its turn
        w.t = REVEAL_GAP_S; expect(revealNext(w)).toBe('fort');
        w.t += REVEAL_GAP_S; expect(revealNext(w)).toBe('radar');
        w.force = 0; w.t += REVEAL_GAP_S;
        expect(isShown(w, 'strike')).toBe(true);         // sticky
        // the tier button waits for both the clock and four landings
        w.landings = 4; w.t = TIER_REVEAL_S - 1; expect(revealNext(w)).toBeNull();
        w.t = TIER_REVEAL_S; expect(revealNext(w)).toBe('tier');
    });

    test('a damaged plate yields its share of HP', () => {
        expect(hpYield(5, 10)).toBe(0.5);
        expect(hpYield(undefined, 10)).toBe(1);
        expect(hpYield(-3, 10)).toBe(0);
        expect(hpYield(20, 10)).toBe(1);
    });

    test('tier cost ignores the current slider and grows per tier', () => {
        expect(tierScienceCost(1, 1000)).toBe(70000 * FIRST_TIER_PREMIUM);   // the first rung is the lesson
        expect(tierScienceCost(3, 1000)).toBeGreaterThan(tierScienceCost(2, 1000));
        expect(tierScienceCost(2, 1000)).toBe(Math.round(70000 * 1.26));
        expect(tierScienceCost(1, 0)).toBe(35000 * FIRST_TIER_PREMIUM);
    });

    test('research under fire is dear, a lead is cheap to keep', () => {
        const level = tierScienceCost(3, 1000, 0);
        expect(tierScienceCost(3, 1000, 1)).toBeCloseTo(level * RESEARCH_CATCHUP, -1);
        expect(tierScienceCost(3, 1000, -1)).toBeCloseTo(level / RESEARCH_CATCHUP, -1);
        // the hole never gets deeper than two tiers
        expect(tierScienceCost(3, 1000, 5)).toBe(tierScienceCost(3, 1000, 2));
        expect(tierScienceCost(3, 1000, -5)).toBe(tierScienceCost(3, 1000, -1));
    });

    test('weapons are relative: equal tiers fight at 1, a tier ahead roughly doubles', () => {
        expect(relativePower(3, 3)).toBe(1);
        expect(relativePower(4, 3)).toBeGreaterThan(1.5);
        expect(relativePower(3, 4)).toBeLessThan(0.7);
        // same tier, decent defence: a skyscraper takes a wave and stands
        const equal = resolveLanding({ size: 40, enemyTier: 2, ourTier: 2, defence: 40, hp: 40 });
        expect(equal.razed).toBe(false);
        expect(equal.hpLeft).toBe(28);
        // two tiers ahead: the same wave razes it whatever the defence
        const ahead = resolveLanding({ size: 40, enemyTier: 4, ourTier: 2, defence: 400, hp: 40 });
        expect(ahead.razed).toBe(true);
        // our strike: equal tiers need defence + tile in units
        expect(canRazeTile(160, 2, 2, 45, ENEMY_TILE_HP)).toBe(false);
        expect(canRazeTile(170, 2, 2, 45, ENEMY_TILE_HP)).toBe(true);
        expect(canRazeTile(170, 2, 3, 45, ENEMY_TILE_HP)).toBe(false);   // a tier behind: not enough
        expect(canRazeTile(0, 5, 0, 0, 1)).toBe(false);
        const r = resolveOurStrike({ force: 170, ourTier: 2, enemyTier: 2, enemyDefence: 45, tileHp: ENEMY_TILE_HP });
        expect(r.razed).toBe(true);
        expect(r.forceLeft).toBe(85);
    });

    test('plateMaxHp adds fortification', () => {
        expect(plateMaxHp('home')).toBe(10);
        expect(plateMaxHp('home', 2)).toBe(34);
        expect(plateMaxHp('unknown')).toBe(10);
    });
});
