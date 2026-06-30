import { useEffect } from "react";
import { getMediaFile } from "../core/persistence/persistenceFacade";
import { fontFormat } from "../core/utils/fontFormat";

export function usePresentationFonts(presentation) {
  useEffect(() => {
    const fonts = presentation?.slideset?.fonts ?? [];
    if (fonts.length === 0) return;

    const objectUrls = [];
    let style = null;
    let cancelled = false;

    async function load() {
      const rules = await Promise.all(
        fonts
          .filter((f) => f["font-id"] && f["font-file"])
          .map(async (f) => {
            let src = f["font-file"];
            let mimeType = "";

            if (src.startsWith("indexeddb://")) {
              const key = src.replace("indexeddb://", "");
              const blob = await getMediaFile(key);
              if (cancelled || !blob) return null;
              mimeType = blob.type;
              const url = URL.createObjectURL(blob);
              objectUrls.push(url);
              src = url;
            }

            return (
              `@font-face {\n` +
              `  font-family: "${f["font-id"]}";\n` +
              `  src: url("${src}") format("${fontFormat(f["font-file"], mimeType)}");\n` +
              `  font-weight: normal;\n` +
              `  font-style: normal;\n` +
              `}`
            );
          }),
      );

      if (cancelled) return;

      const css = rules.filter(Boolean).join("\n");
      if (!css) return;

      style = document.createElement("style");
      style.setAttribute("data-presentation-fonts", "true");
      style.textContent = css;
      document.head.appendChild(style);
    }

    load();

    return () => {
      cancelled = true;
      if (style) document.head.removeChild(style);
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [presentation?.slideset?.fonts]);
}
