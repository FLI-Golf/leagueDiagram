import { describe, expect, it } from 'vitest';

import { ProPlayer } from '../player/Player';
import { DraftAdmins } from './DraftAdmins';
import { DraftRoom } from './DraftRoom';
import { MockDraftSeries } from './MockDraftSeries';

const participantIds = ['owner', 'p2', 'p3', 'p4', 'p5', 'p6'];

// 12 teams, each one male and one female, so 24 players across 6 rosters of 4.
const buildPool = (): ProPlayer[] =>
  Array.from({ length: 12 }).flatMap((_, index) => [
    new ProPlayer(`m${index + 1}`, `Male ${index + 1}`, `m${index + 1}@fli.example.com`, 'male'),
    new ProPlayer(`f${index + 1}`, `Female ${index + 1}`, `f${index + 1}@fli.example.com`, 'female'),
  ]);

const buildRoom = (order: readonly string[] = participantIds): DraftRoom =>
  new DraftRoom('tournament-1', order, buildPool(), new DraftAdmins('owner'), 60);

const pickFirstEligible = (room: DraftRoom): void => {
  const participantId = room.getParticipantOnTheClock() as string;
  const [player] = room.getSelectablePlayers(participantId);
  room.pick(participantId, player.id);
};

describe('Mock draft room', () => {
  it('derives four rounds and a two-per-gender cap from the player pool', () => {
    const room = buildRoom();

    expect(room.rounds).toBe(4);
    expect(room.maxPerGender).toBe(2);
    expect(room.getStatus()).toBe('pending');
  });

  it('runs the pick order as a snake', () => {
    const room = buildRoom();
    const seen: string[] = [];

    for (let pick = 0; pick < 12; pick += 1) {
      seen.push(room.getParticipantOnTheClock() as string);
      pickFirstEligible(room);
    }

    expect(seen.slice(0, 6)).toEqual(participantIds);
    expect(seen.slice(6, 12)).toEqual([...participantIds].reverse());
  });

  it('reports who is next up, including around the snake turn', () => {
    const room = buildRoom();

    expect(room.getParticipantOnTheClock()).toBe('owner');
    expect(room.getNextParticipant()).toBe('p2');

    for (let pick = 0; pick < 5; pick += 1) {
      pickFirstEligible(room);
    }

    // Last pick of round one, so the order doubles back on itself.
    expect(room.getParticipantOnTheClock()).toBe('p6');
    expect(room.getNextParticipant()).toBe('p6');

    while (room.getStatus() !== 'complete') {
      pickFirstEligible(room);
    }

    expect(room.getParticipantOnTheClock()).toBeNull();
    expect(room.getNextParticipant()).toBeNull();
  });

  it('closes picks once the tournament locks the room', () => {
    const room = buildRoom();

    expect(room.isLocked()).toBe(false);
    room.pick('owner', 'm1');

    room.lock();

    expect(room.isLocked()).toBe(true);
    expect(() => room.pick('p2', 'f1')).toThrow('Picks are closed because the tournament has started.');
    expect(room.getPicks()).toHaveLength(1);
  });

  it('rejects a pick made out of turn', () => {
    const room = buildRoom();

    expect(() => room.pick('p3', 'm1')).toThrow("It is not p3's turn to pick.");
  });

  it('rejects a player who is already drafted', () => {
    const room = buildRoom();

    room.pick('owner', 'm1');
    pickFirstEligible(room);

    expect(() => room.pick('p3', 'm1')).toThrow('That player has already been drafted.');
  });

  it('leaves rounds one and two unrestricted', () => {
    const room = buildRoom();

    expect(room.getSelectablePlayers('owner')).toHaveLength(24);

    room.pick('owner', 'm1');
    for (let pick = 0; pick < 10; pick += 1) {
      pickFirstEligible(room);
    }

    // Owner is on the clock again in round two and still holds only one male.
    expect(room.getCurrentRound()).toBe(2);
    expect(room.getParticipantOnTheClock()).toBe('owner');
    expect(room.getSelectablePlayers('owner').some((player) => player.gender === 'male')).toBe(true);
  });

  it('hides males from a participant who already holds two of them', () => {
    const room = buildRoom();

    room.pick('owner', 'm1');
    for (let pick = 0; pick < 10; pick += 1) {
      pickFirstEligible(room);
    }

    const secondMale = room.getAvailablePlayers().find((player) => player.gender === 'male') as ProPlayer;
    room.pick('owner', secondMale.id);

    expect(room.getGenderCount('owner', 'male')).toBe(2);
    expect(room.getSelectablePlayers('owner').every((player) => player.gender === 'female')).toBe(true);

    const anotherMale = room.getAvailablePlayers().find((player) => player.gender === 'male') as ProPlayer;
    expect(() => room.pick('owner', anotherMale.id)).toThrow(/already holds 2 male players/);
  });

  it('fills every roster with two males and two females', () => {
    const room = buildRoom();

    while (room.getStatus() !== 'complete') {
      pickFirstEligible(room);
    }

    expect(room.getPicks()).toHaveLength(24);
    for (const participantId of participantIds) {
      expect(room.getGenderCount(participantId, 'male')).toBe(2);
      expect(room.getGenderCount(participantId, 'female')).toBe(2);
    }
  });
});

describe('Mock draft pick clock', () => {
  it('counts down from the duration the owner set and auto-picks when it expires', () => {
    const room = buildRoom();

    room.setTimerSeconds('owner', 30);
    room.open('owner', 0);

    expect(room.getSecondsRemaining(10_000)).toBe(20);
    expect(room.isOnTheClockExpired(10_000)).toBe(false);
    expect(() => room.autoPick(10_000)).toThrow('The pick clock has not expired.');

    expect(room.isOnTheClockExpired(30_000)).toBe(true);
    const pick = room.autoPick(30_000);

    expect(pick.participantId).toBe('owner');
    expect(room.getParticipantOnTheClock()).toBe('p2');
    expect(room.getSecondsRemaining(30_000)).toBe(30);
  });

  it('only lets an administrator change the timer or open the draft', () => {
    const room = buildRoom();

    expect(() => room.setTimerSeconds('p4', 30)).toThrow('Only the league owner or an assigned co-owner can change the pick timer.');
    expect(() => room.open('p4', 0)).toThrow('Only the league owner or an assigned co-owner can open the draft.');
    expect(() => room.setTimerSeconds('owner', 0)).toThrow('The pick timer must be a positive number of seconds.');
  });
});

describe('Mock draft series', () => {
  const fillSeries = (series: MockDraftSeries): void => {
    for (const participantId of participantIds.slice(1)) {
      series.join(participantId);
    }
  };

  it('waits for the sixth participant before building any rooms', () => {
    const series = new MockDraftSeries('series-1', 'owner');

    series.configure('owner', ['t2', 't3'], buildPool());

    expect(series.isBuilt()).toBe(false);

    for (const participantId of ['p2', 'p3', 'p4', 'p5']) {
      series.join(participantId);
      expect(series.isBuilt()).toBe(false);
    }

    series.join('p6');

    expect(series.isFull()).toBe(true);
    expect(series.isBuilt()).toBe(true);
    expect(series.getRooms()).toHaveLength(2);
  });

  it('builds immediately when the schedule is configured after the roster fills', () => {
    const series = new MockDraftSeries('series-1', 'owner');

    fillSeries(series);

    expect(series.isFull()).toBe(true);
    expect(series.isBuilt()).toBe(false);

    series.configure('owner', ['t2', 't3'], buildPool());

    expect(series.isBuilt()).toBe(true);
  });

  it('guards the roster against duplicates and overflow', () => {
    const series = new MockDraftSeries('series-1', 'owner');

    expect(() => series.join('owner')).toThrow('That participant has already joined the draft.');

    fillSeries(series);

    expect(() => series.join('p7')).toThrow('A mock draft holds exactly 6 participants.');
  });

  it('drops tournaments that have already been played', () => {
    const scheduled = ['t1', 't2', 't3', 't4', 't5', 't6'];

    expect(MockDraftSeries.remainingTournaments(scheduled, [])).toHaveLength(6);
    expect(MockDraftSeries.remainingTournaments(scheduled, ['t1'])).toEqual(['t2', 't3', 't4', 't5', 't6']);
  });

  it('gives every remaining tournament its own randomized snake order', () => {
    const series = new MockDraftSeries('series-1', 'owner');
    const orders = [
      ['p2', 'owner', 'p3', 'p4', 'p5', 'p6'],
      ['p6', 'p5', 'p4', 'p3', 'p2', 'owner'],
    ];
    let call = 0;

    series.configure('owner', ['t2', 't3'], buildPool(), 45, () => orders[call++]);
    fillSeries(series);

    expect(series.getRooms()).toHaveLength(2);
    expect(series.getRoom('t2').order).toEqual(orders[0]);
    expect(series.getRoom('t3').order).toEqual(orders[1]);
    expect(series.getRoom('t2').getTimerSeconds()).toBe(45);
  });

  it('refuses to reconfigure a board that is already built', () => {
    const series = new MockDraftSeries('series-1', 'owner');

    series.configure('owner', ['t2'], buildPool());
    fillSeries(series);

    expect(() => series.configure('owner', ['t3'], buildPool())).toThrow(
      'The draft rooms are already built and cannot be reconfigured.',
    );
  });

  it('lets the owner hand full owner duties to a participant', () => {
    const series = new MockDraftSeries('series-1', 'owner');
    fillSeries(series);

    expect(series.admins.canAdminister('p2')).toBe(false);
    expect(() => series.configure('p2', ['t2'], buildPool())).toThrow(
      'Only the league owner or an assigned co-owner can configure the draft.',
    );

    series.admins.grantOwnerDuties('owner', 'p2');

    expect(series.admins.canAdminister('p2')).toBe(true);
    series.configure('p2', ['t2'], buildPool());
    series.getRoom('t2').setTimerSeconds('p2', 90);
    expect(series.getRoom('t2').getTimerSeconds()).toBe(90);
  });

  it('locks a single room without touching the others', () => {
    const series = new MockDraftSeries('series-1', 'owner');

    series.configure('owner', ['t2', 't3'], buildPool());
    fillSeries(series);

    series.lockRoom('t2');

    expect(series.getRoom('t2').isLocked()).toBe(true);
    expect(series.getRoom('t3').isLocked()).toBe(false);
  });

  it('never lets a co-owner strip the league owner', () => {    const series = new MockDraftSeries('series-1', 'owner');

    series.admins.grantOwnerDuties('owner', 'p2');

    expect(() => series.admins.revokeOwnerDuties('p2', 'owner')).toThrow(
      'The league owner cannot have owner duties revoked.',
    );

    series.admins.revokeOwnerDuties('owner', 'p2');
    expect(series.admins.canAdminister('p2')).toBe(false);
  });
});
