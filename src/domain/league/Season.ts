import { Tournament } from '../tournament/Tournament';

export abstract class Season {
  readonly name: string;
  readonly year: number;
  private readonly tournaments: Tournament[] = [];

  constructor(name: string, year: number) {
    this.name = name;
    this.year = year;
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
