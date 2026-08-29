import { Sponsor } from './Sponsor';

export class Hole {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly description: string;
  readonly basketSetup: string;
  private readonly sponsors: Sponsor[] = [];

  constructor(id: string, number: number, name: string, description: string, basketSetup: string) {
    this.id = id;
    this.number = number;
    this.name = name;
    this.description = description;
    this.basketSetup = basketSetup;
  }

  addSponsor(sponsor: Sponsor): void {
    this.sponsors.push(sponsor);
  }

  getSponsors(): readonly Sponsor[] {
    return [...this.sponsors];
  }
}
