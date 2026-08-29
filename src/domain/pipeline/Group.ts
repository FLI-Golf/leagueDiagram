import { Team } from '../team/Team';

export class Group {
  readonly id: string;
  readonly name: string;
  readonly teams: readonly Team[];
  private readonly holeScores = new Map<string, Map<number, number>>();

  constructor(id: string, name: string, teams: readonly Team[]) {
    this.id = id;
    this.name = name;
    this.teams = [...teams];
  }

  recordHoleScore(team: Team, holeNumber: number, score: number): void {
    const currentScores = this.holeScores.get(team.id) ?? new Map<number, number>();
    currentScores.set(holeNumber, score);
    this.holeScores.set(team.id, currentScores);
  }

  getScore(team: Team, holeNumber: number): number {
    return this.holeScores.get(team.id)?.get(holeNumber) ?? 0;
  }

  getAllHoleScores(): ReadonlyMap<string, ReadonlyMap<number, number>> {
    return new Map(Array.from(this.holeScores.entries()).map(([teamId, holeMap]) => [teamId, new Map(holeMap)]));
  }
}
