import { BROWSE_SPORTS } from "@/src/config/sports";

import { track, type TrackParams } from "./track";

/** The browse sport a game is shelved under: GA's `sport` id, not the card's display label. */
export function sportOf(gameId: string) {
  return BROWSE_SPORTS.find(({ gameIds }) => gameIds.includes(gameId))?.id ?? "other";
}

/** `select_content` for a game card or Play button; `location` says which one. */
export function trackGameSelect(
  game: { id: string; comingSoon?: boolean },
  location: string,
  extra: TrackParams = {},
) {
  track("select_content", {
    content_type: "game",
    game_id: game.id,
    sport: sportOf(game.id),
    coming_soon: Boolean(game.comingSoon),
    location,
    ...extra,
  });
}
