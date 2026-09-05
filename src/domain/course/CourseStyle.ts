import { Hole } from './Hole';

export interface CourseStyle {
  buildRounds(holes: readonly Hole[]): Hole[][];
}

export class FliStyle implements CourseStyle {
  static readonly holesPerNine = 9;
  static readonly holesPerRound = 18;

  buildRounds(holes: readonly Hole[]): Hole[][] {
    if (holes.length < FliStyle.holesPerNine) {
      throw new Error('A FliStyle round requires at least 9 holes.');
    }

    const frontNine = holes.slice(0, FliStyle.holesPerNine);
    const backNine = holes.slice(FliStyle.holesPerNine, FliStyle.holesPerRound);

    return [[...frontNine, ...(backNine.length === 0 ? frontNine : backNine)]];
  }
}

export class MultiRoundStyle implements CourseStyle {
  readonly roundCount: number;

  constructor(roundCount: number) {
    if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 5) {
      throw new Error('A MultiRoundStyle requires between 1 and 5 rounds.');
    }

    this.roundCount = roundCount;
  }

  buildRounds(holes: readonly Hole[]): Hole[][] {
    if (holes.length < 9) {
      throw new Error('A MultiRoundStyle round requires at least 9 holes.');
    }

    return Array.from({ length: this.roundCount }, () => [...holes]);
  }
}