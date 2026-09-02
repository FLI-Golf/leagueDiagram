// Roles answer "what may this account do?" — they gate access.
export type AppRole =
  | 'viewer'
  | 'member'
  | 'siteAdmin'
  | 'leagueAdmin'
  | 'scorekeeper'
  | 'fantasyParticipant'
  | 'fantasyLeagueOwner'
  | 'pro';

// Tags answer "what has this account done?" — they segment users, they never gate access.
export type UserTag = 'ticketBuyer' | 'merchandiseBuyer' | 'seasonPassHolder' | 'sponsor';

export type FanPost = {
  id: string;
  body: string;
  createdAt: string;
};
