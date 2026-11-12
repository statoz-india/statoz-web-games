import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "Rim Rush · StatOz Games",
};

export default function RimRushPage() {
  return <ComingSoon gameId="rim-rush" />;
}
