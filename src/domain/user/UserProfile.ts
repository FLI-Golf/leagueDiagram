import type { AppRole, FanPost } from './UserRole';

export class UserProfile {
  readonly id: string;
  displayName: string;
  email: string;
  bio: string;
  private readonly roles: Set<AppRole>;
  private readonly fanPosts: FanPost[] = [];

  constructor(
    id: string,
    displayName: string,
    email: string,
    roles: readonly AppRole[] = ['viewer'],
    bio = '',
  ) {
    this.id = id;
    this.displayName = displayName;
    this.email = email;
    this.bio = bio;
    this.roles = new Set<AppRole>(roles.length > 0 ? roles : ['viewer']);
  }

  updateDisplayName(displayName: string): void {
    this.displayName = displayName;
  }

  updateEmail(email: string): void {
    this.email = email;
  }

  updateBio(bio: string): void {
    this.bio = bio;
  }

  hasRole(role: AppRole): boolean {
    return this.roles.has(role);
  }

  addRole(role: AppRole): void {
    this.roles.add(role);
  }

  getRoles(): readonly AppRole[] {
    return [...this.roles];
  }

  addFanPost(body: string): FanPost {
    const post: FanPost = {
      id: `${this.id}-post-${this.fanPosts.length + 1}`,
      body,
      createdAt: new Date().toISOString(),
    };

    this.fanPosts.push(post);
    return post;
  }

  getFanPosts(): readonly FanPost[] {
    return [...this.fanPosts];
  }
}
