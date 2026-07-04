import { applyThemeToPresentation } from "../themes/themeManager.js";
import { updateThemeColor as designThemesUpdateColor } from "../model/designThemes.js";

export const applyTheme = (presentation, themeId) => {
  return applyThemeToPresentation(presentation, themeId);
};

export const updateMasterThemeColor = (presentation, colorVariable, hexColor) => {
  const newColorTheme = designThemesUpdateColor(
    presentation.slideset.master["color-theme"],
    colorVariable,
    hexColor
  );

  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      master: {
        ...presentation.slideset.master,
        "color-theme": newColorTheme,
      },
    },
  };
};
