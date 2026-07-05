import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getMediaFile,
  storeMediaFile,
  storeMediaFileAtKey,
} = vi.hoisted(() => ({
  getMediaFile: vi.fn(),
  storeMediaFile: vi.fn(),
  storeMediaFileAtKey: vi.fn(),
}));

vi.mock("../persistence/storage/mediaStorage", () => ({
  getMediaFile,
  storeMediaFile,
  storeMediaFileAtKey,
}));

import { buildProjectManifest } from "../persistence/project/projectFolder";
import {
  writeElectronProjectSnapshot,
  writeAndCommitElectronProjectSnapshot,
  loadElectronProjectSnapshot,
  openElectronProjectFolder,
} from "../persistence/project/electronProjectFolder";

const createPresentationWithImage = () => ({
  slideset: {
    title: "Project",
    filename: "project.json",
    master: { formatting: {}, elements: { text: [], media: [] } },
    layouts: [],
    fonts: [],
    slides: [{
      id: "slide-1",
      contents: {
        text: [],
        media: [{
          id: "image-1",
          "media-type": "image",
          "file-link": "indexeddb://media/source.png",
        }],
      },
    }],
  },
});

describe("Electron project-folder persistence sink", () => {
  beforeEach(() => {
    getMediaFile.mockReset();
    storeMediaFile.mockReset();
    storeMediaFileAtKey.mockReset();
    storeMediaFileAtKey.mockImplementation(async (key) => ({ key }));
    window.electronAPI = {
      writeProjectSnapshot: vi.fn(async () => ({
        projectFolder: "C:\\Projects\\Project",
        verified: true,
      })),
      commitProjectSource: vi.fn(async (presentationId, projectFolder) => ({
        kind: "project",
        presentationId,
        projectFolder,
        status: "project",
      })),
      openProjectFolder: vi.fn(async (projectFolder) => ({
        presentationId: "stable-project-id",
        projectFolder,
      })),
    };
  });

  test("rejects a project snapshot when a required media blob is missing", async () => {
    getMediaFile.mockResolvedValue(null);

    await expect(buildProjectManifest(createPresentationWithImage(), {
      requireResolvedMedia: true,
    })).rejects.toThrow("Required project asset is missing");
  });

  test("sends resolved assets before presentation.json", async () => {
    getMediaFile.mockResolvedValue(new Blob(["image"], { type: "image/png" }));

    await writeElectronProjectSnapshot({
      presentationId: "presentation-1",
      presentation: createPresentationWithImage(),
      projectFolder: "C:\\Projects\\Project",
    });

    expect(window.electronAPI.writeProjectSnapshot).toHaveBeenCalledOnce();
    const payload = window.electronAPI.writeProjectSnapshot.mock.calls[0][0];
    expect(payload.files.map((file) => file.relativePath)).toEqual([
      "media/image/image_1.png",
      "presentation.json",
    ]);
    expect(JSON.parse(payload.files.at(-1).text)
      .slideset.slides[0].contents.media[0]["file-link"])
      .toBe("media/image/image_1.png");
  });

  test("commits source metadata only after the snapshot write succeeds", async () => {
    getMediaFile.mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    const callOrder = [];
    window.electronAPI.writeProjectSnapshot.mockImplementation(async () => {
      callOrder.push("write");
      return { projectFolder: "C:\\Projects\\Project", verified: true };
    });
    window.electronAPI.commitProjectSource.mockImplementation(async () => {
      callOrder.push("commit");
      return {
        kind: "project",
        presentationId: "presentation-1",
        projectFolder: "C:\\Projects\\Project",
        status: "project",
      };
    });

    await writeAndCommitElectronProjectSnapshot({
      presentationId: "presentation-1",
      presentation: createPresentationWithImage(),
      projectFolder: "C:\\Projects\\Project",
    });

    expect(callOrder).toEqual(["write", "commit"]);
  });

  test("keeps source metadata unchanged when snapshot writing fails", async () => {
    getMediaFile.mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    window.electronAPI.writeProjectSnapshot.mockRejectedValue(new Error("disk full"));

    await expect(writeAndCommitElectronProjectSnapshot({
      presentationId: "presentation-1",
      presentation: createPresentationWithImage(),
      projectFolder: "C:\\Projects\\Project",
    })).rejects.toThrow("disk full");

    expect(window.electronAPI.commitProjectSource).not.toHaveBeenCalled();
  });

  test("uses the stable project identity returned for a folder", async () => {
    const first = await openElectronProjectFolder("C:\\Projects\\Project");
    const second = await openElectronProjectFolder("C:\\Projects\\Project");

    expect(first.presentationId).toBe("stable-project-id");
    expect(second.presentationId).toBe(first.presentationId);
    expect(window.electronAPI.openProjectFolder).toHaveBeenCalledTimes(2);
  });

  test("reuses deterministic derived media cache keys across reloads", async () => {
    const manifest = JSON.stringify({
      slideset: {
        slides: [{
          contents: {
            media: [{
              "file-link": "media/image/image_1.png",
              "media-type": "image",
            }],
          },
        }],
      },
    });
    window.electronAPI.loadProjectSnapshot = vi.fn(async (projectFolder) => ({
      text: manifest,
      projectFolder,
    }));
    window.electronAPI.readProjectSnapshotFile = vi.fn(async () =>
      new Uint8Array([1, 2, 3]));

    await loadElectronProjectSnapshot("C:\\Projects\\Project");
    await loadElectronProjectSnapshot("C:\\Projects\\Project");

    const keys = storeMediaFileAtKey.mock.calls.map(([key]) => key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toContain("image_1.png");
  });
});
