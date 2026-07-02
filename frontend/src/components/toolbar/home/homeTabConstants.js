export { FONT_SIZES } from "../../../core/model/fontConfig";

export const BULLET_STYLES = [
  { marker: null, label: "None" },
  { marker: "•", label: "Filled circle" },
  { marker: "○", label: "Open circle" },
  { marker: "▪", label: "Small square" },
  { marker: "□", label: "Open square" },
  { marker: "❖", label: "Diamond" },
  { marker: "➢", label: "Arrow" },
  { marker: "✓", label: "Checkmark" },
];

export const NUMBERED_STYLES = [
  { style: null, label: "None" },
  { style: "decimal", label: "1. 2. 3." },
  { style: "lower-alpha", label: "a. b. c." },
  { style: "upper-alpha", label: "A. B. C." },
  { style: "lower-roman", label: "i. ii. iii." },
  { style: "upper-roman", label: "I. II. III." },
];

export const LAYOUTS = [
  { id: "title-slide", label: "Title Slide" },
  { id: "title-content", label: "Title and Content" },
  { id: "section-header", label: "Section Header" },
  { id: "two-content", label: "Two Content" },
  { id: "comparison", label: "Comparison" },
  { id: "title-only", label: "Title Only" },
  { id: "blank", label: "Blank" },
  { id: "content-caption", label: "Content with Caption" },
  { id: "picture-caption", label: "Picture with Caption" },
];
