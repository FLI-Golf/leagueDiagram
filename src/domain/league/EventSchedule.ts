import { TournamentResult } from '../tournament/TournamentResult';

export class EventScheduleEntry {
  readonly date: string;
  readonly result: TournamentResult;

  constructor(date: string, result: TournamentResult) {
    this.date = date;
    this.result = result;
  }
}

export class EventSchedule {
  readonly id: string;
  private readonly events: EventScheduleEntry[] = [];

  constructor(id: string) {
    this.id = id;
  }

  addEvent(date: string, result: TournamentResult): void {
    this.events.push(new EventScheduleEntry(date, result));
    this.events.sort((left, right) => left.date.localeCompare(right.date));
  }

  getEvents(): readonly EventScheduleEntry[] {
    return [...this.events];
  }
}
