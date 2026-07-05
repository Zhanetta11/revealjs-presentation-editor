import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import JSZip from "jszip";

const { records, storageAdapter } = vi.hoisted(() => {
  const records = new Map();
  return {
    records,
    storageAdapter: {
      get: vi.fn(async (key) => (records.has(key) ? records.get(key) : null)),
      set: vi.fn(async (key, value) => records.set(key, value)),
      remove: vi.fn(async (key) => records.delete(key)),
      getAllKeys: vi.fn(async () => [...records.keys()]),
      getAllPresentationIds: vi.fn(async () => []),
    },
  };
});

vi.mock("../../persistence/storage/storageAdapter", () => ({ storageAdapter }));

import { createDefaultPresentation } from "../../model/defaultPresentation";
import { addSlide } from "../../operations/slideOperations";
import { addMedia } from "../../operations/mediaOperations";
import { addFontEntry } from "../../operations/fontOperations";
import { storeMediaFile } from "../../persistence/storage/mediaStorage";
import { exportToRevealZip } from "../../export/exportToReveal";
import { downloadPresentationAsJson } from "../../persistence/serialization/serializationOperations";
import { validateSlideset } from "../../operations/slidesetValidation";

describe("zip export and JSON save-as integration", () => {
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

  test("the ZIP is self-contained: index.html plus local reveal.js assets, no CDN dependency", async () => {
    let presentation = createDefaultPresentation();
    presentation = addSlide(presentation);

    await exportToRevealZip(presentation);
    expect(capturedBlob).not.toBeNull();

    const zip = await JSZip.loadAsync(await capturedBlob.arrayBuffer());
    for (const required of [
      "index.html",
      "reveal/reveal.js",
      "reveal/reveal.css",
      "reveal/theme/white.css",
    ]) {
      expect(zip.file(required), `${required} missing from zip`).not.toBeNull();
    }

    const html = await zip.file("index.html").async("string");
    expect(html).toContain('href="reveal/reveal.css"');
    expect(html).toContain('href="reveal/theme/white.css"');
    expect(html).toContain('src="reveal/reveal.js"');
    expect(html).not.toContain("cdn.jsdelivr.net");
    expect(html).not.toContain("indexeddb://");
    expect(html).not.toContain("blob:");
  });

  test("stored media lands in media/ and index.html references the packed file", async () => {
    const file = new File(["fake-image-bytes"], "photo.png", { type: "image/png" });
    const { key } = await storeMediaFile(file);

    let presentation = createDefaultPresentation();
    presentation = addMedia(presentation, 0, {
      id: "zip-media-1",
      "file-link": `indexeddb://${key}`,
      "media-type": "image",
      position: { x: 0, y: 0 },
      width: 120,
      height: 90,
      "z-index": 1,
    });

    await exportToRevealZip(presentation);

    const zip = await JSZip.loadAsync(await capturedBlob.arrayBuffer());
    const mediaEntry = zip.file("media/image/image_1.png");
    expect(mediaEntry).not.toBeNull();
    const bytes = await mediaEntry.async("uint8array");
    expect(new TextDecoder().decode(bytes)).toBe("fake-image-bytes");

    const html = await zip.file("index.html").async("string");
    expect(html).toContain('src="media/image/image_1.png"');
    expect(html).not.toContain("indexeddb://");
    expect(html).not.toContain("data:image/png;base64");
  });

  test("external-URL media passes through untouched and is not packed", async () => {
    let presentation = createDefaultPresentation();
    presentation = addMedia(presentation, 0, {
      id: "zip-external-1",
      "file-link": "https://example.com/pic.png",
      "media-type": "image",
      position: { x: 0, y: 0 },
      width: 120,
      height: 90,
      "z-index": 1,
    });

    await exportToRevealZip(presentation);

    const zip = await JSZip.loadAsync(await capturedBlob.arrayBuffer());
    const packedMedia = Object.keys(zip.files).filter((name) =>
      name.startsWith("media/") && !zip.files[name].dir,
    );
    expect(packedMedia).toEqual([]);

    const html = await zip.file("index.html").async("string");
    expect(html).toContain('src="https://example.com/pic.png"');
  });

  test("stored custom fonts are packed under fonts/ and referenced by @font-face", async () => {
    const fontFile = new File(["fake-font-bytes"], "custom.woff2", {
      type: "font/woff2",
    });
    const { key } = await storeMediaFile(fontFile);

    let presentation = createDefaultPresentation();
    presentation = addFontEntry(presentation, {
      "font-id": "Zip Font",
      "font-file": `indexeddb://${key}`,
    });

    await exportToRevealZip(presentation);

    const zip = await JSZip.loadAsync(await capturedBlob.arrayBuffer());
    const fontEntries = Object.keys(zip.files).filter((name) =>
      name.startsWith("fonts/") && !zip.files[name].dir,
    );
    expect(fontEntries).toHaveLength(1);

    const html = await zip.file("index.html").async("string");
    expect(html).toContain('font-family: "Zip Font"');
    expect(html).toContain(`url("${fontEntries[0]}")`);
  });

  test("Save As downloads valid, portable JSON (references, no base64)", async () => {
    let presentation = createDefaultPresentation();
    presentation = addMedia(presentation, 0, {
      id: "saveas-media-1",
      "file-link": "https://example.com/pic.png",
      "media-type": "image",
      position: { x: 0, y: 0 },
      width: 120,
      height: 90,
      "z-index": 1,
    });

    await downloadPresentationAsJson(presentation);
    expect(capturedBlob).not.toBeNull();

    const jsonText = await capturedBlob.text();
    const parsed = JSON.parse(jsonText);
    expect(validateSlideset(parsed)).toEqual([]);

    const media = parsed.slideset.slides[0].contents.media.find(
      (el) => el.id === "saveas-media-1",
    );
    expect(media["file-link"]).toBe("https://example.com/pic.png");
    expect(jsonText).not.toContain("base64");
  });

  test("Save As refuses non-portable local media references and points to ZIP/project export", async () => {
    const file = new File(["fake-image-bytes"], "photo.png", { type: "image/png" });
    const { key } = await storeMediaFile(file);

    let presentation = createDefaultPresentation();
    presentation = addMedia(presentation, 0, {
      id: "saveas-local-media",
      "file-link": `indexeddb://${key}`,
      "media-type": "image",
      position: { x: 0, y: 0 },
      width: 120,
      height: 90,
      "z-index": 1,
    });

    await expect(downloadPresentationAsJson(presentation)).rejects.toThrow(
      /Standalone JSON cannot include local media/,
    );
    expect(capturedBlob).toBeNull();
  });
});