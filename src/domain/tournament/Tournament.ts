import type { Playable } from './Playable';

export class Tournament implements Playable {
  readonly id: string;
  readonly name: string;
  readonly tournamentNumber: number;

  constructor(id: string, name: string, tournamentNumber: number) {
    this.id = id;
    this.name = name;
    this.tournamentNumber = tournamentNumber;
  }

  play(): void {
    // Domain placeholder for future playable tournament behavior.
  }
}
