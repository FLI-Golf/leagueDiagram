import { describe, expect, it } from 'vitest';

import { FantasyScoring } from './FantasyScoring';

const rosters = [
  { participantId: 'owen-bell', playerNames: ['Ricky Wysocki', 'Paul McBeth'] },
  { participantId: 'nina-alvarez', playerNames: ['Simon Lizotte', 'Gannon Buhr'] },
];

describe('Fantasy scoring', () => {
  it('Fantasy totals only count pros with confirmed scores', () => {
    const confirmed = new Map([
      ['Ricky Wysocki', -4],
      ['Simon Lizotte', -2],
    ]);

    const standings = FantasyScoring.scoreEvent(rosters, confirmed);

    expect(standings[0]).toMatchObject({ participantId: 'owen-bell', total: -4, scoredPlayers: 1 });
    expect(standings[0].missingPlayers).toEqual(['Paul McBeth']);
    expect(standings[1]).toMatchObject({ participantId: 'nina-alvarez', total: -2 });
  });

  it('Nothing is scored before the admin confirms an event', () => {
    const standings = FantasyScoring.scoreEvent(rosters, new Map());

    expect(standings.every((standing) => standing.total === 0 && standing.scoredPlayers === 0)).toBe(true);
  });

  it('Season totals accumulate across every confirmed event', () => {
    const eventOne = new Map([
      ['Ricky Wysocki', -4],
      ['Paul McBeth', -1],
      ['Simon Lizotte', -2],
      ['Gannon Buhr', 3],
    ]);
    const eventTwo = new Map([
      ['Ricky Wysocki', 2],
      ['Paul McBeth', -3],
      ['Simon Lizotte', -5],
      ['Gannon Buhr', -1],
    ]);

    const standings = FantasyScoring.scoreSeason(rosters, [eventOne, eventTwo]);

    expect(standings[0]).toMatchObject({ participantId: 'owen-bell', total: -6 });
    expect(standings[1]).toMatchObject({ participantId: 'nina-alvarez', total: -5 });
  });
});
