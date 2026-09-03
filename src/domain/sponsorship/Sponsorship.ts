import { Sponsor } from '../course/Sponsor';

// Tiers rank spend: a season has one title sponsor, then presenting, then official partners.
export type SponsorshipTier = 'title' | 'presenting' | 'official' | 'supporting';

export type SponsorshipScope = 'season' | 'tournament' | 'course' | 'hole' | 'pro' | 'team' | 'broadcast';

export type SponsorshipStatus = 'loi' | 'signed' | 'active';

export class Sponsorship {
  readonly id: string;
  readonly sponsor: Sponsor;
  readonly tier: SponsorshipTier;
  readonly scope: SponsorshipScope;
  readonly scopeId: string;
  readonly scopeName: string;
  readonly amount: number;
  readonly status: SponsorshipStatus;

  constructor(
    id: string,
    sponsor: Sponsor,
    tier: SponsorshipTier,
    scope: SponsorshipScope,
    scopeId: string,
    scopeName: string,
    amount: number,
    status: SponsorshipStatus = 'signed',
  ) {
    if (amount < 0) {
      throw new Error('A sponsorship amount cannot be negative.');
    }

    this.id = id;
    this.sponsor = sponsor;
    this.tier = tier;
    this.scope = scope;
    this.scopeId = scopeId;
    this.scopeName = scopeName;
    this.amount = amount;
    this.status = status;
  }

  getLabel(): string {
    return `${this.sponsor.name} — ${this.scopeName}`;
  }
}

export class SponsorshipProgram {
  private readonly sponsorships: Sponsorship[] = [];

  constructor(sponsorships: readonly Sponsorship[] = []) {
    sponsorships.forEach((sponsorship) => this.add(sponsorship));
  }

  add(sponsorship: Sponsorship): Sponsorship {
    if (sponsorship.tier === 'title' && sponsorship.scope === 'season' && this.getTitleSponsorship()) {
      throw new Error('A season can only have one title sponsor.');
    }

    this.sponsorships.push(sponsorship);
    return sponsorship;
  }

  getTitleSponsorship(): Sponsorship | undefined {
    return this.sponsorships.find((entry) => entry.tier === 'title' && entry.scope === 'season');
  }

  getByScope(scope: SponsorshipScope): readonly Sponsorship[] {
    return this.sponsorships.filter((entry) => entry.scope === scope);
  }

  getByTier(tier: SponsorshipTier): readonly Sponsorship[] {
    return this.sponsorships.filter((entry) => entry.tier === tier);
  }

  getForSponsor(sponsorId: string): readonly Sponsorship[] {
    return this.sponsorships.filter((entry) => entry.sponsor.id === sponsorId);
  }

  getAll(): readonly Sponsorship[] {
    return [...this.sponsorships];
  }

  getTotalValue(): number {
    return this.sponsorships.reduce((total, entry) => total + entry.amount, 0);
  }

  getRanked(): readonly Sponsorship[] {
    return [...this.sponsorships].sort((left, right) => right.amount - left.amount);
  }

  // The title sponsor is expected to be the largest commitment in the program.
  isTitleSponsorPrincipal(): boolean {
    const title = this.getTitleSponsorship();
    if (!title) {
      return false;
    }

    return this.sponsorships.every((entry) => entry.id === title.id || entry.amount <= title.amount);
  }
}
