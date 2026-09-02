import { describe, expect, it } from 'vitest';

import { FantasyLeague } from '../fantasy/FantasyLeague';
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

  it('A UserProfile can carry app roles and allow pro content posts', () => {
    const profile = new UserProfile(
      'pro-1',
      'Simon Lizotte',
      'simon@fli.example.com',
      ['pro', 'fantasyParticipant', 'viewer'],
      'Disc golf pro and content creator',
    );

    expect(profile.hasRole('pro')).toBe(true);
    expect(profile.hasRole('leagueAdmin')).toBe(false);

    profile.addFanPost('Training day in the gym and on the course.');

    expect(profile.getFanPosts()).toHaveLength(1);
    expect(profile.getFanPosts()[0].body).toContain('Training day');
  });

  it('A UserProfile can carry site admin and scorekeeper roles', () => {
    const profile = new UserProfile('site-admin-1', 'Taylor Thompson', 'taylor@fli.example.com', [
      'siteAdmin',
      'scorekeeper',
      'viewer',
    ]);

    expect(profile.hasRole('siteAdmin')).toBe(true);
    expect(profile.hasRole('scorekeeper')).toBe(true);
    expect(profile.hasRole('viewer')).toBe(true);
  });

  it('A registered user starts as a viewer and gains fantasy roles by creating a league', () => {
    const profile = UserProfile.register('user-3', 'Casey Kim', 'casey@example.com');

    expect(profile.getRoles()).toEqual(['viewer']);

    FantasyLeague.createdBy('fantasy-1', 'Casey Invitational', profile);

    expect(profile.hasRole('fantasyLeagueOwner')).toBe(true);
    expect(profile.hasRole('fantasyParticipant')).toBe(true);
  });

  it('A UserProfile tracks commerce activity with tags instead of roles', () => {
    const profile = UserProfile.register('user-4', 'Robin Vale', 'robin@example.com');

    profile.addTag('ticketBuyer');
    profile.addTag('merchandiseBuyer');
    profile.addTag('ticketBuyer');

    expect(profile.getTags()).toEqual(['ticketBuyer', 'merchandiseBuyer']);
    expect(profile.getRoles()).toEqual(['viewer']);
  });
});
