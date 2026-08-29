import { Team } from '../team/Team';

export class ScoreEntry {
  readonly team: Team;
  readonly holeNumber: number;
  readonly score: number;

  constructor(team: Team, holeNumber: number, score: number) {
    this.team = team;
    this.holeNumber = holeNumber;
    this.score = score;
  }
}
