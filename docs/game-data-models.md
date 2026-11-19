# Game data models

The exact data each game stores for a player, field by field, as TypeScript types. It covers every store key inside each game's save, the result it reports after a match, and the progress its server module returns.

This is the reference for writing the game modules in [game-progress-backend.md](game-progress-backend.md) §5.1 (`progress()` and `parseResult()`) and the XP rules in [xp-rewards.md](xp-rewards.md). Every shape was read from the game bundles in this repo on 19 November 2026. If a game is updated, check its section again.

## 1. How to read this

**What the server stores for each game is one envelope**, unchanged, exactly as the website sends it:

```ts
type Envelope = {
  schemaVersion: 1;
  /** The game's whole localStorage: key → string value. The sections below describe each key. */
  stores: Record<string, string>;
  /** Ids of results already reported, so a match is never reported twice. Last 1,000. */
  resultIds: string[];
};
```

Conventions used below:
- **Values are strings.** Each `stores` value is a string. Most are JSON, so `JSON.parse(stores[key])` gives the type shown. A key marked **plain text** is a bare string, not JSON.
- **Comments give limits**, like `// int 0–3`. These are the limits **the game itself checks** when it loads.
- **"Strict" or "lenient" says what the game does with a bad value.** A *strict* game rejects a store with any value out of range: it starts that game fresh and shows the save as incompatible. A *lenient* game replaces a bad value with its default and keeps the rest. A module's `progress()` must never throw on either; it returns `null` instead (backend doc §5.1).
- **Ids are listed in full** where the game has a fixed list, so modules can check them.
- **Missing keys are normal.** A key appears only once the game first writes it. An empty or missing store means the default shown.

### The shared results copy

Each game's bridge adds this key the first time the game reports a result. The seven games that never send results never have it.

```ts
// "statoz.bundle.results": JSON, the last 20 result payloads, oldest first.
type BundleResults = ResultPayload[];   // the game's own result type, in its section
```

## 2. Summary

| Game | Store keys | Strict? | Sends results | Personal data |
|---|---|---|---|---|
| [Penalty Cup](#penalty-cup) | 3 | strict | yes | no |
| [Hoop Legacy](#hoop-legacy) | 5 | no checks | no | **player's first and last name** |
| [Formula](#formula) | 4 (+1 old) | strict | yes | no |
| [Cricketer](#cricketer) | 1 | strict | yes | no |
| [Mini Golf](#mini-golf) | 1 | engine-owned | no | no |
| [5v5 Football Chess](#football-chess) | 4 (+2 old) | lenient | no | squad names |
| [Rally Dash](#rally-dash) | 1 | lenient | no | no |
| [Pitch Rush](#pitch-rush) | 9 | strict for progress | no | 3-letter initials |
| [Yorker](#yorker) | 1 | strict | yes | no |
| [Rim Rush](#rim-rush) | 1 | strict | yes | no |
| [Vibe Basketball](#vibe-basketball) | 0 | — | no | no |
| [Racer](#racer) | 3 | strict for career | yes | no |
| [Longbow](#longbow) | 1 | strict | yes | no |
| [Holdover](#holdover) | 2 | lenient | no | **callsign** |

---

## Penalty Cup

Catalogue id `penalty-cup`, bundle id `penalty-cup`.

| Store key | Format | Type |
|---|---|---|
| `penalty-cup.v1.guest` | JSON | `PenaltyCupSave` |
| `penalty-cup.v1.guest.backup` | JSON | `PenaltyCupSave`, the game's own backup copy, used if the main one can't be read |
| `penalty-cup.settings.v1` | JSON | `PenaltyCupSettings` |

The `guest` in the key is the game's `storageScope`, which the website never sends. Keep it as is (backend doc §8).

```ts
type PenaltyCupSave = {
  version: 2;                  // version 1 saves are upgraded on load
  revision: number;            // int ≥ 0
  active: CupRun | null;       // the cup being played
  history: CupRun[];           // finished cups, at most 12
};

type NationId = string;        // one of the game's 48 nations, e.g. "ARG"
type CupStage = "group" | "round32" | "round16" | "quarter" | "semi" | "bronze" | "final";
type CupStatus = "active" | "eliminated" | "champion" | "runner-up" | "third" | "fourth";

type CupRun = {
  version: 2;
  dataVersion: number;         // the game's nation data version; must match the release
  id: string;                  // ≤ 100 chars
  team: NationId;              // the player's nation
  stage: CupStage;
  status: CupStatus;
  seed: number;                // int ≥ 0
  day: 0 | 1 | 2;              // match day within the group stage
  updatedAt: string;           // ISO date
  fixtures: Fixture[];         // 72–104: exactly 72 group matches (12 groups of 4), then knockouts
  pending?: {                  // a match played but not yet confirmed
    id: string;
    score: [number, number];   // player, opponent
    outcome: "win" | "draw" | "loss";   // draws only in the group stage
    kicks: Kick[];             // ≤ 500
  };
  checkpoint?: { id: string; match: MatchCheckpoint } | null;   // a match in progress
};

type Fixture = {
  id: string;                  // unique within the cup
  stage: CupStage;
  home: NationId;
  away: NationId;              // never equal to home
  seed: number;
  attempts: number;            // int ≥ 0
  day: 0 | 1 | 2;
  score?: [number, number];    // home, away. Group: each ≤ 5. Knockout: never level.
  winner?: NationId;           // set with score, unless a group draw
};

type MatchCheckpoint = {
  version: 1;
  seed: number;                // uint32
  tick: number;                // int ≥ 0
  randomState: number;         // uint32
  level: number;               // int 1–12, set by the stage
  kicks: Kick[];               // 1–500, alternating shooting and keeping
};

type Kick = {
  id: number;                  // 1, 2, 3… in order
  role: "shooting" | "keeping";   // odd ids shoot, even ids keep
  outcome: "goal" | "saved" | "wide" | "over" | "woodwork";
  style: "driven" | "placed" | "chip";
  power: number;
  composure: number;
  target: { x: number; y: number };
  contacts: unknown[];
  flightSeconds: number;
};

type PenaltyCupSettings = {
  effects: number;             // volume 0–1, default 0.65
  crowd: number;               // default 0.45
  music: number;               // default 0.55
  muted: boolean;
  reducedMotion: boolean;
};
```

**Result:**

```ts
type PenaltyCupResult =
  | { id: string; mode: "random"; outcome: "win" | "draw" | "loss"; score: [number, number] }
  | { id: string; mode: "cup"; team: NationId; outcome: Exclude<CupStatus, "active"> };  // sent once, when a cup ends
```

**Progress:**

```ts
type PenaltyCupProgress = {
  cupsPlayed: number;          // history.length
  cupsWon: number;             // history with status "champion"
  bestFinish: Exclude<CupStatus, "active"> | null;   // best status in history
  activeCup: { team: NationId; stage: CupStage } | null;
};
```

---

## Hoop Legacy

Catalogue id `hoop-legacy`, bundle id `hoop-legacy`. **No checks:** the game loads any store with `version: 1` as it is, so the module must check every field it reads.

| Store key | Format | Type |
|---|---|---|
| `hoop-legacy:career:0`, `:1`, `:2` | JSON | `HoopCareer`, one per career slot; missing when the slot is empty |
| `hoop-legacy:settings` | JSON | `HoopSettings` |
| `hoop-legacy:records` | JSON | `HoopRecords` |
| `statoz.bundle.results` | JSON | never written, because the game sends no results |

```ts
type HoopCareer = {
  version: 1;
  slot: 0 | 1 | 2;
  createdAt: number;           // ms since 1970
  updatedAt: number;
  player: HoopPlayer;          // the player's own build
  level: number;
  xp: number;                  // the game's own XP, not site XP
  sp: number;                  // skill points, start 8
  coins: number;               // in-game only, start 400
  followers: number;           // start 120
  chapter: "blacktop" | "circuit" | "combine" | "pro";
  difficulty: "rookie" | "pro" | "allstar" | "superstar" | "hof";
  blacktop: { ladder: HoopPlayer[]; beaten: number };   // 5 park kings; beaten 0–5
  circuit: {
    recruits: HoopPlayer[];    // 6 offered
    teammates: string[];       // ids of the 2 recruits picked
    bracket: unknown | null;   // the 3v3 tournament while it runs
    runs: number;
  };
  combine: { threeScore: number | null; oneOnOne: unknown | null; pick: number | null; teamId: string | null };
  pro: unknown | null;         // the Pro Hoops League career, once reached
  stats: {
    career: HoopStatLine & { gp: number; w: number; l: number };
    season: HoopStatLine & { gp: number; w: number; l: number };
    log: HoopGameLog[];        // last 40 games, newest first
    highs: { pts: number; reb: number; ast: number; stl: number; blk: number; tpm: number };
  };
  trophies: unknown[];
  inbox: { id: string; from: string; title: string; body: string; read: boolean; at: number }[];
  inventory: {
    owned: string[];           // item ids, start ["shoe_street"]
    shoes: string;
    headband: string | null;
    armSleeve: string | null;
    legSleeve: string | null;
    wristbands: string | null;
  };
  legacy: number;              // the career's legacy score
  endorsements: unknown[];
  trainedSinceGame: boolean;
  hallOfFame: boolean;
};

type HoopPlayer = {
  id: string;                  // "me" for the player
  firstName: string;           // typed by the player for their own build: personal data
  lastName: string;
  number: number;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  heightCm: number;
  attributes: Record<string, number>;
  badges: Record<string, number>;
  appearance: Record<string, unknown>;
  archetype: string;
};

type HoopStatLine = {
  pts: number; fgm: number; fga: number; tpm: number; tpa: number; ast: number; reb: number;
  stl: number; blk: number; tov: number; dunks: number; greens: number; ftm: number; fta: number;
};

type HoopGameLog = {
  id: string; label: string; opp: string; won: boolean;
  score: string;               // "21-15"
  stats: unknown; simmed: boolean;
};

type HoopSettings = {          // any key may be missing; the game fills defaults
  quality: string;             // default "auto"
  resolution: number; shake: boolean; sfx: number; crowd: number; music: number;
  vibration: boolean; hints: boolean; difficulty: string; leftHanded: boolean;
  commentary: number; captions: boolean; camera: string;   // default "broadcast"
};

type HoopRecords = { contestBest: number; quickWins: number; quickLosses: number };
```

**Result:** none.

**Progress:**

```ts
type HoopLegacyProgress = {
  slots: ({ slot: 0 | 1 | 2; level: number; chapter: HoopCareer["chapter"]; legacy: number;
            hallOfFame: boolean; careerWins: number /* stats.career.w */ } | null)[];   // always 3
  contestBest: number;
  quickWins: number;
  quickLosses: number;
};
```

Leave the player's name out of progress. It's the largest save of all the games: `stats.log` is capped at 40, but `inbox` keeps growing.

---

## Formula

Catalogue id `formula`, bundle id **`portfolio-formula`**. Strict.

| Store key | Format | Type |
|---|---|---|
| `statoz.portfolio-formula.career.v1` | JSON | `FormulaCareer` |
| `statoz.portfolio-formula.career.v1.backup` | JSON | `FormulaCareer`, the game's own backup |
| `statoz.portfolio-formula.records.v2` | JSON | `FormulaRecords` |
| `statoz.portfolio-formula.records.v1` | JSON | older records, moved into v2 once as the `night` circuit |
| `statoz.portfolio-formula.settings.v1` | JSON | `FormulaSettings` (lenient) |
| `statoz.bundle.results` | JSON | `FormulaResult[]` |

```ts
type CarSlug = string;         // one of the game's 8 cars, e.g. "statoz"
type FormulaCircuit = "night" | "harbor" | "switchback";

type FormulaCareer = {
  version: 1;
  serial: number;              // int 0–1e9, counts championships started
  unlockedTier: 0 | 1 | 2 | 3; // Rookie, Club, Pro, Champion
  best: [FormulaFinish, FormulaFinish, FormulaFinish, FormulaFinish];   // per tier
  active: FormulaChampionship | null;
};
type FormulaFinish = number | null;   // best championship position 1–8, null if none finished

type FormulaChampionship = {   // 3 races, one per circuit, in order; points 10-8-6-5-4-3-2-1
  id: number;                  // 1..serial
  tier: 0 | 1 | 2 | 3;         // ≤ unlockedTier
  slug: CarSlug;               // the player's car
  seed: number;                // uint32
  results: {                   // ≤ 3
    eventId: string;           // `${id}:${index}`
    circuit: FormulaCircuit;   // night, harbor, switchback in that order
    order: CarSlug[];          // all 8 cars in finishing order
  }[];
};

type FormulaRecords = {
  version: 2;
  circuits: Partial<Record<FormulaCircuit, Record<CarSlug, {
    lap?: number;                                   // best lap time, > 0
    races?: Partial<Record<"1" | "3" | "5", number>>;   // best race time by lap count, > 0
  }>>>;
};

type FormulaSettings = {
  circuit: FormulaCircuit;     // default "night"
  paint: -1 | 0 | 1 | 2 | 3;   // -1 = car's own paint; 0–3 = a tier's paint, once earned
  laps: 1 | 3 | 5;
  difficulty: "easy" | "medium" | "hard";
  sound: boolean;
  autoThrottle: boolean;
  camera: "chase" | "onboard";
  racingLine: boolean;
};
```

A tier unlocks when the player finishes a championship in the top 3.

**Result:**

```ts
type FormulaResult = {
  id: string; carId: CarSlug; position: number; time: number; laps: 1 | 3 | 5; bestLap: number;
  mode: "quick" | "career"; circuit: FormulaCircuit; careerEventId?: string;
};
```

**Progress:**

```ts
type FormulaProgress = {
  unlockedTier: 0 | 1 | 2 | 3;
  tierName: "Rookie" | "Club" | "Pro" | "Champion";
  bestFinishPerTier: [FormulaFinish, FormulaFinish, FormulaFinish, FormulaFinish];
  bestLaps: Partial<Record<FormulaCircuit, number>>;   // fastest lap on each circuit, any car
};
```

---

## Cricketer

Catalogue id `cricketer`, bundle id `cricketer`. Strict.

| Store key | Format | Type |
|---|---|---|
| `cricketer.progress.v1` | JSON | `CricketerSave` |
| `statoz.bundle.results` | JSON | `CricketerResult[]` |

```ts
type CricketerLessonId = "lesson-direction" | "lesson-timing" | "lesson-mixed";
type CricketerChaseId = `chase-${1|2|3|4|5|6|7|8|9|10|11|12}`;   // 12 chases, 3 tiers of 4

type CricketerSave = {
  schemaVersion: 1;
  lessons: CricketerLessonId[];          // lessons passed
  unlocked: number;                      // int 0–11: highest chase unlocked
  best: Partial<Record<CricketerChaseId | CricketerLessonId, number>>;   // best runs, int 0–72
  sound: boolean;
  reducedMotion: boolean;
  checkpoint: {                          // a chase in progress
    challengeId: CricketerChaseId | CricketerLessonId;
    initialSeed: number;                 // uint32
    seed: number | null;
    results: CricketerBall[];            // ≤ the chase's balls
  } | null;
  resultId: string | null;
};

type CricketerBall = {
  runs: 0 | 1 | 2 | 3 | 4 | 6;
  feedback: string;                      // < 60 chars, the game's own text
  quality: number;                       // 0–1
  offset: number | null;
  shot: "drive" | "cut" | "pull" | "hook" | "sweep" | "scoop";
  caught: boolean;
};
```

**Result:**

```ts
type CricketerResult = {
  id: string; game: "cricketer"; challengeId: string;
  score: number; target: number; balls: number; won: boolean;
};
```

**Progress:**

```ts
type CricketerProgress = { lessonsDone: number; challengesUnlocked: number; bestScores: Record<string, number> };
```

---

## Mini Golf

Catalogue id `mini-golf`, bundle id `mini-golf`. The engine's own file, not checked by the game.

| Store key | Format | Type |
|---|---|---|
| `mini-golf.storage` | JSON | `MiniGolfStorage`, the engine's `storage.json` file as text |

```ts
/** Every value is a number. Keys appear as the player reaches them. */
type MiniGolfStorage = {
  [hole: `stroke_count_level_${number}`]: number;   // 0–19: best strokes on that hole, ≥ 1
  seen_tutorial_0?: number;                          // tutorial screens already shown
  seen_tutorial_1?: number;
};
```

A hole counts as cleared when its `stroke_count_level_N` is present and at least 1. Holes unlock in order.

**Result:** none.

**Progress:** reuse `parseMiniGolfProgress` from [`progress.ts`](../src/games/mini-golf/components/progress.ts):

```ts
type MiniGolfProgress = {
  holesCleared: number; holes: 20; totalStrokes: number;
  aces: number;                // holes with a best of 1
  nextHole: number | null;     // first uncleared hole, null when all are cleared
};
```

---

## Football Chess

Catalogue id `football-chess`, bundle id `football-chess`. Lenient: bad values become defaults.

| Store key | Format | Type |
|---|---|---|
| `statoz.next.games.football-chess.v2` | JSON | `FootballChessSave` |
| `statoz.next.games.footballchess.v1` | JSON | older record, moved into v2 once |
| `statoz.next.games.economy.v1` | JSON | `FootballChessEconomy` |
| `statoz.next.games.decks.v2` | JSON | `FootballChessDecks` |
| `statoz.next.games.decks.v1` | JSON | older decks, moved into v2 once |
| `statoz.next.games.packs.v1` | JSON | card packs opened; the shape belongs to the platform code built into the game |

The economy, deck and pack keys come from the original StatOz platform code inside this game. Here they're **this game's private copy**, not a site-wide wallet (backend doc §10.3).

```ts
type FootballChessRecord = {
  played: number;              // always wins + draws + losses
  wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number;
  currentStreak: number;       // ≤ bestStreak
  bestStreak: number;          // ≤ wins
};

type FootballChessSave = {
  version: 2;
  revision: number;
  settings: { sound: boolean; evalBar: boolean };
  tutorial: "new" | "inProgress" | "done" | "skipped";
  record: FootballChessRecord;
  byMode: { quick: FootballChessRecord };
  quick: {
    difficulty: "easy" | "medium" | "hard";
    formation: "box" | "diamond" | "attacking" | "defensive";
    length: "short" | "standard" | "long";   // 12, 20 or 28 actions per half
  };
  history: FootballChessMatch[];   // newest 30
  settled: string[];               // match ids already counted, last 60
  migratedFrom: 1 | null;
};

type FootballChessMatch = {
  id: string;                  // ≤ 80 chars
  at: string;                  // ≤ 40 chars, a date
  mode: "quick";
  opponent: string;            // ≤ 40 chars
  difficulty: "easy" | "medium" | "hard";
  personality: "balanced" | "parkTheBus" | "tikiTaka" | "gegenpress" | "longBall" | "maverick";
  scored: number;              // 0–99
  conceded: number;            // 0–99
  result: "W" | "L" | "D";     // worked out from the score
};

type FootballChessEconomy = {
  version: 1;
  coins: number;               // in-game only, starts at 1,000. A match pays 50 (win), 20 (draw), 10 (loss).
  owned: {
    playerCardIds: string[]; actionCardIds: string[]; avatarIds: string[]; bannerIds: string[];
    frameIds: string[]; kitIds: string[]; jerseyIds: string[]; liveryIds: string[];
  };
  equipped: {
    avatarId: string; bannerId: string; frameId: string | null;
    kitId: string; jerseyId: string; liveryId: string;
  };
  starterClaims: Record<string, unknown>;
  dailyDropLastClaimedAt: string | null;
  transactions: { id: string; at: string; kind: string; delta: number; balanceAfter: number; title: string }[];
  settledRewardIds: string[];
};

type FootballChessDecks = {
  version: 2;
  activeDeckId: string;        // default "slot-1"
  slots: {
    id: string;
    name: string;              // default "My Squad"; may be renamed by the player
    loadouts: {
      football?: { sport: "football"; attackers: string[] /* ≤ 2 */; defenders: string[] /* ≤ 2 */;
                   keeperId: string | null; actionCardIds: string[] /* ≤ 6 */ };
      cricket?: { sport: "cricket"; batterIds: string[] /* ≤ 5 */ };
      basketball?: { sport: "basketball"; playerIds: string[] /* ≤ 3 */; starterId: string | null };
      tennis?: { sport: "tennis"; [key: string]: unknown };
    };
  }[];
};
```

**Result:** none. `history` holds each match's id and score, which is the best source for XP without results (xp-rewards.md §4.2).

**Progress:**

```ts
type FootballChessProgress = Omit<FootballChessRecord, "goalsFor" | "goalsAgainst">;
```

---

## Rally Dash

Catalogue id `rally-dash`, bundle id **`grand-prix-dash`**. Lenient. If a save has a newer `version` or `rulesVersion`, the game won't overwrite it.

| Store key | Format | Type |
|---|---|---|
| `statoz.next.games.rally-dash.v1` | JSON | `RallyDashSave` |

```ts
type RallyStage = "pine-ridge" | "red-mesa" | "frostvale" | "harbour-hill" | "mudbank-farm";
type RallyRecordKey = `${RallyStage}:${"auto" | "manual"}:${"assist" | "free"}`;   // throttle, brakes
type RallyMedal = "gold" | "silver" | "bronze";

type RallyDashSave = {
  version: 1;
  rulesVersion: 1;
  setup: {
    version: 1;
    mode: "stage" | "rallycross";
    stage: RallyStage;
    crew: number;              // index into the game's crews
    rivals: "rookie" | "pro" | "legend";
    laps: 3 | 5;
    autoThrottle: boolean; brakeAssist: boolean; noteSounds: boolean; vibration: boolean; muted: boolean;
    camera: "chase" | "map";
    engineVolume: number;      // 0–1
    effectsVolume: number;     // 0–1
    touchSize: number;         // 52–96
    touchOpacity: number;      // 0.2–1
  };
  records: Partial<Record<RallyRecordKey, {   // the game reads at most 40
    best: number;              // seconds, > 10
    splits: [number, number, number, number];
    ghost: RallyGhost | null;  // the replay of the best run
    medal: RallyMedal | null;
  }>>;
  recent: RallyRun[];          // last 12 runs
  tutorialSeen: boolean;
};

type RallyGhost = {
  version: 1; rulesVersion: 1;
  key: RallyRecordKey;         // must match its record
  time: number;                // 10–1200 seconds
  samples: { t: number; x: number; y: number; heading: number }[];   // 2–12,002; t rising
  splits: [number, number, number, number];
};

type RallyRun = {
  version: 1; rulesVersion: 1;
  id: string;
  mode: "stage" | "rallycross";
  stage: RallyStage;
  crew: number;
  position: number;            // 1 = won
  fieldSize: number;
  elapsed: number;
  best: number | null;
  laps: number;
  medal: RallyMedal | null;
  status: "finished" | "retired";
  classification: unknown[];
};
```

**Result:** none. `recent` holds each run's `id`, `position` and `medal`, which makes it the best source for XP without results (xp-rewards.md §4.2).

**Progress:**

```ts
type RallyDashProgress = {
  medals: { gold: number; silver: number; bronze: number };   // each stage's best medal, counted once
  stagesWithMedal: number;     // of 5
};
```

**Size:** ghosts are the biggest part of this save. With 20 possible records, each holding up to 12,002 samples, a player with many records could approach the 512 KB cap. This is worth testing with a long session.

---

## Pitch Rush

Catalogue id `pitch-rush`, bundle id `pitch-rush`. The progress key is strict; the arcade keys from the original engine are lenient.

| Store key | Format | Type |
|---|---|---|
| `statoz.pitch-rush.progress.v1` | JSON | `PitchRushSave` |
| `statoz.pitch-rush.progress.v1.backup` | JSON | `PitchRushSave`, the game's own backup |
| `websoccer.highscores.v1` | JSON | `PitchRushHighScores` |
| `websoccer.name` | plain text | the last initials entered, 3 characters |
| `websoccer.lineup.0`, `websoccer.lineup.1` | JSON | `{ key: string; spots: { x: number; y: number }[] }`, each side's formation |
| `websoccer.music` | plain text | `"off"` when music is off |
| `websoccer.commentary` | plain text | `"off"` when commentary is off |
| `websoccer.bindings` | JSON | two players' key bindings: `Record<string, string>[]`, action → key code |

```ts
type PitchRushSave = {
  version: 1;
  tutorial: { status: "new" | "skipped" | "completed"; completed: (0 | 1 | 2)[] };   // drills done
  career: PitchRushCareer | null;
  activeMatch: { fixtureId: string; state: PitchRushMatchState } | null;   // only for the player's unplayed fixture this round
};

type PitchRushCareer = {
  season: {
    division: 0 | 1 | 2 | 3;   // 3 is the top division
    number: number;            // season number, ≥ 1
    round: 0 | 1 | 2 | 3 | 4 | 5;   // 5 = season over
    seed: number;
    rounds: {                  // exactly 5 rounds of 3 fixtures; 6 clubs, each pair meets once
      id: string;
      home: number;            // club index 0–5; 0 is the player's club
      away: number;
      score: [number, number] | null;   // set for rounds already played, else null
    }[][];
    summary: { rank: number; promoted: boolean; champion: boolean } | null;   // set when round is 5
  };
  unlocked: 0 | 1 | 2 | 3 | 4;       // kits unlocked
  kit: "blue" | "regional" | "national" | "premier" | "champion";   // must be unlocked
  badge: number;                     // ≤ unlocked
  champion: boolean;
  trophies: [number, number, number, number];   // per division
  history: { division: number; number: number; rank: number; promoted: boolean; champion: boolean }[];   // ≤ 20 seasons
};

/** The full simulation, so a match can resume exactly. */
type PitchRushMatchState = {
  tick: number; rng: number; seed: number;
  phase: "kickoff" | "play" | "goal" | "restart" | "halftime" | "fulltime";
  phaseTimer: number;
  half: 1 | 2;
  halfTick: number;
  score: [number, number];           // each 0–999
  config: { halfTicks: number; [key: string]: unknown };
  ball: {
    x: number; y: number; z: number; vx: number; vy: number; vz: number;
    owner: PitchRushPlayerRef | null; lastTouch: PitchRushPlayerRef | null; kicker: PitchRushPlayerRef | null;
  };
  teams: [PitchRushTeam, PitchRushTeam];
  [key: string]: unknown;
};
type PitchRushPlayerRef = { team: 0 | 1; idx: number };   // idx 0–10
type PitchRushTeam = {
  controlled: number;                // 0–10
  attackDir: -1 | 1;
  ai: unknown;
  formation: unknown[];              // 11
  players: { x: number; y: number; vx: number; vy: number; dirX: number; dirY: number;
             charge: number; slide: number; down: number; cooldown: number }[];   // 11
};

/** Top 10 per difficulty, best first. Only wins and draws qualify. */
type PitchRushHighScores = Record<"easy" | "normal" | "hard", {
  id: string;                        // ≤ 40 chars
  name: string;                      // 3 characters from A–Z, 0–9 and "-"
  scored: number;                    // 0–99, ≥ conceded
  conceded: number;
  halfSeconds: number;               // 1–600
  at: number;                        // ms since 1970
}[]>;
```

**Result:** none. A career win is a fixture where club 0 scored more, and it's readable from `career.season.rounds` (xp-rewards.md §4.2).

**Progress:**

```ts
type PitchRushProgress = {
  tutorialDone: boolean;
  division: 0 | 1 | 2 | 3 | null;    // null before a career starts
  season: number | null;
  trophies: number;                  // sum of career.trophies
  champion: boolean;
};
```

---

## Yorker

Catalogue id `yorker`, bundle id `yorker`. Strict.

| Store key | Format | Type |
|---|---|---|
| `yorker.progress.v1` | JSON | `YorkerSave` |
| `statoz.bundle.results` | JSON | `YorkerResult[]` |

```ts
type YorkerSpellId = `spell-${1|2|3|4|5|6|7|8|9|10|11|12}`;
type YorkerLessonId = "lesson-length" | "lesson-release" | "lesson-swing" | "lesson-stumps" | "lesson-spin";
type YorkerDelivery =
  | "seam" | "outswing" | "inswing" | "slower"           // pace
  | "legbreak" | "googly" | "topspin" | "slider";        // spin

type YorkerSave = {
  schemaVersion: 1;
  spells: Partial<Record<YorkerSpellId, {
    stars: 0 | 1 | 2 | 3;
    best: number | null;     // fewest runs conceded in a win, 0–999
    plays: number;
    wins: number;
  }>>;
  lessons: YorkerLessonId[];     // Academy lessons passed
  unlocked: number;              // int 0–11: highest spell unlocked
  bowler: "pace" | "spin";
  sound: boolean;
  reducedMotion: boolean;
  assist: boolean;
  checkpoint: {                  // a spell in progress
    challengeId: string;         // a spell, a lesson or "quick"
    bowler: "pace" | "spin";
    initialSeed: number;         // uint32
    quickSeed: number | null;
    inputs: {                    // ≤ 80, one per ball bowled
      delivery: YorkerDelivery;  // must belong to the bowler
      target: { x: number; z: number };   // x −2–2, z −14–0
      field: "attack" | "balanced" | "defend";
      meter: number;             // −1–3
      assist: boolean;
      review?: boolean;
    }[];
  } | null;
  resultId: string | null;
  stats: {
    balls: number; wickets: number; runs: number;
    fastest: number;             // 0–200, the fastest ball's speed
    perfect: number;             // perfect-timed deliveries
  };
};
```

**Result:**

```ts
type YorkerResult = {
  id: string; game: "yorker"; challengeId: string;
  won: boolean; stars: number; runs: number; wickets: number; balls: number;
};
```

**Progress:**

```ts
type YorkerProgress = { stars: number /* sum over spells */; maxStars: 36; lessonsDone: number; lessons: 5; wickets: number };
```

---

## Rim Rush

Catalogue id `rim-rush`, bundle id `rim-rush`. Strict.

| Store key | Format | Type |
|---|---|---|
| `rim-rush.progress.v1` | JSON | `RimRushSave` |
| `statoz.bundle.results` | JSON | `RimRushResult[]` |

```ts
type RimRushCup = "street" | "city" | "champions";       // must be won in this order
type RimRushRival = "milo" | "tess" | "rafa" | "june" | "dex" | "kai" | "zara" | "otto" | "nova";
type RimRushOutfit = "sunset" | "chalk" | "forest" | "harbour" | "cherry" | "midnight";
type RimRushBall = "classic" | "playground" | "glacier" | "lime" | "flag" | "gold";

type RimRushSave = {
  schemaVersion: 1;
  coins: number;               // in-game only, int 0–10,000,000
  owned: {
    outfits: RimRushOutfit[];  // ≤ 64, no repeats, always includes "sunset"
    balls: RimRushBall[];      // always includes "classic"
  };
  outfit: RimRushOutfit;       // must be owned
  ball: RimRushBall;           // must be owned
  cups: Partial<Record<RimRushCup, { round: 0 | 1 | 2; titles: number }>>;   // round: quarter, semi, final
  rivals: Partial<Record<RimRushRival, { played: number; won: number }>>;     // won ≤ played
  best: number;                // best score, 0–999
  totals: { makes: number; swishes: number; banks: number; blocks: number };   // swishes and banks ≤ makes
  sound: boolean;
  reducedMotion: boolean;
  resultId: string | null;     // ≤ 64 chars
};
```

**Result:**

```ts
type RimRushResult = {
  id: string; game: "rim-rush"; mode: string; rival: RimRushRival; court: string;
  cup: RimRushCup | null; round: number | null;
  score: number; rivalScore: number; won: boolean; tied: boolean;
  coins: number;               // what the match paid in-game; never use for site rewards
};
```

**Progress:**

```ts
type RimRushProgress = {
  cupsWon: number;             // sum of cups[].titles
  rivalsBeaten: number;        // rivals with won ≥ 1
  best: number;
  itemsOwned: number;          // outfits + balls
};
```

---

## Vibe Basketball

Catalogue id `vibe-basketball`. The game never uses storage and sends no results, so there's nothing to store and no data model. Its module only says `saves: false` (backend doc §5.2).

---

## Racer

Catalogue id `racer`, bundle id **`f1-racing`**. The career key is strict; the others are lenient.

| Store key | Format | Type |
|---|---|---|
| `racer.career.progress.v1` | JSON | `RacerCareer` |
| `racer.silverstone.progress.v1` | JSON | `RacerQuickRace` |
| `racer.settings.v1` | JSON | `RacerSettings` |
| `statoz.bundle.results` | JSON | `RacerResult[]` |

```ts
type RacerStageId = `race-${1|2|3|4|5|6|7|8|9|10|11|12}`;   // 3 tiers of 4: Rookie, Club, Grand Prix

type RacerCareer = {
  schemaVersion: 1;
  records: Partial<Record<RacerStageId, {
    stars: 0 | 1 | 2 | 3;      // always matches bestPosition: 1st = 3, 2nd = 2, 3rd = 1, else 0
    bestPosition: number;      // 1 to the stage's grid size
    bestTime: number;          // seconds, > 0
    attempts: number;          // ≥ 1
  }>>;
  selected: RacerStageId;      // must be unlocked
};
// A stage unlocks when the one before it has at least 1 star. The game rejects records for locked stages.

type RacerQuickRace = {
  schemaVersion: 1;
  best: number | null;         // best time in seconds
  races: number;
  wins: number;
};

type RacerSettings = {
  schemaVersion: 1;
  sound: boolean;
  reducedShake: boolean;
  difficulty: "rookie" | "pro" | "elite";
  chassis: "race" | "race-future";
};
```

**Result:**

```ts
type RacerResult = {
  id: string; game: "racer"; mode: "career" | "quick-race";
  circuit: string; difficulty: "rookie" | "pro" | "elite";
  position: number; time: number; laps: number; contacts: number; overtakes: number;
  stageId?: RacerStageId; stars?: 0 | 1 | 2 | 3;   // career races only
};
```

**Progress:**

```ts
type RacerProgress = { careerStars: number; maxStars: 36; racesFinished: number; quickRaceWins: number; quickRaceBest: number | null };
```

---

## Longbow

Catalogue id `longbow`, bundle id `longbow`. Strict.

| Store key | Format | Type |
|---|---|---|
| `longbow.progress.v1` | JSON | `LongbowSave` |
| `statoz.bundle.results` | JSON | `LongbowResult[]` |

```ts
type LongbowLevelId = `level-${string}`;   // level-01 to level-30: 3 ranges of 10
type LongbowRival = "wren" | "tamsin" | "odette";

type LongbowSave = {
  schemaVersion: 1;
  stars: Partial<Record<LongbowLevelId, 0 | 1 | 2 | 3>>;
  best: Partial<Record<LongbowLevelId, number>>;   // best score, 0 to the level's arrows × 10
  rivals: Partial<Record<LongbowRival, {
    played: number;            // 0–1,000,000
    won: number;               // ≤ played
    best: number;              // 0–150
  }>>;
  sound: boolean;
  reducedMotion: boolean;
  checkpoint: {                // a level or match in progress
    mode: "career" | "match";
    id: LongbowLevelId | LongbowRival;
    initialSeed: number;       // uint32
    results: LongbowArrow[];   // arrows shot so far, ≤ the total
  } | null;
  resultId: string | null;     // ≤ 64 chars
};

type LongbowArrow = {
  shooter: "player" | "ai";    // in a match, every second arrow is the rival's
  score: number;               // 0–10; 0 exactly when miss
  x: boolean;                  // inner ten; only with score 10
  miss: boolean;
  px: number;                  // where it hit, −20 to 20
  py: number;
};
```

A range unlocks with 20 stars in the range before it.

**Result:**

```ts
type LongbowResult = {
  id: string; game: "longbow"; mode: "career" | "match";
  challengeId: LongbowLevelId | LongbowRival;
  score: number; rivalScore: number | null; stars: number; won: boolean;
};
```

**Progress:**

```ts
type LongbowProgress = { careerStars: number; maxStars: 90; rivalsBeaten: number /* of 3 */ };
```

---

## Holdover

Catalogue id `holdover`, bundle id `holdover`. Lenient: values out of range are clamped or reset to defaults.

| Store key | Format | Type |
|---|---|---|
| `holdover.profile.v1` | JSON | `HoldoverProfile` |
| `holdover.hud.details` | plain text | `"1"` when the detailed HUD is on |
| `statoz.bundle.results` | JSON | never written, because the game sends no results |

```ts
type HoldoverMission = "op01" | "op02" | "op03" | "op04" | "op05" | "op06" | "op07" | "op08";

type HoldoverProfile = {
  version: 1;
  callsign: string;            // typed by the player: personal data. A–Z, 0–9, space, _ and -; 2–16 chars; default "Ghost-6"
  xp: number;                  // the game's own XP, not site XP; capped at level 20
  missions: Partial<Record<HoldoverMission, {
    completed: boolean;
    stars: 0 | 1 | 2 | 3;
    bestScore: number;
    bestTime: number | null;
    attempts: number;
  }>>;
  stats: {
    kills: number; headshots: number; shotsFired: number; shotsHit: number; longestShot: number;
    missionsCompleted: number;
    duelMatches: number; duelWins: number; duelLosses: number;
    duelRoundsWon: number; duelRoundsLost: number; duelStreak: number; bestDuelStreak: number;
    playSeconds: number;
  };
  loadout: {
    rifle: "ranger" | "whisper" | "longbow" | "anvil";
    camo: "factory" | "desert" | "woodland" | "arctic" | "urban" | "tiger" | "obsidian";
    reticle: "mildot" | "duplex" | "horseshoe" | "tree";
  };
  settings: {
    sensitivity: number;       // 0.2–3
    scopedSensitivity: number; // 0.2–2
    invertY: boolean;
    scopeMode: "hold" | "toggle";
    ballisticAssist: boolean;
    hints: boolean;
    killCam: "final" | "always" | "off";
    quality: "high" | "balanced" | "performance";
    fov: number;               // 55–90
    reduceShake: boolean;
    reduceFlashing: boolean;
    masterVolume: number;      // 0–1
    sfxVolume: number;
    musicVolume: number;
  };
  duel: { arena: "oldtown" | "depot" | "ridge"; difficulty: "recruit" | "veteran" | "elite"; rounds: 3 | 5 | 7 };
  createdAt: number;           // ms since 1970
};
```

The game's rank comes from `xp`. Each level needs 500 + 250 × (level − 1) XP, up to level 20, and each level has a rank name, from "Recruit" up.

**Result:** none. `stats.duelWins` and `missions[].completed` are the sources for XP without results (xp-rewards.md §4.2).

**Progress:**

```ts
type HoldoverProgress = {
  rank: string; level: number;     // worked out from xp as above
  operationsCompleted: number; operations: 8;
  duelWins: number; duelLosses: number; bestDuelStreak: number;
};
```

Leave `callsign` out of progress and out of analytics.

---

## 3. Using these types on the server

- **Parse defensively.** Start every `progress()` with `try`, check `version` or `schemaVersion`, and return `null` if it doesn't match. A new game release may change a format before its module is updated.
- **Never rewrite a store.** The server stores the envelope exactly as received. These types are for reading only.
- **Check results against these types.** `parseResult()` should accept exactly the shape above and the ids listed, so impossible values never reach XP.
- **Personal data:** Hoop Legacy's player name, Holdover's callsign, Pitch Rush's initials and Football Chess's squad names are typed by players. Never put them in progress, analytics or public pages, and include them in data export (backend doc §10.4).
- **Keep this document in step with the games.** When a game's release changes a store's version, add the new type here beside the old one, and update the module to read both.
