import { isElectron, getElectronAPI } from "../platform/electron";

const parseSlideLink = (href) => {
  const match = /^#slide-(\d+)$/.exec(href ?? "");
  return match ? Number(match[1]) - 1 : null;
};

export const followHyperlink = (href, navigateToSlide) => {
  if (!href) return;
  const slideIndex = parseSlideLink(href);
  if (slideIndex !== null) {
    navigateToSlide?.(slideIndex);
    return;
  }
  if (href.startsWith("file:")) {
    if (isElectron()) {
      getElectronAPI().openLocalFile(href).catch((error) => {
        console.warn("[Hyperlink] Failed to open local file:", error);
      });
    }
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
};

export const normalizeHyperlinkHref = (raw, linkType = "web") => {
  const value = (raw ?? "").trim();
  if (!value) return value;
  if (linkType === "email") {
    return value.startsWith("mailto:") ? value : `mailto:${value}`;
  }
  if (value.startsWith("#") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    return value;
  }
  return `https://${value}`;
};
