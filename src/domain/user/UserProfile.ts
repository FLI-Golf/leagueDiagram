import type { AppRole, FanPost, UserTag } from './UserRole';

export class UserProfile {
  readonly id: string;
  displayName: string;
  email: string;
  bio: string;
  private readonly roles: Set<AppRole>;
  private readonly tags: Set<UserTag>;
  private readonly fanPosts: FanPost[] = [];

  constructor(
    id: string,
    displayName: string,
    email: string,
    roles: readonly AppRole[] = ['viewer'],
    bio = '',
    tags: readonly UserTag[] = [],
  ) {
    this.id = id;
    this.displayName = displayName;
    this.email = email;
    this.bio = bio;
    this.roles = new Set<AppRole>(roles.length > 0 ? roles : ['viewer']);
    this.tags = new Set<UserTag>(tags);
  }

  // An anonymous visitor has no profile at all; registering is what makes them a viewer.
  static register(id: string, displayName: string, email: string, bio = ''): UserProfile {
    return new UserProfile(id, displayName, email, ['viewer'], bio);
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

  hasTag(tag: UserTag): boolean {
    return this.tags.has(tag);
  }

  addTag(tag: UserTag): void {
    this.tags.add(tag);
  }

  getTags(): readonly UserTag[] {
    return [...this.tags];
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
