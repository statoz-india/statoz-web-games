# GA4 + GTM implementation

How StatOz Games sends analytics: the website pushes events to Google Tag Manager (GTM), and GTM forwards them to Google Analytics 4 (GA4).

- **Event catalogue** (every event, where it fires, its parameters): `docs/ga-events.md`
- **This document:** the exact wiring in code, in GTM and in GA4, plus testing and deployment.

## 1. Accounts and IDs

| What | Value | Where it is used |
|---|---|---|
| GTM container | `GTM-KM9N2CL7` (container "games.statoz.in", account "Web Games") | Website code, through `NEXT_PUBLIC_GTM_ID` |
| GA4 measurement ID | `G-V9GLTE7WTM` | **Only inside GTM** (the Google Tag). Not in the website code. |
| Google Ads ID | `AW-18560086387` | Not used yet |

## 2. How data flows

```
Website (games.statoz.in)
  │  loads GTM-KM9N2CL7 once, pushes events to window.dataLayer
  ▼
Google Tag Manager
  │  Google Tag (G-V9GLTE7WTM) + GA4 Event tags read the dataLayer
  ▼
Google Analytics 4 (reports)
```

- **The website never talks to GA4 directly.** Adding, changing or removing tags happens in GTM and needs no deploy.
- **GTM must be the only path to GA4.** If the site also loaded `gtag.js` with a GA4 ID, every event would be counted twice.

## 3. Environment variables

| Variable | Value in production | Notes |
|---|---|---|
| `ENVIRONMENT` | `production` | Nothing loads unless this is exactly `production`. |
| `NEXT_PUBLIC_GTM_ID` | `GTM-KM9N2CL7` | Must match `^GTM-[A-Z0-9]+$`, otherwise it is ignored. |
| `NEXT_PUBLIC_GA4_ID` | remove | Not used once the site is GTM only (section 5). |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | optional | Not used yet. |

**Both values are read at build time.** Every page is pre-rendered, so `ENVIRONMENT` and `NEXT_PUBLIC_GTM_ID` must be set in the hosting environment when `next build` runs, not only when the server starts. Changing either one needs a rebuild.

Locally, `.env` holds `ENVIRONMENT=development`, so `npm run dev` never loads GTM. That is intended.

## 4. Code

All analytics code lives in `src/lib/analytics/`.

| File | Role |
|---|---|
| `analytics.tsx` | Server component in `src/app/layout.tsx`. In production only, renders the inline setup script, `<PageViewTracker />` and `<ConsentBanner />`. |
| `track.ts` | `track(event, params)`: the one function every event goes through. |
| `page-view-tracker.tsx` | Sends a page view whenever the pathname changes. |
| `consent-banner.tsx` | Accept / Decline banner shown to every visitor. Saves the choice and updates consent. |
| `game-results.ts` | Per-game allowlist of `result` fields (raw game payloads are never sent). |
| `constants.ts` | `PRIVACY_POLICY_URL`, `CONSENT_STORAGE_KEY` (`statoz.analytics.consent`), `CONSENT_CHANGE_EVENT`. |

Gameplay events are sent from `src/games/shared/components/game-frame.tsx`, which every game uses.

### 4.1 Inline setup script (`analytics.tsx`)

It is rendered as the first child of `<body>`, so it runs while the HTML is parsed, before React hydrates and before any component sends an event. In order, it:

1. Creates `window.dataLayer` and the standard `window.gtag` function, which pushes its `arguments` to `dataLayer`. GTM reads consent commands sent this way.
2. Sets consent defaults:
   - `analytics_storage`: `granted` if `localStorage["statoz.analytics.consent"] === "granted"`, otherwise `denied`
   - `ad_storage`, `ad_user_data`, `ad_personalization`: always `denied`
3. Pushes `{ "gtm.start": Date.now(), event: "gtm.js" }` and loads `https://www.googletagmanager.com/gtm.js?id=GTM-KM9N2CL7`.

### 4.2 The dataLayer format GTM reads

**Every event except page views** is two pushes:

```js
window.dataLayer.push({ params: null });   // clear the previous event's parameters
window.dataLayer.push({ event: "web_game_open", params: { game_id: "penalty-cup", attempt: 0 } });
```

The first push matters: GTM merges nested objects. Without it, a parameter from an earlier event (for example `goals_for` from Penalty Cup) would stick to later events that don't set it.

**Page views** are one push with top-level keys:

```js
window.dataLayer.push({
  event: "web_game_page_view",
  page_path: "/library",
  page_location: "https://games.statoz.in/library",
  page_title: "StatOz Games",
});
```

Page rules:
- `page_path` and `page_location` never contain the query string, so library search text (`?q=`) never reaches GA.
- GA4's own history-based page views stay off (section 6.1 and 7.2), so this push is the only page view.

**Consent** uses the `gtag` function from 4.1:

```js
gtag("consent", "update", { analytics_storage: "granted" }); // or "denied"
```

### 4.3 Consent banner

- Every visitor sees it in production until they choose. It sits above everything, including the full-screen game frame (z-index layer `consent` = 60).
- Text: "We use cookies to see how StatOz Games is played and to improve it." It links to https://www.statoz.in/privacyPolicy, with **DECLINE** and **ACCEPT** buttons.
- **Accept:** stores `granted`, sends the consent update, then sends `web_game_consent_update` with `analytics: "granted"`.
- **Decline:** stores `denied`. Google receives only cookieless Consent Mode pings, and nothing is stored on the device.

### 4.4 Current state and remaining code work

| Item | Status |
|---|---|
| Production-only loading, consent defaults, consent banner | Done |
| Page view tracking | Done (still in the old direct-GA4 format) |
| Gameplay events in `GameFrame` (section 5 of `docs/ga-events.md`), with result fields for all 7 games that send results | Done (still in the old direct-GA4 format) |
| Home, navigation, library and coming-soon events (`docs/ga-events.md` sections 1–4) | Done (still in the old direct-GA4 format) |
| **Switch to GTM only** (section 5 below) | **Not done.** Required before go-live. |

## 5. Switching the code to GTM only (required before go-live)

The code currently loads **both** `gtag.js` (with `NEXT_PUBLIC_GA4_ID`) and GTM, and sends events in gtag's format. Three changes are needed:

1. **`analytics.tsx`:** stop loading `gtag.js` and remove the `gtag("js")` and `gtag("config", …)` calls. Keep the `window.gtag` function (consent needs it) and the GTM loader. Render nothing if `NEXT_PUBLIC_GTM_ID` is missing.
2. **`track.ts`:** replace `gtag("event", name, params)` with the two pushes in 4.2. Keep it a no-op outside production, where `window.dataLayer` doesn't exist.
3. **`page-view-tracker.tsx`:** push `web_game_page_view` with the top-level `page_*` keys in 4.2.

Event names and parameters stay the same, so `game-frame.tsx`, `consent-banner.tsx` and every call site are unchanged.

## 6. GTM configuration (container GTM-KM9N2CL7)

### 6.1 Tags

| Tag name | Type | Settings | Trigger |
|---|---|---|---|
| `GA4 – Google tag` | Google Tag | Tag ID `G-V9GLTE7WTM`. Configuration settings: `send_page_view` = `false`. | Initialization – All Pages |
| `GA4 – Page view` | Google Analytics: GA4 Event | Measurement ID `G-V9GLTE7WTM`. Event name `page_view`. Event parameters: `page_path` = `{{page_path}}`, `page_location` = `{{page_location}}`, `page_title` = `{{page_title}}`. | `CE – web_game_page_view` |
| `GA4 – All web_game events` | Google Analytics: GA4 Event | Measurement ID `G-V9GLTE7WTM`. Event name `{{Event}}`. Event parameters: one row per variable in 6.3, named without the `params.` prefix (e.g. `game_id` = `{{params.game_id}}`). | `CE – All web_game events` |

Parameters an event doesn't send are left out by GA4, so one tag safely serves every event.

### 6.2 Triggers

| Trigger name | Type | Settings |
|---|---|---|
| `CE – web_game_page_view` | Custom Event | Event name `web_game_page_view`. All Custom Events. |
| `CE – All web_game events` | Custom Event | Event name `^web_game_\|^select_content$\|^search$` with **Use regex matching** ticked. Fires on **Some Custom Events**: `Event` **does not equal** `web_game_page_view`. |

The exception on the second trigger is required. Without it, every page view would also be sent as a `web_game_page_view` event and be counted twice. GTM's regex engine has no lookahead, so the exclusion must be a condition, not part of the pattern.

### 6.3 Variables

**Built-in:** in Variables → Configure, tick **Event**.

**User-defined:** each is a Data Layer Variable, Version 2. The variable name equals the data layer key.

| Group | Data Layer Variable names |
|---|---|
| Page views | `page_path`, `page_location`, `page_title` |
| Shared | `params.game_id`, `params.sport`, `params.location`, `params.coming_soon` |
| Navigation, home, library | `params.destination`, `params.method`, `params.content_type`, `params.recent`, `params.paused`, `params.results_count` |
| Gameplay | `params.attempt`, `params.load_ms`, `params.play_seconds`, `params.reached_ready`, `params.reason` |
| Game results | `params.mode`, `params.outcome`, `params.goals_for`, `params.goals_against`, `params.score`, `params.target`, `params.won`, `params.challenge_id`, `params.circuit`, `params.position`, `params.laps`, `params.rival_score`, `params.stars`, `params.runs`, `params.wickets`, `params.balls`, `params.rival`, `params.court`, `params.cup`, `params.round`, `params.tied`, `params.difficulty`, `params.stage_id` |
| Consent | `params.analytics` |

That is 42 variables. When a new parameter is added to `docs/ga-events.md`, add its variable here and a row in the `GA4 – All web_game events` tag.

### 6.4 Container settings

**Admin → Container settings → Enable consent overview.** GA4 tags have built-in consent checks for `analytics_storage`, so they respect the banner without extra settings.

### 6.5 Publishing

1. Test with **Preview** (section 8).
2. Click **Submit**, add a version name such as "GA4 via GTM v1", then **Publish**.

Nothing reaches GA4 from GTM until a version is published.

## 7. GA4 configuration (property with stream G-V9GLTE7WTM)

### 7.1 Custom definitions

In **Admin → Custom definitions**, create one per parameter, all **Event** scope. GA only fills a definition from the day it is created, so create them before go-live.

**Custom dimensions:** `game_id`, `sport`, `location`, `coming_soon`, `destination`, `method`, `content_type`, `recent`, `paused`, `reached_ready`, `reason`, `mode`, `outcome`, `won`, `tied`, `challenge_id`, `circuit`, `difficulty`, `stage_id`, `rival`, `court`, `cup`, `analytics`

**Custom metrics:**

| Metric | Unit |
|---|---|
| `load_ms` | Milliseconds |
| `play_seconds` | Seconds |
| `results_count`, `attempt`, `goals_for`, `goals_against`, `score`, `rival_score`, `target`, `position`, `laps`, `stars`, `runs`, `wickets`, `balls`, `round` | Standard |

That is 23 dimensions and 16 metrics, inside GA4's limit of 50 of each.

### 7.2 Stream settings

**Admin → Data streams → web stream → Enhanced measurement → ⚙**: turn **off** "Page changes based on browser history events".

### 7.3 Key events

**Admin → Key events:** mark `web_game_ready` and `web_game_result`. They appear in the list after their first hit, or can be created by name.

### 7.4 Data retention and internal traffic

- **Admin → Data retention:** 14 months.
- **Admin → Data streams → Configure tag settings → Define internal traffic:** add the team's IP addresses.

## 8. Testing

### 8.1 Locally, before deploying

```bash
# Stop `npm run dev` first: Next.js allows one server per project folder.
ENVIRONMENT=production NEXT_PUBLIC_GTM_ID=GTM-KM9N2CL7 npm run build
ENVIRONMENT=production NEXT_PUBLIC_GTM_ID=GTM-KM9N2CL7 npm run start
```

1. In GTM, click **Preview** and enter `http://localhost:3000`.
2. In the site window that opens, click **ACCEPT** on the banner.
3. In Tag Assistant, check:
   - `GA4 – Google tag` fires on Initialization
   - each page change fires `GA4 – Page view`, and only once
   - opening a game shows `web_game_open`, then `web_game_ready`, each firing `GA4 – All web_game events`
   - the **Variables** tab shows the right `params.*` values, with no leftovers from the previous event
4. In **GA4 → Admin → DebugView**, the same events arrive with their parameters.

### 8.2 After deploying

Repeat 8.1 against `https://games.statoz.in`, then check **GA4 → Reports → Realtime**.

### 8.3 Troubleshooting

| Symptom | Cause |
|---|---|
| Tag Assistant says "Not Connected" / "0 Google tags found" | The page doesn't load GTM. Check the URL is the games site (not `statoz.in`), the build ran with `ENVIRONMENT=production` and `NEXT_PUBLIC_GTM_ID`, and the deployed code includes `src/lib/analytics`. |
| Page views counted twice | `send_page_view` isn't `false` on the Google tag, the trigger exception in 6.2 is missing, or GA4's history page views (7.2) are on. |
| Every event counted twice | The site still loads `gtag.js` directly (section 5 not done). |
| Event arrives but parameters are empty | The Data Layer Variable is missing, misspelled, or not Version 2. Or the parameter row is missing in the event tag. |
| Parameters from an earlier event appear | The `{ params: null }` reset push in `track.ts` is missing. |
| Events in Tag Assistant but none in GA4 | The GTM version isn't published, the visitor declined consent, or the measurement ID in GTM doesn't match the GA4 stream. |

## 9. Go-live checklist

- [ ] Section 5 code switch done and merged
- [ ] Hosting production environment: `ENVIRONMENT=production`, `NEXT_PUBLIC_GTM_ID=GTM-KM9N2CL7`, no `NEXT_PUBLIC_GA4_ID`
- [ ] GTM: tags, triggers and variables from section 6 created; Preview checked; version published
- [ ] GA4: custom definitions, stream setting and key events from section 7 done
- [ ] Production build deployed to `games.statoz.in`
- [ ] Realtime shows visits and `web_game_*` events after accepting the banner
