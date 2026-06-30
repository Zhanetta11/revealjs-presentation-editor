import { describe, expect, it } from "vitest";
import {
  htmlToClipboardParagraphs,
  insertClipboardParagraphs,
  plainTextToClipboardParagraphs,
} from "../text/clipboardText";

const makeParagraph = (text, formatting = {}, runFormatting = {}) => ({
  id: `paragraph-${text}`,
  formatting,
  runs: [
    {
      text,
      formatting: runFormatting,
      "super-sub-script": "normal",
      link: null,
    },
  ],
});

describe("clipboard text conversion", () => {
  it("applies destination run formatting to plain text", () => {
    const paragraphs = plainTextToClipboardParagraphs("One\nTwo", {
      color: "#123456",
      weight: "bold",
      align: "center",
    });

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].runs[0].formatting).toEqual({
      color: "#123456",
      weight: "bold",
    });
    expect(paragraphs[0].runs[0].formatting.align).toBeUndefined();
  });

  it("preserves supported source formatting from HTML", () => {
    const paragraphs = htmlToClipboardParagraphs(
      '<p style="text-align:right"><span style="color:#ff0000;font-family:Georgia">Red</span> <strong>Bold</strong></p>',
    );

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].formatting.align).toBe("right");
    expect(paragraphs[0].runs[0].text).toBe("Red");
    expect(paragraphs[0].runs[0].formatting.color).toBe("rgb(255, 0, 0)");
    expect(paragraphs[0].runs[0].formatting.font).toBe("Georgia");
    expect(paragraphs[0].runs.at(-1).formatting.weight).toBe("bold");
  });

  it("preserves first-line and superscript run boundaries", () => {
    const paragraphs = htmlToClipboardParagraphs(
      "<div>Normal <u>under</u><sup>2</sup></div>",
    );

    expect(paragraphs[0].runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "under",
          formatting: expect.objectContaining({
            "text-decoration": "underline",
          }),
        }),
        expect.objectContaining({
          text: "2",
          "super-sub-script": "super",
        }),
      ]),
    );
  });
});

describe("insertClipboardParagraphs", () => {
  it("replaces the selection and preserves rich source runs", () => {
    const result = insertClipboardParagraphs(
      [makeParagraph("Hello world", { align: "left" })],
      {
        paragraphIdx: 0,
        rangeStart: 6,
        endParagraphIdx: 0,
        rangeEnd: 11,
      },
      [
        {
          formatting: {},
          runs: [
            {
              text: "RED",
              formatting: { color: "#ff0000" },
              "super-sub-script": "normal",
              link: null,
            },
          ],
        },
      ],
    );

    expect(result.paragraphs[0].runs.map((run) => run.text).join("")).toBe(
      "Hello RED",
    );
    expect(result.paragraphs[0].runs.at(-1).formatting.color).toBe("#ff0000");
    expect(result.selection.rangeStart).toBe(9);
  });

  it("creates paragraphs for multiline clipboard content", () => {
    const result = insertClipboardParagraphs(
      [makeParagraph("StartEnd")],
      {
        paragraphIdx: 0,
        rangeStart: 5,
        endParagraphIdx: 0,
        rangeEnd: 5,
      },
      plainTextToClipboardParagraphs("One\nTwo", {}),
    );

    expect(result.paragraphs).toHaveLength(2);
    expect(result.paragraphs[0].runs.map((run) => run.text).join("")).toBe(
      "StartOne",
    );
    expect(result.paragraphs[1].runs.map((run) => run.text).join("")).toBe(
      "TwoEnd",
    );
  });
});

