import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { IMAGES } from "@/src/config/image";

import styles from "./css/not-found.module.css";

const EDGE_LAYERS = [1, 2, 3, 4, 5, 6];
const DIGIT_CLASS = `font-display text-giant leading-none font-black text-fg ${styles.digit}`;

/** Rendered by the root layout alone, so it brings its own backdrop and a way back. */
export function AppNotFound() {
  return (
    <main className="relative isolate flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-(image:--gradient-app) px-4 py-6 text-center text-fg">
      <div className={styles.spotlight} aria-hidden="true" />

      <div
        className={`relative mb-4 flex items-center gap-3 perspective-[900px] ${styles.scene}`}
        aria-hidden="true"
      >
        <span className={`${DIGIT_CLASS} ${styles.digitLeft}`}>4</span>
        <div className={`relative size-(--space-not-found-tile) ${styles.tile}`}>
          {EDGE_LAYERS.map((layer) => (
            <span
              key={layer}
              className={styles.edge}
              style={{ "--layer": layer } as CSSProperties}
            />
          ))}
          <div className={styles.face}>
            <Image
              src={IMAGES.appLogo}
              alt=""
              width={120}
              height={120}
              preload
              className="size-full"
            />
          </div>
        </div>
        <span className={`${DIGIT_CLASS} ${styles.digitRight}`}>4</span>
      </div>

      <h1 className="font-display text-xl font-black tracking-title uppercase">
        Page not found
      </h1>
      <p className="max-w-88 text-sm leading-relaxed text-muted">
        This page is off the pitch. It may have moved, or the link is wrong.
      </p>

      {/* next/link adds the basePath; hard-coding it would break on GitHub Pages. */}
      <Link
        href="/"
        className="inline-flex h-touch items-center justify-center rounded-lg bg-cyan px-6 font-display text-xs font-bold tracking-button text-page no-underline shadow-button transition hover:shadow-button-hover focus-visible:outline-(length:--shape-stroke-regular) focus-visible:outline-offset-(--shape-focus-offset-wide) focus-visible:outline-fg active:translate-y-px motion-reduce:transition-none"
      >
        BACK TO LOBBY
      </Link>
    </main>
  );
}
