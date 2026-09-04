import { Course } from '../domain/course/Course';
import { Hole } from '../domain/course/Hole';
import { Sponsor } from '../domain/course/Sponsor';
import { DraftControlSettings } from '../domain/draft/DraftControlSettings';
import { FantasyLeague } from '../domain/fantasy/FantasyLeague';
import { FantasyPlayer } from '../domain/fantasy/FantasyPlayer';
import { FantasyTeam } from '../domain/fantasy/FantasyTeam';
import { EventSchedule } from '../domain/league/EventSchedule';
import { SeasonBootstrap, SeasonBootstrapResult } from '../domain/season/SeasonBootstrap';
import { Sponsorship, SponsorshipProgram } from '../domain/sponsorship/Sponsorship';
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

export type TitleSponsorInput = {
  name: string;
  amount: number;
};

export type ReservePro = {
  id: string;
  displayName: string;
  email: string;
  gender: 'male' | 'female';
  reason: string;
};

export type PayoutPlacement = {
  place: number;
  label: string;
  amount: number;
};

export type TournamentPayoutSummary = {
  name: string;
  date: string;
  eventTotal: number;
  placements: readonly PayoutPlacement[];
};

export type SeasonPayoutBreakdown = {
  totalPurse: number;
  events: readonly TournamentPayoutSummary[];
};

export type RealisticLeagueSeed = {
  season: SeasonBootstrapResult;
  course: Course;
  courseOptions: readonly Course[];
  tournamentNames: readonly string[];
  sponsors: readonly Sponsor[];
  sponsorshipProgram: SponsorshipProgram;
  schedule: EventSchedule;
  holeMetadata: readonly HolePrizeMetadata[];
  realLeagueTeams: readonly Team[];
  reservePros: readonly ReservePro[];
  fantasyLeagues: readonly FantasyLeagueSeed[];
  payoutBreakdown: SeasonPayoutBreakdown;
};

export class SeasonService {
  private static readonly PRESENTING_SPONSOR_AMOUNT = 900_000;

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
    purseAmount = 4_000_000,
  ): SeasonBootstrapResult {
    return this.bootstrap.build(users, fantasyTeams, tournamentControls, purseAmount);
  }

  static canCreateSeason(user: UserProfile): boolean {
    return user.hasRole('siteAdmin') || user.hasRole('leagueAdmin') || user.hasRole('scorekeeper');
  }

  // The presenting sponsor is the next-highest default commitment; the title sponsor must outspend it.
  static getMinimumTitleSponsorAmount(): number {
    return SeasonService.PRESENTING_SPONSOR_AMOUNT;
  }

  static createNamedSeason(id: string, name: string, purseAmount = 4_000_000, titleSponsor?: TitleSponsorInput): RealisticLeagueSeed {
    return SeasonService.createRealisticLeagueSeed(id, name, purseAmount, titleSponsor);
  }

  static getEventPayoutAmount(eventIndex: number, finishPosition: number, payoutBreakdown: SeasonPayoutBreakdown = SeasonService.createProgressivePayoutBreakdown()): number {
    const placements = payoutBreakdown.events[eventIndex]?.placements ?? [];
    const placement = placements[Math.max(0, finishPosition - 1)];
    return placement?.amount ?? 0;
  }

  static getEventPayoutTotal(eventIndex: number, payoutBreakdown: SeasonPayoutBreakdown = SeasonService.createProgressivePayoutBreakdown()): number {
    return payoutBreakdown.events[eventIndex]?.eventTotal ?? payoutBreakdown.totalPurse;
  }

  static createProgressivePayoutBreakdown(): SeasonPayoutBreakdown {
    const eventTotals = [400_000, 480_000, 560_000, 720_000, 720_000, 1_120_000];
    const eventDates = ['2026-09-01', '2026-09-15', '2026-09-29', '2026-10-13', '2026-10-27', '2026-11-10'];
    const eventNames = ["America's Mobile Open", 'Blackwood Clash', 'Ridge Rumble', 'Autumn Classic', 'Pine Valley Showdown', 'Championship Weekend'];
    const baseWeights = [0.24, 0.2, 0.16, 0.12, 0.08, 0.06, 0.04, 0.03, 0.02, 0.015, 0.01, 0.005];
    const boostedWeights = baseWeights.map((weight, placementIndex) => (placementIndex >= 6 ? weight * 1.3 : weight));
    const normalizedWeights = boostedWeights.map((weight) => weight / boostedWeights.reduce((sum, item) => sum + item, 0));

    const events = eventNames.map((name, index) => {
      const eventTotal = eventTotals[index];
      const placements = Array.from({ length: 12 }, (_, placementIndex) => ({
        place: placementIndex + 1,
        label: `${placementIndex + 1}${placementIndex === 0 ? 'st' : placementIndex === 1 ? 'nd' : placementIndex === 2 ? 'rd' : 'th'} place`,
        amount: Math.round(eventTotal * normalizedWeights[placementIndex]),
      }));
      const placementsTotal = placements.reduce((sum, placement) => sum + placement.amount, 0);
      const remainder = eventTotal - placementsTotal;

      if (remainder !== 0) {
        placements[0].amount += remainder;
      }

      return {
        name,
        date: eventDates[index],
        eventTotal,
        placements,
      };
    });

    return {
      totalPurse: 4_000_000,
      events,
    };
  }

  static createDemoSeason(id: string, name: string, purseAmount = 4_000_000): SeasonBootstrapResult {
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

    return new SeasonService(id, name).bootstrapSeason(users, fantasyTeams, tournamentControls, purseAmount);
  }

  static createRealisticLeagueSeed(id: string, name: string, purseAmount = 4_000_000, titleSponsor?: TitleSponsorInput): RealisticLeagueSeed {
    if (titleSponsor && titleSponsor.amount <= SeasonService.PRESENTING_SPONSOR_AMOUNT) {
      throw new Error(`The title sponsor must commit more than $${SeasonService.PRESENTING_SPONSOR_AMOUNT.toLocaleString()} to remain the season's top sponsor.`);
    }

    const season = SeasonService.createDemoSeason(id, name, purseAmount);

    const course = new Course('course-turf-paradise', 'Turf Paradise');
    const alternateCourse = new Course('course-arizona-athletic-grounds', 'Arizona Athletic Grounds');
    const sponsorA = new Sponsor('s-1', "America's Mobile", 'Wireless Mobile • $100,000 • LOI Signed', 'https://example.com/americas-mobile.png');
    const sponsorB = new Sponsor('s-2', 'Sur Coffee', 'Beverage • $125,000 • LOI Signed', 'https://example.com/sur-coffee.png');
    const sponsorC = new Sponsor('s-3', 'SCCG Management', 'Advisory Partner • $500,000 to $900,000 • LOI Signed', 'https://example.com/sccg-management.png');
    const officialSponsors = [
      sponsorA,
      sponsorB,
      sponsorC,
      new Sponsor('s-4', 'GK Productions (Go Throw League)', 'Media Partner • $100,000 to $200,000 • LOI Signed', 'https://example.com/gk-productions.png'),
      new Sponsor('s-5', 'Coghlan Technology Group', 'Technology • LOI Signed', 'https://example.com/coghlan.png'),
      new Sponsor('s-6', 'Pure Mobile Productions', 'Media Production • LOI Signed', 'https://example.com/pure-mobile-productions.png'),
      new Sponsor('s-7', 'Smart Boost', 'Social Media • LOI Signed', 'https://example.com/smart-boost.png'),
      new Sponsor('s-8', 'Neology', 'Social Media • LOI Signed', 'https://example.com/neology.png'),
      new Sponsor('s-9', 'Turf Paradise', 'Venue • $100,000 • LOI Signed', 'https://example.com/turf-paradise.png'),
      new Sponsor('s-10', 'State Farm Insurance', 'Insurance • LOI Signed', 'https://example.com/state-farm.png'),
      new Sponsor('s-11', 'Creekside Sponsor', 'Course-side branding and sponsor support.', 'https://example.com/creekside-sponsor.png'),
    ];
    const [, , , mediaSponsor, technologySponsor, , socialSponsor, insightSponsor, venueSponsor, insuranceSponsor] = officialSponsors;
    const titleSponsorEntity = titleSponsor
      ? new Sponsor('s-title-custom', titleSponsor.name, `Title Sponsor • $${titleSponsor.amount.toLocaleString()} • Signed`, 'https://example.com/title-sponsor.png')
      : sponsorA;
    const leagueSponsors = titleSponsor ? [...officialSponsors, titleSponsorEntity] : officialSponsors;
    const titleSponsorAmount = titleSponsor?.amount ?? 1_500_000;
    const sponsorshipProgram = new SponsorshipProgram([
      new Sponsorship('spon-title', titleSponsorEntity, 'title', 'season', id, name || 'Season', titleSponsorAmount, 'signed'),
      new Sponsorship('spon-presenting', sponsorC, 'presenting', 'season', id, name || 'Season', 900_000, 'signed'),
      new Sponsorship('spon-broadcast', mediaSponsor, 'official', 'broadcast', `${id}-broadcast`, 'Season broadcast', 200_000, 'signed'),
      new Sponsorship('spon-technology', technologySponsor, 'official', 'season', id, 'Scoring technology', 150_000, 'loi'),
      new Sponsorship('spon-course', venueSponsor, 'official', 'course', course.id, course.name, 100_000, 'signed'),
      new Sponsorship('spon-hole-2', sponsorB, 'supporting', 'hole', `${course.id}-hole-2`, 'Canyon Cut', 125_000, 'signed'),
      new Sponsorship('spon-hole-8', insightSponsor, 'supporting', 'hole', `${course.id}-hole-8`, 'After Dark Patio 21+', 60_000, 'loi'),
      new Sponsorship('spon-pro-ricky', socialSponsor, 'supporting', 'pro', 'ricky-wysocki', 'Ricky Wysocki', 75_000, 'active'),
      new Sponsorship('spon-pro-simon', insuranceSponsor, 'supporting', 'pro', 'simon-lizotte', 'Simon Lizotte', 65_000, 'active'),
      new Sponsorship('spon-team-ace', insuranceSponsor, 'supporting', 'team', 'team-1', 'Ace Makers', 40_000, 'signed'),
    ]);
    const genericObstacleSponsors = [
      new Sponsor('obs-1', 'Creekside Sponsor', 'Course-side branding for the water feature.', 'https://example.com/creekside.png'),
      new Sponsor('obs-2', 'Hazard Partners', 'Obstacle branding and on-course signage.', 'https://example.com/hazard.png'),
      new Sponsor('obs-3', 'Fairway Support', 'Support for the landing zone and approach lane.', 'https://example.com/fairway.png'),
    ];

    const turfParadiseHoles = [
      { number: 1, name: 'Ridge View', description: 'A tight par 3 with a soft dogleg that rewards precision off the tee.', basketSetup: 'Short nine blue basket setup', distance: 210 },
      { number: 2, name: 'Canyon Cut', description: 'A mid-range shot with a creek guarding the fairway on the approach.', basketSetup: 'Short nine blue basket setup', distance: 295 },
      { number: 3, name: 'Briar Line', description: 'The landing area narrows around a tree line and a fast green.', basketSetup: 'Short nine blue basket setup', distance: 180 },
      { number: 4, name: 'Dogleg Drop', description: 'An obstacle-lined hole with a slight left break and a small green.', basketSetup: 'Short nine blue basket setup', distance: 240 },
      { number: 5, name: 'Mesa Glide', description: 'A gradually uphill shot with a shallow green and a forgiving right side.', basketSetup: 'Short nine blue basket setup', distance: 330 },
      { number: 6, name: 'Pine Capsule', description: 'A compact green surrounded by trees and an elevated tee.', basketSetup: 'Short nine blue basket setup', distance: 150 },
      { number: 7, name: 'Desert Drift', description: 'A longer approach that asks for a stable line over the lake hazard.', basketSetup: 'Short nine blue basket setup', distance: 380 },
      { number: 8, name: 'After Dark Patio 21+', description: 'The party hole: fans and guests must be 21+ on this side of the course.', basketSetup: 'Short nine blue basket setup', distance: 135 },
      { number: 9, name: 'Sunset Finish', description: 'An open finishing hole with enough room to go for the aggressive line.', basketSetup: 'Short nine blue basket setup', distance: 425 },
    ];

    const arizonaAthleticGroundsHoles = [
      { number: 1, name: 'Blue Sky Tee', description: 'A clean opening line with a gentle rise and a forgiving landing zone.', basketSetup: 'Short nine red basket setup', distance: 230 },
      { number: 2, name: 'Crimson Run', description: 'A right-side ridge keeps the green visually tight but still very fair.', basketSetup: 'Short nine red basket setup', distance: 315 },
      { number: 3, name: 'Fence Line', description: 'A strong mid-range shot with added pressure from the fairway edge.', basketSetup: 'Short nine red basket setup', distance: 200 },
      { number: 4, name: 'Windmill Bend', description: 'A crosswind approach that rewards a smooth and confident flight.', basketSetup: 'Short nine red basket setup', distance: 260 },
      { number: 5, name: 'South Loop', description: 'The green sits behind a small mound, making the landing window feel narrower than it looks.', basketSetup: 'Short nine red basket setup', distance: 340 },
      { number: 6, name: 'Mile Marker', description: 'An elevated tee forces a clear line to avoid the rough on the right.', basketSetup: 'Short nine red basket setup', distance: 170 },
      { number: 7, name: 'North Arc', description: 'A longer fade is rewarded if the player can hold the middle of the fairway.', basketSetup: 'Short nine red basket setup', distance: 390 },
      { number: 8, name: 'After Hours Lounge 21+ Party', description: 'The 21+ party hole with a lively atmosphere and dedicated spectator zone.', basketSetup: 'Short nine red basket setup', distance: 165 },
      { number: 9, name: 'Final Stamp', description: 'A confident finishing putt with a wide green and a strong closing feel.', basketSetup: 'Short nine red basket setup', distance: 435 },
    ];

    const blueSetupAdjustments = [0, -8, 12, -10, 15, 14, -12, 18, -16];
    const redSetupAdjustments = [10, -6, 14, -12, 18, 16, -14, 20, -18];

    for (const [index, hole] of turfParadiseHoles.entries()) {
      const basketDelta = blueSetupAdjustments[index];
      const basketAdjustedDistance = Math.max(110, Math.min(440, hole.distance + basketDelta));
      const courseHole = new Hole(
        `short-h-${hole.number}`,
        hole.number,
        hole.name,
        hole.description,
        hole.basketSetup,
        3,
        basketAdjustedDistance,
        hole.distance,
        basketDelta,
        basketDelta < 0 ? 'left' : basketDelta > 0 ? 'right' : null,
      );
      const sponsor = genericObstacleSponsors[(hole.number - 1) % genericObstacleSponsors.length];
      const officialSupportSponsor = officialSponsors[(hole.number - 1) % officialSponsors.length];
      courseHole.addSponsor(sponsor);
      courseHole.addSponsor(officialSupportSponsor);
      course.addHole(courseHole);
    }

    for (const [index, hole] of arizonaAthleticGroundsHoles.entries()) {
      const basketDelta = redSetupAdjustments[index];
      const redAdjustedDistance = Math.max(110, Math.min(440, hole.distance + basketDelta));
      const courseHole = new Hole(
        `alt-short-h-${hole.number}`,
        hole.number,
        hole.name,
        hole.description,
        hole.basketSetup,
        3,
        redAdjustedDistance,
        hole.distance,
        basketDelta,
        basketDelta < 0 ? 'left' : basketDelta > 0 ? 'right' : null,
      );
      const sponsor = genericObstacleSponsors[(hole.number + 1) % genericObstacleSponsors.length];
      const officialSupportSponsor = officialSponsors[(hole.number + 2) % officialSponsors.length];
      courseHole.addSponsor(sponsor);
      courseHole.addSponsor(officialSupportSponsor);
      alternateCourse.addHole(courseHole);
    }

    const courseOptions = [course, alternateCourse];

    const tournamentNames = [
      'America\'s Mobile Open',
      'Sur Coffee Showdown',
      'SCCG Management Invitational',
      'Go Throw League Cup',
      'Turf Paradise Clash',
      'State Farm Championship Weekend',
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
    const firstEventDate = new Date('2026-09-01T00:00:00Z');

    const eventCourseAssignments = [
      'Turf Paradise',
      'Arizona Athletic Grounds',
      'Turf Paradise',
      'Arizona Athletic Grounds',
      'Turf Paradise',
      'Arizona Athletic Grounds',
    ];

    for (let index = 0; index < tournamentNames.length; index += 1) {
      const eventDate = new Date(firstEventDate);
      eventDate.setUTCDate(eventDate.getUTCDate() + index * 14);
      const event = new TournamentResult(`t-${index + 1}`, tournamentNames[index], []);
      schedule.addEvent(eventDate.toISOString().slice(0, 10), event, eventCourseAssignments[index] ?? 'Turf Paradise');
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
      courseOptions,
      tournamentNames,
      sponsors: leagueSponsors,
      sponsorshipProgram,
      schedule,
      holeMetadata,
      realLeagueTeams,
      reservePros,
      fantasyLeagues,
      payoutBreakdown: SeasonService.createProgressivePayoutBreakdown(),
    };
  }
}
