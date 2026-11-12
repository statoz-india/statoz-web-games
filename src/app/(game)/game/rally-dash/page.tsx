import type { Metadata } from "next";

import { ComingSoon } from "@/src/games/shared/components/coming-soon";

export const metadata: Metadata = {
  title: "Rally Dash · StatOz Games",
};

export default function RallyDashPage() {
  return <ComingSoon gameId="rally-dash" />;
}
