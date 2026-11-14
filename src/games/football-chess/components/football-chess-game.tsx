"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { GameFrame } from "@/src/games/shared/components/game-frame";

/** The bundle draws its own board, squads, turns and results, so the host only frames it. */
export function FootballChessGame({ account = null }: { account?: string | null }) {
  const router = useRouter();
  // Stable, so the frame's effect does not tear down and reload the bundle.
  const exit = useCallback(() => router.push("/"), [router]);

  return (
    <GameFrame gameId="football-chess" title="5v5 Football Chess" src="/games/football-chess/index.html"
      account={account} onExit={exit} />
  );
}
