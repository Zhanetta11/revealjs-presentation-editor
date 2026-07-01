import { useReducer, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { createInitialEditorState, editorReducer } from "../core/store/editorStore";
import { createEventBus } from "../core/events/eventBus";
import { EditorEventType, createEditorEvent } from "../core/events/editorEvents";
import { storageGet, updateIndexEntry, getSetting } from "../core/persistence/persistenceFacade";

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

  const eventBus = useMemo(
    () => createEventBus(dispatchAndCommit, getCommittedState, {
      storageKey,
      onSaveError: onSaveError ?? ((err) => console.error("[EditorState] Autosave failed:", err)),
      onSaveStatusChange: setSaveStatus,
    }),
    [dispatchAndCommit, getCommittedState, onSaveError, storageKey],
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
    storageGet(storageKey)
      .then((saved) => {
        if (cancelled || !saved) return;
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
          console.error("[EditorState] Failed to load presentation from IndexedDB:", error);
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [storageKey]);

  useEffect(() => {
    if (isLoading || !presentationId) return;
    const title =
      state.presentation?.slideset?.title ??
      state.presentation?.slideset?.filename ??
      "Untitled Presentation";
    updateIndexEntry(presentationId, title);
  }, [
    presentationId,
    isLoading,
    state.presentation?.slideset?.title,
    state.presentation?.slideset?.filename,
  ]);

  return { state, eventBus, isLoading, saveStatus };
}
