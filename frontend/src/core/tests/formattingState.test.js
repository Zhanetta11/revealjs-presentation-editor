import { describe, expect, test } from "vitest";
import {
  computeFormattingState,
  findMasterTextElement,
  isStoredTextSelectionValid,
} from "../operations/formattingState";

const textElement = {
  id: "text-1",
  paragraphs: [
    {
      formatting: { weight: "normal" },
      runs: [{ text: "Title text", formatting: { weight: "bold" } }],
    },
  ],
};

const expandedSelection = {
  elementId: "text-1",
  paragraphIdx: 0,
  rangeStart: 0,
  endParagraphIdx: 0,
  rangeEnd: 5,
};

describe("stored text selection validity", () => {
  test("accepts a bounded selection only while the same element is being edited", () => {
    expect(
      isStoredTextSelectionValid({
        selection: expandedSelection,
        elementId: "text-1",
        textElement,
        isEditing: true,
      }),
    ).toBe(true);

    expect(
      isStoredTextSelectionValid({
        selection: expandedSelection,
        elementId: "text-1",
        textElement,
        isEditing: false,
      }),
    ).toBe(false);
  });

  test("rejects selections for another element and out-of-bounds ranges", () => {
    expect(
      isStoredTextSelectionValid({
        selection: expandedSelection,
        elementId: "text-2",
        textElement,
        isEditing: true,
      }),
    ).toBe(false);

    expect(
      isStoredTextSelectionValid({
        selection: { ...expandedSelection, rangeEnd: 100 },
        elementId: "text-1",
        textElement,
        isEditing: true,
      }),
    ).toBe(false);
  });

  test("falls back to object formatting when a previous selection is stale", () => {
    const result = computeFormattingState({
      presentation: { slideset: { master: { formatting: { font: "Arial" } } } },
      selectedSlide: null,
      activeTextEl: textElement,
      activeElementId: "text-1",
      activeSelectionForFormatting: expandedSelection,
      isSlideMasterOpen: true,
      isEditingSelected: false,
      pendingFormatting: {},
    });

    expect(result.hasRealSelection).toBeFalsy();
    expect(result.currentFormatting.weight).toBe("normal");
    expect(result.currentFormatting.font).toBe("Arial");
  });

  test("uses a valid active selection while text editing is live", () => {
    const result = computeFormattingState({
      presentation: { slideset: { master: { formatting: { font: "Arial" } } } },
      selectedSlide: null,
      activeTextEl: textElement,
      activeElementId: "text-1",
      activeSelectionForFormatting: expandedSelection,
      isSlideMasterOpen: false,
      isEditingSelected: true,
      pendingFormatting: {},
    });

    expect(result.hasRealSelection).toBe(true);
    expect(result.currentFormatting.weight).toBe("bold");
  });

  test.each([
    ["title-placeholder", "title", "Edit title"],
    ["body-placeholder", "body", "Edit body"],
  ])("builds selectable pseudo text for %s", (placeholderId, role, promptText) => {
    const presentation = {
      slideset: {
        master: { elements: { text: [] } },
        layouts: [
          {
            "layout-id": "layout-1",
            elements: { text: [] },
            placeholders: [
              {
                "placeholder-id": placeholderId,
                type: "text",
                role,
                promptText,
                formatting: { size: "30px" },
                position: { x: 0, y: 0 },
                width: 400,
                height: 100,
              },
            ],
          },
        ],
      },
    };

    const pseudo = findMasterTextElement(
      presentation,
      "layout-1",
      placeholderId,
    );

    expect(pseudo.isPlaceholder).toBe(true);
    expect(pseudo.paragraphs[0].runs[0].text).toBe(promptText);
    expect(pseudo.paragraphs[0].formatting.size).toBe("30px");
  });
});
