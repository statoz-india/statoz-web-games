"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { trackGameSelect } from "@/src/lib/analytics/game-select";
import { track } from "@/src/lib/analytics/track";
import { FilterChips } from "@/src/lib/components/filter-chips";
import { GameCoverCard } from "@/src/lib/components/game-cover-card";
import { SearchField } from "@/src/lib/components/search-field";
import { CloseIcon } from "@/src/lib/icons/close.icon";
import { GridViewIcon } from "@/src/lib/icons/gridView.icon";
import { moveCoverFocus } from "@/src/utils/cover-focus";

import {
  LIBRARY_SPORTS,
  type LibraryEntry,
  listLibraryGames,
} from "../data/list-library-games";
import styles from "./css/game-library.module.css";

const ALL = "all";
// A search is reported once typing has paused this long.
const SEARCH_SETTLE_MS = 800;
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
  const live = entries.filter(({ game }) => !game.comingSoon);
  const comingSoon = entries.filter(({ game }) => game.comingSoon);
  const recent = new Set(recentIds);
  // A ?q= the page opened with is not a search the visitor made here.
  const lastSearch = useRef(search.trim());

  const grid = (list: readonly LibraryEntry[]) => (
    <ul className={`grid list-none ${styles.grid}`}>
      {list.map(({ game, sport: gameSport }) => (
        <li key={game.id} className="relative isolate min-w-0">
          <GameCoverCard
            id={game.id}
            title={game.title}
            cover={game.cover}
            sportLabel={gameSport.label}
            href={game.href}
            comingSoon={game.comingSoon}
            recent={recent.has(game.id)}
            onClick={() =>
              trackGameSelect(game, "library", { recent: recent.has(game.id) })
            }
          />
        </li>
      ))}
    </ul>
  );
  const sportLabel = LIBRARY_SPORTS.find(
    (option) => option.id === sport,
  )?.label;

  const changeSearch = (value: string) => {
    setSearch(value);
    writeParam("q", value);
  };
  const applySport = (id: string) => {
    const next = id === ALL ? null : id;
    setSport(next);
    writeParam("listSport", next ?? ALL);
    return next;
  };
  const changeSport = (id: string) => {
    const next = applySport(id);
    track("web_game_browse_filter", {
      sport: id,
      location: "library",
      results_count: listLibraryGames(next, search).length,
    });
  };
  // One event for the reset, not a filter change as well.
  const clearAll = () => {
    changeSearch("");
    applySport(ALL);
    track("web_game_library_clear_filters");
  };

  // The search text is never sent: it can hold personal data. Only the count is.
  useEffect(() => {
    const term = search.trim();
    if (!term || term === lastSearch.current) return;
    const timer = window.setTimeout(() => {
      lastSearch.current = term;
      const count = listLibraryGames(sport, term).length;
      track("search", { results_count: count });
      if (count === 0) track("web_game_search_no_results", { sport: sport ?? ALL });
    }, SEARCH_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [search, sport]);

  // Escape leaves the library; the search field handles its own Escape first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector("dialog:modal")
      ) {
        event.preventDefault();
        track("web_game_library_close", { method: "escape" });
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

        {/* One key handler, so arrows run on from live games into Coming Soon. */}
        <div onKeyDown={moveCoverFocus} className={styles.results}>
          {entries.length ? (
            <>
              {live.length > 0 && grid(live)}
              {comingSoon.length > 0 && (
                <section
                  aria-labelledby="library-coming-soon"
                  className={styles["soon-section"]}
                >
                  <header
                    className={`flex items-center gap-3 ${styles["soon-head"]}`}
                  >
                    <h2 id="library-coming-soon">Coming Soon</h2>
                    <span className={styles["soon-count"]}>
                      {comingSoon.length}
                    </span>
                  </header>
                  {grid(comingSoon)}
                </section>
              )}
            </>
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
