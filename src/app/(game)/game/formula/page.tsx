import type { Metadata } from "next";

import { FormulaGame } from "@/src/games/formula/components/formula-game";

export const metadata: Metadata = {
  title: "Formula · StatOz Games",
};

// Outside the (with-navbar) group: the game fills the screen and draws its own menus.
export default function FormulaPage() {
  return <FormulaGame />;
}
