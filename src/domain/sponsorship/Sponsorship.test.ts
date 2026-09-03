import { describe, expect, it } from 'vitest';

import { Sponsor } from '../course/Sponsor';
import { Sponsorship, SponsorshipProgram } from './Sponsorship';

const sponsor = (id: string, name: string) => new Sponsor(id, name, `${name} partnership`, `https://example.com/${id}.png`);

describe('Sponsorship program', () => {
  it('A season carries one title sponsor alongside hole, course, and pro deals', () => {
    const program = new SponsorshipProgram([
      new Sponsorship('sp-1', sponsor('s-1', "America's Mobile"), 'title', 'season', 'season-1', 'FLI Inaugural Season', 1_500_000),
      new Sponsorship('sp-2', sponsor('s-2', 'Turf Paradise'), 'official', 'course', 'course-1', 'Turf Paradise', 100_000),
      new Sponsorship('sp-3', sponsor('s-3', 'Sur Coffee'), 'supporting', 'hole', 'hole-2', 'Canyon Cut', 125_000),
      new Sponsorship('sp-4', sponsor('s-4', 'Smart Boost'), 'supporting', 'pro', 'ricky-wysocki', 'Ricky Wysocki', 75_000),
    ]);

    expect(program.getTitleSponsorship()?.sponsor.name).toBe("America's Mobile");
    expect(program.getByScope('hole')).toHaveLength(1);
    expect(program.getByScope('pro')[0].scopeName).toBe('Ricky Wysocki');
    expect(program.getTotalValue()).toBe(1_800_000);
    expect(program.isTitleSponsorPrincipal()).toBe(true);
  });

  it('A second title sponsor is rejected', () => {
    const program = new SponsorshipProgram([
      new Sponsorship('sp-1', sponsor('s-1', "America's Mobile"), 'title', 'season', 'season-1', 'Season', 1_500_000),
    ]);

    expect(() =>
      program.add(new Sponsorship('sp-2', sponsor('s-2', 'Neology'), 'title', 'season', 'season-1', 'Season', 900_000)),
    ).toThrow('A season can only have one title sponsor.');
  });

  it('Flags a title sponsor that is outspent by another partner', () => {
    const program = new SponsorshipProgram([
      new Sponsorship('sp-1', sponsor('s-1', 'Neology'), 'title', 'season', 'season-1', 'Season', 250_000),
      new Sponsorship('sp-2', sponsor('s-2', 'SCCG Management'), 'presenting', 'season', 'season-1', 'Season', 900_000),
    ]);

    expect(program.isTitleSponsorPrincipal()).toBe(false);
    expect(program.getRanked()[0].sponsor.name).toBe('SCCG Management');
  });

  it('Rejects negative commitments', () => {
    expect(() => new Sponsorship('sp-x', sponsor('s-x', 'Bad Deal'), 'official', 'team', 'team-1', 'Ace Makers', -1)).toThrow(
      'A sponsorship amount cannot be negative.',
    );
  });
});
