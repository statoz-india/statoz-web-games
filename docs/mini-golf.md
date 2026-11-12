# Mini Golf — implementation

Mini Golf is a 3D mini-golf game: 20 holes, drag-to-aim putting, a free camera, and a best
stroke count saved per hole. The gameplay is the upstream
[Open Golf](https://github.com/mgerdes/Open-Golf) engine by Michael Gerdes (MIT), compiled to
WebAssembly. Everything a player reads — splash, hole select, HUD, pause, results — is our own
HTML drawn over the engine's canvas.

The whole game ships as **one self-contained `index.html`** served from `public/`, loaded into a
sandboxed iframe by a thin React host.

---

## 1. Architecture

Four layers. Each one only talks to its neighbours.

```
/game/mini-golf                                    Next.js route
└─ <MiniGolfGame>                                  host wrapper
   └─ <GameFrame>                                  sandboxed iframe, srcdoc
        └─ public/games/mini-golf/index.html       the bundle
           ├─ prelude      localStorage shim + postMessage protocol
           ├─ <canvas>  ←  golf-mobile.js + golf-mobile.wasm      (engine)
           ├─ shell        HTML / CSS / JS, polls _statoz_golf_*  (interface)
           └─ configuration  pausable rAF, FS ↔ storage, engine start
```

| Layer             | Lives in                                | Owns                                                |
| ----------------- | --------------------------------------- | --------------------------------------------------- |
| **Engine**        | `bundle/engine/`                        | Courses, physics, rendering, aiming, audio, saves    |
| **Bridge**        | `scripts/statoz-ui-bridge.c`            | Reads engine state, forwards shell commands          |
| **Shell**         | `bundle/shell/`                         | Every screen the player sees                         |
| **Host**          | `components/` + the route               | Framing, save persistence, exit                      |

The engine never draws a menu, and the shell never touches game rules. The bridge is the only
seam between them.

---

## 2. File map

```
src/games/mini-golf/
├── bundle/                             everything inlined into the shipped html
│   ├── engine/
│   │   ├── golf-mobile.js              Emscripten runtime  (~248 KB)
│   │   └── golf-mobile.wasm            compiled engine     (~17.5 MB)
│   ├── fonts/
│   │   └── rubik-latin-wght-normal.woff2
│   ├── shell/
│   │   ├── golf-shell.html             markup for all 9 screens
│   │   ├── golf-shell.js               the frame loop and all UI logic
│   │   └── css/golf-shell.css          the game's own design tokens
│   └── THIRD-PARTY-NOTICES.txt         upstream + dependency licences
├── components/                         the React host
│   ├── mini-golf-game.tsx              frames the game, handles exit
│   ├── game-frame.tsx                  iframe, postMessage protocol, saves
│   ├── progress.ts                     save key + parsing saved progress
│   ├── credits.ts                      GENERATED from THIRD-PARTY-NOTICES.txt
│   └── css/…
└── scripts/
    ├── build-mini-golf.mjs             bundle builder
    ├── rebuild-mini-golf-mobile.py     engine rebuilder (needs Emscripten)
    └── statoz-ui-bridge.c              appended to the engine's ui.c

src/app/(game)/game/mini-golf/page.tsx  the route
public/games/mini-golf/index.html       GENERATED bundle (~23.8 MiB)
```

Two files are generated — `credits.ts` and `public/games/mini-golf/index.html`. Never edit them
by hand; run the build.

---

## 3. Engine

### 3.1 Provenance

| Item            | Value                                      |
| --------------- | ------------------------------------------ |
| Upstream        | `github.com/mgerdes/Open-Golf` (MIT)       |
| Pinned revision | `b9029f1e80c3110ae3d4fc9300854bdaeef96508` |
| Toolchain       | Emscripten **3.1.64**                      |

### 3.2 The three patches

`scripts/rebuild-mini-golf-mobile.py` copies the upstream source to a scratch directory and
patches it before compiling. Nothing upstream is modified in place.

**`common/data.c` — single-threaded asset loading.** Upstream loads assets on a pthread and
posts file events back. That needs `SharedArrayBuffer`, which needs cross-origin isolation,
which we do not have inside a `srcdoc` iframe. The patch drops the thread and finalises each
asset inline on the render thread:

```c
if (loader->finalize_fn) loader->finalize_fn(golf_data.ptr);
/* Recursive dependencies may have grown the map; reacquire its entry. */
map_get(&_loaded_data, file.path)->is_loaded = true;
```

The cost is that loading a course can briefly block rendering. The benefit is that the game
starts in Android WebView and in any non-isolated frame.

**`common/inputs.c` — real touch detection.** The upstream web build latches into mouse mode and
stays there, so nothing responds on a phone. The patch picks the mode from the events that
actually arrive, clearing stale state on each switch, which keeps hybrid devices working:

```c
if (event->type == SAPP_EVENTTYPE_TOUCHES_BEGAN) {
    inputs.is_touch = true;
    memset(inputs.mouse_down, 0, sizeof(inputs.mouse_down));
    memset(inputs.mouse_clicked, 0, sizeof(inputs.mouse_clicked));
```

**`golf/ui.c` — hand the interface to HTML.** Sets `STATOZ_HTML_UI 1` and guards every
engine-drawn menu, HUD string, pause panel and result panel behind it, then appends the bridge.
What stays in the engine: the aim line and power arc, the tutorial pointer, screen fades, the
out-of-bounds flash, courses, physics and saves. The patch helper raises an error if a target
string does not appear exactly the expected number of times, so an upstream bump fails loudly
rather than silently producing a half-patched build.

### 3.3 Build flags

Compile: `-O2 -DNDEBUG -DSOKOL_GLES3 -DGOLF_PLATFORM_EMSCRIPTEN`

Link:

```
-sUSE_WEBGL2=1 -sFULL_ES3=1
-sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=268435456
-sSTACK_SIZE=5242880
-sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,MEMFS -lidbfs.js -lstdc++
```

The **5 MB stack is deliberate** and matches the original toolchain. A smaller one crashes during
nested UI initialisation. Course data is baked into the binary as `data_zip.h`, so the game makes
no network requests while playing.

### 3.4 Bridge API

Every export is prefixed `statoz_golf_`. Getters return `-1` when the engine is not ready, so the
shell can call them on any frame without guarding.

| Function                   | Returns                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `levels()`                 | Hole count (20, from `game.cfg`)                           |
| `best(level)`              | Best strokes for a hole, `-1` if never cleared             |
| `state()`                  | `0` title · `1` menu · `2` loading · `3` in game           |
| `game_state()`             | `1` intro · `2` ready · `3` aiming · `4` rolling · `5` celebrate · `6` finished · `7` paused |
| `level()`                  | Current hole index                                         |
| `strokes()`                | Strokes on this hole                                       |
| `tutorial()`               | Tutorial step `0–2`, else `-1`                             |
| `busy()`                   | `1` while a fade is running                                |
| `power()`                  | Aim power `0–1`, `0` unless aiming                         |
| `since_out_of_bounds()`    | Seconds since the last OOB, `-1` if none                   |

| Command         | Effect                                                               |
| --------------- | --------------------------------------------------------------------- |
| `play(level)`   | Start a hole. Only from the menu or a finished hole, and only if unlocked |
| `pause()`       | Only while waiting for aim or watching the ball                      |
| `resume()`      | Only from paused                                                      |
| `retry()`       | Restart the hole, from pause or results                              |
| `menu()`        | Back to hole select, from pause or results                           |
| `click()`       | Play the shared button sound                                         |

Commands return `1` when accepted and `0` when refused, and they all run through the upstream
transition `_golf_ui_start_fade_out` — so fades and state changes stay exactly as upstream wrote
them. Every command refuses while a fade is in flight.

**Unlock rule** (`_statoz_unlocked`, mirroring upstream): a hole opens once every earlier hole has
a recorded best.

### 3.5 Rebuilding the engine

Only needed when changing engine C code. Requires Emscripten 3.1.64 and the upstream source.

```bash
python src/games/mini-golf/scripts/rebuild-mini-golf-mobile.py \
  --source <extracted-upstream-root> --sdk <emsdk-dir> --output <scratch-build-dir>
```

Then copy `golf.js` / `golf.wasm` over `bundle/engine/golf-mobile.js` / `.wasm` and rebuild the
bundle. `--interface-only` recompiles just `inputs.c` and `ui.c`; `--link-only` relinks existing
objects.

`bundle/engine/**` is in the eslint ignore list — it is generated output, not source.

---

## 4. Bundle

`scripts/build-mini-golf.mjs` inlines everything into one file:

| Piece          | How it is embedded                                                     |
| -------------- | ---------------------------------------------------------------------- |
| Shell CSS      | `<style>`, with `__RUBIK_WOFF2__` replaced by the font as a data URI    |
| Shell markup   | Inline, right after the `<canvas>`                                      |
| Credits        | `<script type="application/json" id="mini-golf-credits">`               |
| WASM           | base64 in `<script type="application/octet-stream" id="og-wasm">`       |
| Engine runtime | `<script type="text/plain" id="og-runtime">` — *not executed on parse*  |
| Prelude        | real `<script>`, runs first                                             |
| Shell JS       | real `<script>`                                                         |
| Configuration  | real `<script>`, runs last                                              |

Every embedded string has `</script` escaped to `<\/script`.

```bash
node src/games/mini-golf/scripts/build-mini-golf.mjs
```

Writes `public/games/mini-golf/index.html` (~23.8 MiB) and regenerates `components/credits.ts`
so the host shows the same notices the bundle carries.

### 4.1 Prelude — storage and messaging

The bundle runs on an opaque origin, where real `localStorage` is unavailable. The prelude
**replaces `window.localStorage`** with an in-memory store that posts every write to the host:

```js
Object.defineProperty(window, "localStorage", { value: storage, configurable: false });
```

Writes over 512 KB throw `QuotaExceededError`, the same as a real quota failure. It also installs
`window.__STATOZ_HOST__` (`emit`, `save`, `sessionId`, `command`) and listens for `pause`,
`resume` and `dispose` from the host, validating origin and session on every message.

### 4.2 Configuration — pausing and start-up

- **Pausable `requestAnimationFrame`.** Frames are *queued* while paused and replayed on resume,
  rather than dropped. Audio is suspended and resumed with them.
- **Filesystem bridge.** `/opengolf_persistent_data` is mounted as MEMFS and `FS.syncfs` is
  swapped for one that round-trips `storage.json` through the `mini-golf.storage` key — so the
  engine keeps writing an ordinary file and it lands in the host's real `localStorage`.
- **Deferred start.** Decoding and compiling ~17.5 MB of WebAssembly blocks the page, so the
  engine script is only injected after the splash has painted (`rAF` → `setTimeout 0`).

---

## 5. Shell

`bundle/shell/golf-shell.js` drives nine screens from one `requestAnimationFrame` loop that
polls the bridge. It holds no game state of its own — it renders whatever the engine reports.

It captures `requestAnimationFrame` **before** the configuration script wraps it, so menus keep
animating while the engine is paused.

### 5.1 Screens

| Screen        | Shown when                               |
| ------------- | ---------------------------------------- |
| `splash`      | Boot, until the engine reaches the menu  |
| `select`      | Engine at the main menu                  |
| `loading`     | A fade or a course load is in progress   |
| `play`        | In a hole — HUD layer, pointer-transparent |
| `pause`       | `game_state` is paused                   |
| `finish`      | `game_state` is finished                 |
| `host-pause`  | The host backgrounded the tab            |
| `error`       | The engine aborted                       |

`show()` swaps `hidden`, lets a leaving screen finish its fade, and moves focus. Focus only lands
on the hole grid after keyboard use (tracked by `lastInput`), so touch players never see a stray
focus ring.

### 5.2 What each screen does

**Hole select.** Rebuilds 20 tiles with state `cleared` / `next` / `locked`, a staggered pop-in
(`--i` per tile), a pulsing glow on the next playable hole, a gold star on any ace, and live
cleared / best-total / aces stats. The continue button reads `TEE OFF`, `PLAY HOLE n`, or
`REPLAY HOLE 1` once the course is complete.

**HUD.** Hole, strokes and best as chips. The stroke chip bumps on change and turns red once you
pass your best. The pause button is disabled (`aria-disabled`) whenever the bridge would refuse.
The power gauge appears only while aiming, with colour zones at 40 / 65 / 90 %.

**Results.** Title is `HOLE IN ONE!`, `COURSE COMPLETE!` or `HOLE COMPLETE`. The badge
distinguishes `FIRST CLEAR!` / `NEW BEST!` / `MATCHED BEST` — computed from `bestBefore`, captured
at the hole's camera intro, because the engine has already overwritten the saved best by the time
results render. Confetti fires for an ace, an improvement or a first clear, and is skipped under
`prefers-reduced-motion`. `NEXT HOLE` spans the full first row with `REPLAY` and `HOLES` beneath;
on the final hole it is hidden and the other two collapse into one row.

### 5.3 Input

Clicks are delegated from `#og-ui` — one listener reads `data-action` (or a `.og-tile`).

Keyboard needs care: Sokol listens on `window` and cancels Space, which would stop buttons
activating. The shell registers capture-phase listeners **before the engine starts**, so they run
first, and calls `stopImmediatePropagation()` for any key aimed at its own controls.

| Key                  | Action                                 |
| -------------------- | --------------------------------------- |
| `Escape` / `P`       | Pause or resume                        |
| Arrows               | Move through the hole grid             |
| `Home` / `End`       | First / last hole                      |
| `Space` / `Enter`    | Activate the focused control           |

### 5.4 Host hooks

```js
window.MiniGolfShell = { ready(module), fail(), hostPause(paused) };
```

`ready()` verifies `_statoz_golf_state` exists before accepting the module, and falls back to the
error screen if the bridge is missing.

---

## 6. Host

### 6.1 Route

`src/app/(game)/game/mini-golf/page.tsx` sits outside the `(with-navbar)` group so the game fills
the screen. It renders `<MiniGolfGame>`, which passes a `useCallback`-stable exit handler — an
unstable one would tear down and reload the 24 MB iframe on every render.

There is no React lobby. The bundle's own `SELECT HOLE` screen is the hole picker, and
`EXIT TO LOBBY` returns to `/`.

### 6.2 GameFrame

Fetches the bundle, injects boot data ahead of every other script, and hands it to the iframe:

```js
html.replace("<head>", `<head><script>window.__STATOZ_BOOT__=${json};</script>`);
```

`<` is escaped to `\u003c` so the JSON cannot close the tag. The frame is
`sandbox="allow-scripts allow-pointer-lock"` with no `allow-same-origin`, which is what makes the
origin opaque — hence the `event.origin !== "null"` check.

Every inbound message is validated on source, origin, `protocolVersion`, `gameId` **and** a
per-mount `sessionId`, so a stale frame cannot write to a new session's save.

| Direction     | Message                            |
| ------------- | ---------------------------------- |
| game → host   | `ready`, `exit`, `error`, `save`   |
| host → game   | `pause`, `resume`, `dispose`       |

The host pauses on `visibilitychange` and disposes on unmount.

### 6.3 Saves

Saves are written under an account-scoped key:

```
games.bundle.mini-golf.<encodeURIComponent(account || "guest")>
```

```jsonc
{
  "schemaVersion": 1,
  "stores": { "mini-golf.storage": "{\"stroke_count_level_0\":3,\"stroke_count_level_1\":2}" },
  "resultIds": []
}
```

`stores["mini-golf.storage"]` is the engine's own `storage.json`, kept as an opaque string. A
payload over 600 KB is rejected. After a successful write the host dispatches an
`mini-golf-save` event so any listening UI updates without a reload.

`progress.ts` parses that back into `{ bests, cleared, total, aces, next }` via
`useSyncExternalStore`, with a `null` server snapshot so nothing renders stale progress before
hydration. A save that cannot be parsed is left untouched — the game reports it when it opens.

### 6.4 Progress, end to end

Progress lives only in the browser's `localStorage`. Nothing is sent to a server.

**What is saved.** The engine's `storage.json`:

```json
{ "seen_tutorial_0": 1, "stroke_count_level_0": 1, "stroke_count_level_1": 3 }
```

| Key                      | Meaning                                                  |
| ------------------------ | -------------------------------------------------------- |
| `stroke_count_level_<n>` | Best strokes on hole `n + 1` (0-based). Absent = never cleared. |
| `seen_tutorial_<n>`      | Tutorial hint `n` has been shown.                        |

A hole is unlocked when every earlier hole has a `stroke_count_level_*` entry (§3.4).

**Saving — a hole is finished:**

```
engine writes /opengolf_persistent_data/storage.json   (MEMFS, §4.2)
  → FS.syncfs copies it to localStorage["mini-golf.storage"]   (the shim, §4.1)
    → the shim posts { type: "save", payload: { schemaVersion: 1, stores, resultIds } }
      → GameFrame validates source, origin, session, schema and size (§6.2)
        → real localStorage["games.bundle.mini-golf.guest"]
          → "mini-golf-save" event → useMiniGolfProgress re-reads
```

**Restoring — the game opens:**

```
GameFrame reads localStorage["games.bundle.mini-golf.guest"]
  → passes it inside __STATOZ_BOOT__ (its `stores`)
    → the shim starts with those stores
      → FS.syncfs(populate) writes them back to storage.json
        → the engine loads bests and unlocks as if they never left
```

**Limits.**

| Limit | Effect |
| ----- | ------ |
| One browser, one device | Progress does not follow the player to another browser or device. |
| Clearable | Clearing site data, private browsing, or Safari's 7-day cleanup of script-written storage wipes it. |
| Guest-only | No `account` is passed yet, so everyone on that browser shares one save (§9). |
| Editable | Anyone can change bests in DevTools — not trustworthy for leaderboards. |

**Adding server sync.** The `save` branch of `GameFrame`'s message handler is the single place
every save passes through: send the payload to the backend there, and load it into `save` before
building `__STATOZ_BOOT__`. The engine, shim and shell need no changes.

### 6.5 Catalogue

`src/config/sports.ts` carries the entry: cover, gameplay video, and `href: "/game/mini-golf"`.

---

## 7. Design

The game deliberately **does not** use the StatOz design system — no shared tokens, no Orbitron
or Space Grotesk, no chamfers. It is its own sunny arcade look, scoped under `.og`:

| Token          | Value     | Use                     |
| -------------- | --------- | ----------------------- |
| `--og-ink`     | `#04190f` | Page and canvas ground  |
| `--og-panel`   | `#0f4a2c` | Card faces              |
| `--og-lime`    | `#9be15d` | Eyebrows, progress      |
| `--og-grass`   | `#4cb848` | Hole tiles              |
| `--og-sun`     | `#ffd23f` | Primary buttons         |
| `--og-cream`   | `#fff6df` | Text, secondary buttons |
| `--og-flag`    | `#ff4d5a` | Out of bounds, flags    |

Three details worth knowing:

- **Root font size is fluid** — `clamp(13px, 1.5vmin + 8px, 20px)` — so the whole interface scales
  with the viewport and almost everything else can be in `rem`.
- **Buttons fake depth** with `box-shadow: 0 .3rem 0 <edge>`, and pressing translates down while
  shrinking the shadow.
- **`.og` is `pointer-events: none`**, re-enabled only on buttons and full-screen overlays, so
  drags pass straight through the HUD to the canvas during play.

Layout adapts at `(orientation: portrait)` (stacked select, 4-column grid) and
`(max-height: 430px) and (orientation: landscape)` (tighter cards for landscape phones).

Accessibility: a `#og-live` region announces hole changes, results and tutorial hints; tiles carry
descriptive `aria-label`s; modals are `role="dialog" aria-modal="true"`; all animation collapses
under `prefers-reduced-motion`.

---

## 8. Licensing

The engine, courses, models, sounds and physics are upstream work under the **MIT licence**.
`bundle/THIRD-PARTY-NOTICES.txt` carries that licence and every dependency's, is inlined into the
bundle, and is mirrored into `credits.ts` for the host. The splash credits Michael Gerdes on
screen. Rubik is **SIL OFL 1.1**. The shell and host are our own.

Do not present the game as entirely original work.

---

## 9. Known gaps

| Gap | Detail |
| --- | ------ |
| `SELECTHOLE` in portrait | The heading is `SELECT<br>HOLE` and the portrait rule hides the `<br>` without substituting a space. Present in the upstream StatOz build too. |
| Lint error | `game-frame.tsx:21` assigns a ref during render (`react-hooks/refs`). Now that `onExit` is stable the ref is no longer load-bearing, so it is safe to remove. |
| Generated file in `public/` | `public/games/mini-golf/index.html` is ~24 MB of build output and is not gitignored. |
| Guest-only progress | Nothing passes `account`, so every save lands under `guest`. Wire the auth session into `<MiniGolfGame account=…>` when it exists. |
| Unused files | `open-golf-lobby.tsx`, `css/open-golf-lobby.module.css` and `rubik-font.ts` are left over from the previous lobby design. `useMiniGolfProgress` is currently unused — only `miniGolfSaveKey` is consumed. |
| Deep link unused | The shell supports `__STATOZ_BOOT__.launch.hole` to boot straight into a hole; nothing passes it now. |

---

## 10. Common tasks

| Task | How |
| ---- | --- |
| Change a screen's look | Edit `bundle/shell/css/golf-shell.css`, rebuild |
| Change screen logic | Edit `bundle/shell/golf-shell.js`, rebuild |
| Add a screen | Add a section to `golf-shell.html`, register it in the `screens` map, rebuild |
| Expose new engine state | Add a getter to `scripts/statoz-ui-bridge.c`, rebuild the engine, then the bundle |
| Update licences | Edit `bundle/THIRD-PARTY-NOTICES.txt`, rebuild (regenerates `credits.ts`) |

Any change under `bundle/` needs `node src/games/mini-golf/scripts/build-mini-golf.mjs` before it
shows up — the served file is a build artefact, and the dev server will not pick it up otherwise.
