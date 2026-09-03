import { describe, expect, it } from 'vitest';
import { resolveAppRoute, getProPlayers, getTeamSummaries } from './AppRoutes';
import { SeasonService } from './SeasonService';

describe('AppRoutes', () => {
  it('resolves team and pro pages from the pathname', () => {
    expect(resolveAppRoute('/teams')).toMatchObject({ kind: 'teams' });
    expect(resolveAppRoute('/teams/team-3')).toMatchObject({ kind: 'team-detail', teamId: 'team-3' });
    expect(resolveAppRoute('/pros')).toMatchObject({ kind: 'pros' });
    expect(resolveAppRoute('/pros/pro-1')).toMatchObject({ kind: 'pro-detail', playerId: 'pro-1' });
  });

  it('resolves diagram views', () => {
    expect(resolveAppRoute('/diagram')).toMatchObject({ kind: 'diagram', view: 'overview' });
    expect(resolveAppRoute('/diagram/pros')).toMatchObject({ kind: 'diagram', view: 'pros' });
  });

  it('builds the team and pro data used by the routes', () => {
    const seed = SeasonService.createRealisticLeagueSeed('league-route-demo', 'Route Demo');
    const teams = getTeamSummaries(seed);
    const pros = getProPlayers(seed);

    expect(teams[0]).toMatchObject({ id: 'team-1', name: 'Ace Makers' });
    expect(teams[0].players).toHaveLength(2);
    expect(pros[0]).toMatchObject({ id: 'real-m-1' });
    expect(pros[0].teamId).toBe('team-1');
    expect(pros[0].teamName).toBe('Ace Makers');
  });
});
