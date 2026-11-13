import type { Metadata } from "next";

import { HoopLegacyGame } from "@/src/games/hoop-legacy/components/hoop-legacy-game";

export const metadata: Metadata = {
  title: "Hoop Legacy · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function HoopLegacyPage() {
  return <HoopLegacyGame />;
}
