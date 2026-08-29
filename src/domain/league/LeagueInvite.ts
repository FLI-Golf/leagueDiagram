export class LeagueInvite {
  readonly leagueId: string;
  readonly userId: string;
  status: 'pending' | 'accepted' | 'declined';

  constructor(leagueId: string, userId: string, status: 'pending' | 'accepted' | 'declined' = 'pending') {
    this.leagueId = leagueId;
    this.userId = userId;
    this.status = status;
  }
}
