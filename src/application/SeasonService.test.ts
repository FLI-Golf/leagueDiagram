import { describe, expect, it } from 'vitest';

import { DraftControlSettings } from '../domain/draft/DraftControlSettings';
import { FantasyTeam } from '../domain/fantasy/FantasyTeam';
import { UserProfile } from '../domain/user/UserProfile';
import { SeasonService } from './SeasonService';

describe('Season service facade', () => {
  it('Builds a season and exposes the league, fantasy teams, and draft schedule through one service', () => {
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

    const service = new SeasonService('season-service-1', 'Spring Season');
    const season = service.bootstrapSeason(users, fantasyTeams, [
      new DraftControlSettings(90, 'ascending'),
      new DraftControlSettings(60, 'descending'),
    ]);

    expect(season.league.getParticipants()).toHaveLength(6);
    expect(season.fantasyTeams).toHaveLength(2);
    expect(season.draftOrders).toHaveLength(2);
    expect(season.draftOrders[0].controls.timerSeconds).toBe(90);
  });

  it('Creates a one-call demo season with six users, fantasy teams, and draft controls', () => {
    const season = SeasonService.createDemoSeason('demo-season-1', 'Demo Season');

    expect(season.league.getParticipants()).toHaveLength(6);
    expect(season.fantasyTeams).toHaveLength(2);
    expect(season.draftOrders).toHaveLength(2);
    expect(season.draftOrders[0].controls.pickDirection).toBe('ascending');
    expect(season.draftOrders[1].controls.pickDirection).toBe('descending');
  });

  it('Creates a realistic league seed with course, tournaments, sponsor details, prize metadata, and a real schedule in one call', () => {
    const seed = SeasonService.createRealisticLeagueSeed('realistic-seed-1', 'Summer League');

    expect(seed.season.league.getParticipants()).toHaveLength(6);
    expect(seed.course.name).toBe('Turf Paradise');
    expect(seed.course.getHoles()).toHaveLength(9);
    expect(seed.course.buildTournamentRound()).toHaveLength(18);
    expect(seed.course.buildTournamentRound()[8].number).toBe(9);
    expect(seed.course.buildTournamentRound()[9].number).toBe(1);
    expect(seed.tournamentNames).toHaveLength(6);
    expect(seed.sponsors).toHaveLength(11);
    expect(seed.course.getHoleByNumber(3).getSponsors()[0].name).toMatch(/Creekside Sponsor|Hazard Partners|Fairway Support/);
    expect(seed.schedule.getEvents()).toHaveLength(6);
    expect(seed.schedule.getEvents()[0].date).toBe('2026-06-02');
    expect(seed.schedule.getEvents()[0].result.name).toBe('Sunset Open');
    expect(seed.schedule.getEvents()[1].date).toBe('2026-06-16');
    expect(seed.schedule.getEvents()[2].date).toBe('2026-06-30');
    expect(seed.schedule.getEvents()[5].date).toBe('2026-08-11');
    expect(seed.schedule.getEvents()[0].courseName).toBe('Turf Paradise');
    expect(seed.schedule.getEvents()[2].courseName).toBe('Canyon Mesa Park');
    expect(seed.holeMetadata[2].prize.amount).toBe(120);
    expect(seed.holeMetadata[2].sponsors[0].name).toBe("America's Mobile");
  });

  it('Creates a realistic league setup that includes 12 mixed-gender teams and six-person fantasy leagues', () => {
    const seed = SeasonService.createRealisticLeagueSeed('realistic-seed-2', 'Summer League');

    expect(seed.realLeagueTeams).toHaveLength(12);
    expect(seed.realLeagueTeams.every((team) => team.malePlayer.gender === 'male' && team.femalePlayer.gender === 'female')).toBe(true);
    expect(seed.fantasyLeagues).toHaveLength(2);
    expect(seed.fantasyLeagues.every((league) => league.getParticipants().length === 6)).toBe(true);
  });

  it('Provides two course options including a nine-hole adjustable par-3 course with generic obstacle sponsors', () => {
    const seed = SeasonService.createRealisticLeagueSeed('realistic-seed-3', 'Summer League');

    expect(seed.courseOptions).toHaveLength(2);
    const turfCourse = seed.courseOptions.find((course) => course.name === 'Turf Paradise');
    const shortCourse = seed.courseOptions.find((course) => course.name === 'Arizona Athletic Grounds');

    expect(turfCourse).toBeDefined();
    expect(shortCourse).toBeDefined();
    expect(shortCourse?.getHoles()).toHaveLength(9);
    expect(shortCourse?.getHoles().every((hole) => hole.par === 3)).toBe(true);
    expect(shortCourse?.getHoles().every((hole) => hole.distance >= 110 && hole.distance <= 440)).toBe(true);
    expect(shortCourse?.getHoles()[0].getSponsors()[0].name).toMatch(/Creekside Sponsor|Hazard Partners|Fairway Support/);
    expect(turfCourse?.getHoleByNumber(8).name).not.toBe(shortCourse?.getHoleByNumber(8).name);
    expect(turfCourse?.getHoleByNumber(8).name).toMatch(/Party|21/);
    expect(shortCourse?.getHoleByNumber(8).name).toMatch(/Party|21/);
  });

  it('Creates a progressive payout table that pays all 12 teams in order of finish and totals the 4 million purse', () => {
    const payoutBreakdown = SeasonService.createProgressivePayoutBreakdown();

    expect(payoutBreakdown.totalPurse).toBe(4_000_000);
    expect(payoutBreakdown.events).toHaveLength(6);
    expect(payoutBreakdown.events[0].name).toBe('Sunset Open');
    expect(payoutBreakdown.events[0].eventTotal).toBe(400_000);
    expect(payoutBreakdown.events[5].eventTotal).toBe(1_120_000);
    expect(payoutBreakdown.events[0].placements).toHaveLength(12);
    expect(payoutBreakdown.events[0].placements[0].amount).toBe(94_490);
    expect(payoutBreakdown.events[5].placements[0].amount).toBe(264_568);
    expect(payoutBreakdown.events[0].placements[6].amount).toBe(20_472);
    expect(payoutBreakdown.events[5].placements[11].amount).toBe(7_165);

    const eventTotals = payoutBreakdown.events.reduce((sum, event) => sum + event.eventTotal, 0);
    expect(eventTotals).toBe(payoutBreakdown.totalPurse);

    for (const event of payoutBreakdown.events) {
      const placementsTotal = event.placements.reduce((sum, placement) => sum + placement.amount, 0);
      expect(placementsTotal).toBe(event.eventTotal);
    }
  });

  it('keeps payout amounts descending by finish position', () => {
    const payoutBreakdown = SeasonService.createProgressivePayoutBreakdown();
    const placements = payoutBreakdown.events[0].placements;

    for (let index = 1; index < placements.length; index += 1) {
      expect(placements[index - 1].amount).toBeGreaterThan(placements[index].amount);
    }
  });

  it('uses the selected event total and payout amount instead of the championship total', () => {
    const payoutBreakdown = SeasonService.createProgressivePayoutBreakdown();

    expect(SeasonService.getEventPayoutTotal(0, payoutBreakdown)).toBe(400_000);
    expect(SeasonService.getEventPayoutAmount(0, 1, payoutBreakdown)).toBe(94_490);
    expect(SeasonService.getEventPayoutTotal(5, payoutBreakdown)).toBe(1_120_000);
    expect(SeasonService.getEventPayoutAmount(5, 1, payoutBreakdown)).toBe(264_568);
  });

  it('creates a winter schedule and scales event payouts to the selected season purse', () => {
    const seed = SeasonService.createNamedSeason('winter-season-1', 'Winter Season', 8_000_000);

    expect(seed.schedule.getEvents()[0].date).toBe('2026-12-01');
    expect(seed.schedule.getEvents()[5].date).toBe('2027-02-09');
    expect(seed.schedule.getEvents()[0].result.name).toBe('Snowline Open');
    expect(seed.schedule.getEvents()[0].courseName).toBe('Pine Ridge Disc Park');
    expect(seed.payoutBreakdown.totalPurse).toBe(8_000_000);
    expect(seed.payoutBreakdown.events.reduce((sum, event) => sum + event.eventTotal, 0)).toBe(8_000_000);
    expect(seed.payoutBreakdown.events[0].eventTotal).toBe(800_000);
  });

  it('creates a multi-round season with a configurable course from 9 to 33 holes', () => {
    const seed = SeasonService.createNamedSeason('multi-round-season-1', 'Championship Season', 6_000_000, undefined, {
      format: 'multi-round',
      courseHoleCount: 24,
    });

    expect(seed.format).toBe('multi-round');
    expect(seed.scoringHoleCount).toBe(24);
    expect(seed.course.getHoles()).toHaveLength(24);
    expect(seed.course.getHoleByNumber(24).name).toBe('Pine Point 24');
  });

  it('lets a league admin set a custom title sponsor as long as it outspends the other season sponsors', () => {
    const seed = SeasonService.createNamedSeason('upcoming-season-1', 'Winter Circuit', 4_000_000, {
      name: 'Northwind Outfitters',
      amount: 2_000_000,
    });

    const title = seed.sponsorshipProgram.getTitleSponsorship();
    expect(title?.sponsor.name).toBe('Northwind Outfitters');
    expect(title?.amount).toBe(2_000_000);
    expect(seed.sponsorshipProgram.isTitleSponsorPrincipal()).toBe(true);
    expect(seed.sponsors.some((sponsor) => sponsor.name === 'Northwind Outfitters')).toBe(true);
  });

  it('uses the default commitment for a custom title sponsor when no amount is supplied', () => {
    const seed = SeasonService.createNamedSeason('upcoming-season-default-sponsor', 'Winter Circuit', 4_000_000, {
      name: 'Northwind Outfitters',
    });

    const title = seed.sponsorshipProgram.getTitleSponsorship();
    expect(title?.sponsor.name).toBe('Northwind Outfitters');
    expect(title?.amount).toBe(1_500_000);
    expect(seed.sponsorshipProgram.isTitleSponsorPrincipal()).toBe(true);
  });

  it('rejects a title sponsor that would not pay the most', () => {
    expect(() =>
      SeasonService.createNamedSeason('upcoming-season-2', 'Winter Circuit', 4_000_000, {
        name: 'Bargain Bin Sponsors',
        amount: 500_000,
      }),
    ).toThrow(/title sponsor must commit more/i);
  });
});
