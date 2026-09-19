/**
 * Roman numerals. Above 3999 the thousands get a vinculum (overline):
 * V̄ = 5 000, X̄ = 10 000, C̄ = 100 000. Returns HTML-free text; the overline
 * is a combining character (U+0305) so it renders in any font.
 *
 * @param {number} num
 * @returns {string}
 */
function toRoman(num) {
  if (num < 1) return "";
  num = Math.round(num);
  const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  const convert = (n) => {
    let str = "";
    for (const key of Object.keys(roman)) {
      const q = Math.floor(n / roman[key]);
      n -= q * roman[key];
      str += key.repeat(q);
    }
    return str;
  };
  if (num < 4000) return convert(num);
  const thousands = Math.floor(num / 1000);
  const rest = num % 1000;
  const barred = [...convert(thousands)].map(ch => ch + "\u0305").join("");
  return barred + convert(rest);
}

export { toRoman };
