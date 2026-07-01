import { createPresentation, savePresentation } from "./persistenceFacade";
import { DEFAULT_PRESENTATION_TITLE } from "../utils/presentationUtils";
import { deserializePresentation } from "./serializationOperations";

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export const importPresentationFromJson = async (jsonText) => {
  if (typeof jsonText !== "string" || new Blob([jsonText]).size > MAX_IMPORT_BYTES) {
    throw new Error("Presentation JSON must be text and no larger than 25 MB.");
  }

  const result = deserializePresentation(jsonText);
  if (!result.data || result.errors.length > 0) {
    const details = result.errors.slice(0, 5).join("\n");
    throw new Error(`Invalid presentation file.${details ? `\n${details}` : ""}`);
  }
  const data = result.data;

  const title = data.slideset.title ?? data.slideset.filename ?? DEFAULT_PRESENTATION_TITLE;
  const id = await createPresentation(title);
  await savePresentation(id, data);
  return id;
};
