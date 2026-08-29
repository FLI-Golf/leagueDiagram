export type AppRole =
  | 'viewer'
  | 'member'
  | 'leagueAdmin'
  | 'scorekeeper'
  | 'fantasyParticipant'
  | 'fantasyLeagueOwner'
  | 'pro';

export type FanPost = {
  id: string;
  body: string;
  createdAt: string;
};
