export type PlayerGender = 'male' | 'female';

export type ProPlayerSeed = {
  id: string;
  displayName: string;
  email: string;
  gender: PlayerGender;
};

export class ProPlayer {
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

  static fromSeed(seed: ProPlayerSeed): ProPlayer {
    return new ProPlayer(seed.id, seed.displayName, seed.email, seed.gender);
  }
}

export { ProPlayer as Player };
