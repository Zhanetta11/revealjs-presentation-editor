import { createDefaultLayouts } from "./defaultLayouts";
import { DESIGN_THEMES } from "./designThemes";
import { createId, createParagraphId } from "../utils/presentationUtils";
import { DEFAULT_TRANSITION } from "./transitionDefaults";

const createTextFormatting = ({
  size = "28px",
  color = "var(--text-dark)",
  weight = "normal",
  italics = false,
  textDecoration = "none",
  align = "left",
  verticalAlign = "top",
  lineSpacing = "1.4em",
} = {}) => ({
  size,
  color,
  weight,
  italics,
  "text-decoration": textDecoration,
  "line-spacing": lineSpacing,
  "list-type": "none",
  "list-style": {},
  "indent-level": 0,
  margin: "0",
  align,
  "vertical-align": verticalAlign,
});

const createTextElement = ({
  placeholderId,
  x,
  y,
  width,
  height,
  zIndex = 1,
  text = "",
  formatting,
  posType = "relative-to-placeholder",
}) => ({
  id: createId("text"),
  "placeholder-id": placeholderId,
  position: { x, y },
  "pos-type": posType,
  width,
  height,
  rotation: 0,
  overflow: "auto-fit",
  "z-index": zIndex,
  background: "transparent",
  userModified: false,
  paragraphs: [
    {
      id: createParagraphId(),
      formatting,
      bullets: "none",
      runs: [
        {
          formatting: {},
          "super-sub-script": "normal",
          text,
          link: null,
        },
      ],
    },
  ],
});

const createDefaultSlideContents = ({
  text = [],
  media = [],
  background = "var(--bg-light)",
  transition = DEFAULT_TRANSITION,
  notes = "",
  comments = [],
} = {}) => ({
  text,
  shapes: [],
  media,
  tables: [],
  groups: [],
  animations: [],
  background,
  transition,
  notes,
  comments,
});

export const createDefaultPresentation = () => {
  const titleFormatting = createTextFormatting({
    size: "44px",
    weight: "bold",
    align: "center",
    verticalAlign: "middle",
    lineSpacing: "1.2em",
  });

  const bodyFormatting = createTextFormatting();

  const layouts = createDefaultLayouts({
    titleFormatting,
    bodyFormatting,
  });

  const defaultLayout = layouts.find(
    (layout) => layout["layout-id"] === "title-content",
  );

  if (!defaultLayout) {
    throw new Error(
      "Default layout 'title-content' not found in createDefaultLayouts",
    );
  }

  const titlePlaceholder = defaultLayout.placeholders.find(
    (p) => p["placeholder-id"] === "title-placeholder",
  );
  const bodyPlaceholder = defaultLayout.placeholders.find(
    (p) => p["placeholder-id"] === "body-placeholder",
  );

  if (!titlePlaceholder || !bodyPlaceholder) {
    throw new Error("Required placeholders missing from default layout 'title-content'");
  }

  return {
    slideset: {
      filename: "untitled-presentation.json",
      title: "Untitled Presentation",
      author: "",
      "creation-date": new Date().toISOString().split("T")[0],

      fonts: [],

      master: {
        formatting: {
          font: "Arial",
          color: "var(--text-dark)",
          size: "24px",
          weight: "normal",
          italics: false,
          "text-decoration": "none",
          "line-spacing": "1.4em",
          align: "left",
          "vertical-align": "top",
        },
        "aspect-ratio": "16:9",
        "slide-dimensions": {
          width: 1280,
          height: 720,
        },
        "dimension-units": "px",
        "color-theme": (DESIGN_THEMES.find((t) => t.id === "default") ?? DESIGN_THEMES[0]).colorTheme,
        elements: {
          text: [],
          shapes: [],
          media: [],
        },
      },

      layouts,

      slides: [
        {
          title: {
            content: "First Slide",
          },
          "layout-id": "title-content",
          hidden: false,
          contents: createDefaultSlideContents({
            text: [
              createTextElement({
                placeholderId: "title-placeholder",
                x: titlePlaceholder.position.x,
                y: titlePlaceholder.position.y,
                width: titlePlaceholder.width,
                height: titlePlaceholder.height,
                zIndex: 1,
                text: "My First Slide",
                formatting: {},
              }),
              createTextElement({
                placeholderId: "body-placeholder",
                x: bodyPlaceholder.position.x,
                y: bodyPlaceholder.position.y,
                width: bodyPlaceholder.width,
                height: bodyPlaceholder.height,
                zIndex: 2,
                text: "Start editing your presentation.",
                formatting: {},
              }),
            ],
            media: [],
          }),
        },
      ],
    },
  };
};
