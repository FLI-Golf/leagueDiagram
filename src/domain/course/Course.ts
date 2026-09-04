import { Hole } from './Hole';
import { CourseStyle, FliStyle } from './CourseStyle';

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

  getHoleForRoundNumber(number: number): Hole {
    if (this.holes.length === 0) {
      throw new Error('This course has no holes.');
    }

    if (number < 1) {
      throw new Error('Hole numbers must be positive.');
    }

    const wrappedNumber = ((number - 1) % this.holes.length) + 1;
    return this.getHoleByNumber(wrappedNumber);
  }

  buildTournamentRound(): Hole[] {
    return this.buildTournamentRounds()[0] ?? [];
  }

  buildTournamentRounds(style: CourseStyle = new FliStyle()): Hole[][] {
    return style.buildRounds(this.holes);
  }
}
