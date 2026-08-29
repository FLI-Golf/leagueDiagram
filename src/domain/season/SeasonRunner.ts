import { DraftControlSettings } from '../draft/DraftControlSettings';
import { DraftOrder } from '../league/DraftOrder';
import { UserProfile } from '../user/UserProfile';
import { SeasonDraftManager } from './SeasonDraftManager';

export class SeasonRunner {
  readonly id: string;
  readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  createSeason(users: readonly UserProfile[], tournamentControls: readonly DraftControlSettings[]): SeasonDraftManager {
    const manager = new SeasonDraftManager(`${this.id}-season`, this.name);
    manager.createLeague(users);

    for (let index = 0; index < tournamentControls.length; index += 1) {
      const controls = tournamentControls[index];
      manager.createTournamentDraft(`t-${index + 1}`, controls);
    }

    return manager;
  }
}
