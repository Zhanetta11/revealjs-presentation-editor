export const DEFAULT_SLIDE_WIDTH = 1280;
export const DEFAULT_SLIDE_HEIGHT = 720;
export const DEFAULT_SLIDE_SIZE = {
  width: DEFAULT_SLIDE_WIDTH,
  height: DEFAULT_SLIDE_HEIGHT,
};

export const SLIDE_SIZES = [
  { label: "Widescreen (16:9)", aspectRatio: "16:9", width: DEFAULT_SLIDE_WIDTH, height: DEFAULT_SLIDE_HEIGHT },
  { label: "Standard (4:3)", aspectRatio: "4:3", width: 1024, height: 768 },
];

export const ASPECT_RATIOS = SLIDE_SIZES.map((s) => ({
  label: s.aspectRatio,
  width: s.width,
  height: s.height,
}));

export const clampSlideDimension = (value, defaultValue) =>
  Math.max(100, parseInt(value) || defaultValue);
