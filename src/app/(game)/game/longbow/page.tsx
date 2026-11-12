import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "Longbow · StatOz Games",
};

export default function LongbowPage() {
  return <ComingSoon gameId="longbow" />;
}
