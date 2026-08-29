import { Scorecard } from './Scorecard';

export class Standing {
  readonly player: Scorecard['player'];
  readonly totalScore: number;

  constructor(player: Scorecard['player'], totalScore: number) {
    this.player = player;
    this.totalScore = totalScore;
  }

  static fromScorecards(scorecards: readonly Scorecard[]): Standing[] {
    return [...scorecards]
      .map((scorecard) => new Standing(scorecard.player, scorecard.totalScore()))
      .sort((left, right) => left.totalScore - right.totalScore);
  }
}
