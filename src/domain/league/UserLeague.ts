import { DraftOrder } from './DraftOrder';
import { LeagueInvite } from './LeagueInvite';
import { LeagueMembership } from './LeagueMembership';
import { UserProfile } from '../user/UserProfile';

export class UserLeague {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  private readonly invites: LeagueInvite[] = [];
  private readonly participants: Map<string, LeagueMembership> = new Map();

  constructor(id: string, name: string, owner: UserProfile) {
    this.id = id;
    this.name = name;
    this.ownerId = owner.id;
    this.participants.set(owner.id, new LeagueMembership(owner.id, 'owner'));
  }

  invite(invite: LeagueInvite): void {
    this.invites.push(invite);
  }

  acceptInvite(userId: string): void {
    const invite = this.invites.find((entry) => entry.userId === userId && entry.leagueId === this.id);
    if (!invite) {
      throw new Error('User is not invited to this league.');
    }

    if (this.participants.has(userId)) {
      throw new Error('User is already a participant in this league.');
    }

    this.participants.set(userId, new LeagueMembership(userId, 'member'));
    invite.status = 'accepted';
  }

  getParticipants(): readonly string[] {
    return [...this.participants.keys()];
  }

  canRunSeason(): boolean {
    return this.participants.size >= 6;
  }

  createDraftOrderForTournament(tournamentId: string): DraftOrder {
    const users = [...this.participants.keys()];
    const shuffled = [...users];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return new DraftOrder(tournamentId, shuffled);
  }
}
