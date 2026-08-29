import { describe, expect, it } from 'vitest';

import { Player } from './Player';
import { Round } from './Round';
import { Scorecard } from './Scorecard';
import { Standing } from './Standing';

const makePlayer = (id: string, name: string): Player => new Player(id, name, 'player@example.com');

describe('Player and round domain model', () => {
  it('A Player can register with a profile and rating', () => {
    const player = makePlayer('p-1', 'Avery Brooks');

    expect(player.id).toBe('p-1');
    expect(player.displayName).toBe('Avery Brooks');
    expect(player.email).toBe('player@example.com');
  });

  it('A Scorecard records hole-by-hole scores and totals', () => {
    const player = makePlayer('p-2', 'Blake Cole');
    const card = new Scorecard(player);

    card.recordScore(1, 3);
    card.recordScore(2, 4);
    card.recordScore(3, 5);

    expect(card.getScoreForHole(2)).toBe(4);
    expect(card.totalScore()).toBe(12);
  });

  it('A Round can keep many scorecards and determine the winner', () => {
    const round = new Round('r-1', 'Oak Valley 19-hole event');
    const playerOne = makePlayer('p-3', 'Casey Dunn');
    const playerTwo = makePlayer('p-4', 'Drew Shaw');

    const cardOne = new Scorecard(playerOne);
    const cardTwo = new Scorecard(playerTwo);

    cardOne.recordScore(1, 3);
    cardOne.recordScore(2, 4);
    cardTwo.recordScore(1, 4);
    cardTwo.recordScore(2, 4);

    round.addScorecard(cardOne);
    round.addScorecard(cardTwo);

    expect(round.getScorecards()).toHaveLength(2);
    expect(round.getWinner()?.player.id).toBe('p-3');
  });

  it('Standings sort players from best to worst total score', () => {
    const playerOne = makePlayer('p-5', 'Emerson Tate');
    const playerTwo = makePlayer('p-6', 'Finley Ross');

    const cardOne = new Scorecard(playerOne);
    cardOne.recordScore(1, 3);
    cardOne.recordScore(2, 4);

    const cardTwo = new Scorecard(playerTwo);
    cardTwo.recordScore(1, 4);
    cardTwo.recordScore(2, 4);

    const standings = Standing.fromScorecards([cardOne, cardTwo]);

    expect(standings[0].player.id).toBe('p-5');
    expect(standings[1].player.id).toBe('p-6');
  });
});
