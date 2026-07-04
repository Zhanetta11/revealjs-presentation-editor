import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const { records, storageAdapter } = vi.hoisted(() => {
  const records = new Map();
  return {
    records,
    storageAdapter: {
      get: vi.fn(async (key) => (records.has(key) ? records.get(key) : null)),
      set: vi.fn(async (key, value) => records.set(key, value)),
      remove: vi.fn(async (key) => records.delete(key)),
      getAllKeys: vi.fn(async () => [...records.keys()]),
      getAllPresentationIds: vi.fn(async () =>
        [...records.keys()]
          .filter((k) => k.startsWith("presentation-"))
          .map((k) => k.slice("presentation-".length)),
      ),
    },
  };
});

vi.mock("../../persistence/storageAdapter", () => ({ storageAdapter }));

import { createDefaultPresentation } from "../../model/defaultPresentation";
import { addTextElement } from "../../operations/textOperations";
import { addAnimation, createAnimation } from "../../operations/animationOperations";
import { addFontEntry } from "../../operations/fontOperations";
import { storeMediaFile } from "../../persistence/mediaStorage";
import { exportToReveal } from "../../export/exportToReveal";

describe("animation + font export pipeline integration", () => {
  let capturedBlob;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let clickSpy;

  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
    capturedBlob = null;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob) => {
      capturedBlob = blob;
      return "blob:mock-export-url";
    });
    URL.revokeObjectURL = vi.fn();
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    clickSpy.mockRestore();
  });

  test("a sequenced animation on a text element produces matching fragment markup on export", async () => {
    let presentation = createDefaultPresentation();
    presentation = addTextElement(presentation, 0, {
      id: "animated-text-1",
      position: { x: 10, y: 10 },
      width: 300,
      height: 80,
      "z-index": 1,
      paragraphs: [
        { id: "p-1", formatting: {}, runs: [{ text: "Animated line" }] },
      ],
    });
    presentation = addAnimation(
      presentation,
      0,
      createAnimation("animated-text-1", "grow", 1),
    );

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    expect(html).toContain("Animated line");
    expect(html).toContain('class="fragment grow"');
    expect(html).toContain('data-fragment-index="1"');
  });

  test("two animations on the same slide export in ascending sequence order", async () => {
    let presentation = createDefaultPresentation();
    presentation = addTextElement(presentation, 0, {
      id: "animated-text-a",
      position: { x: 10, y: 10 },
      width: 200,
      height: 60,
      "z-index": 1,
      paragraphs: [{ id: "pa", formatting: {}, runs: [{ text: "First" }] }],
    });
    presentation = addTextElement(presentation, 0, {
      id: "animated-text-b",
      position: { x: 10, y: 100 },
      width: 200,
      height: 60,
      "z-index": 2,
      paragraphs: [{ id: "pb", formatting: {}, runs: [{ text: "Second" }] }],
    });
    presentation = addAnimation(presentation, 0, createAnimation("animated-text-a", "fade-up", 1));
    presentation = addAnimation(presentation, 0, createAnimation("animated-text-b", "fade-down", 2));

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    const firstIndex = html.indexOf('data-fragment-index="1"');
    const secondIndex = html.indexOf('data-fragment-index="2"');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(-1);
    expect(html).toContain("First");
    expect(html).toContain("Second");
  });

  test("a font added via addFontEntry and stored via storeMediaFile is embedded as @font-face on export", async () => {
    const fontFile = new File(["fake-font-bytes"], "custom.woff2", {
      type: "font/woff2",
    });
    const { key } = await storeMediaFile(fontFile);

    let presentation = createDefaultPresentation();
    presentation = addFontEntry(presentation, {
      "font-id": "Custom Display Font",
      "font-file": `indexeddb://${key}`,
    });
    presentation = addTextElement(presentation, 0, {
      id: "custom-font-text",
      position: { x: 10, y: 10 },
      width: 300,
      height: 80,
      "z-index": 1,
      paragraphs: [
        {
          id: "p-font",
          formatting: { font: "Custom Display Font" },
          runs: [{ text: "Styled with a custom font" }],
        },
      ],
    });

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    expect(html).toContain('@font-face');
    expect(html).toContain('font-family: "Custom Display Font"');
    expect(html).toContain("data:font/woff2;base64");
    expect(html).toContain("Styled with a custom font");
  });

  test("a font with no stored file is skipped without breaking the export", async () => {
    let presentation = createDefaultPresentation();
    presentation = addFontEntry(presentation, {
      "font-id": "Never Uploaded",
      "font-file": "indexeddb://media/does-not-exist",
    });

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    expect(html).not.toContain("Never Uploaded");
    expect(html).toContain("<!doctype html>");
  });
});