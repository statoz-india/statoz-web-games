import type { TrackParams } from "./track";

type Payload = Record<string, unknown>;

const isRecord = (value: unknown): value is Payload => typeof value === "object" && value !== null;
// Short strings only: long ones are free text or IDs, which must not reach GA.
const text = (value: unknown) => (typeof value === "string" && value.length <= 40 ? value : undefined);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const flag = (value: unknown) => (typeof value === "boolean" ? value : undefined);

function defined(params: Record<string, string | number | boolean | undefined>): TrackParams {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as TrackParams;
}

/**
 * The only result fields each game may send. The raw payload is never forwarded:
 * its id carries the session id, and every game shapes it differently.
 */
// Partial: games that never send results have no picker (Hoop Legacy, Mini Golf, Rally Dash,
// Holdover, Pitch Rush, Vibe Basketball, Football Chess).
const PICKERS: Partial<Record<string, (payload: Payload) => TrackParams>> = {
  // score is [player goals, opponent goals]; cup results send the cup status as outcome.
  "penalty-cup": (p) => {
    const score = Array.isArray(p.score) ? p.score : [];
    return defined({ mode: text(p.mode), outcome: text(p.outcome), goals_for: count(score[0]), goals_against: count(score[1]) });
  },
  cricketer: (p) => defined({ challenge_id: text(p.challengeId), score: count(p.score), target: count(p.target), won: flag(p.won) }),
  // time and bestLap are left out: near-unique values.
  formula: (p) => defined({ mode: text(p.mode), circuit: text(p.circuit), position: count(p.position), laps: count(p.laps) }),
  // challengeId is the career level id, or the rival's id in a match.
  longbow: (p) => defined({
    mode: text(p.mode), challenge_id: text(p.challengeId), score: count(p.score),
    rival_score: count(p.rivalScore), stars: count(p.stars), won: flag(p.won),
  }),
  yorker: (p) => defined({
    challenge_id: text(p.challengeId), won: flag(p.won), stars: count(p.stars),
    runs: count(p.runs), wickets: count(p.wickets), balls: count(p.balls),
  }),
  // coins is left out: it is a reward, not a measure of the match.
  "rim-rush": (p) => defined({
    mode: text(p.mode), rival: text(p.rival), court: text(p.court), cup: text(p.cup), round: count(p.round),
    score: count(p.score), rival_score: count(p.rivalScore), won: flag(p.won), tied: flag(p.tied),
  }),
  // Bundle id "f1-racing". time is left out (near-unique); stageId and stars come with career races.
  racer: (p) => defined({
    mode: text(p.mode), circuit: text(p.circuit), difficulty: text(p.difficulty), position: count(p.position),
    laps: count(p.laps), stage_id: text(p.stageId), stars: count(p.stars),
  }),
};

export function resultParams(gameId: string, payload: unknown): TrackParams {
  const pick = PICKERS[gameId];
  return pick && isRecord(payload) ? pick(payload) : {};
}
