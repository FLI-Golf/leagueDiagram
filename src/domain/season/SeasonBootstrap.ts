import { DraftControlSettings } from '../draft/DraftControlSettings';
import { FantasyTeam } from '../fantasy/FantasyTeam';
import { DraftOrder } from '../league/DraftOrder';
import { UserLeague } from '../league/UserLeague';
import { UserProfile } from '../user/UserProfile';

export class SeasonBootstrapResult {
  readonly league: UserLeague;
  readonly fantasyTeams: readonly FantasyTeam[];
  readonly draftOrders: readonly DraftOrder[];

  constructor(league: UserLeague, fantasyTeams: readonly FantasyTeam[], draftOrders: readonly DraftOrder[]) {
    this.league = league;
    this.fantasyTeams = [...fantasyTeams];
    this.draftOrders = [...draftOrders];
  }
}

export class SeasonBootstrap {
  readonly id: string;
  readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  build(users: readonly UserProfile[], fantasyTeams: readonly FantasyTeam[], tournamentControls: readonly DraftControlSettings[]): SeasonBootstrapResult {
    const owner = users[0];
    const league = new UserLeague(`${this.id}-league`, this.name, owner);

    for (const user of users.slice(1)) {
      league.invite({ leagueId: league.id, userId: user.id, status: 'pending' });
      league.acceptInvite(user.id);
    }

    const draftOrders: DraftOrder[] = [];
    for (let index = 0; index < tournamentControls.length; index += 1) {
      const controls = tournamentControls[index];
      const order = league.createDraftOrderForTournament(`t-${index + 1}`);
      draftOrders.push(new DraftOrder(`t-${index + 1}`, order.getUserIds(), controls));
    }

    return new SeasonBootstrapResult(league, fantasyTeams, draftOrders);
  }
}
