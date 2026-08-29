import { describe, expect, it } from 'vitest';

import { FantasyLeague } from './FantasyLeague';
import { UserProfile } from '../user/UserProfile';

describe('Fantasy league model', () => {
  it('A fantasy league can have up to six participants', () => {
    const participants = Array.from({ length: 6 }, (_, index) => new UserProfile(`user-${index + 1}`, `Player ${index + 1}`, `player${index + 1}@example.com`));

    const league = new FantasyLeague('fantasy-1', 'Weekend League', participants);

    expect(league.getParticipants()).toHaveLength(6);
    expect(league.isFull()).toBe(true);
  });

  it('A fantasy league rejects more than six participants', () => {
    const participants = Array.from({ length: 7 }, (_, index) => new UserProfile(`user-${index + 1}`, `Player ${index + 1}`, `player${index + 1}@example.com`));

    expect(() => new FantasyLeague('fantasy-2', 'Too Many Players', participants)).toThrow('A fantasy league cannot have more than 6 participants.');
  });
});
