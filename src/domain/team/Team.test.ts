import { describe, expect, it } from 'vitest';

import { League } from '../league/League';
import { Player } from '../player/Player';
import { Team } from './Team';

describe('Mixed-gender team model', () => {
  it('A Team is exactly one male and one female player', () => {
    const male = new Player('p-1', 'Avery Brooks', 'avery@example.com', 'male');
    const female = new Player('p-2', 'Blake Cole', 'blake@example.com', 'female');

    const team = new Team('team-1', 'City Champs', male, female);

    expect(team.players).toHaveLength(2);
    expect(team.malePlayer.id).toBe('p-1');
    expect(team.femalePlayer.id).toBe('p-2');
  });

  it('A League supports exactly 12 mixed-gender teams', () => {
    const league = new League('league-1', 'Spring League');

    for (let i = 1; i <= 12; i += 1) {
      const male = new Player(`male-${i}`, `Male ${i}`, `male${i}@example.com`, 'male');
      const female = new Player(`female-${i}`, `Female ${i}`, `female${i}@example.com`, 'female');
      league.addTeam(new Team(`team-${i}`, `Team ${i}`, male, female));
    }

    expect(league.getTeams()).toHaveLength(12);
  });

  it('A Team rejects mismatched genders and extra members', () => {
    const male = new Player('p-3', 'Casey Dunn', 'casey@example.com', 'male');
    const female = new Player('p-4', 'Drew Shaw', 'drew@example.com', 'female');
    const anotherMale = new Player('p-5', 'Emerson Tate', 'emerson@example.com', 'male');

    expect(() => new Team('team-2', 'Wrong Mix', male, anotherMale)).toThrow('A team must include exactly one male and one female player.');
    expect(() => new Team('team-3', 'Wrong Gender', male, female)).not.toThrow();
  });
});
