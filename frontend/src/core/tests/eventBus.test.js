import { describe, test, expect, vi, beforeEach } from "vitest";
import { createEventBus } from "../events/eventBus";
import { EditorEventType } from "../events/editorEvents";

vi.mock("../persistence/autoSaveService", () => {
  return {
    createAutosaveService: vi.fn(() => ({
      scheduleAutosave: vi.fn(),
      saveImmediately: vi.fn(),
      persistAutosaveSetting: vi.fn(),
      shouldAutosave: vi.fn((eventType) =>
        [
          EditorEventType.SLIDE.ADD,
          EditorEventType.MEDIA.ADD,
          EditorEventType.MEDIA.DELETE,
          EditorEventType.MEDIA.UPDATE,
          EditorEventType.ELEMENT.UPDATE_SILENT,
          EditorEventType.HISTORY.CANCEL,
          EditorEventType.HISTORY.UNDO,
          EditorEventType.HISTORY.REDO,
        ].includes(eventType)
      ),
    })),
  };
});

import { createAutosaveService } from "../persistence/autoSaveService";

describe("createEventBus", () => {
  let reactDispatch;
  let getState;
  let eventBus;
  let autosave;

  beforeEach(() => {
    vi.clearAllMocks();

    reactDispatch = vi.fn();
    getState = vi.fn(() => ({
        autosaveEnabled: true,
        presentation: {
            slideset: {
            slides: [],
            },
        },
    }));

    eventBus = createEventBus(reactDispatch, getState);
    autosave = createAutosaveService.mock.results[0].value;
  });

  test("dispatch forwards event to reducer", async () => {
    const event = {
      type: EditorEventType.SLIDE.ADD,
      payload: {},
    };

    await eventBus.dispatch(event);

    expect(reactDispatch).toHaveBeenCalledWith(event);
  });

  test("dispatch schedules autosave for slide changes", async () => {
    const event = {
      type: EditorEventType.SLIDE.ADD,
      payload: {},
    };

    await eventBus.dispatch(event);

    expect(autosave.shouldAutosave).toHaveBeenCalledWith(
      EditorEventType.SLIDE.ADD
    );
    expect(autosave.scheduleAutosave).toHaveBeenCalled();
  });

  test("dispatch schedules autosave for media add", async () => {
    const event = {
      type: EditorEventType.MEDIA.ADD,
      payload: {
        mediaElement: {
          id: "media-1",
        },
      },
    };

    await eventBus.dispatch(event);

    expect(autosave.shouldAutosave).toHaveBeenCalledWith(
      EditorEventType.MEDIA.ADD
    );
    expect(autosave.scheduleAutosave).toHaveBeenCalled();
  });

  test("dispatch saves immediately for manual save event", async () => {
    const event = {
      type: EditorEventType.PRESENTATION.SAVE,
      payload: {},
    };

    await eventBus.dispatch(event);

    expect(autosave.saveImmediately).toHaveBeenCalled();
    expect(autosave.scheduleAutosave).not.toHaveBeenCalled();
  });

  test("manual save failures are returned to the caller", async () => {
    const error = new Error("IndexedDB is unavailable");
    autosave.saveImmediately.mockRejectedValueOnce(error);

    await expect(eventBus.dispatch({
      type: EditorEventType.PRESENTATION.SAVE,
      payload: {},
    })).rejects.toThrow("IndexedDB is unavailable");
  });

  test("dispatch persists the updated autosave setting", async () => {
    getState.mockReturnValue({
      autosaveEnabled: false,
      presentation: { slideset: { slides: [] } },
    });

    await eventBus.dispatch({
      type: EditorEventType.PRESENTATION.TOGGLE_AUTOSAVE,
      payload: {},
    });

    expect(autosave.persistAutosaveSetting).toHaveBeenCalledWith(false);
    expect(autosave.scheduleAutosave).not.toHaveBeenCalled();
  });

  test("dispatch does not autosave for slide select", async () => {
    const event = {
      type: EditorEventType.SLIDE.SELECT,
      payload: {
        slideIndex: 0,
      },
    };

    await eventBus.dispatch(event);

    expect(autosave.shouldAutosave).toHaveBeenCalledWith(
      EditorEventType.SLIDE.SELECT
    );
    expect(autosave.scheduleAutosave).not.toHaveBeenCalled();
    expect(autosave.saveImmediately).not.toHaveBeenCalled();
  });

  test("dispatch does not schedule an autosave when autosave is disabled", async () => {
    getState.mockReturnValue({
        autosaveEnabled: false,
        presentation: {
        slideset: {
            slides: [],
        },
    },
    });

    const event = {
        type: EditorEventType.SLIDE.ADD,
        payload: {},
    };

    await eventBus.dispatch(event);

    expect(autosave.scheduleAutosave).not.toHaveBeenCalled();
    });

  test("dispatch still marks pending status when autosave is disabled", async () => {
    const onSaveStatusChange = vi.fn();
    getState.mockReturnValue({
      autosaveEnabled: false,
      presentation: {
        slideset: {
          slides: [],
        },
      },
    });
    const busWithStatus = createEventBus(reactDispatch, getState, { onSaveStatusChange });

    await busWithStatus.dispatch({ type: EditorEventType.SLIDE.ADD, payload: {} });

    expect(onSaveStatusChange).toHaveBeenCalledWith("pending");
  });
});
