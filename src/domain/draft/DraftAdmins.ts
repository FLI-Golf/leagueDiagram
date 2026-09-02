// The league owner can hand full commissioner powers to any participant.
export class DraftAdmins {
  readonly ownerId: string;
  private readonly delegates: Set<string> = new Set();

  constructor(ownerId: string) {
    this.ownerId = ownerId;
  }

  canAdminister(userId: string): boolean {
    return userId === this.ownerId || this.delegates.has(userId);
  }

  grantOwnerDuties(actorId: string, participantId: string): void {
    this.requireAdmin(actorId, 'grant owner duties');
    this.delegates.add(participantId);
  }

  revokeOwnerDuties(actorId: string, participantId: string): void {
    this.requireAdmin(actorId, 'revoke owner duties');

    if (participantId === this.ownerId) {
      throw new Error('The league owner cannot have owner duties revoked.');
    }

    this.delegates.delete(participantId);
  }

  requireAdmin(actorId: string, action: string): void {
    if (!this.canAdminister(actorId)) {
      throw new Error(`Only the league owner or an assigned co-owner can ${action}.`);
    }
  }

  getDelegates(): readonly string[] {
    return [...this.delegates];
  }
}
