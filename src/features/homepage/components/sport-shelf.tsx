import Image from "next/image";
import type { CSSProperties } from "react";

import { ImagePlayButton } from "@/src/lib/components/buttons/image-play-button";

import type { BrowseSport } from "../data/browse-sport";
import type { HomeGame } from "../data/home-game";
import { moveCoverFocus } from "./cover-rail-keys";
import styles from "./css/games-browse.module.css";

type SportShelfProps = {
  sport: BrowseSport;
  games: readonly HomeGame[];
  onViewAll?: () => void;
};

export function SportShelf({ sport, games, onViewAll }: SportShelfProps) {
  const count = games.length;

  return (
    <section
      aria-label={`${sport.label} games`}
      className="min-w-0"
      style={{ "--shelf-accent": sport.accent } as CSSProperties}
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`h-[18px] w-[3px] ${styles["sport-bar"]}`} />
          <h2
            className={`flex items-center gap-4 ${styles["heading-title"]}`}
          >
            {sport.label}
          </h2>
          <span className={styles.count}>
            {count} {count === 1 ? "game" : "games"}
          </span>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className={`inline-flex min-h-touch flex-none items-center justify-center gap-2 px-1 ${styles["text-action"]}`}
        >
          View all <span aria-hidden="true">↗</span>
        </button>
      </div>

      <ul
        onKeyDown={moveCoverFocus}
        className={`flex list-none overflow-x-auto ${styles["cover-rail"]}`}
      >
        {games.map((game) => (
          <li key={game.id} className="min-w-0">
            {/* A button with no action until game routes exist. */}
            <button
              type="button"
              data-game-cover={game.id}
              aria-label={`Play ${game.title}`}
              className={`block w-full min-w-0 text-left ${styles["cover-card"]}`}
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
                  <ImagePlayButton
                    className={`absolute ${styles["cover-play"]}`}
                  />
                </span>
              </span>
              <span
                className={`flex items-baseline gap-1.5 ${styles["cover-caption"]}`}
              >
                <span
                  className={`min-w-0 flex-1 truncate ${styles["cover-title"]}`}
                >
                  {game.title}
                </span>
              </span>
              <span className={`block ${styles["cover-sport"]}`}>
                {sport.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
