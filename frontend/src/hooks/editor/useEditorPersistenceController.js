import { useCallback, useEffect, useRef } from "react";
import { getPresentationTitle } from "../../core/utils/presentationUtils";
import { isElectron, getElectronAPI } from "../../core/platform/electron";
import { supportsFileSystemAccess } from "../../core/platform/fileSystemAccess";
import { confirmDialog } from "../../core/platform/dialogs";
import {
  chooseElectronProjectFolder,
  chooseElectronProjectToOpen,
  createPresentation,
  createCommittingSource,
  createProjectSource,
  deleteDraftManifest,
  deletePresentation,
  downloadPresentationAsJson,
  getPresentationSource,
  linkBrowserProjectFolder,
  openBrowserProjectFolderFromPicker,
  openElectronProjectFolder,
  saveBrowserProjectSnapshot,
  writeAndCommitElectronProjectSnapshot,
} from "../../core/persistence/persistenceFacade";
import { deserializePresentation } from "../../core/persistence/serialization/serializationOperations";
import { importPresentationFromJson } from "../../core/persistence/serialization/importPresentation";
import { rehydrateProjectManifestJson } from "../../core/persistence/project/projectMediaRehydrate";
import {
  isRecentProjectCurrentSource,
  openRecentProject,
} from "../useProjectLibrary";

const hasProjectRelativeAssetReferences = (jsonText) => {
  try {
    const parsed = JSON.parse(jsonText);
    const walk = (value) => {
      if (Array.isArray(value)) return value.some(walk);
      if (!value || typeof value !== "object") return false;
      return Object.entries(value).some(([key, child]) => {
        if (
          (key === "file-link" || key === "font-file") &&
          typeof child === "string" &&
          (child.startsWith("media/") || child.startsWith("fonts/"))
        ) {
          return true;
        }
        return walk(child);
      });
    };
    return walk(parsed);
  } catch {
    return false;
  }
};

export function useEditorPersistenceController({
  presentationId,
  presentation,
  presentationSource,
  setPresentationSource,
  renamePresentation,
  savePresentation,
  autosaveStatus,
  eventBus,
  autosaveEnabled,
  navigate,
}) {
  const linkedFolderPath = presentationSource.projectFolder;
  const linkedFolderPathRef = useRef(linkedFolderPath);
  useEffect(() => {
    linkedFolderPathRef.current = presentationSource.projectFolder;
  }, [presentationSource.projectFolder]);

  const canUseProjectFolders =
    isElectron() || supportsFileSystemAccess();

  const saveProjectToFolder = useCallback(
    async (forceNewFolder, renameTo = null) => {
      const previousSource = presentationSource;
      let targetFolder = previousSource.projectFolder;
      let effectiveRename = renameTo;

      if (isElectron()) {
        if (
          forceNewFolder ||
          previousSource.kind === "draft" ||
          !targetFolder
        ) {
          const chosen = await chooseElectronProjectFolder(
            renameTo || getPresentationTitle(presentation),
          );
          if (!chosen) return false;
          targetFolder = chosen.projectFolder;
          effectiveRename = chosen.folderName;
        }

        const effectivePresentation = effectiveRename
          ? {
              ...presentation,
              slideset: {
                ...presentation.slideset,
                title: effectiveRename,
              },
            }
          : presentation;

        setPresentationSource(
          createCommittingSource(presentationId, targetFolder),
        );
        try {
          const committedSource =
            await writeAndCommitElectronProjectSnapshot({
              presentationId,
              presentation: effectivePresentation,
              projectFolder: targetFolder,
            });
          setPresentationSource(
            createProjectSource(
              presentationId,
              committedSource.projectFolder,
            ),
          );
          if (effectiveRename) renamePresentation(effectiveRename);
          if (previousSource.kind === "draft") {
            deleteDraftManifest(presentationId).catch((error) => {
              console.warn(
                "[EditorPage] Could not remove committed draft manifest:",
                error,
              );
            });
          }
          return true;
        } catch (error) {
          setPresentationSource(previousSource);
          throw error;
        }
      }

      const effectivePresentation = renameTo
        ? {
            ...presentation,
            slideset: { ...presentation.slideset, title: renameTo },
          }
        : presentation;
      const savedProject = await saveBrowserProjectSnapshot({
        presentationId,
        presentation: effectivePresentation,
        forceNewFolder,
      });
      const savedFolder = savedProject?.projectFolder ?? null;

      if (savedFolder && renameTo) renamePresentation(renameTo);
      if (savedFolder) {
        setPresentationSource(
          createProjectSource(presentationId, savedFolder),
        );
      }
      return Boolean(savedFolder);
    },
    [
      presentation,
      presentationId,
      presentationSource,
      renamePresentation,
      setPresentationSource,
    ],
  );

  const promptForPresentationName = useCallback(() => {
    const current = getPresentationTitle(presentation);
    const name = window.prompt("Presentation name:", current);
    if (name === null) return null;
    const trimmed = name.trim();
    return trimmed || current;
  }, [presentation]);

  const handleSave = useCallback(async () => {
    let sourceBeforeSave = presentationSource;
    if (isElectron() && sourceBeforeSave.kind !== "project") {
      try {
        const restoredSource = await getPresentationSource(presentationId);
        if (restoredSource.kind === "project") {
          sourceBeforeSave = restoredSource;
          setPresentationSource(restoredSource);
        }
      } catch (error) {
        console.warn(
          "[EditorPage] Could not refresh Electron project source:",
          error,
        );
      }
    }
    const result = await savePresentation();
    if (!result.success || !canUseProjectFolders) return;
    if (sourceBeforeSave.kind === "project") return;
    if (isElectron()) {
      try {
        await saveProjectToFolder(false);
      } catch (error) {
        console.error(
          "[EditorPage] Failed to save presentation folder:",
          error,
        );
        getElectronAPI().showError(
          "Save Failed",
          error?.message ?? "Could not save the presentation folder.",
        );
      }
      return;
    }
    const isFirstSave = !linkedFolderPathRef.current;
    const renameTo = isFirstSave ? promptForPresentationName() : null;
    if (isFirstSave && renameTo === null) return;
    try {
      await saveProjectToFolder(false, renameTo);
    } catch (error) {
      console.error(
        "[EditorPage] Failed to save presentation folder:",
        error,
      );
      const message =
        error?.message ?? "Could not save the presentation folder.";
      if (isElectron()) {
        getElectronAPI().showError("Save Failed", message);
      } else {
        window.alert(message);
      }
    }
  }, [
    presentationSource,
    presentationId,
    savePresentation,
    saveProjectToFolder,
    canUseProjectFolders,
    promptForPresentationName,
    setPresentationSource,
  ]);

  const handleSaveAs = useCallback(async () => {
    if (isElectron()) {
      // Save As must not touch the old project. Do NOT call savePresentation()
      // first (that would write current edits into the current project sink).
      // saveProjectToFolder(true) builds directly from the in-memory snapshot,
      // commits to the newly chosen folder, and only then switches the source;
      // a cancel or commit failure leaves the old project untouched. After the
      // source switch succeeds, run the normal save lifecycle against the new
      // active project so save status and manual Save agree immediately.
      try {
        const saved = await saveProjectToFolder(true);
        if (saved) await savePresentation();
      } catch (error) {
        console.error(
          "[EditorPage] Failed to save presentation folder:",
          error,
        );
        getElectronAPI().showError(
          "Save As Failed",
          error?.message ?? "Could not save the presentation folder.",
        );
      }
      return;
    }
    if (!canUseProjectFolders) {
      const renameTo = promptForPresentationName();
      if (renameTo === null) return;
      try {
        await downloadPresentationAsJson(
          renameTo
            ? {
                ...presentation,
                slideset: {
                  ...presentation.slideset,
                  title: renameTo,
                  filename: renameTo,
                },
              }
            : presentation,
        );
        if (renameTo) renamePresentation(renameTo);
      } catch (error) {
        console.warn(
          "[EditorPage] Standalone JSON export was blocked:",
          error,
        );
        window.alert(
          error?.message ??
            "Standalone JSON cannot include local presentation assets.",
        );
      }
      return;
    }
    const renameTo = promptForPresentationName();
    if (renameTo === null) return;
    try {
      const saved = await saveProjectToFolder(true, renameTo);
      if (saved) await savePresentation();
    } catch (error) {
      console.error(
        "[EditorPage] Failed to save presentation folder:",
        error,
      );
      const message =
        error?.message ?? "Could not save the presentation folder.";
      if (isElectron()) {
        getElectronAPI().showError("Save Failed", message);
      } else {
        window.alert(message);
      }
    }
  }, [
    presentation,
    savePresentation,
    saveProjectToFolder,
    canUseProjectFolders,
    promptForPresentationName,
    renamePresentation,
  ]);

  const requestCloseChoice = useCallback(async (source) => {
    const folderName = source.projectFolder
      ?.split(/[/\\]/)
      .filter(Boolean)
      .pop();
    if (isElectron()) {
      return getElectronAPI().confirmSaveBeforeQuit(folderName);
    }
    if (window.confirm("Save changes before closing?")) return "save";
    return window.confirm("Close without saving changes?")
      ? "discard"
      : "cancel";
  }, []);

  const cleanupClosedPresentation = useCallback(async () => {
    await deletePresentation(presentationId, {
      presentation,
      deleteMedia: true,
    });
  }, [presentation, presentationId]);

  const prepareToLeave = useCallback(async () => {
    const sourceBeforeClose = presentationSource;
    const hadPendingChanges =
      autosaveStatus === "pending" || autosaveStatus === "error";

    try {
      await eventBus.discardPending();
      const needsChoice =
        sourceBeforeClose.kind === "draft" || hadPendingChanges;
      const choice = needsChoice
        ? await requestCloseChoice(sourceBeforeClose)
        : null;

      if (choice === "cancel") {
        if (hadPendingChanges && autosaveEnabled) {
          eventBus.resumePending();
        }
        return false;
      }

      if (choice === "save") {
        const saveResult = await savePresentation({ silent: true });
        if (!saveResult.success) return false;
        if (sourceBeforeClose.kind === "draft") {
          const saved = await saveProjectToFolder(false);
          if (!saved) return false;
        }
      }

      await cleanupClosedPresentation();
      return true;
    } catch (error) {
      console.error(
        "[EditorPage] Could not close presentation safely:",
        error,
      );
      const message =
        error?.message ??
        "The presentation could not be closed safely.";
      if (isElectron()) {
        await getElectronAPI().showError("Close Failed", message);
      } else {
        window.alert(message);
      }
      return false;
    }
  }, [
    autosaveEnabled,
    autosaveStatus,
    cleanupClosedPresentation,
    eventBus,
    presentationSource,
    requestCloseChoice,
    savePresentation,
    saveProjectToFolder,
  ]);

  const handleClosePresentation = useCallback(async () => {
    if (await prepareToLeave()) navigate("/");
  }, [navigate, prepareToLeave]);

  const handleNew = useCallback(async () => {
    if (!(await prepareToLeave())) return;
    const id = await createPresentation(getPresentationTitle(null));
    navigate(`/editor/${id}`);
  }, [navigate, prepareToLeave]);

  const handleOpenRecentProject = useCallback(
    async (key) => {
      const isCurrentProject = await isRecentProjectCurrentSource(
        key,
        presentationId,
        presentationSource,
      );
      if (!(await prepareToLeave())) return false;
      if (isCurrentProject) {
        navigate(`/editor/${presentationId}`, {
          replace: true,
          state: { reloadPresentationToken: crypto.randomUUID() },
        });
        return true;
      }
      const id = await openRecentProject(key, { asDraftCopy: false });
      const navigationOptions = id === presentationId
        ? {
            replace: true,
            state: { reloadPresentationToken: crypto.randomUUID() },
          }
        : undefined;
      if (navigationOptions) navigate(`/editor/${id}`, navigationOptions);
      else navigate(`/editor/${id}`);
      return true;
    },
    [
      navigate,
      prepareToLeave,
      presentationId,
      presentationSource,
    ],
  );

  const handleLoadFile = useCallback(
    async (jsonText, readMediaFile = null) => {
      try {
        const validation = deserializePresentation(jsonText);
        if (!validation.data || validation.errors.length > 0) {
          const details = validation.errors.slice(0, 5).join("\n");
          throw new Error(
            `Invalid presentation file.${details ? `\n${details}` : ""}`,
          );
        }
        if (!(await prepareToLeave())) return;
        if (!readMediaFile && hasProjectRelativeAssetReferences(jsonText)) {
          const message =
            "This presentation references external media. Open the project folder instead to load images.";
          if (isElectron()) getElectronAPI().showMessage("Import JSON", message);
          else window.alert(message);
        }
        const finalJson = readMediaFile
          ? await rehydrateProjectManifestJson(jsonText, readMediaFile)
          : jsonText;
        const id = await importPresentationFromJson(finalJson);
        navigate(`/editor/${id}`);
      } catch (error) {
        console.error("[EditorPage] Failed to import file:", error);
        const message =
          error?.message ?? "Could not open this file.";
        if (isElectron()) {
          getElectronAPI().showError("Open Failed", message);
        } else {
          window.alert(message);
        }
      }
    },
    [navigate, prepareToLeave],
  );

  const openElectronProjectFromFolder = useCallback(
    async (projectFolder) => {
      const isCurrentProject = await isRecentProjectCurrentSource(
        projectFolder,
        presentationId,
        presentationSource,
      );
      if (!(await prepareToLeave())) return false;
      if (isCurrentProject) {
        navigate(`/editor/${presentationId}`, {
          replace: true,
          state: { reloadPresentationToken: crypto.randomUUID() },
        });
        return true;
      }
      const id =
        (await openElectronProjectFolder(projectFolder)).presentationId;
      const navigationOptions = id === presentationId
        ? {
            replace: true,
            state: { reloadPresentationToken: crypto.randomUUID() },
          }
        : undefined;
      if (navigationOptions) navigate(`/editor/${id}`, navigationOptions);
      else navigate(`/editor/${id}`);
      return true;
    },
    [
      navigate,
      prepareToLeave,
      presentationId,
      presentationSource,
    ],
  );

  const handleElectronOpen = useCallback(async () => {
    const api = getElectronAPI();
    if (typeof api?.chooseProjectToOpen !== "function") {
      console.warn("[EditorPage] Electron project open API is unavailable.");
      return false;
    }
    try {
      const projectFolder = await chooseElectronProjectToOpen();
      if (!projectFolder) return false;
      return await openElectronProjectFromFolder(projectFolder);
    } catch (error) {
      console.error("[EditorPage] Failed to open project:", error);
      api?.showError?.(
        "Open Failed",
        error?.message ?? "Could not open this project.",
      );
      return false;
    }
  }, [openElectronProjectFromFolder]);

  const handleOpenProjectFolder = useCallback(async () => {
    if (typeof getElectronAPI()?.chooseProjectToOpen === "function") {
      return handleElectronOpen();
    }
    if (!supportsFileSystemAccess()) {
      window.alert("Project folders are not supported in this browser. Use Import JSON instead.");
      return false;
    }
    try {
      const opened = await openBrowserProjectFolderFromPicker();
      if (!opened) return false;
      const isCurrentProject = await isRecentProjectCurrentSource(
        opened.recentId,
        presentationId,
        presentationSource,
      );
      if (!(await prepareToLeave())) return false;
      if (isCurrentProject) {
        navigate(`/editor/${presentationId}`, {
          replace: true,
          state: { reloadPresentationToken: crypto.randomUUID() },
        });
        return true;
      }
      const id = await importPresentationFromJson(opened.jsonText);
      await linkBrowserProjectFolder(id, opened.folderHandle);
      navigate(`/editor/${id}`);
      return true;
    } catch (error) {
      console.error("[EditorPage] Failed to open project folder:", error);
      window.alert(error?.message ?? "Could not open this project folder.");
      return false;
    }
  }, [
    handleElectronOpen,
    navigate,
    prepareToLeave,
    presentationId,
    presentationSource,
  ]);

  useEffect(() => {
    if (!isElectron()) return;
    const api = getElectronAPI();
    const unsubscribers = [
      api.onMenuNew(handleNew),
      api.onMenuOpen(handleElectronOpen),
      api.onMenuSave(handleSave),
      api.onMenuSaveAs(handleSaveAs),
      api.onFileDrop(async (filePath) => {
        try {
          const folder = filePath.replace(/[/\\][^/\\]*$/, "");
          await openElectronProjectFromFolder(folder);
        } catch (error) {
          console.error(
            "[EditorPage] Failed to open dropped project:",
            error,
          );
          api.showError(
            "Open Failed",
            error?.message ?? "Could not open this project.",
          );
        }
      }),
      api.onBeforeQuit(async () => {
        if (await prepareToLeave()) {
          api.notifyQuitReady(true);
        } else {
          api.cancelQuit();
        }
      }),
    ];
    return () =>
      unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [
    handleElectronOpen,
    handleNew,
    handleSave,
    handleSaveAs,
    openElectronProjectFromFolder,
    prepareToLeave,
  ]);

  const handleDeleteAndGoHome = useCallback(async () => {
    if (!presentationId) return;
    const confirmed = await confirmDialog(
      "Delete Presentation",
      "Delete this presentation? This cannot be undone.",
    );
    if (!confirmed) return;
    await deletePresentation(presentationId);
    navigate("/");
  }, [presentationId, navigate]);

  return {
    linkedFolderPath,
    handleSave,
    handleSaveAs,
    handleClosePresentation,
    handleNew,
    handleOpenRecentProject,
    handleElectronOpen,
    handleOpenProjectFolder,
    handleLoadFile,
    handleDeleteAndGoHome,
  };
}
