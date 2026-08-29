export type PlayerGender = 'male' | 'female';

export class Player {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly gender: PlayerGender;

  constructor(id: string, displayName: string, email: string, gender: PlayerGender = 'male') {
    this.id = id;
    this.displayName = displayName;
    this.email = email;
    this.gender = gender;
  }
}
