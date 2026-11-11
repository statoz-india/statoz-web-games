import { toCssVariables } from "./css-variables";

// Written onto <html> as --type-*; tokens.css maps them to Tailwind's
// font-*, text-*, tracking-* and leading-* classes.
export const TYPOGRAPHY = {
  family: {
    // The --font-* variables come from next/font in the root layout.
    sans: "var(--font-space-grotesk), sans-serif",
    display: "var(--font-orbitron), sans-serif",
  },
  size: {
    /** Navbar "GAMES" sub-label. */
    micro: "0.5625rem",
    "2xs": "0.625rem",
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    /** Navbar wordmark between tablet and desktop. */
    brandMd: "1.0625rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    /** Loading-screen wordmark; scales with the viewport. */
    hero: "clamp(1.75rem, 7vw, 2.75rem)",
    /** The 404 digits. */
    giant: "clamp(5.5rem, 24vw, 9.5rem)",
  },
  weight: {
    semibold: "600",
    bold: "700",
    extrabold: "800",
    black: "900",
  },
  tracking: {
    brand: "0.04em",
    title: "0.12em",
    button: "0.15em",
    ultra: "0.3em",
    sub: "0.42em",
  },
  leading: {
    none: "1",
    relaxed: "1.625",
  },
} as const;

export const TYPOGRAPHY_VARIABLES = toCssVariables("type", TYPOGRAPHY);
