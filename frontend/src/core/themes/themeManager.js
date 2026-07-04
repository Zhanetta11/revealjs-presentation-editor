import { DESIGN_THEMES } from "../model/designThemes.js";

export const applyThemeToPresentation = (presentation, themeId) => {
  const theme = DESIGN_THEMES.find((t) => t.id === themeId);
  if (!theme) {
    throw new Error(`Theme with id "${themeId}" not found`);
  }

  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      master: {
        ...presentation.slideset.master,
        "color-theme": [...theme.colorTheme],
      },
    },
  };
};
