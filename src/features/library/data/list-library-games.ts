import { BROWSE_SPORTS, HOME_GAMES, LIBRARY_ORDER } from "@/src/config/sports";
import type { BrowseSport } from "@/src/features/homepage/data/browse-sport";
import type { HomeGame } from "@/src/features/homepage/data/home-game";

export type LibraryEntry = { game: HomeGame; sport: BrowseSport };

// Each sport's games, in that sport's order.
const ENTRIES: readonly LibraryEntry[] = BROWSE_SPORTS.flatMap((sport) =>
  sport.gameIds.flatMap((id) => {
    const game = HOME_GAMES.find((candidate) => candidate.id === id);
    return game ? [{ game, sport }] : [];
  }),
);
const BY_ID = new Map(ENTRIES.map((entry) => [entry.game.id, entry]));

/** Sports that have at least one game, in display order. */
export const LIBRARY_SPORTS: readonly BrowseSport[] = BROWSE_SPORTS.filter(
  (sport) => ENTRIES.some((entry) => entry.sport.id === sport.id),
);

/**
 * The games to list: one sport in its own order, or every game in the
 * library order. Every word typed must appear in the title, tagline or sport id.
 */
export function listLibraryGames(
  sportId: string | null,
  query: string,
): LibraryEntry[] {
  const pool = sportId
    ? ENTRIES.filter((entry) => entry.sport.id === sportId)
    : LIBRARY_ORDER.flatMap((id) => BY_ID.get(id) ?? []);
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return pool.filter(({ game, sport }) => {
    const text =
      `${game.title} ${game.subtitle} ${sport.id}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
