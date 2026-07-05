import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { records, storageAdapter, linkedFolders, recentProjects } = vi.hoisted(() => {
  const records = new Map();
  const linkedFolders = new Map();
  const recentProjects = new Map();
  return {
    records,
    linkedFolders,
    recentProjects,
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

vi.mock("../../persistence/browserProjectDb", () => ({
  linkedFolderStore: {
    get: async (id) => linkedFolders.get(id) ?? null,
    set: async (id, handle) => {
      linkedFolders.set(id, handle);
    },
    remove: async (id) => {
      linkedFolders.delete(id);
    },
    getAllIds: async () => [...linkedFolders.keys()],
  },
  recentProjectsStore: {
    list: async () =>
      [...recentProjects.entries()]
        .map(([id, value]) => ({
          id,
          handle: value.handle,
          title: value.title,
          updatedAt: value.updatedAt,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    get: async (id) => recentProjects.get(id) ?? null,
    upsert: async ({ handle, title }) => {
      const id = crypto.randomUUID();
      recentProjects.set(id, { handle, title, updatedAt: Date.now() });
      return id;
    },
    remove: async (id) => {
      recentProjects.delete(id);
    },
  },
}));

import {
  useProjectLibrary,
  openRecentProject,
  removeRecentProject,
} from "../../../hooks/useProjectLibrary";
import { createDefaultPresentation } from "../../model/defaultPresentation";
import { addMedia } from "../../operations/mediaOperations";
import { serializePresentation } from "../../persistence/serializationOperations";
import { loadPresentation } from "../../persistence/presentationsLibrary";

function createFakeFolderHandle(name, files) {
  const makeDir = (prefix, dirName) => ({
    name: dirName,
    kind: "directory",
    queryPermission: async () => "granted",
    requestPermission: async () => "granted",
    isSameEntry: async () => false,
    getDirectoryHandle: async (child) => makeDir(`${prefix}${child}/`, child),
    getFileHandle: async (fileName) => {
      const fullPath = `${prefix}${fileName}`;
      if (!files.has(fullPath)) {
        throw new Error(`File not found in fake folder: ${fullPath}`);
      }
      const content = files.get(fullPath);
      const bytes =
        typeof content === "string" ? new TextEncoder().encode(content) : content;
      return {
        getFile: async () => ({
          text: async () => new TextDecoder().decode(bytes),
          arrayBuffer: async () => bytes.slice().buffer,
        }),
      };
    },
  });
  return makeDir("", name);
}

describe("project library + browser project folder integration", () => {
  beforeEach(() => {
    records.clear();
    linkedFolders.clear();
    recentProjects.clear();
    vi.clearAllMocks();
    window.showDirectoryPicker = () => {};
  });

  afterEach(() => {
    delete window.showDirectoryPicker;
  });

  test("useProjectLibrary splits draft and project-backed presentations and lists recents", async () => {
    records.set("presentations_index", [
      { id: "draft-1", title: "Loose Draft", updatedAt: 2 },
      { id: "proj-1", title: "Folder Backed", updatedAt: 1 },
    ]);
    linkedFolders.set("proj-1", createFakeFolderHandle("Folder Backed", new Map()));
    recentProjects.set("recent-1", {
      handle: createFakeFolderHandle("Folder Backed", new Map()),
      title: "Folder Backed",
      updatedAt: 10,
    });

    const { result, unmount } = renderHook(() => useProjectLibrary());

    await waitFor(() => expect(result.current.presentations).toHaveLength(2));
    await waitFor(() => expect(result.current.recentProjects).toHaveLength(1));

    expect(result.current.draftPresentations.map((p) => p.id)).toEqual(["draft-1"]);
    expect(result.current.recentProjects[0].title).toBe("Folder Backed");

    unmount();
  });

  test("without File System Access support the library lists presentations but no drafts split", async () => {
    delete window.showDirectoryPicker;
    records.set("presentations_index", [
      { id: "only-1", title: "Plain Browser Deck", updatedAt: 1 },
    ]);

    const { result, unmount } = renderHook(() => useProjectLibrary());

    await waitFor(() => expect(result.current.presentations).toHaveLength(1));
    expect(result.current.draftPresentations).toEqual([]);
    expect(result.current.recentProjects).toEqual([]);

    unmount();
  });

  test("openRecentProject rehydrates folder media into storage and imports the presentation", async () => {
    let source = createDefaultPresentation();
    source.slideset.title = "Opened From Folder";
    source = addMedia(source, 0, {
      id: "folder-media-1",
      "file-link": "media/image/pic.png",
      "media-type": "image",
      position: { x: 0, y: 0 },
      width: 100,
      height: 80,
      "z-index": 1,
    });
    const imageBytes = new TextEncoder().encode("fake-png-bytes");
    const folderFiles = new Map([
      ["presentation.json", serializePresentation(source)],
      ["media/image/pic.png", imageBytes],
    ]);
    recentProjects.set("recent-open", {
      handle: createFakeFolderHandle("Opened From Folder", folderFiles),
      title: "Opened From Folder",
      updatedAt: 5,
    });

    const id = await openRecentProject("recent-open");
    expect(typeof id).toBe("string");

    const stored = await loadPresentation(id);
    const parsed = JSON.parse(stored);
    const media = parsed.slideset.slides[0].contents.media.find(
      (el) => el.id === "folder-media-1",
    );
    expect(media["file-link"]).toMatch(/^indexeddb:\/\//);

    const mediaKey = media["file-link"].replace("indexeddb://", "");
    const blob = records.get(mediaKey);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(new TextDecoder().decode(await blob.arrayBuffer())).toBe("fake-png-bytes");

    expect(linkedFolders.has(id)).toBe(true);

    const index = records.get("presentations_index");
    expect(index.some((entry) => entry.id === id)).toBe(true);
  });

  test("removeRecentProject drops the entry from the recents store", async () => {
    recentProjects.set("recent-gone", {
      handle: createFakeFolderHandle("Old", new Map()),
      title: "Old",
      updatedAt: 1,
    });

    await removeRecentProject("recent-gone");

    expect(recentProjects.has("recent-gone")).toBe(false);
  });
});