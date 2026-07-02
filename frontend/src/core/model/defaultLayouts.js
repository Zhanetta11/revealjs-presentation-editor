export const createLayoutPlaceholder = ({
  placeholderId,
  x,
  y,
  width,
  height,
  type = "text",
  role = "body",
  padding = "8px",
  background = "#FFFFFF00",
  formatting = {},
  promptText = undefined,
}) => ({
  "placeholder-id": placeholderId,
  position: { x, y },
  width,
  height,
  padding: { css: padding },
  type,
  role,
  background,
  formatting,
  ...(promptText !== undefined ? { promptText } : {}),
});

export const createDefaultLayouts = ({ titleFormatting, bodyFormatting }) => {
  const makeTitleTop = () =>
    createLayoutPlaceholder({
      placeholderId: "title-placeholder",
      x: 120,
      y: 80,
      width: 1040,
      height: 90,
      type: "text",
      role: "title",
      formatting: titleFormatting,
    });

  const makeBody = ({ placeholderId = "body-placeholder", x, y, width, height, promptText }) =>
    createLayoutPlaceholder({
      placeholderId,
      x,
      y,
      width,
      height,
      type: "text",
      role: "body",
      padding: "12px",
      formatting: bodyFormatting,
      promptText,
    });

  const makeCaption = ({ placeholderId, x, y, width, height, formatting = {} }) =>
    createLayoutPlaceholder({
      placeholderId,
      x,
      y,
      width,
      height,
      type: "text",
      role: "body",
      padding: "8px",
      formatting: { ...bodyFormatting, ...formatting },
      promptText: "Click to edit caption",
    });

  return [
    {
      "layout-id": "title-slide",
      name: "Title Slide",
      placeholders: [
        createLayoutPlaceholder({
          placeholderId: "title-placeholder",
          x: 120,
          y: 240,
          width: 1040,
          height: 130,
          type: "text",
          role: "title",
          formatting: titleFormatting,
        }),
        createLayoutPlaceholder({
          placeholderId: "subtitle-placeholder",
          x: 220,
          y: 400,
          width: 840,
          height: 80,
          type: "text",
          role: "subtitle",
          padding: "8px",
          formatting: { ...bodyFormatting, size: "24px", align: "center" },
        }),
      ],
    },
    {
      "layout-id": "title-content",
      name: "Title and Content",
      placeholders: [
        makeTitleTop(),
        makeBody({ x: 120, y: 220, width: 1040, height: 400 }),
      ],
    },
    {
      "layout-id": "section-header",
      name: "Section Header",
      placeholders: [
        createLayoutPlaceholder({
          placeholderId: "title-placeholder",
          x: 120,
          y: 290,
          width: 1040,
          height: 110,
          type: "text",
          role: "title",
          formatting: { ...titleFormatting, align: "left" },
        }),
        createLayoutPlaceholder({
          placeholderId: "subtitle-placeholder",
          x: 120,
          y: 410,
          width: 1040,
          height: 60,
          type: "text",
          role: "subtitle",
          padding: "8px",
          formatting: { ...bodyFormatting, size: "20px" },
        }),
      ],
    },
    {
      "layout-id": "two-content",
      name: "Two Content",
      placeholders: [
        makeTitleTop(),
        makeBody({ x: 120, y: 220, width: 505, height: 400 }),
        makeBody({
          placeholderId: "right-body-placeholder",
          x: 655,
          y: 220,
          width: 505,
          height: 400,
          promptText: "Click to edit second content",
        }),
      ],
    },
    {
      "layout-id": "comparison",
      name: "Comparison",
      placeholders: [
        makeTitleTop(),
        makeCaption({
          placeholderId: "left-caption-placeholder",
          x: 120,
          y: 200,
          width: 505,
          height: 55,
          formatting: { weight: "bold", size: "22px" },
        }),
        makeBody({ x: 120, y: 265, width: 505, height: 355 }),
        makeCaption({
          placeholderId: "right-caption-placeholder",
          x: 655,
          y: 200,
          width: 505,
          height: 55,
          formatting: { weight: "bold", size: "22px" },
        }),
        makeBody({
          placeholderId: "right-body-placeholder",
          x: 655,
          y: 265,
          width: 505,
          height: 355,
          promptText: "Click to edit second content",
        }),
      ],
    },
    {
      "layout-id": "title-only",
      name: "Title Only",
      placeholders: [makeTitleTop()],
    },
    {
      "layout-id": "blank",
      name: "Blank",
      placeholders: [],
    },
    {
      "layout-id": "content-caption",
      name: "Content with Caption",
      placeholders: [
        createLayoutPlaceholder({
          placeholderId: "title-placeholder",
          x: 120,
          y: 80,
          width: 400,
          height: 110,
          type: "text",
          role: "title",
          formatting: { ...titleFormatting, size: "32px", align: "left" },
        }),
        makeCaption({
          placeholderId: "caption-placeholder",
          x: 120,
          y: 210,
          width: 400,
          height: 430,
          formatting: { size: "18px" },
        }),
        makeBody({ x: 560, y: 80, width: 600, height: 560 }),
      ],
    },
    {
      "layout-id": "picture-caption",
      name: "Picture with Caption",
      placeholders: [
        makeBody({
          x: 120,
          y: 80,
          width: 600,
          height: 560,
          promptText: "Click to add picture",
        }),
        createLayoutPlaceholder({
          placeholderId: "title-placeholder",
          x: 760,
          y: 180,
          width: 400,
          height: 110,
          type: "text",
          role: "title",
          formatting: { ...titleFormatting, size: "32px", align: "left" },
        }),
        makeCaption({
          placeholderId: "caption-placeholder",
          x: 760,
          y: 310,
          width: 400,
          height: 250,
          formatting: { size: "18px" },
        }),
      ],
    },
  ];
};
