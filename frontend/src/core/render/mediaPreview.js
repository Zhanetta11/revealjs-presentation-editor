const videoPreviewSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48">
    <defs>
      <linearGradient id="video-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1f2937"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="64" height="48" rx="3" fill="url(#video-bg)"/>
    <circle cx="32" cy="21" r="11" fill="#ffffff" fill-opacity="0.18"/>
    <path d="M29 15.5v11l9-5.5z" fill="#ffffff"/>
    <text x="32" y="41" text-anchor="middle" fill="#cbd5e1"
      font-family="Arial, sans-serif" font-size="7" font-weight="700">VIDEO</text>
  </svg>
`;

export const DEFAULT_VIDEO_PREVIEW_SRC =
  `data:image/svg+xml,${encodeURIComponent(videoPreviewSvg)}`;

export const getVideoPosterReference = (media) => {
  if (media?.["media-type"] !== "video") return null;
  const candidates = [
    media.poster,
    media["poster-link"],
    media.thumbnail,
    media["thumbnail-link"],
  ];
  return candidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim(),
  ) ?? null;
};
