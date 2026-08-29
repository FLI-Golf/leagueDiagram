import { Course } from '../domain/course/Course';
import { League } from '../domain/league/League';
import { EventSchedule } from '../domain/league/EventSchedule';
import { LeagueTable } from '../domain/league/LeagueTable';
import { ProPlayer } from '../domain/player/Player';
import { Scorecard } from '../domain/player/Scorecard';
import { TournamentResult } from '../domain/tournament/TournamentResult';

export class LeagueApp {
  private readonly league: League;
  private readonly players: ProPlayer[] = [];
  private readonly courses: Course[] = [];
  private readonly eventSchedule: EventSchedule;
  private readonly leagueTable: LeagueTable;

  constructor(id: string, name: string) {
    this.league = new League(id, name);
    this.eventSchedule = new EventSchedule(id);
    this.leagueTable = new LeagueTable(id, `${name} Standings`);
  }

  registerPlayer(id: string, displayName: string, email: string): ProPlayer {
    const player = new ProPlayer(id, displayName, email);
    this.players.push(player);
    this.league.addMember({
      id: player.id,
      displayName: player.displayName,
      email: player.email,
      updateDisplayName: () => undefined,
      updateEmail: () => undefined,
    });
    return player;
  }

  addCourse(course: Course): void {
    this.courses.push(course);
  }

  recordTournament(date: string, name: string, entries: readonly Scorecard[]): void {
    const result = new TournamentResult(`${date}-${name}`, name, entries);
    this.eventSchedule.addEvent(date, result);
    this.leagueTable.recordResult(result);
  }

  getLeague(): League {
    return this.league;
  }

  getPlayers(): readonly ProPlayer[] {
    return [...this.players];
  }

  getCourses(): readonly Course[] {
    return [...this.courses];
  }

  getStandings(): Array<{ player: { id: string; displayName: string }; totalPoints: number }> {
    return this.leagueTable.getStandings();
  }

  getEvents(): ReadonlyArray<ReturnType<EventSchedule['getEvents']>[number]> {
    return this.eventSchedule.getEvents();
  }
}
