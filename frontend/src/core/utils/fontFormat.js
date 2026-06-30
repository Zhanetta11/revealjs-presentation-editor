export function fontFormat(originalPath, mimeType = "") {
  const source = `${originalPath} ${mimeType}`.toLowerCase();
  if (source.includes("woff2")) return "woff2";
  if (source.includes("woff")) return "woff";
  if (source.includes("ttf") || source.includes("truetype")) return "truetype";
  if (source.includes("otf") || source.includes("opentype")) return "opentype";
  return "woff";
}

export function fontExtension(format) {
  if (format === "truetype") return "ttf";
  if (format === "opentype") return "otf";
  return format;
}
