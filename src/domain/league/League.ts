import { Season } from './Season';

export class League {
  readonly id: string;
  readonly name: string;
  private readonly seasons: Season[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addSeason(season: Season): void {
    this.seasons.push(season);
  }

  getSeasons(): readonly Season[] {
    return [...this.seasons];
  }
}
