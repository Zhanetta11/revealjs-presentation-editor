const hasPrimaryModifier = (event) => event.ctrlKey || event.metaKey;

export const isEditableTarget = (target) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target.isContentEditable;

export const isUndoShortcut = (event) =>
  hasPrimaryModifier(event) && !event.shiftKey && event.key.toLowerCase() === "z";

export const isRedoShortcut = (event) =>
  hasPrimaryModifier(event) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));

export const isCopyShortcut = (event) =>
  hasPrimaryModifier(event) && event.key.toLowerCase() === "c";

export const isPasteShortcut = (event) =>
  hasPrimaryModifier(event) && event.key.toLowerCase() === "v";

export const isCutShortcut = (event) =>
  hasPrimaryModifier(event) && event.key.toLowerCase() === "x";

export const isSelectAllShortcut = (event) =>
  hasPrimaryModifier(event) && event.key.toLowerCase() === "a";

export const isDeleteShortcut = (event) =>
  event.key === "Delete" || event.key === "Backspace";

export const isEscapeShortcut = (event) => event.key === "Escape";

export const isEnterShortcut = (event) => event.key === "Enter";
