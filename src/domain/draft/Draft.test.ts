import { describe, expect, it } from 'vitest';

import { Player } from '../player/Player';
import { Draft } from './Draft';
import { DraftSelection } from './DraftSelection';

const makePlayer = (id: string, name: string, gender: 'male' | 'female') =>
  new Player(id, name, `${id}@example.com`, gender);

describe('Draft domain model', () => {
  it('A draft records picks in order and supports a round-based flow', () => {
    const draft = new Draft('draft-1', 'Spring Draft');
    const first = makePlayer('p-1', 'Avery Brooks', 'male');
    const second = makePlayer('p-2', 'Blake Cole', 'female');

    draft.select(first);
    draft.select(second);

    expect(draft.getSelections()).toHaveLength(2);
    expect(draft.getSelections()[0].player.id).toBe('p-1');
    expect(draft.getCurrentRound()).toBe(1);
  });

  it('A draft can prevent duplicate player selections', () => {
    const draft = new Draft('draft-2', 'Summer Draft');
    const player = makePlayer('p-3', 'Casey Dunn', 'male');

    draft.select(player);

    expect(() => draft.select(player)).toThrow('A player cannot be selected twice in the same draft.');
  });

  it('A draft exposes selection order and round metadata', () => {
    const draft = new Draft('draft-3', 'Fall Draft');

    for (let i = 1; i <= 3; i += 1) {
      const gender = i % 2 === 0 ? 'female' : 'male';
      draft.select(makePlayer(`p-${i}`, `Player ${i}`, gender));
    }

    const selection = draft.getSelections()[2] as DraftSelection;
    expect(selection.round).toBe(2);
    expect(selection.pickNumber).toBe(3);
  });
});
