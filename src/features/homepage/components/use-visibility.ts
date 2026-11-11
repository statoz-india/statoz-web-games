import { type RefObject, useEffect, useState, useSyncExternalStore } from "react";

/** Whether any part of the element is on screen. */
export function useInView(ref: RefObject<Element | null>) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return inView;
}

const subscribeToTab = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

export function useTabVisible() {
  return useSyncExternalStore(
    subscribeToTab,
    () => document.visibilityState === "visible",
    () => true,
  );
}
