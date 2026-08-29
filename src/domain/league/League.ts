import { Team } from '../team/Team';
import { UserProfile } from '../user/UserProfile';
import { Season } from './Season';

export class League {
  readonly id: string;
  readonly name: string;
  private readonly seasons: Season[] = [];
  private readonly members: UserProfile[] = [];
  private readonly teams: Team[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addSeason(season: Season): void {
    this.seasons.push(season);
  }

  getSeasons(): readonly Season[] {
    return [...this.seasons];
  }

  addMember(member: UserProfile): void {
    this.members.push(member);
  }

  getMembers(): readonly UserProfile[] {
    return [...this.members];
  }

  addTeam(team: Team): void {
    if (this.teams.length >= 12) {
      throw new Error('A league cannot contain more than 12 teams.');
    }

    this.teams.push(team);
  }

  getTeams(): readonly Team[] {
    return [...this.teams];
  }
}
