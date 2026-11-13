"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { GameFrame } from "@/src/games/shared/components/game-frame";

/** The bundle draws its own lobby, garage, race HUD and results, so the host only frames it. */
export function FormulaGame({ account = null }: { account?: string | null }) {
  const router = useRouter();
  // Stable, so the frame's effect does not tear down and reload the bundle.
  const exit = useCallback(() => router.push("/"), [router]);

  // The bundle was published as "portfolio-formula" and signs every message with that id;
  // analytics reports the catalogue id.
  return (
    <GameFrame gameId="portfolio-formula" analyticsId="formula" title="Formula" src="/games/formula/index.html"
      account={account} onExit={exit} />
  );
}
