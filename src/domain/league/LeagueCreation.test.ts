import { describe, expect, it } from 'vitest';

import { DraftOrder } from './DraftOrder';
import { LeagueInvite } from './LeagueInvite';
import { LeagueMembership } from './LeagueMembership';
import { UserLeague } from './UserLeague';
import { UserProfile } from '../user/UserProfile';

describe('League creation and invitation workflow', () => {
  it('A league owner can invite other users until the league reaches six participants', () => {
    const owner = new UserProfile('owner-1', 'Jamie Reed', 'jamie@example.com');
    const league = new UserLeague('league-1', 'City League', owner);

    for (let i = 1; i <= 5; i += 1) {
      const participant = new UserProfile(`user-${i}`, `Player ${i}`, `player${i}@example.com`);
      const invite = new LeagueInvite(league.id, participant.id, 'pending');
      league.invite(invite);
      league.acceptInvite(participant.id);
    }

    expect(league.getParticipants()).toHaveLength(6);
    expect(league.canRunSeason()).toBe(true);
  });

  it('A league can generate a random draft order for each tournament in the season', () => {
    const owner = new UserProfile('owner-2', 'Morgan Fox', 'morgan@example.com');
    const league = new UserLeague('league-2', 'Weekend League', owner);

    for (let i = 1; i <= 5; i += 1) {
      const participant = new UserProfile(`user-${i}-b`, `Participant ${i}`, `participant${i}@example.com`);
      league.invite(new LeagueInvite(league.id, participant.id, 'pending'));
      league.acceptInvite(participant.id);
    }

    const firstDraft = league.createDraftOrderForTournament('t-1');
    const secondDraft = league.createDraftOrderForTournament('t-2');

    expect(firstDraft.order.length).toBe(6);
    expect(secondDraft.order.length).toBe(6);
    expect(new Set(firstDraft.getUserIds()).size).toBe(6);
    expect(new Set(secondDraft.getUserIds()).size).toBe(6);
  });

  it('A participant must be invited before joining the league and cannot join twice', () => {
    const owner = new UserProfile('owner-3', 'Taylor Ross', 'taylor@example.com');
    const league = new UserLeague('league-3', 'Neighborhood League', owner);
    const participant = new UserProfile('user-a', 'Chris Allen', 'chris@example.com');

    expect(() => league.acceptInvite(participant.id)).toThrow('User is not invited to this league.');

    league.invite(new LeagueInvite(league.id, participant.id, 'pending'));
    league.acceptInvite(participant.id);

    expect(() => league.acceptInvite(participant.id)).toThrow('User is already a participant in this league.');
  });

  it('LeagueMembership stores a participant relationship with a user and role', () => {
    const user = new UserProfile('user-1', 'Jordan Quinn', 'jordan@example.com');
    const membership = new LeagueMembership(user.id, 'member');

    expect(membership.userId).toBe('user-1');
    expect(membership.role).toBe('member');
  });

  it('DraftOrder stores random pick order with a tournament id', () => {
    const order = new DraftOrder('t-1', ['u-1', 'u-2', 'u-3']);

    expect(order.tournamentId).toBe('t-1');
    expect(order.order).toHaveLength(3);
    expect(order.getUserIds()).toEqual(['u-1', 'u-2', 'u-3']);
  });
});
