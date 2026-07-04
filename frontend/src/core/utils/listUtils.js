const toRoman = (n) => {
  if (!Number.isFinite(n) || n <= 0) return "";
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];

  let result = "";

  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) {
      result += syms[i];
      n -= vals[i];
    }
  }

  return result;
};

const toAlpha = (n, upper = false) => {
  if (!Number.isFinite(n) || n <= 0) return "";

  let result = "";

  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }

  return upper ? result.toUpperCase() : result;
};

const LIST_INDENT_PX = 24;

export const MAX_LIST_INDENT_LEVEL = 4;
export const LIST_MARKER_WIDTH_EM = 1.8;

export const getListIndent = (level = 0, listType) =>
  listType
    ? `${Math.min(level, MAX_LIST_INDENT_LEVEL) * LIST_INDENT_PX}px`
    : "0px";

export const getListMarker = (
  index = 0,
  listType,
  listMarker,
  listNumberedStyle
) => {
  if (listType === "bullets") return listMarker ?? "•";

  const n = index + 1;

  switch (listNumberedStyle) {
    case "lower-alpha":
      return `${toAlpha(n)}.`;
    case "upper-alpha":
      return `${toAlpha(n, true)}.`;
    case "lower-roman":
      return `${toRoman(n).toLowerCase()}.`;
    case "upper-roman":
      return `${toRoman(n)}.`;
    default:
      return `${n}.`;
  }
};
