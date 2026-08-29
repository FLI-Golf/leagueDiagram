import { Group } from './Group';
import { ScoreEntry } from './ScoreEntry';

export class ScorekeeperPipeline {
  private readonly group: Group;
  private readonly pendingScores: ScoreEntry[] = [];
  private approved = false;

  constructor(group: Group) {
    this.group = group;
  }

  submitHoleScore(entry: ScoreEntry): void {
    this.pendingScores.push(entry);
    this.group.recordHoleScore(entry.team, entry.holeNumber, entry.score);
    this.approved = false;
  }

  isReadyForApproval(): boolean {
    if (this.group.teams.length === 0) {
      return false;
    }

    const requiredHoles = new Set<number>([1, 2]);
    for (const team of this.group.teams) {
      for (const hole of requiredHoles) {
        if (this.group.getScore(team, hole) === 0) {
          return false;
        }
      }
    }

    return this.pendingScores.length >= this.group.teams.length * requiredHoles.size;
  }

  approve(): void {
    if (!this.isReadyForApproval()) {
      throw new Error('Scores cannot be approved until every team has a score for every required hole.');
    }

    this.approved = true;
  }

  isApproved(): boolean {
    return this.approved;
  }
}
