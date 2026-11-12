"use client";

import { useState } from "react";

import { FilterChips } from "@/src/lib/components/filter-chips";

import type { BrowseSport } from "../data/browse-sport";
import type { HomeGame } from "../data/home-game";
import styles from "./css/games-browse.module.css";
import { SportShelf } from "./sport-shelf";

const ALL = "all";

type GamesBrowseProps = {
  sports: readonly BrowseSport[];
  /** Looked up by each sport's gameIds. */
  games: readonly HomeGame[];
  onViewAll?: (sportId: string) => void;
};

export function GamesBrowse({ sports, games, onViewAll }: GamesBrowseProps) {
  const [selected, setSelected] = useState(ALL);

  const byId = new Map(games.map((game) => [game.id, game]));
  const shelves = sports
    .map((sport) => ({
      sport,
      games: sport.gameIds.flatMap((id) => byId.get(id) ?? []),
    }))
    .filter((shelf) => shelf.games.length > 0);
  const visible =
    selected === ALL
      ? shelves
      : shelves.filter((shelf) => shelf.sport.id === selected);
  const total = visible.reduce((sum, shelf) => sum + shelf.games.length, 0);
  const options = [
    { id: ALL, label: "All Games" },
    ...shelves.map(({ sport }) => ({ id: sport.id, label: sport.label })),
  ];

  return (
    <div className={`min-w-0 overflow-clip ${styles["games-browse"]}`}>
      <div className={`mx-auto ${styles.content}`}>
        <section aria-label="Browse by sport" className={styles.browse}>
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <span className={`mb-1.5 block ${styles.kicker}`}>
                FIND YOUR ARENA
              </span>
              <h2
                className={`flex items-center gap-4 ${styles["heading-title"]}`}
              >
                Every sport. Your game.
              </h2>
            </div>
            <span className={`${styles.count} ${styles["catalog-count"]}`}>
              {total} games to explore
            </span>
          </div>
          <FilterChips
            label="Browse games by sport"
            options={options}
            selected={selected}
            onSelect={setSelected}
          />
        </section>

        <div className="grid gap-8 py-8">
          {visible.map(({ sport, games: shelfGames }) => (
            <SportShelf
              key={sport.id}
              sport={sport}
              games={shelfGames}
              onViewAll={onViewAll && (() => onViewAll(sport.id))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
