import { useEffect, useState } from "react";
import { getMediaFile } from "../../core/persistence/persistenceFacade";

export function useMediaSrc(fileLink) {
  const [src, setSrc] = useState(() => {
    if (!fileLink) return null;
    if (!fileLink.startsWith("indexeddb://")) return fileLink;
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    async function load() {
      if (!fileLink) {
        setSrc(null);
        return;
      }

      if (!fileLink.startsWith("indexeddb://")) {
        setSrc(fileLink);
        return;
      }

      const key = fileLink.replace("indexeddb://", "");
      const blob = await getMediaFile(key);
      if (cancelled || !blob) return;

      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileLink]);

  return src;
}
