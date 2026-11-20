import type { Metadata } from "next";

import { FootDuelGame } from "@/src/games/foot-duel/components/foot-duel-game";

export const metadata: Metadata = {
  title: "FOT Duel · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function FootDuelPage() {
  return <FootDuelGame />;
}
