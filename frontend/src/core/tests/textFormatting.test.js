import { describe, it, expect } from "vitest";
import {
  paragraphsToHTML,
  migrateParagraphFormatting,
  applyFormattingToParagraphs,
  splitFormattingUpdates,
  RUN_ONLY_KEYS,
  SHARED_KEYS,
  RUN_LEVEL_KEYS,
  buildRunStyles,
  computeCurrentFormatting,
} from "../text/textFormatting";

describe("key classification", () => {
  it("highlight is RUN_ONLY (not SHARED)", () => {
    expect(RUN_ONLY_KEYS.has("highlight")).toBe(true);
    expect(SHARED_KEYS.has("highlight")).toBe(false);
  });

  it("font-size-delta is not in RUN_LEVEL_KEYS", () => {
    expect(RUN_LEVEL_KEYS.has("font-size-delta")).toBe(false);
  });

  it("align is not a run-level key", () => {
    expect(RUN_LEVEL_KEYS.has("align")).toBe(false);
  });

  it("vertical-align is not a run-level key", () => {
    expect(RUN_LEVEL_KEYS.has("vertical-align")).toBe(false);
  });

  it("size, color, font, weight, italics are SHARED", () => {
    for (const k of ["size", "color", "font", "weight", "italics"]) {
      expect(SHARED_KEYS.has(k)).toBe(true);
    }
  });
});

describe("splitFormattingUpdates", () => {
  it("routes run-level keys to runUpdates", () => {
    const { runUpdates } = splitFormattingUpdates({ size: "24px", color: "#fff" });
    expect(runUpdates.size).toBe("24px");
    expect(runUpdates.color).toBe("#fff");
  });

  it("routes paragraph-level keys to paraUpdates", () => {
    const { paraUpdates } = splitFormattingUpdates({ align: "center", "vertical-align": "middle" });
    expect(paraUpdates.align).toBe("center");
    expect(paraUpdates["vertical-align"]).toBe("middle");
  });

  it("routes highlight to runUpdates (RUN_ONLY)", () => {
    const { runUpdates, paraUpdates } = splitFormattingUpdates({ highlight: "#ff0" });
    expect(runUpdates.highlight).toBe("#ff0");
    expect(paraUpdates.highlight).toBeUndefined();
  });

  it("mixed updates split correctly", () => {
    const { runUpdates, paraUpdates } = splitFormattingUpdates({
      size: "18px",
      highlight: "#f00",
      align: "right",
      "list-type": "bullets",
    });
    expect(runUpdates.size).toBe("18px");
    expect(runUpdates.highlight).toBe("#f00");
    expect(paraUpdates.align).toBe("right");
    expect(paraUpdates["list-type"]).toBe("bullets");
  });
});

describe("buildRunStyles", () => {
  it("applies highlight as background-color", () => {
    const styles = buildRunStyles({ highlight: "#ffff00" });
    expect(styles).toContain("background-color:#ffff00");
  });

  it("skips highlight when transparent", () => {
    const styles = buildRunStyles({ highlight: "transparent" });
    expect(styles).not.toContain("background-color");
  });

  it("applies font-size", () => {
    const styles = buildRunStyles({ size: "32px" });
    expect(styles).toContain("font-size:32px");
  });
});

describe("applyFormattingToParagraphs", () => {
  const makeParagraphs = () => [
    {
      formatting: { align: "left", size: "24px" },
      runs: [{ text: "Hello", formatting: { size: "24px", color: "#000" } }],
    },
    {
      formatting: { align: "left" },
      runs: [{ text: "World", formatting: { color: "#000" } }],
    },
  ];

  it("applies paragraph-level key to all paragraphs", () => {
    const result = applyFormattingToParagraphs(makeParagraphs(), { align: "center" });
    expect(result[0].formatting.align).toBe("center");
    expect(result[1].formatting.align).toBe("center");
  });

  it("removes shared key from runs when set at paragraph level", () => {
    const result = applyFormattingToParagraphs(makeParagraphs(), { size: "32px" });
    expect(result[0].runs[0].formatting.size).toBeUndefined();
  });

  it("keeps run-only keys on runs", () => {
    const paragraphs = [
      { formatting: {}, runs: [{ text: "Hi", formatting: { highlight: "#ff0" } }] },
    ];
    const result = applyFormattingToParagraphs(paragraphs, { highlight: "#0f0" });
    expect(result[0].runs[0].formatting.highlight).toBe("#0f0");
  });

  it("does not modify paragraphs it was not given", () => {
    const original = makeParagraphs();
    applyFormattingToParagraphs(original, { align: "center" });
    expect(original[0].formatting.align).toBe("left");
  });
});

describe("paragraphsToHTML", () => {
  const makePara = (text, formatting = {}, runFmt = {}) => ({
    formatting,
    runs: [{ text, formatting: runFmt }],
  });

  it("returns empty string for empty paragraphs", () => {
    expect(paragraphsToHTML([])).toBe("");
    expect(paragraphsToHTML(null)).toBe("");
  });

  it("wraps each paragraph in a data-paragraph-index div", () => {
    const html = paragraphsToHTML([makePara("A"), makePara("B")]);
    expect(html).toContain('data-paragraph-index="0"');
    expect(html).toContain('data-paragraph-index="1"');
  });

  it("applies text-align from paragraph formatting", () => {
    const html = paragraphsToHTML([makePara("Hi", { align: "center" })]);
    expect(html).toContain("text-align:center");
  });

  it("applies font-size from paragraph formatting", () => {
    const html = paragraphsToHTML([makePara("Hi", { size: "32px" })]);
    expect(html).toContain("font-size:32px");
  });

  it("does not render bullet marker when renderBullets is false (default)", () => {
    const para = makePara("Item", { "list-type": "bullets" });
    const html = paragraphsToHTML([para]);
    expect(html).not.toContain("inline-block");
  });

  it("renders bullet marker when renderBullets is true", () => {
    const para = makePara("Item", { "list-type": "bullets" });
    const html = paragraphsToHTML([para], {}, {}, true);
    expect(html).toContain("inline-block");
  });

  it("adds padding-left for list paragraphs", () => {
    const para = makePara("Item", { "list-type": "bullets" });
    const html = paragraphsToHTML([para]);
    expect(html).toContain("padding-left");
  });

  it("renders Before text indentation for ordinary paragraphs", () => {
    const html = paragraphsToHTML([
      makePara("Indented", { "before-text": 36 }),
    ]);
    expect(html).toContain("padding-left:36px");
  });

  it("renders legacy non-list indent levels consistently", () => {
    const html = paragraphsToHTML([
      makePara("Indented", { "indent-level": 2 }),
    ]);
    expect(html).toContain("padding-left:48px");
  });

  it("combines Before text with hanging indentation", () => {
    const html = paragraphsToHTML([
      makePara("Indented", {
        "before-text": 20,
        "special-indent": "hanging",
        "special-indent-by": 10,
      }),
    ]);
    expect(html).toContain("padding-left:calc(20px + 10px)");
    expect(html).toContain("text-indent:-10px");
  });

  it("explicitly clears inherited special indentation", () => {
    const html = paragraphsToHTML(
      [
        makePara("Plain", {
          "special-indent": "none",
          "special-indent-by": 0,
          "text-indent": "0px",
        }),
      ],
      {
        "special-indent": "first-line",
        "special-indent-by": 24,
        "text-indent": "24px",
      },
    );
    expect(html).not.toContain("text-indent:");
  });

  it("numbered list counter increments correctly", () => {
    const paras = [
      makePara("First", { "list-type": "numbered" }),
      makePara("Second", { "list-type": "numbered" }),
      makePara("Third", { "list-type": "numbered" }),
    ];
    const html = paragraphsToHTML(paras, {}, {}, true);
    expect(html).toContain("1.");
    expect(html).toContain("2.");
    expect(html).toContain("3.");
  });

  it("startCounter offsets numbered list", () => {
    const para = makePara("Item", { "list-type": "numbered" });
    const html = paragraphsToHTML([para], {}, {}, true, 2);
    expect(html).toContain(">3.<");
    expect(html).not.toContain(">1.<");
  });

  it("counter resets after non-list paragraph", () => {
    const paras = [
      makePara("A", { "list-type": "numbered" }),
      makePara("B", {}),
      makePara("C", { "list-type": "numbered" }),
    ];
    const html = paragraphsToHTML(paras, {}, {}, true);
    const matches = [...html.matchAll(/>\s*1\.\s*</g)];
    expect(matches.length).toBe(2);
  });

  it("highlight on run does not appear on paragraph div", () => {
    const para = {
      formatting: {},
      runs: [{ text: "Hi", formatting: { highlight: "#ff0" } }],
    };
    const html = paragraphsToHTML([para]);
    const divPart = html.split(">")[0];
    expect(divPart).not.toContain("background-color");
  });

  it("inherits formatting from masterFormatting", () => {
    const html = paragraphsToHTML(
      [makePara("Hi", {})],
      { align: "right" },
      {},
    );
    expect(html).toContain("text-align:right");
  });

  it("paragraph formatting overrides master", () => {
    const html = paragraphsToHTML(
      [makePara("Hi", { align: "left" })],
      { align: "right" },
      {},
    );
    expect(html).toContain("text-align:left");
  });

  it("explicit none disables a list inherited from a placeholder", () => {
    const html = paragraphsToHTML(
      [makePara("Plain", { "list-type": "none" })],
      {},
      { "list-type": "bullets", "list-marker": "•" },
      true,
    );
    expect(html).not.toContain(">•<");
    expect(html).not.toContain("padding-left");
  });

  it("inherits numbered lists from master formatting", () => {
    const html = paragraphsToHTML(
      [makePara("Inherited", {})],
      { "list-type": "numbered" },
      {},
      true,
    );
    expect(html).toContain(">1.<");
  });

  it("uses the shared marker width for list padding and markers", () => {
    const html = paragraphsToHTML(
      [makePara("Item", { "list-type": "bullets" })],
      {},
      {},
      true,
    );
    expect(html).toContain("width:1.8em");
    expect(html).toContain("+ 1.8em");
  });
});

describe("computeCurrentFormatting paragraph selections", () => {
  it("reports mixed paragraph and run formatting across selected paragraphs", () => {
    const selectedTextEl = {
      paragraphs: [
        {
          formatting: { align: "left", margin: "0px" },
          runs: [{ text: "First", formatting: { color: "#111111" } }],
        },
        {
          formatting: { align: "right", margin: "8px 0" },
          runs: [{ text: "Second", formatting: { color: "#222222" } }],
        },
      ],
    };

    const result = computeCurrentFormatting({
      isEditing: true,
      activeSelection: {
        elementId: "text-1",
        paragraphIdx: 0,
        rangeStart: 0,
        endParagraphIdx: 1,
        rangeEnd: 6,
      },
      selectedElementId: "text-1",
      selectedTextEl,
      effectiveFormatting: { align: "left", color: "#111111", margin: "0px" },
      pendingFormatting: {},
    });

    expect(result.align).toBe("mixed");
    expect(result.margin).toBe("mixed");
    expect(result.color).toBe("mixed");
  });
});

describe("migrateParagraphFormatting", () => {
  const makeParagraph = (formatting, runs = [{ text: "Hello", formatting: {} }]) => ({
    formatting,
    runs,
  });

  it("removes key that exactly matches placeholder value (redundant)", () => {
    const paragraphs = [makeParagraph({ align: "center" })];
    const result = migrateParagraphFormatting(paragraphs, { align: "center" });
    expect(result[0].formatting.align).toBeUndefined();
  });

  it("keeps key that differs from placeholder value (user override)", () => {
    const paragraphs = [makeParagraph({ align: "left" })];
    const result = migrateParagraphFormatting(paragraphs, { align: "center" });
    expect(result[0].formatting.align).toBe("left");
  });

  it("keeps vertical-align when different from master", () => {
    const paragraphs = [makeParagraph({ "vertical-align": "middle" })];
    const result = migrateParagraphFormatting(
      paragraphs,
      {},
      { "vertical-align": "top" },
    );
    expect(result[0].formatting["vertical-align"]).toBe("middle");
  });

  it("removes vertical-align when same as master", () => {
    const paragraphs = [makeParagraph({ "vertical-align": "top" })];
    const result = migrateParagraphFormatting(
      paragraphs,
      {},
      { "vertical-align": "top" },
    );
    expect(result[0].formatting["vertical-align"]).toBeUndefined();
  });

  it("placeholder takes precedence over master for same key", () => {
    const paragraphs = [makeParagraph({ align: "right" })];
    const result = migrateParagraphFormatting(
      paragraphs,
      { align: "right" },
      { align: "left" },
    );
    expect(result[0].formatting.align).toBeUndefined();
  });

  it("strips redundant run formatting that matches paragraph", () => {
    const paragraphs = [
      {
        formatting: { color: "#000" },
        runs: [{ text: "A", formatting: { color: "#000" } }],
      },
    ];
    const result = migrateParagraphFormatting(paragraphs, {});
    expect(result[0].runs[0].formatting.color).toBeUndefined();
  });

  it("keeps run-only keys on runs even if they match paragraph", () => {
    const paragraphs = [
      {
        formatting: {},
        runs: [{ text: "A", formatting: { highlight: "#ff0" } }],
      },
    ];
    const result = migrateParagraphFormatting(paragraphs, {});
    expect(result[0].runs[0].formatting.highlight).toBe("#ff0");
  });

  it("migrates legacy bullets field to list-type", () => {
    const paragraphs = [
      { formatting: {}, runs: [{ text: "Item", formatting: {} }], bullets: "bullet" },
    ];
    const result = migrateParagraphFormatting(paragraphs, {});
    expect(result[0].formatting["list-type"]).toBe("bullets");
  });

  it("preserves key in userSetKeys even when it matches placeholder (explicit user override)", () => {
    const paragraphs = [
      { formatting: { align: "center" }, userSetKeys: ["align"], runs: [] },
    ];
    const result = migrateParagraphFormatting(paragraphs, { align: "center" });
    expect(result[0].formatting.align).toBe("center");
  });

  it("handles null paragraphs gracefully", () => {
    expect(migrateParagraphFormatting(null, {})).toBeNull();
  });

  it("handles empty paragraphs array", () => {
    expect(migrateParagraphFormatting([], {})).toEqual([]);
  });
});
