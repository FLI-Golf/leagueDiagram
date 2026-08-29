import { UserProfile } from '../user/UserProfile';
import { FantasyTeam } from './FantasyTeam';

export class FantasyLeague {
  readonly id: string;
  readonly name: string;
  private readonly participants: UserProfile[] = [];
  private readonly teams: FantasyTeam[] = [];
  private readonly teamByParticipantId: Map<string, FantasyTeam> = new Map();

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

  createTeamForParticipant(participantId: string, teamName: string): FantasyTeam {
    const participant = this.participants.find((entry) => entry.id === participantId);
    if (!participant) {
      throw new Error('A participant must belong to this fantasy league before creating a team.');
    }

    if (this.teamByParticipantId.has(participantId)) {
      throw new Error('A participant can only own one fantasy team per league.');
    }

    const team = new FantasyTeam(`${this.id}-team-${this.teams.length + 1}`, teamName);
    this.teams.push(team);
    this.teamByParticipantId.set(participantId, team);
    return team;
  }

  getParticipants(): readonly string[] {
    return this.participants.map((participant) => participant.id);
  }

  getTeams(): readonly FantasyTeam[] {
    return [...this.teams];
  }

  getTeamForParticipant(participantId: string): FantasyTeam | undefined {
    return this.teamByParticipantId.get(participantId);
  }

  isFull(): boolean {
    return this.participants.length === 6;
  }
}
