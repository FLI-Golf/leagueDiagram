import { describe, expect, it } from 'vitest';

import { League } from '../league/League';
import { UserProfile } from './UserProfile';

describe('User profile domain model', () => {
  it('A League can hold user profiles', () => {
    const league = new League('league-1', 'Test League');
    const profile = new UserProfile('user-1', 'Sam Smith', 'sam@example.com');

    league.addMember(profile);

    expect(league.getMembers()).toHaveLength(1);
    expect(league.getMembers()[0]).toBe(profile);
  });

  it('A UserProfile can update its public details', () => {
    const profile = new UserProfile('user-2', 'Jordan Lee', 'jordan@example.com');

    profile.updateDisplayName('Jordan L.');
    profile.updateEmail('jordan.lee@newmail.com');

    expect(profile.displayName).toBe('Jordan L.');
    expect(profile.email).toBe('jordan.lee@newmail.com');
  });
});
