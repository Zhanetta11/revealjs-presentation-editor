export const IMAGE_STYLES = [
  { id: "none", label: "No Style", group: null, css: {} },

  // Frames
  { id: "simple-white",  label: "Simple Frame, White",  group: "frames", css: {
    border: "4px solid #ffffff",
    boxShadow: "0 0 0 1px #d1d5db, 2px 2px 6px rgba(0,0,0,0.15)",
  }},
  { id: "simple-gray",   label: "Simple Frame, Gray",   group: "frames", css: {
    border: "4px solid #9ca3af",
  }},
  { id: "simple-black",  label: "Simple Frame, Black",  group: "frames", css: {
    border: "4px solid #111827",
  }},
  { id: "thick-black",   label: "Thick Black Frame",    group: "frames", css: {
    border: "10px solid #111827",
  }},
  { id: "double-border", label: "Double Border",        group: "frames", css: {
    border: "3px solid #111827",
    outline: "3px solid #111827",
    outlineOffset: "3px",
  }},
  { id: "white-double",  label: "White Double Border",  group: "frames", css: {
    border: "3px solid #ffffff",
    outline: "3px solid #ffffff",
    outlineOffset: "3px",
    boxShadow: "0 0 0 6px #9ca3af",
  }},

  // Rounded
  { id: "rounded",        label: "Rounded Corners",      group: "rounded", css: {
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
  }},
  { id: "rounded-white",  label: "Rounded White Frame",  group: "rounded", css: {
    borderRadius: "12px",
    border: "5px solid #ffffff",
    boxShadow: "0 0 0 1px #d1d5db, 0 4px 12px rgba(0,0,0,0.2)",
  }},
  { id: "rounded-shadow", label: "Rounded with Shadow",  group: "rounded", css: {
    borderRadius: "12px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
  }},
  { id: "soft-edge",      label: "Soft Edge",            group: "rounded", css: {
    borderRadius: "24px",
  }},
  { id: "oval",           label: "Oval",                 group: "rounded", css: {
    borderRadius: "50%",
  }},
  { id: "oval-white",     label: "Oval White Frame",     group: "rounded", css: {
    borderRadius: "50%",
    border: "5px solid #ffffff",
    boxShadow: "0 0 0 1px #9ca3af",
  }},
  { id: "oval-black",     label: "Oval Black Frame",     group: "rounded", css: {
    borderRadius: "50%",
    border: "4px solid #111827",
  }},

  // Shadows
  { id: "drop-shadow",       label: "Drop Shadow",              group: "shadows", css: {
    boxShadow: "5px 5px 14px rgba(0,0,0,0.35)",
  }},
  { id: "offset-shadow",     label: "Offset Shadow",            group: "shadows", css: {
    boxShadow: "8px 8px 0 rgba(0,0,0,0.18)",
  }},
  { id: "perspective-left",  label: "Perspective Shadow Left",  group: "shadows", css: {
    boxShadow: "-8px 8px 0 rgba(0,0,0,0.15)",
  }},
  { id: "glow-blue",         label: "Blue Glow",                group: "shadows", css: {
    boxShadow: "0 0 12px 4px rgba(99,102,241,0.6)",
  }},
  { id: "glow-white",        label: "White Glow",               group: "shadows", css: {
    boxShadow: "0 0 0 3px #ffffff, 0 0 16px 4px rgba(255,255,255,0.7)",
  }},

  // Special
  { id: "tilted-right",   label: "Tilted Right",    group: "special", css: {
    transform: "rotate(3deg)",
    boxShadow: "2px 4px 10px rgba(0,0,0,0.25)",
  }},
  { id: "tilted-left",    label: "Tilted Left",     group: "special", css: {
    transform: "rotate(-3deg)",
    boxShadow: "-2px 4px 10px rgba(0,0,0,0.25)",
  }},
  { id: "compound",       label: "Compound Frame",  group: "special", css: {
    border: "4px solid #1e293b",
    outline: "2px solid #94a3b8",
    outlineOffset: "3px",
  }},
  { id: "metal",          label: "Metal Frame",     group: "special", css: {
    border: "6px solid",
    borderColor: "#d1d5db #6b7280 #6b7280 #e5e7eb",
    boxShadow: "1px 1px 4px rgba(0,0,0,0.2)",
  }},
  { id: "inset-shadow",   label: "Inset Shadow",    group: "special", css: {
    boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15)",
    border: "2px solid #e5e7eb",
  }},
  { id: "accent-border",  label: "Accent Border",   group: "special", css: {
    border: "4px solid transparent",
    boxShadow: "0 0 0 4px #6366f1, 0 4px 12px rgba(99,102,241,0.3)",
  }},
];

export function getStyleById(id) {
  if (!id || id === "none") return IMAGE_STYLES[0];
  const found = IMAGE_STYLES.find((s) => s.id === id);
  if (!found) console.warn(`[imageStyles] Unknown style id: "${id}"`);
  return found ?? IMAGE_STYLES[0];
}
