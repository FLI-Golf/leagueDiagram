import { describe, expect, it } from 'vitest';

import { DraftControlSettings } from '../draft/DraftControlSettings';
import { FantasyTeam } from '../fantasy/FantasyTeam';
import { UserProfile } from '../user/UserProfile';
import { SeasonBootstrap } from './SeasonBootstrap';

describe('Season bootstrap', () => {
  it('Builds a full six-user league plus fantasy teams and draft setup', () => {
    const users = [
      new UserProfile('u-1', 'Jamie Reed', 'jamie@example.com'),
      new UserProfile('u-2', 'Morgan Fox', 'morgan@example.com'),
      new UserProfile('u-3', 'Taylor Ross', 'taylor@example.com'),
      new UserProfile('u-4', 'Jordan Quinn', 'jordan@example.com'),
      new UserProfile('u-5', 'Chris Allen', 'chris@example.com'),
      new UserProfile('u-6', 'Casey Dunn', 'casey@example.com'),
    ];

    const fantasyTeams = [
      new FantasyTeam('ft-1', 'The Big Dogs'),
      new FantasyTeam('ft-2', 'Night Hawks'),
      new FantasyTeam('ft-3', 'Skyline Crew'),
    ];

    const bootstrap = new SeasonBootstrap('season-bootstrap-1', 'Spring Season');
    const setup = bootstrap.build(users, fantasyTeams, [
      new DraftControlSettings(90, 'ascending'),
      new DraftControlSettings(60, 'descending'),
    ]);

    expect(setup.league.getParticipants()).toHaveLength(6);
    expect(setup.fantasyTeams).toHaveLength(3);
    expect(setup.draftOrders).toHaveLength(2);
    expect(setup.draftOrders[0].controls.timerSeconds).toBe(90);
  });
});
