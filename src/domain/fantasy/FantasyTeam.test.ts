import { describe, expect, it } from 'vitest';

import { FantasyPlayer } from './FantasyPlayer';
import { FantasyTeam } from './FantasyTeam';

describe('Fantasy team model', () => {
  it('A fantasy team can own multiple fantasy players and a team name', () => {
    const playerOne = new FantasyPlayer('fp-1', { id: 'p-1', displayName: 'Avery Brooks', email: 'avery@example.com', gender: 'male' }, 'male', 88);
    const playerTwo = new FantasyPlayer('fp-2', { id: 'p-2', displayName: 'Blake Cole', email: 'blake@example.com', gender: 'female' }, 'female', 91);

    const team = new FantasyTeam('team-1', 'The Big Dogs');
    team.addPlayer(playerOne);
    team.addPlayer(playerTwo);

    expect(team.getPlayers()).toHaveLength(2);
    expect(team.name).toBe('The Big Dogs');
  });

  it('A fantasy team cannot exceed a valid roster limit', () => {
    const team = new FantasyTeam('team-2', 'Night Hawks');

    for (let i = 1; i <= 6; i += 1) {
      const player = new FantasyPlayer(`fp-${i}`, { id: `p-${i}`, displayName: `Player ${i}`, email: `player${i}@example.com`, gender: i % 2 === 0 ? 'female' : 'male' }, i % 2 === 0 ? 'female' : 'male', 85 + i);
      team.addPlayer(player);
    }

    expect(team.getPlayers()).toHaveLength(6);
  });
});
