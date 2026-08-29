import { ProPlayer, type ProPlayerSeed } from '../player/Player';

export type FantasyPosition = 'male' | 'female' | 'flex';

export class FantasyPlayer {
  readonly id: string;
  readonly proPlayer: ProPlayer;
  readonly position: FantasyPosition;
  readonly overallRating: number;

  constructor(
    id: string,
    proPlayer: ProPlayer | ProPlayerSeed,
    position: FantasyPosition,
    overallRating: number,
  ) {
    this.id = id;
    this.proPlayer = proPlayer instanceof ProPlayer ? proPlayer : ProPlayer.fromSeed(proPlayer);
    this.position = position;
    this.overallRating = overallRating;
  }

  get realPlayer(): ProPlayer {
    return this.proPlayer;
  }

  get proPlayerId(): string {
    return this.proPlayer.id;
  }
}
