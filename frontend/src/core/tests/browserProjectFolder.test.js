import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  linkedFolderGet,
  linkedFolderSet,
  recentUpsert,
  recentGet,
  getMediaFile,
  storeMediaFileAtKey,
} = vi.hoisted(() => ({
  linkedFolderGet: vi.fn(),
  linkedFolderSet: vi.fn(),
  recentUpsert: vi.fn(),
  recentGet: vi.fn(),
  getMediaFile: vi.fn(),
  storeMediaFileAtKey: vi.fn(),
}));

vi.mock("../persistence/project/browserProjectDb", () => ({
  linkedFolderStore: {
    get: linkedFolderGet,
    set: linkedFolderSet,
    getAllIds: vi.fn(async () => []),
  },
  recentProjectsStore: {
    upsert: recentUpsert,
    get: recentGet,
    list: vi.fn(async () => []),
  },
}));

vi.mock("../persistence/storage/mediaStorage", () => ({
  getMediaFile,
  storeMediaFile: vi.fn(),
  storeMediaFileAtKey,
}));

import {
  linkBrowserProjectFolder,
  linkBrowserRecentProject,
  openBrowserProjectFolderFromPicker,
  openBrowserRecentProject,
  saveBrowserProjectSnapshot,
  writeBrowserProjectSnapshot,
} from "../persistence/project/browserProjectFolder";
import {
  getPresentationSource,
  PresentationSourceKind,
  PresentationSourcePlatform,
} from "../persistence/project/sourceMetadata";

const createPresentation = (title = "Browser Project") => ({
  slideset: {
    filename: "browser-project.json",
    title,
    author: "",
    "creation-date": "2026-07-04",
    fonts: [],
    master: {
      formatting: {},
      "aspect-ratio": "16:9",
      "slide-dimensions": { width: 1280, height: 720 },
      "dimension-units": "px",
      "color-theme": [],
      elements: { text: [], media: [] },
    },
    layouts: [],
    slides: [{
      title: { content: "Slide" },
      "layout-id": "layout-1",
      hidden: false,
      contents: {
        text: [],
        shapes: [],
        media: [{
          id: "image-1",
          "media-type": "image",
          "file-link": "indexeddb://media/source.png",
        }],
        tables: [],
        groups: [],
        animations: [],
        transition: "none",
        notes: "",
      },
    }],
  },
});

function createMemoryFolder(name = "Browser Project") {
  const files = new Map();
  const writeOrder = [];

  const makeDirectory = (prefix = "") => ({
    name,
    queryPermission: vi.fn(async () => "granted"),
    requestPermission: vi.fn(async () => "granted"),
    getDirectoryHandle: vi.fn(async (segment) =>
      makeDirectory(`${prefix}${segment}/`)),
    getFileHandle: vi.fn(async (filename, options = {}) => {
      const path = `${prefix}${filename}`;
      if (!options.create && !files.has(path)) {
        throw new Error(`Missing file: ${path}`);
      }
      return {
        createWritable: vi.fn(async () => ({
          write: async (content) => {
            files.set(path, content);
            writeOrder.push(path);
          },
          close: async () => {},
        })),
        getFile: vi.fn(async () => {
          const content = files.get(path);
          const bytes =
            typeof content === "string"
              ? new TextEncoder().encode(content)
              : new Uint8Array(content ?? []);
          return {
            text: async () =>
              typeof content === "string"
                ? content
                : new TextDecoder().decode(bytes),
            arrayBuffer: async () =>
              bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
              ),
          };
        }),
      };
    }),
  });

  return { handle: makeDirectory(), files, writeOrder };
}

describe("Browser project-folder persistence sink", () => {
  beforeEach(() => {
    linkedFolderGet.mockReset();
    linkedFolderSet.mockReset();
    recentUpsert.mockReset();
    recentGet.mockReset();
    getMediaFile.mockReset();
    storeMediaFileAtKey.mockReset();
    getMediaFile.mockResolvedValue(
      new Blob(["image"], { type: "image/png" }),
    );
    storeMediaFileAtKey.mockImplementation(async (key) => ({ key }));
    delete window.showDirectoryPicker;
  });

  test("explicit Save links the selected folder after writing a verified snapshot", async () => {
    const project = createMemoryFolder();
    const parent = {
      getDirectoryHandle: vi.fn(async (_name, options = {}) => {
        if (!options.create) throw new Error("Folder does not exist");
        return project.handle;
      }),
    };
    window.showDirectoryPicker = vi.fn(async () => parent);

    const result = await saveBrowserProjectSnapshot({
      presentationId: "browser-project-1",
      presentation: createPresentation(),
      forceNewFolder: false,
    });

    expect(result).toEqual({
      projectFolder: "Browser Project",
      verified: true,
    });
    expect(linkedFolderSet).toHaveBeenCalledWith(
      "browser-project-1",
      project.handle,
    );
    expect(project.writeOrder.at(-1)).toBe("presentation.json");
    expect(project.writeOrder[0]).toBe("media/image/image_1.png");

    linkedFolderGet.mockResolvedValue(project.handle);
    await expect(getPresentationSource("browser-project-1")).resolves.toEqual(
      expect.objectContaining({
        kind: PresentationSourceKind.PROJECT,
        platform: PresentationSourcePlatform.BROWSER,
        projectFolder: "Browser Project",
      }),
    );
  });

  test("autosave updates the linked project folder without opening a picker", async () => {
    const project = createMemoryFolder();
    linkedFolderGet.mockResolvedValue(project.handle);
    const picker = vi.fn();
    window.showDirectoryPicker = picker;

    await writeBrowserProjectSnapshot({
      presentationId: "browser-project-1",
      presentation: createPresentation("Updated Browser Project"),
    });

    const manifest = JSON.parse(project.files.get("presentation.json"));
    expect(manifest.slideset.title).toBe("Updated Browser Project");
    expect(picker).not.toHaveBeenCalled();
    expect(linkedFolderSet).not.toHaveBeenCalled();
    expect(project.writeOrder.at(-1)).toBe("presentation.json");
  });

  test("does not silently fall back to draft storage when the linked handle is missing", async () => {
    linkedFolderGet.mockResolvedValue(null);

    await expect(writeBrowserProjectSnapshot({
      presentationId: "missing-browser-project",
      presentation: createPresentation(),
    })).rejects.toThrow("not linked to a browser project folder");
  });

  test("opening an authoritative project requests readwrite permission", async () => {
    const project = createMemoryFolder();
    project.files.set(
      "presentation.json",
      JSON.stringify(createPresentation("Opened Project")),
    );
    recentGet.mockResolvedValue({ handle: project.handle });

    await openBrowserRecentProject("recent-id", { writable: true });

    expect(project.handle.queryPermission).toHaveBeenCalledWith({
      mode: "readwrite",
    });
  });

  test("an opened and linked browser project restores as a project source", async () => {
    const project = createMemoryFolder("Opened Project");
    window.showDirectoryPicker = vi.fn();
    project.files.set(
      "presentation.json",
      JSON.stringify(createPresentation("Opened Project")),
    );
    recentGet.mockResolvedValue({ handle: project.handle });

    await openBrowserRecentProject("recent-id", { writable: true });
    await linkBrowserRecentProject("opened-project-id", "recent-id");
    linkedFolderGet.mockResolvedValue(project.handle);

    await expect(getPresentationSource("opened-project-id")).resolves.toEqual(
      expect.objectContaining({
        kind: PresentationSourceKind.PROJECT,
        platform: PresentationSourcePlatform.BROWSER,
        projectFolder: "Opened Project",
      }),
    );
    expect(linkedFolderSet).toHaveBeenCalledWith(
      "opened-project-id",
      project.handle,
    );
  });

  test("Open Project Folder reads presentation.json, rehydrates media, and exposes the folder handle for linking", async () => {
    const project = createMemoryFolder("Picked Project");
    const presentation = createPresentation("Picked Project");
    presentation.slideset.slides[0].contents.media[0]["file-link"] =
      "media/image/picked.png";
    project.files.set("presentation.json", JSON.stringify(presentation));
    project.files.set("media/image/picked.png", new Uint8Array([1, 2, 3]));
    window.showDirectoryPicker = vi.fn(async () => project.handle);
    recentUpsert.mockResolvedValue("recent-picked");

    const opened = await openBrowserProjectFolderFromPicker();
    await linkBrowserProjectFolder("picked-id", opened.folderHandle);

    const parsed = JSON.parse(opened.jsonText);
    expect(window.showDirectoryPicker).toHaveBeenCalledWith({
      mode: "readwrite",
    });
    expect(project.handle.queryPermission).toHaveBeenCalledWith({
      mode: "readwrite",
    });
    expect(opened.projectFolder).toBe("Picked Project");
    expect(opened.recentId).toBe("recent-picked");
    expect(parsed.slideset.slides[0].contents.media[0]["file-link"])
      .toContain("media/browser-project-open-Picked Project-media_image_picked.png");
    expect(recentUpsert).toHaveBeenCalledWith({
      handle: project.handle,
      title: "Picked Project",
    });
    expect(linkedFolderSet).toHaveBeenCalledWith(
      "picked-id",
      project.handle,
    );
  });

  // --- FIX 2: browser linked-folder permission / source identity ---------

  test("a linked folder with granted permission is a project source (no permission needed)", async () => {
    const project = createMemoryFolder("Granted Project");
    project.handle.queryPermission = vi.fn(async () => "granted");
    linkedFolderGet.mockResolvedValue(project.handle);
    window.showDirectoryPicker = vi.fn();

    const source = await getPresentationSource("granted-id");

    expect(source.kind).toBe(PresentationSourceKind.PROJECT);
    expect(source.projectFolder).toBe("Granted Project");
    expect(source.permissionRequired).toBe(false);
  });

  test("a linked folder awaiting permission is still a project source, not a draft", async () => {
    const project = createMemoryFolder("Pending Project");
    // Permission has lapsed: queryPermission reports "prompt", not "granted".
    project.handle.queryPermission = vi.fn(async () => "prompt");
    linkedFolderGet.mockResolvedValue(project.handle);
    window.showDirectoryPicker = vi.fn();

    const source = await getPresentationSource("pending-id");

    expect(source.kind).toBe(PresentationSourceKind.PROJECT);
    expect(source.projectFolder).toBe("Pending Project");
    // The valid link must not be misclassified as a draft.
    expect(source.permissionRequired).toBe(true);
  });

  test("a presentation with no linked folder resolves as a draft", async () => {
    linkedFolderGet.mockResolvedValue(null);
    window.showDirectoryPicker = vi.fn();

    const source = await getPresentationSource("unlinked-id");

    expect(source.kind).toBe(PresentationSourceKind.DRAFT);
    expect(source.projectFolder).toBeNull();
  });

  test("explicit Save requests permission on the existing handle instead of opening a picker", async () => {
    const project = createMemoryFolder("Reauth Project");
    // Permission must be re-requested; the grant then succeeds.
    project.handle.queryPermission = vi.fn(async () => "prompt");
    project.handle.requestPermission = vi.fn(async () => "granted");
    linkedFolderGet.mockResolvedValue(project.handle);
    const picker = vi.fn();
    window.showDirectoryPicker = picker;

    const result = await saveBrowserProjectSnapshot({
      presentationId: "reauth-id",
      presentation: createPresentation("Reauth Project"),
      forceNewFolder: false,
    });

    expect(result).toEqual({ projectFolder: "Reauth Project", verified: true });
    expect(project.handle.requestPermission).toHaveBeenCalledWith({
      mode: "readwrite",
    });
    // Re-granting permission must not spawn a second project via the picker.
    expect(picker).not.toHaveBeenCalled();
    expect(linkedFolderSet).toHaveBeenCalledWith("reauth-id", project.handle);
  });

  test("Save on a linked folder with denied permission errors without opening a picker or downgrading", async () => {
    const project = createMemoryFolder("Denied Project");
    project.handle.queryPermission = vi.fn(async () => "prompt");
    project.handle.requestPermission = vi.fn(async () => "denied");
    linkedFolderGet.mockResolvedValue(project.handle);
    const picker = vi.fn();
    window.showDirectoryPicker = picker;

    await expect(
      saveBrowserProjectSnapshot({
        presentationId: "denied-id",
        presentation: createPresentation("Denied Project"),
        forceNewFolder: false,
      }),
    ).rejects.toThrow(/permission/i);

    // No fallback picker, and the link is left intact (still the same project).
    expect(picker).not.toHaveBeenCalled();
    expect(linkedFolderSet).not.toHaveBeenCalled();
  });

  test("autosave errors rather than falling back to draft when permission is temporarily denied", async () => {
    const project = createMemoryFolder("Autosave Project");
    project.handle.queryPermission = vi.fn(async () => "prompt");
    project.handle.requestPermission = vi.fn(async () => "denied");
    linkedFolderGet.mockResolvedValue(project.handle);
    const picker = vi.fn();
    window.showDirectoryPicker = picker;

    await expect(
      writeBrowserProjectSnapshot({
        presentationId: "autosave-id",
        presentation: createPresentation("Autosave Project"),
      }),
    ).rejects.toThrow(/permission/i);

    expect(picker).not.toHaveBeenCalled();
    expect(linkedFolderSet).not.toHaveBeenCalled();
  });
});
