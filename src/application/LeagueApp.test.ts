import { describe, expect, it } from 'vitest';

import { Course } from '../domain/course/Course';
import { Hole } from '../domain/course/Hole';
import { Player } from '../domain/player/Player';
import { Scorecard } from '../domain/player/Scorecard';
import { LeagueApp } from './LeagueApp';

describe('League app facade', () => {
  it('Registers players, adds a course, and records tournament standings from one access point', () => {
    const app = new LeagueApp('league-app-1', 'City Champs');

    const playerOne = app.registerPlayer('p-1', 'Avery Brooks', 'avery@example.com');
    const playerTwo = app.registerPlayer('p-2', 'Blake Cole', 'blake@example.com');

    const course = new Course('course-1', 'Oak Valley');
    course.addHole(new Hole('h-1', 1, 'Opening Drive', 'Smooth start', 'Blue basket setup'));
    course.addHole(new Hole('h-2', 2, 'Dogleg Bend', 'Tight right turn', 'Blue basket setup'));

    app.addCourse(course);

    const firstCard = new Scorecard(playerOne);
    firstCard.recordScore(1, 3);
    firstCard.recordScore(2, 4);

    const secondCard = new Scorecard(playerTwo);
    secondCard.recordScore(1, 4);
    secondCard.recordScore(2, 4);

    app.recordTournament('2026-05-12', 'Spring Open', [firstCard, secondCard]);

    expect(app.getLeague().name).toBe('City Champs');
    expect(app.getPlayers()).toHaveLength(2);
    expect(app.getCourses()).toHaveLength(1);
    expect(app.getStandings()[0].player.id).toBe('p-1');
    expect(app.getEvents()).toHaveLength(1);
  });
});
