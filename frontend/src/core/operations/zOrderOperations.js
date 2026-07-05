const numericZIndex = (element) => {
  const value = Number(element?.["z-index"]);
  return Number.isFinite(value) ? value : 1;
};

const Z_ORDER_COLLECTIONS = ["text", "media", "shapes", "tables", "groups"];

export const getElementsInZOrder = (slide) => {
  const elements = Z_ORDER_COLLECTIONS.flatMap((collection) =>
    Array.isArray(slide?.contents?.[collection])
      ? slide.contents[collection]
      : [],
  );

  return elements
    .map((element, sourceIndex) => ({ element, sourceIndex }))
    .sort(
      (a, b) =>
        numericZIndex(a.element) - numericZIndex(b.element) ||
        a.sourceIndex - b.sourceIndex,
    )
    .map(({ element }) => element);
};

const moveSelectedForward = (elements, selectedIds) => {
  const result = [...elements];
  for (let index = result.length - 2; index >= 0; index -= 1) {
    if (
      selectedIds.has(result[index].id) &&
      !selectedIds.has(result[index + 1].id)
    ) {
      [result[index], result[index + 1]] = [
        result[index + 1],
        result[index],
      ];
    }
  }
  return result;
};

const moveSelectedBackward = (elements, selectedIds) => {
  const result = [...elements];
  for (let index = 1; index < result.length; index += 1) {
    if (
      selectedIds.has(result[index].id) &&
      !selectedIds.has(result[index - 1].id)
    ) {
      [result[index], result[index - 1]] = [
        result[index - 1],
        result[index],
      ];
    }
  }
  return result;
};

export const createZOrderUpdates = (slide, elementIds, mode) => {
  const ordered = getElementsInZOrder(slide);
  const availableIds = new Set(ordered.map((element) => element.id));
  const selectedIds = new Set(
    (elementIds ?? []).filter((id) => availableIds.has(id)),
  );

  if (selectedIds.size === 0) return [];

  const selected = ordered.filter((element) => selectedIds.has(element.id));
  const unselected = ordered.filter((element) => !selectedIds.has(element.id));

  let reordered;
  switch (mode) {
    case "front":
      reordered = [...unselected, ...selected];
      break;
    case "back":
      reordered = [...selected, ...unselected];
      break;
    case "forward":
      reordered = moveSelectedForward(ordered, selectedIds);
      break;
    case "backward":
      reordered = moveSelectedBackward(ordered, selectedIds);
      break;
    default:
      return [];
  }

  return reordered.flatMap((element, index) => {
    const zIndex = index + 1;
    if (element["z-index"] === zIndex) return [];
    return [{ elementId: element.id, updates: { "z-index": zIndex } }];
  });
};
