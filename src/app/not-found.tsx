import type { Metadata } from "next";

import { AppNotFound } from "@/src/lib/ui/not-found";

export const metadata: Metadata = {
  title: "Page not found · StatOz",
};

export default function NotFound() {
  return <AppNotFound />;
}
