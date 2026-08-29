import { describe, expect, it } from 'vitest';

import { FantasyLeague } from './FantasyLeague';
import { UserProfile } from '../user/UserProfile';

describe('Fantasy league model', () => {
  it('A fantasy league can have up to six participants and each participant can own one fantasy team', () => {
    const participants = Array.from({ length: 6 }, (_, index) => new UserProfile(`user-${index + 1}`, `Player ${index + 1}`, `player${index + 1}@example.com`));

    const league = new FantasyLeague('fantasy-1', 'Weekend League', participants);

    const firstTeam = league.createTeamForParticipant(participants[0].id, 'The Big Dogs');
    const secondTeam = league.createTeamForParticipant(participants[1].id, 'Night Hawks');

    expect(league.getParticipants()).toHaveLength(6);
    expect(league.isFull()).toBe(true);
    expect(firstTeam.name).toBe('The Big Dogs');
    expect(secondTeam.name).toBe('Night Hawks');
    expect(league.getTeams()).toHaveLength(2);

    expect(() => league.createTeamForParticipant(participants[0].id, 'Duplicate Team')).toThrow('A participant can only own one fantasy team per league.');
  });

  it('A fantasy league rejects more than six participants and each league is independent', () => {
    const participants = Array.from({ length: 7 }, (_, index) => new UserProfile(`user-${index + 1}`, `Player ${index + 1}`, `player${index + 1}@example.com`));

    expect(() => new FantasyLeague('fantasy-2', 'Too Many Players', participants)).toThrow('A fantasy league cannot have more than 6 participants.');

    const firstLeague = new FantasyLeague('fantasy-3', 'League A', participants.slice(0, 6));
    const secondLeague = new FantasyLeague('fantasy-4', 'League B', participants.slice(1, 7));

    expect(firstLeague).not.toBe(secondLeague);
    expect(firstLeague.getParticipants()).toHaveLength(6);
    expect(secondLeague.getParticipants()).toHaveLength(6);
  });
});
