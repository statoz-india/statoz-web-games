import { useEffect, useEffectEvent } from "react";

const IDLE_MS = 30_000;
const ACTIVITY_EVENTS = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

/** Calls onIdle after 30s with no input, while enabled and the tab is visible. */
export function useIdleRotation(enabled: boolean, onIdle: () => void) {
  const fire = useEffectEvent(onIdle);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, IDLE_MS);
    };
    const tick = () => {
      if (document.visibilityState === "visible") fire();
      restart();
    };
    // Capture, so scrolling inside the rail (which doesn't bubble) counts too.
    const options = { capture: true, passive: true };
    for (const type of ACTIVITY_EVENTS) addEventListener(type, restart, options);
    document.addEventListener("visibilitychange", restart);
    restart();

    return () => {
      window.clearTimeout(timer);
      for (const type of ACTIVITY_EVENTS) {
        removeEventListener(type, restart, options);
      }
      document.removeEventListener("visibilitychange", restart);
    };
  }, [enabled]);
}
