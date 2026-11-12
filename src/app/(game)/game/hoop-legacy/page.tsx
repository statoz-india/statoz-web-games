import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "Hoop Legacy · StatOz Games",
};

export default function HoopLegacyPage() {
  return <ComingSoon gameId="hoop-legacy" />;
}
