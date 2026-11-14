"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { GameFrame } from "@/src/games/shared/components/game-frame";

/** The bundle draws its own lobby, court, HUD and pause menu, so the host only frames it. */
export function VibeBasketballGame({ account = null }: { account?: string | null }) {
  const router = useRouter();
  // Stable, so the frame's effect does not tear down and reload the bundle.
  const exit = useCallback(() => router.push("/"), [router]);

  return (
    <GameFrame gameId="vibe-basketball" title="Vibe Basketball" src="/games/vibe-basketball/index.html"
      account={account} onExit={exit} />
  );
}
