import { FantasyPlayer } from './FantasyPlayer';

export class FantasyTeam {
  readonly id: string;
  readonly name: string;
  private readonly players: FantasyPlayer[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addPlayer(player: FantasyPlayer): void {
    if (this.players.length >= 6) {
      throw new Error('A fantasy team cannot have more than 6 players.');
    }

    this.players.push(player);
  }

  getPlayers(): readonly FantasyPlayer[] {
    return [...this.players];
  }
}
