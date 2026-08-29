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
});
