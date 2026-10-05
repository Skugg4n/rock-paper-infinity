/* eslint-env jest */
import { chosenDeep, nextDeep, deepModule } from './deepVersion.js';

describe('which chapter IV', () => {
    test('the URL wins, then the kept choice, then the old act', () => {
        expect(chosenDeep('?deep=vault', 'colony')).toBe('vault');
        expect(chosenDeep('?debug&deep=colony', 'vault')).toBe('colony');
        expect(chosenDeep('?deep=dig&debug', null)).toBe('dig');
        expect(chosenDeep('', 'vault')).toBe('vault');
        expect(chosenDeep('', 'dig')).toBe('dig');
        expect(chosenDeep('', null)).toBe('colony');
        expect(chosenDeep('?deep=other', 'nonsense')).toBe('colony');
    });
    test('the debug item cycles colony, vault, dig', () => {
        expect(nextDeep('colony')).toBe('vault');
        expect(nextDeep('vault')).toBe('dig');
        expect(nextDeep('dig')).toBe('colony');
    });
    test('where each one lives', () => {
        expect(deepModule('vault')).toBe('./phase4v/index.js');
        expect(deepModule('dig')).toBe('./phase4d/index.js');
        expect(deepModule('colony')).toBe('./phase4/index.js');
    });
});
