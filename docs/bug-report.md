# Bug report

A review of this repo's own code on 14 November 2026: the app, the shared game host, the build scripts and config. The 14 vendored game bundles were only checked for how they connect to the host, not reviewed line by line.

**How it was checked:** reading every source file, `tsc --noEmit` (passes), `npm run lint`, a catalogue consistency script (every game's route, bundle, artwork, shelf and library entry), and reproductions in a browser against `npm run dev`.

**Status:** **Confirmed** means it was reproduced or is certain from the code. **Unconfirmed** means likely, but not reproduced.

## Summary

| # | Severity | Bug | Status |
|---|---|---|---|
| 1 | High | Games don't load at all when the browser blocks storage, and the error message is wrong | **Fixed** |
| 2 | High | `npm run lint` fails: 60 errors and 8,427 warnings from game bundles | **Fixed** |
| 3 | Medium | A corrupt or old save locks the game for good; "Try again" can never work | **Fixed** |
| 4 | Medium | `npm run build` doesn't build the games; the 14 build scripts are manual and undocumented | Confirmed |
| 5 | Medium | Four visible buttons do nothing when clicked | Confirmed |
| 6 | Medium | A consent choice can never be changed, and the banner can cover game controls on phones | Confirmed from code; overlap not tested |
| 7 | Low | Home, Library, Shop and Leaderboard all have the same tab title | Confirmed |
| 8 | Low | `/homescreen` is a second public URL for the home page | Confirmed |
| 9 | Low | The Games tab checks `/games/`, but game routes are `/game/` | Confirmed |
| 10 | Low | The "recently played" mark can never show | Confirmed |
| 11 | Low | Every game's loading and error screen uses Mini Golf's green theme | Confirmed |
| 12 | Low | Boot data injection fails silently if a bundle's `<head>` tag ever has attributes | Confirmed (latent) |
| 13 | Low | Dead code and stale files | Confirmed |
| 14 | Low | Arrow keys on sport chips send one analytics event per key press | Confirmed |
| 15 | Low | The host pauses games when the tab is hidden but never resumes them | Unconfirmed |
| 16 | Low | Page views may record an empty `page_title` | Unconfirmed |

Game-specific problems found while porting are listed after these, then content and licensing risks, which aren't code bugs.

---

## High

### 1. Games don't load when the browser blocks storage

**Where:** [game-frame.tsx:60-63](../src/games/shared/components/game-frame.tsx#L60-L63)

```ts
try {
  const old = JSON.parse(localStorage.getItem(key) || "null");
  if (old?.schemaVersion === 1) save = old; else if (old !== null) invalid = true;
} catch { invalid = true; }
```

The same `catch` handles two different failures: a save that can't be parsed, and `localStorage` itself throwing. Browsers throw a `SecurityError` on `localStorage` when site data is blocked, for example Chrome's "Block all cookies" or some embedded and privacy modes. Both cases set `invalid = true`, so the game is never loaded.

**What the player sees:** "Saved progress needs a compatible game version. It has been preserved." with Try again and Back. No game works on that browser, and the message is wrong: there is no saved progress.

**Reproduced:** with storage access made to throw on the host page, `/game/football-chess` showed exactly that message and never loaded. This affects all 14 games.

**Fix:** read storage in its own `try`. If reading throws, start with an empty save and show the existing notice "Progress could not be saved on this device." Mark the save invalid only when the stored value exists but can't be parsed or has the wrong `schemaVersion`. The source repo's host does this ("Storage denial still permits temporary play").

**Fixed (14 November 2026):** `GameFrame` now does exactly this. With storage blocked:
- The game loads and the notice shows.
- `web_game_save_failed` is sent once per session, not on every save.
- Saves aren't attempted.

Normal saving and the error for a genuinely incompatible save behave as before.

### 2. `npm run lint` fails

**Where:** [eslint.config.mjs:13-20](../eslint.config.mjs#L13-L20)

The ignore list only covers the Mini Golf engine and the Cricketer and Formula bundles. ESLint therefore lints the minified JavaScript of the other 12 bundles in `src/games/*/bundle/`, and every copy in `public/games/`.

**Result:** 8,487 problems (60 errors, 8,427 warnings), all in vendored files. Any CI step that runs `npm run lint` fails, and real problems in app code are lost in the noise. With the bundles excluded, the app code has a single warning (#13).

**Fix:** ignore `src/games/*/bundle/**` and `public/games/**` instead of listing bundles one by one.

**Fixed (14 November 2026):** `eslint.config.mjs` now ignores both patterns. `npm run lint` exits 0, with only the one app-code warning from #13.

---

## Medium

### 3. A bad save locks the game for good

**Where:** [game-frame.tsx:62](../src/games/shared/components/game-frame.tsx#L62), [:116](../src/games/shared/components/game-frame.tsx#L116), [:158](../src/games/shared/components/game-frame.tsx#L158)

When a save has an unknown `schemaVersion` or invalid JSON, the frame shows "Saved progress needs a compatible game version" with **Try again**. Retrying re-reads the same save and fails the same way, every time.

**Reproduced:** with `{"schemaVersion":2}` stored for Football Chess, the error appeared, and after Try again it appeared again.

That game is unplayable on the device until site data is cleared by hand. This will happen to every player of a game whose release changes its save version.

**Fix:** for this error, replace "Try again" with a clear choice such as "Start fresh", which moves the old save aside under a backup key, and keep Back.

**Fixed (14 November 2026):** this error now offers **Start fresh** and **Back**. Start fresh copies the unreadable save to `games.bundle.<id>.<account>.backup.<timestamp>`, so nothing is deleted. It then removes the original and reloads the game with an empty save, sending `web_game_retry` with `reason: "save_incompatible"`. If the save can't be moved, it says so instead of deleting it. Other errors still offer Try again.

### 4. `npm run build` doesn't build the games

**Where:** [package.json](../package.json) (`"build": "next build"`), `src/games/*/scripts/build-*.mjs`

Each game is published by running `node src/games/<id>/scripts/build-<id>.mjs`, which checks the release hashes and copies the files into `public/games/<id>/`. Nothing runs these scripts:
- There's no npm script for them.
- `build` doesn't call them.
- The README is still the create-next-app template. It refers to `app/page.tsx` and the Geist font, neither of which this project uses, and says nothing about games.

**Risk:**
- **Stale files:** after a release is updated in `src/games/<id>/bundle/`, the site keeps serving the old files in `public/` until someone remembers to run the script.
- **Double storage:** both copies are committed, about 74 MB in `src/games` plus 84 MB in `public/games`. They match today, but nothing keeps them in sync.

**Fix:**
- Add a `build:games` script that runs all 14 build scripts, and run it from `prebuild`.
- Either stop committing `public/games/` (generate it at build time) or stop committing the `src` copies.
- Replace the README with real setup and build steps.

### 5. Four visible buttons do nothing

They look and behave like controls (focusable, hover styles, an arrow icon) but have no action:

| Button | Where |
|---|---|
| "Explore {sport}" in the spotlight | [home-spotlight.tsx:114](../src/features/homepage/components/home-spotlight.tsx#L114) |
| "Game Library" above "Your games" | [cover-rail.tsx:39-45](../src/features/homepage/components/cover-rail.tsx#L39-L45) |
| "View all" on every sport shelf; `HomeScreen` never passes `onViewAll` | [sport-shelf.tsx:40](../src/features/homepage/components/sport-shelf.tsx#L40) |
| "Your Collection" shortcut (no `href`) | [beyond-play.tsx:84](../src/features/homepage/components/beyond-play.tsx#L84) |

"Game Library" and "View all" could link to `/library` and `/library?listSport=<sport>` today, since the library already reads `listSport`. Until the others are built, hide them or mark them as coming soon.

### 6. A consent choice can't be changed, and the banner can cover game controls

**Where:** [consent-banner.tsx:50](../src/lib/analytics/consent-banner.tsx#L50)

**Covering controls:** the banner sits at layer 60, above the full-screen game frame (50), and takes the bottom of the screen up to 672 px wide. Games that put touch controls in the bottom corners can be partly covered. On an 844×390 phone, the banner's edges reach the area where Pitch Rush draws its joystick and Attack button. This wasn't tested with the banner showing, because it only appears in a production build. It lasts until the visitor chooses, but a first visit that goes straight to a game starts that way.

**No way to change a choice:** there is no way to reopen the banner or withdraw consent. Accept or Decline is stored permanently in `statoz.analytics.consent`. Privacy rules generally require withdrawing consent to be as easy as giving it.

**Fix:**
- **Game pages:** show the banner as a compact bar at the top, or above the game's own controls.
- **Settings:** add a "Cookie settings" link, for example in the footer, that clears the stored choice.

---

## Low

### 7. Pages share one tab title

Only game pages and the 404 page set `metadata.title`. Home, Library, Shop and Leaderboard all read "StatOz Games", so browser tabs, history and GA's `page_title` can't tell them apart. The 404 title also uses "· StatOz" while games use "· StatOz Games".

### 8. `/homescreen` duplicates the home page

**Where:** [src/app/(with-navbar)/homescreen/page.tsx](../src/app/(with-navbar)/homescreen/page.tsx), imported by [src/app/(with-navbar)/page.tsx](../src/app/(with-navbar)/page.tsx)

`/` renders the `/homescreen` page component, so the same page is public at two URLs. The Games tab isn't marked active on `/homescreen`. The root page's component is also named `Library`. Move `HomeScreen` straight into `page.tsx` and delete the `homescreen` route.

### 9. The Games tab checks the wrong path

**Where:** [navigation.ts:22](../src/config/navigation.ts#L22)

`match: pathname === "/" || pathname.startsWith("/games/")` refers to `/games/`, but game routes are `/game/<id>`. It has no visible effect today, because game pages don't show the navbar, but the check is wrong.

### 10. "Recently played" can never show

**Where:** [game-library.tsx:50](../src/features/library/components/game-library.tsx#L50), `HomeGame.recent`

The clock mark depends on `recentIds` and `HomeGame.recent`, and nothing ever sets either. As a result, GA's `recent` parameter on library clicks is always `false`. The data is available: every game's save sits in `localStorage` under `games.bundle.<id>.*`.

### 11. Every game's loading screen uses Mini Golf's theme

**Where:** [game-frame.module.css](../src/games/shared/components/css/game-frame.module.css)

`GameFrame`'s overlay ("Opening your game…", errors, Try again and Back) uses Mini Golf's fixed greens and yellow (`#04190f`, `#ffc83d`) and the Rubik font. It is the first screen of all 14 games, so Racer, Holdover and Football Chess all open on a golf-green screen. These colours also bypass the design tokens in `src/styles/`.

### 12. Boot injection fails silently if `<head>` changes

**Where:** [game-frame.tsx:27](../src/games/shared/components/game-frame.tsx#L27)

`html.replace("<head>", …)` needs that exact tag. All 14 bundles have exactly one plain `<head>` today. If a future release has `<head lang="en">`, nothing is replaced. The game would then load with no base URL, no boot data and no session, so it would never send `ready`, and the player would be stuck on "Opening your game…" with no error. Match `<head[^>]*>` with a regex, or show an error if nothing was replaced.

### 13. Dead code and stale files

- [game-library.tsx:11](../src/features/library/components/game-library.tsx#L11): `CloseIcon` is imported and never used. This is the only lint warning in app code.
- Not imported anywhere:
  - [progress.ts](../src/games/mini-golf/components/progress.ts), a Mini Golf progress hook.
  - [credits.ts](../src/games/mini-golf/components/credits.ts), 33 KB of licence text that `build-mini-golf.mjs` regenerates on every build.
  - The licence text is never shown in the app. If it was meant to satisfy Open Golf's MIT notice, that isn't happening.
- [utility-tray.tsx](../src/lib/ui/navbar/utility-tray.tsx) is commented out of the navbar. It links to `/streaks` and `/profile`, which don't exist.
- `src/app/(onboarding)/` is an empty route group.
- [docs/ga-events.md](ga-events.md) points to `impl/google-analytics.md`, but `impl/` is in `.gitignore`, so the link is broken for everyone but the author.

### 14. Arrow keys on sport chips send an event per key press

**Where:** [filter-chips.tsx:37](../src/lib/components/filter-chips.tsx#L37)

The chips select as focus moves, so moving from "All Games" to "Archery" with arrow keys sends a `web_game_browse_filter` for every chip passed. GA will overcount filter use by keyboard users. Either report only `click` selections, or send after a short pause.

### 15. Games are paused but never resumed (unconfirmed)

**Where:** [game-frame.tsx:126](../src/games/shared/components/game-frame.tsx#L126)

When the tab is hidden, the host posts `pause`, and it never posts `resume` when the tab comes back. At least Mini Golf's and Pitch Rush's bridges accept a `resume` command. If a game waits for it rather than showing its own pause menu, it stays frozen. Check each game by switching tabs mid-play.

### 16. `page_title` may be empty (unconfirmed)

**Where:** [page-view-tracker.tsx](../src/lib/analytics/page-view-tracker.tsx)

The tracker reads `document.title` in an effect when the pathname changes. During client-side navigation, the title was briefly empty before Next.js set it. If the effect runs in that gap, `page_title` is recorded as empty or as the previous page's title. Check in a production build with GTM Preview.

---

## Game-specific issues

Problems in the published game releases, not in this repo's code. The live site has the same problems.

| Game | Issue |
|---|---|
| Vibe Basketball | On phone landscape (844×390), the lobby overlaps: "YOUR RULES." covers the 1V1 card, and "3-POINT CONTEST" wraps one word per line. This comes from the game's own `mobile.css`. |
| Rim Rush | In an automated browser, the 7 sound effects were never requested, on the live site or locally. Confirm by ear in a real browser. |
| Pitch Rush | The Online button is hidden and disabled. Online play needs a relay server that doesn't exist. |
| Hoop Legacy, Mini Golf, Rally Dash, Holdover, Pitch Rush, Vibe Basketball, Football Chess | They never send a `result`, so GA can't see wins, scores or completions for 7 of 14 games. |

## Content and licensing risks

Not code bugs, but each could force a game offline. All are already on the live site.

| Game | Risk |
|---|---|
| Penalty Cup | The striker and keeper sprites and 7 audio files come from the commercial game Penalty Shooters 2 (10x10games and Poki). The only recorded permission covers GitHub Pages. |
| Football Chess | Contains 367 real athletes with ratings: national-team footballers and NBA players. Rival squads use real surnames (Bombito, Castagne, Budimir and others). |
| Formula | Driver names mirror real Formula 1 champions. |
| Racer | The track is named "SILVERSTONE GP", a real circuit's trademark. |
| Cricketer, Yorker | Use a Sketchfab model titled "virat-kohli-cricket-batting-animation". The CC BY licence covers the model, not a real player's likeness. |
| Holdover | A military sniper game listed under Archery. The source repo's notes say "do not synchronize it into another repository" (porting it here was approved). |
| Pitch Rush | Credits "WebSoccer by Mark Clausing · MIT", but the MIT licence text isn't shipped. |
| Formula | The fonts' OFL licence texts aren't shipped. |

## Open from earlier work

- **Analytics loading:** the code loads Google Analytics directly *and* through GTM. If the GTM container ever gets a GA4 tag before the code switch in `docs/ga-gtm-impl.md` §5, every event is counted twice. That switch is required before go-live.
