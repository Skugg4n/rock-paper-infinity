/* eslint-env jest */
import { toRoman } from './roman.js';

describe('toRoman', () => {
  test('converts numbers to Roman numerals', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(58)).toBe('LVIII');
    expect(toRoman(1994)).toBe('MCMXCIV');
    expect(toRoman(3999)).toBe('MMMCMXCIX');
  });

  test('uses a vinculum for thousands from 4000 up', () => {
    expect(toRoman(4000)).toBe('I\u0305V\u0305');
    expect(toRoman(10000)).toBe('X\u0305');
    expect(toRoman(22000)).toBe('X\u0305X\u0305I\u0305I\u0305');
    expect(toRoman(12345)).toBe('X\u0305I\u0305I\u0305CCCXLV');
  });
});
