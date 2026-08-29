import { describe, expect, it } from 'vitest';

import { DraftControlSettings } from '../domain/draft/DraftControlSettings';
import { FantasyTeam } from '../domain/fantasy/FantasyTeam';
import { UserProfile } from '../domain/user/UserProfile';
import { SeasonService } from './SeasonService';

describe('Season service facade', () => {
  it('Builds a season and exposes the league, fantasy teams, and draft schedule through one service', () => {
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
    ];

    const service = new SeasonService('season-service-1', 'Spring Season');
    const season = service.bootstrapSeason(users, fantasyTeams, [
      new DraftControlSettings(90, 'ascending'),
      new DraftControlSettings(60, 'descending'),
    ]);

    expect(season.league.getParticipants()).toHaveLength(6);
    expect(season.fantasyTeams).toHaveLength(2);
    expect(season.draftOrders).toHaveLength(2);
    expect(season.draftOrders[0].controls.timerSeconds).toBe(90);
  });

  it('Creates a one-call demo season with six users, fantasy teams, and draft controls', () => {
    const season = SeasonService.createDemoSeason('demo-season-1', 'Demo Season');

    expect(season.league.getParticipants()).toHaveLength(6);
    expect(season.fantasyTeams).toHaveLength(2);
    expect(season.draftOrders).toHaveLength(2);
    expect(season.draftOrders[0].controls.pickDirection).toBe('ascending');
    expect(season.draftOrders[1].controls.pickDirection).toBe('descending');
  });

  it('Creates a realistic league seed with course, tournaments, sponsor details, prize metadata, and a real schedule in one call', () => {
    const seed = SeasonService.createRealisticLeagueSeed('realistic-seed-1', 'Summer League');

    expect(seed.season.league.getParticipants()).toHaveLength(6);
    expect(seed.course.name).toBe('Blackwood Ridge');
    expect(seed.course.getHoles()).toHaveLength(9);
    expect(seed.tournamentNames).toHaveLength(3);
    expect(seed.sponsors).toHaveLength(3);
    expect(seed.course.getHoleByNumber(3).getSponsors()[0].name).toBe('Hawkeye Gear');
    expect(seed.schedule.getEvents()).toHaveLength(3);
    expect(seed.holeMetadata[2].prize.amount).toBe(120);
    expect(seed.holeMetadata[2].sponsors[0].name).toBe('Hawkeye Gear');
  });

  it('Creates a realistic league setup that includes 12 mixed-gender teams and six-person fantasy leagues', () => {
    const seed = SeasonService.createRealisticLeagueSeed('realistic-seed-2', 'Summer League');

    expect(seed.realLeagueTeams).toHaveLength(12);
    expect(seed.realLeagueTeams.every((team) => team.malePlayer.gender === 'male' && team.femalePlayer.gender === 'female')).toBe(true);
    expect(seed.fantasyLeagues).toHaveLength(2);
    expect(seed.fantasyLeagues.every((league) => league.getParticipants().length === 6)).toBe(true);
  });
});
