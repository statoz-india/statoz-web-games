# Hoop Legacy — implementation

Hoop Legacy is a 3D arcade basketball game: 1v1 and 3v3 half-court games, a three-point contest,
and a story-mode career that takes a created player from the combine and the draft through
seasons, the All-Star Weekend, a 3v3 street tournament and free agency.

The game is an original React + Three.js app built **outside this repo**. What lives here is the
prebuilt bundle, the shared engine runtime it imports, the 3D athlete models it streams at runtime,
a build step that verifies and copies all of it into `public/`, and the React host that frames it.

The bundle and athlete files were taken from the published StatOz game library
(`game-library/catalogue.json`, release `37ac4929…e563`). The bundle was verified against the
catalogue's SHA-256, and each athlete file against the SHA-256 in its manifest.

---

## 1. Architecture

```
/game/hoop-legacy                                     Next.js route
└─ <HoopLegacyGame>                                   host wrapper
   └─ <GameFrame>  (src/games/shared)                 sandboxed iframe, srcdoc
        └─ public/games/hoop-legacy/index.html        the bundle (~2.4 MiB)
           ├─ host bridge      localStorage shim + postMessage protocol
           ├─ import-map setup resolves @statoz/game-engine at runtime
           └─ game module      React 19.3.1 UI + Three.js r187 scene + basketball sim
                 ├─ imports  public/games/hoop-legacy/game-runtime/        shared engine (~45 KB)
                 └─ fetches  public/games/hoop-legacy/assets/athletes-v2/  athlete models (~13 MB)
```

| Layer              | Lives in                                      | Owns                                            |
| ------------------ | --------------------------------------------- | ----------------------------------------------- |
| **Game**           | `bundle/index.html` (game module)             | Rules, AI, scene, menus, HUD, audio, career, its own saves |
| **Athletes**       | `bundle/assets/athletes-v2/`                  | Player bodies, heads, hair, kit and gear (GLB + textures) |
| **Engine runtime** | `bundle/game-runtime/`                        | Game loop, clock, audio context and buses       |
| **Bundle shims**   | `bundle/index.html` (first scripts)           | Storage, messaging, import map                  |
| **Host**           | `components/`, `src/games/shared/`, the route | Framing, save persistence, exit, analytics      |

Unlike Longbow and Penalty Cup, Hoop Legacy is **not self-contained in two ways**: it imports the
engine runtime **and** downloads its athlete models over the network. Both must be served next to
the bundle. There is **no offline asset shim**: everything apart from the athletes (court, arena,
crowd, fonts) is generated or embedded.

---

## 2. File map

```
src/games/hoop-legacy/
├── bundle/                                  prebuilt input — not authored here
│   ├── index.html                           the whole game (~2.4 MiB)
│   ├── game-runtime/                        shared StatOz engine (ES modules)
│   │   ├── core-IYY2ZB6B.js
│   │   ├── audio-XE237B2H.js
│   │   ├── chunks/chunk-*.js
│   │   └── LICENSES-f19df2bc8a4ac000.txt
│   └── assets/athletes-v2/                  streamed athlete models (~13 MB, 70 files)
│       ├── manifest.json                    every file with size and SHA-256
│       ├── lod1/                            lighter models (16 GLB)
│       ├── lod0/                            full models (16 GLB)
│       ├── hero/                            close-up models (16 GLB)
│       ├── shared/                          textures shared by every level (21 WebP)
│       └── LICENSES.txt                     CC0 notices
├── components/
│   └── hoop-legacy-game.tsx                 frames the game, handles exit
└── scripts/
    └── build-hoop-legacy.mjs                verify + copy to public/

src/games/shared/components/
├── game-frame.tsx                           iframe, boot data, protocol, saves, analytics
└── css/game-frame.module.css                loading / error overlay

src/app/(game)/game/hoop-legacy/page.tsx     the route
public/games/hoop-legacy/index.html          GENERATED copy of the bundle
public/games/hoop-legacy/game-runtime/**     GENERATED copy of the runtime
public/games/hoop-legacy/assets/**           GENERATED copy of the athletes
next.config.ts                               CORS headers for the runtime and the athletes
src/config/sports.ts                         catalogue card (href /game/hoop-legacy)
```

Everything under `public/games/hoop-legacy/` is build output. Never edit it by hand; run the build.

---

## 3. Gameplay

### 3.1 Modes

| Menu item | What it is |
| --------- | ---------- |
| **My Career** (story mode) | Create a player and play the career (§3.6). Three save slots. |
| **Play Now** (1v1 · 3v3) | A quick game against the CPU with your own settings (§3.2). |
| **3PT Contest** | A timed three-point shooting contest (§3.5). |
| **Settings** | Graphics, audio, camera, controls and accessibility (§3.8). |

The title screen reads *"BUILD YOUR LEGACY"* and *"TAP TO START"*.

### 3.2 Play Now

| Option | Choices |
| ------ | ------- |
| Format | 1v1 or 3v3 |
| Teams | 16 fictional teams (§3.3) |
| Difficulty | Rookie, Pro, All-Star, Superstar, HOF (Hall of Fame) |
| Game length | First to **11**, **15** or **21** |
| Clock | No clock, **3:00**, **5:00** or **8:00** |

Rules shown on the setup screen: *"Scoring: 2s & 3s · 12-second shot clock · Loser's ball after
every make"*. After a change of possession the ball has to be cleared past the arc before the
offence can score. Quick-game wins and losses are kept in the records (§7).

### 3.3 Teams

| Id | Team | Id | Team |
| -- | ---- | -- | ---- |
| `bay` | Bay City Monarchs | `nsw` | Northside Wolves |
| `cst` | Coastline Surge | `oto` | Old Town Outlaws |
| `dsc` | Desert Scorpions | `park` | Rucker Lane Park |
| `ebh` | Eastbank Hoopers | `rvr` | Riverside Runners |
| `hbk` | Harbor Krakens | `smt` | Summit Peaks |
| `ipe` | Iron Park Elite | `ssb` | Southside Ballers |
| `mtt` | Metro Titans | `upr` | Uptown Royals |
| `vlt` | Neon City Voltage | `wek` | Westend Kings |

All team names, players and sponsors (*Aero Glide Kicks*, *Swish Energy* and others) are fictional.

### 3.4 Shooting and difficulty

**Shot types:** layup, dunk, jumper and three. Each is driven by one player attribute: finishing,
dunk, mid-range and three respectively.

**Release timing.** Shots use a timing meter with its target at `0.8`. The perfect window depends
on the shooter's attribute for that shot:

```
window = (0.034 + 0.042 × max(0, (attribute − 40) / 59)) × difficulty.greenMul × (1 + 0.45 × greenMachineBadge)
```

| Release error | Grade (HUD text) |
| ------------- | ---------------- |
| ≤ window | `EXCELLENT` (perfect, "green") |
| ≤ 2.5 × window | `GOOD RELEASE` |
| ≤ 0.24 | `SLIGHTLY EARLY` / `SLIGHTLY LATE` |
| more | `VERY EARLY` / `VERY LATE` |

Base make chance then comes from the shot type and attribute, with adjustments for shot distance,
contests and badges. For example, a jumper starts at `0.41 + (attribute − 60) × 0.0082` and loses
accuracy beyond 5 m. A layup gains from the *Pro Touch* badge.

**Difficulty** sets the CPU's skill and how much help the human gets:

| Level | Reaction (s) | Shot IQ | Steal rate | Contest | Speed | Perfect window ×  | Human assist |
| ----- | ------------ | ------- | ---------- | ------- | ----- | ----------------- | ------------ |
| Rookie | 0.46 | 0.55 | 0.08 | 0.60 | 0.90 | 1.65 | 1.25 |
| Pro | 0.34 | 0.70 | 0.13 | 0.75 | 0.95 | 1.30 | 1.10 |
| All-Star | 0.25 | 0.82 | 0.19 | 0.90 | 1.00 | 1.05 | 1.00 |
| Superstar | 0.18 | 0.90 | 0.25 | 1.00 | 1.03 | 0.88 | 0.92 |
| Hall of Fame | 0.13 | 0.96 | 0.31 | 1.10 | 1.06 | 0.72 | 0.85 |

Each level also sets how often the CPU's own shots grade perfect, good, early or late, and very
early or late.

### 3.5 Three-Point Contest

Racks of balls around the arc against a clock. The career uses it twice:
- **Combine · Shooting Drill:** a *"60-second, five-rack three-point test. Scouts are watching."*
- **All-Star Weekend:** *"Two rounds against the league's best shooters."* Winning adds the
  *3PT Contest Champion* award.

The HUD tracks makes, attempts and perfect releases. The best score from any contest is kept as
`contestBest` in the records (§7).

### 3.6 Career

A career runs in chapters, each shown as a card with a chapter label, title and subtitle:

```
Create player → Combine (shooting drill) → Draft Night → regular season
   → All-Star Weekend (Three-Point Contest, All-Star Game) → season end and awards
   → Free Agency (offseason) → next season
City Circuit: Build Your Crew → 3v3 street tournament (runs alongside)
```

| Chapter | In-game description |
| ------- | ------------------- |
| Combine · Shooting Drill | 60-second, five-rack three-point test. Scouts are watching. |
| Draft Night | The commissioner is at the podium. Find out where you land. The draft position depends on combine results and overall rating. |
| Three-Point Contest | Two rounds against the league's best shooters (All-Star Weekend, if invited). |
| All-Star Game | 3v3 with the league's elite · First to 15 (if selected). |
| Build Your Crew | Recruit two teammates for the City Circuit 3v3 tournament. *"Better players want a bigger cut of your coins."* |
| Season Complete / Season Over | Head into the offseason, or see the awards after elimination. |
| Free Agency | Review contract offers and start the next season. |

**Player creation** sets a name (or *Random name*), height, look (jersey, shorts, shoes, headband,
sleeves, wristbands) and one of five **archetypes**:

| Archetype | Tagline | Positions |
| --------- | ------- | --------- |
| Sharpshooter | Lights-out range. Punishes every closeout. | PG, SG, SF |
| Slasher | Explosive first step. Lives at the rim. | SG, SF, PF |
| Floor General | Ankle-breaking handles and dimes on a string. | PG, SG |
| Lockdown | Clamps on the perimeter. Thief in the lanes. | SG, SF, PF |
| Paint Beast | Owns the glass. Protects the rim. | PF, C |

The archetype and height set the starting attributes and their caps. Attributes: three, mid,
finish, dunk, handles, passing, speed, vertical, perimeter defence, steal, block, rebound and
stamina.

**Progression.**
- **Training:** one session unlocks after each game played (*"You trained since your last game.
  Play your next game to unlock another session."*).
- **Badges:** 13 badges, each with four tiers. A tier needs its attribute at a threshold and costs
  points.

  | Badge | Effect | Attribute |
  | ----- | ------ | --------- |
  | Deadeye | Contested jumpers lose less accuracy | three |
  | Limitless Range | Extends range well beyond the arc | three |
  | Catch & Shoot | Boost to shots right after a pass | three |
  | Green Machine | Wider perfect-release window on jumpers | mid |
  | Pro Touch | Layups and floaters fall more often | finish |
  | Posterizer | Dunk through contact more often | dunk |
  | Ankle Breaker | Skill moves stagger defenders more often | handles |
  | Quick First Step | Faster acceleration with the ball | speed |
  | Dimer | Teammates shoot better after your passes | passing |
  | Clamps | Stronger contests and on-ball defence | perimD |
  | Pick Pocket | Higher steal success | steal |
  | Rim Protector | Block shots at the rim more often | block |
  | Rebound Chaser | Bigger reach and pull on rebounds | rebound |

- **Coins:** a career currency. City Circuit teammates take a share, and better players want a
  bigger cut. Gear can be changed in the career; shoe boosts apply in every game.
- **Rewards:** awards (*Rookie of the Year*, *Defensive Player of the Year*, *3PT Contest Champion*,
  *City Circuit Champion*), a trophy case (*"Win games, tournaments and awards to fill your trophy
  case."*), box scores, *Player of the Game* and in-game messages.

### 3.7 Controls

| Action | Keyboard | Gamepad | Touch |
| ------ | -------- | ------- | ----- |
| Move | `W` `A` `S` `D` / arrow keys | Left stick (dead zone 0.18) | On-screen stick |
| Sprint | `Shift` | RB / RT | Push the stick fully |
| Shoot (hold and release on the meter) | `Space` / `J` | X (button 2) | Shoot button |
| Pass | `K` / `E` | A (button 0) | Pass button |
| Skill move (hesi, spin, step-back, pump fake) | `L` / `Q` | B / Y | Skill button |
| Pause | `Escape` | Start | Pause button |

The HUD adapts to the last device used. A *left-handed* setting mirrors the touch controls.

The game does **not** lock orientation. In portrait it shows *"Rotate your phone to landscape for
the full-court view. Tap to dismiss."* It pauses itself on window blur, when the tab is hidden, and
when the host sends `pause`.

### 3.8 Settings

Defaults:

```js
{ quality: "auto", resolution: 1, shake: true, sfx: 0.9, crowd: 0.7, music: 0.45,
  vibration: true, hints: true, difficulty: "pro", leftHanded: false,
  commentary: 0.8, captions: true, camera: "broadcast" }
```

### 3.9 Rendering quality

`quality: "auto"` picks **low** when the device reports ≤ 2 GB memory or ≤ 3 CPU cores, **medium**
on touch devices, and **high** otherwise.

| Level | Pixel ratio (max) | Shadows | Shadow map | Crowd density | Bloom | Clearcoat | Post | AO | Reflections |
| ----- | ----------------- | ------- | ---------- | ------------- | ----- | --------- | ---- | -- | ----------- |
| low | 1 | off | 512 | 45 % | off | off | off | off | 0 |
| medium | 1.5 touch / 1.25 | on | 1024 | 75 % | off | off | on | off | 1 |
| high | 2 | on | 2048 | 100 % | on | on | on | on | 2 |

The pixel ratio is also multiplied by the *resolution* setting.

### 3.10 Athletes and levels of detail

Players are assembled from the streamed models in `assets/athletes-v2/` (body with build morphs,
head, eyes, hair, uniform, shoes and gear). There are three detail levels:

| Level | Used for |
| ----- | -------- |
| `lod1` | Low quality, and medium quality on touch devices |
| `lod0` | Everything else |
| `hero` | The featured player in close-ups: the intro, scoring replays and the game-over shot |

The loader uses Meshopt-compressed GLB and streams levels as they are needed. If a model fails to
load, the game falls back to a simpler built-in figure and keeps running.

### 3.11 Audio

The game has sound effects, crowd and music, each with its own volume, plus **commentary** (its own
volume) with optional on-screen **captions**. Music and crowd stop when the host disposes the game.

---

## 4. Bundle

`bundle/index.html` arrives prebuilt. In order:

| Block | Size | Role |
| ----- | ---- | ---- |
| `<style>` | ~810 KB | Tailwind CSS and embedded fonts (Barlow Condensed and others) |
| Host bridge | ~5 KB | Storage shim and messaging (§4.1) |
| `#statoz-engine-dependencies` | ~1 KB | JSON list of runtime files with SHA-256 and sizes |
| Import-map setup | <1 KB | Builds the import map for the engine (§4.2) |
| Game module | ~1.5 MB | React 19.3.1, Three.js r187 and the game (`type="module"`) |

### 4.1 Host bridge

This is the generic StatOz prelude, the same as in Cricketer, Penalty Cup and Longbow. It:

- **Replaces `window.localStorage`** with an in-memory store seeded from `__STATOZ_BOOT__.stores`.
  Every write posts a `save` to the host; writes over 512 KB throw `QuotaExceededError`.
- Installs `window.__STATOZ_HOST__` with `emit`, `save`, `command` and `result`.
- Accepts `pause` / `resume` / `dispose` from the parent after checking origin, `gameId` and
  `sessionId`.

There is no asset shim, so `fetch` is not wrapped. Athlete files are requested from
`./assets/athletes-v2/`, which resolves through the `<base href>` that `GameFrame` injects (§6.2)
to `/games/hoop-legacy/assets/athletes-v2/`.

### 4.2 Import map

The game module imports `@statoz/game-engine` and `@statoz/game-engine/audio`. A small script
builds the import map at runtime:

```js
base   = boot.assetRoot || "/games/hoop-legacy/"
prefix = new URL("../../", base).pathname           // "/" on the web
map    = { "@statoz/game-engine": prefix + "games/hoop-legacy/game-runtime/core-IYY2ZB6B.js", … }
```

The published release pointed at `/game-runtime/…`. When it was added here, every
`"/game-runtime/` URL in `bundle/index.html` (9 in total, in the import map and the dependency list)
was rewritten to `"/games/hoop-legacy/game-runtime/`. Nothing else in the file was changed.

### 4.3 Game module and host protocol

- **`ready`** is emitted once the 3D scene is built and running, not when the menu first paints.
  A headless test with software rendering took about 14 s; real GPUs are much faster.
- **`exit`** is emitted by *Back to Games* on the menu and in the pause menu.
- **`error`** is emitted on an uncaught failure.
- **`dispose`** from the host stops music and crowd audio, closes the audio context and unmounts
  the app.
- The game **does not emit `result`**. Game outcomes stay inside its own saves (§7).
- **Debug hook:** `window.__HOOP_LEGACY__(options?)` returns a snapshot: ready state, current
  screen and mode, athlete loading status, renderer stats (draw calls, textures, geometries),
  pause state, quality level and input state. With `{ geometry: true }` it also returns athlete
  bounds.

---

## 5. Engine runtime

`@statoz/game-engine`, API version **1**. The files are byte-identical to the copies used by
Cricketer, Formula, Penalty Cup and Longbow.

The bundle's `#statoz-engine-dependencies` lists each runtime file with SHA-256 and byte size, and
the build refuses to ship on any mismatch.

**CORS.** The iframe has an opaque origin, so both the module imports and the athlete downloads
are cross-origin. `next.config.ts` sends `Access-Control-Allow-Origin: *` on:

- `/games/hoop-legacy/game-runtime/:path*`
- `/games/hoop-legacy/assets/:path*`

Without the first, the game never reaches `ready`. Without the second, the athletes fail to load
(the browser console shows a CORS error for `assets/athletes-v2/manifest.json`).

---

## 6. Host

### 6.1 Route

`src/app/(game)/game/hoop-legacy/page.tsx` sits outside `(with-navbar)` so the game fills the
screen, and renders `<HoopLegacyGame>`. That passes a `useCallback`-stable exit handler to
`GameFrame`; an unstable one would reload the iframe on every render. Exit goes to `/`.

### 6.2 GameFrame

Shared by every bundled game (`src/games/shared/components/game-frame.tsx`). It fetches the bundle
and writes it into `srcdoc`, with this injected first in `<head>`:

```html
<base href="{entryRoot}"><script>window.__STATOZ_BOOT__ = {…};</script>
```

The `<base>` is what makes both the import map and the relative athlete URLs resolve, because a
`srcdoc` document's own base is `about:srcdoc`.

The frame is `sandbox="allow-scripts allow-pointer-lock"` (no `allow-same-origin`), so inbound
messages must have `origin === "null"` and match `protocolVersion`, `gameId` and `sessionId`.

| Direction   | Messages |
| ----------- | -------- |
| game → host | `ready`, `exit`, `error`, `save` |
| host → game | `pause` (tab hidden), `dispose` (unmount) |

Until `ready`, the host shows an "Opening your game…" overlay with a Back button; on `error` it
offers *Try again*.

### 6.3 Analytics

In production builds (`ENVIRONMENT=production`), `GameFrame` sends the gameplay events from
`docs/ga-events.md` §5 with `game_id: "hoop-legacy"`. These are `web_game_open`, `web_game_ready`
(with `load_ms`), `web_game_exit` (with `play_seconds`), `web_game_error`, `web_game_retry`,
`web_game_save_failed` and `web_game_pause`.

Because the game never emits `result`, there are **no `web_game_result` events** for Hoop Legacy.
Load time and play time are the only measures of play.

---

## 7. Progress

Progress lives only in the browser's `localStorage`. Nothing is sent to a server.

**The game's own keys**, inside the bundle's storage:

| Key | Holds |
| --- | ----- |
| `hoop-legacy:career:0`, `:1`, `:2` | One career per slot (`version: 1`): player, attributes, badges, look, coins, season, team, schedule, circuit, awards and messages |
| `hoop-legacy:settings` | The settings in §3.8 |
| `hoop-legacy:records` | `{ contestBest, quickWins, quickLosses }` |

Career slots that fail to parse, or have another `version`, show as empty. Deleting a career
removes its key.

**On the way out:**

```
game writes localStorage["hoop-legacy:career:0"]          (the shim, §4.1)
  → shim posts { type: "save", payload: { schemaVersion: 1, stores, resultIds } }
    → GameFrame validates source, origin, session, schema, size < 600 KB
      → real localStorage["games.bundle.hoop-legacy.guest"]
        → "hoop-legacy-save" event
```

**On the way in:** `GameFrame` reads `games.bundle.hoop-legacy.guest`, passes its `stores` in
`__STATOZ_BOOT__`, and the shim starts with them.

**Limits:**
- One browser and device only.
- Wiped by clearing site data, by private browsing, or by Safari's 7-day storage cleanup.
- Guest-only: no `account` is passed.
- Editable in DevTools.
- The shim caps all of the game's storage at 512 KB, and the host refuses saves over 600 KB. Three
  long careers share that budget.

---

## 8. Build

```bash
node src/games/hoop-legacy/scripts/build-hoop-legacy.mjs
```

1. Reads `bundle/index.html` and its `#statoz-engine-dependencies` list.
2. For each listed file, strips the served prefix `/games/hoop-legacy/` and checks
   `bundle/game-runtime/…` against the SHA-256 and byte size.
3. Reads `bundle/assets/athletes-v2/manifest.json` and checks every file it names that has a
   SHA-256 (78 references, some shared between levels).
4. Any mismatch stops the build. Otherwise it writes `public/games/hoop-legacy/index.html` and
   replaces `public/games/hoop-legacy/game-runtime/` and `public/games/hoop-legacy/assets/` with
   fresh copies.

Output:

```
hoop-legacy: 2.4 MiB
hoop-legacy: 6 runtime files verified and copied
hoop-legacy: 78 athlete assets verified and copied
```

---

## 9. Licensing and credits

| Item | Licence | Where it is credited |
| ---- | ------- | -------------------- |
| Athlete bodies, heads, eyes, proxies, skins, brows, lashes, afro hair cards | CC0 (derived from MakeHuman CC0 assets) | `assets/athletes-v2/LICENSES.txt` |
| Uniforms, footwear, strand hair and gear | CC0 (generated by the athlete tool) | `assets/athletes-v2/LICENSES.txt` |
| Three.js r187 | MIT | Licence comment inside the game module |
| React 19.3.1, scheduler | MIT | Licence comment inside the game module |
| Engine dependencies (three, pixi.js, Rapier 2D/3D) | MIT / Apache-2.0 | `game-runtime/LICENSES-….txt` |

Blender was an offline build tool, and no MakeHuman program code is shipped. Teams, players,
sponsors and the league are original and fictional.

---

## 10. Known gaps

| Gap | Detail |
| --- | ------ |
| Source not in the repo | Only the built bundle and athlete files are here. The source isn't in the local `statoz-next-games-web-pai` checkout either. |
| Hand-edited runtime URLs | A fresh export uses `/game-runtime/…`; re-apply the rewrite in §4.2 or the build stops. |
| Slow first load | `ready` waits for the full 3D scene. It is the slowest bundled game to open, and the host overlay stays up until then. |
| No `result` events | Outcomes never reach the host, so analytics has no `web_game_result` for Hoop Legacy. Adding them needs a change in the source project. |
| Screen wake lock | The game asks to keep the screen awake. The iframe's `allow` list has no `screen-wake-lock`, so this logs a console warning. Adding it to `GameFrame` would affect every game. |
| Storage budget | All three career slots plus settings must fit in 512 KB (§7). |
| Duplicated runtime | Five games ship identical copies of `game-runtime/`. |
| Guest-only progress | Nothing passes `account`. Wire the auth session into `<HoopLegacyGame account=…>`. |
| Host overlay styling | `game-frame.module.css` uses Mini Golf's green palette. |
| Lint error | `game-frame.tsx` assigns `exit.current` during render (`react-hooks/refs`). |
| Generated files in `public/` | `public/games/hoop-legacy/**` (about 16 MB) is build output and is not gitignored. |

---

## 11. Common tasks

| Task | How |
| ---- | --- |
| Ship a new game build | Download the release and its `assets/athletes-v2/` files from the catalogue, check the SHA-256s, replace `bundle/`, re-apply the runtime URLs (§4.2), run the build |
| Update only the athletes | Replace `bundle/assets/athletes-v2/` (manifest and files together) and run the build; it checks every hash |
| Move the files | Change the URLs in `bundle/index.html`, `SERVED_PREFIX` and the copy targets in the build, and both CORS rules in `next.config.ts` |
| Change the catalogue card | `src/config/sports.ts`: cover, spotlight, video, `href: "/game/hoop-legacy"` |
| Inspect a session | `window.__HOOP_LEGACY__()` inside the frame |

Any change under `bundle/` needs `node src/games/hoop-legacy/scripts/build-hoop-legacy.mjs` before
it shows up: the served files are copies.
