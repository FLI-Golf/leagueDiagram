import { describe, expect, it } from 'vitest';

import { buildGroupScorecard } from './ScorecardSummary';

describe('ScorecardSummary', () => {
  it('builds a full group scorecard with running relative totals for each player', () => {
    const lineups = [
      { teamName: 'Ace Makers', players: ['Simon Lizotte', 'Kat Mertsch'] },
      { teamName: 'Birdie Storm', players: ['Isaac Robinson', 'Missy Gannon'] },
    ];

    const holeScoresByIndex: Record<number, Record<string, string>> = {
      0: {
        'Group A|Ace Makers|Simon Lizotte': '+4',
        'Group A|Ace Makers|Kat Mertsch': '+3',
        'Group A|Birdie Storm|Isaac Robinson': '+4',
        'Group A|Birdie Storm|Missy Gannon': '+3',
      },
      1: {
        'Group A|Ace Makers|Simon Lizotte': '+3',
        'Group A|Ace Makers|Kat Mertsch': '+4',
        'Group A|Birdie Storm|Isaac Robinson': '+3',
        'Group A|Birdie Storm|Missy Gannon': '+5',
      },
    };

    const rows = buildGroupScorecard('Group A', lineups, holeScoresByIndex);

    expect(rows).toHaveLength(4);
    expect(rows[0].player).toBe('Simon Lizotte');
    expect(rows[0].displayTotal).toBe('+1');
    expect(rows[1].player).toBe('Kat Mertsch');
    expect(rows[1].displayTotal).toBe('+1');
    expect(rows[2].holeScores).toHaveLength(18);
    expect(rows[3].displayTotal).toBe('+2');
  });
});
