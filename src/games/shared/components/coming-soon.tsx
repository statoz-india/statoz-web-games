import Link from "next/link";
import { notFound } from "next/navigation";

import { HOME_GAMES } from "@/src/config/sports";

/** Placeholder for a catalogue game that has no playable build yet. */
export function ComingSoon({ gameId }: { gameId: string }) {
  const game = HOME_GAMES.find(({ id }) => id === gameId);
  if (!game) notFound();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-lg font-bold tracking-wide text-muted">
        {game.title}
      </h1>
      <p className="text-2xl font-semibold">Coming soon</p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-touch items-center rounded-md border border-line-strong px-5 font-semibold transition-colors hover:border-cyan hover:text-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
      >
        Back to games
      </Link>
    </main>
  );
}
