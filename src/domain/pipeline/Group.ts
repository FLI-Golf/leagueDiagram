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

  static generateCompetitivePairings(teams: readonly Team[]): Group[] {
    if (teams.length === 0) {
      return [];
    }

    if (teams.length % 2 !== 0) {
      throw new Error('Competitive pairings require an even number of teams.');
    }

    return Group.generateSeasonPairings(teams, 1)[0] ?? [];
  }

  static generateSeasonPairings(teams: readonly Team[], eventCount: number): Group[][] {
    if (teams.length === 0) {
      return [];
    }

    if (teams.length % 2 !== 0) {
      throw new Error('Competitive pairings require an even number of teams.');
    }

    const sorted = [...teams].sort((left, right) => left.name.localeCompare(right.name));
    const seasonRounds: Group[][] = [];
    const maxRounds = Math.max(1, eventCount);

    for (let roundIndex = 0; roundIndex < maxRounds; roundIndex += 1) {
      const rotated = sorted.slice(roundIndex).concat(sorted.slice(0, roundIndex));
      const groups: Group[] = [];

      for (let index = 0; index < rotated.length / 2; index += 1) {
        const first = rotated[index];
        const second = rotated[rotated.length - 1 - index];
        if (first.id === second.id) {
          continue;
        }

        groups.push(new Group(`group-${roundIndex + 1}-${index + 1}`, `Group ${index + 1}`, [first, second]));
      }

      seasonRounds.push(groups);
    }

    return seasonRounds;
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
