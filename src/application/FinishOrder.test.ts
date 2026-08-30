import { describe, expect, it } from 'vitest';

import { areAllGroupsApproved, normalizeFinishOrder, sortTeamsByScore } from './FinishOrder';

describe('Finish order helpers', () => {
  it('returns true once every group is approved', () => {
    const groups = ['Group A', 'Group B', 'Group C'];
    const approved = { 'Group A': true, 'Group B': true, 'Group C': true };

    expect(areAllGroupsApproved(groups, approved)).toBe(true);
  });

  it('normalizes finish order to include every approved group exactly once', () => {
    const groups = ['Group A', 'Group B', 'Group C', 'Group D'];
    const order = ['Group C', 'Group A', 'Group C', 'Group D'];

    expect(normalizeFinishOrder(groups, order)).toEqual(['Group C', 'Group A', 'Group D', 'Group B']);
  });

  it('sorts golf results by the lowest score first', () => {
    const teams = [
      { teamName: 'Birdie Storm', score: 9 },
      { teamName: 'Ace Makers', score: 7 },
      { teamName: 'Disc Dynasty', score: 12 },
    ];

    expect(sortTeamsByScore(teams).map((team) => team.teamName)).toEqual(['Ace Makers', 'Birdie Storm', 'Disc Dynasty']);
  });

  it('keeps the playoff finish order when totals are tied', () => {
    const teams = [
      { teamName: 'Chain Seekers', score: 7, playoffDistance: 128 },
      { teamName: 'Birdie Storm', score: 7, playoffDistance: 149 },
    ];

    expect(sortTeamsByScore(teams).map((team) => team.teamName)).toEqual(['Chain Seekers', 'Birdie Storm']);
  });

  it('uses the closest combined playoff throw distance to break a tie', () => {
    const teams = [
      { teamName: 'Birdie Storm', score: 7, playoffDistance: 149 },
      { teamName: 'Chain Seekers', score: 7, playoffDistance: 128 },
      { teamName: 'Chain Breakers', score: 17, playoffDistance: 200 },
    ];

    expect(sortTeamsByScore(teams).map((team) => team.teamName)).toEqual(['Chain Seekers', 'Birdie Storm', 'Chain Breakers']);
  });
});
