export type FantasyPosition = 'male' | 'female' | 'flex';

export class FantasyPlayer {
  readonly id: string;
  readonly realPlayer: {
    id: string;
    displayName: string;
    email: string;
    gender: 'male' | 'female';
  };
  readonly position: FantasyPosition;
  readonly overallRating: number;

  constructor(
    id: string,
    realPlayer: {
      id: string;
      displayName: string;
      email: string;
      gender: 'male' | 'female';
    },
    position: FantasyPosition,
    overallRating: number,
  ) {
    this.id = id;
    this.realPlayer = realPlayer;
    this.position = position;
    this.overallRating = overallRating;
  }
}
