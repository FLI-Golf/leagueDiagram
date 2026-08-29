import { describe, expect, it } from 'vitest';

import { League } from './League';
import { Season } from './Season';
import { Tournament } from '../tournament/Tournament';

class TestSeason extends Season {
  doPayout(): void {
    // placeholder for future payout logic
  }
}

describe('League domain model', () => {
  it('A League can contain a Season', () => {
    const league = new League('league-1', 'Test League');
    const season = new TestSeason('2025 Season', 2025);

    league.addSeason(season);

    expect(league.getSeasons()).toHaveLength(1);
    expect(league.getSeasons()[0]).toBe(season);
  });

  it('A Season can contain Tournaments', () => {
    const season = new TestSeason('2025 Season', 2025);
    const tournament = new Tournament('t-1', 'The Open', 1);

    season.addTournament(tournament);

    expect(season.getTournaments()).toHaveLength(1);
    expect(season.getTournaments()[0]).toBe(tournament);
  });

  it('A Season uses a default 4 million purse amount', () => {
    const season = new TestSeason('2025 Season', 2025);

    expect(season.purseAmount).toBe(4_000_000);
  });

  it('A Season can contain exactly 6 Tournaments', () => {
    const season = new TestSeason('2025 Season', 2025);

    for (let i = 1; i <= 6; i += 1) {
      season.addTournament(new Tournament(`t-${i}`, `Tournament ${i}`, i));
    }

    expect(season.getTournaments()).toHaveLength(6);
  });

  it('Adding a 7th Tournament is rejected', () => {
    const season = new TestSeason('2025 Season', 2025);

    for (let i = 1; i <= 6; i += 1) {
      season.addTournament(new Tournament(`t-${i}`, `Tournament ${i}`, i));
    }

    expect(() => {
      season.addTournament(new Tournament('t-7', 'Tournament 7', 7));
    }).toThrow('A season cannot contain more than 6 tournaments.');
  });

  it('Tournament implements playable behavior', () => {
    const tournament = new Tournament('t-1', 'The Open', 1);

    expect(typeof tournament.play).toBe('function');
    expect(() => tournament.play()).not.toThrow();
  });

  it('getTournaments() does not allow callers to mutate the Season internal tournament collection', () => {
    const season = new TestSeason('2025 Season', 2025);
    const tournament = new Tournament('t-1', 'The Open', 1);
    season.addTournament(tournament);

    const tournaments = season.getTournaments();
    (tournaments as Tournament[]).push(new Tournament('t-2', 'PGA Championship', 2));

    expect(season.getTournaments()).toHaveLength(1);
    expect(season.getTournaments()[0]).toBe(tournament);
  });
});
