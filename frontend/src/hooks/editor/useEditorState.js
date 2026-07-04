import {
  useReducer,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createInitialEditorState, editorReducer } from "../../core/store/editorStore";
import { createEventBus } from "../../core/events/eventBus";
import { EditorEventType, createEditorEvent } from "../../core/events/editorEvents";
import {
  storageGet,
  updateIndexEntry,
  getSetting,
  createDraftSource,
  getPresentationSource,
  writeElectronProjectSnapshot,
  loadElectronProjectSnapshot,
  writeBrowserProjectSnapshot,
  loadBrowserLinkedProjectSnapshot,
} from "../../core/persistence/persistenceFacade";
import { isElectron } from "../../core/platform/electron";

const AUTOSAVE_SETTING_KEY = "autosaveEnabled";

const createCommitCoordinator = () => {
  let committedState = null;
  const waiters = [];
  return {
    commit(nextState) {
      committedState = nextState;
      waiters.splice(0).forEach((resolve) => resolve());
    },
    enqueue(resolve) {
      waiters.push(resolve);
    },
    getState() {
      return committedState;
    },
  };
};

const createSourceCoordinator = (initialSource) => {
  let currentSource = initialSource;
  return {
    get() {
      return currentSource;
    },
    set(source) {
      currentSource = source;
    },
  };
};

export function useEditorState(presentationId, { onSaveError } = {}) {
  const storageKey = presentationId
    ? `presentation-${presentationId}`
    : "presentation";

  const [commitCoordinator] = useState(createCommitCoordinator);
  const committedReducer = (currentState, event) => {
    const nextState = editorReducer(currentState, event);
    return {
      ...nextState,
      __commitRevision: (currentState.__commitRevision ?? 0) + 1,
    };
  };
  const [state, reactDispatch] = useReducer(
    committedReducer,
    undefined,
    createInitialEditorState,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const initialSource = useMemo(
    () => createDraftSource(presentationId),
    [presentationId],
  );
  const [presentationSource, setPresentationSourceState] = useState(initialSource);
  const [sourceCoordinator] = useState(
    () => createSourceCoordinator(initialSource),
  );
  const setPresentationSource = useCallback((source) => {
    sourceCoordinator.set(source);
    setPresentationSourceState(source);
  }, [sourceCoordinator]);

  useEffect(() => {
    globalThis.navigator?.storage?.persist?.().catch((error) => {
      console.warn("[EditorState] Persistent storage request failed:", error);
    });
  }, []);

  useLayoutEffect(() => {
    commitCoordinator.commit(state);
  }, [commitCoordinator, state]);

  const dispatchAndCommit = useCallback(
    (event) =>
      new Promise((resolve) => {
        commitCoordinator.enqueue(resolve);
        reactDispatch(event);
      }),
    [commitCoordinator, reactDispatch],
  );
  const getCommittedState = useCallback(
    () => commitCoordinator.getState(),
    [commitCoordinator],
  );
  const getAutosaveSource = useCallback(
    () => sourceCoordinator.get(),
    [sourceCoordinator],
  );
  const persistProject = useCallback(
    ({ presentationId: id, presentation, projectFolder, source }) => {
      if (source?.platform === "browser" || !isElectron()) {
        return writeBrowserProjectSnapshot({
          presentationId: id,
          presentation,
        });
      }
      return writeElectronProjectSnapshot({
          presentationId: id,
          presentation,
          projectFolder,
        });
    },
    [],
  );

  const eventBus = useMemo(
    () => createEventBus(dispatchAndCommit, getCommittedState, {
      storageKey,
      onSaveError: onSaveError ?? ((err) => console.error("[EditorState] Autosave failed:", err)),
      onSaveStatusChange: setSaveStatus,
      getSource: getAutosaveSource,
      persistProject,
    }),
    [
      dispatchAndCommit,
      getAutosaveSource,
      getCommittedState,
      onSaveError,
      persistProject,
      storageKey,
    ],
  );

  useEffect(() => {
    const flush = () => {
      eventBus.flush().catch((error) => {
        console.error("[EditorState] Failed to flush pending changes:", error);
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
      eventBus.dispose();
    };
  }, [eventBus]);

  useEffect(() => {
    let cancelled = false;
    getPresentationSource(presentationId)
      .catch(() => createDraftSource(presentationId))
      .then(async (source) => {
        if (cancelled) return null;
        let saved;
        if (source.kind === "project") {
          try {
            saved = source.platform === "browser"
              ? (await loadBrowserLinkedProjectSnapshot(presentationId)).jsonText
              : (await loadElectronProjectSnapshot(source.projectFolder)).jsonText;
          } catch (error) {
            console.warn(
              "[EditorState] Could not load the active project folder; using local recovery data:",
              error,
            );
            saved = await storageGet(storageKey);
          }
        } else {
          saved = await storageGet(storageKey);
        }
        return { saved, source };
      })
      .then((loaded) => {
        if (!loaded) return;
        const { saved, source } = loaded;
        if (cancelled) return;
        setPresentationSource(source);
        if (!saved) return;
        const raw = getSetting(AUTOSAVE_SETTING_KEY);
        const autosaveEnabled = raw === null ? true : raw === "true";
        reactDispatch(
          createEditorEvent(EditorEventType.PRESENTATION.LOAD, {
            jsonString: saved,
            autosaveEnabled,
          }),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[EditorState] Failed to load presentation state:", error);
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [presentationId, setPresentationSource, storageKey]);

  useEffect(() => {
    if (isLoading || !presentationId) return;
    if (isElectron() && presentationSource.kind === "project") return;
    const title =
      state.presentation?.slideset?.title ??
      state.presentation?.slideset?.filename ??
      "Untitled Presentation";
    updateIndexEntry(presentationId, title);
  }, [
    presentationId,
    isLoading,
    presentationSource.kind,
    state.presentation?.slideset?.title,
    state.presentation?.slideset?.filename,
  ]);

  return {
    state,
    eventBus,
    isLoading,
    saveStatus,
    presentationSource,
    setPresentationSource,
  };
}
