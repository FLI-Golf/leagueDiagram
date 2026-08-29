import { Player } from '../player/Player';

export class DraftSelection {
  readonly player: Player;
  readonly round: number;
  readonly pickNumber: number;

  constructor(player: Player, round: number, pickNumber: number) {
    this.player = player;
    this.round = round;
    this.pickNumber = pickNumber;
  }
}
