export const paragraphText = (paragraph) =>
  (paragraph?.runs ?? []).map((run) => run.text ?? "").join("");

export const canCopyOrCutEditorSelection = ({
  hasRealTextSelection,
  selectedElementCount,
  isEditingSelectedText,
  objectSelectionMode,
}) =>
  Boolean(hasRealTextSelection) ||
  selectedElementCount > 1 ||
  (selectedElementCount === 1 &&
    (!isEditingSelectedText || objectSelectionMode));

export const getSelectedLink = (textElement, selection) => {
  if (!textElement || !selection) return null;
  const para = textElement.paragraphs?.[selection.paragraphIdx];
  if (!para) return null;
  const start = Math.min(selection.rangeStart, selection.rangeEnd);
  const end = Math.max(selection.rangeStart, selection.rangeEnd);
  let offset = 0;
  for (const run of para.runs ?? []) {
    const runEnd = offset + run.text.length;
    if (runEnd > start && offset < end) return run.link ?? null;
    offset = runEnd;
  }
  return null;
};

export const getSelectedPlainText = (textElement, selection) => {
  if (!textElement || !selection) return "";
  const startParagraphIdx = Math.min(
    selection.paragraphIdx,
    selection.endParagraphIdx ?? selection.paragraphIdx,
  );
  const endParagraphIdx = Math.max(
    selection.paragraphIdx,
    selection.endParagraphIdx ?? selection.paragraphIdx,
  );
  const lines = [];
  for (let pIdx = startParagraphIdx; pIdx <= endParagraphIdx; pIdx++) {
    const text = paragraphText(textElement.paragraphs?.[pIdx]);
    const start = pIdx === selection.paragraphIdx ? selection.rangeStart : 0;
    const end =
      pIdx === (selection.endParagraphIdx ?? selection.paragraphIdx)
        ? selection.rangeEnd
        : text.length;
    lines.push(text.slice(Math.min(start, end), Math.max(start, end)));
  }
  return lines.join("\n");
};

export const readImageDimensionsFromFile = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: 300, height: 200 });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

export const readVideoDimensionsFromFile = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve({ width: 480, height: 270 });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });

export const fitImageToSlide = (width, height, slideWidth, slideHeight) => {
  const maxW = slideWidth * 0.35;
  const maxH = slideHeight * 0.35;
  if (width <= maxW && height <= maxH) return { width, height };
  const scale = Math.min(maxW / width, maxH / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const readClipboardPayload = async () => {
  const payload = { text: "", html: "", imageBlob: null, imageType: "" };
  try {
    const items = await navigator.clipboard?.read?.();
    for (const item of items ?? []) {
      if (!payload.imageBlob) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          payload.imageBlob = await item.getType(imageType);
          payload.imageType = imageType;
        }
      }
      if (!payload.html && item.types.includes("text/html"))
        payload.html = await (await item.getType("text/html")).text();
      if (!payload.text && item.types.includes("text/plain"))
        payload.text = await (await item.getType("text/plain")).text();
    }
  } catch {}
  if (!payload.text) {
    try {
      payload.text = (await navigator.clipboard?.readText?.()) ?? "";
    } catch {}
  }
  return payload;
};
