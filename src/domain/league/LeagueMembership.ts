export class LeagueMembership {
  readonly userId: string;
  readonly role: 'owner' | 'member';

  constructor(userId: string, role: 'owner' | 'member' = 'member') {
    this.userId = userId;
    this.role = role;
  }
}
