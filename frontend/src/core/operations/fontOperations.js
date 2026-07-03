export function addFontEntry(presentation, fontEntry) {
  const existing = presentation.slideset.fonts ?? [];
  if (existing.some((f) => f["font-id"] === fontEntry["font-id"])) return presentation;
  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      fonts: [...existing, fontEntry],
    },
  };
}

const FALLBACK_FONT = "Arial";

const scrubFontReferences = (value, fontId) => {
  if (Array.isArray(value)) return value.map((item) => scrubFontReferences(item, fontId));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "font" && child === fontId
        ? FALLBACK_FONT
        : scrubFontReferences(child, fontId),
    ]),
  );
};

export function removePresentationFont(presentation, fontId) {
  const scrubbed = scrubFontReferences(presentation, fontId);
  return {
    ...scrubbed,
    slideset: {
      ...scrubbed.slideset,
      fonts: (scrubbed.slideset.fonts ?? []).filter((f) => f["font-id"] !== fontId),
    },
  };
}
