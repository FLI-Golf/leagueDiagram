import { UserProfile } from '../user/UserProfile';

export class FantasyLeague {
  readonly id: string;
  readonly name: string;
  private readonly participants: UserProfile[] = [];

  constructor(id: string, name: string, participants: readonly UserProfile[] = []) {
    this.id = id;
    this.name = name;

    if (participants.length > 6) {
      throw new Error('A fantasy league cannot have more than 6 participants.');
    }

    for (const participant of participants) {
      this.addParticipant(participant);
    }
  }

  addParticipant(participant: UserProfile): void {
    if (this.participants.length >= 6) {
      throw new Error('A fantasy league cannot have more than 6 participants.');
    }

    if (this.participants.some((entry) => entry.id === participant.id)) {
      throw new Error('A fantasy participant cannot be added twice.');
    }

    this.participants.push(participant);
  }

  getParticipants(): readonly string[] {
    return this.participants.map((participant) => participant.id);
  }

  isFull(): boolean {
    return this.participants.length === 6;
  }
}
