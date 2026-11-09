import { toCssVariables } from "./css-variables";

const mix = (color: string, percent: number, other = "transparent") =>
  `color-mix(in srgb, var(--color-${color}) ${percent}%, ${other})`;

// Written onto <html> as --gradient-*. Used as background images, so classes
// read them with bg-(image:--gradient-…).
export const GRADIENTS = {
  background: {
    app: "radial-gradient(120% 80% at 50% 0%, var(--color-glow) 0%, var(--color-page) 65%)",
  },
  nav: {
    active: `linear-gradient(135deg, ${mix("violet", 45)}, var(--color-line) 65%)`,
  },
  avatar: {
    default: "linear-gradient(135deg, var(--color-surface), var(--color-page))",
    active: `linear-gradient(135deg, ${mix("violet", 25)}, var(--color-page))`,
  },
  loader: {
    horizon: `radial-gradient(ellipse 60% 100% at 50% 100%, ${mix("cyan", 22)}, transparent 70%)`,
    grid: [
      `linear-gradient(${mix("cyan", 38)} 1px, transparent 1px)`,
      `linear-gradient(90deg, ${mix("cyan", 38)} 1px, transparent 1px)`,
    ].join(", "),
    // A mask: only its opacity matters, so black is opaque, not a colour.
    fade: "linear-gradient(to top, black 10%, transparent 90%)",
    shadow: `radial-gradient(closest-side, ${mix("cyan", 35)}, transparent)`,
    core: `radial-gradient(circle at 35% 30%, var(--color-highlight) 0%, var(--color-cyan) 38%, ${mix("cyan", 45, "var(--color-deep)")} 80%)`,
  },
  notFound: {
    spotlight: `radial-gradient(ellipse 55% 35% at 50% 40%, ${mix("cyan", 18)}, transparent 70%)`,
    shine: `linear-gradient(115deg, transparent 38%, ${mix("highlight", 45)} 50%, transparent 62%)`,
    shadow: `radial-gradient(closest-side, ${mix("cyan", 40)}, transparent)`,
  },
} as const;

export const GRADIENT_VARIABLES = toCssVariables("gradient", GRADIENTS);
