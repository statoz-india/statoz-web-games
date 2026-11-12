import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "Pitch Rush · StatOz Games",
};

export default function PitchRushPage() {
  return <ComingSoon gameId="pitch-rush" />;
}
