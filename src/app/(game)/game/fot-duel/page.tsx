import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "FOT Duel · StatOz Games",
};

export default function FotDuelPage() {
  return <ComingSoon gameId="fot-duel" />;
}
