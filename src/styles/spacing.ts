import { toCssVariables } from "./css-variables";

// Written onto <html> as --space-*. Values on the unit grid use Tailwind's
// numeric classes (p-4 = 4 units); everything off the grid is named here.
export const SPACING = {
  /** Tailwind's numeric spacing classes (p-4, gap-2…) are multiples of this. */
  unit: "0.25rem",
  /** Smallest comfortable tap target (44px). */
  touch: "2.75rem",
  layout: {
    // Sticky elements offset by these, so change them here only.
    header: "4rem",
    headerCompact: "3rem",
    gutter: "clamp(1rem, 4vw, 4rem)",
  },
  nav: {
    underlineOffset: "5px",
  },
  loader: {
    horizonBottom: "38%",
    horizonHeight: "40%",
    // Wider than the screen so its edges never show once tilted back.
    floorWidth: "200%",
    floorHeight: "62%",
    gridCell: "48px",
    shadowWidth: "70%",
    ballSize: "10px",
    ballOffset: "-6px",
    ringInsetB: "10%",
    ringInsetC: "20%",
    coreInset: "37%",
    barWidth: "35%",
    /** Where the bar rests when reduced motion stops the scan. */
    barParked: "32%",
  },
  spotlight: {
    maxWidth: "100rem",
    coverWidth: "clamp(9rem, 14vw, 13rem)",
    coverWidthLandscape: "clamp(8rem, 17vw, 11rem)",
  },
  notFound: {
    tile: "clamp(4.5rem, 19vw, 7.5rem)",
    /** Thickness of each stacked layer behind the logo tile. */
    edgeDepth: "2px",
    shadowWidth: "70%",
  },
} as const;

export const SPACING_VARIABLES = toCssVariables("space", SPACING);
