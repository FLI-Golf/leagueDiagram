import { Player, PlayerGender } from '../player/Player';
import { DraftAdmins } from './DraftAdmins';

export type DraftRoomStatus = 'pending' | 'inProgress' | 'complete';

export class RoomPick {
  readonly participantId: string;
  readonly player: Player;
  readonly round: number;
  readonly pickNumber: number;

  constructor(participantId: string, player: Player, round: number, pickNumber: number) {
    this.participantId = participantId;
    this.player = player;
    this.round = round;
    this.pickNumber = pickNumber;
  }
}

export class DraftRoom {
  readonly tournamentId: string;
  readonly order: readonly string[];
  readonly rounds: number;
  readonly maxPerGender: number;
  private readonly pool: readonly Player[];
  private readonly admins: DraftAdmins;
  private readonly picks: RoomPick[] = [];
  private timerSeconds: number;
  private clockStartedAt: number | null = null;
  private locked = false;

  constructor(
    tournamentId: string,
    order: readonly string[],
    pool: readonly Player[],
    admins: DraftAdmins,
    timerSeconds = 60,
  ) {
    if (order.length === 0) {
      throw new Error('A draft room needs at least one participant.');
    }

    if (new Set(order).size !== order.length) {
      throw new Error('A participant cannot appear twice in the draft order.');
    }

    if (pool.length % order.length !== 0) {
      throw new Error('The player pool must divide evenly across the participants.');
    }

    const rounds = pool.length / order.length;
    if (rounds % 2 !== 0) {
      throw new Error('The draft needs an even number of rounds so rosters can be gender balanced.');
    }

    const males = pool.filter((player) => player.gender === 'male').length;
    if (males * 2 !== pool.length) {
      throw new Error('The player pool must hold an equal number of male and female players.');
    }

    this.tournamentId = tournamentId;
    this.order = [...order];
    this.pool = [...pool];
    this.admins = admins;
    this.rounds = rounds;
    this.maxPerGender = rounds / 2;
    this.timerSeconds = timerSeconds;
  }

  getStatus(): DraftRoomStatus {
    if (this.picks.length === this.pool.length) {
      return 'complete';
    }

    return this.clockStartedAt === null ? 'pending' : 'inProgress';
  }

  open(actorId: string, now: number): void {
    this.admins.requireAdmin(actorId, 'open the draft');
    this.clockStartedAt = now;
  }

  setTimerSeconds(actorId: string, seconds: number): void {
    this.admins.requireAdmin(actorId, 'change the pick timer');

    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('The pick timer must be a positive number of seconds.');
    }

    this.timerSeconds = seconds;
  }

  getTimerSeconds(): number {
    return this.timerSeconds;
  }

  getSecondsRemaining(now: number): number {
    if (this.clockStartedAt === null || this.getStatus() === 'complete') {
      return this.timerSeconds;
    }

    const elapsed = Math.floor((now - this.clockStartedAt) / 1000);
    return Math.max(0, this.timerSeconds - elapsed);
  }

  isOnTheClockExpired(now: number): boolean {
    return this.getStatus() === 'inProgress' && this.getSecondsRemaining(now) === 0;
  }

  getCurrentRound(): number {
    return Math.min(this.rounds, Math.floor(this.picks.length / this.order.length) + 1);
  }

  // Snake: odd rounds run down the order, even rounds run back up it.
  getParticipantForPick(pickNumber: number): string | null {
    if (pickNumber < 1 || pickNumber > this.pool.length) {
      return null;
    }

    const index = pickNumber - 1;
    const round = Math.floor(index / this.order.length) + 1;
    const indexInRound = index % this.order.length;
    return round % 2 === 1 ? this.order[indexInRound] : this.order[this.order.length - 1 - indexInRound];
  }

  getParticipantOnTheClock(): string | null {
    return this.getParticipantForPick(this.picks.length + 1);
  }

  getNextParticipant(): string | null {
    return this.getParticipantForPick(this.picks.length + 2);
  }

  getRoster(participantId: string): readonly Player[] {
    return this.picks.filter((pick) => pick.participantId === participantId).map((pick) => pick.player);
  }

  getGenderCount(participantId: string, gender: PlayerGender): number {
    return this.getRoster(participantId).filter((player) => player.gender === gender).length;
  }

  getAvailablePlayers(): readonly Player[] {
    const taken = new Set(this.picks.map((pick) => pick.player.id));
    return this.pool.filter((player) => !taken.has(player.id));
  }

  // Rounds 1 and 2 are unrestricted; the cap only bites once a roster is full at a gender.
  getSelectablePlayers(participantId: string): readonly Player[] {
    return this.getAvailablePlayers().filter(
      (player) => this.getGenderCount(participantId, player.gender) < this.maxPerGender,
    );
  }

  // Once the tournament is under way the roster is final, or a late pick could chase known results.
  lock(): void {
    this.locked = true;
  }

  isLocked(): boolean {
    return this.locked;
  }

  pick(participantId: string, playerId: string, now?: number): RoomPick {
    if (this.locked) {
      throw new Error('Picks are closed because the tournament has started.');
    }

    if (this.getStatus() === 'complete') {
      throw new Error('The draft is already complete.');
    }

    const onTheClock = this.getParticipantOnTheClock();
    if (participantId !== onTheClock) {
      throw new Error(`It is not ${participantId}'s turn to pick.`);
    }

    const player = this.pool.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error('That player is not in this draft pool.');
    }

    if (this.picks.some((pick) => pick.player.id === playerId)) {
      throw new Error('That player has already been drafted.');
    }

    if (this.getGenderCount(participantId, player.gender) >= this.maxPerGender) {
      throw new Error(
        `${participantId} already holds ${this.maxPerGender} ${player.gender} players and must pick another gender.`,
      );
    }

    const pick = new RoomPick(participantId, player, this.getCurrentRound(), this.picks.length + 1);
    this.picks.push(pick);

    if (now !== undefined) {
      this.clockStartedAt = now;
    }

    return pick;
  }

  autoPick(now: number): RoomPick {
    if (!this.isOnTheClockExpired(now)) {
      throw new Error('The pick clock has not expired.');
    }

    const participantId = this.getParticipantOnTheClock() as string;
    const [next] = this.getSelectablePlayers(participantId);
    if (!next) {
      throw new Error('No eligible player remains for the participant on the clock.');
    }

    return this.pick(participantId, next.id, now);
  }

  getPicks(): readonly RoomPick[] {
    return [...this.picks];
  }
}
