
import { NPC } from '../../../shared/models/npc';
import { CommandExecutor } from '../../helpers/command-executor';
import { random, maxBy, sample, clamp, includes, size, extend, uniq, shuffle } from 'lodash';
import { ShieldClasses} from '../../../shared/interfaces/item';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';
import { RollerHelper } from '../../../shared/helpers/roller-helper';
import { MoveHelper } from '../../helpers/character/move-helper';
import { WeaponClasses } from '../../../shared/interfaces/item';

export class DefaultAIBehavior {

  constructor(protected npc: NPC) {}

  protected checkGroundForItems() {

    const npc = this.npc;

    // npcs in rooms with exit points cannot pick up random items
    if(npc.$$room.exitPoint) return;

    if(npc.rightHand && npc.leftHand) return;

    const ground = npc.$$room.state.getGroundItems(npc.x, npc.y);

    if(npc.$$hadRightHandAtSpawn && !npc.rightHand && (!npc.leftHand || !npc.leftHand.twoHanded)) {
      WeaponClasses.forEach(itemClass => {
        if(includes(ShieldClasses, itemClass)) return;

        const items = ground[itemClass];
        if(!items || !items.length) return;

        items.forEach(item => {
          if(npc.rightHand || !item.isOwnedBy || !item.isOwnedBy(npc) || item.binds) return;
          npc.setRightHand(item);
          npc.$$room.removeItemFromGround(item);
        });
      });
    }

    if(!npc.leftHand && (!npc.rightHand || !npc.rightHand.twoHanded)) {
      ShieldClasses.forEach(itemClass => {
        const items = ground[itemClass];
        if(!items || !items.length) return;

        items.forEach(item => {
          if(npc.leftHand || !item.isOwnedBy || !item.isOwnedBy(npc) || item.binds) return;
          npc.setLeftHand(item);
          npc.$$room.removeItemFromGround(item);
        });
      });
    }

  }

  protected findValidAllyInView(skillRef: Skill, skill: string) {
    const npc = this.npc;

    const allies = npc.$$room.state.getAllAlliesInRange(npc, skillRef.range(npc));
    return sample(allies.filter(ally => CommandExecutor.checkIfCanUseSkill(skill, npc, ally)));
  }

  private moveTowardsSimple(npc: NPC, target: { x: number, y: number }, moveRate) {
    const oldX = npc.x;
    const oldY = npc.y;

    const steps = [];
    let stepdiffX = clamp(target.x - npc.x, -moveRate, moveRate);
    let stepdiffY = clamp(target.y - npc.y, -moveRate, moveRate);

    for(let curStep = 0; curStep < moveRate; curStep++) {
      const step = { x: 0, y: 0 };

      if(stepdiffX < 0) {
        step.x = -1;
        stepdiffX++;
      } else if(stepdiffX > 0) {
        step.x = 1;
        stepdiffX--;
      }

      if(stepdiffY < 0) {
        step.y = -1;
        stepdiffY++;
      } else if(stepdiffY > 0) {
        step.y = 1;
        stepdiffY--;
      }

      steps[curStep] = step;

    }

    npc.takeSequenceOfSteps(steps, true);
    const diffX = npc.x - oldX;
    const diffY = npc.y - oldY;

    return { xChange: diffX, yChange: diffY };
  }

  public tick(canMove: boolean, amINearAPlayer?: boolean) {

    const npc = this.npc;

    if(npc.isDead()) return;
    if(npc.hostility === 'Never') return;

    const possibleAgro = npc.agro;

    if(npc.$$owner) {
      extend(possibleAgro, npc.$$owner.agro);
      delete npc.agro[(<any>npc.$$owner).username];
    }

    let diffX = 0;
    let diffY = 0;

    let highestAgro: Character = null;
    let currentTarget: Character = null;

    // onhit with no agro means they don't care
    if(npc.hostility === 'OnHit' && size(possibleAgro) === 0) {
      currentTarget = null;

    // either you have agro, or you can look for a target
    } else {

      let shouldDoTargetting = true;
      if(!amINearAPlayer) shouldDoTargetting = false;

      if(shouldDoTargetting) {
        const targetsInRange = npc.$$room.state.getPossibleTargetsFor(npc, 4);

        highestAgro = maxBy(targetsInRange, (char: Character) => possibleAgro[char.uuid]);
        if(!highestAgro) highestAgro = sample(targetsInRange);

        currentTarget = highestAgro;
      }
    }

    // do movement
    const moveRate = npc.getTotalStat('move');
    let numSteps = random(0, Math.min(moveRate, npc.path ? npc.path.length : moveRate));
    if(numSteps < 0) numSteps = 0;

    if(RollerHelper.OneInX(100)) {
      this.checkGroundForItems();
    }

    let chosenSkill: Skill = null;

    let isThrowing = false;

    let rolledSkills = uniq(npc.$$skillRoller.chooseWithReplacement(3));

    if(npc.$$owner) {
      rolledSkills.unshift(...npc.getBonusUsableSkillsBasedOnOwner());
      rolledSkills = shuffle(rolledSkills);
    }

    rolledSkills.forEach((skill: string) => {
      if(chosenSkill) return;

      if(highestAgro && npc.getAttackDamage(highestAgro, skill) === 0 && npc.getZeroTimes(highestAgro, skill) >= 5) {
        skill = includes(npc.usableSkills, 'Charge') ? 'Charge' : 'Attack';
      }

      if(highestAgro && skill === 'Attack' && npc.rightHand && npc.rightHand.returnsOnThrow) {
        isThrowing = true;
        skill = 'Throw';
      }

      // if it's a buff, it works slightly differently
      const skillRef = CommandExecutor.getSkillRef(skill);
      if(skillRef && skillRef.targetsFriendly) {
        const newTarget = this.findValidAllyInView(skillRef, skill);
        if(!newTarget) return;

        currentTarget = newTarget;
        chosenSkill = skillRef;
        return;
      }

      if(!currentTarget) return;
      chosenSkill = CommandExecutor.checkIfCanUseSkill(skill, npc, currentTarget);
    });

    if(npc.$$interceptor) {
      npc.sendClientMessage(`Tick. Skill chosen: ${chosenSkill ? chosenSkill.name : 'none'}. Has target: ${!!highestAgro || !!currentTarget}`);
    }

    // we have a target
    if(highestAgro) {

      if(npc.path && !npc.$$pathDisrupted) npc.$$pathDisrupted = { x: npc.x, y: npc.y };

      // use a skill that can hit the target
      if(chosenSkill) {
        let opts = {};
        if(isThrowing) opts = { throwHand: 'right' };
        chosenSkill.use(npc, currentTarget, opts);
        npc.mp.sub(chosenSkill.mpCost(npc));

        // either move towards target
      } else if(canMove) {
        const { xChange, yChange } = this.moveTowardsSimple(npc, highestAgro, moveRate);
        diffX = xChange;
        diffY = yChange;
      }

      if(npc.$$stanceCooldown > 0) npc.$$stanceCooldown--;

      // we have a path
    } else if(canMove && npc.path && npc.path.length > 0) {

      let hasMovedAfterPathDisruption = false;

      if(npc.$$pathDisrupted) {

        if(npc.x === npc.$$pathDisrupted.x && npc.y === npc.$$pathDisrupted.y) {
          npc.$$pathDisrupted = null;

        } else {
          const didMoveHappen = MoveHelper.move(npc, {
            x: npc.$$pathDisrupted.x - npc.x,
            y: npc.$$pathDisrupted.y - npc.y,
            room: npc.$$room,
            gameState: npc.$$room.state
          });

          if(didMoveHappen) hasMovedAfterPathDisruption = true;
        }
      }

      if(!hasMovedAfterPathDisruption && !npc.$$pathDisrupted) {
        const steps = [];

        for(let i = 0; i < numSteps; i++) {
          const step = npc.path.shift();
          diffX += step.x;
          diffY += step.y;

          steps.push(step);
        }

        npc.takeSequenceOfSteps(steps);

        if(!npc.path.length) {
          npc.spawner.assignPath(npc);
        }
      }

      // we wander
    } else if(canMove) {
      const oldX = npc.x;
      const oldY = npc.y;
      const steps = Array(numSteps).fill(null).map(() => ({ x: random(-1, 1), y: random(-1, 1) }));
      npc.takeSequenceOfSteps(steps);
      diffX = npc.x - oldX;
      diffY = npc.y - oldY;
    }

    if(!highestAgro && chosenSkill && currentTarget) {
      chosenSkill.use(npc, currentTarget);
      npc.mp.sub(chosenSkill.mpCost(npc));
    }


    // change dir
    if(diffX || diffY) npc.setDirBasedOnXYDiff(diffX, diffY);


    if(npc.$$owner) {
      const distFrom = npc.distFrom(npc.$$owner);

      if(distFrom > 4) {
        npc.x = npc.$$owner.x;
        npc.y = npc.$$owner.y;
      }

    } else {

      // check if should leash
      const distFrom = npc.distFrom(npc.spawner);

      // if we have no path AND no target and its out of the random walk radius, or we're past the leash radius, we leash

      const noLeash = !npc.path;

      if(noLeash
        && ((!currentTarget && npc.spawner.randomWalkRadius >= 0 && distFrom > npc.spawner.randomWalkRadius)
          || (npc.spawner.leashRadius >= 0 && distFrom > npc.spawner.leashRadius))) {

        npc.sendLeashMessage();

        npc.x = npc.spawner.x;
        npc.y = npc.spawner.y;

        // chasing a player, probably - leash, fix hp, fix agro
        if(distFrom > npc.spawner.leashRadius + 4) {
          npc.hp.toMaximum();
          npc.mp.toMaximum();
          npc.resetAgro(true);
        }

        // if we had a path, re-assign a path
        if(npc.path && npc.path.length > 0) {
          npc.spawner.assignPath(npc);
        }
      }
    }

  }
}
