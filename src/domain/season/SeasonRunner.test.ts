import { describe, expect, it } from 'vitest';

import { DraftControlSettings } from '../draft/DraftControlSettings';
import { UserProfile } from '../user/UserProfile';
import { SeasonRunner } from './SeasonRunner';

describe('Season runner', () => {
  it('Schedules tournament drafts for a full six-user league and creates an ordered season timeline', () => {
    const users = [
      new UserProfile('u-1', 'Jamie Reed', 'jamie@example.com'),
      new UserProfile('u-2', 'Morgan Fox', 'morgan@example.com'),
      new UserProfile('u-3', 'Taylor Ross', 'taylor@example.com'),
      new UserProfile('u-4', 'Jordan Quinn', 'jordan@example.com'),
      new UserProfile('u-5', 'Chris Allen', 'chris@example.com'),
      new UserProfile('u-6', 'Casey Dunn', 'casey@example.com'),
    ];

    const runner = new SeasonRunner('season-runner-1', 'Spring Season');
    const season = runner.createSeason(users, [
      new DraftControlSettings(90, 'ascending'),
      new DraftControlSettings(75, 'descending'),
      new DraftControlSettings(60, 'ascending'),
    ]);

    expect(season.getLeague().getParticipants()).toHaveLength(6);
    expect(season.getDraftOrders()).toHaveLength(3);
    expect(season.getDraftOrders()[0].controls.timerSeconds).toBe(90);
    expect(season.getDraftOrders()[2].controls.timerSeconds).toBe(60);
  });
});
