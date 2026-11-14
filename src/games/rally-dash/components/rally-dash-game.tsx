"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { GameFrame } from "@/src/games/shared/components/game-frame";

/** The bundle draws its own stage select, HUD and results, so the host only frames it. */
export function RallyDashGame({ account = null }: { account?: string | null }) {
  const router = useRouter();
  // Stable, so the frame's effect does not tear down and reload the bundle.
  const exit = useCallback(() => router.push("/"), [router]);

  // The bundle was published as "grand-prix-dash" and signs every message with that id;
  // analytics reports the catalogue id.
  return (
    <GameFrame gameId="grand-prix-dash" analyticsId="rally-dash" title="Rally Dash"
      src="/games/rally-dash/index.html" account={account} onExit={exit} />
  );
}
