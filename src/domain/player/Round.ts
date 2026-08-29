import { Scorecard } from './Scorecard';

export class Round {
  readonly id: string;
  readonly name: string;
  private readonly scorecards: Scorecard[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addScorecard(scorecard: Scorecard): void {
    this.scorecards.push(scorecard);
  }

  getScorecards(): readonly Scorecard[] {
    return [...this.scorecards];
  }

  getWinner(): Scorecard | undefined {
    if (this.scorecards.length === 0) {
      return undefined;
    }

    return [...this.scorecards].sort((left, right) => left.totalScore() - right.totalScore())[0];
  }
}
