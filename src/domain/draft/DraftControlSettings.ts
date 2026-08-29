export type DraftPickDirection = 'ascending' | 'descending';
export type DraftGender = 'male' | 'female';

export class DraftControlSettings {
  readonly timerSeconds: number;
  readonly pickDirection: DraftPickDirection;
  readonly genderCheck?: {
    enabled: boolean;
    rounds: number[];
    requiredGenderSequence: DraftGender[];
  };

  constructor(
    timerSeconds: number,
    pickDirection: DraftPickDirection,
    genderCheck?: {
      enabled: boolean;
      rounds: number[];
      requiredGenderSequence: DraftGender[];
    },
  ) {
    this.timerSeconds = timerSeconds;
    this.pickDirection = pickDirection;
    this.genderCheck = genderCheck;
  }
}
