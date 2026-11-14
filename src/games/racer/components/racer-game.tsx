"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { GameFrame } from "@/src/games/shared/components/game-frame";

/** The bundle draws its own career, garage, race HUD and results, so the host only frames it. */
export function RacerGame({ account = null }: { account?: string | null }) {
  const router = useRouter();
  // Stable, so the frame's effect does not tear down and reload the bundle.
  const exit = useCallback(() => router.push("/"), [router]);

  // The bundle signs its messages "f1-racing"; the catalogue calls it "racer".
  return (
    <GameFrame gameId="f1-racing" analyticsId="racer" title="Racer" src="/games/racer/index.html"
      account={account} onExit={exit} />
  );
}
