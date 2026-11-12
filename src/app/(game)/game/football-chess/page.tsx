import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "5v5 Football Chess · StatOz Games",
};

export default function FootballChessPage() {
  return <ComingSoon gameId="football-chess" />;
}
