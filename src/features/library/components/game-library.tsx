"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { FilterChips } from "@/src/lib/components/filter-chips";
import { GameCoverCard } from "@/src/lib/components/game-cover-card";
import { SearchField } from "@/src/lib/components/search-field";
import { CloseIcon } from "@/src/lib/icons/close.icon";
import { GridViewIcon } from "@/src/lib/icons/gridView.icon";
import { moveCoverFocus } from "@/src/utils/cover-focus";

import { LIBRARY_SPORTS, listLibraryGames } from "../data/list-library-games";
import styles from "./css/game-library.module.css";

const ALL = "all";
const CHIP_OPTIONS = [
  { id: ALL, label: "All Games" },
  ...LIBRARY_SPORTS.map(({ id, label }) => ({ id, label })),
];

/** Mirrors a value into the URL without a navigation. */
function writeParam(key: string, value: string) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value);
  else params.delete(key);
  window.history.replaceState(
    null,
    "",
    window.location.pathname +
      (params.size ? `?${params}` : "") +
      window.location.hash,
  );
}

type GameLibraryProps = {
  /** Game ids that get the "recently played" mark. */
  recentIds?: readonly string[];
};

/** Every game, searchable and filterable by sport; ?q= and ?listSport= mirror the state. */
export function GameLibrary({ recentIds = [] }: GameLibraryProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [sport, setSport] = useState<string | null>(
    () =>
      LIBRARY_SPORTS.find((option) => option.id === params.get("listSport"))
        ?.id ?? null,
  );
  const entries = listLibraryGames(sport, search);
  const recent = new Set(recentIds);
  const sportLabel = LIBRARY_SPORTS.find(
    (option) => option.id === sport,
  )?.label;

  const changeSearch = (value: string) => {
    setSearch(value);
    writeParam("q", value);
  };
  const changeSport = (id: string) => {
    const next = id === ALL ? null : id;
    setSport(next);
    writeParam("listSport", next ?? ALL);
  };
  const clearAll = () => {
    changeSearch("");
    changeSport(ALL);
  };

  // Escape leaves the library; the search field handles its own Escape first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector("dialog:modal")
      ) {
        event.preventDefault();
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="relative isolate min-w-0 flex-1">
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 -z-1 overflow-hidden ${styles.backdrop}`}
      >
        <div className={`absolute ${styles["backdrop-grid"]}`} />
      </div>

      <section
        aria-labelledby="library-title"
        className={`mx-auto flex w-full flex-col ${styles.panel}`}
      >
        <header
          className={`mb-4 flex min-h-touch min-w-0 flex-none items-center justify-between ${styles.header}`}
        >
          <h1 id="library-title" className={`flex-none ${styles.title}`}>
            Game Library
          </h1>
          <div className={`flex min-w-0 justify-end ${styles.search}`}>
            <SearchField
              label="Search games"
              placeholder="Search games…"
              value={search}
              onChange={changeSearch}
              onClear={() => changeSearch("")}
            />
          </div>
        </header>

        <div className="flex min-w-0 flex-none items-center justify-between gap-3">
          <div className="min-w-0">
            <FilterChips
              label="Filter games by sport"
              options={CHIP_OPTIONS}
              selected={sport ?? ALL}
              onSelect={changeSport}
            />
          </div>
        </div>

        <div
          className={`flex flex-none items-center gap-3 ${styles["result-bar"]}`}
        >
          <span aria-live="polite" aria-atomic="true">
            {entries.length} {entries.length === 1 ? "game" : "games"}
            {sportLabel ? ` in ${sportLabel}` : " in your library"}
          </span>
        </div>

        <div className={styles.results}>
          {entries.length ? (
            <ul
              onKeyDown={moveCoverFocus}
              className={`grid list-none ${styles.grid}`}
            >
              {entries.map(({ game, sport: gameSport }) => (
                <li key={game.id} className="relative isolate min-w-0">
                  <GameCoverCard
                    id={game.id}
                    title={game.title}
                    cover={game.cover}
                    sportLabel={gameSport.label}
                    href={game.href}
                    recent={recent.has(game.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div
              className={`grid justify-items-center content-center text-center ${styles.empty}`}
            >
              <GridViewIcon size={36} />
              <h2>No games found</h2>
              <p>Try another title or browse a different sport.</p>
              <button type="button" onClick={clearAll}>
                Clear search and filters
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
