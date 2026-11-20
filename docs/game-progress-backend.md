# Game progress backend

How to save every game's progress on a server for each logged-in player, so it follows them across devices and survives a cleared browser.

This covers the data model, the per-game API, how the website syncs saves, moving guest progress to an account, and what each of the 14 games actually saves. It is based on reading the current code and every game bundle on 19 November 2026.

Rewarding XP for wins is in its own document, [xp-rewards.md](xp-rewards.md). It builds on the results endpoints here.

## 1. How saving works today

Nothing is sent to a server. Everything lives in the browser's `localStorage`.

```
 Game (sandboxed iframe)                 Website (GameFrame)                      Browser storage
 ───────────────────────                 ───────────────────                      ───────────────
 game calls localStorage.setItem(k, v)
   └─ bridge shim keeps it in `stores`
   └─ posts {type:"save", payload:envelope} ──►  checks source, session, size
                                                 writes the whole envelope  ──────►  games.bundle.<bundleId>.<account>
 game finishes a match
   └─ posts {type:"result", payload} ──────────►  sends web_game_result to GA (only this, today)
```

Key facts the backend has to fit:

1. **One save per game per player, called the envelope.** [`game-frame.tsx`](../src/games/shared/components/game-frame.tsx) stores it under `games.bundle.<bundleId>.<account or "guest">`:

   ```json
   {
     "schemaVersion": 1,
     "stores": { "longbow.progress.v1": "{\"schemaVersion\":1,\"stars\":{...}}" },
     "resultIds": ["4f1c…", "9a2e…"]
   }
   ```

   - `stores` is the game's whole `localStorage`, captured by a bridge script inside the game. Keys and values are both **strings**. Values are usually JSON that the game encoded itself.
   - `resultIds` lists the results already reported, so a game never reports the same match twice. Most bridges keep the last 1,000.
2. **Games never reach the website's storage or the network.** The iframe is sandboxed with a null origin. Only the website (`GameFrame`) can read or write saves, so only the website talks to the backend. Games need no changes.
3. **Games save on every change.** Each `localStorage.setItem` inside a game posts a full new envelope, which can be many times a minute during play. The backend must not receive one request per save (see §6).
4. **There's a size cap.** Each game's bridge rejects a save over 524,288 characters (512 KB) with a `QuotaExceededError`, and `GameFrame` ignores envelopes over 600,000 characters. The server should accept up to 600,000.
5. **Results are separate from saves.** A `result` message carries one finished match with a stable `id` (see §9 for each game's payload). Ten of the games' bridges also copy the last 20 results into `stores["statoz.bundle.results"]`.
6. **Logged-in accounts aren't connected yet.** `GameFrame` takes an `account` prop, but every game page passes nothing, so every player is `guest`. Connecting the logged-in user is step 1 of this work (§11).
7. **The bundle id is not always the catalogue id.** The storage key uses the id the game was built with:

   | Catalogue id (site, analytics) | Bundle id (storage key, messages) |
   |---|---|
   | `formula` | `portfolio-formula` |
   | `rally-dash` | `grand-prix-dash` |
   | `racer` | `f1-racing` |
   | every other game | same as the catalogue id |

## 2. Design principles

1. **Each game has its own endpoints and its own module, but the save is stored whole.** The shared code accepts or rejects a save by the envelope's outer shape and size only (§10.1). The game's module then reads the inside to work out progress, and checks results (§5.1). If a game release changes its format, saving keeps working and only the progress figures wait for a module update.
2. **Offline first.** The browser copy stays the working copy. Play never waits on the network after a game has opened, and nothing is lost if a request fails; it syncs later.
3. **One save per player per game, with a revision number.** The server tracks which version it holds, so two devices can't silently overwrite each other (§6.4).
4. **Never delete progress outright.** Overwrites, conflicts, resets and imports all keep the previous copy in a version history (§4).
5. **Results are append-only and idempotent.** The same result sent twice is stored once, using the game's own result id.
6. **Treat everything a game reports as untrusted.** It comes from the player's browser and can be edited. Nothing that costs real money or ranks players publicly should rely on it without server-side checks (§10).

## 3. Architecture

```
┌──────────── browser ────────────┐        ┌──────────── server ────────────┐
│ Game iframe                     │        │                                │
│   ⇅ postMessage (protocol v1)   │        │  /v1/me/games/<game-id>/… (§5) │
│ GameFrame                       │        │    shared: auth, size, shape,  │
│   ⇅                             │ HTTPS  │    revisions, idempotency      │
│ Progress sync client (new, §6)  │ ─────► │           │                    │
│   - local cache (localStorage)  │        │  Game modules (§5.1), one each │
│   - debounced push, retry queue │        │    progress(), parseResult()   │
└─────────────────────────────────┘        │           │                    │
                                           │  Database (§4)                 │
                                           │    game_saves                  │
                                           │    game_save_versions          │
                                           │    game_results                │
                                           │    xp tables (xp-rewards.md)   │
                                           └────────────────────────────────┘
```

The sync client is a small module in the website, for example `src/lib/progress/`. `GameFrame` calls it to load a save before starting a game, and to hand over each new save.

## 4. Data model

PostgreSQL is used as the reference here. Any relational database works the same way. Assumes an existing `users` table with a stable `id`.

```sql
-- One row per catalogue game. Maps the site's id to the id the bundle saves under.
create table games (
  id            text primary key,          -- 'racer'
  bundle_id     text not null unique,      -- 'f1-racing'
  title         text not null,
  save_enabled  boolean not null default true
);

-- The current save: one row per player per game.
create table game_saves (
  user_id            uuid not null references users(id) on delete cascade,
  game_id            text not null references games(id),
  revision           bigint not null,      -- +1 on every accepted write
  envelope           jsonb not null,       -- {schemaVersion, stores, resultIds}, as sent
  size_chars         integer not null,     -- length of the JSON as received
  device_id          text,                 -- random id per browser, for debugging conflicts
  client_updated_at  timestamptz,          -- when the browser last changed it
  progress           jsonb,                -- the game module's progress(), null if unreadable
  progress_version   integer,              -- module version that wrote it, to recompute after updates
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Every save that was replaced, so progress can always be recovered.
create table game_save_versions (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  game_id     text not null references games(id),
  revision    bigint not null,             -- the revision this copy had
  envelope    jsonb not null,
  reason      text not null check (reason in
                ('replaced', 'conflict', 'reset', 'guest_import', 'incompatible')),
  created_at  timestamptz not null default now()
);
create index game_save_versions_lookup on game_save_versions (user_id, game_id, created_at desc);

-- One row per finished match. Primary key = idempotency.
create table game_results (
  user_id      uuid not null references users(id) on delete cascade,
  game_id      text not null references games(id),
  result_id    text not null,              -- the game's payload.id
  payload      jsonb not null,             -- as sent, after size check
  mode         text,                       -- from the module's parseResult()
  won          boolean,                    -- the game's own win rule (§9)
  score        integer,
  details      jsonb,                      -- the module's other checked fields
  played_at    timestamptz,                -- the client's clock
  received_at  timestamptz not null default now(),
  primary key (user_id, game_id, result_id)
);
create index game_results_recent on game_results (user_id, game_id, received_at desc);
```

Notes:
- **Envelope storage:** store it as `jsonb`, but don't parse or index `stores` values; they're strings. `bytea` with gzip is fine too, since saves compress well. JSON also makes support and debugging easier.
- **Version history size:** keep the last 20 versions per player per game, plus every `conflict`, `guest_import` and `incompatible` version for 90 days. Prune with a nightly job.
- **Seed `games`** from the game modules (§5.1), which hold the catalogue id and bundle id. The website already has the same mapping in each game component (`gameId` and `analyticsId`).
- **Recomputing progress:** when a module's `progress()` changes, bump its version and run a job over the saves with an older `progress_version`.

## 5. API

Every game has its own set of endpoints under `/v1/me/games/<game-id>/`, for example `/v1/me/games/longbow/save`. Each set is served by that game's own module (§5.1), so each game decides what it accepts and what it reports back.

All endpoints act on the logged-in user. The user id **always** comes from the session or token, never from the URL or body. Responses are JSON. The id in the URL is the **catalogue** id (`racer`, not `f1-racing`).

### 5.1 One module per game

The server has one small module per game, for example `server/games/longbow.ts`. The routes are registered from these modules, so a game with no module has no endpoints, and an endpoint a game doesn't support returns `404`.

```ts
type GameModule<Progress> = {
  id: string;               // catalogue id: "racer"
  bundleId: string;         // id the bundle saves under: "f1-racing"
  saves: boolean;           // false: no save endpoints (Vibe Basketball)
  /** Reads the game's stores into its profile figures. Returns null if it can't. */
  progress(stores: Record<string, string>): Progress | null;
  /** Checks one result payload. Absent: the game sends no results, so no results endpoint. */
  parseResult?(payload: unknown): ParsedResult | { error: string };
};

type ParsedResult = {
  mode: string | null;
  won: boolean | null;      // the game's own rule for a win, in §9
  score: number | null;
  details: Record<string, string | number | boolean | null>;  // the game's other checked fields
};
```

What a module may and may not do:
- **It never rejects a save because of the game's inner data.** The envelope checks in §10.1 decide whether a save is accepted. `progress()` runs after the save is stored. If it throws or returns `null`, for example after a game release changed its format, the save is kept and `progress` is stored as `null` until the module is updated. A game update can therefore never lose a player's progress.
- **It does check results.** `parseResult()` rejects a payload with missing or impossible values, like `stars: 7` or `position: 0`. A rejected result is reported under `rejected` and gives no XP.
- **It's the only place that knows the game's format.** Profile pages, XP rules ([xp-rewards.md](xp-rewards.md)) and support tools all go through it.

Shared code handles everything the endpoints have in common: authentication, revisions, version history, size limits, idempotency and rate limits. A game module is usually under 100 lines.

### 5.2 Endpoints for each game

| Game | Save | Results | Progress |
|---|---|---|---|
| Penalty Cup | `/v1/me/games/penalty-cup/save` | `/v1/me/games/penalty-cup/results` | `/v1/me/games/penalty-cup/progress` |
| Hoop Legacy | `/v1/me/games/hoop-legacy/save` | none | `/v1/me/games/hoop-legacy/progress` |
| Formula | `/v1/me/games/formula/save` | `/v1/me/games/formula/results` | `/v1/me/games/formula/progress` |
| Cricketer | `/v1/me/games/cricketer/save` | `/v1/me/games/cricketer/results` | `/v1/me/games/cricketer/progress` |
| Mini Golf | `/v1/me/games/mini-golf/save` | none | `/v1/me/games/mini-golf/progress` |
| 5v5 Football Chess | `/v1/me/games/football-chess/save` | none | `/v1/me/games/football-chess/progress` |
| Rally Dash | `/v1/me/games/rally-dash/save` | none | `/v1/me/games/rally-dash/progress` |
| Pitch Rush | `/v1/me/games/pitch-rush/save` | none | `/v1/me/games/pitch-rush/progress` |
| Yorker | `/v1/me/games/yorker/save` | `/v1/me/games/yorker/results` | `/v1/me/games/yorker/progress` |
| Rim Rush | `/v1/me/games/rim-rush/save` | `/v1/me/games/rim-rush/results` | `/v1/me/games/rim-rush/progress` |
| Vibe Basketball | none | none | none |
| Racer | `/v1/me/games/racer/save` | `/v1/me/games/racer/results` | `/v1/me/games/racer/progress` |
| Longbow | `/v1/me/games/longbow/save` | `/v1/me/games/longbow/results` | `/v1/me/games/longbow/progress` |
| Holdover | `/v1/me/games/holdover/save` | none | `/v1/me/games/holdover/progress` |

Each **save** URL takes `GET`, `PUT` and `DELETE`, plus `POST` on `save/versions` (§5.4–5.7). Each **results** URL takes `POST` and `GET` (§5.8–5.9). Each **progress** URL takes `GET` (§5.10). "None" means the route doesn't exist and returns `404`.

A game that starts sending results, like the seven listed as "none", gets a results endpoint by adding `parseResult()` to its module. Nothing else changes.

### 5.3 List games

`GET /v1/me/games`

This lists every game the player has a save for, with its progress but not its save. Profile pages use it, and so does the website at login to decide what to sync.

```json
200
{ "games": [
  { "gameId": "longbow", "revision": 14, "sizeChars": 2311, "updatedAt": "2026-11-19T10:42:07Z",
    "progress": { "careerStars": 14, "rivalsBeaten": 3 } },
  { "gameId": "racer", "revision": 3, "sizeChars": 958, "updatedAt": "2026-11-18T21:05:44Z",
    "progress": { "careerStars": 9, "racesFinished": 11, "quickRaceWins": 2 } }
] }
```

### 5.4 Read a save

`GET /v1/me/games/{gameId}/save`

```json
200   ETag: "14"
{ "gameId": "longbow", "revision": 14, "updatedAt": "2026-11-19T10:42:07Z",
  "envelope": { "schemaVersion": 1, "stores": { "longbow.progress.v1": "{…}" }, "resultIds": ["…"] } }
```

`404` means there's no save yet, which is normal for a game never played on this account.

### 5.5 Write a save

`PUT /v1/me/games/{gameId}/save` with `If-Match: "<revision the client started from>"`, or `If-None-Match: *` when creating the first save.

```json
{ "envelope": { "schemaVersion": 1, "stores": { … }, "resultIds": [ … ] },
  "clientUpdatedAt": "2026-11-19T10:43:30Z",
  "deviceId": "b1d0…" }
```

| Response | When | Body |
|---|---|---|
| `200` | Accepted. The old copy is kept in `game_save_versions` (reason `replaced`). Then the module's `progress()` runs, and any milestone XP is awarded ([xp-rewards.md](xp-rewards.md) §4.2). | `{ "revision": 15, "updatedAt": "…", "progress": {…} }`, plus `awards` and `xp` when XP was given |
| `409` | The server copy changed since the client's base revision: another device saved. | `{ "current": { "revision": 16, "envelope": {…}, "updatedAt": "…" } }` |
| `413` | Envelope over 600,000 characters | |
| `422` | Envelope shape invalid (§10.1) | `{ "error": "…" }` |
| `428` | `If-Match` missing | |

### 5.6 Reset a save

`DELETE /v1/me/games/{gameId}/save` with `If-Match: "<revision>"`

This moves the save into `game_save_versions` (reason `reset`) and removes the current row. It's used when a player starts over, including the website's existing **Start fresh** button for incompatible saves; that one uses reason `incompatible` via `?reason=incompatible`.

### 5.7 Keep a copy without replacing the save

`POST /v1/me/games/{gameId}/save/versions`

```json
{ "envelope": { … }, "reason": "conflict", "baseRevision": 14, "deviceId": "b1d0…" }
```

This adds the envelope to `game_save_versions` without touching the current save. It's used for the losing copy in a conflict (§6.4) and for guest progress when the account already has a save (§7). `reason` must be `conflict` or `guest_import`. The size and shape checks in §10.1 apply.

### 5.8 Report results

`POST /v1/me/games/{gameId}/results` takes a batch of up to 50 results for that game.

```json
{ "results": [
  { "resultId": "r-8c1e…", "playedAt": "2026-11-19T10:41:58Z",
    "payload": { "id": "r-8c1e…", "game": "longbow", "mode": "career", "challengeId": "level-3",
                 "score": 54, "rivalScore": null, "stars": 2, "won": true } }
] }
```

Each result goes through the module's `parseResult()`, then is stored, then XP is awarded in the same transaction ([xp-rewards.md](xp-rewards.md)):

```json
200
{ "accepted": [{ "resultId": "r-8c1e…", "won": true, "xp": 45 }],
  "duplicates": [],
  "rejected": [],
  "xp": { "total": 1040, "level": 5 } }
```

A result already stored is reported under `duplicates` and gives no XP again, so retrying is always safe. A rejected result is listed as `{ "resultId": "…", "error": "stars must be 0–3" }`.

### 5.9 Read results

`GET /v1/me/games/{gameId}/results?limit=50&before=<cursor>`

This returns the player's match history for that game, newest first, with the checked fields from `parseResult()` and the XP each match earned.

### 5.10 Read progress

`GET /v1/me/games/{gameId}/progress`

This returns that game's profile figures, worked out by its module when the save was last written. Each game's shape is listed in §9.

```json
200
{ "gameId": "racer", "updatedAt": "2026-11-18T21:05:44Z",
  "progress": { "careerStars": 9, "racesFinished": 11, "quickRaceWins": 2 } }
```

`progress` is `null` when the module couldn't read the save (§5.1). `404` means there's no save.

### 5.11 Export and delete

- `GET /v1/me/game-data/export`: every save, version, result and XP event for the player as one JSON file, to meet data-access requests.
- Account deletion: `on delete cascade` removes everything. Nothing about a player's games outlives the account.

## 6. How the website syncs

### 6.1 Local storage keys

| Key | Holds |
|---|---|
| `games.bundle.<bundleId>.<accountId>` | The working envelope. Same key and format as today, with the account id in place of `guest`. |
| `games.sync.<bundleId>.<accountId>` | `{ "baseRevision": 14, "dirty": true, "changedAt": "…" }`. `baseRevision` is the server revision this copy was built on. `dirty` means there are changes not yet uploaded. |
| `games.results.queue.<accountId>` | Results waiting to upload, up to 200. |

Guests keep today's `games.bundle.<bundleId>.guest` and never sync.

### 6.2 Opening a game

`GameFrame` already fetches the game's HTML before starting it, so the save is loaded at the same time with no added wait:

1. Read the local envelope and sync record.
2. `GET /v1/me/games/{gameId}/save` with a **3-second timeout**.
3. Choose the save to start with:

   | Local | Server | Start with | Then |
   |---|---|---|---|
   | none | none | empty save | nothing |
   | none or clean | exists | server copy | write it locally, `baseRevision` = server revision |
   | dirty, `baseRevision` = server revision | exists | local copy | upload it (§6.3) |
   | dirty, `baseRevision` < server revision | exists | **server copy** | upload the local copy as a `conflict` version (§6.4) |
   | dirty | none (404) | local copy | create it on the server |
   | any | request failed or timed out | local copy | stay dirty, retry later |

4. Boot the game with the chosen envelope's `stores` and `resultIds`, exactly as today.

### 6.3 Saving while playing

1. **Every `save` message:** write the envelope to `localStorage` immediately, as today, and mark the sync record `dirty`.
2. **Upload with a debounce:** send `PUT /v1/me/games/{gameId}/save` 3 seconds after the last save, and at most every 30 seconds during constant saving. One request at a time per game; if more saves arrive during a request, send once more after it finishes.
3. **Flush early:** send any pending upload when the game exits, when the player presses Back, and when the tab becomes hidden (`visibilitychange`).
4. **Don't rely on `pagehide`:** browsers cap requests sent while a page closes (`fetch` with `keepalive`, or `sendBeacon`) at 64 KB in total, and many saves are bigger. Uploading on `visibilitychange` covers most closes. Anything still `dirty` uploads the next time the player opens the game.
5. **On failure:** keep `dirty`, retry with backoff (5 s, 15 s, 60 s, then on the next game open). Never block play.

### 6.4 When two devices disagree

A `409` means another device saved after this one loaded. The rule is **the server copy wins, and the local copy is kept as a version**:

1. Upload the local envelope as a `conflict` version (§5.7).
2. Take the server copy from the `409` response, store it locally, and set `baseRevision` to its revision.
3. If the game is still open, show the existing notice bar: "This game was saved on another device. Reopen it to continue from there." Then reload the game on the next open, not mid-match.

Merging two saves isn't possible in general: the backend can't understand each game's format, and some saves hold a match in progress. Keeping both copies means a support tool can always restore the other one.

### 6.5 Results

1. On a `result` message, add `{gameId, resultId, playedAt, payload}` to the results queue, unless that `resultId` is already queued.
2. Upload the queue in batches to each game's own `POST /v1/me/games/{gameId}/results`: right away if online, otherwise on the next game open or login.
3. Drop entries the server reports as `accepted` or `duplicates`. Keep `rejected` ones out of the queue and log them.
4. Show the XP from `accepted` to the player (see [xp-rewards.md](xp-rewards.md)).

The game's `resultIds` already prevent the same match being reported twice from one save. The `result_id` primary key covers retries and multiple devices.

## 7. Logging in, logging out and guests

**At login,** for each game with a guest save on this device (`games.bundle.<bundleId>.guest`):

| Server save for that game | Action |
|---|---|
| none | Upload the guest save as the account's first save (reason `guest_import`), then remove the guest copy |
| exists | Keep the server save. Upload the guest save as a `guest_import` version (§5.7), then remove the guest copy. |

Doing this automatically never loses anything, because the guest save is always kept on the server. A friendlier option is to ask: "You have Longbow progress from playing as a guest. Keep your account progress, or replace it with this device's progress?" That's an open decision (§13).

**At logout,** upload anything `dirty`, then remove `games.bundle.*.<accountId>`, `games.sync.*` and the results queue for that account. This stops the next person on a shared device from reading it. After logout the player is a guest again.

**On another device,** nothing special happens: opening a game downloads its save (§6.2).

## 8. Changes to the website

| Change | File |
|---|---|
| Pass the logged-in user's id as `account` to every game | the 14 `src/games/*/components/*-game.tsx` files, from the auth session |
| Load the save through the sync client before starting the game, instead of reading `localStorage` directly | [`game-frame.tsx`](../src/games/shared/components/game-frame.tsx) |
| Hand each `save` and `result` message to the sync client | `game-frame.tsx` |
| Flush on exit, Back and tab hidden | `game-frame.tsx` (the handlers already exist) |
| Sync client: cache, debounce, retry, results queue, conflicts | new `src/lib/progress/` |
| Guest import at login, cleanup at logout | wherever login and logout are handled |
| Show XP earned after a win, and the player's level | `game-frame.tsx` notice bar, and the profile page ([xp-rewards.md](xp-rewards.md) §7) |
| Analytics (optional): `web_game_sync_failed` and `web_game_save_conflict` with `game_id` | `docs/ga-events.md`, plus the GTM setup |

Two details to keep:
- **Penalty Cup:** keep its inner key unchanged. It saves under `penalty-cup.v1.<storageScope>`, with the scope from `__STATOZ_BOOT__.storageScope`. `GameFrame` doesn't send a scope, so it's always `penalty-cup.v1.guest`. Don't start sending `storageScope` when accounts arrive: the account is already in the outer key, and changing the inner key would make existing progress look lost.
- **Storage limits:** the existing behaviour when storage is blocked (the game plays, unsaved, with a notice) still applies. A logged-in player with storage blocked can still sync, so the notice can say progress saves to the account but not to this device.

## 9. What each game saves

For each game: its store keys and what they hold, whether a match in progress is saved (so it can be resumed mid-match), its result payload and what counts as a win, and what its `progress` endpoint returns. This is what each game's module (§5.1) implements.

Fields are taken from each game's default save in its bundle. A trailing `{…}` means a map the game fills during play. Every field's exact type and limits are in [game-data-models.md](game-data-models.md).

### Penalty Cup (`penalty-cup`)

| Store key | Holds |
|---|---|
| `penalty-cup.v1.guest` | `{version: 2, revision, active, history[]}`: the cup run in progress (group stage through final) and past cups with their status (`champion`, `runner-up`, `eliminated`…) |
| `penalty-cup.settings.v1` | `{effects, crowd, music, muted, reducedMotion}` |
| `statoz.bundle.results` | last 20 results (bridge copy) |

- **Match in progress:** yes. The game checks a saved match's seed, level and kick list (up to 500 kicks), so it can resume one.
- **Result:**
  - Random matches: `{id, mode: "random", outcome, score: [player, opponent]}`.
  - Cups: `{id, mode: "cup", team, outcome: <cup status>}`.
- **Win:** a random match with `outcome: "win"`, or a cup with `outcome: "champion"`. Matches played inside a cup send no result of their own; the cup sends one when it ends.
- **Progress:** `{ cupsPlayed, cupsWon, bestFinish, activeCup: { team, stage } | null }`

### Hoop Legacy (`hoop-legacy`)

| Store key | Holds |
|---|---|
| `hoop-legacy:career:0`, `:1`, `:2` | Three career slots. Each is `{version: 1, slot, createdAt, updatedAt, player, level, xp, sp, coins, followers, chapter, difficulty, blacktop{ladder, beaten}, circuit{recruits, teammates, bracket, runs}, combine{…}, pro, stats{career, season, log, highs}, trophies[], inbox[], inventory{…}, legacy, endorsements[], hallOfFame}`. `player` holds the build: the first and last name the player typed, position, height, attributes, badges, appearance, archetype. |
| `hoop-legacy:settings` | graphics and sound settings |
| `hoop-legacy:records` | `{contestBest, quickWins, quickLosses}` |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** no.
- **Result:** none; this game never sends `result`.
- **Win:** not reported, because the game sends no results. [xp-rewards.md](xp-rewards.md) §4 covers XP for it.
- **Progress:** `{ slots: [{ slot, level, chapter, legacy, hallOfFame }], contestBest, quickWins, quickLosses }`. The game's own `xp` stays inside the game and is not site XP.
- **Size:** the biggest save of all. `stats.log` and `inbox` grow with play, so watch it against the 512 KB cap.

### Formula (`formula`, bundle `portfolio-formula`)

| Store key | Holds |
|---|---|
| `statoz.portfolio-formula.career.v1` | `{version: 1, serial, unlockedTier (0–3: Rookie, Club, Pro, Champion), best[4], active}` |
| `statoz.portfolio-formula.career.v1.backup` | the game's own backup of the career |
| `statoz.portfolio-formula.records.v2` | `{version: 2, circuits{<circuit>: {<car>: {lap, races{"1","3","5"}}}}}`: best lap and best race time for each circuit, car and lap count |
| `statoz.portfolio-formula.settings.v1` | `{circuit, paint, laps, difficulty, sound, autoThrottle, camera, racingLine}` |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** `active` holds the current career event.
- **Result:** `{id, carId, position, time, laps, bestLap, mode, circuit, careerEventId}`.
- **Win:** `position: 1`.
- **Progress:** `{ unlockedTier, tierName, bestFinishPerTier: [1, 3, null, null], bestLaps: { <circuit>: <lap> } }`

### Cricketer (`cricketer`)

| Store key | Holds |
|---|---|
| `cricketer.progress.v1` | `{schemaVersion: 1, lessons[], unlocked, best{…}, sound, reducedMotion, checkpoint, resultId}`: lessons done, chases unlocked, best score per challenge |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** `checkpoint` resumes an unfinished chase.
- **Result:** `{id, game, challengeId, score, target, balls, won}`.
- **Win:** `won: true`.
- **Progress:** `{ lessonsDone, challengesUnlocked, bestScores: { <challengeId>: <score> } }`

### Mini Golf (`mini-golf`)

| Store key | Holds |
|---|---|
| `mini-golf.storage` | The engine's own `storage.json`, as text. Holds `stroke_count_level_0` to `stroke_count_level_19` (best strokes per hole) and engine settings. |

- **Match in progress:** no.
- **Result:** none.
- **Win:** not reported, because the game sends no results. [xp-rewards.md](xp-rewards.md) §4 covers XP for it.
- **Progress:** `{ holesCleared, holes: 20, totalStrokes, aces, nextHole }`. [`progress.ts`](../src/games/mini-golf/components/progress.ts) already works these out from the save, and its `parseMiniGolfProgress` can be reused as the module's `progress()`.

### 5v5 Football Chess (`football-chess`)

| Store key | Holds |
|---|---|
| `statoz.next.games.football-chess.v2` | `{version: 2, revision, settings{sound, evalBar}, tutorial, record{played, wins, draws, losses, goalsFor, goalsAgainst, currentStreak, bestStreak}, byMode{quick}, quick{difficulty, formation, length}, history[], settled[], migratedFrom}` |
| `statoz.next.games.footballchess.v1` | older format, read once and migrated |
| `statoz.next.games.economy.v1` | `{version: 1, coins, owned{…}, equipped{…}}`: coins and collectables, starting at 1,000 coins |
| `statoz.next.games.decks.v2` (and `v1`, `packs.v1`) | squads and card packs |

- **Match in progress:** no.
- **Result:** none.
- **Win:** not reported, because the game sends no results. [xp-rewards.md](xp-rewards.md) §4 covers XP for it.
- **Progress:** `{ played, wins, draws, losses, currentStreak, bestStreak }`
- **Coins are game-local.** The economy and deck keys come from the original StatOz platform code built into this game. Inside the sandbox they're **this game's private copy**, not a site-wide wallet. Don't treat these coins as real currency (§10.3).

### Rally Dash (`rally-dash`, bundle `grand-prix-dash`)

| Store key | Holds |
|---|---|
| `statoz.next.games.rally-dash.v1` | `{version: 1, mode, stage, crew, rivals, laps, autoThrottle, brakeAssist, noteSounds, vibration, camera, engineVolume, effectsVolume, muted, touchSize, touchOpacity}`, plus records for each stage, kept separately for auto or manual throttle and brake assist on or off (best time and a gold, silver or bronze medal) |

- **Match in progress:** no.
- **Result:** none.
- **Win:** not reported, because the game sends no results. [xp-rewards.md](xp-rewards.md) §4 covers XP for it.
- **Progress:** `{ medals: { gold, silver, bronze }, stagesWithMedal }`, counting each stage's best medal once

### Pitch Rush (`pitch-rush`)

| Store key | Holds |
|---|---|
| `statoz.pitch-rush.progress.v1` | `{version: 1, tutorial{status, completed[]}, career, activeMatch}`: tutorial drills, the career (club, divisions, season) and a match in progress |
| `statoz.pitch-rush.progress.v1.backup` | the game's own backup |
| `websoccer.highscores.v1` | local high-score table |
| `websoccer.name` | the **3-letter initials the player typed** for high scores |
| `websoccer.lineup.0` and `.1`, `websoccer.music`, `websoccer.commentary`, `websoccer.bindings` | lineups, audio and key bindings |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** yes, `activeMatch` (the full match state).
- **Result:** none.
- **Win:** not reported, because the game sends no results. [xp-rewards.md](xp-rewards.md) §4 covers XP for it.
- **Progress:** `{ tutorialDone, division, season, trophies, champion }`
- **Privacy:** `websoccer.name` holds initials the player typed (§10.4).

### Yorker (`yorker`)

| Store key | Holds |
|---|---|
| `yorker.progress.v1` | `{schemaVersion: 1, spells{…}, lessons[], unlocked, bowler ("pace" or "spin"), sound, reducedMotion, assist, checkpoint, resultId, stats{balls, wickets, runs, fastest, perfect}}`. `spells` holds the result of each spell played, and `lessons` covers the Academy. |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** `checkpoint`.
- **Result:** `{id, game, challengeId, won, stars, runs, wickets, balls}`.
- **Win:** `won: true`.
- **Progress:** `{ stars, maxStars: 36, lessonsDone, lessons: 5, wickets }`. The game's menu shows the same stars as "Browse spells 0/36 ★".

### Rim Rush (`rim-rush`)

| Store key | Holds |
|---|---|
| `rim-rush.progress.v1` | `{schemaVersion: 1, coins, owned{outfits[], balls[]}, outfit, ball, cups{…}, rivals{…}, best, totals{makes, swishes, banks, blocks}, sound, reducedMotion, resultId}` |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** no.
- **Result:** `{id, game, mode, rival, court, cup, round, score, rivalScore, won, tied, coins}`.
- **Win:** `won: true` and `tied: false`.
- **Progress:** `{ cupsWon, rivalsBeaten, best, itemsOwned }`
- **Coins:** earned and spent inside the game only (§10.3).

### Vibe Basketball (`vibe-basketball`)

Nothing. The game never uses storage, so there's no save to sync, and it sends no results either. Its module has `saves: false`, so it has no endpoints (§5.2) until a release adds saves or results.

### Racer (`racer`, bundle `f1-racing`)

| Store key | Holds |
|---|---|
| `racer.career.progress.v1` | `{schemaVersion: 1, records{<stageId>: {stars, …}}, selected}`: 12 career races (`race-1` to `race-12`), up to 3 stars each, each unlocked by starring the one before |
| `racer.silverstone.progress.v1` | `{schemaVersion: 1, best, races, wins}`: quick races |
| `racer.settings.v1` | `{schemaVersion: 1, sound, reducedShake, difficulty, chassis}` |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** no.
- **Result:** `{id, game, mode, circuit, difficulty, position, time, laps, contacts, overtakes, stageId?, stars?}`.
- **Win:** `position: 1`.
- **Progress:** `{ careerStars, maxStars: 36, racesFinished, quickRaceWins, quickRaceBest }`

### Longbow (`longbow`)

| Store key | Holds |
|---|---|
| `longbow.progress.v1` | `{schemaVersion: 1, stars{…}, best{…}, rivals{…}, sound, reducedMotion, checkpoint, resultId}`: stars and best score per career level, and rivals beaten |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** `checkpoint`, which includes the arrows shot so far.
- **Result:** `{id, game, mode, challengeId, score, rivalScore, stars, won}`.
- **Win:** `won: true`.
- **Progress:** `{ careerStars, rivalsBeaten }`

### Holdover (`holdover`)

| Store key | Holds |
|---|---|
| `holdover.profile.v1` | `{version: 1, callsign, xp, missions{…}, stats{kills, headshots, shotsFired, shotsHit, longestShot, missionsCompleted, duelMatches, duelWins, duelLosses, duelRoundsWon, duelRoundsLost, duelStreak, bestDuelStreak, playSeconds}, loadout{rifle, camo, reticle}, settings{…}, duel{arena, difficulty, rounds}, createdAt}` |
| `holdover.hud.details` | a HUD display preference |
| `statoz.bundle.results` | last 20 results |

- **Match in progress:** no.
- **Result:** none.
- **Win:** not reported, because the game sends no results. [xp-rewards.md](xp-rewards.md) §4 covers XP for it.
- **Progress:** `{ rank, operationsCompleted, operations: 8, duelWins, duelLosses, bestDuelStreak }`. Rank comes from the game's own `xp`, which is not site XP. Leave `callsign` out (§10.4).
- **Privacy:** `callsign` defaults to "Ghost-6", and the player can change it (§10.4).

### Summary

| Game | Saves | Mid-match resume | Sends results | Bridge copies results into save |
|---|---|---|---|---|
| Penalty Cup | yes | yes | yes | yes |
| Hoop Legacy | yes (3 slots) | no | no | yes |
| Formula | yes | yes (`active`) | yes | yes |
| Cricketer | yes | yes | yes | yes |
| Mini Golf | yes | no | no | no |
| Football Chess | yes | no | no | no |
| Rally Dash | yes | no | no | no |
| Pitch Rush | yes | yes | no | yes |
| Yorker | yes | yes | yes | yes |
| Rim Rush | yes | no | yes | yes |
| Vibe Basketball | **no** | — | no | no |
| Racer | yes | no | yes | yes |
| Longbow | yes | yes | yes | yes |
| Holdover | yes | no | no | yes |

## 10. Validation, limits and security

### 10.1 Envelope checks on `PUT`

Reject with `422` unless the envelope:
- is an object with `schemaVersion === 1`
- has `stores`: an object of string keys to string values, at most 500 keys, each key at most 200 characters
- has `resultIds`: an array of at most 1,000 strings, each at most 200 characters
- is at most 600,000 characters as received (`413` beyond that)

Never parse or rewrite the `stores` values.

### 10.2 Result checks on `POST`

- The URL's game must have a results endpoint (§5.2). Otherwise `404`.
- `resultId` must be at most 200 characters and must equal `payload.id`.
- The payload must be at most 4 KB.
- The game module's `parseResult()` must accept it. It rejects missing or impossible values, like stars outside 0–3 or a position below 1.
- `playedAt` must not be in the future, give or take 5 minutes for clock drift.

### 10.3 Saves can be edited by the player

Every save and result comes from the player's browser, where it can be edited in developer tools. So:
- Coins, items and stars in saves (Rim Rush, Hoop Legacy, Football Chess) are **in-game only**. Never convert them into anything with real value, and never add them to a site-wide wallet.
- A future leaderboard built from `game_results` needs server-side checks first: plausible values, rate limits, and replay checks where a game records its seed. Until then, show results only to the player who made them.
- XP is earned from these same results, so it can be faked too. [xp-rewards.md](xp-rewards.md) §6 limits how much, and XP must stay cosmetic for the same reason.

### 10.4 Personal data

- Four games store text the player typed: Hoop Legacy's player first and last name, Holdover's callsign, Pitch Rush's 3-letter high-score initials, and Football Chess's squad names. Treat saves as personal data: include them in export, delete them with the account, and never send them to analytics.
- Result ids in Formula include the game's session id. That's fine server-side, but never forward raw payloads to analytics; the existing allowlist in `src/lib/analytics/game-results.ts` already prevents that.

### 10.5 Access and abuse

- Authenticate with the site's session. With cookies, use `SameSite=Lax` and require a CSRF token, or a custom header, on `PUT`, `POST` and `DELETE`.
- If the API is on another origin than `games.statoz.in`, allow only that origin, with credentials.
- Rate limits: 60 `PUT` per player per game per hour (debouncing keeps normal play far below this), and 120 results per player per hour.
- Gzip responses. Saves are text and compress about 5 to 10 times.

## 11. Rollout

1. **Accounts:** pass the logged-in user's id as `account` to every game. Saves split per account locally with no backend yet. This is safe on its own.
2. **Backend:** create the tables, write a module for each game (§5.1; Vibe Basketball's only declares `saves: false`), and build §5 behind a feature flag.
3. **Sync client:** add loading, debounced upload, conflicts and the results queue. Turn it on for internal accounts first.
4. **Guest import and logout cleanup:** turn on alongside step 3.
5. **Profiles:** show each game's `progress` (§5.10) on the profile page. It's worked out on write, so pages never read saves.
6. **XP:** turn on XP for the seven games that send results, then the others as described in [xp-rewards.md](xp-rewards.md) §4.

### Test checklist

- New account plays Longbow → refresh → progress is still there, now from the server.
- Play on device A, then open on device B → B starts from A's progress.
- Play on both devices offline, then go online → one wins, and the other copy appears in `game_save_versions` as `conflict`.
- Guest progress on a device → log in to an account with no save → progress moves to the account. Repeat with an account that already has a save: the account save stays, and the guest copy is kept as a version.
- Lose the network mid-match → play continues → saves upload when the connection returns.
- A 500 KB Hoop Legacy save uploads; a 700 KB envelope gets `413`, and play continues locally.
- The same result is reported twice → stored once, and XP is given once.
- A result with impossible values (`stars: 7`) → `rejected`, no XP.
- A save the module can't read → still saved, and `progress` is `null`.
- `POST /v1/me/games/mini-golf/results` and `GET /v1/me/games/vibe-basketball/save` → `404`.
- Log out → no `games.bundle.*.<accountId>` keys remain in the browser.
- Storage blocked in the browser → the game still plays, and saves to the account.

## 12. Glossary

| Term | Meaning |
|---|---|
| Envelope | `{schemaVersion, stores, resultIds}`: everything one game saved for one player |
| Stores | the game's own storage keys and string values, inside the envelope |
| Bundle id | the id a game was built with; used in the storage key and in its messages |
| Catalogue id | the site's id for a game; used in URLs, analytics and this API |
| Game module | the server code for one game: its endpoints, how to read its progress, and how to check its results |
| Progress | the figures a game's module reads from its save, for profiles |
| Revision | the server's version number for a save; goes up by 1 on every accepted write |
| Dirty | the local copy has changes the server hasn't received yet |

## 13. Open decisions

| Decision | Recommendation |
|---|---|
| Backend stack and where the API runs | Anything with a relational database. Same site as `games.statoz.in`, or a subdomain allowed by CORS. |
| Where the user id comes from: existing statoz.in accounts or a new login | Reuse statoz.in accounts, so one identity covers the whole platform |
| Guest progress at login: automatic or ask the player | Automatic first (§7, nothing is lost), then add the question once the basics work |
| Conflicts: server wins, or ask the player which copy to keep | Server wins with the other copy kept (§6.4), plus a support tool to restore versions |
| Whether results feed public leaderboards | Not until §10.3's checks exist |
| XP amounts, caps and level curve | The starting values in [xp-rewards.md](xp-rewards.md), tuned after a few weeks of real data |
| How long to keep save versions and results | 20 versions per game, conflict and import copies for 90 days, results while the account exists |
