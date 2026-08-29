import { Player } from '../player/Player';
import { DraftControlSettings, DraftGender } from './DraftControlSettings';
import { DraftSelection } from './DraftSelection';

export class Draft {
  readonly id: string;
  readonly name: string;
  private readonly selections: DraftSelection[] = [];
  private controls?: DraftControlSettings;
  private genderCheckHistory: Array<{ round: number; gender: DraftGender }> = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  select(player: Player): void {
    if (this.selections.some((selection) => selection.player.id === player.id)) {
      throw new Error('A player cannot be selected twice in the same draft.');
    }

    const pickNumber = this.selections.length + 1;
    const round = Math.ceil(pickNumber / 2);
    this.selections.push(new DraftSelection(player, round, pickNumber));
  }

  recordSelection(player: Player, round: number): void {
    if (this.controls?.genderCheck?.enabled && this.controls.genderCheck.rounds.includes(round)) {
      const expectedGender = this.controls.genderCheck.requiredGenderSequence[this.genderCheckHistory.length % this.controls.genderCheck.requiredGenderSequence.length];
      if (player.gender !== expectedGender) {
        throw new Error(`Draft gender check failed for round ${round}. Expected ${expectedGender}.`);
      }
    }

    this.genderCheckHistory.push({ round, gender: player.gender });
    this.select(player);
  }

  setControls(controls: DraftControlSettings): void {
    this.controls = controls;
  }

  getControls(): DraftControlSettings {
    if (!this.controls) {
      return new DraftControlSettings(60, 'ascending');
    }

    return this.controls;
  }

  canSelectGender(round: number, gender: DraftGender): boolean {
    if (!this.controls?.genderCheck?.enabled || !this.controls.genderCheck.rounds.includes(round)) {
      return true;
    }

    const sequence = this.controls.genderCheck.requiredGenderSequence;
    const requiredIndex = round - this.controls.genderCheck.rounds[0];
    const expectedGender = sequence[requiredIndex % sequence.length];
    return gender === expectedGender;
  }

  getGenderCheckStatus(): 'pass' | 'fail' | 'pending' {
    if (!this.controls?.genderCheck?.enabled) {
      return 'pending';
    }

    return this.genderCheckHistory.length === 0 ? 'pending' : 'pass';
  }

  getSelections(): readonly DraftSelection[] {
    return [...this.selections];
  }

  getCurrentRound(): number {
    return this.selections.length === 0 ? 1 : Math.ceil(this.selections.length / 2);
  }
}
