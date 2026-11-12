"use client";

import { useSyncExternalStore } from "react";

/** Holes in the upstream course list (data/config/game.cfg num_levels). */
export const miniGolfHoles = 20;

export type MiniGolfProgress = {
  /** Best stroke count per hole, or null when the hole has not been cleared. */
  bests: readonly (number | null)[];
  cleared: number;
  total: number;
  aces: number;
  /** First hole without a best (the engine unlocks holes in order); null when all are cleared. */
  next: number | null;
};

/** Account-scoped key the game frame (D3) writes the bundle save to. */
export function miniGolfSaveKey(account: string | null): string {
  return "games.bundle.mini-golf." + encodeURIComponent(account || "guest");
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Reads the engine's storage.json, carried in the bundle save under "mini-golf.storage". */
export function parseMiniGolfProgress(raw: string | null): MiniGolfProgress {
  let storage: Record<string, unknown> = {};
  try {
    const save = record(JSON.parse(raw ?? "null"));
    const stored = save?.schemaVersion === 1 ? record(save.stores)?.["mini-golf.storage"] : null;
    if (typeof stored === "string") storage = record(JSON.parse(stored)) ?? {};
  } catch {
    // Unreadable saves stay untouched; the game reports them when it opens.
  }
  const bests = Array.from({ length: miniGolfHoles }, (_, hole) => {
    const value = storage[`stroke_count_level_${hole}`];
    return typeof value === "number" && Number.isFinite(value) && value >= 1 ? Math.round(value) : null;
  });
  const scored = bests.filter((best): best is number => best !== null);
  const next = bests.findIndex((best) => best === null);
  return {
    bests,
    cleared: scored.length,
    total: scored.reduce((sum, best) => sum + best, 0),
    aces: scored.filter((best) => best === 1).length,
    next: next < 0 ? null : next,
  };
}

const cache = new Map<string, MiniGolfProgress>();
function readProgress(account: string | null): MiniGolfProgress {
  let raw: string | null = null;
  try { raw = localStorage.getItem(miniGolfSaveKey(account)); } catch { /* Storage denied: fresh course. */ }
  const cacheKey = `${account ?? ""}\u0000${raw ?? ""}`;
  let progress = cache.get(cacheKey);
  if (!progress) { progress = parseMiniGolfProgress(raw); cache.clear(); cache.set(cacheKey, progress); }
  return progress;
}
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("mini-golf-save", onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener("mini-golf-save", onChange); };
}

/** Saved course progress for the account, or null before hydration. */
export function useMiniGolfProgress(account: string | null): MiniGolfProgress | null {
  return useSyncExternalStore(subscribe, () => readProgress(account), () => null);
}
