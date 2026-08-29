import { describe, expect, it } from 'vitest';

import { Draft } from './Draft';
import { DraftControlSettings } from './DraftControlSettings';
import { Player } from '../player/Player';

describe('Draft controls', () => {
  it('A draft can track timer and pick direction', () => {
    const draft = new Draft('draft-1', 'Spring Draft');
    const settings = new DraftControlSettings(90, 'ascending');

    draft.setControls(settings);

    expect(draft.getControls().timerSeconds).toBe(90);
    expect(draft.getControls().pickDirection).toBe('ascending');
  });

  it('A draft can enforce gender checks on picks during specific rounds', () => {
    const draft = new Draft('draft-2', 'Summer Draft');
    const settings = new DraftControlSettings(60, 'descending', {
      enabled: true,
      rounds: [1, 2],
      requiredGenderSequence: ['male', 'female'],
    });

    draft.setControls(settings);

    const male = new Player('m-1', 'Avery Brooks', 'avery@example.com', 'male');
    const female = new Player('f-1', 'Blake Cole', 'blake@example.com', 'female');

    expect(draft.canSelectGender(1, 'male')).toBe(true);
    expect(draft.canSelectGender(2, 'female')).toBe(true);
    expect(draft.canSelectGender(3, 'male')).toBe(true);

    draft.recordSelection(male, 1);
    draft.recordSelection(female, 2);

    expect(draft.getGenderCheckStatus()).toBe('pass');
  });
});
