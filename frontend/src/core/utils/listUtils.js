export const toRoman = (n) => {
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

export const toAlpha = (n, upper = false) => {
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

export const increaseIndent = (currentFormatting = {}) => ({
  "indent-level": Math.min(
    MAX_LIST_INDENT_LEVEL,
    (currentFormatting["indent-level"] ?? 0) + 1
  ),
});

export const decreaseIndent = (currentFormatting = {}) => {
  const level = currentFormatting["indent-level"] ?? 0;

  if (level <= 0) {
    return {
      "list-type": "none",
      "list-marker": null,
      "list-numbered-style": null,
      "indent-level": 0,
    };
  }

  return {
    "indent-level": level - 1,
  };
};

export const toggleList = (
  currentFormatting = {},
  type,
  defaultStyle
) => {
  const isActive = currentFormatting["list-type"] === type;

  if (isActive) {
    return {
      "list-type": "none",
      "list-marker": null,
      "list-numbered-style": null,
      "indent-level": 0,
    };
  }

  if (type === "bullets") {
    return {
      "list-type": "bullets",
      "list-marker": defaultStyle ?? currentFormatting["list-marker"] ?? "•",
      "list-numbered-style": null,
      "indent-level": currentFormatting["indent-level"] ?? 0,
    };
  }

  return {
    "list-type": "numbered",
    "list-numbered-style":
      defaultStyle ?? currentFormatting["list-numbered-style"] ?? "decimal",
    "list-marker": null,
    "indent-level": currentFormatting["indent-level"] ?? 0,
  };
};
