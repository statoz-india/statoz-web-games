"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { NAV_DESTINATIONS } from "@/src/config/navigation";

const TYPING_TARGETS = "input, textarea, select, [contenteditable='true']";

// Skipped with a modifier (Cmd+1 must still switch browser tabs), on repeat,
// while typing, or with a dialog open.
export function useNavShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (
        (target instanceof Element && target.closest(TYPING_TARGETS)) ||
        document.querySelector("dialog[open]")
      ) {
        return;
      }

      if (!/^[1-9]$/.test(event.key)) return;
      const destination = NAV_DESTINATIONS[Number(event.key) - 1];
      if (!destination) return;

      event.preventDefault();
      router.push(destination.href);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}
