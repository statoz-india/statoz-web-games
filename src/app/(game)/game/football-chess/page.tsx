import type { Metadata } from "next";

import { FootballChessGame } from "@/src/games/football-chess/components/football-chess-game";

export const metadata: Metadata = {
  title: "5v5 Football Chess · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function FootballChessPage() {
  return <FootballChessGame />;
}
