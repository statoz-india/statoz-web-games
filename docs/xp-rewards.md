# XP rewards

A suggested design for giving players site-wide XP when they win a game, and levels built from that XP.

It builds on [game-progress-backend.md](game-progress-backend.md): XP is awarded by each game's server module (§5.1 there), from the results the website already uploads. All the amounts here are starting values, meant to be tuned once there's real data.

## 1. How it works

```
 Player wins a match
   └─ game posts {type:"result"} ──► GameFrame queues it ──► POST /v1/me/games/longbow/results
                                                                 │
                                       server, in one transaction:
                                         1. longbow module checks the result (parseResult)
                                         2. stores it in game_results (once, by result id)
                                         3. longbow module decides the XP (xp.forResult)
                                         4. applies the daily caps (§6)
                                         5. writes xp_events rows, adds to user_xp
                                                                 │
 GameFrame shows "+45 XP · Level 6"  ◄────────────── { accepted: [{ xp: 45 }], xp: { total, level } }
```

The browser reports **what happened**: the match result. Only the server decides **what it's worth**.

## 2. Rules

1. **The server works out every XP amount.** The website never sends one, and the server ignores any XP-like field in a payload.
2. **Each result or milestone gives XP at most once, ever.** A unique key on the XP ledger enforces this, so retries, a second device and replays can't repeat it.
3. **Every award is a row in a ledger.** The player's total is the sum of the rows. Awards can be audited, and reversed with a correcting row.
4. **XP has daily limits** per game and overall (§6).
5. **XP is cosmetic only**: levels, badges, profile flair. Results come from the player's browser and can be faked (backend doc §10.3), so XP must never turn into money, prizes, in-game coins or anything else of value.
6. **Site XP is separate from in-game XP.** Hoop Legacy and Holdover have their own `xp` inside their saves. Never copy those into site XP: they're easy to edit, and each game scales them differently.
7. **Only logged-in players earn XP.** Guests are invited to log in instead (§8).

## 3. Data model

```sql
-- The ledger: one row per award. The unique key is what makes every award happen once.
create table xp_events (
  id             bigserial primary key,
  user_id        uuid not null references users(id) on delete cascade,
  game_id        text references games(id),     -- null for adjustments not tied to a game
  source         text not null check (source in ('result', 'milestone', 'adjustment')),
  source_id      text not null,                 -- result id, or a milestone id like 'first-win:level-3'
  rule           text not null,                 -- 'win', 'stars', 'first-win', 'cup-champion', …
  xp             integer not null,              -- negative only for adjustments
  capped         boolean not null default false,-- true when a daily limit cut it down
  rules_version  integer not null,              -- which XP values were in force (§9)
  created_at     timestamptz not null default now(),
  unique (user_id, game_id, source, source_id, rule)
);
create index xp_events_daily on xp_events (user_id, created_at);

-- The running total, kept in the same transaction as each award.
create table user_xp (
  user_id     uuid primary key references users(id) on delete cascade,
  total       integer not null default 0,
  level       integer not null default 1,
  updated_at  timestamptz not null default now()
);

-- For games without results: the highest value seen for each counter, so a reset save can't earn XP twice.
create table xp_progress_marks (
  user_id  uuid not null references users(id) on delete cascade,
  game_id  text not null references games(id),
  mark     text not null,                      -- 'record.wins', 'stats.duelWins', 'hole-7'
  value    integer not null,
  primary key (user_id, game_id, mark)
);
```

A nightly job checks that each `user_xp.total` equals the sum of that player's `xp_events`, and reports any difference.

Each game module from the backend doc gets one more part:

```ts
type XpAward = { rule: string; xp: number; sourceId?: string };  // sourceId defaults to the result id

type GameModule = {
  // …everything in game-progress-backend.md §5.1, plus:
  xp?: {
    /** XP for one checked result. ctx says, for example, whether this challenge was won before. */
    forResult?(result: ParsedResult, ctx: XpContext): XpAward[];
    /** XP for milestones reached between two saves (games that send no results, §4.2). */
    forProgress?(before: Progress | null, after: Progress, marks: Marks): XpAward[];
    /** Minimum seconds between two results that both earn XP (§6). */
    minGapSeconds?: number;
  };
};
```

## 4. XP for each game

The core reward is **XP for every win**. The bonuses are optional extras that make harder wins worth more. Each game's win rule is the one in the backend doc §9.

### 4.1 Games that send results (works from day one)

| Game | Counts as a win | Win | Optional bonuses |
|---|---|---|---|
| Penalty Cup | random match with `outcome: "win"` | 20 | Cup won (`outcome: "champion"`): 150. A cup's matches send no results, so the cup's XP covers the whole run. |
| Formula | `position: 1` | 30 | Career race (`careerEventId` set): +10 |
| Cricketer | `won: true` | 25 | First win of a challenge: +50 |
| Yorker | `won: true` | 25 | +5 per star. First win of a spell: +50 |
| Rim Rush | `won: true` and `tied: false` | 20 | Cup match (`cup` set): +10 |
| Racer | `position: 1` | 30 | Career race: +5 per star |
| Longbow | `won: true` | 25 | +5 per star. First win of a level or rival: +50 |

How "first win of a challenge" stays one-time: it's written as a `milestone` award with `source_id = 'first-win:<challengeId>'`. The ledger's unique key then rejects any repeat, on any device.

Example: a Longbow career win on `level-3` with 2 stars, the first win of that level, gives 25 + 10 + 50 = **85 XP** as three ledger rows (`win`, `stars`, `first-win`).

### 4.2 Games that send no results

Seven games never send a `result` message, so the server never hears about their wins directly. There are two ways to give them XP:

1. **Recommended in the long run: have each game send results.** The message protocol and every game's bridge already support it. Each game's release needs to send `{type: "result", payload: {id, won, …}}` when a match ends. That's a change in the games' source repo, not in this website. Then add `parseResult()` and `xp.forResult()` to the game's module, and it works like §4.1.
2. **Until then: XP from milestones in the save.** On each accepted save, the module compares the new progress with the previous one and awards XP for what's new:

| Game | Milestone read from the save | XP |
|---|---|---|
| Hoop Legacy | `records.quickWins` goes up, or a slot's `stats.career.w` goes up | 20 per new win |
| Mini Golf | a hole cleared for the first time | 15 per hole. A hole's first ace (1 stroke): +10. All 20 holes cleared: +100 |
| Football Chess | `record.wins` goes up | 20 per new win |
| Rally Dash | a new run in `recent` (each has its own `id`) finishing in `position` 1, or a better medal on a stage | 20 per win. Medals: bronze 10, silver 20, gold 30; an upgrade gives only the difference. |
| Pitch Rush | a new career win (a finished fixture where the player's team, index 0, scored more), or a new trophy | 20 per win, 100 per trophy |
| Holdover | `stats.duelWins` goes up, or a mission completed for the first time | 20 per duel win, 40 per mission |
| Vibe Basketball | nothing: it saves nothing and sends nothing | none until a release adds results |

Milestones need extra care, because the save is easier to edit than a single result:
- **High-water marks:** XP is paid only above the highest value ever seen for each counter (`xp_progress_marks`). Resetting a save and winning again doesn't pay twice.
- **No XP for the first sync:** the first time an account's save reaches the server, including a guest import, set the marks to its values without awarding anything. Otherwise an old save, or an edited one, would pay out all at once.
- **At most 3 new wins per save:** games save after every change, so a real save never holds more than one or two new wins. Anything above 3 is counted towards the marks but not paid.
- **The daily limits in §6 apply too.**

## 5. Levels

XP needed to go from level *n* to *n* + 1 is **100 × *n***, so the total needed to reach level *n* is 50 × *n* × (*n* − 1).

| Level | Total XP | About how many 25 XP wins |
|---|---|---|
| 2 | 100 | 4 |
| 3 | 300 | 12 |
| 5 | 1,000 | 40 |
| 10 | 4,500 | 180 |
| 20 | 19,000 | 760 |
| 50 | 122,500 | 4,900 |

The early levels come fast, so new players see progress in their first session. Later levels take steadily longer, and with no cap a level always remains to reach. Store `level` in `user_xp` so pages don't recompute it, and recompute it whenever `total` changes.

## 6. Limits against farming and cheating

| Limit | Starting value | What happens over it |
|---|---|---|
| Daily XP per game | 300 | The result is still stored. Its XP is cut to what's left of the limit, and the row has `capped: true`. |
| Daily XP overall | 1,000 | Same |
| Gap between two paid results in one game | 20 seconds, set per game with `minGapSeconds` | The later result earns no XP. No real match is shorter. |
| Age of a result (`playedAt`) | 7 days | Older results are stored without XP, so a big offline queue can't pay out at once. |
| Implausible values | the module's `parseResult()` | The result is rejected, with no XP. |
| Results per hour | 120 (backend doc §10.5) | `429` |

The day resets at midnight in one fixed time zone for everyone (an open decision, §11). The website shows "Daily XP limit reached for Longbow" when an award comes back `capped`, so players don't think it's broken.

Support can correct abuse with an `adjustment` row, for example −500 with a reason. The total and level follow, and the original rows stay for the record.

## 7. API

The XP endpoints sit beside the per-game endpoints from the backend doc.

**On every result upload** (backend doc §5.8), each accepted result carries its XP, and the response carries the new totals:

```json
200
{ "accepted": [{ "resultId": "r-8c1e…", "won": true, "xp": 85, "capped": false,
                 "awards": [{ "rule": "win", "xp": 25 }, { "rule": "stars", "xp": 10 }, { "rule": "first-win", "xp": 50 }] }],
  "duplicates": [], "rejected": [],
  "xp": { "total": 1040, "level": 5, "levelUp": true } }
```

**On a save upload** (backend doc §5.5), for the §4.2 games, the response adds any milestone XP the same way: `"awards": […], "xp": {…}`.

**`GET /v1/me/xp`**: the player's XP, for the navbar and profile.

```json
200
{ "total": 1040, "level": 5, "levelStartsAt": 1000, "nextLevelAt": 1500,
  "today": { "xp": 180, "limit": 1000, "byGame": { "longbow": 120, "racer": 60 } } }
```

**`GET /v1/me/xp/events?limit=50&before=<cursor>`**: XP history, newest first, for a "How I earned it" list.

## 8. Website changes

| Change | Where |
|---|---|
| After a results or save upload, show "+85 XP" in the notice bar, and "Level 5!" on `levelUp`. It must never cover or pause the game. | [`game-frame.tsx`](../src/games/shared/components/game-frame.tsx), whose notice bar already exists |
| Show "Daily XP limit reached" when an award comes back `capped` | `game-frame.tsx` |
| Show the level and a progress bar to the next level | the navbar and the profile page, from `GET /v1/me/xp` |
| Guests: after a win, show once per visit "Log in to save your progress and earn XP" | `game-frame.tsx` |
| XP client: read the XP from upload responses, cache `GET /v1/me/xp` | the new `src/lib/progress/` from the backend doc |
| Analytics (optional): `web_xp_awarded` with `game_id`, `xp`, `rule`, and `web_level_up` with `level` | [`ga-events.md`](ga-events.md), plus the GTM setup |

Results upload right after a match when the player is online (backend doc §6.5), so the XP shows a moment after the match ends. Offline, it shows when the queue uploads later.

## 9. Changing the values later

- Keep each game's XP values in its module. Moving them to a database table later allows tuning without a deploy.
- Each award records the `rules_version` it was made under. When the values change, bump the version. **Never recompute past awards**: players keep what they earned, and the new values apply from then on.
- Watch, per game: average XP per player per day, the share of awards that hit a cap, and wins per hour. A game far above the others needs lower values or a longer `minGapSeconds`.

## 10. Rollout and tests

1. Build the tables and the XP part of the result upload, for the seven §4.1 games, behind a flag.
2. Add the notice bar message and the navbar level. Turn it on for internal accounts first.
3. Add the milestone XP for the §4.2 games one at a time, starting with the simplest counters (Football Chess, Hoop Legacy, Holdover duels).
4. Ask for `result` messages in the next release of each §4.2 game, and switch it to §4.1 rules when that ships.

Tests:
- A Longbow win → XP once. The same result sent again → `duplicates`, no more XP.
- The first win of a level → `first-win` bonus. A second win of that level → no bonus.
- A loss → no XP. A Rim Rush tie → no XP.
- 15 quick wins in one game in a day → XP stops at 300, and the rest come back `capped`.
- Two results 5 seconds apart → only the first pays.
- A result with `stars: 7` → `rejected`, no XP.
- A result with `playedAt` 10 days ago → stored, no XP.
- Football Chess save with `record.wins` 4 → 5 → 20 XP. Reset the save and win again (0 → 1) → no XP, because the mark is 5.
- First sync of an existing save with 40 wins → no XP; the marks are set to 40.
- A guest win → no XP, and the log-in prompt appears.
- `user_xp.total` always equals the sum of `xp_events`.

## 11. Open decisions

| Decision | Recommendation |
|---|---|
| XP for finishing a match without winning | Start with wins only, as asked. If players who lose a lot stop coming back, add 5 XP for finishing. |
| The XP amounts, daily limits and level curve | The starting values above, reviewed after two to four weeks |
| Which time zone the daily limit resets in | The time zone of most players (IST if they're mostly in India) |
| XP for progress made as a guest before logging in | None. The import sets the marks without paying, and guests see the log-in prompt instead. |
| Games without results: wait for result messages, or use save milestones meanwhile | Use milestones now for the simple counters, and ask for result messages in each game's next release |
| What levels unlock | Cosmetic only: badges, profile frames, titles. Never coins, prizes or money (§2). |
