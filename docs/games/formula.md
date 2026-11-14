# Formula — implementation

Formula is a 3D single-seater racing game. There are **three circuits** and an 8-car grid. The
player can run a **Quick Match** with their own settings, or a **Career** of four championship
tiers, each one three races long.

The game is an original React + Three.js app built **outside this repo**. Its internal id is
`portfolio-formula`, because it started as a design-portfolio piece. What lives here is the
prebuilt bundle, the shared engine runtime it imports, a build step that verifies and copies both
into `public/`, and the React host that frames it.

The bundle was taken from the published StatOz game library (`game-library/catalogue.json`, entry
`portfolio-formula`, release `cf680d7c…fbddb`) and verified against the catalogue's SHA-256.

---

## 1. Architecture

```
/game/formula                                         Next.js route
└─ <FormulaGame>                                      host wrapper
   └─ <GameFrame gameId="portfolio-formula">          sandboxed iframe, srcdoc
        └─ public/games/formula/index.html            the bundle (~1.9 MiB)
           ├─ host bridge      localStorage shim + postMessage protocol
           ├─ import-map setup resolves @statoz/game-engine at runtime
           └─ game module      React 19 + React Three Fiber + Three.js r187 + racing sim
                 └─ imports  public/games/formula/game-runtime/   shared engine (~45 KB)
```

| Layer              | Lives in                                      | Owns                                          |
| ------------------ | --------------------------------------------- | --------------------------------------------- |
| **Game**           | `bundle/index.html` (game module)             | Physics, AI, circuits, cars, menus, HUD, audio, its own saves |
| **Engine runtime** | `bundle/game-runtime/`                        | Game loop, audio context and buses            |
| **Bundle shims**   | `bundle/index.html` (first scripts)           | Storage, messaging, import map                |
| **Host**           | `components/`, `src/games/shared/`, the route | Framing, save persistence, exit, analytics    |

The engine runtime must be served next to the bundle. Nothing else is fetched: circuits are built
from code, and cars, scenery, fonts and sounds are generated or embedded. There is no asset shim.

---

## 2. File map

```
src/games/formula/
├── bundle/                                  prebuilt input — not authored here
│   ├── index.html                           the whole game (~1.9 MiB)
│   └── game-runtime/                        shared StatOz engine (ES modules)
│       ├── core-IYY2ZB6B.js
│       ├── audio-XE237B2H.js
│       ├── chunks/chunk-*.js
│       └── LICENSES-f19df2bc8a4ac000.txt
├── components/
│   └── formula-game.tsx                     frames the game, handles exit, sets analyticsId
└── scripts/
    └── build-formula.mjs                    verify + copy to public/

src/games/shared/components/
├── game-frame.tsx                           iframe, boot data, protocol, saves, analytics
└── css/game-frame.module.css                loading / error overlay

src/app/(game)/game/formula/page.tsx         the route
public/games/formula/index.html              GENERATED copy of the bundle
public/games/formula/game-runtime/**         GENERATED copy of the runtime
next.config.ts                               CORS header for the runtime
src/config/sports.ts                         catalogue card (id formula, href /game/formula)
```

Everything under `public/games/formula/` is build output. Never edit it by hand; run the build.

### Two ids

| Where | Id |
| ----- | -- |
| Route, catalogue card, analytics `game_id` | `formula` |
| Bundle (`data-game`), every host message, storage key, engine session | `portfolio-formula` |

`FormulaGame` passes `gameId="portfolio-formula"`, because `GameFrame` rejects messages with any
other id, and `analyticsId="formula"`.

---

## 3. Gameplay

### 3.1 Circuits

| Id | Circuit | Character | In-game description |
| -- | ------- | --------- | ------------------- |
| `night` | Night Circuit | BALANCED | Fast esses. A late hairpin. The original floodlit circuit. |
| `harbor` | Harbor Run | HIGH SPEED | Long straights and deep braking beside the harbor lights. |
| `switchback` | Switchback Ring | TECHNICAL | Linked corners and tight hairpins. Find your rhythm. |

Each layout is a closed spline through a list of control points, scaled by 1.2. The track has
three timing sectors, and running wide onto the grass slows the car with extra drag.

### 3.2 Cars and grid

The grid always holds all eight cars, and the player picks one. Each car is a full livery (colours,
finish, pattern and a tyre-compound marking) tied to a fictional team and driver.

| Car | Code | Driver | Slug |
| --- | ---- | ------ | ---- |
| Apex GP-01 | SER | Ayrton Serra | `statoz` |
| Verdant GP-02 | PRE | Alain Prevost | `pluspay` |
| Aurora GP-03 | VOS | Sebastian Voss | `gift-card-marketplace` |
| Vortex GP-04 | HAK | Mika Hakkala | `muncho` |
| Imperial GP-05 | SCH | Michael Schreiber | `muncho-dashboard` |
| Argent GP-06 | HAR | Lewis Harrington | `sri-aakriti` |
| Azure GP-07 | VAN | Max Van Dalen | `eko-infomatics` |
| Solstice GP-08 | ALV | Fernando Alvarez | `mintiq` |

Each car record also carries the portfolio case study it came from (summary, role, industry,
platform, tags and images). See §10 for the concerns this raises.

### 3.3 Quick Match

| Option | Choices | Default |
| ------ | ------- | ------- |
| Circuit | Night Circuit, Harbor Run, Switchback Ring | Night Circuit |
| Car | any of the 8 | — |
| Paint | the car's livery, or a career paint once unlocked | the car's livery |
| Laps | 1, 3, 5 | 3 |
| Difficulty | Easy, Medium, Hard | Medium |

### 3.4 Career

Four championship tiers, each with fixed laps and rival strength (*"Career championships set the
laps and rival strength. Driving assists remain available."*):

| Tier | Laps | Rivals | Reward paint | In-game line |
| ---- | ---- | ------ | ------------ | ------------ |
| Rookie | 1 | easy | Signal | Find your line. Earn your place. |
| Club | 3 | medium | Copper | Hold your nerve over three laps. |
| Pro | 3 | hard | Silverline | Every braking point matters. |
| Champion | 5 | expert | Goldleaf | Five laps. The fastest grid. Your title. |

- **A championship is three races,** one on each circuit in order: Night Circuit, Harbor Run,
  Switchback Ring.
- **Points per finishing position:** 10, 8, 6, 5, 4, 3, 2, 1. Standings are sorted by points.
- **Progress:** the save tracks the highest unlocked tier, the best championship finish (1–8) for
  each tier, and the championship in progress.
- **Expert rivals exist only in the career.** Quick Match stops at Hard.

### 3.5 Driving and AI

The simulation runs on a **fixed 120 Hz step**.

**Controls are analogue:** steering eases towards the input, quickly when the direction reverses
and more slowly otherwise. Throttle and brake are 0–1.

**AI strength** by difficulty: each rival gets a random skill within the range, waits a moment off
the line, and pushes harder when chasing.

| Difficulty | Skill range | Start wait | Chase |
| ---------- | ----------- | ---------- | ----- |
| easy | 0.68–0.74 | 0.2 | 0 |
| medium | 0.79–0.84 | 0.07 | 0.035 |
| hard | 0.88–0.93 | 0.035 | 0.05 |
| expert | 0.94–0.98 | 0.035 | 0.05 |

**Race flow:**

```
select → grid → lights (start lights) → racing → finished → results
```

- The HUD shows position, lap, race time, sector times, *Wrong way* and team-radio style messages
  (*"Box, box."*). Messages are also announced to screen readers.
- **Classification** lists the finishing order. **Race details** shows best laps.
- The result screen offers *Next race* (career) or *Restart race*.
- *Reset car to track* puts a stranded car back on the racing line.

**Assists:**
- **Racing line:** on by default.
- **Auto-throttle:** keyboard and gamepad only. With it on, the car accelerates whenever the
  player isn't braking. It is always off on touch devices.

### 3.6 Controls

| Action | Keyboard | Gamepad | Touch |
| ------ | -------- | ------- | ----- |
| Throttle | `↑` / `W` | RT (analogue) or A | Throttle pedal |
| Brake | `↓` / `S` | LT (analogue), B or D-pad down | Brake pedal |
| Steer | `←` `→` / `A` `D` | Left stick (dead zone 0.14) or D-pad | *Steer left* / *Steer right* buttons |
| Change camera (chase / onboard) | `C` | Y | Settings |
| Reset car | `R` | Back / Select | *Reset car to track* button |
| Sound on / off | `M` | — | *Engine sound* button / settings |
| Pause | `Escape` / `P` | Start | *Pause* button |

*"On-screen steering and pedals appear when the race starts."* The race pauses itself on window
blur, when the tab is hidden, and when the host sends `pause`.

### 3.7 Rendering quality

There are two levels:
- **low** on coarse-pointer (touch) devices or windows narrower than 768 px.
- **high** otherwise.

A performance monitor drops a struggling device to **low** once, and doesn't switch back. Post-
processing (from the `postprocessing` library) runs fully on high and in a lighter mode on low.
`?quality=high` or `?quality=low` on the bundle URL forces a level.

If WebGL is unavailable the game shows *"The circuit needs 3D graphics."*

### 3.8 Audio

Everything is synthesised with Web Audio through the engine's `gameAudioBus`: the engine note (a
sawtooth through a wave-shaper and low-pass filter, following revs), impacts, and UI sounds. The
*Sound* setting (or `M`) mutes it.

---

## 4. Bundle

`bundle/index.html` arrives prebuilt. In order:

| Block | Size | Role |
| ----- | ---- | ---- |
| `<style>` | ~390 KB | Tailwind CSS and embedded fonts (Archivo, JetBrains Mono) |
| Host bridge | ~5 KB | Storage shim and messaging (§4.1) |
| `#statoz-engine-dependencies` | ~1 KB | JSON list of runtime files with SHA-256 and sizes |
| Import-map setup | <1 KB | Builds the import map for the engine (§4.2) |
| Game module | ~1.6 MB | React 19, React Three Fiber, drei, camera-controls, postprocessing 6.39.6, Three.js r187, zustand and the game (`type="module"`) |

### 4.1 Host bridge

This is the generic StatOz prelude, the same as in Cricketer, Penalty Cup, Longbow and Hoop
Legacy. It:

- **Replaces `window.localStorage`** with an in-memory store seeded from `__STATOZ_BOOT__.stores`.
  Every write posts a `save` to the host; writes over 512 KB throw `QuotaExceededError`.
- Installs `window.__STATOZ_HOST__` with `emit`, `save`, `command` and `result`. `result()`
  de-duplicates by id, keeps the last 20 results under `statoz.bundle.results`, and emits `result`.
- Accepts `pause` / `resume` / `dispose` from the parent after checking origin, `gameId` and
  `sessionId`.

### 4.2 Import map

The game module imports `@statoz/game-engine` (for `createGameLoop`) and
`@statoz/game-engine/audio`. A small script builds the import map at runtime:

```js
base   = boot.assetRoot || "/games/portfolio-formula/"   // GameFrame always passes assetRoot
prefix = new URL("../../", base).pathname                // "/" on the web
map    = { "@statoz/game-engine": prefix + "games/formula/game-runtime/core-IYY2ZB6B.js", … }
```

The published release pointed at `/game-runtime/…`. When it was added here, every
`"/game-runtime/` URL in `bundle/index.html` (in the import map and the dependency list) was
rewritten to `"/games/formula/game-runtime/`. Nothing else in the file was changed.

### 4.3 Game module and host protocol

- **`ready`** is emitted once the 3D scene is ready, with payload
  `{ runtime: "portfolio-formula", source: "figma-261:2" }`.
- **`exit`** is emitted by *Back to Motorsport* in the lobby.
- **`result`** is emitted when a race finishes:

  ```js
  { id: `${sessionId}-${raceId}`, carId,   // car slug
    position, time, laps, bestLap,
    mode,                                  // "quick" | "career"
    circuit,                               // night | harbor | switchback
    careerEventId }                        // career races only
  ```

- **`dispose`** from the host stops the game loop and audio, unsubscribes the stores, unmounts the
  app and removes the debug hook. `pause` / `resume` toggle the race pause.
- **Debug hook:** `window.__PORTFOLIO_FORMULA__()` returns a snapshot with these fields:
  - scene ready, phase, menu, mode, circuit
  - career tier, round, unlocked tier and bests
  - grid, save warning, pause and settings state
  - car, laps, difficulty, camera, assists
  - live speed, lap and race time
  - quality level and touch input

---

## 5. Engine runtime

`@statoz/game-engine`, API version **1**. The files are byte-identical to the copies used by the
other bundled games. Formula uses only `createGameLoop`, `createGameAudioContext` and
`gameAudioBus`.

The bundle's `#statoz-engine-dependencies` lists each runtime file with SHA-256 and byte size, and
the build refuses to ship on any mismatch.

**CORS.** The iframe has an opaque origin, so module imports of the runtime are cross-origin.
`next.config.ts` sends `Access-Control-Allow-Origin: *` on `/games/formula/game-runtime/:path*`.
Without it the imports fail and the game never reaches `ready`.

---

## 6. Host

### 6.1 Route

`src/app/(game)/game/formula/page.tsx` sits outside `(with-navbar)` so the game fills the screen,
and renders `<FormulaGame>`. That passes a `useCallback`-stable exit handler to `GameFrame`; an
unstable one would reload the iframe on every render. Exit goes to `/`.

### 6.2 GameFrame

Shared by every bundled game (`src/games/shared/components/game-frame.tsx`). It fetches the bundle
and writes it into `srcdoc`, with this injected first in `<head>`:

```html
<base href="{entryRoot}"><script>window.__STATOZ_BOOT__ = {…};</script>
```

The frame is `sandbox="allow-scripts allow-pointer-lock"` (no `allow-same-origin`), so inbound
messages must have `origin === "null"`, `protocolVersion: 1`, `gameId: "portfolio-formula"` and
the current `sessionId`.

| Direction   | Messages |
| ----------- | -------- |
| game → host | `ready`, `exit`, `error`, `save`, `result` |
| host → game | `pause` (tab hidden), `dispose` (unmount) |

Until `ready`, the host shows an "Opening your game…" overlay with a Back button; on `error` it
offers *Try again*.

### 6.3 Analytics

In production builds (`ENVIRONMENT=production`), `GameFrame` sends the gameplay events from
`docs/ga-events.md` §5 with `game_id: "formula"`, set by `analyticsId`.

Formula is in the result allowlist (`src/lib/analytics/game-results.ts`), so `web_game_result`
carries `mode`, `circuit`, `position` and `laps`. `time` and `bestLap` are left out on purpose
because they are near-unique values.

---

## 7. Progress

Progress lives only in the browser's `localStorage`. Nothing is sent to a server.

**The game's own keys**, inside the bundle's storage:

| Key | Holds |
| --- | ----- |
| `statoz.portfolio-formula.settings.v1` | `{ circuit, paint, laps, difficulty, sound, autoThrottle, camera, racingLine }` |
| `statoz.portfolio-formula.career.v1` | `{ version: 1, serial, unlockedTier, best[4], active }` (§3.4) |
| `statoz.portfolio-formula.records.v2` | `{ version: 2, circuits: { [circuit]: { [car]: { lap, races: { "1"\|"3"\|"5": time } } } } }`: best lap and best race time per lap count |
| `statoz.portfolio-formula.records.v1` | Older records format, read for migration |

Settings defaults:

```js
{ circuit: "night", paint: -1, laps: 3, difficulty: "medium", sound: true,
  autoThrottle: false, camera: "chase", racingLine: true }
```

- **Settings:** every field is checked on load, and invalid fields fall back to their defaults.
  Changes save automatically.
- **Career:** an invalid career is discarded.
- **Records:** if the records are invalid, the game keeps running but stops writing them. A save
  warning is exposed in the debug snapshot.
- **Championship in progress:** stored with its seed and each race's finishing order, so it can be
  resumed.

**On the way out:**

```
game writes localStorage["statoz.portfolio-formula.career.v1"]   (the shim, §4.1)
  → shim posts { type: "save", payload: { schemaVersion: 1, stores, resultIds } }
    → GameFrame validates source, origin, session, schema, size < 600 KB
      → real localStorage["games.bundle.portfolio-formula.guest"]
        → "portfolio-formula-save" event
```

Finished races are also stored by the bridge under `statoz.bundle.results` (last 20) and
`resultIds` (last 1000).

**On the way in:** `GameFrame` reads `games.bundle.portfolio-formula.guest`, passes its `stores`
in `__STATOZ_BOOT__`, and the shim starts with them.

**Limits:**
- One browser and device only.
- Wiped by clearing site data, by private browsing, or by Safari's 7-day storage cleanup.
- Guest-only: no `account` is passed.
- Editable in DevTools, so lap records aren't fit for leaderboards.

---

## 8. Build

```bash
node src/games/formula/scripts/build-formula.mjs
```

1. Reads `bundle/index.html` and its `#statoz-engine-dependencies` list.
2. For each listed file, strips the served prefix `/games/formula/` and checks
   `bundle/game-runtime/…` against the SHA-256 and byte size. Any mismatch, or a URL outside that
   prefix, stops the build.
3. Writes `public/games/formula/index.html`.
4. Replaces `public/games/formula/game-runtime/` with a fresh copy.

---

## 9. Licensing and credits

| Item | Licence | Where it is credited |
| ---- | ------- | -------------------- |
| Three.js r187 | MIT | Licence comment inside the game module |
| React 19, React Three Fiber, drei, zustand | MIT | Licence comments inside the game module |
| camera-controls | MIT | Licence comment inside the game module |
| postprocessing 6.39.6 | Zlib | Licence comment inside the game module |
| Archivo, JetBrains Mono fonts | SIL OFL 1.1 | **Not shipped here** (see §10) |
| Engine dependencies (three, pixi.js, Rapier 2D/3D) | MIT / Apache-2.0 | `game-runtime/LICENSES-….txt` |

Circuits, cars, liveries and the racing simulation are original work.

---

## 10. Known gaps

| Gap | Detail |
| --- | ------ |
| **Driver names echo real F1 champions** | Ayrton Serra, Alain Prevost, Sebastian Voss, Mika Hakkala, Michael Schreiber, Lewis Harrington, Max Van Dalen and Fernando Alvarez closely mirror Senna, Prost, Vettel, Häkkinen, Schumacher, Hamilton, Verstappen and Alonso, with matching three-letter codes. Get this reviewed before launch, or rename the drivers in the source project. |
| **Portfolio content inside the game** | Each car carries a design-portfolio case study naming real products and clients (StatOz, Pluspay, Muncho, Sri Aakriti, Eko Infomatics, Mintiq and others). Confirm this content is meant to ship in a StatOz game, and that the clients have agreed. |
| Font licences | The bundle embeds Archivo and JetBrains Mono (OFL). The OFL texts are in the source project (`…/portfolio-formula/source/src/assets/fonts/*-OFL.txt`) but not shipped here. |
| Source not in the repo | Only the built bundle is here. The source isn't in the local `statoz-next-games-web-pai` checkout either. |
| Hand-edited runtime URLs | A fresh export uses `/game-runtime/…`; re-apply the rewrite in §4.2 or the build stops. |
| Two ids | Anything that reads saves, messages or analytics must know `formula` and `portfolio-formula` are the same game (§2). |
| Duplicated runtime | Five games ship identical copies of `game-runtime/`. |
| Guest-only progress | Nothing passes `account`. Wire the auth session into `<FormulaGame account=…>`. |
| Host overlay styling | `game-frame.module.css` uses Mini Golf's green palette. |
| Lint error | `game-frame.tsx` assigns `exit.current` during render (`react-hooks/refs`). |
| Generated files in `public/` | `public/games/formula/**` is build output and is not gitignored. |

---

## 11. Common tasks

| Task | How |
| ---- | --- |
| Ship a new game build | Download the `portfolio-formula` release from the catalogue, check its SHA-256, replace `bundle/index.html`, re-apply the runtime URLs (§4.2), run the build |
| Move the runtime | Change the URLs in `bundle/index.html`, `SERVED_PREFIX` and the copy target in the build, and the CORS rule in `next.config.ts` |
| Change the catalogue card | `src/config/sports.ts`: cover, spotlight (`portfolio-formula`), video, `href: "/game/formula"` |
| Force a quality level | Add `?quality=high` or `?quality=low` to the bundle URL |
| Inspect a session | `window.__PORTFOLIO_FORMULA__()` inside the frame |

Any change under `bundle/` needs `node src/games/formula/scripts/build-formula.mjs` before it
shows up: the served files are copies.
