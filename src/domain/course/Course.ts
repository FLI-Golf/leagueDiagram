import { Hole } from './Hole';

export class Course {
  readonly id: string;
  readonly name: string;
  readonly intermissionAfterHoleNumber = 9;
  private readonly holes: Hole[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addHole(hole: Hole): void {
    this.holes.push(hole);
  }

  setBackNine(holes: readonly Hole[]): void {
    const backNine = [...holes];
    if (backNine.length !== 9) {
      throw new Error('The back nine must contain exactly 9 holes.');
    }

    const frontNine = this.holes.slice(0, 9);
    const allHoles = [...frontNine, ...backNine];

    this.holes.length = 0;
    this.holes.push(...allHoles);
  }

  getHoles(): readonly Hole[] {
    return [...this.holes];
  }

  getHoleByNumber(number: number): Hole {
    const hole = this.holes.find((entry) => entry.number === number);
    if (!hole) {
      throw new Error(`Hole ${number} does not exist on this course.`);
    }

    return hole;
  }

  buildTournamentRound(): Hole[] {
    if (this.holes.length < 9) {
      throw new Error('A tournament round requires at least 9 holes.');
    }

    const frontNine = this.holes.slice(0, 9);
    const backNine = this.holes.slice(9, 18);

    if (backNine.length === 0) {
      return [...frontNine, ...frontNine];
    }

    return [...frontNine, ...backNine];
  }
}
