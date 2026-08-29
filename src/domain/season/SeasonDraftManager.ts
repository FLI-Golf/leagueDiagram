import { Draft } from '../draft/Draft';
import { DraftControlSettings } from '../draft/DraftControlSettings';
import { DraftOrder } from '../league/DraftOrder';
import { UserLeague } from '../league/UserLeague';
import { UserProfile } from '../user/UserProfile';

export class SeasonDraftManager {
  readonly id: string;
  readonly name: string;
  private league?: UserLeague;
  private readonly tournamentDrafts: DraftOrder[] = [];
  private readonly fantasyDrafts: Draft[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  createLeague(users: readonly UserProfile[]): UserLeague {
    const owner = users[0];
    const league = new UserLeague(`${this.id}-league`, this.name, owner);

    for (const user of users.slice(1)) {
      league.invite({ leagueId: league.id, userId: user.id, status: 'pending' });
      league.acceptInvite(user.id);
    }

    this.league = league;
    return league;
  }

  getLeague(): UserLeague {
    if (!this.league) {
      throw new Error('No league has been created for this season draft manager.');
    }

    return this.league;
  }

  createTournamentDraft(tournamentId: string, controls: DraftControlSettings): DraftOrder {
    const league = this.getLeague();
    const order = league.createDraftOrderForTournament(tournamentId);
    const draftOrder = new DraftOrder(tournamentId, order.getUserIds(), controls);
    this.tournamentDrafts.push(draftOrder);

    return draftOrder;
  }

  startFantasyDraft(tournamentId: string, controls: DraftControlSettings): Draft {
    const draft = new Draft(`${tournamentId}-fantasy`, `${this.name} Fantasy Draft`);
    draft.setControls(controls);
    this.fantasyDrafts.push(draft);
    return draft;
  }

  getTournamentDrafts(): readonly DraftOrder[] {
    return [...this.tournamentDrafts];
  }

  getDraftOrders(): readonly DraftOrder[] {
    return this.getTournamentDrafts();
  }

  getFantasyDrafts(): readonly Draft[] {
    return [...this.fantasyDrafts];
  }
}
