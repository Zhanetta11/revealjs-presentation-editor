import { serializePresentation } from "./serializationOperations";
import { updateIndexEntry } from "./presentationsLibrary";
import { setSetting } from "./persistenceFacade";
import { EditorEventType } from "../events/editorEvents";
import { storageAdapter } from "./storageAdapter";

const AUTOSAVE_SETTING_KEY = "autosaveEnabled";

const DEFAULT_STORAGE_KEY = "presentation";
const DEFAULT_AUTOSAVE_DELAY = 2000;
const TEXT_UPDATE_AUTOSAVE_DELAY = 5000;

const AUTO_SAVE_EVENTS = new Set([
  EditorEventType.PRESENTATION.CREATE,
  EditorEventType.SLIDE.ADD,
  EditorEventType.SLIDE.DELETE,
  EditorEventType.SLIDE.DUPLICATE,
  EditorEventType.SLIDE.REORDER,
  EditorEventType.SLIDE.TOGGLE_HIDDEN,
  EditorEventType.SLIDE.UPDATE_TRANSITION,
  EditorEventType.SLIDE.UPDATE_NOTES,
  EditorEventType.SLIDE.UPDATE_BACKGROUND,
  EditorEventType.SLIDE.APPLY_TRANSITION_TO_ALL,
  EditorEventType.SLIDE.APPLY_BACKGROUND_TO_ALL,

  EditorEventType.TEXT.ADD,
  EditorEventType.TEXT.UPDATE_CONTENT,
  EditorEventType.TEXT.UPDATE_FORMATTING,
  EditorEventType.TEXT.UPDATE_PARAGRAPH_FORMATTING,
  EditorEventType.TEXT.UPDATE_RANGE_FORMATTING,
  EditorEventType.TEXT.UPDATE_PARAGRAPHS,
  EditorEventType.TEXT.UPDATE_RUN_LINK,
  EditorEventType.TEXT.DELETE,

  EditorEventType.MEDIA.ADD,
  EditorEventType.MEDIA.DELETE,
  EditorEventType.MEDIA.UPDATE,

  EditorEventType.ELEMENT.RESIZE,
  EditorEventType.ELEMENT.UPDATE,
  EditorEventType.ELEMENT.UPDATE_SILENT,
  EditorEventType.ELEMENT.CUT,
  EditorEventType.ELEMENT.PASTE,
  EditorEventType.ELEMENT.DELETE_SELECTION,
  EditorEventType.ELEMENT.UPDATE_MANY,

  EditorEventType.ANIMATION.ADD,
  EditorEventType.ANIMATION.UPDATE,
  EditorEventType.ANIMATION.DELETE,

  EditorEventType.LAYOUT.ADD,
  EditorEventType.LAYOUT.DELETE,
  EditorEventType.LAYOUT.APPLY,
  EditorEventType.LAYOUT.UPDATE_PLACEHOLDERS,
  EditorEventType.LAYOUT.RESET,
  EditorEventType.LAYOUT.RENAME,
  EditorEventType.LAYOUT.ADD_ELEMENT,
  EditorEventType.LAYOUT.DELETE_ELEMENT,
  EditorEventType.LAYOUT.ADD_PLACEHOLDER,
  EditorEventType.LAYOUT.DELETE_PLACEHOLDER,
  EditorEventType.LAYOUT.UPDATE_FONT,
  EditorEventType.LAYOUT.UPDATE_ITEM,
  EditorEventType.LAYOUT.UPDATE_TEXT_FORMATTING,

  EditorEventType.FONT.ADD,
  EditorEventType.FONT.DELETE,

  EditorEventType.MASTER.UPDATE_THEME,
  EditorEventType.MASTER.UPDATE_THEME_COLOR,
  EditorEventType.MASTER.UPDATE_DIMENSIONS,
  EditorEventType.MASTER.UPDATE_FORMATTING,
  EditorEventType.MASTER.ADD_ELEMENT,
  EditorEventType.MASTER.UPDATE_ITEM,
  EditorEventType.MASTER.DELETE_ELEMENT,
  EditorEventType.MASTER.TOGGLE_TITLE,
  EditorEventType.MASTER.TOGGLE_FOOTERS,

  EditorEventType.COMMENT.ADD,
  EditorEventType.COMMENT.DELETE,

  EditorEventType.HISTORY.CANCEL,
  EditorEventType.HISTORY.UNDO,
  EditorEventType.HISTORY.REDO,
]);

const createDebounce = (fn, delay) => {
  let timer = null;
  let pending = null;

  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (!pending) {
      pending = {};
      pending.promise = new Promise((resolve, reject) => {
        pending.resolve = resolve;
        pending.reject = reject;
      });
      pending.promise.catch(() => {});
    }
    timer = setTimeout(() => {
      timer = null;
      const current = pending;
      pending = null;
      Promise.resolve(fn()).then(current.resolve, current.reject);
    }, delay);
    return pending.promise;
  };

  schedule.flush = () => {
    if (!timer) return Promise.resolve();
    clearTimeout(timer);
    timer = null;
    const current = pending;
    pending = null;
    return Promise.resolve(fn()).then(current.resolve, current.reject);
  };

  schedule.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending?.resolve();
    pending = null;
  };
  schedule.hasPending = () => timer !== null;

  return schedule;
};

export const createAutosaveService = (
  getState,
  { storageKey = DEFAULT_STORAGE_KEY, delay = DEFAULT_AUTOSAVE_DELAY, onError, onStatusChange } = {},
) => {
  let saveQueue = Promise.resolve();
  const setStatus = (status) => onStatusChange?.(status);

  const persist = () => {
    setStatus("saving");
    const task = saveQueue.then(async () => {
      const state = getState();
      if (!state?.presentation) {
        throw new Error("No presentation state is available to save.");
      }
      const id = storageKey.startsWith("presentation-") ? storageKey.slice("presentation-".length) : storageKey;
      const title = state.presentation?.slideset?.title
        ?? state.presentation?.slideset?.filename
        ?? "Untitled Presentation";
      const write = async () => {
        await storageAdapter.set(storageKey, serializePresentation(state.presentation));
        await updateIndexEntry(id, title);
      };
      if (globalThis.navigator?.locks) {
        await navigator.locks.request(`presentation-write:${storageKey}`, write);
      } else {
        await write();
      }
      if (import.meta.env.DEV) {
        console.log("[AutosaveService] Saved.");
      }
    });
    task.then(
      () => setStatus("saved"),
      (error) => {
        console.error("[AutosaveService] Save failed:", error);
        onError?.(error);
        setStatus("error");
      },
    );
    saveQueue = task.catch(() => {});
    return task;
  };

  const scheduleAutosave = createDebounce(persist, delay);
  const scheduleTextAutosave = createDebounce(persist, TEXT_UPDATE_AUTOSAVE_DELAY);
  const saveImmediately = async () => {
    scheduleAutosave.cancel();
    scheduleTextAutosave.cancel();
    return persist();
  };
  const shouldAutosave = (eventType) => AUTO_SAVE_EVENTS.has(eventType);

  const schedule = (eventType) => {
    setStatus("pending");
    if (eventType === EditorEventType.TEXT.UPDATE_CONTENT) {
      scheduleTextAutosave();
    } else {
      scheduleAutosave();
    }
  };

  const persistAutosaveSetting = (enabled) =>
    Promise.resolve(setSetting(AUTOSAVE_SETTING_KEY, String(enabled)));

  const flush = async () => {
    const hasPending = scheduleAutosave.hasPending() || scheduleTextAutosave.hasPending();
    scheduleAutosave.cancel();
    scheduleTextAutosave.cancel();
    if (hasPending) await persist();
    await saveQueue;
  };

  const dispose = () => {
    scheduleAutosave.cancel();
    scheduleTextAutosave.cancel();
  };

  return {
    scheduleAutosave: schedule,
    saveImmediately,
    shouldAutosave,
    persistAutosaveSetting,
    flush,
    dispose,
  };
};
