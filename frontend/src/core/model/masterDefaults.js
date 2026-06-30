import { createId, createParagraphId } from "../utils/presentationUtils";

export const TITLE_PLACEHOLDER = {
  "placeholder-id": "title-placeholder",
  position: { x: 120, y: 80 },
  width: 1040,
  height: 90,
  type: "text",
  role: "title",
  padding: { css: "8px" },
  background: "#FFFFFF00",
  formatting: {
    size: "44px",
    color: "var(--text-dark)",
    weight: "bold",
    italics: false,
    "text-decoration": "none",
    "line-spacing": "1.2em",
    "list-type": "none",
    "indent-level": 0,
    margin: "0",
    align: "center",
    "vertical-align": "middle",
  },
};

export const FOOTER_PLACEHOLDERS = [
  { "placeholder-id": "footer-date",   position: { x: 60,  y: 640 }, width: 260, height: 40, type: "text", role: "footer", padding: { css: "4px" }, background: "#FFFFFF00", formatting: { size: "20px", align: "center" }, promptText: "Date" },
  { "placeholder-id": "footer-center", position: { x: 380, y: 640 }, width: 520, height: 40, type: "text", role: "footer", padding: { css: "4px" }, background: "#FFFFFF00", formatting: { size: "20px", align: "center" }, promptText: "Footer" },
  { "placeholder-id": "footer-page",   position: { x: 960, y: 640 }, width: 260, height: 40, type: "text", role: "slide-number", padding: { css: "4px" }, background: "#FFFFFF00", formatting: { size: "20px", align: "center" }, promptText: "#" },
];

export const createMasterTextElement = (id, position, width, height, text, formatting) => ({
  id,
  "placeholder-id": null,
  position,
  width,
  height,
  rotation: 0,
  overflow: "auto-fit",
  "z-index": 5,
  background: "#FFFFFF00",
  userModified: true,
  paragraphs: [{
    id: `${id}-p`,
    formatting,
    bullets: "none",
    runs: [{ formatting: {}, "super-sub-script": "normal", text, link: null }],
  }],
});

export const createTextElementDefaults = (zIndex, labelText) => ({
  id: createId("text"),
  "placeholder-id": null,
  position: { x: 100, y: 100 },
  width: 300,
  height: 80,
  rotation: 0,
  "z-index": zIndex,
  background: "transparent",
  userModified: true,
  paragraphs: [{
    id: createParagraphId(),
    formatting: { size: "24px", color: "var(--text-dark)", align: "left" },
    bullets: "none",
    runs: [{ formatting: {}, "super-sub-script": "normal", text: labelText, link: null }],
  }],
});
