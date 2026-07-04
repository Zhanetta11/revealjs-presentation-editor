const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const SNAP_THRESHOLD = 5;

export const normalizeAngle = (angle) => ((angle % 360) + 360) % 360;

export const snapAngle = (angle) => {
  const normalized = normalizeAngle(angle);
  for (const snap of SNAP_ANGLES) {
    if (Math.abs(normalized - snap) <= SNAP_THRESHOLD) return snap % 360;
  }
  return normalized;
};

export const computeResize = (dir, initial, mouse, canvasWidth, canvasHeight) => {
  const { x, y, width, height } = initial;
  const dx = mouse.x - initial.mouseX;
  const dy = mouse.y - initial.mouseY;

  let newX = x, newY = y, newW = width, newH = height;

  if (dir === "nw" || dir === "w" || dir === "sw") { newX = x + dx; newW = width - dx; }
  else if (dir === "ne" || dir === "e" || dir === "se") { newW = width + dx; }

  if (dir === "nw" || dir === "n" || dir === "ne") { newY = y + dy; newH = height - dy; }
  else if (dir === "sw" || dir === "s" || dir === "se") { newH = height + dy; }

  const minW = 80, minH = 30;

  if (newW < minW) {
    if (dir === "nw" || dir === "w" || dir === "sw") newX = x + width - minW;
    newW = minW;
  }
  if (newH < minH) {
    if (dir === "nw" || dir === "n" || dir === "ne") newY = y + height - minH;
    newH = minH;
  }

  if (newX < 0) {
    if (dir === "nw" || dir === "w" || dir === "sw") newW = Math.max(minW, newW + newX);
    newX = 0;
  }
  if (newY < 0) {
    if (dir === "nw" || dir === "n" || dir === "ne") newH = Math.max(minH, newH + newY);
    newY = 0;
  }
  if (canvasWidth != null && newX + newW > canvasWidth) newW = canvasWidth - newX;
  if (canvasHeight != null && newY + newH > canvasHeight) newH = canvasHeight - newY;

  return { newX, newY, newW, newH };
};

export const getElementRotationAngle = (element, mouseX, mouseY) => {
  const cx = (element.position?.x ?? 0) + (element.width ?? 300) / 2;
  const cy = (element.position?.y ?? 0) + (element.height ?? 200) / 2;
  return (Math.atan2(mouseY - cy, mouseX - cx) * 180) / Math.PI;
};
