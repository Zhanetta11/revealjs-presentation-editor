export const SLIDE_SIZES = [
  { label: "Widescreen (16:9)", aspectRatio: "16:9", width: 1280, height: 720 },
  { label: "Standard (4:3)", aspectRatio: "4:3", width: 1024, height: 768 },
];

export const ASPECT_RATIOS = SLIDE_SIZES.map((s) => ({
  label: s.aspectRatio,
  width: s.width,
  height: s.height,
}));

export const clampSlideDimension = (value, defaultValue) =>
  Math.max(100, parseInt(value) || defaultValue);
