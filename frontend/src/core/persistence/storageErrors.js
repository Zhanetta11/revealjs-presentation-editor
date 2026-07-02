export const QUOTA_EXCEEDED_MESSAGE =
  "Browser storage is full. Export your presentation to keep it safe, then free up space by deleting old presentations or unused media.";

export const isQuotaExceededError = (error) =>
  error?.name === "QuotaExceededError" ||
  error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
  error?.code === 22;

export const toStorageError = (error) => {
  if (!isQuotaExceededError(error)) return error;
  const friendly = new Error(QUOTA_EXCEEDED_MESSAGE, { cause: error });
  friendly.name = "QuotaExceededError";
  return friendly;
};
