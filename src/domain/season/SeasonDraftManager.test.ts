import { describe, expect, it } from 'vitest';

import { DraftControlSettings } from '../draft/DraftControlSettings';
import { DraftOrder } from '../league/DraftOrder';
import { UserProfile } from '../user/UserProfile';
import { SeasonDraftManager } from './SeasonDraftManager';

describe('Season draft manager', () => {
  it('Creates a six-user league setup with random draft order per tournament and control settings', () => {
    const users = [
      new UserProfile('u-1', 'Jamie Reed', 'jamie@example.com'),
      new UserProfile('u-2', 'Morgan Fox', 'morgan@example.com'),
      new UserProfile('u-3', 'Taylor Ross', 'taylor@example.com'),
      new UserProfile('u-4', 'Jordan Quinn', 'jordan@example.com'),
      new UserProfile('u-5', 'Chris Allen', 'chris@example.com'),
      new UserProfile('u-6', 'Casey Dunn', 'casey@example.com'),
    ];

    const manager = new SeasonDraftManager('season-1', 'Spring League');
    manager.createLeague(users);

    const tournamentOne = manager.createTournamentDraft('t-1', new DraftControlSettings(90, 'ascending'));
    const tournamentTwo = manager.createTournamentDraft('t-2', new DraftControlSettings(60, 'descending', {
      enabled: true,
      rounds: [1, 2],
      requiredGenderSequence: ['male', 'female'],
    }));

    expect(manager.getLeague().getParticipants()).toHaveLength(6);
    expect(tournamentOne.order.length).toBe(6);
    expect(tournamentTwo.order.length).toBe(6);
    expect(tournamentOne.order).not.toEqual(tournamentTwo.order);
    expect(tournamentTwo.controls.timerSeconds).toBe(60);
    expect(tournamentTwo.controls.pickDirection).toBe('descending');
  });

  it('Records a full fantasy draft event flow for a tournament', () => {
    const users = [
      new UserProfile('u-7', 'Avery Brooks', 'avery@example.com'),
      new UserProfile('u-8', 'Blake Cole', 'blake@example.com'),
      new UserProfile('u-9', 'Emerson Tate', 'emerson@example.com'),
      new UserProfile('u-10', 'Finley Ross', 'finley@example.com'),
      new UserProfile('u-11', 'Harper Lane', 'harper@example.com'),
      new UserProfile('u-12', 'Isla Park', 'isla@example.com'),
    ];

    const manager = new SeasonDraftManager('season-2', 'Summer League');
    manager.createLeague(users);

    const draft = manager.startFantasyDraft('t-3', new DraftControlSettings(120, 'ascending'));
    draft.select({ id: 'p-1', displayName: 'Avery Brooks', email: 'avery@example.com', gender: 'male' });
    draft.select({ id: 'p-2', displayName: 'Blake Cole', email: 'blake@example.com', gender: 'female' });

    expect(draft.getSelections()).toHaveLength(2);
    expect(manager.getFantasyDrafts()).toHaveLength(1);
  });

  it('Creates a new order when a tournament is repeated, but keeps the league itself stable', () => {
    const users = Array.from({ length: 6 }, (_, index) => new UserProfile(`repeat-${index + 1}`, `Player ${index + 1}`, `player${index + 1}@example.com`));
    const manager = new SeasonDraftManager('season-3', 'Repeat League');
    manager.createLeague(users);

    const first = manager.createTournamentDraft('t-repeat-1', new DraftControlSettings(45, 'ascending'));
    const second = manager.createTournamentDraft('t-repeat-2', new DraftControlSettings(45, 'ascending'));

    expect(manager.getLeague().getParticipants()).toHaveLength(6);
    expect(first.tournamentId).toBe('t-repeat-1');
    expect(second.tournamentId).toBe('t-repeat-2');
    expect(first.order).not.toEqual(second.order);
  });
});
