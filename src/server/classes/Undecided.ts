
import { BaseClass } from '../base/BaseClass';
import { Character } from '../../models/character';

export class Undecided extends BaseClass {
  static combatDivisor = 5;
  static willDivisor = 4;

  static becomeClass(character: Character) {

  }
}
