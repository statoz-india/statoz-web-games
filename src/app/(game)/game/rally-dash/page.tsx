import type { Metadata } from "next";

import { RallyDashGame } from "@/src/games/rally-dash/components/rally-dash-game";

export const metadata: Metadata = {
  title: "Rally Dash · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function RallyDashPage() {
  return <RallyDashGame />;
}
