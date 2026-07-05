import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deletePresentation: vi.fn(),
  isRecentProjectCurrentSource: vi.fn(),
  openRecentProject: vi.fn(),
  isElectron: vi.fn(() => false),
  supportsFileSystemAccess: vi.fn(() => false),
  chooseElectronProjectFolder: vi.fn(),
  linkBrowserProjectFolder: vi.fn(),
  openBrowserProjectFolderFromPicker: vi.fn(),
  saveBrowserProjectSnapshot: vi.fn(),
  writeAndCommitElectronProjectSnapshot: vi.fn(),
  createCommittingSource: vi.fn((id, folder = null) => ({
    kind: folder ? "project" : "draft",
    status: "committing",
    presentationId: id,
    projectFolder: folder,
  })),
  createProjectSource: vi.fn((id, folder) => ({
    kind: "project",
    status: "project",
    presentationId: id,
    projectFolder: folder,
  })),
  getPresentationSource: vi.fn(),
  electronApi: {
    onMenuNew: vi.fn(() => vi.fn()),
    onMenuOpen: vi.fn(() => vi.fn()),
    onMenuSave: vi.fn(() => vi.fn()),
    onMenuSaveAs: vi.fn(() => vi.fn()),
    onFileDrop: vi.fn(() => vi.fn()),
    onBeforeQuit: vi.fn(() => vi.fn()),
  },
}));

vi.mock("../../core/platform/electron", () => ({
  isElectron: mocks.isElectron,
  getElectronAPI: vi.fn(() => mocks.electronApi),
}));
vi.mock("../../core/platform/fileSystemAccess", () => ({
  supportsFileSystemAccess: mocks.supportsFileSystemAccess,
}));
vi.mock("../../core/platform/dialogs", () => ({
  confirmDialog: vi.fn(),
}));
vi.mock("../../core/persistence/persistenceFacade", () => ({
  chooseElectronProjectFolder: mocks.chooseElectronProjectFolder,
  chooseElectronProjectToOpen: vi.fn(),
  createPresentation: vi.fn(),
  createCommittingSource: mocks.createCommittingSource,
  createProjectSource: mocks.createProjectSource,
  deleteDraftManifest: vi.fn(() => Promise.resolve()),
  deletePresentation: mocks.deletePresentation,
  downloadPresentationAsJson: vi.fn(),
  getPresentationSource: mocks.getPresentationSource,
  linkBrowserProjectFolder: mocks.linkBrowserProjectFolder,
  openBrowserProjectFolderFromPicker: mocks.openBrowserProjectFolderFromPicker,
  openElectronProjectFolder: vi.fn(),
  saveBrowserProjectSnapshot: mocks.saveBrowserProjectSnapshot,
  writeAndCommitElectronProjectSnapshot: mocks.writeAndCommitElectronProjectSnapshot,
}));
vi.mock("../../core/persistence/serialization/serializationOperations", () => ({
  deserializePresentation: vi.fn(),
}));
vi.mock("../../core/persistence/serialization/importPresentation", () => ({
  importPresentationFromJson: vi.fn(),
}));
vi.mock("../../core/persistence/project/projectMediaRehydrate", () => ({
  rehydrateProjectManifestJson: vi.fn(),
}));
vi.mock("../useProjectLibrary", () => ({
  isRecentProjectCurrentSource: mocks.isRecentProjectCurrentSource,
  openRecentProject: mocks.openRecentProject,
}));

import { useEditorPersistenceController } from "./useEditorPersistenceController";

const renderController = () => {
  const navigate = vi.fn();
  const eventBus = {
    discardPending: vi.fn(async () => {}),
    resumePending: vi.fn(),
  };
  const rendered = renderHook(() =>
    useEditorPersistenceController({
      presentationId: "current-id",
      presentation: { slideset: { title: "Deck" } },
      presentationSource: {
        kind: "project",
        status: "project",
        projectFolder: "project-key",
      },
      setPresentationSource: vi.fn(),
      renamePresentation: vi.fn(),
      savePresentation: vi.fn(async () => ({ success: true })),
      autosaveStatus: "saved",
      eventBus,
      autosaveEnabled: true,
      navigate,
    }),
  );
  return { ...rendered, navigate, eventBus };
};

describe("useEditorPersistenceController same-project Open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isElectron.mockReturnValue(false);
    mocks.supportsFileSystemAccess.mockReturnValue(false);
    mocks.deletePresentation.mockResolvedValue(undefined);
    mocks.openRecentProject.mockResolvedValue("copy-id");
    mocks.getPresentationSource.mockResolvedValue({
      kind: "draft",
      status: "draft",
      presentationId: "current-id",
      projectFolder: null,
      platform: "electron",
    });
  });

  it("reloads the active project from its existing source", async () => {
    mocks.isRecentProjectCurrentSource.mockResolvedValue(true);
    const { result, navigate } = renderController();

    await act(async () => {
      await result.current.handleOpenRecentProject("project-key");
    });

    expect(mocks.openRecentProject).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      "/editor/current-id",
      expect.objectContaining({
        replace: true,
        state: {
          reloadPresentationToken: expect.any(String),
        },
      }),
    );
  });

  it("keeps a different recent project on the normal project-backed path", async () => {
    mocks.isRecentProjectCurrentSource.mockResolvedValue(false);
    mocks.openRecentProject.mockResolvedValue("other-project-id");
    const { result, navigate } = renderController();

    await act(async () => {
      await result.current.handleOpenRecentProject("other-key");
    });

    expect(mocks.openRecentProject).toHaveBeenCalledWith("other-key", {
      asDraftCopy: false,
    });
    expect(navigate).toHaveBeenCalledWith("/editor/other-project-id");
  });

  it("saves an opened browser project without choosing another folder", async () => {
    mocks.supportsFileSystemAccess.mockReturnValue(true);
    const { result } = renderController();

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mocks.saveBrowserProjectSnapshot).not.toHaveBeenCalled();
    expect(mocks.chooseElectronProjectFolder).not.toHaveBeenCalled();
  });

  it("saves an opened Electron project without choosing another folder", async () => {
    mocks.isElectron.mockReturnValue(true);
    const { result } = renderController();

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mocks.chooseElectronProjectFolder).not.toHaveBeenCalled();
    expect(mocks.saveBrowserProjectSnapshot).not.toHaveBeenCalled();
  });

  it("restores an Electron project mapping before saving a stale draft source", async () => {
    mocks.isElectron.mockReturnValue(true);
    const restoredSource = {
      kind: "project",
      status: "project",
      presentationId: "current-id",
      projectFolder: "C:\\Projects\\Deck",
      platform: "electron",
    };
    mocks.getPresentationSource.mockResolvedValue(restoredSource);
    const setPresentationSource = vi.fn();
    const savePresentation = vi.fn(async () => ({ success: true }));
    const navigate = vi.fn();
    const eventBus = {
      discardPending: vi.fn(async () => {}),
      resumePending: vi.fn(),
    };
    const { result } = renderHook(() =>
      useEditorPersistenceController({
        presentationId: "current-id",
        presentation: { slideset: { title: "Deck" } },
        presentationSource: {
          kind: "draft",
          status: "draft",
          presentationId: "current-id",
          projectFolder: null,
          platform: "electron",
        },
        setPresentationSource,
        renamePresentation: vi.fn(),
        savePresentation,
        autosaveStatus: "saved",
        eventBus,
        autosaveEnabled: true,
        navigate,
      }),
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mocks.getPresentationSource).toHaveBeenCalledWith("current-id");
    expect(setPresentationSource).toHaveBeenCalledWith(restoredSource);
    expect(savePresentation).toHaveBeenCalledOnce();
    expect(mocks.chooseElectronProjectFolder).not.toHaveBeenCalled();
  });

  it("forces a reload when Electron Open returns the current project id", async () => {
    mocks.isElectron.mockReturnValue(true);
    mocks.isRecentProjectCurrentSource.mockResolvedValue(false);
    mocks.openRecentProject.mockResolvedValue("current-id");
    const { result, navigate } = renderController();

    await act(async () => {
      await result.current.handleOpenRecentProject(
        "C:\\Projects\\Deck",
      );
    });

    expect(mocks.openRecentProject).toHaveBeenCalledWith(
      "C:\\Projects\\Deck",
      { asDraftCopy: false },
    );
    expect(navigate).toHaveBeenCalledWith(
      "/editor/current-id",
      expect.objectContaining({
        replace: true,
        state: {
          reloadPresentationToken: expect.any(String),
        },
      }),
    );
  });
});

describe("useEditorPersistenceController Electron Save As isolation", () => {
  const OLD_PROJECT = {
    kind: "project",
    status: "project",
    presentationId: "current-id",
    projectFolder: "C:\\Projects\\Old",
    platform: "electron",
  };

  const renderWith = ({ source = OLD_PROJECT } = {}) => {
    const setPresentationSource = vi.fn();
    const savePresentation = vi.fn(async () => ({ success: true }));
    const renamePresentation = vi.fn();
    const navigate = vi.fn();
    const eventBus = {
      discardPending: vi.fn(async () => {}),
      resumePending: vi.fn(),
    };
    const rendered = renderHook(() =>
      useEditorPersistenceController({
        presentationId: "current-id",
        presentation: { slideset: { title: "Deck" } },
        presentationSource: source,
        setPresentationSource,
        renamePresentation,
        savePresentation,
        autosaveStatus: "saved",
        eventBus,
        autosaveEnabled: true,
        navigate,
      }),
    );
    return { ...rendered, setPresentationSource, savePresentation };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isElectron.mockReturnValue(true);
    mocks.supportsFileSystemAccess.mockReturnValue(false);
    mocks.electronApi.showError = vi.fn();
  });

  it("commits Save As to the newly chosen folder without touching the old project", async () => {
    mocks.chooseElectronProjectFolder.mockResolvedValue({
      projectFolder: "C:\\Projects\\New",
      folderName: "New Deck",
    });
    mocks.writeAndCommitElectronProjectSnapshot.mockResolvedValue({
      projectFolder: "C:\\Projects\\New",
    });
    const { result, setPresentationSource, savePresentation } = renderWith();

    await act(async () => {
      await result.current.handleSaveAs();
    });

    // The old project must never be written to first.
    expect(savePresentation).not.toHaveBeenCalled();
    // The snapshot is built from the in-memory presentation and committed to
    // the new folder only.
    expect(mocks.writeAndCommitElectronProjectSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        presentationId: "current-id",
        projectFolder: "C:\\Projects\\New",
      }),
    );
    // Source only switches to the new project after a successful commit.
    expect(mocks.createProjectSource).toHaveBeenCalledWith(
      "current-id",
      "C:\\Projects\\New",
    );
    expect(setPresentationSource).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectFolder: "C:\\Projects\\New" }),
    );
  });

  it("leaves the old project untouched when Save As is cancelled", async () => {
    mocks.chooseElectronProjectFolder.mockResolvedValue(null);
    const { result, setPresentationSource, savePresentation } = renderWith();

    await act(async () => {
      await result.current.handleSaveAs();
    });

    expect(savePresentation).not.toHaveBeenCalled();
    expect(mocks.writeAndCommitElectronProjectSnapshot).not.toHaveBeenCalled();
    // No source mutation at all: the old project mapping stays exactly as-is.
    expect(setPresentationSource).not.toHaveBeenCalled();
    expect(mocks.electronApi.showError).not.toHaveBeenCalled();
  });

  it("restores the old project source when the Save As commit fails", async () => {
    mocks.chooseElectronProjectFolder.mockResolvedValue({
      projectFolder: "C:\\Projects\\New",
      folderName: "New Deck",
    });
    mocks.writeAndCommitElectronProjectSnapshot.mockRejectedValue(
      new Error("disk full"),
    );
    const { result, setPresentationSource, savePresentation } = renderWith();

    await act(async () => {
      await result.current.handleSaveAs();
    });

    expect(savePresentation).not.toHaveBeenCalled();
    // Never promoted to the new project; the previous source is restored.
    expect(mocks.createProjectSource).not.toHaveBeenCalled();
    expect(setPresentationSource).toHaveBeenLastCalledWith(OLD_PROJECT);
    expect(mocks.electronApi.showError).toHaveBeenCalledWith(
      "Save As Failed",
      "disk full",
    );
  });

  it("first Save of an Electron draft asks for a folder and becomes project-backed", async () => {
    const draftSource = {
      kind: "draft",
      status: "draft",
      presentationId: "current-id",
      projectFolder: null,
      platform: "electron",
    };
    mocks.getPresentationSource.mockResolvedValue(draftSource);
    mocks.chooseElectronProjectFolder.mockResolvedValue({
      projectFolder: "C:\\Projects\\Fresh",
      folderName: "Fresh Deck",
    });
    mocks.writeAndCommitElectronProjectSnapshot.mockResolvedValue({
      projectFolder: "C:\\Projects\\Fresh",
    });
    const { result, setPresentationSource, savePresentation } = renderWith({
      source: draftSource,
    });

    await act(async () => {
      await result.current.handleSave();
    });

    // Normal Save still persists first, then prompts for a folder for a draft.
    expect(savePresentation).toHaveBeenCalledOnce();
    expect(mocks.chooseElectronProjectFolder).toHaveBeenCalled();
    expect(mocks.createProjectSource).toHaveBeenCalledWith(
      "current-id",
      "C:\\Projects\\Fresh",
    );
    expect(setPresentationSource).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectFolder: "C:\\Projects\\Fresh" }),
    );
  });
});
