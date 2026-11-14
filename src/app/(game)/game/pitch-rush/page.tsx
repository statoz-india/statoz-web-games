import type { Metadata } from "next";

import { PitchRushGame } from "@/src/games/pitch-rush/components/pitch-rush-game";

export const metadata: Metadata = {
  title: "Pitch Rush · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function PitchRushPage() {
  return <PitchRushGame />;
}
