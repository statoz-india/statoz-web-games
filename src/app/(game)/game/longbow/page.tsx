import type { Metadata } from "next";

import { LongbowGame } from "@/src/games/longbow/components/longbow-game";

export const metadata: Metadata = {
  title: "Longbow · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function LongbowPage() {
  return <LongbowGame />;
}
