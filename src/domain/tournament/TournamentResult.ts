import { Scorecard } from '../player/Scorecard';

export class TournamentResult {
  readonly id: string;
  readonly name: string;
  private readonly entries: Scorecard[];

  constructor(id: string, name: string, entries: readonly Scorecard[]) {
    this.id = id;
    this.name = name;
    this.entries = [...entries];
  }

  getEntries(): readonly Scorecard[] {
    return [...this.entries];
  }

  totalEntries(): number {
    return this.entries.length;
  }

  getWinner(): Scorecard | undefined {
    if (this.entries.length === 0) {
      return undefined;
    }

    return this.getRankedEntries()[0];
  }

  getRankedEntries(): readonly Scorecard[] {
    return [...this.entries].sort((left, right) => {
      const scoreDifference = left.totalScore() - right.totalScore();
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return left.player.displayName.localeCompare(right.player.displayName) || left.player.id.localeCompare(right.player.id);
    });
  }

  getPlacement(scorecard: Scorecard): number {
    return this.getRankedEntries().findIndex((entry) => entry.player.id === scorecard.player.id) + 1;
  }

  getPointsFor(scorecard: Scorecard): number {
    const placement = this.getPlacement(scorecard);
    return Math.max(0, 100 - (placement - 1) * 10);
  }
}
