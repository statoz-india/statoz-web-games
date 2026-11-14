import type { Metadata } from "next";

import { YorkerGame } from "@/src/games/yorker/components/yorker-game";

export const metadata: Metadata = {
  title: "Yorker · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function YorkerPage() {
  return <YorkerGame />;
}
