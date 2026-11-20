"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { GameFrame } from "@/src/games/shared/components/game-frame";
import { starterStores } from "./starter-squad";

/** The bundle draws its own club house, lineup, duels and results, so the host only frames it. */
export function FootDuelGame({ account = null }: { account?: string | null }) {
  const router = useRouter();
  // Stable, so the frame's effect does not tear down and reload the bundle.
  const exit = useCallback(() => router.push("/"), [router]);

  // The bundle signs its messages "pitch-duel"; the catalogue calls it "foot-duel".
  // A new player's squad comes from the roster API, so the debut pack reveal never shows.
  return (
    <GameFrame gameId="pitch-duel" analyticsId="foot-duel" title="Foot Duel" src="/games/foot-duel/index.html"
      account={account} onExit={exit} prepare={starterStores} />
  );
}
