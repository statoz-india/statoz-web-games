import { toCssVariables } from "./css-variables";

// The only place colour values live. CSS can't import this file, so the root
// layout writes COLOR_VARIABLES onto <html> and tokens.css reads them from there.
export const COLORS = {
  background: {
    primary: "#070b14",
    elevated: "#1e2a3d",

    glow: "#0f2a3d",
    deep: "#02060d",
  },
  text: {
    default: "#e6edf5",
    muted: "#8a9bb0",
  },
  border: {
    subtle: "#1a2433",
    default: "#2a3648",
  },
  accent: {
    cyan: "#22d3ee",
    violet: "#a78bfa",
    gold: "#fbbf24",
    orange: "#fb923c",
  },
  effect: {
    highlight: "#ffffff",
    shadow: "rgb(0 0 0 / 0.6)",
  },
  // Homescreen spotlight only; its spec uses its own palette.
  spotlight: {
    page: "#0d111a",
    artwork: "#070c1f",
    cover: "#1d293d",
    borderSubtle: "#20293e",
    borderDefault: "#314158",
    text: "#ffffff",
    textSubtle: "#cad5e2",
    textMuted: "#90a1b9",
    cyan: "#5cdfff",
    violet: "#c27aff",
  },
} as const;

// --palette-* rather than --color-*: that prefix belongs to Tailwind's theme.
export const COLOR_VARIABLES = toCssVariables("palette", COLORS);
