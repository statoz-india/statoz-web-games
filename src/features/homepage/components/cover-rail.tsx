"use client";

import Image from "next/image";
import Link from "next/link";
import { type PointerEvent, type RefObject, useRef } from "react";

import { ClockIcon } from "@/src/lib/icons/clock.icon";
import { GridViewIcon } from "@/src/lib/icons/gridView.icon";
import { ImagePlayButton } from "@/src/lib/components/buttons/image-play-button";
import { ComingSoonTag } from "@/src/lib/components/coming-soon-tag";
import { moveCoverFocus } from "@/src/utils/cover-focus";

import type { HomeGame } from "../data/home-game";
import styles from "./css/home-spotlight.module.css";

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
        onKeyDown={moveCoverFocus}
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

// A rail drag longer than this isn't a click.
const DRAG_TOLERANCE = 8;

// A link when the game has a route; otherwise a button with no action yet.
function CoverCard({ game, active, onActivate }: CoverCardProps) {
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  const shared = {
    "data-game-cover": game.id,
    "data-active": active || undefined,
    "aria-label": game.comingSoon
      ? `${game.title}, coming soon`
      : `Play ${game.title}`,
    onFocus: onActivate,
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") onActivate();
    },
    className: `block w-full min-w-0 ${styles["cover-card"]}`,
  };
  const body = <CoverCardBody game={game} />;

  if (!game.href) {
    return (
      <button type="button" {...shared}>
        {body}
      </button>
    );
  }
  return (
    <Link
      href={game.href}
      {...shared}
      onPointerDown={(event) => {
        pressedAt.current = { x: event.clientX, y: event.clientY };
      }}
      onClick={(event) => {
        const start = pressedAt.current;
        pressedAt.current = null;
        if (
          start &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) >
            DRAG_TOLERANCE
        )
          event.preventDefault();
      }}
    >
      {body}
    </Link>
  );
}

function CoverCardBody({ game }: { game: HomeGame }) {
  return (
    <>
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
          {game.comingSoon ? (
            <ComingSoonTag className={`absolute ${styles["cover-soon"]}`} />
          ) : (
            <ImagePlayButton className={`absolute ${styles["cover-play"]}`} />
          )}
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
    </>
  );
}
