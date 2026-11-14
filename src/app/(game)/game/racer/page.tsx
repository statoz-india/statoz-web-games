import type { Metadata } from "next";

import { RacerGame } from "@/src/games/racer/components/racer-game";

export const metadata: Metadata = {
  title: "Racer · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function RacerPage() {
  return <RacerGame />;
}
