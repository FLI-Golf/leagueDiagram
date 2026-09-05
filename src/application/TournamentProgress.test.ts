import { describe, expect, it } from 'vitest';
import { getNextTournamentIndex, hasNextTournament } from './TournamentProgress';

describe('TournamentProgress', () => {
  it('moves to the next event when another tournament exists', () => {
    expect(getNextTournamentIndex(0, 3)).toBe(1);
    expect(hasNextTournament(0, 3)).toBe(true);
  });

  it('stays on the last event when there is no next tournament', () => {
    expect(getNextTournamentIndex(2, 3)).toBe(2);
    expect(hasNextTournament(2, 3)).toBe(false);
  });
});
