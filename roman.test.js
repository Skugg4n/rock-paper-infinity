/* eslint-env jest */
const { toRoman } = require('./roman');

describe('toRoman', () => {
  test('converts numbers to Roman numerals', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(58)).toBe('LVIII');
    expect(toRoman(1994)).toBe('MCMXCIV');
  });
});
