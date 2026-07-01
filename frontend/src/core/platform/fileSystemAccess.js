export const supportsFileSystemAccess = () =>
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
