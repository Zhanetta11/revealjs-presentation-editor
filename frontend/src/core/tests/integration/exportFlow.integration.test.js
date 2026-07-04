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
import { addSlide } from "../../operations/slideOperations";
import { addTextElement } from "../../operations/textOperations";
import { addMedia } from "../../operations/mediaOperations";
import { storeMediaFile } from "../../persistence/mediaStorage";
import { exportToReveal } from "../../export/exportToReveal";

describe("export pipeline integration (operations + persistence + export)", () => {
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

  test("exports slide text content into the generated reveal.js HTML", async () => {
    let presentation = createDefaultPresentation();
    presentation = addSlide(presentation);
    presentation = addTextElement(presentation, 1, {
      id: "export-text-1",
      position: { x: 10, y: 10 },
      width: 300,
      height: 80,
      "z-index": 1,
      paragraphs: [
        { id: "p-1", formatting: {}, runs: [{ text: "Exported slide text" }] },
      ],
    });

    await exportToReveal(presentation);

    expect(capturedBlob).not.toBeNull();
    const html = await capturedBlob.text();
    expect(html).toContain("Exported slide text");
    expect(html).toContain("<section");
    expect(html).toContain("class=\"reveal\"");
  });

  test("hidden slides are excluded from the exported HTML", async () => {
    let presentation = createDefaultPresentation();
    presentation = addSlide(presentation);
    presentation = addTextElement(presentation, 1, {
      id: "hidden-slide-text",
      position: { x: 0, y: 0 },
      width: 100,
      height: 50,
      paragraphs: [
        { id: "p-1", formatting: {}, runs: [{ text: "Should not appear" }] },
      ],
    });
    presentation.slideset.slides[1].hidden = true;

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    expect(html).not.toContain("Should not appear");
  });

  test("media stored via storeMediaFile is resolved to an embedded data URL on export", async () => {
    const file = new File(["fake-image-bytes"], "photo.png", {
      type: "image/png",
    });
    const { key } = await storeMediaFile(file);

    let presentation = createDefaultPresentation();
    presentation = addMedia(presentation, 0, {
      id: "exported-media-1",
      "file-link": `indexeddb://${key}`,
      "media-type": "image",
      position: { x: 0, y: 0 },
      width: 120,
      height: 90,
      "z-index": 1,
    });

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    expect(html).toContain("data:image/png;base64");
    expect(html).not.toContain(`indexeddb://${key}`);
  });

  test("media that was never stored falls back to its raw file-link", async () => {
    let presentation = createDefaultPresentation();
    presentation = addMedia(presentation, 0, {
      id: "external-media-1",
      "file-link": "https://example.com/pic.png",
      "media-type": "image",
      position: { x: 0, y: 0 },
      width: 120,
      height: 90,
      "z-index": 1,
    });

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    expect(html).toContain("https://example.com/pic.png");
  });
});