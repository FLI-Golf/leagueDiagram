import { describe, expect, it } from 'vitest';

import { FantasyDraft } from './FantasyDraft';
import { FantasyPlayer } from './FantasyPlayer';
import { FantasyRoster } from './FantasyRoster';

describe('Fantasy player and draft model', () => {
  it('A fantasy player can be created from a real player and assigned a fantasy team', () => {
    const realPlayer = {
      id: 'p-1',
      displayName: 'Avery Brooks',
      email: 'avery@example.com',
      gender: 'male' as const,
    };

    const fantasyPlayer = new FantasyPlayer('fp-1', realPlayer, 'male', 88);

    expect(fantasyPlayer.realPlayer.id).toBe('p-1');
    expect(fantasyPlayer.position).toBe('male');
    expect(fantasyPlayer.overallRating).toBe(88);
  });

  it('A draft can select a fantasy roster in order and prevent duplicates', () => {
    const roster = new FantasyRoster('roster-1', 'The Big Dogs');
    const draft = new FantasyDraft('draft-1', 'Spring Fantasy Draft');

    const firstPlayer = new FantasyPlayer('fp-2', { id: 'p-2', displayName: 'Blake Cole', email: 'blake@example.com', gender: 'female' }, 'female', 91);
    const secondPlayer = new FantasyPlayer('fp-3', { id: 'p-3', displayName: 'Casey Dunn', email: 'casey@example.com', gender: 'male' }, 'male', 87);

    draft.addPick(roster, firstPlayer);
    expect(() => draft.addPick(roster, firstPlayer)).toThrow('A fantasy player cannot be drafted twice in the same draft.');

    draft.addPick(new FantasyRoster('roster-2', 'Night Hawks'), secondPlayer);
    expect(draft.getPicks()).toHaveLength(2);
  });
});
