import type { Metadata } from "next";

import { PenaltyCupGame } from "@/src/games/penalty-cup/components/penalty-cup-game";

export const metadata: Metadata = {
  title: "Penalty Cup · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function PenaltyCupPage() {
  return <PenaltyCupGame />;
}
