export class UserProfile {
  readonly id: string;
  displayName: string;
  email: string;

  constructor(id: string, displayName: string, email: string) {
    this.id = id;
    this.displayName = displayName;
    this.email = email;
  }

  updateDisplayName(displayName: string): void {
    this.displayName = displayName;
  }

  updateEmail(email: string): void {
    this.email = email;
  }
}
