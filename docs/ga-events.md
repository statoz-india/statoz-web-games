# GA4 events

Every Google Analytics event to add to this repo: what it measures, which file fires it and which parameters it sends.

The rollout plan, consent setup and the `track()` helper are in `impl/google-analytics.md`. All events go through `track()`.

## Rules for every event

- **Names and parameters are `snake_case`.** GA4 requires this. It is the one place this repo doesn't use kebab-case or camelCase.
- **Every custom event starts with `web_game_`**, so StatOz web events are easy to tell apart and filter in GA. Gameplay events don't repeat the word: `web_game_open`, not `web_game_game_open`.
- **GA's recommended events keep their standard names**: `page_view`, `search` and `select_content`. Prefixing them would turn them into custom events and empty GA's built-in page and search reports.
- **Never send personal data or free text.** No email, name, raw game payloads, session IDs or search text, unless the owner approves it.
- **Keep values low-cardinality.** Game IDs, sport IDs and modes are fine. Timestamps and generated IDs are not.
- **`game_id` is always the catalogue ID** from `HOME_GAMES` in `src/config/sports.ts` (`penalty-cup`, `formula` and so on). Formula's bundle uses `portfolio-formula` as its frame `gameId`, so map it back to `formula` before sending.

## Shared parameters

| Parameter | Type | Values |
|---|---|---|
| `game_id` | string | catalogue ID from `HOME_GAMES` |
| `sport` | string | `football`, `cricket`, `basketball`, `motorsport`, `golf`, `archery` |
| `coming_soon` | boolean | from `HOME_GAMES[].comingSoon` |
| `location` | string | where in the UI the action happened (each event lists its own values) |

## 1. Navigation

| Event | Fires when | File | Parameters |
|---|---|---|---|
| `page_view` | The pathname changes. Pathname only, no query string. | `src/lib/analytics/page-view-tracker.tsx` (new), rendered in `src/app/layout.tsx` | `page_path`, `page_location` (origin + pathname), `page_title` |
| `web_game_nav_click` | A navbar tab is clicked | `src/lib/ui/navbar/primary-nav.tsx` | `destination` (`games`, `library`, `shop`, `leaderboard`), `method: "click"` |
| `web_game_nav_click` | A number key (1–4) opens a tab | `src/lib/ui/navbar/use-nav-shortcuts.ts` | `destination`, `method: "keyboard"` |
| `web_game_nav_click` | The StatOz logo is clicked | `src/lib/ui/navbar/brand-link.tsx` | `destination: "games"`, `method: "logo"` |
| `web_game_not_found_view` | The 404 page renders | `src/lib/ui/not-found.tsx` | none (the page path is already on the `page_view`) |
| `web_game_not_found_home_click` | "Back home" on the 404 page | `src/lib/ui/not-found.tsx` | none |

## 2. Home page

| Event | Fires when | File | Parameters |
|---|---|---|---|
| `select_content` | The spotlight **Play** button is clicked | `src/features/homepage/components/home-spotlight.tsx` | `content_type: "game"`, `game_id`, `sport`, `coming_soon`, `location: "spotlight_hero"` |
| `select_content` | A cover in the "Your games" rail is clicked. Skip when the click was a drag (the existing `DRAG_TOLERANCE` check). | `src/features/homepage/components/cover-rail.tsx` | `content_type: "game"`, `game_id`, `sport`, `coming_soon`, `location: "cover_rail"` |
| `select_content` | A cover in a sport shelf is clicked | `src/features/homepage/components/sport-shelf.tsx` | `content_type: "game"`, `game_id`, `sport`, `coming_soon`, `location: "sport_shelf"` |
| `web_game_spotlight_motion_toggle` | The spotlight pause/play button is pressed | `src/features/homepage/components/home-spotlight.tsx` | `paused` (boolean) |
| `web_game_browse_filter` | A sport chip is chosen under "Every sport. Your game." | `src/features/homepage/components/games-browse.tsx` | `sport` (`all` or a sport ID), `location: "home_browse"` |
| `web_game_shortcut_click` | A "More from StatOz" link is clicked | `src/features/homepage/components/beyond-play.tsx` | `destination` (`library`, `leaderboard`, `shop`) |

These three are not needed yet, because the controls have no action. Add each one when its action is built:

| Event | Control | File |
|---|---|---|
| `web_game_explore_sport_click` (`sport`) | "Explore {sport}" button in the spotlight | `home-spotlight.tsx` |
| `web_game_library_open` (`location: "cover_rail"`) | "Game Library" button above the rail | `cover-rail.tsx` |
| `web_game_view_all_click` (`sport`) | Sport shelf "View all" (`onViewAll` isn't passed in from `HomeScreen`) | `sport-shelf.tsx` |

Not tracked on purpose:
- **Spotlight auto-rotation, rail hover and focus.** They fire constantly and don't show what the player chose.
- **Spotlight video plays.** They start automatically, so they are not a choice.

## 3. Library (`/library`)

| Event | Fires when | File | Parameters |
|---|---|---|---|
| `select_content` | A game card is clicked | `src/features/library/components/game-library.tsx` (on the `GameCoverCard` link) | `content_type: "game"`, `game_id`, `sport`, `coming_soon`, `recent` (boolean), `location: "library"` |
| `search` | The search text settles: debounced about 800 ms, not empty, and different from the last one sent | `game-library.tsx` (`changeSearch`) | `results_count`; `search_term` **only if approved** (see the open decision at the end) |
| `web_game_search_no_results` | A settled search returns no games | `game-library.tsx` | `sport` (current filter or `all`) |
| `web_game_browse_filter` | A sport chip is chosen | `game-library.tsx` (`changeSport`) | `sport` (`all` or a sport ID), `location: "library"`, `results_count` |
| `web_game_library_clear_filters` | "Clear search and filters" in the empty state | `game-library.tsx` (`clearAll`) | none |
| `web_game_library_close` | Escape leaves the library | `game-library.tsx` (Escape handler) | `method: "escape"` |

## 4. Coming soon

| Event | Fires when | File | Parameters |
|---|---|---|---|
| `web_game_coming_soon_view` | A coming-soon game page renders | `src/games/shared/components/coming-soon.tsx` | `game_id`, `sport` |
| `web_game_coming_soon_back_click` | "Back to games" on that page | `coming-soon.tsx` | `game_id` |

`web_game_coming_soon_view` measures demand for unreleased games. Use it to decide which game to port next.

`coming-soon.tsx` is a server component. Send the event from a small client child, for example `<TrackOnMount event="web_game_coming_soon_view" … />`.

## 5. Gameplay

All of these fire from **`src/games/shared/components/game-frame.tsx`** and nowhere else. Every game is rendered through `GameFrame`, and its `receive` handler already checks each message's source, session and `gameId`. The game bundles are not changed.

| Event | Fires when | Parameters |
|---|---|---|
| `web_game_open` | `GameFrame` starts loading a game (effect start; also on each "Try again") | `game_id`, `attempt` (0 on first load) |
| `web_game_ready` | The game sends `ready` | `game_id`, `load_ms` (time since `web_game_open`) |
| `web_game_result` | The game sends `result` | `game_id`, plus **only** the allowlisted fields in the table below |
| `web_game_exit` | The game sends `exit`, the player presses the overlay **Back** button, or `GameFrame` unmounts without either (browser back, closing the tab). Send it **once** per session. | `game_id`, `method` (`in_game`, `overlay_back`, `unmount`), `reached_ready` (boolean), `play_seconds` (from `ready` to exit; 0 if never ready), `results_count` |
| `web_game_error` | The game sends `error`, the bundle fetch fails, or the saved progress is incompatible | `game_id`, `reason` (`runtime`, `bundle`, `save_incompatible`) |
| `web_game_retry` | The overlay **Try again** button is pressed | `game_id`, `reason` (the last `web_game_error` reason) |
| `web_game_save_failed` | `localStorage.setItem` throws ("Progress could not be saved on this device.") | `game_id` |
| `web_game_pause` | The tab is hidden while a game is open (the existing `visibilitychange` handler) | `game_id` |

Not tracked: `save` messages. Games send them on every progress change, which would flood GA.

### Allowed `web_game_result` fields

Read the payload as `unknown` and narrow each field. Send only these fields; never the raw payload. Its `id` contains the session ID.

| Game | Sends `ready` | Sends `result` | Fields to send |
|---|---|---|---|
| `penalty-cup` | yes | yes | `mode` (`cup`, `random`), `outcome` (`win`, `loss`, `draw`; cup results send the cup status, e.g. `champion`), `goals_for`, `goals_against` (from `score: [player, opponent]`) |
| `cricketer` | yes | yes | `challenge_id` (from `challengeId`), `score`, `target`, `won` |
| `formula` (bundle: `portfolio-formula`) | yes | yes | `mode`, `circuit`, `position`, `laps`. Skip `time` and `bestLap`: they are near-unique values. |
| `hoop-legacy` | yes | **no** | none |
| `mini-golf` | yes | **no** | none |

For Hoop Legacy and Mini Golf, `web_game_ready`, `web_game_exit` and `play_seconds` are the only measures of play. Adding a `result` event to those games would mean rebuilding their bundles in the source repo.

The allowlist lives in `src/lib/analytics/game-results.ts`. A game with no entry there sends `web_game_result` with `game_id` only.

## 6. Consent

Only needed if a consent banner is built (open decision 2 in `impl/google-analytics.md`).

| Event | Fires when | File | Parameters |
|---|---|---|---|
| `web_game_consent_update` | The visitor accepts or declines | consent banner component (new) | `analytics` (`granted`, `denied`) |

This event only fires after consent is granted, so declines are never recorded. That is expected.

## 7. GA Admin setup for these events

**Custom dimensions (event scope):** `game_id`, `sport`, `location`, `destination`, `method`, `content_type`, `mode`, `outcome`, `circuit`, `challenge_id`, `reason`, `coming_soon`, `reached_ready`, `recent`, `paused`

**Custom metrics:** `load_ms` (milliseconds), `play_seconds` (seconds), `score`, `goals_for`, `goals_against`, `position`, `target`, `laps`, `results_count`, `attempt`

**Key events:** `web_game_ready`, `web_game_result`

Register dimensions as early as possible: GA only fills them from the day they are created.

## 8. Event count

| Area | Events |
|---|---|
| Navigation | `page_view`, `web_game_nav_click`, `web_game_not_found_view`, `web_game_not_found_home_click` |
| Home | `select_content`, `web_game_spotlight_motion_toggle`, `web_game_browse_filter`, `web_game_shortcut_click` |
| Library | `select_content`, `search`, `web_game_search_no_results`, `web_game_browse_filter`, `web_game_library_clear_filters`, `web_game_library_close` |
| Coming soon | `web_game_coming_soon_view`, `web_game_coming_soon_back_click` |
| Gameplay | `web_game_open`, `web_game_ready`, `web_game_result`, `web_game_exit`, `web_game_error`, `web_game_retry`, `web_game_save_failed`, `web_game_pause` |
| Consent | `web_game_consent_update` (only with a banner) |
| Later, when the controls work | `web_game_explore_sport_click`, `web_game_library_open`, `web_game_view_all_click` |

That is **22 distinct events now**, plus 1 if a consent banner is built and 3 more later. `select_content` and `web_game_browse_filter` each fire from several places and are told apart by `location`.

## Open decision

**Library search text.** Send `search_term` to GA, or only `results_count`? Search text can contain personal data. Recommendation: `results_count` only.
