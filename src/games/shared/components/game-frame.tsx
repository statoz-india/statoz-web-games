"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { resultParams } from "@/src/lib/analytics/game-results";
import { track } from "@/src/lib/analytics/track";
import styles from "./css/game-frame.module.css";

type Props = {
  gameId: string; title: string; src: string; account: string | null;
  launch?: Record<string, unknown>; onExit: () => void;
  /** Catalogue id for analytics, when the bundle signs its messages with another id. */
  analyticsId?: string;
};

type ExitMethod = "in_game" | "overlay_back" | "unmount";

/**
 * Insert boot data before any bundle script runs. JSON is made safe for an inline <script>.
 *
 * The <base href> matters: a srcdoc document's own base URL is "about:srcdoc", against which
 * nothing path-absolute resolves. Bundles that pull in a shared engine through an import map
 * ("/games/cricketer/game-runtime/…") need a real base before any of their URLs mean anything.
 */
function frameDocument(html: string, boot: { entryRoot: string } & Record<string, unknown>) {
  const json = JSON.stringify(boot).replaceAll("<", "\\u003c");
  const setup = `<base href="${boot.entryRoot}"><script>window.__STATOZ_BOOT__=${json};</script>`;
  return html.replace("<head>", "<head>" + setup);
}

/** Where the bundle lives, and the root its path-absolute URLs resolve against. */
function roots(src: string) {
  const entry = new URL(src, location.href);
  return { entryRoot: new URL(".", entry).href, artifactRoot: new URL("../../", entry).href };
}

export function GameFrame({ gameId, title, src, account, launch, onExit, analyticsId = gameId }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [attempt, setAttempt] = useState(0);
  // Retrying can't fix an unreadable save, so that error offers "Start fresh" instead.
  const [incompatible, setIncompatible] = useState(false);
  const saveKey = `games.bundle.${gameId}.${encodeURIComponent(account || "guest")}`;
  // A bundle can ask to be reloaded with a new query string (mode, quality, rematch).
  const [reloads, setReloads] = useState(0);
  const query = useRef("");
  // Always the latest onExit, without making the frame's effect reload the game when it changes.
  const exit = useEffectEvent(onExit);
  // Analytics state the overlay buttons need from the current session.
  const endSession = useRef<(method: ExitMethod) => void>(() => {});
  const lastError = useRef("runtime");
  const retrying = useRef(false);
  // A bundle-requested reload continues the same analytics session.
  const restarting = useRef(false);
  const visit = useRef({ openedAt: 0, readyAt: null as number | null, results: 0, ended: false });

  useEffect(() => {
    let active = true;
    const element = frame.current, sessionId = crypto.randomUUID();
    const resumed = restarting.current;
    restarting.current = false;
    let save: { schemaVersion: number; stores: Record<string, string>; resultIds: string[] } = { schemaVersion: 1, stores: {}, resultIds: [] };
    let invalid = false, storageBlocked = false;
    // Blocked storage (e.g. "Block all cookies") throws on access. The game still runs, unsaved;
    // only a save that exists but can't be read is "incompatible".
    let stored: string | null = null;
    try { stored = localStorage.getItem(saveKey); } catch { storageBlocked = true; }
    try {
      const old = JSON.parse(stored || "null");
      if (old?.schemaVersion === 1) save = old; else if (old !== null) invalid = true;
    } catch { invalid = true; }

    const session = visit.current;
    if (!resumed) {
      Object.assign(session, { openedAt: performance.now(), readyAt: null, results: 0, ended: false });
      track("web_game_open", { game_id: analyticsId, attempt });
    }
    const fail = (reason: string) => {
      lastError.current = reason;
      track("web_game_error", { game_id: analyticsId, reason });
    };
    // Exactly once per session, however the player leaves.
    endSession.current = (method) => {
      if (session.ended) return;
      session.ended = true;
      track("web_game_exit", {
        game_id: analyticsId, method, reached_ready: session.readyAt !== null, results_count: session.results,
        play_seconds: session.readyAt === null ? 0 : Math.round((performance.now() - session.readyAt) / 1000),
      });
    };

    const receive = (event: MessageEvent) => {
      const m = event.data;
      if (!active || event.source !== element?.contentWindow || event.origin !== "null" || m?.protocolVersion !== 1 || m.gameId !== gameId || m.sessionId !== sessionId) return;
      if (m.type === "ready") {
        setReady(true);
        if (session.readyAt === null) {
          session.readyAt = performance.now();
          track("web_game_ready", { game_id: analyticsId, load_ms: Math.round(session.readyAt - session.openedAt) });
        }
      }
      if (m.type === "restart" && typeof m.payload?.search === "string" && m.payload.search.length < 1024) {
        query.current = m.payload.search;
        restarting.current = true;
        setReloads(n => n + 1);
      }
      if (m.type === "result") {
        session.results++;
        track("web_game_result", { game_id: analyticsId, ...resultParams(analyticsId, m.payload) });
      }
      if (m.type === "exit") { endSession.current("in_game"); exit(); }
      if (m.type === "error") { fail("runtime"); setError("The game could not continue. Try loading it again."); }
      // With storage blocked, every save would fail again; the notice was already shown once.
      if (m.type === "save" && !storageBlocked && m.payload?.schemaVersion === 1 && JSON.stringify(m.payload).length < 600000) {
        // "<game-id>-save": progress hooks on the host listen for their own game.
        try { localStorage.setItem(saveKey, JSON.stringify(m.payload)); window.dispatchEvent(new Event(`${gameId}-save`)); }
        catch { setNotice("Progress could not be saved on this device."); track("web_game_save_failed", { game_id: analyticsId }); }
      }
    };
    window.addEventListener("message", receive);

    const abort = new AbortController();
    fetch(src, { signal: abort.signal }).then(r => { if (!r.ok) throw Error("The game files could not be loaded."); return r.text(); }).then(html => {
      if (!active || !element) return;
      if (invalid) {
        fail("save_incompatible");
        setIncompatible(true);
        setError("Your saved progress is from a version of this game that can't be loaded. Start fresh to play; your old save stays on this device.");
        return;
      }
      if (storageBlocked) {
        setNotice("Progress could not be saved on this device.");
        track("web_game_save_failed", { game_id: analyticsId });
      }
      const { entryRoot, artifactRoot } = roots(src);
      element.srcdoc = frameDocument(html, {
        ...save, sessionId, origin: location.origin, query: query.current,
        entryRoot, artifactRoot, assetRoot: entryRoot,
        ...(launch ? { launch } : {}),
      });
    }).catch(e => { if (active && e.name !== "AbortError") { fail("bundle"); setError(e.message); } });

    const post = (type: string) => element?.contentWindow?.postMessage({ protocolVersion: 1, gameId, sessionId, type }, "*");
    const visibility = () => { if (document.hidden) { post("pause"); track("web_game_pause", { game_id: analyticsId }); } };
    document.addEventListener("visibilitychange", visibility);
    // Closing or reloading the tab skips React cleanup; gtag sends this one by beacon.
    const leave = () => endSession.current("unmount");
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      // A retry starts a new attempt of the same visit, not an exit.
      if (!retrying.current && !restarting.current) endSession.current("unmount");
      retrying.current = false;
      active = false; abort.abort(); post("dispose");
      window.removeEventListener("message", receive);
      document.removeEventListener("visibilitychange", visibility);
      if (element) element.srcdoc = "";
    };
  }, [gameId, analyticsId, src, account, attempt, launch, reloads, saveKey]);

  const retry = () => {
    retrying.current = true;
    track("web_game_retry", { game_id: analyticsId, reason: lastError.current });
    setError(""); setIncompatible(false); setReady(false); setAttempt(n => n + 1);
  };
  // Moves the unreadable save aside (never deletes it), then loads with an empty one.
  const startFresh = () => {
    try {
      const old = localStorage.getItem(saveKey);
      if (old !== null) localStorage.setItem(`${saveKey}.backup.${Date.now()}`, old);
      localStorage.removeItem(saveKey);
    } catch {
      setError("Your old save couldn't be moved aside, so this game can't start fresh on this device.");
      setIncompatible(false);
      return;
    }
    retry();
  };
  const back = () => { endSession.current("overlay_back"); onExit(); };

  return (
    <section className={styles.root}>
      <iframe ref={frame} title={title} className={styles.frame} sandbox="allow-scripts allow-pointer-lock" allow="autoplay; fullscreen; gamepad" allowFullScreen />
      {(!ready || error) && (
        <div className={styles.overlay} role={error ? "alert" : "status"}>
          <h1>{title}</h1>
          <p>{error || "Opening your game…"}</p>
          <div className={styles.actions}>
            {error && (incompatible
              ? <button type="button" onClick={startFresh}>Start fresh</button>
              : <button type="button" onClick={retry}>Try again</button>)}
            <button type="button" onClick={back}>Back</button>
          </div>
        </div>
      )}
      {notice && <div className={styles.notice} role="status">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
    </section>
  );
}
