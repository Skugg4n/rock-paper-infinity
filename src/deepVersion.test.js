/* eslint-env jest */
import { chosenDeep, otherDeep, deepModule } from './deepVersion.js';

describe('which chapter IV', () => {
    test('the URL wins, then the kept choice, then the old act', () => {
        expect(chosenDeep('?deep=vault', 'colony')).toBe('vault');
        expect(chosenDeep('?debug&deep=colony', 'vault')).toBe('colony');
        expect(chosenDeep('', 'vault')).toBe('vault');
        expect(chosenDeep('', null)).toBe('colony');
        expect(chosenDeep('?deep=other', null)).toBe('colony');
    });
    test('the other one, and where it lives', () => {
        expect(otherDeep('vault')).toBe('colony');
        expect(otherDeep('colony')).toBe('vault');
        expect(deepModule('vault')).toBe('./phase4v/index.js');
        expect(deepModule('colony')).toBe('./phase4/index.js');
    });
});
