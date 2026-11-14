import type { Metadata } from "next";

import { HoldoverGame } from "@/src/games/holdover/components/holdover-game";

export const metadata: Metadata = {
  title: "Holdover · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function HoldoverPage() {
  return <HoldoverGame />;
}
