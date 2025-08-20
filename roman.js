function toRoman(num) {
  if (num < 1) return "";
  const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let str = "";
  for (const key of Object.keys(roman)) {
    const q = Math.floor(num / roman[key]);
    num -= q * roman[key];
    str += key.repeat(q);
  }
  return str;
}

if (typeof module !== 'undefined') {
  module.exports = { toRoman };
}
