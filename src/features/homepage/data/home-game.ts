export type HomeGame = {
  id: string;
  /** Uppercase; shown in the hero h1 and on the card. */
  title: string;
  /** Uppercase tagline. */
  subtitle: string;
  sport: string;
  /** 3:2 WebP. */
  cover: string;
  /** 16:9 WebP; the hero falls back to the cover. */
  spotlight?: string;
  /** object-position for the hero background. */
  position: string;
  /** 1280×720 muted MP4. */
  video?: string;
  /** Shows the clock mark on the card. */
  recent?: boolean;
  /** Launch URL; without one the game's cards and PLAY have no action yet. */
  href?: string;
};
