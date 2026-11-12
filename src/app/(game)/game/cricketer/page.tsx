import type { Metadata } from "next";

import { CricketerGame } from "@/src/games/cricketer/components/cricketer-game";

export const metadata: Metadata = {
  title: "Cricketer · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function CricketerPage() {
  return <CricketerGame />;
}
