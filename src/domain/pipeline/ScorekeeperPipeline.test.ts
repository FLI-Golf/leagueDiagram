import { describe, expect, it } from 'vitest';

import { Team } from '../team/Team';
import { Player } from '../player/Player';
import { Group } from './Group';
import { ScoreEntry } from './ScoreEntry';
import { ScorekeeperPipeline } from './ScorekeeperPipeline';

describe('Scorekeeper pipeline', () => {
  it('A group can contain paired mixed-gender teams and track scores per hole', () => {
    const maleOne = new Player('m-1', 'Avery Brooks', 'avery@example.com', 'male');
    const femaleOne = new Player('f-1', 'Blake Cole', 'blake@example.com', 'female');
    const maleTwo = new Player('m-2', 'Casey Dunn', 'casey@example.com', 'male');
    const femaleTwo = new Player('f-2', 'Drew Shaw', 'drew@example.com', 'female');

    const teamOne = new Team('team-1', 'City Champs', maleOne, femaleOne);
    const teamTwo = new Team('team-2', 'Oak Crew', maleTwo, femaleTwo);

    const group = new Group('group-1', 'Group A', [teamOne, teamTwo]);
    group.recordHoleScore(teamOne, 1, 3);
    group.recordHoleScore(teamTwo, 1, 4);

    expect(group.getScore(teamOne, 1)).toBe(3);
    expect(group.getScore(teamTwo, 1)).toBe(4);
  });

  it('The scorekeeper pipeline only finalizes after all hole scores are approved', () => {
    const maleOne = new Player('m-3', 'Emerson Tate', 'emerson@example.com', 'male');
    const femaleOne = new Player('f-3', 'Finley Ross', 'finley@example.com', 'female');
    const maleTwo = new Player('m-4', 'Harper Lane', 'harper@example.com', 'male');
    const femaleTwo = new Player('f-4', 'Isla Park', 'isla@example.com', 'female');

    const teamOne = new Team('team-3', 'Skyline', maleOne, femaleOne);
    const teamTwo = new Team('team-4', 'Trail Mix', maleTwo, femaleTwo);
    const group = new Group('group-2', 'Group B', [teamOne, teamTwo]);

    const pipeline = new ScorekeeperPipeline(group);

    expect(pipeline.isReadyForApproval()).toBe(false);

    pipeline.submitHoleScore(new ScoreEntry(teamOne, 1, 4));
    pipeline.submitHoleScore(new ScoreEntry(teamTwo, 1, 5));
    pipeline.submitHoleScore(new ScoreEntry(teamOne, 2, 3));
    pipeline.submitHoleScore(new ScoreEntry(teamTwo, 2, 4));

    expect(pipeline.isReadyForApproval()).toBe(true);
    expect(() => pipeline.approve()).not.toThrow();
  });

  it('Generates competitive pairings by balancing strengths across the field', () => {
    const makeTeam = (id: string, name: string): Team => {
      const male = new Player(`${id}-male`, `${name} Male`, `${id}.male@example.com`, 'male');
      const female = new Player(`${id}-female`, `${name} Female`, `${id}.female@example.com`, 'female');
      return new Team(id, name, male, female);
    };

    const teams = [
      makeTeam('team-1', 'Alpha'),
      makeTeam('team-2', 'Bravo'),
      makeTeam('team-3', 'Charlie'),
      makeTeam('team-4', 'Delta'),
      makeTeam('team-5', 'Echo'),
      makeTeam('team-6', 'Foxtrot'),
    ];

    const groups = Group.generateCompetitivePairings(teams);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.teams.map((team) => team.name))).toEqual([
      ['Alpha', 'Foxtrot'],
      ['Bravo', 'Echo'],
      ['Charlie', 'Delta'],
    ]);
  });

  it('Creates a six-event season with no repeated opponent matchups', () => {
    const makeTeam = (id: string, name: string): Team => {
      const male = new Player(`${id}-male`, `${name} Male`, `${id}.male@example.com`, 'male');
      const female = new Player(`${id}-female`, `${name} Female`, `${id}.female@example.com`, 'female');
      return new Team(id, name, male, female);
    };

    const teams = [
      makeTeam('team-1', 'Alpha'),
      makeTeam('team-2', 'Bravo'),
      makeTeam('team-3', 'Charlie'),
      makeTeam('team-4', 'Delta'),
      makeTeam('team-5', 'Echo'),
      makeTeam('team-6', 'Foxtrot'),
      makeTeam('team-7', 'Golf'),
      makeTeam('team-8', 'Hotel'),
      makeTeam('team-9', 'India'),
      makeTeam('team-10', 'Juliet'),
      makeTeam('team-11', 'Kilo'),
      makeTeam('team-12', 'Lima'),
    ];

    const seasonPairings = Group.generateSeasonPairings(teams, 6);

    expect(seasonPairings).toHaveLength(6);

    const seenOpponents = new Set<string>();
    for (const roundGroups of seasonPairings) {
      const roundKeys = new Set<string>();
      for (const group of roundGroups) {
        const pair = [...group.teams].map((team) => team.name).sort();
        const pairKey = pair.join('|');
        expect(roundKeys.has(pairKey)).toBe(false);
        roundKeys.add(pairKey);

        const matchupKey = pair.join('|');
        expect(seenOpponents.has(matchupKey)).toBe(false);
        seenOpponents.add(matchupKey);
      }
    }
  });
});
