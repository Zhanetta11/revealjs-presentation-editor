import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { storageSet, updateIndexEntry } = vi.hoisted(() => ({
  storageSet: vi.fn(),
  updateIndexEntry: vi.fn(),
}));

vi.mock("../persistence/storageAdapter", () => ({
  storageAdapter: {
    set: storageSet,
  },
}));

vi.mock("../persistence/presentationsLibrary", () => ({
  updateIndexEntry,
}));

import { createAutosaveService } from "../persistence/autoSaveService";

const editorState = {
  presentation: {
    slideset: {
      title: "Autosave Project",
      filename: "autosave-project.json",
      master: { formatting: {}, elements: { text: [], media: [] } },
      layouts: [],
      fonts: [],
      slides: [],
    },
  },
};

describe("autosave persistence destination", () => {
  beforeEach(() => {
    storageSet.mockReset();
    updateIndexEntry.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("writes draft presentations to the cache adapter", async () => {
    const persistProject = vi.fn();
    const service = createAutosaveService(() => editorState, {
      storageKey: "presentation-draft-1",
      getSource: () => ({
        kind: "draft",
        presentationId: "draft-1",
        projectFolder: null,
        status: "draft",
      }),
      persistProject,
    });

    await service.saveImmediately();

    expect(storageSet).toHaveBeenCalledOnce();
    expect(storageSet.mock.calls[0][0]).toBe("presentation-draft-1");
    expect(updateIndexEntry).toHaveBeenCalledWith("draft-1", "Autosave Project");
    expect(persistProject).not.toHaveBeenCalled();
  });

  test("writes project-backed presentations only to the project sink", async () => {
    const persistProject = vi.fn().mockResolvedValue({
      projectFolder: "C:\\Projects\\Autosave Project",
      verified: true,
    });
    const service = createAutosaveService(() => editorState, {
      storageKey: "presentation-project-1",
      getSource: () => ({
        kind: "project",
        presentationId: "project-1",
        projectFolder: "C:\\Projects\\Autosave Project",
        status: "project",
      }),
      persistProject,
    });

    await service.saveImmediately();

    expect(persistProject).toHaveBeenCalledWith(expect.objectContaining({
      presentationId: "project-1",
      presentation: editorState.presentation,
      projectFolder: "C:\\Projects\\Autosave Project",
    }));
    expect(storageSet).not.toHaveBeenCalled();
    expect(updateIndexEntry).not.toHaveBeenCalled();
  });

  test("reports project sink failures through active save status", async () => {
    const error = new Error("project disk is full");
    const persistProject = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    const statuses = [];
    const service = createAutosaveService(() => editorState, {
      storageKey: "presentation-project-2",
      getSource: () => ({
        kind: "project",
        presentationId: "project-2",
        projectFolder: "C:\\Projects\\Project 2",
        status: "project",
      }),
      persistProject,
      onError,
      onStatusChange: (status) => statuses.push(status),
    });

    await expect(service.saveImmediately()).rejects.toThrow("project disk is full");

    expect(statuses).toEqual(["saving", "error"]);
    expect(onError).toHaveBeenCalledWith(error);
    expect(storageSet).not.toHaveBeenCalled();
  });

  test("cancels a pending autosave before discard and can resume it after cancel", async () => {
    vi.useFakeTimers();
    const service = createAutosaveService(() => editorState, {
      storageKey: "presentation-draft-close",
      delay: 1000,
    });

    service.scheduleAutosave("SLIDE.ADD");
    await service.discardPending();
    await vi.runAllTimersAsync();
    expect(storageSet).not.toHaveBeenCalled();

    service.resumePending();
    await vi.runAllTimersAsync();
    expect(storageSet).toHaveBeenCalledOnce();
  });
});
