export class Sponsor {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly logoUrl: string;

  constructor(id: string, name: string, tagline: string, logoUrl: string) {
    this.id = id;
    this.name = name;
    this.tagline = tagline;
    this.logoUrl = logoUrl;
  }
}
