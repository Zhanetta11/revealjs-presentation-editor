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
  openElectronProjectFolder,
  saveBrowserProjectSnapshot,
  writeAndCommitElectronProjectSnapshot,
} from "../../core/persistence/persistenceFacade";
import { deserializePresentation } from "../../core/persistence/serializationOperations";
import { importPresentationFromJson } from "../../core/persistence/importPresentation";
import { rehydrateProjectManifestJson } from "../../core/persistence/projectMediaRehydrate";
import { openRecentProject } from "../useProjectLibrary";

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
    const sourceBeforeSave = presentationSource;
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
    savePresentation,
    saveProjectToFolder,
    canUseProjectFolders,
    promptForPresentationName,
  ]);

  const handleSaveAs = useCallback(async () => {
    if (isElectron()) {
      const result = await savePresentation();
      if (!result.success) return;
      try {
        await saveProjectToFolder(true);
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
      await saveProjectToFolder(true, renameTo);
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
      if (!(await prepareToLeave())) return false;
      const id = await openRecentProject(key);
      navigate(`/editor/${id}`);
      return true;
    },
    [navigate, prepareToLeave],
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
      if (!(await prepareToLeave())) return false;
      const { presentationId: id } =
        await openElectronProjectFolder(projectFolder);
      navigate(`/editor/${id}`);
      return true;
    },
    [navigate, prepareToLeave],
  );

  const handleElectronOpen = useCallback(async () => {
    const api = getElectronAPI();
    try {
      const projectFolder = await chooseElectronProjectToOpen();
      if (!projectFolder) return;
      await openElectronProjectFromFolder(projectFolder);
    } catch (error) {
      console.error("[EditorPage] Failed to open project:", error);
      api.showError(
        "Open Failed",
        error?.message ?? "Could not open this project.",
      );
    }
  }, [openElectronProjectFromFolder]);

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
    handleLoadFile,
    handleDeleteAndGoHome,
  };
}
