import styles from "./css/loading.module.css";

export type AppLoadingProps = {
  /** Shown under the bar and announced to screen readers. */
  label?: string;
};

// Letter-spacing trails the last glyph; pull it back so the text centres.
const TRAILING_TRACKING_FIX = "mr-[calc(var(--tracking-ultra)*-1)]";

/** The one loading screen, so every wait in the app looks the same. */
export function AppLoading({ label = "Loading" }: AppLoadingProps) {
  return (
    <div
      className="relative isolate flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-(image:--gradient-app) p-6 text-center perspective-[600px] perspective-origin-[50%_35%]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.horizon} aria-hidden="true" />
      <div className={styles.floor} aria-hidden="true" />

      <div className="flex flex-col items-center gap-6">
        <div
          className={`relative size-40 perspective-[800px] ${styles.scene}`}
          aria-hidden="true"
        >
          <div className={styles.core} />
          <div className={styles.gyro}>
            <div className={`${styles.ring} ${styles.ringA}`} />
            <div className={`${styles.ring} ${styles.ringB}`} />
            <div className={`${styles.ring} ${styles.ringC}`} />
          </div>
        </div>

        <span
          className={`font-display text-hero leading-none font-black tracking-ultra text-fg ${TRAILING_TRACKING_FIX} ${styles.wordmark}`}
          aria-hidden="true"
        >
          STATOZ
        </span>

        <div
          className="relative h-1 w-48 overflow-hidden rounded-sm bg-cyan/14"
          aria-hidden="true"
        >
          <div className={styles.bar} />
        </div>
        <span
          className={`text-xs font-semibold tracking-ultra text-muted uppercase ${TRAILING_TRACKING_FIX}`}
        >
          {label}…
        </span>
      </div>
    </div>
  );
}
