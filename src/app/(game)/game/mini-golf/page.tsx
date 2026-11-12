import type { Metadata } from "next";

import { MiniGolfGame } from "@/src/games/mini-golf/components/mini-golf-game";

export const metadata: Metadata = {
  title: "Mini Golf · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function MiniGolfPage() {
  return <MiniGolfGame />;
}
