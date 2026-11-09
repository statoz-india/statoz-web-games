import { toCssVariables } from "./css-variables";

const cyan = (percent: number) =>
  `color-mix(in srgb, var(--color-cyan) ${percent}%, transparent)`;

// Written onto <html> as --elevation-*: how raised things look, and what
// stacks on top of what.
export const ELEVATIONS = {
  layer: {
    behind: "-1",
    // Page-level sticky elements should stay below the navbar.
    nav: "30",
    skipLink: "100",
  },
  blur: {
    soft: "4px",
    glass: "16px",
  },
  shadow: {
    halo: `0 0 32px -8px ${cyan(55)}`,
    button: `0 0 18px -4px ${cyan(70)}`,
    buttonHover: `0 0 26px -2px ${cyan(80)}`,
    ring: "0 0 14px -2px var(--color-cyan), inset 0 0 14px -2px var(--color-cyan)",
    spark:
      "0 0 6px 1px var(--color-highlight), 0 0 16px 4px var(--color-cyan)",
    core: `0 0 24px 2px ${cyan(70)}, 0 0 60px 8px ${cyan(25)}`,
    bar: `0 0 10px -1px ${cyan(60)}`,
    tile: `0 0 36px -4px ${cyan(55)}`,
  },
  textShadow: {
    // Stacked shadows in deepening cyan extrude the letters.
    extruded: [
      "0 1px 0 color-mix(in srgb, var(--color-cyan) 85%, var(--color-highlight))",
      "0 2px 0 color-mix(in srgb, var(--color-cyan) 80%, var(--color-deep))",
      "0 3px 0 color-mix(in srgb, var(--color-cyan) 65%, var(--color-deep))",
      "0 4px 0 color-mix(in srgb, var(--color-cyan) 50%, var(--color-deep))",
      "0 5px 0 color-mix(in srgb, var(--color-cyan) 38%, var(--color-deep))",
      "0 6px 0 color-mix(in srgb, var(--color-cyan) 28%, var(--color-deep))",
      "0 10px 14px var(--color-shadow)",
      `0 0 28px ${cyan(45)}`,
    ].join(", "),
    // In em so the depth scales with the 404 digits.
    deep: [
      "0 0.01em 0 color-mix(in srgb, var(--color-cyan) 85%, var(--color-highlight))",
      "0 0.02em 0 color-mix(in srgb, var(--color-cyan) 75%, var(--color-deep))",
      "0 0.03em 0 color-mix(in srgb, var(--color-cyan) 62%, var(--color-deep))",
      "0 0.04em 0 color-mix(in srgb, var(--color-cyan) 50%, var(--color-deep))",
      "0 0.05em 0 color-mix(in srgb, var(--color-cyan) 40%, var(--color-deep))",
      "0 0.06em 0 color-mix(in srgb, var(--color-cyan) 32%, var(--color-deep))",
      "0 0.07em 0 color-mix(in srgb, var(--color-cyan) 25%, var(--color-deep))",
      "0 0.12em 0.12em var(--color-shadow)",
      `0 0 0.3em ${cyan(40)}`,
    ].join(", "),
  },
} as const;

export const ELEVATION_VARIABLES = toCssVariables("elevation", ELEVATIONS);
