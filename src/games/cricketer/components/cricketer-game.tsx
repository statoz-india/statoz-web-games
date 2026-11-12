"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { GameFrame } from "@/src/games/shared/components/game-frame";

/** The bundle draws its own menus, match HUD and results, so the host only frames it. */
export function CricketerGame({ account = null }: { account?: string | null }) {
  const router = useRouter();
  // Stable, so the frame's effect does not tear down and reload the bundle.
  const exit = useCallback(() => router.push("/"), [router]);

  return (
    <GameFrame gameId="cricketer" title="Cricketer" src="/games/cricketer/index.html"
      account={account} onExit={exit} />
  );
}
