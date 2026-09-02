import { Player } from '../player/Player';
import { DraftAdmins } from './DraftAdmins';
import { DraftRoom } from './DraftRoom';

export const REQUIRED_PARTICIPANTS = 6;

export type Shuffle = (participantIds: readonly string[]) => readonly string[];

const randomShuffle: Shuffle = (participantIds) => {
  const shuffled = [...participantIds];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

type DraftPlan = {
  tournamentIds: readonly string[];
  pool: readonly Player[];
  timerSeconds: number;
  shuffle: Shuffle;
};

// One independent re-draft per remaining tournament, each with its own snake order.
// Every room is built the moment the sixth participant joins, so the whole board is
// known up front instead of being decided tournament by tournament.
export class MockDraftSeries {
  readonly id: string;
  readonly admins: DraftAdmins;
  private readonly participants: string[] = [];
  private readonly rooms: Map<string, DraftRoom> = new Map();
  private plan?: DraftPlan;

  constructor(id: string, ownerId: string) {
    this.id = id;
    this.admins = new DraftAdmins(ownerId);
    this.participants.push(ownerId);
  }

  // Starting late costs you the tournaments already played.
  static remainingTournaments(scheduledIds: readonly string[], completedIds: readonly string[]): readonly string[] {
    const completed = new Set(completedIds);
    return scheduledIds.filter((tournamentId) => !completed.has(tournamentId));
  }

  configure(
    actorId: string,
    tournamentIds: readonly string[],
    pool: readonly Player[],
    timerSeconds = 60,
    shuffle: Shuffle = randomShuffle,
  ): void {
    this.admins.requireAdmin(actorId, 'configure the draft');

    if (this.isBuilt()) {
      throw new Error('The draft rooms are already built and cannot be reconfigured.');
    }

    if (tournamentIds.length === 0) {
      throw new Error('There are no tournaments left to draft for.');
    }

    this.plan = { tournamentIds: [...tournamentIds], pool: [...pool], timerSeconds, shuffle };
    this.buildIfReady();
  }

  join(participantId: string): void {
    if (this.participants.includes(participantId)) {
      throw new Error('That participant has already joined the draft.');
    }

    if (this.isFull()) {
      throw new Error(`A mock draft holds exactly ${REQUIRED_PARTICIPANTS} participants.`);
    }

    this.participants.push(participantId);
    this.buildIfReady();
  }

  private buildIfReady(): void {
    if (!this.plan || !this.isFull() || this.isBuilt()) {
      return;
    }

    for (const tournamentId of this.plan.tournamentIds) {
      this.rooms.set(
        tournamentId,
        new DraftRoom(
          tournamentId,
          this.plan.shuffle(this.participants),
          this.plan.pool,
          this.admins,
          this.plan.timerSeconds,
        ),
      );
    }
  }

  isFull(): boolean {
    return this.participants.length === REQUIRED_PARTICIPANTS;
  }

  isBuilt(): boolean {
    return this.rooms.size > 0;
  }

  getParticipants(): readonly string[] {
    return [...this.participants];
  }

  getRoom(tournamentId: string): DraftRoom {
    const room = this.rooms.get(tournamentId);
    if (!room) {
      throw new Error(`No draft room exists for ${tournamentId}.`);
    }

    return room;
  }

  lockRoom(tournamentId: string): void {
    this.rooms.get(tournamentId)?.lock();
  }

  getRooms(): readonly DraftRoom[] {
    return [...this.rooms.values()];
  }
}
