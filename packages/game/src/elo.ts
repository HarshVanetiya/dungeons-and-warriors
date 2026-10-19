// GAME_RULES.md section 6.

export const STARTING_ELO = 1200;
export const ELO_K = 32;
/** Players are only matched if each of them would gain at least this much for a win. */
export const MIN_WIN_GAIN = 6;

/** Chance that a player rated `elo` beats one rated `opponentElo`. */
export function expectedScore(elo: number, opponentElo: number): number {
  return 1 / (1 + 10 ** ((opponentElo - elo) / 400));
}

/** Points the winner gains and the loser loses. Rounded once so the change is zero-sum. */
export function eloDelta(winnerElo: number, loserElo: number): number {
  return Math.round(ELO_K * (1 - expectedScore(winnerElo, loserElo)));
}

export type EloOutcome = 'aWins' | 'bWins' | 'draw';

export interface EloChange {
  a: number;
  b: number;
  /** Change applied to a (b gets the opposite). 0 for a draw. */
  deltaA: number;
}

export function applyElo(a: number, b: number, outcome: EloOutcome): EloChange {
  if (outcome === 'draw') return { a, b, deltaA: 0 };
  const delta = outcome === 'aWins' ? eloDelta(a, b) : -eloDelta(b, a);
  return { a: a + delta, b: b - delta, deltaA: delta };
}

/** True if both players would gain at least MIN_WIN_GAIN by winning. Works out to a rating gap of at most 273. */
export function canMatch(a: number, b: number): boolean {
  return eloDelta(a, b) >= MIN_WIN_GAIN && eloDelta(b, a) >= MIN_WIN_GAIN;
}
