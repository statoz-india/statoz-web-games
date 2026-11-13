declare global {
  interface Window {
    // Defined by the inline setup script in analytics.tsx, production only.
    gtag?: (...args: unknown[]) => void;
  }
}

/** Does nothing outside production, where the setup script never runs. */
export function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  window.gtag?.(...args);
}

export type TrackParams = Record<string, string | number | boolean>;

export function track(event: string, params: TrackParams = {}) {
  gtag("event", event, params);
}
