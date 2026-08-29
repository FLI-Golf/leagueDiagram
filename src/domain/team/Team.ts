import { Player } from '../player/Player';

export class Team {
  readonly id: string;
  readonly name: string;
  readonly players: readonly [Player, Player];

  constructor(id: string, name: string, malePlayer: Player, femalePlayer: Player) {
    if (malePlayer.gender !== 'male' || femalePlayer.gender !== 'female') {
      throw new Error('A team must include exactly one male and one female player.');
    }

    this.id = id;
    this.name = name;
    this.players = [malePlayer, femalePlayer];
  }

  get malePlayer(): Player {
    return this.players[0];
  }

  get femalePlayer(): Player {
    return this.players[1];
  }
}
