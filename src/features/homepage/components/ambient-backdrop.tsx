"use client";

import { useEffect, useRef } from "react";

import styles from "./css/home-spotlight.module.css";

const PARALLAX_RATE = 0.08;
const PARALLAX_MAX = 180;

/** Fixed glow, grid and sweep behind the whole page, drifting on scroll. */
export function AmbientBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        ref.current?.style.setProperty(
          "--ambient-scroll",
          `${Math.min(window.scrollY * PARALLAX_RATE, PARALLAX_MAX)}px`,
        ),
      );
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-1 overflow-hidden ${styles.ambient}`}
    >
      <div className={`absolute ${styles["ambient-glow"]}`} />
      <div className={`absolute ${styles["ambient-grid"]}`} />
      <span className={`absolute left-0 w-full ${styles["ambient-sweep"]}`} />
    </div>
  );
}
