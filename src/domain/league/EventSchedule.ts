import { TournamentResult } from '../tournament/TournamentResult';

export class EventScheduleEntry {
  readonly date: string;
  readonly result: TournamentResult;
  readonly courseId?: string;
  readonly courseName?: string;

  constructor(date: string, result: TournamentResult, courseId?: string, courseName?: string) {
    this.date = date;
    this.result = result;
    this.courseId = courseId;
    this.courseName = courseName;
  }
}

export class EventSchedule {
  readonly id: string;
  private readonly events: EventScheduleEntry[] = [];

  constructor(id: string) {
    this.id = id;
  }

  addEvent(date: string, result: TournamentResult, courseIdOrName?: string): void {
    const courseId = courseIdOrName && courseIdOrName.includes(' ') ? undefined : courseIdOrName;
    const courseName = courseIdOrName && courseIdOrName.includes(' ') ? courseIdOrName : undefined;
    this.events.push(new EventScheduleEntry(date, result, courseId, courseName));
    this.events.sort((left, right) => left.date.localeCompare(right.date));
  }

  getEvents(): readonly EventScheduleEntry[] {
    return [...this.events];
  }
}
