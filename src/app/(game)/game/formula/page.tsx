import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "Formula · StatOz Games",
};

export default function FormulaPage() {
  return <ComingSoon gameId="formula" />;
}
