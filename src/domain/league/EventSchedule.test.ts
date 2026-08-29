import { describe, expect, it } from 'vitest';

import { LeagueTable } from './LeagueTable';
import { EventSchedule } from './EventSchedule';
import { TournamentResult } from '../tournament/TournamentResult';
import { Player } from '../player/Player';
import { Scorecard } from '../player/Scorecard';

const player = (id: string, name: string): Player => new Player(id, name, `${id}@example.com`);

describe('Tournament and league results model', () => {
  it('A TournamentResult can capture the winner and the round score', () => {
    const firstPlace = player('p-1', 'Avery Brooks');
    const runnerUp = player('p-2', 'Blake Cole');
    const winningCard = new Scorecard(firstPlace);
    winningCard.recordScore(1, 3);
    winningCard.recordScore(2, 4);

    const runnerUpCard = new Scorecard(runnerUp);
    runnerUpCard.recordScore(1, 4);
    runnerUpCard.recordScore(2, 4);

    const result = new TournamentResult('t-1', 'Oak Valley Open', [winningCard, runnerUpCard]);

    expect(result.getWinner()?.player.id).toBe('p-1');
    expect(result.totalEntries()).toBe(2);
  });

  it('A LeagueTable can rank players by cumulative tournament points', () => {
    const p1 = player('p-3', 'Casey Dunn');
    const p2 = player('p-4', 'Drew Shaw');

    const p1Card = new Scorecard(p1);
    p1Card.recordScore(1, 3);
    p1Card.recordScore(2, 4);

    const p2Card = new Scorecard(p2);
    p2Card.recordScore(1, 4);
    p2Card.recordScore(2, 4);

    const table = new LeagueTable('league-1', 'Season Table');
    table.recordResult(new TournamentResult('t-2', 'Spring Open', [p1Card, p2Card]));

    const secondP1Card = new Scorecard(p1);
    secondP1Card.recordScore(1, 5);
    secondP1Card.recordScore(2, 5);

    const secondP2Card = new Scorecard(p2);
    secondP2Card.recordScore(1, 4);
    secondP2Card.recordScore(2, 5);

    table.recordResult(new TournamentResult('t-3', 'Summer Open', [secondP2Card, secondP1Card]));

    expect(table.getStandings()[0].player.id).toBe('p-3');
    expect(table.getStandings()[1].player.id).toBe('p-4');
  });

  it('An EventSchedule keeps tournaments in date order', () => {
    const schedule = new EventSchedule('league-1');
    const open = new TournamentResult('t-4', 'Opening Event', []);
    const finals = new TournamentResult('t-5', 'Championship', []);

    schedule.addEvent('2026-05-10', open);
    schedule.addEvent('2026-04-15', finals);

    expect(schedule.getEvents()[0].date).toBe('2026-04-15');
    expect(schedule.getEvents()[1].date).toBe('2026-05-10');
  });

  it('An EventSchedule can record the course for each tournament event', () => {
    const schedule = new EventSchedule('league-1');
    const open = new TournamentResult('t-6', 'Opening Event', []);

    schedule.addEvent('2026-05-10', open, 'Turf Paradise');

    expect(schedule.getEvents()[0].courseName).toBe('Turf Paradise');
    expect(schedule.getEvents()[0].courseId).toBeUndefined();
  });
});
