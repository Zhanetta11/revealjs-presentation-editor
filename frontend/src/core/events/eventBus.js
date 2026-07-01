import { EditorEventType } from "./editorEvents";
import { createAutosaveService } from "../persistence/autoSaveService";

export const createEventBus = (dispatchAndCommit, getState, { storageKey, onSaveError, onSaveStatusChange } = {}) => {
  const autosave = createAutosaveService(getState, {
    storageKey,
    onError: onSaveError,
    onStatusChange: onSaveStatusChange,
  });

  return {
    async dispatch(event) {
      if (import.meta.env.DEV) {
        console.log(`[EventBus] → ${event.type}`);
      }

      try {
        await dispatchAndCommit(event);

        if (event.type === EditorEventType.PRESENTATION.TOGGLE_AUTOSAVE) {
          const state = getState();
          if (state) await autosave.persistAutosaveSetting(state.autosaveEnabled);
        } else if (event.type === EditorEventType.PRESENTATION.SAVE) {
          await autosave.saveImmediately();
        } else {
          const state = getState();
          if (!state) return;

          if (autosave.shouldAutosave(event.type)) {
            if (state.autosaveEnabled) {
              autosave.scheduleAutosave(event.type);
            } else {
              onSaveStatusChange?.("pending");
            }
          }
        }
      } catch (error) {
        console.error(`[EventBus] Failed to dispatch ${event.type}:`, error);
        throw error;
      }
    },
    flush: () => autosave.flush(),
    dispose: () => autosave.dispose(),
  };
};
