import { describe, expect, it } from 'vitest';

import { buildGroupScorecard, convertDisplayedHoleValueToStoredScore, getDisplayedHoleValueForPlayer, normalizeScoreEditValue } from './ScorecardSummary';

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

  it('supports a multi-round scorecard with more than 18 holes', () => {
    const lineups = [{ teamName: 'Ace Makers', players: ['Simon Lizotte'] }];
    const holeScoresByIndex: Record<number, Record<string, string>> = {
      23: { 'Group A|Ace Makers|Simon Lizotte': '+4' },
    };

    const rows = buildGroupScorecard('Group A', lineups, holeScoresByIndex, 24);

    expect(rows[0].holeScores).toHaveLength(24);
    expect(rows[0].holeScores[23].displayValue).toBe('+1');
    expect(getDisplayedHoleValueForPlayer('Group A', 'Ace Makers', 'Simon Lizotte', 24, lineups, holeScoresByIndex, 24)).toBe('+1');
  });

  it('normalizes scorecard edit values before saving a corrected hole score', () => {
    expect(normalizeScoreEditValue('E')).toBe('E');
    expect(normalizeScoreEditValue('+4')).toBe('+4');
    expect(normalizeScoreEditValue('-2')).toBe('-2');
    expect(normalizeScoreEditValue('  +7  ')).toBe('+7');
    expect(normalizeScoreEditValue('abc')).toBe('+3');
  });

  it('returns the displayed hole value for the selected hole instead of a stale previous value', () => {
    const lineups = [{ teamName: 'Ace Makers', players: ['Simon Lizotte'] }];
    const holeScoresByIndex: Record<number, Record<string, string>> = {
      0: { 'Group A|Ace Makers|Simon Lizotte': '+4' },
      1: { 'Group A|Ace Makers|Simon Lizotte': '+1' },
    };

    expect(getDisplayedHoleValueForPlayer('Group A', 'Ace Makers', 'Simon Lizotte', 1, lineups, holeScoresByIndex)).toBe('+1');
    expect(getDisplayedHoleValueForPlayer('Group A', 'Ace Makers', 'Simon Lizotte', 2, lineups, holeScoresByIndex)).toBe('-2');
  });

  it('stores the actual score under the par-based display value when the admin edits a hole', () => {
    expect(convertDisplayedHoleValueToStoredScore('E')).toBe('+3');
    expect(convertDisplayedHoleValueToStoredScore('+1')).toBe('+4');
    expect(convertDisplayedHoleValueToStoredScore('-2')).toBe('+1');
    expect(convertDisplayedHoleValueToStoredScore('+5')).toBe('+8');
  });
});
