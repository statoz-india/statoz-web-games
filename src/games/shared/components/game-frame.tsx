"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./css/game-frame.module.css";

type Props = {
  gameId: string; title: string; src: string; account: string | null;
  launch?: Record<string, unknown>; onExit: () => void;
};

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

export function GameFrame({ gameId, title, src, account, launch, onExit }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [attempt, setAttempt] = useState(0);
  const exit = useRef(onExit); exit.current = onExit;

  useEffect(() => {
    let active = true;
    const element = frame.current, sessionId = crypto.randomUUID();
    const key = `games.bundle.${gameId}.${encodeURIComponent(account || "guest")}`;
    let save: { schemaVersion: number; stores: Record<string, string>; resultIds: string[] } = { schemaVersion: 1, stores: {}, resultIds: [] };
    let invalid = false;
    try {
      const old = JSON.parse(localStorage.getItem(key) || "null");
      if (old?.schemaVersion === 1) save = old; else if (old !== null) invalid = true;
    } catch { invalid = true; }

    const receive = (event: MessageEvent) => {
      const m = event.data;
      if (!active || event.source !== element?.contentWindow || event.origin !== "null" || m?.protocolVersion !== 1 || m.gameId !== gameId || m.sessionId !== sessionId) return;
      if (m.type === "ready") setReady(true);
      if (m.type === "exit") exit.current();
      if (m.type === "error") setError("The game could not continue. Try loading it again.");
      if (m.type === "save" && m.payload?.schemaVersion === 1 && JSON.stringify(m.payload).length < 600000) {
        // "<game-id>-save": progress hooks on the host listen for their own game.
        try { localStorage.setItem(key, JSON.stringify(m.payload)); window.dispatchEvent(new Event(`${gameId}-save`)); }
        catch { setNotice("Progress could not be saved on this device."); }
      }
    };
    window.addEventListener("message", receive);

    const abort = new AbortController();
    fetch(src, { signal: abort.signal }).then(r => { if (!r.ok) throw Error("The game files could not be loaded."); return r.text(); }).then(html => {
      if (!active || !element) return;
      if (invalid) { setError("Saved progress needs a compatible game version. It has been preserved."); return; }
      const { entryRoot, artifactRoot } = roots(src);
      element.srcdoc = frameDocument(html, {
        ...save, sessionId, origin: location.origin,
        entryRoot, artifactRoot, assetRoot: entryRoot,
        ...(launch ? { launch } : {}),
      });
    }).catch(e => { if (active && e.name !== "AbortError") setError(e.message); });

    const post = (type: string) => element?.contentWindow?.postMessage({ protocolVersion: 1, gameId, sessionId, type }, "*");
    const visibility = () => { if (document.hidden) post("pause"); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false; abort.abort(); post("dispose");
      window.removeEventListener("message", receive);
      document.removeEventListener("visibilitychange", visibility);
      if (element) element.srcdoc = "";
    };
  }, [gameId, src, account, attempt, launch]);

  return (
    <section className={styles.root}>
      <iframe ref={frame} title={title} className={styles.frame} sandbox="allow-scripts allow-pointer-lock" allow="autoplay; fullscreen; gamepad" allowFullScreen />
      {(!ready || error) && (
        <div className={styles.overlay} role={error ? "alert" : "status"}>
          <h1>{title}</h1>
          <p>{error || "Opening your game…"}</p>
          <div className={styles.actions}>
            {error && <button type="button" onClick={() => { setError(""); setReady(false); setAttempt(n => n + 1); }}>Try again</button>}
            <button type="button" onClick={onExit}>Back</button>
          </div>
        </div>
      )}
      {notice && <div className={styles.notice} role="status">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
    </section>
  );
}
