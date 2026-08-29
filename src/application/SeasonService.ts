import { Course } from '../domain/course/Course';
import { Hole } from '../domain/course/Hole';
import { Sponsor } from '../domain/course/Sponsor';
import { DraftControlSettings } from '../domain/draft/DraftControlSettings';
import { FantasyLeague } from '../domain/fantasy/FantasyLeague';
import { FantasyPlayer } from '../domain/fantasy/FantasyPlayer';
import { FantasyTeam } from '../domain/fantasy/FantasyTeam';
import { EventSchedule } from '../domain/league/EventSchedule';
import { SeasonBootstrap, SeasonBootstrapResult } from '../domain/season/SeasonBootstrap';
import { Team } from '../domain/team/Team';
import { TournamentResult } from '../domain/tournament/TournamentResult';
import { UserProfile } from '../domain/user/UserProfile';

export type HolePrizeMetadata = {
  holeNumber: number;
  title: string;
  description: string;
  prize: {
    amount: number;
    currency: string;
    award: string;
  };
  sponsors: readonly Sponsor[];
};

export type FantasyLeagueSeed = FantasyLeague;

export type ReservePro = {
  id: string;
  displayName: string;
  email: string;
  gender: 'male' | 'female';
  reason: string;
};

export type RealisticLeagueSeed = {
  season: SeasonBootstrapResult;
  course: Course;
  tournamentNames: readonly string[];
  sponsors: readonly Sponsor[];
  schedule: EventSchedule;
  holeMetadata: readonly HolePrizeMetadata[];
  realLeagueTeams: readonly Team[];
  reservePros: readonly ReservePro[];
  fantasyLeagues: readonly FantasyLeagueSeed[];
};

export class SeasonService {
  readonly id: string;
  readonly name: string;
  private readonly bootstrap: SeasonBootstrap;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.bootstrap = new SeasonBootstrap(id, name);
  }

  bootstrapSeason(
    users: readonly UserProfile[],
    fantasyTeams: readonly FantasyTeam[],
    tournamentControls: readonly DraftControlSettings[],
  ): SeasonBootstrapResult {
    return this.bootstrap.build(users, fantasyTeams, tournamentControls);
  }

  static createDemoSeason(id: string, name: string): SeasonBootstrapResult {
    const users = [
      new UserProfile('u-1', 'Jamie Reed', 'jamie@example.com'),
      new UserProfile('u-2', 'Morgan Fox', 'morgan@example.com'),
      new UserProfile('u-3', 'Taylor Ross', 'taylor@example.com'),
      new UserProfile('u-4', 'Jordan Quinn', 'jordan@example.com'),
      new UserProfile('u-5', 'Chris Allen', 'chris@example.com'),
      new UserProfile('u-6', 'Casey Dunn', 'casey@example.com'),
    ];

    const fantasyTeams = [
      new FantasyTeam('ft-1', 'The Big Dogs'),
      new FantasyTeam('ft-2', 'Night Hawks'),
    ];

    const teamOnePlayers = [
      new FantasyPlayer('fp-1', { id: 'u-1', displayName: 'Jamie Reed', email: 'jamie@example.com', gender: 'male' }, 'male', 87),
      new FantasyPlayer('fp-2', { id: 'u-2', displayName: 'Morgan Fox', email: 'morgan@example.com', gender: 'female' }, 'female', 85),
      new FantasyPlayer('fp-3', { id: 'u-3', displayName: 'Taylor Ross', email: 'taylor@example.com', gender: 'male' }, 'flex', 82),
    ];

    const teamTwoPlayers = [
      new FantasyPlayer('fp-4', { id: 'u-4', displayName: 'Jordan Quinn', email: 'jordan@example.com', gender: 'male' }, 'male', 88),
      new FantasyPlayer('fp-5', { id: 'u-5', displayName: 'Chris Allen', email: 'chris@example.com', gender: 'female' }, 'female', 84),
      new FantasyPlayer('fp-6', { id: 'u-6', displayName: 'Casey Dunn', email: 'casey@example.com', gender: 'male' }, 'flex', 80),
    ];

    for (const player of teamOnePlayers) {
      fantasyTeams[0].addPlayer(player);
    }

    for (const player of teamTwoPlayers) {
      fantasyTeams[1].addPlayer(player);
    }

    const tournamentControls = [
      new DraftControlSettings(90, 'ascending'),
      new DraftControlSettings(60, 'descending'),
    ];

    return new SeasonService(id, name).bootstrapSeason(users, fantasyTeams, tournamentControls);
  }

  static createRealisticLeagueSeed(id: string, name: string): RealisticLeagueSeed {
    const season = SeasonService.createDemoSeason(id, name);

    const course = new Course('course-blackwood-ridge', 'Blackwood Ridge');
    const sponsorA = new Sponsor('s-1', 'Hawkeye Gear', 'Premium discs and apparel', 'https://example.com/hawkeye.png');
    const sponsorB = new Sponsor('s-2', 'River City BBQ', 'Smoked meats and cold drinks', 'https://example.com/rivercity.png');
    const sponsorC = new Sponsor('s-3', 'Summit Coffee', 'Fresh roast and cold brew', 'https://example.com/summitcoffee.png');

    const holeDefinitions = [
      { number: 1, name: 'Opening Drive', description: 'A wide, forgiving fairway to settle in and start the round clean.', basketSetup: 'Blue basket setup' },
      { number: 2, name: 'Dogleg Bend', description: 'A gentle right turn with a line that protects the lane.', basketSetup: 'Blue basket setup' },
      { number: 3, name: 'Cedar Chute', description: 'The most wooded hole on the front nine with a demanding approach.', basketSetup: 'Blue basket setup' },
      { number: 4, name: 'Long Cross', description: 'A longer drive with a crosswind that punishes weak discs.', basketSetup: 'Blue basket setup' },
      { number: 5, name: 'The Pit', description: 'A tight wooded landing area that rewards patience and placement.', basketSetup: 'Blue basket setup' },
      { number: 6, name: 'Pine Point', description: 'A perfectly framed fairway with a quick, downhill green.', basketSetup: 'Blue basket setup' },
      { number: 7, name: 'Marsh Run', description: 'A long carry over wet ground and a soft approach to the green.', basketSetup: 'Blue basket setup' },
      { number: 8, name: 'Switchback', description: 'A sharp left turn before the green with little room for error.', basketSetup: 'Blue basket setup' },
      { number: 9, name: 'Final Fade', description: 'A confident finish with a flattering landing area and a scenic finish.', basketSetup: 'Blue basket setup' },
    ];

    for (const hole of holeDefinitions) {
      const courseHole = new Hole(`h-${hole.number}`, hole.number, hole.name, hole.description, hole.basketSetup);
      if (hole.number === 3) {
        courseHole.addSponsor(sponsorA);
      }
      if (hole.number === 6) {
        courseHole.addSponsor(sponsorB);
      }
      if (hole.number === 9) {
        courseHole.addSponsor(sponsorC);
      }
      course.addHole(courseHole);
    }

    const tournamentNames = [
      'Spring Opener',
      'Midseason Mixer',
      'Championship Weekend',
    ];

    const holeMetadata: HolePrizeMetadata[] = [
      { holeNumber: 1, title: 'Birdie Bonus', description: 'Closest-to-pin on the opening drive.', prize: { amount: 50, currency: 'USD', award: 'Closest to the pin' }, sponsors: [sponsorA] },
      { holeNumber: 2, title: 'Ace Chase', description: 'Ace pot for a lucky first shot.', prize: { amount: 75, currency: 'USD', award: 'Ace pot' }, sponsors: [sponsorB] },
      { holeNumber: 3, title: 'Cedar Challenge', description: 'Best score on the wooded par four.', prize: { amount: 120, currency: 'USD', award: 'Best score on the hole' }, sponsors: [sponsorA, sponsorC] },
      { holeNumber: 4, title: 'Crosswind Cash', description: 'Best approach on the crosswind hole.', prize: { amount: 80, currency: 'USD', award: 'Best approach' }, sponsors: [sponsorB] },
      { holeNumber: 5, title: 'The Pit Prize', description: 'Best scramble from the tree line.', prize: { amount: 65, currency: 'USD', award: 'Best scramble' }, sponsors: [sponsorC] },
      { holeNumber: 6, title: 'Pine Point Pot', description: 'Longest putt made inside ten feet.', prize: { amount: 90, currency: 'USD', award: 'Longest putt' }, sponsors: [sponsorB] },
      { holeNumber: 7, title: 'Marsh Bonus', description: 'Closest to the pin from the wet side.', prize: { amount: 70, currency: 'USD', award: 'Closest to the pin' }, sponsors: [sponsorA] },
      { holeNumber: 8, title: 'Switchback Showdown', description: 'Best score on the left-turn challenge.', prize: { amount: 110, currency: 'USD', award: 'Best score on the hole' }, sponsors: [sponsorC] },
      { holeNumber: 9, title: 'Final Fade Prize', description: 'Best closing putt under pressure.', prize: { amount: 140, currency: 'USD', award: 'Best closing putt' }, sponsors: [sponsorA, sponsorB, sponsorC] },
    ];

    const schedule = new EventSchedule(`${id}-schedule`);
    const eventDates = ['2026-04-15', '2026-05-20', '2026-06-27'];

    for (let index = 0; index < tournamentNames.length; index += 1) {
      const event = new TournamentResult(`t-${index + 1}`, tournamentNames[index], []);
      schedule.addEvent(eventDates[index], event);
    }

    const realLeagueTeams: Team[] = [
      new Team('team-1', 'Ace Makers', { id: 'real-m-1', displayName: 'Simon Lizotte', email: 'simon@fli.example.com', gender: 'male' }, { id: 'real-f-1', displayName: 'Kat Mertsch', email: 'kat@fli.example.com', gender: 'female' }),
      new Team('team-2', 'Birdie Storm', { id: 'real-m-2', displayName: 'Isaac Robinson', email: 'isaac@fli.example.com', gender: 'male' }, { id: 'real-f-2', displayName: 'Missy Gannon', email: 'missy@fli.example.com', gender: 'female' }),
      new Team('team-3', 'Chain Breakers', { id: 'real-m-3', displayName: 'Paul McBeth', email: 'paul@fli.example.com', gender: 'male' }, { id: 'real-f-3', displayName: 'Holyn Handley', email: 'holyn@fli.example.com', gender: 'female' }),
      new Team('team-4', 'Chain Seekers', { id: 'real-m-4', displayName: 'Anthony Barela', email: 'anthony@fli.example.com', gender: 'male' }, { id: 'real-f-4', displayName: 'Hailey King', email: 'hailey@fli.example.com', gender: 'female' }),
      new Team('team-5', 'Disc Dynasty', { id: 'real-m-5', displayName: 'Chris Dickerson', email: 'chris@fli.example.com', gender: 'male' }, { id: 'real-f-5', displayName: 'Paige Pierce', email: 'paige@fli.example.com', gender: 'female' }),
      new Team('team-6', 'Disc Jesters', { id: 'real-m-6', displayName: 'Kyle Klein', email: 'kyle@fli.example.com', gender: 'male' }, { id: 'real-f-6', displayName: 'Silva Saarinen', email: 'silva@fli.example.com', gender: 'female' }),
      new Team('team-7', 'Fairway Bombers', { id: 'real-m-7', displayName: 'Niklas Anttila', email: 'niklas@fli.example.com', gender: 'male' }, { id: 'real-f-7', displayName: 'Heidi Laine', email: 'heidi@fli.example.com', gender: 'female' }),
      new Team('team-8', 'Flight Squad', { id: 'real-m-8', displayName: 'Calvin Heimburg', email: 'calvin@fli.example.com', gender: 'male' }, { id: 'real-f-8', displayName: 'Ohn Scoggins', email: 'ohn@fli.example.com', gender: 'female' }),
      new Team('team-9', 'Glide Masters', { id: 'real-m-9', displayName: 'Ezra Robinson', email: 'ezra@fli.example.com', gender: 'male' }, { id: 'real-f-9', displayName: 'Natalie Ryan', email: 'natalie@fli.example.com', gender: 'female' }),
      new Team('team-10', 'Huk-a-Mania', { id: 'real-m-10', displayName: 'Ricky Wysocki', email: 'ricky@fli.example.com', gender: 'male' }, { id: 'real-f-10', displayName: 'Evelina Salonen', email: 'evelina@fli.example.com', gender: 'female' }),
      new Team('team-11', 'Hyzer Heros', { id: 'real-m-11', displayName: 'Gannon Buhr', email: 'gannon@fli.example.com', gender: 'male' }, { id: 'real-f-11', displayName: 'Kristin Latt', email: 'kristin@fli.example.com', gender: 'female' }),
      new Team('team-12', 'Midas Touch', { id: 'real-m-12', displayName: 'Matthew Orum', email: 'matthew@fli.example.com', gender: 'male' }, { id: 'real-f-12', displayName: 'Ella Hansen', email: 'ella@fli.example.com', gender: 'female' }),
    ];

    const reservePros: ReservePro[] = [
      { id: 'reserve-1', displayName: 'Nate Doss', email: 'nate@fli.example.com', gender: 'male', reason: 'Travel backup' },
      { id: 'reserve-2', displayName: 'Mariah Smith', email: 'mariah@fli.example.com', gender: 'female', reason: 'Late-swap coverage' },
      { id: 'reserve-3', displayName: 'Avery Jenkins', email: 'avery@fli.example.com', gender: 'male', reason: 'Course-specific replacement' },
      { id: 'reserve-4', displayName: 'Stevie Mickelson', email: 'stevie@fli.example.com', gender: 'female', reason: 'Injury relief' },
    ];

    const fantasyLeagues: FantasyLeagueSeed[] = [
      new FantasyLeague(
        `${id}-fantasy-1`,
        'Sundown Six',
        Array.from({ length: 6 }, (_, index) => new UserProfile(`fantasy-${index + 1}`, `Fantasy ${index + 1}`, `fantasy${index + 1}@example.com`)),
      ),
      new FantasyLeague(
        `${id}-fantasy-2`,
        'Ridge Roster',
        Array.from({ length: 6 }, (_, index) => new UserProfile(`fantasy-b-${index + 1}`, `Fantasy B ${index + 1}`, `fantasyb${index + 1}@example.com`)),
      ),
    ];

    return {
      season,
      course,
      tournamentNames,
      sponsors: [sponsorA, sponsorB, sponsorC],
      schedule,
      holeMetadata,
      realLeagueTeams,
      reservePros,
      fantasyLeagues,
    };
  }
}
