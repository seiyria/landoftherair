
import { startsWith } from 'lodash';

import { Skill } from '../../../../../base/Skill';
import { Character, SkillClassNames } from '../../../../../../models/character';
import { Cure as CastEffect } from '../../../../../effects/Cure';

export class Cure extends Skill {

  public name = 'cure';
  public format = 'Target';

  static macroMetadata = {
    name: 'Cure',
    macro: 'cure',
    icon: 'tentacle-heart',
    color: '#080',
    mode: 'clickToTarget'
  };

  flagSkills = [SkillClassNames.Restoration];

  mpCost = () => 5;
  range = () => 5;

  execute(user: Character, { gameState, args }) {
    const range = this.range();

    let target = user;

    if(args) {
      const possTargets = user.$$room.getPossibleMessageTargets(user, args);
      target = possTargets[0];
      if(!target) return user.sendClientMessage('You do not see that person.');

      if(target.distFrom(user) > range) return user.sendClientMessage('That target is too far away!');
    }

    const cost = this.mpCost();

    if(user.mp.getValue() < cost) return user.sendClientMessage('You do not have enough MP!');
    user.mp.sub(cost);

    this.use(user, target);
  }

  use(user: Character, target: Character) {
    const effect = new CastEffect({});
    effect.cast(user, target, this);
  }

}
