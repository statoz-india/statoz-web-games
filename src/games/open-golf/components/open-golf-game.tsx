"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { GameFrame } from "./game-frame";

/** The bundle draws its own splash, hole select, HUD and results, so the host only frames it. */
export function OpenGolfGame({ account = null }: { account?: string | null }) {
  const router = useRouter();
  // Stable, so the frame's effect does not tear down and reload the bundle.
  const exit = useCallback(() => router.push("/"), [router]);

  return (
    <GameFrame gameId="open-golf" title="Open Golf" src="/games/open-golf/index.html"
      account={account} onExit={exit} />
  );
}
