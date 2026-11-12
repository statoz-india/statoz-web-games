import type { KeyboardEvent } from "react";

export const COVER_SELECTOR = "[data-game-cover]";

// Arrow keys step one card; Home and End jump to the ends.
const KEY_TARGETS: Record<string, (current: number, last: number) => number> = {
  ArrowLeft: (current) => current - 1,
  ArrowRight: (current) => current + 1,
  Home: () => 0,
  End: (_, last) => last,
};

/** onKeyDown for a rail: moves focus between its covers and scrolls to it. */
export function moveCoverFocus(event: KeyboardEvent<HTMLElement>) {
  const target = KEY_TARGETS[event.key];
  if (!target) return;
  const cards = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(COVER_SELECTOR),
  );
  const current = cards.findIndex((card) => card === event.target);
  if (current < 0) return;
  const next = cards[target(current, cards.length - 1)];
  if (!next) return;
  event.preventDefault();
  next.focus({ preventScroll: true });
  next.scrollIntoView({ inline: "nearest", block: "nearest" });
}
