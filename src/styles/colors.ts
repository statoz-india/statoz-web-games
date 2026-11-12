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

  spotlight: {
    page: "#0d111a",
    surface: "#0f172b",
    artwork: "#070c1f",
    cover: "#1d293d",
    borderSubtle: "#20293e",
    borderMuted: "#243654",
    borderDefault: "#314158",
    borderStrong: "#45556c",
    text: "#ffffff",
    textSubtle: "#cad5e2",
    textMuted: "#90a1b9",
    cyan: "#5cdfff",
    violet: "#c27aff",
    gold: "#fdc700",
    lime: "#51ff94",
    racing: "#f42d29",
  },
  // Open Golf lobby and game frame: the game's own arcade palette. The in-game
  // shell keeps a copy, since it runs in a sandboxed iframe.
  openGolf: {
    night: "#04190f",
    deep: "#0b3b22",
    green: "#2f9e44",
    greenDeep: "#1d6b2c",
    grass: "#8fd14f",
    cream: "#fff6dc",
    creamDeep: "#d8c99e",
    creamDark: "#f1e6c4",
    ink: "#10301c",
    gold: "#ffc83d",
    goldDeep: "#c98a00",
    locked: "#1a3a26",
    lockedText: "#5f7d68",
    lockedDeep: "#0f2617",
  },
} as const;

// --palette-* rather than --color-*: that prefix belongs to Tailwind's theme.
export const COLOR_VARIABLES = toCssVariables("palette", COLORS);
