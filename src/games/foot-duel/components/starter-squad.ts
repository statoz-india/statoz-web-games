/**
 * A first-time Foot Duel player's squad, from the StatOz random roster API instead of the
 * game's debut XI pack reveal.
 *
 * The bundle skips the reveal once the "pitch-duel-debut-xi" grant is settled in its economy
 * save, and plays the saved club when every place holds a card the player owns. So the host
 * writes the economy (the API's players owned, the grant settled) and the career (those players
 * seated in a 4-3-3). Card stats come from the bundle's own catalogue, which holds every player
 * the API returns. A third store keeps each player's photo URL from the API, which the patched
 * bundle shows on their card (see build-foot-duel.mjs).
 */

const ROSTER_URL = "https://api.statoz.in/api/v1/public-api/player-cards/football/random";
const ROSTER_TIMEOUT_MS = 20_000;
/** The bundle's stores and debut grant id (from the "pitch-duel" release). */
const ECONOMY_KEY = "statoz.next.games.economy.v1";
const CAREER_KEY = "statoz.next.games.pitch-duel.v4";
/** Host-owned: player id → photo URL. Read by the patched bundle's portrait lookup. */
const PORTRAITS_KEY = "foot-duel.portraits.v1";
const DEBUT_GRANT_ID = "pitch-duel-debut-xi";
const OPENING_COINS = 1000;

/** The bundle's 4-3-3 places, in its slot order (the debut reveal's formation). */
const FORMATION = "4-3-3";
const SLOTS = ["LB", "CB", "CB", "RB", "CM", "CDM", "CM", "LW", "ST", "RW"] as const;
const GROUP: Record<string, "DEF" | "MID" | "FWD"> = {
  CB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF",
  CDM: "MID", CM: "MID", CAM: "MID", LM: "MID", RM: "MID",
  LW: "FWD", RW: "FWD", ST: "FWD", SS: "FWD",
};

type RosterCard = { id: string; positions: string[]; keeper: boolean; rating: number; image: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const groupOf = (position: string) => GROUP[position] ?? "MID";
const sideOf = (position: string) => (/^L/.test(position) ? "L" : /^R/.test(position) ? "R" : "C");

/** The bundle's position fit: 3 natural, 2 same flank (wide or attacking), 1 same group, 0 otherwise. */
function fit(card: RosterCard, place: string): number {
  if (card.positions.includes(place)) return 3;
  const group = groupOf(place), flank = sideOf(place);
  const attacking = (g: string) => g === "MID" || g === "FWD";
  if (flank !== "C" && card.positions.some((p) => sideOf(p) === flank && (groupOf(p) === group || (attacking(group) && attacking(groupOf(p)))))) return 2;
  return card.positions.some((p) => groupOf(p) === group) ? 1 : 0;
}

/**
 * The bundle's own seating rule (wide and specialist places pick first, each taking the best mix
 * of fit and rating), but drawn only from the roster, so no academy player takes a place.
 */
function seat(outfield: RosterCard[]): string[] | null {
  const seated: (string | null)[] = SLOTS.map(() => null);
  const used = new Set<string>();
  const generic = (place: string) => place === "CB" || place === "CM";
  const order = SLOTS.map((place, i) => ({ place, i })).sort((a, b) => Number(generic(a.place)) - Number(generic(b.place)));
  for (const { place, i } of order) {
    let best: RosterCard | null = null, bestValue = -Infinity;
    for (const card of outfield) {
      if (used.has(card.id)) continue;
      const f = fit(card, place);
      const value = (f === 0 ? -40 : f * 10) + card.rating;
      if (value > bestValue) { best = card; bestValue = value; }
    }
    if (!best) return null;
    seated[i] = best.id;
    used.add(best.id);
  }
  return seated as string[];
}

function parseCard(value: unknown): RosterCard | null {
  if (!isRecord(value) || typeof value.playerId !== "string" || !value.playerId) return null;
  const positions = typeof value.position === "string"
    ? value.position.toUpperCase().split("/").map((p) => p.trim()).filter(Boolean)
    : [];
  const rating = typeof value.finalRating === "number" && Number.isFinite(value.finalRating) ? value.finalRating : 0;
  // Only https photos: the card puts this URL straight into an <img>.
  const image = typeof value.image === "string" && value.image.startsWith("https://") ? value.image : null;
  return { id: value.playerId, positions, keeper: value.playerType === "goalkeeper", rating, image };
}

/** The roster's cards. A malformed card is skipped rather than failing the whole roster. */
async function fetchRoster(signal: AbortSignal): Promise<RosterCard[]> {
  const response = await fetch(ROSTER_URL, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Roster API: HTTP ${response.status}`);
  const body: unknown = await response.json();
  const data = isRecord(body) ? body.data : null;
  if (!isRecord(data)) throw new Error("Roster API: missing data");
  const seen = new Set<string>();
  const cards = ["attackers", "defenders", "goalkeepers"]
    .flatMap((group) => (Array.isArray(data[group]) ? (data[group] as unknown[]) : []))
    .map(parseCard)
    .filter((card): card is RosterCard => card !== null && !seen.has(card.id) && Boolean(seen.add(card.id)));
  if (!cards.length) throw new Error("Roster API: no players");
  return cards;
}

/** GameFrame `prepare`: the stores a new player starts with. */
export async function starterStores(signal: AbortSignal): Promise<Record<string, string>> {
  let cards: RosterCard[];
  try {
    cards = await fetchRoster(AbortSignal.any([signal, AbortSignal.timeout(ROSTER_TIMEOUT_MS)]));
  } catch (error) {
    // Leaving the page aborts quietly; anything else is shown on the frame with "Try again".
    if (signal.aborted) throw error;
    throw new Error("Your starting squad couldn't be loaded. Check your connection and try again.");
  }

  const now = new Date().toISOString();
  // Missing economy fields (cosmetics, equipped items) are filled with defaults by the bundle.
  const economy = {
    version: 1,
    coins: OPENING_COINS,
    owned: { playerCardIds: cards.map((card) => card.id), actionCardIds: [] },
    // Newest first, as the bundle keeps them.
    transactions: [
      { id: `grant-${DEBUT_GRANT_ID}`, at: now, kind: "grant", delta: 0, balanceAfter: OPENING_COINS, title: "FOT DUEL STARTER SQUAD" },
      { id: "opening-balance", at: new Date(0).toISOString(), kind: "openingBalance", delta: OPENING_COINS, balanceAfter: OPENING_COINS, title: "OPENING BALANCE" },
    ],
    settledRewardIds: [DEBUT_GRANT_ID],
  };
  const portraits = Object.fromEntries(cards.flatMap((card) => (card.image ? [[card.id, card.image]] : [])));
  const stores: Record<string, string> = { [ECONOMY_KEY]: JSON.stringify(economy), [PORTRAITS_KEY]: JSON.stringify(portraits) };

  // Without a keeper or ten outfield players the bundle picks the club itself, filling gaps from its academy.
  const keeper = cards.filter((card) => card.keeper).sort((a, b) => b.rating - a.rating)[0];
  const outfield = keeper ? seat(cards.filter((card) => !card.keeper)) : null;
  if (keeper && outfield) {
    // The bundle fills every other career field with its defaults.
    stores[CAREER_KEY] = JSON.stringify({ version: 4, club: { formation: FORMATION, keeperId: keeper.id, outfield, tactics: [] } });
  }
  return stores;
}
