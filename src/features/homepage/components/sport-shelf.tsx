import type { CSSProperties } from "react";

import { GameCoverCard } from "@/src/lib/components/game-cover-card";
import { moveCoverFocus } from "@/src/utils/cover-focus";

import type { BrowseSport } from "../data/browse-sport";
import type { HomeGame } from "../data/home-game";
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
            <GameCoverCard
              id={game.id}
              title={game.title}
              cover={game.cover}
              sportLabel={sport.label}
              href={game.href}
              comingSoon={game.comingSoon}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
