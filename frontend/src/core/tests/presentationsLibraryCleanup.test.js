import { beforeEach, describe, expect, test, vi } from "vitest";

const { records, storageAdapter } = vi.hoisted(() => {
  const records = new Map();
  return {
    records,
    storageAdapter: {
      get: vi.fn(async (key) => records.get(key) ?? null),
      set: vi.fn(async (key, value) => records.set(key, value)),
      remove: vi.fn(async (key) => records.delete(key)),
      getAllKeys: vi.fn(async () => [...records.keys()]),
      getAllPresentationIds: vi.fn(async () => []),
    },
  };
});

vi.mock("../persistence/storageAdapter", () => ({ storageAdapter }));

import {
  deleteDraftManifest,
  deletePresentation,
} from "../persistence/presentationsLibrary";

const withMedia = (mediaKey) => ({
  slideset: {
    title: "Cleanup",
    slides: [{
      contents: {
        media: [{ "file-link": `indexeddb://${mediaKey}` }],
      },
    }],
  },
});

describe("presentation cache cleanup", () => {
  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
  });

  test("removes only the draft manifest and index entry after source switch", async () => {
    records.set("presentations_index", [{
      id: "draft-1",
      title: "Draft",
      updatedAt: 1,
    }]);
    records.set("presentation-draft-1", JSON.stringify(withMedia("media/owned.png")));
    records.set("media/owned.png", new Blob(["image"]));

    await deleteDraftManifest("draft-1");

    expect(records.get("presentations_index")).toEqual([]);
    expect(records.has("presentation-draft-1")).toBe(false);
    expect(records.has("media/owned.png")).toBe(true);
  });

  test("does not delete media still referenced by another cached presentation", async () => {
    records.set("presentations_index", [
      { id: "draft-1", title: "Draft", updatedAt: 2 },
      { id: "draft-2", title: "Other", updatedAt: 1 },
    ]);
    records.set("presentation-draft-1", JSON.stringify(withMedia("media/shared.png")));
    records.set("presentation-draft-2", JSON.stringify(withMedia("media/shared.png")));
    records.set("media/shared.png", new Blob(["image"]));

    await deletePresentation("draft-1", {
      presentation: withMedia("media/shared.png"),
      deleteMedia: true,
    });

    expect(records.has("presentation-draft-1")).toBe(false);
    expect(records.has("presentation-draft-2")).toBe(true);
    expect(records.has("media/shared.png")).toBe(true);
  });
});
