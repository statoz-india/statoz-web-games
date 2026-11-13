# Cricketer — implementation

Cricketer is a 3D arcade batting chase. Each chase sets a target score and a number of balls; the
player picks the side and times one tap per delivery, and the game turns that into runs. There are
12 chases across three grounds, plus a three-lesson Academy.

The game is an original React + Three.js app built **outside this repo**. What lives here is the
prebuilt bundle, a small shared engine runtime it imports, a build step that verifies and copies
both into `public/`, and the React host that frames it.

---

## 1. Architecture

```
/game/cricketer                                       Next.js route
└─ <CricketerGame>                                    host wrapper
   └─ <GameFrame>  (src/games/shared)                 sandboxed iframe, srcdoc
        └─ public/games/cricketer/index.html          the bundle (~2.3 MiB)
           ├─ host bridge      localStorage shim + postMessage protocol
           ├─ asset shim       embedded models served from data URIs, network blocked
           ├─ import-map setup resolves @statoz/game-engine at runtime
           └─ game module      React 19 UI + Three.js r186 scene + match rules
                 └─ imports  public/games/cricketer/game-runtime/   shared engine (~64 KB)
```

| Layer              | Lives in                                         | Owns                                              |
| ------------------ | ------------------------------------------------ | ------------------------------------------------- |
| **Game**           | `bundle/index.html` (game module)                | Rules, scene, menus, HUD, audio, its own save     |
| **Engine runtime** | `bundle/game-runtime/`                           | Game loop, fixed-step clock, audio buses          |
| **Bundle shims**   | `bundle/index.html` (first three scripts)        | Storage, messaging, offline assets, import map    |
| **Host**           | `components/`, `src/games/shared/`, the route    | Framing, save persistence, exit                   |

Unlike Mini Golf, the bundle is **not self-contained**: the engine runtime is a set of separate
ES modules that must be served next to it.

---

## 2. File map

```
src/games/cricketer/
├── bundle/                                  prebuilt input — not authored here
│   ├── index.html                           the whole game (~2.3 MiB)
│   └── game-runtime/                        shared StatOz engine (ES modules)
│       ├── core-IYY2ZB6B.js                 loop, clock, sessions, saves, assets
│       ├── audio-XE237B2H.js                audio context, buses, volume
│       ├── chunks/chunk-*.js                code shared by core and audio
│       └── LICENSES-f19df2bc8a4ac000.txt    engine dependency licences
├── components/
│   └── cricketer-game.tsx                   frames the game, handles exit
└── scripts/
    └── build-cricketer.mjs                  verify + copy to public/

src/games/shared/components/
├── game-frame.tsx                           iframe, boot data, protocol, saves
└── css/game-frame.module.css                loading / error overlay

src/app/(game)/game/cricketer/page.tsx       the route
public/games/cricketer/index.html            GENERATED copy of the bundle
public/games/cricketer/game-runtime/**       GENERATED copy of the runtime
next.config.ts                               CORS header for the runtime
```

Everything under `public/games/cricketer/` is build output. Never edit it by hand; run the build.

---

## 3. Gameplay

### 3.1 Chases

Twelve chases, unlocked in order. Each tier of four shares a ground.

| #  | Chase            | Target | Balls | Tier |
| -- | ---------------- | ------ | ----- | ---- |
| 1  | First light      | 5      | 5     | 0    |
| 2  | Find the gap     | 10     | 6     | 0    |
| 3  | Over the rope    | 15     | 6     | 0    |
| 4  | Village champion | 20     | 6     | 0    |
| 5  | New ball         | 24     | 9     | 1    |
| 6  | Change of pace   | 28     | 9     | 1    |
| 7  | Under the lights | 32     | 9     | 1    |
| 8  | Pavilion final   | 36     | 9     | 1    |
| 9  | Quick hands      | 40     | 12    | 2    |
| 10 | Spin cycle       | 44     | 12    | 2    |
| 11 | Pressure chase   | 48     | 12    | 2    |
| 12 | One last over    | 54     | 12    | 2    |

Tier labels are *Village green*, *Pavilion lights* and *The grandstand*; grounds are *Willow
Park*, *Pavilion Oval* and *Crown Ground*. A chase ends the moment the score reaches the target
(won) or the balls run out (lost). There are no wickets — a catch is a dot ball.

### 3.2 Academy

| Lesson               | Target | Balls | Teaches                                                 |
| -------------------- | ------ | ----- | ------------------------------------------------------- |
| Pick your side       | 6      | 6     | Direction only: balls alternate left/right, wide timing |
| Find the middle      | 12     | 6     | Timing into the contact zone                            |
| Read the delivery    | 16     | 6     | Line and length together                                |

### 3.3 Deliveries

Each delivery is generated from a seeded LCG (`seed * 1664525 + 1013904223`), so a chase replays
identically from its seed.

| Property | Rule |
| -------- | ---- |
| Side     | Random left/right (alternating in *Pick your side*) |
| Length   | Random `0–1` (fixed `0.55` in *Pick your side*) |
| Kind     | Tier 0 and lessons: always pace. Tiers 1–2: spin (28 %), slower (20 %), pace |
| Speed    | Spin 78–95 km/h · slower 96–108 km/h · pace 108 + 12×tier, up to +12 more |
| Shot     | Picked for the player from length and side: drive, cut, pull, hook, sweep, scoop |

### 3.4 Timing and runs

The player taps once per ball, choosing **left** or **right**. Input opens 1.15 s into the
delivery and closes at contact. The timing error is measured against the contact moment, and the
window narrows with tier: `0.28 − 0.025 × tier` seconds (`0.52` in *Pick your side*).

```
quality = clamp(1 − |error| / window, 0, 1)
```

| Condition                                   | Runs | Feedback               |
| ------------------------------------------- | ---- | ---------------------- |
| Wrong side                                  | 0    | `WRONG SIDE`           |
| No tap                                      | 0    | `NO SHOT`              |
| Quality 0                                   | 0    | `TOO EARLY` / `TOO LATE` |
| Quality under 0.23 on a long ball (> 0.65)  | 0    | `CAUGHT`               |
| Quality > 0.83                              | 6    | `MIDDLE OF THE BAT`    |
| Quality > 0.66                              | 4    | `MIDDLE OF THE BAT` / `GOOD TIMING` |
| Quality > 0.45                              | 3    | `GOOD TIMING` / `EARLY` / `LATE` |
| Quality > 0.26                              | 2    | `EARLY` / `LATE`       |
| Quality > 0                                 | 1    | `EARLY` / `LATE`       |

Feedback above 0.78 quality reads `MIDDLE OF THE BAT`, above 0.48 `GOOD TIMING`, otherwise
`EARLY` / `LATE`. Ones, twos and threes play a running animation; fours and sixes fly to the rope.

The match runs on a **fixed 120 Hz step** (`FixedStepper(1/120, 24)` from the engine), independent
of frame rate; the camera and render run every animation frame.

### 3.5 Controls

| Input                    | Action                                   |
| ------------------------ | ---------------------------------------- |
| `←` / `A`, on-screen left  | Bat left                                 |
| `→` / `D`, on-screen right | Bat right                                |
| `Escape` / `P`           | Pause / resume; back to menu from lists  |
| `Tab`                    | Cycles focus inside open dialogs         |

The game **requires landscape**. In portrait it pauses and shows *"TURN FOR THE CHASE. Hold your
device landscape, then resume."* It also pauses on window blur and when the tab is hidden.

### 3.6 Screens

`loading` → `menu` (*Play*, *Browse chases*, *Academy*) → `ladder` (the 12 chases) or `lessons`
→ playing → `paused` (Resume, Settings: Sound / Reduce motion, Help, Exit to menu) →
`finished`. An `error` screen covers load failures and a lost WebGL context ("Reload the game to
continue from your last completed delivery").

### 3.7 Audio

All sound is synthesised at runtime with Web Audio — noise, applause and crowd roar are generated,
not sampled. It routes through the engine's `gameAudioBus`, with separate sfx, crowd and UI buses
behind a compressor. Cues: swing, hit, perfect, groan, applause, four, six, catch, land, win,
lose. The crowd bed drops when the game is not in play.

---

## 4. Bundle

`bundle/index.html` arrives prebuilt. Its scripts, in order:

| Script | Size | Role |
| ------ | ---- | ---- |
| `<style>` | ~41 KB | Game CSS, including the `CricketerCondensed` font as a data URI |
| Host bridge | ~5 KB | Storage shim and messaging (§4.1) |
| Asset shim | ~1.4 MB | Embedded models and offline fetch (§4.2) |
| `#statoz-engine-dependencies` | ~1 KB | JSON list of runtime files with SHA-256 and sizes |
| Import-map setup | <1 KB | Builds the import map for the engine (§4.3) |
| Game module | ~920 KB | React 19.2.8, Three.js r186 and the game (`type="module"`) |

### 4.1 Host bridge

A generic StatOz prelude shared by several bundles (it contains inert branches for other games).
For Cricketer it:

- **Replaces `window.localStorage`** with an in-memory store seeded from `__STATOZ_BOOT__.stores`.
  Every write posts a `save` to the host; writes over 512 KB throw `QuotaExceededError`.
- Installs `window.__STATOZ_HOST__` with `emit`, `save`, `command` and `result`. `result()`
  de-duplicates by id, keeps the last 20 results under `statoz.bundle.results`, and emits `result`.
- Accepts `pause` / `resume` / `dispose` from the parent, checking origin, `gameId` and
  `sessionId`.
- Emits `error` on any uncaught error, and pauses itself when the tab is hidden.
- Can also talk to a native WebView (`window.StatozGame.postMessage`) or take boot data from the
  parent (`__STATOZ_BUNDLE_BOOT__`); neither is used on the web.

### 4.2 Asset shim

Five assets are embedded as data URIs:

| Asset                     | Size     |
| ------------------------- | -------- |
| `cricketer-player.glb`    | ~690 KB  |
| `pavilion.glb`            | ~146 KB  |
| `wicket.glb`              | ~28 KB   |
| `cover.png`               | ~171 KB  |
| `characters-manifest.json`| <1 KB    |

`window.fetch` and the `src` setters on images and media are wrapped so a request whose path ends
in one of those names gets the data URI. Requests under `<assetRoot>/engine-assets/` pass through;
**everything else is rejected** ("Remote resource blocked in offline game"). The game makes no
network requests of its own.

### 4.3 Import map

The game module imports `@statoz/game-engine` and `@statoz/game-engine/audio`. A small script
builds the import map at runtime so the URLs work wherever the bundle is mounted:

```js
base   = boot.assetRoot || "/games/cricketer/"
prefix = new URL("../../", base).pathname          // "/" on the web
map    = { "@statoz/game-engine": prefix + "games/cricketer/game-runtime/core-IYY2ZB6B.js", … }
```

The runtime files import each other relatively (`./chunks/…`), so the folder moves as a unit.

### 4.4 Game module

- `createRoot(#root)` renders the app, wired to the bridge: `onExit` → `emit("exit")`,
  `onEvent` → `result()` or `emit()`, host commands → pause / resume / dispose.
- After `CricketView.loadAssets(assetRoot)` succeeds it emits
  `ready` with `{ gameId: "cricketer", title: "Cricketer", engine: "Original Three.js batting chase" }`.
- **Debug hook:** `window.__CRICKETER_INSPECT__` exposes `snapshot()` and `view()`. With
  `?clock=manual` the clock stops and `advance(seconds)` steps it — useful for tests.

---

## 5. Engine runtime

`@statoz/game-engine`, API version **1**. Cricketer uses only `createGameLoop`, `FixedStepper`,
`createGameAudioContext` and `gameAudioBus`.

| Module  | Exports |
| ------- | ------- |
| `core`  | `createGameLoop`, `GameLoop`, `FixedStepper`, `FrameClock`, `GameSession`, `TurnSession`, `ResourceScope`, `SaveStore`, `ScreenStack`, `SeededRandom`, `TaskQueue`, `AssetCache`, `AssetCatalog`, `loadRuntimeAsset`, … |
| `audio` | `AudioMixer`, `createGameAudioContext`, `adoptGameAudioContext`, `gameAudioBus`, `pauseGameAudio`, `resumeGameAudio`, `setGameVolume`, `dbToGain`, `audioDiagnostics` |

The file names carry content hashes. The bundle's `#statoz-engine-dependencies` lists each file
with SHA-256 and byte size, and the build refuses to ship on any mismatch.

**CORS.** The iframe has an opaque origin, so module imports of the runtime are cross-origin.
`next.config.ts` sends `Access-Control-Allow-Origin: *` on `/games/cricketer/game-runtime/:path*`.
Without it the imports fail and the game never reaches `ready`.

---

## 6. Host

### 6.1 Route

`src/app/(game)/game/cricketer/page.tsx` sits outside `(with-navbar)` so the game fills the
screen, and renders `<CricketerGame>`. That passes a `useCallback`-stable exit handler to
`GameFrame` — an unstable one would reload the iframe on every render. Exit goes to `/`.

### 6.2 GameFrame

Shared with Mini Golf (`src/games/shared/components/game-frame.tsx`). It fetches the bundle and
writes it into `srcdoc` with this injected first in `<head>`:

```html
<base href="{entryRoot}"><script>window.__STATOZ_BOOT__ = {…};</script>
```

The `<base>` is what makes path-absolute URLs (the import map) resolve: a `srcdoc` document's own
base is `about:srcdoc`. Boot data carries the saved `stores` / `resultIds`, a per-mount
`sessionId`, `origin`, and `entryRoot` / `artifactRoot` / `assetRoot`.

The frame is `sandbox="allow-scripts allow-pointer-lock"` (no `allow-same-origin`), so inbound
messages must have `origin === "null"` and match `protocolVersion`, `gameId` and `sessionId`.

| Direction   | Messages                                  |
| ----------- | ----------------------------------------- |
| game → host | `ready`, `exit`, `error`, `save`, `result` (ignored by the host) |
| host → game | `pause` (tab hidden), `dispose` (unmount) |

Until `ready`, the host shows an "Opening your game…" overlay with a Back button; on `error` it
offers *Try again*.

---

## 7. Progress

Progress lives only in the browser's `localStorage`. Nothing is sent to a server.

**The game's own save** — key `cricketer.progress.v1` inside the bundle's storage:

```jsonc
{
  "schemaVersion": 1,
  "lessons": ["lesson-direction"],      // lessons won
  "unlocked": 3,                        // highest chase index open (0–11)
  "best": { "chase-1": 7, "chase-2": 12 }, // best score per chase/lesson (0–72)
  "sound": true,
  "reducedMotion": false,
  "checkpoint": { "challengeId": "chase-4", "initialSeed": 123, "seed": null, "results": […] },
  "resultId": "uuid"
}
```

- **Unlocking.** Winning chase *n* opens chase *n + 1*. Winning a lesson records it in `lessons`.
- **Checkpoint.** Written after every ball. *Continue chase* rebuilds the match by replaying the
  recorded results from `initialSeed`, so an interrupted chase resumes at the last completed ball.
- **Validation.** On load every field is checked (known ids, ranges, result shapes). An invalid save
  is **not overwritten** — the session runs without saving and tells the player.

**On the way out:**

```
game writes localStorage["cricketer.progress.v1"]          (the shim, §4.1)
  → shim posts { type: "save", payload: { schemaVersion: 1, stores, resultIds } }
    → GameFrame validates source, origin, session, schema, size < 600 KB
      → real localStorage["games.bundle.cricketer.guest"]
        → "cricketer-save" event
```

When a chase finishes, the game also calls `result()` with
`{ id, game, challengeId, score, target, balls, won }`. That is stored in the same save under
`statoz.bundle.results` (last 20) and `resultIds` (last 1000).

**On the way in:** `GameFrame` reads `games.bundle.cricketer.guest`, passes its `stores` in
`__STATOZ_BOOT__`, and the shim starts with them — the game reads its save as if from real storage.

**Limits.** One browser and device only; wiped by clearing site data, private browsing, or
Safari's 7-day storage cleanup; guest-only (no `account` is passed); editable in DevTools, so not
fit for leaderboards. To add server sync, hook the `save` branch of `GameFrame`'s message handler.

---

## 8. Build

```bash
node src/games/cricketer/scripts/build-cricketer.mjs
```

1. Reads `bundle/index.html` and its `#statoz-engine-dependencies` list.
2. For each listed file, strips the served prefix `/games/cricketer/` and checks
   `bundle/game-runtime/…` against the SHA-256 and byte size. Any mismatch, or a URL outside that
   prefix, stops the build.
3. Writes `public/games/cricketer/index.html`.
4. Replaces `public/games/cricketer/game-runtime/` with a fresh copy.

The bundle is copied as-is — there is no assembly step, unlike Mini Golf.

---

## 9. Licensing and credits

| Item | Licence | Where it is credited |
| ---- | ------- | -------------------- |
| Player model — Sketchfab `a21f5e7ee14f4b6aa5cf6c94a1016932` by **bhagathartworks** | CC BY 4.0 | On the title screen, linking the model and the licence |
| Three.js r186 | MIT | Licence comment inside the game module |
| React 19.2.8, scheduler | MIT | Licence comment inside the game module |
| Engine dependencies (three, pixi.js, Rapier 2D/3D) | MIT / Apache-2.0 | `game-runtime/LICENSES-….txt` |

The game rules, UI and scene are original StatOz work.

---

## 10. Known gaps

| Gap | Detail |
| --- | ------ |
| Source not in the repo | Only the built bundle is here. Changing gameplay, UI or assets means rebuilding in the source project and replacing `bundle/`. |
| Hand-edited runtime URLs | The import map and dependency list in `bundle/index.html` were changed from `/game-runtime/…` to `/games/cricketer/game-runtime/…`. A fresh export will revert them and the build will stop. |
| Real-person likeness | The Sketchfab source model is titled *"virat-kohli-cricket-batting-animation-low-poly"*. CC BY covers the model's copyright, not a real person's likeness or name. Get this reviewed before launch. |
| Player licence file | `characters-manifest.json` lists `PLAYER-LICENSE.txt`, but it is not embedded in the bundle. Attribution currently relies on the on-screen credit. |
| Shared runtime location | The runtime sits under Cricketer's folder; another game using `@statoz/game-engine` would load it from there or ship its own copy. |
| Host overlay styling | `game-frame.module.css` uses Mini Golf's green palette and Rubik, so Cricketer's "Opening your game…" overlay looks golf-themed. |
| `result` messages unused | The host ignores `result`; finished chases are only kept in the local save. |
| Guest-only progress | Nothing passes `account`. Wire the auth session into `<CricketerGame account=…>`. |
| Lint error | `game-frame.tsx` assigns `exit.current` during render (`react-hooks/refs`). |
| Generated files in `public/` | `public/games/cricketer/**` is build output and is not gitignored. |

---

## 11. Common tasks

| Task | How |
| ---- | --- |
| Ship a new game build | Replace `bundle/index.html` and `bundle/game-runtime/`, re-apply the runtime URLs (§10), run the build |
| Move the runtime | Change the URLs in `bundle/index.html`, `SERVED_PREFIX` and the copy target in the build, and the CORS rule in `next.config.ts` |
| Change the catalogue card | `src/config/sports.ts` — cover, spotlight, video, `href: "/game/cricketer"` |
| Test deterministically | Open with `?clock=manual` inside the frame and drive `window.__CRICKETER_INSPECT__.advance()` |

Any change under `bundle/` needs `node src/games/cricketer/scripts/build-cricketer.mjs` before it
shows up — the served files are copies.
