
import { NPC } from '../../../shared/models/npc';
import { CommandExecutor } from '../../helpers/command-executor';
import { random, sumBy, maxBy, sample, sampleSize, clamp, size } from 'lodash';
import { NPCLoader } from '../../helpers/npc-loader';
import { Player } from '../../../shared/models/player';
import { MoveHelper } from '../../helpers/move-helper';

export const tick = (npc: NPC) => {

  if(npc.isDead()) return;
  if(npc.hostility === 'Never') return;

  let diffX = 0;
  let diffY = 0;

  const targetsInRange = npc.$$room.state.getPlayersInRange(npc, 5);

  let target = null;
  targetsInRange.forEach((possibleTarget: Player) => {
    if(!NPCLoader.checkPlayerHeldItemEitherHand(possibleTarget, 'Steffen LostChild Doll')) return;
    target = possibleTarget;
  });

  npc.$$following = !!target;

  let responses = [];

  // do movement
  const moveRate = npc.getTotalStat('move');

  // we see someone with a doll
  if(target) {
    MoveHelper.move(npc, { x: target.x - npc.x, y: target.y - npc.y, room: npc.$$room, gameState: npc.$$room.state });

    responses = [
      `Thanks for taking me ${target.sex === 'M' ? 'mister' : 'miss'}!`,
      'Are you sure you know where you\'re going?',
      'Are we there yet?'
    ];

  // wander
  } else {
    const oldX = npc.x;
    const oldY = npc.y;
    const numSteps = random(0, moveRate);
    const steps = Array(numSteps).fill(null).map(() => ({ x: random(-1, 1), y: random(-1, 1) }));
    npc.takeSequenceOfSteps(steps);
    diffX = npc.x - oldX;
    diffY = npc.y - oldY;

    responses = [
      `Someone please help me get home!`,
      '*sob*',
      'Is anyone there...?'
    ];

  }

  // spam view chat for fun
  if(random(1, 7) === 1) {
    let response = sample(responses);

    if(responses.length > 1 && response === npc.$$lastResponse) {
      do {
        response = sample(responses);
      } while(response === npc.$$lastResponse);
    }

    npc.$$lastResponse = response;
    const msgObject = { name: npc.name, message: response, subClass: 'chatter' };
    npc.sendClientMessageToRadius(msgObject, 8);
  }

  // change dir
  npc.setDirBasedOnXYDiff(diffX, diffY);

  // check if should leash
  const distFrom = npc.distFrom(npc.spawner);

  if(npc.spawner.leashRadius >= 0 && distFrom > npc.spawner.leashRadius) {
    npc.sendLeashMessage();

    npc.x = npc.spawner.x;
    npc.y = npc.spawner.y;
  }

};
