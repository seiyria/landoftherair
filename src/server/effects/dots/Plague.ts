
import { SpellEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { CombatHelper } from '../../helpers/world/combat-helper';
import { Skill } from '../../base/Skill';
import * as dice from 'dice.js';
import { RollerHelper } from '../../../shared/helpers/roller-helper';

export class Plague extends SpellEffect {

  iconData = {
    name: 'death-zone',
    color: '#0a0',
    tooltipDesc: 'Constantly receiving disease damage.'
  };

  maxSkillForSkillGain = 25;
  skillMults = [[0, 1], [6, 1.25], [11, 1.5], [16, 1.75], [21, 2]];

  private critBonus: number;
  private healerCripple: number;

  cast(caster: Character, target: Character, skillRef?: Skill) {

    this.setPotencyAndGainSkill(caster, skillRef);

    const mult = this.getMultiplier();

    const wisCheck = this.getTotalDamageDieSize(caster);
    const totalPotency = Math.floor(mult * this.getTotalDamageRolls(caster));
    const damage = RollerHelper.diceRoll(totalPotency, wisCheck);

    this.duration = this.duration || this.potency;

    const natureSpirit = caster.getTraitLevelAndUsageModifier('NatureSpirit');
    this.critBonus = natureSpirit;

    this.duration += caster.getTraitLevel('NatureSpirit');

    if(caster.getTraitLevel('CripplingPlague')) {
      this.healerCripple = Math.round(this.potency / 5);
    }

    this.effectInfo = { damage, caster: caster.uuid };
    this.flagCasterName(caster.name);
    target.applyEffect(this);
    this.effectMessage(caster, `You poisoned ${target.name}!`);
  }

  effectStart(char: Character) {
    this.effectMessage(char, 'You were poisoned!');

    if(this.healerCripple) {
      this.iconData.tooltipDesc = `${this.iconData.tooltipDesc} Offense/Defense penalty.`;
      this.loseStat(char, 'offense', this.healerCripple);
      this.loseStat(char, 'defense', this.healerCripple);
    }
  }

  effectTick(char: Character) {
    const caster = char.$$room.state.findPlayer(this.effectInfo.caster);

    let isCrit = false;

    if(RollerHelper.XInOneHundred(this.critBonus * 100)) {
      isCrit = true;
    }

    CombatHelper.magicalAttack(caster, char, {
      effect: this,
      atkMsg: `${char.name} is ${isCrit ? 'critically ' : ''}plagued!`,
      defMsg: `You are ${isCrit ? 'critically ' : ''}plagued!`,
      damage: this.effectInfo.damage * (isCrit ? 3 : 1),
      damageClass: 'disease',
      isOverTime: true
    });

  }

  effectEnd(char: Character) {
    this.effectMessage(char, 'Your body expelled the plague.');
  }
}
