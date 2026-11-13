"use client";

import { useSyncExternalStore } from "react";

import { CONSENT_CHANGE_EVENT, CONSENT_STORAGE_KEY, PRIVACY_POLICY_URL } from "./constants";
import { gtag, track } from "./track";

type Choice = "granted" | "denied";

function readChoice(): Choice | null {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  };
}

// "pending" on the server, so the banner never flashes for visitors who already chose.
const getServerSnapshot = () => "pending" as const;

function choose(choice: Choice) {
  try { localStorage.setItem(CONSENT_STORAGE_KEY, choice); } catch { /* private mode: ask again next visit */ }
  // Ads stay denied: the Ads tag is not in use.
  gtag("consent", "update", { analytics_storage: choice });
  // Only reaches GA once granted, so declines are not counted.
  track("web_game_consent_update", { analytics: choice });
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

const BUTTON_CLASS =
  "inline-flex h-touch flex-1 items-center justify-center rounded-lg px-5 font-display text-xs font-bold tracking-button transition focus-visible:outline-(length:--shape-stroke-regular) focus-visible:outline-offset-(--shape-focus-offset-default) focus-visible:outline-fg active:translate-y-px motion-reduce:transition-none sm:flex-none";

export function ConsentBanner() {
  const choice = useSyncExternalStore(subscribe, readChoice, getServerSnapshot);
  if (choice !== null) return null;

  return (
    <section
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-consent mx-auto flex max-w-2xl flex-col gap-4 rounded-lg border border-line-strong bg-surface p-4 text-fg shadow-halo backdrop-blur-glass sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-sm leading-relaxed text-muted">
        We use cookies to see how StatOz Games is played and to improve it.{" "}
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-cyan underline underline-offset-2"
        >
          Privacy policy
        </a>
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => choose("denied")}
          className={`${BUTTON_CLASS} border border-line-strong text-fg hover:border-cyan hover:text-cyan`}
        >
          DECLINE
        </button>
        <button
          type="button"
          onClick={() => choose("granted")}
          className={`${BUTTON_CLASS} bg-cyan text-page shadow-button hover:shadow-button-hover`}
        >
          ACCEPT
        </button>
      </div>
    </section>
  );
}
