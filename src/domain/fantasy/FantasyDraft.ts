import { FantasyPlayer } from './FantasyPlayer';
import { FantasyRoster } from './FantasyRoster';

export class DraftPick {
  readonly roster: FantasyRoster;
  readonly player: FantasyPlayer;

  constructor(roster: FantasyRoster, player: FantasyPlayer) {
    this.roster = roster;
    this.player = player;
  }
}

export class FantasyDraft {
  readonly id: string;
  readonly name: string;
  private readonly picks: DraftPick[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addPick(roster: FantasyRoster, player: FantasyPlayer): void {
    if (this.picks.some((pick) => pick.player.id === player.id)) {
      throw new Error('A fantasy player cannot be drafted twice in the same draft.');
    }

    const pick = new DraftPick(roster, player);
    this.picks.push(pick);
    roster.addPlayer(player);
  }

  getPicks(): readonly DraftPick[] {
    return [...this.picks];
  }
}
