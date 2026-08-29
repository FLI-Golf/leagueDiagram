import { Tournament } from '../tournament/Tournament';

export abstract class Season {
  readonly name: string;
  readonly year: number;
  readonly purseAmount: number;
  private readonly tournaments: Tournament[] = [];

  constructor(name: string, year: number, purseAmount = 4_000_000) {
    this.name = name;
    this.year = year;
    this.purseAmount = purseAmount;
  }

  addTournament(tournament: Tournament): void {
    if (this.tournaments.length >= 6) {
      throw new Error('A season cannot contain more than 6 tournaments.');
    }

    this.tournaments.push(tournament);
  }

  getTournaments(): readonly Tournament[] {
    return [...this.tournaments];
  }

  abstract doPayout(): void;
}
