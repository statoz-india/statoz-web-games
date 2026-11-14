import type { Metadata } from "next";

import { VibeBasketballGame } from "@/src/games/vibe-basketball/components/vibe-basketball-game";

export const metadata: Metadata = {
  title: "Vibe Basketball · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function VibeBasketballPage() {
  return <VibeBasketballGame />;
}
