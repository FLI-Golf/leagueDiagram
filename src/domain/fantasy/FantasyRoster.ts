import { FantasyPlayer } from './FantasyPlayer';

export class FantasyRoster {
  readonly id: string;
  readonly name: string;
  private readonly players: FantasyPlayer[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addPlayer(player: FantasyPlayer): void {
    this.players.push(player);
  }

  getPlayers(): readonly FantasyPlayer[] {
    return [...this.players];
  }
}
