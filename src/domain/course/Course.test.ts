import { describe, expect, it } from 'vitest';

import { Course } from './Course';
import { Hole } from './Hole';
import { Sponsor } from './Sponsor';

const makeCourse = (): Course => {
  const course = new Course('course-1', 'Oak Valley');

  course.addHole(new Hole('h-1', 1, 'Opening Drive', 'An easy opening shot...', 'Front nine basket setup'));
  course.addHole(new Hole('h-2', 2, 'Dogleg Bend', 'A right turn around the pines.', 'Front nine basket setup'));
  course.addHole(new Hole('h-3', 3, 'Cedar Chute', 'A tight fairway with a dramatic downhill putt.', 'Front nine basket setup'));
  course.addHole(new Hole('h-4', 4, 'Long Cross', 'A long straight drive with open landing area.', 'Front nine basket setup'));
  course.addHole(new Hole('h-5', 5, 'The Pit', 'A wooded landing zone with a tricky scramble.', 'Front nine basket setup'));
  course.addHole(new Hole('h-6', 6, 'Pine Point', 'A low tree line and a fast green.', 'Front nine basket setup'));
  course.addHole(new Hole('h-7', 7, 'Marsh Run', 'A long carry over the water feature.', 'Front nine basket setup'));
  course.addHole(new Hole('h-8', 8, 'The Switchback', 'A sharp left turn before the green.', 'Front nine basket setup'));
  course.addHole(new Hole('h-9', 9, 'Final Fade', 'A confident approach to the clubhouse.', 'Front nine basket setup'));

  return course;
};

describe('Course domain model', () => {
  it('A Course can contain nine named holes with detailed descriptions', () => {
    const course = makeCourse();

    expect(course.getHoles()).toHaveLength(9);
    expect(course.getHoleByNumber(1).name).toBe('Opening Drive');
    expect(course.getHoleByNumber(9).description).toContain('clubhouse');
  });

  it('A tournament round uses the same 9 holes twice with an intermission after hole 9', () => {
    const course = makeCourse();
    const round = course.buildTournamentRound();

    expect(round).toHaveLength(18);
    expect(round[8].number).toBe(9);
    expect(round[9].number).toBe(1);
    expect(course.intermissionAfterHoleNumber).toBe(9);
  });

  it('A course can resolve a hole number across an 18-hole round even when the course only contains 9 holes', () => {
    const course = makeCourse();

    expect(course.getHoleForRoundNumber(10).name).toBe('Opening Drive');
    expect(course.getHoleForRoundNumber(11).name).toBe('Dogleg Bend');
    expect(course.getHoleForRoundNumber(18).name).toBe('Final Fade');
  });

  it('A hole can display sponsor advertisements and signage', () => {
    const hole = new Hole('h-1', 1, 'Opening Drive', 'A wide open start.', 'Blue basket setup');
    const sponsorA = new Sponsor('s-1', 'Hawkeye Gear', 'Premium discs and apparel', 'https://example.com/hawkeye.png');
    const sponsorB = new Sponsor('s-2', 'River City BBQ', 'Smoked meats and cold drinks', 'https://example.com/rivercity.png');

    hole.addSponsor(sponsorA);
    hole.addSponsor(sponsorB);

    expect(hole.getSponsors()).toHaveLength(2);
    expect(hole.getSponsors()[0].name).toBe('Hawkeye Gear');
    expect(hole.getSponsors()[1].tagline).toBe('Smoked meats and cold drinks');
  });

  it('The back nine can be rearranged for tournament basket placement', () => {
    const course = makeCourse();
    const backNine = course.getHoles().slice().reverse();

    course.setBackNine(backNine);

    expect(course.buildTournamentRound()[9].name).toBe(backNine[0].name);
    expect(course.buildTournamentRound()[17].name).toBe(backNine[8].name);
  });

  it('A hole can show a clear baseline distance and basket move note when setup changes', () => {
    const hole = new Hole('h-10', 10, 'Moved Tee', 'A shifted basket changes the approach.', 'Blue basket setup', 3, 222, 210, -8, 'left');

    expect(hole.getDistanceLabel()).toBe('210 ft / 222 ft');
    expect(hole.getBasketMoveNote()).toBe('Basket moved 8 ft left');
  });
});
