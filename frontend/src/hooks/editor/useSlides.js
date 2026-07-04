export function useSlides(state) {
  const presentation = state.presentation;
  const slides = presentation?.slideset?.slides ?? [];
  const selectedSlideIndex = state.selectedSlideIndex ?? 0;
  const selectedSlide = slides[selectedSlideIndex] ?? null;
  const selectedElementId = state.selectedElementId ?? null;
  const selectedElementIds = state.selectedElementIds ?? (
    selectedElementId ? [selectedElementId] : []
  );

  return {
    presentation,
    slides,
    selectedSlide,
    selectedSlideIndex,
    selectedElementId,
    selectedElementIds,
  };
}
