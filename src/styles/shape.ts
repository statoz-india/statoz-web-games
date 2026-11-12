import { toCssVariables } from "./css-variables";

/**
 * The shape measurements the surfaces share. Corner cuts are px numbers so
 * clip paths can be built from them; everything else is a CSS length.
 */
export const SHAPE = {
  /** Corner cut on fields and the navbar's tabs. */
  fieldCut: 8,
  /** Corner cut on the homescreen spotlight's buttons and cover cards. */
  spotlightCut: 10,
  /** Corner cut on the library's card tiles. */
  panelCut: 12,
  radius: {
    hairline: "1px",
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    /** Pill ends on any size. */
    full: "9999px",
    /** Circles and ellipses: follows the box's own proportions. */
    round: "50%",
    /** Matches the corners drawn in app-logo.png. */
    appIcon: "20.5%",
  },
  stroke: {
    hairline: "1px",
    regular: "2px",
  },
  focusOffset: {
    default: "2px",
    wide: "3px",
  },
} as const;

/** A rectangle with the same cut taken off all four corners. */
export function chamferPath(cut: number): string {
  const c = `${cut}px`;
  return `polygon(${c} 0, calc(100% - ${c}) 0, 100% ${c}, 100% calc(100% - ${c}), calc(100% - ${c}) 100%, ${c} 100%, 0 calc(100% - ${c}), 0 ${c})`;
}

/** The house shape, worn by fields and the navbar's tabs. */
export const FIELD_CLIP_PATH = chamferPath(SHAPE.fieldCut);

// Written onto <html> as --shape-*. Cuts only feed the clip paths, so the
// finished paths are written instead of the raw numbers.
export const SHAPE_VARIABLES = toCssVariables("shape", {
  radius: SHAPE.radius,
  stroke: SHAPE.stroke,
  focusOffset: SHAPE.focusOffset,
  clip: {
    field: FIELD_CLIP_PATH,
    spotlight: chamferPath(SHAPE.spotlightCut),
    panel: chamferPath(SHAPE.panelCut),
  },
});
