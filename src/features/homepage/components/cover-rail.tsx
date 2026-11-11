"use client";

import Image from "next/image";
import type { KeyboardEvent, RefObject } from "react";

import { ClockIcon } from "@/src/lib/icons/clock.icon";
import { GridViewIcon } from "@/src/lib/icons/gridView.icon";
import { ImagePlayButton } from "@/src/lib/components/buttons/image-play-button";

import type { HomeGame } from "../data/home-game";
import styles from "./css/home-spotlight.module.css";

export const COVER_SELECTOR = "[data-game-cover]";

// Arrow keys step one card; Home and End jump to the ends.
const KEY_TARGETS: Record<string, (current: number, last: number) => number> = {
  ArrowLeft: (current) => current - 1,
  ArrowRight: (current) => current + 1,
  Home: () => 0,
  End: (_, last) => last,
};

type CoverRailProps = {
  games: readonly HomeGame[];
  activeIndex: number;
  onActivate: (index: number) => void;
  railRef: RefObject<HTMLUListElement | null>;
};

export function CoverRail({
  games,
  activeIndex,
  onActivate,
  railRef,
}: CoverRailProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
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
  };

  return (
    <section
      aria-label="Your game lineup"
      className={`mx-auto ${styles["primary-strip"]}`}
    >
      <div
        className={`items-center justify-between gap-4 ${styles["section-heading"]}`}
      >
        <h2 className={styles["section-title"]}>Your games</h2>
        {/* No library action yet. */}
        <button
          type="button"
          className={`inline-flex min-h-touch flex-none items-center justify-center gap-2 ${styles["text-action"]}`}
        >
          <GridViewIcon />
          Game Library <span aria-hidden="true">↗</span>
        </button>
      </div>

      <ul
        ref={railRef}
        onKeyDown={onKeyDown}
        className={`flex list-none ${styles["cover-rail"]}`}
      >
        {games.map((game, index) => (
          <li key={game.id} className="min-w-0">
            <CoverCard
              game={game}
              active={index === activeIndex}
              onActivate={() => onActivate(index)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

type CoverCardProps = {
  game: HomeGame;
  active: boolean;
  onActivate: () => void;
};

// A button with no action until game routes exist.
function CoverCard({ game, active, onActivate }: CoverCardProps) {
  return (
    <button
      type="button"
      data-game-cover={game.id}
      data-active={active || undefined}
      aria-label={`Play ${game.title}`}
      onFocus={onActivate}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onActivate();
      }}
      className={`block w-full min-w-0 ${styles["cover-card"]}`}
    >
      <span className={`relative block ${styles["cover-frame"]}`}>
        <span
          className={`relative block overflow-hidden ${styles["cover-image"]}`}
        >
          <Image
            src={game.cover}
            alt=""
            fill
            sizes="13rem"
            className="object-cover"
          />
          <ImagePlayButton className={`absolute ${styles["cover-play"]}`} />
        </span>
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 ${styles["cover-corners"]}`}
        />
      </span>
      <span className={`flex items-baseline ${styles["cover-caption"]}`}>
        <span className={`min-w-0 flex-1 truncate ${styles["cover-title"]}`}>
          {game.title}
        </span>
        {game.recent && (
          <span
            role="img"
            aria-label="Recently played"
            className={`inline-flex flex-none items-center ${styles["recent-mark"]}`}
          >
            <ClockIcon />
          </span>
        )}
      </span>
      <span className={styles["cover-sport"]}>{game.sport}</span>
    </button>
  );
}
