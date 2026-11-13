"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { track } from "./track";

/**
 * GA's own history tracking is off (send_page_view: false), so this is the only page_view.
 * Pathname only: library search text in ?q= must never reach GA.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    track("page_view", {
      page_path: pathname,
      page_location: location.origin + pathname,
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}
