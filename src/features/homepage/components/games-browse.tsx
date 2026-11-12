"use client";

import { type KeyboardEvent, useState } from "react";

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

type FilterChipsProps = {
  label: string;
  options: readonly { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
};

// Arrow keys wrap around; Home and End jump to the ends.
const CHIP_TARGETS: Record<string, (index: number, count: number) => number> =
  {
    ArrowRight: (index, count) => (index + 1) % count,
    ArrowLeft: (index, count) => (index - 1 + count) % count,
    Home: () => 0,
    End: (_, count) => count - 1,
  };

/** Tabs that select as focus moves, so only the active chip is tabbable. */
function FilterChips({ label, options, selected, onSelect }: FilterChipsProps) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = CHIP_TARGETS[event.key];
    if (!target) return;
    const next = target(index, options.length);
    event.preventDefault();
    onSelect(options[next].id);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex shrink-0 gap-1 overflow-x-auto ${styles.chips}`}
    >
      {options.map((option, index) => {
        const active = option.id === selected;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-active={active || undefined}
            onClick={() => onSelect(option.id)}
            onKeyDown={(event) => move(event, index)}
            className={`relative isolate min-h-touch flex-none whitespace-nowrap ${styles.chip}`}
          >
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
