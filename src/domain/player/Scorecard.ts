import { Player } from './Player';

export class Scorecard {
  readonly player: Player;
  private readonly scores = new Map<number, number>();

  constructor(player: Player) {
    this.player = player;
  }

  recordScore(holeNumber: number, score: number): void {
    this.scores.set(holeNumber, score);
  }

  getScoreForHole(holeNumber: number): number {
    return this.scores.get(holeNumber) ?? 0;
  }

  totalScore(): number {
    return Array.from(this.scores.values()).reduce((sum, score) => sum + score, 0);
  }
}
