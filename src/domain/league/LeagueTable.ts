import { TournamentResult } from '../tournament/TournamentResult';

export class LeagueTable {
  readonly id: string;
  readonly name: string;
  private readonly results: TournamentResult[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  recordResult(result: TournamentResult): void {
    this.results.push(result);
  }

  getStandings(): Array<{ player: { id: string; displayName: string }; totalPoints: number }> {
    const pointsByPlayer = new Map<string, { id: string; displayName: string; totalPoints: number }>();

    for (const result of this.results) {
      for (const entry of result.getEntries()) {
        const existing = pointsByPlayer.get(entry.player.id) ?? {
          id: entry.player.id,
          displayName: entry.player.displayName,
          totalPoints: 0,
        };

        existing.totalPoints += result.getPointsFor(entry);
        pointsByPlayer.set(entry.player.id, existing);
      }
    }

    return Array.from(pointsByPlayer.values())
      .sort((left, right) => right.totalPoints - left.totalPoints || left.displayName.localeCompare(right.displayName))
      .map((entry) => ({ player: { id: entry.id, displayName: entry.displayName }, totalPoints: entry.totalPoints }));
  }
}
