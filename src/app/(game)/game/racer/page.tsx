import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "Racer · StatOz Games",
};

export default function RacerPage() {
  return <ComingSoon gameId="racer" />;
}
