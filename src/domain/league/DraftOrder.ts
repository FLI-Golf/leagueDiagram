export class DraftOrderEntry {
  readonly userId: string;
  readonly pickNumber: number;

  constructor(userId: string, pickNumber: number) {
    this.userId = userId;
    this.pickNumber = pickNumber;
  }
}

import { DraftControlSettings } from '../draft/DraftControlSettings';

export class DraftOrder {
  readonly tournamentId: string;
  readonly order: readonly DraftOrderEntry[];
  readonly controls: DraftControlSettings;

  constructor(tournamentId: string, order: readonly string[], controls: DraftControlSettings = new DraftControlSettings(60, 'ascending')) {
    this.tournamentId = tournamentId;
    this.order = order.map((userId, index) => new DraftOrderEntry(userId, index + 1));
    this.controls = controls;
  }

  getUserIds(): readonly string[] {
    return this.order.map((entry) => entry.userId);
  }
}
