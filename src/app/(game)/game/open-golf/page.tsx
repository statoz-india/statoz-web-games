import type { Metadata } from "next";

import { OpenGolfGame } from "@/src/games/open-golf/components/open-golf-game";

export const metadata: Metadata = {
  title: "Open Golf · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function OpenGolfPage() {
  return <OpenGolfGame />;
}
