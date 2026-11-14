# Penalty Cup — implementation

Penalty Cup is a penalty-shootout game. The player picks one of **48 national teams** and plays a
full penalties-only international cup (group stage, then knockouts to the final), or a one-off
**Random Game** against a random opponent. Every match is a shootout in which the player takes
their team's kicks and keeps goal for the opponent's.

The game is a React app with a Three.js stadium and Rapier physics, built **outside this repo**.
What lives here is the prebuilt bundle, the shared engine runtime it imports, a build step that
verifies and copies both into `public/`, and the React host that frames it.

The bundle was taken from the published StatOz game library (`game-library/catalogue.json`,
release `ff66ee8c…eefd1`) and verified against the catalogue's SHA-256.

> ## ⚠️ Third-party assets: resolve before production
>
> The striker and goalkeeper sprites, and all seven sound files, come from **Penalty Shooters 2**, a
> commercial game by **10x10games**, published on Poki.
>
> - The embedded character manifest records the source as *"Commercial source artwork"*. The only
>   recorded approval is *"permission to publish these sprites on GitHub Pages"*, dated 2026-10-26.
> - The source project's `scripts/acquire-penalty-audio.mjs` downloaded the audio from that game's
>   Poki deployment.
>
> That approval covers GitHub Pages, not StatOz's production site. Before Penalty Cup goes live,
> either get written permission from 10x10games covering this use, or replace the sprites and
> sounds with original or properly licensed assets. See §9 and §10.

---

## 1. Architecture

```
/game/penalty-cup                                     Next.js route
└─ <PenaltyCupGame>                                   host wrapper
   └─ <GameFrame>  (src/games/shared)                 sandboxed iframe, srcdoc
        └─ public/games/penalty-cup/index.html        the bundle (~8.8 MiB)
           ├─ host bridge      localStorage shim + postMessage protocol
           ├─ import-map setup resolves @statoz/game-engine at runtime
           └─ game module      React 19.2.8 UI + Three.js r186 + Rapier 3D (WASM) + cup logic
                 ├─ embedded assets   sprites, kit masks, audio (data URIs)
                 └─ imports  public/games/penalty-cup/game-runtime/   shared engine (~45 KB)
```

| Layer              | Lives in                                      | Owns                                          |
| ------------------ | --------------------------------------------- | --------------------------------------------- |
| **Game**           | `bundle/index.html` (game module)             | Shootout rules, physics, cup, AI, menus, HUD, audio, its own saves |
| **Engine runtime** | `bundle/game-runtime/`                        | Game loop, fixed-step clock, audio context and buses |
| **Bundle shims**   | `bundle/index.html` (first scripts)           | Storage, messaging, import map                |
| **Host**           | `components/`, `src/games/shared/`, the route | Framing, save persistence, exit, analytics    |

Apart from the engine runtime, the bundle is self-contained. The game asks for assets by path
(for example `/assets/games/penalty-shootout/audio/kick.wav`). A lookup baked in at build time
answers with an embedded data URI, so nothing else is fetched.

---

## 2. File map

```
src/games/penalty-cup/
├── bundle/                                  prebuilt input — not authored here
│   ├── index.html                           the whole game (~8.8 MiB)
│   └── game-runtime/                        shared StatOz engine (ES modules)
│       ├── core-IYY2ZB6B.js
│       ├── audio-XE237B2H.js
│       ├── chunks/chunk-*.js
│       └── LICENSES-f19df2bc8a4ac000.txt
├── components/
│   └── penalty-cup-game.tsx                 frames the game, handles exit
└── scripts/
    └── build-penalty-cup.mjs                verify + copy to public/

src/games/shared/components/
├── game-frame.tsx                           iframe, boot data, protocol, saves, analytics
└── css/game-frame.module.css                loading / error overlay

src/app/(game)/game/penalty-cup/page.tsx     the route
public/games/penalty-cup/index.html          GENERATED copy of the bundle
public/games/penalty-cup/game-runtime/**     GENERATED copy of the runtime
next.config.ts                               CORS header for the runtime
src/config/sports.ts                         catalogue card (href /game/penalty-cup)
```

Everything under `public/games/penalty-cup/` is build output. Never edit it by hand; run the build.

---

## 3. Gameplay

### 3.1 Modes

| Mode | What it is |
| ---- | ---------- |
| **Penalty Cup** | Choose a nation and play the whole tournament. Progress is saved after every penalty. |
| **Random Game** | A one-off shootout against a random opponent, at group-stage strength. Not saved. |
| **Cup history** | Finished cups (up to 12) and the trophy room (*"Your trophy room awaits"*). |

The home screen reads *"PENALTY CUP · Own the spot. Lift the trophy."* with *"CHOOSE YOUR
CHALLENGE"*.

### 3.2 Nations and groups

There are 48 teams in 12 groups of four, each with a ranking and kit colours. The tournament data
is versioned `world-cup-2026.2026-06-11.v1` and follows the real 2026 draw. The game never uses
the words "World Cup" or "FIFA" on screen.

| Group | Teams (ranking) |
| ----- | --------------- |
| A | Mexico (14), South Africa (60), South Korea (25), Czechia (40) |
| B | Canada (30), Bosnia and Herzegovina (64), Qatar (56), Switzerland (19) |
| C | Brazil (6), Morocco (7), Haiti (83), Scotland (42) |
| D | United States (17), Paraguay (41), Australia (27), Türkiye (22) |
| E | Germany (10), Curaçao (82), Ivory Coast (33), Ecuador (23) |
| F | Netherlands (8), Japan (18), Sweden (38), Tunisia (45) |
| G | Belgium (9), Egypt (29), Iran (20), New Zealand (85) |
| H | Spain (2), Cape Verde (67), Saudi Arabia (61), Uruguay (16) |
| I | France (3), Senegal (15), Iraq (57), Norway (31) |
| J | Argentina (1), Algeria (28), Austria (24), Jordan (63) |
| K | Portugal (5), Congo DR (46), Uzbekistan (50), Colombia (13) |
| L | England (4), Croatia (11), Ghana (73), Panama (34) |

Team ids are three-letter codes (`ARG`, `ENG`, …). The default selection is Argentina.

### 3.3 Cup format

```
Group stage (3 matches) → Round of 32 → Round of 16 → Quarter-final → Semi-final → Final
                                                                     ↘ Third-place match
```

- **Group stage:** 72 fixtures. The top two of each group and the **eight best third-placed
  teams** go through. A built-in table (*Third-place table*) maps each possible combination of
  qualifying third-placed groups to their Round of 32 slots, as in the real format.
- **104 fixtures in total.** Every match the player isn't in is simulated from its own seed: each
  kick scores with probability 0.74, under normal shootout rules.
- **Cup status:** `active`, `eliminated`, `champion`, `runner-up`, `third` or `fourth`.
- **Retries:** a lost knockout match can be retried (*Retry match*). Each fixture records its
  attempts.

### 3.4 Shootout rules

The player shoots first, then players alternate between **shooting** and **keeping**.

| Stage | Rules |
| ----- | ----- |
| Group stage | Exactly five kicks each. A draw is allowed, and there's no early finish. |
| Knockouts and Random Game | Best of five. It ends early once one side can't be caught. If level after five each, sudden death. |

Kick outcomes are `GOAL`, `SAVED`, `WIDE`, `OVER` and `POST`. A kick resolves when the keeper
holds the ball, the ball stops, or 8 s pass.

**Difficulty** rises through the cup as a level from 1 to 12:

| Stage | Level |
| ----- | ----- |
| Group stage, Random Game | 5 |
| Round of 32 | 6 |
| Round of 16 | 7 |
| Quarter-final | 8 |
| Semi-final, Third-place match | 9 |
| Final | 10 |

### 3.5 Shooting

| Phase | What happens |
| ----- | ------------ |
| Preparation | Aim at the goal: the aim point is bounded to ±4.7 m sideways and −0.1 to 3.25 m high, so it can be off-frame. Choose a style. A **composure** marker sweeps a bar. |
| Charging | Press shoot: composure is set from where the marker stopped (`1 − |marker − 0.5| × 2`, best in the middle). Hold to build power, which reaches full in 0.9 s (minimum 5 %). |
| Run-up | Starts on release, or automatically at full power. Lasts 1 s. |
| Flight | The ball is a Rapier rigid body under gravity, against posts, crossbar, net and keeper colliders. |

**Accuracy.** The ball lands at a random point inside a circle around the aim point. Its radius is:

```
radius = (0.035 + (1 − composure) × 0.7 + max(0, power − 0.78)² × 7) × styleFactor
```

So a calm, central composure and power at or below 78 % are accurate.

| Style | Key | Accuracy factor | Ball speed (by power) | Notes |
| ----- | --- | --------------- | --------------------- | ----- |
| Driven | `1` | 1.0 | 15–34 m/s | Default |
| Placed | `2` | 0.72 (tighter) | 13–25 m/s | Adds sidespin |
| Chip | `3` | 1.2 (looser) | 9–15 m/s | Lofted |

The goal is 7.32 × 2.44 m, and the spot is 11 m out.

**The computer keeper** reads the player's last five shots. If they lean to one side, it guesses
that side more often: the chance rises from 0.2 to 0.55 through the cup. Otherwise it picks a side
at random. It chooses a low, middle or high dive. About half its dives are committed early, during
the run-up. The rest react to the flight, with a reaction time that falls from 0.38 s to 0.18 s as
the level rises.

### 3.6 Keeping

When the opponent shoots, the player is the goalkeeper:
- **Preparation:** *"Move on the line — read the taker"*.
- **Run-up:** *"Commit early for reach, or react late"*. Diving early covers more goal; diving
  late risks being beaten by the ball.

The computer taker aims 1–3.25 m from centre at 0.22–2.15 m height, with 40–85 % power. Its
composure rises from 0.5 to 0.94 through the cup. It chips about 10 % of the time, places about
36 %, and drives the rest.

After every kick there's a **replay** (up to 16 s of recorded frames) and a summary.

### 3.7 Controls

| Action | Keyboard | Gamepad | Touch |
| ------ | -------- | ------- | ----- |
| Aim (shooting) / move on line (keeping) | `W` `A` `S` `D` / arrows | Left stick | AIM / MOVE pad |
| Choose style | `1` Driven · `2` Placed · `3` Chip | B Driven · RB Placed · LB Chip | Style buttons |
| Shoot: hold, then release | `Space` | B | *Hold to shoot* button |
| Dive (keeping) | Arrow keys | Right-stick flick (A = stay central) | Tap to dive |
| Pause | `Escape` | Start | Pause button |

The in-game help summarises this as *"Aim · Hold · Release"* and *"Move · Tap to dive"*. The pause
menu offers *Save & exit* in the cup or *Exit match* in a Random Game. The catalogue lists the game
as landscape.

### 3.8 Presentation and audio

- **Stadium:** a 3D Three.js scene with crowd and advertising boards.
- **Players:** 2D sprite animations drawn into the scene:
  - **Striker:** 55 kick frames, ball contact at frame 42.
  - **Keeper:** idle, plus low, mid and high catches and parries.
- **Kit colours:** a shader recolours the sprites from kit masks (`penalty-cup-masked-kit-v1`), so
  every nation plays in its own primary and secondary colours.
- **Audio:** seven sampled sounds (crowd, kick, glove, frame, goal, whistle, result) through the
  engine's audio context and buses, with separate *effects*, *crowd* and *music* volumes and a mute.
- **Reduced motion:** follows the OS setting by default.

---

## 4. Bundle

`bundle/index.html` arrives prebuilt. In order:

| Block | Size | Role |
| ----- | ---- | ---- |
| `<style>` | ~60 KB | Game CSS, including the *Cup Condensed* font as a data URI |
| Host bridge | ~5 KB | Storage shim and messaging (§4.1) |
| `#statoz-engine-dependencies` | ~1 KB | JSON list of runtime files with SHA-256 and sizes |
| Import-map setup | <1 KB | Builds the import map for the engine (§4.2) |
| Game module | ~8.7 MB | Everything else (`type="module"`); see below |

Inside the game module:

| Part | Size |
| ---- | ---- |
| Rapier 3D physics, as base64 WebAssembly | ~4.0 MB |
| Embedded assets: two sprite sheets (~1.3 MB), two kit masks (~350 KB), seven sounds (~350 KB) and the character manifest | ~2.0 MB |
| React 19.2.8, Three.js r186 and the game code, including inline animation data | the rest |

### 4.1 Host bridge

This is the generic StatOz prelude, the same as in the other bundled games. It:

- **Replaces `window.localStorage`** with an in-memory store seeded from `__STATOZ_BOOT__.stores`.
  Every write posts a `save` to the host; writes over 512 KB throw `QuotaExceededError`.
- Installs `window.__STATOZ_HOST__` with `emit`, `save`, `command` and `result`. `result()`
  de-duplicates by id, keeps the last 20 results under `statoz.bundle.results`, and emits `result`.
- Accepts `pause` / `resume` / `dispose` from the parent after checking origin, `gameId` and
  `sessionId`.

### 4.2 Import map

The game module imports `@statoz/game-engine` (for `createGameLoop` and
`FixedStepper(1/120, 24)`) and `@statoz/game-engine/audio`. A small script builds the import map
at runtime:

```js
base   = boot.assetRoot || "/games/penalty-cup/"
prefix = new URL("../../", base).pathname           // "/" on the web
map    = { "@statoz/game-engine": prefix + "games/penalty-cup/game-runtime/core-IYY2ZB6B.js", … }
```

The published release pointed at `/game-runtime/…`. When it was added here, every
`"/game-runtime/` URL in `bundle/index.html` (9 in total, in the import map and the dependency list)
was rewritten to `"/games/penalty-cup/game-runtime/`. Nothing else in the file was changed.

### 4.3 Game module and host protocol

- **`ready`** is emitted once the cup save has loaded, with payload `{ game: "penalty-cup" }`.
- **`exit`** is emitted by the back button on the home screen.
- **`result`** is emitted:
  - **after a Random Game:**
    ```js
    { id, mode: "random", outcome: "win" | "loss" | "draw", score: [player, opponent] }
    ```
  - **when a cup ends**, as the run leaves `active`:
    ```js
    { id, mode: "cup", team, outcome }   // outcome: eliminated | champion | runner-up | third | fourth
    ```
- **`pause`, `resume` and `dispose`** from the host pause, resume or unmount the game.

---

## 5. Engine runtime

`@statoz/game-engine`, API version **1**. The files are byte-identical to the copies used by the
other bundled games.

The bundle's `#statoz-engine-dependencies` lists each runtime file with SHA-256 and byte size, and
the build refuses to ship on any mismatch.

**CORS.** The iframe has an opaque origin, so module imports of the runtime are cross-origin.
`next.config.ts` sends `Access-Control-Allow-Origin: *` on `/games/penalty-cup/game-runtime/:path*`.
Without it the imports fail and the game never reaches `ready`.

---

## 6. Host

### 6.1 Route

`src/app/(game)/game/penalty-cup/page.tsx` sits outside `(with-navbar)` so the game fills the
screen, and renders `<PenaltyCupGame>`. That passes a `useCallback`-stable exit handler to
`GameFrame`; an unstable one would reload the iframe on every render. Exit goes to `/`.

### 6.2 GameFrame

Shared by every bundled game (`src/games/shared/components/game-frame.tsx`). It fetches the bundle
and writes it into `srcdoc`, with this injected first in `<head>`:

```html
<base href="{entryRoot}"><script>window.__STATOZ_BOOT__ = {…};</script>
```

The frame is `sandbox="allow-scripts allow-pointer-lock"` (no `allow-same-origin`), so inbound
messages must have `origin === "null"` and match `protocolVersion`, `gameId` and `sessionId`.

| Direction   | Messages |
| ----------- | -------- |
| game → host | `ready`, `exit`, `error`, `save`, `result` |
| host → game | `pause` (tab hidden), `dispose` (unmount) |

Until `ready`, the host shows an "Opening your game…" overlay with a Back button; on `error` it
offers *Try again*.

### 6.3 Analytics

In production builds (`ENVIRONMENT=production`), `GameFrame` sends the gameplay events from
`docs/ga-events.md` §5 with `game_id: "penalty-cup"`.

Penalty Cup is in the result allowlist (`src/lib/analytics/game-results.ts`):

| Result | `web_game_result` carries |
| ------ | ------------------------- |
| Random Game | `mode`, `outcome`, `goals_for`, `goals_against` |
| Cup | `mode` and `outcome` (the cup status). The cup result has no score, and `team` isn't sent. |

---

## 7. Progress

Progress lives only in the browser's `localStorage`. Nothing is sent to a server.

**The game's own keys**, inside the bundle's storage:

| Key | Holds |
| --- | ----- |
| `penalty-cup.v1.guest` | The cup save (below) |
| `penalty-cup.v1.guest.backup` | A copy of the last good cup save |
| `penalty-cup.settings.v1` | `{ effects: 0.65, crowd: 0.45, music: 0.55, muted: false, reducedMotion }` |

`guest` comes from `__STATOZ_BOOT__.storageScope`, which `GameFrame` doesn't set.

**Cup save:**

```jsonc
{
  "version": 2,
  "revision": 17,                 // increases on every commit; stale writes are refused
  "active": {                     // the cup in progress, or null
    "version": 2, "dataVersion": "world-cup-2026.2026-06-11.v1",
    "id": "…", "team": "ARG", "stage": "round16", "status": "active",
    "seed": 123, "day": 0, "updatedAt": "…",
    "fixtures": [ /* 72–104 fixtures: id, stage, home, away, seed, attempts, day, score … */ ],
    "checkpoint": { /* the match in progress: seed, level, tick, random state, kicks */ }
  },
  "history": [ /* up to 12 finished cups, newest first */ ]
}
```

- **Checkpoint:** written after every completed penalty (*"Completed penalties are kept."*), so a
  cup match resumes exactly where it stopped, including the random state.
- **Backup:** every write updates both keys. If the main key is unreadable, the backup is used.
  If both fail: *"Saved cup unavailable. Your original save is preserved."* The bad save isn't
  overwritten, and *Reset save* clears it.
- **Version 1 saves** are migrated to version 2 on load.
- **Storage write failure:** *"Progress stays in this session"*.

**On the way out:**

```
game writes localStorage["penalty-cup.v1.guest"]          (the shim, §4.1)
  → shim posts { type: "save", payload: { schemaVersion: 1, stores, resultIds } }
    → GameFrame validates source, origin, session, schema, size < 600 KB
      → real localStorage["games.bundle.penalty-cup.guest"]
        → "penalty-cup-save" event
```

**On the way in:** `GameFrame` reads `games.bundle.penalty-cup.guest`, passes its `stores` in
`__STATOZ_BOOT__`, and the shim starts with them.

**Limits:**
- One browser and device only.
- Wiped by clearing site data, by private browsing, or by Safari's 7-day storage cleanup.
- Guest-only.
- A full 104-fixture cup save, stored twice (main plus backup), counts against the shim's 512 KB
  limit.

---

## 8. Build

```bash
node src/games/penalty-cup/scripts/build-penalty-cup.mjs
```

1. Reads `bundle/index.html` and its `#statoz-engine-dependencies` list.
2. For each listed file, strips the served prefix `/games/penalty-cup/` and checks
   `bundle/game-runtime/…` against the SHA-256 and byte size. Any mismatch, or a URL outside that
   prefix, stops the build.
3. Writes `public/games/penalty-cup/index.html`.
4. Replaces `public/games/penalty-cup/game-runtime/` with a fresh copy.

Output: `penalty-cup: 8.8 MiB` and `penalty-cup: 6 runtime files verified and copied`.

---

## 9. Licensing and credits

| Item | Licence | Status |
| ---- | ------- | ------ |
| **Striker and keeper sprite sheets** (`imported-characters/striker.webp`, `keeper.webp`) and their kit masks | **Commercial artwork from *Penalty Shooters 2* by 10x10games** (poki.com/en/g/penalty-shooters-2) | ⚠️ Recorded permission covers GitHub Pages only. Not cleared for StatOz production. |
| **Audio**: crowd, kick, glove, frame, goal, whistle, result | **Taken from the *Penalty Shooters 2* Poki deployment** by the source project's `acquire-penalty-audio.mjs` | ⚠️ No licence recorded. Not cleared. |
| Rapier 3D (`@dimforge/rapier3d-compat`) | Apache-2.0 | Licence text not visible in the bundle; ship `game-runtime/LICENSES-….txt` alongside |
| Three.js r186 | MIT | Licence comment inside the game module |
| React 19.2.8, scheduler | MIT | Licence comment inside the game module |
| Engine dependencies (three, pixi.js, Rapier 2D/3D) | MIT / Apache-2.0 | `game-runtime/LICENSES-….txt` |
| National team names, flags and colours | Factual | No crests or federation marks are used |

The cup logic, physics, AI, stadium and UI are StatOz's own code. The visible players and every
sound are not.

---

## 10. Known gaps

| Gap | Detail |
| --- | ------ |
| **Third-party sprites and audio** | The top-of-page warning and §9. Blocking for production: get a licence from 10x10games, or replace the sprite sheets, kit masks and seven sounds and rebuild in the source project. |
| **Similarity to Penalty Shooters 2** | Beyond the assets, the concept (pick a nation, shoot and keep in alternate penalties, win the cup) follows Penalty Shooters 2 closely. The source project also contains a `penalty-shooters-2` game. Have the design reviewed together with the asset question. |
| Real tournament data | Groups and rankings mirror the real 2026 draw. No competition name is shown, but the internal data id says `world-cup-2026`. |
| Already live in the catalogue | `src/config/sports.ts` lists Penalty Cup as playable (no `comingSoon`). Set it back to coming soon until the asset rights are settled. |
| Source not in the repo | Only the built bundle is here. The source isn't in the local `statoz-next-games-web-pai` checkout either. |
| Hand-edited runtime URLs | A fresh export uses `/game-runtime/…`; re-apply the rewrite in §4.2 or the build stops. |
| Bundle size | 8.8 MiB, nearly half of it the Rapier WebAssembly as base64. The largest of the bundled games except Mini Golf. |
| Duplicated runtime | Five games ship identical copies of `game-runtime/`. |
| Guest-only progress | `storageScope` and `account` are never set. |
| Host overlay styling | `game-frame.module.css` uses Mini Golf's green palette. |
| Lint error | `game-frame.tsx` assigns `exit.current` during render (`react-hooks/refs`). |
| Generated files in `public/` | `public/games/penalty-cup/**` is build output and is not gitignored. |

---

## 11. Common tasks

| Task | How |
| ---- | --- |
| Ship a new game build | Download the release from the catalogue, check its SHA-256, replace `bundle/index.html`, re-apply the runtime URLs (§4.2), run the build |
| Replace the third-party assets | In the source project: new sprite sheets and kit masks with an updated `imported-characters/manifest.json`, and new audio files. Then rebuild the bundle there and ship it as above. |
| Hide the game until cleared | Add `comingSoon: true` to the `penalty-cup` entry in `src/config/sports.ts`, and render `<ComingSoon gameId="penalty-cup" />` in the route |
| Move the runtime | Change the URLs in `bundle/index.html`, `SERVED_PREFIX` and the copy target in the build, and the CORS rule in `next.config.ts` |
| Change the catalogue card | `src/config/sports.ts`: cover, spotlight, video, `href: "/game/penalty-cup"` |

Any change under `bundle/` needs `node src/games/penalty-cup/scripts/build-penalty-cup.mjs` before
it shows up: the served files are copies.
