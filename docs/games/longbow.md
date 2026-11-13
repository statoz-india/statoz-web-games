# Longbow — implementation

Longbow is a 3D first-person archery game. The player holds to draw the bow, drags to aim, reads the
wind and releases. There are **30 lanes** across three ranges (90 stars in all), plus **Duel a
Rival**: head-to-head matches against three computer archers.

The game is an original React + Three.js app built **outside this repo**. What lives here is the
prebuilt bundle, the shared engine runtime it imports, a build step that verifies and copies both
into `public/`, and the React host that frames it.

The bundle was taken from the published StatOz game library (`game-library/catalogue.json`,
release `e02c0117…5208`) and verified against the catalogue's SHA-256 before use.

---

## 1. Architecture

```
/game/longbow                                         Next.js route
└─ <LongbowGame>                                      host wrapper
   └─ <GameFrame>  (src/games/shared)                 sandboxed iframe, srcdoc
        └─ public/games/longbow/index.html            the bundle (~4.7 MiB)
           ├─ host bridge      localStorage shim + postMessage protocol
           ├─ asset shim       models, textures, audio served from data URIs, network blocked
           ├─ import-map setup resolves @statoz/game-engine at runtime
           └─ game module      React 19.2.8 UI + Three.js r186 scene + archery rules
                 └─ imports  public/games/longbow/game-runtime/   shared engine (~45 KB)
```

| Layer              | Lives in                                       | Owns                                           |
| ------------------ | ---------------------------------------------- | ---------------------------------------------- |
| **Game**           | `bundle/index.html` (game module)              | Rules, ballistics, scene, menus, HUD, audio, its own save |
| **Engine runtime** | `bundle/game-runtime/`                         | Game loop, clock, audio context and buses      |
| **Bundle shims**   | `bundle/index.html` (first scripts)            | Storage, messaging, offline assets, import map |
| **Host**           | `components/`, `src/games/shared/`, the route  | Framing, save persistence, exit, analytics     |

Like Cricketer and Formula, the bundle is **not self-contained**: the engine runtime is a set of
separate ES modules that must be served next to it. Everything else (models, textures, sounds) is
embedded.

---

## 2. File map

```
src/games/longbow/
├── bundle/                                  prebuilt input — not authored here
│   ├── index.html                           the whole game (~4.7 MiB)
│   └── game-runtime/                        shared StatOz engine (ES modules)
│       ├── core-IYY2ZB6B.js                 loop, clock, sessions, saves, assets
│       ├── audio-XE237B2H.js                audio context, buses, volume
│       ├── chunks/chunk-*.js                code shared by core and audio
│       └── LICENSES-f19df2bc8a4ac000.txt    engine dependency licences
├── components/
│   └── longbow-game.tsx                     frames the game, handles exit
└── scripts/
    └── build-longbow.mjs                    verify + copy to public/

src/games/shared/components/
├── game-frame.tsx                           iframe, boot data, protocol, saves, analytics
└── css/game-frame.module.css                loading / error overlay

src/app/(game)/game/longbow/page.tsx         the route
public/games/longbow/index.html              GENERATED copy of the bundle
public/games/longbow/game-runtime/**         GENERATED copy of the runtime
next.config.ts                               CORS header for the runtime
src/config/sports.ts                         catalogue card (href /game/longbow)
```

Everything under `public/games/longbow/` is build output. Never edit it by hand; run the build.

---

## 3. Gameplay

### 3.1 Ranges and lanes

Thirty lanes in three ranges of ten:

| Range | Blurb (in game) |
| ----- | --------------- |
| **Meadow** | Open grass, short lanes and a gentle breeze. |
| **Pinewood** | Longer lanes between the pines. Targets start to move. |
| **Red Canyon** | Long shots, strong gusts and small, restless targets. |

Arrows are shot in **ends of 3**. A lane has 3, 6 or 9 arrows, so it scores up to 30, 60 or 90.
Stars are earned at fixed shares of the maximum: 60 / 78 / 90 % in Meadow, 55 / 74 / 87 % in
Pinewood, and 50 / 70 / 84 % in Red Canyon.

| #  | Lane | Range | Distance | Target | Movement | Wind | Arrows | Max | ★ / ★★ / ★★★ |
| -- | ---- | ----- | -------- | ------ | -------- | ---- | ------ | --- | ------------ |
| 1 | First Draw | Meadow | 15 m | standard | — | 0–0 m/s | 3 | 30 | 18 / 23 / 27 |
| 2 | Steady Hands | Meadow | 18 m | standard | — | 0–0 m/s | 3 | 30 | 18 / 23 / 27 |
| 3 | Clover Lane | Meadow | 20 m | standard | — | 0–1 m/s | 6 | 60 | 36 / 47 / 54 |
| 4 | Hay Bale Row | Meadow | 25 m | standard | — | 0–2 m/s | 6 | 60 | 36 / 47 / 54 |
| 5 | Breeze Check | Meadow | 25 m | standard | — | 1–3 m/s | 6 | 60 | 36 / 47 / 54 |
| 6 | Long Grass | Meadow | 30 m | standard | — | 1–3 m/s | 6 | 60 | 36 / 47 / 54 |
| 7 | The Drifter | Meadow | 30 m | standard | slide 0.8 m / 4.5 s | 0–2 m/s | 6 | 60 | 36 / 47 / 54 |
| 8 | Windmill Field | Meadow | 35 m | standard | — | 2–4 m/s | 6 | 60 | 36 / 47 / 54 |
| 9 | Little Gold | Meadow | 35 m | small | — | 0–2 m/s | 6 | 60 | 36 / 47 / 54 |
| 10 | Meadow Final | Meadow | 40 m | standard | slide 1.0 m / 4 s | 2–4 m/s | 9 | 90 | 54 / 70 / 81 |
| 11 | Pine Gate | Pinewood | 30 m | standard | — | 2–4 m/s | 6 | 60 | 33 / 44 / 52 |
| 12 | Needle Path | Pinewood | 35 m | standard | slide 1.2 m / 4 s | 1–3 m/s | 6 | 60 | 33 / 44 / 52 |
| 13 | Hanging Ring | Pinewood | 35 m | standard | swing 0.35 rad / 3.2 s | 0–2 m/s | 6 | 60 | 33 / 44 / 52 |
| 14 | Timber Line | Pinewood | 40 m | standard | — | 3–5 m/s | 6 | 60 | 33 / 44 / 52 |
| 15 | Fox Run | Pinewood | 45 m | standard | slide 1.4 m / 3.6 s | 2–4 m/s | 6 | 60 | 33 / 44 / 52 |
| 16 | Woodcutter | Pinewood | 45 m | small | — | 2–5 m/s | 6 | 60 | 33 / 44 / 52 |
| 17 | Pendulum | Pinewood | 50 m | standard | swing 0.4 rad / 3 s | 2–4 m/s | 6 | 60 | 33 / 44 / 52 |
| 18 | Ridge Wind | Pinewood | 50 m | standard | — | 4–6 m/s | 9 | 90 | 50 / 67 / 78 |
| 19 | Shadow Glade | Pinewood | 55 m | small | slide 1.2 m / 4 s | 2–5 m/s | 6 | 60 | 33 / 44 / 52 |
| 20 | Pinewood Final | Pinewood | 60 m | standard | swing 0.45 rad / 2.8 s | 3–6 m/s | 9 | 90 | 50 / 67 / 78 |
| 21 | Dust Devil | Red Canyon | 50 m | standard | — | 4–7 m/s | 6 | 60 | 30 / 42 / 50 |
| 22 | Sandstone | Red Canyon | 55 m | standard | slide 1.6 m / 3.4 s | 3–6 m/s | 6 | 60 | 30 / 42 / 50 |
| 23 | Red Arch | Red Canyon | 60 m | small | — | 4–7 m/s | 6 | 60 | 30 / 42 / 50 |
| 24 | Gust Corridor | Red Canyon | 65 m | standard | — | 6–9 m/s | 6 | 60 | 30 / 42 / 50 |
| 25 | Coyote Run | Red Canyon | 65 m | standard | slide 1.8 m / 3 s | 4–7 m/s | 6 | 60 | 30 / 42 / 50 |
| 26 | Bell Rope | Red Canyon | 70 m | standard | swing 0.5 rad / 2.6 s | 4–8 m/s | 6 | 60 | 30 / 42 / 50 |
| 27 | Mesa Top | Red Canyon | 75 m | small | — | 5–9 m/s | 6 | 60 | 30 / 42 / 50 |
| 28 | Rattler | Red Canyon | 80 m | small | slide 1.5 m / 3.2 s | 4–8 m/s | 9 | 90 | 45 / 63 / 76 |
| 29 | Thunder Gap | Red Canyon | 85 m | standard | swing 0.5 rad / 2.4 s | 7–11 m/s | 9 | 90 | 45 / 63 / 76 |
| 30 | Canyon Crown | Red Canyon | 90 m | small | — | 8–12 m/s | 9 | 90 | 45 / 63 / 76 |

Lane ids are `level-01` … `level-30`.

**Targets.** A standard face has a 0.61 m radius and a small face 0.4 m. *Slide* targets move side
to side (amplitude and period in the table); *swing* targets hang from a 2.2 m rope and swing like
a pendulum.

**Winning a lane:** one star or more.

**Unlocking:**
- The first lane of a range opens when the range opens; every other lane opens once the lane
  before it has at least one star.
- Meadow is always open. Pinewood opens at **20 stars in Meadow**, and Red Canyon at **20 stars in
  Pinewood**.

### 3.2 Duel a Rival

Head-to-head matches against three computer archers, played on a standard target with no movement.
Each match is **5 ends of 3 arrows each**, alternating shots (30 arrows in total).

| Rival | Title | Distance | Wind | Aim spread | Wind error |
| ----- | ----- | -------- | ---- | ---------- | ---------- |
| Wren Hollis | Village Rookie | 30 m | 0–3 m/s | 0.2 | 50 % |
| Tamsin Rook | Forest Ranger | 50 m | 2–6 m/s | 0.12 | 25 % |
| Odette Vale | Canyon Champion | 70 m | 4–9 m/s | 0.075 | 10 % |

- **Win:** a higher total. On equal totals, more X's (centre hits) wins; equal on both is a tie.
- **Unlocking:** Wren is always open. Each next rival opens after beating the previous one once.
- **The computer's aim** solves the perfect shot for the current wind, then misjudges the wind by
  its *wind error* and adds random scatter scaled by its *spread*.

### 3.3 Shooting

The simulation runs on a **fixed 120 Hz step**, independent of frame rate.

| Phase | Rule |
| ----- | ---- |
| Ready | Before each arrow the sight starts slightly off target, at a random angle. |
| Draw  | Full draw takes **0.6 s**. Releasing below **35 %** draw cancels the shot and the arrow stays nocked. |
| Hold  | Sway is at full strength while drawing. After full draw it eases to its smallest (30 %) over 0.5 s (`settling`), stays there until 2.5 s after full draw (`steady`), then grows by 0.6× per second up to 3× (`tiring`). |
| Flight | Launch speed is `70 m/s × (0.55 + 0.45 × draw)`, under 9.81 m/s² gravity, pushed by the wind. The aim already allows for drop at the target distance, but **not** for wind. |
| Impact | The arrow scores where it crosses the target plane. |

The HUD prompts follow the phase: *"Hold anywhere to draw · drag to aim · let go to shoot"*,
*"Steady. Release when the sight is on gold."* and *"Your arms are tiring. Release soon."*

**Wind** is rolled at the start of every end: a random speed within the lane's range in a random
direction. It is shown as an arrow with a speed in m/s.

**Scoring** works on 10 equal rings:

```
score = 10 − floor(distanceFromCentre / (radius / 10))     (minimum 1 on the face)
X     = distanceFromCentre ≤ radius / 20                   (counts as 10, used for tie-breaks)
miss  = off the face, into the ground, or 6 s in the air   (0 points)
```

A 10 by the player plays a short arrow-cam cinematic.

### 3.4 Randomness and replays

All randomness (wind, sway, starting sight, computer noise) comes from a seeded LCG,
`seed = seed × 1664525 + 1013904223`. A session is fully described by its initial seed plus the
recorded shot results, which is how checkpoints resume (§7).

### 3.5 Controls

| Input | Action |
| ----- | ------ |
| Press and hold anywhere / hold `Space` | Draw |
| Drag while holding / `←` `→` `↑` `↓` or `W` `A` `S` `D` | Aim |
| Release | Shoot |
| `Escape` / `P` | Pause or resume. In the lane and rival lists, back to the menu. |

The game **requires landscape**. In portrait it pauses and shows *"Turn your device sideways.
Longbow plays in landscape. Resume once it is turned."* It also pauses on window blur and when the
tab is hidden.

### 3.6 Screens

```
loading → menu ──┬─ PLAY FIRST DRAW / continue ─────────┐
                 ├─ BROWSE LANES  (career: 30 lanes, n / 90 ★)
                 └─ DUEL A RIVAL  (rivals: 3 archers)   ▼
                                                     playing ⇄ paused
                                                        ▼
                                                     finished
error  ("THE RANGE IS CLOSED" · RETRY LOADING · BACK TO ARCHERY)
```

The menu credits *"Scenery and sounds: Poly Haven, ambientCG and freesound contributors (CC0)."*

### 3.7 Rendering quality

There are two presets, picked automatically: **low** on coarse-pointer (touch) devices or when the
short screen side is under 500 px, otherwise **high**. A frame-time monitor ignores the first 2.5 s,
then watches a 3 s window and flags frames averaging over 22 ms.

| Preset | Pixel ratio | Shadows | Shadow map | Post-processing |
| ------ | ----------- | ------- | ---------- | --------------- |
| high | 1.6 | on | 2048 | on |
| low  | 1.25 | off (blob shadows) | 1024 | off |

`window.__LONGBOW_QUALITY__ = "high" | "low"` forces a preset (for testing).

### 3.8 Audio

Four sampled sounds (bow release, arrow fly-by, arrow hit and a meadow ambience bed) plus
synthesised cues: bow creak while drawing, a chime on a 10, and a filtered-noise thud on a miss.
Audio goes through the engine's audio context and buses, and the *Sound on / off* toggle is saved.

---

## 4. Bundle

`bundle/index.html` arrives prebuilt. In order:

| Block | Size | Role |
| ----- | ---- | ---- |
| `<style>` | ~41 KB | Game CSS and fonts as data URIs |
| Host bridge | ~5 KB | Storage shim and messaging (§4.1) |
| Asset shim | ~3.9 MB | Embedded assets and offline fetch (§4.2) |
| `#statoz-engine-dependencies` | ~1 KB | JSON list of runtime files with SHA-256 and sizes |
| Import-map setup | <1 KB | Builds the import map for the engine (§4.3) |
| Game module | ~1.8 MB | React 19.2.8, Three.js r186 and the game (`type="module"`) |

### 4.1 Host bridge

This is the generic StatOz prelude, the same as in Cricketer and Penalty Cup. It:

- **Replaces `window.localStorage`** with an in-memory store seeded from `__STATOZ_BOOT__.stores`.
  Every write posts a `save` to the host; writes over 512 KB throw `QuotaExceededError`.
- Installs `window.__STATOZ_HOST__` with `emit`, `save`, `command` and `result`. `result()`
  de-duplicates by id, keeps the last 20 results under `statoz.bundle.results`, and emits `result`.
- Accepts `pause` / `resume` / `dispose` from the parent after checking origin, `gameId` and
  `sessionId`.

### 4.2 Asset shim

Sixteen assets are embedded as data URIs:

| Asset | Size |
| ----- | ---- |
| `audio/meadow-ambience.mp3` | ~1.3 MB |
| `audio/arrow-hit.mp3` | ~160 KB |
| `audio/arrow-flyby.mp3` | ~65 KB |
| `audio/bow-release.mp3` | ~20 KB |
| `models/shrub.glb`, `fern.glb`, `stump.glb`, `boulder.glb`, `rock.glb` | 100–190 KB each |
| `textures/meadow-grass-*.jpg`, `forest-floor-*.jpg`, `canyon-sand-*.jpg` (colour + normal) | 15–65 KB each |
| `cover.png` | ~280 KB |

`window.fetch` and the `src` setters on images and media are wrapped. A request ending in one of
these paths gets the data URI, requests under `<assetRoot>/engine-assets/` pass through, and
**everything else is rejected** ("Remote resource blocked in offline game"). The game makes no
network requests of its own.

### 4.3 Import map

The game module imports `@statoz/game-engine` and `@statoz/game-engine/audio`. A small script
builds the import map at runtime so the URLs resolve wherever the bundle is mounted:

```js
base   = boot.assetRoot || "/games/longbow/"
prefix = new URL("../../", base).pathname           // "/" on the web
map    = { "@statoz/game-engine": prefix + "games/longbow/game-runtime/core-IYY2ZB6B.js", … }
```

The published release pointed at `/game-runtime/…`. When it was added here, every
`"/game-runtime/` URL in `bundle/index.html` (9 in total, in the import map and the dependency list)
was rewritten to `"/games/longbow/game-runtime/`. Nothing else in the file was changed.

### 4.4 Game module

- `createRoot(#root)` renders the app, wired to the bridge: `onExit` → `emit("exit")`,
  `onEvent` → `result()` or `emit()`, host commands → pause / resume / dispose.
- Once its assets are loaded it emits `ready` with
  `{ gameId: "longbow", title: "Longbow", engine: "Original Three.js archery" }`.
- When a lane or match finishes it calls `result()` with:

  ```js
  { id, game: "longbow", mode: "career" | "match",
    challengeId,          // lane id (career) or rival id (match)
    score, rivalScore,    // rivalScore is null in career
    stars, won }
  ```

- **Debug hooks:**
  - `window.__LONGBOW_INSPECT__` exposes `snapshot()` (screen, game state, save), `view()` and
    `aim()`.
  - With `?clock=manual` the clock stops and is stepped by hand.

---

## 5. Engine runtime

`@statoz/game-engine`, API version **1**. The files are byte-identical to Cricketer's and
Formula's copies (same content hashes).

| Module  | Exports (main) |
| ------- | -------------- |
| `core`  | `createGameLoop`, `FixedStepper`, `FrameClock`, `GameSession`, `SaveStore`, `SeededRandom`, `AssetCache`, … |
| `audio` | `createGameAudioContext`, `gameAudioBus`, `pauseGameAudio`, `resumeGameAudio`, `setGameVolume`, … |

The bundle's `#statoz-engine-dependencies` lists each runtime file with SHA-256 and byte size, and
the build refuses to ship on any mismatch.

**CORS.** The iframe has an opaque origin, so module imports of the runtime are cross-origin.
`next.config.ts` sends `Access-Control-Allow-Origin: *` on `/games/longbow/game-runtime/:path*`.
Without it the imports fail and the game never reaches `ready`.

---

## 6. Host

### 6.1 Route

`src/app/(game)/game/longbow/page.tsx` sits outside `(with-navbar)` so the game fills the screen,
and renders `<LongbowGame>`. That passes a `useCallback`-stable exit handler to `GameFrame`; an
unstable one would reload the iframe on every render. Exit goes to `/`.

### 6.2 GameFrame

Shared by every bundled game (`src/games/shared/components/game-frame.tsx`). It fetches the bundle
and writes it into `srcdoc`, with this injected first in `<head>`:

```html
<base href="{entryRoot}"><script>window.__STATOZ_BOOT__ = {…};</script>
```

The `<base>` makes path-absolute URLs (the import map) resolve, because a `srcdoc` document's own
base is `about:srcdoc`. Boot data carries the saved `stores` / `resultIds`, a per-mount `sessionId`,
`origin`, and `entryRoot` / `artifactRoot` / `assetRoot`.

The frame is `sandbox="allow-scripts allow-pointer-lock"` (no `allow-same-origin`), so inbound
messages must have `origin === "null"` and match `protocolVersion`, `gameId` and `sessionId`.

| Direction   | Messages |
| ----------- | -------- |
| game → host | `ready`, `exit`, `error`, `save`, `result` |
| host → game | `pause` (tab hidden), `dispose` (unmount) |

Until `ready`, the host shows an "Opening your game…" overlay with a Back button; on `error` it
offers *Try again*.

### 6.3 Analytics

In production builds (`ENVIRONMENT=production`), `GameFrame` sends the gameplay events in
`docs/ga-events.md` §5 for Longbow automatically: `web_game_open`, `web_game_ready`,
`web_game_result`, `web_game_exit`, `web_game_error`, `web_game_retry`, `web_game_save_failed` and
`web_game_pause`, with `game_id: "longbow"`.

Longbow has **no entry** in the result allowlist (`src/lib/analytics/game-results.ts`), so
`web_game_result` currently carries only `game_id`. Candidate fields to add: `mode`, `challenge_id`,
`score`, `rival_score`, `stars`, `won`.

---

## 7. Progress

Progress lives only in the browser's `localStorage`. Nothing is sent to a server.

**The game's own save** is under key `longbow.progress.v1` inside the bundle's storage:

```jsonc
{
  "schemaVersion": 1,
  "stars":  { "level-01": 3, "level-02": 1 },          // 0–3 per lane
  "best":   { "level-01": 27 },                        // best score per lane (0–arrows×10)
  "rivals": { "wren": { "played": 2, "won": 1, "best": 128 } },
  "sound": true,
  "reducedMotion": false,
  "checkpoint": { "mode": "career", "id": "level-03", "initialSeed": 123, "results": […] },
  "resultId": "uuid"
}
```

- **After a lane:** `best` and `stars` keep the highest values. **After a match:** `played`, `won`
  and `best` are updated for that rival.
- **Checkpoint:** written after every arrow. *Continue* rebuilds the session by replaying the
  recorded results from `initialSeed`, so an interrupted lane or match resumes at the last arrow.
  It is cleared when the session finishes.
- **Validation:** on load every field is checked (known lane and rival ids, ranges, each recorded
  shot's shape and its shooter order). An invalid save is replaced in memory by an empty one and
  flagged as incompatible.

**On the way out:**

```
game writes localStorage["longbow.progress.v1"]           (the shim, §4.1)
  → shim posts { type: "save", payload: { schemaVersion: 1, stores, resultIds } }
    → GameFrame validates source, origin, session, schema, size < 600 KB
      → real localStorage["games.bundle.longbow.guest"]
        → "longbow-save" event
```

**On the way in:** `GameFrame` reads `games.bundle.longbow.guest`, passes its `stores` in
`__STATOZ_BOOT__`, and the shim starts with them, so the game reads its save as if from real
storage.

**Limits:**
- One browser and device only.
- Wiped by clearing site data, by private browsing, or by Safari's 7-day storage cleanup.
- Guest-only: no `account` is passed.
- Editable in DevTools, so not fit for leaderboards.

To add server sync, hook the `save` branch of `GameFrame`'s message handler.

---

## 8. Build

```bash
node src/games/longbow/scripts/build-longbow.mjs
```

1. Reads `bundle/index.html` and its `#statoz-engine-dependencies` list.
2. For each listed file, strips the served prefix `/games/longbow/` and checks
   `bundle/game-runtime/…` against the SHA-256 and byte size. Any mismatch, or a URL outside that
   prefix, stops the build.
3. Writes `public/games/longbow/index.html`.
4. Replaces `public/games/longbow/game-runtime/` with a fresh copy.

Output: `longbow: 4.7 MiB` and `longbow: 6 runtime files verified and copied`.

---

## 9. Licensing and credits

| Item | Licence | Where it is credited |
| ---- | ------- | -------------------- |
| Scenery models and textures (Poly Haven, ambientCG) | CC0 | Menu credit line |
| Sounds (freesound contributors) | CC0 | Menu credit line |
| Three.js r186 | MIT | Licence comment inside the game module |
| React 19.2.8, scheduler | MIT | Licence comment inside the game module |
| Engine dependencies (three, pixi.js, Rapier 2D/3D) | MIT / Apache-2.0 | `game-runtime/LICENSES-….txt` |

The game rules, UI, lane design and rivals are original StatOz work.

---

## 10. Known gaps

| Gap | Detail |
| --- | ------ |
| Source not in the repo | Only the built bundle is here. The source isn't in the local `statoz-next-games-web-pai` checkout either. Changing gameplay, UI or assets means rebuilding in the source project and replacing `bundle/`. |
| Hand-edited runtime URLs | A fresh export from the catalogue uses `/game-runtime/…`; re-apply the rewrite in §4.3 or the build stops. |
| Duplicated runtime | Cricketer, Formula, Penalty Cup, Hoop Legacy and Longbow each ship an identical copy of `game-runtime/`. |
| Analytics result fields | `web_game_result` carries only `game_id` until Longbow is added to the allowlist (§6.3). |
| Guest-only progress | Nothing passes `account`. Wire the auth session into `<LongbowGame account=…>`. |
| Host overlay styling | `game-frame.module.css` uses Mini Golf's green palette, so Longbow's "Opening your game…" overlay doesn't match its cream and green look. |
| Lint error | `game-frame.tsx` assigns `exit.current` during render (`react-hooks/refs`). |
| Generated files in `public/` | `public/games/longbow/**` is build output and is not gitignored. |

---

## 11. Common tasks

| Task | How |
| ---- | --- |
| Ship a new game build | Download the new release from the catalogue, check its SHA-256, replace `bundle/index.html`, re-apply the runtime URLs (§4.3), run the build |
| Move the runtime | Change the URLs in `bundle/index.html`, `SERVED_PREFIX` and the copy target in the build, and the CORS rule in `next.config.ts` |
| Change the catalogue card | `src/config/sports.ts`: cover, video, `href: "/game/longbow"` |
| Force a quality preset | Set `window.__LONGBOW_QUALITY__` inside the frame before load |
| Inspect a session | `window.__LONGBOW_INSPECT__.snapshot()` inside the frame |

Any change under `bundle/` needs `node src/games/longbow/scripts/build-longbow.mjs` before it shows
up: the served files are copies.
