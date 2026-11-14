import { notFound } from "next/navigation";

import { HOME_GAMES } from "@/src/config/sports";
import { sportOf } from "@/src/lib/analytics/game-select";
import { TrackOnMount } from "@/src/lib/analytics/track-on-mount";
import { TrackedLink } from "@/src/lib/analytics/tracked-link";

/** Placeholder for a catalogue game that has no playable build yet. */
export function ComingSoon({ gameId }: { gameId: string }) {
  const game = HOME_GAMES.find(({ id }) => id === gameId);
  if (!game) notFound();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      {/* Demand for unreleased games: which one to port next. */}
      <TrackOnMount event="web_game_coming_soon_view" params={{ game_id: game.id, sport: sportOf(game.id) }} />
      <h1 className="font-display text-lg font-bold tracking-wide text-muted">
        {game.title}
      </h1>
      <p className="text-2xl font-semibold">Coming soon</p>
      <TrackedLink
        href="/"
        event="web_game_coming_soon_back_click"
        params={{ game_id: game.id }}
        className="mt-2 inline-flex min-h-touch items-center rounded-md border border-line-strong px-5 font-semibold transition-colors hover:border-cyan hover:text-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
      >
        Back to games
      </TrackedLink>
    </main>
  );
}
