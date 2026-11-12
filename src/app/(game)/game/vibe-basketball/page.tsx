import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "Vibe Basketball · StatOz Games",
};

export default function VibeBasketballPage() {
  return <ComingSoon gameId="vibe-basketball" />;
}
