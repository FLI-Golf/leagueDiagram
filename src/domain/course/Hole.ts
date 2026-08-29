import { Sponsor } from './Sponsor';

export class Hole {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly description: string;
  readonly basketSetup: string;
  readonly par: number;
  readonly distance: number;
  readonly baselineDistance: number;
  readonly basketShiftFeet: number;
  readonly basketShiftDirection: string | null;
  private readonly sponsors: Sponsor[] = [];

  constructor(
    id: string,
    number: number,
    name: string,
    description: string,
    basketSetup: string,
    par = 3,
    distance = 300,
    baselineDistance = distance,
    basketShiftFeet = 0,
    basketShiftDirection: string | null = null,
  ) {
    this.id = id;
    this.number = number;
    this.name = name;
    this.description = description;
    this.basketSetup = basketSetup;
    this.par = par;
    this.distance = distance;
    this.baselineDistance = baselineDistance;
    this.basketShiftFeet = basketShiftFeet;
    this.basketShiftDirection = basketShiftDirection;
  }

  addSponsor(sponsor: Sponsor): void {
    this.sponsors.push(sponsor);
  }

  getSponsors(): readonly Sponsor[] {
    return [...this.sponsors];
  }

  getDistanceLabel(): string {
    return `${this.baselineDistance} ft / ${this.distance} ft`;
  }

  getBasketMoveNote(): string {
    if (!this.basketShiftFeet || !this.basketShiftDirection) {
      return '';
    }

    return `Basket moved ${Math.abs(this.basketShiftFeet)} ft ${this.basketShiftDirection}`;
  }
}
