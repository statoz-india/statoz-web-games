import type { Metadata } from "next";

import { RimRushGame } from "@/src/games/rim-rush/components/rim-rush-game";

export const metadata: Metadata = {
  title: "Rim Rush · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function RimRushPage() {
  return <RimRushGame />;
}
